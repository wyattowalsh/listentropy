import { create } from 'zustand'

import type { AudioTraitCoverage, AudioTraitSnapshot, AudioTraitVector, LabDatasetSnapshot, ProviderCapabilityStatus, SpotifyApiCapabilities } from '@/lib/types'
import { createSpotifyAudioTraitProvider } from '@/lib/audio-traits/providers/spotify/provider'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

export type AudioTraitSnapshotStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error'

interface AudioTraitLastFetchMeta {
  datasetFingerprint: string
  status: AudioTraitSnapshotStatus
  fetchedAt: string
  message?: string
}

interface AudioTraitStoreState {
  providerId: 'spotify-audio-traits'
  snapshotByDatasetFingerprint: Record<string, AudioTraitSnapshot>
  statusByDatasetFingerprint: Record<string, AudioTraitSnapshotStatus>
  errorByDatasetFingerprint: Record<string, string | null>
  lastFetchMeta: AudioTraitLastFetchMeta | null
  capabilityStatus: ProviderCapabilityStatus
  ensureSnapshotForDataset: (dataset: LabDatasetSnapshot, options?: { force?: boolean }) => Promise<AudioTraitSnapshot | null>
  clearSnapshot: (datasetFingerprint: string) => void
}

const spotifyProvider = createSpotifyAudioTraitProvider()

interface TraitJoinPreparation {
  uniqueTrackIds: string[]
  recordRowsTotal: number
  musicRowsEligible: number
  rowsWithTrackUri: number
  podcastRowsExcluded: number
  localRowsExcluded: number
  trackIdByRowIndex: Array<string | null>
}

function extractSpotifyTrackId(uri: string | null | undefined): string | null {
  if (!uri) {
    return null
  }
  if (!uri.startsWith('spotify:track:')) {
    return null
  }
  const parts = uri.split(':')
  const id = parts[2]
  if (!id || id === 'local') {
    return null
  }
  return id
}

function prepareTraitJoin(dataset: LabDatasetSnapshot): TraitJoinPreparation {
  const unique = new Set<string>()
  let musicRowsEligible = 0
  let rowsWithTrackUri = 0
  let podcastRowsExcluded = 0
  let localRowsExcluded = 0
  const trackIdByRowIndex: Array<string | null> = []

  for (const record of dataset.records) {
    const isPodcastLike = record.content_type !== 'music' || Boolean(record.spotify_episode_uri) || Boolean(record.episode_name)
    if (isPodcastLike) {
      podcastRowsExcluded += 1
      trackIdByRowIndex.push(null)
      continue
    }
    musicRowsEligible += 1
    const rawUri = record.spotify_track_uri
    if (rawUri?.startsWith('spotify:local:')) {
      localRowsExcluded += 1
    }
    const trackId = extractSpotifyTrackId(rawUri)
    if (trackId) {
      rowsWithTrackUri += 1
      unique.add(trackId)
      trackIdByRowIndex.push(trackId)
    } else {
      trackIdByRowIndex.push(null)
    }
  }

  return {
    uniqueTrackIds: [...unique],
    recordRowsTotal: dataset.records.length,
    musicRowsEligible,
    rowsWithTrackUri,
    podcastRowsExcluded,
    localRowsExcluded,
    trackIdByRowIndex,
  }
}

function buildCoverage(
  prep: TraitJoinPreparation,
  dataset: LabDatasetSnapshot,
  traitsByTrackId: Record<string, { traits: AudioTraitVector }>,
): AudioTraitCoverage {
  let rowsMatchedToTrait = 0
  for (let index = 0; index < dataset.records.length; index += 1) {
    const trackId = prep.trackIdByRowIndex[index]
    if (trackId && traitsByTrackId[trackId]) {
      rowsMatchedToTrait += 1
    }
  }

  const uniqueTrackIdsRequested = prep.uniqueTrackIds.length
  const uniqueTrackIdsResolved = prep.uniqueTrackIds.filter((id) => Boolean(traitsByTrackId[id])).length

  return {
    recordRowsTotal: prep.recordRowsTotal,
    musicRowsEligible: prep.musicRowsEligible,
    rowsWithTrackUri: prep.rowsWithTrackUri,
    rowsMatchedToTrait,
    rowsCoverageShare: prep.rowsWithTrackUri > 0 ? rowsMatchedToTrait / prep.rowsWithTrackUri : 0,
    uniqueTrackIdsRequested,
    uniqueTrackIdsResolved,
    uniqueTrackCoverageShare: uniqueTrackIdsRequested > 0 ? uniqueTrackIdsResolved / uniqueTrackIdsRequested : 0,
    podcastRowsExcluded: prep.podcastRowsExcluded,
    localRowsExcluded: prep.localRowsExcluded,
  }
}

export const useAudioTraitStore = create<AudioTraitStoreState>((set, get) => ({
  providerId: 'spotify-audio-traits',
  snapshotByDatasetFingerprint: {},
  statusByDatasetFingerprint: {},
  errorByDatasetFingerprint: {},
  lastFetchMeta: null,
  capabilityStatus: 'unknown',
  ensureSnapshotForDataset: async (dataset, options) => {
    const datasetFingerprint = dataset.datasetIdentity.fingerprint
    const currentStatus = get().statusByDatasetFingerprint[datasetFingerprint]
    if (!options?.force && currentStatus === 'ready' && get().snapshotByDatasetFingerprint[datasetFingerprint]) {
      return get().snapshotByDatasetFingerprint[datasetFingerprint]
    }

    set((state) => ({
      statusByDatasetFingerprint: {
        ...state.statusByDatasetFingerprint,
        [datasetFingerprint]: 'loading',
      },
      errorByDatasetFingerprint: {
        ...state.errorByDatasetFingerprint,
        [datasetFingerprint]: null,
      },
    }))

    const auth = useSpotifyAuthStore.getState()
    const accessToken = await auth.ensureValidAccessToken()
    if (!accessToken) {
      set((state) => ({
        statusByDatasetFingerprint: {
          ...state.statusByDatasetFingerprint,
          [datasetFingerprint]: 'unsupported',
        },
        errorByDatasetFingerprint: {
          ...state.errorByDatasetFingerprint,
          [datasetFingerprint]: 'Connect Spotify or provide a manual token to prepare audio trait enrichment.',
        },
        capabilityStatus: 'unauthorized',
        lastFetchMeta: {
          datasetFingerprint,
          status: 'unsupported',
          fetchedAt: new Date().toISOString(),
          message: 'No Spotify access token available.',
        },
      }))
      return null
    }

    const prep = prepareTraitJoin(dataset)
    const providerResult = await spotifyProvider.fetchTraitSnapshot({
      datasetFingerprint,
      trackIds: prep.uniqueTrackIds,
      accessToken,
      tokenSource: auth.session?.tokenSource ?? 'unknown',
      scopes: auth.session?.scopes,
    })

    const capabilityStatus = (providerResult.capabilities as SpotifyApiCapabilities).audioFeatures ?? 'unknown'

    if (providerResult.status !== 'ready' && providerResult.status !== 'partial') {
      set((state) => ({
        statusByDatasetFingerprint: {
          ...state.statusByDatasetFingerprint,
          [datasetFingerprint]: providerResult.status === 'unsupported' ? 'unsupported' : 'error',
        },
        errorByDatasetFingerprint: {
          ...state.errorByDatasetFingerprint,
          [datasetFingerprint]: providerResult.message,
        },
        capabilityStatus,
        lastFetchMeta: {
          datasetFingerprint,
          status: providerResult.status === 'unsupported' ? 'unsupported' : 'error',
          fetchedAt: providerResult.provenance.fetchedAt,
          message: providerResult.message,
        },
      }))
      return null
    }

    const traitsByTrackId = providerResult.traitsByTrackId ?? {}
    const coverage = buildCoverage(prep, dataset, traitsByTrackId)
    const snapshot: AudioTraitSnapshot = {
      providerId: 'spotify-audio-traits',
      datasetFingerprint,
      traitsByTrackId,
      coverage,
      capabilities: providerResult.capabilities,
      warnings: [
        ...providerResult.warnings,
        ...(coverage.rowsCoverageShare < 0.35 ? ['Low row-level audio trait coverage; centroid summaries may not represent the full dataset.'] : []),
      ],
      provenance: providerResult.provenance,
    }

    set((state) => ({
      snapshotByDatasetFingerprint: {
        ...state.snapshotByDatasetFingerprint,
        [datasetFingerprint]: snapshot,
      },
      statusByDatasetFingerprint: {
        ...state.statusByDatasetFingerprint,
        [datasetFingerprint]: 'ready',
      },
      errorByDatasetFingerprint: {
        ...state.errorByDatasetFingerprint,
        [datasetFingerprint]: null,
      },
      capabilityStatus,
      lastFetchMeta: {
        datasetFingerprint,
        status: 'ready',
        fetchedAt: snapshot.provenance.fetchedAt,
        message: providerResult.message,
      },
    }))

    return snapshot
  },
  clearSnapshot: (datasetFingerprint) =>
    set((state) => {
      const nextSnapshots = { ...state.snapshotByDatasetFingerprint }
      const nextStatus = { ...state.statusByDatasetFingerprint }
      const nextErrors = { ...state.errorByDatasetFingerprint }
      delete nextSnapshots[datasetFingerprint]
      delete nextStatus[datasetFingerprint]
      delete nextErrors[datasetFingerprint]
      return {
        snapshotByDatasetFingerprint: nextSnapshots,
        statusByDatasetFingerprint: nextStatus,
        errorByDatasetFingerprint: nextErrors,
      }
    }),
}))

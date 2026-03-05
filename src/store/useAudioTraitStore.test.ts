import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'
import { useAudioTraitStore } from '@/store/useAudioTraitStore'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

afterEach(() => {
  vi.restoreAllMocks()
})

function resetStores(): void {
  useAudioTraitStore.setState({
    providerId: 'spotify-audio-traits',
    snapshotByDatasetFingerprint: {},
    statusByDatasetFingerprint: {},
    errorByDatasetFingerprint: {},
    lastFetchMeta: null,
    capabilityStatus: 'unknown',
  })
  useSpotifyAuthStore.setState({
    status: 'disconnected',
    session: null,
    error: null,
  })
}

describe('useAudioTraitStore', () => {
  beforeEach(() => {
    resetStores()
  })

  it('prepares a snapshot without requiring ensureValidAccessToken beforehand', async () => {
    const snapshot = makeSyntheticLabSnapshot()
    const trackId = snapshot.records.find((row) => row.spotify_track_uri)?.spotify_track_uri?.split(':')[2] ?? '0'
    const ensureValidAccessTokenSpy = vi.spyOn(useSpotifyAuthStore.getState(), 'ensureValidAccessToken')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        data: {
          features: [{
            id: trackId,
            danceability: 0.6,
            energy: 0.7,
            valence: 0.4,
            acousticness: 0.2,
            instrumentalness: 0.1,
            speechiness: 0.05,
            tempo: 128,
            liveness: 0.25,
          }],
          requestStats: {
            requestedUniqueTrackIds: 1,
            cappedUniqueTrackIds: 1,
            truncatedTrackIds: 0,
            requestChunkCount: 1,
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await useAudioTraitStore.getState().ensureSnapshotForDataset(snapshot)

    expect(ensureValidAccessTokenSpy).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/spotify/enrichment/audio-features',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(useSpotifyAuthStore.getState().status).toBe('disconnected')
    expect(useSpotifyAuthStore.getState().session).toBeNull()
    expect(result).toBeTruthy()
    expect(useAudioTraitStore.getState().statusByDatasetFingerprint[snapshot.datasetIdentity.fingerprint]).toBe('ready')
    expect(useAudioTraitStore.getState().capabilityStatus).toBe('available')
  })

  it('builds and caches an audio trait snapshot with coverage', async () => {
    const snapshot = makeSyntheticLabSnapshot()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        data: {
          features: [{
            id: snapshot.records.find((row) => row.spotify_track_uri)?.spotify_track_uri?.split(':')[2] ?? '0',
            danceability: 0.6,
            energy: 0.7,
            valence: 0.4,
            acousticness: 0.2,
            instrumentalness: 0.1,
            speechiness: 0.05,
            tempo: 128,
            liveness: 0.25,
          }],
          requestStats: {
            requestedUniqueTrackIds: 1,
            cappedUniqueTrackIds: 1,
            truncatedTrackIds: 0,
            requestChunkCount: 1,
          },
        },
      }),
    }))

    const built = await useAudioTraitStore.getState().ensureSnapshotForDataset(snapshot)
    expect(built).toBeTruthy()
    if (!built) {
      return
    }
    expect(built.datasetFingerprint).toBe(snapshot.datasetIdentity.fingerprint)
    expect(built.coverage.recordRowsTotal).toBe(snapshot.records.length)
    expect(Object.keys(built.traitsByTrackId).length).toBeGreaterThan(0)
    expect((built as unknown as { accessToken?: string }).accessToken).toBeUndefined()

    const cached = await useAudioTraitStore.getState().ensureSnapshotForDataset(snapshot)
    expect(cached).toBe(built)
  })
})

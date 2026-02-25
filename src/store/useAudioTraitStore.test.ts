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

  it('returns unsupported when no Spotify token is available', async () => {
    const snapshot = makeSyntheticLabSnapshot()
    const result = await useAudioTraitStore.getState().ensureSnapshotForDataset(snapshot)

    expect(result).toBeNull()
    expect(useAudioTraitStore.getState().statusByDatasetFingerprint[snapshot.datasetIdentity.fingerprint]).toBe('unsupported')
    expect(useAudioTraitStore.getState().capabilityStatus).toBe('unauthorized')
  })

  it('builds and caches an audio trait snapshot with coverage', async () => {
    const snapshot = makeSyntheticLabSnapshot()
    useSpotifyAuthStore.getState().setManualToken('token')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        audio_features: [{
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

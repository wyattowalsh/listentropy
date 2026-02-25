import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSpotifyAudioTraitProvider } from '@/lib/audio-traits/providers/spotify/provider'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('spotify audio trait provider', () => {
  it('returns ready and normalizes traits when audio-features endpoint succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        audio_features: [{
          id: 'abc',
          danceability: 0.7,
          energy: 0.8,
          valence: 0.4,
          acousticness: 0.2,
          instrumentalness: 0.1,
          speechiness: 0.05,
          tempo: 120,
          liveness: 0.3,
        }],
      }),
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'token',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('ready')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('available')
    expect(result.traitsByTrackId?.abc?.traits.danceability).toBe(0.7)
    expect(result.traitsByTrackId?.abc?.traits.tempo).toBeGreaterThan(0)
  })

  it('maps restricted endpoint responses to unsupported with restricted capability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'token',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('unsupported')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('restricted')
    expect(result.message).toMatch(/restricted/i)
  })

  it('surfaces a warning when track IDs are capped before audio feature fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        audio_features: [],
      }),
    }))

    const trackIds = Array.from({ length: 5_010 }, (_, index) => `track-${index}`)
    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds,
      accessToken: 'token',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('ready')
    expect(result.warnings.some((warning) => /capp?ed|limit|truncat/i.test(warning))).toBe(true)
    expect(result.provenance.endpointNotes?.some((note) => /5,?010|5,?000|truncat|limit/i.test(note))).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSpotifyAudioTraitProvider } from '@/lib/audio-traits/providers/spotify/provider'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('spotify audio trait provider', () => {
  it('returns ready through the backend proxy even without a user access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        data: {
          features: [{
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
          requestStats: {
            requestedUniqueTrackIds: 1,
            cappedUniqueTrackIds: 1,
            truncatedTrackIds: 0,
            requestChunkCount: 1,
          },
        },
      }),
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: '',
      tokenSource: 'unknown',
    })

    expect(result.status).toBe('ready')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('available')
    expect(result.traitsByTrackId?.abc?.traits.danceability).toBe(0.7)
    expect(result.traitsByTrackId?.abc?.traits.tempo).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith(
      '/api/spotify/enrichment/audio-features',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('maps restricted endpoint responses to unsupported when optional fallback token is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: '',
      tokenSource: 'unknown',
    })

    expect(result.status).toBe('unsupported')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('restricted')
    expect(result.message).toMatch(/restricted/i)
  })

  it('uses optional token fallback when the backend proxy is restricted', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio_features: [{
            id: 'abc',
            danceability: 0.61,
            energy: 0.74,
            valence: 0.52,
            acousticness: 0.14,
            instrumentalness: 0.03,
            speechiness: 0.04,
            tempo: 124.3,
            liveness: 0.11,
          }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'manual-token-value',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('ready')
    expect(result.message).toMatch(/fallback/i)
    expect(result.warnings.some((warning) => /fallback/i.test(warning))).toBe(true)
    expect(result.traitsByTrackId?.abc?.traits.energy).toBe(0.74)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/api\.spotify\.com\/v1\/audio-features/)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: {
        Authorization: 'Bearer manual-token-value',
      },
    })
  })

  it('maps 401 proxy responses to unsupported with unauthorized capability when fallback token is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: '',
      tokenSource: 'unknown',
    })

    expect(result.status).toBe('unsupported')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('unauthorized')
    expect(result.message).toMatch(/401|rejected/i)
  })

  it('maps 429 responses to rate-limited capability and preserves Retry-After context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === 'Retry-After' ? '12' : null) },
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'token',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('error')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('rate-limited')
    expect(result.message).toMatch(/429|rate limit/i)
    expect(result.provenance.endpointNotes?.some((note) => /Retry-After 12s/i.test(note))).toBe(true)
  })

  it('maps unavailable upstream responses to an unavailable error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => null },
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'token',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('error')
    expect(result.message).toMatch(/unavailable|503/i)
  })

  it('surfaces a warning when track IDs are capped before audio feature fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        data: {
          features: [],
          requestStats: {
            requestedUniqueTrackIds: 5_010,
            cappedUniqueTrackIds: 5_000,
            truncatedTrackIds: 10,
            requestChunkCount: 50,
          },
        },
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

  it('reports unknown capabilities before enrichment is attempted', async () => {
    const provider = createSpotifyAudioTraitProvider()
    const capabilities = await provider.getCapabilities()
    expect('audioFeatures' in capabilities ? capabilities.audioFeatures : capabilities.audioTraits).toBe('unknown')
  })

  it('returns a ready no-op result when there are no eligible track ids', async () => {
    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: [],
      accessToken: '',
      tokenSource: 'unknown',
    })

    expect(result.status).toBe('ready')
    expect(result.traitsByTrackId).toEqual({})
    expect(result.warnings.some((warning) => /no eligible spotify .*track/i.test(warning))).toBe(true)
  })

  it('adds fallback cap notes when optional token fallback truncates request ids', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          audio_features: [],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const trackIds = Array.from({ length: 5_010 }, (_, index) => `track-${index}`)
    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds,
      accessToken: 'manual-token-value',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('ready')
    expect(result.provenance.endpointNotes?.some((note) => /fallback cap applied/i.test(note))).toBe(true)
    expect(result.provenance.endpointNotes?.some((note) => /5,?010|5,?000/i.test(note))).toBe(true)
  })

  it('maps fallback 404 responses to unsupported with restricted capability', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => null },
      })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'manual-token-value',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('unsupported')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('restricted')
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings[1]).toMatch(/404|restricted/i)
  })

  it('preserves fallback Retry-After context when fallback receives 429', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name === 'Retry-After' ? '7' : null) },
      })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'manual-token-value',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('error')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('rate-limited')
    expect(result.warnings[1]).toMatch(/429|rate limit/i)
    expect(result.provenance.endpointNotes?.some((note) => /Fallback Retry-After 7s/i.test(note))).toBe(true)
  })

  it('surfaces unexpected fallback failures that are not HTTP errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => null },
      })
      .mockRejectedValueOnce(new Error('fallback network exploded'))
    vi.stubGlobal('fetch', fetchMock)

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'manual-token-value',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('error')
    expect(result.message).toBe('fallback network exploded')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('restricted')
    expect(result.warnings[1]).toMatch(/Unexpected Spotify fallback failure/i)
  })

  it('surfaces unexpected non-http provider failures from proxy fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('proxy network exploded')))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: 'manual-token-value',
      tokenSource: 'manual-token',
    })

    expect(result.status).toBe('error')
    expect(result.message).toBe('proxy network exploded')
    expect(result.warnings[0]).toMatch(/Unexpected Spotify provider failure/i)
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('unknown')
  })

  it('maps bad-request proxy responses to an error without unsupported status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
    }))

    const provider = createSpotifyAudioTraitProvider()
    const result = await provider.fetchTraitSnapshot({
      datasetFingerprint: 'fp',
      trackIds: ['abc'],
      accessToken: '',
      tokenSource: 'unknown',
    })

    expect(result.status).toBe('error')
    expect('audioFeatures' in result.capabilities ? result.capabilities.audioFeatures : result.capabilities.audioTraits).toBe('unknown')
    expect(result.message).toMatch(/400|invalid/i)
  })
})

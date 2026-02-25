import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/client'

import { fetchSpotifyAudioFeatureProfile } from './spotify-api'

function feature(id: string) {
  return {
    id,
    danceability: 0.5,
    energy: 0.6,
    valence: 0.4,
    acousticness: 0.2,
    instrumentalness: 0.1,
    speechiness: 0.05,
    tempo: 120,
    liveness: 0.3,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchSpotifyAudioFeatureProfile', () => {
  it('fetches features in chunks and aggregates dimensions', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ audio_features: [feature('a')] }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audio_features: [feature('a')] }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audio_features: [feature('b')] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const uris = Array.from({ length: 101 }, (_, index) => `spotify:track:${index}`)
    const result = await fetchSpotifyAudioFeatureProfile('token', uris)

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(result.fetchedTrackCount).toBe(2)
    expect(result.dimensions.some((item) => item.key === 'tempo')).toBe(true)
  })

  it('throws an endpoint-aware SpotifyApiHttpError when audio-features returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => null },
      }),
    )

    let thrown: unknown
    try {
      await fetchSpotifyAudioFeatureProfile('bad-token', ['spotify:track:abc'])
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SpotifyApiHttpError)
    expect(thrown).toMatchObject({
      status: 401,
      endpoint: 'audio-features',
    })
    expect((thrown as Error).message).toContain('401')
    expect((thrown as Error).message).toContain('audio-features')
  })

  it('propagates Retry-After on rate-limited audio-features responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name === 'Retry-After' ? '17' : null) },
      }),
    )

    let thrown: unknown
    try {
      await fetchSpotifyAudioFeatureProfile('token', ['spotify:track:abc'])
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SpotifyApiHttpError)
    expect(thrown).toMatchObject({
      status: 429,
      endpoint: 'audio-features',
      retryAfterSeconds: 17,
    })
  })

  it('keeps audio feature results when artist enrichment fails', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio_features: [feature('a')] }),
      })
      .mockRejectedValueOnce(new Error('tracks endpoint unavailable'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSpotifyAudioFeatureProfile('token', ['spotify:track:abc'])
    expect(result.fetchedTrackCount).toBe(1)
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it('adds genre affinity and neighborhood metrics when artist enrichment succeeds', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio_features: [feature('a')] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tracks: [
            {
              id: 'abc',
              artists: [{ id: 'artist-1', name: 'Artist 1' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [
            { id: 'artist-1', name: 'Artist 1', genres: ['alt-pop', 'indie pop'], popularity: 72 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [{ id: 'artist-1', name: 'Artist 1', genres: ['alt-pop'], popularity: 70 }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSpotifyAudioFeatureProfile('token', ['spotify:track:abc'])
    expect(result.genreAffinities?.[0]?.genre).toBe('alt-pop')
    expect(result.artistAffinities?.[0]?.name).toBe('Artist 1')
    expect(result.neighborhoodQuality?.endpointSupported).toBe(true)
  })
})

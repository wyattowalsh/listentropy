import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('throws when spotify API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    )

    await expect(
      fetchSpotifyAudioFeatureProfile('bad-token', ['spotify:track:abc']),
    ).rejects.toThrow('Spotify API request failed with 401')
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

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchSpotifyAudioFeaturesByTrackIds,
  fetchSpotifyAudioFeaturesViaProxy,
  SpotifyApiHttpError,
} from '@/lib/audio-traits/providers/spotify/client'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('spotify audio-traits client', () => {
  it('calls the no-login backend proxy contract for audio features', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        data: {
          features: [{
            id: 'track-1',
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
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSpotifyAudioFeaturesViaProxy(['track-1'])

    expect(fetchMock).toHaveBeenCalledWith('/api/spotify/enrichment/audio-features', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trackIds: ['track-1'] }),
    })
    expect(result.features).toHaveLength(1)
    expect(result.requestStats.requestedUniqueTrackIds).toBe(1)
  })

  it('throws proxy endpoint errors and preserves retry-after from proxy payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => null },
        json: async () => ({
          status: 429,
          error: {
            code: 'rate-limited',
            message: 'Rate limited',
            retryAfterSeconds: 13,
          },
        }),
      }),
    )

    let thrown: unknown
    try {
      await fetchSpotifyAudioFeaturesViaProxy(['track-1'])
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SpotifyApiHttpError)
    expect(thrown).toMatchObject({
      status: 429,
      endpoint: 'audio-features-proxy',
      retryAfterSeconds: 13,
    })
  })

  it('throws an endpoint-aware HTTP error with Retry-After when rate limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name === 'Retry-After' ? '9' : null) },
      }),
    )

    let thrown: unknown
    try {
      await fetchSpotifyAudioFeaturesByTrackIds('token', ['track-1'])
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SpotifyApiHttpError)
    expect(thrown).toMatchObject({
      status: 429,
      endpoint: 'audio-features',
      retryAfterSeconds: 9,
    })
    expect((thrown as Error).message).toContain('429')
    expect((thrown as Error).message).toContain('audio-features')
  })
})

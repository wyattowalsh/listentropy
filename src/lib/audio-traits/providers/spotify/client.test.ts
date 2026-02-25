import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchSpotifyAudioFeaturesByTrackIds, SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/client'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('spotify audio-traits client', () => {
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler, { resetSpotifyEnrichmentProxyRateLimitForTests } from './audio-features'
import {
  SPOTIFY_APP_TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS,
  resetSpotifyAppTokenCacheForTests,
} from '@/lib/audio-traits/providers/spotify/proxy-server'

interface MockApiResponse {
  statusCode: number
  jsonPayload: unknown
  headers: Record<string, string>
  status: (code: number) => MockApiResponse
  setHeader: (name: string, value: string) => MockApiResponse
  json: (payload: unknown) => void
}

function createMockResponse(): MockApiResponse {
  return {
    statusCode: 200,
    jsonPayload: null,
    headers: {},
    status(code: number) {
      this.statusCode = code
      return this
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value
      return this
    },
    json(payload: unknown) {
      this.jsonPayload = payload
    },
  }
}

function createTrustedPostRequest(args: { body: unknown; headers?: Record<string, string> }): {
  method: 'POST'
  body: unknown
  headers: Record<string, string>
} {
  return {
    method: 'POST',
    body: args.body,
    headers: args.headers ?? {},
  }
}

function createAudioFeature(trackId: string) {
  return {
    id: trackId,
    danceability: 0.7,
    energy: 0.8,
    valence: 0.4,
    acousticness: 0.2,
    instrumentalness: 0.1,
    speechiness: 0.05,
    tempo: 120,
    liveness: 0.3,
  }
}

describe('spotify audio features enrichment api route', () => {
  beforeEach(() => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'client-id')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'client-secret')
    resetSpotifyAppTokenCacheForTests()
    resetSpotifyEnrichmentProxyRateLimitForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    resetSpotifyAppTokenCacheForTests()
    resetSpotifyEnrichmentProxyRateLimitForTests()
  })

  it('returns a bad-request contract error for non-POST methods', async () => {
    const response = createMockResponse()

    await handler({ method: 'GET' }, response)

    expect(response.statusCode).toBe(400)
    expect(response.jsonPayload).toMatchObject({
      status: 400,
      error: { code: 'bad-request' },
    })
  })

  it('returns bad-request when the POST body is invalid JSON', async () => {
    const response = createMockResponse()

    await handler(createTrustedPostRequest({ body: '{"trackIds":[' }), response)

    expect(response.statusCode).toBe(400)
    expect(response.jsonPayload).toMatchObject({
      status: 400,
      error: { code: 'bad-request' },
    })
  })

  it('enforces per-client proxy rate limits and returns retry-after contract metadata', async () => {
    vi.stubEnv('SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE', '1')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'app-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-1')],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const firstResponse = createMockResponse()
    const secondResponse = createMockResponse()

    await handler(
      createTrustedPostRequest({
        headers: { 'x-forwarded-for': '198.51.100.1' },
        body: { trackIds: ['track-1'] },
      }),
      firstResponse,
    )
    await handler(
      createTrustedPostRequest({
        headers: { 'x-forwarded-for': '198.51.100.1' },
        body: { trackIds: ['track-1'] },
      }),
      secondResponse,
    )

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(429)
    expect(secondResponse.headers['retry-after']).toBeDefined()
    expect(secondResponse.jsonPayload).toMatchObject({
      status: 429,
      error: {
        code: 'rate-limited',
      },
    })
  })

  it('ignores caller-supplied client-id for limiter keying', async () => {
    vi.stubEnv('SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE', '1')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'app-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-1')],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const firstResponse = createMockResponse()
    const secondResponse = createMockResponse()
    const thirdResponse = createMockResponse()

    await handler(
      createTrustedPostRequest({
        headers: {
          'x-forwarded-for': '198.51.100.1',
          'x-spotify-enrichment-proxy-client-id': 'trusted-caller-a',
        },
        body: { trackIds: ['track-1'] },
      }),
      firstResponse,
    )
    await handler(
      createTrustedPostRequest({
        headers: {
          'x-forwarded-for': '198.51.100.1',
          'x-spotify-enrichment-proxy-client-id': 'trusted-caller-b',
        },
        body: { trackIds: ['track-1'] },
      }),
      secondResponse,
    )
    await handler(
      createTrustedPostRequest({
        headers: {
          'x-forwarded-for': '198.51.100.1',
          'x-spotify-enrichment-proxy-client-id': 'trusted-caller-a',
        },
        body: { trackIds: ['track-1'] },
      }),
      thirdResponse,
    )

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(429)
    expect(thirdResponse.statusCode).toBe(429)
  })

  it('ignores spoofed custom ip headers for limiter keying', async () => {
    vi.stubEnv('SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE', '1')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'app-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-1')],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const firstResponse = createMockResponse()
    const secondResponse = createMockResponse()

    await handler(
      createTrustedPostRequest({
        headers: {
          'user-agent': 'audit-suite',
          'accept-language': 'en-US',
          origin: 'https://listentropy.w4w.dev',
          'x-real-ip': '198.51.100.20',
        },
        body: { trackIds: ['track-1'] },
      }),
      firstResponse,
    )
    await handler(
      createTrustedPostRequest({
        headers: {
          'user-agent': 'audit-suite',
          'accept-language': 'en-US',
          origin: 'https://listentropy.w4w.dev',
          'x-real-ip': '198.51.100.21',
        },
        body: { trackIds: ['track-1'] },
      }),
      secondResponse,
    )

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(429)
  })

  it('uses client credentials to fetch app token and returns audio features', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'app-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-1')],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const response = createMockResponse()
    await handler(createTrustedPostRequest({ body: { trackIds: [' track-1 ', 'track-1'] } }), response)

    const tokenRequest = fetchMock.mock.calls[0]
    const audioFeaturesRequest = fetchMock.mock.calls[1]

    expect(tokenRequest?.[0]).toBe('https://accounts.spotify.com/api/token')
    expect(tokenRequest?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    const tokenBody = tokenRequest?.[1]?.body as URLSearchParams
    expect(tokenBody.get('grant_type')).toBe('client_credentials')

    expect(audioFeaturesRequest?.[0]).toBe('https://api.spotify.com/v1/audio-features?ids=track-1')
    expect(audioFeaturesRequest?.[1]).toMatchObject({
      headers: {
        Authorization: 'Bearer app-token',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.jsonPayload).toMatchObject({
      status: 200,
      data: {
        features: [createAudioFeature('track-1')],
        requestStats: {
          requestedUniqueTrackIds: 1,
          cappedUniqueTrackIds: 1,
          truncatedTrackIds: 0,
          requestChunkCount: 1,
        },
      },
    })
  })

  it.each([
    { upstreamStatus: 400, expectedStatus: 400, expectedCode: 'bad-request' },
    { upstreamStatus: 401, expectedStatus: 401, expectedCode: 'unauthorized' },
    { upstreamStatus: 403, expectedStatus: 403, expectedCode: 'restricted' },
    { upstreamStatus: 404, expectedStatus: 403, expectedCode: 'restricted' },
    { upstreamStatus: 503, expectedStatus: 503, expectedCode: 'unavailable' },
  ])(
    'maps upstream %s responses to proxy contract error statuses',
    async ({ upstreamStatus, expectedStatus, expectedCode }) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'app-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: upstreamStatus,
          headers: { get: () => null },
        })
      vi.stubGlobal('fetch', fetchMock)

      const response = createMockResponse()
      await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), response)

      expect(response.statusCode).toBe(expectedStatus)
      expect(response.jsonPayload).toMatchObject({
        status: expectedStatus,
        error: {
          code: expectedCode,
        },
      })
    },
  )

  it('caches app tokens in memory until inside the expiry safety margin', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'cached-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-1')],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), createMockResponse())
    await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), createMockResponse())

    const tokenCalls = fetchMock.mock.calls.filter((call) => call[0] === 'https://accounts.spotify.com/api/token')
    expect(tokenCalls).toHaveLength(1)
  })

  it('refreshes cached app token when within expiry safety margin', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-25T00:00:00Z'))
    const tokenExpiresInSeconds = SPOTIFY_APP_TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS + 5
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token-1',
          token_type: 'Bearer',
          expires_in: tokenExpiresInSeconds,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-1')],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token-2',
          token_type: 'Bearer',
          expires_in: tokenExpiresInSeconds,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio_features: [createAudioFeature('track-2')],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), createMockResponse())
    vi.advanceTimersByTime(10_000)
    await handler(createTrustedPostRequest({ body: { trackIds: ['track-2'] } }), createMockResponse())

    const tokenCalls = fetchMock.mock.calls.filter((call) => call[0] === 'https://accounts.spotify.com/api/token')
    expect(tokenCalls).toHaveLength(2)
  })

  it('maps rate limits to contract errors and propagates retry-after', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'app-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name === 'Retry-After' ? '7' : null) },
      })
    vi.stubGlobal('fetch', fetchMock)

    const response = createMockResponse()
    await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), response)

    expect(response.statusCode).toBe(429)
    expect(response.headers['retry-after']).toBe('7')
    expect(response.jsonPayload).toMatchObject({
      status: 429,
      error: {
        code: 'rate-limited',
        retryAfterSeconds: 7,
      },
    })
  })

  it('propagates retry-after when client credentials token endpoint is rate-limited', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name === 'Retry-After' ? '11' : null) },
      })
    vi.stubGlobal('fetch', fetchMock)

    const response = createMockResponse()
    await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), response)

    expect(response.statusCode).toBe(429)
    expect(response.headers['retry-after']).toBe('11')
    expect(response.jsonPayload).toMatchObject({
      status: 429,
      error: {
        code: 'rate-limited',
        retryAfterSeconds: 11,
      },
    })
  })

  it('returns unavailable when server-side credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', '')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = createMockResponse()

    await handler(createTrustedPostRequest({ body: { trackIds: ['track-1'] } }), response)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.statusCode).toBe(503)
    expect(response.jsonPayload).toMatchObject({
      status: 503,
      error: {
        code: 'unavailable',
      },
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSpotifyAuthCallbackParamsFromUrl,
  exchangeSpotifyPkceCode,
  parseSpotifyAuthCallbackParams,
  refreshSpotifyPkceSession,
} from '@/lib/spotify-auth/oauth'

describe('spotify auth oauth helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-25T12:00:00Z'))
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('parses successful OAuth callback params from a callback URL', () => {
    expect(
      parseSpotifyAuthCallbackParams('http://localhost/auth/spotify/callback?code=abc123&state=state-1'),
    ).toEqual({
      code: 'abc123',
      state: 'state-1',
      error: undefined,
    })
  })

  it('parses OAuth error callback params from a callback URL', () => {
    expect(
      parseSpotifyAuthCallbackParams('http://localhost/auth/spotify/callback?error=access_denied&state=state-1'),
    ).toEqual({
      code: undefined,
      state: 'state-1',
      error: 'access_denied',
    })
  })

  it('maps token exchange HTTP failures with the response status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      exchangeSpotifyPkceCode({
        code: 'oauth-code',
        codeVerifier: 'verifier-1',
        clientId: 'client-123',
        redirectUri: 'http://localhost/auth/spotify/callback',
      }),
    ).rejects.toThrow('Spotify token request failed with 400')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://accounts.spotify.com/api/token')
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(requestInit.method).toBe('POST')
    expect(requestInit.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    const body = requestInit.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('oauth-code')
    expect(body.get('code_verifier')).toBe('verifier-1')
  })

  it('creates a PKCE session from refresh token responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          token_type: 'Bearer',
          scope: 'user-read-email user-read-private',
          expires_in: 3600,
        }),
      }),
    )

    const session = await refreshSpotifyPkceSession({
      refreshToken: 'refresh-1',
      clientId: 'client-123',
    })

    expect(session).toMatchObject({
      accessToken: 'refreshed-token',
      tokenSource: 'pkce',
      scopes: ['user-read-email', 'user-read-private'],
      grantedAt: '2026-02-25T12:00:00.000Z',
    })
    expect(session.expiresAt).toBe(Date.now() + 3_600_000)
  })

  it('scrubs OAuth callback params from the URL while preserving unrelated state', () => {
    window.history.replaceState(
      {},
      '',
      '/auth/spotify/callback?code=abc&state=state-1&error=access_denied&keep=1#section',
    )

    clearSpotifyAuthCallbackParamsFromUrl()

    const currentUrl = new URL(window.location.href)
    expect(currentUrl.searchParams.get('code')).toBeNull()
    expect(currentUrl.searchParams.get('state')).toBeNull()
    expect(currentUrl.searchParams.get('error')).toBeNull()
    expect(currentUrl.searchParams.get('keep')).toBe('1')
    expect(currentUrl.hash).toBe('#section')
  })
})

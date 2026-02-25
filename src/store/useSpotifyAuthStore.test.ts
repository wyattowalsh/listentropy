import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadModules() {
  vi.resetModules()
  const storage = await import('@/lib/spotify-auth/storage')
  const store = await import('@/store/useSpotifyAuthStore')
  return { ...storage, ...store }
}

describe('useSpotifyAuthStore manual token persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('defaults manual tokens to memory-only (no sessionStorage persistence)', async () => {
    const { getSpotifyAuthStorageKeys, useSpotifyAuthStore } = await loadModules()
    const keys = getSpotifyAuthStorageKeys()

    useSpotifyAuthStore.getState().setManualToken('manual-token-123')

    const state = useSpotifyAuthStore.getState()
    expect(state.status).toBe('connected')
    expect(state.session?.tokenSource).toBe('manual-token')
    expect(state.session?.accessToken).toBe('manual-token-123')
    expect(sessionStorage.getItem(keys.manualToken)).toBeNull()
    expect(sessionStorage.getItem(keys.session)).toBeNull()
  })

  it('persists manual token and session when persist option is enabled', async () => {
    const { getSpotifyAuthStorageKeys, useSpotifyAuthStore } = await loadModules()
    const keys = getSpotifyAuthStorageKeys()

    useSpotifyAuthStore.getState().setManualToken('manual-token-abc', { persist: true })

    expect(sessionStorage.getItem(keys.manualToken)).toBe('manual-token-abc')
    const storedSession = sessionStorage.getItem(keys.session)
    expect(storedSession).toBeTruthy()
    expect(storedSession).toMatch(/manual-token-abc/)
  })

  it('clears persisted and in-memory manual token state', async () => {
    const { getSpotifyAuthStorageKeys, useSpotifyAuthStore } = await loadModules()
    const keys = getSpotifyAuthStorageKeys()

    useSpotifyAuthStore.getState().setManualToken('manual-token-abc', { persist: true })
    useSpotifyAuthStore.getState().clearManualToken()

    const state = useSpotifyAuthStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.session).toBeNull()
    expect(sessionStorage.getItem(keys.manualToken)).toBeNull()
    expect(sessionStorage.getItem(keys.session)).toBeNull()
  })
})

describe('useSpotifyAuthStore oauth callback and refresh flows', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-25T12:00:00Z'))
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('handles a successful OAuth callback, exchanges the code, and scrubs callback params', async () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
    vi.stubEnv('VITE_SPOTIFY_REDIRECT_URI', 'http://localhost/auth/spotify/callback')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'pkce-token',
        token_type: 'Bearer',
        scope: 'user-read-email',
        expires_in: 3600,
        refresh_token: 'refresh-123',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    const { getSpotifyAuthStorageKeys, loadSpotifyPkceTemp, persistSpotifyPkceTemp, useSpotifyAuthStore } = await loadModules()
    const keys = getSpotifyAuthStorageKeys()
    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })
    window.history.replaceState(
      {},
      '',
      '/auth/spotify/callback?code=oauth-code&state=state-1&keep=1#done',
    )

    const handled = await useSpotifyAuthStore.getState().handleAuthCallback()

    expect(handled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://accounts.spotify.com/api/token')
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(requestInit.method).toBe('POST')
    const body = requestInit.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('oauth-code')
    expect(body.get('code_verifier')).toBe('verifier-1')
    expect(body.get('client_id')).toBe('client-123')
    expect(body.get('redirect_uri')).toBe('http://localhost/auth/spotify/callback')

    const state = useSpotifyAuthStore.getState()
    expect(state.status).toBe('connected')
    expect(state.error).toBeNull()
    expect(state.session).toMatchObject({
      accessToken: 'pkce-token',
      refreshToken: 'refresh-123',
      tokenSource: 'pkce',
      scopes: ['user-read-email'],
    })
    expect(loadSpotifyPkceTemp()).toBeNull()
    expect(sessionStorage.getItem(keys.pkceVerifier)).toBeNull()
    expect(sessionStorage.getItem(keys.oauthState)).toBeNull()
    expect(sessionStorage.getItem(keys.pkceCreatedAt)).toBeNull()
    expect(sessionStorage.getItem(keys.session)).toMatch(/pkce-token/)

    const currentUrl = new URL(window.location.href)
    expect(currentUrl.searchParams.get('code')).toBeNull()
    expect(currentUrl.searchParams.get('state')).toBeNull()
    expect(currentUrl.searchParams.get('error')).toBeNull()
    expect(currentUrl.searchParams.get('keep')).toBe('1')
    expect(currentUrl.hash).toBe('#done')
    expect(replaceStateSpy).toHaveBeenCalled()
  })

  it('handles OAuth error callback params and clears temporary PKCE state', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { getSpotifyAuthStorageKeys, persistSpotifyPkceTemp, useSpotifyAuthStore } = await loadModules()
    const keys = getSpotifyAuthStorageKeys()
    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })
    window.history.replaceState(
      {},
      '',
      '/auth/spotify/callback?error=access_denied&state=state-1&keep=1',
    )

    const handled = await useSpotifyAuthStore.getState().handleAuthCallback()

    expect(handled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSpotifyAuthStore.getState().status).toBe('error')
    expect(useSpotifyAuthStore.getState().error).toBe('Spotify OAuth error: access_denied')
    expect(sessionStorage.getItem(keys.pkceVerifier)).toBeNull()
    expect(sessionStorage.getItem(keys.oauthState)).toBeNull()
    expect(sessionStorage.getItem(keys.pkceCreatedAt)).toBeNull()
    const currentUrl = new URL(window.location.href)
    expect(currentUrl.searchParams.get('error')).toBeNull()
    expect(currentUrl.searchParams.get('state')).toBeNull()
    expect(currentUrl.searchParams.get('keep')).toBe('1')
  })

  it('rejects callbacks when the OAuth state does not match the stored PKCE state', async () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { persistSpotifyPkceTemp, useSpotifyAuthStore } = await loadModules()
    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'expected-state' })
    window.history.replaceState(
      {},
      '',
      '/auth/spotify/callback?code=oauth-code&state=wrong-state&keep=1',
    )

    const handled = await useSpotifyAuthStore.getState().handleAuthCallback()

    expect(handled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSpotifyAuthStore.getState().status).toBe('error')
    expect(useSpotifyAuthStore.getState().error).toBe('Spotify OAuth state mismatch.')
    const currentUrl = new URL(window.location.href)
    expect(currentUrl.searchParams.get('code')).toBeNull()
    expect(currentUrl.searchParams.get('state')).toBeNull()
    expect(currentUrl.searchParams.get('keep')).toBe('1')
  })

  it('rejects callbacks when PKCE temp state is missing', async () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { useSpotifyAuthStore } = await loadModules()
    window.history.replaceState(
      {},
      '',
      '/auth/spotify/callback?code=oauth-code&state=state-1&keep=1',
    )

    const handled = await useSpotifyAuthStore.getState().handleAuthCallback()

    expect(handled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSpotifyAuthStore.getState().status).toBe('error')
    expect(useSpotifyAuthStore.getState().error).toBe('Missing PKCE verifier/state for Spotify OAuth callback.')
  })

  it('rejects callbacks when stored PKCE temp state has expired', async () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { SPOTIFY_PKCE_TEMP_TTL_MS, persistSpotifyPkceTemp, useSpotifyAuthStore } = await loadModules()
    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })
    vi.advanceTimersByTime(SPOTIFY_PKCE_TEMP_TTL_MS + 1)
    window.history.replaceState(
      {},
      '',
      '/auth/spotify/callback?code=oauth-code&state=state-1&keep=1',
    )

    const handled = await useSpotifyAuthStore.getState().handleAuthCallback()

    expect(handled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSpotifyAuthStore.getState().status).toBe('error')
    expect(useSpotifyAuthStore.getState().error).toBe('Missing PKCE verifier/state for Spotify OAuth callback.')
  })

  it('returns null and sets an error when PKCE token refresh fails', async () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    )

    const { useSpotifyAuthStore } = await loadModules()
    const expiredSession = {
      accessToken: 'stale-token',
      refreshToken: 'refresh-123',
      expiresAt: Date.now() - 1_000,
      tokenSource: 'pkce' as const,
      scopes: [],
      grantedAt: new Date(Date.now() - 86_400_000).toISOString(),
    }
    useSpotifyAuthStore.setState({
      status: 'connected',
      session: expiredSession,
      error: null,
    })

    const accessToken = await useSpotifyAuthStore.getState().ensureValidAccessToken()
    const state = useSpotifyAuthStore.getState()

    expect(accessToken).toBeNull()
    expect(state.status).toBe('error')
    expect(state.error).toBe('Spotify token request failed with 401')
    expect(state.session).toEqual(expiredSession)
  })
})

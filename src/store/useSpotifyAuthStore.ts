import { create } from 'zustand'

import { createOAuthState, createPkceChallenge, createRandomPkceVerifier } from '@/lib/spotify-auth/pkce'
import {
  buildSpotifyAuthorizeUrl,
  clearSpotifyAuthCallbackParamsFromUrl,
  exchangeSpotifyPkceCode,
  getSpotifyPkceConfig,
  parseSpotifyAuthCallbackParams,
  refreshSpotifyPkceSession,
} from '@/lib/spotify-auth/oauth'
import {
  clearSpotifyPkceTemp,
  loadLegacyManualToken,
  loadSpotifyAuthSession,
  loadSpotifyPkceTemp,
  persistLegacyManualToken,
  persistSpotifyAuthSession,
  persistSpotifyPkceTemp,
} from '@/lib/spotify-auth/storage'
import type { SpotifyAuthSession, SpotifyAuthStatus } from '@/lib/types'

interface SpotifyAuthState {
  status: SpotifyAuthStatus
  session: SpotifyAuthSession | null
  error: string | null
  connectSpotify: () => Promise<void>
  handleAuthCallback: () => Promise<boolean>
  ensureValidAccessToken: () => Promise<string | null>
  disconnect: () => void
  setManualToken: (token: string, options?: { persist?: boolean }) => void
  clearManualToken: () => void
}

function createManualSession(token: string): SpotifyAuthSession {
  const now = Date.now()
  return {
    accessToken: token.trim(),
    expiresAt: now + 12 * 60 * 60 * 1000,
    tokenSource: 'manual-token',
    scopes: [],
    grantedAt: new Date(now).toISOString(),
  }
}

function getInitialState(): Pick<SpotifyAuthState, 'status' | 'session' | 'error'> {
  const stored = loadSpotifyAuthSession()
  if (stored?.accessToken) {
    return {
      status: 'connected',
      session: stored,
      error: null,
    }
  }
  const manualToken = loadLegacyManualToken()
  if (manualToken) {
    const session = createManualSession(manualToken)
    persistSpotifyAuthSession(session)
    return {
      status: 'connected',
      session,
      error: null,
    }
  }
  return {
    status: 'disconnected',
    session: null,
    error: null,
  }
}

export const useSpotifyAuthStore = create<SpotifyAuthState>((set, get) => ({
  ...getInitialState(),
  connectSpotify: async () => {
    const { clientId, redirectUri } = getSpotifyPkceConfig()
    if (!clientId) {
      set({ status: 'error', error: 'Missing VITE_SPOTIFY_CLIENT_ID. Configure a Spotify app client ID to use OAuth PKCE.' })
      return
    }

    try {
      const codeVerifier = createRandomPkceVerifier(64)
      const codeChallenge = await createPkceChallenge(codeVerifier)
      const state = createOAuthState(32)
      persistSpotifyPkceTemp({ codeVerifier, state })
      set({ status: 'authorizing', error: null })
      const url = buildSpotifyAuthorizeUrl({
        clientId,
        redirectUri,
        state,
        codeChallenge,
        scopes: [],
      })
      window.location.assign(url)
    } catch (error) {
      set({ status: 'error', error: (error as Error).message })
    }
  },
  handleAuthCallback: async () => {
    const params = parseSpotifyAuthCallbackParams()
    if (!params.code && !params.error) {
      return false
    }
    if (params.error) {
      clearSpotifyPkceTemp()
      clearSpotifyAuthCallbackParamsFromUrl()
      set({ status: 'error', error: `Spotify OAuth error: ${params.error}` })
      return true
    }

    const temp = loadSpotifyPkceTemp()
    const { clientId, redirectUri } = getSpotifyPkceConfig()
    if (!params.code || !params.state || !temp) {
      clearSpotifyPkceTemp()
      clearSpotifyAuthCallbackParamsFromUrl()
      set({ status: 'error', error: 'Missing PKCE verifier/state for Spotify OAuth callback.' })
      return true
    }
    if (params.state !== temp.state) {
      clearSpotifyPkceTemp()
      clearSpotifyAuthCallbackParamsFromUrl()
      set({ status: 'error', error: 'Spotify OAuth state mismatch.' })
      return true
    }
    if (!clientId) {
      clearSpotifyPkceTemp()
      clearSpotifyAuthCallbackParamsFromUrl()
      set({ status: 'error', error: 'Missing VITE_SPOTIFY_CLIENT_ID for callback token exchange.' })
      return true
    }

    set({ status: 'authorizing', error: null })
    try {
      const session = await exchangeSpotifyPkceCode({
        code: params.code,
        codeVerifier: temp.codeVerifier,
        clientId,
        redirectUri,
      })
      persistSpotifyAuthSession(session)
      clearSpotifyPkceTemp()
      clearSpotifyAuthCallbackParamsFromUrl()
      set({ status: 'connected', session, error: null })
    } catch (error) {
      clearSpotifyPkceTemp()
      clearSpotifyAuthCallbackParamsFromUrl()
      set({ status: 'error', error: (error as Error).message })
    }
    return true
  },
  ensureValidAccessToken: async () => {
    const state = get()
    const session = state.session
    if (!session?.accessToken) {
      return null
    }
    if (session.tokenSource === 'manual-token') {
      return session.accessToken
    }

    const expiresSoon = session.expiresAt <= Date.now() + 60_000
    if (!expiresSoon) {
      return session.accessToken
    }
    if (!session.refreshToken) {
      set({ status: 'error', error: 'Spotify PKCE session expired and no refresh token is available.' })
      return null
    }

    const { clientId } = getSpotifyPkceConfig()
    if (!clientId) {
      set({ status: 'error', error: 'Missing VITE_SPOTIFY_CLIENT_ID for token refresh.' })
      return null
    }

    set({ status: 'refreshing', error: null })
    try {
      const refreshed = await refreshSpotifyPkceSession({
        refreshToken: session.refreshToken,
        clientId,
      })
      const nextSession: SpotifyAuthSession = {
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
      }
      persistSpotifyAuthSession(nextSession)
      set({ status: 'connected', session: nextSession, error: null })
      return nextSession.accessToken
    } catch (error) {
      set({ status: 'error', error: (error as Error).message })
      return null
    }
  },
  disconnect: () => {
    persistSpotifyAuthSession(null)
    clearSpotifyPkceTemp()
    set({ status: 'disconnected', session: null, error: null })
  },
  setManualToken: (token, options) => {
    const trimmed = token.trim()
    if (!trimmed) {
      get().clearManualToken()
      return
    }
    const persist = options?.persist ?? false
    if (persist) {
      persistLegacyManualToken(trimmed)
    } else {
      persistLegacyManualToken('')
      // Memory-only mode: do not leave a tab-persisted auth session behind.
      persistSpotifyAuthSession(null)
    }
    const session = createManualSession(trimmed)
    if (persist) {
      persistSpotifyAuthSession(session)
    }
    set({ status: 'connected', session, error: null })
  },
  clearManualToken: () => {
    persistLegacyManualToken('')
    const session = get().session
    if (session?.tokenSource === 'manual-token') {
      persistSpotifyAuthSession(null)
      set({ status: 'disconnected', session: null, error: null })
      return
    }
    set({ error: null })
  },
}))

import type { SpotifyAuthSession } from '@/lib/types'

const KEYS = {
  session: 'listentropy-spotify-auth-session',
  manualToken: 'listentropy-spotify-token',
  pkceVerifier: 'listentropy-spotify-pkce-verifier',
  oauthState: 'listentropy-spotify-oauth-state',
  pkceCreatedAt: 'listentropy-spotify-pkce-created-at',
} as const

export const SPOTIFY_PKCE_TEMP_TTL_MS = 10 * 60 * 1000

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.sessionStorage
}

export function getSpotifyAuthStorageKeys(): typeof KEYS {
  return KEYS
}

export function loadSpotifyAuthSession(): SpotifyAuthSession | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const raw = storage.getItem(KEYS.session)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as SpotifyAuthSession
  } catch {
    storage.removeItem(KEYS.session)
    return null
  }
}

export function persistSpotifyAuthSession(session: SpotifyAuthSession | null): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (!session) {
    storage.removeItem(KEYS.session)
    return
  }
  storage.setItem(KEYS.session, JSON.stringify(session))
}

export function loadLegacyManualToken(): string {
  const storage = getSessionStorage()
  if (!storage) {
    return ''
  }
  return storage.getItem(KEYS.manualToken) ?? ''
}

export function persistLegacyManualToken(token: string): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (token.trim()) {
    storage.setItem(KEYS.manualToken, token.trim())
  } else {
    storage.removeItem(KEYS.manualToken)
  }
}

export function persistSpotifyPkceTemp(args: { codeVerifier: string; state: string } | null): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (!args) {
    storage.removeItem(KEYS.pkceVerifier)
    storage.removeItem(KEYS.oauthState)
    storage.removeItem(KEYS.pkceCreatedAt)
    return
  }
  storage.setItem(KEYS.pkceVerifier, args.codeVerifier)
  storage.setItem(KEYS.oauthState, args.state)
  storage.setItem(KEYS.pkceCreatedAt, String(Date.now()))
}

export function loadSpotifyPkceTemp(): { codeVerifier: string; state: string } | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const codeVerifier = storage.getItem(KEYS.pkceVerifier)
  const state = storage.getItem(KEYS.oauthState)
  if (!codeVerifier || !state) {
    return null
  }
  const createdAtRaw = storage.getItem(KEYS.pkceCreatedAt)
  if (createdAtRaw == null) {
    // Backward-compatibility for pre-TTL tabs: allow one load and start TTL now.
    storage.setItem(KEYS.pkceCreatedAt, String(Date.now()))
    return { codeVerifier, state }
  }
  const createdAt = Number.parseInt(createdAtRaw, 10)
  if (!Number.isFinite(createdAt)) {
    clearSpotifyPkceTemp()
    return null
  }
  if (Date.now() - createdAt > SPOTIFY_PKCE_TEMP_TTL_MS) {
    clearSpotifyPkceTemp()
    return null
  }
  return { codeVerifier, state }
}

export function clearSpotifyPkceTemp(): void {
  persistSpotifyPkceTemp(null)
}

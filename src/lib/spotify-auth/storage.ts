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
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function safeGetSessionStorageItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSetSessionStorageItem(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemoveSessionStorageItem(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function getSpotifyAuthStorageKeys(): typeof KEYS {
  return KEYS
}

export function loadSpotifyAuthSession(): SpotifyAuthSession | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const raw = safeGetSessionStorageItem(storage, KEYS.session)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as SpotifyAuthSession
  } catch {
    safeRemoveSessionStorageItem(storage, KEYS.session)
    return null
  }
}

export function persistSpotifyAuthSession(session: SpotifyAuthSession | null): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (!session) {
    safeRemoveSessionStorageItem(storage, KEYS.session)
    return
  }
  safeSetSessionStorageItem(storage, KEYS.session, JSON.stringify(session))
}

export function loadLegacyManualToken(): string {
  const storage = getSessionStorage()
  if (!storage) {
    return ''
  }
  return safeGetSessionStorageItem(storage, KEYS.manualToken) ?? ''
}

export function persistLegacyManualToken(token: string): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (token.trim()) {
    safeSetSessionStorageItem(storage, KEYS.manualToken, token.trim())
  } else {
    safeRemoveSessionStorageItem(storage, KEYS.manualToken)
  }
}

export function persistSpotifyPkceTemp(args: { codeVerifier: string; state: string } | null): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (!args) {
    safeRemoveSessionStorageItem(storage, KEYS.pkceVerifier)
    safeRemoveSessionStorageItem(storage, KEYS.oauthState)
    safeRemoveSessionStorageItem(storage, KEYS.pkceCreatedAt)
    return
  }
  safeSetSessionStorageItem(storage, KEYS.pkceVerifier, args.codeVerifier)
  safeSetSessionStorageItem(storage, KEYS.oauthState, args.state)
  safeSetSessionStorageItem(storage, KEYS.pkceCreatedAt, String(Date.now()))
}

export function loadSpotifyPkceTemp(): { codeVerifier: string; state: string } | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const codeVerifier = safeGetSessionStorageItem(storage, KEYS.pkceVerifier)
  const state = safeGetSessionStorageItem(storage, KEYS.oauthState)
  if (!codeVerifier || !state) {
    return null
  }
  const createdAtRaw = safeGetSessionStorageItem(storage, KEYS.pkceCreatedAt)
  if (createdAtRaw == null) {
    // Backward-compatibility for pre-TTL tabs: allow one load and start TTL now.
    safeSetSessionStorageItem(storage, KEYS.pkceCreatedAt, String(Date.now()))
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

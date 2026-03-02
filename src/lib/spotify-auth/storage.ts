import type { SpotifyAuthSession } from '@/lib/types'
import {
  getBrowserStorage,
  readStorageItem,
  removeStorageItem,
  writeStorageItem,
} from '@/lib/storage/safeBrowserStorage'

const KEYS = {
  session: 'listentropy-spotify-auth-session',
  manualToken: 'listentropy-spotify-token',
  pkceVerifier: 'listentropy-spotify-pkce-verifier',
  oauthState: 'listentropy-spotify-oauth-state',
  pkceCreatedAt: 'listentropy-spotify-pkce-created-at',
} as const

export const SPOTIFY_PKCE_TEMP_TTL_MS = 10 * 60 * 1000

function getSessionStorage() {
  return getBrowserStorage('session')
}

export function getSpotifyAuthStorageKeys(): typeof KEYS {
  return KEYS
}

export function loadSpotifyAuthSession(): SpotifyAuthSession | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const raw = readStorageItem(storage, KEYS.session)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as SpotifyAuthSession
  } catch {
    removeStorageItem(storage, KEYS.session)
    return null
  }
}

export function persistSpotifyAuthSession(session: SpotifyAuthSession | null): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (!session) {
    removeStorageItem(storage, KEYS.session)
    return
  }
  writeStorageItem(storage, KEYS.session, JSON.stringify(session))
}

export function loadLegacyManualToken(): string {
  const storage = getSessionStorage()
  if (!storage) {
    return ''
  }
  return readStorageItem(storage, KEYS.manualToken) ?? ''
}

export function persistLegacyManualToken(token: string): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (token.trim()) {
    writeStorageItem(storage, KEYS.manualToken, token.trim())
  } else {
    removeStorageItem(storage, KEYS.manualToken)
  }
}

export function persistSpotifyPkceTemp(args: { codeVerifier: string; state: string } | null): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  if (!args) {
    removeStorageItem(storage, KEYS.pkceVerifier)
    removeStorageItem(storage, KEYS.oauthState)
    removeStorageItem(storage, KEYS.pkceCreatedAt)
    return
  }
  writeStorageItem(storage, KEYS.pkceVerifier, args.codeVerifier)
  writeStorageItem(storage, KEYS.oauthState, args.state)
  writeStorageItem(storage, KEYS.pkceCreatedAt, String(Date.now()))
}

export function loadSpotifyPkceTemp(): { codeVerifier: string; state: string } | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const codeVerifier = readStorageItem(storage, KEYS.pkceVerifier)
  const state = readStorageItem(storage, KEYS.oauthState)
  if (!codeVerifier || !state) {
    return null
  }
  const createdAtRaw = readStorageItem(storage, KEYS.pkceCreatedAt)
  if (createdAtRaw == null) {
    // Backward-compatibility for pre-TTL tabs: allow one load and start TTL now.
    writeStorageItem(storage, KEYS.pkceCreatedAt, String(Date.now()))
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

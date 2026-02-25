import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SPOTIFY_PKCE_TEMP_TTL_MS,
  clearSpotifyPkceTemp,
  getSpotifyAuthStorageKeys,
  loadSpotifyPkceTemp,
  persistSpotifyPkceTemp,
} from '@/lib/spotify-auth/storage'

describe('spotify auth storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-25T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('persists and loads PKCE temp values with timestamp metadata', () => {
    const keys = getSpotifyAuthStorageKeys()

    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })

    expect(loadSpotifyPkceTemp()).toEqual({ codeVerifier: 'verifier-1', state: 'state-1' })
    expect(sessionStorage.getItem(keys.pkceCreatedAt)).toBe(String(Date.now()))
  })

  it('rejects and clears expired PKCE temp state', () => {
    const keys = getSpotifyAuthStorageKeys()
    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })

    vi.advanceTimersByTime(SPOTIFY_PKCE_TEMP_TTL_MS + 1)

    expect(loadSpotifyPkceTemp()).toBeNull()
    expect(sessionStorage.getItem(keys.pkceVerifier)).toBeNull()
    expect(sessionStorage.getItem(keys.oauthState)).toBeNull()
    expect(sessionStorage.getItem(keys.pkceCreatedAt)).toBeNull()
  })

  it('rejects and clears malformed PKCE timestamp metadata', () => {
    const keys = getSpotifyAuthStorageKeys()
    sessionStorage.setItem(keys.pkceVerifier, 'verifier-1')
    sessionStorage.setItem(keys.oauthState, 'state-1')
    sessionStorage.setItem(keys.pkceCreatedAt, 'not-a-number')

    expect(loadSpotifyPkceTemp()).toBeNull()
    expect(sessionStorage.getItem(keys.pkceVerifier)).toBeNull()
    expect(sessionStorage.getItem(keys.oauthState)).toBeNull()
    expect(sessionStorage.getItem(keys.pkceCreatedAt)).toBeNull()
  })

  it('clears PKCE temp state and timestamp', () => {
    const keys = getSpotifyAuthStorageKeys()
    persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })

    clearSpotifyPkceTemp()

    expect(sessionStorage.getItem(keys.pkceVerifier)).toBeNull()
    expect(sessionStorage.getItem(keys.oauthState)).toBeNull()
    expect(sessionStorage.getItem(keys.pkceCreatedAt)).toBeNull()
  })
})

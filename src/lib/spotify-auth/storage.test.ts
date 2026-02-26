import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SPOTIFY_PKCE_TEMP_TTL_MS,
  clearSpotifyPkceTemp,
  getSpotifyAuthStorageKeys,
  loadLegacyManualToken,
  loadSpotifyAuthSession,
  loadSpotifyPkceTemp,
  persistLegacyManualToken,
  persistSpotifyAuthSession,
  persistSpotifyPkceTemp,
} from '@/lib/spotify-auth/storage'
import type { SpotifyAuthSession } from '@/lib/types'

type StorageMock = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key'> & {
  length: number
}

const originalSessionStorage = window.sessionStorage

function createStorageMock(overrides: Partial<StorageMock> = {}): StorageMock {
  return {
    length: 0,
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(() => null),
    ...overrides,
  }
}

function installSessionStorage(mockStorage: StorageMock): void {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: mockStorage,
  })
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: mockStorage,
    })
  }
}

function installSessionStorageGetterThatThrows(): void {
  const getter = (): never => {
    throw new DOMException('Access denied', 'SecurityError')
  }

  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get: getter,
  })
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: getter,
    })
  }
}

function restoreSessionStorage(): void {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: originalSessionStorage,
  })
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    })
  }
}

describe('spotify auth storage', () => {
  beforeEach(() => {
    restoreSessionStorage()
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-25T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreSessionStorage()
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

  it('fails safe when sessionStorage property access is denied', () => {
    const session: SpotifyAuthSession = {
      accessToken: 'token-1',
      expiresAt: Date.now() + 60_000,
      tokenSource: 'pkce',
      scopes: [],
      grantedAt: new Date(Date.now()).toISOString(),
    }

    installSessionStorageGetterThatThrows()

    expect(loadSpotifyAuthSession()).toBeNull()
    expect(loadLegacyManualToken()).toBe('')
    expect(loadSpotifyPkceTemp()).toBeNull()
    expect(() => persistSpotifyAuthSession(session)).not.toThrow()
    expect(() => persistSpotifyAuthSession(null)).not.toThrow()
    expect(() => persistLegacyManualToken('manual-token-1')).not.toThrow()
    expect(() => persistLegacyManualToken('')).not.toThrow()
    expect(() => persistSpotifyPkceTemp({ codeVerifier: 'verifier-1', state: 'state-1' })).not.toThrow()
    expect(() => clearSpotifyPkceTemp()).not.toThrow()
  })

  it('fails safe when sessionStorage methods throw', () => {
    const storageError = new DOMException('Access denied', 'SecurityError')
    const session: SpotifyAuthSession = {
      accessToken: 'token-2',
      expiresAt: Date.now() + 60_000,
      tokenSource: 'pkce',
      scopes: [],
      grantedAt: new Date(Date.now()).toISOString(),
    }
    installSessionStorage(
      createStorageMock({
        getItem: vi.fn(() => {
          throw storageError
        }),
        setItem: vi.fn(() => {
          throw storageError
        }),
        removeItem: vi.fn(() => {
          throw storageError
        }),
      }),
    )

    expect(loadSpotifyAuthSession()).toBeNull()
    expect(loadLegacyManualToken()).toBe('')
    expect(loadSpotifyPkceTemp()).toBeNull()
    expect(() => persistSpotifyAuthSession(session)).not.toThrow()
    expect(() => persistSpotifyAuthSession(null)).not.toThrow()
    expect(() => persistLegacyManualToken('manual-token-2')).not.toThrow()
    expect(() => persistLegacyManualToken('')).not.toThrow()
    expect(() => persistSpotifyPkceTemp({ codeVerifier: 'verifier-2', state: 'state-2' })).not.toThrow()
    expect(() => clearSpotifyPkceTemp()).not.toThrow()
  })
})

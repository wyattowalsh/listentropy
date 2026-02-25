import { beforeEach, describe, expect, it, vi } from 'vitest'

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

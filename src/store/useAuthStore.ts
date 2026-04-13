import { create } from 'zustand'

export interface AuthUser {
  id: string
  spotifyId: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  createdAt: string
  spotifyConnected: boolean
  scopes: string[]
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  csrfToken: string | null
  error: string | null
  checkSession: () => Promise<void>
  login: () => void
  logout: () => Promise<void>
  disconnectSpotify: () => Promise<void>
  deleteAccount: () => Promise<void>
  refreshSpotifyToken: () => Promise<void>
  startTokenLifecycle: () => () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  csrfToken: null,
  error: null,

  checkSession: async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) {
        set({ status: 'unauthenticated', user: null, csrfToken: null, error: null })
        return
      }
      const data = await res.json()
      set({
        status: 'authenticated',
        user: data.user,
        csrfToken: data.csrfToken,
        error: null,
      })
    } catch {
      set({ status: 'unauthenticated', user: null, csrfToken: null, error: null })
    }
  },

  login: () => {
    window.location.href = '/api/auth/spotify/login'
  },

  logout: async () => {
    const { csrfToken } = get()
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      })
    } catch {
      // ignore
    }
    set({ status: 'unauthenticated', user: null, csrfToken: null, error: null })
  },

  disconnectSpotify: async () => {
    const { csrfToken } = get()
    try {
      const res = await fetch('/api/auth/spotify/disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      })
      if (res.ok) {
        await get().checkSession()
      } else {
        set({ error: 'Failed to disconnect Spotify' })
      }
    } catch {
      set({ error: 'Failed to disconnect Spotify' })
    }
  },

  deleteAccount: async () => {
    const { csrfToken } = get()
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      })
      if (res.ok) {
        set({ status: 'unauthenticated', user: null, csrfToken: null, error: null })
      } else {
        set({ error: 'Failed to delete account' })
      }
    } catch {
      set({ error: 'Failed to delete account' })
    }
  },

  refreshSpotifyToken: async () => {
    const { csrfToken } = get()
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      })
      if (!res.ok) {
        await get().checkSession()
      }
    } catch {
      await get().checkSession()
    }
  },

  startTokenLifecycle: () => {
    const REFRESH_INTERVAL = 10 * 60 * 1000
    const SESSION_SYNC_INTERVAL = 5 * 60 * 1000

    const refreshTimer = setInterval(() => {
      const { status, user } = get()
      if (status === 'authenticated' && user?.spotifyConnected) {
        void get().refreshSpotifyToken()
      }
    }, REFRESH_INTERVAL)

    const syncTimer = setInterval(() => {
      const { status } = get()
      if (status === 'authenticated') {
        void get().checkSession()
      }
    }, SESSION_SYNC_INTERVAL)

    return () => {
      clearInterval(refreshTimer)
      clearInterval(syncTimer)
    }
  },
}))

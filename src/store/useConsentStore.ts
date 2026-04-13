import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'

type ConsentType = 'persist_history' | 'persist_enrichment' | 'aggregate_analytics'

interface ConsentState {
  consent: Record<ConsentType, boolean | null>
  loaded: boolean
  showConsentDialog: boolean
  pendingAction: (() => void) | null
  fetchConsent: () => Promise<void>
  grantConsent: (consentType: ConsentType, granted: boolean) => Promise<void>
  requireConsent: (action: () => void) => void
  dismissDialog: () => void
}

export const useConsentStore = create<ConsentState>((set, get) => ({
  consent: {
    persist_history: null,
    persist_enrichment: null,
    aggregate_analytics: null,
  },
  loaded: false,
  showConsentDialog: false,
  pendingAction: null,

  fetchConsent: async () => {
    try {
      const res = await fetch('/api/datasets/consent', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      set({
        consent: {
          persist_history: data.consent.persist_history ?? null,
          persist_enrichment: data.consent.persist_enrichment ?? null,
          aggregate_analytics: data.consent.aggregate_analytics ?? null,
        },
        loaded: true,
      })
    } catch {
      set({ loaded: true })
    }
  },

  grantConsent: async (consentType, granted) => {
    const csrfToken = useAuthStore.getState().csrfToken
    try {
      const res = await fetch('/api/datasets/consent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ consentType, granted }),
      })
      if (res.ok) {
        set((state) => ({
          consent: { ...state.consent, [consentType]: granted },
        }))
      }
    } catch {
    }
  },

  requireConsent: (action) => {
    const { consent } = get()
    if (consent.persist_history === true) {
      action()
      return
    }
    set({ showConsentDialog: true, pendingAction: action })
  },

  dismissDialog: () => {
    set({ showConsentDialog: false, pendingAction: null })
  },
}))

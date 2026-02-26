import { create } from 'zustand'

import type { ExperienceLevel } from '@/lib/types'

const STORAGE_KEY = 'listentropy-experience-level'

type BehaviorKey = 'full_tab_visit' | 'share_action'

interface ExperienceState {
  experienceLevel: ExperienceLevel
  behaviorSignals: {
    fullTabVisits: number
    shareActions: number
  }
  setExperienceLevel: (level: ExperienceLevel) => void
  recordBehavior: (key: BehaviorKey) => void
}

function getStoredLevel(): ExperienceLevel {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') {
    return 'full'
  }
  const value = window.localStorage.getItem(STORAGE_KEY)
  if (value === 'guided') {
    persistLevel('full')
    return 'full'
  }
  return 'full'
}

function persistLevel(level: ExperienceLevel): void {
  if (typeof window === 'undefined' || typeof window.localStorage?.setItem !== 'function') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, level)
}

export const useExperienceStore = create<ExperienceState>((set, get) => ({
  experienceLevel: getStoredLevel(),
  behaviorSignals: {
    fullTabVisits: 0,
    shareActions: 0,
  },
  setExperienceLevel: (level) => {
    persistLevel(level)
    set({ experienceLevel: level })
  },
  recordBehavior: (key) => {
    const current = get()
    const nextSignals = {
      fullTabVisits:
        key === 'full_tab_visit'
          ? current.behaviorSignals.fullTabVisits + 1
          : current.behaviorSignals.fullTabVisits,
      shareActions:
        key === 'share_action'
          ? current.behaviorSignals.shareActions + 1
          : current.behaviorSignals.shareActions,
    }
    const shouldPromote =
      current.experienceLevel === 'guided' &&
      (nextSignals.fullTabVisits >= 3 || nextSignals.shareActions >= 5)

    if (shouldPromote) {
      persistLevel('full')
      set({
        behaviorSignals: nextSignals,
        experienceLevel: 'full',
      })
      return
    }

    set({ behaviorSignals: nextSignals })
  },
}))

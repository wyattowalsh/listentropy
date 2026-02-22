import { create } from 'zustand'

import type { ExperienceLevel } from '@/lib/types'

const STORAGE_KEY = 'listentropy-experience-level'

type BehaviorKey = 'advanced_tab_visit' | 'share_action'

interface ExperienceState {
  experienceLevel: ExperienceLevel
  behaviorSignals: {
    advancedTabVisits: number
    shareActions: number
  }
  setExperienceLevel: (level: ExperienceLevel) => void
  recordBehavior: (key: BehaviorKey) => void
}

function getStoredLevel(): ExperienceLevel {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') {
    return 'advanced'
  }
  const value = window.localStorage.getItem(STORAGE_KEY)
  if (value === 'guided') {
    persistLevel('advanced')
    return 'advanced'
  }
  return 'advanced'
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
    advancedTabVisits: 0,
    shareActions: 0,
  },
  setExperienceLevel: (level) => {
    persistLevel(level)
    set({ experienceLevel: level })
  },
  recordBehavior: (key) => {
    const current = get()
    const nextSignals = {
      advancedTabVisits:
        key === 'advanced_tab_visit'
          ? current.behaviorSignals.advancedTabVisits + 1
          : current.behaviorSignals.advancedTabVisits,
      shareActions:
        key === 'share_action'
          ? current.behaviorSignals.shareActions + 1
          : current.behaviorSignals.shareActions,
    }
    const shouldPromote =
      current.experienceLevel === 'guided' &&
      (nextSignals.advancedTabVisits >= 3 || nextSignals.shareActions >= 5)

    if (shouldPromote) {
      persistLevel('advanced')
      set({
        behaviorSignals: nextSignals,
        experienceLevel: 'advanced',
      })
      return
    }

    set({ behaviorSignals: nextSignals })
  },
}))

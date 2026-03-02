import { create } from 'zustand'

type BehaviorKey = 'full_tab_visit' | 'share_action'

interface ExperienceState {
  behaviorSignals: {
    fullTabVisits: number
    shareActions: number
  }
  recordBehavior: (key: BehaviorKey) => void
}

const SIGNAL_KEY_BY_BEHAVIOR: Record<BehaviorKey, keyof ExperienceState['behaviorSignals']> = {
  full_tab_visit: 'fullTabVisits',
  share_action: 'shareActions',
}

export const useExperienceStore = create<ExperienceState>((set, get) => ({
  behaviorSignals: {
    fullTabVisits: 0,
    shareActions: 0,
  },
  recordBehavior: (key) => {
    const signalKey = SIGNAL_KEY_BY_BEHAVIOR[key]
    const current = get().behaviorSignals
    set({
      behaviorSignals: {
        ...current,
        [signalKey]: current[signalKey] + 1,
      },
    })
  },
}))

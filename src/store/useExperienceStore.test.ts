import { beforeEach, describe, expect, it } from 'vitest'

import { useExperienceStore } from './useExperienceStore'

describe('useExperienceStore', () => {
  beforeEach(() => {
    useExperienceStore.setState({
      experienceLevel: 'advanced',
      behaviorSignals: {
        advancedTabVisits: 0,
        shareActions: 0,
      },
    })
  })

  it('defaults to advanced mode and can be manually changed', () => {
    expect(useExperienceStore.getState().experienceLevel).toBe('advanced')
    useExperienceStore.getState().setExperienceLevel('guided')
    expect(useExperienceStore.getState().experienceLevel).toBe('guided')
  })

  it('auto-promotes after repeated advanced interactions', () => {
    useExperienceStore.setState({
      experienceLevel: 'guided',
      behaviorSignals: {
        advancedTabVisits: 0,
        shareActions: 0,
      },
    })
    const store = useExperienceStore.getState()
    store.recordBehavior('advanced_tab_visit')
    store.recordBehavior('advanced_tab_visit')
    store.recordBehavior('advanced_tab_visit')

    expect(useExperienceStore.getState().experienceLevel).toBe('advanced')
    expect(useExperienceStore.getState().behaviorSignals.advancedTabVisits).toBe(3)
  })
})

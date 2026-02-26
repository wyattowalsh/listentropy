import { beforeEach, describe, expect, it } from 'vitest'

import { useExperienceStore } from './useExperienceStore'

describe('useExperienceStore', () => {
  beforeEach(() => {
    useExperienceStore.setState({
      experienceLevel: 'full',
      behaviorSignals: {
        fullTabVisits: 0,
        shareActions: 0,
      },
    })
  })

  it('defaults to full mode and can be manually changed', () => {
    expect(useExperienceStore.getState().experienceLevel).toBe('full')
    useExperienceStore.getState().setExperienceLevel('guided')
    expect(useExperienceStore.getState().experienceLevel).toBe('guided')
  })

  it('auto-promotes after repeated full interactions', () => {
    useExperienceStore.setState({
      experienceLevel: 'guided',
      behaviorSignals: {
        fullTabVisits: 0,
        shareActions: 0,
      },
    })
    const store = useExperienceStore.getState()
    store.recordBehavior('full_tab_visit')
    store.recordBehavior('full_tab_visit')
    store.recordBehavior('full_tab_visit')

    expect(useExperienceStore.getState().experienceLevel).toBe('full')
    expect(useExperienceStore.getState().behaviorSignals.fullTabVisits).toBe(3)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { useExperienceStore } from './useExperienceStore'

describe('useExperienceStore', () => {
  beforeEach(() => {
    useExperienceStore.setState({
      behaviorSignals: {
        fullTabVisits: 0,
        shareActions: 0,
      },
    })
  })

  it('tracks behavior counters without guided mode state', () => {
    const state = useExperienceStore.getState()

    expect(state.behaviorSignals).toEqual({ fullTabVisits: 0, shareActions: 0 })
    expect('experienceLevel' in state).toBe(false)
    expect('setExperienceLevel' in state).toBe(false)
  })

  it('increments the corresponding behavior counter', () => {
    const store = useExperienceStore.getState()

    store.recordBehavior('full_tab_visit')
    store.recordBehavior('full_tab_visit')
    store.recordBehavior('share_action')

    expect(useExperienceStore.getState().behaviorSignals).toEqual({
      fullTabVisits: 2,
      shareActions: 1,
    })
  })
})

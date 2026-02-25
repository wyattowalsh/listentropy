import { describe, expect, it } from 'vitest'

import { runLabModule } from '@/lib/labs/modules'
import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'
import type { CounterfactualsPayload, LabModuleId } from '@/lib/types'

const implementedModules: LabModuleId[] = [
  'sequence-motifs',
  'ritual-detector',
  'chronotype-drift',
  'stability-chaos',
  'novelty-economics',
  'era-microshifts',
  'compare-engine',
  'counterfactuals',
  'forecast-lite',
  'audio-affect-overlay',
]

describe('xenolab modules', () => {
  const snapshot = makeSyntheticLabSnapshot()

  it.each(implementedModules)('%s returns confidence + provenance', (moduleId) => {
    const result = runLabModule(moduleId, snapshot)
    expect(['ready', 'unsupported']).toContain(result.status)
    expect(result.confidence).toBeDefined()
    expect(result.provenance).toBeDefined()
    expect(result.provenance?.method).toMatch(/heuristic|descriptive/)
    expect(Array.isArray(result.provenance?.assumptions)).toBe(true)
    expect(Array.isArray(result.provenance?.warnings)).toBe(true)
  })

  it('counterfactuals invariants hold for eligible scenarios', () => {
    const result = runLabModule('counterfactuals', snapshot)
    expect(result.status).toBe('ready')
    const payload = result.payload as CounterfactualsPayload
    const byId = Object.fromEntries(payload.scenarios.map((scenario) => [scenario.id, scenario])) as Record<CounterfactualsPayload['scenarios'][number]['id'], CounterfactualsPayload['scenarios'][number]>

    if (byId['no-skips'].eligibility === 'eligible') {
      expect(byId['no-skips'].summaryDelta.skipRateDelta).toBeLessThanOrEqual(0)
    }
    if (byId['no-shuffle'].eligibility === 'eligible') {
      expect(byId['no-shuffle'].summaryDelta.shuffleRateDelta).toBeLessThanOrEqual(0)
    }
    if (byId['travel-removed'].eligibility === 'eligible') {
      const travelNote = byId['travel-removed'].notes.find((note) => note.startsWith('Travel share (internal check):'))
      expect(travelNote).toBeTruthy()
    }
  })
})

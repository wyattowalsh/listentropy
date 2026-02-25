import { describe, expect, it } from 'vitest'

import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'
import { buildGraphTimeSlices } from '@/lib/labs/graph-time-slices'

describe('buildGraphTimeSlices', () => {
  it('produces sorted yearly slices with normalized fields', () => {
    const snapshot = makeSyntheticLabSnapshot()
    const slices = buildGraphTimeSlices(snapshot)

    expect(slices.length).toBeGreaterThan(0)
    expect([...slices].sort((a, b) => a.year.localeCompare(b.year))).toEqual(slices)
    for (const slice of slices) {
      expect(slice.normalizedIntensity).toBeGreaterThanOrEqual(0)
      expect(slice.normalizedIntensity).toBeLessThanOrEqual(1)
      expect(slice.normalizedDiversity).toBeGreaterThanOrEqual(0)
      expect(slice.normalizedDiversity).toBeLessThanOrEqual(1)
      expect(slice.estimatedBridgePressure).toBeGreaterThanOrEqual(0)
      expect(slice.estimatedBridgePressure).toBeLessThanOrEqual(1)
    }
  })
})

import { describe, expect, it } from 'vitest'

import { runForecastSnapshotModule } from '@/lib/labs/modules/forecast'
import { makeSyntheticLabSnapshot, makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { buildDefaultLabDatasetSnapshot } from '@/lib/labs/registry'
import { processRecords } from '@/lib/processor'
import type { ForecastSnapshotPayload } from '@/lib/types'

describe('forecast-snapshot module', () => {
  it('returns unsupported for sparse monthly histories', () => {
    const sparse = buildDefaultLabDatasetSnapshot(processRecords(makeSyntheticRecords(18), { timezoneMode: 'local' }))
    const result = runForecastSnapshotModule(sparse)

    expect(result.status).toBe('unsupported')
    expect(result.confidence).toBeDefined()
    expect(result.provenance).toBeDefined()
  })

  it('returns deterministic heuristic forecast bands and trend signals', () => {
    const snapshot = makeSyntheticLabSnapshot()
    const result = runForecastSnapshotModule(snapshot)

    expect(result.status).toBe('ready')
    expect(result.confidence).toBeDefined()
    expect(result.provenance?.method).toMatch(/heuristic/i)

    const payload = result.payload as ForecastSnapshotPayload
    expect(payload.nextMonth).toMatch(/^\d{4}-\d{2}$/)
    expect(payload.bands.plays.low).toBeLessThanOrEqual(payload.bands.plays.mid)
    expect(payload.bands.plays.mid).toBeLessThanOrEqual(payload.bands.plays.high)
    expect(payload.bands.totalHours.low).toBeLessThanOrEqual(payload.bands.totalHours.high)
    expect(payload.trendSignals.length).toBeGreaterThan(0)
    expect(payload.trendSignals.every((signal) => Number.isFinite(signal.strength))).toBe(true)
    expect(payload.anomalyRisk.score).toBeGreaterThanOrEqual(0)
    expect(payload.anomalyRisk.score).toBeLessThanOrEqual(1)
  })
})


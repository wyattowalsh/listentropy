import { describe, expect, it } from 'vitest'

import { runCompareEngineModule } from '@/lib/labs/modules/compare'
import { makeSyntheticLabSnapshot, makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { buildDefaultLabDatasetSnapshot } from '@/lib/labs/registry'
import { processRecords } from '@/lib/processor'

describe('compare-engine module', () => {
  it('returns unsupported without a baseline snapshot option', () => {
    const current = makeSyntheticLabSnapshot()
    const result = runCompareEngineModule(current)

    expect(result.status).toBe('unsupported')
    expect(result.message).toMatch(/Capture a baseline dataset/i)
    expect(result.confidence).toBeDefined()
    expect(result.provenance).toBeDefined()
  })

  it('returns ready with aggregate deltas when baseline is provided', () => {
    const baseline = makeSyntheticLabSnapshot()
    const currentProcessed = processRecords(makeSyntheticRecords(320), { timezoneMode: 'utc' })
    const current = buildDefaultLabDatasetSnapshot(currentProcessed)

    const result = runCompareEngineModule(current, { baselineSnapshot: baseline })
    expect(result.status).toBe('ready')
    expect(result.confidence).toBeDefined()
    expect(result.provenance).toBeDefined()
    expect(result.provenance?.method).toMatch(/descriptive heuristic/i)

    const payload = result.payload
    expect(payload).toBeDefined()
    if (!payload) {
      return
    }
    expect(payload.topMetricShifts.length).toBeGreaterThan(0)
    expect(payload.topMetricShifts.every((item) => Number.isFinite(item.delta))).toBe(true)
    expect(payload.baseline.fingerprint).toBe(baseline.datasetIdentity.fingerprint)
    expect(payload.current.fingerprint).toBe(current.datasetIdentity.fingerprint)
    expect(payload.archetypeDelta).toBeDefined()
    expect(payload.eraDelta).toBeDefined()
    expect(payload.archetypeScoreShifts.length).toBeGreaterThan(0)
    expect(payload.archetypeScoreShifts.every((item) => Number.isFinite(item.delta))).toBe(true)
    expect(payload.eraPairDeltas.length).toBeGreaterThan(0)
    expect(payload.eraPairDeltas.every((item) => Number.isFinite(item.diversityScoreDelta))).toBe(true)
    expect(payload.eraVsEra).toBeDefined()
    expect(payload.archetypeTournament).toBeDefined()
    expect(payload.scope.id).toBe('all')
    expect(payload.sliceDelta.currentRecords).toBeGreaterThan(0)
  })

  it('supports scoped compare slices (night)', () => {
    const baselineProcessed = processRecords(makeSyntheticRecords(300), { timezoneMode: 'local' })
    const currentProcessed = processRecords(makeSyntheticRecords(360), { timezoneMode: 'local' })
    const baseline = buildDefaultLabDatasetSnapshot(baselineProcessed)
    const current = buildDefaultLabDatasetSnapshot(currentProcessed)

    const result = runCompareEngineModule(current, { baselineSnapshot: baseline, scopeId: 'night' })
    expect(result.status).toBe('ready')

    const payload = result.payload
    expect(payload).toBeDefined()
    if (!payload) {
      return
    }

    expect(payload.scope.id).toBe('night')
    expect(payload.scope.label).toMatch(/night/i)
    expect(payload.sliceDelta.baselineRecords).toBeGreaterThan(0)
    expect(payload.sliceDelta.currentRecords).toBeGreaterThan(0)
    expect(Number.isFinite(payload.sliceDelta.skipRateDelta)).toBe(true)
  })

  it('supports explicit era-vs-era selection and returns tournament rankings', () => {
    const baseline = buildDefaultLabDatasetSnapshot(processRecords(makeSyntheticRecords(520), { timezoneMode: 'local' }))
    const current = buildDefaultLabDatasetSnapshot(processRecords(makeSyntheticRecords(560), { timezoneMode: 'utc' }))

    expect(baseline.eras.length).toBeGreaterThan(0)
    expect(current.eras.length).toBeGreaterThan(0)

    const baselineEraId = baseline.eras[0]?.id
    const currentEraId = current.eras.at(-1)?.id
    expect(baselineEraId).toBeTruthy()
    expect(currentEraId).toBeTruthy()

    const result = runCompareEngineModule(current, { baselineSnapshot: baseline, baselineEraId, currentEraId })
    expect(result.status).toBe('ready')

    const payload = result.payload
    expect(payload).toBeDefined()
    if (!payload) {
      return
    }

    expect(payload.eraVsEra.selection.mode).toBe('manual')
    expect(payload.eraVsEra.selection.baselineEraId).toBe(baselineEraId)
    expect(payload.eraVsEra.selection.currentEraId).toBe(currentEraId)
    expect(payload.eraVsEra.baselineEra).toBeTruthy()
    expect(payload.eraVsEra.currentEra).toBeTruthy()
    if (!payload.eraVsEra.baselineEra || !payload.eraVsEra.currentEra) {
      return
    }
    expect(payload.eraVsEra.baselineEra.id).toBe(baselineEraId)
    expect(payload.eraVsEra.currentEra.id).toBe(currentEraId)
    expect(Number.isFinite(payload.eraVsEra.delta.diversityScoreDelta)).toBe(true)
    expect(Number.isFinite(payload.eraVsEra.dominantArtistOverlap.overlapShare)).toBe(true)
    expect(Number.isFinite(payload.eraVsEra.dominantArtistOverlap.rankWeightedOverlapScore)).toBe(true)
    expect(Number.isFinite(payload.eraVsEra.changeDriverOverlap.overlapShare)).toBe(true)
    expect(Array.isArray(payload.eraVsEra.dominantArtistOverlap.sharedDominantArtists)).toBe(true)
    expect(Array.isArray(payload.eraVsEra.dominantArtistOverlap.rankAlignedSharedArtists)).toBe(true)
    expect(Array.isArray(payload.eraVsEra.changeDriverOverlap.sharedDriverKeys)).toBe(true)

    expect(payload.archetypeTournament.rankings.length).toBeGreaterThan(0)
    expect(payload.archetypeTournament.rankings[0]?.rank).toBe(1)
    expect(payload.archetypeTournament.summary.totalArchetypes).toBe(payload.archetypeTournament.rankings.length)
  })
})

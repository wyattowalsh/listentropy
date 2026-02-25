import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'
import { useLabStore } from '@/store/useLabStore'

const runLabModuleWithFallbackMock = vi.fn()

vi.mock('@/lib/labs/worker-client', () => ({
  runLabModuleWithFallback: (...args: unknown[]) => runLabModuleWithFallbackMock(...args),
}))

function resetStore(): void {
  useLabStore.setState({
    selectedModuleId: null,
    selectedSceneId: 'intent-sankey',
    compareBaselineSnapshot: null,
    compareImportedSnapshot: null,
    compareSnapshotLibrary: [],
    compareSelectedBaselineSnapshotId: null,
    compareScopeId: 'all',
    compareBaselineEraId: null,
    compareCurrentEraId: null,
    compareImportMode: 'idle',
    compareImportProgress: null,
    compareImportError: null,
    moduleStatusByDataset: {},
    moduleResultsByDataset: {},
    lastErrorByModule: {},
    queue: [],
    explainabilityTarget: null,
  })
}

describe('useLabStore', () => {
  beforeEach(() => {
    runLabModuleWithFallbackMock.mockReset()
    resetStore()
  })

  it('caches module results by dataset fingerprint', async () => {
    const snapshot = makeSyntheticLabSnapshot()
    runLabModuleWithFallbackMock.mockResolvedValue({
      id: 'ritual-detector',
      status: 'ready',
      message: 'ok',
      confidence: { value: 0.7, label: 'medium', reasons: [] },
      provenance: {
        moduleId: 'ritual-detector',
        computedAt: new Date().toISOString(),
        durationMs: 12,
        sourceFields: ['records'],
        method: 'descriptive heuristic',
        assumptions: [],
        warnings: [],
      },
      payload: { rituals: [], ritualHeatmap: [] },
    })

    await useLabStore.getState().runModule(snapshot, 'ritual-detector')

    const fingerprint = snapshot.datasetIdentity.fingerprint
    expect(useLabStore.getState().moduleStatusByDataset[fingerprint]?.['ritual-detector']).toBe('ready')
    expect(useLabStore.getState().moduleResultsByDataset[fingerprint]?.['ritual-detector']?.status).toBe('ready')
    expect(useLabStore.getState().queue[0]?.moduleId).toBe('ritual-detector')
  })

  it('isolates cache entries across dataset fingerprints', async () => {
    const a = makeSyntheticLabSnapshot()
    const b = { ...makeSyntheticLabSnapshot(), datasetIdentity: { ...makeSyntheticLabSnapshot().datasetIdentity, fingerprint: 'le-test-b' } }

    runLabModuleWithFallbackMock.mockResolvedValue({
      id: 'sequence-motifs',
      status: 'unsupported',
      message: 'insufficient',
      confidence: { value: 0.2, label: 'low', reasons: [] },
      provenance: {
        moduleId: 'sequence-motifs',
        computedAt: new Date().toISOString(),
        durationMs: 5,
        sourceFields: [],
        method: 'descriptive heuristic',
        assumptions: [],
        warnings: ['insufficient'],
      },
    })

    await useLabStore.getState().runModule(a, 'sequence-motifs')
    await useLabStore.getState().runModule(b, 'sequence-motifs')

    expect(Object.keys(useLabStore.getState().moduleResultsByDataset)).toContain(a.datasetIdentity.fingerprint)
    expect(Object.keys(useLabStore.getState().moduleResultsByDataset)).toContain('le-test-b')
  })

  it('captures a baseline snapshot and passes it to compare-engine runs', async () => {
    const baseline = makeSyntheticLabSnapshot()
    const current = {
      ...makeSyntheticLabSnapshot(),
      datasetIdentity: { ...makeSyntheticLabSnapshot().datasetIdentity, fingerprint: 'le-current-cmp' },
    }

    runLabModuleWithFallbackMock.mockImplementation(
      async (
        _moduleId: unknown,
        _dataset: unknown,
        options: {
          baselineSnapshot?: { datasetIdentity?: { fingerprint?: string } }
          scopeId?: string
          baselineEraId?: string | null
          currentEraId?: string | null
        },
      ) => ({
        id: 'compare-engine',
        status: 'ready',
        message: 'Compared current dataset against baseline.',
        confidence: { value: 0.82, label: 'high', reasons: [] },
        provenance: {
          moduleId: 'compare-engine',
          computedAt: new Date().toISOString(),
          durationMs: 11,
          sourceFields: ['summary'],
          method: 'descriptive heuristic baseline-vs-current comparison',
          assumptions: [],
          warnings: [],
        },
        payload: {
          baseline: { fingerprint: options.baselineSnapshot?.datasetIdentity?.fingerprint ?? 'missing', recordCount: 10, timezoneMode: 'local' },
          current: { fingerprint: 'le-current-cmp', recordCount: 10, timezoneMode: 'local' },
          summaryDelta: {
            totalPlaysDelta: 1,
            totalHoursDelta: 0.1,
            skipRateDelta: -0.01,
            shuffleRateDelta: 0.02,
            nocturnalShareDelta: 0,
            top10ArtistShareDelta: 0,
            eclecticismDelta: 0,
            uniqueArtistsDelta: 1,
            sessionDepthAvgDelta: 0,
            travelShareDelta: 0,
          },
          topMetricShifts: [],
          archetypeScoreShifts: [],
          eraPairDeltas: [],
          eraDelta: { baselineEraCount: 2, currentEraCount: 2, delta: 0 },
          archetypeDelta: {
            baselinePrimaryKey: 'explorer',
            baselinePrimaryLabel: 'Explorer',
            currentPrimaryKey: 'explorer',
            currentPrimaryLabel: 'Explorer',
            changed: false,
          },
          scope: {
            id: 'night',
            label: 'Night Listening',
          },
          sliceDelta: {
            baselineRecords: 5,
            currentRecords: 6,
            totalHoursDelta: 0.1,
            skipRateDelta: 0,
            shuffleRateDelta: 0,
            uniqueArtistsDelta: 1,
            nocturnalShareDelta: 0,
          },
          eraVsEra: {
            selection: {
              mode: 'manual',
              baselineEraId: options.baselineEraId ?? 'baseline-era-1',
              currentEraId: options.currentEraId ?? 'current-era-1',
            },
            baselineEra: {
              id: options.baselineEraId ?? 'baseline-era-1',
              label: 'Baseline Era',
              startMonth: '2024-01',
              endMonth: '2024-03',
              durationMonths: 3,
              dominanceScore: 0.6,
              diversityScore: 0.4,
              confidence: 0.7,
            },
            currentEra: {
              id: options.currentEraId ?? 'current-era-1',
              label: 'Current Era',
              startMonth: '2024-04',
              endMonth: '2024-06',
              durationMonths: 3,
              dominanceScore: 0.5,
              diversityScore: 0.5,
              confidence: 0.75,
            },
            delta: {
              durationMonthsDelta: 0,
              dominanceScoreDelta: -0.1,
              diversityScoreDelta: 0.1,
              confidenceDelta: 0.05,
            },
            dominantArtistOverlap: {
              overlapShare: 0.5,
              rankWeightedOverlapScore: 0.4167,
              sharedDominantArtists: ['Artist A'],
              rankAlignedSharedArtists: [
                {
                  artist: 'Artist A',
                  baselineRank: 1,
                  currentRank: 2,
                  rankDistance: 1,
                },
              ],
              baselineOnlyDominantArtists: ['Artist B'],
              currentOnlyDominantArtists: ['Artist C'],
            },
            changeDriverOverlap: {
              overlapShare: 0.3333,
              sharedDriverKeys: ['artist-turnover'],
              baselineOnlyDriverKeys: ['context-shift'],
              currentOnlyDriverKeys: ['behavior-shift'],
            },
            notes: [],
          },
          archetypeTournament: {
            rankings: [
              {
                rank: 1,
                key: 'explorer',
                label: 'Explorer',
                baselineScore: 0.5,
                currentScore: 0.7,
                delta: 0.2,
                absDelta: 0.2,
                winner: 'current',
                direction: 'up',
              },
            ],
            summary: {
              totalArchetypes: 1,
              currentWins: 1,
              baselineWins: 0,
              ties: 0,
              topSwingKey: 'explorer',
              topSwingLabel: 'Explorer',
            },
          },
          notes: [],
        },
      }),
    )

    useLabStore.getState().captureCompareBaseline(baseline)
    useLabStore.getState().setCompareScopeId('night')
    useLabStore.getState().setCompareBaselineEraId('baseline-era-2')
    useLabStore.getState().setCompareCurrentEraId('current-era-4')
    await useLabStore.getState().runCompareAgainstBaseline(current)

    expect(runLabModuleWithFallbackMock).toHaveBeenCalledWith(
      'compare-engine',
      current,
      expect.objectContaining({
        baselineSnapshot: expect.objectContaining({
          datasetIdentity: expect.objectContaining({ fingerprint: baseline.datasetIdentity.fingerprint }),
        }),
        scopeId: 'night',
        baselineEraId: 'baseline-era-2',
        currentEraId: 'current-era-4',
      }),
    )

    expect(useLabStore.getState().compareBaselineSnapshot?.datasetIdentity.fingerprint).toBe(baseline.datasetIdentity.fingerprint)
    expect(useLabStore.getState().moduleResultsByDataset['le-current-cmp']?.['compare-engine']?.status).toBe('ready')
  })

  it('maintains a compare snapshot library with baseline selection and dedupe by fingerprint', () => {
    const a = makeSyntheticLabSnapshot()
    const sameA = { ...a, datasetIdentity: { ...a.datasetIdentity } }
    const b = {
      ...makeSyntheticLabSnapshot(),
      datasetIdentity: { ...makeSyntheticLabSnapshot().datasetIdentity, fingerprint: 'le-library-b' },
    }

    const idA1 = useLabStore.getState().saveCompareSnapshot(a, 'captured-current')
    const idA2 = useLabStore.getState().saveCompareSnapshot(sameA, 'captured-current')
    const idB = useLabStore.getState().saveCompareSnapshot(b, 'imported-zip')

    expect(idA1).toBe(idA2)
    expect(useLabStore.getState().compareSnapshotLibrary).toHaveLength(2)

    useLabStore.getState().setCompareBaselineFromLibrary(idB)
    expect(useLabStore.getState().compareBaselineSnapshot?.datasetIdentity.fingerprint).toBe('le-library-b')
    expect(useLabStore.getState().compareSelectedBaselineSnapshotId).toBe(idB)

    useLabStore.getState().removeCompareSnapshot(idB)
    expect(useLabStore.getState().compareSnapshotLibrary).toHaveLength(1)
    expect(useLabStore.getState().compareBaselineSnapshot).toBeNull()
    expect(useLabStore.getState().compareSelectedBaselineSnapshotId).toBeNull()
  })
})

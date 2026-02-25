import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LabWorkbench } from '@/components/views/LabWorkbench'
import { buildDefaultLabDatasetSnapshot } from '@/lib/labs/registry'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'
import type { AudioTraitSnapshot } from '@/lib/types'
import { useAudioTraitStore } from '@/store/useAudioTraitStore'
import { useLabStore } from '@/store/useLabStore'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

const SLOW_LAB_WORKBENCH_TEST_TIMEOUT_MS = 60_000

const runLabModuleWithFallbackMock = vi.fn()

vi.mock('@/lib/labs/worker-client', () => ({
  runLabModuleWithFallback: (...args: unknown[]) => runLabModuleWithFallbackMock(...args),
}))

function resetLabStore(): void {
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
  useAudioTraitStore.setState({
    providerId: 'spotify-audio-traits',
    snapshotByDatasetFingerprint: {},
    statusByDatasetFingerprint: {},
    errorByDatasetFingerprint: {},
    lastFetchMeta: null,
    capabilityStatus: 'unknown',
  })
  useSpotifyAuthStore.setState({
    status: 'disconnected',
    session: null,
    error: null,
  })
}

describe('LabWorkbench', () => {
  beforeEach(() => {
    runLabModuleWithFallbackMock.mockReset()
    resetLabStore()
  })

  it('renders Xenolab sections and can run a module to populate explainability', async () => {
    const data = processRecords(makeSyntheticRecords(120), { timezoneMode: 'local' })
    runLabModuleWithFallbackMock.mockResolvedValue({
      id: 'sequence-motifs',
      status: 'ready',
      message: 'Detected 4 recurring motifs.',
      confidence: {
        value: 0.78,
        label: 'high',
        reasons: ['fixture'],
      },
      provenance: {
        moduleId: 'sequence-motifs',
        computedAt: new Date().toISOString(),
        durationMs: 10,
        sourceFields: ['records', 'sessions'],
        method: 'descriptive heuristic motif mining over session-local windows',
        assumptions: ['Fixture assumption'],
        warnings: [],
      },
      payload: {
        motifs: [],
        surpriseJumps: [],
        sessionOpeners: [],
        sessionClosers: [],
      },
    })

    const user = userEvent.setup()
    render(<LabWorkbench data={data} />)

    expect(screen.getByRole('heading', { name: 'Xenolab' })).toBeInTheDocument()
    expect(screen.getByText('Spotify Audio Trait Enrichment')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare Audio Trait Snapshot' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Module Gallery' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Visual Scene Gallery' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('heading', { name: 'Compare Workspace' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: 'Explainability Drawer' })).toBeInTheDocument()

    const sequenceHeading = screen.getAllByText('Sequence Motifs')[0]
    const sequenceCard = sequenceHeading.closest('.rounded-theme') as HTMLElement | null
    expect(sequenceCard).toBeTruthy()
    if (!sequenceCard) {
      return
    }
    await user.click(within(sequenceCard).getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      expect(screen.getByText('Detected 4 recurring motifs.')).toBeInTheDocument()
    })

    expect(screen.getByText(/descriptive heuristic motif mining/i)).toBeInTheDocument()
    expect(screen.getByText(/Fixture assumption/)).toBeInTheDocument()
  }, SLOW_LAB_WORKBENCH_TEST_TIMEOUT_MS)

  it('runs audio-affect-overlay from the Spotify enrichment card when a snapshot is prepared', async () => {
    const data = processRecords(makeSyntheticRecords(150), { timezoneMode: 'local' })
    const fingerprint = data.datasetIdentity.fingerprint
    const firstTrackId = data.records.find((row) => row.spotify_track_uri)?.spotify_track_uri?.split(':')[2] ?? '0'
    const audioTraitSnapshot: AudioTraitSnapshot = {
      providerId: 'spotify-audio-traits',
      datasetFingerprint: fingerprint,
      traitsByTrackId: {
        [firstTrackId]: {
          trackId: firstTrackId,
          providerId: 'spotify-audio-traits',
          traits: {
            danceability: 0.6,
            energy: 0.7,
            valence: 0.5,
            acousticness: 0.2,
            instrumentalness: 0.1,
            speechiness: 0.05,
            tempo: 0.55,
            liveness: 0.2,
          },
          fetchedAt: new Date().toISOString(),
          sourceVersion: 'test',
        },
      },
      coverage: {
        recordRowsTotal: data.records.length,
        musicRowsEligible: data.records.length,
        rowsWithTrackUri: data.records.length,
        rowsMatchedToTrait: 1,
        rowsCoverageShare: 0.01,
        uniqueTrackIdsRequested: 20,
        uniqueTrackIdsResolved: 1,
        uniqueTrackCoverageShare: 0.05,
        podcastRowsExcluded: 0,
        localRowsExcluded: 0,
      },
      capabilities: {
        audioFeatures: 'available',
        tracks: 'unknown',
        artists: 'unknown',
        relatedArtists: 'unknown',
      },
      warnings: [],
      provenance: {
        fetchedAt: new Date().toISOString(),
        sourceVersion: 'test',
        providerLabel: 'Test Provider',
        tokenSource: 'manual-token',
      },
    }

    useAudioTraitStore.setState((state) => ({
      ...state,
      snapshotByDatasetFingerprint: {
        ...state.snapshotByDatasetFingerprint,
        [fingerprint]: audioTraitSnapshot,
      },
      statusByDatasetFingerprint: {
        ...state.statusByDatasetFingerprint,
        [fingerprint]: 'ready',
      },
    }))

    runLabModuleWithFallbackMock.mockResolvedValue({
      id: 'audio-affect-overlay',
      status: 'unsupported',
      message: 'Insufficient matched rows for audio-affect overlay (need at least 10 matched plays).',
      confidence: { value: 0.2, label: 'low', reasons: ['fixture'] },
      provenance: {
        moduleId: 'audio-affect-overlay',
        computedAt: new Date().toISOString(),
        durationMs: 5,
        sourceFields: ['records'],
        method: 'descriptive heuristic (unsupported fallback)',
        assumptions: ['fixture'],
        warnings: [],
      },
    })

    const user = userEvent.setup()
    render(<LabWorkbench data={data} />)

    await user.click(screen.getByRole('button', { name: 'Run Audio Affect Overlay' }))

    await waitFor(() => {
      expect(runLabModuleWithFallbackMock).toHaveBeenCalled()
    })

    const [moduleId, datasetArg, optionsArg] = runLabModuleWithFallbackMock.mock.calls[0] as [string, { datasetIdentity: { fingerprint: string } }, { audioTraitSnapshot?: AudioTraitSnapshot }]
    expect(moduleId).toBe('audio-affect-overlay')
    expect(datasetArg.datasetIdentity.fingerprint).toBe(fingerprint)
    expect(optionsArg.audioTraitSnapshot?.datasetFingerprint).toBe(fingerprint)
  }, SLOW_LAB_WORKBENCH_TEST_TIMEOUT_MS)

  it('captures a compare baseline and runs compare-engine from Compare Workspace', async () => {
    const baselineData = processRecords(makeSyntheticRecords(120), { timezoneMode: 'local' })
    const currentData = processRecords(makeSyntheticRecords(240), { timezoneMode: 'utc' })

    runLabModuleWithFallbackMock.mockResolvedValue({
      id: 'compare-engine',
      status: 'ready',
      message: 'Compared current dataset against baseline (different dataset).',
      confidence: {
        value: 0.84,
        label: 'high',
        reasons: ['fixture compare'],
      },
      provenance: {
        moduleId: 'compare-engine',
        computedAt: new Date().toISOString(),
        durationMs: 12,
        sourceFields: ['summary', 'contextAnalytics.country'],
        method: 'descriptive heuristic baseline-vs-current comparison over core aggregate outputs',
        assumptions: ['Fixture compare'],
        warnings: [],
      },
      payload: {
        baseline: {
          fingerprint: baselineData.datasetIdentity.fingerprint,
          recordCount: baselineData.datasetIdentity.recordCount,
          timezoneMode: baselineData.timezoneMode,
        },
        current: {
          fingerprint: currentData.datasetIdentity.fingerprint,
          recordCount: currentData.datasetIdentity.recordCount,
          timezoneMode: currentData.timezoneMode,
        },
        summaryDelta: {
          totalPlaysDelta: 120,
          totalHoursDelta: 6.2,
          skipRateDelta: -0.01,
          shuffleRateDelta: 0.05,
          nocturnalShareDelta: 0.02,
          top10ArtistShareDelta: -0.04,
          eclecticismDelta: 0.03,
          uniqueArtistsDelta: 4,
          sessionDepthAvgDelta: 0.6,
          travelShareDelta: 0.01,
        },
        topMetricShifts: [
          { key: 'totalPlays', label: 'Total Plays', delta: 120, absDelta: 120, direction: 'up' },
          { key: 'totalHours', label: 'Total Hours', delta: 6.2, absDelta: 6.2, direction: 'up' },
        ],
        eraPairDeltas: [
          {
            pairIndex: 0,
            baselineEraId: 'era-a',
            baselineEraLabel: 'Baseline Era A',
            currentEraId: 'era-b',
            currentEraLabel: 'Current Era B',
            durationMonthsDelta: 1,
            dominanceScoreDelta: 0.08,
            diversityScoreDelta: -0.04,
            confidenceDelta: 0.02,
          },
        ],
        eraDelta: { baselineEraCount: 3, currentEraCount: 4, delta: 1 },
        archetypeDelta: {
          baselinePrimaryKey: baselineData.archetypes.primary.key,
          baselinePrimaryLabel: baselineData.archetypes.primary.label,
          currentPrimaryKey: currentData.archetypes.primary.key,
          currentPrimaryLabel: currentData.archetypes.primary.label,
          changed: baselineData.archetypes.primary.key !== currentData.archetypes.primary.key,
        },
        archetypeScoreShifts: [
          {
            key: baselineData.archetypes.primary.key,
            label: baselineData.archetypes.primary.label,
            baselineScore: 0.52,
            currentScore: 0.74,
            delta: 0.22,
            absDelta: 0.22,
            direction: 'up',
          },
        ],
        scope: {
          id: 'all',
          label: 'All Records',
        },
        sliceDelta: {
          baselineRecords: 120,
          currentRecords: 240,
          totalHoursDelta: 6.2,
          skipRateDelta: -0.01,
          shuffleRateDelta: 0.05,
          uniqueArtistsDelta: 4,
          nocturnalShareDelta: 0.02,
        },
        eraVsEra: {
          selection: {
            mode: 'manual',
            baselineEraId: 'era-a',
            currentEraId: 'era-b',
          },
          baselineEra: {
            id: 'era-a',
            label: 'Baseline Era A',
            startMonth: '2024-01',
            endMonth: '2024-03',
            durationMonths: 3,
            dominanceScore: 0.61,
            diversityScore: 0.39,
            confidence: 0.71,
          },
          currentEra: {
            id: 'era-b',
            label: 'Current Era B',
            startMonth: '2024-04',
            endMonth: '2024-06',
            durationMonths: 3,
            dominanceScore: 0.52,
            diversityScore: 0.48,
            confidence: 0.73,
          },
          delta: {
            durationMonthsDelta: 0,
            dominanceScoreDelta: -0.09,
            diversityScoreDelta: 0.09,
            confidenceDelta: 0.02,
          },
          dominantArtistOverlap: {
            overlapShare: 0.5,
            rankWeightedOverlapScore: 0.4167,
            sharedDominantArtists: ['Artist One'],
            rankAlignedSharedArtists: [
              {
                artist: 'Artist One',
                baselineRank: 1,
                currentRank: 2,
                rankDistance: 1,
              },
            ],
            baselineOnlyDominantArtists: ['Artist Two'],
            currentOnlyDominantArtists: ['Artist Three'],
          },
          changeDriverOverlap: {
            overlapShare: 0.3333,
            sharedDriverKeys: ['artist-turnover'],
            baselineOnlyDriverKeys: ['context-shift'],
            currentOnlyDriverKeys: ['behavior-shift'],
          },
          notes: ['Era overlap note'],
        },
        archetypeTournament: {
          rankings: [
            {
              rank: 1,
              key: baselineData.archetypes.primary.key,
              label: baselineData.archetypes.primary.label,
              baselineScore: 0.52,
              currentScore: 0.74,
              delta: 0.22,
              absDelta: 0.22,
              winner: 'current',
              direction: 'up',
            },
          ],
          summary: {
            totalArchetypes: 1,
            currentWins: 1,
            baselineWins: 0,
            ties: 0,
            topSwingKey: baselineData.archetypes.primary.key,
            topSwingLabel: baselineData.archetypes.primary.label,
          },
        },
        notes: ['Fixture compare note'],
      },
    })

    const user = userEvent.setup()
    const { rerender } = render(<LabWorkbench data={baselineData} />)
    await user.click(screen.getByRole('button', { name: 'Capture Current as Baseline' }))

    rerender(<LabWorkbench data={currentData} />)

    await user.click(screen.getByRole('button', { name: 'Run Compare' }))

    await waitFor(() => {
      expect(screen.getAllByText(/Compared current dataset against baseline/i).length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByText('Top Metric Shifts')).toBeInTheDocument()
    expect(screen.getByText('Compare Visual Summary')).toBeInTheDocument()
    expect(screen.getByText('Metric Swing Bars')).toBeInTheDocument()
    expect(screen.getByText('Archetype Swing Mini Chart')).toBeInTheDocument()
    expect(screen.getByText('Archetype Score Shifts')).toBeInTheDocument()
    expect(screen.getByText('Era Pair Deltas')).toBeInTheDocument()
    expect(screen.getByText('Era vs Era Compare')).toBeInTheDocument()
    expect(screen.getByText('Dominant Artist Overlap Details')).toBeInTheDocument()
    expect(screen.getByText('Rank-Weighted Overlap')).toBeInTheDocument()
    expect(screen.getByText('Aligned Shared Artists (Rank-Aware)')).toBeInTheDocument()
    expect(screen.getByText('Change Driver Overlap Details')).toBeInTheDocument()
    expect(screen.getByText('Archetype Tournament')).toBeInTheDocument()
    expect(screen.getByText(/Fixture compare note/)).toBeInTheDocument()
  }, SLOW_LAB_WORKBENCH_TEST_TIMEOUT_MS)

  it('shows saved compare snapshots after capturing baseline', async () => {
    const data = processRecords(makeSyntheticRecords(180), { timezoneMode: 'local' })
    const user = userEvent.setup()
    render(<LabWorkbench data={data} />)

    await user.click(screen.getByRole('button', { name: 'Capture Current as Baseline' }))

    expect(screen.getByText('Saved Compare Snapshots')).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(data.datasetIdentity.fingerprint)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/captured current/i).length).toBeGreaterThanOrEqual(1)
  }, SLOW_LAB_WORKBENCH_TEST_TIMEOUT_MS)

  it('clears invalid compare era selections when baseline/current datasets change', async () => {
    const baselineData = processRecords(makeSyntheticRecords(140), { timezoneMode: 'local' })
    const currentData = processRecords(makeSyntheticRecords(220), { timezoneMode: 'utc' })
    const baselineSnapshot = buildDefaultLabDatasetSnapshot(baselineData)

    useLabStore.setState({
      compareBaselineSnapshot: baselineSnapshot,
      compareBaselineEraId: 'missing-baseline-era',
      compareCurrentEraId: 'missing-current-era',
    })

    render(<LabWorkbench data={currentData} />)

    await waitFor(() => {
      expect(useLabStore.getState().compareBaselineEraId).toBeNull()
      expect(useLabStore.getState().compareCurrentEraId).toBeNull()
    })

    expect(screen.getByLabelText('Baseline era selector')).toHaveValue('')
    expect(screen.getByLabelText('Current era selector')).toHaveValue('')
  }, SLOW_LAB_WORKBENCH_TEST_TIMEOUT_MS)
})

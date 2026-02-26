import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ModuleResultCard } from '@/components/labs/ModuleResultCard'
import { getLabModuleManifest } from '@/lib/labs/registry'
import type { AudioAffectOverlayPayload, ForecastSnapshotPayload, LabModuleResult } from '@/lib/types'

function makeAudioAffectResult(): LabModuleResult<AudioAffectOverlayPayload> {
  return {
    id: 'audio-affect-overlay',
    status: 'ready',
    message: 'Computed audio-affect overlay from 120 Spotify tracks (68% row coverage).',
    confidence: {
      value: 0.72,
      label: 'medium',
      reasons: ['coverage'],
    },
    provenance: {
      moduleId: 'audio-affect-overlay',
      computedAt: new Date().toISOString(),
      durationMs: 14,
      sourceFields: ['records', 'eras', 'datasetIdentity'],
      method: 'descriptive heuristic weighted audio-trait centroid aggregation',
      assumptions: ['test fixture'],
      warnings: [],
    },
    payload: {
      coverage: {
        recordRowsTotal: 300,
        musicRowsEligible: 260,
        rowsWithTrackUri: 240,
        rowsMatchedToTrait: 164,
        rowsCoverageShare: 0.6833,
        uniqueTrackIdsRequested: 120,
        uniqueTrackIdsResolved: 98,
        uniqueTrackCoverageShare: 0.8167,
        podcastRowsExcluded: 20,
        localRowsExcluded: 10,
      },
      overallCentroid: {
        danceability: 0.63,
        energy: 0.58,
        valence: 0.47,
        acousticness: 0.21,
        instrumentalness: 0.06,
        speechiness: 0.08,
        tempo: 0.55,
        liveness: 0.22,
      },
      daypartCentroids: {
        'late-night': { danceability: 0.61, energy: 0.52, valence: 0.44, acousticness: 0.22, instrumentalness: 0.07, speechiness: 0.09, tempo: 0.5, liveness: 0.23, sampleRows: 40 },
        morning: { danceability: 0.62, energy: 0.55, valence: 0.45, acousticness: 0.21, instrumentalness: 0.07, speechiness: 0.08, tempo: 0.52, liveness: 0.22, sampleRows: 35 },
        afternoon: { danceability: 0.65, energy: 0.6, valence: 0.49, acousticness: 0.2, instrumentalness: 0.05, speechiness: 0.08, tempo: 0.57, liveness: 0.21, sampleRows: 45 },
        evening: { danceability: 0.64, energy: 0.59, valence: 0.48, acousticness: 0.2, instrumentalness: 0.05, speechiness: 0.08, tempo: 0.56, liveness: 0.22, sampleRows: 44 },
      },
      eraCentroids: [
        {
          eraId: 'era-1',
          eraLabel: 'Era One',
          sampleRows: 80,
          centroid: {
            danceability: 0.6,
            energy: 0.55,
            valence: 0.46,
            acousticness: 0.22,
            instrumentalness: 0.07,
            speechiness: 0.08,
            tempo: 0.54,
            liveness: 0.22,
          },
          spread: {
            danceability: 0.08,
            energy: 0.07,
          },
        },
      ],
      capabilities: {
        audioFeatures: 'available',
        tracks: 'unknown',
        artists: 'unknown',
        relatedArtists: 'unknown',
      },
      notes: ['test note'],
    },
  }
}

describe('ModuleResultCard', () => {
  it('renders audio-affect overlay coverage and centroid summary', () => {
    const manifest = getLabModuleManifest('audio-affect-overlay')
    expect(manifest).toBeDefined()
    render(
      <ModuleResultCard
        manifest={manifest!}
        status="ready"
        result={makeAudioAffectResult()}
        onRun={() => {}}
        onRetry={() => {}}
        onExplain={() => {}}
      />,
    )

    expect(screen.getByText('Audio Trait Coverage')).toBeInTheDocument()
    expect(screen.getByText('Overall Trait Centroid')).toBeInTheDocument()
    expect(screen.getByText('Danceability')).toBeInTheDocument()
    expect(screen.getByText('Tempo (normalized)')).toBeInTheDocument()
    expect(screen.getByText('68%')).toBeInTheDocument()
    expect(screen.getByText('Era Centroids')).toBeInTheDocument()
    expect(screen.getByText('coverage 68%')).toBeInTheDocument()
    expect(screen.getByText(/traits available/i)).toBeInTheDocument()
  })

  it('renders forecast-snapshot summary bands and anomaly risk', () => {
    const manifest = getLabModuleManifest('forecast-snapshot')
    expect(manifest).toBeDefined()
    const result: LabModuleResult<ForecastSnapshotPayload> = {
      id: 'forecast-snapshot',
      status: 'ready',
      message: 'Forecasted next month range from recent monthly behavior.',
      confidence: {
        value: 0.64,
        label: 'medium',
        reasons: ['recent monthly coverage'],
      },
      provenance: {
        moduleId: 'forecast-snapshot',
        computedAt: new Date().toISOString(),
        durationMs: 11,
        sourceFields: ['monthly', 'monthlyBehavior'],
        method: 'descriptive heuristic one-step smoothing forecast',
        assumptions: ['test fixture'],
        warnings: [],
      },
      payload: {
        nextMonth: '2025-03',
        horizonMonths: 1,
        bands: {
          plays: { low: 420, mid: 480, high: 550 },
          totalHours: { low: 28, mid: 33, high: 39 },
          skipRate: { low: 0.08, mid: 0.11, high: 0.15 },
          shuffleRate: { low: 0.32, mid: 0.39, high: 0.46 },
        },
        trendSignals: [
          { key: 'plays', label: 'Plays', direction: 'up', strength: 0.6, basisMonths: 6 },
          { key: 'skipRate', label: 'Skip Rate', direction: 'flat', strength: 0.2, basisMonths: 6 },
        ],
        anomalyRisk: {
          level: 'medium',
          score: 0.52,
          reasons: ['Recent volatility in monthly plays'],
        },
        basisMonths: ['2024-09', '2024-10', '2024-11', '2024-12', '2025-01', '2025-02'],
      },
    }

    render(
      <ModuleResultCard
        manifest={manifest!}
        status="ready"
        result={result}
        onRun={() => {}}
        onRetry={() => {}}
        onExplain={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Forecast Snapshot' })).toBeInTheDocument()
    expect(screen.getByText('Forecast Snapshot', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Forecast Month')).toBeInTheDocument()
    expect(screen.getByText('2025-03')).toBeInTheDocument()
    expect(screen.getByText('Anomaly Risk')).toBeInTheDocument()
    expect(screen.getAllByText(/^medium$/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Forecast Bands (midpoints)')).toBeInTheDocument()
    expect(screen.getByText('480 plays')).toBeInTheDocument()
    expect(screen.getByText('33.0 h')).toBeInTheDocument()
    expect(screen.getByText('11% skip')).toBeInTheDocument()
    expect(screen.getByText('39% shuffle')).toBeInTheDocument()
    expect(screen.getByText('Trend Signals')).toBeInTheDocument()
    expect(screen.getByText(/Plays: up/i)).toBeInTheDocument()
  })
})

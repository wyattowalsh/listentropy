import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ExplainabilityDrawer } from '@/components/labs/ExplainabilityDrawer'
import { getLabModuleManifest } from '@/lib/labs/registry'
import type { AudioAffectOverlayPayload, ForecastSnapshotPayload, LabModuleResult } from '@/lib/types'

function makeAudioAffectResult(): LabModuleResult<AudioAffectOverlayPayload> {
  return {
    id: 'audio-affect-overlay',
    status: 'ready',
    message: 'Audio trait overlay computed.',
    confidence: {
      value: 0.74,
      label: 'medium',
      reasons: ['coverage is moderate'],
    },
    provenance: {
      moduleId: 'audio-affect-overlay',
      computedAt: '2026-02-23T10:00:00.000Z',
      durationMs: 18,
      sourceFields: ['records', 'eras', 'datasetIdentity'],
      method: 'descriptive heuristic weighted audio-trait centroid aggregation',
      assumptions: ['Spotify audio trait snapshot is representative of matched rows'],
      warnings: ['Row coverage below 75%; centroids may underrepresent unmatched tracks'],
    },
    payload: {
      coverage: {
        recordRowsTotal: 200,
        musicRowsEligible: 170,
        rowsWithTrackUri: 160,
        rowsMatchedToTrait: 112,
        rowsCoverageShare: 0.7,
        uniqueTrackIdsRequested: 80,
        uniqueTrackIdsResolved: 62,
        uniqueTrackCoverageShare: 0.775,
        podcastRowsExcluded: 20,
        localRowsExcluded: 10,
      },
      overallCentroid: {
        danceability: 0.66,
        energy: 0.59,
        valence: 0.48,
        acousticness: 0.19,
        instrumentalness: 0.03,
        speechiness: 0.09,
        tempo: 0.57,
        liveness: 0.2,
      },
      daypartCentroids: {
        'late-night': { danceability: 0.62, energy: 0.51, valence: 0.42, acousticness: 0.22, instrumentalness: 0.05, speechiness: 0.09, tempo: 0.5, liveness: 0.21, sampleRows: 31 },
        morning: { danceability: 0.65, energy: 0.57, valence: 0.47, acousticness: 0.2, instrumentalness: 0.04, speechiness: 0.08, tempo: 0.55, liveness: 0.19, sampleRows: 22 },
        afternoon: { danceability: 0.67, energy: 0.61, valence: 0.5, acousticness: 0.18, instrumentalness: 0.03, speechiness: 0.08, tempo: 0.58, liveness: 0.2, sampleRows: 30 },
        evening: { danceability: 0.68, energy: 0.6, valence: 0.49, acousticness: 0.18, instrumentalness: 0.03, speechiness: 0.08, tempo: 0.58, liveness: 0.2, sampleRows: 29 },
      },
      eraCentroids: [
        {
          eraId: 'era-1',
          eraLabel: 'Test Era',
          sampleRows: 50,
          centroid: {
            danceability: 0.64,
            energy: 0.56,
            valence: 0.46,
            acousticness: 0.2,
            instrumentalness: 0.04,
            speechiness: 0.08,
            tempo: 0.55,
            liveness: 0.2,
          },
          spread: { danceability: 0.07, energy: 0.08 },
        },
      ],
      capabilities: {
        audioFeatures: 'available',
        tracks: 'unknown',
        artists: 'unknown',
        relatedArtists: 'unknown',
      },
      notes: ['Spotify endpoint access available for audio features'],
    },
  }
}

function makeForecastResult(): LabModuleResult<ForecastSnapshotPayload> {
  return {
    id: 'forecast-snapshot',
    status: 'ready',
    message: 'Forecast completed.',
    confidence: {
      value: 0.63,
      label: 'medium',
      reasons: ['6 monthly periods available'],
    },
    provenance: {
      moduleId: 'forecast-snapshot',
      computedAt: '2026-02-23T10:00:00.000Z',
      durationMs: 9,
      sourceFields: ['monthly', 'monthlyBehavior'],
      method: 'descriptive heuristic one-step smoothing forecast',
      assumptions: ['Recent monthly behavior is a suitable short-term baseline'],
      warnings: ['Volatility elevated in the last 2 months'],
    },
    payload: {
      nextMonth: '2026-03',
      horizonMonths: 1,
      bands: {
        plays: { low: 410, mid: 480, high: 560 },
        totalHours: { low: 24, mid: 31, high: 39 },
        skipRate: { low: 0.09, mid: 0.12, high: 0.16 },
        shuffleRate: { low: 0.3, mid: 0.37, high: 0.43 },
      },
      trendSignals: [
        { key: 'plays', label: 'Plays', direction: 'up', strength: 0.52, basisMonths: 6 },
      ],
      anomalyRisk: {
        level: 'medium',
        score: 0.57,
        reasons: ['Recent month-to-month variance increased'],
      },
      basisMonths: ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'],
    },
  }
}

describe('ExplainabilityDrawer', () => {
  it('renders audio-affect specific coverage and capability details', () => {
    const manifest = getLabModuleManifest('audio-affect-overlay')
    render(<ExplainabilityDrawer manifest={manifest} result={makeAudioAffectResult()} />)

    expect(screen.getByText('Audio Trait Enrichment')).toBeInTheDocument()
    expect(screen.getByText(/^Row coverage$/i)).toBeInTheDocument()
    expect(screen.getByText(/70%/)).toBeInTheDocument()
    expect(screen.getByText(/^Track coverage$/i)).toBeInTheDocument()
    expect(screen.getByText(/78%/)).toBeInTheDocument()
    expect(screen.getByText(/Audio trait capability/i)).toBeInTheDocument()
    expect(screen.getByText(/^available$/i)).toBeInTheDocument()
  })

  it('renders forecast-snapshot specific forecast context details', () => {
    const manifest = getLabModuleManifest('forecast-snapshot')
    render(<ExplainabilityDrawer manifest={manifest} result={makeForecastResult()} />)

    expect(screen.getByText('Forecast Context')).toBeInTheDocument()
    expect(screen.getByText(/Forecast month/i)).toBeInTheDocument()
    expect(screen.getByText('2026-03')).toBeInTheDocument()
    expect(screen.getByText(/Anomaly risk/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^medium$/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Basis months/i)).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })
})

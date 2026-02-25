import { describe, expect, it } from 'vitest'

import { runAudioAffectOverlayModule } from '@/lib/labs/modules/enrichment'
import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'
import type { AudioTraitSnapshot } from '@/lib/types'

function buildTraitSnapshot(datasetFingerprint: string, trackIds: string[]): AudioTraitSnapshot {
  const traitsByTrackId = Object.fromEntries(
    [...new Set(trackIds)].map((trackId, index) => [
      trackId,
      {
        trackId,
        providerId: 'spotify-audio-traits' as const,
        traits: {
          danceability: 0.4 + (index % 5) * 0.1,
          energy: 0.5,
          valence: 0.45,
          acousticness: 0.2,
          instrumentalness: 0.1,
          speechiness: 0.05,
          tempo: 0.6,
          liveness: 0.25,
        },
        fetchedAt: new Date().toISOString(),
        sourceVersion: 'test',
      },
    ]),
  )

  return {
    providerId: 'spotify-audio-traits',
    datasetFingerprint,
    traitsByTrackId,
    coverage: {
      recordRowsTotal: 0,
      musicRowsEligible: 0,
      rowsWithTrackUri: 0,
      rowsMatchedToTrait: 0,
      rowsCoverageShare: 0.8,
      uniqueTrackIdsRequested: trackIds.length,
      uniqueTrackIdsResolved: Object.keys(traitsByTrackId).length,
      uniqueTrackCoverageShare: 0.8,
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
}

describe('audio-affect-overlay module', () => {
  it('returns unsupported when no audio trait snapshot is passed', () => {
    const snapshot = makeSyntheticLabSnapshot()
    const result = runAudioAffectOverlayModule(snapshot)
    expect(result.status).toBe('unsupported')
    expect(result.confidence).toBeDefined()
    expect(result.provenance).toBeDefined()
  })

  it('returns ready with centroids and coverage when traits are provided', () => {
    const snapshot = makeSyntheticLabSnapshot()
    const trackIds = snapshot.records
      .map((record) => record.spotify_track_uri?.split(':')[2])
      .filter((id): id is string => Boolean(id))
      .slice(0, 30)
    const audioTraitSnapshot = buildTraitSnapshot(snapshot.datasetIdentity.fingerprint, trackIds)

    const result = runAudioAffectOverlayModule(snapshot, { audioTraitSnapshot })
    expect(result.status).toBe('ready')
    expect(result.confidence).toBeDefined()
    expect(result.provenance).toBeDefined()
    expect(result.payload).toBeDefined()
    if (!result.payload) {
      return
    }
    expect(result.payload.coverage).toBeDefined()
    expect(result.payload.overallCentroid.danceability).toBeGreaterThan(0)
    expect(result.payload.daypartCentroids.morning.sampleRows).toBeGreaterThanOrEqual(0)
    expect(result.payload.eraCentroids.every((era) => Number.isFinite(era.centroid.energy))).toBe(true)
  })
})

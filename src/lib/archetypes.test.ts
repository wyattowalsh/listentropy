import { describe, expect, it } from 'vitest'

import type { ProcessedDataSummary } from './types'
import { computeArchetypes } from './archetypes'

function baseSummary(overrides: Partial<ProcessedDataSummary> = {}): ProcessedDataSummary {
  return {
    totalMs: 4_000_000,
    totalPlays: 20_000,
    totalHours: 1111,
    uniqueArtists: 6000,
    uniqueTracks: 25000,
    uniqueAlbums: 8000,
    firstListen: '2011-01-01T00:00:00Z',
    lastListen: '2026-01-01T00:00:00Z',
    skipRate: 0.22,
    shuffleRate: 0.72,
    peakHour: 23,
    nocturnalShare: 0.44,
    longestStreakDays: 42,
    topTrackPlayCount: 650,
    top10ArtistShare: 0.18,
    top20ArtistShare: 0.38,
    bingeFactor: 0.31,
    eclecticism: 0.89,
    yearsCovered: 15,
    sessionDepthAvg: 12,
    ...overrides,
  }
}

describe('computeArchetypes', () => {
  it('returns deterministic primary + secondary badges', () => {
    const archetypes = computeArchetypes(baseSummary())
    expect(archetypes.primary.key).toBe('obsessive')
    expect(archetypes.secondary).toHaveLength(2)
    expect(archetypes.allScores.length).toBeGreaterThan(3)
  })

  it('detects skippers with high skip rates', () => {
    const archetypes = computeArchetypes(
      baseSummary({ skipRate: 0.48, top10ArtistShare: 0.6, uniqueArtists: 1000 }),
    )
    expect(archetypes.primary.key).toBe('skipper')
  })

  it('documents tie-break metadata for equal scores', () => {
    const archetypes = computeArchetypes(
      baseSummary({
        skipRate: 0.2,
        topTrackPlayCount: 100,
        nocturnalShare: 0.2,
        shuffleRate: 0.2,
        totalHours: 100,
        yearsCovered: 5,
      }),
    )
    expect(typeof archetypes.tieBreak.reason).toBe('string')
  })
})

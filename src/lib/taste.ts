import { toMonthKey } from './utils'
import type { ProcessedDataSummary, StreamRecord, TasteDimension, TasteProfile } from './types'

const DIMENSION_LABELS: Array<[string, string]> = [
  ['intensity', 'Intensity'],
  ['loyalty', 'Loyalty'],
  ['discoveryRate', 'Discovery Rate'],
  ['nocturnalScore', 'Nocturnal Score'],
  ['persistence', 'Persistence'],
  ['shuffleTendency', 'Shuffle Tendency'],
  ['bingeFactor', 'Binge Factor'],
  ['eclecticism', 'Eclecticism'],
  ['sessionDepth', 'Session Depth'],
  ['nostalgia', 'Decade Nostalgia'],
]

function normalize(value: number, max = 1): number {
  return Math.min(1, Math.max(0, value / max))
}

export function buildTasteProfile(
  summary: ProcessedDataSummary,
  records: StreamRecord[],
): TasteProfile {
  const dimensions: TasteDimension[] = [
    { key: 'intensity', label: 'Intensity', score: normalize(summary.totalHours, 4000) },
    { key: 'loyalty', label: 'Loyalty', score: summary.top10ArtistShare },
    { key: 'discoveryRate', label: 'Discovery Rate', score: Math.max(0, 1 - summary.top20ArtistShare) },
    { key: 'nocturnalScore', label: 'Nocturnal Score', score: summary.nocturnalShare },
    { key: 'persistence', label: 'Persistence', score: normalize(summary.totalMs / Math.max(1, summary.totalPlays), 240000) },
    { key: 'shuffleTendency', label: 'Shuffle Tendency', score: summary.shuffleRate },
    { key: 'bingeFactor', label: 'Binge Factor', score: summary.bingeFactor },
    { key: 'eclecticism', label: 'Eclecticism', score: summary.eclecticism },
    { key: 'sessionDepth', label: 'Session Depth', score: normalize(summary.sessionDepthAvg, 15) },
    { key: 'nostalgia', label: 'Decade Nostalgia', score: normalize(summary.yearsCovered, 15) },
  ]

  const monthly = new Map<string, StreamRecord[]>()
  for (const record of records) {
    const month = toMonthKey(new Date(record.ts))
    const list = monthly.get(month) ?? []
    list.push(record)
    monthly.set(month, list)
  }

  const yearlyMap = new Map<string, StreamRecord[]>()
  for (const [month, monthRecords] of monthly.entries()) {
    const year = month.slice(0, 4)
    const list = yearlyMap.get(year) ?? []
    yearlyMap.set(year, list.concat(monthRecords))
  }

  const yearlyFingerprints = [...yearlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, yearRecords]) => {
      const plays = yearRecords.length
      const shuffle = yearRecords.filter((record) => record.shuffle).length / Math.max(1, plays)
      const skip = yearRecords.filter((record) => record.skipped).length / Math.max(1, plays)
      const uniqueArtists = new Set(
        yearRecords
          .map((record) => record.master_metadata_album_artist_name)
          .filter((item): item is string => Boolean(item)),
      ).size
      const baseScores: Record<string, number> = {
        intensity: normalize(plays, 30000),
        loyalty: normalize(1 - skip),
        discoveryRate: normalize(uniqueArtists, 2000),
        nocturnalScore: shuffle,
        persistence: normalize(yearRecords.reduce((sum, record) => sum + record.ms_played, 0) / Math.max(1, plays), 250000),
        shuffleTendency: shuffle,
        bingeFactor: normalize(plays / Math.max(1, uniqueArtists), 30),
        eclecticism: normalize(uniqueArtists, 2000),
        sessionDepth: normalize(plays / 365, 40),
        nostalgia: normalize(Number(year) - 2011, 15),
      }
      return {
        year,
        dimensions: DIMENSION_LABELS.map(([key, label]) => ({
          key,
          label,
          score: baseScores[key] ?? 0,
        })),
      }
    })

  return { dimensions, yearlyFingerprints }
}

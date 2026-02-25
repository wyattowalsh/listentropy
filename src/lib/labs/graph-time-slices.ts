import type { LabDatasetSnapshot } from '@/lib/types'

export interface GraphTimeSlice {
  year: string
  plays: number
  totalMs: number
  uniqueArtists: number
  normalizedIntensity: number
  normalizedDiversity: number
  estimatedBridgePressure: number
}

export function buildGraphTimeSlices(snapshot: LabDatasetSnapshot): GraphTimeSlice[] {
  if (snapshot.yearly.length === 0) {
    return []
  }
  const maxPlays = Math.max(1, ...snapshot.yearly.map((bucket) => bucket.plays))
  const maxArtists = Math.max(1, ...snapshot.yearly.map((bucket) => bucket.uniqueArtists))
  const bridgeBase = snapshot.graphAnalytics.bridges.length / Math.max(1, snapshot.graphAnalytics.summary.nodeCount)

  return snapshot.yearly
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({
      year: bucket.key,
      plays: bucket.plays,
      totalMs: bucket.totalMs,
      uniqueArtists: bucket.uniqueArtists,
      normalizedIntensity: Math.min(1, bucket.plays / maxPlays),
      normalizedDiversity: Math.min(1, bucket.uniqueArtists / maxArtists),
      estimatedBridgePressure: Math.min(1, bridgeBase + (bucket.uniqueArtists / Math.max(1, bucket.plays)) * 0.6),
    }))
}

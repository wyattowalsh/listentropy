import type { LabDatasetSnapshot, NoveltyEconomicsPayload } from '@/lib/types'

import {
  clamp01,
  confidenceFromValue,
  getStartTime,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

export function runNoveltyEconomicsModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.monthly.length < 4) {
    return unsupportedResult<NoveltyEconomicsPayload>({
      moduleId: 'novelty-economics',
      startedAt,
      message: 'Need at least 4 monthly buckets for novelty cycle estimation.',
      sourceFields: ['monthly'],
      assumptions: ['Novelty cycles require multiple months of behavior.'],
    })
  }

  const maxUniqueArtists = Math.max(1, ...snapshot.monthly.map((bucket) => bucket.uniqueArtists))
  const monthlyNovelty: NoveltyEconomicsPayload['monthlyNovelty'] = snapshot.monthly
    .map((bucket) => {
      const repeatArtistShare = clamp01(1 - bucket.uniqueArtists / Math.max(1, bucket.plays))
      const noveltyScore = clamp01((bucket.uniqueArtists / maxUniqueArtists) * 0.7 + (1 - repeatArtistShare) * 0.3)
      const loyaltyReboundScore = clamp01(repeatArtistShare * 0.7 + (bucket.plays / Math.max(1, snapshot.summary.totalPlays)) * 2)
      return {
        month: bucket.key,
        uniqueArtists: bucket.uniqueArtists,
        repeatArtistShare: round(repeatArtistShare, 3),
        noveltyScore: round(noveltyScore, 3),
        loyaltyReboundScore: round(loyaltyReboundScore, 3),
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const cycles: NoveltyEconomicsPayload['cycles'] = []
  let current: NoveltyEconomicsPayload['cycles'][number] | null = null
  for (const row of monthlyNovelty) {
    const phase: NoveltyEconomicsPayload['cycles'][number]['phase'] =
      row.noveltyScore - row.loyaltyReboundScore > 0.12
        ? 'novelty'
        : row.loyaltyReboundScore - row.noveltyScore > 0.12
          ? 'loyalty'
          : 'mixed'
    const strength = round(Math.abs(row.noveltyScore - row.loyaltyReboundScore), 3)
    if (!current || current.phase !== phase) {
      if (current) {
        cycles.push(current)
      }
      current = { startMonth: row.month, endMonth: row.month, phase, strength }
      continue
    }
    current.endMonth = row.month
    current.strength = round((current.strength + strength) / 2, 3)
  }
  if (current) {
    cycles.push(current)
  }

  const noveltyDebtIndex = round(
    monthlyNovelty.reduce((sum, row) => sum + Math.max(0, row.noveltyScore - row.loyaltyReboundScore), 0) /
      Math.max(1, monthlyNovelty.length),
    3,
  )
  const recoveryIndex = round(
    monthlyNovelty.reduce((sum, row) => sum + Math.max(0, row.loyaltyReboundScore - row.noveltyScore), 0) /
      Math.max(1, monthlyNovelty.length),
    3,
  )

  let dominantMode: NoveltyEconomicsPayload['summary']['dominantMode'] = 'balanced'
  if (noveltyDebtIndex - recoveryIndex > 0.05) {
    dominantMode = 'novelty'
  } else if (recoveryIndex - noveltyDebtIndex > 0.05) {
    dominantMode = 'loyalty'
  }

  const payload: NoveltyEconomicsPayload = {
    monthlyNovelty,
    cycles,
    summary: {
      noveltyDebtIndex,
      recoveryIndex,
      dominantMode,
    },
  }

  const confidence = confidenceFromValue(
    Math.min(0.9, (monthlyNovelty.length / 24) * 0.7 + (cycles.length / 6) * 0.3),
    [
      `${monthlyNovelty.length} monthly buckets analyzed`,
      `${cycles.length} novelty/loyalty cycle segments identified`,
      'Descriptive heuristic over monthly unique-artist and concentration proxies.',
    ],
  )

  return readyResult({
    moduleId: 'novelty-economics',
    startedAt,
    payload,
    confidence,
    sourceFields: ['monthly', 'summary'],
    method: 'descriptive heuristic novelty-vs-loyalty scoring over monthly buckets',
    assumptions: [
      'Monthly unique artist count proxies novelty exposure in Train A.',
      'Repeat artist share is approximated from plays vs unique artists, not exact repeat sequence counts.',
    ],
    warnings: monthlyNovelty.length < 8 ? ['Short history reduces cycle segmentation confidence.'] : [],
    message: `Dominant mode appears ${dominantMode}.`,
  })
}

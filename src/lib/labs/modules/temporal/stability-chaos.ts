import type { LabDatasetSnapshot, StabilityChaosPayload } from '@/lib/types'

import {
  clamp01,
  confidenceFromValue,
  getStartTime,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

function distance(a: StabilityChaosPayload['monthlyState'][number], b: StabilityChaosPayload['monthlyState'][number]): number {
  return Math.sqrt(
    (a.intensity - b.intensity) ** 2 +
    (a.diversity - b.diversity) ** 2 +
    (a.skipRate - b.skipRate) ** 2,
  )
}

export function runStabilityChaosModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.monthlyBehavior.length < 4 || snapshot.monthly.length < 4) {
    return unsupportedResult<StabilityChaosPayload>({
      moduleId: 'stability-chaos',
      startedAt,
      message: 'Need at least 4 monthly points for stability/chaos analysis.',
      sourceFields: ['monthlyBehavior', 'monthly'],
      assumptions: ['Phase portrait requires multi-month trajectories.'],
    })
  }

  const monthlyBucketByKey = new Map(snapshot.monthly.map((bucket) => [bucket.key, bucket]))
  const maxPlays = Math.max(1, ...snapshot.monthlyBehavior.map((row) => row.plays))
  const maxArtists = Math.max(1, ...snapshot.monthly.map((row) => row.uniqueArtists))
  const baselineSkip = snapshot.summary.skipRate

  const monthlyState: StabilityChaosPayload['monthlyState'] = snapshot.monthlyBehavior
    .map((row) => {
      const bucket = monthlyBucketByKey.get(row.key)
      const intensity = clamp01(row.plays / maxPlays)
      const diversity = clamp01((bucket?.uniqueArtists ?? 0) / maxArtists)
      const skipVariance = Math.abs(row.skipRate - baselineSkip)
      const chaosScore = clamp01(skipVariance * 2.2 + (1 - diversity) * 0.25 + row.offlineRate * 0.35 + row.incognitoRate * 0.25)
      const stabilityScore = clamp01(1 - chaosScore * 0.8 - Math.abs(row.shuffleRate - snapshot.summary.shuffleRate) * 0.2)
      return {
        month: row.key,
        intensity: round(intensity, 3),
        diversity: round(diversity, 3),
        skipRate: round(row.skipRate, 3),
        chaosScore: round(chaosScore, 3),
        stabilityScore: round(stabilityScore, 3),
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const transitions: StabilityChaosPayload['transitions'] = []
  for (let index = 1; index < monthlyState.length; index += 1) {
    const prev = monthlyState[index - 1]
    const curr = monthlyState[index]
    const d = round(distance(prev, curr), 4)
    transitions.push({
      fromMonth: prev.month,
      toMonth: curr.month,
      distance: d,
      regimeChange: d >= 0.33,
    })
  }

  const volatileMonths = monthlyState.filter((row) => row.chaosScore >= 0.55).length
  const calmMonths = monthlyState.filter((row) => row.stabilityScore >= 0.65).length
  const maxChaosMonth = [...monthlyState].sort((a, b) => b.chaosScore - a.chaosScore)[0]?.month ?? null

  const payload: StabilityChaosPayload = {
    monthlyState,
    transitions,
    summary: {
      calmMonths,
      volatileMonths,
      maxChaosMonth,
    },
  }

  const confidence = confidenceFromValue(
    Math.min(0.9, (monthlyState.length / 18) * 0.6 + (snapshot.monthlyBehavior.length / 18) * 0.4),
    [
      `${monthlyState.length} monthly state points`,
      `${transitions.filter((item) => item.regimeChange).length} regime-change transitions flagged`,
      'Descriptive phase portrait heuristic using intensity/diversity/skip dimensions.',
    ],
  )

  return readyResult({
    moduleId: 'stability-chaos',
    startedAt,
    payload,
    confidence,
    sourceFields: ['summary', 'monthly', 'monthlyBehavior'],
    method: 'descriptive heuristic phase-space scoring over monthly behavior',
    assumptions: [
      'Chaos score combines skip variance, concentration, and context volatility proxies.',
      'Regime change threshold is tuned for visual interpretability in Train A.',
    ],
    warnings: monthlyState.length < 8 ? ['Short monthly history reduces regime stability confidence.'] : [],
    message: `Flagged ${volatileMonths} volatile month(s) and ${calmMonths} calm month(s).`,
  })
}

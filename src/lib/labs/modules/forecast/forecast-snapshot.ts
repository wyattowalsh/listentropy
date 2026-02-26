import type { ForecastSnapshotPayload, LabDatasetSnapshot } from '@/lib/types'

import { clamp01, confidenceFromValue, getStartTime, readyResult, round, unsupportedResult } from '@/lib/labs/modules/utils'

type MetricKey = keyof ForecastSnapshotPayload['bands']

interface ForecastSeriesPoint {
  key: string
  plays: number
  totalHours: number
  skipRate: number
  shuffleRate: number
}

function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) {
    return monthKey
  }
  const next = new Date(Date.UTC(year, month - 1 + 1, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

function average(values: number[]): number {
  if (!values.length) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdev(values: number[]): number {
  if (values.length < 2) {
    return 0
  }
  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function buildSeries(snapshot: LabDatasetSnapshot): ForecastSeriesPoint[] {
  const behaviorByMonth = new Map(snapshot.monthlyBehavior.map((point) => [point.key, point]))
  return snapshot.monthly
    .map((month) => ({
      key: month.key,
      plays: month.plays,
      totalHours: round(month.totalMs / 3_600_000, 3),
      skipRate: behaviorByMonth.get(month.key)?.skipRate ?? 0,
      shuffleRate: behaviorByMonth.get(month.key)?.shuffleRate ?? 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

function forecastBand(
  series: ForecastSeriesPoint[],
  metricKey: MetricKey,
  isRate: boolean,
): ForecastSnapshotPayload['bands'][MetricKey] {
  const values = series.map((point) => point[metricKey])
  const last = values.at(-1) ?? 0
  const diffs = values.slice(1).map((value, index) => value - values[index])
  const avgDiff = average(diffs)
  const volatility = Math.max(stdev(diffs), stdev(values) * 0.35, isRate ? 0.01 : 1)
  const midRaw = last + avgDiff * 0.75
  const lowRaw = midRaw - volatility
  const highRaw = midRaw + volatility

  if (isRate) {
    const low = round(clamp01(lowRaw), 4)
    const mid = round(clamp01(midRaw), 4)
    const high = round(clamp01(highRaw), 4)
    return { low: Math.min(low, mid), mid, high: Math.max(mid, high) }
  }

  const low = round(Math.max(0, lowRaw), 3)
  const mid = round(Math.max(0, midRaw), 3)
  const high = round(Math.max(0, highRaw), 3)
  return {
    low: Math.min(low, mid),
    mid,
    high: Math.max(mid, high),
  }
}

function buildTrendSignals(series: ForecastSeriesPoint[]): ForecastSnapshotPayload['trendSignals'] {
  const defs: Array<{ key: MetricKey; label: string; isRate: boolean }> = [
    { key: 'plays', label: 'Plays', isRate: false },
    { key: 'totalHours', label: 'Total Hours', isRate: false },
    { key: 'skipRate', label: 'Skip Rate', isRate: true },
    { key: 'shuffleRate', label: 'Shuffle Rate', isRate: true },
  ]

  return defs.map(({ key, label, isRate }) => {
    const values = series.map((point) => point[key])
    const diffs = values.slice(1).map((value, index) => value - values[index])
    const avgDiff = average(diffs)
    const baselineScale = isRate ? 0.08 : Math.max(1, average(values) * 0.18)
    const normalized = baselineScale > 0 ? Math.abs(avgDiff) / baselineScale : 0
    return {
      key,
      label,
      direction: avgDiff > 0.001 ? ('up' as const) : avgDiff < -0.001 ? ('down' as const) : ('flat' as const),
      strength: round(Math.min(1, normalized), 3),
      basisMonths: series.length,
    }
  })
}

function buildAnomalyRisk(series: ForecastSeriesPoint[]): ForecastSnapshotPayload['anomalyRisk'] {
  const metrics: MetricKey[] = ['plays', 'totalHours', 'skipRate', 'shuffleRate']
  const scores = metrics.map((metricKey) => {
    const values = series.map((point) => point[metricKey])
    if (values.length < 2) {
      return 0
    }
    const diffs = values.slice(1).map((value, index) => value - values[index])
    const diffVol = stdev(diffs)
    const valueScale = Math.max(0.0001, average(values))
    return Math.min(1, diffVol / (valueScale * (metricKey === 'plays' || metricKey === 'totalHours' ? 0.55 : 0.8)))
  })
  const score = round(clamp01(average(scores)), 3)
  const reasons: string[] = []
  if (score >= 0.66) {
    reasons.push('Recent month-to-month variability is elevated across tracked metrics.')
  } else if (score >= 0.38) {
    reasons.push('Recent variability is moderate; expect wider forecast bands.')
  } else {
    reasons.push('Recent trends are relatively stable for a lightweight heuristic forecast.')
  }
  return {
    level: score >= 0.66 ? 'high' : score >= 0.38 ? 'medium' : 'low',
    score,
    reasons,
  }
}

export function runForecastSnapshotModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  const series = buildSeries(snapshot)
  const usable = series.filter((point) => point.plays > 0)

  if (usable.length < 4) {
    return unsupportedResult<ForecastSnapshotPayload>({
      moduleId: 'forecast-snapshot',
      startedAt,
      message: 'Need at least 4 non-empty months to generate a forecast-snapshot heuristic.',
      sourceFields: ['monthly', 'monthlyBehavior', 'datasetIdentity'],
      assumptions: ['Forecast Snapshot uses recent month-level aggregates and behavior rates only.'],
    })
  }

  const recent = usable.slice(-6)
  const lastMonth = recent.at(-1)?.key ?? usable.at(-1)?.key ?? 'unknown'
  const nextMonth = nextMonthKey(lastMonth)

  const payload: ForecastSnapshotPayload = {
    nextMonth,
    horizonMonths: 1,
    bands: {
      plays: forecastBand(recent, 'plays', false),
      totalHours: forecastBand(recent, 'totalHours', false),
      skipRate: forecastBand(recent, 'skipRate', true),
      shuffleRate: forecastBand(recent, 'shuffleRate', true),
    },
    trendSignals: buildTrendSignals(recent),
    anomalyRisk: buildAnomalyRisk(recent),
    basisMonths: recent.map((point) => point.key),
  }

  const confidence = confidenceFromValue(
    Math.min(
      0.86,
      0.35 +
        Math.min(0.35, recent.length * 0.07) +
        (payload.anomalyRisk.level === 'low' ? 0.14 : payload.anomalyRisk.level === 'medium' ? 0.08 : 0.03),
    ),
    [
      `Forecast based on ${recent.length} recent months (${payload.basisMonths[0]} → ${payload.basisMonths.at(-1)})`,
      'Lightweight heuristic smoothing with trend + volatility bands (not causal, not predictive certainty).',
      `Anomaly risk ${payload.anomalyRisk.level} (${Math.round(payload.anomalyRisk.score * 100)} / 100).`,
    ],
  )

  return readyResult({
    moduleId: 'forecast-snapshot',
    startedAt,
    payload,
    confidence,
    sourceFields: ['monthly', 'monthlyBehavior', 'datasetIdentity'],
    method: 'heuristic one-step forecast from recent month aggregates with volatility bands',
    assumptions: [
      'Forecast Snapshot uses the last 4-6 non-empty months only and does not model seasonality.',
      'Bands reflect recent volatility and trend, not formal probabilistic intervals.',
    ],
    warnings: [
      ...(payload.anomalyRisk.level === 'high'
        ? ['High anomaly risk widens uncertainty; treat bands as exploratory guidance.']
        : []),
    ],
    message: `Forecast Snapshot projects ${payload.nextMonth} using ${recent.length} recent months (${payload.anomalyRisk.level} anomaly risk).`,
  })
}


import { getDaypartForHour } from '@/lib/timezone'
import type { ChronotypeDriftPayload, DaypartKey, LabDatasetSnapshot } from '@/lib/types'

import {
  clamp01,
  confidenceFromValue,
  getStartTime,
  monthKeyForTs,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

function createHourCounts(): number[] {
  return Array.from({ length: 24 }, () => 0)
}

function getHour(ts: string, timezoneMode: LabDatasetSnapshot['timezoneMode']): number {
  const date = new Date(ts)
  return timezoneMode === 'utc' ? date.getUTCHours() : date.getHours()
}

function variance(values: number[]): number {
  if (values.length <= 1) {
    return 0
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
}

export function runChronotypeDriftModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.records.length < 40 || snapshot.monthly.length < 4) {
    return unsupportedResult<ChronotypeDriftPayload>({
      moduleId: 'chronotype-drift',
      startedAt,
      message: 'Need at least 40 records across 4 months for chronotype drift analysis.',
      sourceFields: ['records', 'monthly', 'timezoneMode'],
      assumptions: ['Chronotype drift is month-level and needs multi-month history.'],
    })
  }

  const monthlyHourCounts = new Map<string, number[]>()
  for (const record of snapshot.records) {
    const month = monthKeyForTs(record.ts, snapshot.timezoneMode)
    const bucket = monthlyHourCounts.get(month) ?? createHourCounts()
    bucket[getHour(record.ts, snapshot.timezoneMode)] += 1
    monthlyHourCounts.set(month, bucket)
  }

  const monthlyPeaks: ChronotypeDriftPayload['monthlyPeaks'] = [...monthlyHourCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, counts]) => {
      const total = counts.reduce((sum, value) => sum + value, 0)
      const peakHour = counts.indexOf(Math.max(...counts))
      const nocturnal = counts.slice(22).reduce((a, b) => a + b, 0) + counts.slice(0, 6).reduce((a, b) => a + b, 0)
      const daypartCounts: Record<DaypartKey, number> = {
        'late-night': 0,
        morning: 0,
        afternoon: 0,
        evening: 0,
      }
      counts.forEach((count, hour) => {
        daypartCounts[getDaypartForHour(hour)] += count
      })
      return {
        month,
        peakHour,
        nocturnalShare: round(nocturnal / Math.max(1, total), 3),
        daypartShares: {
          'late-night': round(daypartCounts['late-night'] / Math.max(1, total), 3),
          morning: round(daypartCounts.morning / Math.max(1, total), 3),
          afternoon: round(daypartCounts.afternoon / Math.max(1, total), 3),
          evening: round(daypartCounts.evening / Math.max(1, total), 3),
        },
      }
    })

  const byYear = new Map<string, ChronotypeDriftPayload['monthlyPeaks']>()
  for (const row of monthlyPeaks) {
    const year = row.month.slice(0, 4)
    const list = byYear.get(year) ?? []
    list.push(row)
    byYear.set(year, list)
  }

  const yearlyDrift: ChronotypeDriftPayload['yearlyDrift'] = [...byYear.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, rows]) => {
      const avgPeakHour = rows.reduce((sum, row) => sum + row.peakHour, 0) / rows.length
      const nocturnalShare = rows.reduce((sum, row) => sum + row.nocturnalShare, 0) / rows.length
      const stabilityIndex = clamp01(1 - variance(rows.map((row) => row.peakHour)) / 30)
      return {
        year,
        avgPeakHour: round(avgPeakHour, 2),
        nocturnalShare: round(nocturnalShare, 3),
        stabilityIndex: round(stabilityIndex, 3),
      }
    })

  const peakHours = monthlyPeaks.map((row) => row.peakHour)
  const peakHourDriftHours = peakHours.length > 1 ? round(peakHours[peakHours.length - 1] - peakHours[0], 2) : 0
  const chronotypeDirection: ChronotypeDriftPayload['driftSummary']['chronotypeDirection'] =
    peakHourDriftHours > 0.75 ? 'later' : peakHourDriftHours < -0.75 ? 'earlier' : 'stable'

  const payload: ChronotypeDriftPayload = {
    monthlyPeaks,
    yearlyDrift,
    driftSummary: {
      peakHourDriftHours,
      chronotypeDirection,
      confidenceBasisMonths: monthlyPeaks.length,
    },
  }

  const confidence = confidenceFromValue(
    Math.min(0.95, (monthlyPeaks.length / 24) * 0.7 + (snapshot.records.length / 5000) * 0.3),
    [
      `${monthlyPeaks.length} monthly peak profiles`,
      `${snapshot.records.length} records included`,
      'Descriptive chronotype drift estimated from month-level peak hour changes.',
    ],
  )

  return readyResult({
    moduleId: 'chronotype-drift',
    startedAt,
    payload,
    confidence,
    sourceFields: ['records', 'monthly', 'timezoneMode'],
    method: 'descriptive heuristic using monthly hour distributions and peak-hour drift',
    assumptions: [
      'Month-level peak hour is an acceptable chronotype proxy for Train A.',
      'Drift direction threshold is intentionally conservative (+/- 0.75h).',
    ],
    warnings: monthlyPeaks.length < 8 ? ['Low month count reduces drift confidence.'] : [],
    message: `Chronotype drift looks ${chronotypeDirection} over ${monthlyPeaks.length} months.`,
  })
}

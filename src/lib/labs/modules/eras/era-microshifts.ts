import type { EraMicroshiftsPayload, LabDatasetSnapshot } from '@/lib/types'

import {
  clamp01,
  confidenceFromValue,
  daypartForTs,
  getStartTime,
  monthKeyForTs,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

function monthIndex(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return year * 12 + (month - 1)
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  const start = monthIndex(startMonth)
  const end = monthIndex(endMonth)
  const keys: string[] = []
  for (let index = start; index <= end; index += 1) {
    const year = Math.floor(index / 12)
    const month = (index % 12) + 1
    keys.push(`${year}-${String(month).padStart(2, '0')}`)
  }
  return keys
}

export function runEraMicroshiftsModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.eras.length === 0 || snapshot.monthlyBehavior.length < 3) {
    return unsupportedResult<EraMicroshiftsPayload>({
      moduleId: 'era-microshifts',
      startedAt,
      message: 'Need detected eras and at least 3 monthly behavior points for microshift analysis.',
      sourceFields: ['eras', 'monthlyBehavior', 'records'],
      assumptions: ['Microshifts are nested inside detected core eras.'],
    })
  }

  const eraByMonth = new Map<string, { eraId: string; eraLabel: string }>()
  for (const era of snapshot.eras) {
    for (const key of monthsBetween(era.startMonth, era.endMonth)) {
      eraByMonth.set(key, { eraId: era.id, eraLabel: era.label })
    }
  }

  const monthTopArtistCounts = new Map<string, Map<string, number>>()
  const monthDaypartMix = new Map<string, Map<string, number>>()
  for (const record of snapshot.records) {
    const month = monthKeyForTs(record.ts, snapshot.timezoneMode)
    const artist = record.master_metadata_album_artist_name || 'Unknown Artist'
    const artistMap = monthTopArtistCounts.get(month) ?? new Map<string, number>()
    artistMap.set(artist, (artistMap.get(artist) ?? 0) + 1)
    monthTopArtistCounts.set(month, artistMap)

    const dp = daypartForTs(record.ts, snapshot.timezoneMode)
    const dpMap = monthDaypartMix.get(month) ?? new Map<string, number>()
    dpMap.set(dp, (dpMap.get(dp) ?? 0) + 1)
    monthDaypartMix.set(month, dpMap)
  }

  const monthlyBehaviorByKey = new Map(snapshot.monthlyBehavior.map((row) => [row.key, row]))
  const countryTimelineByMonth = new Map(snapshot.contextAnalytics.country.timeline.map((row) => [row.key, row]))

  const eraVolatilityMap = new Map<string, { eraId: string; eraLabel: string; total: number; count: number; microshiftCount: number }>()
  const microshifts: EraMicroshiftsPayload['microshifts'] = []

  const months = [...monthlyBehaviorByKey.keys()].sort((a, b) => a.localeCompare(b))
  for (let index = 1; index < months.length; index += 1) {
    const prevMonth = months[index - 1]
    const month = months[index]
    const era = eraByMonth.get(month)
    if (!era) {
      continue
    }
    const prev = monthlyBehaviorByKey.get(prevMonth)
    const curr = monthlyBehaviorByKey.get(month)
    if (!prev || !curr) {
      continue
    }

    const prevTopArtist = [...(monthTopArtistCounts.get(prevMonth) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const currTopArtist = [...(monthTopArtistCounts.get(month) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const artistTurnover = prevTopArtist && currTopArtist && prevTopArtist !== currTopArtist ? 1 : 0

    const skipDelta = Math.abs(curr.skipRate - prev.skipRate)
    const shuffleDelta = Math.abs(curr.shuffleRate - prev.shuffleRate)
    const prevCountries = countryTimelineByMonth.get(prevMonth)?.countryCount ?? 0
    const currCountries = countryTimelineByMonth.get(month)?.countryCount ?? 0
    const contextDelta = Math.abs(currCountries - prevCountries) / Math.max(1, Math.max(prevCountries, currCountries, 1))

    const score = clamp01(artistTurnover * 0.35 + skipDelta * 1.8 + shuffleDelta * 1.5 + contextDelta * 0.7)
    const drivers: EraMicroshiftsPayload['microshifts'][number]['drivers'] = []
    if (artistTurnover) drivers.push('artist-turnover')
    if (skipDelta >= 0.08) drivers.push('skip-change')
    if (shuffleDelta >= 0.1) drivers.push('shuffle-change')
    if (contextDelta >= 0.25) drivers.push('context-change')
    if (drivers.length === 0 && score >= 0.2) {
      drivers.push('context-change')
    }

    const noteParts = []
    if (artistTurnover) noteParts.push(`Top artist shifted ${prevTopArtist ?? 'N/A'} → ${currTopArtist ?? 'N/A'}`)
    if (skipDelta >= 0.04) noteParts.push(`skip Δ ${Math.round(skipDelta * 100)}pp`)
    if (shuffleDelta >= 0.05) noteParts.push(`shuffle Δ ${Math.round(shuffleDelta * 100)}pp`)
    if (contextDelta >= 0.15) noteParts.push(`country footprint volatility ${round(contextDelta, 2)}`)

    if (score >= 0.2) {
      microshifts.push({
        eraId: era.eraId,
        eraLabel: era.eraLabel,
        month,
        shiftScore: round(score, 3),
        drivers,
        note: noteParts.join(' · ') || 'Composite behavioral/context shift',
      })
    }

    const eraVol = eraVolatilityMap.get(era.eraId) ?? {
      eraId: era.eraId,
      eraLabel: era.eraLabel,
      total: 0,
      count: 0,
      microshiftCount: 0,
    }
    eraVol.total += score
    eraVol.count += 1
    if (score >= 0.2) {
      eraVol.microshiftCount += 1
    }
    eraVolatilityMap.set(era.eraId, eraVol)
  }

  microshifts.sort((a, b) => b.shiftScore - a.shiftScore || a.month.localeCompare(b.month))

  const eraVolatility: EraMicroshiftsPayload['eraVolatility'] = [...eraVolatilityMap.values()]
    .map((row) => ({
      eraId: row.eraId,
      eraLabel: row.eraLabel,
      volatilityScore: round(row.total / Math.max(1, row.count), 3),
      microshiftCount: row.microshiftCount,
    }))
    .sort((a, b) => b.volatilityScore - a.volatilityScore || b.microshiftCount - a.microshiftCount)

  const payload: EraMicroshiftsPayload = { microshifts: microshifts.slice(0, 24), eraVolatility }
  const confidence = confidenceFromValue(
    Math.min(0.88, (snapshot.eras.length / 6) * 0.3 + (snapshot.monthlyBehavior.length / 24) * 0.7),
    [
      `${snapshot.eras.length} eras evaluated`,
      `${snapshot.monthlyBehavior.length} monthly behavior points analyzed`,
      'Descriptive heuristic over intra-era month-to-month shifts.',
    ],
  )

  return readyResult({
    moduleId: 'era-microshifts',
    startedAt,
    payload,
    confidence,
    sourceFields: ['eras', 'monthlyBehavior', 'records', 'contextAnalytics.country.timeline'],
    method: 'descriptive heuristic month-over-month change scoring nested within detected eras',
    assumptions: [
      'Core era segmentation is accepted as the outer boundary for Train A microshifts.',
      'Top-artist turnover is used as a coarse artist-transition signal.',
    ],
    warnings: snapshot.eras.some((era) => era.confidence < 0.45) ? ['One or more source eras have low confidence.'] : [],
    message: `Detected ${payload.microshifts.length} microshift(s) across ${eraVolatility.length} era(s).`,
  })
}

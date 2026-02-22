import type { EraData, StreamRecord } from './types'
import { toMonthKey } from './utils'

interface MonthlyArtistBucket {
  month: string
  artists: Map<string, number>
  totalMs: number
  plays: number
  skipped: number
  shuffled: number
  platforms: Map<string, number>
  countries: Map<string, number>
}

interface MonthSummary {
  month: string
  topArtist: string
  topShare: number
  dominantArtists: string[]
  totalMs: number
  plays: number
  skipRate: number
  shuffleRate: number
  topArtistShares: Map<string, number>
  topCountryShare: number
  topPlatformShare: number
  sparse: boolean
}

interface EraCandidate {
  summaries: MonthSummary[]
  leadArtist: string
}

const DOMINANCE_THRESHOLD = 0.36
const SPLIT_ENTER_THRESHOLD = 0.34
const SPLIT_FORCE_THRESHOLD = 0.56
const MIN_ERA_MONTHS = 2
const REBOUND_BLIP_MAX_SHARE = 0.58
const GAP_CONFIDENCE_PENALTY_PER_MONTH = 0.04
const GAP_CONFIDENCE_PENALTY_CAP = 0.32

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function monthIndex(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return year * 12 + (month - 1)
}

function monthSpanInclusive(startMonth: string, endMonth: string): number {
  return Math.max(1, monthIndex(endMonth) - monthIndex(startMonth) + 1)
}

function topShare(map: Map<string, number>, total: number): number {
  let best = 0
  for (const value of map.values()) {
    if (value > best) {
      best = value
    }
  }
  return best / Math.max(1, total)
}

function normalizeShares(entries: Array<[string, number]>, total: number, topK = 10): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, topK)
  const result = new Map<string, number>()
  let covered = 0
  for (const [artist, ms] of top) {
    const share = ms / Math.max(1, total)
    covered += share
    result.set(artist, share)
  }
  const other = Math.max(0, 1 - covered)
  if (other > 0.0001) {
    result.set('__other__', other)
  }
  return result
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((value) => setB.has(value)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 1 : intersection / union
}

function vectorDistance(a: Map<string, number>, b: Map<string, number>): number {
  const keys = new Set([...a.keys(), ...b.keys()])
  let sum = 0
  for (const key of keys) {
    const diff = (a.get(key) ?? 0) - (b.get(key) ?? 0)
    sum += diff * diff
  }
  return clamp(Math.sqrt(sum / Math.max(1, keys.size)) * 2)
}

function dominantArtistShare(summaries: MonthSummary[]): number {
  if (summaries.length === 0) {
    return 0
  }
  return summaries.reduce((sum, summary) => sum + summary.topShare, 0) / summaries.length
}

function diversityScore(summaries: MonthSummary[]): number {
  const dominance = dominantArtistShare(summaries)
  const unique = new Set(summaries.flatMap((summary) => summary.dominantArtists)).size
  const breadth = clamp(unique / Math.max(3, summaries.length * 2))
  return round(clamp((1 - dominance) * 0.7 + breadth * 0.3))
}

function buildMonthlyBuckets(records: StreamRecord[]): MonthlyArtistBucket[] {
  const monthly = new Map<string, MonthlyArtistBucket>()
  for (const record of records) {
    const artist = record.master_metadata_album_artist_name
    if (!artist) {
      continue
    }
    const month = toMonthKey(new Date(record.ts))
    if (!monthly.has(month)) {
      monthly.set(month, {
        month,
        artists: new Map(),
        totalMs: 0,
        plays: 0,
        skipped: 0,
        shuffled: 0,
        platforms: new Map(),
        countries: new Map(),
      })
    }
    const bucket = monthly.get(month)!
    bucket.totalMs += record.ms_played
    bucket.plays += 1
    bucket.skipped += record.skipped ? 1 : 0
    bucket.shuffled += record.shuffle ? 1 : 0
    bucket.artists.set(artist, (bucket.artists.get(artist) ?? 0) + record.ms_played)
    bucket.platforms.set(record.platform, (bucket.platforms.get(record.platform) ?? 0) + 1)
    const country = record.conn_country || 'ZZ'
    bucket.countries.set(country, (bucket.countries.get(country) ?? 0) + 1)
  }
  return [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function summarizeMonth(bucket: MonthlyArtistBucket, medianMs: number): MonthSummary {
  const sortedArtists = [...bucket.artists.entries()].sort((a, b) => b[1] - a[1])
  const [topArtist, topMs] = sortedArtists[0] ?? ['Unknown', 0]
  const dominantArtists = sortedArtists.slice(0, 5).map(([artist]) => artist)
  const totalPlays = Math.max(1, bucket.plays)

  return {
    month: bucket.month,
    topArtist,
    topShare: topMs / Math.max(1, bucket.totalMs),
    dominantArtists: dominantArtists.slice(0, 3),
    totalMs: bucket.totalMs,
    plays: bucket.plays,
    skipRate: bucket.skipped / totalPlays,
    shuffleRate: bucket.shuffled / totalPlays,
    topArtistShares: normalizeShares(sortedArtists, bucket.totalMs, 10),
    topCountryShare: topShare(bucket.countries, bucket.plays),
    topPlatformShare: topShare(bucket.platforms, bucket.plays),
    sparse: bucket.plays < 1 || bucket.totalMs < medianMs * 0.12,
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function smoothedMonth(summaries: MonthSummary[], index: number): MonthSummary {
  const prev = summaries[index - 1]
  const current = summaries[index]
  if (!prev) {
    return current
  }
  return {
    ...current,
    topShare: (prev.topShare + current.topShare) / 2,
    skipRate: (prev.skipRate + current.skipRate) / 2,
    shuffleRate: (prev.shuffleRate + current.shuffleRate) / 2,
    topCountryShare: (prev.topCountryShare + current.topCountryShare) / 2,
    topPlatformShare: (prev.topPlatformShare + current.topPlatformShare) / 2,
  }
}

interface ChangeScoreDetails {
  total: number
  artistTurnover: number
  dominanceShift: number
  behaviorShift: number
  contextShift: number
  distributionShift: number
  sparsePenalty: number
}

function computeChangeScore(previous: MonthSummary, current: MonthSummary): ChangeScoreDetails {
  const artistTurnover = 1 - jaccard(previous.dominantArtists, current.dominantArtists)
  const dominanceShift = Math.abs(previous.topShare - current.topShare)
  const behaviorShift =
    (Math.abs(previous.skipRate - current.skipRate) + Math.abs(previous.shuffleRate - current.shuffleRate)) / 2
  const contextShift =
    (Math.abs(previous.topCountryShare - current.topCountryShare) + Math.abs(previous.topPlatformShare - current.topPlatformShare)) / 2
  const distributionShift = vectorDistance(previous.topArtistShares, current.topArtistShares)
  const sparsePenalty = previous.sparse || current.sparse ? 0.18 : 0

  const weighted =
    artistTurnover * 0.28 +
    distributionShift * 0.26 +
    dominanceShift * 0.18 +
    behaviorShift * 0.14 +
    contextShift * 0.14 -
    sparsePenalty

  return {
    total: clamp(weighted),
    artistTurnover: clamp(artistTurnover),
    dominanceShift: clamp(dominanceShift),
    behaviorShift: clamp(behaviorShift),
    contextShift: clamp(contextShift),
    distributionShift: clamp(distributionShift),
    sparsePenalty,
  }
}

function buildEraLabel(leadArtist: string, confidence: number, diversity: number): string {
  if (confidence < 0.35) {
    return `Transitioning ${leadArtist} Era`
  }
  if (diversity > 0.62) {
    return `${leadArtist} & Co. Era`
  }
  return `The ${leadArtist} Era`
}

function summarizeChangeDrivers(details: ChangeScoreDetails, sparse: boolean): EraData['changeDrivers'] {
  const drivers: EraData['changeDrivers'] = []
  const candidates: EraData['changeDrivers'] = [
    {
      key: 'artist-turnover',
      weight: round(details.artistTurnover),
      description: 'Top artist rotation changed meaningfully between adjacent months.',
    },
    {
      key: 'dominance-shift',
      weight: round(details.dominanceShift),
      description: 'Dominance concentration shifted (one artist took more or less of the month).',
    },
    {
      key: 'behavior-shift',
      weight: round(details.behaviorShift),
      description: 'Skip/shuffle behavior changed enough to alter listening mode.',
    },
    {
      key: 'context-shift',
      weight: round(details.contextShift),
      description: 'Country/platform concentration changed, suggesting a context shift.',
    },
  ]
  for (const driver of candidates.sort((a, b) => b.weight - a.weight)) {
    if (driver.weight >= 0.08) {
      drivers.push(driver)
    }
  }
  if (sparse) {
    drivers.push({
      key: 'sparse-data',
      weight: 0.15,
      description: 'Sparse months reduced split confidence and encouraged smoothing.',
    })
  }
  return drivers.slice(0, 4)
}

function aggregateEra(base: EraCandidate, previousEra?: EraData, previousMonth?: MonthSummary): EraData {
  const summaries = base.summaries
  const startMonth = summaries[0]?.month ?? 'unknown'
  const endMonth = summaries[summaries.length - 1]?.month ?? startMonth
  const spanMonths = monthSpanInclusive(startMonth, endMonth)
  const totalMs = summaries.reduce((sum, summary) => sum + summary.totalMs, 0)
  const sparseCount = summaries.filter((summary) => summary.sparse).length
  const missingMonthCount = Math.max(0, spanMonths - summaries.length)
  const sparseSignalCount = sparseCount + missingMonthCount
  const hasSparseSignals = sparseSignalCount > 0
  const dominantArtists = Array.from(new Set(summaries.flatMap((summary) => summary.dominantArtists))).slice(0, 5)

  const avgDominance = dominantArtistShare(summaries)
  const diversity = diversityScore(summaries)

  let changeDrivers: EraData['changeDrivers'] = [
    {
      key: hasSparseSignals ? 'sparse-data' : 'dominance-shift',
      weight: hasSparseSignals ? 0.12 : round(avgDominance),
      description:
        hasSparseSignals
          ? 'This era includes lower-density or missing months, so boundaries were smoothed conservatively.'
          : 'This era is characterized by a stable concentration around a recurring artist core.',
    },
  ]

  let topArrivals: string[] | undefined
  let topDepartures: string[] | undefined
  let transitionFromPrevious: EraData['transitionFromPrevious'] | undefined
  const gapPenalty = Math.min(GAP_CONFIDENCE_PENALTY_CAP, missingMonthCount * GAP_CONFIDENCE_PENALTY_PER_MONTH)
  let confidence = clamp(
    0.35 + avgDominance * 0.35 + (1 - diversity) * 0.15 + Math.min(0.15, summaries.length * 0.03) - gapPenalty,
  )

  if (previousEra && previousMonth && summaries[0]) {
    const details = computeChangeScore(previousMonth, summaries[0])
    confidence = clamp(confidence + details.total * 0.2 - (hasSparseSignals ? 0.08 : 0))
    changeDrivers = summarizeChangeDrivers(details, hasSparseSignals)

    const arrivalSet = new Set(dominantArtists)
    const departureSet = new Set(previousEra.dominantArtists)
    topArrivals = dominantArtists.filter((artist) => !departureSet.has(artist)).slice(0, 3)
    topDepartures = previousEra.dominantArtists.filter((artist) => !arrivalSet.has(artist)).slice(0, 3)

    const leadChanged = previousEra.dominantArtists[0] !== dominantArtists[0]
    const transitionSummary = leadChanged
      ? `Shift from ${previousEra.dominantArtists[0] ?? 'previous core'} toward ${dominantArtists[0] ?? 'new core'} with ${Math.round(details.total * 100)}% change intensity.`
      : `Same lead artist, but rotation and behavior/context shifted with ${Math.round(details.total * 100)}% change intensity.`

    transitionFromPrevious = {
      confidence: round(clamp(0.35 + details.total * 0.55 - (hasSparseSignals ? 0.12 : 0))),
      summary: transitionSummary,
    }
  }

  return {
    id: `${startMonth}-${endMonth}`,
    label: buildEraLabel(base.leadArtist, confidence, diversity),
    startMonth,
    endMonth,
    dominantArtists,
    totalMs,
    confidence: round(confidence),
    durationMonths: spanMonths,
    dominanceScore: round(avgDominance),
    diversityScore: round(diversity),
    changeDrivers,
    topArrivals,
    topDepartures,
    transitionFromPrevious,
  }
}

function shouldSplit(
  currentEraMonths: MonthSummary[],
  previous: MonthSummary,
  current: MonthSummary,
  next: MonthSummary | undefined,
): boolean {
  if (currentEraMonths.length < MIN_ERA_MONTHS) {
    return false
  }

  const previousWindow = currentEraMonths.slice(-2)
  const previousSmoothed = previousWindow.length >= 2 ? smoothedMonth(previousWindow, 1) : previous
  const currentSmoothed = smoothedMonth([previous, current], 1)
  const details = computeChangeScore(previousSmoothed, currentSmoothed)

  const leadChanged = current.topArtist !== previous.topArtist
  const strongDominance = current.topShare >= DOMINANCE_THRESHOLD
  const newLeadPersists = Boolean(next && next.topArtist === current.topArtist)
  const prior = currentEraMonths[currentEraMonths.length - 2]
  const nextDetails = next ? computeChangeScore(current, next) : null
  const nextSupportsSplit = Boolean(nextDetails && nextDetails.total >= SPLIT_ENTER_THRESHOLD * 0.7)

  const isSingleMonthLeadBlip =
    leadChanged &&
    Boolean(next && next.topArtist === previous.topArtist) &&
    current.topShare <= REBOUND_BLIP_MAX_SHARE &&
    !current.sparse &&
    (!prior || prior.topArtist === previous.topArtist)

  if (isSingleMonthLeadBlip) {
    return false
  }

  const isSingleMonthReboundBlip =
    Boolean(prior) &&
    prior!.topArtist === current.topArtist &&
    previous.topArtist !== current.topArtist &&
    Boolean(next && next.topArtist === current.topArtist) &&
    previous.topShare <= REBOUND_BLIP_MAX_SHARE &&
    !previous.sparse

  if (isSingleMonthReboundBlip) {
    return false
  }

  if (leadChanged && strongDominance && (newLeadPersists || current.topShare >= 0.62) && !current.sparse) {
    return true
  }

  if (details.total >= SPLIT_FORCE_THRESHOLD && leadChanged && strongDominance) {
    return true
  }

  if (details.total < SPLIT_ENTER_THRESHOLD) {
    return false
  }

  if (!leadChanged && details.behaviorShift < 0.25 && details.contextShift < 0.25) {
    return false
  }

  if (current.sparse) {
    return false
  }

  return strongDominance && (newLeadPersists || nextSupportsSplit)
}

export function computeEras(records: StreamRecord[]): EraData[] {
  if (records.length === 0) {
    return []
  }

  const monthlyBuckets = buildMonthlyBuckets(records)
  if (monthlyBuckets.length === 0) {
    return []
  }

  const medianMs = median(monthlyBuckets.map((bucket) => bucket.totalMs))
  const summaries = monthlyBuckets.map((bucket) => summarizeMonth(bucket, medianMs))
  if (summaries.length === 0) {
    return []
  }

  const eras: EraData[] = []
  let currentCandidate: EraCandidate = {
    summaries: [summaries[0]],
    leadArtist: summaries[0].topArtist,
  }

  for (let index = 1; index < summaries.length; index += 1) {
    const previous = summaries[index - 1]
    const current = summaries[index]
    const next = summaries[index + 1]

    if (shouldSplit(currentCandidate.summaries, previous, current, next)) {
      const aggregated = aggregateEra(currentCandidate, eras[eras.length - 1], previous)
      eras.push(aggregated)
      currentCandidate = {
        summaries: [current],
        leadArtist: current.topArtist,
      }
      continue
    }

    currentCandidate.summaries.push(current)

    const leadCounts = new Map<string, number>()
    for (const month of currentCandidate.summaries) {
      leadCounts.set(month.topArtist, (leadCounts.get(month.topArtist) ?? 0) + 1)
    }
    currentCandidate.leadArtist = [...leadCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? currentCandidate.leadArtist
  }

  eras.push(aggregateEra(currentCandidate, eras[eras.length - 1], summaries[summaries.length - currentCandidate.summaries.length - 1]))

  if (eras.length > 2) {
    const merged: EraData[] = []
    for (const era of eras) {
      const previous = merged[merged.length - 1]
      if (!previous) {
        merged.push(era)
        continue
      }
      const shouldMergeTiny =
        era.durationMonths === 1 &&
        (era.transitionFromPrevious?.confidence ?? 0) < 0.7 &&
        era.confidence < 0.65

      if (!shouldMergeTiny) {
        merged.push(era)
        continue
      }

      const combinedDominant = Array.from(new Set([...previous.dominantArtists, ...era.dominantArtists])).slice(0, 5)
      merged[merged.length - 1] = {
        ...previous,
        id: `${previous.startMonth}-${era.endMonth}`,
        endMonth: era.endMonth,
        dominantArtists: combinedDominant,
        totalMs: previous.totalMs + era.totalMs,
        durationMonths: monthSpanInclusive(previous.startMonth, era.endMonth),
        confidence: round(clamp((previous.confidence + era.confidence) / 2 - 0.05)),
        changeDrivers: Array.from(new Map([...previous.changeDrivers, ...era.changeDrivers].map((driver) => [driver.key, driver])).values()).slice(0, 4),
      }
    }
    return merged
  }

  return eras
}

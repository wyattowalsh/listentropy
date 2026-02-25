import { computeArchetypes } from './archetypes'
import { computeEras } from './eras'
import { computeForgottenGems } from './gems'
import { computeGraphAnalytics } from './graph-analytics'
import { buildGraphData } from './graph'
import { buildDatasetIdentity } from './labs/dataset-identity'
import { normalizePlatform } from './platform'
import { buildAlbumStats, buildArtistStats, buildTrackStats } from './processor/stages/aggregates'
import { computeSummary } from './processor/stages/summary'
import {
  buildHourDistributionByTimezone,
  buildTimeBuckets,
  buildWeekdayDistribution,
} from './processor/stages/time-series'
import { reconstructSessions } from './sessions'
import { buildTasteProfile } from './taste'
import { getDaypartForHour, getModeHour, toModeMonthKey } from './timezone'
import type {
  ArtistMonthlyTrends,
  ContextAnalytics,
  DataQualitySummary,
  DaypartKey,
  MonthlyBehaviorPoint,
  NarrativeInsight,
  ParseProgress,
  PlatformCategory,
  ProcessedDataModel,
  SessionMetrics,
  StageProvenance,
  StreamRecord,
  TimezoneMode,
} from './types'

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function toMonthKey(value: string, timezoneMode: TimezoneMode): string {
  return toModeMonthKey(new Date(value), timezoneMode)
}

function buildPlatformStats(records: StreamRecord[]): Array<{ platform: PlatformCategory; plays: number; totalMs: number }> {
  const map = new Map<PlatformCategory, { plays: number; totalMs: number }>()
  for (const record of records) {
    const platform = normalizePlatform(record.platform)
    if (!map.has(platform)) {
      map.set(platform, { plays: 0, totalMs: 0 })
    }
    const value = map.get(platform)!
    value.plays += 1
    value.totalMs += record.ms_played
  }
  return [...map.entries()]
    .map(([platform, value]) => ({ platform, plays: value.plays, totalMs: value.totalMs }))
    .sort((a, b) => b.totalMs - a.totalMs)
}

function buildSkipStats(
  records: StreamRecord[],
  timezoneMode: TimezoneMode,
): ProcessedDataModel['skipStats'] {
  const byHour = Array.from({ length: 24 }, () => ({ skipped: 0, total: 0 }))
  const byArtistMap = new Map<string, { skipped: number; plays: number }>()
  let skippedCount = 0

  for (const record of records) {
    const hour = getModeHour(new Date(record.ts), timezoneMode)
    byHour[hour].total += 1
    if (record.skipped) {
      byHour[hour].skipped += 1
      skippedCount += 1
    }
    const artist = record.master_metadata_album_artist_name
    if (!artist) {
      continue
    }
    if (!byArtistMap.has(artist)) {
      byArtistMap.set(artist, { skipped: 0, plays: 0 })
    }
    const value = byArtistMap.get(artist)!
    value.plays += 1
    if (record.skipped) {
      value.skipped += 1
    }
  }

  return {
    overall: skippedCount / Math.max(1, records.length),
    byHour: byHour.map((item) => item.skipped / Math.max(1, item.total)),
    byArtist: [...byArtistMap.entries()]
      .map(([name, value]) => ({
        name,
        skipRate: value.skipped / Math.max(1, value.plays),
        plays: value.plays,
      }))
      .sort((a, b) => b.skipRate - a.skipRate)
      .slice(0, 25),
  }
}

function buildMonthlyBehavior(
  records: StreamRecord[],
  monthKeys: string[],
  timezoneMode: TimezoneMode,
): MonthlyBehaviorPoint[] {
  const map = new Map<string, { plays: number; skipped: number; shuffle: number; offline: number; incognito: number }>()
  for (const key of monthKeys) {
    map.set(key, { plays: 0, skipped: 0, shuffle: 0, offline: 0, incognito: 0 })
  }

  for (const record of records) {
    const monthKey = toMonthKey(record.ts, timezoneMode)
    if (!map.has(monthKey)) {
      map.set(monthKey, { plays: 0, skipped: 0, shuffle: 0, offline: 0, incognito: 0 })
    }
    const entry = map.get(monthKey)!
    entry.plays += 1
    if (record.skipped) {
      entry.skipped += 1
    }
    if (record.shuffle) {
      entry.shuffle += 1
    }
    if (record.offline) {
      entry.offline += 1
    }
    if (record.incognito_mode) {
      entry.incognito += 1
    }
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      key,
      plays: value.plays,
      skipRate: value.skipped / Math.max(1, value.plays),
      shuffleRate: value.shuffle / Math.max(1, value.plays),
      offlineRate: value.offline / Math.max(1, value.plays),
      incognitoRate: value.incognito / Math.max(1, value.plays),
    }))
}

function buildArtistMonthlyTrends(
  records: StreamRecord[],
  timezoneMode: TimezoneMode,
): ArtistMonthlyTrends {
  const trends: ArtistMonthlyTrends = {}
  for (const record of records) {
    const artist = record.master_metadata_album_artist_name
    if (!artist) {
      continue
    }
    const monthKey = toMonthKey(record.ts, timezoneMode)
    if (!trends[artist]) {
      trends[artist] = {}
    }
    trends[artist][monthKey] = (trends[artist][monthKey] ?? 0) + 1
  }
  return trends
}

function asReason(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return 'unknown'
  }
  return normalized
}

function buildContextAnalytics(
  records: StreamRecord[],
  sessions: ProcessedDataModel['sessions'],
  monthKeys: string[],
  timezoneMode: TimezoneMode,
): ContextAnalytics {
  const countryMap = new Map<string, { plays: number; totalMs: number }>()
  const monthlyCountryMap = new Map<string, Map<string, number>>()
  const reasonStartMap = new Map<string, number>()
  const reasonEndMap = new Map<string, number>()
  const transitionMap = new Map<string, number>()
  let offlineCount = 0
  let incognitoCount = 0
  let offlineWithTimestamp = 0
  let inconsistentOfflineTimestampCount = 0

  for (const key of monthKeys) {
    monthlyCountryMap.set(key, new Map())
  }

  for (const record of records) {
    const country = record.conn_country || 'ZZ'
    if (!countryMap.has(country)) {
      countryMap.set(country, { plays: 0, totalMs: 0 })
    }
    const countryValue = countryMap.get(country)!
    countryValue.plays += 1
    countryValue.totalMs += record.ms_played

    const monthKey = toMonthKey(record.ts, timezoneMode)
    if (!monthlyCountryMap.has(monthKey)) {
      monthlyCountryMap.set(monthKey, new Map())
    }
    const monthly = monthlyCountryMap.get(monthKey)!
    monthly.set(country, (monthly.get(country) ?? 0) + 1)

    const reasonStart = asReason(record.reason_start)
    const reasonEnd = asReason(record.reason_end)
    reasonStartMap.set(reasonStart, (reasonStartMap.get(reasonStart) ?? 0) + 1)
    reasonEndMap.set(reasonEnd, (reasonEndMap.get(reasonEnd) ?? 0) + 1)
    transitionMap.set(`${reasonStart}::${reasonEnd}`, (transitionMap.get(`${reasonStart}::${reasonEnd}`) ?? 0) + 1)

    if (record.offline) {
      offlineCount += 1
      if (record.offline_timestamp !== null) {
        offlineWithTimestamp += 1
      }
      if (record.offline_timestamp === null) {
        inconsistentOfflineTimestampCount += 1
      }
    } else if (record.offline_timestamp !== null) {
      inconsistentOfflineTimestampCount += 1
    }

    if (record.incognito_mode) {
      incognitoCount += 1
    }
  }

  const topCountries = [...countryMap.entries()]
    .map(([country, value]) => ({
      country,
      plays: value.plays,
      totalMs: value.totalMs,
      share: value.plays / Math.max(1, records.length),
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10)

  const homeCountry = topCountries[0]?.country ?? null
  const domesticShare =
    homeCountry === null
      ? 0
      : records.filter((record) => (record.conn_country || 'ZZ') === homeCountry).length / Math.max(1, records.length)
  const travelShare = 1 - domesticShare

  const reasonStart = [...reasonStartMap.entries()]
    .map(([reason, count]) => ({ reason, count, share: count / Math.max(1, records.length) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
  const reasonEnd = [...reasonEndMap.entries()]
    .map(([reason, count]) => ({ reason, count, share: count / Math.max(1, records.length) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
  const transitions = [...transitionMap.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split('::')
      return {
        from: from || 'unknown',
        to: to || 'unknown',
        count,
        share: count / Math.max(1, records.length),
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const orderedMonthKeys = [...monthlyCountryMap.keys()].sort((a, b) => a.localeCompare(b))
  const timeline = orderedMonthKeys.map((key) => {
    const countries = monthlyCountryMap.get(key) ?? new Map<string, number>()
    const ranked = [...countries.entries()].sort((a, b) => b[1] - a[1])
    return {
      key,
      topCountry: ranked[0]?.[0] ?? 'N/A',
      totalPlays: ranked.reduce((sum, [, count]) => sum + count, 0),
      countryCount: ranked.length,
    }
  })

  const sessionTransitionsMap = new Map<string, number>()
  const sessionDaypartTransitionsMap = new Map<string, number>()
  let crossPlatformTransitions = 0
  let totalTransitions = 0
  const sortedSessions = [...sessions].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )
  for (let index = 1; index < sortedSessions.length; index += 1) {
    const from = sortedSessions[index - 1].platform
    const to = sortedSessions[index].platform
    totalTransitions += 1
    if (from !== to) {
      crossPlatformTransitions += 1
    }
    const key = `${from}::${to}`
    sessionTransitionsMap.set(key, (sessionTransitionsMap.get(key) ?? 0) + 1)

    const fromHour = getModeHour(new Date(sortedSessions[index - 1].startTime), timezoneMode)
    const toHour = getModeHour(new Date(sortedSessions[index].startTime), timezoneMode)
    const daypartKey = `${getDaypartForHour(fromHour)}::${getDaypartForHour(toHour)}`
    sessionDaypartTransitionsMap.set(daypartKey, (sessionDaypartTransitionsMap.get(daypartKey) ?? 0) + 1)
  }

  const deviceTransitions = [...sessionTransitionsMap.entries()]
    .map(([key, count]) => {
      const [fromRaw, toRaw] = key.split('::')
      const from = (fromRaw as PlatformCategory) || 'Other'
      const to = (toRaw as PlatformCategory) || 'Other'
      return {
        from,
        to,
        count,
        share: count / Math.max(1, totalTransitions),
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const sessionDayparts = [...sessionDaypartTransitionsMap.entries()]
    .map(([key, count]) => {
      const [fromRaw, toRaw] = key.split('::')
      const from = (fromRaw as DaypartKey) || 'evening'
      const to = (toRaw as DaypartKey) || 'evening'
      return {
        from,
        to,
        count,
        share: count / Math.max(1, totalTransitions),
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  let currentReason = ''
  let currentReasonStreak = 0
  let longestReasonStartStreak: { reason: string; count: number } | null = null
  const topReasonStreaks = new Map<string, number>()
  let countryTransitions = 0
  let comparableCountryPairs = 0
  for (let index = 0; index < records.length; index += 1) {
    const reason = asReason(records[index].reason_start)
    if (reason === currentReason) {
      currentReasonStreak += 1
    } else {
      if (currentReason) {
        topReasonStreaks.set(currentReason, Math.max(topReasonStreaks.get(currentReason) ?? 0, currentReasonStreak))
      }
      currentReason = reason
      currentReasonStreak = 1
    }
    if (!longestReasonStartStreak || currentReasonStreak > longestReasonStartStreak.count) {
      longestReasonStartStreak = { reason, count: currentReasonStreak }
    }

    if (index > 0) {
      const prevCountry = records[index - 1].conn_country || 'ZZ'
      const currCountry = records[index].conn_country || 'ZZ'
      comparableCountryPairs += 1
      if (prevCountry !== currCountry) {
        countryTransitions += 1
      }
    }
  }
  if (currentReason) {
    topReasonStreaks.set(currentReason, Math.max(topReasonStreaks.get(currentReason) ?? 0, currentReasonStreak))
  }

  const topStartReasonStreaks = [...topReasonStreaks.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    country: {
      homeCountry,
      topCountries,
      domesticShare,
      travelShare,
      timeline,
    },
    reasons: {
      start: reasonStart,
      end: reasonEnd,
      transitions,
    },
    offlinePrivacy: {
      offlineRate: offlineCount / Math.max(1, records.length),
      incognitoRate: incognitoCount / Math.max(1, records.length),
      offlineTimestampCoverage: offlineWithTimestamp / Math.max(1, offlineCount),
      inconsistentOfflineTimestampCount,
    },
    deviceJourney: {
      transitions: deviceTransitions,
      dominantTransition: deviceTransitions[0] ?? null,
      crossPlatformSessionShare: crossPlatformTransitions / Math.max(1, totalTransitions),
    },
    sessionDayparts: {
      transitions: sessionDayparts,
      dominantTransition: sessionDayparts[0] ?? null,
    },
    intentPersistence: {
      longestReasonStartStreak,
      topStartReasonStreaks,
    },
    countryVolatilityIndex: countryTransitions / Math.max(1, comparableCountryPairs),
  }
}

function buildTrackUriIndex(records: StreamRecord[]): Record<string, string> {
  const index: Record<string, string> = {}
  for (const record of records) {
    if (!record.master_metadata_track_name || !record.master_metadata_album_artist_name || !record.spotify_track_uri) {
      continue
    }
    const key = `${record.master_metadata_track_name}::${record.master_metadata_album_artist_name}`
    if (!index[key]) {
      index[key] = record.spotify_track_uri
    }
  }
  return index
}

function buildDataQuality(records: StreamRecord[], contextAnalytics: ContextAnalytics): DataQualitySummary {
  const total = Math.max(1, records.length)
  const missingTrackName = records.filter((record) => !record.master_metadata_track_name).length
  const missingArtistName = records.filter((record) => !record.master_metadata_album_artist_name).length
  const missingTrackUri = records.filter((record) => record.content_type === 'music' && !record.spotify_track_uri).length
  const unknownCountry = records.filter((record) => !record.conn_country || record.conn_country === 'ZZ').length

  return {
    unknownCountryRate: unknownCountry / total,
    missingTrackNameRate: missingTrackName / total,
    missingArtistNameRate: missingArtistName / total,
    missingTrackUriRate: missingTrackUri / total,
    offlineTimestampInconsistencyRate:
      contextAnalytics.offlinePrivacy.inconsistentOfflineTimestampCount / total,
    historySignals: {
      offlineRows: Math.round(contextAnalytics.offlinePrivacy.offlineRate * records.length),
      incognitoRows: Math.round(contextAnalytics.offlinePrivacy.incognitoRate * records.length),
      countriesObserved: contextAnalytics.country.topCountries.length,
    },
  }
}

function buildNarrativeInsights(
  records: StreamRecord[],
  model: Pick<ProcessedDataModel, 'summary' | 'contextAnalytics' | 'monthlyBehavior' | 'archetypes' | 'timezoneMode'>,
): NarrativeInsight[] {
  const insights: NarrativeInsight[] = []
  const { summary, contextAnalytics, monthlyBehavior, archetypes, timezoneMode } = model

  insights.push({
    id: 'peak-hour',
    title: `${summary.peakHour}:00 is your peak listening hour`,
    description: `Your strongest activity cluster appears around ${summary.peakHour}:00 in ${timezoneMode === 'utc' ? 'UTC' : 'local time'}.`,
    confidence: records.length > 500 ? 'high' : records.length > 100 ? 'medium' : 'low',
    why: [
      `Peak hour chosen from ${records.length.toLocaleString()} records`,
      `Nocturnal share ${Math.round(summary.nocturnalShare * 100)}%`,
    ],
    category: 'habit',
  })

  insights.push({
    id: 'travel-footprint',
    title: `Travel share ${Math.round(contextAnalytics.country.travelShare * 100)}%`,
    description:
      contextAnalytics.country.homeCountry
        ? `Most listening happens in ${contextAnalytics.country.homeCountry}, with meaningful movement across countries.`
        : 'Country footprint suggests mixed or unknown connection geography.',
    confidence: contextAnalytics.country.topCountries.length >= 2 ? 'medium' : 'low',
    why: [
      `Home country ${contextAnalytics.country.homeCountry ?? 'N/A'}`,
      `Country volatility index ${contextAnalytics.countryVolatilityIndex.toFixed(2)}`,
    ],
    category: 'context',
  })

  const volatileMonth = [...monthlyBehavior]
    .filter((item) => item.plays >= 50)
    .sort((a, b) => Math.abs(b.skipRate - summary.skipRate) - Math.abs(a.skipRate - summary.skipRate))[0]
  if (volatileMonth) {
    insights.push({
      id: 'behavior-spike',
      title: `Behavior spike in ${volatileMonth.key}`,
      description: `Skip rate deviated to ${Math.round(volatileMonth.skipRate * 100)}% with offline usage ${Math.round(volatileMonth.offlineRate * 100)}%.`,
      confidence: volatileMonth.plays >= 200 ? 'high' : 'medium',
      why: [
        `Compared against overall skip rate ${Math.round(summary.skipRate * 100)}%`,
        `Month plays ${volatileMonth.plays.toLocaleString()}`,
      ],
      category: 'context',
    })
  }

  insights.push({
    id: 'archetype-anchor',
    title: `Primary archetype: ${archetypes.primary.label}`,
    description: archetypes.primary.rationale,
    confidence: archetypes.primary.score >= 0.75 ? 'high' : archetypes.primary.score >= 0.5 ? 'medium' : 'low',
    why: [`Score ${Math.round(archetypes.primary.score * 100)}%`, `Tie-break used: ${archetypes.tieBreak.used ? 'yes' : 'no'}`],
    category: 'taste',
  })

  return insights.slice(0, 6)
}

function buildContentMix(records: StreamRecord[]): Record<StreamRecord['content_type'], number> {
  const contentMix = {
    music: 0,
    podcast: 0,
    audiobook: 0,
  }
  for (const record of records) {
    contentMix[record.content_type] += 1
  }
  return contentMix
}

function pushStage(
  stageProvenance: StageProvenance[],
  stage: StageProvenance['stage'],
  startedAt: number,
  outputCount: number,
): void {
  stageProvenance.push({
    stage,
    durationMs: Math.round((nowMs() - startedAt) * 100) / 100,
    outputCount,
  })
}

export interface ProcessOptions {
  onProgress?: (progress: ParseProgress) => void
  timezoneMode?: TimezoneMode
}

export function processRecords(
  records: StreamRecord[],
  options: ProcessOptions = {},
): ProcessedDataModel {
  const timezoneMode = options.timezoneMode ?? 'local'
  const modelVersion = 1

  options.onProgress?.({
    stage: 'aggregation',
    filesParsed: 0,
    totalFiles: 0,
    recordsParsed: records.length,
  })

  const stageProvenance: StageProvenance[] = []

  options.onProgress?.({ stage: 'artists', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  let startedAt = nowMs()
  const artists = buildArtistStats(records)
  pushStage(stageProvenance, 'artists', startedAt, artists.length)

  options.onProgress?.({ stage: 'tracks', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const tracks = buildTrackStats(records)
  pushStage(stageProvenance, 'tracks', startedAt, tracks.length)

  options.onProgress?.({ stage: 'albums', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const albums = buildAlbumStats(records)
  pushStage(stageProvenance, 'albums', startedAt, albums.length)

  options.onProgress?.({ stage: 'time-series', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const yearly = buildTimeBuckets(records, 'year', timezoneMode)
  const monthly = buildTimeBuckets(records, 'month', timezoneMode)
  const weekly = buildTimeBuckets(records, 'week', timezoneMode)
  const daily = buildTimeBuckets(records, 'day', timezoneMode)
  const hours = buildHourDistributionByTimezone(records, timezoneMode)
  const dayOfWeek = buildWeekdayDistribution(records, timezoneMode)
  pushStage(stageProvenance, 'time-series', startedAt, yearly.length + monthly.length + weekly.length + daily.length)

  options.onProgress?.({ stage: 'sessions', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const sessions = reconstructSessions(records)
  pushStage(stageProvenance, 'sessions', startedAt, sessions.length)

  options.onProgress?.({ stage: 'summary', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const summary = computeSummary(records, artists, tracks, albums, daily, sessions, timezoneMode)
  pushStage(stageProvenance, 'summary', startedAt, 1)

  options.onProgress?.({ stage: 'taste', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const taste = buildTasteProfile(summary, records)
  pushStage(stageProvenance, 'taste', startedAt, taste.dimensions.length)

  options.onProgress?.({ stage: 'archetypes', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const archetypes = computeArchetypes(summary)
  pushStage(stageProvenance, 'archetypes', startedAt, archetypes.allScores.length)

  options.onProgress?.({ stage: 'platform', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const platform = buildPlatformStats(records)
  pushStage(stageProvenance, 'platform', startedAt, platform.length)

  options.onProgress?.({ stage: 'graph', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const graph = buildGraphData(records, artists, tracks)
  const graphAnalytics = computeGraphAnalytics(graph.nodes, graph.edges)
  pushStage(stageProvenance, 'graph', startedAt, graph.nodes.length + graph.edges.length)

  options.onProgress?.({ stage: 'gems', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const gems = computeForgottenGems(records)
  pushStage(stageProvenance, 'gems', startedAt, gems.length)

  options.onProgress?.({ stage: 'eras', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const eras = computeEras(records)
  pushStage(stageProvenance, 'eras', startedAt, eras.length)

  options.onProgress?.({ stage: 'skip', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const skipStats = buildSkipStats(records, timezoneMode)
  pushStage(stageProvenance, 'skip', startedAt, skipStats.byArtist.length)

  options.onProgress?.({ stage: 'context', filesParsed: 0, totalFiles: 0, recordsParsed: records.length })
  startedAt = nowMs()
  const monthKeys = monthly.map((bucket) => bucket.key)
  const monthlyBehavior = buildMonthlyBehavior(records, monthKeys, timezoneMode)
  const artistMonthlyTrends = buildArtistMonthlyTrends(records, timezoneMode)
  const contextAnalytics = buildContextAnalytics(records, sessions, monthKeys, timezoneMode)
  const trackUriIndex = buildTrackUriIndex(records)
  const dataQuality = buildDataQuality(records, contextAnalytics)
  pushStage(
    stageProvenance,
    'context',
    startedAt,
    monthlyBehavior.length +
      Object.keys(artistMonthlyTrends).length +
      contextAnalytics.reasons.transitions.length +
      contextAnalytics.deviceJourney.transitions.length,
  )

  const timeLabel = timezoneMode === 'utc' ? 'UTC' : 'local time'

  const quickInsights = [
    `You are most active at ${summary.peakHour}:00 (${timeLabel}).`,
    `${Math.round(summary.nocturnalShare * 100)}% of listening happens after 10PM (${timeLabel}).`,
    `Skip rate sits at ${Math.round(summary.skipRate * 100)}%.`,
    `Shuffle usage is ${Math.round(summary.shuffleRate * 100)}%.`,
    `Longest streak: ${summary.longestStreakDays} consecutive days.`,
  ]

  const diagnostics = {
    inputRecords: records.length,
    validRecords: records.length,
    droppedRecords: 0,
    contentMix: buildContentMix(records),
    warnings:
      contextAnalytics.offlinePrivacy.inconsistentOfflineTimestampCount > 0
        ? ['Detected inconsistent offline timestamp rows in source history.']
        : [],
  }

  const sessionMetricsSnapshot: SessionMetrics = {
    startedAt: new Date().toISOString(),
    counts: {
      upload_complete: 1,
      share_tab_open: 0,
      share_link_generated: 0,
      share_link_copied: 0,
      asset_exported: 0,
      advanced_mode_enabled: 0,
      advanced_tab_visit: 0,
      universe_mode_switched: 0,
      universe_3d_init_success: 0,
      universe_3d_init_failed: 0,
    },
    events: [
      {
        type: 'upload_complete',
        timestamp: new Date().toISOString(),
        dedupeKey: 'upload',
      },
    ],
  }

  const narrativeInsights = buildNarrativeInsights(records, {
    summary,
    contextAnalytics,
    monthlyBehavior,
    archetypes,
    timezoneMode,
  })
  const datasetIdentity = buildDatasetIdentity(records, timezoneMode)

  return {
    timezoneMode,
    modelVersion,
    datasetIdentity,
    records,
    summary,
    artists,
    tracks,
    albums,
    yearly,
    monthly,
    weekly,
    daily,
    hours,
    dayOfWeek,
    calendar: daily.map((bucket) => ({
      date: bucket.date,
      plays: bucket.plays,
      totalMs: bucket.totalMs,
    })),
    platform,
    sessions,
    skipStats,
    monthlyBehavior,
    artistMonthlyTrends,
    trackUriIndex,
    contextAnalytics,
    dataQuality,
    narrativeInsights,
    eras,
    gems,
    graph,
    graphAnalytics,
    taste,
    archetypes,
    quickInsights,
    sessionMetricsSnapshot,
    diagnostics,
    stageProvenance,
  }
}

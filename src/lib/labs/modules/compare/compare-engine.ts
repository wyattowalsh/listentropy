import type { CompareEnginePayload, CompareEngineScopeId, LabCompareDatasetSnapshot } from '@/lib/types'

import {
  confidenceFromValue,
  getStartTime,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

interface CompareEngineOptions {
  baselineSnapshot?: LabCompareDatasetSnapshot
  scopeId?: CompareEngineScopeId
  baselineEraId?: string | null
  currentEraId?: string | null
}

const COMPARE_SCOPE_LABELS: Record<CompareEngineScopeId, string> = {
  all: 'All Records',
  night: 'Night Listening',
  offline: 'Offline Sessions',
  weekend: 'Weekend Listening',
  travel: 'Travel Listening',
}

function asLabSnapshot(value: unknown): LabCompareDatasetSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Partial<LabCompareDatasetSnapshot>
  if (
    !candidate.datasetIdentity ||
    typeof candidate.datasetIdentity.fingerprint !== 'string' ||
    !candidate.summary ||
    typeof candidate.summary.totalPlays !== 'number' ||
    !Array.isArray(candidate.records) ||
    !candidate.contextAnalytics?.country ||
    typeof candidate.contextAnalytics.country.travelShare !== 'number' ||
    !Array.isArray(candidate.eras) ||
    !candidate.archetypes?.primary ||
    !Array.isArray(candidate.archetypes.allScores)
  ) {
    return null
  }
  return candidate as LabCompareDatasetSnapshot
}

function delta(current: number, baseline: number, digits = 4): number {
  return round(current - baseline, digits)
}

function asScopeId(value: unknown): CompareEngineScopeId {
  if (typeof value === 'string' && value in COMPARE_SCOPE_LABELS) {
    return value as CompareEngineScopeId
  }
  return 'all'
}

function recordDate(ts: string, timezoneMode: LabCompareDatasetSnapshot['timezoneMode']): Date {
  const date = new Date(ts)
  if (timezoneMode === 'utc') {
    return date
  }
  return date
}

function recordHour(ts: string, timezoneMode: LabCompareDatasetSnapshot['timezoneMode']): number {
  const date = recordDate(ts, timezoneMode)
  return timezoneMode === 'utc' ? date.getUTCHours() : date.getHours()
}

function recordDay(ts: string, timezoneMode: LabCompareDatasetSnapshot['timezoneMode']): number {
  const date = recordDate(ts, timezoneMode)
  return timezoneMode === 'utc' ? date.getUTCDay() : date.getDay()
}

function isNightHour(hour: number): boolean {
  return hour >= 23 || hour < 6
}

function filterRecordsForScope(snapshot: LabCompareDatasetSnapshot, scopeId: CompareEngineScopeId) {
  const homeCountry = snapshot.contextAnalytics.country.homeCountry
  if (scopeId === 'all') {
    return snapshot.records
  }

  return snapshot.records.filter((record) => {
    if (scopeId === 'offline') {
      return record.offline
    }
    if (scopeId === 'night') {
      return isNightHour(recordHour(record.ts, snapshot.timezoneMode))
    }
    if (scopeId === 'weekend') {
      const day = recordDay(record.ts, snapshot.timezoneMode)
      return day === 0 || day === 6
    }
    if (scopeId === 'travel') {
      if (!homeCountry) {
        return false
      }
      return Boolean(record.conn_country && record.conn_country !== homeCountry)
    }
    return true
  })
}

function summarizeSlice(snapshot: LabCompareDatasetSnapshot, scopeId: CompareEngineScopeId) {
  const records = filterRecordsForScope(snapshot, scopeId)
  const plays = records.length
  const totalMs = records.reduce((sum, record) => sum + record.ms_played, 0)
  const skipCount = records.reduce((sum, record) => sum + (record.skipped ? 1 : 0), 0)
  const shuffleCount = records.reduce((sum, record) => sum + (record.shuffle ? 1 : 0), 0)
  const nightCount = records.reduce(
    (sum, record) => sum + (isNightHour(recordHour(record.ts, snapshot.timezoneMode)) ? 1 : 0),
    0,
  )
  const uniqueArtists = new Set(
    records
      .map((record) => record.master_metadata_album_artist_name?.trim())
      .filter((artist): artist is string => Boolean(artist)),
  ).size

  return {
    records,
    recordCount: plays,
    totalHours: round(totalMs / 3_600_000, 3),
    skipRate: plays > 0 ? round(skipCount / plays, 4) : 0,
    shuffleRate: plays > 0 ? round(shuffleCount / plays, 4) : 0,
    uniqueArtists,
    nocturnalShare: plays > 0 ? round(nightCount / plays, 4) : 0,
  }
}

function sortedEras(snapshot: LabCompareDatasetSnapshot) {
  return [...snapshot.eras].sort((a, b) => a.startMonth.localeCompare(b.startMonth) || a.endMonth.localeCompare(b.endMonth))
}

function findEraById(eras: LabCompareDatasetSnapshot['eras'], eraId: string | null | undefined) {
  if (!eraId) {
    return null
  }
  const era = eras.find((item) => item.id === eraId)
  return era ?? null
}

function buildEraSnapshot(era: LabCompareDatasetSnapshot['eras'][number] | null) {
  if (!era) {
    return null
  }
  return {
    id: era.id,
    label: era.label,
    startMonth: era.startMonth,
    endMonth: era.endMonth,
    durationMonths: era.durationMonths,
    dominanceScore: round(era.dominanceScore, 4),
    diversityScore: round(era.diversityScore, 4),
    confidence: round(era.confidence, 4),
  }
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function uniqueOrderedStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    ordered.push(value)
  }
  return ordered
}

function buildStringOverlapDetails(
  baselineValues: string[],
  currentValues: string[],
  maxListItems = 6,
) {
  const baseline = uniqueSortedStrings(baselineValues)
  const current = uniqueSortedStrings(currentValues)
  const baselineSet = new Set(baseline)
  const currentSet = new Set(current)
  const shared = baseline.filter((value) => currentSet.has(value))
  const baselineOnly = baseline.filter((value) => !currentSet.has(value))
  const currentOnly = current.filter((value) => !baselineSet.has(value))
  const unionSize = new Set([...baseline, ...current]).size
  return {
    overlapShare: round(unionSize === 0 ? 0 : shared.length / unionSize, 4),
    shared: shared.slice(0, maxListItems),
    baselineOnly: baselineOnly.slice(0, maxListItems),
    currentOnly: currentOnly.slice(0, maxListItems),
  }
}

function buildRankAwareArtistOverlap(
  baselineValues: string[],
  currentValues: string[],
): Pick<
  CompareEnginePayload['eraVsEra']['dominantArtistOverlap'],
  'rankWeightedOverlapScore' | 'rankAlignedSharedArtists'
> {
  const baseline = uniqueOrderedStrings(baselineValues)
  const current = uniqueOrderedStrings(currentValues)
  const baselineRankByArtist = new Map(baseline.map((artist, index) => [artist, index + 1]))
  const currentRankByArtist = new Map(current.map((artist, index) => [artist, index + 1]))
  const union = new Set([...baseline, ...current])

  const rankWeight = (rank: number | undefined) => (rank ? 1 / rank : 0)

  let numerator = 0
  let denominator = 0
  for (const artist of union) {
    const baselineRank = baselineRankByArtist.get(artist)
    const currentRank = currentRankByArtist.get(artist)
    const baselineWeight = rankWeight(baselineRank)
    const currentWeight = rankWeight(currentRank)
    denominator += Math.max(baselineWeight, currentWeight)
    if (baselineRank && currentRank) {
      const alignment = 1 / (1 + Math.abs(baselineRank - currentRank))
      numerator += ((baselineWeight + currentWeight) / 2) * alignment
    }
  }

  const rankAlignedSharedArtists = [...baselineRankByArtist.keys()]
    .filter((artist) => currentRankByArtist.has(artist))
    .map((artist) => {
      const baselineRank = baselineRankByArtist.get(artist)!
      const currentRank = currentRankByArtist.get(artist)!
      return {
        artist,
        baselineRank,
        currentRank,
        rankDistance: Math.abs(baselineRank - currentRank),
      }
    })
    .sort((a, b) => a.rankDistance - b.rankDistance || a.baselineRank - b.baselineRank || a.artist.localeCompare(b.artist))
    .slice(0, 6)

  return {
    rankWeightedOverlapScore: round(denominator === 0 ? 0 : numerator / denominator, 4),
    rankAlignedSharedArtists,
  }
}

function buildEraVsEra(
  snapshot: LabCompareDatasetSnapshot,
  baseline: LabCompareDatasetSnapshot,
  options?: CompareEngineOptions,
): CompareEnginePayload['eraVsEra'] {
  const baselineEras = sortedEras(baseline)
  const currentEras = sortedEras(snapshot)

  const requestedBaselineId = options?.baselineEraId ?? null
  const requestedCurrentId = options?.currentEraId ?? null
  const explicitRequested = Boolean(requestedBaselineId || requestedCurrentId)

  const baselineEra = findEraById(baselineEras, requestedBaselineId) ?? baselineEras.at(-1) ?? null
  const currentEra = findEraById(currentEras, requestedCurrentId) ?? currentEras.at(-1) ?? null

  const missingRequested =
    (requestedBaselineId && !findEraById(baselineEras, requestedBaselineId)) ||
    (requestedCurrentId && !findEraById(currentEras, requestedCurrentId))

  const selectionMode: CompareEnginePayload['eraVsEra']['selection']['mode'] =
    explicitRequested
      ? (missingRequested ? 'fallback' : 'manual')
      : 'auto-latest'

  const baselineEraView = buildEraSnapshot(baselineEra)
  const currentEraView = buildEraSnapshot(currentEra)
  const notes: string[] = []
  if (!baselineEraView || !currentEraView) {
    notes.push('One side has no detected eras; era-vs-era metrics are sparse placeholders.')
  }
  if (selectionMode === 'auto-latest') {
    notes.push('Era comparison defaults to the latest detected era on each side.')
  }
  if (selectionMode === 'fallback') {
    notes.push('Requested era ID was not found on one side; fell back to the latest detected era.')
  }

  const dominantArtistOverlap = buildStringOverlapDetails(
    baselineEra?.dominantArtists ?? [],
    currentEra?.dominantArtists ?? [],
  )
  const rankAwareArtistOverlap = buildRankAwareArtistOverlap(
    baselineEra?.dominantArtists ?? [],
    currentEra?.dominantArtists ?? [],
  )
  const changeDriverOverlap = buildStringOverlapDetails(
    (baselineEra?.changeDrivers ?? []).map((driver) => driver.key),
    (currentEra?.changeDrivers ?? []).map((driver) => driver.key),
  )
  if (dominantArtistOverlap.overlapShare === 0 && (baselineEra?.dominantArtists.length || currentEra?.dominantArtists.length)) {
    notes.push('Selected eras share no dominant artists in their top dominant-artist summaries.')
  }
  if (changeDriverOverlap.overlapShare === 0 && ((baselineEra?.changeDrivers.length ?? 0) || (currentEra?.changeDrivers.length ?? 0))) {
    notes.push('Selected eras have non-overlapping change-driver categories.')
  }

  return {
    selection: {
      mode: selectionMode,
      baselineEraId: baselineEraView?.id ?? null,
      currentEraId: currentEraView?.id ?? null,
    },
    baselineEra: baselineEraView,
    currentEra: currentEraView,
    delta: {
      durationMonthsDelta: (currentEraView?.durationMonths ?? 0) - (baselineEraView?.durationMonths ?? 0),
      dominanceScoreDelta: delta(currentEraView?.dominanceScore ?? 0, baselineEraView?.dominanceScore ?? 0),
      diversityScoreDelta: delta(currentEraView?.diversityScore ?? 0, baselineEraView?.diversityScore ?? 0),
      confidenceDelta: delta(currentEraView?.confidence ?? 0, baselineEraView?.confidence ?? 0),
    },
    dominantArtistOverlap: {
      overlapShare: dominantArtistOverlap.overlapShare,
      rankWeightedOverlapScore: rankAwareArtistOverlap.rankWeightedOverlapScore,
      sharedDominantArtists: dominantArtistOverlap.shared,
      rankAlignedSharedArtists: rankAwareArtistOverlap.rankAlignedSharedArtists,
      baselineOnlyDominantArtists: dominantArtistOverlap.baselineOnly,
      currentOnlyDominantArtists: dominantArtistOverlap.currentOnly,
    },
    changeDriverOverlap: {
      overlapShare: changeDriverOverlap.overlapShare,
      sharedDriverKeys: changeDriverOverlap.shared as CompareEnginePayload['eraVsEra']['changeDriverOverlap']['sharedDriverKeys'],
      baselineOnlyDriverKeys: changeDriverOverlap.baselineOnly as CompareEnginePayload['eraVsEra']['changeDriverOverlap']['baselineOnlyDriverKeys'],
      currentOnlyDriverKeys: changeDriverOverlap.currentOnly as CompareEnginePayload['eraVsEra']['changeDriverOverlap']['currentOnlyDriverKeys'],
    },
    notes,
  }
}

function buildTopMetricShifts(payload: CompareEnginePayload['summaryDelta']): CompareEnginePayload['topMetricShifts'] {
  const entries: Array<Omit<CompareEnginePayload['topMetricShifts'][number], 'absDelta' | 'direction'>> = [
    { key: 'totalPlays', label: 'Total Plays', delta: payload.totalPlaysDelta },
    { key: 'totalHours', label: 'Total Hours', delta: payload.totalHoursDelta },
    { key: 'skipRate', label: 'Skip Rate', delta: payload.skipRateDelta },
    { key: 'shuffleRate', label: 'Shuffle Rate', delta: payload.shuffleRateDelta },
    { key: 'nocturnalShare', label: 'Nocturnal Share', delta: payload.nocturnalShareDelta },
    { key: 'top10ArtistShare', label: 'Top-10 Artist Share', delta: payload.top10ArtistShareDelta },
    { key: 'eclecticism', label: 'Eclecticism', delta: payload.eclecticismDelta },
    { key: 'uniqueArtists', label: 'Unique Artists', delta: payload.uniqueArtistsDelta },
    { key: 'sessionDepthAvg', label: 'Avg Session Depth', delta: payload.sessionDepthAvgDelta },
    { key: 'travelShare', label: 'Travel Share', delta: payload.travelShareDelta },
  ]

  return entries
    .map((entry) => ({
      ...entry,
      absDelta: round(Math.abs(entry.delta), 4),
      direction:
        entry.delta > 0
          ? ('up' as const)
          : entry.delta < 0
            ? ('down' as const)
            : ('flat' as const),
    }))
    .sort((a, b) => b.absDelta - a.absDelta || a.label.localeCompare(b.label))
    .slice(0, 6)
}

function buildArchetypeScoreShifts(
  baseline: LabCompareDatasetSnapshot,
  current: LabCompareDatasetSnapshot,
): CompareEnginePayload['archetypeScoreShifts'] {
  const baselineScores = new Map(baseline.archetypes.allScores.map((score) => [score.key, score]))
  const currentScores = new Map(current.archetypes.allScores.map((score) => [score.key, score]))
  const keys = new Set([...baselineScores.keys(), ...currentScores.keys()])

  return [...keys]
    .map((key) => {
      const baselineScore = baselineScores.get(key)
      const currentScore = currentScores.get(key)
      const deltaValue = round((currentScore?.score ?? 0) - (baselineScore?.score ?? 0), 4)
      return {
        key,
        label: currentScore?.label ?? baselineScore?.label ?? key,
        baselineScore: round(baselineScore?.score ?? 0, 4),
        currentScore: round(currentScore?.score ?? 0, 4),
        delta: deltaValue,
        absDelta: round(Math.abs(deltaValue), 4),
        direction:
          deltaValue > 0
            ? ('up' as const)
            : deltaValue < 0
              ? ('down' as const)
              : ('flat' as const),
      }
    })
    .sort((a, b) => b.absDelta - a.absDelta || a.label.localeCompare(b.label))
}

function buildArchetypeTournament(
  shifts: CompareEnginePayload['archetypeScoreShifts'],
): CompareEnginePayload['archetypeTournament'] {
  const rankings = shifts
    .map((shift, index) => ({
      rank: index + 1,
      key: shift.key,
      label: shift.label,
      baselineScore: shift.baselineScore,
      currentScore: shift.currentScore,
      delta: shift.delta,
      absDelta: shift.absDelta,
      winner:
        shift.delta > 0
          ? ('current' as const)
          : shift.delta < 0
            ? ('baseline' as const)
            : ('tie' as const),
      direction: shift.direction,
    }))
    .slice(0, 12)

  const summary = rankings.reduce(
    (acc, ranking) => {
      if (ranking.winner === 'current') {
        acc.currentWins += 1
      } else if (ranking.winner === 'baseline') {
        acc.baselineWins += 1
      } else {
        acc.ties += 1
      }
      return acc
    },
    {
      totalArchetypes: rankings.length,
      currentWins: 0,
      baselineWins: 0,
      ties: 0,
      topSwingKey: rankings[0]?.key ?? null,
      topSwingLabel: rankings[0]?.label ?? null,
    },
  )

  return {
    rankings,
    summary,
  }
}

function buildEraPairDeltas(
  baseline: LabCompareDatasetSnapshot,
  current: LabCompareDatasetSnapshot,
): CompareEnginePayload['eraPairDeltas'] {
  const maxPairs = Math.max(baseline.eras.length, current.eras.length)

  const pairs = Array.from({ length: maxPairs }, (_, pairIndex) => {
    const baselineEra = baseline.eras[pairIndex]
    const currentEra = current.eras[pairIndex]

    return {
      pairIndex,
      baselineEraId: baselineEra?.id ?? null,
      baselineEraLabel: baselineEra?.label ?? null,
      currentEraId: currentEra?.id ?? null,
      currentEraLabel: currentEra?.label ?? null,
      durationMonthsDelta: (currentEra?.durationMonths ?? 0) - (baselineEra?.durationMonths ?? 0),
      dominanceScoreDelta: delta(currentEra?.dominanceScore ?? 0, baselineEra?.dominanceScore ?? 0),
      diversityScoreDelta: delta(currentEra?.diversityScore ?? 0, baselineEra?.diversityScore ?? 0),
      confidenceDelta: delta(currentEra?.confidence ?? 0, baselineEra?.confidence ?? 0),
    }
  })
  return pairs.slice(Math.max(0, pairs.length - 6))
}

export function runCompareEngineModule(snapshot: LabCompareDatasetSnapshot, options?: Record<string, unknown>) {
  const startedAt = getStartTime()
  const compareOptions = options as CompareEngineOptions | undefined
  const baseline = asLabSnapshot(compareOptions?.baselineSnapshot)
  const scopeId = asScopeId(compareOptions?.scopeId)

  if (!baseline) {
    return unsupportedResult<CompareEnginePayload>({
      moduleId: 'compare-engine',
      startedAt,
      message: 'Capture a baseline dataset in Compare Workspace before running Compare Engine.',
      sourceFields: ['datasetIdentity', 'summary', 'contextAnalytics', 'eras', 'archetypes'],
      assumptions: ['Compare Engine requires a local baseline snapshot passed via Xenolab UI options.'],
    })
  }

  if (baseline.records.length < 10 || snapshot.records.length < 10) {
    return unsupportedResult<CompareEnginePayload>({
      moduleId: 'compare-engine',
      startedAt,
      message: 'Need at least 10 records in both baseline and current datasets for comparison.',
      sourceFields: ['records', 'summary', 'datasetIdentity'],
      assumptions: ['Train B starter compare uses core aggregate deltas, not full compare engine pipeline yet.'],
    })
  }

  const summaryDelta: CompareEnginePayload['summaryDelta'] = {
    totalPlaysDelta: snapshot.summary.totalPlays - baseline.summary.totalPlays,
    totalHoursDelta: delta(snapshot.summary.totalHours, baseline.summary.totalHours, 3),
    skipRateDelta: delta(snapshot.summary.skipRate, baseline.summary.skipRate),
    shuffleRateDelta: delta(snapshot.summary.shuffleRate, baseline.summary.shuffleRate),
    nocturnalShareDelta: delta(snapshot.summary.nocturnalShare, baseline.summary.nocturnalShare),
    top10ArtistShareDelta: delta(snapshot.summary.top10ArtistShare, baseline.summary.top10ArtistShare),
    eclecticismDelta: delta(snapshot.summary.eclecticism, baseline.summary.eclecticism),
    uniqueArtistsDelta: snapshot.summary.uniqueArtists - baseline.summary.uniqueArtists,
    sessionDepthAvgDelta: delta(snapshot.summary.sessionDepthAvg, baseline.summary.sessionDepthAvg, 3),
    travelShareDelta: delta(snapshot.contextAnalytics.country.travelShare, baseline.contextAnalytics.country.travelShare),
  }

  const sameFingerprint = baseline.datasetIdentity.fingerprint === snapshot.datasetIdentity.fingerprint
  const timezoneMismatch = baseline.timezoneMode !== snapshot.timezoneMode
  const archetypeChanged = baseline.archetypes.primary.key !== snapshot.archetypes.primary.key
  const baselineSlice = summarizeSlice(baseline, scopeId)
  const currentSlice = summarizeSlice(snapshot, scopeId)

  const notes: string[] = []
  if (sameFingerprint) {
    notes.push('Baseline and current dataset fingerprints match; deltas will be near zero unless metadata/timezone differs.')
  }
  if (timezoneMismatch) {
    notes.push(`Timezone mismatch: baseline=${baseline.timezoneMode}, current=${snapshot.timezoneMode}. Time-based metrics may shift.`)
  }
  notes.push(
    `Primary archetype ${baseline.archetypes.primary.label} → ${snapshot.archetypes.primary.label}${archetypeChanged ? ' (changed)' : ' (unchanged)'}.`,
  )
  notes.push(
    `Era count ${baseline.eras.length} → ${snapshot.eras.length}; travel share ${Math.round(
      baseline.contextAnalytics.country.travelShare * 100,
    )}% → ${Math.round(snapshot.contextAnalytics.country.travelShare * 100)}%.`,
  )
  if (scopeId !== 'all') {
    notes.push(
      `Compare scope: ${COMPARE_SCOPE_LABELS[scopeId]} (${baselineSlice.recordCount.toLocaleString()} baseline records, ${currentSlice.recordCount.toLocaleString()} current records).`,
    )
  }
  if (baselineSlice.recordCount === 0 || currentSlice.recordCount === 0) {
    notes.push('Scoped compare slice is sparse on one side; slice deltas may be unstable or uninformative.')
  }
  const eraVsEra = buildEraVsEra(snapshot, baseline, compareOptions)
  notes.push(...eraVsEra.notes)
  const archetypeScoreShifts = buildArchetypeScoreShifts(baseline, snapshot)
  const archetypeTournament = buildArchetypeTournament(archetypeScoreShifts)

  const payload: CompareEnginePayload = {
    baseline: {
      fingerprint: baseline.datasetIdentity.fingerprint,
      recordCount: baseline.datasetIdentity.recordCount,
      timezoneMode: baseline.timezoneMode,
    },
    current: {
      fingerprint: snapshot.datasetIdentity.fingerprint,
      recordCount: snapshot.datasetIdentity.recordCount,
      timezoneMode: snapshot.timezoneMode,
    },
    summaryDelta,
    topMetricShifts: buildTopMetricShifts(summaryDelta),
    eraDelta: {
      baselineEraCount: baseline.eras.length,
      currentEraCount: snapshot.eras.length,
      delta: snapshot.eras.length - baseline.eras.length,
    },
    archetypeDelta: {
      baselinePrimaryKey: baseline.archetypes.primary.key,
      baselinePrimaryLabel: baseline.archetypes.primary.label,
      currentPrimaryKey: snapshot.archetypes.primary.key,
      currentPrimaryLabel: snapshot.archetypes.primary.label,
      changed: archetypeChanged,
    },
    archetypeScoreShifts,
    eraPairDeltas: buildEraPairDeltas(baseline, snapshot),
    eraVsEra,
    archetypeTournament,
    scope: {
      id: scopeId,
      label: COMPARE_SCOPE_LABELS[scopeId],
    },
    sliceDelta: {
      baselineRecords: baselineSlice.recordCount,
      currentRecords: currentSlice.recordCount,
      totalHoursDelta: delta(currentSlice.totalHours, baselineSlice.totalHours, 3),
      skipRateDelta: delta(currentSlice.skipRate, baselineSlice.skipRate),
      shuffleRateDelta: delta(currentSlice.shuffleRate, baselineSlice.shuffleRate),
      uniqueArtistsDelta: currentSlice.uniqueArtists - baselineSlice.uniqueArtists,
      nocturnalShareDelta: delta(currentSlice.nocturnalShare, baselineSlice.nocturnalShare),
    },
    notes,
  }

  const recordFloor = Math.min(baseline.records.length, snapshot.records.length)
  const confidence = confidenceFromValue(
    Math.min(
      0.92,
      (Math.min(1, recordFloor / 4000) * 0.65) +
        (timezoneMismatch ? 0.05 : 0.15) +
        (sameFingerprint ? 0.05 : 0.12),
    ),
    [
      `Compared ${baseline.records.length.toLocaleString()} baseline records vs ${snapshot.records.length.toLocaleString()} current records`,
      `Scope: ${COMPARE_SCOPE_LABELS[scopeId]} (${baselineSlice.recordCount.toLocaleString()} vs ${currentSlice.recordCount.toLocaleString()} records)`,
      `Era-vs-era mode: ${eraVsEra.selection.mode}`,
      timezoneMismatch ? 'Timezone differs across compared snapshots' : 'Timezone mode matches across snapshots',
      'Descriptive aggregate delta comparison (not causal or predictive).',
    ],
  )

  return readyResult({
    moduleId: 'compare-engine',
    startedAt,
    payload,
    confidence,
    sourceFields: ['datasetIdentity', 'summary', 'contextAnalytics.country', 'eras', 'archetypes'],
    method: 'descriptive heuristic baseline-vs-current comparison over core aggregate outputs',
    assumptions: [
      'Train B starter compare engine compares core aggregates and selected derived signals, not a full slice compare pipeline.',
      'Baseline snapshot is captured locally in-session and passed to worker as module options.',
    ],
    warnings: [
      ...(timezoneMismatch ? ['Timezone mismatch may produce artificial drift in peak/nocturnal metrics.'] : []),
      ...(sameFingerprint ? ['Same dataset fingerprint compared against itself; use a second upload or changed slice for meaningful deltas.'] : []),
      ...(baselineSlice.recordCount === 0 || currentSlice.recordCount === 0
        ? ['Selected compare scope has zero records on one side; slice deltas default to sparse-data heuristics.']
        : []),
      ...(eraVsEra.selection.mode === 'fallback'
        ? ['Requested era selection fell back to latest detected era on one or both sides.']
        : []),
      ...((!eraVsEra.baselineEra || !eraVsEra.currentEra)
        ? ['Era-vs-era compare is sparse because one side has no detected eras.']
        : []),
    ],
    message: `Compared current dataset against baseline (${sameFingerprint ? 'same dataset' : 'different dataset'}).`,
  })
}

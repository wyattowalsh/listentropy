import type {
  AudioAffectOverlayPayload,
  AudioTraitMetricKey,
  AudioTraitSnapshot,
  AudioTraitVector,
  DaypartKey,
  LabDatasetSnapshot,
  LabModuleResult,
} from '@/lib/types'

import {
  confidenceFromValue,
  daypartForTs,
  getStartTime,
  monthKeyForTs,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

const TRAIT_KEYS: AudioTraitMetricKey[] = [
  'danceability',
  'energy',
  'valence',
  'acousticness',
  'instrumentalness',
  'speechiness',
  'tempo',
  'liveness',
]

interface WeightedTraitRow {
  traits: AudioTraitVector
  weight: number
  skipped: boolean
  daypart: DaypartKey
  month: string
}

function zeroVector(): AudioTraitVector {
  return {
    danceability: 0,
    energy: 0,
    valence: 0,
    acousticness: 0,
    instrumentalness: 0,
    speechiness: 0,
    tempo: 0,
    liveness: 0,
  }
}

function addWeighted(sum: AudioTraitVector, values: AudioTraitVector, weight: number): void {
  for (const key of TRAIT_KEYS) {
    sum[key] += values[key] * weight
  }
}

function divideVector(sum: AudioTraitVector, denominator: number): AudioTraitVector {
  if (denominator <= 0) {
    return zeroVector()
  }
  const out = zeroVector()
  for (const key of TRAIT_KEYS) {
    out[key] = round(sum[key] / denominator, 4)
  }
  return out
}

function computeWeightedCentroid(rows: WeightedTraitRow[]): { centroid: AudioTraitVector; totalWeight: number } {
  const totalWeight = rows.reduce((acc, row) => acc + row.weight, 0)
  const sum = zeroVector()
  for (const row of rows) {
    addWeighted(sum, row.traits, row.weight)
  }
  return {
    centroid: divideVector(sum, totalWeight),
    totalWeight,
  }
}

function computeSpread(rows: WeightedTraitRow[], centroid: AudioTraitVector): Partial<Record<AudioTraitMetricKey, number>> {
  if (rows.length === 0) {
    return {}
  }
  const totalWeight = rows.reduce((acc, row) => acc + row.weight, 0)
  if (totalWeight <= 0) {
    return {}
  }

  const varianceSums: Partial<Record<AudioTraitMetricKey, number>> = {}
  for (const key of TRAIT_KEYS) {
    varianceSums[key] = 0
  }
  for (const row of rows) {
    for (const key of TRAIT_KEYS) {
      const delta = row.traits[key] - centroid[key]
      varianceSums[key] = (varianceSums[key] ?? 0) + delta * delta * row.weight
    }
  }

  const spread: Partial<Record<AudioTraitMetricKey, number>> = {}
  for (const key of TRAIT_KEYS) {
    spread[key] = round(Math.sqrt((varianceSums[key] ?? 0) / totalWeight), 4)
  }
  return spread
}

function asAudioTraitSnapshot(value: unknown): AudioTraitSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const maybe = value as Partial<AudioTraitSnapshot>
  if (!maybe.providerId || !maybe.datasetFingerprint || !maybe.traitsByTrackId || !maybe.coverage) {
    return null
  }
  return maybe as AudioTraitSnapshot
}

function extractTrackId(uri: string | null | undefined): string | null {
  if (!uri || !uri.startsWith('spotify:track:')) {
    return null
  }
  const id = uri.split(':')[2]
  if (!id || id === 'local') {
    return null
  }
  return id
}

function buildEraMonthLookup(snapshot: LabDatasetSnapshot): Map<string, { eraId: string; eraLabel: string }> {
  const map = new Map<string, { eraId: string; eraLabel: string }>()
  for (const era of snapshot.eras) {
    let cursor = new Date(`${era.startMonth}-01T00:00:00Z`)
    const end = new Date(`${era.endMonth}-01T00:00:00Z`)
    while (!Number.isNaN(cursor.getTime()) && cursor <= end) {
      const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
      map.set(month, { eraId: era.id, eraLabel: era.label })
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
    }
  }
  return map
}

function groupRowsByDaypart(rows: WeightedTraitRow[]): Record<DaypartKey, WeightedTraitRow[]> {
  return {
    'late-night': rows.filter((row) => row.daypart === 'late-night'),
    morning: rows.filter((row) => row.daypart === 'morning'),
    afternoon: rows.filter((row) => row.daypart === 'afternoon'),
    evening: rows.filter((row) => row.daypart === 'evening'),
  }
}

export function runAudioAffectOverlayModule(
  snapshot: LabDatasetSnapshot,
  options?: Record<string, unknown>,
): LabModuleResult<AudioAffectOverlayPayload> {
  const startedAt = getStartTime()
  const audioTraitSnapshot = asAudioTraitSnapshot(options?.audioTraitSnapshot)

  if (!audioTraitSnapshot) {
    return unsupportedResult({
      moduleId: 'audio-affect-overlay',
      startedAt,
      message: 'Audio trait snapshot not prepared. Connect Spotify and prepare enrichment first.',
      sourceFields: ['records', 'eras', 'datasetIdentity'],
      assumptions: ['Audio trait snapshot is prepared in main thread and passed into Xenolab module options.'],
    })
  }

  if (audioTraitSnapshot.datasetFingerprint !== snapshot.datasetIdentity.fingerprint) {
    return unsupportedResult({
      moduleId: 'audio-affect-overlay',
      startedAt,
      message: 'Audio trait snapshot does not match the current dataset fingerprint.',
      sourceFields: ['datasetIdentity', 'records'],
      assumptions: ['Audio trait snapshots are cached per dataset fingerprint.'],
    })
  }

  const capability = 'audioFeatures' in audioTraitSnapshot.capabilities
    ? audioTraitSnapshot.capabilities.audioFeatures
    : audioTraitSnapshot.capabilities.audioTraits

  if (capability !== 'available' && Object.keys(audioTraitSnapshot.traitsByTrackId).length === 0) {
    return unsupportedResult({
      moduleId: 'audio-affect-overlay',
      startedAt,
      message: `Spotify audio trait endpoint is ${capability}; no trait records available.`,
      sourceFields: ['records', 'eras', 'datasetIdentity'],
      warnings: audioTraitSnapshot.warnings,
      assumptions: ['Endpoint restrictions are treated as normal unsupported outcomes.'],
    })
  }

  const eraLookup = buildEraMonthLookup(snapshot)
  const weightedRows: WeightedTraitRow[] = []
  const rowsByEra = new Map<string, WeightedTraitRow[]>()

  for (const record of snapshot.records) {
    const trackId = extractTrackId(record.spotify_track_uri)
    if (!trackId) {
      continue
    }
    const traitRecord = audioTraitSnapshot.traitsByTrackId[trackId]
    if (!traitRecord) {
      continue
    }
    const weight = Number.isFinite(record.ms_played) && record.ms_played > 0 ? record.ms_played : 1
    const month = monthKeyForTs(record.ts, snapshot.timezoneMode)
    const row: WeightedTraitRow = {
      traits: traitRecord.traits,
      weight,
      skipped: Boolean(record.skipped || record.reason_end === 'fwdbtn'),
      daypart: daypartForTs(record.ts, snapshot.timezoneMode),
      month,
    }
    weightedRows.push(row)
    const eraRef = eraLookup.get(month)
    if (eraRef) {
      const key = `${eraRef.eraId}::${eraRef.eraLabel}`
      const existing = rowsByEra.get(key) ?? []
      existing.push(row)
      rowsByEra.set(key, existing)
    }
  }

  if (weightedRows.length < 10) {
    return unsupportedResult({
      moduleId: 'audio-affect-overlay',
      startedAt,
      message: 'Insufficient matched rows for audio-affect overlay (need at least 10 matched plays).',
      sourceFields: ['records', 'eras', 'datasetIdentity'],
      warnings: audioTraitSnapshot.warnings,
      assumptions: ['Minimum matched rows threshold avoids unstable trait centroids.'],
    })
  }

  const overall = computeWeightedCentroid(weightedRows)
  const byDaypart = groupRowsByDaypart(weightedRows)
  const daypartCentroids = {
    'late-night': { ...computeWeightedCentroid(byDaypart['late-night']).centroid, sampleRows: byDaypart['late-night'].length },
    morning: { ...computeWeightedCentroid(byDaypart.morning).centroid, sampleRows: byDaypart.morning.length },
    afternoon: { ...computeWeightedCentroid(byDaypart.afternoon).centroid, sampleRows: byDaypart.afternoon.length },
    evening: { ...computeWeightedCentroid(byDaypart.evening).centroid, sampleRows: byDaypart.evening.length },
  }

  const eraCentroids = [...rowsByEra.entries()]
    .map(([key, rows]) => {
      const [eraId, eraLabel] = key.split('::')
      const centroidResult = computeWeightedCentroid(rows)
      return {
        eraId,
        eraLabel,
        sampleRows: rows.length,
        centroid: centroidResult.centroid,
        spread: computeSpread(rows, centroidResult.centroid),
      }
    })
    .sort((a, b) => b.sampleRows - a.sampleRows || a.eraLabel.localeCompare(b.eraLabel))
    .slice(0, 12)

  const skippedRows = weightedRows.filter((row) => row.skipped)
  const completedRows = weightedRows.filter((row) => !row.skipped)
  let skipTraitDeltas: AudioAffectOverlayPayload['skipTraitDeltas'] | undefined
  if (skippedRows.length >= 10 && completedRows.length >= 10) {
    const skippedCentroid = computeWeightedCentroid(skippedRows).centroid
    const completedCentroid = computeWeightedCentroid(completedRows).centroid
    const deltas: Partial<Record<AudioTraitMetricKey, number>> = {}
    for (const key of TRAIT_KEYS) {
      deltas[key] = round(skippedCentroid[key] - completedCentroid[key], 4)
    }
    skipTraitDeltas = {
      matchedSkippedRows: skippedRows.length,
      matchedCompletedRows: completedRows.length,
      deltas,
    }
  }

  const coverage = audioTraitSnapshot.coverage
  const warnings = [...audioTraitSnapshot.warnings]
  if (coverage.rowsCoverageShare < 0.35) {
    warnings.push('Low row-level trait coverage may bias audio-affect summaries.')
  }
  if (eraCentroids.length === 0) {
    warnings.push('No era-level audio trait centroids could be computed from matched rows.')
  }

  const coverageConfidence = Math.min(
    1,
    (coverage.rowsCoverageShare * 0.55) + (coverage.uniqueTrackCoverageShare * 0.35) + (Math.min(weightedRows.length, 400) / 400) * 0.1,
  )

  const payload: AudioAffectOverlayPayload = {
    coverage,
    overallCentroid: overall.centroid,
    daypartCentroids,
    eraCentroids,
    skipTraitDeltas,
    capabilities: audioTraitSnapshot.capabilities,
    notes: [
      `Matched ${weightedRows.length.toLocaleString()} records to audio traits.`,
      'Centroids are weighted by ms_played (fallback count weight when invalid).',
    ],
  }

  return readyResult({
    moduleId: 'audio-affect-overlay',
    startedAt,
    payload,
    message: `Computed audio-affect overlay from ${coverage.uniqueTrackIdsResolved.toLocaleString()} Spotify tracks (${Math.round(coverage.rowsCoverageShare * 100)}% row coverage).`,
    confidence: confidenceFromValue(coverageConfidence, [
      `Row coverage ${Math.round(coverage.rowsCoverageShare * 100)}%`,
      `Unique track coverage ${Math.round(coverage.uniqueTrackCoverageShare * 100)}%`,
      `${weightedRows.length.toLocaleString()} matched rows`,
    ]),
    sourceFields: ['records', 'eras', 'datasetIdentity'],
    method: 'descriptive heuristic weighted audio-trait centroid aggregation',
    assumptions: [
      'Spotify audio trait values are treated as track-level static metadata.',
      'Tempo is normalized to a 0-1 scale for centroid comparability.',
      'Coverage warnings indicate potential join bias from missing track URIs or API restrictions.',
    ],
    warnings,
  })
}

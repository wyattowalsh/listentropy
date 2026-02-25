import type { LabDatasetSnapshot, SequenceMotifsPayload } from '@/lib/types'

import {
  confidenceFromValue,
  getStartTime,
  monthKeyForTs,
  readyResult,
  round,
  topShareList,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

function safeTrackLabel(record: LabDatasetSnapshot['records'][number]): string {
  return record.master_metadata_track_name || record.episode_name || record.audiobook_chapter_title || 'Unknown Track'
}

function safeArtistLabel(record: LabDatasetSnapshot['records'][number]): string {
  return record.master_metadata_album_artist_name || record.episode_show_name || record.audiobook_title || 'Unknown Artist'
}

function buildSequences(snapshot: LabDatasetSnapshot): Array<{ tracks: string[]; artists: string[] }> {
  const sequences: Array<{ tracks: string[]; artists: string[] }> = []
  let cursor = 0

  for (const session of snapshot.sessions) {
    const slice = snapshot.records.slice(cursor, cursor + session.trackCount)
    cursor += session.trackCount
    if (slice.length === 0) {
      continue
    }
    sequences.push({
      tracks: slice.map(safeTrackLabel),
      artists: slice.map(safeArtistLabel),
    })
  }

  if (sequences.length === 0 && snapshot.records.length > 0) {
    sequences.push({
      tracks: snapshot.records.map(safeTrackLabel),
      artists: snapshot.records.map(safeArtistLabel),
    })
  }

  return sequences
}

function collectMotifs(
  sequences: string[][],
  type: 'track' | 'artist',
  maxLength = 3,
): SequenceMotifsPayload['motifs'] {
  const counts = new Map<string, { sequence: string[]; occurrences: number; sessions: Set<number>; length: number }>()

  sequences.forEach((sequence, sessionIndex) => {
    for (let windowLength = 2; windowLength <= maxLength; windowLength += 1) {
      for (let index = 0; index <= sequence.length - windowLength; index += 1) {
        const sampleSequence = sequence.slice(index, index + windowLength)
        if (sampleSequence.some((label) => !label)) {
          continue
        }
        const key = `${type}:${sampleSequence.join(' → ')}`
        const bucket = counts.get(key) ?? {
          sequence: sampleSequence,
          occurrences: 0,
          sessions: new Set<number>(),
          length: windowLength,
        }
        bucket.occurrences += 1
        bucket.sessions.add(sessionIndex)
        counts.set(key, bucket)
      }
    }
  })

  return [...counts.entries()]
    .map(([key, value]) => ({
      key,
      type,
      length: value.length,
      occurrences: value.occurrences,
      sampleSequence: value.sequence,
      distinctSessionCount: value.sessions.size,
      recurrenceScore: round((value.occurrences * value.sessions.size) / Math.max(1, sequences.length * value.length), 3),
    }))
    .filter((motif) => motif.occurrences >= 2)
    .sort((a, b) => b.recurrenceScore - a.recurrenceScore || b.occurrences - a.occurrences || a.key.localeCompare(b.key))
    .slice(0, 18)
}

export function runSequenceMotifsModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.records.length < 20 || snapshot.sessions.length < 2) {
    return unsupportedResult<SequenceMotifsPayload>({
      moduleId: 'sequence-motifs',
      startedAt,
      message: 'Need at least 20 records and 2 sessions for reliable motif detection.',
      sourceFields: ['records', 'sessions'],
      assumptions: ['Sequence motifs are session-oriented and require repeated behavior.'],
    })
  }

  const sessionSequences = buildSequences(snapshot)
  const trackMotifs = collectMotifs(sessionSequences.map((item) => item.tracks), 'track', 3)
  const artistMotifs = collectMotifs(sessionSequences.map((item) => item.artists), 'artist', 3)
  const motifs = [...trackMotifs, ...artistMotifs]
    .sort((a, b) => b.recurrenceScore - a.recurrenceScore || b.occurrences - a.occurrences)
    .slice(0, 24)

  const transitionCounts = new Map<string, number>()
  for (let index = 1; index < snapshot.records.length; index += 1) {
    const fromLabel = safeArtistLabel(snapshot.records[index - 1])
    const toLabel = safeArtistLabel(snapshot.records[index])
    if (fromLabel === toLabel) {
      continue
    }
    const key = `${fromLabel}::${toLabel}`
    transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1)
  }

  const rareTransitions = [...transitionCounts.entries()]
    .filter(([, count]) => count <= 2)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([key, count]) => {
      const [fromLabel, toLabel] = key.split('::')
      const fromMonths = new Set<string>()
      const toMonths = new Set<string>()
      for (const record of snapshot.records) {
        const month = monthKeyForTs(record.ts, snapshot.timezoneMode)
        if (safeArtistLabel(record) === fromLabel) {
          fromMonths.add(month)
        }
        if (safeArtistLabel(record) === toLabel) {
          toMonths.add(month)
        }
      }
      const overlap = [...fromMonths].filter((month) => toMonths.has(month)).length
      const rarityScore = round(1 / count + (overlap === 0 ? 0.5 : 0), 3)
      return { fromLabel: fromLabel || 'Unknown', toLabel: toLabel || 'Unknown', count, rarityScore }
    })
    .sort((a, b) => b.rarityScore - a.rarityScore || a.count - b.count)
    .slice(0, 8)

  const openerMap = new Map<string, number>()
  const closerMap = new Map<string, number>()
  for (const session of snapshot.sessions) {
    if (session.tracks.length === 0) {
      continue
    }
    openerMap.set(session.tracks[0], (openerMap.get(session.tracks[0]) ?? 0) + 1)
    const last = session.tracks[session.tracks.length - 1]
    closerMap.set(last, (closerMap.get(last) ?? 0) + 1)
  }

  const payload: SequenceMotifsPayload = {
    motifs,
    surpriseJumps: rareTransitions,
    sessionOpeners: topShareList(openerMap, snapshot.sessions.length, 8),
    sessionClosers: topShareList(closerMap, snapshot.sessions.length, 8),
  }

  const confidence = confidenceFromValue(
    Math.min(0.95, (snapshot.sessions.length / 120) * 0.6 + (motifs.length / 10) * 0.4),
    [
      `${snapshot.sessions.length} sessions analyzed`,
      `${motifs.length} repeated motifs retained`,
      'Descriptive heuristic over session-local windows (length 2-3).',
    ],
  )

  return readyResult({
    moduleId: 'sequence-motifs',
    startedAt,
    payload,
    confidence,
    sourceFields: ['records', 'sessions', 'timezoneMode'],
    method: 'descriptive heuristic motif mining over session-local windows',
    assumptions: [
      'Session boundaries reconstructed by core pipeline are sufficiently aligned with user listening sessions.',
      'Motifs are limited to short windows (2-3) for performance and readability in Train A.',
    ],
    warnings: motifs.length === 0 ? ['No repeated motifs met minimum recurrence threshold.'] : [],
    message: motifs.length > 0 ? `Detected ${motifs.length} recurring motifs.` : 'No recurring motifs detected above threshold.',
  })
}

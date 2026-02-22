import { normalizePlatform } from './platform'
import type { SessionData, StreamRecord } from './types'

interface SessionAccumulator {
  id: string
  startTime: string
  endTime: string
  trackCount: number
  totalMs: number
  tracks: string[]
  platformCount: Map<SessionData['platform'], number>
}

function finalizeSession(accumulator: SessionAccumulator): SessionData {
  const platform =
    [...accumulator.platformCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other'

  return {
    id: accumulator.id,
    startTime: accumulator.startTime,
    endTime: accumulator.endTime,
    trackCount: accumulator.trackCount,
    totalMs: accumulator.totalMs,
    platform,
    tracks: accumulator.tracks,
  }
}

export function reconstructSessions(
  records: StreamRecord[],
  gapMinutes = 30,
): SessionData[] {
  if (records.length === 0) {
    return []
  }

  const sessions: SessionData[] = []
  const sorted = [...records].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  )
  const maxGapMs = gapMinutes * 60 * 1000

  let current: SessionAccumulator = {
    id: `session-${new Date(sorted[0].ts).getTime()}`,
    startTime: sorted[0].ts,
    endTime: sorted[0].ts,
    trackCount: 0,
    totalMs: 0,
    tracks: [],
    platformCount: new Map(),
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const record = sorted[index]
    const previous = sorted[index - 1]

    if (previous) {
      const gap = new Date(record.ts).getTime() - new Date(previous.ts).getTime()
      if (gap > maxGapMs) {
        sessions.push(finalizeSession(current))
        current = {
          id: `session-${new Date(record.ts).getTime()}`,
          startTime: record.ts,
          endTime: record.ts,
          trackCount: 0,
          totalMs: 0,
          tracks: [],
          platformCount: new Map(),
        }
      }
    }

    const platform = normalizePlatform(record.platform)
    current.endTime = record.ts
    current.trackCount += 1
    current.totalMs += record.ms_played
    current.platformCount.set(platform, (current.platformCount.get(platform) ?? 0) + 1)
    if (record.master_metadata_track_name) {
      current.tracks.push(record.master_metadata_track_name)
    }
  }

  sessions.push(finalizeSession(current))
  return sessions
}

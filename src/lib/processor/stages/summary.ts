import { differenceInCalendarDays } from 'date-fns'

import { getModeHour, getModeYear } from '@/lib/timezone'
import type {
  AlbumStats,
  ArtistStats,
  ProcessedDataSummary,
  SessionData,
  StreamRecord,
  TimeBucket,
  TimezoneMode,
  TrackStats,
} from '@/lib/types'

function entropy(distribution: number[]): number {
  const total = distribution.reduce((sum, value) => sum + value, 0)
  if (total === 0) {
    return 0
  }
  const h = distribution.reduce((sum, count) => {
    const p = count / total
    if (p <= 0) {
      return sum
    }
    return sum - p * Math.log2(p)
  }, 0)
  return h / Math.log2(Math.max(2, distribution.length))
}

export function computeLongestStreak(daily: TimeBucket[]): number {
  if (daily.length === 0) {
    return 0
  }
  let longest = 1
  let current = 1
  for (let index = 1; index < daily.length; index += 1) {
    const prev = new Date(daily[index - 1].date)
    const curr = new Date(daily[index].date)
    const diff = differenceInCalendarDays(curr, prev)
    if (diff === 1) {
      current += 1
      if (current > longest) {
        longest = current
      }
    } else {
      current = 1
    }
  }
  return longest
}

export function computeSummary(
  records: StreamRecord[],
  artists: ArtistStats[],
  tracks: TrackStats[],
  albums: AlbumStats[],
  daily: TimeBucket[],
  sessions: SessionData[],
  timezoneMode: TimezoneMode = 'local',
): ProcessedDataSummary {
  const totalMs = records.reduce((sum, record) => sum + record.ms_played, 0)
  const totalPlays = records.length
  const skipRate = records.filter((record) => record.skipped).length / Math.max(1, totalPlays)
  const shuffleRate = records.filter((record) => record.shuffle).length / Math.max(1, totalPlays)
  const hourCounts = Array.from({ length: 24 }, () => 0)
  for (const record of records) {
    hourCounts[getModeHour(new Date(record.ts), timezoneMode)] += 1
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))
  const nocturnalPlays =
    hourCounts.slice(22).reduce((a, b) => a + b, 0) + hourCounts.slice(0, 4).reduce((a, b) => a + b, 0)
  const topTrackPlayCount = tracks[0]?.plays ?? 0
  const top10ArtistPlays = artists.slice(0, 10).reduce((sum, artist) => sum + artist.plays, 0)
  const top20ArtistPlays = artists.slice(0, 20).reduce((sum, artist) => sum + artist.plays, 0)
  const yearsCovered =
    records.length > 0
      ? getModeYear(new Date(records[records.length - 1].ts), timezoneMode) -
        getModeYear(new Date(records[0].ts), timezoneMode) +
        1
      : 0

  let bingeRuns = 0
  let runLength = 1
  for (let index = 1; index < records.length; index += 1) {
    const current = records[index].master_metadata_track_name
    const previous = records[index - 1].master_metadata_track_name
    if (current && previous && current === previous) {
      runLength += 1
      if (runLength >= 3) {
        bingeRuns += 1
      }
    } else {
      runLength = 1
    }
  }

  return {
    totalMs,
    totalPlays,
    totalHours: totalMs / 1000 / 60 / 60,
    uniqueArtists: artists.length,
    uniqueTracks: tracks.length,
    uniqueAlbums: albums.length,
    firstListen: records[0]?.ts ?? '',
    lastListen: records[records.length - 1]?.ts ?? '',
    skipRate,
    shuffleRate,
    peakHour,
    nocturnalShare: nocturnalPlays / Math.max(1, totalPlays),
    longestStreakDays: computeLongestStreak(daily),
    topTrackPlayCount,
    top10ArtistShare: top10ArtistPlays / Math.max(1, totalPlays),
    top20ArtistShare: top20ArtistPlays / Math.max(1, totalPlays),
    bingeFactor: bingeRuns / Math.max(1, totalPlays),
    eclecticism: entropy(artists.slice(0, 500).map((artist) => artist.plays)),
    yearsCovered,
    sessionDepthAvg:
      sessions.reduce((sum, session) => sum + session.trackCount, 0) /
      Math.max(1, sessions.length),
  }
}

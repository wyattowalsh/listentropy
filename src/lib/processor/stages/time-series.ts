import { WEEK_DAYS } from '@/lib/constants'
import {
  getModeDay,
  getModeHour,
  getModeYear,
  toModeDateKey,
  toModeIsoWeekKey,
  toModeMonthKey,
} from '@/lib/timezone'
import type { StreamRecord, TimeBucket, TimezoneMode } from '@/lib/types'

export function buildTimeBuckets(
  records: StreamRecord[],
  granularity: 'year' | 'month' | 'week' | 'day',
  timezoneMode: TimezoneMode = 'local',
): TimeBucket[] {
  const buckets = new Map<
    string,
    {
      date: string
      plays: number
      totalMs: number
      artists: Set<string>
    }
  >()

  for (const record of records) {
    const date = new Date(record.ts)
    let key = ''
    if (granularity === 'year') {
      key = String(getModeYear(date, timezoneMode))
    } else if (granularity === 'month') {
      key = toModeMonthKey(date, timezoneMode)
    } else if (granularity === 'week') {
      key = toModeIsoWeekKey(date, timezoneMode)
    } else {
      key = toModeDateKey(date, timezoneMode)
    }
    if (!buckets.has(key)) {
      buckets.set(key, {
        date: key,
        plays: 0,
        totalMs: 0,
        artists: new Set(),
      })
    }
    const bucket = buckets.get(key)!
    bucket.plays += 1
    bucket.totalMs += record.ms_played
    if (record.master_metadata_album_artist_name) {
      bucket.artists.add(record.master_metadata_album_artist_name)
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      key,
      date: value.date,
      plays: value.plays,
      totalMs: value.totalMs,
      uniqueArtists: value.artists.size,
    }))
}

export function buildHourDistribution(records: StreamRecord[]): Array<{ hour: number; plays: number; totalMs: number }> {
  return buildHourDistributionByTimezone(records, 'utc')
}

export function buildHourDistributionByTimezone(
  records: StreamRecord[],
  timezoneMode: TimezoneMode = 'local',
): Array<{ hour: number; plays: number; totalMs: number }> {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: 0,
    totalMs: 0,
  }))
  for (const record of records) {
    const hour = getModeHour(new Date(record.ts), timezoneMode)
    hours[hour].plays += 1
    hours[hour].totalMs += record.ms_played
  }
  return hours
}

export function buildWeekdayDistribution(
  records: StreamRecord[],
  timezoneMode: TimezoneMode = 'local',
): Array<{ day: string; plays: number; totalMs: number }> {
  const buckets = WEEK_DAYS.map((day) => ({ day, plays: 0, totalMs: 0 }))
  for (const record of records) {
    const day = (getModeDay(new Date(record.ts), timezoneMode) + 6) % 7
    buckets[day].plays += 1
    buckets[day].totalMs += record.ms_played
  }
  return buckets
}

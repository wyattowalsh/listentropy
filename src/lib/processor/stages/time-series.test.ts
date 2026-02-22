import { describe, expect, it } from 'vitest'

import {
  buildHourDistributionByTimezone,
  buildTimeBuckets,
  buildWeekdayDistribution,
} from './time-series'
import type { StreamRecord } from '@/lib/types'

function record(ts: string, artist = 'Artist A'): StreamRecord {
  return {
    ts,
    platform: 'ios',
    ms_played: 180000,
    conn_country: 'US',
    master_metadata_track_name: 'Track',
    master_metadata_album_artist_name: artist,
    master_metadata_album_album_name: 'Album',
    spotify_track_uri: 'spotify:track:abc',
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: 'playbtn',
    reason_end: 'trackdone',
    shuffle: false,
    skipped: false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
  }
}

describe('time-series stage', () => {
  it('builds sorted day/month/year buckets with unique artist counts', () => {
    const records = [
      record('2024-03-03T10:00:00Z', 'Artist A'),
      record('2024-03-01T11:00:00Z', 'Artist B'),
      record('2024-03-01T12:00:00Z', 'Artist A'),
    ]

    const daily = buildTimeBuckets(records, 'day')
    const monthly = buildTimeBuckets(records, 'month')
    const yearly = buildTimeBuckets(records, 'year')

    expect(daily.map((item) => item.key)).toEqual(['2024-03-01', '2024-03-03'])
    expect(daily[0]?.uniqueArtists).toBe(2)
    expect(monthly).toHaveLength(1)
    expect(monthly[0]?.key).toBe('2024-03')
    expect(yearly).toHaveLength(1)
    expect(yearly[0]?.key).toBe('2024')
  })

  it('computes hour and weekday distributions for a selected timezone mode', () => {
    const records = [
      record('2024-03-04T01:00:00Z'), // Monday
      record('2024-03-04T01:30:00Z'),
      record('2024-03-05T12:00:00Z'), // Tuesday
    ]

    const hours = buildHourDistributionByTimezone(records, 'utc')
    const weekdays = buildWeekdayDistribution(records, 'utc')

    expect(hours[1]?.plays).toBe(2)
    expect(hours[12]?.plays).toBe(1)
    expect(weekdays.find((item) => item.day === 'Mon')?.plays).toBe(2)
    expect(weekdays.find((item) => item.day === 'Tue')?.plays).toBe(1)
  })

  it('uses ISO week-year keys for weekly buckets', () => {
    const records = [
      record('2020-12-31T23:00:00Z', 'Artist A'),
      record('2021-01-01T01:00:00Z', 'Artist B'),
      record('2021-01-08T01:00:00Z', 'Artist B'),
    ]
    const weekly = buildTimeBuckets(records, 'week', 'utc')
    expect(weekly.map((item) => item.key)).toEqual(['2020-W53', '2021-W01'])
  })

  it('uses true UTC clock math around DST boundaries in utc mode', () => {
    const records = [
      record('2024-03-10T09:30:00Z'), // DST spring-forward boundary in many local zones
      record('2024-11-03T08:30:00Z'), // DST fall-back boundary in many local zones
    ]

    const hours = buildHourDistributionByTimezone(records, 'utc')

    expect(hours[9]?.plays).toBe(1)
    expect(hours[8]?.plays).toBe(1)
  })
})

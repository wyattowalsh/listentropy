import { describe, expect, it } from 'vitest'

import { computeLongestStreak, computeSummary } from './summary'
import type {
  AlbumStats,
  ArtistStats,
  SessionData,
  StreamRecord,
  TimeBucket,
  TrackStats,
} from '@/lib/types'

function record(ts: string, track: string, artist: string, options?: { skipped?: boolean; shuffle?: boolean }): StreamRecord {
  return {
    ts,
    platform: 'ios',
    ms_played: 180000,
    conn_country: 'US',
    master_metadata_track_name: track,
    master_metadata_album_artist_name: artist,
    master_metadata_album_album_name: `${artist} Album`,
    spotify_track_uri: `spotify:track:${track}`,
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: 'playbtn',
    reason_end: 'trackdone',
    shuffle: options?.shuffle ?? false,
    skipped: options?.skipped ?? false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
  }
}

describe('summary stage', () => {
  it('computes longest streak from consecutive daily buckets', () => {
    const daily: TimeBucket[] = [
      { key: '2024-01-01', date: '2024-01-01', plays: 1, totalMs: 1000, uniqueArtists: 1 },
      { key: '2024-01-02', date: '2024-01-02', plays: 2, totalMs: 2000, uniqueArtists: 1 },
      { key: '2024-01-03', date: '2024-01-03', plays: 3, totalMs: 3000, uniqueArtists: 2 },
      { key: '2024-01-07', date: '2024-01-07', plays: 1, totalMs: 500, uniqueArtists: 1 },
    ]

    expect(computeLongestStreak(daily)).toBe(3)
  })

  it('computes summary with skip, shuffle, and concentration metrics', () => {
    const records: StreamRecord[] = [
      record('2024-01-01T23:00:00Z', 'Track A', 'Artist A', { shuffle: true }),
      record('2024-01-01T23:04:00Z', 'Track A', 'Artist A', { skipped: true }),
      record('2024-01-02T23:08:00Z', 'Track A', 'Artist A'),
      record('2024-01-03T06:08:00Z', 'Track B', 'Artist B'),
    ]

    const artists: ArtistStats[] = [
      {
        key: 'Artist A',
        name: 'Artist A',
        plays: 3,
        totalMs: 540000,
        hours: 0.15,
        firstListen: '2024-01-01T23:00:00Z',
        lastListen: '2024-01-02T23:08:00Z',
        skipRate: 1 / 3,
      },
      {
        key: 'Artist B',
        name: 'Artist B',
        plays: 1,
        totalMs: 180000,
        hours: 0.05,
        firstListen: '2024-01-03T06:08:00Z',
        lastListen: '2024-01-03T06:08:00Z',
        skipRate: 0,
      },
    ]

    const tracks: TrackStats[] = [
      {
        key: 'Track A::Artist A',
        name: 'Track A',
        artist: 'Artist A',
        plays: 3,
        totalMs: 540000,
        hours: 0.15,
        firstListen: '2024-01-01T23:00:00Z',
        lastListen: '2024-01-02T23:08:00Z',
        skipRate: 1 / 3,
      },
      {
        key: 'Track B::Artist B',
        name: 'Track B',
        artist: 'Artist B',
        plays: 1,
        totalMs: 180000,
        hours: 0.05,
        firstListen: '2024-01-03T06:08:00Z',
        lastListen: '2024-01-03T06:08:00Z',
        skipRate: 0,
      },
    ]

    const albums: AlbumStats[] = [
      {
        key: 'Album A::Artist A',
        name: 'Album A',
        artist: 'Artist A',
        plays: 3,
        totalMs: 540000,
        hours: 0.15,
        firstListen: '2024-01-01T23:00:00Z',
        lastListen: '2024-01-02T23:08:00Z',
      },
      {
        key: 'Album B::Artist B',
        name: 'Album B',
        artist: 'Artist B',
        plays: 1,
        totalMs: 180000,
        hours: 0.05,
        firstListen: '2024-01-03T06:08:00Z',
        lastListen: '2024-01-03T06:08:00Z',
      },
    ]

    const daily: TimeBucket[] = [
      { key: '2024-01-01', date: '2024-01-01', plays: 2, totalMs: 360000, uniqueArtists: 1 },
      { key: '2024-01-02', date: '2024-01-02', plays: 1, totalMs: 180000, uniqueArtists: 1 },
      { key: '2024-01-03', date: '2024-01-03', plays: 1, totalMs: 180000, uniqueArtists: 1 },
    ]

    const sessions: SessionData[] = [
      {
        id: 's1',
        startTime: '2024-01-01T23:00:00Z',
        endTime: '2024-01-01T23:08:00Z',
        trackCount: 2,
        totalMs: 360000,
        platform: 'iOS',
        tracks: ['Track A', 'Track A'],
      },
      {
        id: 's2',
        startTime: '2024-01-02T23:08:00Z',
        endTime: '2024-01-03T06:08:00Z',
        trackCount: 2,
        totalMs: 360000,
        platform: 'iOS',
        tracks: ['Track A', 'Track B'],
      },
    ]

    const summary = computeSummary(records, artists, tracks, albums, daily, sessions, 'utc')

    expect(summary.totalPlays).toBe(4)
    expect(summary.skipRate).toBeCloseTo(0.25)
    expect(summary.shuffleRate).toBeCloseTo(0.25)
    expect(summary.topTrackPlayCount).toBe(3)
    expect(summary.top10ArtistShare).toBeCloseTo(1)
    expect(summary.longestStreakDays).toBe(3)
    expect(summary.sessionDepthAvg).toBeCloseTo(2)
  })

  it('computes UTC peak hour correctly across DST boundaries', () => {
    const records: StreamRecord[] = [
      record('2024-03-10T09:30:00Z', 'Track A', 'Artist A'),
      record('2024-03-10T09:45:00Z', 'Track B', 'Artist B'),
      record('2024-11-03T08:30:00Z', 'Track C', 'Artist C'),
    ]

    const artists: ArtistStats[] = [
      {
        key: 'Artist A',
        name: 'Artist A',
        plays: 1,
        totalMs: 180000,
        hours: 0.05,
        firstListen: records[0].ts,
        lastListen: records[0].ts,
        skipRate: 0,
      },
      {
        key: 'Artist B',
        name: 'Artist B',
        plays: 1,
        totalMs: 180000,
        hours: 0.05,
        firstListen: records[1].ts,
        lastListen: records[1].ts,
        skipRate: 0,
      },
      {
        key: 'Artist C',
        name: 'Artist C',
        plays: 1,
        totalMs: 180000,
        hours: 0.05,
        firstListen: records[2].ts,
        lastListen: records[2].ts,
        skipRate: 0,
      },
    ]
    const tracks: TrackStats[] = artists.map((artist, index) => ({
      key: `Track ${index}::${artist.name}`,
      name: `Track ${index}`,
      artist: artist.name,
      plays: 1,
      totalMs: 180000,
      hours: 0.05,
      firstListen: records[index].ts,
      lastListen: records[index].ts,
      skipRate: 0,
    }))
    const albums: AlbumStats[] = artists.map((artist, index) => ({
      key: `Album ${index}::${artist.name}`,
      name: `Album ${index}`,
      artist: artist.name,
      plays: 1,
      totalMs: 180000,
      hours: 0.05,
      firstListen: records[index].ts,
      lastListen: records[index].ts,
    }))
    const daily: TimeBucket[] = [
      { key: '2024-03-10', date: '2024-03-10', plays: 2, totalMs: 360000, uniqueArtists: 2 },
      { key: '2024-11-03', date: '2024-11-03', plays: 1, totalMs: 180000, uniqueArtists: 1 },
    ]
    const sessions: SessionData[] = [
      {
        id: 's1',
        startTime: records[0].ts,
        endTime: records[1].ts,
        trackCount: 2,
        totalMs: 360000,
        platform: 'iOS',
        tracks: ['Track 0', 'Track 1'],
      },
      {
        id: 's2',
        startTime: records[2].ts,
        endTime: records[2].ts,
        trackCount: 1,
        totalMs: 180000,
        platform: 'iOS',
        tracks: ['Track 2'],
      },
    ]

    const summary = computeSummary(records, artists, tracks, albums, daily, sessions, 'utc')
    expect(summary.peakHour).toBe(9)
  })
})

import { describe, expect, it } from 'vitest'

import { processRecords } from './processor'
import type { StreamRecord } from './types'

function record(input: Partial<StreamRecord> & { ts: string }): StreamRecord {
  return {
    ts: input.ts,
    platform: input.platform ?? 'ios',
    ms_played: input.ms_played ?? 180000,
    conn_country: input.conn_country ?? 'US',
    master_metadata_track_name: input.master_metadata_track_name ?? 'Track',
    master_metadata_album_artist_name: input.master_metadata_album_artist_name ?? 'Artist',
    master_metadata_album_album_name: input.master_metadata_album_album_name ?? 'Album',
    spotify_track_uri: input.spotify_track_uri ?? 'spotify:track:1',
    episode_name: input.episode_name ?? null,
    episode_show_name: input.episode_show_name ?? null,
    spotify_episode_uri: input.spotify_episode_uri ?? null,
    audiobook_title: input.audiobook_title ?? null,
    audiobook_uri: input.audiobook_uri ?? null,
    audiobook_chapter_uri: input.audiobook_chapter_uri ?? null,
    audiobook_chapter_title: input.audiobook_chapter_title ?? null,
    reason_start: input.reason_start ?? 'playbtn',
    reason_end: input.reason_end ?? 'trackdone',
    shuffle: input.shuffle ?? false,
    skipped: input.skipped ?? false,
    offline: input.offline ?? false,
    offline_timestamp: input.offline_timestamp ?? null,
    incognito_mode: input.incognito_mode ?? false,
    content_type: input.content_type ?? 'music',
  }
}

describe('context analytics', () => {
  it('computes country, reason, offline/privacy, and device journey metrics', () => {
    const records: StreamRecord[] = [
      record({
        ts: '2024-01-01T00:00:00Z',
        conn_country: 'US',
        reason_start: 'playbtn',
        reason_end: 'trackdone',
        platform: 'ios',
      }),
      record({
        ts: '2024-01-01T00:05:00Z',
        conn_country: 'US',
        reason_start: 'playbtn',
        reason_end: 'fwdbtn',
        platform: 'ios',
      }),
      record({
        ts: '2024-01-01T02:00:00Z',
        conn_country: 'CA',
        reason_start: 'clickrow',
        reason_end: 'trackdone',
        platform: 'osx',
        offline: true,
        offline_timestamp: 1234,
        incognito_mode: true,
      }),
      record({
        ts: '2024-01-02T06:00:00Z',
        conn_country: 'US',
        reason_start: 'clickrow',
        reason_end: 'trackdone',
        platform: 'web_player osx',
        offline: true,
        offline_timestamp: null,
      }),
      record({
        ts: '2024-01-02T07:00:00Z',
        conn_country: 'US',
        reason_start: 'remote',
        reason_end: 'endplay',
        platform: 'xbox',
      }),
    ]

    const processed = processRecords(records, { timezoneMode: 'utc' })
    const context = processed.contextAnalytics

    expect(context.country.homeCountry).toBe('US')
    expect(context.country.topCountries[0]?.country).toBe('US')
    expect(context.country.topCountries[0]?.plays).toBe(4)
    expect(context.reasons.transitions[0]?.from).toBe('clickrow')
    expect(context.offlinePrivacy.offlineRate).toBeCloseTo(0.4)
    expect(context.offlinePrivacy.incognitoRate).toBeCloseTo(0.2)
    expect(context.offlinePrivacy.inconsistentOfflineTimestampCount).toBe(1)
    expect(context.deviceJourney.transitions.length).toBeGreaterThan(0)
    expect(context.sessionDayparts.transitions.length).toBeGreaterThanOrEqual(0)
    expect(context.intentPersistence.longestReasonStartStreak).not.toBeNull()
    expect(context.countryVolatilityIndex).toBeGreaterThanOrEqual(0)
  })
})

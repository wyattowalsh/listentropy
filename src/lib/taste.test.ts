import { describe, expect, it } from 'vitest'

import { buildTasteProfile } from './taste'
import type { ProcessedDataSummary, StreamRecord } from './types'

const summary: ProcessedDataSummary = {
  totalMs: 10_000_000,
  totalPlays: 100,
  totalHours: 2500,
  uniqueArtists: 1200,
  uniqueTracks: 4000,
  uniqueAlbums: 600,
  firstListen: '2018-01-01T00:00:00Z',
  lastListen: '2026-01-01T00:00:00Z',
  skipRate: 0.2,
  shuffleRate: 0.65,
  peakHour: 23,
  nocturnalShare: 0.45,
  longestStreakDays: 18,
  topTrackPlayCount: 250,
  top10ArtistShare: 0.42,
  top20ArtistShare: 0.61,
  bingeFactor: 0.12,
  eclecticism: 0.82,
  yearsCovered: 9,
  sessionDepthAvg: 6,
}

function record(ts: string, options?: { shuffle?: boolean; skipped?: boolean; artist?: string }): StreamRecord {
  return {
    ts,
    platform: 'ios',
    ms_played: 180000,
    conn_country: 'US',
    master_metadata_track_name: 'Track',
    master_metadata_album_artist_name: options?.artist ?? 'Artist A',
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
    shuffle: options?.shuffle ?? false,
    skipped: options?.skipped ?? false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
  }
}

describe('buildTasteProfile', () => {
  it('builds base dimensions and yearly fingerprints with normalized scores', () => {
    const records: StreamRecord[] = [
      record('2024-01-01T00:00:00Z', { artist: 'Artist A', shuffle: true }),
      record('2024-03-01T00:00:00Z', { artist: 'Artist B', skipped: true }),
      record('2025-01-01T00:00:00Z', { artist: 'Artist C' }),
      record('2025-06-01T00:00:00Z', { artist: 'Artist D', shuffle: true }),
    ]

    const profile = buildTasteProfile(summary, records)

    expect(profile.dimensions).toHaveLength(10)
    expect(profile.dimensions.every((entry) => entry.score >= 0 && entry.score <= 1)).toBe(true)

    expect(profile.yearlyFingerprints).toHaveLength(2)
    expect(profile.yearlyFingerprints[0]?.year).toBe('2024')
    expect(profile.yearlyFingerprints[1]?.year).toBe('2025')
    expect(profile.yearlyFingerprints[0]?.dimensions).toHaveLength(10)
  })
})

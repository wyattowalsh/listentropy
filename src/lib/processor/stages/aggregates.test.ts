import { describe, expect, it } from 'vitest'

import { buildAlbumStats, buildArtistStats, buildTrackStats } from './aggregates'
import type { StreamRecord } from '@/lib/types'

function record(options: {
  ts: string
  artist: string | null
  track: string | null
  album: string | null
  msPlayed?: number
  skipped?: boolean
}): StreamRecord {
  return {
    ts: options.ts,
    platform: 'ios',
    ms_played: options.msPlayed ?? 180000,
    conn_country: 'US',
    master_metadata_track_name: options.track,
    master_metadata_album_artist_name: options.artist,
    master_metadata_album_album_name: options.album,
    spotify_track_uri: options.track ? `spotify:track:${options.track}` : null,
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
    skipped: options.skipped ?? false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
  }
}

describe('aggregate stages', () => {
  it('builds artist, track, and album stats with skip/first/last metadata', () => {
    const records = [
      record({ ts: '2024-01-01T00:00:00Z', artist: 'Artist A', track: 'Track A', album: 'Album A' }),
      record({ ts: '2024-01-01T01:00:00Z', artist: 'Artist A', track: 'Track A', album: 'Album A', skipped: true }),
      record({ ts: '2024-01-02T00:00:00Z', artist: 'Artist B', track: 'Track B', album: 'Album B', msPlayed: 240000 }),
      record({ ts: '2024-01-03T00:00:00Z', artist: null, track: null, album: null }),
    ]

    const artists = buildArtistStats(records)
    const tracks = buildTrackStats(records)
    const albums = buildAlbumStats(records)

    expect(artists).toHaveLength(2)
    expect(artists[0]?.name).toBe('Artist A')
    expect(artists[0]?.skipRate).toBeCloseTo(0.5)
    expect(artists[0]?.firstListen).toBe('2024-01-01T00:00:00Z')
    expect(artists[0]?.lastListen).toBe('2024-01-01T01:00:00Z')

    expect(tracks).toHaveLength(2)
    expect(tracks[0]?.key).toBe('Track A::Artist A')

    expect(albums).toHaveLength(2)
    expect(albums[0]?.key).toBe('Album A::Artist A')
  })
})

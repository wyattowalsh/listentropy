import { describe, expect, it } from 'vitest'

import type { StreamRecord } from './types'
import { reconstructSessions } from './sessions'

function makeRecord(
  ts: string,
  msPlayed: number,
  platform = 'ios',
  track = 'Track',
): StreamRecord {
  return {
    ts,
    platform,
    ms_played: msPlayed,
    conn_country: 'US',
    master_metadata_track_name: track,
    master_metadata_album_artist_name: 'Artist',
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

describe('reconstructSessions', () => {
  it('groups plays within the threshold into one session', () => {
    const records = [
      makeRecord('2024-01-01T10:00:00Z', 180000),
      makeRecord('2024-01-01T10:10:00Z', 200000),
      makeRecord('2024-01-01T10:30:00Z', 120000),
    ]

    const sessions = reconstructSessions(records, 30)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.trackCount).toBe(3)
    expect(sessions[0]?.totalMs).toBe(500000)
  })

  it('splits sessions when the threshold is exceeded', () => {
    const records = [
      makeRecord('2024-01-01T10:00:00Z', 180000),
      makeRecord('2024-01-01T10:10:00Z', 200000),
      makeRecord('2024-01-01T11:00:00Z', 120000),
    ]

    const sessions = reconstructSessions(records, 30)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.trackCount).toBe(2)
    expect(sessions[1]?.trackCount).toBe(1)
  })

  it('does not split on exact threshold and uses dominant platform in a session', () => {
    const records = [
      makeRecord('2024-01-01T10:00:00Z', 180000, 'ios'),
      makeRecord('2024-01-01T10:30:00Z', 200000, 'osx'),
      makeRecord('2024-01-01T11:00:00Z', 120000, 'ios'),
    ]

    const sessions = reconstructSessions(records, 30)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.platform).toBe('iOS')
  })
})

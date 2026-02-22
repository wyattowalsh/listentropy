import { describe, expect, it, vi } from 'vitest'

import { computeForgottenGems } from './gems'
import type { StreamRecord } from './types'

function record(ts: string, track: string, artist: string): StreamRecord {
  return {
    ts,
    platform: 'ios',
    ms_played: 190000,
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
    shuffle: false,
    skipped: false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
  }
}

describe('computeForgottenGems', () => {
  it('finds a loved-then-abandoned track', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'))

    const oldPlays = Array.from({ length: 12 }, (_, index) =>
      record(`2021-03-${String(index + 1).padStart(2, '0')}T00:00:00Z`, 'Anthem', 'Artist X'),
    )
    const recentPlay = record('2023-01-02T00:00:00Z', 'Anthem', 'Artist X')
    const control = Array.from({ length: 15 }, (_, index) =>
      record(`2025-12-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`, 'Fresh', 'Artist Y'),
    )

    const gems = computeForgottenGems([...oldPlays, recentPlay, ...control])
    expect(gems[0]?.track).toBe('Anthem')

    vi.useRealTimers()
  })
})

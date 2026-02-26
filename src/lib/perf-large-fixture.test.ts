import { describe, expect, it } from 'vitest'

import { processRecords } from './processor'
import type { StreamRecord } from './types'

function makeRecord(index: number): StreamRecord {
  return {
    ts: new Date(Date.parse('2020-01-01T00:00:00Z') + index * 60_000).toISOString(),
    platform: index % 2 === 0 ? 'ios' : 'osx',
    ms_played: 120000 + (index % 10) * 5000,
    conn_country: index % 11 === 0 ? 'CA' : 'US',
    master_metadata_track_name: `Track ${index % 500}`,
    master_metadata_album_artist_name: `Artist ${index % 120}`,
    master_metadata_album_album_name: `Album ${index % 240}`,
    spotify_track_uri: `spotify:track:${index % 500}`,
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: index % 5 === 0 ? 'clickrow' : 'playbtn',
    reason_end: index % 8 === 0 ? 'fwdbtn' : 'trackdone',
    shuffle: index % 3 === 0,
    skipped: index % 8 === 0,
    offline: index % 20 === 0,
    offline_timestamp: index % 20 === 0 ? Date.now() : null,
    incognito_mode: index % 50 === 0,
    content_type: 'music',
  }
}

describe('large fixture perf benchmark (local)', () => {
  it(
    'measures process + timezone toggle latency on a large synthetic dataset',
    () => {
    const records = Array.from({ length: 50_000 }, (_, index) => makeRecord(index))

    const startLocal = performance.now()
    const local = processRecords(records, { timezoneMode: 'local' })
    const localMs = performance.now() - startLocal

    const startUtc = performance.now()
    const utc = processRecords(records, { timezoneMode: 'utc' })
    const utcMs = performance.now() - startUtc

    console.log(
      `[perf-large-fixture] local=${localMs.toFixed(1)}ms utc-toggle=${utcMs.toFixed(1)}ms records=${records.length.toLocaleString()}`,
    )

    expect(local.summary.totalPlays).toBe(records.length)
    expect(utc.summary.totalPlays).toBe(records.length)
    },
    180_000,
  )
})

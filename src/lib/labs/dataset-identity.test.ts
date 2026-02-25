import { describe, expect, it } from 'vitest'

import type { StreamRecord } from '@/lib/types'
import { buildDatasetFingerprint } from '@/lib/labs/dataset-identity'

function makeRecord(overrides: Partial<StreamRecord> = {}): StreamRecord {
  return {
    ts: '2024-01-01T23:30:00Z',
    platform: 'iOS 17.1 (iPhone14,2)',
    ms_played: 180000,
    conn_country: 'US',
    master_metadata_track_name: 'Track A',
    master_metadata_album_artist_name: 'Artist A',
    master_metadata_album_album_name: 'Album A',
    spotify_track_uri: 'spotify:track:1',
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: 'trackdone',
    reason_end: 'trackdone',
    shuffle: false,
    skipped: false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
    ...overrides,
  }
}

describe('dataset identity fingerprint', () => {
  it('is deterministic for identical records and timezone mode', () => {
    const records = [makeRecord(), makeRecord({ ts: '2024-01-02T00:30:00Z', spotify_track_uri: 'spotify:track:2', master_metadata_track_name: 'Track B' })]
    expect(buildDatasetFingerprint(records, 'local')).toBe(buildDatasetFingerprint(records, 'local'))
  })

  it('changes when timezone mode changes', () => {
    const records = [makeRecord()]
    expect(buildDatasetFingerprint(records, 'local')).not.toBe(buildDatasetFingerprint(records, 'utc'))
  })
})

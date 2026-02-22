import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { inspectSpotifyZipArchive, parseSpotifyZip, sanitizeRecord } from './parser'
import type { RawSpotifyRecord } from '../types'

const baseRecord: RawSpotifyRecord = {
  ts: '2024-10-25T21:19:42Z',
  platform: 'ios',
  ms_played: 200000,
  conn_country: 'US',
  ip_addr: '127.0.0.1',
  master_metadata_track_name: 'Track',
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
}

describe('sanitizeRecord', () => {
  it('strips ip_addr and infers content type', () => {
    const sanitized = sanitizeRecord(baseRecord)
    expect('ip_addr' in sanitized).toBe(false)
    expect(sanitized.content_type).toBe('music')
  })
})

describe('parseSpotifyZip', () => {
  it('parses multiple matching history files and sorts by ts', async () => {
    const zip = new JSZip()
    zip.file(
      'Streaming_History_Audio_2024-2025_0.json',
      JSON.stringify([{ ...baseRecord, ts: '2025-01-01T10:00:00Z' }]),
    )
    zip.file(
      'Streaming_History_Audio_2024-2025_1.json',
      JSON.stringify([{ ...baseRecord, ts: '2024-01-01T10:00:00Z' }]),
    )

    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'spotify.zip', { type: 'application/zip' })
    const parsed = await parseSpotifyZip(file)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.ts).toBe('2024-01-01T10:00:00Z')
    expect(parsed[1]?.ts).toBe('2025-01-01T10:00:00Z')
  })

  it('skips malformed entries and coerces null-heavy records safely', async () => {
    const zip = new JSZip()
    zip.file(
      'Streaming_History_Audio_2024-2025_0.json',
      JSON.stringify([
        { bad: true },
        {
          ts: '2024-02-01T00:00:00Z',
          platform: null,
          ms_played: '1200',
          conn_country: null,
          ip_addr: null,
          master_metadata_track_name: null,
          master_metadata_album_artist_name: null,
          master_metadata_album_album_name: null,
          spotify_track_uri: null,
          episode_name: 'Episode A',
          episode_show_name: null,
          spotify_episode_uri: 'spotify:episode:abc',
          audiobook_title: null,
          audiobook_uri: null,
          audiobook_chapter_uri: null,
          audiobook_chapter_title: null,
          reason_start: null,
          reason_end: null,
          shuffle: null,
          skipped: null,
          offline: null,
          offline_timestamp: null,
          incognito_mode: null,
        },
      ]),
    )

    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'spotify.zip', { type: 'application/zip' })
    const parsed = await parseSpotifyZip(file)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.platform).toBe('unknown')
    expect(parsed[0]?.ms_played).toBe(0)
    expect(parsed[0]?.content_type).toBe('podcast')
  })

  it('inspects zip history files for upload preflight', async () => {
    const zip = new JSZip()
    zip.file('README.txt', 'x')
    zip.file('Streaming_History_Audio_2024-2025_0.json', JSON.stringify([{ ...baseRecord }]))
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'spotify.zip', { type: 'application/zip' })

    const inspection = await inspectSpotifyZipArchive(file)
    expect(inspection.historyFileCount).toBe(1)
    expect(inspection.historyFiles[0]).toContain('Streaming_History_Audio')
    expect(inspection.totalEntries).toBe(2)
  })
})

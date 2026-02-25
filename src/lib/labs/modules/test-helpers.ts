import { processRecords } from '@/lib/processor'
import { buildDefaultLabDatasetSnapshot } from '@/lib/labs/registry'
import type { LabDatasetSnapshot, StreamRecord } from '@/lib/types'

function baseRecord(): StreamRecord {
  return {
    ts: '2024-01-01T08:00:00Z',
    platform: 'iOS 17.0',
    ms_played: 180000,
    conn_country: 'US',
    master_metadata_track_name: 'Track 0',
    master_metadata_album_artist_name: 'Artist 0',
    master_metadata_album_album_name: 'Album 0',
    spotify_track_uri: 'spotify:track:0',
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
  }
}

export function makeSyntheticRecords(recordCount = 240): StreamRecord[] {
  const start = new Date('2024-01-01T00:00:00Z').getTime()
  const records: StreamRecord[] = []
  for (let index = 0; index < recordCount; index += 1) {
    const monthOffsetDays = Math.floor(index / 20) * 30
    const sessionOffsetMinutes = (index % 5) * 4
    const gapMinutes = index % 20 === 0 ? 240 : 0
    const time = new Date(start + (monthOffsetDays * 24 * 60 + gapMinutes + sessionOffsetMinutes + index * 37) * 60_000)
    const artistNumber = (index + Math.floor(index / 7)) % 14
    const trackNumber = (index * 3) % 40
    const platform = ['iOS 17.0', 'Web Player', 'macOS 14', 'Android 14'][index % 4]
    const country = ['US', 'US', 'CA', 'GB'][index % 4]
    records.push({
      ...baseRecord(),
      ts: time.toISOString(),
      platform,
      conn_country: country,
      ms_played: 90_000 + (index % 6) * 45_000,
      master_metadata_track_name: `Track ${trackNumber}`,
      master_metadata_album_artist_name: `Artist ${artistNumber}`,
      master_metadata_album_album_name: `Album ${artistNumber % 6}`,
      spotify_track_uri: `spotify:track:${trackNumber}`,
      reason_start: index % 9 === 0 ? 'clickrow' : 'trackdone',
      reason_end: index % 11 === 0 ? 'fwdbtn' : 'trackdone',
      shuffle: index % 3 === 0,
      skipped: index % 7 === 0,
      offline: index % 10 === 0,
      offline_timestamp: index % 10 === 0 ? Date.parse(time.toISOString()) : null,
      incognito_mode: index % 16 === 0,
    })
  }
  return records.sort((a, b) => a.ts.localeCompare(b.ts))
}

export function makeSyntheticLabSnapshot(): LabDatasetSnapshot {
  const processed = processRecords(makeSyntheticRecords(), { timezoneMode: 'local' })
  return buildDefaultLabDatasetSnapshot(processed)
}

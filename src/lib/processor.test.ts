import { describe, expect, it } from 'vitest'

import { processRecords } from './processor'
import type { ParseProgress, StreamRecord } from './types'

function musicRecord(ts: string, artist: string, track: string): StreamRecord {
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
    shuffle: false,
    skipped: false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'music',
  }
}

function podcastRecord(ts: string): StreamRecord {
  return {
    ts,
    platform: 'web_player osx',
    ms_played: 210000,
    conn_country: 'US',
    master_metadata_track_name: null,
    master_metadata_album_artist_name: null,
    master_metadata_album_album_name: null,
    spotify_track_uri: null,
    episode_name: 'Episode 1',
    episode_show_name: 'Show',
    spotify_episode_uri: 'spotify:episode:1',
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: 'playbtn',
    reason_end: 'trackdone',
    shuffle: true,
    skipped: true,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
    content_type: 'podcast',
  }
}

describe('processRecords', () => {
  it('builds diagnostics, provenance, and emits deterministic stage progress', () => {
    const records = [
      musicRecord('2024-01-01T00:00:00Z', 'Artist A', 'Track A'),
      musicRecord('2024-01-01T00:10:00Z', 'Artist A', 'Track A'),
      musicRecord('2024-01-01T00:30:00Z', 'Artist B', 'Track B'),
      podcastRecord('2024-01-01T01:00:00Z'),
    ]

    const progressEvents: ParseProgress[] = []
    const processed = processRecords(records, {
      timezoneMode: 'utc',
      onProgress(progress) {
        progressEvents.push(progress)
      },
    })

    expect(processed.diagnostics.inputRecords).toBe(4)
    expect(processed.diagnostics.contentMix.music).toBe(3)
    expect(processed.diagnostics.contentMix.podcast).toBe(1)
    expect(processed.diagnostics.contentMix.audiobook).toBe(0)

    const stages = processed.stageProvenance.map((item) => item.stage)
    expect(stages).toEqual([
      'artists',
      'tracks',
      'albums',
      'time-series',
      'sessions',
      'summary',
      'taste',
      'archetypes',
      'platform',
      'graph',
      'gems',
      'eras',
      'skip',
      'context',
    ])

    expect(progressEvents.at(0)?.stage).toBe('aggregation')
    expect(progressEvents.some((event) => event.stage === 'graph')).toBe(true)
    expect(progressEvents.at(-1)?.stage).toBe('context')
    expect(progressEvents.some((event) => event.stage === 'context')).toBe(true)

    expect(processed.quickInsights).toHaveLength(5)
    expect(processed.graph.nodes.length).toBeGreaterThan(0)
    expect(processed.timezoneMode).toBe('utc')
    expect(processed.monthlyBehavior.length).toBeGreaterThan(0)
    expect(processed.contextAnalytics.country.topCountries.length).toBeGreaterThan(0)
    expect(Object.keys(processed.trackUriIndex).length).toBeGreaterThan(0)
    expect(processed.dataQuality.missingTrackUriRate).toBeGreaterThanOrEqual(0)
    expect(processed.narrativeInsights.length).toBeGreaterThan(0)
    expect(processed.sessionMetricsSnapshot.counts.upload_complete).toBe(1)
  })
})

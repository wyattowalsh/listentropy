import { describe, expect, it } from 'vitest'

import { computeEras } from './eras'
import type { StreamRecord } from './types'

function record(ts: string, artist: string, ms = 200000): StreamRecord {
  const safeTs = ts.replace('T00:00:00Z', 'T12:00:00Z')
  return {
    ts: safeTs,
    platform: 'ios',
    ms_played: ms,
    conn_country: 'US',
    master_metadata_track_name: `${artist} Track`,
    master_metadata_album_artist_name: artist,
    master_metadata_album_album_name: `${artist} Album`,
    spotify_track_uri: `spotify:track:${artist}`,
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

describe('computeEras', () => {
  it('creates a new era for strong dominance changes', () => {
    const records = [
      record('2024-01-10T00:00:00Z', 'Artist A', 400000),
      record('2024-01-12T00:00:00Z', 'Artist A', 380000),
      record('2024-02-10T00:00:00Z', 'Artist A', 390000),
      record('2024-03-01T00:00:00Z', 'Artist B', 500000),
      record('2024-03-05T00:00:00Z', 'Artist B', 520000),
      record('2024-04-04T00:00:00Z', 'Artist B', 510000),
    ]

    const eras = computeEras(records)
    expect(eras.length).toBeGreaterThanOrEqual(2)
    expect(eras[0]?.label).toContain('Artist A')
    expect(eras[eras.length - 1]?.label).toContain('Artist B')
    expect(eras[0]?.confidence).toBeGreaterThan(0)
    expect(eras[0]?.durationMonths).toBeGreaterThanOrEqual(1)
    expect(eras[0]?.changeDrivers.length).toBeGreaterThan(0)
  })

  it('keeps one era when dominance is weak', () => {
    const records = [
      record('2024-01-10T00:00:00Z', 'Artist A', 200000),
      record('2024-01-12T00:00:00Z', 'Artist B', 180000),
      record('2024-02-10T00:00:00Z', 'Artist A', 190000),
      record('2024-02-11T00:00:00Z', 'Artist B', 180000),
    ]

    const eras = computeEras(records)
    expect(eras).toHaveLength(1)
    expect(eras[0]?.diversityScore).toBeGreaterThan(0)
  })

  it('avoids thrash from a single noisy month between stable periods', () => {
    const records = [
      record('2024-01-10T00:00:00Z', 'Artist A', 450000),
      record('2024-02-10T00:00:00Z', 'Artist A', 420000),
      record('2024-03-10T00:00:00Z', 'Artist B', 410000),
      record('2024-03-12T00:00:00Z', 'Artist A', 390000),
      record('2024-04-10T00:00:00Z', 'Artist A', 430000),
      record('2024-05-10T00:00:00Z', 'Artist A', 440000),
    ]

    const eras = computeEras(records)
    expect(eras.length).toBeLessThanOrEqual(2)
    expect(eras[0]?.label).toContain('Artist A')
  })

  it('does not create a new era from a single mixed rebound month', () => {
    const records = [
      record('2024-01-10T00:00:00Z', 'Artist A', 520000),
      record('2024-02-10T00:00:00Z', 'Artist A', 500000),
      record('2024-03-10T00:00:00Z', 'Artist B', 310000),
      record('2024-03-12T00:00:00Z', 'Artist A', 300000),
      record('2024-04-10T00:00:00Z', 'Artist A', 540000),
      record('2024-05-10T00:00:00Z', 'Artist A', 530000),
    ]

    const eras = computeEras(records)

    expect(eras).toHaveLength(1)
    expect(eras[0]?.dominantArtists[0]).toBe('Artist A')
  })

  it('marks long missing-month gaps as sparse and reduces confidence', () => {
    const records = [
      record('2024-01-10T00:00:00Z', 'Artist A', 450000),
      record('2024-12-10T00:00:00Z', 'Artist A', 470000),
    ]

    const eras = computeEras(records)

    expect(eras).toHaveLength(1)
    expect(eras[0]?.durationMonths).toBe(12)
    expect(eras[0]?.changeDrivers.some((driver) => driver.key === 'sparse-data')).toBe(true)
    expect(eras[0]?.confidence ?? 1).toBeLessThan(0.7)
  })

  it('produces deterministic enriched transition metadata', () => {
    const records = [
      record('2024-01-01T00:00:00Z', 'Artist A', 500000),
      record('2024-01-03T00:00:00Z', 'Artist C', 100000),
      record('2024-02-01T00:00:00Z', 'Artist A', 480000),
      record('2024-03-01T00:00:00Z', 'Artist B', 520000),
      record('2024-03-02T00:00:00Z', 'Artist C', 120000),
      record('2024-04-01T00:00:00Z', 'Artist B', 540000),
    ]

    const first = computeEras(records)
    const second = computeEras(records)

    expect(first).toEqual(second)
    expect(first[1]?.transitionFromPrevious?.summary ?? '').not.toHaveLength(0)
    expect(first[1]?.topArrivals).toBeDefined()
    expect(first[1]?.topDepartures).toBeDefined()
  })
})

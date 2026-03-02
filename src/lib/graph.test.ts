import { describe, expect, it } from 'vitest'

import { buildGraphData, sanitizeGraphForRender } from './graph'
import type { ArtistStats, GraphEdge, GraphNode, StreamRecord, TrackStats } from './types'

function record(ts: string, artist: string, track: string): StreamRecord {
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

describe('sanitizeGraphForRender', () => {
  it('filters invalid nodes/edges and keeps only finite values', () => {
    const nodes: GraphNode[] = [
      {
        id: 'artist:a',
        type: 'artist',
        label: 'Artist A',
        playCount: 10,
        totalMs: 1000,
        firstListen: '2024-01-01T00:00:00Z',
      },
      {
        id: '',
        type: 'track',
        label: 'Broken',
        playCount: 10,
        totalMs: 100,
        firstListen: '2024-01-01T00:00:00Z',
      },
      {
        id: 'track:b',
        type: 'track',
        label: 'Track B',
        playCount: Number.NaN,
        totalMs: Number.POSITIVE_INFINITY,
        firstListen: '2024-01-01T00:00:00Z',
      },
    ]

    const edges: GraphEdge[] = [
      { source: 'artist:a', target: 'track:b', type: 'contains', weight: 2 },
      { source: 'artist:a', target: 'missing', type: 'contains', weight: 1 },
      { source: 'artist:a', target: 'track:b', type: 'contains', weight: 0 },
    ]

    const sanitized = sanitizeGraphForRender(nodes, edges, { maxNodes: 10 })

    expect(sanitized.nodes).toHaveLength(2)
    expect(sanitized.nodes[1]?.playCount).toBe(0)
    expect(sanitized.nodes[1]?.totalMs).toBe(0)
    expect(sanitized.edges).toHaveLength(1)
    expect(sanitized.edges[0]).toEqual({
      source: 'artist:a',
      target: 'track:b',
      type: 'contains',
      weight: 2,
    })
  })
})

describe('buildGraphData', () => {
  it('avoids repeated linear lookups while keeping edge endpoints valid', () => {
    const artists: ArtistStats[] = Array.from({ length: 32 }, (_, index) => ({
      key: `Artist ${index}`,
      name: `Artist ${index}`,
      plays: 500 - index,
      totalMs: 2_000_000 - index * 10_000,
      hours: 0.5,
      firstListen: '2024-01-01T00:00:00Z',
      lastListen: '2024-01-15T00:00:00Z',
      skipRate: 0,
    }))

    const tracks: TrackStats[] = artists.flatMap((artist, artistIndex) =>
      Array.from({ length: 6 }, (_, trackIndex) => ({
        key: `Track ${trackIndex}::${artist.key}`,
        name: `Track ${trackIndex}`,
        artist: artist.key,
        plays: 100 - trackIndex,
        totalMs: 200_000 + artistIndex * 1000,
        hours: 0.1,
        firstListen: '2024-01-01T00:00:00Z',
        lastListen: '2024-01-15T00:00:00Z',
        skipRate: 0,
      })),
    )

    const records: StreamRecord[] = Array.from({ length: 180 }, (_, index) =>
      record(
        `2024-01-${String((index % 28) + 1).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00:00Z`,
        `Artist ${index % 16}`,
        `Track ${index % 6}`,
      ),
    )

    const originalFind = Array.prototype.find
    let findCallCount = 0
    Array.prototype.find = function (
      this: unknown[],
      predicate: Parameters<typeof originalFind>[0],
      thisArg?: unknown,
    ) {
      findCallCount += 1
      return originalFind.call(this, predicate, thisArg)
    } as typeof Array.prototype.find

    let graph: ReturnType<typeof buildGraphData>
    try {
      graph = buildGraphData(records, artists, tracks, {
        maxNodes: 280,
        topTracksPerArtist: 3,
      })
    } finally {
      Array.prototype.find = originalFind
    }

    expect(findCallCount).toBe(0)

    const nodeIds = new Set(graph.nodes.map((node) => node.id))
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.source)).toBe(true)
      expect(nodeIds.has(edge.target)).toBe(true)
    }
  })

  it('emits edges that only target known nodes after artist/track filtering', () => {
    const artists: ArtistStats[] = [
      {
        key: 'Artist A',
        name: 'Artist A',
        plays: 10,
        totalMs: 2_000_000,
        hours: 0.55,
        firstListen: '2024-01-01T00:00:00Z',
        lastListen: '2024-01-02T00:00:00Z',
        skipRate: 0,
      },
      {
        key: 'Artist B',
        name: 'Artist B',
        plays: 8,
        totalMs: 1_600_000,
        hours: 0.44,
        firstListen: '2024-01-01T00:00:00Z',
        lastListen: '2024-01-02T00:00:00Z',
        skipRate: 0,
      },
    ]

    const tracks: TrackStats[] = [
      {
        key: 'Track A::Artist A',
        name: 'Track A',
        artist: 'Artist A',
        plays: 6,
        totalMs: 1_000_000,
        hours: 0.27,
        firstListen: '2024-01-01T00:00:00Z',
        lastListen: '2024-01-01T12:00:00Z',
        skipRate: 0,
      },
      {
        key: 'Track Missing::Unknown',
        name: 'Track Missing',
        artist: 'Unknown',
        plays: 10,
        totalMs: 1_200_000,
        hours: 0.33,
        firstListen: '2024-01-01T00:00:00Z',
        lastListen: '2024-01-01T12:00:00Z',
        skipRate: 0,
      },
    ]

    const records: StreamRecord[] = [
      record('2024-01-01T00:00:00Z', 'Artist A', 'Track A'),
      record('2024-01-01T00:10:00Z', 'Artist B', 'Track B'),
      record('2024-01-01T00:20:00Z', 'Artist A', 'Track A'),
    ]

    const graph = buildGraphData(records, artists, tracks, {
      maxNodes: 10,
      topTracksPerArtist: 2,
    })

    const nodeIds = new Set(graph.nodes.map((node) => node.id))
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.source)).toBe(true)
      expect(nodeIds.has(edge.target)).toBe(true)
    }
  })
})

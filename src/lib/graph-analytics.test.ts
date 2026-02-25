import { describe, expect, it } from 'vitest'

import { annotateGraphMetrics, computeGraphAnalytics } from './graph-analytics'
import type { GraphEdge, GraphNode } from './types'

const nodes: GraphNode[] = [
  {
    id: 'artist:a',
    type: 'artist',
    label: 'Artist A',
    playCount: 100,
    totalMs: 100_000,
    firstListen: '2024-01-01',
    communityId: 'a',
  },
  {
    id: 'artist:b',
    type: 'artist',
    label: 'Artist B',
    playCount: 90,
    totalMs: 90_000,
    firstListen: '2024-01-02',
    communityId: 'b',
  },
  {
    id: 'track:a1',
    type: 'track',
    label: 'Track A1',
    playCount: 40,
    totalMs: 40_000,
    firstListen: '2024-01-03',
    communityId: 'a',
  },
  {
    id: 'track:b1',
    type: 'track',
    label: 'Track B1',
    playCount: 35,
    totalMs: 35_000,
    firstListen: '2024-01-04',
    communityId: 'b',
  },
]

const edges: GraphEdge[] = [
  { source: 'artist:a', target: 'track:a1', type: 'contains', weight: 40 },
  { source: 'artist:b', target: 'track:b1', type: 'contains', weight: 35 },
  { source: 'artist:a', target: 'artist:b', type: 'co-listened', weight: 12 },
]

describe('computeGraphAnalytics', () => {
  it('computes summary, hubs, bridges, and cluster breakdowns deterministically', () => {
    const analytics = computeGraphAnalytics(nodes, edges)

    expect(analytics.summary.nodeCount).toBe(4)
    expect(analytics.summary.edgeCount).toBe(3)
    expect(analytics.summary.artistTrackRatio).toBeCloseTo(1)
    expect(analytics.hubs.length).toBeGreaterThan(0)
    expect(analytics.bridges.some((entry) => entry.nodeId === 'artist:a' || entry.nodeId === 'artist:b')).toBe(true)
    expect(analytics.clusters.length).toBeGreaterThan(0)
    expect(analytics.motifs.topPairs.length).toBeGreaterThan(0)

    const hubNames = analytics.hubs.map((item) => item.label)
    expect(hubNames[0]).toMatch(/Artist [AB]/)

    const bridgeEdge = analytics.bridgedEdges.find(
      (edge) => edge.sourceId === 'artist:a' && edge.targetId === 'artist:b',
    )
    expect(bridgeEdge?.communityBridge).toBe(true)
  })

  it('honors pre-annotated metrics when the caller opts into the fast path', () => {
    const annotated = annotateGraphMetrics(nodes, edges)
    const sentinelNodes = annotated.nodes.map((node, index) => ({
      ...node,
      degree: 100 + index,
      weightedDegree: 1000 + index * 10,
      communityId: `community-${index % 2}`,
    }))
    const sentinelEdges = annotated.edges.map((edge) => ({
      ...edge,
      communityBridge: true,
      normalizedWeight: 0.5,
    }))

    const analytics = computeGraphAnalytics(sentinelNodes, sentinelEdges, {
      assumeAnnotatedMetrics: true,
    })

    expect(analytics.summary.averageDegree).toBe(101.5)
    expect(analytics.summary.averageWeightedDegree).toBe(1015)
    expect(analytics.bridgedEdges.every((edge) => edge.communityBridge)).toBe(true)
  })
})

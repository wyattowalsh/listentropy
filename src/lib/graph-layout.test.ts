import { describe, expect, it } from 'vitest'

import type { GraphEdge, GraphNode } from './types'
import { computeGraphLayout } from './graph-layout'

const nodes: GraphNode[] = [
  {
    id: 'artist:a',
    type: 'artist',
    label: 'Artist A',
    playCount: 100,
    totalMs: 100_000,
    firstListen: '2024-01-01',
    cluster: 'a',
  },
  {
    id: 'artist:b',
    type: 'artist',
    label: 'Artist B',
    playCount: 80,
    totalMs: 80_000,
    firstListen: '2024-01-02',
    cluster: 'b',
  },
  {
    id: 'track:a1',
    type: 'track',
    label: 'Track A1',
    playCount: 30,
    totalMs: 30_000,
    firstListen: '2024-01-03',
    cluster: 'a',
  },
]

const edges: GraphEdge[] = [
  { source: 'artist:a', target: 'track:a1', type: 'contains', weight: 30 },
  { source: 'artist:a', target: 'artist:b', type: 'co-listened', weight: 6 },
]

describe('computeGraphLayout', () => {
  it('returns deterministic finite layout coordinates for graph nodes', () => {
    const first = computeGraphLayout(nodes, edges)
    const second = computeGraphLayout(nodes, edges)

    expect(first.nodes).toHaveLength(nodes.length)
    expect(second.nodes).toHaveLength(nodes.length)

    for (const node of first.nodes) {
      expect(node.layout).toBeDefined()
      expect(Number.isFinite(node.layout?.x)).toBe(true)
      expect(Number.isFinite(node.layout?.y)).toBe(true)
      expect(Number.isFinite(node.layout?.z ?? 0)).toBe(true)
      expect(node.communityId).toBeTruthy()
    }

    const firstCoords = first.nodes.map((node) => ({
      id: node.id,
      x: Math.round(node.layout?.x ?? 0),
      y: Math.round(node.layout?.y ?? 0),
      z: Math.round(node.layout?.z ?? 0),
    }))
    const secondCoords = second.nodes.map((node) => ({
      id: node.id,
      x: Math.round(node.layout?.x ?? 0),
      y: Math.round(node.layout?.y ?? 0),
      z: Math.round(node.layout?.z ?? 0),
    }))

    expect(firstCoords).toEqual(secondCoords)
  })
})


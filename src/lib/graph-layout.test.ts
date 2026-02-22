import { describe, expect, it } from 'vitest'

import type { GraphEdge, GraphNode } from './types'
import { computeGraphLayout, projectNodeLayoutToViewport } from './graph-layout'

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

describe('projectNodeLayoutToViewport', () => {
  it('projects normalized layout coordinates into a padded viewport and clamps out-of-range values', () => {
    const projected = projectNodeLayoutToViewport(
      { layout: { x: 2.5, y: -2.5 } },
      { width: 200, height: 100, padding: 10 },
    )

    expect(projected).toEqual({ x: 190, y: 10 })
  })

  it('falls back to the viewport center when layout or viewport dimensions are invalid', () => {
    const projected = projectNodeLayoutToViewport(
      {},
      { width: Number.NaN, height: 0 },
    )

    expect(Number.isFinite(projected.x)).toBe(true)
    expect(Number.isFinite(projected.y)).toBe(true)
    expect(projected).toEqual({ x: 0.5, y: 0.5 })
  })
})

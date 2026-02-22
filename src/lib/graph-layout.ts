import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'

import type { GraphEdge, GraphNode } from './types'

interface LayoutNode extends SimulationNodeDatum {
  id: string
  communityId: string
  x: number
  y: number
}

interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  source: string | LayoutNode
  target: string | LayoutNode
  weight: number
}

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomFromSeed(seed: number): number {
  let state = seed || 1
  state ^= state << 13
  state ^= state >> 17
  state ^= state << 5
  return ((state >>> 0) % 10_000) / 10_000
}

function inferCommunityId(node: GraphNode): string {
  if (node.communityId) {
    return node.communityId
  }
  if (node.cluster) {
    return node.cluster
  }
  const colon = node.id.indexOf(':')
  return colon >= 0 ? node.id.slice(0, colon) : node.type
}

function initialPosition(node: GraphNode): { x: number; y: number } {
  const seed = hashSeed(node.id)
  const angle = randomFromSeed(seed) * Math.PI * 2
  const radius = 80 + randomFromSeed(seed ^ 0x9e3779b9) * 140
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function normalizeCoordinate(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (max - min < 1e-6) {
    return 0
  }
  return ((value - min) / (max - min)) * 2 - 1
}

function zCoordinate(node: GraphNode, communityId: string): number {
  const a = randomFromSeed(hashSeed(node.id))
  const b = randomFromSeed(hashSeed(communityId))
  return (a - 0.5) * 0.8 + (b - 0.5) * 0.4
}

export function computeGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (nodes.length === 0) {
    return { nodes, edges }
  }

  const mutableNodes: LayoutNode[] = nodes.map((node) => {
    const pos = initialPosition(node)
    return {
      id: node.id,
      communityId: inferCommunityId(node),
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
    }
  })

  const nodeById = new Map(mutableNodes.map((node) => [node.id, node]))
  const links: LayoutLink[] = edges
    .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }))

  const simulation = forceSimulation<LayoutNode>(mutableNodes)
    .stop()
    .alpha(1)
    .force('charge', forceManyBody().strength(-65))
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links)
        .id((node) => node.id)
        .distance((link) => {
          const weight = Math.max(1, link.weight)
          return Math.max(28, 105 - Math.log2(weight + 1) * 10)
        })
        .strength((link) => Math.min(0.9, 0.15 + Math.log2(Math.max(1, link.weight) + 1) * 0.12)),
    )
    .force('center', forceCenter(0, 0))

  for (let tick = 0; tick < 140; tick += 1) {
    simulation.tick()
  }
  simulation.stop()

  const xs = mutableNodes.map((node) => node.x)
  const ys = mutableNodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const laidOutNodes = nodes.map((node) => {
    const simNode = nodeById.get(node.id)
    const communityId = simNode?.communityId ?? inferCommunityId(node)
    const x = normalizeCoordinate(simNode?.x ?? 0, minX, maxX)
    const y = normalizeCoordinate(simNode?.y ?? 0, minY, maxY)
    return {
      ...node,
      communityId,
      layout: {
        x,
        y,
        z: zCoordinate(node, communityId),
      },
    }
  })

  return {
    nodes: laidOutNodes,
    edges: [...edges],
  }
}


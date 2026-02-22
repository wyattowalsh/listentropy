import { DEFAULT_MAX_GRAPH_NODES } from './constants'
import type { ArtistStats, GraphEdge, GraphNode, StreamRecord, TrackStats } from './types'

interface GraphOptions {
  maxNodes?: number
  topTracksPerArtist?: number
}

interface SanitizeGraphOptions {
  maxNodes?: number
  maxEdges?: number
}

export function buildGraphData(
  records: StreamRecord[],
  artists: ArtistStats[],
  tracks: TrackStats[],
  options: GraphOptions = {},
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_GRAPH_NODES
  const topTracksPerArtist = options.topTracksPerArtist ?? 3
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const topArtists = artists.slice(0, Math.min(100, artists.length))
  for (const artist of topArtists) {
    nodes.push({
      id: `artist:${artist.key}`,
      type: 'artist',
      label: artist.name,
      playCount: artist.plays,
      totalMs: artist.totalMs,
      firstListen: artist.firstListen,
      cluster: artist.key,
    })
  }

  const artistTrackCount = new Map<string, number>()
  for (const track of tracks) {
    if (nodes.length >= maxNodes) {
      break
    }
    const artistNodeId = `artist:${track.artist}`
    if (!nodes.find((node) => node.id === artistNodeId)) {
      continue
    }
    const count = artistTrackCount.get(track.artist) ?? 0
    if (count >= topTracksPerArtist) {
      continue
    }
    const nodeId = `track:${track.key}`
    nodes.push({
      id: nodeId,
      type: 'track',
      label: track.name,
      playCount: track.plays,
      totalMs: track.totalMs,
      firstListen: track.firstListen,
      cluster: track.artist,
    })
    edges.push({
      source: artistNodeId,
      target: nodeId,
      type: 'contains',
      weight: track.plays,
    })
    artistTrackCount.set(track.artist, count + 1)
  }

  // Session adjacency for top co-listened artist connections.
  const sessions = new Map<string, string[]>()
  for (const record of records) {
    if (!record.master_metadata_album_artist_name) {
      continue
    }
    const dateKey = record.ts.slice(0, 13)
    const list = sessions.get(dateKey) ?? []
    list.push(record.master_metadata_album_artist_name)
    sessions.set(dateKey, list)
  }

  const coListenWeights = new Map<string, number>()
  for (const artistsInSession of sessions.values()) {
    const unique = [...new Set(artistsInSession)]
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const key = [unique[i], unique[j]].sort().join('::')
        coListenWeights.set(key, (coListenWeights.get(key) ?? 0) + 1)
      }
    }
  }

  for (const [pair, weight] of [...coListenWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 120)) {
    const [a, b] = pair.split('::')
    const source = `artist:${a}`
    const target = `artist:${b}`
    if (nodes.find((node) => node.id === source) && nodes.find((node) => node.id === target)) {
      edges.push({
        source,
        target,
        type: 'co-listened',
        weight,
      })
    }
  }

  return { nodes, edges }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sanitizeNode(node: GraphNode): GraphNode | null {
  if (!node?.id) {
    return null
  }
  if (node.type !== 'artist' && node.type !== 'album' && node.type !== 'track') {
    return null
  }
  const playCount = isFiniteNumber(node.playCount) ? Math.max(0, Math.round(node.playCount)) : 0
  const totalMs = isFiniteNumber(node.totalMs) ? Math.max(0, node.totalMs) : 0

  return {
    ...node,
    label: node.label || node.id,
    playCount,
    totalMs,
  }
}

function sanitizeEdge(edge: GraphEdge): GraphEdge | null {
  if (!edge?.source || !edge.target) {
    return null
  }
  if (edge.type !== 'contains' && edge.type !== 'co-listened') {
    return null
  }
  const weight = isFiniteNumber(edge.weight) ? Math.max(0, edge.weight) : 0
  if (weight === 0) {
    return null
  }
  return {
    ...edge,
    weight,
  }
}

export function sanitizeGraphForRender(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: SanitizeGraphOptions = {},
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const maxNodes = options.maxNodes ?? nodes.length
  const maxEdges = options.maxEdges ?? edges.length

  const safeNodes = nodes
    .map(sanitizeNode)
    .filter((item): item is GraphNode => Boolean(item))
    .slice(0, Math.max(1, maxNodes))

  const allowedNodeIds = new Set(safeNodes.map((node) => node.id))

  const safeEdges = edges
    .map(sanitizeEdge)
    .filter((item): item is GraphEdge => Boolean(item))
    .filter((edge) => allowedNodeIds.has(edge.source) && allowedNodeIds.has(edge.target))
    .slice(0, Math.max(0, maxEdges))

  return {
    nodes: safeNodes,
    edges: safeEdges,
  }
}

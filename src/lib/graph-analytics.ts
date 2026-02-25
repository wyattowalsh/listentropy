import type { GraphAnalytics, GraphEdge, GraphNode } from './types'

interface ComputeGraphAnalyticsOptions {
  assumeAnnotatedMetrics?: boolean
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function getCommunityId(node: GraphNode): string {
  return node.communityId ?? node.cluster ?? node.type
}

export function annotateGraphMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const degree = new Map<string, number>()
  const weighted = new Map<string, number>()
  let maxWeight = 0

  for (const edge of edges) {
    maxWeight = Math.max(maxWeight, edge.weight)
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
    weighted.set(edge.source, (weighted.get(edge.source) ?? 0) + edge.weight)
    weighted.set(edge.target, (weighted.get(edge.target) ?? 0) + edge.weight)
  }

  const annotatedNodes = nodes.map((node) => ({
    ...node,
    communityId: getCommunityId(node),
    degree: degree.get(node.id) ?? 0,
    weightedDegree: weighted.get(node.id) ?? 0,
  }))

  const communityByNodeId = new Map(annotatedNodes.map((node) => [node.id, node.communityId ?? node.type]))
  const annotatedEdges = edges.map((edge) => {
    const sourceCommunity = communityByNodeId.get(edge.source)
    const targetCommunity = communityByNodeId.get(edge.target)
    return {
      ...edge,
      normalizedWeight: maxWeight > 0 ? edge.weight / maxWeight : 0,
      communityBridge:
        Boolean(sourceCommunity) &&
        Boolean(targetCommunity) &&
        sourceCommunity !== targetCommunity &&
        edge.type === 'co-listened',
    }
  })

  return {
    nodes: annotatedNodes,
    edges: annotatedEdges,
  }
}

function connectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
  if (nodes.length === 0) {
    return 0
  }
  const adjacency = new Map<string, string[]>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) {
      continue
    }
    adjacency.get(edge.source)!.push(edge.target)
    adjacency.get(edge.target)!.push(edge.source)
  }

  const visited = new Set<string>()
  let count = 0
  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue
    }
    count += 1
    const queue = [node.id]
    let queueIndex = 0
    visited.add(node.id)
    while (queueIndex < queue.length) {
      const current = queue[queueIndex]!
      queueIndex += 1
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) {
          continue
        }
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return count
}

export function computeGraphAnalytics(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ComputeGraphAnalyticsOptions = {},
): GraphAnalytics {
  const { nodes: enrichedNodes, edges: enrichedEdges } = options.assumeAnnotatedMetrics
    ? { nodes, edges }
    : annotateGraphMetrics(nodes, edges)
  const nodeById = new Map(enrichedNodes.map((node) => [node.id, node]))

  const artists = enrichedNodes.filter((node) => node.type === 'artist')
  const tracks = enrichedNodes.filter((node) => node.type === 'track')

  const hubs = [...enrichedNodes]
    .sort((a, b) => (b.weightedDegree ?? 0) - (a.weightedDegree ?? 0) || (b.degree ?? 0) - (a.degree ?? 0))
    .slice(0, 10)
    .map((node) => ({
      nodeId: node.id,
      label: node.label,
      type: node.type,
      degree: node.degree ?? 0,
      weightedDegree: node.weightedDegree ?? 0,
      playCount: node.playCount,
    }))

  const communityTouchMap = new Map<string, Set<string>>()
  const bridgeEdgeCount = new Map<string, number>()

  for (const edge of enrichedEdges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) {
      continue
    }
    const sourceSet = communityTouchMap.get(source.id) ?? new Set<string>([getCommunityId(source)])
    const targetSet = communityTouchMap.get(target.id) ?? new Set<string>([getCommunityId(target)])
    sourceSet.add(getCommunityId(source))
    sourceSet.add(getCommunityId(target))
    targetSet.add(getCommunityId(source))
    targetSet.add(getCommunityId(target))
    communityTouchMap.set(source.id, sourceSet)
    communityTouchMap.set(target.id, targetSet)
    if (edge.communityBridge) {
      bridgeEdgeCount.set(source.id, (bridgeEdgeCount.get(source.id) ?? 0) + 1)
      bridgeEdgeCount.set(target.id, (bridgeEdgeCount.get(target.id) ?? 0) + 1)
    }
  }

  const bridges = [...enrichedNodes]
    .map((node) => {
      const communities = communityTouchMap.get(node.id) ?? new Set([getCommunityId(node)])
      const count = bridgeEdgeCount.get(node.id) ?? 0
      return {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        bridgeScore: round(count * Math.max(0, communities.size - 1)),
        bridgeEdgeCount: count,
        communityCount: communities.size,
      }
    })
    .filter((entry) => entry.bridgeScore > 0)
    .sort((a, b) => b.bridgeScore - a.bridgeScore || b.bridgeEdgeCount - a.bridgeEdgeCount)
    .slice(0, 10)

  const clusterMap = new Map<string, { nodes: GraphNode[] }>()
  for (const node of enrichedNodes) {
    const communityId = getCommunityId(node)
    const bucket = clusterMap.get(communityId) ?? { nodes: [] }
    bucket.nodes.push(node)
    clusterMap.set(communityId, bucket)
  }

  const clusters = [...clusterMap.entries()]
    .map(([communityId, bucket]) => {
      const clusterArtists = bucket.nodes.filter((node) => node.type === 'artist')
      const clusterTracks = bucket.nodes.filter((node) => node.type === 'track')
      return {
        communityId,
        nodeCount: bucket.nodes.length,
        artistCount: clusterArtists.length,
        trackCount: clusterTracks.length,
        totalPlayCount: bucket.nodes.reduce((sum, node) => sum + node.playCount, 0),
        topArtists: clusterArtists
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 3)
          .map((node) => node.label),
      }
    })
    .sort((a, b) => b.totalPlayCount - a.totalPlayCount)
    .slice(0, 12)

  const topPairs = enrichedEdges
    .filter((edge) => edge.type === 'co-listened')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map((edge) => ({
      sourceId: edge.source,
      sourceLabel: nodeById.get(edge.source)?.label ?? edge.source,
      targetId: edge.target,
      targetLabel: nodeById.get(edge.target)?.label ?? edge.target,
      weight: edge.weight,
    }))

  const degreeValues = enrichedNodes.map((node) => node.degree ?? 0)
  const weightedValues = enrichedNodes.map((node) => node.weightedDegree ?? 0)

  return {
    summary: {
      nodeCount: enrichedNodes.length,
      edgeCount: enrichedEdges.length,
      artistCount: artists.length,
      trackCount: tracks.length,
      averageDegree:
        degreeValues.length > 0 ? round(degreeValues.reduce((sum, value) => sum + value, 0) / degreeValues.length, 2) : 0,
      averageWeightedDegree:
        weightedValues.length > 0
          ? round(weightedValues.reduce((sum, value) => sum + value, 0) / weightedValues.length, 2)
          : 0,
      connectedComponents: connectedComponents(enrichedNodes, enrichedEdges),
      artistTrackRatio: artists.length > 0 ? round(tracks.length / artists.length, 2) : 0,
    },
    hubs,
    bridges,
    clusters,
    motifs: { topPairs },
    bridgedEdges: enrichedEdges
      .filter((edge) => edge.type === 'co-listened')
      .map((edge) => ({
        sourceId: edge.source,
        targetId: edge.target,
        weight: edge.weight,
        communityBridge: Boolean(edge.communityBridge),
      })),
  }
}

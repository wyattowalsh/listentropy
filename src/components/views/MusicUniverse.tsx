import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'

import { GraphControls } from '@/components/graph/GraphControls'
import { Universe2D } from '@/components/graph/Universe2D'
import { Universe3D } from '@/components/graph/Universe3D'
import { UniverseInspector } from '@/components/graph/UniverseInspector'
import { UniverseLegend } from '@/components/graph/UniverseLegend'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { annotateGraphMetrics, computeGraphAnalytics } from '@/lib/graph-analytics'
import { computeGraphLayout } from '@/lib/graph-layout'
import { sanitizeGraphForRender } from '@/lib/graph'
import type { GraphEdge, GraphFallbackReason, GraphRendererStatus, ProcessedDataModel } from '@/lib/types'
import { formatCompact } from '@/lib/utils'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'

interface MusicUniverseProps {
  data: ProcessedDataModel
}

interface Universe3DGuardProps {
  retryKey: number
  onError: () => void
  children: ReactNode
}

interface Universe3DGuardState {
  failed: boolean
}

class Universe3DGuard extends Component<Universe3DGuardProps, Universe3DGuardState> {
  state: Universe3DGuardState = {
    failed: false,
  }

  static getDerivedStateFromError(): Universe3DGuardState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Universe 3D renderer failed', { error, info })
    this.props.onError()
  }

  componentDidUpdate(prevProps: Universe3DGuardProps): void {
    if (prevProps.retryKey !== this.props.retryKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render(): ReactNode {
    if (this.state.failed) {
      return null
    }
    return this.props.children
  }
}

function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') {
    return false
  }
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return Boolean(context)
  } catch {
    return false
  }
}

function fallbackText(reason: GraphFallbackReason | undefined): string {
  if (reason === 'webgl-unsupported') {
    return '3D rendering is unavailable in this browser session. Showing the 2D graph instead.'
  }
  if (reason === 'renderer-init-failed') {
    return '3D renderer failed to initialize. 2D mode is active. You can retry 3D at any time.'
  }
  if (reason === 'manual') {
    return '2D mode selected for a clearer force-directed view.'
  }
  return '2D mode is active.'
}

function initialRendererStatus(webglSupported: boolean): GraphRendererStatus {
  if (!webglSupported) {
    return {
      renderer: '2d',
      fallbackReason: 'webgl-unsupported',
      state: '2d-unsupported',
      diagnosticMessage: 'WebGL is unavailable, so the graph opened in 2D fallback mode.',
    }
  }
  return {
    renderer: '3d',
    state: 'probing',
    diagnosticMessage: 'Attempting 3D initialization…',
  }
}

function filterEdgesByToggles(
  edges: GraphEdge[],
  options: { showContainsEdges: boolean; showCoListenEdges: boolean; maxEdges: number },
): GraphEdge[] {
  const filtered = edges.filter((edge) => {
    if (edge.type === 'contains') {
      return options.showContainsEdges
    }
    if (edge.type === 'co-listened') {
      return options.showCoListenEdges
    }
    return false
  })
  return [...filtered].sort((a, b) => b.weight - a.weight).slice(0, options.maxEdges)
}

export function MusicUniverse({ data }: MusicUniverseProps): JSX.Element {
  const webglSupported = useMemo(() => detectWebGLSupport(), [])
  const recordMetric = useSessionMetricsStore((state) => state.record)

  const [rendererStatus, setRendererStatus] = useState<GraphRendererStatus>(() => initialRendererStatus(webglSupported))
  const [maxNodes, setMaxNodes] = useState(250)
  const [maxEdges, setMaxEdges] = useState(140)
  const [search, setSearch] = useState('')
  const [showContainsEdges, setShowContainsEdges] = useState(false)
  const [showCoListenEdges, setShowCoListenEdges] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [cameraResetKey, setCameraResetKey] = useState(0)
  const [focusToken, setFocusToken] = useState(0)
  const [lastRetryAt, setLastRetryAt] = useState(0)

  useEffect(() => {
    setRendererStatus(initialRendererStatus(webglSupported))
  }, [webglSupported])

  const graph = useMemo(() => {
    const sanitized = sanitizeGraphForRender(data.graph.nodes, data.graph.edges, { maxNodes })
    const toggledEdges = filterEdgesByToggles(sanitized.edges, {
      showContainsEdges,
      showCoListenEdges,
      maxEdges,
    })
    const metricAnnotated = annotateGraphMetrics(sanitized.nodes, toggledEdges)
    const laidOut = computeGraphLayout(metricAnnotated.nodes, metricAnnotated.edges)
    return annotateGraphMetrics(laidOut.nodes, laidOut.edges)
  }, [data.graph.edges, data.graph.nodes, maxEdges, maxNodes, showCoListenEdges, showContainsEdges])

  const analytics = useMemo(() => computeGraphAnalytics(graph.nodes, graph.edges), [graph.edges, graph.nodes])

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])

  const searchMatches = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return []
    }
    return graph.nodes.filter((node) => node.label.toLowerCase().includes(query)).slice(0, 12)
  }, [graph.nodes, search])

  useEffect(() => {
    if (selectedNodeId && nodeById.has(selectedNodeId)) {
      return
    }
    setSelectedNodeId((current) => (current && nodeById.has(current) ? current : null))
  }, [nodeById, selectedNodeId])

  useEffect(() => {
    if (!search.trim()) {
      return
    }
    if (selectedNodeId && nodeById.get(selectedNodeId)?.label.toLowerCase().includes(search.trim().toLowerCase())) {
      return
    }
    if (searchMatches[0]) {
      setSelectedNodeId(searchMatches[0].id)
    }
  }, [nodeById, search, searchMatches, selectedNodeId])

  const inspectedNode = nodeById.get(selectedNodeId ?? hoveredNodeId ?? '') ?? null

  const neighbors = useMemo(() => {
    if (!inspectedNode) {
      return []
    }
    return graph.edges
      .filter((edge) => edge.source === inspectedNode.id || edge.target === inspectedNode.id)
      .map((edge) => {
        const neighborId = edge.source === inspectedNode.id ? edge.target : edge.source
        const neighbor = nodeById.get(neighborId)
        return {
          id: neighborId,
          label: neighbor?.label ?? neighborId,
          type: neighbor?.type ?? 'artist',
          weight: edge.weight,
        }
      })
      .sort((a, b) => b.weight - a.weight)
  }, [graph.edges, inspectedNode, nodeById])

  const activate3D = useCallback(() => {
    const now = Date.now()
    if (now - lastRetryAt < 1000) {
      return
    }
    setLastRetryAt(now)
    setRetryKey((previous) => previous + 1)
    if (!webglSupported) {
      setRendererStatus({
        renderer: '2d',
        fallbackReason: 'webgl-unsupported',
        state: '2d-unsupported',
        diagnosticMessage: '3D is unavailable in this browser session because WebGL could not be initialized.',
      })
      return
    }
    setRendererStatus({
      renderer: '3d',
      state: 'probing',
      diagnosticMessage: 'Attempting 3D initialization…',
    })
    recordMetric({
      type: 'universe_mode_switched',
      timestamp: new Date().toISOString(),
      metadata: { mode: '3d' },
    })
  }, [lastRetryAt, recordMetric, webglSupported])

  const activate2D = useCallback(() => {
    setRendererStatus({
      renderer: '2d',
      fallbackReason: 'manual',
      state: '2d-manual',
      diagnosticMessage: '2D mode selected manually for a clearer force-directed map.',
    })
    recordMetric({
      type: 'universe_mode_switched',
      timestamp: new Date().toISOString(),
      metadata: { mode: '2d' },
    })
  }, [recordMetric])

  const handleModeChange = useCallback(
    (mode: '2d' | '3d') => {
      if (mode === '2d') {
        activate2D()
        return
      }
      activate3D()
    },
    [activate2D, activate3D],
  )

  const handle3DInitFailure = useCallback(() => {
    setRendererStatus({
      renderer: '2d',
      fallbackReason: 'renderer-init-failed',
      state: '3d-failed',
      diagnosticMessage: '3D renderer initialization failed in this browser session. 2D fallback is active.',
    })
    recordMetric({
      type: 'universe_3d_init_failed',
      timestamp: new Date().toISOString(),
    })
  }, [recordMetric])

  const handle3DInitSuccess = useCallback(() => {
    setRendererStatus((current) => {
      if (current.renderer !== '3d') {
        return current
      }
      return {
        renderer: '3d',
        state: '3d-ready',
        diagnosticMessage: '3D renderer initialized successfully.',
      }
    })
    recordMetric({
      type: 'universe_3d_init_success',
      timestamp: new Date().toISOString(),
    })
  }, [recordMetric])

  const is3D = rendererStatus.renderer === '3d'

  const selectedNodeLabel = selectedNodeId ? nodeById.get(selectedNodeId)?.label ?? null : null

  const renderKey = `${is3D ? '3d' : '2d'}-${retryKey}-${cameraResetKey}`

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Music Universe Graph</CardTitle>
        <CardDescription className="mt-1">
          Explore artist and track constellations by co-listen and hierarchy links.
        </CardDescription>
        <div className="mt-3">
          <GraphControls
            mode={rendererStatus.renderer}
            onModeChange={handleModeChange}
            maxNodes={maxNodes}
            onMaxNodesChange={setMaxNodes}
            maxEdges={maxEdges}
            onMaxEdgesChange={setMaxEdges}
            search={search}
            onSearchChange={setSearch}
            showContainsEdges={showContainsEdges}
            showCoListenEdges={showCoListenEdges}
            onShowContainsEdgesChange={setShowContainsEdges}
            onShowCoListenEdgesChange={setShowCoListenEdges}
            webglSupported={webglSupported}
            fallbackReason={rendererStatus.fallbackReason}
            rendererState={rendererStatus.state}
            diagnosticMessage={rendererStatus.diagnosticMessage}
            selectedNodeLabel={selectedNodeLabel}
            onResetCamera={() => setCameraResetKey((value) => value + 1)}
            onRetry3D={activate3D}
          />
        </div>
        <div className="mt-3">
          <UniverseLegend />
        </div>
        {searchMatches.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchMatches.slice(0, 8).map((match) => (
              <button
                key={match.id}
                type="button"
                className={`rounded-theme border px-2 py-1 text-xs transition ${
                  selectedNodeId === match.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-muted hover:text-text'
                }`}
                onClick={() => setSelectedNodeId(match.id)}
              >
                {match.label}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {!is3D ? (
        <Card>
          <CardDescription>{fallbackText(rendererStatus.fallbackReason)}</CardDescription>
        </Card>
      ) : null}

      {is3D ? (
        <Universe3DGuard retryKey={retryKey} onError={handle3DInitFailure}>
          <Universe3D
            key={renderKey}
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onHoverNodeChange={setHoveredNodeId}
            onRendererInitError={handle3DInitFailure}
            onRendererInitSuccess={handle3DInitSuccess}
            focusTargetId={selectedNodeId}
            focusToken={focusToken}
          />
        </Universe3DGuard>
      ) : (
        <Universe2D key={renderKey} nodes={graph.nodes} edges={graph.edges} selectedNodeId={selectedNodeId} />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle>Network Analytics</CardTitle>
            <CardDescription className="mt-1">
              Analytics for the current filtered view (respects node/edge limits and edge toggles).
            </CardDescription>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Nodes / Edges</p>
                <p className="mt-1 text-sm text-text">
                  {analytics.summary.nodeCount} / {analytics.summary.edgeCount}
                </p>
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Artist / Track Ratio</p>
                <p className="mt-1 text-sm text-text">{analytics.summary.artistTrackRatio}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Avg Degree</p>
                <p className="mt-1 text-sm text-text">{analytics.summary.averageDegree}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Components</p>
                <p className="mt-1 text-sm text-text">{analytics.summary.connectedComponents}</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Top Hubs</CardTitle>
              <ul className="mt-3 space-y-2">
                {analytics.hubs.slice(0, 6).map((hub) => (
                  <li key={hub.nodeId} className="flex items-center justify-between gap-3 rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-text">{hub.label}</p>
                      <p className="text-xs text-text-muted">{hub.type} · degree {hub.degree}</p>
                    </div>
                    <p className="shrink-0 text-xs text-text-muted">wdeg {formatCompact(hub.weightedDegree)}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Bridge Artists</CardTitle>
              <ul className="mt-3 space-y-2">
                {analytics.bridges.slice(0, 6).map((bridge) => (
                  <li key={bridge.nodeId} className="flex items-center justify-between gap-3 rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-text">{bridge.label}</p>
                      <p className="text-xs text-text-muted">
                        {bridge.type} · {bridge.communityCount} communities
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-text-muted">score {bridge.bridgeScore}</p>
                  </li>
                ))}
                {analytics.bridges.length === 0 ? (
                  <li className="rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm text-text-muted">
                    No bridge-heavy nodes in the current filtered graph.
                  </li>
                ) : null}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Cluster Summary</CardTitle>
              <ul className="mt-3 space-y-2">
                {analytics.clusters.slice(0, 6).map((cluster) => (
                  <li key={cluster.communityId} className="rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-text">{cluster.communityId}</p>
                      <p className="shrink-0 text-xs text-text-muted">{cluster.nodeCount} nodes</p>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      artists {cluster.artistCount} · tracks {cluster.trackCount} · plays {formatCompact(cluster.totalPlayCount)}
                    </p>
                    {cluster.topArtists.length > 0 ? (
                      <p className="mt-1 truncate text-xs text-text-muted">
                        Top artists: {cluster.topArtists.join(', ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Co-listen Motifs</CardTitle>
              <ul className="mt-3 space-y-2">
                {analytics.motifs.topPairs.slice(0, 8).map((pair) => (
                  <li key={`${pair.sourceId}-${pair.targetId}`} className="rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm">
                    <p className="truncate text-text">
                      {pair.sourceLabel} ↔ {pair.targetLabel}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">Co-listen weight {pair.weight}</p>
                  </li>
                ))}
                {analytics.motifs.topPairs.length === 0 ? (
                  <li className="rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm text-text-muted">
                    Enable co-listen edges to see motif highlights.
                  </li>
                ) : null}
              </ul>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <UniverseInspector
            node={inspectedNode}
            neighbors={neighbors}
            onFocusSelected={
              selectedNodeId
                ? () => {
                    setFocusToken((value) => value + 1)
                  }
                : undefined
            }
            onClearSelected={selectedNodeId ? () => setSelectedNodeId(null) : undefined}
          />
          <Card>
            <CardTitle>View Diagnostics</CardTitle>
            <div className="mt-3 grid gap-2 text-sm text-text-muted">
              <p>Renderer state: {rendererStatus.state ?? (is3D ? '3d-ready' : '2d-manual')}</p>
              <p>Renderer mode: {rendererStatus.renderer.toUpperCase()}</p>
              <p>Visible artists: {analytics.summary.artistCount}</p>
              <p>Visible tracks: {analytics.summary.trackCount}</p>
              <p>Average weighted degree: {analytics.summary.averageWeightedDegree}</p>
            </div>
            {rendererStatus.diagnosticMessage ? (
              <p className="mt-3 text-xs text-text-muted">{rendererStatus.diagnosticMessage}</p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}

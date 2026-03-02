import {
  Component,
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type KeyboardEvent,
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
  analysisMode?: 'simple' | 'deep'
}

interface Universe3DGuardProps {
  retryKey: number
  onError: () => void
  children: ReactNode
}

interface Universe3DGuardState {
  failed: boolean
}

interface TimedStageResult<T> {
  value: T
  durationMs: number | null
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

function buildEdgesByNodeIndex(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const index = new Map<string, GraphEdge[]>()
  for (const edge of edges) {
    const sourceList = index.get(edge.source)
    if (sourceList) {
      sourceList.push(edge)
    } else {
      index.set(edge.source, [edge])
    }

    if (edge.target === edge.source) {
      continue
    }

    const targetList = index.get(edge.target)
    if (targetList) {
      targetList.push(edge)
    } else {
      index.set(edge.target, [edge])
    }
  }
  return index
}

function isGraphPerfDebugEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  try {
    const query = new URLSearchParams(window.location.search)
    if (query.get('debugGraphPerf') === '1') {
      return true
    }
    return window.localStorage.getItem('listentropy:debugGraphPerf') === '1'
  } catch {
    return false
  }
}

function runTimedStage<T>(enabled: boolean, compute: () => T): TimedStageResult<T> {
  if (!enabled || typeof performance === 'undefined') {
    return {
      value: compute(),
      durationMs: null,
    }
  }

  const start = performance.now()
  const value = compute()
  return {
    value,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
  }
}

function renderModeAwareDeepSection(
  isSimpleMode: boolean,
  title: string,
  content: ReactNode,
): ReactNode {
  if (!isSimpleMode) {
    return content
  }

  return (
    <details className="rounded-theme border border-border bg-surface p-3">
      <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-text-muted">
        {title}
      </summary>
      <div className="mt-3 space-y-4">{content}</div>
    </details>
  )
}

export function MusicUniverse({ data, analysisMode = 'deep' }: MusicUniverseProps): JSX.Element {
  const webglSupported = useMemo(() => detectWebGLSupport(), [])
  const graphPerfDebugEnabled = useMemo(() => isGraphPerfDebugEnabled(), [])
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
  const last3DFailureMetricAttemptRef = useRef<number | null>(null)
  const last3DSuccessMetricAttemptRef = useRef<number | null>(null)

  useEffect(() => {
    setRendererStatus(initialRendererStatus(webglSupported))
  }, [webglSupported])

  const deferredMaxNodes = useDeferredValue(maxNodes)
  const deferredMaxEdges = useDeferredValue(maxEdges)
  const deferredShowContainsEdges = useDeferredValue(showContainsEdges)
  const deferredShowCoListenEdges = useDeferredValue(showCoListenEdges)
  const deferredSearch = useDeferredValue(search)

  const sanitizedGraphStage = useMemo(
    () =>
      runTimedStage(graphPerfDebugEnabled, () =>
        sanitizeGraphForRender(data.graph.nodes, data.graph.edges, { maxNodes: deferredMaxNodes }),
      ),
    [data.graph.edges, data.graph.nodes, deferredMaxNodes, graphPerfDebugEnabled],
  )

  const filteredGraphStage = useMemo(
    () =>
      runTimedStage(graphPerfDebugEnabled, () => {
        const toggledEdges = filterEdgesByToggles(sanitizedGraphStage.value.edges, {
          showContainsEdges: deferredShowContainsEdges,
          showCoListenEdges: deferredShowCoListenEdges,
          maxEdges: deferredMaxEdges,
        })
        return {
          nodes: sanitizedGraphStage.value.nodes,
          edges: toggledEdges,
        }
      }),
    [
      deferredMaxEdges,
      deferredShowCoListenEdges,
      deferredShowContainsEdges,
      graphPerfDebugEnabled,
      sanitizedGraphStage,
    ],
  )

  const annotatedGraphStage = useMemo(
    () =>
      runTimedStage(graphPerfDebugEnabled, () =>
        annotateGraphMetrics(filteredGraphStage.value.nodes, filteredGraphStage.value.edges),
      ),
    [filteredGraphStage, graphPerfDebugEnabled],
  )

  const laidOutGraphStage = useMemo(
    () =>
      runTimedStage(graphPerfDebugEnabled, () =>
        computeGraphLayout(annotatedGraphStage.value.nodes, annotatedGraphStage.value.edges),
      ),
    [annotatedGraphStage, graphPerfDebugEnabled],
  )

  const graph = laidOutGraphStage.value

  const analyticsStage = useMemo(
    () =>
      runTimedStage(graphPerfDebugEnabled, () =>
        computeGraphAnalytics(graph.nodes, graph.edges, { assumeAnnotatedMetrics: true }),
      ),
    [graph.edges, graph.nodes, graphPerfDebugEnabled],
  )
  const analytics = analyticsStage.value

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])
  const edgesByNodeId = useMemo(() => buildEdgesByNodeIndex(graph.edges), [graph.edges])

  const normalizedDeferredSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch])

  const searchMatches = useMemo(() => {
    if (!normalizedDeferredSearch) {
      return []
    }
    return graph.nodes.filter((node) => node.label.toLowerCase().includes(normalizedDeferredSearch)).slice(0, 12)
  }, [graph.nodes, normalizedDeferredSearch])

  useEffect(() => {
    if (selectedNodeId && nodeById.has(selectedNodeId)) {
      return
    }
    setSelectedNodeId((current) => (current && nodeById.has(current) ? current : null))
  }, [nodeById, selectedNodeId])

  useEffect(() => {
    if (!normalizedDeferredSearch) {
      return
    }
    if (selectedNodeId && nodeById.get(selectedNodeId)?.label.toLowerCase().includes(normalizedDeferredSearch)) {
      return
    }
    if (searchMatches[0]) {
      setSelectedNodeId(searchMatches[0].id)
    }
  }, [nodeById, normalizedDeferredSearch, searchMatches, selectedNodeId])

  const inspectedNode = nodeById.get(selectedNodeId ?? hoveredNodeId ?? '') ?? null

  const neighbors = useMemo(() => {
    if (!inspectedNode) {
      return []
    }
    return (edgesByNodeId.get(inspectedNode.id) ?? [])
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
  }, [edgesByNodeId, inspectedNode, nodeById])

  const hasDeferredGraphUpdate =
    deferredMaxNodes !== maxNodes ||
    deferredMaxEdges !== maxEdges ||
    deferredShowContainsEdges !== showContainsEdges ||
    deferredShowCoListenEdges !== showCoListenEdges ||
    deferredSearch !== search

  const graphStageTimings = useMemo(
    () => ({
      sanitizeMs: sanitizedGraphStage.durationMs,
      filterMs: filteredGraphStage.durationMs,
      annotateMs: annotatedGraphStage.durationMs,
      layoutMs: laidOutGraphStage.durationMs,
      analyticsMs: analyticsStage.durationMs,
    }),
    [analyticsStage.durationMs, annotatedGraphStage.durationMs, filteredGraphStage.durationMs, laidOutGraphStage.durationMs, sanitizedGraphStage.durationMs],
  )

  useEffect(() => {
    if (!graphPerfDebugEnabled) {
      return
    }

    console.debug('[MusicUniverse] graph pipeline', {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      deferredPending: hasDeferredGraphUpdate,
      ...graphStageTimings,
    })
  }, [graph.edges.length, graph.nodes.length, graphPerfDebugEnabled, graphStageTimings, hasDeferredGraphUpdate])

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
    if (last3DFailureMetricAttemptRef.current === retryKey) {
      return
    }
    last3DFailureMetricAttemptRef.current = retryKey
    last3DSuccessMetricAttemptRef.current = null
    recordMetric({
      type: 'universe_3d_init_failed',
      timestamp: new Date().toISOString(),
    })
  }, [recordMetric, retryKey])

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
    if (last3DSuccessMetricAttemptRef.current === retryKey) {
      return
    }
    last3DSuccessMetricAttemptRef.current = retryKey
    last3DFailureMetricAttemptRef.current = null
    recordMetric({
      type: 'universe_3d_init_success',
      timestamp: new Date().toISOString(),
    })
  }, [recordMetric, retryKey])

  const is3D = rendererStatus.renderer === '3d'
  const isSimpleMode = analysisMode === 'simple'
  const diagnosticMessageToneClass = isSimpleMode ? 'text-text' : 'text-text-muted'

  const selectedNodeLabel = selectedNodeId ? nodeById.get(selectedNodeId)?.label ?? null : null
  const keyboardNavigatorNodes = useMemo(
    () =>
      [...graph.nodes]
        .sort((a, b) => b.playCount - a.playCount || a.label.localeCompare(b.label))
        .slice(0, 250),
    [graph.nodes],
  )

  const keyboardNavigatorSelectedNode =
    keyboardNavigatorNodes.find((node) => node.id === selectedNodeId) ??
    (selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null)

  const handleKeyboardNavigatorStep = useCallback(
    (step: number) => {
      if (keyboardNavigatorNodes.length === 0) {
        return
      }

      const currentIndex = selectedNodeId
        ? keyboardNavigatorNodes.findIndex((node) => node.id === selectedNodeId)
        : -1
      const baseIndex = currentIndex >= 0 ? currentIndex : step > 0 ? -1 : 0
      const nextIndex = Math.min(keyboardNavigatorNodes.length - 1, Math.max(0, baseIndex + step))
      const nextNode = keyboardNavigatorNodes[nextIndex]
      if (nextNode) {
        setSelectedNodeId(nextNode.id)
      }
    },
    [keyboardNavigatorNodes, selectedNodeId],
  )

  const handleKeyboardNavigatorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target instanceof HTMLSelectElement) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        handleKeyboardNavigatorStep(1)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        handleKeyboardNavigatorStep(-1)
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        const firstNode = keyboardNavigatorNodes[0]
        if (firstNode) {
          setSelectedNodeId(firstNode.id)
        }
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        const lastNode = keyboardNavigatorNodes[keyboardNavigatorNodes.length - 1]
        if (lastNode) {
          setSelectedNodeId(lastNode.id)
        }
      }
    },
    [handleKeyboardNavigatorStep, keyboardNavigatorNodes],
  )

  const renderKey = `${is3D ? '3d' : '2d'}-${retryKey}`
  const networkDetailPanels = (
    <>
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
    </>
  )

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardTitle as="h2">Music Universe Graph</CardTitle>
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
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="space-y-3">
            <UniverseLegend />
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Search quick picks</p>
              {searchMatches.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {searchMatches.slice(0, 8).map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      className={`min-h-[44px] rounded-theme border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                        selectedNodeId === match.id
                          ? 'border-accent bg-accent/10 text-text'
                          : 'border-border text-text-muted hover:text-text'
                      }`}
                      onClick={() => setSelectedNodeId(match.id)}
                    >
                      {match.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-muted">
                  Start typing in graph search to surface artist and track quick picks.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Graph keyboard navigator</p>
            <p id="graph-keyboard-navigator-help" className="mt-1 text-xs text-text-muted">
              Use Arrow Up/Down (or Previous/Next) to move through visible nodes when canvas interaction is unavailable.
            </p>
            <div
              role="group"
              aria-label="Graph keyboard navigator"
              aria-describedby="graph-keyboard-navigator-help"
              className="mt-2 flex flex-wrap items-end gap-2"
              tabIndex={0}
              onKeyDown={handleKeyboardNavigatorKeyDown}
            >
              <label className="min-w-[15rem] flex-1 text-xs text-text-muted">
                Graph node navigator
                <select
                  className="mt-1 h-10 w-full rounded-theme border border-border bg-surface px-2 text-sm text-text"
                  aria-label="Graph node navigator"
                  value={selectedNodeId ?? ''}
                  onChange={(event) => setSelectedNodeId(event.currentTarget.value || null)}
                >
                  <option value="">No node selected</option>
                  {keyboardNavigatorNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label} · {node.type}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="min-h-[44px] rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] disabled:opacity-50"
                onClick={() => handleKeyboardNavigatorStep(-1)}
                disabled={keyboardNavigatorNodes.length === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] disabled:opacity-50"
                onClick={() => handleKeyboardNavigatorStep(1)}
                disabled={keyboardNavigatorNodes.length === 0}
              >
                Next
              </button>
            </div>
            <p role="status" aria-live="polite" className="mt-2 text-xs text-text-muted">
              {keyboardNavigatorSelectedNode
                ? `Selected graph node: ${keyboardNavigatorSelectedNode.label} (${keyboardNavigatorSelectedNode.type})`
                : 'Selected graph node: none'}
            </p>
          </div>
        </div>
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
            resetCameraToken={cameraResetKey}
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

          {renderModeAwareDeepSection(isSimpleMode, 'Deep network breakdown', networkDetailPanels)}
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
            <CardDescription className="mt-1">
              Renderer health and filtered graph totals for the currently visible network.
            </CardDescription>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Renderer health</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">Mode</dt>
                    <dd className="text-text">{rendererStatus.renderer.toUpperCase()}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">State</dt>
                    <dd className="text-text">{rendererStatus.state ?? (is3D ? '3d-ready' : '2d-manual')}</dd>
                  </div>
                </dl>
                {rendererStatus.diagnosticMessage ? (
                  <p className={`mt-2 text-xs ${diagnosticMessageToneClass}`}>{rendererStatus.diagnosticMessage}</p>
                ) : null}
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Filtered view</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">Artists</dt>
                    <dd className="text-text">{analytics.summary.artistCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">Tracks</dt>
                    <dd className="text-text">{analytics.summary.trackCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-muted">Avg weighted degree</dt>
                    <dd className="text-text">{analytics.summary.averageWeightedDegree}</dd>
                  </div>
                </dl>
              </div>
            </div>
            {graphPerfDebugEnabled ? (
              <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3 text-xs text-text-muted">
                <p className="font-medium text-text">Graph perf debug (dev only)</p>
                <p className="mt-1">
                  Deferred graph update: {hasDeferredGraphUpdate ? 'pending' : 'idle'}
                </p>
                <p className="mt-1">
                  sanitize {graphStageTimings.sanitizeMs ?? 0}ms · filter {graphStageTimings.filterMs ?? 0}ms · annotate {graphStageTimings.annotateMs ?? 0}ms
                </p>
                <p className="mt-1">
                  layout {graphStageTimings.layoutMs ?? 0}ms · analytics {graphStageTimings.analyticsMs ?? 0}ms
                </p>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}

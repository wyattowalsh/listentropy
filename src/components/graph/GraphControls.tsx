import { Slider } from '@/components/share/Slider'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { GraphFallbackReason } from '@/lib/types'

interface GraphControlsProps {
  mode: '2d' | '3d'
  onModeChange: (mode: '2d' | '3d') => void
  maxNodes: number
  onMaxNodesChange: (value: number) => void
  maxEdges: number
  onMaxEdgesChange: (value: number) => void
  search: string
  onSearchChange: (value: string) => void
  showContainsEdges: boolean
  showCoListenEdges: boolean
  onShowContainsEdgesChange: (value: boolean) => void
  onShowCoListenEdgesChange: (value: boolean) => void
  webglSupported: boolean
  fallbackReason?: GraphFallbackReason
  rendererState?: 'probing' | '3d-ready' | '3d-failed' | '2d-manual' | '2d-unsupported'
  diagnosticMessage?: string
  selectedNodeLabel?: string | null
  onResetCamera: () => void
  onRetry3D: () => void
}

export function GraphControls({
  mode,
  onModeChange,
  maxNodes,
  onMaxNodesChange,
  maxEdges,
  onMaxEdgesChange,
  search,
  onSearchChange,
  showContainsEdges,
  showCoListenEdges,
  onShowContainsEdgesChange,
  onShowCoListenEdgesChange,
  webglSupported,
  fallbackReason,
  rendererState,
  diagnosticMessage,
  selectedNodeLabel,
  onResetCamera,
  onRetry3D,
}: GraphControlsProps): JSX.Element {
  const isFallback = Boolean(fallbackReason)
  const canRetry3D = fallbackReason === 'renderer-init-failed'
  const resolvedRendererState =
    rendererState ?? (mode === '3d' ? '3d-ready' : webglSupported ? '2d-manual' : '2d-unsupported')
  const notices = [
    !webglSupported
      ? 'WebGL is not available in this browser session. 3D mode may not initialize.'
      : null,
    rendererState === 'probing' ? 'Checking 3D renderer support in this session…' : null,
    isFallback
      ? `Running in 2D fallback${
          fallbackReason === 'renderer-init-failed' ? ' after a 3D initialization failure.' : '.'
        }`
      : null,
    maxNodes > 500 ? 'High node counts may reduce frame rate on lower-end hardware.' : null,
  ].filter((notice): notice is string => Boolean(notice))

  return (
    <div className="space-y-4">
      <div className="rounded-theme border border-border bg-surface-hover p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Renderer status</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="rounded-theme border border-border bg-surface px-2 py-1 text-text">
            Mode {mode.toUpperCase()}
          </span>
          <span className="rounded-theme border border-border bg-surface px-2 py-1">
            State {resolvedRendererState}
          </span>
          {isFallback ? (
            <span className="rounded-theme border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-amber-200">
              2D fallback active
            </span>
          ) : null}
        </div>
        {diagnosticMessage ? (
          <p className="mt-2 text-xs text-text-muted">{diagnosticMessage}</p>
        ) : null}
        {selectedNodeLabel ? (
          <p className="mt-2 text-xs text-text-muted">
            Selected node: <span className="text-text">{selectedNodeLabel}</span>
          </p>
        ) : null}
        {notices.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-300">
            {notices.map((notice) => (
              <li key={notice}>• {notice}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Renderer controls</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-sm text-text-muted">
              Mode
              <Select
                className="ml-2 min-w-[6.5rem]"
                value={mode}
                onChange={(event) => onModeChange(event.currentTarget.value as '2d' | '3d')}
              >
                <option value="3d">3D</option>
                <option value="2d">2D</option>
              </Select>
            </label>
            {canRetry3D ? (
              <button
                type="button"
                className="min-h-10 rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent"
                onClick={onRetry3D}
              >
                Retry 3D
              </button>
            ) : null}
            {mode === '3d' ? (
              <button
                type="button"
                className="min-h-10 rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent"
                onClick={onResetCamera}
              >
                Reset Camera
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Use retry after fallback errors and reset camera after large drag/zoom movements.
          </p>
        </div>

        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Graph density</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Slider
              value={maxNodes}
              min={50}
              max={2000}
              step={10}
              label={`Max nodes: ${maxNodes}`}
              onChange={onMaxNodesChange}
            />
            <Slider
              value={maxEdges}
              min={20}
              max={500}
              step={5}
              label={`Max edges: ${maxEdges}`}
              onChange={onMaxEdgesChange}
            />
          </div>
        </div>
      </div>

      <div className="rounded-theme border border-border bg-surface-hover p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Search and edge filters</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={search}
            aria-label="Search artist or track in graph"
            placeholder="Search artist or track in graph…"
            onChange={(event) => onSearchChange(event.currentTarget.value)}
          />
          <fieldset className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <legend className="sr-only">Edge visibility</legend>
            <label className={cn('inline-flex min-h-10 items-center gap-2 rounded-theme border border-border px-3 py-2')}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={showCoListenEdges}
                onChange={(event) => onShowCoListenEdgesChange(event.currentTarget.checked)}
              />
              Co-listen edges
            </label>
            <label className={cn('inline-flex min-h-10 items-center gap-2 rounded-theme border border-border px-3 py-2')}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={showContainsEdges}
                onChange={(event) => onShowContainsEdgesChange(event.currentTarget.checked)}
              />
              Contains edges
            </label>
          </fieldset>
        </div>
      </div>
    </div>
  )
}

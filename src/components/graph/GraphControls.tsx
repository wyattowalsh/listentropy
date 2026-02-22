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

  return (
    <div className="space-y-3">
      {!webglSupported ? (
        <p className="text-xs text-amber-300">
          WebGL is not available in this browser session. 3D mode may not initialize.
        </p>
      ) : null}
      {rendererState === 'probing' ? (
        <p className="text-xs text-amber-300">Checking 3D renderer support in this session…</p>
      ) : null}
      {isFallback ? (
        <p className="text-xs text-amber-300">
          Running in 2D fallback
          {fallbackReason === 'renderer-init-failed' ? ' after a 3D initialization failure.' : '.'}
        </p>
      ) : null}
      {diagnosticMessage ? (
        <p className="text-xs text-text-muted">{diagnosticMessage}</p>
      ) : null}
      {maxNodes > 500 ? (
        <p className="text-xs text-amber-300">
          High node counts may reduce frame rate on lower-end hardware.
        </p>
      ) : null}
      {selectedNodeLabel ? (
        <p className="text-xs text-text-muted">
          Selected node: <span className="text-text">{selectedNodeLabel}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-text-muted">
          Mode
          <Select
            className="ml-2"
            value={mode}
            onChange={(event) => onModeChange(event.currentTarget.value as '2d' | '3d')}
          >
            <option value="3d">3D</option>
            <option value="2d">2D</option>
          </Select>
        </label>
        <div className="w-64">
          <Slider
            value={maxNodes}
            min={50}
            max={2000}
            step={10}
            label={`Max nodes: ${maxNodes}`}
            onChange={onMaxNodesChange}
          />
        </div>
        <div className="w-64">
          <Slider
            value={maxEdges}
            min={20}
            max={500}
            step={5}
            label={`Max edges: ${maxEdges}`}
            onChange={onMaxEdgesChange}
          />
        </div>
        {canRetry3D ? (
          <button
            type="button"
            className="rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent"
            onClick={onRetry3D}
          >
            Retry 3D
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent"
          onClick={onResetCamera}
        >
          Reset Camera
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={search}
          placeholder="Search artist or track in graph…"
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <label className={cn('inline-flex items-center gap-2 rounded-theme border border-border px-2 py-1')}>
            <input
              type="checkbox"
              checked={showCoListenEdges}
              onChange={(event) => onShowCoListenEdgesChange(event.currentTarget.checked)}
            />
            Co-listen edges
          </label>
          <label className={cn('inline-flex items-center gap-2 rounded-theme border border-border px-2 py-1')}>
            <input
              type="checkbox"
              checked={showContainsEdges}
              onChange={(event) => onShowContainsEdgesChange(event.currentTarget.checked)}
            />
            Contains edges
          </label>
        </div>
      </div>
    </div>
  )
}

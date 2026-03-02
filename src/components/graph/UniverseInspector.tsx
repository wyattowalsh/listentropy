import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { GraphNode } from '@/lib/types'
import { formatCompact, formatHours } from '@/lib/utils'

interface UniverseInspectorProps {
  node: GraphNode | null
  neighbors: Array<{ id: string; label: string; type: GraphNode['type']; weight: number }>
  onFocusSelected?: () => void
  onClearSelected?: () => void
}

export function UniverseInspector({
  node,
  neighbors,
  onFocusSelected,
  onClearSelected,
}: UniverseInspectorProps): JSX.Element {
  if (!node) {
    return (
      <Card>
        <CardTitle>Graph Inspector</CardTitle>
        <CardDescription className="mt-2">
          Hover or select a node in 3D mode, or use search to inspect an artist/track.
        </CardDescription>
        <ul className="mt-3 space-y-1 text-xs text-text-muted">
          <li>• Use search chips for touch-friendly node jumps.</li>
          <li>• Use keyboard navigator buttons when canvas interaction is limited.</li>
          <li>• Node details and neighbors appear here after selection.</li>
        </ul>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{node.label}</CardTitle>
          <CardDescription className="mt-1">
            {node.type} · plays {formatCompact(node.playCount)} · {formatHours(node.totalMs)}h
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onFocusSelected ? (
            <button
              type="button"
              className="min-h-10 rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent"
              onClick={onFocusSelected}
            >
              Focus Selected
            </button>
          ) : null}
          {onClearSelected ? (
            <button
              type="button"
              className="min-h-10 rounded-theme border border-border px-3 py-2 text-sm text-text transition hover:border-accent hover:text-accent"
              onClick={onClearSelected}
            >
              Clear Selection
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Community</p>
          <p className="mt-1 text-sm text-text">{node.communityId ?? node.cluster ?? 'N/A'}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Degree</p>
          <p className="mt-1 text-sm text-text">{node.degree ?? 0}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Weighted Degree</p>
          <p className="mt-1 text-sm text-text">{formatCompact(node.weightedDegree ?? 0)}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">First Listen</p>
          <p className="mt-1 text-sm text-text">{node.firstListen}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Neighbors</p>
          <p className="text-xs text-text-muted">{Math.min(neighbors.length, 8)} shown</p>
        </div>
        {neighbors.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No visible neighbors in the current filtered graph.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {neighbors.slice(0, 8).map((neighbor, index) => (
              <li
                key={`${neighbor.id}-${neighbor.weight}`}
                className="flex items-center justify-between gap-2 rounded-theme border border-border bg-surface-hover px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-text">{neighbor.label}</p>
                  <p className="text-xs text-text-muted">{neighbor.type}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-text-muted">#{index + 1}</p>
                  <p className="text-xs text-text-muted">weight {neighbor.weight}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

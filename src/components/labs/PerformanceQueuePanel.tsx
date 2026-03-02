import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { LabModuleManifest } from '@/lib/types'

interface QueueItemView {
  key: string
  moduleId: string
  status: string
  startedAt: string
  finishedAt?: string
}

interface PerformanceQueuePanelProps {
  queue: QueueItemView[]
  manifestsById: Record<string, LabModuleManifest>
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running': return 'In progress'
    case 'ready': return 'Complete'
    case 'error': return 'Failed'
    case 'unsupported': return 'Unsupported'
    default: return status
  }
}

function statusTone(status: string): string {
  switch (status) {
    case 'running': return 'border-accent/40 bg-accent/10 text-accent'
    case 'ready': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'error': return 'border-negative/40 bg-negative/10 text-negative'
    case 'unsupported': return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    default: return 'border-border bg-surface text-text-muted'
  }
}

export function PerformanceQueuePanel({ queue, manifestsById }: PerformanceQueuePanelProps): JSX.Element {
  return (
    <Card>
      <CardTitle>Performance Queue</CardTitle>
      <CardDescription className="mt-1">Recent deferred compute jobs and their current status.</CardDescription>
      {queue.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No Xenolab jobs have been run yet.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {queue.map((item) => (
            <li key={item.key} className="rounded-theme border border-border bg-surface-hover p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-text">{manifestsById[item.moduleId]?.name ?? item.moduleId}</span>
                <span className={`rounded-theme border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${statusTone(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                started {item.startedAt.slice(11, 19)}{item.finishedAt ? ` · finished ${item.finishedAt.slice(11, 19)}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

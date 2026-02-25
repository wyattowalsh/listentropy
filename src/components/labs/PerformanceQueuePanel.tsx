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
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-text">{manifestsById[item.moduleId]?.name ?? item.moduleId}</span>
                <span className="text-xs text-text-muted">{item.status}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                started {item.startedAt.slice(11, 19)}{item.finishedAt ? ` · finished ${item.finishedAt.slice(11, 19)}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

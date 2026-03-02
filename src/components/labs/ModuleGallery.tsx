import { ModuleResultCard } from '@/components/labs/ModuleResultCard'
import type { LabModuleId, LabModuleManifest, LabModuleResult, LabModuleStatus } from '@/lib/types'

interface ModuleGalleryProps {
  manifests: LabModuleManifest[]
  statuses: Partial<Record<LabModuleId, LabModuleStatus>>
  results: Partial<Record<LabModuleId, LabModuleResult>>
  onRun: (moduleId: LabModuleId) => void
  onRetry: (moduleId: LabModuleId) => void
  onExplain: (moduleId: LabModuleId) => void
}

export function ModuleGallery({ manifests, statuses, results, onRun, onRetry, onExplain }: ModuleGalleryProps): JSX.Element {
  const ordered = [...manifests].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name))
  const featured = ordered.filter((manifest) => manifest.featured)
  const standard = ordered.filter((manifest) => !manifest.featured)
  const readyCount = ordered.filter((manifest) => statuses[manifest.id] === 'ready').length

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-theme border border-border bg-surface-hover p-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Total</p>
          <p className="mt-1 text-sm text-text">{ordered.length}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Ready</p>
          <p className="mt-1 text-sm text-text">{readyCount}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Deferred</p>
          <p className="mt-1 text-sm text-text">{ordered.length - readyCount}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {featured.map((manifest) => (
          <ModuleResultCard
            key={manifest.id}
            manifest={manifest}
            status={statuses[manifest.id] ?? 'idle'}
            result={results[manifest.id]}
            onRun={() => onRun(manifest.id)}
            onRetry={() => onRetry(manifest.id)}
            onExplain={() => onExplain(manifest.id)}
          />
        ))}
      </div>

      {standard.length ? (
        <details className="rounded-theme border border-border bg-surface-hover p-3">
          <summary className="cursor-pointer text-sm text-text">Additional Modules ({standard.length})</summary>
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            {standard.map((manifest) => (
              <ModuleResultCard
                key={manifest.id}
                manifest={manifest}
                status={statuses[manifest.id] ?? 'idle'}
                result={results[manifest.id]}
                onRun={() => onRun(manifest.id)}
                onRetry={() => onRetry(manifest.id)}
                onExplain={() => onExplain(manifest.id)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

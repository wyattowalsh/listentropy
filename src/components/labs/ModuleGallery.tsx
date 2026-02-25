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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {ordered.map((manifest) => (
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
  )
}

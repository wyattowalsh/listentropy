import { Suspense, lazy, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type {
  ChronotypeDriftPayload,
  LabDatasetSnapshot,
  LabModuleId,
  LabModuleResult,
  LabSceneId,
  LabSceneManifest,
  ProcessedDataModel,
  StabilityChaosPayload,
} from '@/lib/types'

const IntentSankeyScene = lazy(() => import('@/components/lab-scenes/flow').then((module) => ({ default: module.IntentSankeyScene })))
const ChronomapRidgelinesScene = lazy(() => import('@/components/lab-scenes/temporal').then((module) => ({ default: module.ChronomapRidgelinesScene })))
const EntropyPhasePortraitScene = lazy(() => import('@/components/lab-scenes/temporal').then((module) => ({ default: module.EntropyPhasePortraitScene })))
const UniverseTimeSliderScene = lazy(() => import('@/components/lab-scenes/graph').then((module) => ({ default: module.UniverseTimeSliderScene })))

interface SceneGalleryProps {
  data: ProcessedDataModel
  snapshot: LabDatasetSnapshot
  selectedSceneId: LabSceneId | null
  onSelectScene: (sceneId: LabSceneId) => void
  manifests: LabSceneManifest[]
  moduleResults: Partial<Record<LabModuleId, LabModuleResult>>
}

function asPayload<T>(result: LabModuleResult | undefined): T | undefined {
  return result?.status === 'ready' ? (result.payload as T) : undefined
}

export function SceneGallery({ data, snapshot, selectedSceneId, onSelectScene, manifests, moduleResults }: SceneGalleryProps): JSX.Element {
  const selected = selectedSceneId ?? manifests.find((manifest) => manifest.featured && !manifest.comingSoon)?.id ?? manifests[0]?.id
  const manifestById = useMemo(() => Object.fromEntries(manifests.map((manifest) => [manifest.id, manifest])) as Record<LabSceneId, LabSceneManifest>, [manifests])
  const featured = manifests.filter((manifest) => manifest.featured || !manifest.comingSoon)
  const experimental = manifests.filter((manifest) => !manifest.featured && manifest.comingSoon)

  const currentManifest = selected ? manifestById[selected] : undefined

  let scene: JSX.Element | null = null
  if (selected === 'intent-sankey') {
    scene = <IntentSankeyScene data={data} />
  } else if (selected === 'chronomap-ridgelines') {
    scene = <ChronomapRidgelinesScene payload={asPayload<ChronotypeDriftPayload>(moduleResults['chronotype-drift'])} />
  } else if (selected === 'entropy-phase-portrait') {
    scene = <EntropyPhasePortraitScene payload={asPayload<StabilityChaosPayload>(moduleResults['stability-chaos'])} />
  } else if (selected === 'universe-time-slider') {
    scene = <UniverseTimeSliderScene snapshot={snapshot} />
  } else {
    scene = (
      <Card>
        <CardTitle>{currentManifest?.name ?? 'Scene'}</CardTitle>
        <CardDescription className="mt-2">Coming soon in a future Xenolab train.</CardDescription>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Visual Scene Gallery</CardTitle>
        <CardDescription className="mt-1">Exotic visualizations layered on top of core and deferred Xenolab analytics.</CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          {featured.map((manifest) => (
            <Button
              key={manifest.id}
              variant={selected === manifest.id ? 'default' : 'outline'}
              onClick={() => onSelectScene(manifest.id)}
            >
              {manifest.name}
              {manifest.comingSoon ? ' (Soon)' : ''}
            </Button>
          ))}
        </div>
        {experimental.length ? (
          <details className="mt-3 rounded-theme border border-border bg-surface p-2">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-text-muted">
              Experimental Scenes ({experimental.length})
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {experimental.map((manifest) => (
                <Button
                  key={manifest.id}
                  variant={selected === manifest.id ? 'default' : 'outline'}
                  onClick={() => onSelectScene(manifest.id)}
                  className="h-8 px-2 text-xs"
                >
                  {manifest.name}
                  {manifest.comingSoon ? ' (Soon)' : ''}
                </Button>
              ))}
            </div>
          </details>
        ) : null}
        {currentManifest ? (
          <div className="mt-3 rounded-theme border border-border bg-surface-hover p-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Selected Scene</p>
            <p className="mt-1 text-sm text-text">{currentManifest.name}</p>
            <p className="mt-1 text-xs text-text-muted">{currentManifest.description}</p>
          </div>
        ) : null}
      </Card>
      <Suspense
        fallback={
          <Card>
            <CardTitle>Loading scene…</CardTitle>
            <CardDescription className="mt-2">Preparing Xenolab visualization.</CardDescription>
          </Card>
        }
      >
        {scene}
      </Suspense>
    </div>
  )
}

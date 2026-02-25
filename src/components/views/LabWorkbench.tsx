import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  CompareWorkspacePanel,
  ExplainabilityDrawer,
  ModuleGallery,
  PerformanceQueuePanel,
  SceneGallery,
  SpotifyConnectCard,
} from '@/components/labs'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { buildDefaultLabDatasetSnapshot, labModuleManifests, labSceneManifests } from '@/lib/labs/registry'
import type { CompareEnginePayload, LabModuleId, ProcessedDataModel } from '@/lib/types'
import { useAudioTraitStore } from '@/store/useAudioTraitStore'
import { useLabStore } from '@/store/useLabStore'

interface LabWorkbenchProps {
  data: ProcessedDataModel
}

export function LabWorkbench({ data }: LabWorkbenchProps): JSX.Element {
  const snapshot = useMemo(() => buildDefaultLabDatasetSnapshot(data), [data])
  const datasetFingerprint = data.datasetIdentity.fingerprint

  const {
    moduleStatusByDataset,
    moduleResultsByDataset,
    queue,
    selectedSceneId,
    compareBaselineSnapshot,
    compareImportedSnapshot,
    compareSnapshotLibrary,
    compareSelectedBaselineSnapshotId,
    compareScopeId,
    compareBaselineEraId,
    compareCurrentEraId,
    compareImportMode,
    compareImportProgress,
    compareImportError,
    explainabilityTarget,
    setSelectedSceneId,
    setExplainabilityTarget,
    captureCompareBaseline,
    clearCompareBaseline,
    ingestCompareZip,
    clearImportedCompareSnapshot,
    useImportedCompareAsBaseline,
    setCompareBaselineFromLibrary,
    removeCompareSnapshot,
    setCompareScopeId,
    setCompareBaselineEraId,
    setCompareCurrentEraId,
    runModule,
    retryModule,
    runCompareAgainstBaseline,
  } = useLabStore(useShallow((state) => ({
    moduleStatusByDataset: state.moduleStatusByDataset,
    moduleResultsByDataset: state.moduleResultsByDataset,
    queue: state.queue,
    selectedSceneId: state.selectedSceneId,
    compareBaselineSnapshot: state.compareBaselineSnapshot,
    compareImportedSnapshot: state.compareImportedSnapshot,
    compareSnapshotLibrary: state.compareSnapshotLibrary,
    compareSelectedBaselineSnapshotId: state.compareSelectedBaselineSnapshotId,
    compareScopeId: state.compareScopeId,
    compareBaselineEraId: state.compareBaselineEraId,
    compareCurrentEraId: state.compareCurrentEraId,
    compareImportMode: state.compareImportMode,
    compareImportProgress: state.compareImportProgress,
    compareImportError: state.compareImportError,
    explainabilityTarget: state.explainabilityTarget,
    setSelectedSceneId: state.setSelectedSceneId,
    setExplainabilityTarget: state.setExplainabilityTarget,
    captureCompareBaseline: state.captureCompareBaseline,
    clearCompareBaseline: state.clearCompareBaseline,
    ingestCompareZip: state.ingestCompareZip,
    clearImportedCompareSnapshot: state.clearImportedCompareSnapshot,
    useImportedCompareAsBaseline: state.useImportedCompareAsBaseline,
    setCompareBaselineFromLibrary: state.setCompareBaselineFromLibrary,
    removeCompareSnapshot: state.removeCompareSnapshot,
    setCompareScopeId: state.setCompareScopeId,
    setCompareBaselineEraId: state.setCompareBaselineEraId,
    setCompareCurrentEraId: state.setCompareCurrentEraId,
    runModule: state.runModule,
    retryModule: state.retryModule,
    runCompareAgainstBaseline: state.runCompareAgainstBaseline,
  })))

  const statuses = moduleStatusByDataset[datasetFingerprint] ?? {}
  const results = moduleResultsByDataset[datasetFingerprint] ?? {}
  const audioTraitSnapshot = useAudioTraitStore((state) => state.snapshotByDatasetFingerprint[datasetFingerprint] ?? null)

  const manifestsById = useMemo(
    () => Object.fromEntries(labModuleManifests.map((manifest) => [manifest.id, manifest])) as Record<string, (typeof labModuleManifests)[number]>,
    [],
  )

  const explainManifest = explainabilityTarget ? manifestsById[explainabilityTarget.moduleId] : undefined
  const explainResult = explainabilityTarget ? moduleResultsByDataset[explainabilityTarget.datasetFingerprint]?.[explainabilityTarget.moduleId] : undefined
  const compareResult = results['compare-engine']
  const comparePayload = compareResult?.status === 'ready' ? (compareResult.payload as CompareEnginePayload) : undefined

  useEffect(() => {
    if (compareBaselineEraId && compareBaselineSnapshot) {
      const baselineHasSelectedEra = compareBaselineSnapshot.eras.some((era) => era.id === compareBaselineEraId)
      if (!baselineHasSelectedEra) {
        setCompareBaselineEraId(null)
      }
    }

    if (compareCurrentEraId) {
      const currentHasSelectedEra = snapshot.eras.some((era) => era.id === compareCurrentEraId)
      if (!currentHasSelectedEra) {
        setCompareCurrentEraId(null)
      }
    }
  }, [
    compareBaselineEraId,
    compareBaselineSnapshot,
    compareCurrentEraId,
    setCompareBaselineEraId,
    setCompareCurrentEraId,
    snapshot,
  ])

  function handleRun(moduleId: LabModuleId): void {
    if (moduleId === 'audio-affect-overlay' && audioTraitSnapshot) {
      void runModule(snapshot, moduleId, { audioTraitSnapshot })
      return
    }
    if (moduleId === 'compare-engine' && compareBaselineSnapshot) {
      void runModule(snapshot, moduleId, {
        baselineSnapshot: compareBaselineSnapshot,
        scopeId: compareScopeId,
        baselineEraId: compareBaselineEraId,
        currentEraId: compareCurrentEraId,
      })
      return
    }
    void runModule(snapshot, moduleId)
  }

  function handleRetry(moduleId: LabModuleId): void {
    if (moduleId === 'audio-affect-overlay' && audioTraitSnapshot) {
      void retryModule(snapshot, moduleId, { audioTraitSnapshot })
      return
    }
    if (moduleId === 'compare-engine' && compareBaselineSnapshot) {
      void retryModule(snapshot, moduleId, {
        baselineSnapshot: compareBaselineSnapshot,
        scopeId: compareScopeId,
        baselineEraId: compareBaselineEraId,
        currentEraId: compareCurrentEraId,
      })
      return
    }
    void retryModule(snapshot, moduleId)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Xenolab</CardTitle>
        <CardDescription className="mt-1">
          Deferred, privacy-first analytics lab. Heavy modules run on demand and stay local to this browser session.
        </CardDescription>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Dataset fingerprint</p>
            <p className="mt-1 truncate text-sm text-text">{datasetFingerprint}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Model version</p>
            <p className="mt-1 text-sm text-text">v{data.modelVersion}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Records</p>
            <p className="mt-1 text-sm text-text">{data.datasetIdentity.recordCount.toLocaleString()}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Timezone mode</p>
            <p className="mt-1 text-sm text-text">{data.timezoneMode}</p>
          </div>
        </div>
      </Card>

      <SpotifyConnectCard
        dataset={snapshot}
        audioAffectStatus={statuses['audio-affect-overlay'] ?? 'idle'}
        onRunAudioAffectOverlay={() => handleRun('audio-affect-overlay')}
      />

      <section className="space-y-4" aria-labelledby="xenolab-module-gallery">
        <div>
          <h2 id="xenolab-module-gallery" className="font-heading text-xl text-text">Module Gallery</h2>
          <p className="mt-1 text-sm text-text-muted">Launch analytics modules on demand. Results are cached per dataset fingerprint.</p>
        </div>
        <ModuleGallery
          manifests={labModuleManifests}
          statuses={statuses}
          results={results}
          onRun={handleRun}
          onRetry={handleRetry}
          onExplain={(moduleId) => setExplainabilityTarget({ datasetFingerprint, moduleId })}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]" aria-labelledby="xenolab-scenes">
        <div className="min-w-0 space-y-4">
          <div>
            <h2 id="xenolab-scenes" className="font-heading text-xl text-text">Visual Scene Gallery</h2>
            <p className="mt-1 text-sm text-text-muted">Explorable scenes layered on core analytics and Xenolab module outputs.</p>
          </div>
          <SceneGallery
            data={data}
            snapshot={snapshot}
            selectedSceneId={selectedSceneId}
            onSelectScene={setSelectedSceneId}
            manifests={labSceneManifests}
            moduleResults={results}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div aria-labelledby="xenolab-compare-workspace">
            <h2 id="xenolab-compare-workspace" className="font-heading text-xl text-text">Compare Workspace</h2>
            <CompareWorkspacePanel
              currentSnapshot={snapshot}
              baselineSnapshot={compareBaselineSnapshot}
              importedSnapshot={compareImportedSnapshot}
              savedSnapshots={compareSnapshotLibrary}
              selectedBaselineSnapshotId={compareSelectedBaselineSnapshotId}
              scopeId={compareScopeId}
              baselineEraId={compareBaselineEraId}
              currentEraId={compareCurrentEraId}
              importMode={compareImportMode}
              importProgress={compareImportProgress}
              importError={compareImportError}
              compareStatus={statuses['compare-engine'] ?? 'idle'}
              compareResult={compareResult}
              onCaptureBaseline={() => captureCompareBaseline(snapshot)}
              onClearBaseline={clearCompareBaseline}
              onImportCompareFile={(file) => {
                void ingestCompareZip(file, data.timezoneMode)
              }}
              onClearImported={clearImportedCompareSnapshot}
              onUseImportedAsBaseline={useImportedCompareAsBaseline}
              onUseSavedSnapshotAsBaseline={setCompareBaselineFromLibrary}
              onRemoveSavedSnapshot={removeCompareSnapshot}
              onSetScopeId={setCompareScopeId}
              onSetBaselineEraId={setCompareBaselineEraId}
              onSetCurrentEraId={setCompareCurrentEraId}
              onRunCompare={() => {
                void runCompareAgainstBaseline(snapshot)
              }}
              onExplainCompare={() => setExplainabilityTarget({ datasetFingerprint, moduleId: 'compare-engine' })}
            />
            {comparePayload ? (
              <p className="mt-2 text-xs text-text-muted">
                Baseline {comparePayload.baseline.recordCount.toLocaleString()} records vs current {comparePayload.current.recordCount.toLocaleString()} records.
              </p>
            ) : null}
          </div>

          <div aria-labelledby="xenolab-counterfactuals">
            <h2 id="xenolab-counterfactuals" className="font-heading text-xl text-text">Counterfactuals</h2>
            <p className="mt-1 text-sm text-text-muted">Run the Counterfactuals module to populate this panel with scenario deltas.</p>
            <Card className="mt-2">
              <CardDescription>
                Quick path: run <span className="font-semibold text-text">Counterfactuals</span> in the Module Gallery, then inspect the result card and Explainability panel.
              </CardDescription>
            </Card>
          </div>

          <div aria-labelledby="xenolab-explainability">
            <h2 id="xenolab-explainability" className="font-heading text-xl text-text">Explainability Drawer</h2>
            <ExplainabilityDrawer
              manifest={explainManifest}
              result={explainResult}
              onClose={() => setExplainabilityTarget(null)}
            />
          </div>

          <div aria-labelledby="xenolab-perf-queue">
            <h2 id="xenolab-perf-queue" className="font-heading text-xl text-text">Performance Queue</h2>
            <PerformanceQueuePanel queue={queue} manifestsById={manifestsById} />
          </div>
        </div>
      </section>
    </div>
  )
}

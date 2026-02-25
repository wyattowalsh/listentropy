import { create } from 'zustand'

import { parseSpotifyZip } from '@/lib/data/parser'
import { runDataProcessorWorkerTask } from '@/lib/data/runDataProcessorWorkerTask'
import { normalizeUploadError } from '@/lib/data/upload-errors'
import { buildDefaultLabDatasetSnapshot } from '@/lib/labs/registry'
import { runLabModuleWithFallback } from '@/lib/labs/worker-client'
import { processRecords } from '@/lib/processor'
import type {
  CompareEngineScopeId,
  LabCompareSnapshotEntry,
  LabCompareSnapshotSource,
  LabDatasetSnapshot,
  LabModuleId,
  LabModuleResult,
  LabModuleStatus,
  LabSceneId,
  ParseProgress,
  ProcessedDataModel,
  TimezoneMode,
} from '@/lib/types'

interface QueueItem {
  key: string
  datasetFingerprint: string
  moduleId: LabModuleId
  status: Extract<LabModuleStatus, 'running' | 'ready' | 'error' | 'unsupported'>
  startedAt: string
  finishedAt?: string
}

interface ExplainabilityTarget {
  datasetFingerprint: string
  moduleId: LabModuleId
}

type CompareImportMode = 'idle' | 'parsing' | 'ready' | 'error'

interface LabState {
  selectedModuleId: LabModuleId | null
  selectedSceneId: LabSceneId | null
  compareBaselineSnapshot: LabDatasetSnapshot | null
  compareImportedSnapshot: LabDatasetSnapshot | null
  compareSnapshotLibrary: LabCompareSnapshotEntry[]
  compareSelectedBaselineSnapshotId: string | null
  compareScopeId: CompareEngineScopeId
  compareBaselineEraId: string | null
  compareCurrentEraId: string | null
  compareImportMode: CompareImportMode
  compareImportProgress: ParseProgress | null
  compareImportError: string | null
  moduleStatusByDataset: Record<string, Partial<Record<LabModuleId, LabModuleStatus>>>
  moduleResultsByDataset: Record<string, Partial<Record<LabModuleId, LabModuleResult>>>
  lastErrorByModule: Partial<Record<LabModuleId, string>>
  queue: QueueItem[]
  explainabilityTarget: ExplainabilityTarget | null
  setSelectedModuleId: (moduleId: LabModuleId | null) => void
  setSelectedSceneId: (sceneId: LabSceneId | null) => void
  setCompareScopeId: (scopeId: CompareEngineScopeId) => void
  setCompareBaselineEraId: (eraId: string | null) => void
  setCompareCurrentEraId: (eraId: string | null) => void
  saveCompareSnapshot: (dataset: LabDatasetSnapshot, source: LabCompareSnapshotSource, label?: string) => string
  captureCompareBaseline: (dataset: LabDatasetSnapshot) => void
  clearCompareBaseline: () => void
  ingestCompareZip: (file: File, timezoneMode: TimezoneMode) => Promise<void>
  clearImportedCompareSnapshot: () => void
  useImportedCompareAsBaseline: () => void
  setCompareBaselineFromLibrary: (snapshotId: string) => void
  removeCompareSnapshot: (snapshotId: string) => void
  setExplainabilityTarget: (target: ExplainabilityTarget | null) => void
  clearDatasetResults: (datasetFingerprint: string) => void
  runModule: (dataset: LabDatasetSnapshot, moduleId: LabModuleId, options?: Record<string, unknown>) => Promise<void>
  retryModule: (dataset: LabDatasetSnapshot, moduleId: LabModuleId, options?: Record<string, unknown>) => Promise<void>
  runCompareAgainstBaseline: (dataset: LabDatasetSnapshot) => Promise<void>
  getModuleResult: (datasetFingerprint: string, moduleId: LabModuleId) => LabModuleResult | undefined
}

function queueKey(datasetFingerprint: string, moduleId: LabModuleId): string {
  return `${datasetFingerprint}:${moduleId}`
}

function upsertQueue(queue: QueueItem[], nextItem: QueueItem): QueueItem[] {
  const index = queue.findIndex((item) => item.key === nextItem.key)
  if (index === -1) {
    return [nextItem, ...queue].slice(0, 20)
  }
  const copy = [...queue]
  copy[index] = nextItem
  return copy
}

function compareSnapshotId(snapshot: LabDatasetSnapshot): string {
  return `cmp-${snapshot.datasetIdentity.fingerprint}`
}

function compareSnapshotLabel(
  snapshot: LabDatasetSnapshot,
  source: LabCompareSnapshotSource,
): string {
  const sourceLabel = source === 'captured-current' ? 'Captured Current' : 'Imported Zip'
  return `${sourceLabel} · ${snapshot.datasetIdentity.recordCount.toLocaleString()} records · ${snapshot.timezoneMode.toUpperCase()}`
}

function upsertCompareSnapshotLibrary(
  library: LabCompareSnapshotEntry[],
  entry: LabCompareSnapshotEntry,
): LabCompareSnapshotEntry[] {
  const existingIndex = library.findIndex((item) => item.fingerprint === entry.fingerprint)
  if (existingIndex === -1) {
    return [entry, ...library].slice(0, 8)
  }
  const copy = [...library]
  copy[existingIndex] = {
    ...copy[existingIndex],
    ...entry,
  }
  return copy
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 8)
}

async function processCompareZipWithMainThread(
  file: File,
  timezoneMode: TimezoneMode,
  set: (partial: Partial<LabState>) => void,
): Promise<ProcessedDataModel> {
  const records = await parseSpotifyZip(file, {
    onProgress(progress) {
      set({ compareImportProgress: progress })
    },
  })
  return processRecords(records, {
    timezoneMode,
    onProgress(progress) {
      set({ compareImportProgress: progress })
    },
  })
}

async function processCompareZipWithWorker(
  file: File,
  timezoneMode: TimezoneMode,
  set: (partial: Partial<LabState>) => void,
): Promise<ProcessedDataModel> {
  return runDataProcessorWorkerTask(
    { type: 'process-zip', file, timezoneMode },
    {
      onProgress(progress) {
        set({ compareImportProgress: progress })
      },
    },
  )
}

export const useLabStore = create<LabState>((set, get) => ({
  selectedModuleId: null,
  selectedSceneId: 'intent-sankey',
  compareBaselineSnapshot: null,
  compareImportedSnapshot: null,
  compareSnapshotLibrary: [],
  compareSelectedBaselineSnapshotId: null,
  compareScopeId: 'all',
  compareBaselineEraId: null,
  compareCurrentEraId: null,
  compareImportMode: 'idle',
  compareImportProgress: null,
  compareImportError: null,
  moduleStatusByDataset: {},
  moduleResultsByDataset: {},
  lastErrorByModule: {},
  queue: [],
  explainabilityTarget: null,
  setSelectedModuleId: (moduleId) => set({ selectedModuleId: moduleId }),
  setSelectedSceneId: (sceneId) => set({ selectedSceneId: sceneId }),
  setCompareScopeId: (scopeId) => set({ compareScopeId: scopeId }),
  setCompareBaselineEraId: (eraId) => set({ compareBaselineEraId: eraId }),
  setCompareCurrentEraId: (eraId) => set({ compareCurrentEraId: eraId }),
  saveCompareSnapshot: (dataset, source, label) => {
    const id = compareSnapshotId(dataset)
    const entry: LabCompareSnapshotEntry = {
      id,
      fingerprint: dataset.datasetIdentity.fingerprint,
      source,
      label: label ?? compareSnapshotLabel(dataset, source),
      savedAt: new Date().toISOString(),
      snapshot: dataset,
    }
    set((state) => ({
      compareSnapshotLibrary: upsertCompareSnapshotLibrary(state.compareSnapshotLibrary, entry),
    }))
    return id
  },
  captureCompareBaseline: (dataset) => {
    const id = get().saveCompareSnapshot(dataset, 'captured-current')
    set({
      compareBaselineSnapshot: dataset,
      compareSelectedBaselineSnapshotId: id,
      compareBaselineEraId: null,
    })
  },
  clearCompareBaseline: () => set({
    compareBaselineSnapshot: null,
    compareSelectedBaselineSnapshotId: null,
    compareBaselineEraId: null,
  }),
  ingestCompareZip: async (file, timezoneMode) => {
    set({
      compareImportMode: 'parsing',
      compareImportError: null,
      compareImportProgress: {
        stage: 'loading',
        filesParsed: 0,
        totalFiles: 0,
        recordsParsed: 0,
      },
    })

    try {
      const processed =
        typeof Worker !== 'undefined'
          ? await processCompareZipWithWorker(file, timezoneMode, set)
          : await processCompareZipWithMainThread(file, timezoneMode, set)
      const snapshot = buildDefaultLabDatasetSnapshot(processed)
      const savedId = get().saveCompareSnapshot(snapshot, 'imported-zip')
      set({
        compareImportedSnapshot: snapshot,
        compareBaselineSnapshot: snapshot,
        compareSelectedBaselineSnapshotId: savedId,
        compareBaselineEraId: null,
        compareImportMode: 'ready',
        compareImportProgress: null,
        compareImportError: null,
      })
    } catch (error) {
      set({
        compareImportMode: 'error',
        compareImportError: normalizeUploadError(error),
        compareImportProgress: null,
      })
    }
  },
  clearImportedCompareSnapshot: () =>
    set((state) => ({
      compareImportedSnapshot: null,
      compareImportMode: 'idle',
      compareImportProgress: null,
      compareImportError: null,
      compareBaselineSnapshot:
        state.compareImportedSnapshot &&
        state.compareBaselineSnapshot?.datasetIdentity.fingerprint === state.compareImportedSnapshot.datasetIdentity.fingerprint
          ? null
          : state.compareBaselineSnapshot,
      compareBaselineEraId:
        state.compareImportedSnapshot &&
        state.compareBaselineSnapshot?.datasetIdentity.fingerprint === state.compareImportedSnapshot.datasetIdentity.fingerprint
          ? null
          : state.compareBaselineEraId,
      compareSelectedBaselineSnapshotId:
        state.compareImportedSnapshot &&
        state.compareSelectedBaselineSnapshotId === compareSnapshotId(state.compareImportedSnapshot)
          ? null
          : state.compareSelectedBaselineSnapshotId,
    })),
  useImportedCompareAsBaseline: () =>
    set((state) => ({
      compareBaselineSnapshot: state.compareImportedSnapshot ?? state.compareBaselineSnapshot,
      compareSelectedBaselineSnapshotId: state.compareImportedSnapshot ? compareSnapshotId(state.compareImportedSnapshot) : state.compareSelectedBaselineSnapshotId,
      compareBaselineEraId: null,
    })),
  setCompareBaselineFromLibrary: (snapshotId) =>
    set((state) => {
      const entry = state.compareSnapshotLibrary.find((item) => item.id === snapshotId)
      if (!entry) {
        return {}
      }
      return {
        compareBaselineSnapshot: entry.snapshot,
        compareSelectedBaselineSnapshotId: entry.id,
        compareBaselineEraId: null,
      }
    }),
  removeCompareSnapshot: (snapshotId) =>
    set((state) => {
      const removed = state.compareSnapshotLibrary.find((item) => item.id === snapshotId)
      if (!removed) {
        return {}
      }
      const nextLibrary = state.compareSnapshotLibrary.filter((item) => item.id !== snapshotId)
      const removedFingerprint = removed.fingerprint
      const removeBaseline = state.compareBaselineSnapshot?.datasetIdentity.fingerprint === removedFingerprint
      const removeImported = state.compareImportedSnapshot?.datasetIdentity.fingerprint === removedFingerprint
      return {
        compareSnapshotLibrary: nextLibrary,
        compareBaselineSnapshot: removeBaseline ? null : state.compareBaselineSnapshot,
        compareBaselineEraId: removeBaseline ? null : state.compareBaselineEraId,
        compareSelectedBaselineSnapshotId:
          state.compareSelectedBaselineSnapshotId === snapshotId ? null : state.compareSelectedBaselineSnapshotId,
        compareImportedSnapshot: removeImported ? null : state.compareImportedSnapshot,
        compareImportMode: removeImported ? 'idle' : state.compareImportMode,
        compareImportProgress: removeImported ? null : state.compareImportProgress,
        compareImportError: removeImported ? null : state.compareImportError,
      }
    }),
  setExplainabilityTarget: (target) => set({ explainabilityTarget: target }),
  clearDatasetResults: (datasetFingerprint) => {
    set((state) => {
      const nextStatus = { ...state.moduleStatusByDataset }
      const nextResults = { ...state.moduleResultsByDataset }
      delete nextStatus[datasetFingerprint]
      delete nextResults[datasetFingerprint]
      return {
        moduleStatusByDataset: nextStatus,
        moduleResultsByDataset: nextResults,
        queue: state.queue.filter((item) => item.datasetFingerprint !== datasetFingerprint),
        compareBaselineSnapshot:
          state.compareBaselineSnapshot?.datasetIdentity.fingerprint === datasetFingerprint ? null : state.compareBaselineSnapshot,
        compareBaselineEraId:
          state.compareBaselineSnapshot?.datasetIdentity.fingerprint === datasetFingerprint ? null : state.compareBaselineEraId,
        compareImportedSnapshot:
          state.compareImportedSnapshot?.datasetIdentity.fingerprint === datasetFingerprint ? null : state.compareImportedSnapshot,
        compareSnapshotLibrary: state.compareSnapshotLibrary.filter((entry) => entry.fingerprint !== datasetFingerprint),
        compareSelectedBaselineSnapshotId:
          state.compareBaselineSnapshot?.datasetIdentity.fingerprint === datasetFingerprint
            ? null
            : state.compareSelectedBaselineSnapshotId,
        explainabilityTarget:
          state.explainabilityTarget?.datasetFingerprint === datasetFingerprint ? null : state.explainabilityTarget,
      }
    })
  },
  runModule: async (dataset, moduleId, options) => {
    const datasetFingerprint = dataset.datasetIdentity.fingerprint
    const key = queueKey(datasetFingerprint, moduleId)
    const startedAt = new Date().toISOString()
    set((state) => ({
      selectedModuleId: moduleId,
      moduleStatusByDataset: {
        ...state.moduleStatusByDataset,
        [datasetFingerprint]: {
          ...(state.moduleStatusByDataset[datasetFingerprint] ?? {}),
          [moduleId]: 'running',
        },
      },
      queue: upsertQueue(state.queue, {
        key,
        datasetFingerprint,
        moduleId,
        status: 'running',
        startedAt,
      }),
    }))

    try {
      const result = await runLabModuleWithFallback(moduleId, dataset, options)
      const nextStatus = result.status === 'ready' ? 'ready' : result.status === 'unsupported' ? 'unsupported' : 'error'
      set((state) => ({
        moduleStatusByDataset: {
          ...state.moduleStatusByDataset,
          [datasetFingerprint]: {
            ...(state.moduleStatusByDataset[datasetFingerprint] ?? {}),
            [moduleId]: nextStatus,
          },
        },
        moduleResultsByDataset: {
          ...state.moduleResultsByDataset,
          [datasetFingerprint]: {
            ...(state.moduleResultsByDataset[datasetFingerprint] ?? {}),
            [moduleId]: result,
          },
        },
        lastErrorByModule:
          result.status === 'error'
            ? { ...state.lastErrorByModule, [moduleId]: result.error ?? result.message ?? 'Module failed' }
            : state.lastErrorByModule,
        explainabilityTarget: { datasetFingerprint, moduleId },
        queue: upsertQueue(state.queue, {
          key,
          datasetFingerprint,
          moduleId,
          status: nextStatus,
          startedAt,
          finishedAt: new Date().toISOString(),
        }),
      }))
    } catch (error) {
      set((state) => ({
        moduleStatusByDataset: {
          ...state.moduleStatusByDataset,
          [datasetFingerprint]: {
            ...(state.moduleStatusByDataset[datasetFingerprint] ?? {}),
            [moduleId]: 'error',
          },
        },
        lastErrorByModule: {
          ...state.lastErrorByModule,
          [moduleId]: (error as Error).message,
        },
        queue: upsertQueue(state.queue, {
          key,
          datasetFingerprint,
          moduleId,
          status: 'error',
          startedAt,
          finishedAt: new Date().toISOString(),
        }),
      }))
    }
  },
  retryModule: async (dataset, moduleId, options) => {
    await get().runModule(dataset, moduleId, options)
  },
  runCompareAgainstBaseline: async (dataset) => {
    const baseline = get().compareBaselineSnapshot
    const scopeId = get().compareScopeId
    const baselineEraId = get().compareBaselineEraId
    const currentEraId = get().compareCurrentEraId
    await get().runModule(
      dataset,
      'compare-engine',
      baseline
        ? { baselineSnapshot: baseline, scopeId, baselineEraId, currentEraId }
        : { scopeId, baselineEraId, currentEraId },
    )
  },
  getModuleResult: (datasetFingerprint, moduleId) => {
    return get().moduleResultsByDataset[datasetFingerprint]?.[moduleId]
  },
}))

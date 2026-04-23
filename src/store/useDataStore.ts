import { create } from 'zustand'

import { parseSpotifyZip } from '@/lib/data/parser'
import type { PreparedSpotifyZipArchive, ZipInspectionResult } from '@/lib/data/parser'
import { runDataProcessorWorkerTask } from '@/lib/data/runDataProcessorWorkerTask'
import { normalizeUploadError } from '@/lib/data/upload-errors'
import { processRecords } from '@/lib/processor'
import type { ParseProgress, ProcessedDataModel, TimezoneMode } from '@/lib/types'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'

type LoadMode = 'idle' | 'parsing' | 'ready' | 'error'

export interface ZipIngestPreflightContext {
  inspection?: ZipInspectionResult
  preparedArchive?: PreparedSpotifyZipArchive
}

interface DataState {
  mode: LoadMode
  progress: ParseProgress | null
  data: ProcessedDataModel | null
  error: string | null
  useWorker: boolean
  timezoneMode: TimezoneMode
  setUseWorker: (useWorker: boolean) => void
  setTimezoneMode: (timezoneMode: TimezoneMode) => void
  ingestZip: (file: File, preflight?: ZipIngestPreflightContext) => Promise<void>
  reset: () => void
}

let timezoneReprocessRequestId = 0

async function processWithMainThread(
  file: File,
  timezoneMode: TimezoneMode,
  set: (partial: Partial<DataState>) => void,
  preflight?: ZipIngestPreflightContext,
): Promise<ProcessedDataModel> {
  const records = await parseSpotifyZip(file, {
    archive: preflight?.preparedArchive,
    onProgress(progress) {
      set({ progress })
    },
  })
  const processed = processRecords(records, {
    timezoneMode,
    onProgress(progress) {
      set({ progress })
    },
  })
  return processed
}

async function processWithWorker(
  file: File,
  timezoneMode: TimezoneMode,
  set: (partial: Partial<DataState>) => void,
  preflight?: ZipIngestPreflightContext,
): Promise<ProcessedDataModel> {
  return runDataProcessorWorkerTask(
    {
      type: 'process-zip',
      file,
      timezoneMode,
      historyFileNames: preflight?.inspection?.historyFiles,
    },
    {
      onProgress(progress) {
        set({ progress })
      },
    },
  )
}

async function processRecordsWithWorker(
  records: ProcessedDataModel['records'],
  timezoneMode: TimezoneMode,
  set: (partial: Partial<DataState>) => void,
): Promise<ProcessedDataModel> {
  return runDataProcessorWorkerTask(
    { type: 'process-records', records, timezoneMode },
    {
      onProgress(progress) {
        set({ progress })
      },
    },
  )
}

export const useDataStore = create<DataState>((set, get) => ({
  mode: 'idle',
  progress: null,
  data: null,
  error: null,
  useWorker: true,
  timezoneMode: 'local',
  setUseWorker: (useWorker) => set({ useWorker }),
  setTimezoneMode: (timezoneMode) => {
    const current = get()
    if (current.timezoneMode === timezoneMode) {
      return
    }
    const records = current.data?.records
    if (records && records.length > 0) {
      const requestId = (timezoneReprocessRequestId += 1)
      set({
        timezoneMode,
        progress: {
          stage: 'aggregation',
          filesParsed: 0,
          totalFiles: 0,
          recordsParsed: records.length,
        },
      })
      void (async () => {
        try {
          const reprocessed =
            typeof Worker !== 'undefined'
              ? await processRecordsWithWorker(records, timezoneMode, set)
              : processRecords(records, { timezoneMode })
          if (requestId !== timezoneReprocessRequestId) {
            return
          }
          set({ data: reprocessed, progress: null, error: null })
        } catch (error) {
          if (requestId !== timezoneReprocessRequestId) {
            return
          }
          set({ progress: null, error: (error as Error).message })
        }
      })()
      return
    }
    set({ timezoneMode })
  },
  ingestZip: async (file, preflight) => {
    try {
      useSessionMetricsStore.getState().reset()
      set({
        mode: 'parsing',
        error: null,
        progress: {
          stage: 'loading',
          filesParsed: 0,
          totalFiles: 0,
          recordsParsed: 0,
        },
      })

      const timezoneMode = get().timezoneMode
      const processed = get().useWorker
        ? await processWithWorker(file, timezoneMode, set, preflight)
        : await processWithMainThread(file, timezoneMode, set, preflight)

      useSessionMetricsStore.getState().record({
        type: 'upload_complete',
        timestamp: new Date().toISOString(),
        dedupeKey: 'upload',
        metadata: {
          records: processed.records.length,
          timezoneMode: processed.timezoneMode,
        },
      })

      set({
        data: processed,
        mode: 'ready',
        progress: null,
      })
    } catch (error) {
      set({
        mode: 'error',
        error: normalizeUploadError(error),
      })
    }
  },
  reset: () => {
    set({
      mode: 'idle',
      progress: null,
      data: null,
        error: null,
        timezoneMode: 'local',
      })
    },
}))

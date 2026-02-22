import { create } from 'zustand'

import { parseSpotifyZip } from '@/lib/data/parser'
import { normalizeUploadError } from '@/lib/data/upload-errors'
import { processRecords } from '@/lib/processor'
import type { ParseProgress, ProcessedDataModel, TimezoneMode } from '@/lib/types'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'

type LoadMode = 'idle' | 'parsing' | 'ready' | 'error'

interface DataState {
  mode: LoadMode
  progress: ParseProgress | null
  data: ProcessedDataModel | null
  error: string | null
  useWorker: boolean
  timezoneMode: TimezoneMode
  setUseWorker: (useWorker: boolean) => void
  setTimezoneMode: (timezoneMode: TimezoneMode) => void
  ingestZip: (file: File) => Promise<void>
  reset: () => void
}

interface WorkerProgressMessage {
  type: 'parse:progress'
  payload: ParseProgress
}

interface WorkerCompleteMessage {
  type: 'parse:complete'
  payload: ProcessedDataModel
}

interface WorkerErrorMessage {
  type: 'parse:error'
  payload: { message: string }
}

type WorkerMessage = WorkerProgressMessage | WorkerCompleteMessage | WorkerErrorMessage

let timezoneReprocessRequestId = 0

async function processWithMainThread(
  file: File,
  timezoneMode: TimezoneMode,
  set: (partial: Partial<DataState>) => void,
): Promise<ProcessedDataModel> {
  const records = await parseSpotifyZip(file, {
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
): Promise<ProcessedDataModel> {
  const worker = new Worker(new URL('../workers/dataProcessor.worker.ts', import.meta.url), {
    type: 'module',
  })

  return new Promise<ProcessedDataModel>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === 'parse:progress') {
        set({ progress: event.data.payload })
        return
      }
      if (event.data.type === 'parse:complete') {
        resolve(event.data.payload)
        worker.terminate()
        return
      }
      if (event.data.type === 'parse:error') {
        reject(new Error(event.data.payload.message))
        worker.terminate()
      }
    }

    worker.onerror = (event) => {
      reject(new Error(event.message))
      worker.terminate()
    }

    worker.postMessage({ type: 'process-zip', file, timezoneMode })
  })
}

async function processRecordsWithWorker(
  records: ProcessedDataModel['records'],
  timezoneMode: TimezoneMode,
  set: (partial: Partial<DataState>) => void,
): Promise<ProcessedDataModel> {
  const worker = new Worker(new URL('../workers/dataProcessor.worker.ts', import.meta.url), {
    type: 'module',
  })

  return new Promise<ProcessedDataModel>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === 'parse:progress') {
        set({ progress: event.data.payload })
        return
      }
      if (event.data.type === 'parse:complete') {
        resolve(event.data.payload)
        worker.terminate()
        return
      }
      if (event.data.type === 'parse:error') {
        reject(new Error(event.data.payload.message))
        worker.terminate()
      }
    }

    worker.onerror = (event) => {
      reject(new Error(event.message))
      worker.terminate()
    }

    worker.postMessage({ type: 'process-records', records, timezoneMode })
  })
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
  ingestZip: async (file) => {
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
        ? await processWithWorker(file, timezoneMode, set)
        : await processWithMainThread(file, timezoneMode, set)

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

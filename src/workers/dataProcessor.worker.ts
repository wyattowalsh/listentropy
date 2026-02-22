/// <reference lib="webworker" />

import { parseSpotifyZip } from '@/lib/data/parser'
import { processRecords } from '@/lib/processor'
import type { ParseProgress, ProcessedDataModel, TimezoneMode } from '@/lib/types'

type WorkerRequest =
  | {
      type: 'process-zip'
      file: File
      timezoneMode: TimezoneMode
    }
  | {
      type: 'process-records'
      records: ProcessedDataModel['records']
      timezoneMode: TimezoneMode
    }

type WorkerResponse =
  | { type: 'parse:progress'; payload: ParseProgress }
  | { type: 'parse:complete'; payload: ProcessedDataModel }
  | { type: 'parse:error'; payload: { message: string } }

const context: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

context.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    const records =
      request.type === 'process-zip'
        ? await parseSpotifyZip(request.file, {
            onProgress(progress) {
              context.postMessage({
                type: 'parse:progress',
                payload: progress,
              } satisfies WorkerResponse)
            },
          })
        : request.records

    const processed = processRecords(records, {
      timezoneMode: request.timezoneMode,
      onProgress(progress) {
        context.postMessage({
          type: 'parse:progress',
          payload: progress,
        } satisfies WorkerResponse)
      },
    })

    context.postMessage({
      type: 'parse:complete',
      payload: processed,
    } satisfies WorkerResponse)
  } catch (error) {
    context.postMessage({
      type: 'parse:error',
      payload: { message: (error as Error).message },
    } satisfies WorkerResponse)
  }
}

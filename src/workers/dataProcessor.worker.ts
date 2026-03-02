/// <reference lib="webworker" />

import { parseSpotifyZip } from '@/lib/data/parser'
import { processRecords } from '@/lib/processor'
import type { DataProcessorWorkerRequest, DataProcessorWorkerResponse } from '@/lib/data/dataProcessorWorker.types'

const context: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidDataProcessorWorkerRequest(request: unknown): request is DataProcessorWorkerRequest {
  if (!isObjectRecord(request) || typeof request.type !== 'string') {
    return false
  }
  if (request.type === 'process-zip') {
    return (
      request.file instanceof File &&
      (request.timezoneMode === 'local' || request.timezoneMode === 'utc') &&
      (request.historyFileNames === undefined ||
        (Array.isArray(request.historyFileNames) && request.historyFileNames.every((name) => typeof name === 'string')))
    )
  }
  if (request.type === 'process-records') {
    return Array.isArray(request.records) && (request.timezoneMode === 'local' || request.timezoneMode === 'utc')
  }
  return false
}

context.onmessage = async (event: MessageEvent<unknown>) => {
  const request = event.data
  if (!isValidDataProcessorWorkerRequest(request)) {
    context.postMessage({
      type: 'parse:error',
      payload: { message: 'Invalid data processor worker request.' },
    } satisfies DataProcessorWorkerResponse)
    return
  }
  try {
    const records =
      request.type === 'process-zip'
        ? await parseSpotifyZip(request.file, {
            historyFileNames: request.historyFileNames,
            onProgress(progress) {
              context.postMessage({
                type: 'parse:progress',
                payload: progress,
              } satisfies DataProcessorWorkerResponse)
            },
          })
        : request.records

    const processed = processRecords(records, {
      timezoneMode: request.timezoneMode,
      onProgress(progress) {
        context.postMessage({
          type: 'parse:progress',
          payload: progress,
        } satisfies DataProcessorWorkerResponse)
      },
    })

    context.postMessage({
      type: 'parse:complete',
      payload: processed,
    } satisfies DataProcessorWorkerResponse)
  } catch (error) {
    context.postMessage({
      type: 'parse:error',
      payload: { message: (error as Error).message },
    } satisfies DataProcessorWorkerResponse)
  }
}

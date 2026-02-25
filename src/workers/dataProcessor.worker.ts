/// <reference lib="webworker" />

import { parseSpotifyZip } from '@/lib/data/parser'
import { processRecords } from '@/lib/processor'
import type { DataProcessorWorkerRequest, DataProcessorWorkerResponse } from '@/lib/data/dataProcessorWorker.types'

const context: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

context.onmessage = async (event: MessageEvent<DataProcessorWorkerRequest>) => {
  const request = event.data
  try {
    const records =
      request.type === 'process-zip'
        ? await parseSpotifyZip(request.file, {
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

import type { ParseProgress, ProcessedDataModel } from '@/lib/types'

import type { DataProcessorWorkerRequest, DataProcessorWorkerResponse } from '@/lib/data/dataProcessorWorker.types'

interface RunDataProcessorWorkerTaskOptions {
  onProgress?: (progress: ParseProgress) => void
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidWorkerRequest(request: DataProcessorWorkerRequest): boolean {
  if (request.type === 'process-zip') {
    return request.file instanceof File && (request.timezoneMode === 'local' || request.timezoneMode === 'utc')
  }
  return Array.isArray(request.records) && (request.timezoneMode === 'local' || request.timezoneMode === 'utc')
}

function isValidProgressPayload(payload: unknown): payload is ParseProgress {
  if (!isObjectRecord(payload)) {
    return false
  }
  if (typeof payload.stage !== 'string') {
    return false
  }
  return (
    typeof payload.filesParsed === 'number' &&
    Number.isFinite(payload.filesParsed) &&
    typeof payload.totalFiles === 'number' &&
    Number.isFinite(payload.totalFiles) &&
    typeof payload.recordsParsed === 'number' &&
    Number.isFinite(payload.recordsParsed)
  )
}

function isValidCompletePayload(payload: unknown): payload is ProcessedDataModel {
  return isObjectRecord(payload) && Array.isArray(payload.records)
}

function isValidWorkerResponse(response: unknown): response is DataProcessorWorkerResponse {
  if (!isObjectRecord(response) || typeof response.type !== 'string') {
    return false
  }

  if (response.type === 'parse:progress') {
    return isValidProgressPayload(response.payload)
  }

  if (response.type === 'parse:complete') {
    return isValidCompletePayload(response.payload)
  }

  if (response.type === 'parse:error') {
    return isObjectRecord(response.payload) && typeof response.payload.message === 'string'
  }

  return false
}

export async function runDataProcessorWorkerTask(
  request: DataProcessorWorkerRequest,
  options?: RunDataProcessorWorkerTaskOptions,
): Promise<ProcessedDataModel> {
  if (!isValidWorkerRequest(request)) {
    return Promise.reject(new Error('Invalid data processor worker request payload.'))
  }

  const worker = new Worker(new URL('../../workers/dataProcessor.worker.ts', import.meta.url), {
    type: 'module',
  })

  return new Promise<ProcessedDataModel>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isValidWorkerResponse(event.data)) {
        worker.terminate()
        reject(new Error('Malformed data processor worker message.'))
        return
      }

      if (event.data.type === 'parse:progress') {
        options?.onProgress?.(event.data.payload as ParseProgress)
        return
      }
      if (event.data.type === 'parse:complete') {
        worker.terminate()
        resolve(event.data.payload as ProcessedDataModel)
        return
      }
      worker.terminate()
      reject(new Error(event.data.payload.message))
    }

    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Data processor worker failed'))
    }

    try {
      worker.postMessage(request)
    } catch (error) {
      worker.terminate()
      reject(new Error((error as Error).message || 'Failed to post data processor worker request'))
    }
  })
}

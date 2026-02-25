import type { ParseProgress, ProcessedDataModel } from '@/lib/types'

import type { DataProcessorWorkerRequest, DataProcessorWorkerResponse } from '@/lib/data/dataProcessorWorker.types'

interface RunDataProcessorWorkerTaskOptions {
  onProgress?: (progress: ParseProgress) => void
}

export async function runDataProcessorWorkerTask(
  request: DataProcessorWorkerRequest,
  options?: RunDataProcessorWorkerTaskOptions,
): Promise<ProcessedDataModel> {
  const worker = new Worker(new URL('../../workers/dataProcessor.worker.ts', import.meta.url), {
    type: 'module',
  })

  return new Promise<ProcessedDataModel>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<DataProcessorWorkerResponse>) => {
      if (event.data.type === 'parse:progress') {
        options?.onProgress?.(event.data.payload)
        return
      }
      if (event.data.type === 'parse:complete') {
        worker.terminate()
        resolve(event.data.payload)
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

import { runLabModule } from '@/lib/labs/modules'
import type {
  LabDatasetSnapshot,
  LabModuleId,
  LabModuleResult,
  LabWorkerRequest,
  LabWorkerResponse,
} from '@/lib/types'

interface PendingRequest {
  resolve: (result: LabModuleResult) => void
  reject: (error: Error) => void
}

class LabWorkerClient {
  private worker: Worker | null = null
  private pending = new Map<string, PendingRequest>()

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../../workers/labAnalytics.worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker.onmessage = (event: MessageEvent<LabWorkerResponse>) => {
        const message = event.data
        if (message.type === 'lab:progress') {
          return
        }
        if (message.type === 'lab:error') {
          const pending = this.pending.get(message.requestId)
          if (!pending) {
            return
          }
          this.pending.delete(message.requestId)
          pending.reject(new Error(message.error))
          return
        }
        const pending = this.pending.get(message.requestId)
        if (!pending) {
          return
        }
        this.pending.delete(message.requestId)
        pending.resolve(message.result)
      }
      this.worker.onerror = (event) => {
        const error = new Error(event.message || 'Lab worker failed')
        for (const [, pending] of this.pending) {
          pending.reject(error)
        }
        this.pending.clear()
        this.worker?.terminate()
        this.worker = null
      }
    }
    return this.worker
  }

  async runModule(
    moduleId: LabModuleId,
    dataset: LabDatasetSnapshot,
    options?: Record<string, unknown>,
  ): Promise<LabModuleResult> {
    if (typeof Worker === 'undefined') {
      return runLabModule(moduleId, dataset, options)
    }

    const requestId = `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const request: LabWorkerRequest = {
      type: 'lab:run-module',
      requestId,
      moduleId,
      dataset,
      options,
    }

    const worker = this.getWorker()
    return new Promise<LabModuleResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      worker.postMessage(request)
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}

let singleton: LabWorkerClient | null = null

export function getLabWorkerClient(): LabWorkerClient {
  if (!singleton) {
    singleton = new LabWorkerClient()
  }
  return singleton
}

export async function runLabModuleWithFallback(
  moduleId: LabModuleId,
  dataset: LabDatasetSnapshot,
  options?: Record<string, unknown>,
): Promise<LabModuleResult> {
  try {
    return await getLabWorkerClient().runModule(moduleId, dataset, options)
  } catch {
    return runLabModule(moduleId, dataset, options)
  }
}

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
  timeoutId: ReturnType<typeof setTimeout>
}

const LAB_WORKER_REQUEST_TIMEOUT_MS = 30_000

class LabWorkerClientError extends Error {
  readonly kind: 'module' | 'transport'

  constructor(kind: 'module' | 'transport', message: string) {
    super(message)
    this.kind = kind
    this.name = 'LabWorkerClientError'
  }
}

class LabWorkerClient {
  private worker: Worker | null = null
  private pending = new Map<string, PendingRequest>()

  private getWorker(): Worker {
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('../../workers/labAnalytics.worker.ts', import.meta.url), {
          type: 'module',
        })
      } catch (error) {
        throw new LabWorkerClientError(
          'transport',
          (error as Error).message || 'Failed to initialize Xenolab worker',
        )
      }
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
          clearTimeout(pending.timeoutId)
          this.pending.delete(message.requestId)
          pending.reject(new LabWorkerClientError('module', message.error))
          return
        }
        const pending = this.pending.get(message.requestId)
        if (!pending) {
          return
        }
        clearTimeout(pending.timeoutId)
        this.pending.delete(message.requestId)
        pending.resolve(message.result)
      }
      this.worker.onerror = (event) => {
        const error = new LabWorkerClientError('transport', event.message || 'Lab worker failed')
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timeoutId)
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
      const timeoutId = setTimeout(() => {
        const pending = this.pending.get(requestId)
        if (!pending) {
          return
        }
        this.pending.delete(requestId)
        pending.reject(new LabWorkerClientError('transport', 'Lab worker request timed out'))
        this.worker?.terminate()
        this.worker = null
      }, LAB_WORKER_REQUEST_TIMEOUT_MS)

      this.pending.set(requestId, { resolve, reject, timeoutId })
      try {
        worker.postMessage(request)
      } catch (error) {
        const pending = this.pending.get(requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
        }
        this.pending.delete(requestId)
        reject(
          new LabWorkerClientError(
            'transport',
            (error as Error).message || 'Failed to post Xenolab worker request',
          ),
        )
      }
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeoutId)
    }
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
  } catch (error) {
    if (error instanceof LabWorkerClientError && error.kind === 'transport') {
      return runLabModule(moduleId, dataset, options)
    }
    throw error
  }
}

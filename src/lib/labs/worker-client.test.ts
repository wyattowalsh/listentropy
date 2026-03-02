import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'

const runLabModuleMock = vi.fn()

vi.mock('@/lib/labs/modules', () => ({
  runLabModule: (...args: unknown[]) => runLabModuleMock(...args),
}))

class FakeWorker {
  static constructShouldThrow = false
  static onPostMessage: ((worker: FakeWorker, message: unknown) => void) | null = null

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false

  constructor(url: URL, options?: WorkerOptions) {
    void url
    void options
    if (FakeWorker.constructShouldThrow) {
      throw new Error('worker constructor failed')
    }
  }

  postMessage(message: unknown): void {
    FakeWorker.onPostMessage?.(this, message)
  }

  terminate(): void {
    this.terminated = true
  }
}

function makeFallbackResult() {
  return {
    id: 'sequence-motifs',
    status: 'error',
    message: 'fallback result',
    confidence: { value: 0.2, label: 'low', reasons: [] },
    provenance: {
      moduleId: 'sequence-motifs',
      computedAt: new Date().toISOString(),
      durationMs: 1,
      sourceFields: [],
      method: 'test fallback',
      assumptions: [],
      warnings: [],
    },
  }
}

async function loadModule() {
  vi.resetModules()
  return import('@/lib/labs/worker-client')
}

describe('runLabModuleWithFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    runLabModuleMock.mockReset()
    FakeWorker.constructShouldThrow = false
    FakeWorker.onPostMessage = null
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not rerun on main thread when the worker reports a module error', async () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
    const { runLabModuleWithFallback } = await loadModule()
    const snapshot = makeSyntheticLabSnapshot()

    FakeWorker.onPostMessage = (worker, message) => {
      const request = message as { requestId: string; moduleId: string }
      worker.onmessage?.({
        data: {
          type: 'lab:error',
          requestId: request.requestId,
          moduleId: request.moduleId,
          error: 'Module failed in worker',
        },
      } as MessageEvent<unknown>)
    }

    runLabModuleMock.mockReturnValue(makeFallbackResult())

    await expect(runLabModuleWithFallback('sequence-motifs', snapshot)).rejects.toThrow(/Module failed in worker/i)
    expect(runLabModuleMock).not.toHaveBeenCalled()
  })

  it('falls back to main-thread execution on worker transport/bootstrap failure', async () => {
    FakeWorker.constructShouldThrow = true
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
    const { runLabModuleWithFallback } = await loadModule()
    const snapshot = makeSyntheticLabSnapshot()
    const fallback = makeFallbackResult()
    runLabModuleMock.mockReturnValue(fallback)

    await expect(runLabModuleWithFallback('sequence-motifs', snapshot)).resolves.toBe(fallback)
    expect(runLabModuleMock).toHaveBeenCalledTimes(1)
  })

  it('uses main-thread execution when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined as unknown as typeof Worker)
    const { runLabModuleWithFallback } = await loadModule()
    const snapshot = makeSyntheticLabSnapshot()
    const fallback = makeFallbackResult()
    runLabModuleMock.mockReturnValue(fallback)

    await expect(runLabModuleWithFallback('sequence-motifs', snapshot)).resolves.toBe(fallback)
    expect(runLabModuleMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to main thread when a worker request times out', async () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
    const { runLabModuleWithFallback } = await loadModule()
    const snapshot = makeSyntheticLabSnapshot()
    const fallback = makeFallbackResult()
    runLabModuleMock.mockReturnValue(fallback)
    FakeWorker.onPostMessage = () => {
      // Simulate a stuck worker that never responds.
    }

    const promise = runLabModuleWithFallback('sequence-motifs', snapshot)
    promise.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(120_000)

    expect(runLabModuleMock).toHaveBeenCalledTimes(1)
    await expect(promise).resolves.toBe(fallback)
  })
})

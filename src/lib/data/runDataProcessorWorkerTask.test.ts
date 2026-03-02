import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWorker {
  static instances: FakeWorker[] = []
  static onPostMessage: ((worker: FakeWorker, message: unknown) => void) | null = null
  static constructShouldThrow = false

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false
  postedMessages: unknown[] = []

  constructor(url: URL, options?: WorkerOptions) {
    void url
    void options
    if (FakeWorker.constructShouldThrow) {
      throw new Error('failed to create worker')
    }
    FakeWorker.instances.push(this)
  }

  postMessage(message: unknown): void {
    this.postedMessages.push(message)
    FakeWorker.onPostMessage?.(this, message)
  }

  terminate(): void {
    this.terminated = true
  }
}

async function loadHelper() {
  vi.resetModules()
  return import('@/lib/data/runDataProcessorWorkerTask')
}

describe('runDataProcessorWorkerTask', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    FakeWorker.onPostMessage = null
    FakeWorker.constructShouldThrow = false
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards progress events and resolves on parse:complete', async () => {
    const progressCalls: unknown[] = []
    const processed = { records: [], summary: {} } as unknown

    FakeWorker.onPostMessage = (worker) => {
      worker.onmessage?.({
        data: {
          type: 'parse:progress',
          payload: {
            stage: 'loading',
            filesParsed: 1,
            totalFiles: 2,
            recordsParsed: 100,
          },
        },
      } as MessageEvent<unknown>)
      worker.onmessage?.({
        data: {
          type: 'parse:complete',
          payload: processed,
        },
      } as MessageEvent<unknown>)
    }

    const { runDataProcessorWorkerTask } = await loadHelper()
    const result = await runDataProcessorWorkerTask(
      { type: 'process-records', records: [], timezoneMode: 'local' },
      { onProgress: (progress) => progressCalls.push(progress) },
    )

    expect(result).toBe(processed)
    expect(progressCalls).toHaveLength(1)
    expect(FakeWorker.instances[0]?.terminated).toBe(true)
  })

  it('rejects on parse:error and terminates worker', async () => {
    FakeWorker.onPostMessage = (worker) => {
      worker.onmessage?.({
        data: {
          type: 'parse:error',
          payload: { message: 'worker parse failed' },
        },
      } as MessageEvent<unknown>)
    }

    const { runDataProcessorWorkerTask } = await loadHelper()

    await expect(
      runDataProcessorWorkerTask({ type: 'process-records', records: [], timezoneMode: 'utc' }),
    ).rejects.toThrow(/worker parse failed/i)
    expect(FakeWorker.instances[0]?.terminated).toBe(true)
  })

  it('rejects on worker.onerror and terminates worker', async () => {
    FakeWorker.onPostMessage = (worker) => {
      worker.onerror?.({ message: 'worker transport failed' } as ErrorEvent)
    }

    const { runDataProcessorWorkerTask } = await loadHelper()

    await expect(
      runDataProcessorWorkerTask({ type: 'process-records', records: [], timezoneMode: 'utc' }),
    ).rejects.toThrow(/worker transport failed/i)
    expect(FakeWorker.instances[0]?.terminated).toBe(true)
  })

  it('rejects malformed worker completion payloads and terminates worker', async () => {
    FakeWorker.onPostMessage = (worker) => {
      worker.onmessage?.({
        data: {
          type: 'parse:complete',
          payload: null,
        },
      } as MessageEvent<unknown>)
    }

    const { runDataProcessorWorkerTask } = await loadHelper()

    await expect(
      runDataProcessorWorkerTask({ type: 'process-records', records: [], timezoneMode: 'utc' }),
    ).rejects.toThrow(/malformed|invalid/i)
    expect(FakeWorker.instances[0]?.terminated).toBe(true)
  })
})

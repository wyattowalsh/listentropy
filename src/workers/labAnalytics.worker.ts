/// <reference lib="webworker" />

import { runLabModule } from '@/lib/labs/modules'
import type { LabWorkerRequest, LabWorkerResponse } from '@/lib/types'

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (event: MessageEvent<LabWorkerRequest>) => {
  const request = event.data
  if (request.type !== 'lab:run-module') {
    ctx.postMessage({
      type: 'lab:error',
      requestId: 'unknown',
      error: `Unsupported worker request: ${(request as { type?: string }).type ?? 'unknown'}`,
    } satisfies LabWorkerResponse)
    return
  }

  try {
    ctx.postMessage({
      type: 'lab:progress',
      requestId: request.requestId,
      moduleId: request.moduleId,
      progress: 0.15,
      message: `Running ${request.moduleId}…`,
    } satisfies LabWorkerResponse)

    const result = runLabModule(request.moduleId, request.dataset, request.options)

    ctx.postMessage({
      type: 'lab:complete',
      requestId: request.requestId,
      moduleId: request.moduleId,
      result,
    } satisfies LabWorkerResponse)
  } catch (error) {
    ctx.postMessage({
      type: 'lab:error',
      requestId: request.requestId,
      moduleId: request.moduleId,
      error: (error as Error).message,
    } satisfies LabWorkerResponse)
  }
}

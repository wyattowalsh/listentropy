import { create } from 'zustand'

import { createEmptySessionMetrics, recordSessionEvent } from '@/lib/metrics/session-metrics'
import type { SessionMetricEvent, SessionMetricEventType, SessionMetrics } from '@/lib/types'

interface SessionMetricsState {
  metrics: SessionMetrics
  record: (event: SessionMetricEventType | SessionMetricEvent) => void
  reset: () => void
}

export const useSessionMetricsStore = create<SessionMetricsState>((set) => ({
  metrics: createEmptySessionMetrics(),
  record: (event) =>
    set((state) => ({
      metrics: recordSessionEvent(state.metrics, event),
    })),
  reset: () => set({ metrics: createEmptySessionMetrics() }),
}))

export { computeShareCompletionRate, exportSessionMetricsJson } from '@/lib/metrics/session-metrics'

import type { SessionMetricEvent, SessionMetricEventType, SessionMetrics } from '@/lib/types'
export type { SessionMetricEvent, SessionMetricEventType, SessionMetrics } from '@/lib/types'

const MAX_EVENTS = 250

const EVENT_TYPES: SessionMetricEventType[] = [
  'upload_complete',
  'share_tab_open',
  'share_link_generated',
  'share_link_copied',
  'asset_exported',
  'full_mode_enabled',
  'full_tab_visit',
  'universe_mode_switched',
  'universe_3d_init_success',
  'universe_3d_init_failed',
]

function emptyCounts(): SessionMetrics['counts'] {
  return EVENT_TYPES.reduce(
    (acc, type) => {
      acc[type] = 0
      return acc
    },
    {} as SessionMetrics['counts'],
  )
}

export function createEmptySessionMetrics(startedAt = new Date().toISOString()): SessionMetrics {
  return {
    startedAt,
    counts: emptyCounts(),
    events: [],
  }
}

export function recordSessionEvent(
  metrics: SessionMetrics,
  input: SessionMetricEventType | SessionMetricEvent,
): SessionMetrics {
  const event: SessionMetricEvent =
    typeof input === 'string'
      ? {
          type: input,
          timestamp: new Date().toISOString(),
        }
      : input

  const last = metrics.events[metrics.events.length - 1]
  if (event.dedupeKey && last?.dedupeKey === event.dedupeKey && last.type === event.type) {
    return metrics
  }

  const counts = {
    ...metrics.counts,
    [event.type]: (metrics.counts[event.type] ?? 0) + 1,
  }
  const events = [...metrics.events, event].slice(-MAX_EVENTS)

  return {
    ...metrics,
    counts,
    events,
  }
}

export function computeShareCompletionRate(metrics: SessionMetrics): number {
  const attempts = Math.max(1, metrics.counts.share_tab_open)
  const completions =
    metrics.counts.share_link_copied > 0 ||
    metrics.counts.asset_exported > 0 ||
    metrics.counts.share_link_generated > 0
      ? 1
      : 0
  return completions / attempts
}

export function exportSessionMetricsJson(metrics: SessionMetrics): string {
  return JSON.stringify(
    {
      ...metrics,
      shareCompletionRate: computeShareCompletionRate(metrics),
    },
    null,
    2,
  )
}

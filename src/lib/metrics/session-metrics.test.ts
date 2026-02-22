import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptySessionMetrics,
  computeShareCompletionRate,
  recordSessionEvent,
  type SessionMetricEvent,
} from './session-metrics'

describe('session metrics', () => {
  let metrics = createEmptySessionMetrics()

  beforeEach(() => {
    metrics = createEmptySessionMetrics()
  })

  it('records funnel events with counts and last event ordering', () => {
    metrics = recordSessionEvent(metrics, 'upload_complete')
    metrics = recordSessionEvent(metrics, 'share_tab_open')
    metrics = recordSessionEvent(metrics, 'share_link_generated')
    metrics = recordSessionEvent(metrics, 'share_link_generated')

    expect(metrics.counts.upload_complete).toBe(1)
    expect(metrics.counts.share_link_generated).toBe(2)
    expect(metrics.events.at(-1)?.type).toBe('share_link_generated')
  })

  it('deduplicates immediate duplicate idempotent events when requested', () => {
    const event: SessionMetricEvent = {
      type: 'share_tab_open',
      timestamp: '2026-02-22T00:00:00.000Z',
      dedupeKey: 'tab:share',
    }
    metrics = recordSessionEvent(metrics, event)
    metrics = recordSessionEvent(metrics, event)

    expect(metrics.counts.share_tab_open).toBe(1)
    expect(metrics.events).toHaveLength(1)
  })

  it('computes share completion rate from generated/copy/export outcomes', () => {
    metrics = recordSessionEvent(metrics, 'upload_complete')
    metrics = recordSessionEvent(metrics, 'share_tab_open')
    metrics = recordSessionEvent(metrics, 'share_link_generated')
    metrics = recordSessionEvent(metrics, 'share_link_copied')
    metrics = recordSessionEvent(metrics, 'asset_exported')

    expect(computeShareCompletionRate(metrics)).toBeCloseTo(1)
  })
})

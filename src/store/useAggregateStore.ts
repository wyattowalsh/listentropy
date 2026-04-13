import { create } from 'zustand'

interface SnapshotSummary {
  type: string
  cohortSize: number
  computedAt: string
}

interface AggregateFactItem {
  dimension: string
  dimensionValue: string
  metricName: string
  metricValue: number
  rank: number | null
  suppressed: boolean
}

interface SnapshotData {
  type: string
  cohortSize: number
  computedAt: string
  facts: AggregateFactItem[]
  suppressedItemCount: number
}

interface AggregateState {
  available: boolean
  loading: boolean
  error: string | null
  cohortSize: number
  snapshots: SnapshotSummary[]
  snapshotData: Record<string, SnapshotData>
  fetchSummary: () => Promise<void>
  fetchSnapshot: (type: string) => Promise<void>
  fetchAll: () => Promise<void>
}

export const useAggregateStore = create<AggregateState>((set, get) => ({
  available: false,
  loading: false,
  error: null,
  cohortSize: 0,
  snapshots: [],
  snapshotData: {},

  fetchSummary: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/aggregates/summary')
      if (!res.ok) {
        set({ loading: false, error: 'Failed to fetch aggregate summary' })
        return
      }
      const data = await res.json()
      const snapshots = data.snapshots ?? []
      const cohortSize = snapshots.length > 0
        ? Math.max(...snapshots.map((s: SnapshotSummary) => s.cohortSize))
        : 0
      set({
        available: data.available,
        cohortSize,
        snapshots,
        loading: false,
      })
    } catch {
      set({ loading: false, error: 'Failed to fetch aggregate data' })
    }
  },

  fetchSnapshot: async (type: string) => {
    try {
      const res = await fetch(`/api/aggregates/snapshot/${type}`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.available) return

      const facts: AggregateFactItem[] = []
      const rawFacts = data.facts ?? {}
      for (const [key, metrics] of Object.entries(rawFacts)) {
        const [dimension, ...valueParts] = key.split(':')
        const dimensionValue = valueParts.join(':')
        for (const m of metrics as Array<{ metric: string; value: number; rank: number | null }>) {
          facts.push({
            dimension,
            dimensionValue,
            metricName: m.metric,
            metricValue: m.value,
            rank: m.rank,
            suppressed: false,
          })
        }
      }

      set((state) => ({
        snapshotData: {
          ...state.snapshotData,
          [type]: {
            type: data.type,
            cohortSize: data.cohortSize,
            computedAt: data.computedAt,
            facts,
            suppressedItemCount: data.suppressedItemCount ?? 0,
          },
        },
      }))
    } catch {
    }
  },

  fetchAll: async () => {
    const { fetchSummary, fetchSnapshot } = get()
    await fetchSummary()
    const { available, snapshots } = get()
    if (!available) return
    const types = snapshots.map((s) => s.type)
    await Promise.all(types.map((t) => fetchSnapshot(t)))
  },
}))

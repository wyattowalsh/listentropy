import { create } from 'zustand'

export type MetricMode = 'plays' | 'hours'
export type TimeRangeMode = 'all' | 'year' | 'custom'

interface FilterState {
  metricMode: MetricMode
  timeRangeMode: TimeRangeMode
  selectedYear: string | null
  customRange: { from: string | null; to: string | null }
  setMetricMode: (metricMode: MetricMode) => void
  setTimeRangeMode: (timeRangeMode: TimeRangeMode) => void
  setSelectedYear: (year: string | null) => void
  setCustomRange: (from: string | null, to: string | null) => void
}

export const useFilterStore = create<FilterState>((set) => ({
  metricMode: 'plays',
  timeRangeMode: 'all',
  selectedYear: null,
  customRange: { from: null, to: null },
  setMetricMode: (metricMode) => set({ metricMode }),
  setTimeRangeMode: (timeRangeMode) => set({ timeRangeMode }),
  setSelectedYear: (selectedYear) => set({ selectedYear }),
  setCustomRange: (from, to) => set({ customRange: { from, to } }),
}))

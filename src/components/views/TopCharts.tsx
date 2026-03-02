import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFilterStore } from '@/store/useFilterStore'
import type { AlbumStats, ArtistStats, ProcessedDataModel, TrackStats } from '@/lib/types'

type ChartTab = 'artists' | 'tracks' | 'albums'

interface TopChartsProps {
  data: ProcessedDataModel
}

type Item = ArtistStats | TrackStats | AlbumStats

function itemName(tab: ChartTab, item: Item): string {
  if (tab === 'artists') {
    return (item as ArtistStats).name
  }
  if (tab === 'tracks') {
    const track = item as TrackStats
    return `${track.name} — ${track.artist}`
  }
  const album = item as AlbumStats
  return `${album.name} — ${album.artist}`
}

export function TopCharts({ data }: TopChartsProps): JSX.Element {
  const [tab, setTab] = useState<ChartTab>('artists')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'count'>('rank')
  const metricMode = useFilterStore((state) => state.metricMode)
  const setMetricMode = useFilterStore((state) => state.setMetricMode)
  const parentRef = useRef<HTMLDivElement | null>(null)

  const source = tab === 'artists' ? data.artists : tab === 'tracks' ? data.tracks : data.albums

  const items = useMemo(() => {
    const lowered = search.trim().toLowerCase()
    const filtered = source.filter((item) =>
      itemName(tab, item).toLowerCase().includes(lowered),
    )
    if (sortBy === 'name') {
      return [...filtered].sort((a, b) => itemName(tab, a).localeCompare(itemName(tab, b)))
    }
    if (sortBy === 'count') {
      return [...filtered].sort((a, b) =>
        metricMode === 'plays' ? b.plays - a.plays : b.totalMs - a.totalMs,
      )
    }
    return filtered
  }, [metricMode, search, sortBy, source, tab])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(value) => setTab(value as ChartTab)}>
          <TabsList>
            <TabsTrigger value="artists">Artists</TabsTrigger>
            <TabsTrigger value="tracks">Tracks</TabsTrigger>
            <TabsTrigger value="albums">Albums</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={metricMode} onChange={(event) => setMetricMode(event.currentTarget.value as 'plays' | 'hours')}>
          <option value="plays">Play Count</option>
          <option value="hours">Listening Time</option>
        </Select>
        <Select value={sortBy} onChange={(event) => setSortBy(event.currentTarget.value as 'rank' | 'name' | 'count')}>
          <option value="rank">Rank</option>
          <option value="name">Name</option>
          <option value="count">Count</option>
        </Select>
        <Input
          className="max-w-xs"
          aria-label="Search leaderboard"
          placeholder="Search leaderboard..."
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </div>

      <div className="rounded-theme border border-border bg-surface">
        <div className="grid grid-cols-[56px,1fr,140px,140px] border-b border-border px-4 py-3 text-xs uppercase tracking-[0.18em] text-text-muted">
          <span>Rank</span>
          <span>Name</span>
          <span>Plays</span>
          <span>Hours</span>
        </div>
        <div ref={parentRef} className="h-[560px] overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index]
              if (!item) {
                return null
              }
              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 grid w-full grid-cols-[56px,1fr,140px,140px] items-center border-b border-border/70 px-4 py-3 text-sm text-text"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <span className="text-text-muted">#{virtualRow.index + 1}</span>
                  <span className="truncate">{itemName(tab, item)}</span>
                  <span>{item.plays.toLocaleString()}</span>
                  <span>{(item.totalMs / 1000 / 60 / 60).toFixed(1)}h</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getTabsPanelId, getTabsTabId } from '@/components/ui/tab-ids'
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
  const premiumCardClass =
    'rounded-theme border border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'
  const [tab, setTab] = useState<ChartTab>('artists')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'count'>('rank')
  const [showFilters, setShowFilters] = useState(false)
  const metricMode = useFilterStore((state) => state.metricMode)
  const setMetricMode = useFilterStore((state) => state.setMetricMode)
  const parentRef = useRef<HTMLDivElement | null>(null)
  const tabsIdBase = 'top-charts'

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
  const topItem = items[0]

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  })

  return (
    <div className="space-y-5">
      <div className={`${premiumCardClass} p-3`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Filter controls</p>
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-xs md:hidden"
            aria-controls="top-charts-controls"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
          >
            {showFilters ? 'Hide filters' : 'Show filters'}
          </Button>
        </div>
        <div
          id="top-charts-controls"
          className={`mt-3 flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden md:flex'}`}
        >
          <Tabs value={tab} onValueChange={(value) => setTab(value as ChartTab)} idBase={tabsIdBase}>
            <TabsList aria-label="Leaderboard entity tabs">
              <TabsTrigger value="artists">Artists</TabsTrigger>
              <TabsTrigger value="tracks">Tracks</TabsTrigger>
              <TabsTrigger value="albums">Albums</TabsTrigger>
            </TabsList>
            {(['artists', 'tracks', 'albums'] as const).map((tabValue) => (
              <div
                key={tabValue}
                id={getTabsPanelId(tabsIdBase, tabValue)}
                role="tabpanel"
                aria-labelledby={getTabsTabId(tabsIdBase, tabValue)}
                hidden
              />
            ))}
          </Tabs>
          <Select
            aria-label="Leaderboard metric mode"
            value={metricMode}
            onChange={(event) => setMetricMode(event.currentTarget.value as 'plays' | 'hours')}
          >
            <option value="plays">Play Count</option>
            <option value="hours">Listening Time</option>
          </Select>
          <Select
            aria-label="Leaderboard sort order"
            value={sortBy}
            onChange={(event) => setSortBy(event.currentTarget.value as 'rank' | 'name' | 'count')}
          >
            <option value="rank">Rank</option>
            <option value="name">Name</option>
            <option value="count">Count</option>
          </Select>
          <Input
            className="max-w-xs md:min-w-[16rem]"
            aria-label="Search leaderboard"
            placeholder="Search leaderboard..."
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
      </div>

      <div className={`${premiumCardClass} p-3`}>
        <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Key takeaways</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Rows in view</p>
            <p className="mt-1 text-sm text-text">{items.length.toLocaleString()}</p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Top item</p>
            <p className="mt-1 truncate text-sm text-text">{topItem ? itemName(tab, topItem) : 'No results'}</p>
          </div>
        </div>
      </div>

      <div className={premiumCardClass}>
        <div className="grid grid-cols-[44px,1fr,96px,96px] border-b border-border px-3 py-3 text-[11px] uppercase tracking-[0.16em] text-text-muted md:grid-cols-[56px,1fr,140px,140px] md:px-4">
          <span>Rank</span>
          <span>Name</span>
          <span>Plays</span>
          <span>Hours</span>
        </div>
        <div
          ref={parentRef}
          className="h-[420px] overflow-y-auto md:h-[560px]"
          tabIndex={0}
          aria-label={`${tab} leaderboard rows`}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index]
              if (!item) {
                return null
              }
              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 grid w-full grid-cols-[44px,1fr,96px,96px] items-center border-b border-border/60 px-3 py-3 text-sm text-text transition-colors duration-fast hover:bg-surface-hover/70 md:grid-cols-[56px,1fr,140px,140px] md:px-4"
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

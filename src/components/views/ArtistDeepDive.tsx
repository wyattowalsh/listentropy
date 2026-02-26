import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartContainer } from '@/components/charts/ChartContainer'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ProcessedDataModel } from '@/lib/types'

interface ArtistDeepDiveProps {
  data: ProcessedDataModel
}

export function ArtistDeepDive({ data }: ArtistDeepDiveProps): JSX.Element {
  const [query, setQuery] = useState(data.artists[0]?.name ?? '')

  const selectedArtist = useMemo(() => {
    if (!query) {
      return data.artists[0] ?? null
    }
    return (
      data.artists.find((artist) => artist.name.toLowerCase() === query.toLowerCase()) ??
      data.artists.find((artist) => artist.name.toLowerCase().includes(query.toLowerCase())) ??
      null
    )
  }, [data.artists, query])

  const artistTracks = useMemo(() => {
    if (!selectedArtist) {
      return []
    }
    return data.tracks
      .filter((track) => track.artist === selectedArtist.name)
      .slice(0, 10)
      .map((track) => ({ key: track.name, plays: track.plays }))
  }, [data.tracks, selectedArtist])

  const artistTrend = useMemo(() => {
    if (!selectedArtist) {
      return []
    }
    const trendIndex = data.artistMonthlyTrends[selectedArtist.name] ?? {}
    return data.monthly.map((month) => ({
      key: month.key,
      plays: trendIndex[month.key] ?? 0,
    }))
  }, [data.artistMonthlyTrends, data.monthly, selectedArtist])

  if (!selectedArtist) {
    return (
      <Card>
        <CardTitle>Artist Analysis</CardTitle>
        <CardDescription>No artist found for your search.</CardDescription>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Artist Analysis</CardTitle>
        <div className="mt-3 max-w-lg">
          <Input
            placeholder="Search artist..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="xl:col-span-1">
          <CardDescription>Selected Artist</CardDescription>
          <p className="mt-2 font-heading text-xl text-text">{selectedArtist.name}</p>
          <p className="mt-1 text-sm text-text-muted">
            {selectedArtist.plays.toLocaleString()} plays ·{' '}
            {(selectedArtist.totalMs / 1000 / 60 / 60).toFixed(1)}h
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {selectedArtist.firstListen.slice(0, 10)} → {selectedArtist.lastListen.slice(0, 10)}
          </p>
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle>Artist trend over time</CardTitle>
          <ChartContainer ariaLabel="Artist trend over time line chart" className="mt-3" height={224}>
            <LineChart data={artistTrend}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="plays" stroke="var(--color-chart-0)" strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle>Top tracks by artist</CardTitle>
          <ChartContainer ariaLabel="Top tracks by artist bar chart" className="mt-3" height={224}>
            <BarChart data={artistTracks}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="plays" fill="var(--color-chart-2)" />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>
    </div>
  )
}

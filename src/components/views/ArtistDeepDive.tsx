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
  analysisMode?: 'simple' | 'deep'
}

export function ArtistDeepDive({ data, analysisMode = 'deep' }: ArtistDeepDiveProps): JSX.Element {
  const [query, setQuery] = useState(data.artists[0]?.name ?? '')
  const isSimpleMode = analysisMode === 'simple'
  const normalizedQuery = query.trim().toLowerCase()
  const fallbackArtist = useMemo(
    () =>
      data.artists
        .slice()
        .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))[0] ?? null,
    [data.artists],
  )

  const selectedArtist = useMemo(() => {
    if (!normalizedQuery) {
      return data.artists[0] ?? null
    }
    return (
      data.artists.find((artist) => artist.name.toLowerCase() === normalizedQuery) ??
      data.artists.find((artist) => artist.name.toLowerCase().includes(normalizedQuery)) ??
      null
    )
  }, [data.artists, normalizedQuery])

  const artistMatches = useMemo(() => {
    if (!normalizedQuery) {
      return data.artists.slice(0, 8)
    }
    return data.artists.filter((artist) => artist.name.toLowerCase().includes(normalizedQuery)).slice(0, 8)
  }, [data.artists, normalizedQuery])

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
        <CardTitle as="h2">Artist Analysis</CardTitle>
        <CardDescription>
          {normalizedQuery
            ? `No artist found for your search. No artist matched “${normalizedQuery}”.`
            : 'No artist data available yet.'}
        </CardDescription>
        <p className="mt-2 text-xs text-text-muted">Try clearing your search or selecting a popular artist.</p>
        <div className="mt-3 space-y-2">
          <div className="max-w-lg">
            <Input
              aria-label="Search artist"
              placeholder="Search artist..."
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-[44px] rounded-theme border border-border px-3 py-2 text-sm text-text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
              onClick={() => setQuery('')}
            >
              Clear search
            </button>
            {fallbackArtist ? (
              <button
                type="button"
                className="min-h-[44px] rounded-theme border border-accent bg-accent/10 px-3 py-2 text-sm text-text transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
                onClick={() => setQuery(fallbackArtist.name)}
              >
                Try top artist: {fallbackArtist.name}
              </button>
            ) : null}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle as="h2">Artist Analysis</CardTitle>
        <CardDescription className="mt-1">
          Search for an artist, then inspect listening trend and top tracks in one place.
        </CardDescription>
        <div className="mt-3 space-y-2">
          <div className="max-w-lg">
            <Input
              aria-label="Search artist"
              placeholder="Search artist..."
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>
          {artistMatches.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {artistMatches.map((artist) => (
                <button
                  key={artist.name}
                  type="button"
                  className={`min-h-[44px] rounded-theme border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                    selectedArtist?.name === artist.name
                      ? 'border-accent bg-accent/10 text-text'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                  onClick={() => setQuery(artist.name)}
                >
                  {artist.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No quick matches. Try a shorter artist name fragment.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="xl:col-span-1">
          <CardDescription>Selected Artist</CardDescription>
          <p className="mt-2 font-heading text-xl text-text">{selectedArtist.name}</p>
          <div className="mt-3 space-y-2 text-sm text-text-muted">
            <div className="rounded-theme border border-border bg-surface-hover p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Total plays</p>
              <p className="mt-1 text-text">{selectedArtist.plays.toLocaleString()}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Listening time</p>
              <p className="mt-1 text-text">{(selectedArtist.totalMs / 1000 / 60 / 60).toFixed(1)}h</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Listening window</p>
              <p className="mt-1 text-xs text-text-muted">
                {selectedArtist.firstListen.slice(0, 10)} → {selectedArtist.lastListen.slice(0, 10)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle>Artist trend over time</CardTitle>
          <CardDescription className="mt-1">Monthly play-count trend for the selected artist.</CardDescription>
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
          <CardDescription className="mt-1">Most-played tracks currently associated with this artist.</CardDescription>
          {isSimpleMode ? (
            <details className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-text-muted">
                Show top-track breakdown
              </summary>
              <ChartContainer ariaLabel="Top tracks by artist bar chart" className="mt-3" height={224}>
                <BarChart data={artistTracks}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="plays" fill="var(--color-chart-2)" />
                </BarChart>
              </ChartContainer>
            </details>
          ) : (
            <ChartContainer ariaLabel="Top tracks by artist bar chart" className="mt-3" height={224}>
              <BarChart data={artistTracks}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="plays" fill="var(--color-chart-2)" />
              </BarChart>
            </ChartContainer>
          )}
        </Card>
      </div>
    </div>
  )
}

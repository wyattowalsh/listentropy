import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartContainer } from '@/components/charts/ChartContainer'
import { Button } from '@/components/ui/button'
import { SparkLine } from '@/components/charts/SparkLine'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { ProcessedDataModel } from '@/lib/types'
import { formatCompact, formatHours, formatPercent } from '@/lib/utils'

interface OverviewDashboardProps {
  data: ProcessedDataModel
  onOpenContext?: () => void
}

export function OverviewDashboard({ data, onOpenContext }: OverviewDashboardProps): JSX.Element {
  const statCards = [
    ['Listening hours', Math.round(data.summary.totalHours).toLocaleString()],
    ['Total plays', data.summary.totalPlays.toLocaleString()],
    ['Unique artists', data.summary.uniqueArtists.toLocaleString()],
    ['Unique tracks', data.summary.uniqueTracks.toLocaleString()],
    ['Unique albums', data.summary.uniqueAlbums.toLocaleString()],
    [
      'Date range',
      `${data.summary.firstListen.slice(0, 7)} — ${data.summary.lastListen.slice(0, 7)}`,
    ],
  ]

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map(([label, value], index) => (
          <Card key={label} className={`reveal reveal-${index + 1}`}>
            <CardDescription>{label}</CardDescription>
            <p className="mt-2 font-heading text-2xl text-text">{value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardDescription>#1 Artist</CardDescription>
          <CardTitle className="mt-2">{data.artists[0]?.name ?? 'N/A'}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            {formatCompact(data.artists[0]?.plays ?? 0)} plays ·{' '}
            {formatHours(data.artists[0]?.totalMs ?? 0)}h
          </p>
        </Card>
        <Card>
          <CardDescription>#1 Track</CardDescription>
          <CardTitle className="mt-2">{data.tracks[0]?.name ?? 'N/A'}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            {data.tracks[0]?.artist ?? 'N/A'} · {formatCompact(data.tracks[0]?.plays ?? 0)} plays
          </p>
        </Card>
        <Card>
          <CardDescription>#1 Album</CardDescription>
          <CardTitle className="mt-2">{data.albums[0]?.name ?? 'N/A'}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            {data.albums[0]?.artist ?? 'N/A'} · {formatCompact(data.albums[0]?.plays ?? 0)} plays
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Year-over-year listening</CardTitle>
          <ChartContainer ariaLabel="Year-over-year listening bar chart" className="mt-3" height={256}>
            <BarChart data={data.yearly}>
              <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)' }} />
              <Tooltip />
              <Bar dataKey="totalMs">
                {data.yearly.map((bucket) => (
                  <Cell key={bucket.key} fill="var(--color-chart-0)" />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>
        <Card>
          <CardTitle>Platform split</CardTitle>
          <ChartContainer ariaLabel="Platform split pie chart" className="mt-3" height={256}>
            <PieChart>
              <Pie data={data.platform} dataKey="totalMs" nameKey="platform" outerRadius={90}>
                {data.platform.map((item, index) => (
                  <Cell key={item.platform} fill={`var(--color-chart-${index % 10})`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ChartContainer>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        {data.quickInsights.map((insight) => (
          <Card key={insight}>
            <p className="text-sm text-text">{insight}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardDescription>Monthly plays trend</CardDescription>
          <SparkLine data={data.monthly.map((bucket) => bucket.plays)} />
        </Card>
        <Card>
          <CardDescription>Monthly hours trend</CardDescription>
          <SparkLine data={data.monthly.map((bucket) => bucket.totalMs / 1000 / 60 / 60)} />
        </Card>
        <Card>
          <CardDescription>Unique artists trend</CardDescription>
          <SparkLine data={data.monthly.map((bucket) => bucket.uniqueArtists)} />
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardDescription>Night owl score</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.nocturnalShare)}</p>
        </Card>
        <Card>
          <CardDescription>Skip rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.skipRate)}</p>
        </Card>
        <Card>
          <CardDescription>Shuffle rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.shuffleRate)}</p>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Country context</CardTitle>
          <CardDescription className="mt-1">
            Home country {data.contextAnalytics.country.homeCountry ?? 'N/A'} · travel share{' '}
            {formatPercent(data.contextAnalytics.country.travelShare)}.
          </CardDescription>
          {onOpenContext ? (
            <Button className="mt-3" variant="outline" onClick={onOpenContext}>
              Open Context Intelligence
            </Button>
          ) : null}
        </Card>
        <Card>
          <CardTitle>Device journey snapshot</CardTitle>
          <CardDescription className="mt-1">
            Cross-platform session handoffs{' '}
            {formatPercent(data.contextAnalytics.deviceJourney.crossPlatformSessionShare)}.
          </CardDescription>
          <p className="mt-2 text-sm text-text-muted">
            Dominant transition:{' '}
            {data.contextAnalytics.deviceJourney.dominantTransition
              ? `${data.contextAnalytics.deviceJourney.dominantTransition.from} → ${data.contextAnalytics.deviceJourney.dominantTransition.to}`
              : 'N/A'}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Narrative Insights</CardTitle>
          <div className="mt-3 space-y-3">
            {data.narrativeInsights.slice(0, 4).map((insight) => (
              <div key={insight.id} className="rounded-theme border border-border bg-surface-hover p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text">{insight.title}</p>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                    {insight.confidence}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{insight.description}</p>
                <p className="mt-2 text-[11px] text-text-muted">
                  Why: {insight.why.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Data Quality</CardTitle>
          <CardDescription className="mt-1">
            Audit of source completeness and consistency used for local-only insights.
          </CardDescription>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Unknown country rate</p>
              <p className="mt-1 text-lg text-text">{formatPercent(data.dataQuality.unknownCountryRate)}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Missing track URI rate</p>
              <p className="mt-1 text-lg text-text">{formatPercent(data.dataQuality.missingTrackUriRate)}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Missing track name rate</p>
              <p className="mt-1 text-lg text-text">{formatPercent(data.dataQuality.missingTrackNameRate)}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Offline timestamp inconsistency</p>
              <p className="mt-1 text-lg text-text">
                {formatPercent(data.dataQuality.offlineTimestampInconsistencyRate)}
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

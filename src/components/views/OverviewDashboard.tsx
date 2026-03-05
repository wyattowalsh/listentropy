import { useState } from 'react'
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
  const premiumCardClass =
    'border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'

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
  const yearlyPeak =
    data.yearly.length > 0 ? [...data.yearly].sort((a, b) => b.totalMs - a.totalMs)[0] : null
  const topPlatform =
    data.platform.length > 0 ? [...data.platform].sort((a, b) => b.totalMs - a.totalMs)[0] : null
  const storySummary =
    data.quickInsights[0] ?? data.narrativeInsights[0]?.description ?? 'Your dataset is ready for exploration.'
  const [showAllNarrativeInsights, setShowAllNarrativeInsights] = useState(false)
  const [showAllDataQualitySignals, setShowAllDataQualitySignals] = useState(false)

  return (
    <div className="space-y-6">
      <Card className={premiumCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle as="h2">Overview Snapshot</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Read your listening story first, then expand advanced tools below and use Share for publishing.
            </CardDescription>
          </div>
          <div className="grid gap-2 text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Quick signal</p>
            <p className="text-sm text-text">
              {data.quickInsights[0] ?? 'Your dataset is ready for exploration.'}
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map(([label, value], index) => (
          <Card key={label} className={`reveal reveal-${index + 1} ${premiumCardClass}`}>
            <CardDescription className="text-xs uppercase tracking-[0.14em]">{label}</CardDescription>
            <p className="mt-2 font-heading text-2xl tabular-nums text-text">{value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">#1 Artist</CardDescription>
          <CardTitle className="mt-2">{data.artists[0]?.name ?? 'N/A'}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            {formatCompact(data.artists[0]?.plays ?? 0)} plays ·{' '}
            {formatHours(data.artists[0]?.totalMs ?? 0)}h
          </p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">#1 Track</CardDescription>
          <CardTitle className="mt-2">{data.tracks[0]?.name ?? 'N/A'}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            {data.tracks[0]?.artist ?? 'N/A'} · {formatCompact(data.tracks[0]?.plays ?? 0)} plays
          </p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">#1 Album</CardDescription>
          <CardTitle className="mt-2">{data.albums[0]?.name ?? 'N/A'}</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            {data.albums[0]?.artist ?? 'N/A'} · {formatCompact(data.albums[0]?.plays ?? 0)} plays
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardTitle>Year-over-year listening</CardTitle>
          <CardDescription className="mt-1">
            Peak period:{' '}
            {yearlyPeak
              ? `${yearlyPeak.key} (${formatHours(yearlyPeak.totalMs)}h)`
              : 'Not enough data yet'}
            .
          </CardDescription>
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
        <Card className={premiumCardClass}>
          <CardTitle>Platform split</CardTitle>
          <CardDescription className="mt-1">
            Leading platform:{' '}
            {topPlatform ? `${topPlatform.platform} (${formatHours(topPlatform.totalMs)}h)` : 'N/A'}.
          </CardDescription>
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
        {data.quickInsights.slice(0, 4).map((insight, index) => (
          <Card key={insight} className={premiumCardClass}>
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Takeaway {index + 1}</p>
            <p className="mt-2 text-sm text-text">{insight}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className={premiumCardClass}>
          <CardDescription>Monthly plays trend</CardDescription>
          <SparkLine data={data.monthly.map((bucket) => bucket.plays)} />
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription>Monthly hours trend</CardDescription>
          <SparkLine data={data.monthly.map((bucket) => bucket.totalMs / 1000 / 60 / 60)} />
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription>Unique artists trend</CardDescription>
          <SparkLine data={data.monthly.map((bucket) => bucket.uniqueArtists)} />
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className={premiumCardClass}>
          <CardDescription>Night owl score</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.nocturnalShare)}</p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription>Skip rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.skipRate)}</p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription>Shuffle rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.shuffleRate)}</p>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card className={premiumCardClass}>
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
        <Card className={premiumCardClass}>
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
        <Card className={premiumCardClass}>
          <CardTitle>Narrative Insights</CardTitle>
          <CardDescription className="mt-1">Story summary first, then expand for full context.</CardDescription>
          <div className="mt-3 rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Story summary</p>
            <p className="mt-1 text-sm text-text">{storySummary}</p>
          </div>
          <div className="mt-3 space-y-3">
            {data.narrativeInsights
              .slice(0, showAllNarrativeInsights ? 4 : 2)
              .map((insight) => (
                <div
                  key={insight.id}
                  className="rounded-theme border border-border/70 bg-surface-hover/70 p-3"
                >
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
          {data.narrativeInsights.length > 2 ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 px-0 text-xs"
              aria-expanded={showAllNarrativeInsights}
              onClick={() => setShowAllNarrativeInsights((value) => !value)}
            >
              {showAllNarrativeInsights ? 'Show fewer insights' : 'Show more insights'}
            </Button>
          ) : null}
        </Card>
        <Card className={premiumCardClass}>
          <CardTitle>Data Quality</CardTitle>
          <CardDescription className="mt-1">
            Audit of source completeness and consistency used for local-only insights.
          </CardDescription>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Unknown country rate</p>
              <p className="mt-1 text-lg text-text">{formatPercent(data.dataQuality.unknownCountryRate)}</p>
            </div>
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Missing track URI rate</p>
              <p className="mt-1 text-lg text-text">{formatPercent(data.dataQuality.missingTrackUriRate)}</p>
            </div>
            {showAllDataQualitySignals ? (
              <>
                <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
                  <p className="text-xs text-text-muted">Missing track name rate</p>
                  <p className="mt-1 text-lg text-text">{formatPercent(data.dataQuality.missingTrackNameRate)}</p>
                </div>
                <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
                  <p className="text-xs text-text-muted">Offline timestamp inconsistency</p>
                  <p className="mt-1 text-lg text-text">
                    {formatPercent(data.dataQuality.offlineTimestampInconsistencyRate)}
                  </p>
                </div>
              </>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 px-0 text-xs"
            aria-expanded={showAllDataQualitySignals}
            onClick={() => setShowAllDataQualitySignals((value) => !value)}
          >
            {showAllDataQualitySignals ? 'Show fewer quality signals' : 'Show all quality signals'}
          </Button>
        </Card>
      </section>
    </div>
  )
}

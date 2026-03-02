import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartContainer } from '@/components/charts/ChartContainer'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import type { ProcessedDataModel } from '@/lib/types'

interface ListeningTimelineProps {
  data: ProcessedDataModel
}

type Granularity = 'yearly' | 'monthly' | 'weekly'

export function ListeningTimeline({ data }: ListeningTimelineProps): JSX.Element {
  const premiumCardClass =
    'border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const [metric, setMetric] = useState<'plays' | 'hours' | 'artists'>('plays')
  const [showDetailCards, setShowDetailCards] = useState(false)

  const series = useMemo(() => {
    const buckets =
      granularity === 'yearly' ? data.yearly : granularity === 'monthly' ? data.monthly : data.weekly
    return buckets.map((bucket) => ({
      key: bucket.key,
      plays: bucket.plays,
      hours: bucket.totalMs / 1000 / 60 / 60,
      artists: bucket.uniqueArtists,
    }))
  }, [data.monthly, data.weekly, data.yearly, granularity])

  const peakPoint =
    series.length > 0
      ? [...series].sort((a, b) => b.hours - a.hours)[0]
      : null
  const metricLabel = metric === 'plays' ? 'plays' : metric === 'hours' ? 'hours listened' : 'unique artists'
  const leadValue = peakPoint ? peakPoint[metric] : null

  return (
    <div className="space-y-5">
      <Card className={premiumCardClass}>
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Timeline granularity"
            value={granularity}
            onChange={(event) => setGranularity(event.currentTarget.value as Granularity)}
          >
            <option value="yearly">Yearly</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </Select>
          <Select
            aria-label="Timeline metric"
            value={metric}
            onChange={(event) => setMetric(event.currentTarget.value as 'plays' | 'hours' | 'artists')}
          >
            <option value="plays">Plays</option>
            <option value="hours">Hours</option>
            <option value="artists">Unique Artists</option>
          </Select>
        </div>
      </Card>

      <Card className={premiumCardClass}>
        <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Key takeaways</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Peak period</p>
            <p className="mt-1 text-sm text-text">
              {peakPoint ? `${peakPoint.key} · ${peakPoint.hours.toFixed(1)} hours` : 'Not enough timeline data'}
            </p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Selected metric lead</p>
            <p className="mt-1 text-sm text-text">
              {peakPoint && leadValue !== null
                ? `${peakPoint.key} · ${metric === 'hours' ? Number(leadValue).toFixed(1) : Number(leadValue).toLocaleString()} ${metricLabel}`
                : 'Switch metric to inspect a specific lead period'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 px-0 text-xs"
          aria-expanded={showDetailCards}
          onClick={() => setShowDetailCards((value) => !value)}
        >
          {showDetailCards ? 'Hide detail cards' : 'Show detail cards'}
        </Button>
      </Card>

      <Card className={premiumCardClass}>
        <CardTitle>Listening timeline</CardTitle>
        <CardDescription className="mt-1">
          Interactive timeline with brush zoom for {metricLabel} ({data.timezoneMode === 'utc' ? 'UTC' : 'local time'}
          ).
        </CardDescription>
        <ChartContainer ariaLabel="Listening timeline area chart" interactive className="mt-4" height={380}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-0)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--color-chart-0)" stopOpacity={0.12} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="var(--color-chart-0)"
              fill="url(#timelineFill)"
              strokeWidth={2}
            />
            <Brush dataKey="key" height={24} stroke="var(--color-chart-0)" />
          </AreaChart>
        </ChartContainer>
      </Card>

      {showDetailCards ? (
        <Card className={premiumCardClass}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Peak point</p>
              <p className="mt-1 text-sm text-text">
                {peakPoint ? `${peakPoint.key} · ${peakPoint.hours.toFixed(1)} hours` : 'Not enough timeline data'}
              </p>
            </div>
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Current metric lead</p>
              <p className="mt-1 text-sm text-text">
                {peakPoint && leadValue !== null
                  ? `${peakPoint.key} · ${metric === 'hours' ? Number(leadValue).toFixed(1) : Number(leadValue).toLocaleString()} ${metricLabel}`
                  : 'Switch metric to inspect a specific lead period'}
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

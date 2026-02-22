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
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import type { ProcessedDataModel } from '@/lib/types'

interface ListeningTimelineProps {
  data: ProcessedDataModel
}

type Granularity = 'yearly' | 'monthly' | 'weekly'

export function ListeningTimeline({ data }: ListeningTimelineProps): JSX.Element {
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const [metric, setMetric] = useState<'plays' | 'hours' | 'artists'>('plays')

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={granularity} onChange={(event) => setGranularity(event.currentTarget.value as Granularity)}>
          <option value="yearly">Yearly</option>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </Select>
        <Select value={metric} onChange={(event) => setMetric(event.currentTarget.value as 'plays' | 'hours' | 'artists')}>
          <option value="plays">Plays</option>
          <option value="hours">Hours</option>
          <option value="artists">Unique Artists</option>
        </Select>
      </div>

      <Card>
        <CardTitle>Listening timeline</CardTitle>
        <CardDescription className="mt-1">
          Interactive timeline with brush zoom and milestone spotting ({data.timezoneMode === 'utc' ? 'UTC' : 'local time'}).
        </CardDescription>
        <ChartContainer ariaLabel="Listening timeline area chart" className="mt-4" height={380}>
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

      {peakPoint ? (
        <Card>
          <CardDescription>
            Peak point: <strong>{peakPoint.key}</strong> with {peakPoint.hours.toFixed(1)} hours.
          </CardDescription>
        </Card>
      ) : null}
    </div>
  )
}

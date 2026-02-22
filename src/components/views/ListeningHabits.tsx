import {
  Area,
  AreaChart,
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
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { ProcessedDataModel } from '@/lib/types'
import { formatPercent } from '@/lib/utils'

interface ListeningHabitsProps {
  data: ProcessedDataModel
  onOpenContext?: () => void
}

export function ListeningHabits({ data, onOpenContext }: ListeningHabitsProps): JSX.Element {
  const skipTrend = data.monthlyBehavior.map((month) => ({
    key: month.key,
    skipRate: month.skipRate,
    shuffleRate: month.shuffleRate,
    offlineRate: month.offlineRate,
    incognitoRate: month.incognitoRate,
  }))

  const sessionDistribution = data.sessions
    .map((session) => session.trackCount)
    .reduce<Record<string, number>>((accumulator, count) => {
      const bucket = count >= 20 ? '20+' : `${Math.floor(count / 5) * 5}-${Math.floor(count / 5) * 5 + 4}`
      accumulator[bucket] = (accumulator[bucket] ?? 0) + 1
      return accumulator
    }, {})

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Skip and shuffle trend</CardTitle>
          <ChartContainer ariaLabel="Skip and shuffle trend line chart" className="mt-3" height={256}>
            <LineChart data={skipTrend}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="skipRate" stroke="var(--color-negative)" />
              <Line type="monotone" dataKey="shuffleRate" stroke="var(--color-chart-0)" />
              <Line type="monotone" dataKey="offlineRate" stroke="var(--color-chart-2)" />
            </LineChart>
          </ChartContainer>
        </Card>
        <Card>
          <CardTitle>Session depth distribution</CardTitle>
          <ChartContainer ariaLabel="Session depth distribution bar chart" className="mt-3" height={256}>
            <BarChart
              data={Object.entries(sessionDistribution).map(([bucket, count]) => ({
                bucket,
                count,
              }))}
            >
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-chart-2)" />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Platform evolution</CardTitle>
          <CardDescription className="mt-1">
            Baseline split by platform category.
          </CardDescription>
          <ChartContainer ariaLabel="Platform evolution area chart" className="mt-3" height={288}>
            <AreaChart data={data.platform}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="platform" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="totalMs" fill="var(--color-chart-3)" stroke="var(--color-chart-0)" />
            </AreaChart>
          </ChartContainer>
        </Card>
        <Card>
          <CardTitle>Skip hotspots</CardTitle>
          <ol className="mt-3 space-y-2">
            {data.skipStats.byArtist.slice(0, 10).map((artist) => (
              <li key={artist.name} className="flex items-center justify-between text-sm">
                <span className="text-text">{artist.name}</span>
                <span className="text-text-muted">
                  {Math.round(artist.skipRate * 100)}% · {artist.plays} plays
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <CardTitle>Context cross-check</CardTitle>
        <CardDescription className="mt-1">
          Offline rate {formatPercent(data.contextAnalytics.offlinePrivacy.offlineRate)} · Incognito rate{' '}
          {formatPercent(data.contextAnalytics.offlinePrivacy.incognitoRate)} · Dominant end reason{' '}
          {data.contextAnalytics.reasons.end[0]?.reason ?? 'N/A'}.
        </CardDescription>
        {data.narrativeInsights[0] ? (
          <p className="mt-3 text-xs text-text-muted">
            Why this matters: {data.narrativeInsights[0].why.join(' · ')}
          </p>
        ) : null}
        {onOpenContext ? (
          <Button className="mt-3" variant="outline" onClick={onOpenContext}>
            Inspect Context Intelligence
          </Button>
        ) : null}
      </Card>
    </div>
  )
}

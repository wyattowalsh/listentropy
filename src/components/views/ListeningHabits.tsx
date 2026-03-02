import { useState } from 'react'
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
  const premiumCardClass =
    'border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'
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
  const skipLeader = data.skipStats.byArtist[0]
  const sessionLeadBucket = Object.entries(sessionDistribution).sort((a, b) => b[1] - a[1])[0]
  const [showAllSkipHotspots, setShowAllSkipHotspots] = useState(false)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">Skip rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.skipRate)}</p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">Shuffle rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.summary.shuffleRate)}</p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">Offline rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.contextAnalytics.offlinePrivacy.offlineRate)}</p>
        </Card>
        <Card className={premiumCardClass}>
          <CardDescription className="text-xs uppercase tracking-[0.14em]">Incognito rate</CardDescription>
          <p className="mt-2 text-xl text-text">{formatPercent(data.contextAnalytics.offlinePrivacy.incognitoRate)}</p>
        </Card>
      </div>

      <Card className={premiumCardClass}>
        <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Story summary</p>
        <p className="mt-2 text-sm text-text">
          {skipLeader
            ? `Skip concentration is highest on ${skipLeader.name} (${Math.round(skipLeader.skipRate * 100)}%), while ${sessionLeadBucket ? `${sessionLeadBucket[0]}-track sessions` : 'session depth'} appears most often.`
            : 'Behavior summary is ready once skip hotspots are detected.'}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardTitle>Skip and shuffle trend</CardTitle>
          <CardDescription className="mt-1">
            Monthly movement of skip, shuffle, and offline behavior rates.
          </CardDescription>
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
        <Card className={premiumCardClass}>
          <CardTitle>Session depth distribution</CardTitle>
          <CardDescription className="mt-1">How often sessions stay shallow vs. deeply continuous.</CardDescription>
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
        <Card className={premiumCardClass}>
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
        <Card className={premiumCardClass}>
          <CardTitle>Skip hotspots</CardTitle>
          <CardDescription className="mt-1">
            Highest skip concentration: {skipLeader ? `${skipLeader.name} (${Math.round(skipLeader.skipRate * 100)}%)` : 'N/A'}.
          </CardDescription>
          <ol className="mt-3 space-y-2">
            {data.skipStats.byArtist
              .slice(0, showAllSkipHotspots ? 10 : 4)
              .map((artist, index) => (
                <li
                  key={artist.name}
                  className="flex items-center justify-between rounded-theme border border-border/60 bg-surface-hover/60 px-3 py-2 text-sm"
                >
                  <span className="text-text">
                    <span className="mr-2 text-xs text-text-muted">#{index + 1}</span>
                    {artist.name}
                  </span>
                  <span className="text-text-muted">
                    {Math.round(artist.skipRate * 100)}% · {artist.plays} plays
                  </span>
                </li>
              ))}
          </ol>
          {data.skipStats.byArtist.length > 4 ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 px-0 text-xs"
              aria-expanded={showAllSkipHotspots}
              onClick={() => setShowAllSkipHotspots((value) => !value)}
            >
              {showAllSkipHotspots ? 'Show fewer hotspots' : 'Show all hotspots'}
            </Button>
          ) : null}
        </Card>
      </div>

      <Card className={premiumCardClass}>
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

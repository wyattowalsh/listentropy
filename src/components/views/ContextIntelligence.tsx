import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

interface ContextIntelligenceProps {
  data: ProcessedDataModel
}

export function ContextIntelligence({ data }: ContextIntelligenceProps): JSX.Element {
  const premiumCardClass =
    'border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'
  const { contextAnalytics } = data
  const [showAllReasonTransitions, setShowAllReasonTransitions] = useState(false)
  const [showAllDeviceTransitions, setShowAllDeviceTransitions] = useState(false)
  const topReasons = contextAnalytics.reasons.transitions.slice(0, showAllReasonTransitions ? 10 : 4)
  const topDeviceTransitions = contextAnalytics.deviceJourney.transitions.slice(0, showAllDeviceTransitions ? 10 : 4)

  return (
    <div className="space-y-5">
      <Card className={premiumCardClass}>
        <CardTitle>Context Intelligence</CardTitle>
        <CardDescription className="mt-1">
          Playback context extracted from country, intent, offline/privacy, and device-transition patterns.
        </CardDescription>
      </Card>

      <Card className={premiumCardClass}>
        <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Story summary</p>
        <p className="mt-2 text-sm text-text">
          {contextAnalytics.country.homeCountry ?? 'Home country unavailable'} anchors {formatPercent(contextAnalytics.country.domesticShare)} domestic listening, while
          {' '}cross-platform handoffs reach {formatPercent(contextAnalytics.deviceJourney.crossPlatformSessionShare)}.
        </p>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        <Card className={premiumCardClass}>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Home country</p>
          <p className="mt-2 text-xl text-text">{contextAnalytics.country.homeCountry ?? 'N/A'}</p>
        </Card>
        <Card className={premiumCardClass}>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Travel share</p>
          <p className="mt-2 text-xl text-text">{formatPercent(contextAnalytics.country.travelShare)}</p>
        </Card>
        <Card className={premiumCardClass}>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Cross-platform handoff</p>
          <p className="mt-2 text-xl text-text">
            {formatPercent(contextAnalytics.deviceJourney.crossPlatformSessionShare)}
          </p>
        </Card>
        <Card className={premiumCardClass}>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Country volatility index</p>
          <p className="mt-2 text-xl text-text">{contextAnalytics.countryVolatilityIndex.toFixed(2)}</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardTitle>Country footprint</CardTitle>
          <CardDescription className="mt-1">
            Home country {contextAnalytics.country.homeCountry ?? 'N/A'} · domestic{' '}
            {formatPercent(contextAnalytics.country.domesticShare)} · travel{' '}
            {formatPercent(contextAnalytics.country.travelShare)}
          </CardDescription>
          <ChartContainer ariaLabel="Country footprint top countries bar chart" className="mt-3" height={260}>
            <BarChart data={contextAnalytics.country.topCountries.slice(0, 8)}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="country" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="plays">
                {contextAnalytics.country.topCountries.slice(0, 8).map((item, index) => (
                  <Cell key={`${item.country}-${index}`} fill={`var(--color-chart-${index % 10})`} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className={premiumCardClass}>
          <CardTitle>Country timeline</CardTitle>
          <CardDescription className="mt-1">Distinct countries active per month.</CardDescription>
          <ChartContainer ariaLabel="Country timeline line chart" className="mt-3" height={260}>
            <LineChart data={contextAnalytics.country.timeline}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="key" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="countryCount" stroke="var(--color-chart-0)" strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardTitle>Playback intent map</CardTitle>
          <CardDescription className="mt-1">
            Top transitions from reason_start → reason_end.
          </CardDescription>
          <ol className="mt-3 space-y-2">
            {topReasons.map((item) => (
              <li
                key={`${item.from}-${item.to}`}
                className="flex items-center justify-between rounded-theme border border-border/60 bg-surface-hover/60 px-3 py-2 text-sm"
              >
                <span className="text-text">
                  {item.from} → {item.to}
                </span>
                <span className="text-text-muted">
                  {item.count.toLocaleString()} · {formatPercent(item.share)}
                </span>
              </li>
            ))}
          </ol>
          {contextAnalytics.reasons.transitions.length > 4 ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 px-0 text-xs"
              aria-expanded={showAllReasonTransitions}
              onClick={() => setShowAllReasonTransitions((value) => !value)}
            >
              {showAllReasonTransitions ? 'Show fewer transitions' : 'Show all transitions'}
            </Button>
          ) : null}
        </Card>

        <Card className={premiumCardClass}>
          <CardTitle>Start/End reason mix</CardTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Start reasons</p>
              <ol className="mt-2 space-y-2">
                {contextAnalytics.reasons.start.slice(0, 6).map((item) => (
                  <li
                    key={item.reason}
                    className="flex items-center justify-between rounded-theme border border-border/60 bg-surface-hover/60 px-3 py-2 text-sm"
                  >
                    <span className="text-text">{item.reason}</span>
                    <span className="text-text-muted">{formatPercent(item.share)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">End reasons</p>
              <ol className="mt-2 space-y-2">
                {contextAnalytics.reasons.end.slice(0, 6).map((item) => (
                  <li
                    key={item.reason}
                    className="flex items-center justify-between rounded-theme border border-border/60 bg-surface-hover/60 px-3 py-2 text-sm"
                  >
                    <span className="text-text">{item.reason}</span>
                    <span className="text-text-muted">{formatPercent(item.share)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mt-3 rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs text-text-muted">
              Longest repeated start-reason streak
            </p>
            <p className="mt-1 text-sm text-text">
              {contextAnalytics.intentPersistence.longestReasonStartStreak
                ? `${contextAnalytics.intentPersistence.longestReasonStartStreak.reason} × ${contextAnalytics.intentPersistence.longestReasonStartStreak.count}`
                : 'N/A'}
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardTitle>Offline & privacy behavior</CardTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Offline rate</p>
              <p className="mt-1 text-xl text-text">{formatPercent(contextAnalytics.offlinePrivacy.offlineRate)}</p>
            </div>
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Incognito rate</p>
              <p className="mt-1 text-xl text-text">{formatPercent(contextAnalytics.offlinePrivacy.incognitoRate)}</p>
            </div>
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Offline timestamp coverage</p>
              <p className="mt-1 text-xl text-text">
                {formatPercent(contextAnalytics.offlinePrivacy.offlineTimestampCoverage)}
              </p>
            </div>
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Inconsistent offline rows</p>
              <p className="mt-1 text-xl text-text">
                {contextAnalytics.offlinePrivacy.inconsistentOfflineTimestampCount.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className={premiumCardClass}>
          <CardTitle>Device journey</CardTitle>
          <CardDescription className="mt-1">
            Cross-platform handoff share {formatPercent(contextAnalytics.deviceJourney.crossPlatformSessionShare)}
          </CardDescription>
          <ol className="mt-3 space-y-2">
            {topDeviceTransitions.map((item) => (
              <li
                key={`${item.from}-${item.to}`}
                className="flex items-center justify-between rounded-theme border border-border/60 bg-surface-hover/60 px-3 py-2 text-sm"
              >
                <span className="text-text">
                  {item.from} → {item.to}
                </span>
                <span className="text-text-muted">
                  {item.count.toLocaleString()} · {formatPercent(item.share)}
                </span>
              </li>
            ))}
          </ol>
          {contextAnalytics.deviceJourney.transitions.length > 4 ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 px-0 text-xs"
              aria-expanded={showAllDeviceTransitions}
              onClick={() => setShowAllDeviceTransitions((value) => !value)}
            >
              {showAllDeviceTransitions ? 'Show fewer device transitions' : 'Show all device transitions'}
            </Button>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Country volatility index</p>
              <p className="mt-1 text-sm text-text">
                {contextAnalytics.countryVolatilityIndex.toFixed(2)}
              </p>
            </div>
            <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
              <p className="text-xs text-text-muted">Dominant daypart transition</p>
              <p className="mt-1 text-sm text-text">
                {contextAnalytics.sessionDayparts.dominantTransition
                  ? `${contextAnalytics.sessionDayparts.dominantTransition.from} → ${contextAnalytics.sessionDayparts.dominantTransition.to}`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

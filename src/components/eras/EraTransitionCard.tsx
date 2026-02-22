import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { EraData } from '@/lib/types'

interface EraTransitionCardProps {
  era?: EraData
  previousEra?: EraData
}

function driverLabel(key: EraData['changeDrivers'][number]['key']): string {
  switch (key) {
    case 'artist-turnover':
      return 'Artist turnover'
    case 'dominance-shift':
      return 'Dominance shift'
    case 'behavior-shift':
      return 'Behavior shift'
    case 'context-shift':
      return 'Context shift'
    case 'sparse-data':
      return 'Sparse-data smoothing'
    default:
      return key
  }
}

export function EraTransitionCard({
  era,
  previousEra,
}: EraTransitionCardProps): JSX.Element {
  if (!era) {
    return (
      <Card>
        <CardTitle>Transition Diagnostics</CardTitle>
        <CardDescription className="mt-2">Select an era to inspect transition diagnostics.</CardDescription>
      </Card>
    )
  }

  if (!previousEra || !era.transitionFromPrevious) {
    return (
      <Card>
        <CardTitle>Transition Diagnostics</CardTitle>
        <CardDescription className="mt-1">
          This is the first detected era, so there is no previous transition to analyze.
        </CardDescription>
        <div className="mt-4 rounded-theme border border-border bg-surface-hover p-3 text-sm text-text-muted">
          Era confidence: {Math.round(era.confidence * 100)}%
        </div>
      </Card>
    )
  }

  return (
    <Card className="min-w-0">
      <CardTitle>Transition Diagnostics</CardTitle>
      <CardDescription className="mt-1">
        {previousEra.label} → {era.label}
      </CardDescription>

      <div className="mt-4 rounded-theme border border-border bg-surface-hover p-3">
        <p className="text-sm text-text">{era.transitionFromPrevious.summary}</p>
        <p className="mt-2 text-xs text-text-muted">
          Transition confidence: {Math.round(era.transitionFromPrevious.confidence * 100)}%
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Change Decomposition</p>
          <ul className="mt-3 space-y-3">
            {era.changeDrivers.map((driver) => (
              <li key={driver.key}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-text">{driverLabel(driver.key)}</span>
                  <span className="text-text-muted">{Math.round(driver.weight * 100)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(4, Math.round(driver.weight * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted">{driver.description}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Top Arrivals / Departures</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-muted">Arrivals</p>
              <ul className="mt-2 space-y-1 text-sm text-text">
                {(era.topArrivals?.length ? era.topArrivals : ['No clear new arrivals']).map((artist) => (
                  <li key={`in-${artist}`} className="truncate">{artist}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-text-muted">Departures</p>
              <ul className="mt-2 space-y-1 text-sm text-text">
                {(era.topDepartures?.length ? era.topDepartures : ['No clear departures']).map((artist) => (
                  <li key={`out-${artist}`} className="truncate">{artist}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

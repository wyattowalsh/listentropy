import type { ProcessedDataModel } from '@/lib/types'

interface DeviceJourneyCardProps {
  data: ProcessedDataModel
}

export function DeviceJourneyCard({ data }: DeviceJourneyCardProps): JSX.Element {
  const transitions = data.contextAnalytics.deviceJourney.transitions.slice(0, 5)

  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Device Journey</h3>
      <p className="mt-2 text-sm text-text-muted">
        Cross-platform handoff {Math.round(data.contextAnalytics.deviceJourney.crossPlatformSessionShare * 100)}%
      </p>
      <ol className="mt-8 space-y-3">
        {transitions.map((item, index) => (
          <li key={`${item.from}-${item.to}`} className="flex items-center justify-between rounded-theme border border-border bg-surface-hover p-3 text-sm">
            <span className="text-text">
              #{index + 1} {item.from} → {item.to}
            </span>
            <span className="text-text-muted">{item.count.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

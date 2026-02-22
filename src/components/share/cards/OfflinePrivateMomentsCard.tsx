import type { ProcessedDataModel } from '@/lib/types'

interface OfflinePrivateMomentsCardProps {
  data: ProcessedDataModel
}

export function OfflinePrivateMomentsCard({ data }: OfflinePrivateMomentsCardProps): JSX.Element {
  const offline = data.contextAnalytics.offlinePrivacy
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Offline & Private Moments</h3>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-theme border border-border bg-surface-hover p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Offline Rate</p>
          <p className="mt-2 font-heading text-3xl text-text">{Math.round(offline.offlineRate * 100)}%</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Incognito Rate</p>
          <p className="mt-2 font-heading text-3xl text-text">{Math.round(offline.incognitoRate * 100)}%</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Timestamp Coverage</p>
          <p className="mt-2 font-heading text-3xl text-text">{Math.round(offline.offlineTimestampCoverage * 100)}%</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Inconsistencies</p>
          <p className="mt-2 font-heading text-3xl text-text">
            {offline.inconsistentOfflineTimestampCount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

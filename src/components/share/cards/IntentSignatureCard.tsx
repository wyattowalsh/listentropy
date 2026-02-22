import type { ProcessedDataModel } from '@/lib/types'

interface IntentSignatureCardProps {
  data: ProcessedDataModel
}

export function IntentSignatureCard({ data }: IntentSignatureCardProps): JSX.Element {
  const transitions = data.contextAnalytics.reasons.transitions.slice(0, 5)
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Intent Signature</h3>
      <p className="mt-2 text-sm text-text-muted">How listening sessions start and end in your history.</p>
      <ol className="mt-8 space-y-3">
        {transitions.map((item, index) => (
          <li key={`${item.from}-${item.to}`} className="rounded-theme border border-border bg-surface-hover p-3 text-sm">
            <p className="text-text">
              #{index + 1} {item.from} → {item.to}
            </p>
            <p className="mt-1 text-text-muted">
              {item.count.toLocaleString()} plays · {Math.round(item.share * 100)}%
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

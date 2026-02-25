import { cn } from '@/lib/utils'
import type { ConfidenceScore } from '@/lib/types'

interface ConfidenceBadgeProps {
  confidence?: ConfidenceScore
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps): JSX.Element {
  if (!confidence) {
    return (
      <span className="rounded-theme border border-border px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">
        no score
      </span>
    )
  }

  return (
    <span
      className={cn(
        'rounded-theme border px-2 py-1 text-[10px] uppercase tracking-[0.14em]',
        confidence.label === 'high' && 'border-emerald-500/40 text-emerald-300',
        confidence.label === 'medium' && 'border-amber-500/40 text-amber-300',
        confidence.label === 'low' && 'border-negative/40 text-negative',
      )}
      title={confidence.reasons.join(' · ')}
    >
      {confidence.label} {Math.round(confidence.value * 100)}
    </span>
  )
}

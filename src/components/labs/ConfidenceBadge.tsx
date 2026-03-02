import { cn } from '@/lib/utils'
import type { ConfidenceScore } from '@/lib/types'

interface ConfidenceBadgeProps {
  confidence?: ConfidenceScore
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps): JSX.Element {
  if (!confidence) {
    return (
      <span className="inline-flex items-center rounded-theme border border-border bg-surface px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">
        no confidence
      </span>
    )
  }

  const score = Math.round(confidence.value * 100)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-theme border px-2 py-1 text-[10px] uppercase tracking-[0.14em]',
        confidence.label === 'high' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        confidence.label === 'medium' && 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        confidence.label === 'low' && 'border-negative/40 bg-negative/10 text-negative',
      )}
      title={confidence.reasons.join(' · ')}
    >
      <span>{confidence.label}</span>
      <span className="rounded border border-current/30 px-1 py-0.5 leading-none">{score}</span>
    </span>
  )
}

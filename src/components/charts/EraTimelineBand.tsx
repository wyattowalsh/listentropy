import type { EraData } from '@/lib/types'
import { cn } from '@/lib/utils'

interface EraTimelineBandProps {
  eras: EraData[]
  activeEraId?: string
  onSelectEra?: (eraId: string) => void
}

function confidenceStyles(confidence: number, active: boolean): string {
  if (active) {
    return 'border-accent bg-accent/15 text-text shadow-[inset_0_0_0_1px_var(--color-accent)]'
  }
  if (confidence >= 0.75) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-text'
  }
  if (confidence >= 0.5) {
    return 'border-amber-500/40 bg-amber-500/10 text-text'
  }
  return 'border-border bg-surface-hover text-text-muted'
}

export function EraTimelineBand({
  eras,
  activeEraId,
  onSelectEra,
}: EraTimelineBandProps): JSX.Element {
  if (eras.length === 0) {
    return (
      <div className="rounded-theme border border-dashed border-border bg-surface-hover p-3 text-sm text-text-muted">
        No eras available yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        className="flex min-w-0 gap-2 overflow-x-auto pb-1"
        role="list"
        aria-label="Era timeline segments"
      >
        {eras.map((era) => {
          const active = era.id === activeEraId
          return (
            <button
              key={era.id}
              type="button"
              role="listitem"
              onClick={() => onSelectEra?.(era.id)}
              className={cn(
                'min-w-[9rem] flex-1 rounded-theme border px-3 py-2 text-left text-xs transition',
                confidenceStyles(era.confidence, active),
              )}
              style={{ flexGrow: Math.max(1, era.durationMonths) }}
              aria-pressed={active}
            >
              <p className="truncate font-medium">{era.label}</p>
              <p className="mt-1 truncate text-[11px] opacity-80">
                {era.startMonth} → {era.endMonth}
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                {era.durationMonths} mo · {Math.round(era.confidence * 100)}% conf
              </p>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] text-text-muted">
        <span>Lower confidence</span>
        <span>Higher confidence</span>
      </div>
    </div>
  )
}

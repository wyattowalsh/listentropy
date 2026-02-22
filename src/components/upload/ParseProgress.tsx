import type { ParseProgress as ParseProgressType } from '@/lib/types'

interface ParseProgressProps {
  progress: ParseProgressType | null
}

export function ParseProgress({ progress }: ParseProgressProps): JSX.Element {
  if (!progress) {
    return (
      <div className="mt-6 rounded-theme border border-border bg-surface p-4 text-sm text-text-muted">
        Initializing parser...
      </div>
    )
  }

  const ratio =
    progress.totalFiles > 0 ? Math.min(100, (progress.filesParsed / progress.totalFiles) * 100) : 5
  const firstValueHint =
    progress.stage === 'parsing'
      ? `Preflight signal: ${progress.recordsParsed.toLocaleString()} rows parsed so far.`
      : progress.stage === 'aggregation'
        ? 'Building first insights from your parsed history…'
        : progress.recordsParsed > 0
          ? `Working across ${progress.recordsParsed.toLocaleString()} records…`
          : 'Preparing local processing pipeline…'

  return (
    <div className="mt-6 rounded-theme border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">
        {progress.stage} · Parsed {progress.recordsParsed.toLocaleString()} records
      </p>
      <p className="mt-1 text-xs text-text-muted">{firstValueHint}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  )
}

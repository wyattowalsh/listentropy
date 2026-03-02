import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from '@/components/labs/ConfidenceBadge'
import type {
  AudioAffectOverlayPayload,
  ForecastSnapshotPayload,
  LabModuleManifest,
  LabModuleResult,
  LabModuleStatus,
} from '@/lib/types'

interface ModuleResultCardProps {
  manifest: LabModuleManifest
  status: LabModuleStatus
  result?: LabModuleResult
  onRun: () => void
  onRetry: () => void
  onExplain: () => void
}

function statusText(status: LabModuleStatus): string {
  switch (status) {
    case 'idle': return 'Not started'
    case 'running': return 'Running…'
    case 'ready': return 'Ready'
    case 'unsupported': return 'Unavailable'
    case 'error': return 'Action needed'
  }
}

function statusTone(status: LabModuleStatus): string {
  switch (status) {
    case 'running': return 'border-accent/40 bg-accent/10 text-accent'
    case 'ready': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'unsupported': return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'error': return 'border-negative/40 bg-negative/10 text-negative'
    case 'idle':
    default:
      return 'border-border bg-surface text-text-muted'
  }
}

function asAudioAffectOverlayPayload(manifest: LabModuleManifest, result?: LabModuleResult): AudioAffectOverlayPayload | null {
  if (manifest.id !== 'audio-affect-overlay' || result?.status !== 'ready' || !result.payload) {
    return null
  }
  const payload = result.payload as Partial<AudioAffectOverlayPayload>
  if (
    !payload.coverage ||
    typeof payload.coverage !== 'object' ||
    !payload.overallCentroid ||
    typeof payload.overallCentroid !== 'object' ||
    !payload.daypartCentroids ||
    typeof payload.daypartCentroids !== 'object'
  ) {
    return null
  }
  return payload as AudioAffectOverlayPayload
}

function asForecastSnapshotPayload(manifest: LabModuleManifest, result?: LabModuleResult): ForecastSnapshotPayload | null {
  if (manifest.id !== 'forecast-snapshot' || result?.status !== 'ready' || !result.payload) {
    return null
  }
  const payload = result.payload as Partial<ForecastSnapshotPayload>
  if (
    typeof payload.nextMonth !== 'string' ||
    !payload.bands ||
    typeof payload.bands !== 'object' ||
    !payload.anomalyRisk ||
    typeof payload.anomalyRisk !== 'object' ||
    !Array.isArray(payload.trendSignals)
  ) {
    return null
  }
  return payload as ForecastSnapshotPayload
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function score100(value: number): string {
  return `${Math.round(value * 100)} / 100`
}

export function ModuleResultCard({ manifest, status, result, onRun, onRetry, onExplain }: ModuleResultCardProps): JSX.Element {
  const audioAffectPayload = asAudioAffectOverlayPayload(manifest, result)
  const forecastSnapshotPayload = asForecastSnapshotPayload(manifest, result)
  const audioTraitCapability = audioAffectPayload
    ? ('audioFeatures' in audioAffectPayload.capabilities
      ? audioAffectPayload.capabilities.audioFeatures
      : audioAffectPayload.capabilities.audioTraits)
    : null

  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{manifest.name}</CardTitle>
            <span className={`rounded-theme border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusTone(status)}`}>
              {statusText(status)}
            </span>
          </div>
          <CardDescription>{manifest.description}</CardDescription>
        </div>
        <ConfidenceBadge confidence={result?.confidence} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span className="rounded-theme border border-border bg-surface-hover px-2 py-1">{manifest.category}</span>
        <span className="rounded-theme border border-border bg-surface-hover px-2 py-1">{manifest.perfTier}</span>
        {manifest.comingSoon ? <span className="rounded-theme border border-border bg-surface-hover px-2 py-1">coming soon</span> : null}
        {audioAffectPayload ? (
          <>
            <span className="rounded-theme border border-border bg-surface-hover px-2 py-1">
              coverage {percent(audioAffectPayload.coverage.rowsCoverageShare)}
            </span>
            <span className="rounded-theme border border-border bg-surface-hover px-2 py-1">
              traits {audioTraitCapability ?? 'unknown'}
            </span>
          </>
        ) : null}
      </div>
      {result?.message ? <p className="mt-3 rounded-theme border border-border bg-surface-hover p-2 text-sm text-text-muted">{result.message}</p> : null}
      {result?.error ? <p className="mt-3 rounded-theme border border-negative/40 bg-negative/10 p-2 text-sm text-negative">{result.error}</p> : null}
      {audioAffectPayload ? (
        <div className="mt-3 space-y-3 rounded-theme border border-border bg-surface-hover p-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Audio Trait Coverage</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Row Coverage</p>
                <p className="text-sm text-text">{percent(audioAffectPayload.coverage.rowsCoverageShare)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Track Coverage</p>
                <p className="text-sm text-text">{percent(audioAffectPayload.coverage.uniqueTrackCoverageShare)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Matched Rows</p>
                <p className="text-sm text-text">
                  {audioAffectPayload.coverage.rowsMatchedToTrait.toLocaleString()} / {audioAffectPayload.coverage.rowsWithTrackUri.toLocaleString()}
                </p>
              </div>
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Matched Tracks</p>
                <p className="text-sm text-text">
                  {audioAffectPayload.coverage.uniqueTrackIdsResolved.toLocaleString()} / {audioAffectPayload.coverage.uniqueTrackIdsRequested.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Overall Trait Centroid</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Danceability</p>
                <p className="text-sm text-text">{score100(audioAffectPayload.overallCentroid.danceability)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Energy</p>
                <p className="text-sm text-text">{score100(audioAffectPayload.overallCentroid.energy)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Valence</p>
                <p className="text-sm text-text">{score100(audioAffectPayload.overallCentroid.valence)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface p-2">
                <p className="text-xs text-text-muted">Tempo (normalized)</p>
                <p className="text-sm text-text">{score100(audioAffectPayload.overallCentroid.tempo)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-theme border border-border bg-surface p-2">
              <p className="text-xs text-text-muted">Era Centroids</p>
              <p className="text-sm text-text">{audioAffectPayload.eraCentroids.length}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface p-2">
              <p className="text-xs text-text-muted">Late-Night Sample Rows</p>
              <p className="text-sm text-text">{audioAffectPayload.daypartCentroids['late-night'].sampleRows.toLocaleString()}</p>
            </div>
          </div>
        </div>
      ) : null}
      {forecastSnapshotPayload ? (
        <div className="mt-3 space-y-3 rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Forecast Snapshot</p>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-theme border border-border bg-surface p-2">
              <p className="text-xs text-text-muted">Forecast Month</p>
              <p className="text-sm text-text">{forecastSnapshotPayload.nextMonth}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface p-2">
              <p className="text-xs text-text-muted">Anomaly Risk</p>
              <p className="text-sm text-text">{forecastSnapshotPayload.anomalyRisk.level}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface p-2">
              <p className="text-xs text-text-muted">Basis Months</p>
              <p className="text-sm text-text">{forecastSnapshotPayload.basisMonths.length}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-text-muted">Forecast Bands (midpoints)</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
              <li className="rounded-theme border border-border bg-surface p-2 text-text">
                {Math.round(forecastSnapshotPayload.bands.plays.mid).toLocaleString()} plays
              </li>
              <li className="rounded-theme border border-border bg-surface p-2 text-text">
                {forecastSnapshotPayload.bands.totalHours.mid.toFixed(1)} h
              </li>
              <li className="rounded-theme border border-border bg-surface p-2 text-text">
                {Math.round(forecastSnapshotPayload.bands.skipRate.mid * 100)}% skip
              </li>
              <li className="rounded-theme border border-border bg-surface p-2 text-text">
                {Math.round(forecastSnapshotPayload.bands.shuffleRate.mid * 100)}% shuffle
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs text-text-muted">Trend Signals</p>
            <ul className="mt-2 space-y-1 text-sm text-text">
              {forecastSnapshotPayload.trendSignals.slice(0, 4).map((signal) => (
                <li key={signal.key}>
                  {signal.label}: {signal.direction} ({Math.round(signal.strength * 100)}%)
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={status === 'ready' ? 'outline' : 'default'} onClick={onRun} disabled={status === 'running' || manifest.comingSoon}>
          {status === 'running' ? 'Running…' : status === 'ready' ? 'Run Again' : 'Run'}
        </Button>
        <Button variant="outline" onClick={onRetry} disabled={status === 'running' || manifest.comingSoon}>Retry</Button>
        <Button variant="ghost" onClick={onExplain} disabled={!result?.provenance}>Explain</Button>
      </div>
    </Card>
  )
}

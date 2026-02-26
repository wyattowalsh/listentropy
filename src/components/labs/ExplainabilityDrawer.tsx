import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from '@/components/labs/ConfidenceBadge'
import type {
  AudioAffectOverlayPayload,
  ForecastSnapshotPayload,
  LabModuleManifest,
  LabModuleResult,
} from '@/lib/types'

interface ExplainabilityDrawerProps {
  manifest?: LabModuleManifest
  result?: LabModuleResult
  onClose?: () => void
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function asAudioAffectPayload(manifest?: LabModuleManifest, result?: LabModuleResult): AudioAffectOverlayPayload | null {
  if (manifest?.id !== 'audio-affect-overlay' || result?.status !== 'ready' || !result.payload) {
    return null
  }

  const payload = result.payload as Partial<AudioAffectOverlayPayload>
  if (
    !payload.coverage ||
    typeof payload.coverage !== 'object' ||
    !payload.capabilities ||
    typeof payload.capabilities !== 'object'
  ) {
    return null
  }

  return payload as AudioAffectOverlayPayload
}

function asForecastSnapshotPayload(manifest?: LabModuleManifest, result?: LabModuleResult): ForecastSnapshotPayload | null {
  if (manifest?.id !== 'forecast-snapshot' || result?.status !== 'ready' || !result.payload) {
    return null
  }

  const payload = result.payload as Partial<ForecastSnapshotPayload>
  if (
    typeof payload.nextMonth !== 'string' ||
    !payload.anomalyRisk ||
    typeof payload.anomalyRisk !== 'object' ||
    !Array.isArray(payload.basisMonths)
  ) {
    return null
  }

  return payload as ForecastSnapshotPayload
}

export function ExplainabilityDrawer({ manifest, result, onClose }: ExplainabilityDrawerProps): JSX.Element {
  const audioAffectPayload = asAudioAffectPayload(manifest, result)
  const forecastSnapshotPayload = asForecastSnapshotPayload(manifest, result)
  const audioTraitCapability = audioAffectPayload
    ? ('audioFeatures' in audioAffectPayload.capabilities
      ? audioAffectPayload.capabilities.audioFeatures
      : audioAffectPayload.capabilities.audioTraits)
    : null

  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Explainability</CardTitle>
          <CardDescription className="mt-1">
            Confidence, provenance, assumptions, and warnings for the selected Xenolab result.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge confidence={result?.confidence} />
          {onClose ? <Button variant="ghost" onClick={onClose}>Close</Button> : null}
        </div>
      </div>
      {!manifest || !result ? (
        <p className="mt-4 text-sm text-text-muted">Select a module result to inspect its provenance.</p>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Module</p>
            <p className="mt-1 text-text">{manifest.name}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Method</p>
            <p className="mt-1 text-text">{result.provenance?.method ?? 'N/A'}</p>
          </div>
          {audioAffectPayload ? (
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Audio Trait Enrichment</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Row coverage</p>
                  <p className="text-sm text-text">{percent(audioAffectPayload.coverage.rowsCoverageShare)}</p>
                </div>
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Track coverage</p>
                  <p className="text-sm text-text">{percent(audioAffectPayload.coverage.uniqueTrackCoverageShare)}</p>
                </div>
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Audio trait capability</p>
                  <p className="text-sm text-text">{audioTraitCapability ?? 'unknown'}</p>
                </div>
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Matched rows</p>
                  <p className="text-sm text-text">
                    {audioAffectPayload.coverage.rowsMatchedToTrait.toLocaleString()} / {audioAffectPayload.coverage.rowsWithTrackUri.toLocaleString()}
                  </p>
                </div>
              </div>
              {audioAffectPayload.notes.length ? (
                <p className="mt-2 text-xs text-text-muted">{audioAffectPayload.notes.slice(0, 2).join(' · ')}</p>
              ) : null}
            </div>
          ) : null}
          {forecastSnapshotPayload ? (
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Forecast Context</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Forecast month</p>
                  <p className="text-sm text-text">{forecastSnapshotPayload.nextMonth}</p>
                </div>
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Anomaly risk</p>
                  <p className="text-sm text-text">{forecastSnapshotPayload.anomalyRisk.level}</p>
                </div>
                <div className="rounded-theme border border-border bg-surface p-2">
                  <p className="text-xs text-text-muted">Basis months</p>
                  <p className="text-sm text-text">{forecastSnapshotPayload.basisMonths.length}</p>
                </div>
              </div>
              {forecastSnapshotPayload.anomalyRisk.reasons.length ? (
                <p className="mt-2 text-xs text-text-muted">
                  {forecastSnapshotPayload.anomalyRisk.reasons.slice(0, 2).join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Assumptions</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-text-muted">
                {(result.provenance?.assumptions ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-text-muted">
                {(result.provenance?.warnings?.length ? result.provenance.warnings : ['No module warnings.']).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Source fields</p>
            <p className="mt-1 text-text">{(result.provenance?.sourceFields ?? []).join(', ') || 'N/A'}</p>
            <p className="mt-2 text-xs text-text-muted">
              Duration {result.provenance?.durationMs ?? 0}ms · computed {result.provenance?.computedAt ?? 'N/A'}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

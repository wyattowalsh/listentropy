import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type {
  CompareEnginePayload,
  CompareEngineScopeId,
  LabCompareDatasetSnapshot,
  LabCompareSnapshotEntry,
  LabDatasetSnapshot,
  LabModuleResult,
  LabModuleStatus,
  ParseProgress,
} from '@/lib/types'

interface CompareWorkspacePanelProps {
  currentSnapshot: LabDatasetSnapshot
  baselineSnapshot: LabCompareDatasetSnapshot | null
  importedSnapshot: LabCompareDatasetSnapshot | null
  savedSnapshots: LabCompareSnapshotEntry[]
  selectedBaselineSnapshotId: string | null
  scopeId: CompareEngineScopeId
  baselineEraId: string | null
  currentEraId: string | null
  importMode: 'idle' | 'parsing' | 'ready' | 'error'
  importProgress: ParseProgress | null
  importError: string | null
  compareStatus: LabModuleStatus
  compareResult?: LabModuleResult
  onCaptureBaseline: () => void
  onClearBaseline: () => void
  onImportCompareFile: (file: File) => void
  onClearImported: () => void
  onUseImportedAsBaseline: () => void
  onUseSavedSnapshotAsBaseline: (snapshotId: string) => void
  onRemoveSavedSnapshot: (snapshotId: string) => void
  onSetScopeId: (scopeId: CompareEngineScopeId) => void
  onSetBaselineEraId: (eraId: string | null) => void
  onSetCurrentEraId: (eraId: string | null) => void
  onRunCompare: () => void
  onExplainCompare: () => void
}

function formatSigned(value: number, digits = 3): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded > 0) {
    return `+${rounded}`
  }
  return `${rounded}`
}

function asComparePayload(result?: LabModuleResult): CompareEnginePayload | undefined {
  return result?.status === 'ready' ? (result.payload as CompareEnginePayload) : undefined
}

function divergingBarHalfWidth(value: number, maxAbs: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) {
    return '0%'
  }
  const normalized = Math.min(1, Math.max(0, Math.abs(value) / maxAbs))
  return `${Math.round(normalized * 100)}%`
}

export function CompareWorkspacePanel({
  currentSnapshot,
  baselineSnapshot,
  importedSnapshot,
  savedSnapshots,
  selectedBaselineSnapshotId,
  scopeId,
  baselineEraId,
  currentEraId,
  importMode,
  importProgress,
  importError,
  compareStatus,
  compareResult,
  onCaptureBaseline,
  onClearBaseline,
  onImportCompareFile,
  onClearImported,
  onUseImportedAsBaseline,
  onUseSavedSnapshotAsBaseline,
  onRemoveSavedSnapshot,
  onSetScopeId,
  onSetBaselineEraId,
  onSetCurrentEraId,
  onRunCompare,
  onExplainCompare,
}: CompareWorkspacePanelProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const payload = asComparePayload(compareResult)
  const eraVsEraNotes = payload?.eraVsEra?.notes ?? []
  const eraDominantArtistOverlap = payload?.eraVsEra?.dominantArtistOverlap ?? {
    overlapShare: 0,
    rankWeightedOverlapScore: 0,
    sharedDominantArtists: [],
    rankAlignedSharedArtists: [],
    baselineOnlyDominantArtists: [],
    currentOnlyDominantArtists: [],
  }
  const eraChangeDriverOverlap = payload?.eraVsEra?.changeDriverOverlap ?? {
    overlapShare: 0,
    sharedDriverKeys: [],
    baselineOnlyDriverKeys: [],
    currentOnlyDriverKeys: [],
  }
  const visualMetricRows = payload?.topMetricShifts.slice(0, 5) ?? []
  const visualMetricMaxAbs = Math.max(0.0001, ...visualMetricRows.map((row) => row.absDelta))
  const visualArchetypeRows = payload?.archetypeTournament?.rankings.slice(0, 5) ?? []
  const visualArchetypeMaxAbs = Math.max(0.0001, ...visualArchetypeRows.map((row) => row.absDelta))
  const sameFingerprint = baselineSnapshot?.datasetIdentity.fingerprint === currentSnapshot.datasetIdentity.fingerprint
  const importedMatchesBaseline =
    importedSnapshot?.datasetIdentity.fingerprint !== undefined &&
    baselineSnapshot?.datasetIdentity.fingerprint === importedSnapshot.datasetIdentity.fingerprint
  const baselineEras = baselineSnapshot?.eras ?? []
  const currentEras = currentSnapshot.eras ?? []

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Compare Workspace</CardTitle>
          <CardDescription className="mt-1">
            Pin a local baseline dataset, then compare the current upload against it using deferred local-only analytics.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMode === 'parsing'}>
            {importMode === 'parsing' ? 'Importing…' : 'Import Compare Zip'}
          </Button>
          <Button variant="outline" onClick={onCaptureBaseline}>Capture Current as Baseline</Button>
          <Button variant="outline" onClick={onClearBaseline} disabled={!baselineSnapshot}>Clear Baseline</Button>
          <Button onClick={onRunCompare} disabled={compareStatus === 'running'}>
            {compareStatus === 'running' ? 'Comparing…' : 'Run Compare'}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".zip,application/zip,application/x-zip-compressed"
        aria-label="Import compare dataset zip"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            onImportCompareFile(file)
          }
          event.currentTarget.value = ''
        }}
      />

      <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted">Compare Scope</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['night', 'Night'],
              ['offline', 'Offline'],
              ['weekend', 'Weekend'],
              ['travel', 'Travel'],
            ] as const).map(([id, label]) => (
              <Button
                key={id}
                variant={scopeId === id ? 'default' : 'outline'}
                onClick={() => onSetScopeId(id)}
                className="h-8 px-2 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Scope applies to slice deltas in Compare Engine; aggregate deltas remain dataset-wide for context.
        </p>
      </div>

      <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
        <p className="text-xs text-text-muted">Era vs Era Selection</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="block text-xs text-text-muted">Baseline Era</span>
            <select
              className="w-full rounded-theme border border-border bg-surface px-2 py-2 text-sm text-text"
              value={baselineEraId ?? ''}
              onChange={(event) => onSetBaselineEraId(event.target.value || null)}
              disabled={!baselineSnapshot || baselineEras.length === 0}
              aria-label="Baseline era selector"
            >
              <option value="">Auto (latest era)</option>
              {baselineEras.map((era) => (
                <option key={era.id} value={era.id}>
                  {era.label} ({era.startMonth} to {era.endMonth})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block text-xs text-text-muted">Current Era</span>
            <select
              className="w-full rounded-theme border border-border bg-surface px-2 py-2 text-sm text-text"
              value={currentEraId ?? ''}
              onChange={(event) => onSetCurrentEraId(event.target.value || null)}
              disabled={currentEras.length === 0}
              aria-label="Current era selector"
            >
              <option value="">Auto (latest era)</option>
              {currentEras.map((era) => (
                <option key={era.id} value={era.id}>
                  {era.label} ({era.startMonth} to {era.endMonth})
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Leave either selector on Auto to compare the latest available era on that side.
        </p>
      </div>

      <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
        <p className="text-xs text-text-muted">Imported Compare Dataset</p>
        {importedSnapshot ? (
          <div className="mt-2 space-y-2">
            <div className="text-sm text-text">
              <p className="truncate">{importedSnapshot.datasetIdentity.fingerprint}</p>
              <p>{importedSnapshot.datasetIdentity.recordCount.toLocaleString()} records · {importedSnapshot.timezoneMode}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onUseImportedAsBaseline} disabled={importedMatchesBaseline}>
                {importedMatchesBaseline ? 'Imported Baseline Active' : 'Use Imported as Baseline'}
              </Button>
              <Button variant="outline" onClick={onClearImported}>Clear Imported</Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            No imported compare dataset yet. Import a second Spotify zip to compare across exports in this session.
          </p>
        )}
        {importMode === 'parsing' && importProgress ? (
          <p className="mt-2 text-xs text-text-muted">
            Import progress: {importProgress.stage} · {importProgress.recordsParsed.toLocaleString()} records
            {importProgress.totalFiles > 0 ? ` · ${importProgress.filesParsed}/${importProgress.totalFiles} files` : ''}
          </p>
        ) : null}
        {importError ? <p className="mt-2 text-sm text-negative">{importError}</p> : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs text-text-muted">Baseline</p>
          {baselineSnapshot ? (
            <div className="mt-1 space-y-1 text-sm text-text">
              <p className="truncate">{baselineSnapshot.datasetIdentity.fingerprint}</p>
              <p>{baselineSnapshot.datasetIdentity.recordCount.toLocaleString()} records · {baselineSnapshot.timezoneMode}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-text-muted">No baseline captured yet.</p>
          )}
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs text-text-muted">Current</p>
          <div className="mt-1 space-y-1 text-sm text-text">
            <p className="truncate">{currentSnapshot.datasetIdentity.fingerprint}</p>
            <p>{currentSnapshot.datasetIdentity.recordCount.toLocaleString()} records · {currentSnapshot.timezoneMode}</p>
            {sameFingerprint ? <p className="text-xs text-text-muted">Same fingerprint as baseline (self-compare).</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
        <p className="text-xs text-text-muted">Saved Compare Snapshots</p>
        {savedSnapshots.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">No saved compare snapshots yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {savedSnapshots.map((entry) => {
              const isActiveBaseline = selectedBaselineSnapshotId === entry.id
              return (
                <li key={entry.id} className="rounded-theme border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text">{entry.fingerprint}</p>
                      <p className="mt-1 text-xs text-text-muted">{entry.label}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        source {entry.source === 'captured-current' ? 'captured current' : 'imported zip'} · saved {entry.savedAt.slice(11, 19)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => onUseSavedSnapshotAsBaseline(entry.id)}
                        disabled={isActiveBaseline}
                      >
                        {isActiveBaseline ? 'Baseline Active' : 'Use as Baseline'}
                      </Button>
                      <Button variant="ghost" onClick={() => onRemoveSavedSnapshot(entry.id)}>Remove</Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {compareResult?.message ? (
        <p className="mt-3 text-sm text-text-muted">{compareResult.message}</p>
      ) : null}

      {payload ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Plays Δ</p>
              <p className="mt-1 text-sm text-text">{formatSigned(payload.summaryDelta.totalPlaysDelta, 0)}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Skip Rate Δ</p>
              <p className="mt-1 text-sm text-text">{formatSigned(payload.summaryDelta.skipRateDelta, 4)}</p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Travel Share Δ</p>
              <p className="mt-1 text-sm text-text">{formatSigned(payload.summaryDelta.travelShareDelta, 4)}</p>
            </div>
          </div>

          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">
              Slice Compare ({payload.scope.label})
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-text-muted">Records</p>
                <p className="text-sm text-text">
                  {payload.sliceDelta.baselineRecords.toLocaleString()} → {payload.sliceDelta.currentRecords.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Hours Δ</p>
                <p className="text-sm text-text">{formatSigned(payload.sliceDelta.totalHoursDelta, 3)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Skip Rate Δ</p>
                <p className="text-sm text-text">{formatSigned(payload.sliceDelta.skipRateDelta, 4)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-text-muted">Top Metric Shifts</p>
              <Button variant="ghost" onClick={onExplainCompare}>Explain</Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {payload.topMetricShifts.map((shift) => (
                <li key={shift.key} className="flex items-center justify-between gap-2">
                  <span className="text-text">{shift.label}</span>
                  <span className="text-text-muted">{formatSigned(shift.delta, 4)}</span>
                </li>
              ))}
            </ul>
          </div>

          {(visualMetricRows.length || visualArchetypeRows.length) ? (
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Compare Visual Summary</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">Metric Swing Bars</p>
                  {visualMetricRows.length ? (
                    <ul className="space-y-2">
                      {visualMetricRows.map((row) => {
                        const isPositive = row.delta >= 0
                        return (
                          <li key={`metric-${row.key}`} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-text">{row.label}</span>
                              <span className="text-text-muted">{formatSigned(row.delta, 4)}</span>
                            </div>
                            <div className="relative h-2 rounded-full bg-surface">
                              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" aria-hidden="true" />
                              {row.delta !== 0 ? (
                                <div
                                  className={`absolute top-0 h-full rounded-full ${isPositive ? 'bg-accent' : 'bg-border'}`}
                                  style={
                                    isPositive
                                      ? { left: '50%', width: divergingBarHalfWidth(row.delta, visualMetricMaxAbs) }
                                      : { right: '50%', width: divergingBarHalfWidth(row.delta, visualMetricMaxAbs) }
                                  }
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-muted">No metric shifts available.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-text-muted">Archetype Swing Mini Chart</p>
                  {visualArchetypeRows.length ? (
                    <ul className="space-y-2">
                      {visualArchetypeRows.map((row) => {
                        const isPositive = row.delta >= 0
                        return (
                          <li key={`archetype-${row.key}`} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-text">{row.label}</span>
                              <span className="text-text-muted">{row.winner} · {formatSigned(row.delta, 4)}</span>
                            </div>
                            <div className="relative h-2 rounded-full bg-surface">
                              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" aria-hidden="true" />
                              {row.delta !== 0 ? (
                                <div
                                  className={`absolute top-0 h-full rounded-full ${isPositive ? 'bg-accent' : 'bg-border'}`}
                                  style={
                                    isPositive
                                      ? { left: '50%', width: divergingBarHalfWidth(row.delta, visualArchetypeMaxAbs) }
                                      : { right: '50%', width: divergingBarHalfWidth(row.delta, visualArchetypeMaxAbs) }
                                  }
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-muted">No archetype swings available.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {payload.archetypeScoreShifts.length ? (
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Archetype Score Shifts</p>
              <ul className="mt-2 space-y-1 text-sm">
                {payload.archetypeScoreShifts.slice(0, 6).map((shift) => (
                  <li key={shift.key} className="flex items-center justify-between gap-2">
                    <span className="text-text">{shift.label}</span>
                    <span className="text-text-muted">{formatSigned(shift.delta, 4)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {payload.eraPairDeltas.length ? (
            <div className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-xs text-text-muted">Era Pair Deltas</p>
              <ul className="mt-2 space-y-1 text-sm">
                {payload.eraPairDeltas.slice(0, 4).map((pair) => (
                  <li key={`${pair.pairIndex}-${pair.baselineEraId ?? 'none'}-${pair.currentEraId ?? 'none'}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text">
                        {pair.baselineEraLabel ?? 'None'} → {pair.currentEraLabel ?? 'None'}
                      </span>
                      <span className="text-text-muted">div {formatSigned(pair.diversityScoreDelta, 3)}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      dur {formatSigned(pair.durationMonthsDelta, 0)} · dom {formatSigned(pair.dominanceScoreDelta, 3)} · conf {formatSigned(pair.confidenceDelta, 3)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Era vs Era Compare</p>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-text">
                  {payload.eraVsEra.baselineEra?.label ?? 'No baseline era'} → {payload.eraVsEra.currentEra?.label ?? 'No current era'}
                </span>
                <span className="text-text-muted">{payload.eraVsEra.selection.mode}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-text-muted">Duration Δ (months)</p>
                  <p className="text-text">{formatSigned(payload.eraVsEra.delta.durationMonthsDelta, 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Diversity Δ</p>
                  <p className="text-text">{formatSigned(payload.eraVsEra.delta.diversityScoreDelta, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Dominance Δ</p>
                  <p className="text-text">{formatSigned(payload.eraVsEra.delta.dominanceScoreDelta, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Confidence Δ</p>
                  <p className="text-text">{formatSigned(payload.eraVsEra.delta.confidenceDelta, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Dominant Artist Overlap</p>
                  <p className="text-text">{formatSigned(eraDominantArtistOverlap.overlapShare, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Rank-Weighted Overlap</p>
                  <p className="text-text">{formatSigned(eraDominantArtistOverlap.rankWeightedOverlapScore, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Change Driver Overlap</p>
                  <p className="text-text">{formatSigned(eraChangeDriverOverlap.overlapShare, 3)}</p>
                </div>
              </div>
              {eraDominantArtistOverlap.rankAlignedSharedArtists.length ? (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">Aligned Shared Artists (Rank-Aware)</p>
                  <ul className="space-y-1 text-xs">
                    {eraDominantArtistOverlap.rankAlignedSharedArtists.map((item) => (
                      <li key={`rank-align-${item.artist}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-text">{item.artist}</span>
                        <span className="text-text-muted">
                          B#{item.baselineRank} · C#{item.currentRank} · Δr {item.rankDistance}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(eraDominantArtistOverlap.sharedDominantArtists.length ||
                eraDominantArtistOverlap.baselineOnlyDominantArtists.length ||
                eraDominantArtistOverlap.currentOnlyDominantArtists.length) ? (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">Dominant Artist Overlap Details</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-text-muted">Shared</p>
                      {eraDominantArtistOverlap.sharedDominantArtists.length ? (
                        <ul className="mt-1 space-y-1 text-xs text-text">
                          {eraDominantArtistOverlap.sharedDominantArtists.map((artist) => <li key={`shared-${artist}`}>{artist}</li>)}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-text-muted">None</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Baseline Only</p>
                      {eraDominantArtistOverlap.baselineOnlyDominantArtists.length ? (
                        <ul className="mt-1 space-y-1 text-xs text-text">
                          {eraDominantArtistOverlap.baselineOnlyDominantArtists.map((artist) => <li key={`base-${artist}`}>{artist}</li>)}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-text-muted">None</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Current Only</p>
                      {eraDominantArtistOverlap.currentOnlyDominantArtists.length ? (
                        <ul className="mt-1 space-y-1 text-xs text-text">
                          {eraDominantArtistOverlap.currentOnlyDominantArtists.map((artist) => <li key={`current-${artist}`}>{artist}</li>)}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-text-muted">None</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              {(eraChangeDriverOverlap.sharedDriverKeys.length ||
                eraChangeDriverOverlap.baselineOnlyDriverKeys.length ||
                eraChangeDriverOverlap.currentOnlyDriverKeys.length) ? (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">Change Driver Overlap Details</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-text-muted">Shared Drivers</p>
                      <p className="mt-1 text-xs text-text">
                        {eraChangeDriverOverlap.sharedDriverKeys.length
                          ? eraChangeDriverOverlap.sharedDriverKeys.join(', ')
                          : 'None'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Baseline Only</p>
                      <p className="mt-1 text-xs text-text">
                        {eraChangeDriverOverlap.baselineOnlyDriverKeys.length
                          ? eraChangeDriverOverlap.baselineOnlyDriverKeys.join(', ')
                          : 'None'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Current Only</p>
                      <p className="mt-1 text-xs text-text">
                        {eraChangeDriverOverlap.currentOnlyDriverKeys.length
                          ? eraChangeDriverOverlap.currentOnlyDriverKeys.join(', ')
                          : 'None'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {eraVsEraNotes.length ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-text-muted">
                  {eraVsEraNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Archetype Tournament</p>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-text-muted">Current Wins</p>
                <p className="text-sm text-text">{payload.archetypeTournament.summary.currentWins}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Baseline Wins</p>
                <p className="text-sm text-text">{payload.archetypeTournament.summary.baselineWins}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Ties</p>
                <p className="text-sm text-text">{payload.archetypeTournament.summary.ties}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Top Swing</p>
                <p className="text-sm text-text">{payload.archetypeTournament.summary.topSwingLabel ?? 'None'}</p>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-text-muted">
                    <th className="py-1 pr-3">Rank</th>
                    <th className="py-1 pr-3">Archetype</th>
                    <th className="py-1 pr-3">Winner</th>
                    <th className="py-1 pr-3">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.archetypeTournament.rankings.slice(0, 8).map((row) => (
                    <tr key={row.key} className="border-t border-border/60">
                      <td className="py-1 pr-3 text-text-muted">{row.rank}</td>
                      <td className="py-1 pr-3 text-text">{row.label}</td>
                      <td className="py-1 pr-3 text-text-muted">{row.winner}</td>
                      <td className="py-1 pr-3 text-text-muted">{formatSigned(row.delta, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-theme border border-border bg-surface-hover p-3 text-sm">
              <p className="text-xs text-text-muted">Primary Archetype</p>
              <p className="mt-1 text-text">
                {payload.archetypeDelta.baselinePrimaryLabel} → {payload.archetypeDelta.currentPrimaryLabel}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {payload.archetypeDelta.changed ? 'Primary archetype changed.' : 'Primary archetype unchanged.'}
              </p>
            </div>
            <div className="rounded-theme border border-border bg-surface-hover p-3 text-sm">
              <p className="text-xs text-text-muted">Era Count Δ</p>
              <p className="mt-1 text-text">
                {payload.eraDelta.baselineEraCount} → {payload.eraDelta.currentEraCount} ({formatSigned(payload.eraDelta.delta, 0)})
              </p>
            </div>
          </div>

          {payload.notes.length ? (
            <div className="rounded-theme border border-border bg-surface-hover p-3 text-sm">
              <p className="text-xs text-text-muted">Notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-text-muted">
                {payload.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

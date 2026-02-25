import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getSpotifyPkceConfig } from '@/lib/spotify-auth/oauth'
import type { LabDatasetSnapshot, LabModuleStatus } from '@/lib/types'
import { useAudioTraitStore } from '@/store/useAudioTraitStore'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

interface SpotifyConnectCardProps {
  dataset: LabDatasetSnapshot
  audioAffectStatus?: LabModuleStatus
  onRunAudioAffectOverlay?: () => void
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function SpotifyConnectCard({
  dataset,
  audioAffectStatus = 'idle',
  onRunAudioAffectOverlay,
}: SpotifyConnectCardProps): JSX.Element {
  const datasetFingerprint = dataset.datasetIdentity.fingerprint
  const auth = useSpotifyAuthStore(useShallow((state) => ({
    status: state.status,
    session: state.session,
    error: state.error,
    connectSpotify: state.connectSpotify,
    disconnect: state.disconnect,
    setManualToken: state.setManualToken,
    clearManualToken: state.clearManualToken,
  })))

  const audio = useAudioTraitStore(useShallow((state) => ({
    snapshot: state.snapshotByDatasetFingerprint[datasetFingerprint] ?? null,
    status: state.statusByDatasetFingerprint[datasetFingerprint] ?? 'idle',
    error: state.errorByDatasetFingerprint[datasetFingerprint] ?? null,
    capabilityStatus: state.capabilityStatus,
    lastFetchMeta: state.lastFetchMeta,
    ensureSnapshotForDataset: state.ensureSnapshotForDataset,
    clearSnapshot: state.clearSnapshot,
  })))

  const [manualTokenDraft, setManualTokenDraft] = useState(
    () => (auth.session?.tokenSource === 'manual-token' ? auth.session.accessToken : ''),
  )
  const oauthConfig = useMemo(() => {
    try {
      return getSpotifyPkceConfig()
    } catch {
      return { clientId: '', redirectUri: '' }
    }
  }, [])

  const coverage = audio.snapshot?.coverage
  const capability = audio.snapshot?.capabilities
    ? ('audioFeatures' in audio.snapshot.capabilities
      ? audio.snapshot.capabilities.audioFeatures
      : audio.snapshot.capabilities.audioTraits)
    : audio.capabilityStatus

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Spotify Audio Trait Enrichment</CardTitle>
          <CardDescription className="mt-1">
            Optional, local-only enrichment for danceability/energy/valence/tempo overlays. Tokens stay in this browser session by default.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void auth.connectSpotify()} disabled={!oauthConfig.clientId || auth.status === 'authorizing'}>
            {auth.status === 'authorizing' ? 'Redirecting…' : 'Connect Spotify (OAuth)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void audio.ensureSnapshotForDataset(dataset)
            }}
            disabled={audio.status === 'loading'}
          >
            {audio.status === 'loading' ? 'Preparing…' : 'Prepare Audio Trait Snapshot'}
          </Button>
          <Button
            variant={audioAffectStatus === 'ready' ? 'outline' : 'default'}
            onClick={onRunAudioAffectOverlay}
            disabled={!audio.snapshot || audioAffectStatus === 'running' || !onRunAudioAffectOverlay}
          >
            {audioAffectStatus === 'running'
              ? 'Running Overlay…'
              : audioAffectStatus === 'ready'
                ? 'Run Audio Affect Overlay Again'
                : 'Run Audio Affect Overlay'}
          </Button>
          <Button variant="outline" onClick={() => audio.clearSnapshot(datasetFingerprint)} disabled={!audio.snapshot}>
            Clear Snapshot
          </Button>
          <Button variant="outline" onClick={auth.disconnect} disabled={!auth.session}>Disconnect</Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs text-text-muted">Auth status</p>
          <p className="mt-1 text-sm text-text">{auth.status}</p>
          <p className="mt-1 text-xs text-text-muted">{auth.session ? `Source: ${auth.session.tokenSource}` : 'No token in session'}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs text-text-muted">Audio capability</p>
          <p className="mt-1 text-sm text-text">{capability ?? 'unknown'}</p>
          <p className="mt-1 text-xs text-text-muted">Endpoint access may be restricted by Spotify app policy.</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs text-text-muted">Snapshot status</p>
          <p className="mt-1 text-sm text-text">{audio.status}</p>
          {coverage ? (
            <p className="mt-1 text-xs text-text-muted">
              Row coverage {formatPct(coverage.rowsCoverageShare)} · Track coverage {formatPct(coverage.uniqueTrackCoverageShare)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-text-muted">Prepare a snapshot to enable audio-affect overlay.</p>
          )}
          <p className="mt-1 text-xs text-text-muted">Overlay module: {audioAffectStatus}</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs text-text-muted">PKCE config</p>
          <p className="mt-1 text-sm text-text">{oauthConfig.clientId ? 'Configured' : 'Missing VITE_SPOTIFY_CLIENT_ID'}</p>
          <p className="mt-1 break-all text-xs text-text-muted">
            Redirect URI: {oauthConfig.redirectUri || 'N/A'}
          </p>
          {audio.lastFetchMeta ? <p className="mt-1 text-xs text-text-muted">Last fetch: {audio.lastFetchMeta.status}</p> : null}
        </div>
      </div>

      <details className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
        <summary className="cursor-pointer text-sm font-medium text-text">Manual token (advanced / fallback)</summary>
        <p className="mt-2 text-xs text-text-muted">
          Use this if OAuth PKCE is not configured or you want a temporary manual token. Token stays in sessionStorage only.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            aria-label="Spotify manual token"
            className="min-w-[18rem] flex-1"
            placeholder="Spotify API token"
            value={manualTokenDraft}
            onChange={(event) => setManualTokenDraft(event.currentTarget.value)}
          />
          <Button onClick={() => auth.setManualToken(manualTokenDraft)} disabled={!manualTokenDraft.trim()}>
            Save Token
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setManualTokenDraft('')
              auth.clearManualToken()
            }}
          >
            Clear Manual Token
          </Button>
        </div>
      </details>

      {audio.error ? <p className="mt-3 text-sm text-negative">{audio.error}</p> : null}
      {auth.error ? <p className="mt-2 text-sm text-negative">{auth.error}</p> : null}
      {auth.error || !oauthConfig.clientId ? (
        <details className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
          <summary className="cursor-pointer text-sm font-medium text-text">OAuth troubleshooting</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-text-muted">
            <li>Configure `VITE_SPOTIFY_CLIENT_ID` in your local environment and restart the app.</li>
            <li>Add the exact redirect URI shown above to your Spotify app settings.</li>
            <li>Prefer testing on `localhost` or `127.0.0.1` if your Spotify app redirect list is strict.</li>
            <li>If OAuth still fails, use the manual token fallback to test enrichment while debugging app settings.</li>
          </ul>
        </details>
      ) : null}
      {audio.snapshot?.warnings && audio.snapshot.warnings.length > 0 ? (
        <ul className="mt-2 list-disc pl-4 text-xs text-text-muted">
          {audio.snapshot.warnings.slice(0, 4).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

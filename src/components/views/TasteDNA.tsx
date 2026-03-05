import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from 'recharts'

import { ChartContainer } from '@/components/charts/ChartContainer'
import { TasteFingerprint } from '@/components/charts/TasteFingerprint'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { getSpotifyPkceConfig } from '@/lib/spotify-auth/oauth'
import { fetchSpotifyAudioFeatureProfile, type SpotifyAudioProfileResult } from '@/lib/spotify-api'
import type { ProcessedDataModel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

interface TasteDNAProps {
  data: ProcessedDataModel
  onOpenSpotifySetup?: () => void
}

type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger'

interface StatusBadgeProps {
  label: string
  tone: StatusTone
}

function StatusBadge({ label, tone }: StatusBadgeProps): JSX.Element {
  const toneClassName: Record<StatusTone, string> = {
    neutral: 'border-border bg-surface text-text-muted',
    positive: 'border-accent/40 bg-accent/10 text-accent',
    warning: 'border-border bg-surface-hover text-text',
    danger: 'border-negative/40 bg-surface text-negative',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-semibold', toneClassName[tone])}>
      {label}
    </span>
  )
}

export function TasteDNA({ data, onOpenSpotifySetup }: TasteDNAProps): JSX.Element {
  const { status: spotifyAuthStatus, session: spotifySession, authError, connectSpotify, ensureValidAccessToken } =
    useSpotifyAuthStore(useShallow((state) => ({
      status: state.status,
      session: state.session,
      authError: state.error,
      connectSpotify: state.connectSpotify,
      ensureValidAccessToken: state.ensureValidAccessToken,
    })))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overlayDimensions, setOverlayDimensions] = useState<Array<{ key: string; label: string; score: number }>>([])
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyAudioProfileResult | null>(null)
  const [showAllDimensions, setShowAllDimensions] = useState(false)
  const [showAllSpotifyNotes, setShowAllSpotifyNotes] = useState(false)
  const oauthConfigured = useMemo(() => {
    try {
      return Boolean(getSpotifyPkceConfig().clientId)
    } catch {
      return false
    }
  }, [])

  const combinedDimensions = useMemo(() => {
    if (overlayDimensions.length === 0) {
      return data.taste.dimensions
    }
    return [...data.taste.dimensions.slice(0, 6), ...overlayDimensions]
  }, [data.taste.dimensions, overlayDimensions])
  const spotifyConnected = Boolean(spotifySession)
  const hasEnrichment = overlayDimensions.length > 0
  const isAuthBusy = spotifyAuthStatus === 'authorizing' || spotifyAuthStatus === 'refreshing'

  const connectionBadgeLabel =
    spotifyAuthStatus === 'authorizing'
      ? 'Authorizing'
      : spotifyAuthStatus === 'refreshing'
        ? 'Refreshing session'
        : spotifyAuthStatus === 'error'
          ? 'Auth error'
          : spotifyConnected
            ? 'Connected'
            : 'Disconnected'
  const connectionTone: StatusTone = spotifyConnected
    ? 'positive'
    : spotifyAuthStatus === 'error'
      ? 'danger'
      : isAuthBusy
        ? 'warning'
        : 'neutral'

  const overlayBadgeLabel = loading
    ? 'Loading overlay'
    : hasEnrichment
      ? 'Enriched'
      : 'Base profile'
  const overlayTone: StatusTone = loading
    ? 'warning'
    : hasEnrichment
      ? 'positive'
      : 'neutral'

  const nextStepText = loading
    ? 'Fetching audio features and artist neighborhood context from Spotify…'
    : hasEnrichment
      ? 'Overlay is active. Refresh at any time to re-run enrichment with the current session.'
      : spotifyConnected
        ? 'Session is connected. Load Spotify overlay to refresh backend enrichment and artist context.'
        : oauthConfigured
          ? 'Backend enrichment is available without login. Load Spotify overlay now, then connect Spotify (advanced) only if you need fallback controls.'
          : 'Backend enrichment is available without login. Open Advanced setup only when you need manual token fallback controls.'

  const tasteStorySummary = hasEnrichment
    ? `Spotify overlay is active with ${overlayDimensions.length} enrichment dimensions and ${combinedDimensions.length} total dimensions in view.`
    : `Base profile is active across ${combinedDimensions.length} dimensions. Load Spotify overlay for backend audio feature context; advanced auth setup is optional.`

  async function loadSpotifyOverlay(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const activeToken = (await ensureValidAccessToken()) ?? ''
      const result = await fetchSpotifyAudioFeatureProfile(
        activeToken,
        data.tracks
          .map((track) => data.trackUriIndex[`${track.name}::${track.artist}`] ?? null)
          .filter((value): value is string => Boolean(value)),
      )
      setOverlayDimensions(result.dimensions)
      setSpotifyProfile(result)
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle as="h2">Taste DNA</CardTitle>
        <CardDescription className="mt-1">
          Behavioral profile by default. Add Spotify API overlay for audio feature depth.
        </CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Connection state</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge label={connectionBadgeLabel} tone={connectionTone} />
              {spotifySession ? (
                <span className="text-xs text-text-muted">source {spotifySession.tokenSource}</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {spotifyConnected
                ? 'Connected session is reusable across views for advanced fallback controls.'
                : 'No login is required for backend enrichment; session controls remain optional.'}
            </p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Overlay state</p>
            <div className="mt-2">
              <StatusBadge label={overlayBadgeLabel} tone={overlayTone} />
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {hasEnrichment
                ? `${overlayDimensions.length} Spotify dimensions are blended into the base profile.`
                : 'Using behavioral profile only until backend overlay enrichment is loaded.'}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-theme border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Next step</p>
          <p className="mt-1 text-sm text-text" role="status" aria-live="polite">{nextStepText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={loadSpotifyOverlay} disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Loading...' : hasEnrichment ? 'Refresh Spotify Overlay' : 'Load Spotify Overlay'}
            </Button>
            {spotifyConnected ? (
              <Button variant="outline" onClick={onOpenSpotifySetup} className="w-full sm:w-auto">
                Manage Spotify Setup
              </Button>
            ) : oauthConfigured ? (
              <Button
                variant="outline"
                onClick={() => void connectSpotify()}
                disabled={spotifyAuthStatus === 'authorizing'}
                className="w-full sm:w-auto"
              >
                {spotifyAuthStatus === 'authorizing' ? 'Redirecting…' : 'Connect Spotify (advanced)'}
              </Button>
            ) : (
              <Button variant="outline" onClick={onOpenSpotifySetup} className="w-full sm:w-auto">
                Open Advanced Setup
              </Button>
            )}
            {!spotifyConnected && oauthConfigured ? (
              <Button variant="outline" onClick={onOpenSpotifySetup} className="w-full sm:w-auto">
                Open Advanced Setup
              </Button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-theme border border-negative/40 bg-surface px-3 py-2 text-sm text-negative" role="alert">
            {error}
          </p>
        ) : null}
        {authError ? (
          <p className="mt-2 rounded-theme border border-negative/40 bg-surface px-3 py-2 text-sm text-negative" role="alert">
            {authError}
          </p>
        ) : null}
        {spotifyProfile?.warnings && spotifyProfile.warnings.length > 0 ? (
          <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Spotify notes</p>
            <ul className="mt-2 list-disc pl-4 text-xs text-text-muted">
              {spotifyProfile.warnings
                .slice(0, showAllSpotifyNotes ? spotifyProfile.warnings.length : 3)
                .map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
            </ul>
            {spotifyProfile.warnings.length > 3 ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 px-0 text-xs"
                aria-expanded={showAllSpotifyNotes}
                onClick={() => setShowAllSpotifyNotes((value) => !value)}
              >
                {showAllSpotifyNotes ? 'Show fewer notes' : 'Show all notes'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Story summary</p>
        <p className="mt-2 text-sm text-text">{tasteStorySummary}</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Taste Radar</CardTitle>
          <ChartContainer ariaLabel="Taste radar chart" className="mt-3" height={360}>
            <RadarChart data={combinedDimensions.map((dimension) => ({ ...dimension, value: Math.round(dimension.score * 100) }))}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" />
              <PolarRadiusAxis />
              <Radar dataKey="value" stroke="var(--color-chart-0)" fill="var(--color-chart-0)" fillOpacity={0.4} />
              <Tooltip />
            </RadarChart>
          </ChartContainer>
        </Card>
        <Card>
          <CardTitle>Taste Fingerprint</CardTitle>
          <div className="mt-3 flex justify-center">
            <TasteFingerprint
              values={combinedDimensions.map((dimension) => dimension.score).slice(0, 10)}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Dimension Breakdown</CardTitle>
        <CardDescription className="mt-1">Key dimensions first, with optional full breakdown.</CardDescription>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {combinedDimensions
            .slice(0, showAllDimensions ? combinedDimensions.length : 6)
            .map((dimension) => (
              <div key={dimension.key} className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-sm font-semibold text-text">{dimension.label}</p>
                <p className="text-xs text-text-muted">{Math.round(dimension.score * 100)} / 100</p>
              </div>
            ))}
        </div>
        {combinedDimensions.length > 6 ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 px-0 text-xs"
            aria-expanded={showAllDimensions}
            onClick={() => setShowAllDimensions((value) => !value)}
          >
            {showAllDimensions ? 'Show fewer dimensions' : 'Show all dimensions'}
          </Button>
        ) : null}
      </Card>

      {spotifyProfile?.genreAffinities && spotifyProfile.genreAffinities.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardTitle>Genre Affinity Overlay</CardTitle>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {spotifyProfile.genreAffinities.slice(0, 8).map((genre) => (
                <div key={genre.genre} className="rounded-theme border border-border bg-surface-hover p-3">
                  <p className="text-sm text-text">{genre.genre}</p>
                  <p className="text-xs text-text-muted">{Math.round(genre.share * 100)}% of sampled artists</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Artist Neighborhood Quality</CardTitle>
            <p className="mt-2 text-sm text-text-muted">
              {spotifyProfile.neighborhoodQuality?.endpointSupported
                ? `Related-artist overlap score ${Math.round((spotifyProfile.neighborhoodQuality.score ?? 0) * 100)}% from ${spotifyProfile.neighborhoodQuality.sampledArtists} sampled artists.`
                : 'Related-artist endpoint unavailable for this token; genre affinity overlay is still applied.'}
            </p>
            {spotifyProfile.artistAffinities && spotifyProfile.artistAffinities.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {spotifyProfile.artistAffinities.slice(0, 6).map((artist) => (
                  <li key={artist.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-text">
                      {artist.name}
                      {artist.genres.length > 0 ? ` · ${artist.genres.join(', ')}` : ''}
                    </span>
                    <span className="text-text-muted">{artist.trackRefs} refs</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  )
}

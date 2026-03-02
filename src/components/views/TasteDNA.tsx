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
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

interface TasteDNAProps {
  data: ProcessedDataModel
  onOpenSpotifySetup?: () => void
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

  async function loadSpotifyOverlay(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const activeToken = (await ensureValidAccessToken()) ?? ''
      if (!activeToken) {
        setError('Connect Spotify in Advanced setup first (optional).')
        return
      }
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
    <div className="space-y-4">
      <Card>
        <CardTitle>Taste DNA</CardTitle>
        <CardDescription className="mt-1">
          Behavioral profile by default. Add Spotify API overlay for audio feature depth.
        </CardDescription>
        <div className="mt-3 rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-sm text-text">
            {spotifySession
              ? 'Spotify overlay is connected and reusable across views.'
              : 'Spotify overlay is optional, but this is the canonical way to enrich Taste DNA.'}
          </p>
          {!spotifySession ? (
            <div className="mt-3 rounded-theme border border-accent/40 bg-accent/10 p-3">
              <p className="text-sm font-semibold text-text">Connect Spotify to unlock richer audio features</p>
              <p className="mt-1 text-xs text-text-muted">
                Adds audio traits, genre affinities, and neighborhood quality overlays to your Taste DNA.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {oauthConfigured ? (
                  <Button
                    onClick={() => void connectSpotify()}
                    disabled={spotifyAuthStatus === 'authorizing'}
                    className="w-full justify-center px-5 py-3 text-base sm:w-auto"
                  >
                    {spotifyAuthStatus === 'authorizing' ? 'Redirecting…' : 'Login with Spotify'}
                  </Button>
                ) : (
                  <div className="w-full rounded-theme border border-border bg-surface px-3 py-2 text-sm text-text-muted">
                    Spotify OAuth is not enabled in this build. Use Advanced setup for manual token fallback.
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={onOpenSpotifySetup}
                  className="w-full sm:w-auto"
                >
                  Open Advanced Setup
                </Button>
              </div>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {spotifySession ? (
              <Button variant="outline" onClick={onOpenSpotifySetup}>
                Manage Spotify Setup
              </Button>
            ) : null}
            <Button onClick={loadSpotifyOverlay} disabled={loading}>
              {loading ? 'Loading...' : 'Load Spotify Overlay'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Auth status: {spotifyAuthStatus}
          {spotifySession ? ` · source ${spotifySession.tokenSource}` : ''}
        </p>
        {error ? <p className="mt-2 text-sm text-negative">{error}</p> : null}
        {authError ? <p className="mt-2 text-sm text-negative">{authError}</p> : null}
        {spotifyProfile?.warnings && spotifyProfile.warnings.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs text-text-muted">
            {spotifyProfile.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
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
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {combinedDimensions.map((dimension) => (
            <div key={dimension.key} className="rounded-theme border border-border bg-surface-hover p-3">
              <p className="text-sm font-semibold text-text">{dimension.label}</p>
              <p className="text-xs text-text-muted">{Math.round(dimension.score * 100)} / 100</p>
            </div>
          ))}
        </div>
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

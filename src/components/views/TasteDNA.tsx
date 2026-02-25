import { useEffect, useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { fetchSpotifyAudioFeatureProfile, type SpotifyEnhancementResult } from '@/lib/spotify-api'
import type { ProcessedDataModel } from '@/lib/types'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

interface TasteDNAProps {
  data: ProcessedDataModel
}

export function TasteDNA({ data }: TasteDNAProps): JSX.Element {
  const { status: spotifyAuthStatus, session: spotifySession, authError, connectSpotify, disconnect, setManualToken, ensureValidAccessToken } =
    useSpotifyAuthStore(useShallow((state) => ({
      status: state.status,
      session: state.session,
      authError: state.error,
      connectSpotify: state.connectSpotify,
      disconnect: state.disconnect,
      setManualToken: state.setManualToken,
      ensureValidAccessToken: state.ensureValidAccessToken,
    })))
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enhanced, setEnhanced] = useState<Array<{ key: string; label: string; score: number }>>([])
  const [enhancedMeta, setEnhancedMeta] = useState<SpotifyEnhancementResult | null>(null)

  useEffect(() => {
    if (spotifySession?.tokenSource === 'manual-token') {
      setToken(spotifySession.accessToken)
    }
  }, [spotifySession])

  const combinedDimensions = useMemo(() => {
    if (enhanced.length === 0) {
      return data.taste.dimensions
    }
    return [...data.taste.dimensions.slice(0, 6), ...enhanced]
  }, [data.taste.dimensions, enhanced])

  async function enhance(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      let activeToken = token.trim()
      if (activeToken) {
        setManualToken(activeToken, { persist: false })
      } else {
        activeToken = (await ensureValidAccessToken()) ?? ''
      }
      if (!activeToken) {
        setError('Connect Spotify or enter a Spotify API token first.')
        return
      }
      const result = await fetchSpotifyAudioFeatureProfile(
        activeToken,
        data.tracks
          .map((track) => data.trackUriIndex[`${track.name}::${track.artist}`] ?? null)
          .filter((value): value is string => Boolean(value)),
      )
      setEnhanced(result.dimensions)
      setEnhancedMeta(result)
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
          Behavioral profile by default. Add Spotify API enhancement for audio feature depth.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-lg"
            placeholder="Spotify API token (optional manual fallback)"
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
          />
          <Button variant="outline" onClick={() => void connectSpotify()}>
            Connect Spotify (OAuth)
          </Button>
          <Button variant="outline" onClick={disconnect} disabled={!spotifySession}>
            Disconnect
          </Button>
          <Button onClick={enhance} disabled={loading}>
            {loading ? 'Loading...' : 'Enhance with Spotify API'}
          </Button>
        </div>
        {!token.trim() ? (
          <p className="mt-2 text-xs text-text-muted">
            Optional and local-first: OAuth sessions are tab-scoped, while manual tokens entered here are memory-only unless saved elsewhere.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-text-muted">
          Auth status: {spotifyAuthStatus}
          {spotifySession ? ` · source ${spotifySession.tokenSource}` : ''}
        </p>
        {error ? <p className="mt-2 text-sm text-negative">{error}</p> : null}
        {authError ? <p className="mt-2 text-sm text-negative">{authError}</p> : null}
        {enhancedMeta?.warnings && enhancedMeta.warnings.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs text-text-muted">
            {enhancedMeta.warnings.map((warning) => (
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

      {enhancedMeta?.genreAffinities && enhancedMeta.genreAffinities.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardTitle>Genre Affinity Overlay</CardTitle>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {enhancedMeta.genreAffinities.slice(0, 8).map((genre) => (
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
              {enhancedMeta.neighborhoodQuality?.endpointSupported
                ? `Related-artist overlap score ${Math.round((enhancedMeta.neighborhoodQuality.score ?? 0) * 100)}% from ${enhancedMeta.neighborhoodQuality.sampledArtists} sampled artists.`
                : 'Related-artist endpoint unavailable for this token; genre affinity overlay is still applied.'}
            </p>
            {enhancedMeta.artistAffinities && enhancedMeta.artistAffinities.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {enhancedMeta.artistAffinities.slice(0, 6).map((artist) => (
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

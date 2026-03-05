import { spotifyGetJson } from '@/lib/audio-traits/providers/spotify/http'
import type {
  SpotifyAudioFeatureRecord,
  SpotifyAudioFeaturesProxyErrorResponse,
  SpotifyAudioFeaturesProxyResponse,
  SpotifyAudioFeaturesRequestStats,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'
import {
  planSpotifyAudioFeaturesTrackIds,
  SPOTIFY_AUDIO_FEATURES_PROXY_ENDPOINT,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'
import { SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/http'

export { SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/http'
export type {
  SpotifyAudioFeatureRecord,
  SpotifyAudioFeaturesRequestStats,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'

interface SpotifyAudioFeaturesResponse {
  audio_features: Array<SpotifyAudioFeatureRecord | null>
}

export interface SpotifyAudioFeaturesFetchResult {
  features: SpotifyAudioFeatureRecord[]
  requestStats: SpotifyAudioFeaturesRequestStats
}

function parseRetryAfterSeconds(headers: Headers | { get(name: string): string | null }): number | undefined {
  const raw = headers.get('Retry-After')
  if (!raw) {
    return undefined
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function fetchSpotifyAudioFeaturesViaProxy(trackIds: string[]): Promise<SpotifyAudioFeaturesFetchResult> {
  const requestPlan = planSpotifyAudioFeaturesTrackIds(trackIds)
  const response = await fetch(SPOTIFY_AUDIO_FEATURES_PROXY_ENDPOINT.path, {
    method: SPOTIFY_AUDIO_FEATURES_PROXY_ENDPOINT.method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trackIds: requestPlan.trackIds }),
  })

  if (!response.ok) {
    let retryAfterSeconds = parseRetryAfterSeconds(response.headers)
    try {
      const payload = (await response.json()) as SpotifyAudioFeaturesProxyErrorResponse
      retryAfterSeconds = payload.error?.retryAfterSeconds ?? retryAfterSeconds
    } catch {
      // ignore JSON parsing errors for non-2xx proxy responses
    }
    throw new SpotifyApiHttpError({
      status: response.status,
      endpoint: 'audio-features-proxy',
      url: SPOTIFY_AUDIO_FEATURES_PROXY_ENDPOINT.path,
      retryAfterSeconds,
    })
  }

  const payload = (await response.json()) as SpotifyAudioFeaturesProxyResponse
  if (payload.status !== 200) {
    throw new SpotifyApiHttpError({
      status: payload.status,
      endpoint: 'audio-features-proxy',
      url: SPOTIFY_AUDIO_FEATURES_PROXY_ENDPOINT.path,
      retryAfterSeconds: payload.error.retryAfterSeconds,
    })
  }

  return {
    features: payload.data.features,
    requestStats: payload.data.requestStats,
  }
}

export async function fetchSpotifyAudioFeaturesByTrackIds(
  accessToken: string,
  trackIds: string[],
): Promise<SpotifyAudioFeaturesFetchResult> {
  const requestPlan = planSpotifyAudioFeaturesTrackIds(trackIds)
  const results: SpotifyAudioFeatureRecord[] = []
  for (const chunk of requestPlan.chunks) {
    const payload = await spotifyGetJson<SpotifyAudioFeaturesResponse>({
      accessToken,
      url: `https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`,
      endpoint: 'audio-features',
    })
    results.push(...payload.audio_features.filter(Boolean) as SpotifyAudioFeatureRecord[])
  }
  return {
    features: results,
    requestStats: requestPlan.requestStats,
  }
}

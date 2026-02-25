export interface SpotifyAudioFeatureRecord {
  id: string
  danceability: number
  energy: number
  valence: number
  acousticness: number
  instrumentalness: number
  speechiness: number
  tempo: number
  liveness: number
}

interface SpotifyAudioFeaturesResponse {
  audio_features: Array<SpotifyAudioFeatureRecord | null>
}

export interface SpotifyAudioFeaturesRequestStats {
  requestedUniqueTrackIds: number
  cappedUniqueTrackIds: number
  truncatedTrackIds: number
  requestChunkCount: number
}

export interface SpotifyAudioFeaturesFetchResult {
  features: SpotifyAudioFeatureRecord[]
  requestStats: SpotifyAudioFeaturesRequestStats
}

export class SpotifyApiHttpError extends Error {
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(status: number, retryAfterSeconds?: number) {
    super(`Spotify API request failed with ${status}`)
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const MAX_SPOTIFY_AUDIO_FEATURE_TRACK_IDS = 5_000

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

async function spotifyGetJson<T>(accessToken: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    const retryHeader = response.headers.get('Retry-After')
    const retryAfterSeconds = retryHeader ? Number.parseInt(retryHeader, 10) : undefined
    throw new SpotifyApiHttpError(response.status, Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined)
  }
  return (await response.json()) as T
}

export async function fetchSpotifyAudioFeaturesByTrackIds(
  accessToken: string,
  trackIds: string[],
): Promise<SpotifyAudioFeaturesFetchResult> {
  const uniqueIds = [...new Set(trackIds.filter(Boolean))]
  const ids = uniqueIds.slice(0, MAX_SPOTIFY_AUDIO_FEATURE_TRACK_IDS)
  const results: SpotifyAudioFeatureRecord[] = []
  const chunks = chunkArray(ids, 100)
  for (const chunk of chunks) {
    const payload = await spotifyGetJson<SpotifyAudioFeaturesResponse>(
      accessToken,
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`,
    )
    results.push(...payload.audio_features.filter(Boolean) as SpotifyAudioFeatureRecord[])
  }
  return {
    features: results,
    requestStats: {
      requestedUniqueTrackIds: uniqueIds.length,
      cappedUniqueTrackIds: ids.length,
      truncatedTrackIds: Math.max(0, uniqueIds.length - ids.length),
      requestChunkCount: chunks.length,
    },
  }
}

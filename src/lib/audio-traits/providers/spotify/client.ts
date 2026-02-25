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

export class SpotifyApiHttpError extends Error {
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(status: number, retryAfterSeconds?: number) {
    super(`Spotify API request failed with ${status}`)
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

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
): Promise<SpotifyAudioFeatureRecord[]> {
  const ids = [...new Set(trackIds.filter(Boolean))].slice(0, 5000)
  const results: SpotifyAudioFeatureRecord[] = []
  for (const chunk of chunkArray(ids, 100)) {
    const payload = await spotifyGetJson<SpotifyAudioFeaturesResponse>(
      accessToken,
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`,
    )
    results.push(...payload.audio_features.filter(Boolean) as SpotifyAudioFeatureRecord[])
  }
  return results
}

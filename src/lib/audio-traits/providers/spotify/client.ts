import { spotifyGetJson } from '@/lib/audio-traits/providers/spotify/http'

export { SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/http'

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

export const MAX_SPOTIFY_AUDIO_FEATURE_TRACK_IDS = 5_000

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
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
    const payload = await spotifyGetJson<SpotifyAudioFeaturesResponse>({
      accessToken,
      url: `https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`,
      endpoint: 'audio-features',
    })
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

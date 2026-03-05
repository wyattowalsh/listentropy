export const SPOTIFY_AUDIO_FEATURES_PROXY_ENDPOINT = {
  method: 'POST',
  path: '/api/spotify/enrichment/audio-features',
} as const

export const SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS = 5_000
export const SPOTIFY_AUDIO_FEATURES_PROXY_TRACK_ID_CHUNK_SIZE = 100

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

export interface SpotifyAudioFeaturesRequestStats {
  requestedUniqueTrackIds: number
  cappedUniqueTrackIds: number
  truncatedTrackIds: number
  requestChunkCount: number
}

export interface SpotifyAudioFeaturesProxyRequest {
  trackIds: string[]
}

export interface SpotifyAudioFeaturesProxySuccessResponse {
  status: 200
  data: {
    features: SpotifyAudioFeatureRecord[]
    requestStats: SpotifyAudioFeaturesRequestStats
  }
}

export type SpotifyAudioFeaturesProxyErrorCode =
  | 'bad-request'
  | 'unauthorized'
  | 'restricted'
  | 'rate-limited'
  | 'unavailable'

export type SpotifyAudioFeaturesProxyErrorStatus = 400 | 401 | 403 | 429 | 503

export interface SpotifyAudioFeaturesProxyErrorResponse {
  status: SpotifyAudioFeaturesProxyErrorStatus
  error: {
    code: SpotifyAudioFeaturesProxyErrorCode
    message: string
    retryAfterSeconds?: number
  }
}

export type SpotifyAudioFeaturesProxyResponse =
  | SpotifyAudioFeaturesProxySuccessResponse
  | SpotifyAudioFeaturesProxyErrorResponse

export function isSpotifyAudioFeaturesProxyUnsupportedError(code: SpotifyAudioFeaturesProxyErrorCode): boolean {
  return code === 'unauthorized' || code === 'restricted'
}

export interface SpotifyAudioFeaturesTrackIdPlan {
  trackIds: string[]
  chunks: string[][]
  requestStats: SpotifyAudioFeaturesRequestStats
}

function chunkTrackIds(trackIds: string[], size: number): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < trackIds.length; index += size) {
    chunks.push(trackIds.slice(index, index + size))
  }
  return chunks
}

export function planSpotifyAudioFeaturesTrackIds(trackIds: string[]): SpotifyAudioFeaturesTrackIdPlan {
  const uniqueTrackIds = [...new Set(trackIds.map((trackId) => trackId.trim()).filter(Boolean))]
  const cappedTrackIds = uniqueTrackIds.slice(0, SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS)
  const chunks = chunkTrackIds(cappedTrackIds, SPOTIFY_AUDIO_FEATURES_PROXY_TRACK_ID_CHUNK_SIZE)
  return {
    trackIds: cappedTrackIds,
    chunks,
    requestStats: {
      requestedUniqueTrackIds: uniqueTrackIds.length,
      cappedUniqueTrackIds: cappedTrackIds.length,
      truncatedTrackIds: Math.max(0, uniqueTrackIds.length - cappedTrackIds.length),
      requestChunkCount: chunks.length,
    },
  }
}

export function mapSpotifyUpstreamStatusToAudioFeaturesProxyError(
  status: number,
  retryAfterSeconds?: number,
): SpotifyAudioFeaturesProxyErrorResponse {
  if (status === 400) {
    return {
      status: 400,
      error: {
        code: 'bad-request',
        message: 'Spotify audio trait request payload is invalid (400).',
      },
    }
  }
  if (status === 401) {
    return {
      status: 401,
      error: {
        code: 'unauthorized',
        message: 'Spotify token was rejected (401). Reconnect or refresh the token.',
      },
    }
  }
  if (status === 403) {
    return {
      status: 403,
      error: {
        code: 'restricted',
        message: 'Spotify audio-features endpoint is restricted for this app/token (403).',
      },
    }
  }
  if (status === 404) {
    return {
      status: 403,
      error: {
        code: 'restricted',
        message: 'Spotify audio-features endpoint is unavailable or restricted (404).',
      },
    }
  }
  if (status === 429) {
    return {
      status: 429,
      error: {
        code: 'rate-limited',
        message: 'Spotify rate limit hit while fetching audio traits (429).',
        retryAfterSeconds,
      },
    }
  }
  return {
    status: 503,
    error: {
      code: 'unavailable',
      message: 'Spotify audio trait service is unavailable right now (503).',
    },
  }
}

import { fetchSpotifyAudioFeaturesByTrackIds, SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/client'
import {
  mapSpotifyUpstreamStatusToAudioFeaturesProxyError,
  type SpotifyAudioFeaturesProxyErrorResponse,
  type SpotifyAudioFeaturesProxyRequest,
  type SpotifyAudioFeaturesProxyResponse,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'

const SPOTIFY_CLIENT_CREDENTIALS_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const DEFAULT_SPOTIFY_APP_TOKEN_EXPIRY_SECONDS = 3_600
export const SPOTIFY_APP_TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS = 30

interface SpotifyAppTokenCacheEntry {
  accessToken: string
  expiresAtEpochMs: number
}

interface SpotifyClientCredentialsTokenResponse {
  access_token?: string
  expires_in?: number
}

export interface SpotifyAudioFeaturesProxyExecutionResult {
  response: SpotifyAudioFeaturesProxyResponse
  retryAfterSeconds?: number
}

let spotifyAppTokenCache: SpotifyAppTokenCacheEntry | null = null

class SpotifyClientCredentialsConfigError extends Error {
  constructor() {
    super('Spotify client credentials are not configured on the server.')
    this.name = 'SpotifyClientCredentialsConfigError'
  }
}

class SpotifyClientCredentialsHttpError extends Error {
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(status: number, retryAfterSeconds?: number) {
    super(`Spotify client credentials token request failed with ${status}`)
    this.name = 'SpotifyClientCredentialsHttpError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function parseRetryAfterSeconds(headers: Headers | { get(name: string): string | null }): number | undefined {
  const raw = headers.get('Retry-After')
  if (!raw) {
    return undefined
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function createBadRequestError(message: string): SpotifyAudioFeaturesProxyErrorResponse {
  return {
    status: 400,
    error: {
      code: 'bad-request',
      message,
    },
  }
}

function createUnavailableError(message: string): SpotifyAudioFeaturesProxyErrorResponse {
  return {
    status: 503,
    error: {
      code: 'unavailable',
      message,
    },
  }
}

function mapUpstreamError(status: number, retryAfterSeconds?: number): SpotifyAudioFeaturesProxyExecutionResult {
  const response = mapSpotifyUpstreamStatusToAudioFeaturesProxyError(status, retryAfterSeconds)
  return {
    response,
    retryAfterSeconds: response.error.retryAfterSeconds,
  }
}

function getSpotifyClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() ?? ''
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? ''
  if (!clientId || !clientSecret) {
    throw new SpotifyClientCredentialsConfigError()
  }
  return { clientId, clientSecret }
}

function isSpotifyAppTokenCacheUsable(cache: SpotifyAppTokenCacheEntry, nowEpochMs: number): boolean {
  return cache.expiresAtEpochMs > nowEpochMs + SPOTIFY_APP_TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS * 1_000
}

function normalizeSpotifyTokenExpirySeconds(expiresIn: unknown): number {
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) {
    return DEFAULT_SPOTIFY_APP_TOKEN_EXPIRY_SECONDS
  }
  const floored = Math.floor(expiresIn)
  return Math.max(floored, SPOTIFY_APP_TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS + 1)
}

async function fetchSpotifyClientCredentialsToken(nowEpochMs: number): Promise<string> {
  const { clientId, clientSecret } = getSpotifyClientCredentials()
  const response = await fetch(SPOTIFY_CLIENT_CREDENTIALS_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  })
  if (!response.ok) {
    throw new SpotifyClientCredentialsHttpError(response.status, parseRetryAfterSeconds(response.headers))
  }
  const payload = (await response.json()) as SpotifyClientCredentialsTokenResponse
  const accessToken = payload.access_token?.trim()
  if (!accessToken) {
    throw new Error('Spotify client credentials response did not include an access token.')
  }
  const expiresInSeconds = normalizeSpotifyTokenExpirySeconds(payload.expires_in)
  spotifyAppTokenCache = {
    accessToken,
    expiresAtEpochMs: nowEpochMs + expiresInSeconds * 1_000,
  }
  return accessToken
}

export function resetSpotifyAppTokenCacheForTests(): void {
  spotifyAppTokenCache = null
}

export async function getSpotifyAppAccessToken(): Promise<string> {
  const nowEpochMs = Date.now()
  if (spotifyAppTokenCache && isSpotifyAppTokenCacheUsable(spotifyAppTokenCache, nowEpochMs)) {
    return spotifyAppTokenCache.accessToken
  }
  return fetchSpotifyClientCredentialsToken(nowEpochMs)
}

export function validateSpotifyAudioFeaturesProxyRequest(body: unknown): SpotifyAudioFeaturesProxyRequest | SpotifyAudioFeaturesProxyErrorResponse {
  if (typeof body !== 'object' || !body) {
    return createBadRequestError('Spotify audio trait proxy expects a JSON object body.')
  }
  const candidate = body as { trackIds?: unknown }
  if (!Array.isArray(candidate.trackIds) || candidate.trackIds.some((trackId) => typeof trackId !== 'string')) {
    return createBadRequestError('Spotify audio trait proxy expects trackIds as a string array.')
  }
  return { trackIds: candidate.trackIds }
}

export async function executeSpotifyAudioFeaturesProxyRequest(
  request: SpotifyAudioFeaturesProxyRequest,
): Promise<SpotifyAudioFeaturesProxyExecutionResult> {
  try {
    const accessToken = await getSpotifyAppAccessToken()
    const { features, requestStats } = await fetchSpotifyAudioFeaturesByTrackIds(accessToken, request.trackIds)
    return {
      response: {
        status: 200,
        data: {
          features,
          requestStats,
        },
      },
    }
  } catch (error) {
    if (error instanceof SpotifyClientCredentialsConfigError) {
      return {
        response: createUnavailableError(error.message),
      }
    }
    if (error instanceof SpotifyClientCredentialsHttpError) {
      return mapUpstreamError(error.status, error.retryAfterSeconds)
    }
    if (error instanceof SpotifyApiHttpError) {
      return mapUpstreamError(error.status, error.retryAfterSeconds)
    }
    return {
      response: createUnavailableError('Spotify audio trait proxy is unavailable right now (503).'),
    }
  }
}

import {
  mapSpotifyUpstreamStatusToAudioFeaturesProxyError,
  type SpotifyAudioFeaturesProxyErrorResponse,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'
import {
  executeSpotifyAudioFeaturesProxyRequest,
  validateSpotifyAudioFeaturesProxyRequest,
} from '@/lib/audio-traits/providers/spotify/proxy-server'

interface ApiRouteRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

interface ApiRouteResponse {
  status: (code: number) => ApiRouteResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => ApiRouteResponse
}

const SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_WINDOW_MS = 60_000
const DEFAULT_SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE = 60

interface SpotifyEnrichmentProxyRateLimitEntry {
  windowStartedAtMs: number
  requestCount: number
}

const spotifyEnrichmentProxyRateLimitByClient = new Map<string, SpotifyEnrichmentProxyRateLimitEntry>()

function createBadRequestError(message: string): SpotifyAudioFeaturesProxyErrorResponse {
  return {
    status: 400,
    error: {
      code: 'bad-request',
      message,
    },
  }
}

function parseJsonBodyIfNeeded(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body
  }
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

function getSpotifyEnrichmentProxyRateLimitPerMinute(): number {
  const parsed = Number.parseInt(process.env.SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE
}

function normalizeHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

function resolveClientIdentifier(req: ApiRouteRequest): string {
  const forwardedFor = normalizeHeaderValue(req.headers?.['x-forwarded-for'])
  if (forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() ?? 'anonymous'
  }
  const cfConnectingIp = normalizeHeaderValue(req.headers?.['cf-connecting-ip']).trim()
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  const xRealIp = normalizeHeaderValue(req.headers?.['x-real-ip']).trim()
  if (xRealIp) {
    return xRealIp
  }
  return 'anonymous'
}

function consumeSpotifyEnrichmentProxyRateLimit(
  req: ApiRouteRequest,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const nowMs = Date.now()
  const limitPerMinute = getSpotifyEnrichmentProxyRateLimitPerMinute()
  const clientIdentifier = resolveClientIdentifier(req)
  const existingEntry = spotifyEnrichmentProxyRateLimitByClient.get(clientIdentifier)
  if (!existingEntry || nowMs - existingEntry.windowStartedAtMs >= SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_WINDOW_MS) {
    spotifyEnrichmentProxyRateLimitByClient.set(clientIdentifier, {
      windowStartedAtMs: nowMs,
      requestCount: 1,
    })
    return { allowed: true }
  }
  if (existingEntry.requestCount >= limitPerMinute) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existingEntry.windowStartedAtMs + SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_WINDOW_MS - nowMs) / 1_000),
    )
    return { allowed: false, retryAfterSeconds }
  }
  existingEntry.requestCount += 1
  spotifyEnrichmentProxyRateLimitByClient.set(clientIdentifier, existingEntry)
  return { allowed: true }
}

export function resetSpotifyEnrichmentProxyRateLimitForTests(): void {
  spotifyEnrichmentProxyRateLimitByClient.clear()
}

export default async function handler(req: ApiRouteRequest, res: ApiRouteResponse): Promise<void> {
  if (req.method !== 'POST') {
    const badMethod = createBadRequestError('Spotify audio trait proxy expects POST requests.')
    res.status(badMethod.status).json(badMethod)
    return
  }

  const rateLimitResult = consumeSpotifyEnrichmentProxyRateLimit(req)
  if (!rateLimitResult.allowed) {
    const rateLimited = mapSpotifyUpstreamStatusToAudioFeaturesProxyError(429, rateLimitResult.retryAfterSeconds)
    res.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds))
    res.status(rateLimited.status).json(rateLimited)
    return
  }

  const parsedBody = parseJsonBodyIfNeeded(req.body)
  const validated = validateSpotifyAudioFeaturesProxyRequest(parsedBody)
  if ('error' in validated) {
    res.status(validated.status).json(validated)
    return
  }

  const result = await executeSpotifyAudioFeaturesProxyRequest(validated)
  if (result.retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds))
  }
  res.status(result.response.status).json(result.response)
}

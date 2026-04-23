import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

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
const SPOTIFY_ENRICHMENT_PROXY_IP_HEADER_CANDIDATES = [
  'x-vercel-forwarded-for',
  'cf-connecting-ip',
  'x-forwarded-for',
] as const

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

function getHeaderValue(req: ApiRouteRequest, name: string): string {
  const headers = req.headers
  if (!headers) {
    return ''
  }
  const direct = normalizeHeaderValue(headers[name]).trim()
  if (direct) {
    return direct
  }
  const targetName = name.toLowerCase()
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() === targetName) {
      return normalizeHeaderValue(headerValue).trim()
    }
  }
  return ''
}

function normalizeIpCandidate(candidate: string): string | null {
  const trimmed = candidate.trim()
  if (!trimmed) {
    return null
  }
  const bracketedMatch = trimmed.match(/^\[(.+)\](?::\d+)?$/)
  const unwrapped = bracketedMatch?.[1] ?? trimmed
  const ipv4WithPortMatch = unwrapped.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)
  const maybeIp = ipv4WithPortMatch?.[1] ?? unwrapped
  if (isIP(maybeIp)) {
    return maybeIp
  }
  return null
}

function resolveTrustedClientIp(req: ApiRouteRequest): string | null {
  for (const headerName of SPOTIFY_ENRICHMENT_PROXY_IP_HEADER_CANDIDATES) {
    const rawValue = getHeaderValue(req, headerName)
    if (!rawValue) {
      continue
    }
    const candidateValues = rawValue.split(',')
    for (const candidate of candidateValues) {
      const normalizedIp = normalizeIpCandidate(candidate)
      if (normalizedIp) {
        return normalizedIp
      }
    }
  }
  return null
}

function createAnonymousClientIdentifier(req: ApiRouteRequest): string {
  const fingerprint = createHash('sha256')
    .update(getHeaderValue(req, 'user-agent'))
    .update('|')
    .update(getHeaderValue(req, 'accept-language'))
    .update('|')
    .update(getHeaderValue(req, 'origin'))
    .digest('hex')
    .slice(0, 24)
  return `anon:${fingerprint}`
}

function resolveClientIdentifier(req: ApiRouteRequest): string {
  const clientIp = resolveTrustedClientIp(req)
  if (clientIp) {
    return `ip:${clientIp}`
  }
  return createAnonymousClientIdentifier(req)
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

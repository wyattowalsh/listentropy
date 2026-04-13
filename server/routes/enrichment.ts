import type { Request, Response } from 'express'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_AUDIO_FEATURES_URL = 'https://api.spotify.com/v1/audio-features'

const RATE_LIMIT_WINDOW_MS = 60_000
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60

interface RateLimitEntry {
  windowStartedAtMs: number
  requestCount: number
}

const rateLimitByClient = new Map<string, RateLimitEntry>()

let appTokenCache: { accessToken: string; expiresAtMs: number } | null = null

function getRateLimitPerMinute(): number {
  const parsed = parseInt(process.env.SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT_PER_MINUTE
}

function getClientId(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? 'anonymous'
  }
  return req.ip ?? 'anonymous'
}

function checkRateLimit(req: Request): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now()
  const limit = getRateLimitPerMinute()
  const clientId = getClientId(req)
  const entry = rateLimitByClient.get(clientId)

  if (!entry || now - entry.windowStartedAtMs >= RATE_LIMIT_WINDOW_MS) {
    rateLimitByClient.set(clientId, { windowStartedAtMs: now, requestCount: 1 })
    return { allowed: true }
  }

  if (entry.requestCount >= limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.windowStartedAtMs + RATE_LIMIT_WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfter }
  }

  entry.requestCount += 1
  return { allowed: true }
}

async function getAppToken(): Promise<string> {
  if (appTokenCache && appTokenCache.expiresAtMs > Date.now() + 30_000) {
    return appTokenCache.accessToken
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Spotify client credentials not configured')
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  appTokenCache = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

export default async function enrichmentHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(400).json({ status: 400, error: { code: 'bad-request', message: 'POST only' } })
    return
  }

  const rateCheck = checkRateLimit(req)
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfter))
    res.status(429).json({ status: 429, error: { code: 'rate-limited', message: 'Too many requests' } })
    return
  }

  const body = req.body as { trackIds?: string[]; accessToken?: string }
  if (!body?.trackIds || !Array.isArray(body.trackIds) || body.trackIds.length === 0) {
    res.status(400).json({ status: 400, error: { code: 'bad-request', message: 'trackIds array is required' } })
    return
  }

  if (body.trackIds.length > 100) {
    res.status(400).json({ status: 400, error: { code: 'bad-request', message: 'Maximum 100 track IDs per request' } })
    return
  }

  try {
    const accessToken = body.accessToken || (await getAppToken())
    const ids = body.trackIds.join(',')

    const spotifyRes = await fetch(`${SPOTIFY_AUDIO_FEATURES_URL}?ids=${ids}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!spotifyRes.ok) {
      const retryAfter = spotifyRes.headers.get('Retry-After')
      if (retryAfter) {
        res.setHeader('Retry-After', retryAfter)
      }
      res.status(spotifyRes.status).json({
        status: spotifyRes.status,
        error: { code: 'upstream-error', message: `Spotify API returned ${spotifyRes.status}` },
      })
      return
    }

    const data = await spotifyRes.json()
    res.json({ status: 200, data })
  } catch (err) {
    console.error('[enrichment] Error:', err)
    res.status(500).json({ status: 500, error: { code: 'server-error', message: 'Internal server error' } })
  }
}

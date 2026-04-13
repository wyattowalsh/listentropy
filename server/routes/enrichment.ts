import type { Request, Response } from 'express'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_AUDIO_FEATURES_URL = 'https://api.spotify.com/v1/audio-features'

let appTokenCache: { accessToken: string; expiresAtMs: number } | null = null

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

import { Router, type Response } from 'express'
import crypto from 'node:crypto'
import { query } from '../db.js'
import { encrypt, decrypt, hashToken, generateSessionToken, generateCsrfToken } from '../crypto.js'
import { requireAuth, requireCsrf, type AuthenticatedRequest } from '../middleware.js'

const router = Router()

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_PROFILE_URL = 'https://api.spotify.com/v1/me'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

const IDENTITY_SCOPES = ['user-read-private', 'user-read-email']

function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/spotify/callback`
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required')
  }
  return { clientId, clientSecret, redirectUri }
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url')
}

async function createPkceChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest()
  return base64UrlEncode(hash)
}

router.get('/spotify/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, redirectUri } = getSpotifyConfig()
    const state = crypto.randomBytes(32).toString('hex')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = await createPkceChallenge(codeVerifier)

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    })
    res.cookie('oauth_verifier', codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: IDENTITY_SCOPES.join(' '),
    })

    res.redirect(`${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`)
  } catch (err) {
    console.error('[auth] Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/spotify/callback', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>
    const savedState = req.cookies?.oauth_state
    const codeVerifier = req.cookies?.oauth_verifier

    res.clearCookie('oauth_state', { path: '/' })
    res.clearCookie('oauth_verifier', { path: '/' })

    if (oauthError) {
      res.redirect(`/?auth_error=${encodeURIComponent(oauthError)}`)
      return
    }

    if (!code || !state || !savedState || state !== savedState) {
      res.redirect('/?auth_error=state_mismatch')
      return
    }

    if (!codeVerifier) {
      res.redirect('/?auth_error=missing_verifier')
      return
    }

    const { clientId, clientSecret, redirectUri } = getSpotifyConfig()

    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text()
      console.error('[auth] Token exchange failed:', errBody)
      res.redirect('/?auth_error=token_exchange_failed')
      return
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      scope: string
    }

    const profileResponse = await fetch(SPOTIFY_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileResponse.ok) {
      res.redirect('/?auth_error=profile_fetch_failed')
      return
    }

    const profile = (await profileResponse.json()) as {
      id: string
      display_name?: string
      email?: string
      images?: Array<{ url: string }>
    }

    const avatarUrl = profile.images?.[0]?.url ?? null

    let userResult = await query(
      'SELECT id FROM users WHERE spotify_id = $1',
      [profile.id],
    )

    let userId: string
    if (userResult.rows.length === 0) {
      userResult = await query(
        `INSERT INTO users (spotify_id, display_name, email, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [profile.id, profile.display_name ?? null, profile.email ?? null, avatarUrl],
      )
      userId = userResult.rows[0].id
    } else {
      userId = userResult.rows[0].id
      await query(
        `UPDATE users SET display_name = $1, email = $2, avatar_url = $3, updated_at = now()
         WHERE id = $4`,
        [profile.display_name ?? null, profile.email ?? null, avatarUrl, userId],
      )
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    const existingConn = await query(
      'SELECT id FROM spotify_connections WHERE user_id = $1 AND spotify_id = $2',
      [userId, profile.id],
    )

    if (existingConn.rows.length > 0) {
      await query(
        `UPDATE spotify_connections
         SET access_token_encrypted = $1,
             refresh_token_encrypted = $2,
             token_expires_at = $3,
             scopes = $4,
             last_refreshed_at = now(),
             revoked_at = NULL,
             status = 'active'
         WHERE user_id = $5 AND spotify_id = $6`,
        [
          encrypt(tokens.access_token),
          encrypt(tokens.refresh_token),
          tokenExpiresAt.toISOString(),
          tokens.scope?.split(' ') ?? [],
          userId,
          profile.id,
        ],
      )
    } else {
      await query(
        `INSERT INTO spotify_connections
         (user_id, spotify_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          profile.id,
          encrypt(tokens.access_token),
          encrypt(tokens.refresh_token),
          tokenExpiresAt.toISOString(),
          tokens.scope?.split(' ') ?? [],
        ],
      )
    }

    const sessionToken = generateSessionToken()
    const csrfToken = generateCsrfToken()
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    await query(
      `INSERT INTO sessions (user_id, token_hash, csrf_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        hashToken(sessionToken),
        csrfToken,
        sessionExpiresAt.toISOString(),
        req.ip ?? null,
        req.headers['user-agent'] ?? null,
      ],
    )

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    })

    res.redirect('/?auth_success=true')
  } catch (err) {
    console.error('[auth] Callback error:', err)
    res.redirect('/?auth_error=server_error')
  }
})

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userResult = await query(
      `SELECT u.id, u.spotify_id, u.display_name, u.email, u.avatar_url, u.created_at,
              sc.status as connection_status, sc.scopes, sc.token_expires_at
       FROM users u
       LEFT JOIN spotify_connections sc ON sc.user_id = u.id AND sc.status = 'active'
       WHERE u.id = $1`,
      [req.userId],
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = userResult.rows[0]
    res.json({
      user: {
        id: user.id,
        spotifyId: user.spotify_id,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        spotifyConnected: user.connection_status === 'active',
        scopes: user.scopes ?? [],
      },
      csrfToken: req.csrfToken,
    })
  } catch (err) {
    console.error('[auth] /me error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await query('DELETE FROM sessions WHERE id = $1', [req.sessionId])
    res.clearCookie('session_token', { path: '/' })
    res.json({ success: true })
  } catch (err) {
    console.error('[auth] Logout error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/refresh', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const connResult = await query(
      `SELECT id, spotify_id, refresh_token_encrypted, token_expires_at
       FROM spotify_connections
       WHERE user_id = $1 AND status = 'active'
       ORDER BY connected_at DESC LIMIT 1`,
      [req.userId],
    )

    if (connResult.rows.length === 0) {
      res.status(404).json({ error: 'No active Spotify connection' })
      return
    }

    const conn = connResult.rows[0]
    const tokenExpiresAt = new Date(conn.token_expires_at)
    const needsRefresh = tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

    if (!needsRefresh) {
      res.json({ refreshed: false, expiresAt: conn.token_expires_at })
      return
    }

    const refreshToken = decrypt(conn.refresh_token_encrypted)
    const { clientId, clientSecret } = getSpotifyConfig()

    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('[auth] Token refresh failed:', errText)
      await query(
        `UPDATE spotify_connections SET status = 'expired', revoked_at = now() WHERE id = $1`,
        [conn.id],
      )
      res.status(401).json({ error: 'Token refresh failed — Spotify access may have been revoked' })
      return
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await query(
      `UPDATE spotify_connections
       SET access_token_encrypted = $1,
           refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
           token_expires_at = $3,
           last_refreshed_at = now()
       WHERE id = $4`,
      [
        encrypt(tokens.access_token),
        tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        newExpiresAt.toISOString(),
        conn.id,
      ],
    )

    res.json({ refreshed: true, expiresAt: newExpiresAt.toISOString() })
  } catch (err) {
    console.error('[auth] Refresh error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/spotify/disconnect', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await query(
      `UPDATE spotify_connections
       SET status = 'revoked', revoked_at = now()
       WHERE user_id = $1 AND status = 'active'`,
      [req.userId],
    )
    res.json({ success: true })
  } catch (err) {
    console.error('[auth] Disconnect error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/account', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.userId])
    res.clearCookie('session_token', { path: '/' })
    res.json({ success: true })
  } catch (err) {
    console.error('[auth] Account deletion error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

import type { Request, Response, NextFunction } from 'express'
import { query } from './db.js'
import { hashToken } from './crypto.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  sessionId?: string
  csrfToken?: string
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionToken = req.cookies?.session_token
  if (!sessionToken) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const tokenHash = hashToken(sessionToken)
  const result = await query(
    `SELECT s.id, s.user_id, s.csrf_token, s.expires_at
     FROM sessions s
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  )

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Session expired or invalid' })
    return
  }

  const session = result.rows[0]
  req.userId = session.user_id
  req.sessionId = session.id
  req.csrfToken = session.csrf_token

  await query(
    'UPDATE sessions SET last_active_at = now() WHERE id = $1',
    [session.id],
  )

  next()
}

export function requireCsrf(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const csrfHeader = req.headers['x-csrf-token'] as string | undefined
  if (!csrfHeader || csrfHeader !== req.csrfToken) {
    res.status(403).json({ error: 'Invalid CSRF token' })
    return
  }
  next()
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const sessionToken = req.cookies?.session_token
  if (!sessionToken) {
    next()
    return
  }

  const tokenHash = hashToken(sessionToken)
  query(
    `SELECT s.id, s.user_id, s.csrf_token, s.expires_at
     FROM sessions s
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  )
    .then((result) => {
      if (result.rows.length > 0) {
        const session = result.rows[0]
        req.userId = session.user_id
        req.sessionId = session.id
        req.csrfToken = session.csrf_token
      }
      next()
    })
    .catch(() => {
      next()
    })
}

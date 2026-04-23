import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import crypto from 'node:crypto'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
})

async function dbQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

let testDatasetId: string

async function createTestUser(): Promise<{ userId: string; sessionToken: string; csrfToken: string }> {
  const spotifyId = `test_${crypto.randomBytes(8).toString('hex')}`
  const userResult = await dbQuery<{ id: string }>(
    `INSERT INTO users (spotify_id, display_name) VALUES ($1, $2) RETURNING id`,
    [spotifyId, 'Test User'],
  )
  const userId = userResult.rows[0].id

  const sessionToken = crypto.randomBytes(32).toString('hex')
  const csrfToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await dbQuery(
    `INSERT INTO sessions (user_id, token_hash, csrf_token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(sessionToken), csrfToken, expiresAt.toISOString()],
  )

  return { userId, sessionToken, csrfToken }
}

async function createTestUserWithConsent(): Promise<{ userId: string; sessionToken: string; csrfToken: string }> {
  const result = await createTestUser()
  await dbQuery(
    `INSERT INTO consent_events (user_id, consent_type, granted) VALUES ($1, 'persist_history', true)`,
    [result.userId],
  )
  await dbQuery(
    `INSERT INTO consent_events (user_id, consent_type, granted) VALUES ($1, 'aggregate_analytics', true)`,
    [result.userId],
  )
  return result
}

async function cleanupTestUser(userId: string): Promise<void> {
  await dbQuery('DELETE FROM users WHERE id = $1', [userId])
}

let app: Express

beforeAll(async () => {
  const { runMigrations } = await import('./db.js')
  await runMigrations()

  const { default: authRoutes } = await import('./routes/auth.js')
  const { default: datasetRoutes } = await import('./routes/datasets.js')
  const { default: aggregateRoutes } = await import('./routes/aggregates.js')
  const { default: enrichmentHandler } = await import('./routes/enrichment.js')

  app = express()
  app.set('trust proxy', 1)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.use('/api/auth', authRoutes)
  app.use('/api/datasets', datasetRoutes)
  app.use('/api/aggregates', aggregateRoutes)
  app.post('/api/spotify/enrichment/audio-features', enrichmentHandler)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
})

afterAll(async () => {
  await pool.end()
})

describe('Health & Security Headers', () => {
  it('returns health status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('includes security headers from helmet', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
    expect(res.headers['x-download-options']).toBe('noopen')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
  })
})

describe('Authentication', () => {
  let userId: string
  let sessionToken: string
  let csrfToken: string

  beforeEach(async () => {
    const result = await createTestUser()
    userId = result.userId
    sessionToken = result.sessionToken
    csrfToken = result.csrfToken
  })

  afterAll(async () => {
    try {
      await cleanupTestUser(userId)
    } catch {
      /* Best-effort test cleanup. */
    }
  })

  it('rejects unauthenticated requests to /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Unauthorized')
  })

  it('accepts authenticated requests to /api/auth/me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `session_token=${sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.id).toBe(userId)
    expect(res.body.csrfToken).toBe(csrfToken)
  })

  it('rejects expired sessions', async () => {
    const expiredToken = crypto.randomBytes(32).toString('hex')
    await dbQuery(
      `INSERT INTO sessions (user_id, token_hash, csrf_token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, hashToken(expiredToken), 'csrf', new Date(Date.now() - 1000).toISOString()],
    )

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `session_token=${expiredToken}`)
    expect(res.status).toBe(401)
  })

  it('rejects logout without CSRF', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `session_token=${sessionToken}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Invalid CSRF token')
  })

  it('allows logout with valid CSRF', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `session_token=${sessionToken}`)
      .set('X-CSRF-Token', csrfToken)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('Authorization - Dataset Isolation', () => {
  let user1: { userId: string; sessionToken: string; csrfToken: string }
  let user2: { userId: string; sessionToken: string; csrfToken: string }

  beforeAll(async () => {
    user1 = await createTestUserWithConsent()
    user2 = await createTestUserWithConsent()

    const ds1 = await dbQuery<{ id: string }>(
      `INSERT INTO datasets (user_id, name, source, status, record_count)
       VALUES ($1, 'User1 Dataset', 'spotify_export', 'ready', 10) RETURNING id`,
      [user1.userId],
    )
    testDatasetId = ds1.rows[0].id

    await dbQuery(
      `INSERT INTO datasets (user_id, name, source, status, record_count)
       VALUES ($1, 'User2 Dataset', 'spotify_export', 'ready', 5)`,
      [user2.userId],
    )
  })

  afterAll(async () => {
    await cleanupTestUser(user1.userId)
    await cleanupTestUser(user2.userId)
  })

  it('user1 only sees their own datasets', async () => {
    const res = await request(app)
      .get('/api/datasets')
      .set('Cookie', `session_token=${user1.sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.datasets.length).toBe(1)
    expect(res.body.datasets[0].name).toBe('User1 Dataset')
  })

  it('user2 only sees their own datasets', async () => {
    const res = await request(app)
      .get('/api/datasets')
      .set('Cookie', `session_token=${user2.sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.datasets.length).toBe(1)
    expect(res.body.datasets[0].name).toBe('User2 Dataset')
  })

  it('user2 cannot delete user1 dataset', async () => {
    const res = await request(app)
      .delete(`/api/datasets/${testDatasetId}`)
      .set('Cookie', `session_token=${user2.sessionToken}`)
      .set('X-CSRF-Token', user2.csrfToken)
    expect(res.status).toBe(404)
  })

  it('user1 can delete their own dataset', async () => {
    const res = await request(app)
      .delete(`/api/datasets/${testDatasetId}`)
      .set('Cookie', `session_token=${user1.sessionToken}`)
      .set('X-CSRF-Token', user1.csrfToken)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('Consent Enforcement', () => {
  let user: { userId: string; sessionToken: string; csrfToken: string }

  beforeAll(async () => {
    user = await createTestUser()
  })

  afterAll(async () => {
    await cleanupTestUser(user.userId)
  })

  it('rejects ingest-api without consent', async () => {
    const res = await request(app)
      .post('/api/datasets/ingest-api')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({
        tracks: [{ ts: '2024-01-01T00:00:00Z', trackName: 'Test', artistName: 'Artist', albumName: 'Album', spotifyUri: 'spotify:track:123', msPlayed: 30000 }],
      })
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('Consent')
  })

  it('allows consent recording with valid CSRF', async () => {
    const res = await request(app)
      .post('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ consentType: 'persist_history', granted: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects consent with invalid type', async () => {
    const res = await request(app)
      .post('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ consentType: 'invalid_type', granted: true })
    expect(res.status).toBe(400)
  })

  it('returns consent state', async () => {
    const res = await request(app)
      .get('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.consent.persist_history).toBe(true)
  })

  it('supports consent revocation', async () => {
    await request(app)
      .post('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ consentType: 'persist_history', granted: false })

    const res = await request(app)
      .get('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.consent.persist_history).toBe(false)
  })
})

describe('Input Validation - Ingest API', () => {
  let user: { userId: string; sessionToken: string; csrfToken: string }

  beforeAll(async () => {
    user = await createTestUserWithConsent()
  })

  afterAll(async () => {
    await cleanupTestUser(user.userId)
  })

  it('rejects empty tracks array', async () => {
    const res = await request(app)
      .post('/api/datasets/ingest-api')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ tracks: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('No tracks')
  })

  it('rejects missing tracks field', async () => {
    const res = await request(app)
      .post('/api/datasets/ingest-api')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({})
    expect(res.status).toBe(400)
  })

  it('rejects tracks exceeding maximum count', async () => {
    const tracks = Array.from({ length: 5001 }, (_, i) => ({
      ts: `2024-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
      trackName: `Track ${i}`,
      artistName: 'Artist',
      albumName: 'Album',
      spotifyUri: `spotify:track:${i}`,
      msPlayed: 30000,
    }))
    const res = await request(app)
      .post('/api/datasets/ingest-api')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({ tracks })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('5000')
  })

  it('accepts valid tracks', async () => {
    const res = await request(app)
      .post('/api/datasets/ingest-api')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
      .send({
        tracks: [
          { ts: '2024-01-01T00:00:00Z', trackName: 'Test Track', artistName: 'Test Artist', albumName: 'Test Album', spotifyUri: 'spotify:track:abc', msPlayed: 30000 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.recordCount).toBe(1)
    expect(res.body.datasetId).toBeDefined()
  })
})

describe('Aggregate Endpoints', () => {
  it('returns aggregate summary', async () => {
    const res = await request(app).get('/api/aggregates/summary')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('minCohortSize')
  })

  it('returns privacy policy', async () => {
    const res = await request(app).get('/api/aggregates/privacy')
    expect(res.status).toBe(200)
    expect(res.body.minimumCohortSize).toBe(5)
    expect(res.body.rareItemThreshold).toBe(3)
    expect(res.body.suppressionRules).toBeInstanceOf(Array)
    expect(res.body.dataGuarantees).toBeInstanceOf(Array)
  })

  it('validates snapshot type', async () => {
    const res = await request(app).get('/api/aggregates/snapshot/invalid_type')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Invalid snapshot type')
  })

  it('accepts valid snapshot types', async () => {
    const validTypes = ['top_artists', 'top_tracks', 'genre_distribution', 'hourly_patterns', 'archetype_distribution', 'platform_distribution', 'listening_trends']
    for (const type of validTypes) {
      const res = await request(app).get(`/api/aggregates/snapshot/${type}`)
      expect(res.status).toBe(200)
    }
  })

  it('rejects compute without auth', async () => {
    const res = await request(app).post('/api/aggregates/compute')
    expect(res.status).toBe(401)
  })
})

describe('Enrichment Input Validation', () => {
  it('rejects GET requests', async () => {
    const res = await request(app).get('/api/spotify/enrichment/audio-features')
    expect(res.status).toBe(404)
  })

  it('rejects missing trackIds', async () => {
    const res = await request(app)
      .post('/api/spotify/enrichment/audio-features')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('bad-request')
  })

  it('rejects empty trackIds array', async () => {
    const res = await request(app)
      .post('/api/spotify/enrichment/audio-features')
      .send({ trackIds: [] })
    expect(res.status).toBe(400)
  })

  it('rejects more than 100 trackIds', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `track${i}`)
    const res = await request(app)
      .post('/api/spotify/enrichment/audio-features')
      .send({ trackIds: ids })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('100')
  })
})

describe('Account Deletion Cascade', () => {
  it('deletes all user data when account is deleted', async () => {
    const user = await createTestUserWithConsent()

    const dsResult = await dbQuery<{ id: string }>(
      `INSERT INTO datasets (user_id, name, source, status, record_count)
       VALUES ($1, 'Deletion Test', 'spotify_export', 'ready', 0) RETURNING id`,
      [user.userId],
    )
    const datasetId = dsResult.rows[0].id

    const dedupHash = crypto.createHash('sha256').update('test-deletion').digest('hex')
    await dbQuery(
      `INSERT INTO listening_events (user_id, dataset_id, dedup_hash, ts, platform, ms_played)
       VALUES ($1, $2, $3, '2024-01-01', 'test', 30000)`,
      [user.userId, datasetId, dedupHash],
    )

    await dbQuery(
      `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count)
       VALUES ($1, $2, 'upload', 'spotify_export', 1)`,
      [user.userId, datasetId],
    )

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', user.csrfToken)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const userCheck = await dbQuery('SELECT id FROM users WHERE id = $1', [user.userId])
    expect(userCheck.rows.length).toBe(0)

    const sessionCheck = await dbQuery('SELECT id FROM sessions WHERE user_id = $1', [user.userId])
    expect(sessionCheck.rows.length).toBe(0)

    const consentCheck = await dbQuery('SELECT id FROM consent_events WHERE user_id = $1', [user.userId])
    expect(consentCheck.rows.length).toBe(0)

    const dsCheck = await dbQuery('SELECT id FROM datasets WHERE user_id = $1', [user.userId])
    expect(dsCheck.rows.length).toBe(0)

    const eventsCheck = await dbQuery('SELECT id FROM listening_events WHERE user_id = $1', [user.userId])
    expect(eventsCheck.rows.length).toBe(0)

    const provenanceCheck = await dbQuery('SELECT id FROM provenance_metadata WHERE user_id = $1', [user.userId])
    expect(provenanceCheck.rows.length).toBe(0)
  })
})

describe('CSRF Protection', () => {
  let user: { userId: string; sessionToken: string; csrfToken: string }

  beforeAll(async () => {
    user = await createTestUserWithConsent()
  })

  afterAll(async () => {
    try {
      await cleanupTestUser(user.userId)
    } catch {
      /* Best-effort test cleanup. */
    }
  })

  it('rejects consent POST without CSRF', async () => {
    const res = await request(app)
      .post('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .send({ consentType: 'persist_history', granted: true })
    expect(res.status).toBe(403)
  })

  it('rejects consent POST with wrong CSRF', async () => {
    const res = await request(app)
      .post('/api/datasets/consent')
      .set('Cookie', `session_token=${user.sessionToken}`)
      .set('X-CSRF-Token', 'invalid-token')
      .send({ consentType: 'persist_history', granted: true })
    expect(res.status).toBe(403)
  })

  it('rejects dataset delete without CSRF', async () => {
    const res = await request(app)
      .delete('/api/datasets/some-id')
      .set('Cookie', `session_token=${user.sessionToken}`)
    expect(res.status).toBe(403)
  })
})

describe('OAuth State Validation', () => {
  it('rejects callback with no state', async () => {
    const res = await request(app).get('/api/auth/spotify/callback?code=test')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('auth_error=state_mismatch')
  })

  it('rejects callback with mismatched state', async () => {
    const res = await request(app)
      .get('/api/auth/spotify/callback?code=test&state=bad')
      .set('Cookie', 'oauth_state=good')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('auth_error=state_mismatch')
  })

  it('rejects callback with oauth error', async () => {
    const res = await request(app).get('/api/auth/spotify/callback?error=access_denied')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('auth_error=access_denied')
  })

  it('rejects callback with missing verifier', async () => {
    const res = await request(app)
      .get('/api/auth/spotify/callback?code=test&state=match')
      .set('Cookie', 'oauth_state=match')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('auth_error=missing_verifier')
  })
})

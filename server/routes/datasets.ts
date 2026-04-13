import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { query, getClient } from '../db.js'
import { requireAuth, requireCsrf, type AuthenticatedRequest } from '../middleware.js'
import { parseZipBuffer, type ParsedRecord } from '../parser.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new Error('Only ZIP files are accepted'))
    }
  },
})

router.get('/consent', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  try {
    const result = await query<{ consent_type: string; granted: boolean }>(
      `SELECT DISTINCT ON (consent_type) consent_type, granted
       FROM consent_events
       WHERE user_id = $1
       ORDER BY consent_type, created_at DESC`,
      [authReq.userId],
    )
    const consent: Record<string, boolean> = {}
    for (const row of result.rows) {
      consent[row.consent_type] = row.granted
    }
    res.json({ consent })
  } catch (err) {
    console.error('[datasets] Failed to fetch consent:', err)
    res.status(500).json({ error: 'Failed to fetch consent state' })
  }
})

router.post('/consent', requireAuth, requireCsrf, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  const { consentType, granted } = req.body as { consentType?: string; granted?: boolean }

  const validTypes = ['persist_history', 'persist_enrichment', 'aggregate_analytics']
  if (!consentType || !validTypes.includes(consentType) || typeof granted !== 'boolean') {
    res.status(400).json({ error: 'Invalid consent parameters' })
    return
  }

  try {
    await query(
      `INSERT INTO consent_events (user_id, consent_type, granted) VALUES ($1, $2, $3)`,
      [authReq.userId, consentType, granted],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[datasets] Failed to record consent:', err)
    res.status(500).json({ error: 'Failed to record consent' })
  }
})

const INSERT_BATCH_SIZE = 500

async function insertRecordsBatch(
  client: Awaited<ReturnType<typeof getClient>>,
  userId: string,
  datasetId: string,
  records: ParsedRecord[],
): Promise<number> {
  let inserted = 0

  for (let i = 0; i < records.length; i += INSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + INSERT_BATCH_SIZE)
    const values: unknown[] = []
    const placeholders: string[] = []

    const COLS_PER_ROW = 22

    for (let j = 0; j < batch.length; j++) {
      const r = batch[j]
      const offset = j * COLS_PER_ROW
      const ps = Array.from({ length: COLS_PER_ROW }, (_, k) => `$${offset + k + 1}`).join(', ')
      placeholders.push(`(${ps})`)
      values.push(
        userId,
        datasetId,
        r.dedup_hash,
        r.ts,
        r.platform,
        r.ms_played,
        r.conn_country,
        r.master_metadata_track_name,
        r.master_metadata_album_artist_name,
        r.master_metadata_album_album_name,
        r.spotify_track_uri,
        r.episode_name,
        r.episode_show_name,
        r.spotify_episode_uri,
        r.reason_start,
        r.reason_end,
        r.shuffle,
        r.skipped,
        r.offline,
        r.offline_timestamp,
        r.incognito_mode,
        r.content_type,
      )
    }

    const result = await client.query(
      `INSERT INTO listening_events (
        user_id, dataset_id, dedup_hash, ts, platform, ms_played, conn_country,
        master_metadata_track_name, master_metadata_album_artist_name,
        master_metadata_album_album_name, spotify_track_uri,
        episode_name, episode_show_name, spotify_episode_uri,
        reason_start, reason_end, shuffle, skipped,
        offline, offline_timestamp, incognito_mode, content_type
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_id, dedup_hash) DO NOTHING`,
      values,
    )
    inserted += result.rowCount ?? 0
  }

  return inserted
}

router.post(
  '/upload',
  requireAuth,
  requireCsrf,
  upload.single('file'),
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const consentCheck = await query<{ granted: boolean }>(
      `SELECT granted FROM consent_events
       WHERE user_id = $1 AND consent_type = 'persist_history'
       ORDER BY created_at DESC LIMIT 1`,
      [authReq.userId],
    )

    if (consentCheck.rows.length === 0 || !consentCheck.rows[0].granted) {
      res.status(403).json({ error: 'Consent for history persistence not granted' })
      return
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const datasetResult = await client.query<{ id: string }>(
        `INSERT INTO datasets (user_id, name, source, status, file_size_bytes)
         VALUES ($1, $2, 'spotify_export', 'processing', $3)
         RETURNING id`,
        [authReq.userId, req.file.originalname, req.file.size],
      )
      const datasetId = datasetResult.rows[0].id

      let parseResult
      try {
        parseResult = await parseZipBuffer(req.file.buffer)
      } catch (parseErr) {
        await client.query(
          `UPDATE datasets SET status = 'error', error_message = $1, updated_at = now() WHERE id = $2`,
          [(parseErr as Error).message, datasetId],
        )
        await client.query('COMMIT')
        res.status(422).json({ error: (parseErr as Error).message, datasetId })
        return
      }

      const insertedCount = await insertRecordsBatch(client, authReq.userId, datasetId, parseResult.records)

      await client.query(
        `UPDATE datasets SET
          status = 'ready',
          record_count = $1,
          date_range_start = $2,
          date_range_end = $3,
          history_file_count = $4,
          updated_at = now()
         WHERE id = $5`,
        [insertedCount, parseResult.dateRangeStart, parseResult.dateRangeEnd, parseResult.historyFileCount, datasetId],
      )

      await client.query('COMMIT')

      res.json({
        datasetId,
        recordCount: insertedCount,
        totalParsed: parseResult.records.length,
        duplicatesSkipped: parseResult.records.length - insertedCount,
        historyFileCount: parseResult.historyFileCount,
        dateRange: {
          start: parseResult.dateRangeStart,
          end: parseResult.dateRangeEnd,
        },
      })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[datasets] Upload failed:', err)
      res.status(500).json({ error: 'Failed to process upload' })
    } finally {
      client.release()
    }
  },
)

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  try {
    const result = await query<{
      id: string
      name: string
      source: string
      status: string
      record_count: number
      file_size_bytes: string | null
      date_range_start: string | null
      date_range_end: string | null
      history_file_count: number
      error_message: string | null
      created_at: string
      updated_at: string
    }>(
      `SELECT id, name, source, status, record_count, file_size_bytes,
              date_range_start, date_range_end, history_file_count,
              error_message, created_at, updated_at
       FROM datasets
       WHERE user_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`,
      [authReq.userId],
    )

    res.json({
      datasets: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        status: row.status,
        recordCount: row.record_count,
        fileSizeBytes: row.file_size_bytes ? parseInt(row.file_size_bytes, 10) : null,
        dateRange: {
          start: row.date_range_start,
          end: row.date_range_end,
        },
        historyFileCount: row.history_file_count,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    })
  } catch (err) {
    console.error('[datasets] Failed to list datasets:', err)
    res.status(500).json({ error: 'Failed to list datasets' })
  }
})

router.delete('/:id', requireAuth, requireCsrf, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  const datasetId = req.params.id

  try {
    const check = await query<{ id: string }>(
      `SELECT id FROM datasets WHERE id = $1 AND user_id = $2 AND status != 'deleted'`,
      [datasetId, authReq.userId],
    )

    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Dataset not found' })
      return
    }

    await query(
      `DELETE FROM listening_events WHERE dataset_id = $1 AND user_id = $2`,
      [datasetId, authReq.userId],
    )

    await query(
      `UPDATE datasets SET status = 'deleted', record_count = 0, updated_at = now() WHERE id = $1`,
      [datasetId],
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('[datasets] Failed to delete dataset:', err)
    res.status(500).json({ error: 'Failed to delete dataset' })
  }
})

router.get('/events', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 1000)
  const offset = parseInt(req.query.offset as string, 10) || 0

  try {
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM listening_events WHERE user_id = $1`,
      [authReq.userId],
    )

    const result = await query(
      `SELECT ts, platform, ms_played, conn_country,
              master_metadata_track_name, master_metadata_album_artist_name,
              master_metadata_album_album_name, spotify_track_uri,
              episode_name, episode_show_name, spotify_episode_uri,
              content_type, shuffle, skipped, offline, incognito_mode,
              dataset_id
       FROM listening_events
       WHERE user_id = $1
       ORDER BY ts DESC
       LIMIT $2 OFFSET $3`,
      [authReq.userId, limit, offset],
    )

    res.json({
      totalCount: parseInt(countResult.rows[0].count, 10),
      events: result.rows,
    })
  } catch (err) {
    console.error('[datasets] Failed to fetch events:', err)
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

export default router

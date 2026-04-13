import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { createHash } from 'crypto'
import { query, getClient } from '../db.js'
import { decrypt } from '../crypto.js'
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
      ON CONFLICT (dataset_id, dedup_hash) DO NOTHING`,
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

      await client.query(
        `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count, details)
         VALUES ($1, $2, 'upload', 'spotify_export', $3, $4)`,
        [
          authReq.userId,
          datasetId,
          insertedCount,
          JSON.stringify({
            fileName: req.file.originalname,
            fileSizeBytes: req.file.size,
            totalParsed: parseResult.records.length,
            duplicatesSkipped: parseResult.records.length - insertedCount,
            historyFileCount: parseResult.historyFileCount,
            dateRangeStart: parseResult.dateRangeStart,
            dateRangeEnd: parseResult.dateRangeEnd,
          }),
        ],
      )

      if (parseResult.records.length > insertedCount) {
        await client.query(
          `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count, details)
           VALUES ($1, $2, 'dedupe', 'system', $3, $4)`,
          [
            authReq.userId,
            datasetId,
            parseResult.records.length - insertedCount,
            JSON.stringify({ reason: 'duplicate_dedup_hash' }),
          ],
        )
      }

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

router.post('/ingest-api', requireAuth, requireCsrf, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  const { tracks } = req.body as {
    tracks?: Array<{
      ts: string
      trackName: string
      artistName: string
      albumName: string
      spotifyUri: string
      msPlayed: number
      platform?: string
    }>
  }

  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    res.status(400).json({ error: 'No tracks provided' })
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
      `INSERT INTO datasets (user_id, name, source, status)
       VALUES ($1, $2, 'spotify_api', 'processing')
       RETURNING id`,
      [authReq.userId, `Spotify API import - ${new Date().toISOString().split('T')[0]}`],
    )
    const datasetId = datasetResult.rows[0].id

    let inserted = 0
    let minTs: string | null = null
    let maxTs: string | null = null

    for (let i = 0; i < tracks.length; i += INSERT_BATCH_SIZE) {
      const batch = tracks.slice(i, i + INSERT_BATCH_SIZE)
      const values: unknown[] = []
      const placeholders: string[] = []
      const COLS_PER_ROW = 10

      for (let j = 0; j < batch.length; j++) {
        const t = batch[j]
        const offset = j * COLS_PER_ROW
        const ps = Array.from({ length: COLS_PER_ROW }, (_, k) => `$${offset + k + 1}`).join(', ')
        placeholders.push(`(${ps})`)

        const dedupInput = `${t.ts}|${t.spotifyUri || ''}|${t.trackName || ''}|${t.artistName || ''}`
        const dedupHash = createHash('sha256').update(dedupInput).digest('hex')

        if (!minTs || t.ts < minTs) minTs = t.ts
        if (!maxTs || t.ts > maxTs) maxTs = t.ts

        values.push(
          authReq.userId,
          datasetId,
          dedupHash,
          t.ts,
          t.platform || 'spotify_api',
          t.msPlayed,
          t.trackName || null,
          t.artistName || null,
          t.albumName || null,
          t.spotifyUri || null,
        )
      }

      const result = await client.query(
        `INSERT INTO listening_events (
          user_id, dataset_id, dedup_hash, ts, platform, ms_played,
          master_metadata_track_name, master_metadata_album_artist_name,
          master_metadata_album_album_name, spotify_track_uri
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (dataset_id, dedup_hash) DO NOTHING`,
        values,
      )
      inserted += result.rowCount ?? 0
    }

    await client.query(
      `UPDATE datasets SET
        status = 'ready',
        record_count = $1,
        date_range_start = $2,
        date_range_end = $3,
        updated_at = now()
       WHERE id = $4`,
      [inserted, minTs, maxTs, datasetId],
    )

    await client.query(
      `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count, details)
       VALUES ($1, $2, 'upload', 'spotify_api', $3, $4)`,
      [
        authReq.userId,
        datasetId,
        inserted,
        JSON.stringify({
          totalTracks: tracks.length,
          duplicatesSkipped: tracks.length - inserted,
          dateRangeStart: minTs,
          dateRangeEnd: maxTs,
        }),
      ],
    )

    await client.query('COMMIT')

    res.json({
      datasetId,
      recordCount: inserted,
      totalTracks: tracks.length,
      duplicatesSkipped: tracks.length - inserted,
      dateRange: { start: minTs, end: maxTs },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[datasets] API ingest failed:', err)
    res.status(500).json({ error: 'Failed to ingest API data' })
  } finally {
    client.release()
  }
})

router.post('/sync-spotify', requireAuth, requireCsrf, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest

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

  const connResult = await query<{ access_token_encrypted: string; token_expires_at: string }>(
    `SELECT access_token_encrypted, token_expires_at FROM spotify_connections
     WHERE user_id = $1 AND status = 'active'
     ORDER BY last_refreshed_at DESC LIMIT 1`,
    [authReq.userId],
  )

  if (connResult.rows.length === 0) {
    res.status(400).json({ error: 'No active Spotify connection' })
    return
  }

  const accessToken = decrypt(connResult.rows[0].access_token_encrypted)
  const expiresAt = new Date(connResult.rows[0].token_expires_at)

  if (expiresAt < new Date()) {
    res.status(401).json({ error: 'Spotify token expired — please refresh first' })
    return
  }

  try {
    const spotifyRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!spotifyRes.ok) {
      res.status(502).json({ error: 'Failed to fetch from Spotify API' })
      return
    }

    const data = (await spotifyRes.json()) as {
      items: Array<{
        played_at: string
        track: {
          name: string
          artists: Array<{ name: string }>
          album: { name: string }
          uri: string
          duration_ms: number
        }
      }>
    }

    if (!data.items || data.items.length === 0) {
      res.json({ datasetId: null, recordCount: 0, message: 'No recent tracks found' })
      return
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const datasetResult = await client.query<{ id: string }>(
        `INSERT INTO datasets (user_id, name, source, status)
         VALUES ($1, $2, 'spotify_api', 'processing')
         RETURNING id`,
        [authReq.userId, `Spotify API sync - ${new Date().toISOString().split('T')[0]}`],
      )
      const datasetId = datasetResult.rows[0].id

      let inserted = 0
      let minTs: string | null = null
      let maxTs: string | null = null

      const values: unknown[] = []
      const placeholders: string[] = []
      const COLS_PER_ROW = 10

      for (let j = 0; j < data.items.length; j++) {
        const item = data.items[j]
        const offset = j * COLS_PER_ROW
        const ps = Array.from({ length: COLS_PER_ROW }, (_, k) => `$${offset + k + 1}`).join(', ')
        placeholders.push(`(${ps})`)

        const artistName = item.track.artists.map((a) => a.name).join(', ')
        const dedupInput = `${item.played_at}|${item.track.uri || ''}|${item.track.name || ''}|${artistName || ''}`
        const dedupHash = createHash('sha256').update(dedupInput).digest('hex')

        if (!minTs || item.played_at < minTs) minTs = item.played_at
        if (!maxTs || item.played_at > maxTs) maxTs = item.played_at

        values.push(
          authReq.userId,
          datasetId,
          dedupHash,
          item.played_at,
          'spotify_api',
          item.track.duration_ms,
          item.track.name || null,
          artistName || null,
          item.track.album.name || null,
          item.track.uri || null,
        )
      }

      const insertResult = await client.query(
        `INSERT INTO listening_events (
          user_id, dataset_id, dedup_hash, ts, platform, ms_played,
          master_metadata_track_name, master_metadata_album_artist_name,
          master_metadata_album_album_name, spotify_track_uri
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (dataset_id, dedup_hash) DO NOTHING`,
        values,
      )
      inserted = insertResult.rowCount ?? 0

      await client.query(
        `UPDATE datasets SET
          status = 'ready',
          record_count = $1,
          date_range_start = $2,
          date_range_end = $3,
          updated_at = now()
         WHERE id = $4`,
        [inserted, minTs, maxTs, datasetId],
      )

      await client.query(
        `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count, details)
         VALUES ($1, $2, 'api_fetch', 'spotify_api', $3, $4)`,
        [
          authReq.userId,
          datasetId,
          inserted,
          JSON.stringify({
            totalFetched: data.items.length,
            duplicatesSkipped: data.items.length - inserted,
            dateRangeStart: minTs,
            dateRangeEnd: maxTs,
          }),
        ],
      )

      await client.query('COMMIT')

      res.json({
        datasetId,
        recordCount: inserted,
        totalFetched: data.items.length,
        duplicatesSkipped: data.items.length - inserted,
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[datasets] Spotify sync failed:', err)
    res.status(500).json({ error: 'Failed to sync from Spotify' })
  }
})

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

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM listening_events WHERE dataset_id = $1 AND user_id = $2`,
      [datasetId, authReq.userId],
    )
    const deletedCount = parseInt(countResult.rows[0].count, 10)

    await query(
      `DELETE FROM listening_events WHERE dataset_id = $1 AND user_id = $2`,
      [datasetId, authReq.userId],
    )

    const derivedDatasets = await query<{ id: string }>(
      `SELECT id FROM datasets WHERE user_id = $1 AND source = 'merged' AND status != 'deleted'
       AND id IN (
         SELECT dataset_id FROM provenance_metadata
         WHERE user_id = $1 AND event_type = 'merge'
         AND details::text LIKE $2
       )`,
      [authReq.userId, `%${datasetId}%`],
    )

    let derivedDeletedCount = 0
    for (const derived of derivedDatasets.rows) {
      const derivedCount = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM listening_events WHERE dataset_id = $1`,
        [derived.id],
      )
      derivedDeletedCount += parseInt(derivedCount.rows[0].count, 10)
      await query(`DELETE FROM listening_events WHERE dataset_id = $1`, [derived.id])
      
      await query(
        `UPDATE datasets SET status = 'deleted', record_count = 0, updated_at = now() WHERE id = $1`,
        [derived.id],
      )
    }

    await query(
      `UPDATE datasets SET status = 'deleted', record_count = 0, updated_at = now() WHERE id = $1`,
      [datasetId],
    )

    await query(
      `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count, details)
       VALUES ($1, $2, 'deletion', 'system', $3, $4)`,
      [
        authReq.userId,
        datasetId,
        deletedCount + derivedDeletedCount,
        JSON.stringify({
          action: 'dataset_deleted',
          eventsDeleted: deletedCount,
          derivedDatasetsDeleted: derivedDatasets.rows.map((d) => d.id),
          derivedEventsDeleted: derivedDeletedCount,
        }),
      ],
    )

    res.json({ ok: true, derivedDatasetsDeleted: derivedDatasets.rows.length })
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
      `SELECT COUNT(*) as count FROM (
        SELECT DISTINCT ON (dedup_hash) id FROM listening_events WHERE user_id = $1
      ) deduped`,
      [authReq.userId],
    )

    const result = await query(
      `SELECT DISTINCT ON (dedup_hash) ts, platform, ms_played, conn_country,
              master_metadata_track_name, master_metadata_album_artist_name,
              master_metadata_album_album_name, spotify_track_uri,
              episode_name, episode_show_name, spotify_episode_uri,
              content_type, shuffle, skipped, offline, incognito_mode,
              dataset_id, dedup_hash
       FROM listening_events
       WHERE user_id = $1
       ORDER BY dedup_hash, ts DESC`,
      [authReq.userId],
    )

    const sorted = result.rows.sort((a: { ts: string }, b: { ts: string }) => b.ts.localeCompare(a.ts))
    const paged = sorted.slice(offset, offset + limit)

    const result2 = { rows: paged }

    res.json({
      totalCount: parseInt(countResult.rows[0].count, 10),
      events: result2.rows,
    })
  } catch (err) {
    console.error('[datasets] Failed to fetch events:', err)
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

router.post('/merge', requireAuth, requireCsrf, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  const { datasetIds } = req.body as { datasetIds?: string[] }

  if (!datasetIds || !Array.isArray(datasetIds) || datasetIds.length < 2) {
    res.status(400).json({ error: 'At least two dataset IDs are required for merge' })
    return
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const validDatasets = await client.query<{ id: string; name: string; source: string }>(
      `SELECT id, name, source FROM datasets
       WHERE id = ANY($1) AND user_id = $2 AND status = 'ready'`,
      [datasetIds, authReq.userId],
    )

    if (validDatasets.rows.length < 2) {
      await client.query('ROLLBACK')
      res.status(400).json({ error: 'At least two valid ready datasets required' })
      return
    }

    const sourceNames = validDatasets.rows.map((d) => d.name).join(' + ')
    const mergedDatasetResult = await client.query<{ id: string }>(
      `INSERT INTO datasets (user_id, name, source, status)
       VALUES ($1, $2, 'merged', 'processing')
       RETURNING id`,
      [authReq.userId, `Merged: ${sourceNames}`],
    )
    const mergedDatasetId = mergedDatasetResult.rows[0].id

    const insertResult = await client.query<{ count: string }>(
      `WITH source_events AS (
        SELECT DISTINCT ON (dedup_hash)
          $1::uuid as new_user_id,
          $2::uuid as new_dataset_id,
          dedup_hash, ts, platform, ms_played, conn_country,
          master_metadata_track_name, master_metadata_album_artist_name,
          master_metadata_album_album_name, spotify_track_uri,
          episode_name, episode_show_name, spotify_episode_uri,
          reason_start, reason_end, shuffle, skipped,
          offline, offline_timestamp, incognito_mode, content_type
        FROM listening_events
        WHERE dataset_id = ANY($3) AND user_id = $1
        ORDER BY dedup_hash, ts ASC
      )
      INSERT INTO listening_events (
        user_id, dataset_id, dedup_hash, ts, platform, ms_played, conn_country,
        master_metadata_track_name, master_metadata_album_artist_name,
        master_metadata_album_album_name, spotify_track_uri,
        episode_name, episode_show_name, spotify_episode_uri,
        reason_start, reason_end, shuffle, skipped,
        offline, offline_timestamp, incognito_mode, content_type
      )
      SELECT new_user_id, new_dataset_id,
        dedup_hash, ts, platform, ms_played, conn_country,
        master_metadata_track_name, master_metadata_album_artist_name,
        master_metadata_album_album_name, spotify_track_uri,
        episode_name, episode_show_name, spotify_episode_uri,
        reason_start, reason_end, shuffle, skipped,
        offline, offline_timestamp, incognito_mode, content_type
      FROM source_events
      ON CONFLICT (dataset_id, dedup_hash) DO NOTHING
      RETURNING id`,
      [authReq.userId, mergedDatasetId, validDatasets.rows.map((d) => d.id)],
    )

    const mergedCount = insertResult.rowCount ?? 0

    const dateRange = await client.query<{ min_ts: string | null; max_ts: string | null }>(
      `SELECT MIN(ts) as min_ts, MAX(ts) as max_ts FROM listening_events WHERE dataset_id = $1`,
      [mergedDatasetId],
    )

    await client.query(
      `UPDATE datasets SET
        status = 'ready',
        record_count = $1,
        date_range_start = $2,
        date_range_end = $3,
        updated_at = now()
       WHERE id = $4`,
      [mergedCount, dateRange.rows[0]?.min_ts, dateRange.rows[0]?.max_ts, mergedDatasetId],
    )

    const sourceDatasetIds = validDatasets.rows.map((d) => d.id)
    const sourceCounts = await client.query<{ dataset_id: string; count: string }>(
      `SELECT dataset_id, COUNT(*) as count FROM listening_events
       WHERE dataset_id = ANY($1) GROUP BY dataset_id`,
      [sourceDatasetIds],
    )

    await client.query(
      `INSERT INTO provenance_metadata (user_id, dataset_id, event_type, source, record_count, details)
       VALUES ($1, $2, 'merge', 'merged', $3, $4)`,
      [
        authReq.userId,
        mergedDatasetId,
        mergedCount,
        JSON.stringify({
          sourceDatasets: validDatasets.rows.map((d) => ({
            id: d.id,
            name: d.name,
            source: d.source,
            eventCount: parseInt(sourceCounts.rows.find((r) => r.dataset_id === d.id)?.count ?? '0', 10),
          })),
          duplicatesRemoved: sourceCounts.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0) - mergedCount,
        }),
      ],
    )

    await client.query('COMMIT')

    res.json({
      datasetId: mergedDatasetId,
      recordCount: mergedCount,
      sourceDatasets: validDatasets.rows.length,
      dateRange: {
        start: dateRange.rows[0]?.min_ts,
        end: dateRange.rows[0]?.max_ts,
      },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[datasets] Merge failed:', err)
    res.status(500).json({ error: 'Failed to merge datasets' })
  } finally {
    client.release()
  }
})

router.get('/provenance', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  const datasetId = req.query.datasetId as string | undefined

  try {
    const params: unknown[] = [authReq.userId]
    let whereClause = 'WHERE user_id = $1'
    if (datasetId) {
      whereClause += ' AND dataset_id = $2'
      params.push(datasetId)
    }

    const result = await query(
      `SELECT id, dataset_id, event_type, source, record_count, details, created_at
       FROM provenance_metadata
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 100`,
      params,
    )

    res.json({ provenance: result.rows })
  } catch (err) {
    console.error('[datasets] Failed to fetch provenance:', err)
    res.status(500).json({ error: 'Failed to fetch provenance' })
  }
})

export default router

import { query, getClient } from './db.js'

const MIN_COHORT_SIZE = 5
const RARE_ITEM_THRESHOLD = 3
const MAX_FACTS_PER_SNAPSHOT = 100

interface AggregationResult {
  snapshotId: string
  snapshotType: string
  cohortSize: number
  factCount: number
  suppressedCount: number
}

async function getEligibleUserCount(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT user_id) as count
     FROM consent_events ce
     WHERE consent_type = 'aggregate_analytics'
     AND granted = true
     AND NOT EXISTS (
       SELECT 1 FROM consent_events ce2
       WHERE ce2.user_id = ce.user_id
       AND ce2.consent_type = 'aggregate_analytics'
       AND ce2.created_at > ce.created_at
       AND ce2.granted = false
     )`,
  )
  return parseInt(result.rows[0].count, 10)
}

async function getEligibleUserIds(): Promise<string[]> {
  const result = await query<{ user_id: string }>(
    `SELECT DISTINCT ce.user_id
     FROM consent_events ce
     WHERE ce.consent_type = 'aggregate_analytics'
     AND ce.granted = true
     AND NOT EXISTS (
       SELECT 1 FROM consent_events ce2
       WHERE ce2.user_id = ce.user_id
       AND ce2.consent_type = 'aggregate_analytics'
       AND ce2.created_at > ce.created_at
       AND ce2.granted = false
     )
     AND EXISTS (
       SELECT 1 FROM listening_events le WHERE le.user_id = ce.user_id
     )`,
  )
  return result.rows.map((r) => r.user_id)
}

function shouldSuppress(contributingUsers: number, totalUsers: number): { suppressed: boolean; reason: string | null } {
  if (contributingUsers < RARE_ITEM_THRESHOLD) {
    return { suppressed: true, reason: `fewer_than_${RARE_ITEM_THRESHOLD}_users` }
  }
  if (contributingUsers / totalUsers < 0.01 && contributingUsers < 5) {
    return { suppressed: true, reason: 'anti_fingerprinting_low_prevalence' }
  }
  return { suppressed: false, reason: null }
}

async function computeTopArtists(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('top_artists', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const artistData = await client.query<{
    artist: string
    total_plays: string
    total_ms: string
    user_count: string
  }>(
    `SELECT
       master_metadata_album_artist_name as artist,
       COUNT(*) as total_plays,
       SUM(ms_played) as total_ms,
       COUNT(DISTINCT user_id) as user_count
     FROM listening_events
     WHERE user_id = ANY($1)
     AND master_metadata_album_artist_name IS NOT NULL
     AND master_metadata_album_artist_name != ''
     GROUP BY master_metadata_album_artist_name
     ORDER BY COUNT(*) DESC
     LIMIT 500`,
    [userIds],
  )

  let factCount = 0
  let suppressedCount = 0

  for (let i = 0; i < Math.min(artistData.rows.length, MAX_FACTS_PER_SNAPSHOT); i++) {
    const row = artistData.rows[i]
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) {
      suppressedCount++
    }

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'artist', $2, 'total_plays', $3, $4, $5, $6)`,
      [snapshotId, suppressed ? '[suppressed]' : row.artist, parseInt(row.total_plays, 10), i + 1, suppressed, reason],
    )

    if (!suppressed) {
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'artist', $2, 'total_ms', $3, $4, false, NULL)`,
        [snapshotId, row.artist, parseInt(row.total_ms, 10), i + 1],
      )
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'artist', $2, 'user_count', $3, $4, false, NULL)`,
        [snapshotId, row.artist, userCount, i + 1],
      )
    }

    factCount++
  }

  return { snapshotId, snapshotType: 'top_artists', cohortSize, factCount, suppressedCount }
}

async function computeTopTracks(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('top_tracks', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const trackData = await client.query<{
    track: string
    artist: string
    total_plays: string
    total_ms: string
    user_count: string
  }>(
    `SELECT
       master_metadata_track_name as track,
       master_metadata_album_artist_name as artist,
       COUNT(*) as total_plays,
       SUM(ms_played) as total_ms,
       COUNT(DISTINCT user_id) as user_count
     FROM listening_events
     WHERE user_id = ANY($1)
     AND master_metadata_track_name IS NOT NULL
     AND master_metadata_track_name != ''
     GROUP BY master_metadata_track_name, master_metadata_album_artist_name
     ORDER BY COUNT(*) DESC
     LIMIT 500`,
    [userIds],
  )

  let factCount = 0
  let suppressedCount = 0

  for (let i = 0; i < Math.min(trackData.rows.length, MAX_FACTS_PER_SNAPSHOT); i++) {
    const row = trackData.rows[i]
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) suppressedCount++

    const label = suppressed ? '[suppressed]' : `${row.track} — ${row.artist}`

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'track', $2, 'total_plays', $3, $4, $5, $6)`,
      [snapshotId, label, parseInt(row.total_plays, 10), i + 1, suppressed, reason],
    )

    if (!suppressed) {
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'track', $2, 'user_count', $3, $4, false, NULL)`,
        [snapshotId, label, userCount, i + 1],
      )
    }

    factCount++
  }

  return { snapshotId, snapshotType: 'top_tracks', cohortSize, factCount, suppressedCount }
}

async function computeHourlyPatterns(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('hourly_patterns', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const hourlyData = await client.query<{
    hour: string
    total_plays: string
    avg_ms: string
    user_count: string
  }>(
    `SELECT
       EXTRACT(HOUR FROM ts::timestamptz) as hour,
       COUNT(*) as total_plays,
       AVG(ms_played) as avg_ms,
       COUNT(DISTINCT user_id) as user_count
     FROM listening_events
     WHERE user_id = ANY($1)
     GROUP BY EXTRACT(HOUR FROM ts::timestamptz)
     ORDER BY hour`,
    [userIds],
  )

  let factCount = 0
  let suppressedCount = 0

  for (const row of hourlyData.rows) {
    const hourLabel = `${row.hour.padStart(2, '0')}:00`
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) suppressedCount++

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'hour', $2, 'total_plays', $3, NULL, $4, $5)`,
      [snapshotId, hourLabel, parseInt(row.total_plays, 10), suppressed, reason],
    )

    if (!suppressed) {
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'hour', $2, 'avg_ms_played', $3, NULL, false, NULL)`,
        [snapshotId, hourLabel, parseFloat(row.avg_ms)],
      )
    }

    factCount++
  }

  return { snapshotId, snapshotType: 'hourly_patterns', cohortSize, factCount, suppressedCount }
}

async function computePlatformDistribution(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('platform_distribution', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const platformData = await client.query<{
    platform: string
    total_plays: string
    total_ms: string
    user_count: string
  }>(
    `SELECT
       platform,
       COUNT(*) as total_plays,
       SUM(ms_played) as total_ms,
       COUNT(DISTINCT user_id) as user_count
     FROM listening_events
     WHERE user_id = ANY($1) AND platform IS NOT NULL
     GROUP BY platform
     ORDER BY COUNT(*) DESC`,
    [userIds],
  )

  let factCount = 0
  let suppressedCount = 0

  for (let i = 0; i < platformData.rows.length; i++) {
    const row = platformData.rows[i]
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) suppressedCount++

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'platform', $2, 'total_plays', $3, $4, $5, $6)`,
      [snapshotId, suppressed ? '[suppressed]' : row.platform, parseInt(row.total_plays, 10), i + 1, suppressed, reason],
    )

    if (!suppressed) {
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'platform', $2, 'total_ms', $3, $4, false, NULL)`,
        [snapshotId, row.platform, parseInt(row.total_ms, 10), i + 1],
      )
    }

    factCount++
  }

  return { snapshotId, snapshotType: 'platform_distribution', cohortSize, factCount, suppressedCount }
}

async function computeListeningTrends(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('listening_trends', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const monthlyData = await client.query<{
    month: string
    total_plays: string
    total_ms: string
    avg_skip_rate: string
    user_count: string
  }>(
    `SELECT
       TO_CHAR(ts::timestamptz, 'YYYY-MM') as month,
       COUNT(*) as total_plays,
       SUM(ms_played) as total_ms,
       AVG(CASE WHEN skipped THEN 1.0 ELSE 0.0 END) as avg_skip_rate,
       COUNT(DISTINCT user_id) as user_count
     FROM listening_events
     WHERE user_id = ANY($1)
     GROUP BY TO_CHAR(ts::timestamptz, 'YYYY-MM')
     ORDER BY month`,
    [userIds],
  )

  let factCount = 0
  let suppressedCount = 0

  for (const row of monthlyData.rows) {
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) {
      suppressedCount++
      continue
    }

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES
       ($1, 'month', $2, 'total_plays', $3, NULL, false, NULL),
       ($1, 'month', $2, 'total_ms', $4, NULL, false, NULL),
       ($1, 'month', $2, 'avg_skip_rate', $5, NULL, false, NULL),
       ($1, 'month', $2, 'user_count', $6, NULL, false, NULL)`,
      [snapshotId, row.month, parseInt(row.total_plays, 10), parseInt(row.total_ms, 10), parseFloat(row.avg_skip_rate), userCount],
    )

    factCount++
  }

  return { snapshotId, snapshotType: 'listening_trends', cohortSize, factCount, suppressedCount }
}

async function computeArchetypeDistribution(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('archetype_distribution', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline', method: 'behavioral_indicators' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const behaviorData = await client.query<{
    user_id: string
    total_plays: string
    total_ms: string
    skip_rate: string
    shuffle_rate: string
    nocturnal_share: string
    unique_artists: string
    top_artist_share: string
  }>(
    `WITH user_stats AS (
      SELECT
        user_id,
        COUNT(*) as total_plays,
        SUM(ms_played) as total_ms,
        AVG(CASE WHEN skipped THEN 1.0 ELSE 0.0 END) as skip_rate,
        AVG(CASE WHEN shuffle THEN 1.0 ELSE 0.0 END) as shuffle_rate,
        AVG(CASE WHEN EXTRACT(HOUR FROM ts::timestamptz) >= 22 OR EXTRACT(HOUR FROM ts::timestamptz) < 5 THEN 1.0 ELSE 0.0 END) as nocturnal_share,
        COUNT(DISTINCT master_metadata_album_artist_name) as unique_artists
      FROM listening_events
      WHERE user_id = ANY($1)
      GROUP BY user_id
    ),
    top_artist_stats AS (
      SELECT
        user_id,
        COALESCE(SUM(artist_plays)::float / NULLIF(SUM(total)::float, 0), 0) as top_artist_share
      FROM (
        SELECT
          user_id,
          COUNT(*) as artist_plays,
          SUM(COUNT(*)) OVER (PARTITION BY user_id) as total,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY COUNT(*) DESC) as rn
        FROM listening_events
        WHERE user_id = ANY($1) AND master_metadata_album_artist_name IS NOT NULL
        GROUP BY user_id, master_metadata_album_artist_name
      ) ranked
      WHERE rn <= 10
      GROUP BY user_id
    )
    SELECT
      us.user_id,
      us.total_plays,
      us.total_ms,
      us.skip_rate,
      us.shuffle_rate,
      us.nocturnal_share,
      us.unique_artists,
      COALESCE(tas.top_artist_share, 0) as top_artist_share
    FROM user_stats us
    LEFT JOIN top_artist_stats tas ON tas.user_id = us.user_id`,
    [userIds],
  )

  const archetypeCounts: Record<string, number> = {
    'night-owl': 0,
    'dawn-patrol': 0,
    'explorer': 0,
    'loyalist': 0,
    'skipper': 0,
    'shuffle-brain': 0,
    'streamer': 0,
    'curator': 0,
  }

  for (const row of behaviorData.rows) {
    const nocturnalShare = parseFloat(row.nocturnal_share)
    const skipRate = parseFloat(row.skip_rate)
    const shuffleRate = parseFloat(row.shuffle_rate)
    const totalHours = parseInt(row.total_ms, 10) / 3600000
    const uniqueArtists = parseInt(row.unique_artists, 10)
    const topArtistShare = parseFloat(row.top_artist_share)

    const scores: Array<{ key: string; score: number }> = [
      { key: 'night-owl', score: nocturnalShare },
      { key: 'dawn-patrol', score: Math.max(0, 1 - nocturnalShare - 0.3) },
      { key: 'explorer', score: Math.min(1, uniqueArtists / 5000 + (1 - topArtistShare)) },
      { key: 'loyalist', score: topArtistShare },
      { key: 'skipper', score: skipRate },
      { key: 'shuffle-brain', score: shuffleRate },
      { key: 'streamer', score: Math.min(1, totalHours / 1000) },
      { key: 'curator', score: Math.min(1, (1 - shuffleRate) * 0.5) },
    ]

    scores.sort((a, b) => b.score - a.score)
    const primary = scores[0].key
    archetypeCounts[primary] = (archetypeCounts[primary] || 0) + 1
  }

  let factCount = 0
  let suppressedCount = 0
  const sortedArchetypes = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])

  for (let i = 0; i < sortedArchetypes.length; i++) {
    const [archetype, count] = sortedArchetypes[i]
    if (count === 0) continue

    const { suppressed, reason } = shouldSuppress(count, cohortSize)
    if (suppressed) suppressedCount++

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'archetype', $2, 'user_count', $3, $4, $5, $6)`,
      [snapshotId, suppressed ? '[suppressed]' : archetype, count, i + 1, suppressed, reason],
    )

    if (!suppressed) {
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'archetype', $2, 'share', $3, $4, false, NULL)`,
        [snapshotId, archetype, count / cohortSize, i + 1],
      )
    }

    factCount++
  }

  return { snapshotId, snapshotType: 'archetype_distribution', cohortSize, factCount, suppressedCount }
}

async function computeGenreDistribution(client: ReturnType<typeof getClient> extends Promise<infer T> ? T : never, userIds: string[]): Promise<AggregationResult> {
  const cohortSize = userIds.length

  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO aggregate_snapshots (snapshot_type, cohort_size, min_cohort_threshold, source_provenance)
     VALUES ('genre_distribution', $1, $2, $3)
     RETURNING id`,
    [cohortSize, MIN_COHORT_SIZE, JSON.stringify({ eligibleUsers: cohortSize, computedBy: 'aggregation_pipeline', method: 'enrichment_and_content_type' })],
  )
  const snapshotId = snapshotResult.rows[0].id

  const enrichmentGenres = await client.query<{
    genre: string
    total_plays: string
    user_count: string
  }>(
    `SELECT
       g.genre,
       COUNT(le.id) as total_plays,
       COUNT(DISTINCT le.user_id) as user_count
     FROM listening_events le
     JOIN enrichment_artifacts ea ON ea.user_id = le.user_id
       AND ea.artifact_type = 'genre_affinity'
       AND ea.entity_uri = le.spotify_track_uri
     CROSS JOIN LATERAL jsonb_array_elements_text(ea.payload->'genres') AS g(genre)
     WHERE le.user_id = ANY($1)
     AND le.spotify_track_uri IS NOT NULL
     GROUP BY g.genre
     ORDER BY COUNT(le.id) DESC
     LIMIT 200`,
    [userIds],
  )

  const contentTypeData = await client.query<{
    content_type: string
    total_plays: string
    total_ms: string
    user_count: string
  }>(
    `SELECT
       content_type,
       COUNT(*) as total_plays,
       SUM(ms_played) as total_ms,
       COUNT(DISTINCT user_id) as user_count
     FROM listening_events
     WHERE user_id = ANY($1)
     GROUP BY content_type
     ORDER BY COUNT(*) DESC`,
    [userIds],
  )

  let factCount = 0
  let suppressedCount = 0

  for (let i = 0; i < contentTypeData.rows.length; i++) {
    const row = contentTypeData.rows[i]
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) suppressedCount++

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'content_type', $2, 'total_plays', $3, $4, $5, $6)`,
      [snapshotId, suppressed ? '[suppressed]' : row.content_type, parseInt(row.total_plays, 10), i + 1, suppressed, reason],
    )

    if (!suppressed) {
      await client.query(
        `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
         VALUES ($1, 'content_type', $2, 'total_ms', $3, $4, false, NULL)`,
        [snapshotId, row.content_type, parseInt(row.total_ms, 10), i + 1],
      )
    }
    factCount++
  }

  for (let i = 0; i < Math.min(enrichmentGenres.rows.length, MAX_FACTS_PER_SNAPSHOT - factCount); i++) {
    const row = enrichmentGenres.rows[i]
    const userCount = parseInt(row.user_count, 10)
    const { suppressed, reason } = shouldSuppress(userCount, cohortSize)

    if (suppressed) {
      suppressedCount++
      continue
    }

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'genre', $2, 'total_plays', $3, $4, false, NULL)`,
      [snapshotId, row.genre, parseInt(row.total_plays, 10), i + 1],
    )

    await client.query(
      `INSERT INTO aggregate_facts (snapshot_id, dimension, dimension_value, metric_name, metric_value, rank, suppressed, suppression_reason)
       VALUES ($1, 'genre', $2, 'user_count', $3, $4, false, NULL)`,
      [snapshotId, row.genre, userCount, i + 1],
    )

    factCount++
  }

  return { snapshotId, snapshotType: 'genre_distribution', cohortSize, factCount, suppressedCount }
}

export async function runAggregationPipeline(): Promise<{
  success: boolean
  results: AggregationResult[]
  skipped: boolean
  reason?: string
}> {
  const eligibleCount = await getEligibleUserCount()

  if (eligibleCount < MIN_COHORT_SIZE) {
    return {
      success: true,
      results: [],
      skipped: true,
      reason: `Only ${eligibleCount} eligible users (minimum ${MIN_COHORT_SIZE} required)`,
    }
  }

  const userIds = await getEligibleUserIds()

  if (userIds.length < MIN_COHORT_SIZE) {
    return {
      success: true,
      results: [],
      skipped: true,
      reason: `Only ${userIds.length} users with listening data (minimum ${MIN_COHORT_SIZE} required)`,
    }
  }

  const client = await getClient()
  const results: AggregationResult[] = []

  try {
    await client.query('BEGIN')

    results.push(await computeTopArtists(client, userIds))
    results.push(await computeTopTracks(client, userIds))
    results.push(await computeHourlyPatterns(client, userIds))
    results.push(await computePlatformDistribution(client, userIds))
    results.push(await computeListeningTrends(client, userIds))
    results.push(await computeArchetypeDistribution(client, userIds))
    results.push(await computeGenreDistribution(client, userIds))

    await client.query('COMMIT')

    console.log(`[aggregation] Pipeline complete: ${results.length} snapshots, ${results.reduce((s, r) => s + r.factCount, 0)} facts, ${results.reduce((s, r) => s + r.suppressedCount, 0)} suppressed`)

    return { success: true, results, skipped: false }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[aggregation] Pipeline failed:', err)
    return { success: false, results: [], skipped: false, reason: (err as Error).message }
  } finally {
    client.release()
  }
}

export { MIN_COHORT_SIZE, RARE_ITEM_THRESHOLD, MAX_FACTS_PER_SNAPSHOT }

import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import { runAggregationPipeline, MIN_COHORT_SIZE } from '../aggregation.js'
import { requireAuth, requireCsrf, type AuthenticatedRequest } from '../middleware.js'
import { computeLimiter } from '../rate-limit.js'

const router = Router()

const CACHE_TTL_MS = 15 * 60 * 1000
const snapshotCache = new Map<string, { data: unknown; cachedAt: number }>()

function getCachedOrNull(key: string): unknown | null {
  const entry = snapshotCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    snapshotCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: unknown): void {
  snapshotCache.set(key, { data, cachedAt: Date.now() })
}

router.get('/summary', async (_req: Request, res: Response) => {
  const cached = getCachedOrNull('summary')
  if (cached) {
    res.json(cached)
    return
  }

  try {
    const snapshotTypes = await query<{ snapshot_type: string; cohort_size: number; computed_at: string; id: string }>(
      `SELECT DISTINCT ON (snapshot_type) snapshot_type, cohort_size, computed_at, id
       FROM aggregate_snapshots
       ORDER BY snapshot_type, computed_at DESC`,
    )

    if (snapshotTypes.rows.length === 0) {
      const result = {
        available: false,
        message: 'No aggregate data available yet',
        minCohortSize: MIN_COHORT_SIZE,
      }
      res.json(result)
      return
    }

    const summary = {
      available: true,
      snapshots: snapshotTypes.rows.map((s) => ({
        type: s.snapshot_type,
        cohortSize: s.cohort_size,
        computedAt: s.computed_at,
      })),
      minCohortSize: MIN_COHORT_SIZE,
    }

    setCache('summary', summary)
    res.json(summary)
  } catch (err) {
    console.error('[aggregates] Failed to fetch summary:', err)
    res.status(500).json({ error: 'Failed to fetch aggregate summary' })
  }
})

router.get('/snapshot/:type', async (req: Request, res: Response) => {
  const { type } = req.params
  const validTypes = ['top_artists', 'top_tracks', 'genre_distribution', 'hourly_patterns', 'archetype_distribution', 'platform_distribution', 'listening_trends']

  if (!validTypes.includes(type)) {
    res.status(400).json({ error: 'Invalid snapshot type' })
    return
  }

  const cacheKey = `snapshot:${type}`
  const cached = getCachedOrNull(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  try {
    const snapshotResult = await query<{ id: string; cohort_size: number; computed_at: string; min_cohort_threshold: number; source_provenance: object }>(
      `SELECT id, cohort_size, computed_at, min_cohort_threshold, source_provenance
       FROM aggregate_snapshots
       WHERE snapshot_type = $1
       ORDER BY computed_at DESC
       LIMIT 1`,
      [type],
    )

    if (snapshotResult.rows.length === 0) {
      res.json({ available: false, type, message: 'No data available for this snapshot type' })
      return
    }

    const snapshot = snapshotResult.rows[0]

    const factsResult = await query<{
      dimension: string
      dimension_value: string
      metric_name: string
      metric_value: number
      rank: number | null
      suppressed: boolean
    }>(
      `SELECT dimension, dimension_value, metric_name, metric_value, rank, suppressed
       FROM aggregate_facts
       WHERE snapshot_id = $1 AND suppressed = false
       ORDER BY rank ASC NULLS LAST, metric_value DESC`,
      [snapshot.id],
    )

    const suppressedCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM aggregate_facts WHERE snapshot_id = $1 AND suppressed = true`,
      [snapshot.id],
    )

    const grouped: Record<string, Array<{ metric: string; value: number; rank: number | null }>> = {}
    for (const fact of factsResult.rows) {
      const key = `${fact.dimension}:${fact.dimension_value}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({ metric: fact.metric_name, value: fact.metric_value, rank: fact.rank })
    }

    const result = {
      available: true,
      type,
      cohortSize: snapshot.cohort_size,
      computedAt: snapshot.computed_at,
      minCohortThreshold: snapshot.min_cohort_threshold,
      suppressedItemCount: parseInt(suppressedCount.rows[0].count, 10),
      facts: grouped,
      provenance: snapshot.source_provenance,
    }

    setCache(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error(`[aggregates] Failed to fetch snapshot ${type}:`, err)
    res.status(500).json({ error: 'Failed to fetch aggregate snapshot' })
  }
})

router.post('/compute', computeLimiter, requireAuth, requireCsrf, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest

  const userCheck = await query<{ spotify_id: string }>(
    `SELECT spotify_id FROM users WHERE id = $1`,
    [authReq.userId],
  )

  if (userCheck.rows.length === 0) {
    res.status(403).json({ error: 'Unauthorized' })
    return
  }

  try {
    const result = await runAggregationPipeline()

    snapshotCache.clear()

    res.json({
      success: result.success,
      skipped: result.skipped,
      reason: result.reason,
      snapshots: result.results.map((r) => ({
        type: r.snapshotType,
        cohortSize: r.cohortSize,
        factCount: r.factCount,
        suppressedCount: r.suppressedCount,
      })),
    })
  } catch (err) {
    console.error('[aggregates] Compute trigger failed:', err)
    res.status(500).json({ error: 'Failed to run aggregation pipeline' })
  }
})

router.get('/privacy', (_req: Request, res: Response) => {
  res.json({
    minimumCohortSize: MIN_COHORT_SIZE,
    rareItemThreshold: 3,
    maxFactsPerSnapshot: 100,
    suppressionRules: [
      'Items with fewer than 3 contributing users are suppressed',
      'Items representing less than 1% of the cohort with fewer than 5 users are suppressed for anti-fingerprinting',
      'Suppressed items show as [suppressed] with no identifying data',
    ],
    dataGuarantees: [
      'Only users who explicitly consent to aggregate_analytics are included',
      'Consent is checked at aggregation time — revoked consent excludes the user',
      'No row-level listening data is exposed in aggregate tables',
      'All metrics are derived from grouped/counted data only',
      'Aggregate tables are physically separate from user-private tables',
    ],
    residualRisks: [
      'With very small cohorts (near minimum threshold), aggregate patterns may be more attributable',
      'Top-ranked items in small cohorts may correlate with individual taste profiles',
      'Temporal patterns (hourly/monthly) could theoretically narrow user identity in combination with external data',
    ],
    metricsComputed: [
      'top_artists: Most-played artists across the cohort with play counts and listening time',
      'top_tracks: Most-played tracks across the cohort with play counts',
      'hourly_patterns: Listening activity distribution by hour of day (UTC)',
      'platform_distribution: Listening platform usage across the cohort',
      'listening_trends: Monthly listening volume, skip rates, and engagement',
      'archetype_distribution: Dominant listener archetype distribution across the cohort (behavioral classification)',
      'genre_distribution: Genre and content type distribution from enrichment data and raw events',
    ],
  })
})

export default router

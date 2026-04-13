# Aggregate Analytics — Privacy Model

## Overview

Listentropy computes cross-user aggregate metrics to power the home dashboard with community-level insights. This document describes the privacy model, what metrics are computed, what thresholds are enforced, and what residual risks remain.

## Consent Model

Aggregate analytics are strictly opt-in. Users must explicitly grant `aggregate_analytics` consent via the consent dialog. This consent:

- Is recorded as an append-only event in `consent_events`
- Can be revoked at any time from Account Settings
- Is checked at aggregation time — a user who revokes consent is excluded from the next computation
- Is separate from `persist_history` consent (you can persist data without contributing to aggregates)

## Data Flow

```
User listening_events (private)
    → Aggregation Pipeline (server-side)
    → SQL GROUP BY / COUNT / SUM / AVG (no row-level exposure)
    → Privacy Guardrails (threshold + suppression checks)
    → aggregate_snapshots + aggregate_facts (public-facing)
    → Aggregate API endpoints (read-only, cached)
```

## Metrics Computed

| Snapshot Type | Dimensions | Metrics | Description |
|---|---|---|---|
| `top_artists` | artist name | total_plays, total_ms, user_count | Most-played artists across the cohort |
| `top_tracks` | track + artist | total_plays, user_count | Most-played tracks across the cohort |
| `hourly_patterns` | hour of day (UTC) | total_plays, avg_ms_played | Listening activity distribution by hour |
| `platform_distribution` | platform string | total_plays, total_ms | Device/platform usage distribution |
| `listening_trends` | month (YYYY-MM) | total_plays, total_ms, avg_skip_rate, user_count | Monthly listening volume and engagement |

## Privacy Guardrails

### 1. Minimum Cohort Threshold

No aggregation runs unless at least **5 eligible users** have opted in and have listening data. This prevents aggregate metrics from being derived from too few users, which would make them attributable.

**Constant:** `MIN_COHORT_SIZE = 5`

### 2. Rare-Item Suppression

Within each snapshot, individual dimension values (e.g., a specific artist or track) are suppressed if:

- Fewer than **3 users** contributed to that item
- The item represents less than **1% of the cohort** AND has fewer than 5 contributing users

Suppressed items appear as `[suppressed]` in the aggregate facts with no identifying data preserved. The suppression reason is recorded for audit purposes.

**Constants:** `RARE_ITEM_THRESHOLD = 3`

### 3. Anti-Fingerprinting Protection

Low-prevalence items that could serve as quasi-identifiers are suppressed even if they meet the basic threshold. This protects against:

- Unique taste fingerprinting (e.g., a rare artist listened to by only one user)
- Intersection attacks combining multiple aggregate dimensions

### 4. Physical Separation

Aggregate tables (`aggregate_snapshots`, `aggregate_facts`) have no foreign key references to user-private tables (`listening_events`, `users`, `datasets`). The aggregation pipeline reads from private tables via SQL but writes only grouped results to the aggregate tables.

### 5. No Row-Level Exposure

All aggregate metrics are computed via SQL `GROUP BY`, `COUNT`, `SUM`, and `AVG` operations. No individual listening event row is copied to or referenced from aggregate tables.

## Schema Design

### `aggregate_snapshots`

Each snapshot represents one computation run for a specific metric type. Contains:
- `snapshot_type`: Which metric was computed
- `cohort_size`: How many users contributed
- `min_cohort_threshold`: The threshold that was enforced
- `computed_at`: When the computation ran
- `source_provenance`: JSON metadata about the computation
- `version`: Schema version for forward compatibility

### `aggregate_facts`

Each fact is one data point within a snapshot. Contains:
- `dimension` + `dimension_value`: What this fact describes (e.g., artist:Drake)
- `metric_name` + `metric_value`: The measurement (e.g., total_plays:4521)
- `rank`: Optional ordering within the snapshot
- `suppressed` + `suppression_reason`: Whether this item was privacy-suppressed

## API Endpoints

All aggregate endpoints are read-only and publicly accessible (no auth required for reading):

- `GET /api/aggregates/summary` — Available snapshot types and metadata
- `GET /api/aggregates/snapshot/:type` — Full snapshot data (suppressed items excluded)
- `GET /api/aggregates/privacy` — Machine-readable privacy policy
- `POST /api/aggregates/compute` — Trigger aggregation (auth required)

Responses are cached in-memory for 15 minutes to reduce database load.

## Aggregation Scheduling

Currently triggered manually via `POST /api/aggregates/compute`. Future work may add:
- Cron-based scheduling (e.g., hourly or daily)
- Event-driven triggers (e.g., after N new uploads)

## Residual Risks

1. **Small cohort attributability:** With exactly 5 users, aggregate patterns may correlate with individual taste. Risk decreases as cohort grows.

2. **Temporal correlation:** Hourly/monthly patterns combined with external knowledge (e.g., "I know user X only listens at 3am") could narrow identity. Mitigated by UTC normalization and cohort threshold.

3. **Top-rank inference:** The #1 artist/track in a small cohort likely reflects at least one specific user's heavy rotation. Mitigated by suppression thresholds.

4. **Cross-snapshot combination:** Combining artist + track + hourly data could create a more specific fingerprint than any single snapshot. This is a standard limitation of k-anonymity-style approaches.

## Design Decisions

- **UTC timestamps for hourly patterns:** Avoids leaking timezone information that could narrow geographic identity.
- **Genre distribution:** Combines enrichment-derived genre affinity data (from Spotify API) with content-type classification. Enrichment genres are joined via `enrichment_artifacts` with `genre_affinity` type; content types (music/podcast/audiobook) are always available from raw events.
- **Archetype distribution:** Server-side recomputation of listener archetypes using behavioral indicators (nocturnal share, skip rate, shuffle rate, unique artists, top-artist concentration, total hours). Each user is assigned their dominant archetype, and the aggregate shows the distribution across the cohort.
- **100-item cap per snapshot:** Prevents exhaustive enumeration of the long tail, which could reveal rare items.

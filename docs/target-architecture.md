# Listentropy — Target Architecture

_Generated: 2026-04-13_

---

## 1. Architecture Overview

Listentropy evolves from a local-only SPA into a **hybrid local+server data product** with authenticated users, opt-in persistence, and privacy-preserving aggregate analytics.

### Core Principle
The existing local-first processing pipeline remains the default path. Server-side persistence is an **opt-in layer** that users explicitly consent to. The five data domains are never conflated:

1. **Raw user data** — uploaded listening history records (user-scoped, private)
2. **User-private derived data** — analytics snapshots computed from raw data (user-scoped, private)
3. **Cached API enrichment data** — audio features, artist metadata from Spotify API (shared cache)
4. **Aggregate analytics** — cross-user de-identified metrics (product-wide, public)
5. **UI/session/auth state** — ephemeral client state (not persisted server-side)

### System Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ Auth UI  │  │ Upload   │  │ Analytics│  │ Home Dashboard   ││
│  │          │  │ + Consent│  │ Views    │  │ (Aggregates)     ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
│       │              │             │                  │          │
│  ┌────┴──────────────┴─────────────┴──────────────────┴─────┐   │
│  │              Zustand Stores + Web Workers                │   │
│  │  (Local processing pipeline preserved as-is)             │   │
│  └──────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ API calls (authenticated)
┌─────────────────────────────┼───────────────────────────────────┐
│                     Backend API Server                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Auth     │  │ Ingest   │  │ Enrich   │  │ Aggregate      │  │
│  │ Layer    │  │ Layer    │  │ Layer    │  │ Layer          │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬───────┘  │
│       │              │             │                  │          │
│  ┌────┴──────────────┴─────────────┴──────────────────┴─────┐   │
│  │                    PostgreSQL                            │   │
│  │  users │ connections │ datasets │ events │ aggregates    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### 2.1 User & Identity

```typescript
interface User {
  id: string                     // UUID
  spotifyId: string              // Spotify user ID (unique)
  displayName: string | null     // From Spotify profile
  email: string | null           // From Spotify profile (if scope granted)
  avatarUrl: string | null       // From Spotify profile
  createdAt: string              // ISO 8601
  updatedAt: string              // ISO 8601
}

interface SpotifyConnection {
  id: string                     // UUID
  userId: string                 // FK → users.id
  spotifyId: string              // Spotify user ID
  accessToken: string            // Encrypted at rest
  refreshToken: string           // Encrypted at rest
  tokenExpiresAt: string         // ISO 8601
  scopes: string[]               // Granted OAuth scopes
  connectedAt: string            // ISO 8601
  lastRefreshedAt: string | null
  revokedAt: string | null       // Set when user disconnects
  status: 'active' | 'expired' | 'revoked'
}

interface Session {
  id: string                     // UUID
  userId: string                 // FK → users.id
  token: string                  // Session token (hashed)
  expiresAt: string              // ISO 8601
  createdAt: string              // ISO 8601
  lastActiveAt: string           // ISO 8601
  ipAddress: string | null       // For security audit
  userAgent: string | null       // For security audit
}
```

### 2.2 Consent

Consent uses an **append-only event log** for full auditability, plus a materialized current-state view for fast queries.

```typescript
interface ConsentEvent {
  id: string                     // UUID
  userId: string                 // FK → users.id
  consentType: ConsentType
  action: 'grant' | 'revoke'
  consentVersion: number         // Version of consent text shown to user
  recordedAt: string             // ISO 8601
  ipAddress: string | null       // For audit
}

interface ConsentCurrentState {
  userId: string                 // FK → users.id
  consentType: ConsentType
  granted: boolean
  lastEventId: string            // FK → consent_events.id
  updatedAt: string              // ISO 8601
}

type ConsentType =
  | 'server_data_persistence'    // Allow storing uploaded data server-side
  | 'aggregate_contribution'     // Allow contributing to aggregate analytics
  | 'enrichment_cache'           // Allow caching enrichment results
```

### 2.3 Datasets & Events

```typescript
interface UploadedDataset {
  id: string                     // UUID
  userId: string                 // FK → users.id
  source: DatasetSource
  fileName: string | null
  recordCount: number
  firstEventAt: string           // ISO 8601
  lastEventAt: string            // ISO 8601
  fingerprint: string            // Content hash for dedup
  uploadedAt: string             // ISO 8601
  processedAt: string | null     // ISO 8601
  sizeBytes: number
}

type DatasetSource =
  | 'spotify_export_zip'         // User uploaded ZIP
  | 'spotify_api_recent'         // Fetched via Spotify API
  | 'merged'                     // Result of merge operation

interface DatasetProvenance {
  id: string                     // UUID
  datasetId: string              // FK → datasets.id
  parentDatasetIds: string[]     // Source datasets for merged data
  mergeStrategy: string | null   // 'dedupe-by-timestamp' etc.
  processingVersion: string      // Pipeline version that processed this
  createdAt: string              // ISO 8601
}

interface ListeningEvent {
  id: string                     // UUID (or bigint for perf)
  datasetId: string              // FK → datasets.id
  userId: string                 // FK → users.id (denormalized for perf)
  ts: string                     // ISO 8601 timestamp
  msPlayed: number
  trackName: string | null
  artistName: string | null
  albumName: string | null
  spotifyTrackUri: string | null
  contentType: 'music' | 'podcast' | 'audiobook'
  platform: string
  connCountry: string
  reasonStart: string
  reasonEnd: string
  shuffle: boolean
  skipped: boolean
  offline: boolean
  incognitoMode: boolean
  // ip_addr is NEVER stored — stripped during ingestion
}
```

### 2.4 Enrichment

```typescript
interface EnrichmentArtifact {
  id: string                     // UUID
  trackId: string                // Spotify track ID
  providerId: string             // 'spotify-audio-traits'
  traits: AudioTraitVector       // Cached trait values
  fetchedAt: string              // ISO 8601
  sourceVersion: string          // Provider API version
  expiresAt: string              // Cache TTL
}
```

### 2.5 User-Private Analytics

```typescript
interface UserPrivateAnalyticsSnapshot {
  id: string                     // UUID
  userId: string                 // FK → users.id
  datasetId: string              // FK → datasets.id
  snapshotType: string           // 'full-processed' | 'era-summary' | etc.
  payload: object                // JSON blob of ProcessedDataModel subset
  computedAt: string             // ISO 8601
  pipelineVersion: string        // Processing pipeline version
}
```

### 2.6 Aggregate Analytics

```typescript
interface AggregateMetric {
  id: string                     // UUID
  metricKey: string              // 'top_artists_30d' | 'genre_distribution' | etc.
  timeBucket: string             // '2026-04' | '2026-W15' | etc.
  dimensions: Record<string, string>  // { genre: 'pop' } for dimensional slicing
  value: number
  cohortSize: number             // Number of users contributing
  minCohortThreshold: number     // Suppressed if cohortSize < threshold
  provenanceMix: ProvenanceMix   // Source breakdown
  computedAt: string             // ISO 8601
  pipelineVersion: string
}

interface ProvenanceMix {
  fromExport: number             // Percentage from export uploads
  fromApi: number                // Percentage from Spotify API
  fromMerged: number             // Percentage from merged datasets
}
```

---

## 3. Service Layers

### 3.1 Auth / Session Layer

**Responsibilities:**
- Spotify OAuth PKCE initiation and callback handling (server-side token exchange)
- Session creation and validation
- Token refresh and rotation
- User creation on first login
- Connection management (connect/reconnect/disconnect)

**API Contracts:**
```
GET  /api/auth/spotify/login        → Redirect to Spotify authorize
GET  /api/auth/spotify/callback     → Exchange code, create session, redirect
POST /api/auth/refresh              → Refresh session
POST /api/auth/logout               → Invalidate session
GET  /api/auth/me                   → Current user profile + connection status
POST /api/auth/spotify/disconnect   → Revoke Spotify connection (keep account)
DELETE /api/auth/account            → Full account deletion
```

**Key Design Decisions:**
- Server-side token exchange (not client-side PKCE for identity flow)
- HttpOnly secure cookies for session tokens with `Secure`, `SameSite=Lax` attributes
- Refresh tokens stored encrypted in PostgreSQL
- Existing client-side PKCE path preserved for unauthenticated enrichment fallback
- CSRF protection via `SameSite=Lax` cookies + double-submit CSRF token for state-changing endpoints (POST/PUT/DELETE)

### 3.1.1 Authorization Enforcement Model

All user-scoped data access is enforced through a **mandatory tenant boundary middleware**:

1. **Auth middleware** (`requireAuth`): Extracts user ID from session cookie on every request. Rejects unauthenticated requests with 401.
2. **Ownership middleware** (`requireOwnership`): For dataset/event endpoints, validates that the requested resource belongs to `req.userId`. Rejects with 403 if user ID doesn't match.
3. **Query-level scoping**: All database queries for user-scoped data include `WHERE user_id = $userId` as a mandatory clause — never rely on application-level filtering alone.
4. **No cross-user joins**: Aggregate queries operate on pre-computed aggregate tables only, never on raw user events.
5. **CSRF token validation**: All state-changing endpoints (POST, PUT, DELETE) validate a CSRF token sent in a custom header (`X-CSRF-Token`) against the session-bound token.

```typescript
function requireAuth(req, res, next) {
  const session = await validateSessionCookie(req.cookies.session)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  req.userId = session.userId
  next()
}

const OWNED_TABLES = new Set(['datasets', 'user_analytics_snapshots'])

function requireOwnership(resourceType: string) {
  if (!OWNED_TABLES.has(resourceType)) {
    throw new Error(`Invalid resource type: ${resourceType}`)
  }
  return async (req, res, next) => {
    const resource = await db.query(
      `SELECT user_id FROM ${resourceType} WHERE id = $1`,
      [req.params.id]
    )
    if (!resource || resource.user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
```

### 3.2 Ingestion / Parsing Layer

**Responsibilities:**
- Accept ZIP uploads via multipart form
- Validate file type, size, structure
- Parse and sanitize records (strip PII)
- Store normalized events in PostgreSQL
- Track dataset provenance

**API Contracts:**
```
POST /api/datasets/upload           → Upload ZIP, returns dataset ID
GET  /api/datasets                  → List user's datasets
GET  /api/datasets/:id             → Dataset metadata + provenance
DELETE /api/datasets/:id           → Soft-delete dataset + cascade
POST /api/datasets/merge           → Merge multiple datasets
```

**Key Design Decisions:**
- Server-side parsing requires a **stream-based adapter** wrapping the existing `parser.ts` logic, since the current API operates on browser `File` objects. The adapter accepts a `Buffer` or `ReadableStream`, delegates to the same `coerceRawRecord`/`sanitizeRecord` functions, and enforces the same `ZIP_INGEST_LIMITS`.
- IP addresses are never stored — stripped during `sanitizeRecord()`
- Upload size limit enforced at both reverse proxy level (e.g., 256MB body limit) and application-level validation
- Consent check (`server_data_persistence`) required and verified before any write to `listening_events`
- Multipart upload with streaming to avoid buffering entire ZIP in memory

### 3.3 Enrichment Layer

**Responsibilities:**
- Audio feature enrichment (existing proxy, enhanced)
- Artist metadata caching
- Shared enrichment cache across users (track-level, not user-level)

**API Contracts:**
```
POST /api/enrichment/audio-features → Existing proxy endpoint (enhanced)
GET  /api/enrichment/status         → Provider capability status
```

**Key Design Decisions:**
- Enrichment cache is shared (not user-scoped) since audio features are public metadata
- Cache stored in PostgreSQL with TTL
- Rate limiting moves from in-memory to persistent store

### 3.4 User-Private Analytics Layer

**Responsibilities:**
- Store processed analytics snapshots per user per dataset
- Serve user's own analytics via API
- Reprocess when pipeline version changes

**API Contracts:**
```
GET  /api/analytics/me              → User's latest analytics snapshot
POST /api/analytics/reprocess       → Trigger reprocessing
```

### 3.5 Aggregate Analytics Layer

**Responsibilities:**
- Derive cross-user aggregate metrics from user-private data
- Apply privacy guardrails (thresholds, suppression)
- Serve aggregate data for home dashboard

**API Contracts:**
```
GET  /api/aggregates/dashboard      → Home dashboard aggregate metrics
GET  /api/aggregates/trends         → Time-series aggregate trends
```

**Privacy Guardrails:**
- Minimum cohort threshold: 10 users per metric slice
- Rare item suppression: items appearing for < 3 users are excluded
- No row-level event exposure in aggregate endpoints
- No user-identifiable fields in aggregate responses
- Provenance mix included (export vs API vs merged percentages)

### 3.6 Frontend Query / View Models

API responses use dedicated view-model shapes (not raw DB rows) to decouple frontend rendering from backend schema.

```typescript
interface UserProfileResponse {
  id: string
  displayName: string | null
  avatarUrl: string | null
  spotifyConnected: boolean
  consents: Record<ConsentType, boolean>
  datasetCount: number
  totalEventCount: number
  memberSince: string
}

interface DatasetListResponse {
  datasets: Array<{
    id: string
    source: DatasetSource
    fileName: string | null
    recordCount: number
    dateRange: { from: string; to: string }
    uploadedAt: string
    status: 'processing' | 'ready' | 'error'
  }>
}

interface AnalyticsSnapshotResponse {
  snapshotId: string
  computedAt: string
  summary: {
    totalPlays: number
    totalMsPlayed: number
    uniqueArtists: number
    uniqueTracks: number
    dateRange: { from: string; to: string }
  }
  eras: Array<{ label: string; startDate: string; endDate: string; topArtists: string[] }>
  archetypes: Array<{ name: string; score: number }>
}

interface AggregateDashboardResponse {
  updatedAt: string
  totalUsers: number
  metrics: Array<{
    dimension: string
    value: string
    count: number
    cohortSize: number
  }>
  trends: Array<{
    period: string
    dimension: string
    value: number
  }>
}
```

**Caching boundaries:**
- `UserProfileResponse`: No cache (always fresh)
- `DatasetListResponse`: No cache (user-mutable)
- `AnalyticsSnapshotResponse`: Cache for 1 hour (immutable once computed, invalidated on reprocess)
- `AggregateDashboardResponse`: Cache for 15 minutes (shared, recomputed periodically)

---

## 4. Database Schema (PostgreSQL)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE spotify_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spotify_id TEXT NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  UNIQUE (user_id, spotify_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
  consent_version INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT
);

CREATE TABLE consent_current_state (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  last_event_id UUID NOT NULL REFERENCES consent_events(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, consent_type)
);

CREATE TABLE datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('spotify_export_zip', 'spotify_api_recent', 'merged')),
  file_name TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  first_event_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  fingerprint TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE dataset_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  parent_dataset_ids UUID[] NOT NULL DEFAULT '{}',
  merge_strategy TEXT,
  processing_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listening_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  ms_played INTEGER NOT NULL,
  track_name TEXT,
  artist_name TEXT,
  album_name TEXT,
  spotify_track_uri TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('music', 'podcast', 'audiobook')),
  platform TEXT NOT NULL,
  conn_country TEXT NOT NULL,
  reason_start TEXT NOT NULL,
  reason_end TEXT NOT NULL,
  shuffle BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,
  offline BOOLEAN NOT NULL DEFAULT false,
  incognito_mode BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_listening_events_user_id ON listening_events(user_id);
CREATE INDEX idx_listening_events_dataset_id ON listening_events(dataset_id);
CREATE INDEX idx_listening_events_ts ON listening_events(ts);
CREATE INDEX idx_listening_events_artist ON listening_events(artist_name) WHERE artist_name IS NOT NULL;

CREATE TABLE enrichment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id TEXT NOT NULL UNIQUE,
  traits JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_version TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE user_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pipeline_version TEXT NOT NULL
);

CREATE TABLE aggregate_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  time_bucket TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}',
  value NUMERIC NOT NULL,
  cohort_size INTEGER NOT NULL,
  min_cohort_threshold INTEGER NOT NULL DEFAULT 10,
  provenance_mix JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pipeline_version TEXT NOT NULL,
  UNIQUE (metric_key, time_bucket, dimensions)
);

CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  request_type TEXT NOT NULL CHECK (request_type IN ('dataset', 'account')),
  target_dataset_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
```

---

## 5. Privacy Architecture

### 5.1 Data Classification

| Layer | Access | Retention | Deletion |
|-------|--------|-----------|----------|
| Raw listening events | User-only | Until user deletes | Cascade on dataset/account delete |
| User analytics snapshots | User-only | Until reprocessed or deleted | Cascade on dataset/account delete |
| Enrichment cache | Shared (non-PII) | TTL-based (30 days) | Auto-expire |
| Aggregate metrics | Public (product-wide) | Indefinite | Recomputed periodically; user contribution removed on deletion where feasible |
| Session/auth state | System | Session TTL | Auto-expire |

### 5.2 Consent Model

Before any server-side data persistence:
1. User sees consent dialog explaining exactly what will be stored
2. Three independent consent toggles:
   - "Store my listening data on the server" (`server_data_persistence`)
   - "Contribute to anonymous community insights" (`aggregate_contribution`)
   - "Cache enrichment results for faster loading" (`enrichment_cache`)
3. Each consent is versioned for audit trail
4. Consent can be revoked at any time — triggers appropriate data handling

### 5.3 Deletion Strategy

All user-facing deletions are **hard deletes** to ensure genuine data removal. The `deletion_requests` table provides the audit trail, so soft-deletes are not needed for compliance tracking.

**Dataset deletion:**
1. Hard-delete all `listening_events` for that dataset
2. Hard-delete all `user_analytics_snapshots` for that dataset
3. Hard-delete `dataset_provenance` records
4. Hard-delete the `datasets` record
5. Queue aggregate recomputation job (incremental invalidation by tracking `last_aggregated_at` vs deletion timestamp)

**Account deletion:**
1. Revoke Spotify connection (call Spotify API)
2. Hard-delete all user data via FK cascades: `listening_events`, `datasets`, `user_analytics_snapshots`, `sessions`, `consent_events`, `consent_current_state`, `spotify_connections`
3. Hard-delete the `users` record (cascades handle dependents)
4. Queue aggregate recomputation for affected metrics
5. Create `deletion_requests` audit record (stores only user UUID and timestamp, no PII)

**Aggregate invalidation SLO:** Aggregates must be recomputed within 24 hours of a deletion event. The aggregation job tracks pending invalidations via a `deletion_queue` table.

### 5.4 Aggregate Privacy Guardrails

- **Minimum cohort threshold:** No metric published with fewer than 10 contributing users
- **Rare item suppression:** Artists/tracks appearing for fewer than 3 users are excluded from aggregates
- **No unique fingerprinting surfaces:** Aggregate dimensions are coarse (genre, month, archetype — not user-identifiable combinations)
- **Provenance transparency:** Every aggregate metric includes the source mix percentage
- **Language precision:** Use "de-identified derived aggregates" and "thresholded aggregate analytics" — never claim "anonymous" if reversibility is possible

---

## 6. Migration Strategy

### Phase 1: Backend Foundation + Auth (Task #2)
- Provision PostgreSQL database
- Set up Express/Hono API server alongside Vite dev server
- Implement Spotify OAuth as identity (server-side token exchange)
- Create user/session/connection tables
- Build auth middleware and session management
- Update frontend auth store and UI

**Preserved:** All existing local-first processing continues to work unchanged. Users can still use the app without signing in.

### Phase 2: Data Persistence + Ingestion (Task #3)
- Implement consent UX
- Build server-side upload ingestion API
- Create datasets, events, provenance tables
- Implement merge/dedupe engine
- Build data management UI (view, delete datasets)
- Implement deletion pipeline

**Preserved:** Local-only processing remains the default. Server persistence is opt-in.

### Phase 3: Aggregate Analytics (Task #4)
- Design and implement aggregation pipeline
- Apply privacy guardrails
- Create aggregate API endpoints
- Document privacy tradeoffs

**Preserved:** Existing individual analytics are unchanged.

### Phase 4: Dashboard + UX (Task #5)
- Build home dashboard from aggregate data
- Redesign onboarding (sign in, upload, or both)
- Restructure navigation
- Build account settings
- Add privacy provenance indicators

### Phase 5: Security + Testing + Docs (Task #6)
- Security audit and hardening
- Comprehensive test suite expansion
- Documentation updates

---

## 7. Technical Decisions

### Why Hybrid Local+Server?
The existing local-first architecture is a major strength — it's fast, private, and requires zero backend for basic use. Rather than replacing it, we layer server-side capabilities on top as opt-in features.

### Why PostgreSQL?
- Replit provides managed PostgreSQL
- JSONB support for analytics snapshots
- Strong typing and constraints
- Proven for multi-tenant SaaS
- Good enough for event storage at this scale (millions of rows, not billions)

### Why Not a Separate Auth Provider?
Spotify is the sole identity provider since the entire product is built around Spotify data. Adding email/password or other providers adds complexity without clear value at this stage. The auth abstraction layer supports adding providers later.

### Why Server-Side Token Exchange?
For identity (not just enrichment), tokens must be stored durably server-side. PKCE client-side exchange is preserved as a fallback for unauthenticated enrichment, but the primary auth flow uses server-side exchange with encrypted token storage.

---

## 8. Risks and Open Questions

1. **Scale of listening_events table:** A single user could have 2M records. Partitioning by user_id or time may be needed.
2. **Aggregation job frequency:** Real-time vs batched. Start with daily batch jobs, add near-real-time later if needed.
3. **Spotify API rate limits:** Server-side enrichment at scale needs careful rate limit management.
4. **Export format changes:** Spotify may change their export format. The parser should be versioned.
5. **GDPR/privacy compliance:** Formal privacy review recommended before launch. The architecture supports compliance but implementation details matter.
6. **Cold-start performance:** Serverless functions have cold start latency. Consider always-on server for critical auth paths.
7. **Aggregate recomputation cost:** Deleting a user triggers recomputation of all aggregates they contributed to. Need efficient incremental update strategy.

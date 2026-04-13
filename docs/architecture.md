# Listentropy Architecture

## System Overview

Listentropy is a privacy-first Spotify listening history analyzer that has evolved from a local-only SPA into a multi-user data product. Users can upload their Spotify Extended Streaming History exports, sync recent plays via the Spotify API, and receive deep analytics — all with strong privacy guarantees and consent-gated persistence.

## Component Architecture

### Frontend (Vite + React SPA)

- **Framework**: React 18 + TypeScript 5.9, bundled with Vite 7.3
- **Styling**: Tailwind CSS 3.4 with a theme engine
- **State Management**: 12 Zustand stores covering data processing, auth, consent, datasets, themes, aggregates, and more
- **Visualization**: Recharts (charts), D3-force (network graphs), Three.js + @react-three/fiber (3D)
- **Web Workers**: 2 dedicated workers for heavy data processing and lab analytics
- **Navigation**: 3-tab layout (Home / My Analytics / Share) via react-router-dom v7
- **Routes**: `/` (main), `/auth/spotify/callback` (legacy PKCE), `/share`

### Backend (Express API Server)

- **Runtime**: Node.js with Express, running on port 3001
- **Proxy**: Vite dev server on port 5000 proxies `/api/*` to Express
- **Database**: PostgreSQL (Replit-managed) via `pg` connection pool
- **Auth**: Server-side Spotify OAuth with PKCE + client secret, HttpOnly session cookies
- **Encryption**: AES-256-GCM for Spotify tokens at rest (via `ENCRYPTION_KEY`)
- **Session**: SHA-256 hashed session tokens, 30-day expiry, CSRF protection on all mutations

### Database Schema (10 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts keyed by Spotify identity |
| `spotify_connections` | Encrypted Spotify access/refresh tokens per user |
| `sessions` | Server-side session management with token hashes |
| `consent_events` | Append-only consent audit trail |
| `datasets` | Upload/sync metadata with status tracking |
| `listening_events` | Normalized stream records with SHA-256 dedup |
| `enrichment_artifacts` | Cached audio feature enrichment data |
| `provenance_metadata` | Full data lineage trail (upload, merge, delete events) |
| `aggregate_snapshots` | Cross-user aggregate computation metadata |
| `aggregate_facts` | Individual aggregate metrics with suppression flags |

## Security Architecture

### Authentication Flow

1. User clicks "Sign in with Spotify" → `GET /api/auth/spotify/login`
2. Server generates PKCE verifier + state, stores in HttpOnly cookies
3. User authorizes on Spotify, redirected to `/api/auth/spotify/callback`
4. Server exchanges code for tokens, fetches profile, creates/updates user
5. Server creates session with hashed token, sets HttpOnly session cookie
6. Frontend calls `GET /api/auth/me` to get user profile + CSRF token

### Security Layers

- **PKCE + State**: OAuth flow protected against CSRF and authorization code interception
- **HttpOnly Cookies**: Session tokens never exposed to JavaScript
- **CSRF Tokens**: All mutation endpoints require `X-CSRF-Token` header matching server-side value
- **Token Encryption**: Spotify tokens encrypted with AES-256-GCM before storage
- **Session Hashing**: Session tokens hashed with SHA-256 before database storage
- **Rate Limiting**: Tiered rate limits on auth (30/15min), upload (10/hr), compute (5/10min), general API (300/15min)
- **Security Headers**: Helmet middleware for X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.
- **CORS**: Strict origin allowlist (Replit domains + localhost dev)
- **Body Size Limits**: 1MB JSON body limit, 256MB file upload limit with ZIP-only filter
- **Input Validation**: Track count limits on API ingestion (max 5000), consent type validation, dataset ownership checks

### Authorization Model

- All dataset/events routes require authentication via `requireAuth` middleware
- All mutation routes additionally require CSRF via `requireCsrf` middleware
- Dataset operations are scoped by `user_id` — users can only access their own data
- Aggregate endpoints are public (read-only, privacy-preserving) but compute trigger requires auth
- Account deletion cascades through all user data

## Privacy Model

### Consent System

Three consent types, each independently controllable:
- `persist_history` — Required before any data upload/sync
- `persist_enrichment` — Required before storing audio feature data
- `aggregate_analytics` — Required before including user in cross-user analytics

Consent events are append-only (full audit trail). The latest event per type determines current state. Revocation is immediate and checked at operation time.

### Aggregate Analytics Privacy

Cross-user analytics use a multi-layered privacy approach:

1. **Minimum Cohort Size**: Aggregations only run when ≥5 consenting users have data
2. **Rare Item Suppression**: Items with <3 contributing users are suppressed
3. **Anti-Fingerprinting**: Items representing <1% of cohort with <5 users are suppressed
4. **Physical Separation**: Aggregate tables are separate from user-private tables
5. **No Row-Level Data**: All metrics derived from grouped/counted data only
6. **Max Facts Cap**: Maximum 100 facts per snapshot to limit information exposure

### 7 Aggregate Snapshot Types

- `top_artists` — Most-played artists with play counts and listening time
- `top_tracks` — Most-played tracks with play counts
- `hourly_patterns` — Listening distribution by hour of day (UTC)
- `platform_distribution` — Platform usage across the cohort
- `listening_trends` — Monthly volume, skip rates, engagement metrics
- `archetype_distribution` — Behavioral listener archetype distribution
- `genre_distribution` — Genre and content type distribution

### Data Lifecycle

- Users can delete individual datasets (cascades to events + derived merged datasets)
- Users can delete their entire account (cascades all data)
- Disconnecting Spotify revokes token access but preserves uploaded data
- Provenance metadata tracks all data operations for auditability

## API Reference

### Auth Routes (`/api/auth`)
| Method | Path | Auth | CSRF | Rate Limit | Description |
|--------|------|------|------|------------|-------------|
| GET | `/spotify/login` | No | No | 30/15min | Initiate Spotify OAuth |
| GET | `/spotify/callback` | No | No | 30/15min | OAuth callback |
| GET | `/me` | Yes | No | 300/15min | Current user + CSRF token |
| POST | `/logout` | Yes | Yes | 300/15min | End session |
| POST | `/refresh` | Yes | Yes | 300/15min | Refresh Spotify token |
| POST | `/spotify/disconnect` | Yes | Yes | 300/15min | Revoke Spotify connection |
| DELETE | `/account` | Yes | Yes | 300/15min | Delete account + all data |

### Dataset Routes (`/api/datasets`)
| Method | Path | Auth | CSRF | Rate Limit | Description |
|--------|------|------|------|------------|-------------|
| GET | `/consent` | Yes | No | 300/15min | Get consent state |
| POST | `/consent` | Yes | Yes | 300/15min | Record consent event |
| POST | `/upload` | Yes | Yes | 10/hr | Upload Spotify ZIP export |
| POST | `/ingest-api` | Yes | Yes | 10/hr | Ingest tracks from API |
| POST | `/sync-spotify` | Yes | Yes | 10/hr | Sync recent plays from Spotify |
| GET | `/` | Yes | No | 300/15min | List datasets |
| DELETE | `/:id` | Yes | Yes | 300/15min | Delete dataset |
| GET | `/events` | Yes | No | 300/15min | Paginated listening events |
| POST | `/merge` | Yes | Yes | 300/15min | Merge datasets |
| GET | `/provenance` | Yes | No | 300/15min | Provenance trail |

### Aggregate Routes (`/api/aggregates`)
| Method | Path | Auth | CSRF | Rate Limit | Description |
|--------|------|------|------|------------|-------------|
| GET | `/summary` | No | No | 300/15min | Available snapshot types |
| GET | `/snapshot/:type` | No | No | 300/15min | Snapshot data (cached 15min) |
| POST | `/compute` | Yes | Yes | 5/10min | Trigger aggregation pipeline |
| GET | `/privacy` | No | No | 300/15min | Privacy policy/rules |

### Enrichment (`/api/spotify/enrichment/audio-features`)
| Method | Path | Auth | CSRF | Rate Limit | Description |
|--------|------|------|------|------------|-------------|
| POST | `/` | No | No | 60/min | Audio feature proxy |

## Deduplication Model

Records are deduplicated using a 64-character SHA-256 hash of `(ts, uri, track_name, artist_name)`. The unique constraint is on `(dataset_id, dedup_hash)`, allowing the same event to exist in multiple datasets. Cross-dataset dedup is handled via `DISTINCT ON (dedup_hash)` at query time.

## Aggregation Pipeline

The aggregation pipeline runs on an hourly scheduler (first run 30s after startup):

1. Check cohort size (users with consent + data)
2. If below minimum (5), skip with reason
3. For each of 7 snapshot types, compute metrics from consenting users' data
4. Apply privacy filters (rare item suppression, anti-fingerprinting)
5. Store results in aggregate_snapshots + aggregate_facts tables
6. Results served via API with 15-minute in-memory cache

## Development

- `pnpm run dev` — Start Express API + Vite dev server
- `pnpm test` — Run Vitest unit/integration tests
- `pnpm test:e2e` — Run Playwright E2E tests
- `pnpm run build` — Production build

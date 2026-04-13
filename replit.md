# Listentropy

## Overview
Listentropy is a privacy-first Spotify listening history analyzer. Users upload their Spotify Extended Streaming History ZIP and get deep analytics (eras, archetypes, network graphs, share cards) — all processed locally in-browser via Web Workers. Now evolving into a multi-user product with server-side auth, consent-gated persistence, and data management.

## Architecture
- **Frontend:** React 18 + TypeScript 5.9, Vite 7.3, Tailwind CSS 3.4
- **State:** Zustand (11 stores: data, lab, audio traits, spotify auth, server auth, consent, datasets, theme, session metrics, experience, upload)
- **Visualization:** Recharts, D3-force, Three.js / @react-three/fiber
- **Workers:** 2 dedicated Web Workers (data processing, lab analytics)
- **Backend:** Express API server on port 3001, proxied through Vite dev server
- **Database:** PostgreSQL (Replit-managed) with 8 tables: users, spotify_connections, sessions, consent_events, datasets, listening_events, enrichment_artifacts, provenance_metadata
- **Auth:** Server-side Spotify OAuth (PKCE + client secret) with HttpOnly session cookies
- **Privacy:** Consent-gated persistence with append-only consent events, granular opt-in/revocation, dedup-based merge
- **Data Model:** Per-dataset dedup (unique on dataset_id + dedup_hash), user-level dedup via DISTINCT ON, merge engine creates new datasets with full provenance trail
- **Ingestion:** ZIP export upload, Spotify API server-side sync, merge of multiple datasets
- **Routing:** react-router-dom v7 (/, /auth/spotify/callback, /share)

## Key Directories
```
src/
├── App.tsx                     # Router shell
├── app/DashboardApp.tsx        # Main app shell
├── components/                 # React components (views, upload, layout, share, charts, graph, labs, consent)
├── store/                      # Zustand stores
├── lib/                        # Core logic (types, processor, parser, spotify-auth, audio-traits)
├── workers/                    # Web Workers
├── features/                   # Plugin system
└── themes/                     # Theme engine
server/
├── index.ts                    # Express server entry point
├── db.ts                       # PostgreSQL connection pool + migrations
├── crypto.ts                   # Encryption/hashing utilities
├── middleware.ts               # Auth middleware (requireAuth, requireCsrf, optionalAuth)
├── parser.ts                   # Server-side ZIP parser (reuses client logic patterns)
├── tsconfig.json               # Server TypeScript config
└── routes/
    ├── auth.ts                 # Spotify OAuth + session management routes
    ├── datasets.ts             # Dataset upload, consent, data management routes
    └── enrichment.ts           # Audio feature enrichment proxy
api/
└── spotify/enrichment/         # Legacy serverless enrichment proxy (preserved)
docs/                           # Architecture docs
tests/                          # E2E (Playwright) + fixtures
```

## Development
- **Package manager:** pnpm
- **Dev server:** `pnpm run dev` (starts both Express API on 3001 and Vite on 5000)
- **Frontend only:** `pnpm run dev:frontend` (Vite only)
- **Server only:** `pnpm run dev:server` (Express with tsx watch)
- **Tests:** `pnpm test` (Vitest), `pnpm test:e2e` (Playwright)
- **Build:** `pnpm run build` (tsc + vite build)

## API Routes
- `GET /api/health` — Health check
- `GET /api/auth/spotify/login` — Initiate Spotify OAuth
- `GET /api/auth/spotify/callback` — OAuth callback (token exchange, session creation)
- `GET /api/auth/me` — Current user profile + CSRF token
- `POST /api/auth/logout` — End session
- `POST /api/auth/refresh` — Refresh Spotify access token
- `POST /api/auth/spotify/disconnect` — Revoke Spotify connection (requires CSRF)
- `DELETE /api/auth/account` — Delete account and all data (requires CSRF)
- `GET /api/datasets/consent` — Get current consent state
- `POST /api/datasets/consent` — Record consent event (requires CSRF)
- `POST /api/datasets/upload` — Upload Spotify export ZIP (requires CSRF, consent)
- `GET /api/datasets` — List user's datasets
- `DELETE /api/datasets/:id` — Delete a dataset and its events (requires CSRF)
- `GET /api/datasets/events` — Paginated listening events query
- `POST /api/spotify/enrichment/audio-features` — Audio feature enrichment proxy

## Database Schema
- `users` — User accounts (Spotify identity)
- `spotify_connections` — Encrypted Spotify tokens
- `sessions` — Server-side session management
- `consent_events` — Append-only consent audit trail
- `datasets` — Uploaded export metadata with provenance
- `listening_events` — Normalized stream records with SHA-256 dedup

## Environment Variables
- `SPOTIFY_CLIENT_ID` — Spotify app client ID (backend)
- `SPOTIFY_CLIENT_SECRET` — Spotify app client secret (backend)
- `SPOTIFY_REDIRECT_URI` — OAuth callback URL (defaults to `https://$REPLIT_DEV_DOMAIN/api/auth/spotify/callback`)
- `ENCRYPTION_KEY` — AES encryption key for token storage (Replit Secret)
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `VITE_SPOTIFY_CLIENT_ID` — Spotify client ID (frontend, for legacy PKCE enrichment)
- `VITE_SPOTIFY_REDIRECT_URI` — Legacy OAuth callback URL
- `SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE` — Rate limit override (default: 60)

## Architecture Documents
- `docs/audit.md` — Full codebase audit
- `docs/target-architecture.md` — Target architecture for multi-user evolution

## Privacy Model
- Local-only processing is the default path (no forced server persistence)
- Server-side persistence requires explicit consent dialog before first upload
- Three consent types: persist_history, persist_enrichment, aggregate_analytics
- Consent events are append-only (audit trail preserved)
- Users can delete individual datasets or full account at any time
- Disconnecting Spotify preserves uploaded export data
- Dedup via SHA-256 hash of (ts, uri, track_name, artist_name) — safe merge across uploads

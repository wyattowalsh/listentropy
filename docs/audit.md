# Listentropy — Codebase Audit

_Generated: 2026-04-13_

---

## 1. Executive Summary

Listentropy is a privacy-first, local-first Spotify listening history analyzer built as a Vite + React SPA. Users upload their Spotify Extended Streaming History ZIP, and all processing happens in-browser via Web Workers. The app produces deep analytics (eras, archetypes, graph networks, share cards) without sending listening data to any server.

The only server-side component is a single Vercel-style serverless function (`api/spotify/enrichment/audio-features.ts`) that proxies Spotify API requests using server-held Client Credentials, enabling audio feature enrichment without requiring user login.

**Current deployment target:** Vercel (static SPA + serverless function). Migrated to Replit for development.

---

## 2. Frontend Architecture

### Stack
- **Framework:** React 18 + TypeScript 5.9
- **Build:** Vite 7.3 with code-splitting via `manualChunks`
- **Styling:** Tailwind CSS 3.4 with custom theme engine (CSS variable injection)
- **Routing:** react-router-dom v7 (3 routes: `/`, `/auth/spotify/callback`, `/share`)
- **State:** Zustand stores (8 stores, no middleware persistence)
- **Visualization:** Recharts, D3-force, Three.js / @react-three/fiber
- **Workers:** 2 dedicated Web Workers for data processing and lab analytics

### Component Structure
```
src/
├── App.tsx                    # Router shell
├── app/DashboardApp.tsx       # Main app shell (idle/parsing/ready/error states)
├── components/
│   ├── views/                 # Top-level view panels (lazy-loaded)
│   ├── upload/                # DropZone, ParseProgress
│   ├── layout/                # Header, TabNav, ViewContainer
│   ├── share/                 # ShareStudio, story cards
│   ├── charts/                # Visualization components
│   ├── graph/                 # Universe 2D/3D network
│   ├── eras/                  # Era visualization
│   ├── labs/                  # Xenolab UI
│   ├── lab-scenes/            # Advanced visualization scenes
│   ├── spotify/               # OAuth callback page
│   └── ui/                    # Radix-based primitives
├── store/                     # Zustand stores
├── lib/                       # Core logic, parsers, processors
├── workers/                   # Web Workers
├── features/                  # Plugin system
└── themes/                    # Theme definitions
```

### Strengths
- Clean separation of concerns between views, stores, and processing logic
- Lazy-loaded views with error boundaries
- Comprehensive type system (1,227-line types.ts)
- Modular processing pipeline with stage provenance tracking
- Plugin system architecture (`PluginManifest`)
- Accessibility considerations (ARIA labels, semantic headings, keyboard navigation)

### Weaknesses
- No loading/skeleton states for many dashboard sections
- No persistent user preferences (theme resets on reload unless stored in localStorage)
- DashboardApp.tsx mixes routing, state management, and UI concerns in one component
- No code-level separation between "public landing" and "authenticated experience"

---

## 3. Auth Flow

### Current State
Spotify OAuth with PKCE is implemented but used **only for optional enrichment**, not for user identity/authentication.

### Flow
1. User clicks "Connect Spotify" in the SpotifyConnectCard (inside Xenolab)
2. PKCE verifier + state stored in `sessionStorage`
3. Redirect to Spotify `/authorize` endpoint
4. Callback at `/auth/spotify/callback` exchanges code for tokens
5. Tokens stored in `sessionStorage` (not `localStorage`)
6. Tokens used for audio feature enrichment and artist neighborhood data

### Token Lifecycle
- Access token with expiry tracking
- Automatic refresh via `ensureValidAccessToken()` (60s safety margin)
- Manual token fallback mode (paste a token, 12h TTL)
- Disconnect clears all stored auth state

### Security Assessment
- **PKCE implementation:** Correct — uses SHA-256 challenge, cryptographic random verifier
- **State parameter:** Present and validated on callback
- **Token storage:** `sessionStorage` only — good for preventing cross-tab leakage, but means session dies on tab close
- **Refresh tokens in sessionStorage:** Acceptable for current enrichment-only use, but would need server-side storage for a persistent auth model
- **No CSRF beyond OAuth state:** Acceptable since there's no server-side session to protect
- **Client ID exposed via VITE_ env var:** Expected for PKCE public client flow

### Risks for Multi-User Evolution
- Tokens are client-only; there's no server-side session concept
- No user identity model — OAuth is used purely for API access
- No concept of "logged in" vs "logged out" at the app level
- `sessionStorage` tokens don't persist across tabs/sessions
- No revocation handling beyond manual disconnect

---

## 4. Backend / API Routes

### Single Endpoint
`POST /api/spotify/enrichment/audio-features`

### Functionality
- Accepts `{ trackIds: string[] }` as JSON body
- Uses server-side Spotify Client Credentials (env: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`)
- Fetches audio features from Spotify API
- Returns normalized features to the client
- In-memory rate limiting (60 req/min per IP, sliding window)
- In-memory token caching with expiry safety margin

### Security Assessment
- **Input validation:** Basic — checks for string array, no length limits in validation (though the client caps at 5,000 tracks)
- **Rate limiting:** IP-based, in-memory — resets on cold start, spoofable via `x-forwarded-for`
- **Client credentials:** Properly server-side, not exposed to frontend
- **No authentication required:** By design — enables enrichment without login
- **CORS:** Not explicitly configured (relies on Vercel defaults)

### Risks
- In-memory rate limiting is volatile — resets on serverless cold starts
- No abuse detection beyond simple rate limiting
- No request size limits enforced at the API level
- `x-forwarded-for` header trust without validation

---

## 5. Data Parsing / Workers / Enrichment

### Upload Pipeline
1. User drops `.zip` file on DropZone
2. `parser.ts` validates ZIP (256MB limit, 500 entry limit, 2M record limit)
3. Files matching `Streaming_History_Audio_*.json` are extracted
4. Records coerced, validated, sanitized (PII `ip_addr` stripped)
5. Sorted chronologically

### Processing Pipeline (`processor.ts`)
Multi-stage sequential pipeline:
```
artists → tracks → albums → time-series → sessions → summary →
taste → archetypes → platform → graph → gems → eras → skip → context
```
Each stage produces typed output and records provenance (duration, output count).

### Workers
- **dataProcessor.worker.ts:** Handles ZIP parsing + full processing pipeline
- **labAnalytics.worker.ts:** Runs Xenolab modules (sequence motifs, chronotype drift, etc.)
- Worker client manages request queuing and timeouts

### Enrichment (Audio Traits)
- Dual-path provider: proxy first, user token fallback
- Batched requests (100 IDs per chunk, 5,000 cap)
- Normalization to `AudioTraitVector` format
- Coverage tracking and quality metrics
- Artist neighborhood enrichment (genres, related artists) — requires user token

### Strengths
- Robust input validation with size/count limits
- PII stripping (ip_addr removed during sanitization)
- Worker-based processing keeps UI responsive
- Dual enrichment paths (anonymous proxy + authenticated)
- Comprehensive provenance tracking

### Weaknesses
- All processing is ephemeral — data lost on page reload
- No incremental processing — full re-parse on timezone change
- No server-side ingestion path
- Enrichment data not persisted across sessions

---

## 6. State Management

### Stores

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `useDataStore` | Main dataset, mode, progress | None |
| `useLabStore` | Xenolab modules, compare workspace | None |
| `useAudioTraitStore` | Audio feature snapshots | None |
| `useSpotifyAuthStore` | OAuth tokens, connection status | sessionStorage |
| `useThemeStore` | Visual theme selection | localStorage |
| `useExperienceStore` | Feature discovery tracking | None |
| `useSessionMetricsStore` | Local usage metrics | None |
| `useFilterStore` | View filters | None |

### Assessment
- Clean store boundaries with minimal cross-store coupling
- `useAudioTraitStore` reads from `useSpotifyAuthStore` — acceptable cross-reference
- No global event bus or pub/sub — stores are independent
- No derived/computed store layer — computations happen at component level
- No persistence middleware — state is ephemeral by design

### Risks for Multi-User Evolution
- `useDataStore` has no concept of user ownership
- No distinction between "my data" and "shared/aggregate data"
- Zustand stores are purely client-side — would need a server-sync layer
- Compare workspace (snapshot library) is in-memory only

---

## 7. Tests / CI

### Test Infrastructure
- **Unit/Integration:** Vitest + @testing-library/react + jsdom
- **E2E:** Playwright (chromium, webkit-desktop, webkit-mobile)
- **Coverage:** @vitest/coverage-v8 with coverage gates
- **Fixtures:** Generated synthetic fixtures with policy enforcement

### Test Coverage Areas
- Store tests (auth, lab, theme, experience, audio traits)
- Component tests (DropZone, SharePage, TabNav, Header, ModuleResultCard, etc.)
- Auth flow tests (OAuth, PKCE, storage)
- Proxy contract tests
- E2E: smoke, upload errors, universe/eras, responsive, accessibility, xenolab
- UI/UX audit specs (primary, advanced, responsive)

### Strengths
- Comprehensive E2E coverage including accessibility (`@axe-core/playwright`)
- Performance budget enforcement (`scripts/perf/check-budgets.mjs`)
- Coverage gates preventing regression
- Fixture generation and policy enforcement
- Multiple browser/viewport test projects

### Weaknesses
- No API integration tests (the proxy function is tested via contract tests only)
- No auth flow E2E tests (OAuth redirect is hard to test)
- No data deletion/privacy tests (nothing to delete currently)
- No load/stress testing

---

## 8. Deployment / Runtime Assumptions

### Current Configuration
- **vercel.json:** SPA catch-all rewrite + security headers (X-Content-Type-Options, Referrer-Policy)
- **API function:** Expected to run as Vercel serverless function
- **Static assets:** Vite build output
- **Environment:** Node.js 20

### Assumptions That Must Change for Multi-User
- No database — need PostgreSQL or similar
- No server-side session management
- No persistent API server — only a single serverless function
- No WebSocket/SSE for real-time updates
- No file storage for uploaded ZIPs
- No background job processing for aggregation
- No health checks or monitoring

---

## 9. Performance Constraints

- ZIP size limit: 256MB
- Record limit: 2,000,000
- Chunk size warning: 900KB (Vite)
- Audio feature cap: 5,000 unique tracks per enrichment request
- Web Worker thread isolation for heavy computation
- Lazy-loaded views to minimize initial bundle
- Manual chunk splitting (vendor-react, vendor-recharts, vendor-three, etc.)

---

## 10. Security / Privacy Risks

### Current Strengths
- PII stripping (`ip_addr` removed during parsing)
- Local-first processing — listening data never leaves the browser
- PKCE OAuth — no client secret exposed
- sessionStorage for auth tokens (no cross-tab leakage)
- Privacy-level controls on share payloads (aggregate vs profiled)

### Current Risks
1. **No CSP headers** — relying on Vercel defaults
2. **Rate limiting is in-memory** — volatile on cold starts
3. **IP-based rate limiting trusts x-forwarded-for** — spoofable
4. **No request body size limits** on the API endpoint
5. **Manual token mode** allows arbitrary token input with 12h TTL
6. **Share payloads** encode user listening data in URL fragments — fragments are not sent in HTTP referrer headers, but can be captured by client-side scripts on the target page
7. **No audit logging** for API access or enrichment requests

### New Risks Introduced by Multi-User Evolution
1. **Cross-user data leakage** — must ensure strict user-scoping on all queries
2. **Token storage migration** — moving from sessionStorage to server-side DB
3. **Upload security** — server-side ZIP processing introduces new attack surface
4. **Aggregate re-identification** — small cohorts could expose individual behavior
5. **Consent model** — must distinguish local-only from server-persisted data
6. **Deletion propagation** — must cascade through derived data and aggregates

---

## 11. Current Product / UX Inconsistencies

1. **No landing page for unauthenticated users** — app immediately shows upload prompt
2. **Spotify connection is buried** — accessible only through Advanced Tools > Xenolab
3. **No onboarding flow** — users must already know about Spotify data exports
4. **Share flow is separate from dashboard** — no inline sharing from analytics views
5. **"Advanced tools" toggle** is a single button with no progressive disclosure
6. **No account/settings page** — theme and timezone are inline controls
7. **Demo mode** loads from a static JSON file — no interactive preview
8. **Error states are minimal** — generic error messages without recovery suggestions
9. **Privacy messaging** says "all processing happens locally" — must update if server persistence is added
10. **No clear data lifecycle communication** — users don't know when/how data is cleared

---

## 12. Recommended Target Architecture

See `docs/target-architecture.md` for the full proposal.

### Key Architectural Shifts
1. **Add persistent backend** — Express/Hono server with PostgreSQL
2. **Elevate Spotify OAuth to identity** — transform enrichment auth into sign-in
3. **Hybrid local+server model** — preserve local-first processing, add opt-in server persistence
4. **User-scoped data layer** — all persisted data tied to authenticated user
5. **Aggregate analytics pipeline** — privacy-preserving cross-user metrics
6. **Consent-first UX** — explicit opt-in before any server-side data storage

### Migration Strategy
- **Phase 1:** Backend foundation + Spotify auth as identity
- **Phase 2:** Data persistence with consent + export ingestion
- **Phase 3:** Aggregate analytics engine
- **Phase 4:** Home dashboard + UX overhaul
- **Phase 5:** Security hardening + testing + documentation

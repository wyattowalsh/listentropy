# Listentropy

## Overview
Listentropy is a privacy-first Spotify listening history analyzer. Users upload their Spotify Extended Streaming History ZIP and get deep analytics (eras, archetypes, network graphs, share cards) — all processed locally in-browser via Web Workers.

## Architecture
- **Frontend:** React 18 + TypeScript 5.9, Vite 7.3, Tailwind CSS 3.4
- **State:** Zustand (8 stores: data, lab, audio traits, spotify auth, theme, session metrics, and 2 additional stores)
- **Visualization:** Recharts, D3-force, Three.js / @react-three/fiber
- **Workers:** 2 dedicated Web Workers (data processing, lab analytics)
- **Backend:** Single API endpoint for Spotify audio feature enrichment proxy
- **Database:** None (local-first, all processing in browser)
- **Routing:** react-router-dom v7 (/, /auth/spotify/callback, /share)

## Key Directories
```
src/
├── App.tsx                     # Router shell
├── app/DashboardApp.tsx        # Main app shell
├── components/                 # React components (views, upload, layout, share, charts, graph, labs)
├── store/                      # Zustand stores
├── lib/                        # Core logic (types, processor, parser, spotify-auth, audio-traits)
├── workers/                    # Web Workers
├── features/                   # Plugin system
└── themes/                     # Theme engine
api/
└── spotify/enrichment/         # Serverless enrichment proxy
docs/                           # Architecture docs
tests/                          # E2E (Playwright) + fixtures
```

## Development
- **Package manager:** pnpm
- **Dev server:** `pnpm run dev` (Vite on port 5000)
- **Tests:** `pnpm test` (Vitest), `pnpm test:e2e` (Playwright)
- **Build:** `pnpm run build` (tsc + vite build)

## Environment Variables
- `VITE_SPOTIFY_CLIENT_ID` — Spotify app client ID (frontend, for OAuth PKCE)
- `VITE_SPOTIFY_REDIRECT_URI` — OAuth callback URL (optional, defaults to /auth/spotify/callback)
- `SPOTIFY_CLIENT_ID` — Spotify app client ID (backend, for client credentials proxy)
- `SPOTIFY_CLIENT_SECRET` — Spotify app client secret (backend, for client credentials proxy)
- `SPOTIFY_ENRICHMENT_PROXY_RATE_LIMIT_PER_MINUTE` — Rate limit override (default: 60)

## Architecture Documents
- `docs/audit.md` — Full codebase audit
- `docs/target-architecture.md` — Target architecture for multi-user evolution

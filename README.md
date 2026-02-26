# Listentropy

Your music. Your data. Your story.

Listentropy is a privacy-first Spotify listening explorer that runs 100% in your browser. Upload your Spotify Extended Streaming History `.zip` and get deep analytics, behavior insights, share cards, and visualizations with no backend.

## Highlights

- Fully client-side data processing (no user data leaves the browser).
- Adaptive dual-path UX: guided mode (high-signal defaults) and full mode (full analytics surface).
- 12 analytics views: overview, charts, timeline, clock/calendar, artist deep dive, habits, context intelligence, eras, share studio, universe graph, taste DNA, and extras.
- Xenolab (Train A) Lab tab for deferred, on-demand analytics modules and experimental visual scenes.
- Share Studio with a deterministic 14-card deck, presets, PNG/ZIP export, copy-to-clipboard, and versioned share links.
- Theme system with four visual modes, shared tokens, and chart palette propagation.
- Worker-based processing pipeline with stage progress, diagnostics metadata, and worker-backed timezone reprocessing.
- Local-only session KPI funnel metrics (no external telemetry) for share completion rate tracking.

## How To Get Your Spotify Export ZIP

You need the **Extended Streaming History** export from Spotify.

1. Go to [Spotify Account Privacy](https://www.spotify.com/account/privacy/) and sign in.
2. In the data controls section, request **Extended Streaming History**.
3. Wait for Spotify to prepare your export (delivery time varies).
4. Download the `.zip` from Spotify's email/link.
5. Upload the original `.zip` directly into Listentropy.

Required contents inside the zip include files like:

- `Streaming_History_Audio_YYYY-YYYY_N.json`
- `Streaming_History_Video_YYYY-YYYY.json` (optional)

### Export Troubleshooting

- If your archive does not include `Streaming_History_Audio_*.json`, request **Extended Streaming History** again.
- If the download link expires, request a new export from Spotify.
- Upload the original zip, not an extracted folder.

## Privacy Model

- `ip_addr` is stripped during parse and never persisted in processed records.
- No analytics trackers or telemetry beacons are included.
- No user data is sent to external services.
- Optional Spotify API token (Taste DNA enrichment) is stored in `sessionStorage` only.
- Theme preference and experience mode (`guided`/`full`) are stored in `localStorage`.
- Session KPI events are kept in-memory and can be exported manually as JSON.
- Xenolab deferred module results are cached in-memory per dataset fingerprint and are not persisted across refreshes.

## Xenolab (Train A)

Xenolab is the **Lab** tab for deferred, privacy-first analytics experiments and visual scenes.

Train A includes:

- A dedicated deferred analytics worker (`labAnalytics.worker`) separate from the core processing worker.
- An on-demand module gallery (no heavy auto-run by default).
- An explainability panel with confidence and provenance metadata for module results.
- A scene gallery with lightweight Train A visuals (Intent Sankey, Chronomap Ridgelines, Entropy Phase Portrait, Universe Time Slider).
- Typed `unsupported` placeholder behavior for future modules/scenes (shown as coming soon instead of crashing).

See:

- `docs/xenolab-architecture.md`
- `docs/xenolab-module-authoring.md`
- `docs/xenolab-release-notes-train-a.md`

## Share Behavior

- Share links encode aggregate payloads in URL hash (`/share#...`).
- Payload schema is versioned (`v4`) with backward-compatible decode/upgrade for `v1`/`v2`/`v3`.
- Share presets (Headline Stats / Detailed Stats / Anonymous Highlights) preconfigure card selection and copy style.
- Payloads preserve timezone mode semantics to keep sender/receiver story timing aligned.
- Rich-share mode requires explicit user confirmation.
- Optional anonymization redacts top artist/track names.
- Native Web Share button appears only in secure contexts that support `navigator.share`.

## Performance Constraints

CI enforces performance budgets after build:

- Entry JS gzip: `<= 450 KiB`
- Largest async chunk gzip: `<= 300 KiB`
- Worker chunk gzip: `<= 150 KiB`
- Regression tolerance: max `+5%` from baseline unless explicitly overridden

### Chunk Warning Policy

Vite chunk-size warnings are treated as local development signal only. CI perf budgets (`pnpm perf:budget`) are the release gate and source of truth. If Vite major behavior changes, update chunking strategy and regenerate perf baselines together.

## Coverage and Quality Gates

CI requires:

- lint
- typecheck
- unit tests with coverage
- coverage gate
- build
- perf budget gate
- Playwright e2e smoke checks (`smoke.spec.ts` and `xenolab.spec.ts` on Chromium)

Coverage gates:

- Global line coverage `>= 80%`
- Global branch coverage `>= 70%`
- `src/lib/**` line coverage `>= 85%`

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install and Run

```bash
pnpm install
pnpm dev
```

### Full Verification

```bash
pnpm check
```

### Useful Scripts

```bash
pnpm fixtures:generate      # generate synthetic fixture JSON
pnpm hygiene:snapshot       # write baseline snapshot under docs/baseline
pnpm hygiene:fixtures       # enforce fixture policy
pnpm test:coverage          # run unit tests with coverage output
pnpm coverage:gate          # enforce coverage thresholds
pnpm perf:budget            # enforce build size budgets
SPOTIFY_ZIP_PATH=/abs/path.zip pnpm audit:real-data
pnpm perf:large-fixture        # local synthetic 50k-record process/toggle benchmark
```

### Real-Data Audit (Local Only)

Run a full local audit against your own Spotify export zip:

```bash
SPOTIFY_ZIP_PATH=/absolute/path/to/my_spotify_data.zip pnpm audit:real-data
```

The audit validates:

- zip structure and history files
- upload and parse flow
- rendering across all top-level tabs
- guided-mode + full unlock tab behavior
- Context Intelligence rendering and key section presence
- weekly timeline ISO-like labels (not collapsed to W01..W06)
- timezone toggle behavior (`local`/`utc`)
- Universe stability (graph/fallback, no generic crash card)
- share preset flows, share link generation, and `/share` route rendering
- backward compatibility for legacy share links
- invalid hash handling (`Invalid Share Link`)
- zero console errors/warnings/pageerrors

Machine-readable output:

- `test-results/real-data-audit-report.json`
- `test-results/real-data-context-report.json`

See also:

- `docs/real-data-audit.md`
- `docs/perf-regression-triage.md`

## Fixture Policy

- Only synthetic or sanitized fixtures are allowed under `tests/fixtures/`.
- Personal Spotify exports are forbidden in tracked/pending source.
- `.zip` fixture artifacts are blocked by policy checks.

## Tech Stack

- Vite 7 + React 18 + TypeScript
- Tailwind CSS + local UI primitives
- Zustand
- Recharts + d3-force + Three.js
- JSZip + html-to-image
- Vitest + Playwright

## Deployment

- Static build output: `dist/`
- CI workflow available in `.github/workflows/ci.yml`
- Vercel deploy workflow in `.github/workflows/deploy-vercel.yml`
- GitHub Pages deploy workflow in `.github/workflows/deploy-github-pages.yml` (optional free static hosting)

### Recommended Production Setup (Free-to-Operate)

- Host on **Vercel Hobby**
- Use **Cloudflare for DNS only** (gray-cloud records)
- Do **not** proxy Vercel through Cloudflare unless you intentionally want that tradeoff

Guide:

- `docs/deploy-vercel-cloudflare-dns-only.md`

## Notes on Vite Versioning

This codebase currently targets Vite 7 chunking behavior. If upgrading to a new Vite major version, rerun perf baselines and revalidate manual chunk strategy before release.

## Share Payload Compatibility

- `v1`: legacy payloads still decode
- `v2`: backward-compatible decode retained
- `v3`: backward-compatible decode retained
- `v4`: current encoder default (presets, selected cards, theme key, timezone mode)

## Contributing

Contributions are welcome. Open an issue for larger architectural changes before submitting a PR.

## License

MIT

## Trademark Notice

Listentropy is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Spotify. Spotify is a trademark of Spotify AB.

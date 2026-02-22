# Performance Regression Triage

Listentropy has two performance checks:

- CI budget check (`pnpm perf:budget`) for built asset sizes
- Local synthetic benchmark (`pnpm perf:megafixture`) for processor latency

## 1) Build Size Budget Gate

```bash
pnpm perf:budget
```

This validates gzip size budgets for:

- entry chunk
- largest async chunk
- worker chunk

If this fails:

1. Inspect recent dependencies and imports added to `src/app/*` or shared libraries.
2. Verify lazy-load boundaries for heavy views remain intact.
3. Check if a large library moved from async to eagerly loaded path.
4. Re-run `pnpm build` and compare generated chunk names/sizes in `dist/assets/`.

## 2) Processor Latency Benchmark (Local)

```bash
pnpm perf:megafixture
```

This runs `src/lib/perf-megafixture.test.ts` and logs timings for:

- initial processing (`timezoneMode: 'local'`)
- timezone reprocessing/toggle (`timezoneMode: 'utc'`)

Current benchmark shape:

- synthetic dataset size: `50,000` records
- output line: `[perf-megafixture] local=...ms utc-toggle=...ms records=50,000`

## Triage Checklist

1. Confirm `trackUriIndex`/other processor indexes are still reused instead of repeated `find/filter` scans.
2. Check for new render-time computations in heavy views (`ShareStudio`, `TasteDNA`, `ArtistDeepDive`, `ListeningHabits`).
3. Confirm timezone changes still use the worker path (not synchronous main-thread `processRecords` calls).
4. Review changes to context analytics or share payload generation for accidental `O(n^2)` loops.
5. Re-run benchmark twice to distinguish cold-start noise from persistent regressions.

## Real-Data Cross-Check

For a browser-level sanity check with your own data:

```bash
SPOTIFY_ZIP_PATH=/absolute/path/to/my_spotify_data.zip pnpm audit:real-data
```

Review `timingsMs` in `/Users/ww/dev/projects/listentropy/test-results/real-data-context-report.json`, especially:

- `weeklyTimeline`
- `timezoneToggle`
- `tabTraversal`

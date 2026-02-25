# Xenolab Train A Release Notes (Draft)

## Added

- New top-level `Lab` tab for deferred, privacy-first analytics experiments.
- Xenolab contracts in `src/lib/types.ts` (module/scene manifests, result types, worker protocol, explainability metadata).
- Dataset metadata on core processed output:
  - `modelVersion`
  - `datasetIdentity` (including deterministic fingerprint)
- Dedicated Xenolab worker (`labAnalytics.worker`) and worker client.
- Xenolab in-memory result cache/store (`useLabStore`) with per-dataset fingerprint caching and a performance queue.
- Initial Train A module implementations:
  - Sequence Motifs
  - Ritual Detector
  - Chronotype Drift
  - Stability vs Chaos
  - Novelty Economics
  - Era Microshifts
  - Counterfactuals
- Initial Train A scenes:
  - Intent Sankey
  - Chronomap Ridgelines
  - Entropy Phase Portrait
  - Universe Time Slider (heuristic version)
- Explainability panel with confidence/provenance surfacing.
- Placeholder manifests for future modules and scenes (`comingSoon`).

## Behavior / UX Notes

- Xenolab modules do not auto-run by default.
- Deferred results are cached in-memory and scoped to the current dataset fingerprint.
- Unsupported or future modules return typed `unsupported` states instead of crashing.

## Quality / Validation

Validated during implementation:

- `pnpm typecheck`
- targeted Xenolab + pipeline Vitest suite
- `pnpm build`
- `pnpm perf:budget`
- `pnpm lint`

## Known Limitations (Train A)

- No second-dataset compare workspace yet.
- No forecast/enrichment modules yet.
- Scene implementations are intentionally lightweight and heuristic-first.
- No Train A-specific visual regression suite yet.
- No expanded share payload support for Xenolab scenes/cards yet.

## Next Candidates (Train B)

- Local compare workspace and second dataset ingest
- Compare engine and era-vs-era comparisons
- Forecast-lite and recurrence heuristics
- Optional file/token enrichments (opt-in only)

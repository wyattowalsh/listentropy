# Xenolab Architecture (Train A)

## Purpose

Xenolab is Listentropy's deferred-compute analytics lab. It provides experimental, high-signal analyses and visual scenes without slowing down the core upload-to-dashboard path.

## Privacy Model

- Xenolab runs entirely client-side.
- Module compute happens in a dedicated Web Worker (`src/workers/labAnalytics.worker.ts`).
- Results are cached in-memory only (Zustand store) and are not persisted across refreshes.
- No external network requests are required for Train A modules/scenes.
- Optional future enrichments (for example Spotify audio features) remain explicit opt-in and are not part of Train A runtime behavior.

## Core vs Deferred Split

### Core pipeline
The existing core processor (`src/lib/processor.ts`) still computes the standard `ProcessedDataModel`. Train A adds only two metadata fields:

- `modelVersion`
- `datasetIdentity`

### Deferred compute
Xenolab modules run after core processing:

1. `LabWorkbench` builds a `LabDatasetSnapshot` from `ProcessedDataModel`.
2. `useLabStore.runModule(...)` sends `lab:run-module` to the Xenolab worker.
3. The worker runs a module runner (`src/lib/labs/modules/index.ts`).
4. A typed `LabModuleResult` is returned with confidence and provenance.
5. The result is cached by `datasetIdentity.fingerprint + moduleId`.

## Key Files

- `src/lib/types.ts`: Xenolab contracts, payload types, worker protocol types.
- `src/lib/labs/registry.ts`: module/scene manifests + snapshot builder.
- `src/lib/labs/worker-client.ts`: worker client and fallback execution path.
- `src/workers/labAnalytics.worker.ts`: deferred worker entrypoint.
- `src/store/useLabStore.ts`: cache, queue, explainability state.
- `src/components/views/LabWorkbench.tsx`: Xenolab UI shell.
- `src/components/lab-scenes/*`: scene components.
- `src/lib/labs/modules/*`: deferred analytics modules.

## Explainability Contract (Mandatory)

Each implemented Xenolab module must return:

- `confidence`
- `provenance`
- `provenance.method`
- `provenance.assumptions[]`
- `provenance.warnings[]`

Method strings must explicitly identify heuristic/descriptive behavior to avoid false causal framing.

## Unsupported / Placeholder Modules

The registry may expose future modules/scenes as `comingSoon`. Running those module IDs returns a typed `unsupported` result instead of throwing.

## Performance Notes (Train A)

- The new Xenolab worker is separate from the existing data processing worker.
- Scenes are lazy-loaded through `SceneGallery` to keep the initial app shell smaller.
- Train A scenes use lightweight SVG-style rendering and avoid new heavy dependencies.

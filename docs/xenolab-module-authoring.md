# Xenolab Module Authoring (Train A Pattern)

## Goal

Add a new deferred analytics module without touching shared hotspots more than necessary.

## Module Contract Checklist

A Train A module should:

1. Accept a `LabDatasetSnapshot`
2. Return `LabModuleResult<TPayload>`
3. Include `confidence`
4. Include `provenance`
5. Use descriptive/heuristic wording in `provenance.method`
6. Handle sparse data with `unsupported` or low-confidence warnings
7. Sort output deterministically for stable UI/tests

## Suggested File Layout

Add modules under a category folder:

- `src/lib/labs/modules/<category>/<module-name>.ts`
- `src/lib/labs/modules/<category>/index.ts`
- `src/lib/labs/modules/<category>/<module-name>.test.ts`

Common helpers live in:

- `src/lib/labs/modules/utils.ts`

## Registration Steps

1. Add a typed payload interface in `src/lib/types.ts` (or extend the payload map if already present).
2. Implement the module runner in `src/lib/labs/modules/...`.
3. Export the runner from the category index.
4. Register dispatch in `src/lib/labs/modules/index.ts`.
5. Add/enable a manifest in `src/lib/labs/registry.ts`.
6. If the module powers a scene, add a scene manifest and UI integration later.

## Registry Guidelines

Keep manifests explicit and descriptive:

- `perfTier`: `light`, `medium`, or `heavy`
- `dependsOnCore`: exact core fields needed
- `comingSoon`: set for placeholders not yet implemented
- `featured`: use for modules that should appear near the top of the gallery

## Confidence and Provenance Examples

Good method labels:

- `descriptive heuristic motif mining over session-local windows`
- `descriptive heuristic phase-space scoring over monthly behavior`

Avoid:

- `predicted causality`
- `proved behavioral cause`

## Testing Expectations

Minimum coverage for a new module:

1. Returns typed result and status
2. Includes confidence + provenance
3. Sparse-data behavior (`unsupported` or warnings)
4. Deterministic output ordering
5. No NaN/Infinity values

## Performance Guidance

- Prefer lightweight recomputation on `LabDatasetSnapshot` instead of re-running the full core pipeline.
- Cap result list sizes for UI stability.
- Use simple heuristics first; improve later behind the same payload contract.

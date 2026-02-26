# Real-Data Audit Guide

Run a browser-level validation against a local Spotify export zip without committing any personal data.

## Command

```bash
SPOTIFY_ZIP_PATH=/absolute/path/to/my_spotify_data.zip pnpm audit:real-data
```

## What It Validates

- Zip presence, readability, and Spotify history file structure
- Upload + parse flow completes in browser
- Top-level tab traversal renders without crashes
- Guided-mode and full unlock flows render correctly
- Context Intelligence view headings render
- Weekly timeline labels look ISO-like (`YYYY-W##`) with realistic spread
- Timezone toggle works (`Local Time` / `UTC`)
- Share preset flow and `/share` route rendering
- Backward share decode (legacy payloads)
- Invalid share payload handling
- No console errors, warnings, or page errors

## Outputs

- `/Users/ww/dev/projects/listentropy/test-results/real-data-audit-report.json`
- `/Users/ww/dev/projects/listentropy/test-results/real-data-context-report.json`

## Example Fields (Context Report)

- `checks.weeklyTimelineSane`
- `checks.timezoneToggleWorks`
- `checks.sharePresetFlows`
- `checks.shareV2BackwardCompatible`
- `context.weeklyLabelsSample`
- `timingsMs.timezoneToggle`

## Notes

- The zip path is required at runtime (`SPOTIFY_ZIP_PATH`).
- The audit starts a local preview server and fails fast if port `4173` is occupied.
- No Spotify export data is persisted by the app; reports only include validation metadata and timings.

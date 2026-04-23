# Real-Data Audit Guide

Run a browser-level validation against a local Spotify export zip without committing any personal data.

## Command

```bash
SPOTIFY_ZIP_PATH=/absolute/path/to/my_spotify_data.zip pnpm audit:real-data
```

## What It Validates

- Zip presence, readability, and Spotify history file structure
- Upload + parse flow completes in browser and lands on the current `Dashboard` / `Share` shell
- Primary navigation renders and `Dashboard` shows `Overview Snapshot`
- Dashboard context summary renders (`Country context`)
- Advanced sections switch cleanly for `Artist Analysis`, `Music Universe Graph`, and `Xenolab`
- Timezone toggle works (`Local Time` / `UTC`)
- Share preset flow and `/share` route rendering
- Backward share decode (legacy payloads)
- Invalid share payload handling with the current recovery copy (`This link needs a refresh`)
- No console errors, warnings, or page errors

## Outputs

- `/Users/ww/dev/projects/listentropy/test-results/real-data-audit-report.json`
- `/Users/ww/dev/projects/listentropy/test-results/real-data-context-report.json`

## Example Fields (Context Report)

- `checks.advancedSectionsRendered`
- `checks.timezoneToggleWorks`
- `checks.sharePresetFlows`
- `checks.shareV2BackwardCompatible`
- `context.countryContextVisible`
- `timingsMs.timezoneToggle`

## Notes

- The zip path is required at runtime (`SPOTIFY_ZIP_PATH`).
- The audit starts a local preview server and fails fast if port `4173` is occupied.
- No Spotify export data is persisted by the app; reports only include validation metadata and timings.

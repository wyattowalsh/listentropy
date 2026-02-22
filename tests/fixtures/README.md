# Fixture Policy

This project enforces a strict fixture policy for privacy and reproducibility:

- Only synthetic or sanitized fixtures are allowed.
- Fixtures must live under:
  - `tests/fixtures/generated/`
  - `tests/fixtures/sanitized/`
- Personal Spotify export archives are forbidden in tracked or pending source.
- `.zip` files are disallowed for fixtures; use JSON-based fixture inputs.

Generate local synthetic fixtures with:

```bash
pnpm fixtures:generate
```

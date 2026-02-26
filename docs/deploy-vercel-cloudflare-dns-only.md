# Deploy on Vercel with Cloudflare DNS (DNS-Only)

This is the recommended "free-to-operate" production setup for Listentropy:

- **Vercel Hobby** hosts the static app
- **Cloudflare** manages DNS only (free plan)
- **No backend** required

## Deployment Model (This Repo)

This repo uses a split deployment model to avoid duplicate production deploys while keeping Vercel previews:

- **Vercel Git integration** handles preview deployments (PRs and `main` preview branch deploys)
- **GitHub Actions** handles production deployments to Vercel (`.github/workflows/deploy-vercel.yml`)
- **Cloudflare** manages DNS only (gray-cloud records)

Recommended domains for this setup:

- Production: `https://listentropy.w4w.dev`
- Stable preview (OAuth-capable): `https://preview.listentropy.w4w.dev`

Why the stable preview domain matters:

- Spotify OAuth redirect URIs must match exactly
- Random Vercel preview URLs are good for general QA, but not reliable for OAuth callback registration

## Architecture

- Cloudflare acts as the authoritative DNS provider
- Vercel serves the app and terminates TLS
- Cloudflare DNS records should be set to **DNS only** (gray cloud), not proxied

This avoids reverse-proxy caching/edge issues and keeps Vercel routing and security features intact.

## Vercel Project Setup (Preview First)

1. Push the repository to GitHub.
2. Import the repo into Vercel (Hobby plan is sufficient for a static/local-first app).
3. Use the default Vite build settings:
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Output directory: `dist`
4. Deploy once on the Vercel preview domain and confirm the app loads.
5. In Vercel project settings, set **Production Branch** to a dormant branch name (for example: `vercel-prod-disabled`).
   - This keeps Vercel Git integration active for previews, but prevents `main` from auto-producing a Vercel production deploy.
6. Assign a branch domain for `main`:
   - `preview.listentropy.w4w.dev` -> branch `main`
7. Keep Vercel Git integration enabled so PR branches continue to get previews.

## GitHub Repo Readiness (Before Enabling Production Deploys)

Configure branch protection for `main` (GitHub repository settings):

- Require pull requests before merge (if that matches your team flow)
- Require the `CI / quality` status check to pass
- Require branches to be up to date before merging

This ensures production deployments (which are triggered from successful `CI` runs) only happen from a green `main`.

## Production Deploy Workflow (GitHub Actions -> Vercel)

This repo includes a production deploy workflow at `.github/workflows/deploy-vercel.yml` that:

- triggers from a **successful `CI` workflow run**
- only deploys when the upstream CI event is a `push` to `main`
- checks out the exact tested commit SHA from the CI run
- runs `vercel pull`, `vercel build --prod`, and `vercel deploy --prebuilt --prod`

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Custom Domains + Cloudflare DNS (DNS-Only)

1. In Vercel project settings, add your custom domains:
   - `listentropy.w4w.dev` (production)
   - `preview.listentropy.w4w.dev` (stable preview)
2. In Cloudflare DNS, create the records Vercel requests for each hostname.
   - For subdomains like `listentropy` / `preview`, this is typically a `CNAME` pointing to the Vercel target shown in the Vercel UI.
3. Set those records to **DNS only** (gray cloud).
4. Wait for Vercel domain verification and TLS certificate issuance.
5. Validate HTTPS for both domains before testing Spotify OAuth.

## Cloudflare DNS Mode (Important)

- **Use**: DNS only (gray cloud)
- **Avoid**: Proxied (orange cloud) in front of Vercel unless you have a specific reason and are prepared to debug cache/proxy behavior

## Spotify OAuth (PKCE) Setup

Listentropy supports optional Spotify OAuth PKCE for local-first Taste DNA enrichment.

Create (or reuse) a Spotify app and register these exact redirect URIs:

- `https://listentropy.w4w.dev/auth/spotify/callback`
- `https://preview.listentropy.w4w.dev/auth/spotify/callback`

Notes:

- Redirect URIs must match exactly (scheme + host + path).
- Do not rely on random Vercel preview URLs for OAuth callbacks.
- The app is browser-only PKCE flow: store only the **Spotify Client ID** in Vercel env vars (not a client secret).

## Vercel Environment Variables (Required for OAuth)

Set Vercel env vars explicitly so preview and production use deterministic callback URLs.

Preview environment:

- `VITE_SPOTIFY_CLIENT_ID=<spotify-client-id>`
- `VITE_SPOTIFY_REDIRECT_URI=https://preview.listentropy.w4w.dev/auth/spotify/callback`

Production environment:

- `VITE_SPOTIFY_CLIENT_ID=<spotify-client-id>`
- `VITE_SPOTIFY_REDIRECT_URI=https://listentropy.w4w.dev/auth/spotify/callback`

Important:

- Do **not** set `LISTENTROPY_BASE_PATH` on Vercel (root-path deploy).
- Trigger redeploys after changing env vars so Vite rebuilds with the new values.

## Release-Readiness Checks (Before Production)

Run locally:

```bash
pnpm check
SPOTIFY_ZIP_PATH=/absolute/path/to/my_spotify_data.zip pnpm audit:real-data
```

The real-data audit now includes a **no remote runtime dependency** check (unexpected external HTTP(S) requests fail the audit).

## Launch Verification Checklist

Before public launch, verify all of the following:

- Preview domain loads: `https://preview.listentropy.w4w.dev`
- Production domain loads: `https://listentropy.w4w.dev`
- SPA routes resolve on hosted app:
  - `/`
  - `/share`
  - `/auth/spotify/callback?error=access_denied`
- Spotify OAuth completes successfully on preview and production
- Spotify OAuth cancel/error flow shows a user-friendly error and returns to app flow
- No duplicate production deploys are occurring from Vercel Git integration on `main`
- GitHub Actions production deploy runs only after `CI` succeeds on `main`

## Cost Notes

- Vercel Hobby: free tier (subject to Vercel limits/quotas)
- Cloudflare DNS: free tier
- Listentropy app runtime: static/client-side only, no database/server costs

## Optional Alternative Free Static Hosts

Listentropy also includes static-host compatibility helpers for:

- GitHub Pages (SPA fallback via generated `dist/404.html`)
- Netlify/Cloudflare Pages-style redirect fallback (`public/_redirects`)

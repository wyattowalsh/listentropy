# Deploy on Vercel with Cloudflare DNS (DNS-Only)

This is the recommended "free-to-operate" production setup for Listentropy:

- **Vercel Hobby** hosts the static app
- **Cloudflare** manages DNS only (free plan)
- **No backend** required

## Architecture

- Cloudflare acts as the authoritative DNS provider
- Vercel serves the app and terminates TLS
- Cloudflare DNS records should be set to **DNS only** (gray cloud), not proxied

This avoids reverse-proxy caching/edge issues and keeps Vercel routing and security features intact.

## Deploy Steps

1. Push the repository to GitHub.
2. Import the repo into Vercel (Hobby plan is sufficient for a static/local-first app).
3. Use the default Vite build settings:
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Output directory: `dist`
4. Deploy once on the Vercel preview domain and confirm the app loads.
5. In Vercel project settings, add your custom domain(s).
6. In Cloudflare DNS, create the records Vercel requests (typically apex + `www`).
   - For a subdomain launch like `listentropy.w4w.dev`, this is typically a `CNAME` for `listentropy` pointing to the Vercel target shown in your Vercel domain setup UI.
7. Set those records to **DNS only** (gray cloud).
8. Wait for Vercel domain verification and certificate issuance.

## Cloudflare DNS Mode (Important)

- **Use**: DNS only (gray cloud)
- **Avoid**: Proxied (orange cloud) in front of Vercel unless you have a specific reason and are prepared to debug cache/proxy behavior

## Release-Readiness Checks (Before Production)

Run locally:

```bash
pnpm check
SPOTIFY_ZIP_PATH=/absolute/path/to/my_spotify_data.zip pnpm audit:real-data
```

The real-data audit now includes a **no remote runtime dependency** check (unexpected external HTTP(S) requests fail the audit).

## Cost Notes

- Vercel Hobby: free tier (subject to Vercel limits/quotas)
- Cloudflare DNS: free tier
- Listentropy app runtime: static/client-side only, no database/server costs

## Optional Alternative Free Static Hosts

Listentropy also includes static-host compatibility helpers for:

- GitHub Pages (SPA fallback via generated `dist/404.html`)
- Netlify/Cloudflare Pages-style redirect fallback (`public/_redirects`)

# Publish without a custom domain

Target: Vercel Hobby frontend, Render Free Docker API in Singapore, Neon Free PostgreSQL in Singapore. This document describes configuration; it does not imply a deployment has completed.

## Backend

The tracked apps/api-overlay directory now includes the Laravel application skeleton and locked Composer dependencies. The Docker image copies only that directory, never apps/api, local .env files, SQLite databases, or private wish backups.

1. Create a Neon project with PostgreSQL enabled, Singapore region. No Neon Auth, Functions, object storage or AI gateway is required.
2. In Neon Connect, select the direct (non-pooled) PostgreSQL URL for the initial deployment. Store it privately as DB_URL in Render; retain sslmode=require. Do not commit it or paste it in chat.
3. Push the prepared source to GitHub. Create a Render Blueprint from render.yaml, or a Free Docker Web Service using deploy/api/Dockerfile with repository-root build context, Singapore, port 80, health check /api/health.
4. Set APP_KEY to a newly generated Laravel key, DB_URL to the Neon URL, and APP_URL to the assigned https://...onrender.com address. Generate the key with php artisan key:generate --show; store it only in the hosting environment. Keep it stable across deployments.
5. Startup forces production mode with debug disabled, TLS PostgreSQL, database-backed sessions/cache, runs migrations and starts Apache. Verify /api/health returns {"status":"ok"}.

Do not use Render's ephemeral local disk for SQLite. Its free PostgreSQL offering expires after 30 days, which is why this configuration uses an external Neon database. Free Render web services sleep when idle; allow up to roughly two minutes for the first request. Do not create automated keep-awake traffic. Monitor both providers' free quotas.

## Frontend

Deploy apps/web as a Next.js project on Vercel Hobby. Set server-side environment variables:

- API_INTERNAL_BASE=https://YOUR-API.onrender.com/api
- APP_ORIGIN=https://YOUR-PROJECT.vercel.app

APP_ORIGIN must exactly match the canonical browser origin (no trailing slash). Redirect visitors from other aliases to that canonical address. Preview deployments need their own matching origin and should use a test database/backend before testing mutations. Neither variable needs a NEXT_PUBLIC prefix. Secrets and local environment files are excluded by .vercelignore.

The proxy uses a 120-second function duration. Browser requests allow a cold backend to wake. Archive imports are capped at 4 MiB to remain below Vercel's 4.5 MB request-body limit. Very large archive exports may also hit Vercel response limits; retain local backups and test the target archive size.

## Companion release

After the real API URL is assigned, run from PowerShell 7 at the repository root:

    ./scripts/package-companion.ps1 -ApiBase 'https://YOUR-API.onrender.com/api'

The ZIP includes irminsul-config.json beside the executable. Its installer copies this configuration with the executable. An existing IRMINSUL_API_BASE environment override takes precedence; remove or update an old localhost override before testing online.

The command copies the package to apps/web/public/downloads/IrminsulSync-Windows.zip. This generated binary is intentionally not committed. Deploy the frontend from the local directory with Vercel CLI after packaging so the download is included. Git-only Vercel builds need the release ZIP supplied separately; do not share a deployment with a missing or localhost-configured download.

## Verify before sharing

- API health succeeds with the real PostgreSQL database.
- Registration, login and logout work through the production frontend; the session cookie is HttpOnly and Secure.
- Two accounts cannot read each other's archives or sync sessions.
- Downloaded companion contains the production API URL; install it and sync from Windows Chrome.
- Export/import a backup, confirm dashboard/history counts, and check data survives an API redeploy.
- Run node scripts/verify-web-auth.mjs https://YOUR-PROJECT.vercel.app for guest/CSRF checks.

Local accounts and 955 local wishes are not automatically migrated or uploaded. Register your online account, then export the local archive and import it while signed into your online account. This keeps the local database intact and avoids transferring session tokens.

Email verification and email password recovery are postponed. Render Free blocks ordinary SMTP ports, so Gmail SMTP cannot be assumed to work there; choose a supported email API before enabling email features.

References: https://render.com/docs/free, https://render.com/docs/blueprint-spec, https://neon.com/pricing, https://vercel.com/docs/functions/limitations

# Multiuser authentication

Users register with an Irminsul email/password, sign in, sign out, and change their password. This is independent of HoYoverse credentials. The dashboard lists only game archives belonging to the signed-in user.

## Request flow

Browser requests use the same-origin Next.js `/api/backend` route. Laravel Sanctum issues a seven-day access token; Next.js stores it in a host-only HttpOnly, SameSite=Lax cookie (Secure on HTTPS). The token is removed from login/registration JSON before it reaches browser JavaScript. Mutating web requests require the exact configured origin and JSON content type. The proxy only permits known API paths, never arbitrary destinations, and refuses redirects when forwarding credentials.

Laravel independently authenticates all account reads, archive exports/imports, sync-session creation, and polling. Account queries include `user_id`; missing or foreign archives return 404. Responses are not cacheable. Rate limits use separate keys for each operation so login, registration, imports, and sync polling do not consume each other's limits.

Companion progress/upload continues to use the random 15-minute session capability. Its owner is fixed by the authenticated session-creation request, not by the UID or upload payload. Logout cancels pending sync capabilities; password change revokes all web tokens and pending syncs. The companion never receives a web login password or access token.

Each user may hold a private copy of the same game UID. Importing that UID creates/merges only their own archive. This is isolation of uploaded archives, not proof that the user owns the HoYoverse account.

## Existing local installation

Back up `apps/api/database/database.sqlite` before applying the new migration. Runtime files must match `apps/api-overlay`, including its Composer manifests:

```powershell
cd D:\Project\IrminsulWish\apps\api
composer install --no-interaction
php artisan migrate
```

Legacy archives keep all their wishes but have no user owner. No signup, including the first signup, can claim them over HTTP. Register the intended account, then explicitly assign the old archive from the API command line:

```powershell
php artisan irminsul:assign-legacy "your-email@example.com" "YOUR_GAME_UID"
```

Use the actual registered email and UID. The command refuses to overwrite an existing private archive with the same UID. Assign the legacy archive before syncing/importing that UID into the new user. Refresh the dashboard after assignment. This operation does not delete or recreate wish records.

## Configuration for a future deployment

Frontend server environment:

```dotenv
API_INTERNAL_BASE=https://your-api.example/api
APP_ORIGIN=https://your-web.example
```

Local development defaults to the loopback API at `http://127.0.0.1:8000/api`; the example origin is `http://localhost:3000`. `NEXT_PUBLIC_API_BASE` is no longer used. Do not put auth tokens or secrets in public frontend variables. The browser no longer needs cross-origin cookies or direct API access.

Backend: persistent database/cache storage, a stable `APP_KEY`, `APP_ENV=production`, `APP_DEBUG=false`, HTTPS, migrations, and Composer dependencies from the tracked lockfile. The default local Composer autoloader is unoptimized to avoid slow Windows scanning; deployment can use `composer install --no-dev --optimize-autoloader`. Configure request body/timeout limits for the intended import size; frontend hosting may impose a lower limit than the 4 MiB web proxy limit. Login IP throttles see the Next server's IP unless trusted infrastructure is configured; do not blindly trust arbitrary forwarded headers.

The companion's existing `IRMINSUL_API_BASE` setting must point to the public backend when deploying. Its localhost default is for local development. No friend-specific addresses, tunnels, or hosting accounts are introduced by this change.

## Coverage and limits

`MultiUserAuthTest` covers guest rejection, cross-user account/export/history/session isolation, shared UID separation, immutable upload ownership, logout cancellation, password hashing/change, token expiry, brute-force limits, and explicit legacy assignment. Existing archive/pity/history tests run as an authenticated owner. `node scripts/verify-web-auth.mjs` checks live proxy rejection of anonymous access, unknown paths, missing origins, and cross-site login attempts.

Email verification and email-based password recovery are not implemented; mail delivery is not configured. There is no claim of HoYoverse identity verification. Public deployment, production infrastructure testing, and real Windows companion sync against the deployed backend remain separate work. Nothing here publishes the project.

Authentication package reference: [Laravel Sanctum documentation](https://laravel.com/framework/docs/sanctum).

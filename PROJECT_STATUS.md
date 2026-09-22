# Project Status — POC V1

## Implemented

- Monorepo/project structure.
- Next.js 16.3.3 dashboard.
- Start Sync flow using `irminsul://sync?session=...`.
- Laravel 13 API overlay.
- Short-lived, server-hashed sync session tokens.
- SQLite local development setup (production target: PostgreSQL).
- Genshin account + wish + sync-session tables.
- Pity calculation for Character Event, Weapon, Standard, and Chronicled groups.
- Windows companion source (.NET 8).
- Genshin process detection.
- Current WebView cache scan through `webCaches/.../Cache/Cache_Data/data_2`.
- Local wish URL/authkey extraction.
- Direct HoYoverse fetch from the user's PC.
- UIGF-compatible gacha grouping including Character Event 2 (`400 -> 301`) and Chronicled Wish (`500`).
- Normalized wish upload without sending authkey to Irminsul.
- Dedupe using account + wish ID.
- Windows custom-protocol registration scripts.
- Installer targeting `D:\Project\IrminsulWish`.

## Not implemented yet

- User login/authentication.
- Multi-user ownership/authorization.
- Featured 5-star banner catalog and character 50/50 guarantee state.
- Weapon Fate Point state.
- Signed public Windows installer.
- Companion GUI/system tray.
- Auto-update.
- SSE/WebSocket; V1 web polls the short-lived sync session every 1.5 seconds.
- Production deployment.

## First real-device test

### Verified locally on 2026-09-21

- Windows x64 self-contained companion published to `dist/sync/IrminsulSync.exe`.
- Build script checks SDK 8, publish exit code, and executable existence; a failed publish now fails the script.
- `irminsul://` registered for the Windows user.
- Laravel migrations complete; API and web run on ports 8000 and 3000.
- Next.js production build and TypeScript checks pass.
- Laravel tests: 5 passing, 26 assertions, including session hashing/expiry, empty uploads, deduplication, and shared character-banner pity.
- Companion serialization verified against the API snake_case contract.
- Shared log/cache reading works while Genshin has the file open.
- Actual Genshin History session found; 955 real wishes fetched and imported into SQLite.
- Account statistics endpoint returns 955 wishes and banner pity.
- Windows protocol dispatch launched the companion successfully; a second real-account sync completed with zero new wishes and the database still contains 955 records.
- Added per-user application metadata/capabilities registration, a default open verb, and Windows association-change notification. Registration now verifies both the friendly name and executable through `AssocQueryString`.
- Corrected the registration diagnostic to pass a real null default-verb argument inside C#: PowerShell marshaled its `$null` string argument as an empty string, producing misleading failed executable queries. Both queries now pass.

### User-confirmed browser flow on 2026-09-22

- Running `scripts/register-protocol.ps1` directly from Windows PowerShell resolved the user's Chrome handler error.
- The user confirmed that the companion opens from Chrome and the dashboard displays the calculated wish data.
- Chrome -> companion -> API -> dashboard is confirmed working. The exact reason the earlier tool-side registration was not visible to Chrome was not established.

### Corrections from real-device testing

- Use snake_case for normalized companion payloads; allow empty history uploads.
- Open game log/cache files with read/write/delete sharing.
- Pace upstream requests and retry rate limits with bounded exponential delays.
- Give full-history uploads a two-minute timeout (the first 955-record import completed server-side after the old 30-second client timeout).
- Avoid overlapping browser polling requests, add request timeouts, and stop polling on client-side session expiry.
- Add a direct companion launch link and a cancel control when a browser leaves the session waiting. Ignore stale polling responses after cancellation.

### Remaining acceptance checks

- Edge has not been separately verified; Chrome is confirmed above.
- Verify the game-not-running rejection when Genshin is closed; leave the current game session running.

The game-not-running guard remains a separate acceptance check; it does not invalidate the completed real-account Chrome flow.

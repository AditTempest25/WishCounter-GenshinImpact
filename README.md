# Irminsul Wish

Public Genshin Impact wish tracker with a lightweight Windows sync companion.

## V1 goals

- Web dashboard for pity and wish history.
- `irminsul://sync?...` deep link opens the Windows companion.
- Companion only runs for a Genshin play session.
- Companion reads the local Genshin WebView cache, obtains the current wish-history URL, and calls HoYoverse directly.
- HoYoverse `authkey` never leaves the user's PC.
- Backend receives normalized wish records only.
- Duplicate wish records are ignored by `wish_id`.

> Important: HoYoverse wish history is not guaranteed to update immediately after a pull. This project can automate synchronization, but it cannot make HoYoverse publish new records earlier.

## Repository layout

```text
apps/
  web/          Next.js 16 dashboard prototype
  sync/         Windows .NET 8 companion source
  api-overlay/  Laravel 13 application files copied over a fresh Laravel project
  api/          Local Laravel runtime and SQLite database (Git-ignored)
dist/
  sync/         Published companion used by irminsul:// (Git-ignored)
scripts/
  setup-windows.ps1
  build-sync.ps1
  register-protocol.ps1
  unregister-protocol.ps1
docs/
  ARCHITECTURE.md
  SECURITY.md
```

`apps/api-overlay` is the backend source distributed with this repository;
`apps/api` is the working Laravel installation generated from it. Keep both
locally. When changing backend source, keep the corresponding overlay files in
sync so a fresh setup receives the changes.

Keep `dist/sync/IrminsulSync.exe`: Windows protocol registration points to that
file. Dependencies (`node_modules`, `vendor`), build caches, environment files,
and the wish database stay local and are excluded from Git. The original ZIP
and extracted POC snapshot are redundant once this working project is set up.

## Install into D:\\Project

Extract this repository anywhere, open PowerShell in the extracted folder, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
```

The script installs/copies the project to:

```text
D:\Project\IrminsulWish
```

It does **not** register Windows startup. The companion is launched only from the web button / custom protocol or manually.

## Development requirements

- Node.js 20+ (22 recommended)
- PHP 8.3+
- Composer 2
- SQLite for the local POC (configured automatically); PostgreSQL is the intended production database
- .NET SDK 8 for building the Windows companion

## Quick local development

After setup:

```powershell
cd D:\Project\IrminsulWish

# API
cd apps\api
php artisan migrate
php artisan serve

# Web (new PowerShell)
cd D:\Project\IrminsulWish\apps\web
npm install
npm run dev
```

Build the companion:

```powershell
cd D:\Project\IrminsulWish
.\scripts\build-sync.ps1
.\scripts\register-protocol.ps1
```

Then visit `http://localhost:3000` and press **Start Sync**.

If Chrome reports `scheme does not have a registered handler`, rerun
`scripts/register-protocol.ps1` as the same Windows user who runs Chrome. The
script registers the application metadata and capabilities, refreshes Windows
associations, and verifies that the Windows association API recognizes Irminsul
Sync. Refresh the dashboard, start a new session, and use **Buka Irminsul Sync**
if the automatic launch does not appear. **Batalkan** stops waiting in the web
dashboard; it does not terminate an already running companion.

## Current POC limitations

- Login, logout, password change, and per-user archive ownership are implemented. See [multiuser setup](docs/MULTIUSER.md) before deployment.
- Rate-on/off and featured guarantee use bundled historical banner metadata; unrecognized items, missing metadata, and transition dates remain unknown.
- The companion currently targets Windows PC installations.
- The cache extractor is designed around the current `webCaches/.../Cache/Cache_Data/data_2` method and may need maintenance after Genshin client updates.

## Archive tools and companion installer

The dashboard includes native Irminsul JSON backup/import, monthly charts, a manual Character Event target planner, UID privacy, and PNG summary cards. See [archive tools](docs/ARCHIVE_TOOLS.md) for limits and verification notes.

Build the downloadable Windows companion package from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/package-companion.ps1
```

The ZIP is generated in `dist/IrminsulSync-Windows.zip` and copied to `apps/web/public/downloads` for the dashboard download button. Generated executables and ZIPs are not committed. Rebuild this package for a fresh checkout before distributing the web app. Extract the ZIP and run `Install.cmd` to install the handler for the current Windows user. No administrator or startup service is required.

## Multiuser accounts

Register an Irminsul account in the web UI. Each user sees only their own archives. Existing local archives require explicit assignment to the registered owner; see [migration and authentication details](docs/MULTIUSER.md). The frontend uses a same-origin proxy with an HttpOnly session cookie; configure `API_INTERNAL_BASE` and `APP_ORIGIN` when deploying. No deployment is performed automatically.

## Deployment

See [deployment setup](docs/DEPLOYMENT.md) for Vercel + Render + Neon without a custom domain.

# Archive tools

## Backup and restore

Use **Unduh backup JSON**, choose the resulting file under **Pilih backup**, review its UID/count, and select **Impor & gabungkan**. The native schema is `irminsul-archive`, version `1`; it is not a UIGF implementation. IDs remain strings to preserve precision. Files contain UID and wish records, not HoYoverse authkeys or sync tokens.

Imports merge by account and wish ID in a database transaction. Exact duplicates are skipped. Conflicting banner, rarity, time, or nonempty item IDs cancel the entire import. Existing names, region, and records are preserved. Importing another UID switches the displayed account after success. Imports do not pretend to be a new game sync or change the last-sync summary.

The UI accepts up to 32 MiB / 50,000 wishes. PHP `post_max_size` and any reverse-proxy body limit must allow the request (for example `post_max_size=40M` in the PHP configuration loaded by the API server). Restart the API after changing that setting. Smaller local archives work with the default limits. A timeout does not prove the import was rolled back: refresh the account or retry the same file safely.

## Sync diagnostics

The companion reports only allowlisted progress stages to the API: connected, fetching, uploading, or a bounded failure category. Exception contents, cached URLs, and authkeys are never included. Reporting failure does not prevent a valid upload. Old companion versions still upload normally but cannot show progress.

The dashboard prompts for troubleshooting if a waiting session has no companion response after 20 seconds. It cannot inspect Windows protocol registration itself. The API health check verifies database connectivity. Session expiry ends dashboard polling; failed and completed sessions cannot be reopened by progress reports. Replaying a completed upload preserves its original import summary.

Run `scripts/package-companion.ps1` to build a self-contained Windows x64 package and populate the web download. `Install.cmd` copies the executable to `%LOCALAPPDATA%\IrminsulWish\Companion`, then registers `irminsul://` for the current user. It does not install a service, start on login, or include the local database. The source checkout's existing registration still points at `dist/sync`, which is also updated by the build. Windows may show its normal warnings for an unsigned package; code signing is not included.

## Charts, planner, and sharing

Charts count saved records and include zero months inside the displayed archive range. Monthly views offer the last 12 archive months or up to 20 years. The interval chart displays the last 30 5-star results in chronological order; counts stay within their banner group and partial first intervals use `>=`.

The target planner is for a chosen featured Character Event character. Available wishes are `floor(Primogem / 160) + Intertwined Fate`. Its conservative budget is remaining hard pity plus another hard-pity cycle when not guaranteed; unknown guarantee uses that same conservative scenario. Invalid pity suppresses the estimate. It does not predict luck, banner dates, or future income. Plans are manually saved per UID in the current browser and are not part of the wish backup.

UID privacy is on by default, persists in the browser, and also controls the downloaded PNG card. It hides visible UID and the copy button; it is not authentication or encryption. Backups retain the UID required for restoration. PNG cards are generated locally and are not uploaded anywhere.

## Verification and remaining release checks

Automated coverage includes export/import round trips preserving statistics, duplicate imports, atomic rollback, malformed records, month grouping, progress validation, terminal sessions, replayed uploads, and the existing pity/history/rate-up suites. Tests use in-memory SQLite rather than the user's database.

For release verification on Windows: extract and install the ZIP, restart the PC, run the web/API servers, open Genshin Wish History, start sync in Chrome/Edge, verify progress and completion, then repeat sync and confirm zero new records. Also check game-closed and history-missing failures. Reboot and browser protocol prompts require a real interactive session; automated API tests do not prove those OS interactions.

Authentication and per-user ownership are now implemented; see [multiuser setup](MULTIUSER.md). Hosting configuration, email recovery, and production verification remain separate deployment work.

### Verified in this change

- Production web build and TypeScript check passed.
- Backend: 15 tests, 174 assertions, all passed against in-memory SQLite.
- Windows self-contained publish and ZIP packaging passed; all PowerShell scripts parsed without syntax errors.
- Live browser: real archive loaded (955 wishes), charts rendered, 1,600 Primo + 5 Fate calculated as 15 pulls, item dialog loaded and closed with Escape, API/database check succeeded, PNG and backup download actions completed.
- Upload UI rejected malformed JSON and previewed a different account before import; the preview was canceled without writing test wishes.
- Mobile viewport checked at 390 px; a filter overflow was corrected, with document width equal to viewport width afterward.
- Windows installer execution, OS reboot, and a fresh real-game protocol sync remain manual release checks.

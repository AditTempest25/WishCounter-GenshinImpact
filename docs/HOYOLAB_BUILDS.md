# HoYoLAB character builds (companion v1.1.1)

Sync HoYoLAB is separate from wish sync. It reads the linked global Genshin account's roster and character details from Battle Chronicle. Enka public showcase remains available as an alternative. The catalog includes characters without a synced build; a missing build does not establish that a character is unowned.

## Release order

1. Push the source changes. Railway must deploy the new controller, routes and migration; its existing startup migration command creates the snapshot columns and build session table. Vercel must deploy the updated frontend and proxy allowlist.
2. Upload `dist/IrminsulSync-Windows.zip` as a GitHub release asset under tag `companion-v1.1.1`. Package configuration targets the production Railway API. The main website download points to the companion-v1.1.1 release asset, which supports both wish and HoYoLAB build sync.
3. Extract the whole v1.1.1 ZIP and run `Install.cmd`, replacing the old companion. Microsoft Edge WebView2 Runtime is needed to show the login window. The ZIP includes the self-contained .NET app.
4. Log in to Irminsul, select an account with a synced/imported wish archive, and open Character builds. Click **Sync HoYoLAB**, allow the companion, log in directly to HoYoLAB, and click **Sync this account**. The HoYoLAB account must own that selected UID. Verify the roster, weapon, artifacts and stat totals against Battle Chronicle, then refresh the website to check the saved snapshot.

## Credentials and access

The login window uses an InPrivate WebView2 profile without password autosave. The companion forwards only allowlisted login cookies to fixed HoYoLAB/HoYoverse API hosts and disables redirects. Cookies are held in memory and never sent to Irminsul. Usernames, passwords and raw responses are not logged or uploaded. Login and captcha/verification are completed by the user; no verification bypass is implemented.

The backend binds a hashed capability token to the authenticated owner's selected Genshin account for 15 minutes. Uploads are single-use, owner snapshot reads require authentication, cancel/failure invalidates the session, and UID mismatches are rejected. Only projected build fields persist; failed or partial upstream reads leave the existing snapshot intact. Snapshot data comes from the companion and is not a competitive or verified score.

## Limits and validation

Global accounts only. HoYoLAB may require additional verification, return incomplete data, or change its API; the companion stops with a safe error. Recommendation coverage remains that of the existing catalog, rather than an invented perfect-build score for every character. The frontend omits unsupported character/stat formats and shows a notice. Combat buffs may differ from displayed snapshot stats.

Automated checks cover backend ownership, capability replay/expiry/cancellation, mismatched UID, nested credential projection and parser stat/percentage handling. Live login and comparison against a real Battle Chronicle account still need user verification; a successful build alone does not prove upstream access.

API implementation reference: [genshin.py Battle Chronicle client](https://github.com/seriaati/genshin.py/blob/master/genshin/client/components/chronicle/genshin.py).

Protocol fix in v1.1.1: dispatch uses the parsed URI host and accepts the optional slash inserted by browsers before the query. Run `IrminsulSync.exe --verify-protocol` to check build/wish dispatch and invalid links without making network requests.

## Character atelier tools

All catalog entries have DPS/on-field, support/off-field, and reaction-trigger target editors. Manual roles start with empty targets, do not inherit another character's recipe, and allow CR/CD, ER, ATK, EM, HP and DEF. Automatic profiles are limited to existing sourced recipes and explicitly curated variants. Raiden's Hyperbloom variant follows the linked KQM quick guide (version 5.7); level/EM priorities and weapon options differ from Burst DPS. This does not claim automatic recommendations for every character and team.

Filters include catalog/synced roster, element and weapon type. Up to three upgrade findings are shown first, with remaining notes expandable. Snapshot comparisons include stat deltas, weapons and artifact changes. The previous successful HoYoLAB snapshot is retained server-side for the owner; failed uploads do not rotate it. Deploy the new migration on Railway before using comparison on Vercel. Existing accounts acquire their first comparison after a new successful sync.

Companion v1.1.1 remains supported. The web shows the minimum version, a download link, session creation and actual companion connection. Per-character reading progress remains in the companion terminal; the web does not estimate a percentage or claim it detected the installed version.

# Architecture

## User flow

```text
HoYoPlay -> Genshin -> user opens Wish History
                         |
                         v
Web dashboard -> Start Sync -> irminsul://sync?session=<short-lived-token>
                         |
                         v
                  Irminsul Sync.exe
                         |
             reads local WebView cache
                         |
                    obtains authkey
                         |
                 HoYoverse Wish API
                         |
                 normalized wishes
                         |
                         v
                  Irminsul API
                         |
                  PostgreSQL
                         |
                         v
                 Web dashboard
```

## Trust boundaries

### Browser -> companion

The custom protocol contains only a short-lived synchronization token.

Example:

```text
irminsul://sync?session=example-token
```

The companion does **not** accept an arbitrary backend URL from the deep link. The API base URL is configured locally (`IRMINSUL_API_BASE`) or compiled into the app. This prevents a random website from launching the companion and redirecting private wish records to an attacker-controlled API.

### Companion -> HoYoverse

The companion extracts the Wish History URL from local Genshin WebView cache. It uses that URL locally to fetch wish records from HoYoverse.

The full URL and `authkey` are never sent to the Irminsul backend.

### Companion -> Irminsul API

Only normalized wish records and non-secret metadata are uploaded.

Example record:

```json
{
  "id": "1234567890123456789",
  "gacha_type": "301",
  "uigf_gacha_type": "301",
  "name": "Example Character",
  "item_type": "Character",
  "rank_type": "5",
  "time": "2026-09-21 17:30:00"
}
```

## Sync session

1. Web creates a sync session.
2. Backend generates a random token and stores only its SHA-256 hash.
3. Web invokes `irminsul://sync?session=<token>`.
4. Companion uploads wishes using the same token.
5. Backend marks the token complete and rejects it after expiration.

Default POC expiration: 15 minutes.

## Banner mapping

UIGF-compatible grouping:

| API gacha type | Pity group |
| --- | --- |
| 100 | 100 (Novice) |
| 200 | 200 (Standard) |
| 301 / 400 | 301 (Character Event) |
| 302 | 302 (Weapon Event) |
| 500 | 500 (Chronicled Wish) |

## V2 targets

- Authentication and multiple Genshin accounts per user.
- SSE/WebSocket push after sync completion.
- Banner metadata service for featured 5-star and guarantee state.
- Signed companion releases and auto-update.
- UIGF v4.2 import/export.

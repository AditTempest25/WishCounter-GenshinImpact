# Security notes

## Rules for the companion

1. Never upload the HoYoverse Wish History URL or `authkey`.
2. Never request a HoYoverse username or password.
3. Never read game memory or modify the Genshin process.
4. Read only the files needed to locate the WebView wish-history cache.
5. Accept only an Irminsul sync-session token through the custom protocol.
6. Do not accept arbitrary upload URLs from web pages.
7. Use TLS in production.
8. Sign Windows releases before public distribution.

## Server

- Store only SHA-256 hashes of temporary sync tokens.
- Expire sync sessions quickly.
- Make `wish_id` unique per account.
- Apply request-size and rate limits before public launch.
- Add authenticated account ownership checks before public launch.

## Privacy

UIDs and wish history should be private by default. A future public-profile feature must require explicit opt-in.

# Rate-up classification

The dashboard uses the public [Paimon.moe banner catalog](https://github.com/MadeBaruna/paimon-moe/blob/main/src/data/banners.js), retrieved 2026-09-22, and the genshin-db item ID/name catalog. The bundled Character/Weapon periods currently end on 2026-09-22. Run `node scripts/update-item-icons.mjs`, then `node scripts/update-banner-history.mjs` to refresh the metadata. These developer scripts do not send account data or run downloaded code.

- Character Event (301/400) shares one guarantee; Weapon Event has a separate guarantee.
- A featured 5-star is rate-on. A known permanent-pool 5-star outside the featured set is rate-off.
- After rate-off, the next 5-star is marked guaranteed featured. A featured result resets this guarantee.
- History is evaluated before pagination or filters. The first recorded featured result has unknown prior guarantee, so it is not claimed as a 50/50 win.
- No recorded 5-star, unrecognized items, missing metadata, and banner boundary dates are unknown. Boundary dates are deliberately conservative because server timezone is not normalized in imported wish timestamps.
- Status assumes the stored sequence has no missing wishes. Standard/Beginner/Chronicled banners do not receive these labels.
- Capturing Radiance cannot be identified from a wish record. The Character card's 50/50 label means not guaranteed, not a personalized probability estimate.
- Weapon guarantee is for either featured weapon, not the player's Epitomized Path selection. Fate Points are not reconstructed.

The classification is derived on read, so metadata corrections do not rewrite imported history.

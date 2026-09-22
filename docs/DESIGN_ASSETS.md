# Dashboard illustration

Asset: `apps/web/public/images/irminsul-hero.png`

Generated with OpenAI ImageGen for this project. Decorative fantasy environment; not an official Genshin Impact asset.

Prompt:

> Create a premium wide landscape background illustration for an existing Genshin wish statistics dashboard, not a UI mockup. Original stylized fantasy concept art, no text no logos no characters. An ancient luminous silver-white tree with graceful branching canopy, floating pale green leaves and tiny gold motes, growing on a small island over still reflective water inside a deep emerald nocturnal forest. Tree and glow predominantly in the RIGHT third; LEFT half dark nearly black forest green, quiet and sparse to allow readable text overlay. Painterly high-end anime environment, subtle volumetric light, refined magical atmosphere, muted antique gold highlights. Panoramic 3:1 composition with room for cropping. No UI, typography, border or watermark.

## Character and weapon icons

`apps/web/lib/data/item-icons.json` contains a compact ID/name-to-icon catalog from [genshin-db](https://github.com/theBowja/genshin-db), fetched on 2026-09-22. Artwork is loaded from the [Enka Network image CDN](https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md#icons-and-images). Genshin Impact artwork belongs to HoYoverse.

Refresh the catalog with `node scripts/update-item-icons.mjs` from the repository root. This is a developer update, not a dependency of sync. Unknown items or unavailable images show a generic character/weapon icon; item names and history remain usable. CDN requests contain only the public icon filename and omit the referrer.

# Character builds

The dashboard's Character atelier browses the full local character catalog and loads public Character Showcase builds for the selected, owner-scoped UID. A character absent from showcase is not marked unowned: wish history cannot reveal the entire roster or current equipment.

## Load a build

Enable Show Character Details in the Genshin profile, place characters in Character Showcase, then press Muat build akun. The UI explains that the UID is sent to Enka.Network. No HoYoLAB cookies or authkeys are requested. Only an authenticated owner of a linked UID can access the backend endpoint. Data is cached for the upstream TTL and never persisted to the wish archive. Errors and hidden showcases have separate messages.

API: GET /api/accounts/{uid}/builds. The BFF allows this endpoint and keeps the existing authentication and no-store response behavior. Deploy both frontend and backend; no migrations or companion update are required.

## Guidance and limitations

53 reference profiles are bundled, not one verified build for every character. Uncovered characters display their actual stats and basic equipment checks but explicitly show that specific recommendations are unavailable. The interface must not present these as universal optimal builds. Reference profiles describe one particular archetype; team, constellations, reaction and patch can change the correct build.

CR 70 / CD 140 are editable starter targets authored for this UI, not official minimums. ER reference values are rotation-dependent. Total ATK targets are left blank by default. An optional active CR bonus lets users account for combat buffs not reflected in showcase. Checks highlight target gaps, main-stat differences, missing set pieces and equipment levels. There is no leaderboard percentile, damage simulation or absolute perfect score. PNG exports are stat summaries; they honor the dashboard UID privacy toggle.

## Sources

- Enka API specification: https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md
- Request policy / TTL: https://github.com/EnkaNetwork/API-docs/blob/master/api.md
- Character metadata and English labels: EnkaNetwork/API-docs store/characters.json and store/loc.json, retrieved 2026-10-01. Existing catalog entries without Enka metadata remain browsable. Assets and game data belong to HoYoverse; API attribution appears in the UI.
- 52 recipe objects adapted from natcat38/rpg-build-optimizer, src/meta/metaTargets.ts, retrieved 2026-10-01. The upstream labels its snapshot patch 6.7. MIT license retained in docs/licenses/build-recipes-MIT.txt. Its source links point to KQM; these are shown with each profile. This snapshot has not been independently re-verified for every current team.
- Odette reference: https://keqingmains.com/q/odette-quickguide/ (patch 7.0, accessed 2026-10-01).

Update recipe data and source/patch labels together. Publish a profile only after checking scaling, role, set requirements, passive conditions and accessible alternatives against the cited guide. Do not infer minimums from a screenshot or use a generic ATK/CRIT threshold for healers and reaction supports.

## Validation

- node scripts/verify-character-builds.cjs: unit conversions, equipped stats, refinement, talent bonuses and icon URL validation.
- CharacterBuildTest: owner isolation, upstream TTL caching, empty showcase and upstream failure handling.
- Frontend production build / TypeScript.

Manual acceptance: load an owned UID with public details, select multiple characters, switch account, try an empty showcase, check narrow layout, and export a card with UID privacy on/off. A live player's Enka integration must be verified after deployment; mocked API tests are not evidence that their showcase is public.

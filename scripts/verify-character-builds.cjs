const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../apps/web/node_modules/typescript');
const filename = path.resolve(__dirname, '../apps/web/lib/builds.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(compiled, filename);
const { parseBuild, iconUrl } = m.exports;
const build = parseBuild({
  avatarId: 10000002, propMap: { 4001: { val: '90' } },
  fightPropMap: { 1: 12000, 4: 1000, 7: 700, 2000: 18000, 2001: 2200, 2002: 900, 20: .6, 22: 2.1, 23: 1.35, 6: .466 },
  skillLevelMap: { 10024: 8, 10018: 9, 10019: 10 }, proudSkillExtraLevelMap: { 232: 3 },
  talentIdList: [1, 2, 3], equipList: [
    { itemId: 1, weapon: { level: 90, affixMap: { 1: 4 } }, flat: { icon: 'UI_EquipIcon_Sword_Test', weaponStats: [{ appendPropId: 'FIGHT_PROP_BASE_ATTACK', statValue: 608 }] } },
    { reliquary: { level: 21 }, flat: { equipType: 'EQUIP_SHOES', reliquaryMainstat: { mainPropId: 'FIGHT_PROP_ATTACK_PERCENT', statValue: 46.6 }, reliquarySubstats: [{ appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 10.1 }] } },
  ],
});
assert.equal(build.stats.cr, 60);
assert.equal(build.stats.cd, 210);
assert.equal(build.stats.er, 135);
assert.equal(build.stats.atk, 2200);
assert.equal(build.base.atk, 1000);
assert.deepEqual(build.talents, [8, 12, 10]);
assert.equal(build.weapon.refinement, 5);
assert.equal(build.artifacts[0].level, 20);
assert.equal(build.artifacts[0].stats[0].value, 46.6);
assert.equal(build.artifacts[0].stats[1].name, 'CRIT Rate');
assert.equal(parseBuild({ avatarId: 'unknown' }), null);
assert.equal(iconUrl('https://example.test/tracker'), '');
assert.equal(iconUrl('UI_../../foo'), '');
console.log('Character parsing: 13 checks passed.');

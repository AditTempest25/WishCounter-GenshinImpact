const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../apps/web/node_modules/typescript');
const original = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText, filename);
const {parseHoyolabSnapshot} = require('../apps/web/lib/hoyolab-builds.ts');
require.extensions['.ts'] = original;
const names = ['Max HP','ATK','DEF','CRIT Rate','CRIT DMG','Energy Recharge'];
const values = ['18,000','2,200','900','60.0%','210.0%','135.0%'];
const snapshot = {property_map:Object.fromEntries(names.map((name,i)=>[i,{name}])),characters:[{
  base:{id:10000002,level:90,actived_constellation_num:0,fetter:10},
  base_properties:values.map((final,property_type)=>({final,property_type,base:property_type===1?'1000':'0'})),
  relics:[{name:'Sands',pos:3,level:20,main_property:{property_type:1,value:'46.6%'},sub_property_list:[{property_type:3,value:'10.1%'}]}],
  weapon:{name:'Sword',level:90,affix_level:5,icon:'https://unsafe.example/tracker',main_property:{property_type:1,value:'608'}},
}]};
const [build] = parseHoyolabSnapshot(snapshot);
assert.equal(build.stats.atk,2200);
assert.equal(build.stats.cr,60);
assert.equal(build.stats.cd,210);
assert.equal(build.stats.er,135);
assert.equal(build.base.atk,1000);
assert.equal(build.stats.atkPct,undefined);
assert.equal(build.weapon.icon,'');
assert.equal(build.weapon.refinement,5);
assert.equal(build.artifacts[0].slot,'EQUIP_SHOES');
assert.equal(build.artifacts[0].stats[0].name,'ATK%');
assert.equal(build.artifacts[0].stats[1].value,10.1);
const incomplete = structuredClone(snapshot); incomplete.characters[0].base_properties.pop();
assert.deepEqual(parseHoyolabSnapshot(incomplete),[]);
const malformed = structuredClone(snapshot); malformed.characters[0].base_properties[0].final = 'unavailable';
assert.deepEqual(parseHoyolabSnapshot(malformed),[]);
assert.deepEqual(parseHoyolabSnapshot(null),[]);
const traveler = structuredClone(snapshot); traveler.characters[0].base.id=10000005;traveler.characters[0].base.element='Anemo';
assert.equal(parseHoyolabSnapshot(traveler)[0].character.element,'Wind');
console.log('HoYoLAB parser: 15 checks passed.');

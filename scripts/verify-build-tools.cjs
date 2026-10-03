const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../apps/web/node_modules/typescript');
for(const ext of ['.ts','.tsx']) require.extensions[ext]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
}).outputText,p);
const {characters,weaponEntry}=require('../apps/web/lib/builds.ts');
const {buildProfiles}=require('../apps/web/lib/build-profiles.ts');
for(const c of Object.values(characters)) {
  const profiles=buildProfiles(c.name);
  for(const role of ['dps-custom','support-custom','reaction-custom']) {
    const p=profiles.find(p=>p.id===role);
    assert.ok(p?.manual,`${c.name}: missing ${role}`);
    assert.equal(p.recipe,undefined,'Manual roles must not inherit an unrelated automatic recipe');
  }
}
const hyper=buildProfiles('Raiden Shogun').find(p=>p.id==='hyperbloom');
assert.equal(hyper.levelTarget,90);
assert.deepEqual(hyper.talentIndices,[]);
assert.equal(hyper.recipe.objective,'reaction');
assert.equal(hyper.recipe.mains.circlet,'em');
assert.ok(weaponEntry(hyper.recipe.weaponAccessible));
assert.equal(buildProfiles('Unknown Character')[0].recipe,undefined);
const React=require('../apps/web/node_modules/react');
const {renderToStaticMarkup}=require('../apps/web/node_modules/react-dom/server');
const Comparison=require('../apps/web/components/BuildComparison.tsx').default;
const before={stats:{cr:50,er:200},weapon:{name:'Old Sword',level:80,refinement:1},artifacts:[]};
const after={stats:{cr:60,er:180},weapon:{name:'New Sword',level:90,refinement:2},artifacts:[]};
const html=renderToStaticMarkup(React.createElement(Comparison,{current:after,previous:before,date:'2026-10-03T00:00:00Z'}));
assert.ok(html.includes('+10.0%'));
assert.ok(html.includes('−20.0%'));
assert.ok(html.includes('Old Sword')&&html.includes('New Sword'));
const empty=renderToStaticMarkup(React.createElement(Comparison,{current:after,date:''}));
assert.ok(empty.includes('Belum ada snapshot sebelumnya'));
console.log(`Build tools: all ${Object.keys(characters).length} catalog entries have manual roles; reaction profile and snapshot comparisons passed.`);

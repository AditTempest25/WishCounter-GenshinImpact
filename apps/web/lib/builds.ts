import characterData from './data/build-characters.json';
import labelData from './data/build-labels.json';
import recipeData from './data/build-recipes.json';
import items from './data/item-icons.json';

export type Character = { name: string; icon: string; element: string; weaponType: string; skills: number[]; constellations: string[]; proudMap: Record<string, number> };
export const characters: Record<string, Character> = characterData;
export const labels: Record<string, string> = labelData;
export type Recipe = { mains: Record<string, string>; setRequirement: { kind: string; setKey?: string; setKeys?: string[] }; objective: string; erTarget?: number; statTargets?: Record<string, number>; weapon?: string; weaponAccessible?: string; alternatives?: string[]; source: string; note?: string; patch?: string };
export const recipes = recipeData as Record<string, Recipe>;
export const slug = (name: string) => name.toLowerCase().replaceAll(' ', '_');
export const pretty = (s: string) => s.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
const aliases: Record<string, string> = { 'kamisato_ayaka': 'ayaka', 'kaedehara_kazuha': 'kazuha', 'raiden_shogun': 'raiden', 'sangonomiya_kokomi': 'kokomi', 'arataki_itto': 'itto', 'kamisato_ayato': 'ayato', 'kuki_shinobu': 'kuki', 'yumemizuki_mizuki': 'mizuki', 'shikanoin_heizou': 'heizou' };
export function recipeFor(name: string) { return recipes[slug(name)] ?? recipes[aliases[slug(name)]]; }
export const elementNames: Record<string,string> = { Fire:'Pyro', Water:'Hydro', Ice:'Cryo', Electric:'Electro', Wind:'Anemo', Rock:'Geo', Grass:'Dendro' };
const statNames: Record<string,string> = { FIGHT_PROP_HP:'HP', FIGHT_PROP_ATTACK:'ATK', FIGHT_PROP_DEFENSE:'DEF', FIGHT_PROP_HP_PERCENT:'HP%', FIGHT_PROP_ATTACK_PERCENT:'ATK%', FIGHT_PROP_DEFENSE_PERCENT:'DEF%', FIGHT_PROP_CRITICAL:'CRIT Rate', FIGHT_PROP_CRITICAL_HURT:'CRIT DMG', FIGHT_PROP_CHARGE_EFFICIENCY:'ER', FIGHT_PROP_ELEMENT_MASTERY:'EM', FIGHT_PROP_HEAL_ADD:'Healing Bonus' };
export const mainNames: Record<string,string> = { atk_pct:'ATK%', hp_pct:'HP%', def_pct:'DEF%', elemental_dmg:'Elemental DMG%', physical_dmg:'Physical DMG%', em:'EM', er_pct:'ER%', crit:'CRIT Rate / DMG', crit_rate:'CRIT Rate', crit_dmg:'CRIT DMG', healing_bonus:'Healing Bonus' };
export type Stat = { name: string; value: number; percent: boolean };
export type Equipment = { name: string; icon: string; level: number; rarity: number; set: string; slot: string; refinement: number; stats: Stat[] };
export type Build = { id: string; character: Character; level: number; constellation: number; friendship: number; stats: Record<string, number>; base: Record<string,number>; talents: number[]; weapon?: Equipment; artifacts: Equipment[] };
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
export const iconUrl = (v: unknown) => typeof v === 'string' && /^(UI_|Skill_)[A-Za-z0-9_]+$/.test(v) ? `https://enka.network/ui/${v}.png` : '';
function stat(v: unknown): Stat { const s=obj(v), key=String(s.mainPropId ?? s.appendPropId ?? ''); return {name:statNames[key] ?? labels[key] ?? pretty(key.replace('FIGHT_PROP_','')),value:num(s.statValue ?? s.propValue),percent:/PERCENT|CRITICAL|EFFICIENCY|ADD_HURT|HEAL_ADD/.test(key)}; }
function equipment(v: unknown): Equipment {
  const e=obj(v), f=obj(e.flat), w=obj(e.weapon), a=obj(e.reliquary);
  return {name:labels[String(f.nameTextMapHash)] ?? (items as Record<string,{name:string}>)[String(e.itemId)]?.name ?? 'Equipment',icon:iconUrl(f.icon),level:e.weapon ? num(w.level) : Math.max(0,num(a.level)-1),rarity:num(f.rankLevel),set:labels[String(f.setNameTextMapHash)] ?? '',slot:String(f.equipType ?? ''),refinement:Math.min(5,1+num(Object.values(obj(w.affixMap))[0])),stats:e.weapon ? arr(f.weaponStats).map(stat) : [stat(f.reliquaryMainstat),...arr(f.reliquarySubstats).map(stat)]};
}
export function parseBuild(v: unknown): Build | null {
  const a=obj(v), id=String(a.avatarId ?? ''), key=`${id}-${a.skillDepotId}`;
  const character=characters[key] ?? characters[id]; if(!character) return null;
  const f=obj(a.fightPropMap), props=obj(a.propMap), skills=obj(a.skillLevelMap), bonuses=obj(a.proudSkillExtraLevelMap);
  const gear=arr(a.equipList);
  const stats={hp:num(f['2000']),atk:num(f['2001']),def:num(f['2002']),em:num(f['28']),cr:num(f['20'])*100,cd:num(f['22'])*100,er:num(f['23'])*100,atkPct:num(f['6'])*100,heal:num(f['26'])*100,element:Math.max(...[40,41,42,43,44,45,46].map(k=>num(f[String(k)])))*100};
  return {id:characters[key]?key:id,character,level:num(obj(props['4001']).val),constellation:arr(a.talentIdList).length,friendship:num(obj(a.fetterInfo).expLevel),stats,base:{hp:num(f['1']),atk:num(f['4']),def:num(f['7'])},talents:character.skills.map(k=>num(skills[String(k)])+num(bonuses[String(character.proudMap[String(k)])])),weapon:gear.find(e=>obj(e).weapon) ? equipment(gear.find(e=>obj(e).weapon)) : undefined,artifacts:gear.filter(e=>obj(e).reliquary).map(equipment).sort((a,b)=>slots.indexOf(a.slot)-slots.indexOf(b.slot))};
}
export const slots=['EQUIP_BRACER','EQUIP_NECKLACE','EQUIP_SHOES','EQUIP_RING','EQUIP_DRESS'];
export const slotNames=['Flower','Plume','Sands','Goblet','Circlet'];
export const statLabels: Record<string,string>={hp:'Max HP',atk:'ATK',def:'DEF',em:'Elemental Mastery',cr:'CRIT Rate',cd:'CRIT DMG',er:'Energy Recharge',atkPct:'ATK bonus %',heal:'Healing Bonus',element:'Elemental DMG Bonus'};
export const formatStat=(key:string,value:number) => ['hp','atk','def','em'].includes(key) ? Math.round(value).toLocaleString('en-US') : `${value.toFixed(1)}%`;
export function weaponEntry(key: string) {return Object.values(items).find(e=>e.kind==='weapons' && slug(e.name)===key);}

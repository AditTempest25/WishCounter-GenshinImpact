import { characters, iconUrl, slots, type Build, type Equipment, type Stat } from './builds';
import items from './data/item-icons.json';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const numberValue = (v: unknown) => { const raw = String(v ?? '').replaceAll(',', '').replaceAll('%', '').trim(); return raw === '' ? NaN : Number(raw); };
const numeric = (v: unknown) => { const number = numberValue(v); return Number.isFinite(number) ? number : 0; };
const statAliases: Record<string,string> = { hp:'hp', maxhp:'hp', atk:'atk', attack:'atk', def:'def', defense:'def', elementalmastery:'em', critrate:'cr', critdmg:'cd', critdamage:'cd', energyrecharge:'er', healingbonus:'heal' };
const displayNames: Record<string,string> = { hp:'HP',atk:'ATK',def:'DEF',em:'EM',cr:'CRIT Rate',cd:'CRIT DMG',er:'ER',heal:'Healing Bonus' };
const compact = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');

export function parseHoyolabSnapshot(value: unknown): Build[] {
  const snapshot = obj(value), properties = obj(snapshot.property_map);
  function name(p: Obj) { return String(obj(properties[String(p.property_type)]).name ?? ''); }
  function stat(value: unknown): Stat {
    const p = obj(value), raw = String(p.value ?? p.final ?? ''), original = name(p);
    const key = statAliases[compact(original)];
    const percent = raw.includes('%');
    return { name: key ? `${displayNames[key]}${percent && ['hp','atk','def'].includes(key) ? '%' : ''}` : original, value: numeric(raw), percent };
  }
  function gear(value: unknown, artifact: boolean): Equipment {
    const e = obj(value), item = (items as Record<string,{name:string;icon:string}>)[String(e.id)];
    return { name: String(e.name ?? item?.name ?? 'Equipment'), icon: iconUrl(e.icon) || item?.icon || '', level: numeric(e.level), rarity: numeric(e.rarity), set: String(obj(e.set).name ?? ''), slot: artifact ? slots[Math.max(0,numeric(e.pos)-1)] ?? '' : '', refinement: numeric(e.affix_level) || 1, stats: [stat(e.main_property), ...(artifact ? arr(e.sub_property_list).map(stat) : e.sub_property ? [stat(e.sub_property)] : [])].filter(s=>s.name) };
  }
  return arr(snapshot.characters).flatMap(value => {
    const c = obj(value), b = obj(c.base), rawId = String(b.id);
    const elementAliases: Record<string,string> = { Anemo:'Wind',Geo:'Rock',Electro:'Electric',Dendro:'Grass',Hydro:'Water',Pyro:'Fire',Cryo:'Ice' };
    const element = elementAliases[String(b.element)] ?? String(b.element);
    const variant = Object.keys(characters).find(key=>key.startsWith(`${rawId}-`) && characters[key].element===element);
    const id = variant ?? rawId, character = characters[id];
    if (!character) return [];
    const stats: Record<string,number> = {}, base: Record<string,number> = {};
    const propertyList = [...arr(c.base_properties), ...arr(c.extra_properties), ...arr(c.element_properties)];
    for (const entry of propertyList) {
      const p = obj(entry), propertyName = name(p), key = statAliases[compact(propertyName)];
      if (key && Number.isFinite(numberValue(p.final))) { stats[key] = numeric(p.final); if (['hp','atk','def'].includes(key)) base[key] = numeric(p.base); }
      if (/DMG Bonus/i.test(propertyName) && !/physical/i.test(propertyName)) stats.element = Math.max(stats.element ?? 0, numeric(p.final));
    }
    // Never evaluate a detail response without the core combat properties.
    if (!['hp','atk','def','cr','cd','er'].every(key => key in stats)) return [];
    stats.em ??= 0; stats.heal ??= 0; stats.element ??= 0;
    const skills = arr(c.skills).map(obj);
    const talents = character.skills.map(id=>numeric(skills.find(s=>numeric(s.skill_id)===id)?.level)).filter(level=>level>0);
    return [{id,character,level:numeric(b.level),constellation:numeric(b.actived_constellation_num),friendship:numeric(b.fetter),stats,base,talents,weapon:c.weapon ? gear(c.weapon,false) : undefined,artifacts:arr(c.relics).map(a=>gear(a,true)).sort((a,b)=>slots.indexOf(a.slot)-slots.indexOf(b.slot))}];
  });
}

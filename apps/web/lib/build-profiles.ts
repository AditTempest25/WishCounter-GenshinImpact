import { recipeFor, type Recipe } from './builds';

export type BuildProfile = { id: string; label: string; recipe?: Recipe; levelTarget?: number; talentIndices?: number[]; manual?:boolean };
export function buildProfiles(name: string): BuildProfile[] {
  const recipe = recipeFor(name);
  const profiles: BuildProfile[] = [{id:'reference', label:name==='Raiden Shogun'?'Burst DPS':'Profil referensi', recipe,
    talentIndices:name==='Raiden Shogun'?[2,1]:undefined}];
  if (name === 'Raiden Shogun') profiles.push({id:'hyperbloom',label:'Hyperbloom trigger',levelTarget:90,talentIndices:[],recipe:{
    mains:{sands:'em',goblet:'em',circlet:'em'},setRequirement:{kind:'4pc',setKey:'GildedDreams'},objective:'reaction',
    weaponAccessible:'dragons_bane',alternatives:['moonpiercer','kitain_cross_spear'],
    source:'https://keqingmains.com/q/raiden-quickguide/',patch:'5.7',
    note:'Prioritaskan level 90 dan EM untuk Hyperbloom. CRIT dan ER bukan target utama profil ini. Gilded Dreams adalah salah satu opsi; 2pc EM + 2pc EM dan Flower of Paradise Lost juga dapat digunakan.',
  }});
  profiles.push(
    {id:'dps-custom',label:'DPS / on-field · target sendiri',manual:true},
    {id:'support-custom',label:'Support / off-field · target sendiri',manual:true},
    {id:'reaction-custom',label:'Pemicu reaksi · target sendiri',manual:true},
  );
  return profiles;
}

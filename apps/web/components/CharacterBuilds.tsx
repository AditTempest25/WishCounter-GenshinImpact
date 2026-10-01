"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { characters, elementNames, formatStat, mainNames, parseBuild, pretty, recipeFor, slotNames, slots, statLabels, weaponEntry, type Build, type Equipment } from '../lib/builds';

function Art({ src, fallback = '', className = '' }: {src:string;fallback?:string;className?:string}) {
  const [failed,setFailed]=useState<string[]>([]);
  const current=[src,fallback].find(url=>url&&!failed.includes(url));
  return current ? <Image className={className} src={current} alt="" width={380} height={380} unoptimized onError={()=>setFailed(previous=>[...previous,current])}/> : <span className={`build-art-fallback ${className}`} aria-hidden="true">✦</span>;
}
const roster=Object.entries(characters).sort((a,b)=>a[1].name.localeCompare(b[1].name));

function EquipmentCard({ gear, slot }: {gear?:Equipment;slot:string}) {
  return <article className="build-artifact"><span className="eyebrow">{slot}</span>{gear ? <><Art src={gear.icon}/><strong title={gear.name}>{gear.name}</strong><small>+{gear.level} · {'★'.repeat(Math.max(0,Math.min(5,gear.rarity)))}</small><p className="build-main-stat">{gear.stats[0]?.name} <b>{gear.stats[0]?.value}{gear.stats[0]?.percent?'%':''}</b></p><ul>{gear.stats.slice(1).map((s,i)=><li key={i}><span>{s.name}</span><b>{s.value}{s.percent?'%':''}</b></li>)}</ul><small>{gear.set}</small></> : <p>Belum terpasang</p>}</article>;
}
function Recommendations({ name, build }: {name:string;build?:Build}) {
  const recipe=recipeFor(name);
  const [cr,setCr]=useState('70'), [cd,setCd]=useState('140'), [er,setEr]=useState(String(recipe?.erTarget ?? '')), [atk,setAtk]=useState(''), [critBuff,setCritBuff]=useState('0');
  const wantsCrit=recipe?.objective==='crit_value';
  const missing:string[]=[];
  const effectiveCrit=build ? build.stats.cr+Math.max(0,Number(critBuff)||0) : 0;
  const compact=(v:string)=>v.toLowerCase().replace(/[^a-z]/g,'');
  if(build) {
    if(build.level<80) missing.push('Naikkan level karakter setidaknya ke 80; kebutuhan level 90 bergantung scaling/reaction.');
    if(!build.weapon || build.weapon.level<90) missing.push('Periksa prioritas menaikkan senjata ke level 90.');
    if(build.artifacts.length<5) missing.push(`Lengkapi ${5-build.artifacts.length} slot artefak.`);
    if(build.artifacts.some(a=>a.level<20 && a.rarity===5)) missing.push('Masih ada artefak 5★ di bawah +20.');
    if(recipe) {
      for(const [slot,expected] of Object.entries(recipe.mains)) {
        const slotId: string|undefined=({sands:'EQUIP_SHOES',goblet:'EQUIP_RING',circlet:'EQUIP_DRESS'} as Record<string,string>)[slot];
        const main=build.artifacts.find(a=>a.slot===slotId)?.stats[0]?.name;
        const matches=expected==='crit'?main?.includes('CRIT'):expected==='elemental_dmg'?(main?.includes('DMG')&&!main?.includes('CRIT')&&!main?.includes('Physical')):main===mainNames[expected];
        if(main&&!matches)missing.push('Main stat '+slot+' ('+main+') berbeda dari profil '+(mainNames[expected]??expected)+'; periksa variasi build yang kamu pakai.');
      }
      const sets=recipe.setRequirement.setKeys??[recipe.setRequirement.setKey??''];
      for(const set of sets){if(set&&build.artifacts.every(a=>a.set)&&build.artifacts.filter(a=>compact(a.set)===compact(set)).length<(recipe.setRequirement.kind==='4pc'?4:2))missing.push('Set '+pretty(set)+' belum memenuhi profil '+recipe.setRequirement.kind+'.');}
    }
    if(build.talents.some(n=>n<6)) missing.push('Ada talent di bawah level 6; naikkan hanya talent yang dipakai dalam rotasi.');
    if(wantsCrit && effectiveCrit>100) missing.push('CRIT Rate melewati 100%; evaluasi kelebihan CR setelah buff.');
    for(const [key,target]of [['cr',wantsCrit?cr:''],['cd',wantsCrit?cd:''],['er',er],['atk',atk]] as const){if(target!==''&&Number.isFinite(Number(target))&&Number(target)>0&&(key==='cr'?effectiveCrit:build.stats[key])<Number(target))missing.push(`${statLabels[key]} kurang ${formatStat(key,Number(target)-(key==='cr'?effectiveCrit:build.stats[key]))} dari target pilihanmu.`);}
  }
  const weapons=recipe ? [recipe.weaponAccessible,...(recipe.alternatives??[])].filter((w):w is string=>!!w) : [];
  return <section className="build-recommendations" aria-label="Rekomendasi build"><div className="section-heading"><div><p className="eyebrow">BUILD CHECK</p><h3>Apa yang bisa ditingkatkan?</h3></div><span className="build-badge">{build?'Evaluasi target':'Panduan karakter'}</span></div>
    <p className="subtle">Target adalah patokan yang dapat diubah, bukan minimum wajib atau peringkat Akasha. Stat showcase belum tentu memasukkan buff set, tim, dan senjata yang aktif saat bertarung.</p>
    {recipe ? <><div className="build-priorities">{Object.entries(recipe.mains).map(([slot,value])=><div key={slot}><small>{pretty(slot)}</small><strong>{mainNames[value]??pretty(value)}</strong></div>)}<div><small>Set referensi</small><strong>{recipe.setRequirement.kind} {(recipe.setRequirement.setKeys??[recipe.setRequirement.setKey??'Lihat panduan sumber']).map(pretty).join(' + ')}</strong></div></div><p className="subtle">Profil komunitas patch {recipe.patch??'6.7'} · <a href={recipe.source} target="_blank" rel="noreferrer">Baca konteks tim & rotasi ↗</a></p>{recipe.note&&<p>{recipe.note}</p>}</> : <p className="build-notice">Rekomendasi spesifik {name} belum terverifikasi di katalog ini. Stat aktual tetap bisa dilihat; evaluasi dasar tidak mengasumsikan karakter ini membutuhkan ATK atau CRIT. <a href="https://keqingmains.com/" target="_blank" rel="noreferrer">Cari panduan KQM ↗</a></p>}
    <details><summary>Sesuaikan target stat {wantsCrit?'· patokan awal CR 70 / CD 140':''}</summary><p className="subtle">Isi sesuai build dan buff tim. ATK menggunakan nilai total, bukan persentase: senjata dengan base ATK berbeda membutuhkan ATK% berbeda. Kosongkan target yang tidak relevan. ER profil komunitas perlu disesuaikan dengan rotasi. Isi Bonus CR hanya jika buff set/tim aktif dan belum masuk angka showcase.</p><div className="build-targets">{(wantsCrit ? [['CRIT Rate %',cr,setCr],['CRIT DMG %',cd,setCd],['ER %',er,setEr],['Total ATK',atk,setAtk],['Bonus CR aktif %',critBuff,setCritBuff]] : [['ER %',er,setEr],['Total ATK',atk,setAtk]]).map(([label,value,set])=><label key={label as string}>{label as string}<input type="number" min="0" max="10000" step="0.1" value={value as string} onChange={e=>(set as (v:string)=>void)(e.target.value)}/></label>)}</div></details>
    {build&&<div className="build-findings" role="status">{missing.length ? <ul>{missing.map(m=><li key={m}>{m}</li>)}</ul> : <p>Target yang diperiksa sudah terpenuhi. Tetap periksa main stat, set, buff, dan rotasi; ini belum berarti build optimal.</p>}</div>}
    <h4>Tanpa signature, pakai apa?</h4>{weapons.length ? <div className="build-weapons">{weapons.map(key=>{const w=weaponEntry(key);return <article key={key}><Art src={w?.icon??''}/><div><strong>{w?.name??pretty(key)}</strong><p>Alternatif dalam profil ini. Cek refinement, syarat pasif, dan cara memperoleh di panduan sumber.</p></div></article>;})}</div> : <p className="subtle">Alternatif senjata untuk profil ini belum terverifikasi. Tidak semua senjata satu jenis cocok dengan scaling karakter.</p>}
    {recipe?.weapon&&<p className="subtle">Senjata acuan profil: {weaponEntry(recipe.weapon)?.name??pretty(recipe.weapon)}. Bukan syarat memakai karakter.</p>}
  </section>;
}

export default function CharacterBuilds({uid,privateMode}:{uid:string|null;privateMode:boolean}) {
  const [selected,setSelected]=useState('10000150'),[search,setSearch]=useState(''),[onlyShowcase,setOnlyShowcase]=useState(false);
  const [builds,setBuilds]=useState<Build[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[refreshAfter,setRefreshAfter]=useState(''),[fetchedAt,setFetchedAt]=useState(''),[now,setNow]=useState(0);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{if(!refreshAfter)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[refreshAfter]);
  const waiting=Math.max(0,Math.ceil((Date.parse(refreshAfter)-now)/1000))||0;
  async function load(){if(!uid)return;request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');try{const response=await apiFetch(`/api/backend/accounts/${encodeURIComponent(uid)}/builds`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)]),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.message??'Showcase gagal dimuat.');const parsed:Build[]=(Array.isArray(data.characters)?data.characters:[]).map(parseBuild).filter((b:Build|null)=>!!b);if(controller.signal.aborted)return;setBuilds(parsed);setLoaded(true);setRefreshAfter(data.refresh_after);setFetchedAt(data.fetched_at);setNow(Date.now());if(parsed.length){setSelected(parsed[0].id);setOnlyShowcase(true);}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Showcase gagal dimuat.');}finally{if(request.current===controller)setBusy(false);}}
  const character=characters[selected]??characters['10000002'];
  const current=builds.find(b=>b.id===selected);
  const filtered=roster.filter(([id,c])=>(!onlyShowcase||builds.some(b=>b.id===id))&&`${c.name} ${elementNames[c.element]??''}`.toLowerCase().includes(search.toLowerCase()));
  function saveCard(){if(!current)return;const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=760;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#10231e';ctx.fillRect(0,0,1200,760);ctx.fillStyle='#d9c38b';ctx.font='bold 38px sans-serif';ctx.fillText(`${character.name} · Lv.${current.level} · C${current.constellation}`,48,75);ctx.fillStyle='#c6d7cf';ctx.font='20px sans-serif';ctx.fillText(privateMode?'Irminsul · UID disembunyikan':`Irminsul · UID ${uid}`,48,110);Object.entries(current.stats).forEach(([key,value],i)=>{const x=48+(i%2)*570,y=170+Math.floor(i/2)*48;ctx.fillText(`${statLabels[key]}: ${formatStat(key,value)}`,x,y);});ctx.fillStyle='#d9c38b';ctx.fillText(`${current.weapon?.name??'Tanpa senjata'} · Lv.${current.weapon?.level??0} · R${current.weapon?.refinement??1}`,48,440);current.artifacts.forEach((a,i)=>{ctx.fillStyle='#c6d7cf';ctx.fillText(`${slotNames[slots.indexOf(a.slot)]??'Artefak'} +${a.level}: ${a.stats[0]?.name} ${a.stats[0]?.value}${a.stats[0]?.percent?'%':''}`,48,485+i*37);});ctx.font='16px sans-serif';ctx.fillText('Stat showcase via Enka.Network · Tidak termasuk seluruh buff tempur',48,720);canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`irminsul-${character.name.replace(/[^a-z0-9]/gi,'-')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
  const art=character.icon.replace('UI_AvatarIcon_','UI_Gacha_AvatarImg_');
  return <section id="characters" className="content-section character-builds"><div className="section-heading"><div><p className="eyebrow">YOUR CHARACTERS, THEIR POTENTIAL</p><h2>Character atelier</h2></div><span className="build-badge">{roster.filter(([id])=>!id.includes('-')).length} karakter</span></div>
    <div className="build-toolbar"><label>Cari karakter<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama atau elemen…"/></label><label>Tampilkan<select value={onlyShowcase?'showcase':'all'} onChange={e=>setOnlyShowcase(e.target.value==='showcase')}><option value="all">Semua karakter</option><option value="showcase">Build showcase ({builds.length})</option></select></label><button className="secondary" disabled={!uid||busy||waiting>0} onClick={load}>{busy?'Memuat showcase…':waiting>0?`Refresh dalam ${waiting}s`:'Muat build akun'}</button></div>
    <details className="build-help"><summary>Cara menampilkan build karakter milikmu</summary><p>Di profil Genshin, tambahkan karakter ke Character Showcase dan aktifkan “Show Character Details”. Lalu klik Muat build akun. UID akun terpilih dikirim ke Enka.Network untuk membaca showcase publik. Tidak membutuhkan cookie HoYoLAB. Data dapat tertunda sesuai cache Enka.</p><p>Showcase hanya sebagian roster. Karakter yang tidak muncul bukan berarti belum dimiliki. Katalog “Semua karakter” bisa dibuka tanpa memilikinya.</p></details>
    {!uid&&<p className="build-notice">Sync atau impor wish akun terlebih dahulu untuk menghubungkan UID. Kamu tetap bisa menjelajahi katalog.</p>}{error&&<p role="alert" className="build-notice">{error}</p>}{loaded&&!builds.length&&<p role="status" className="build-notice">Showcase kosong atau detail disembunyikan. Aktifkan detail karakter di profil Genshin, lalu tunggu waktu refresh.</p>}
    <div className="build-roster" aria-label="Pilih karakter">{filtered.map(([id,c])=><button key={id} type="button" aria-pressed={selected===id} onClick={()=>setSelected(id)} title={`${c.name}${id.includes('-')?' · '+elementNames[c.element]:''}`}><Art src={c.icon}/><span>{c.name}{id.includes('-')?` · ${elementNames[c.element]}`:''}</span>{builds.some(b=>b.id===id)&&<small>Showcase</small>}</button>)}</div>{!filtered.length&&<p className="subtle">Tidak ada karakter yang cocok dengan filter.</p>}
    <div className="build-sheet"><div className="build-portrait"><Art src={art} fallback={character.icon} className="build-splash"/><div><span className="eyebrow">{elementNames[character.element]??'GENSHIN IMPACT'}</span><h3>{character.name}</h3><p>{current?`Lv.${current.level} · C${current.constellation} · Friendship ${current.friendship}`:'Katalog karakter · Build belum dimuat'}</p><div className="build-constellations" aria-label="Konstelasi">{Array.from({length:6},(_,i)=><span key={i} className={current&&i<current.constellation?'unlocked':''}>C{i+1}</span>)}</div>{current&&<p>Talent NA / Skill / Burst: {current.talents.length?current.talents.join(' / '):'metadata belum tersedia'}</p>}</div></div>
    <div className="build-details"><div className="section-heading"><h3>Stat karakter</h3><button className="secondary" disabled={!current} onClick={saveCard}>Unduh kartu PNG</button></div>{current ? <><dl className="build-stat-grid">{Object.entries(current.stats).map(([key,value])=><div key={key}><dt>{statLabels[key]}{current.base[key]>0&&<small>Base {Math.round(current.base[key])} + {Math.round(value-current.base[key])}</small>}</dt><dd>{formatStat(key,value)}</dd></div>)}</dl><div className="build-weapon"><Art src={current.weapon?.icon??''}/><div><small>SENJATA TERPASANG</small><h4>{current.weapon?.name??'Tidak ada senjata'}</h4><p>Lv.{current.weapon?.level??0} · R{current.weapon?.refinement??1}</p><p>{current.weapon?.stats.map(s=>`${s.name} ${s.value}${s.percent?'%':''}`).join(' · ')}</p></div></div><p className="subtle">Snapshot: {new Date(fetchedAt).toLocaleString('id-ID')} · <a href="https://enka.network/" target="_blank" rel="noreferrer">Enka.Network ↗</a></p></> : <div className="build-empty"><span>✦</span><h4>Kenali potensinya</h4><p>Pilih karakter dari showcase untuk melihat stat aktual. Untuk karakter lain, lihat profil rekomendasi di bawah.</p></div>}</div>
    {current&&<div className="build-artifacts">{slots.map((slot,i)=><EquipmentCard key={slot} slot={slotNames[i]} gear={current.artifacts.find(a=>a.slot===slot)}/>)}</div>}</div>
    <Recommendations key={`${selected}:${fetchedAt}`} name={character.name} build={current}/>
  </section>;
}

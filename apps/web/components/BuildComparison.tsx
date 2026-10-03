import { formatStat, statLabels, slotNames, slots, type Build } from '../lib/builds';

export default function BuildComparison({current,previous,date}:{current:Build;previous?:Build;date:string}) {
  return <section className="build-recommendations build-comparison" aria-label="Perbandingan snapshot"><h3>Perubahan sejak sync sebelumnya</h3>
    {!previous ? <p className="subtle">Belum ada snapshot sebelumnya untuk karakter ini. Sync HoYoLAB berikutnya akan menyimpan pembanding.</p> : <>
      <p className="subtle">Dibandingkan dengan {new Date(date).toLocaleString('id-ID')}. Kenaikan angka belum tentu lebih baik untuk peran yang dipilih.</p>
      <div className="build-comparison-stats">{Object.entries(current.stats).filter(([key])=>Number.isFinite(previous.stats[key])).map(([key,value])=>{
        const delta=value-previous.stats[key];
        return <div key={key}><small>{statLabels[key]}</small><strong>{formatStat(key,value)}</strong><span>{Math.abs(delta)<.05?'Tetap':`${delta>0?'+':'−'}${formatStat(key,Math.abs(delta))}`}</span></div>;
      })}</div>
      <p>Senjata: {previous.weapon?.name??'Belum terpasang'} Lv.{previous.weapon?.level??0} R{previous.weapon?.refinement??1} → {current.weapon?.name??'Belum terpasang'} Lv.{current.weapon?.level??0} R{current.weapon?.refinement??1}</p>
      <ul>{slots.map((slot,i)=>{const old=previous.artifacts.find(a=>a.slot===slot),now=current.artifacts.find(a=>a.slot===slot);const changed=JSON.stringify(old)!==JSON.stringify(now);return <li key={slot}>{slotNames[i]}: {changed?`${old?.name??'Kosong'} +${old?.level??0} → ${now?.name??'Kosong'} +${now?.level??0} · detail berubah`:'Tidak berubah'}</li>;})}</ul>
    </>}
  </section>;
}

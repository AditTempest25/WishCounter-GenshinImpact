"use client";

import { useEffect, useState } from "react";
import type { AccountStats } from "../lib/api";
import { bannerNames } from "./WishInsights";
import { downloadBlob } from "./ArchiveTools";

export function JourneyCharts({ stats }: { stats: AccountStats | null }) {
  const [banner, setBanner] = useState("all");
  const [range, setRange] = useState("12");
  const months = Object.entries(stats?.analytics?.months ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const filled: { month: string; count: number }[] = [];
  if (months.length) {
    const start = new Date(`${months[0][0]}-01T00:00:00Z`);
    const end = new Date(`${months[months.length - 1][0]}-01T00:00:00Z`);
    // Limit malformed or extremely old imported dates to a useful display window.
    start.setUTCFullYear(Math.max(start.getUTCFullYear(), end.getUTCFullYear() - 20));
    for (let date = start; date <= end; date.setUTCMonth(date.getUTCMonth() + 1)) {
      const month = date.toISOString().slice(0, 7);
      const groups = stats?.analytics?.months?.[month] ?? {};
      filled.push({ month, count: banner === "all" ? Object.values(groups).reduce((a, b) => a + b, 0) : groups[banner] ?? 0 });
    }
  }
  const visible = range === "all" ? filled : filled.slice(-Number(range));
  const max = Math.max(1, ...visible.map(row => row.count));
  const journey = (stats?.analytics?.journey ?? []).filter(row => banner === "all" || row.banner === banner).slice(-30);
  const maxPity = Math.max(1, ...journey.map(row => row.pulls));
  return <section id="journey" className="content-section"><div className="section-heading"><div><p className="eyebrow">YOUR WISH JOURNEY</p><h2>Perjalanan wish</h2></div><div className="tool-actions"><label>Banner grafik<select value={banner} onChange={e => setBanner(e.target.value)}><option value="all">Semua banner</option>{Object.entries(bannerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Rentang bulan<select value={range} onChange={e => setRange(e.target.value)}><option value="12">12 bulan arsip terakhir</option><option value="all">Seluruh arsip (maks. 20 tahun)</option></select></label></div></div>
    <div className="utility-panel"><h3>Pull per bulan</h3>{visible.length ? <div className="bar-chart" role="list" aria-label="Jumlah wish per bulan">{visible.map(row => <div className="chart-row" role="listitem" key={row.month}><span>{row.month}</span><div className="chart-track"><div style={{ width: `${row.count / max * 100}%` }} /></div><b>{row.count}</b></div>)}</div> : <p>Sync atau impor arsip untuk melihat grafik.</p>}<p className="data-note">Bulan kosong dalam rentang arsip ditampilkan sebagai 0. Ini jumlah wish tersimpan, bukan perkiraan pengeluaran.</p></div>
    <div className="utility-panel"><h3>Jarak antar-5★ · 30 hasil terakhir</h3>{journey.length ? <div className="bar-chart" role="list" aria-label="Interval 5 bintang">{journey.map(row => <div className="chart-row interval-row" role="listitem" key={row.id}><span title={row.time}>{row.name}<small>{bannerNames[row.banner]} · {row.time.slice(0, 10)}</small></span><div className="chart-track"><div style={{ width: `${row.pulls / maxPity * 100}%` }} /></div><b>{!row.complete && "≥"}{row.pulls}</b></div>)}</div> : <p>Belum ada 5★ dalam pilihan ini.</p>}<p className="data-note">Urutan lama → baru. Jarak dihitung di banner masing-masing; ≥ menandai awal arsip yang mungkin terpotong.</p></div>
  </section>;
}

type Plan = { target: string; primo: number; fates: number };
export function WishPlanner({ stats }: { stats: AccountStats | null }) {
  const [plan, setPlan] = useState<Plan>({ target: "", primo: 0, fates: 0 });
  const [message, setMessage] = useState("");
  const uid = stats?.uid;
  useEffect(() => {
    setPlan({ target: "", primo: 0, fates: 0 }); setMessage("");
    if (!uid) return;
    try { const p = JSON.parse(localStorage.getItem(`irminsul:plan:v1:${uid}`) ?? "null"); if (p && typeof p.target === "string" && Number.isSafeInteger(p.primo) && p.primo >= 0 && Number.isSafeInteger(p.fates) && p.fates >= 0) setPlan(p); } catch { /* Manual entry remains available. */ }
  }, [uid]);
  const banner = stats?.banners["301"];
  const status = stats?.next_guarantee?.["301"];
  const savedPulls = Math.floor(plan.primo / 160) + plan.fates;
  const validPity = banner && banner.current_pity >= 0 && banner.current_pity < banner.hard_pity;
  const remaining = validPity ? banner.hard_pity - banner.current_pity + (status === "guaranteed" ? 0 : banner.hard_pity) : null;
  const shortage = remaining === null ? null : Math.max(0, remaining - savedPulls);
  return <section id="planner" className="content-section utility-panel"><div className="section-heading"><div><p className="eyebrow">THE NEXT ENCOUNTER</p><h2>Target wish</h2></div></div><p>Rencana manual untuk karakter featured pilihanmu pada Character Event. Tabungan tidak dibaca dari game.</p>
    <form className="planner-form" onSubmit={e => { e.preventDefault(); if (!uid) return; try { localStorage.setItem(`irminsul:plan:v1:${uid}`, JSON.stringify(plan)); setMessage("Rencana tersimpan di browser ini."); } catch { setMessage("Browser tidak mengizinkan penyimpanan. Rencana hanya bertahan selama halaman terbuka."); } }}>
      <label>Target karakter<input maxLength={60} value={plan.target} placeholder="Nama karakter impian…" onChange={e => setPlan({ ...plan, target: e.target.value })} /></label>
      <label>Primogem<input type="number" min="0" max="100000000" step="1" value={plan.primo} onChange={e => setPlan({ ...plan, primo: Math.max(0, Math.min(100000000, Math.floor(Number(e.target.value) || 0))) })} /></label>
      <label>Intertwined Fate<input type="number" min="0" max="1000000" step="1" value={plan.fates} onChange={e => setPlan({ ...plan, fates: Math.max(0, Math.min(1000000, Math.floor(Number(e.target.value) || 0))) })} /></label>
      <button className="secondary" disabled={!uid} type="submit">Simpan rencana</button>
    </form><div className="planner-result"><strong>{savedPulls.toLocaleString("id-ID")} pull tersedia</strong><span>{remaining === null ? "Butuh data pity yang valid untuk menghitung kebutuhan." : `Skenario konservatif: ${remaining} pull lagi · kurang ${shortage} pull (ekuivalen ${(shortage! * 160).toLocaleString("id-ID")} Primo).`}</span></div>
    <p className="data-note">{status === "unknown" || !status ? "Status guaranteed belum diketahui; perhitungan memakai skenario belum guaranteed. " : ""}Berdasarkan hard pity dan arsip tersimpan; data yang terpotong dapat mengubah perkiraan. Tidak memprediksi hasil pull, jadwal banner, Capturing Radiance, atau pendapatan Primo mendatang.</p><p role="status">{message}</p>
  </section>;
}

export function ShareArchive({ stats, privateMode }: { stats: AccountStats | null; privateMode: boolean }) {
  const [message, setMessage] = useState("");
  function saveCard() {
    if (!stats) return;
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 700;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error();
      ctx.fillStyle = "#0c1917"; ctx.fillRect(0, 0, 1200, 700);
      ctx.strokeStyle = "#507d65"; ctx.lineWidth = 2; ctx.strokeRect(28, 28, 1144, 644);
      ctx.fillStyle = "#b3d8a2"; ctx.font = "22px sans-serif"; ctx.fillText("IRminsul / WISH ARCHIVE".toUpperCase(), 70, 95);
      ctx.fillStyle = "#f3efdf"; ctx.font = "bold 52px sans-serif"; ctx.fillText("Every wish, remembered.", 70, 175);
      ctx.font = "24px sans-serif"; ctx.fillStyle = "#adc2b8"; ctx.fillText(privateMode ? "UID disembunyikan" : `UID ${stats.uid}`, 70, 225);
      const metrics = [["TOTAL WISH", stats.total_wishes], ["5★ DITEMUKAN", stats.analytics?.overall.five_stars ?? "—"], ["4★ DITEMUKAN", stats.analytics?.overall.four_stars ?? "—"]];
      metrics.forEach(([label, value], i) => { const x = 70 + i * 365; ctx.fillStyle = "#c9d8cd"; ctx.font = "20px sans-serif"; ctx.fillText(String(label), x, 335); ctx.fillStyle = "#e3c48a"; ctx.font = "bold 65px sans-serif"; ctx.fillText(String(value), x, 420); });
      ctx.fillStyle = "#adc2b8"; ctx.font = "22px sans-serif"; ctx.fillText(`Character pity: ${stats.banners["301"]?.current_pity ?? "—"} · Weapon pity: ${stats.banners["302"]?.current_pity ?? "—"}`, 70, 515);
      ctx.font = "18px sans-serif"; ctx.fillText("Berdasarkan arsip tersimpan • Fan-made • " + new Date().toLocaleDateString("id-ID"), 70, 610);
      canvas.toBlob(blob => { if (blob) { downloadBlob(blob, "irminsul-wish-card.png"); setMessage("Kartu PNG diunduh."); } else setMessage("Gambar belum bisa dibuat."); }, "image/png");
    } catch { setMessage("Browser belum bisa membuat gambar. Coba Chrome atau Edge."); }
  }
  return <div className="share-tools"><button className="secondary" disabled={!stats} onClick={saveCard}>Unduh kartu ringkasan PNG</button><span className="subtle">{privateMode ? "UID disembunyikan di kartu." : "UID akan terlihat di kartu."}</span><span role="status">{message}</span></div>;
}

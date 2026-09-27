"use client";

import { useState } from "react";
import { Gem, Sparkles, Star, TrendingDown, TrendingUp, Orbit } from "lucide-react";
import type { AccountStats, SyncSummary } from "../lib/api";

export const bannerNames: Record<string, string> = {
  "100": "Beginners’ Wish", "200": "Standard", "301": "Character Event",
  "302": "Weapon Event", "500": "Chronicled Wish",
};
const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("id-ID", { maximumFractionDigits: 1 });

export function SyncSummaryLine({ summary }: { summary: SyncSummary }) {
  return <span className="sync-summary-chips"><span>{number(summary.new_wishes)} wish baru</span><span>{summary.five_stars} × 5★</span><span>{summary.four_stars} × 4★</span><span>{summary.three_stars} × 3★</span></span>;
}

export default function WishInsights({ stats }: { stats: AccountStats | null }) {
  const [group, setGroup] = useState("all");
  const metrics = group === "all" ? stats?.analytics?.overall : stats?.analytics?.banners[group];
  const total = group === "all" ? stats?.total_wishes : stats?.banners[group]?.total_wishes;
  return <section className="content-section" id="insights">
    <div className="section-heading"><div><p className="eyebrow">THE STORY IN YOUR STARS</p><h2>Wish insights</h2></div>
      <label className="compact-filter"><span className="sr-only">Banner statistik</span><select value={group} onChange={e => setGroup(e.target.value)}><option value="all">Semua banner</option>{Object.entries(bannerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    <div className="insight-grid">
      {[
        { label: "5★ ditemukan", value: number(metrics?.five_stars ?? (stats && total === 0 ? 0 : undefined)), detail: "Termasuk duplikat dalam arsip", icon: Sparkles },
        { label: "4★ ditemukan", value: number(metrics?.four_stars ?? (stats && total === 0 ? 0 : undefined)), detail: "Karakter dan senjata", icon: Star },
        { label: "Rata-rata jarak 5★", value: number(metrics?.average_pity), detail: `${number(metrics?.interval_count ?? (stats ? 0 : undefined))} interval tercatat`, icon: Orbit },
        { label: "5★ tercepat", value: number(metrics?.fastest_pity), detail: "Pull sejak 5★ sebelumnya", icon: TrendingDown },
        { label: "5★ terlama", value: number(metrics?.longest_pity), detail: "Pull sejak 5★ sebelumnya", icon: TrendingUp },
        { label: "Ekuivalen Primogem", value: number(total == null ? undefined : total * 160), detail: "Patokan 160 Primo per wish", icon: Gem },
      ].map(card => <article className="insight-card" key={card.label}><div><card.icon size={17} /><span>{card.label}</span></div><strong>{card.value}</strong><p>{card.detail}</p></article>)}
    </div>
    <p className="data-note">Interval dihitung terpisah per banner, lalu digabung untuk pilihan semua banner. 5★ pertama setiap banner dan Beginners’ Wish tidak masuk statistik interval. Arsip yang berlubang dapat membuat hitungan lebih rendah. Ekuivalen Primo bukan pengeluaran asli dan tidak memperhitungkan diskon Beginners’ Wish.</p>
    {stats?.last_sync_summary && <div className="last-sync-result"><span>Hasil sync terakhir</span><SyncSummaryLine summary={stats.last_sync_summary} /></div>}
  </section>;
}

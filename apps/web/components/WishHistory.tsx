"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { getWishHistory, type WishHistoryPage } from "../lib/api";
import ItemIcon from "./ItemIcon";

const bannerNames: Record<string, string> = {
  "100": "Beginners’ Wish", "200": "Standard", "301": "Character Event",
  "302": "Weapon Event", "500": "Chronicled Wish",
};

export default function WishHistory({ uid, revision }: { uid: string | null; revision: object | null }) {
  const [banner, setBanner] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<WishHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!uid) { setResult(null); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    getWishHistory(uid, page, banner, rarity, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error && e.name === "TimeoutError"
          ? "API belum merespons. Coba muat ulang history."
          : e instanceof Error ? e.message : "History belum bisa dimuat.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [uid, page, banner, rarity, retry, revision]);

  return <section id="history" className="content-section">
    <div className="section-heading">
      <div><p className="eyebrow">EVERY PULL HAS A PLACE</p><h2>Wish history</h2></div>
      <span className="subtle">Terbaru lebih dulu · 20 per halaman</span>
    </div>
    <div className="history-filters">
      <label>Banner<select value={banner} onChange={e => { setBanner(e.target.value); setPage(1); }}>
        <option value="all">Semua banner</option>
        {Object.entries(bannerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>Rarity<select value={rarity} onChange={e => { setRarity(e.target.value); setPage(1); }}>
        <option value="all">Semua rarity</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option>
      </select></label>
      {uid && <button className="secondary" disabled={loading} onClick={() => setRetry(n => n + 1)}><RefreshCw size={14} /> Muat ulang</button>}
    </div>
    <div className="history-content" aria-busy={loading}>
      {!uid ? <div className="empty-state"><History size={28} /><h3>Arsipmu dimulai di sini</h3><p>Sync akun untuk melihat detail setiap wish.</p></div>
        : loading ? <p className="history-message" role="status">Memuat riwayat wish…</p>
        : error ? <div className="history-message" role="alert"><p>{error}</p><button className="secondary" onClick={() => setRetry(n => n + 1)}>Coba lagi</button></div>
        : result && result.data.length > 0 ? <>
          <div className="history-scroll" tabIndex={0} role="region" aria-label="Tabel riwayat wish, dapat digeser horizontal">
            <table className="history-table"><caption className="sr-only">Detail wish akun aktif, diurutkan dari yang terbaru</caption><thead><tr><th scope="col">Item</th><th scope="col">Rarity</th><th scope="col">Banner</th><th scope="col">Waktu wish</th></tr></thead>
              <tbody>{result.data.map(wish => <tr key={wish.id} className={`wish-rarity-${wish.rarity}`}>
                <td><div className="history-item"><ItemIcon itemId={wish.item_id} name={wish.name} itemType={wish.item_type} rarity={wish.rarity} /><div><strong>{wish.name}</strong><span>{wish.item_type}</span><small>ID {wish.id}</small></div></div></td>
                <td><span className="history-rarity" aria-label={`${wish.rarity} bintang`}>{"★".repeat(wish.rarity)}</span>{wish.rate_up && <span className={`rate-badge rate-${wish.rate_up.result}`} title={wish.rate_up.guaranteed_before === null ? "Status sebelum wish ini belum diketahui dari arsip." : "Berdasarkan urutan 5★ dalam arsip."}>{wish.rate_up.label}</span>}</td>
                <td>{bannerNames[wish.banner] ?? wish.banner}{wish.gacha_type === "400" && <small>Character Event Wish-2</small>}</td>
                <td><time>{wish.time}</time></td>
              </tr>)}</tbody></table>
          </div>
          <div className="history-pagination"><span>{((result.current_page - 1) * result.per_page + 1).toLocaleString("id-ID")}–{Math.min(result.current_page * result.per_page, result.total).toLocaleString("id-ID")} dari {result.total.toLocaleString("id-ID")} wish</span>
            <div><button className="secondary" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage(n => n - 1)}><ChevronLeft size={16} /></button><span>Hal. {page} / {result.last_page}</span><button className="secondary" aria-label="Halaman berikutnya" disabled={page >= result.last_page} onClick={() => setPage(n => n + 1)}><ChevronRight size={16} /></button></div>
          </div>
        </> : <div className="empty-state"><History size={28} /><h3>Tidak ada wish yang cocok</h3><p>Ubah filter atau sync untuk memperbarui arsip.</p>{page > 1 && <button className="secondary" onClick={() => setPage(1)}>Kembali ke halaman pertama</button>}</div>}
    </div>
    <p className="data-note">Waktu mengikuti catatan game. Hanya wish yang sudah diimpor yang ditampilkan.</p>
    <p className="data-note">Rate on/off membandingkan 5★ dengan banner saat itu. Guaranteed dihitung dari urutan arsip; Capturing Radiance dan pilihan Epitomized Path tidak tercatat. Tanggal pergantian banner atau metadata yang belum tersedia ditandai belum diketahui.</p>
  </section>;
}

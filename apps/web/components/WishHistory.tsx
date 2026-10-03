"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, History, Search, X } from "lucide-react";
import { loadWishPage, type HistoryFilters, type WishHistoryPage, type WishRecord } from "../lib/api";
import ItemIcon from "./ItemIcon";
import { bannerNames } from "./WishInsights";

function useWishPage(uid: string | null, page: number, filters: HistoryFilters, revision: object | null) {
  const filterKey = JSON.stringify(filters);
  const requestKey = `${uid}:${page}:${filterKey}`;
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; data: WishHistoryPage | null; error: string | null; loading: boolean }>({ key: "", data: null, error: null, loading: false });
  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    setState({ key: requestKey, data: null, error: null, loading: true });
    loadWishPage(uid, page, JSON.parse(filterKey), controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ key: requestKey, data, error: null, loading: false }); })
      .catch(e => { if (!controller.signal.aborted) setState({ key: requestKey, data: null, error: e instanceof Error && e.name === "TimeoutError" ? "API belum merespons. Coba muat ulang." : e instanceof Error ? e.message : "History belum bisa dimuat.", loading: false }); });
    return () => controller.abort();
  }, [uid, page, filterKey, requestKey, revision, retry]);
  const current = state.key === requestKey;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!uid && (!current || state.loading), reload: () => setRetry(n => n + 1) };
}

function PityLabel({ wish }: { wish: WishRecord }) {
  if (!wish.pity) return null;
  return <span className={`pull-distance ${wish.pity.complete ? "" : "partial"}`} title={wish.pity.complete ? "Jumlah pull sejak 5★ sebelumnya dalam arsip banner yang sama." : "5★ pertama pada banner ini; awal riwayat mungkin terpotong."}>{wish.pity.complete ? "" : "≥ "}{wish.pity.pulls} pulls{!wish.pity.complete && " · arsip awal"}</span>;
}

function RateBadge({ wish }: { wish: WishRecord }) {
  return wish.rate_up ? <span className={`rate-badge rate-${wish.rate_up.result}`} title={wish.rate_up.guaranteed_before === null ? "Status sebelum wish ini belum diketahui." : "Berdasarkan urutan arsip."}>{wish.rate_up.label}</span> : null;
}

function Pagination({ data, onPage, label }: { data: WishHistoryPage; onPage: (page: number) => void; label: string }) {
  return <div className="history-pagination"><span>{data.total ? (data.current_page - 1) * data.per_page + 1 : 0}–{Math.min(data.current_page * data.per_page, data.total)} dari {data.total.toLocaleString("id-ID")}</span><div>
    <button className="secondary" aria-label={`${label}: halaman sebelumnya`} disabled={data.current_page <= 1} onClick={() => onPage(data.current_page - 1)}><ChevronLeft size={16} /></button>
    <span aria-live="polite">Hal. {data.current_page} / {data.last_page}</span>
    <button className="secondary" aria-label={`${label}: halaman berikutnya`} disabled={data.current_page >= data.last_page} onClick={() => onPage(data.current_page + 1)}><ChevronRight size={16} /></button>
  </div></div>;
}

function WishTable({ wishes, onSelect }: { wishes: WishRecord[]; onSelect?: (wish: WishRecord) => void }) {
  return <div className="history-scroll" tabIndex={0} role="region" aria-label="Tabel riwayat wish, geser untuk semua kolom">
    <table className="history-table"><caption className="sr-only">Detail wish, terbaru lebih dulu</caption><thead><tr><th scope="col">Item</th><th scope="col">Rarity / hasil</th><th scope="col">Banner</th><th scope="col">Waktu wish</th></tr></thead><tbody>
      {wishes.map(wish => <tr key={wish.id} className={`wish-rarity-${wish.rarity}`}><td>
        <div className="history-item"><ItemIcon itemId={wish.item_id} name={wish.name} itemType={wish.item_type} rarity={wish.rarity} /><div>{onSelect ? <button className="item-link" onClick={() => onSelect(wish)} aria-label={`Detail ${wish.name}`}><strong>{wish.name}</strong></button> : <strong>{wish.name}</strong>}<span>{wish.item_type}</span><small>ID {wish.id}</small></div></div>
      </td><td><span className="history-rarity" aria-label={`${wish.rarity} bintang`}>{"★".repeat(wish.rarity)}</span><RateBadge wish={wish} /><PityLabel wish={wish} /></td><td>{bannerNames[wish.banner] ?? wish.banner}{wish.gacha_type === "400" && <small>Character Event Wish-2</small>}</td><td><time>{wish.time}</time></td></tr>)}
    </tbody></table>
  </div>;
}

function LoadState({ uid, loading, error, retry }: { uid: string | null; loading: boolean; error: string | null; retry: () => void }) {
  if (!uid) return <div className="empty-state"><History size={26} /><h3>Arsipmu dimulai di sini</h3><p>Sync akun untuk melihat perjalanan wish kamu.</p></div>;
  if (loading) return <p className="history-message" role="status">Memuat arsip…</p>;
  if (error) return <div className="history-message" role="alert"><p>{error}</p><button className="secondary" onClick={retry}>Coba lagi</button></div>;
  return null;
}

function ItemDetails({ uid, wish, revision, onClose }: { uid: string; wish: WishRecord; revision: object | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(1);
  const result = useWishPage(uid, page, { item: wish.id, per_page: 10 }, revision);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; opener?.focus(); };
  }, []);
  return <dialog ref={dialog} className="item-dialog" aria-labelledby="item-detail-title" onCancel={onClose}>
    <div className="item-dialog-heading"><ItemIcon itemId={wish.item_id} name={wish.name} itemType={wish.item_type} rarity={wish.rarity} /><div><p className="eyebrow">YOUR COLLECTION</p><h2 id="item-detail-title">{wish.name}</h2><p>{wish.item_type} · {wish.rarity}★</p></div><button className="icon-button" aria-label="Tutup detail item" onClick={onClose} autoFocus><X size={20} /></button></div>
    <p className="item-count" aria-live="polite">{result.data ? `${result.data.total} kali ditemukan · ${Math.max(0, result.data.total - 1)} duplikat dalam arsip` : "Memuat jumlah kemunculan…"}</p>
    <p className="data-note">Jumlah ini hanya dari wish tersimpan, bukan constellation atau refinement akun. Mencakup semua banner, tanpa filter history.</p>
    <LoadState uid={uid} loading={result.loading} error={result.error} retry={result.reload} />
    {result.data && <><WishTable wishes={result.data.data} /><Pagination data={result.data} onPage={setPage} label="Detail item" /></>}
  </dialog>;
}

function FiveStarTimeline({ uid, revision, onSelect }: { uid: string | null; revision: object | null; onSelect: (wish: WishRecord) => void }) {
  const [query, setQuery] = useState({ page: 1, banner: "all" });
  const result = useWishPage(uid, query.page, { banner: query.banner, rarity: "5", per_page: 10 }, revision);
  return <section id="recent" className="content-section"><div className="section-heading"><div><p className="eyebrow">MOMENTS WORTH KEEPING</p><h2>5★ timeline</h2></div><label className="compact-filter"><span className="sr-only">Banner timeline</span><select value={query.banner} onChange={e => setQuery({ page: 1, banner: e.target.value })}><option value="all">Semua banner</option>{Object.entries(bannerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
    <div className="timeline-panel" aria-busy={result.loading}><LoadState uid={uid} loading={result.loading} error={result.error} retry={result.reload} />
      {result.data && (result.data.total ? <><ol className="five-star-timeline">{result.data.data.map(wish => <li key={wish.id}><button className="timeline-item" onClick={() => onSelect(wish)} aria-label={`Detail ${wish.name}, ${wish.time}`}><ItemIcon itemId={wish.item_id} name={wish.name} itemType={wish.item_type} /><span className="timeline-identity"><strong>{wish.name}</strong><small>{bannerNames[wish.banner]} · {wish.time}</small></span><span className="timeline-result"><PityLabel wish={wish} /><RateBadge wish={wish} /></span><ChevronRight size={15} /></button></li>)}</ol><Pagination data={result.data} onPage={page => setQuery({ ...query, page })} label="Timeline" /></> : <div className="empty-state"><h3>Belum ada 5★</h3><p>Belum ada hasil 5★ pada banner ini dalam arsip.</p></div>)}
    </div><p className="data-note">Klik item untuk detail. Tanda ≥ berarti jumlah minimal pada awal arsip. Interval memakai urutan wish di banner yang sama; bukan jumlah hari atau gabungan semua banner.</p>
  </section>;
}

export function WishTimeline({ uid, revision }: { uid: string | null; revision: object | null }) {
  const [selected, setSelected] = useState<WishRecord | null>(null);
  return <><FiveStarTimeline uid={uid} revision={revision} onSelect={setSelected} />
    {selected && uid && <ItemDetails key={selected.id} uid={uid} wish={selected} revision={revision} onClose={() => setSelected(null)} />}</>;
}

export default function WishHistory({ uid, revision }: { uid: string | null; revision: object | null }) {
  const [query, setQuery] = useState<{ page: number; filters: HistoryFilters }>({ page: 1, filters: { per_page: 20 } });
  const [selected, setSelected] = useState<WishRecord | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const result = useWishPage(uid, query.page, query.filters, revision);
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const from = String(values.get("from") ?? ""), to = String(values.get("to") ?? "");
    if (from && to && to < from) { setValidation("Tanggal akhir harus setelah tanggal awal."); return; }
    setValidation(null);
    setQuery({ page: 1, filters: { banner: String(values.get("banner")), rarity: String(values.get("rarity")), kind: String(values.get("kind")), search: String(values.get("search")).trim(), per_page: Number(values.get("per_page")), from, to } });
  }
  function resetFilters() { form.current?.reset(); setValidation(null); setQuery({ page: 1, filters: { per_page: 20 } }); }
  return <>
    <section id="history" className="content-section"><div className="section-heading"><div><p className="eyebrow">EVERY PULL HAS A PLACE</p><h2>Wish history</h2></div><span className="subtle">Terbaru lebih dulu · klik nama untuk detail</span></div>
      <form className="archive-filters" ref={form} onSubmit={applyFilters}>
        <label className="search-field">Cari nama<input name="search" placeholder="Ineffa, Favonius…" maxLength={100} type="search" /></label>
        <label>Banner<select name="banner" defaultValue="all"><option value="all">Semua banner</option>{Object.entries(bannerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>Rarity<select name="rarity" defaultValue="all"><option value="all">Semua rarity</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option></select></label>
        <label>Jenis item<select name="kind" defaultValue="all"><option value="all">Semua jenis</option><option value="character">Karakter</option><option value="weapon">Senjata</option></select></label>
        <label>Dari tanggal<input name="from" type="date" /></label><label>Sampai tanggal<input name="to" type="date" /></label>
        <label>Baris per halaman<select name="per_page" defaultValue="20"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        <div className="filter-actions"><button type="submit" className="primary"><Search size={15} /> Terapkan</button><button type="button" className="secondary" onClick={resetFilters}>Reset</button><button type="button" className="text-button" disabled={result.loading || !uid} onClick={result.reload}>Muat ulang</button></div>
      </form>
      {validation && <p className="filter-error" role="alert">{validation}</p>}
      <div className="history-content" aria-busy={result.loading}><LoadState uid={uid} loading={result.loading} error={result.error} retry={result.reload} />
        {result.data && (result.data.data.length ? <><WishTable wishes={result.data.data} onSelect={setSelected} /><Pagination data={result.data} onPage={page => setQuery({ ...query, page })} label="History" /></> : <div className="empty-state"><History size={28} /><h3>Tidak ada wish yang cocok</h3><p>Ubah filter atau sync untuk memperbarui arsip.</p><button className="secondary" onClick={resetFilters}>Reset filter</button></div>)}
      </div>
      <p className="data-note">Tanggal dan waktu mengikuti catatan game. Filter jenis mendukung label Indonesia dan Inggris. Rate on/off membandingkan hasil dengan banner saat itu; Capturing Radiance dan Epitomized Path tidak ditebak.</p>
    </section>
    {uid && selected && <ItemDetails key={selected.id} uid={uid} wish={selected} revision={revision} onClose={() => setSelected(null)} />}
  </>;
}

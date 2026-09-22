"use client";

import Image from "next/image";
import WishHistory from "./WishHistory";
import ItemIcon from "./ItemIcon";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, Copy, History, Layers3, LayoutDashboard, Leaf, Orbit, RefreshCw, ShieldCheck, Sparkles, Star, Swords } from "lucide-react";
import { createSyncSession, getAccountStats, getSyncSession, type AccountStats, type SyncSession } from "../lib/api";

const banners = [
  { id: "301", name: "Character Event", subtitle: "A destined encounter", cap: 90, theme: "jade", icon: Sparkles, note: "Pity dibagi antar banner Character Event." },
  { id: "302", name: "Weapon Event", subtitle: "Forged for your journey", cap: 80, theme: "gold", icon: Swords, note: "Fate Point tidak ditampilkan dari riwayat wish." },
  { id: "200", name: "Standard", subtitle: "Wanderlust invocation", cap: 90, theme: "violet", icon: Orbit, note: "Pity Standard terpisah dari banner event." },
  { id: "500", name: "Chronicled Wish", subtitle: "Echoes of familiar stories", cap: 90, theme: "blue", icon: BookOpen, note: "Pity Chronicled Wish dihitung terpisah." },
];
const formatNumber = new Intl.NumberFormat("id-ID");
function readLocal(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function writeLocal(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Sync still works when browser storage is unavailable. */ } }
function errorText(error: unknown) {
  if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) return "API belum merespons. Pastikan server API berjalan, lalu coba lagi.";
  return error instanceof Error ? error.message : "Koneksi gagal. Coba lagi sebentar.";
}

export default function WishDashboard() {
  const [session, setSession] = useState<SyncSession | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [knownUid, setKnownUid] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    const uid = readLocal("irminsul:lastUid");
    setKnownUid(uid);
    if (uid) {
      getAccountStats(uid).then(data => { if (active) setStats(data); })
        .catch(e => { if (active) setError(errorText(e)); })
        .finally(() => { if (active) setLoading(false); });
    } else setLoading(false);
    return () => { active = false; syncGeneration.current++; if (timer.current) clearInterval(timer.current); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  async function refreshAccount() {
    if (!knownUid) return;
    setLoading(true); setError(null);
    try { setStats(await getAccountStats(knownUid)); } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }

  async function startSync() {
    const generation = ++syncGeneration.current;
    if (timer.current) clearInterval(timer.current);
    setBusy(true); setSession(null); setError(null); setConnectionIssue(false);
    try {
      const created = await createSyncSession();
      if (generation !== syncGeneration.current) return;
      setSession(created);
      window.location.href = created.protocol_uri;
      let polling = false;
      timer.current = setInterval(async () => {
        if (generation !== syncGeneration.current || polling) return;
        if (Date.now() >= Date.parse(created.expires_at)) {
          if (timer.current) clearInterval(timer.current);
          syncGeneration.current++; setBusy(false); setSession(null);
          setError("Sesi sync kedaluwarsa. Buka Wish History, lalu mulai sync baru."); return;
        }
        polling = true;
        try {
          const current = await getSyncSession(created.token);
          if (generation !== syncGeneration.current) return;
          setConnectionIssue(false);
          setSession({ ...current, protocol_uri: created.protocol_uri });
          if (current.status === "completed" || current.status === "failed") {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
            if (current.status === "completed" && current.uid) {
              writeLocal("irminsul:lastUid", current.uid);
              setKnownUid(current.uid);
              try {
                const data = await getAccountStats(current.uid);
                if (generation === syncGeneration.current) setStats(data);
              } catch (e) { if (generation === syncGeneration.current) setError(`Sync selesai, tetapi statistik belum dimuat. ${errorText(e)}`); }
            }
            if (generation === syncGeneration.current) setBusy(false);
          }
        } catch { if (generation === syncGeneration.current) setConnectionIssue(true); }
        finally { polling = false; }
      }, 1500);
    } catch (e) { if (generation === syncGeneration.current) { setError(errorText(e)); setBusy(false); } }
  }

  function cancelSync() {
    syncGeneration.current++; if (timer.current) clearInterval(timer.current);
    timer.current = null; setBusy(false); setSession(null); setError(null); setConnectionIssue(false);
  }
  async function copyUid() {
    if (!stats) return;
    try { await navigator.clipboard.writeText(stats.uid); setCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); }
    catch { setError("UID belum bisa disalin. Kamu bisa menyalinnya langsung dari kartu akun."); }
  }
  const value = (n: number | undefined) => n === undefined ? "—" : formatNumber.format(n);
  const recent = banners.flatMap(meta => { const wish = stats?.banners[meta.id]?.last_5_star; return wish ? [{ ...wish, meta }] : []; }).sort((a, b) => b.time.localeCompare(a.time));
  const lastSync = stats?.last_synced_at;
  const syncDate = lastSync && !Number.isNaN(Date.parse(lastSync)) ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastSync)) : "Belum ada sync tercatat";

  return <div className="app-shell">
    <a href="#main" className="skip-link">Lewati navigasi</a>
    <aside className="sidebar">
      <a href="#overview" className="brand"><span className="brand-mark"><Leaf size={25} /></span><span>Irminsul<span className="brand-sub">WISH ARCHIVE</span></span></a>
      <div className="nav-label">YOUR JOURNEY</div>
      <nav aria-label="Navigasi utama">
        <a href="#overview"><LayoutDashboard size={18} /> Overview</a>
        <a href="#banners"><Layers3 size={18} /> Banner pity</a>
        <a href="#recent"><History size={18} /> Latest discoveries</a>
        <a href="#history"><History size={18} /> Wish history</a>
        <a href="#guide"><BookOpen size={18} /> Sync guide</a>
      </nav>
      <div className="privacy"><ShieldCheck size={22} /><strong>Your wishes. Your archive.</strong><p>Authkey tetap di PC kamu. Hanya riwayat wish yang dikirim ke API.</p><span>WINDOWS COMPANION</span></div>
      <div className="sidebar-footer"><Leaf size={13} /> Rooted in your journey</div>
    </aside>
    <div className="workspace" id="overview">
      <header className="topbar"><span>My archive <ChevronRight size={13} /> <b>Overview</b></span><span className="game-label"><Sparkles size={13} /> GENSHIN IMPACT</span></header>
      <main id="main">
        <div className="page-heading"><div><p className="eyebrow">A LITTLE LUCK. A LOT OF MEMORIES.</p><h1>Your wish archive</h1></div><span className="edition">TEYVAT COLLECTION <span>01</span></span></div>
        <section className="hero" aria-label="Irminsul wish archive">
          <Image src="/images/irminsul-hero.png" alt="" fill preload sizes="(max-width: 760px) 100vw, (max-width: 1300px) 80vw, 1100px" />
          <div className="hero-shade" /><div className="hero-content"><p className="eyebrow"><Sparkles size={13} /> EVERY WISH, REMEMBERED</p><h2>Let your wishes<br /><em>take root.</em></h2><p>Setiap bintang punya cerita.<br />Simpan perjalanan wish kamu di satu tempat.</p><a href="#banners">Explore your wishes <ArrowUpRight size={17} /></a></div><span className="hero-caption">THE IRMINSUL ARCHIVE</span>
        </section>
        <section className="account-strip" aria-label="Akun dan sinkronisasi">
          <div className="account-identity"><span className="avatar"><Leaf size={24} /></span><div><span className="label">{stats ? "CONNECTED ACCOUNT" : "YOUR ACCOUNT"}</span><div className="account-uid">{loading ? "Memuat akun…" : stats ? `UID ${stats.uid}` : "Mulai perjalananmu"}{stats && <button className="icon-button" aria-label={copied ? "UID tersalin" : "Salin UID"} onClick={copyUid}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>}</div><span className="subtle">{stats ? stats.region || "Genshin Impact" : "Hubungkan riwayat wish pertamamu"}</span></div></div>
          <div className="last-sync"><span className="label"><Clock3 size={12} /> LAST SYNC</span><span>{syncDate}</span></div>
          <button className="primary" onClick={startSync} disabled={busy || loading}><RefreshCw size={16} className={busy ? "spin" : ""} />{busy ? "Syncing…" : "Start Sync"}</button>
        </section>
        {(busy || session) && <section className={`sync-panel ${session?.status === "completed" ? "success" : ""}`} aria-live="polite"><div><strong>{session?.status === "completed" ? "Arsip berhasil diperbarui" : session?.status === "failed" ? "Sync belum berhasil" : !session ? "Menyiapkan sesi sync…" : connectionIssue ? "Koneksi API terputus. Mencoba lagi…" : "Menunggu hasil dari Irminsul Sync"}</strong><p>{session?.status === "completed" ? `${value(session.new_wishes)} wish baru ditambahkan.` : session?.status === "failed" ? session.message || "Coba mulai sync kembali." : "Buka Wish → History di Genshin, lalu izinkan Chrome/Edge membuka companion."}</p></div>{busy && <div className="sync-actions">{session?.protocol_uri && <a className="secondary" href={session.protocol_uri}>Buka Irminsul Sync <ArrowUpRight size={14} /></a>}<button className="text-button" onClick={cancelSync}>Batalkan</button></div>}</section>}
        {error && <div className="error" role="alert"><span>{error}</span>{knownUid && <button className="secondary" disabled={loading || busy} onClick={refreshAccount}>Muat ulang akun</button>}</div>}
        <section className="summary-grid" aria-label="Ringkasan wish" aria-busy={loading}>
          {[{ name: "Total wishes", number: stats?.total_wishes, icon: Star, detail: "Seluruh arsip" }, ...banners.slice(0, 3).map(b => ({ name: b.name, number: stats?.banners[b.id]?.total_wishes, icon: b.icon, detail: "Stored wishes" }))].map(metric => <article className="summary" key={metric.name}><div><span>{metric.name}</span><metric.icon size={17} /></div><strong>{value(metric.number)}</strong><span className="subtle">{metric.detail}</span></article>)}
        </section>
        <section id="banners" className="content-section"><div className="section-heading"><div><p className="eyebrow">THE NEXT FALLING STAR</p><h2>Banner overview</h2></div><span className="subtle">Pity dari riwayat tersimpan</span></div>
          <div className="filters" role="group" aria-label="Filter banner">{[{ id: "all", name: "All banners" }, ...banners].map(b => <button key={b.id} aria-pressed={filter === b.id} onClick={() => setFilter(b.id)}>{b.name}</button>)}</div>
          <div className="banner-grid">{banners.filter(b => filter === "all" || b.id === filter).map(meta => { const data = stats?.banners[meta.id]; const cap = data?.hard_pity ?? meta.cap; return <article className={`banner-card ${meta.theme}`} key={meta.id}><div className="banner-heading"><span className="banner-icon"><meta.icon size={22} /></span><div><h3>{meta.name}</h3><p>{meta.subtitle}</p></div><span className="rarity">5 <Star size={12} fill="currentColor" /></span></div><div className="pity-row"><div><span className="label">CURRENT PITY</span><strong>{value(data?.current_pity)}<small> / {cap}</small></strong></div><span className="pity-label">{data ? `${Math.max(0, cap - data.current_pity)} hingga hard pity` : "Menunggu riwayat"}</span></div><div className="meter" role="progressbar" aria-label={`${meta.name} pity`} aria-valuenow={data?.current_pity} aria-valuemin={0} aria-valuemax={cap} aria-valuetext={data ? `${data.current_pity} dari ${cap}` : "Belum ada data"}><div style={{ width: `${Math.min(100, (data?.current_pity ?? 0) / cap * 100)}%` }} /></div><div className="meter-labels"><span>0</span><span>{cap} hard pity</span></div><div className="last-pull">{data?.last_5_star ? <ItemIcon itemId={data.last_5_star.item_id} name={data.last_5_star.name} itemType={data.last_5_star.item_type} /> : <Star size={16} />}<div><span className="label">LAST 5-STAR</span><strong>{data?.last_5_star?.name ?? "Belum ada di arsip"}</strong></div><span>{value(data?.total_wishes)}<small> wishes</small></span></div><p className="banner-note">{meta.note}</p>{["301", "302"].includes(meta.id) && <div className={`guarantee-status guarantee-${stats?.next_guarantee?.[meta.id] ?? "unknown"}`}><span className="label">5★ BERIKUTNYA</span><strong>{stats?.next_guarantee?.[meta.id] === "guaranteed" ? "Guaranteed rate-up" : stats?.next_guarantee?.[meta.id] === "not_guaranteed" ? meta.id === "301" ? "50/50 · Belum guaranteed" : "75/25 · Belum guaranteed" : "Belum diketahui"}</strong><p>{meta.id === "301" ? "Dari arsip tersimpan; Capturing Radiance tidak dihitung." : "Untuk salah satu senjata rate-up, bukan pilihan Epitomized Path."}</p></div>}</article>; })}</div>
          <p className="data-note">Riwayat yang tidak lengkap bisa membuat hitungan pity lebih rendah dari kondisi di game.</p>
        </section>
        <section id="recent" className="content-section"><div className="section-heading"><div><p className="eyebrow">MOMENTS WORTH KEEPING</p><h2>Latest discoveries</h2></div><span className="subtle">5★ terakhir per banner</span></div><div className="discoveries">{recent.length ? recent.map(wish => <article className="discovery" key={wish.meta.id}><ItemIcon itemId={wish.item_id} name={wish.name} itemType={wish.item_type} /><div className="discovery-name"><strong>{wish.name}</strong><span>{wish.item_type} <span className="stars" aria-label="5 bintang">★★★★★</span></span></div><span className="discovery-banner">{wish.meta.name}</span><time>{wish.time}</time></article>) : <div className="empty-state"><Sparkles size={28} /><h3>Your story is waiting</h3><p>{stats ? "Belum ada 5★ dalam riwayat yang tersimpan." : "Sync akunmu untuk melihat bintang yang pernah kamu temukan."}</p></div>}</div></section>
        <WishHistory key={stats?.uid ?? "no-account"} uid={stats?.uid ?? null} revision={stats} />
        <section className="guide" id="guide"><div className="section-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>A little ritual. A fresh archive.</h2></div><BookOpen size={24} /></div><ol><li><span>01</span><div><h3>Buka Genshin</h3><p>Jalankan game lewat HoYoPlay di PC yang sama.</p></div></li><li><span>02</span><div><h3>Muat Wish History</h3><p>Buka Wish → History sampai riwayat selesai dimuat.</p></div></li><li><span>03</span><div><h3>Sync & return</h3><p>Klik Start Sync dan izinkan Irminsul Sync terbuka.</p></div></li></ol></section>
        <footer><span><Leaf size={14} /> Irminsul Wish</span><p>Fan-made wish archive · Tidak berafiliasi dengan HoYoverse.</p><a href="#overview">Back to top ↑</a></footer>
      </main>
    </div>
  </div>;
}

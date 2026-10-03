"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { dashboardPages, legacyDashboardHashes } from "../lib/dashboard-pages";
import type { SignedInUser, OwnedAccount } from "./AuthShell";
import ArchiveTools from "./ArchiveTools";
import { JourneyCharts, WishPlanner, ShareArchive } from "./JourneyTools";
const CharacterBuilds = dynamic(() => import("./CharacterBuilds"), { loading: () => <p role="status">Memuat character builds…</p> });
import ConnectionCheck from "./ConnectionCheck";
const WishHistory = dynamic(() => import("./WishHistory"), { loading: () => <p role="status">Memuat history…</p> });
const WishTimeline = dynamic(() => import("./WishHistory").then(module => module.WishTimeline), { loading: () => <p role="status">Memuat timeline…</p> });
import ItemIcon from "./ItemIcon";
import WishInsights, { SyncSummaryLine } from "./WishInsights";
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

export default function WishDashboard({ user, initialAccounts }: { user: SignedInUser; initialAccounts: OwnedAccount[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const page = dashboardPages.find(page => pathname === `/${page.slug}`) ?? dashboardPages[0];
  const overview = page.slug === "";
  const navIcons = [LayoutDashboard, Sparkles, Layers3, History, History, Orbit, Swords, Star, ShieldCheck, BookOpen];

  useEffect(() => {
    const migrateHash = () => {
      const destination = legacyDashboardHashes[window.location.hash.slice(1)];
      if (destination) router.replace(destination);
    };
    migrateHash();
    window.addEventListener("hashchange", migrateHash);
    return () => window.removeEventListener("hashchange", migrateHash);
  }, [router]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);

  const [accounts, setAccounts] = useState(initialAccounts);
  const accountStorageKey = `irminsul:lastUid:${user.id}`;
  const [session, setSession] = useState<SyncSession | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [knownUid, setKnownUid] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [privateMode, setPrivateMode] = useState(true);
  const [launchHint, setLaunchHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    setPrivateMode(readLocal("irminsul:privacy:v1") !== "off");
    const saved = readLocal(accountStorageKey) ?? readLocal("irminsul:lastUid");
    const uid = initialAccounts.find(account => account.uid === saved)?.uid ?? initialAccounts[0]?.uid ?? null;
    setKnownUid(uid);
    if (uid) {
      getAccountStats(uid).then(data => { if (active) setStats(data); })
        .catch(e => { if (active) setError(errorText(e)); })
        .finally(() => { if (active) setLoading(false); });
    } else setLoading(false);
    return () => { active = false; syncGeneration.current++; if (timer.current) clearInterval(timer.current); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  useEffect(() => {
    if (stats) setAccounts(previous => previous.some(account => account.uid === stats.uid) ? previous : [...previous, { uid: stats.uid, region: stats.region }]);
  }, [stats]);

  async function selectAccount(uid: string) {
    if (busy) return;
    setStats(null); setKnownUid(uid); setLoading(true); setError(null); setSession(null); writeLocal(accountStorageKey, uid);
    try { setStats(await getAccountStats(uid)); } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }

  async function refreshAccount() {
    if (!knownUid) return;
    setLoading(true); setError(null);
    try { setStats(await getAccountStats(knownUid)); } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }

  async function startSync() {
    const generation = ++syncGeneration.current;
    if (timer.current) clearInterval(timer.current);
    setBusy(true); setSession(null); setError(null); setConnectionIssue(false); setLaunchHint(false);
    try {
      const created = await createSyncSession();
      if (generation !== syncGeneration.current) return;
      setSession(created);
      window.location.href = created.protocol_uri;
      const startedAt = Date.now();
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
          setLaunchHint(current.status === "waiting" && Date.now() - startedAt > 20000);
          setSession({ ...current, protocol_uri: created.protocol_uri });
          if (current.status === "completed" || current.status === "failed") {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
            if (current.status === "completed" && current.uid) {
              writeLocal(accountStorageKey, current.uid);
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
  async function importedAccount(uid: string) {
    writeLocal(accountStorageKey, uid); setKnownUid(uid); setLoading(true); setError(null); setSession(null); setStats(null);
    try { setStats(await getAccountStats(uid)); } catch (e) { setError(`Impor selesai, tetapi akun belum dimuat. ${errorText(e)}`); } finally { setLoading(false); }
  }
  async function copyUid() {
    if (!stats) return;
    try { await navigator.clipboard.writeText(stats.uid); setCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); }
    catch { setError("UID belum bisa disalin. Kamu bisa menyalinnya langsung dari kartu akun."); }
  }
  const value = (n: number | undefined) => n === undefined ? "—" : formatNumber.format(n);
  const lastSync = stats?.last_synced_at;
  const syncDate = lastSync && !Number.isNaN(Date.parse(lastSync)) ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastSync)) : "Belum ada sync tercatat";

  return <div className="app-shell">
    <a href="#main" className="skip-link">Lewati navigasi</a>
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Leaf size={25} /></span><span>Irminsul<span className="brand-sub">WISH ARCHIVE</span></span></Link>
      <div className="nav-label">YOUR JOURNEY</div>
      <nav aria-label="Navigasi utama">
        {dashboardPages.map((item, index) => { const Icon = navIcons[index]; return <Link key={item.slug} href={`/${item.slug}`} aria-current={page.slug === item.slug ? "page" : undefined}><Icon size={18} />{item.label}</Link>; })}
      </nav>
      <div className="privacy"><ShieldCheck size={22} /><strong>Your wishes. Your archive.</strong><p>Authkey tetap di PC kamu. Hanya riwayat wish yang dikirim ke API.</p><span>WINDOWS COMPANION</span></div>
      <div className="sidebar-footer"><Leaf size={13} /> Rooted in your journey</div>
    </aside>
    <div className="workspace" id="overview">
      <header className="topbar"><span>My archive <ChevronRight size={13} /> <b>{page.label}</b></span><span className="game-label"><Sparkles size={13} /> GENSHIN IMPACT</span></header>
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">A LITTLE LUCK. A LOT OF MEMORIES.</p><h1>{overview ? "Your wish archive" : page.label}</h1>{!overview && <p className="subtle">{page.description}</p>}</div><span className="edition">TEYVAT COLLECTION <span>01</span></span></div>
        {overview && <section className="hero" aria-label="Irminsul wish archive">
          <Image src="/images/irminsul-hero.png" alt="" fill preload sizes="(max-width: 760px) 100vw, (max-width: 1300px) 80vw, 1100px" />
          <div className="hero-shade" /><div className="hero-content"><p className="eyebrow"><Sparkles size={13} /> EVERY WISH, REMEMBERED</p><h2>Let your wishes<br /><em>take root.</em></h2><p>Setiap bintang punya cerita.<br />Simpan perjalanan wish kamu di satu tempat.</p><Link href="/banners">Explore your wishes <ArrowUpRight size={17} /></Link></div><span className="hero-caption">THE IRMINSUL ARCHIVE</span>
        </section>}
        <section className="account-strip" aria-label="Akun dan sinkronisasi">
          <div className="account-identity"><span className="avatar"><Leaf size={24} /></span><div><span className="label">{stats ? "CONNECTED ACCOUNT" : "YOUR ACCOUNT"}</span><div className="account-uid">{loading ? "Memuat akun…" : stats ? `UID ${privateMode ? "•••••••••" : stats.uid}` : "Mulai perjalananmu"}{stats && !privateMode && <button className="icon-button" aria-label={copied ? "UID tersalin" : "Salin UID"} onClick={copyUid}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>}</div><span className="subtle">{stats ? stats.region || "Genshin Impact" : "Hubungkan riwayat wish pertamamu"}</span></div></div>
          <div className="last-sync"><span className="label"><Clock3 size={12} /> LAST SYNC</span><span>{syncDate}</span></div>
          <button className="primary" onClick={startSync} disabled={busy || loading}><RefreshCw size={16} className={busy ? "spin" : ""} />{busy ? "Syncing…" : "Start Sync"}</button>
        </section>
        <div className="privacy-controls">{accounts.length > 1 && <label>Akun Genshin<select aria-label="Pilih akun Genshin" value={knownUid ?? ""} disabled={busy || loading} onChange={e => void selectAccount(e.target.value)}>{accounts.map((account, index) => <option key={account.uid} value={account.uid}>{privateMode ? `Akun ${index + 1}` : account.uid}</option>)}</select></label>}<label><input type="checkbox" checked={privateMode} onChange={e => { setPrivateMode(e.target.checked); writeLocal("irminsul:privacy:v1", e.target.checked ? "on" : "off"); }} /> Sembunyikan UID</label>{overview && <ShareArchive stats={stats} privateMode={privateMode} />}</div>
        {(busy || session) && <section className={`sync-panel ${session?.status === "completed" ? "success" : ""}`} aria-live="polite"><div><strong>{session?.status === "completed" ? "Arsip berhasil diperbarui" : session?.status === "failed" ? "Sync belum berhasil" : !session ? "Menyiapkan sesi sync…" : connectionIssue ? "Koneksi API terputus. Mencoba lagi…" : session?.status === "syncing" ? "Companion terhubung" : "Menunggu Irminsul Sync terbuka"}</strong><p>{session?.status === "completed" ? `${value(session.new_wishes)} wish baru ditambahkan.` : session?.status === "failed" ? session.message || "Coba mulai sync kembali." : session?.status === "syncing" ? session.message : launchHint ? "Companion belum merespons. Coba tautan Buka Irminsul Sync. Jika tetap tidak muncul, buka bantuan koneksi di bawah." : "Buka Wish → History di Genshin, lalu izinkan Chrome/Edge membuka companion."}</p>{session?.status === "completed" && session.summary && <SyncSummaryLine summary={session.summary} />}</div>{busy && <div className="sync-actions">{session?.protocol_uri && <a className="secondary" href={session.protocol_uri}>Buka Irminsul Sync <ArrowUpRight size={14} /></a>}<button className="text-button" onClick={cancelSync}>Batalkan</button></div>}</section>}
        {error && <div className="error" role="alert"><span>{error}</span>{knownUid && <button className="secondary" disabled={loading || busy} onClick={refreshAccount}>Muat ulang akun</button>}</div>}
        {overview && <section className="summary-grid" aria-label="Ringkasan wish" aria-busy={loading}>
          {[{ name: "Total wishes", number: stats?.total_wishes, icon: Star, detail: "Seluruh arsip" }, ...banners.slice(0, 3).map(b => ({ name: b.name, number: stats?.banners[b.id]?.total_wishes, icon: b.icon, detail: "Stored wishes" }))].map(metric => <article className="summary" key={metric.name}><div><span>{metric.name}</span><metric.icon size={17} /></div><strong>{value(metric.number)}</strong><span className="subtle">{metric.detail}</span></article>)}
        </section>}
        {overview && <section className="overview-pity-grid" aria-label="Ringkasan pity event">{banners.slice(0, 2).map(banner => { const data = stats?.banners[banner.id]; const status = stats?.next_guarantee?.[banner.id]; return <Link href="/banners" className="overview-pity-card" key={banner.id}><span className="label">{banner.name}</span><strong>{value(data?.current_pity)}<small> / {data?.hard_pity ?? banner.cap}</small></strong><span>{status === "guaranteed" ? "Guaranteed rate-up" : status === "not_guaranteed" ? banner.id === "301" ? "50/50 · Belum guaranteed" : "75/25 · Belum guaranteed" : "Status belum diketahui"}</span><span className="subtle">Lihat detail banner →</span></Link>; })}</section>}
        {overview && <section className="overview-shortcuts" aria-label="Jelajahi arsip">{dashboardPages.filter(item => ["history", "characters", "planner"].includes(item.slug)).map(item => <Link className="overview-shortcut" key={item.slug} href={`/${item.slug}`}><strong>{item.label}<ArrowUpRight size={17} /></strong><p>{item.description}</p></Link>)}</section>}
        {page.slug === "insights" && <WishInsights stats={stats} />}
        {page.slug === "banners" && <section id="banners" className="content-section"><div className="section-heading"><div><p className="eyebrow">THE NEXT FALLING STAR</p><h2>Banner overview</h2></div><span className="subtle">Pity dari riwayat tersimpan</span></div>
          <div className="filters" role="group" aria-label="Filter banner">{[{ id: "all", name: "All banners" }, ...banners].map(b => <button key={b.id} aria-pressed={filter === b.id} onClick={() => setFilter(b.id)}>{b.name}</button>)}</div>
          <div className="banner-grid">{banners.filter(b => filter === "all" || b.id === filter).map(meta => { const data = stats?.banners[meta.id]; const cap = data?.hard_pity ?? meta.cap; return <article className={`banner-card ${meta.theme}`} key={meta.id}><div className="banner-heading"><span className="banner-icon"><meta.icon size={22} /></span><div><h3>{meta.name}</h3><p>{meta.subtitle}</p></div><span className="rarity">5 <Star size={12} fill="currentColor" /></span></div><div className="pity-row"><div><span className="label">CURRENT PITY</span><strong>{value(data?.current_pity)}<small> / {cap}</small></strong></div><span className="pity-label">{data ? `${Math.max(0, cap - data.current_pity)} hingga hard pity` : "Menunggu riwayat"}</span></div><div className="meter" role="progressbar" aria-label={`${meta.name} pity`} aria-valuenow={data?.current_pity} aria-valuemin={0} aria-valuemax={cap} aria-valuetext={data ? `${data.current_pity} dari ${cap}` : "Belum ada data"}><div style={{ width: `${Math.min(100, (data?.current_pity ?? 0) / cap * 100)}%` }} /></div><div className="meter-labels"><span>0</span><span>{cap} hard pity</span></div><div className="last-pull">{data?.last_5_star ? <ItemIcon itemId={data.last_5_star.item_id} name={data.last_5_star.name} itemType={data.last_5_star.item_type} /> : <Star size={16} />}<div><span className="label">LAST 5-STAR</span><strong>{data?.last_5_star?.name ?? "Belum ada di arsip"}</strong></div><span>{value(data?.total_wishes)}<small> wishes</small></span></div><p className="banner-note">{meta.note}</p>{["301", "302"].includes(meta.id) && <div className={`guarantee-status guarantee-${stats?.next_guarantee?.[meta.id] ?? "unknown"}`}><span className="label">5★ BERIKUTNYA</span><strong>{stats?.next_guarantee?.[meta.id] === "guaranteed" ? "Guaranteed rate-up" : stats?.next_guarantee?.[meta.id] === "not_guaranteed" ? meta.id === "301" ? "50/50 · Belum guaranteed" : "75/25 · Belum guaranteed" : "Belum diketahui"}</strong><p>{meta.id === "301" ? "Dari arsip tersimpan; Capturing Radiance tidak dihitung." : "Untuk salah satu senjata rate-up, bukan pilihan Epitomized Path."}</p><details><summary>Kenapa statusnya begitu?</summary><p>Hasil 5★ terakhir: {data?.last_5_star?.name ?? "belum tercatat"}{data?.last_5_star ? ` (${data.last_5_star.time})` : ""}. Hasil dibandingkan dengan daftar featured pada tanggal wish. Rate off membuat 5★ berikutnya guaranteed rate-up; rate on mengakhiri guaranteed sebelumnya.</p><p>Jika tanggal berada di pergantian banner, metadata belum tersedia, atau item tidak bisa dikenali, status ditampilkan belum diketahui. Riwayat yang hilang setelah hasil terakhir juga dapat mengubah kondisi sebenarnya.</p></details></div>}</article>; })}</div>
          <p className="data-note">Riwayat yang tidak lengkap bisa membuat hitungan pity lebih rendah dari kondisi di game.</p>
        </section>}
        {page.slug === "journey" && <JourneyCharts stats={stats} />}
        {page.slug === "planner" && <WishPlanner key={`plan:${stats?.uid ?? "none"}`} stats={stats} />}
        {page.slug === "timeline" && <WishTimeline key={stats?.uid ?? "no-account"} uid={stats?.uid ?? null} revision={stats} />}
        {page.slug === "history" && <WishHistory key={stats?.uid ?? "no-account"} uid={stats?.uid ?? null} revision={stats} />}
        {page.slug === "characters" && <CharacterBuilds key={knownUid ?? "catalog"} uid={knownUid} privateMode={privateMode} />}
        {page.slug === "backup" && <ArchiveTools uid={stats?.uid ?? null} privateMode={privateMode} disabled={busy || loading} onImported={importedAccount} />}
        {(page.slug === "guide" || launchHint || connectionIssue) && <ConnectionCheck session={session} />}
        {page.slug === "guide" && <section className="guide" id="guide"><div className="section-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>A little ritual. A fresh archive.</h2></div><BookOpen size={24} /></div><ol><li><span>01</span><div><h3>Buka Genshin</h3><p>Jalankan game lewat HoYoPlay di PC yang sama.</p></div></li><li><span>02</span><div><h3>Muat Wish History</h3><p>Buka Wish → History sampai riwayat selesai dimuat.</p></div></li><li><span>03</span><div><h3>Sync & return</h3><p>Klik Start Sync dan izinkan Irminsul Sync terbuka.</p></div></li></ol></section>}
        <footer><span><Leaf size={14} /> Irminsul Wish</span><p>Fan-made wish archive · Tidak berafiliasi dengan HoYoverse.</p><a href="#main">Kembali ke atas ↑</a></footer>
      </main>
    </div>
  </div>;
}

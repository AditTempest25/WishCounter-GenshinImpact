"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

export default function HoyolabBuildSync({ uid, onLoaded }: { uid: string|null; onLoaded: (snapshot: unknown, fetchedAt: string, previous?:unknown, previousAt?:string) => void }) {
  const [session,setSession] = useState<{token:string;protocol_uri:string;expires_at:string}|null>(null);
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [error,setError] = useState('');
  const request = useRef<AbortController|null>(null);
  const [connected,setConnected]=useState(false);
  const snapshot = useCallback(async (signal: AbortSignal) => {
    if (!uid) return;
    const response = await apiFetch(`/api/backend/accounts/${uid}/hoyolab-builds`, {cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(35000)])});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? 'Build HoYoLAB belum dapat dimuat.');
    if (data.snapshot && !signal.aborted) { onLoaded(data.snapshot,data.fetched_at,data.previous_snapshot,data.previous_fetched_at); setMessage('Snapshot HoYoLAB tersimpan dimuat. Sync kembali untuk memperbarui.'); }
  }, [uid,onLoaded]);
  useEffect(() => {
    const controller = new AbortController();
    void snapshot(controller.signal).catch(()=>{});
    return () => { controller.abort(); request.current?.abort(); };
  }, [snapshot]);
  async function cancel() {
    request.current?.abort(); setBusy(false); setSession(null);
    setMessage('Sinkronisasi build dihentikan di web. Tutup companion jika masih terbuka.');
    if (session) try {
      const response = await apiFetch(`/api/backend/build-sync-sessions/${session.token}/cancel`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Cancel failed');
    } catch { setError('Sesi belum berhasil dibatalkan di server. Tutup companion agar tidak mengunggah.'); }
  }
  async function start() {
    if (!uid) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setConnected(false); setError(''); setMessage('Menyiapkan login HoYoLAB…');
    try {
      const response = await apiFetch(`/api/backend/accounts/${uid}/build-sync`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});
      const created = await response.json();
      if (!response.ok) throw new Error(created.message ?? 'Sesi build gagal dibuat.');
      if (controller.signal.aborted) return;
      setSession(created); setMessage('Login di jendela companion, lalu klik Sync this account. Gunakan companion v1.1.1 atau lebih baru.');
      window.location.href = created.protocol_uri;
      while (!controller.signal.aborted) {
        await new Promise<void>((resolve,reject) => { const onAbort = () => {clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));}; const timer = setTimeout(()=>{controller.signal.removeEventListener('abort',onAbort);resolve();},2000);controller.signal.addEventListener('abort',onAbort,{once:true}); });
        if (Date.now() >= Date.parse(created.expires_at)) throw new Error('Sesi build kedaluwarsa. Mulai sync HoYoLAB baru.');
        const poll = await apiFetch(`/api/backend/build-sync-sessions/${created.token}`, {cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        const status = await poll.json();
        if (!poll.ok) throw new Error(status.message ?? 'Status sync belum dapat dibaca.');
        if (status.message && status.status==='waiting') {setConnected(true);setMessage(status.message);}
        if (status.status === 'failed') throw new Error(status.message ?? 'Companion gagal. Periksa pesannya lalu mulai lagi.');
        if (status.status === 'completed') { await snapshot(controller.signal); setMessage(status.message ?? 'Build HoYoLAB berhasil disimpan.'); setSession(null); break; }
      }
    } catch(e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Sync build gagal.'); }
    finally { if (request.current === controller) setBusy(false); }
  }
  return <div className="utility-panel hoyolab-connect"><div className="section-heading"><div><h3>Semua build dari HoYoLAB</h3><p className="subtle">Login langsung di companion Windows. Tidak perlu memajang karakter di showcase.</p></div><button className="primary" disabled={!uid||busy} onClick={start}>{busy?'Menunggu companion…':'Sync HoYoLAB'}</button></div>
    <p className="data-note">Gunakan companion v1.1.1+. Cookie login tetap di PC, sesi jendela bersifat InPrivate. Hanya data karakter, senjata, artefak, dan stat yang disimpan di akun Irminsul. <a href="https://github.com/AditTempest25/WishCounter-GenshinImpact/releases/tag/companion-v1.1.1" target="_blank" rel="noreferrer">Companion v1.1.1 ↗</a></p>
    <div className="companion-status"><strong>Companion minimum: v1.1.1</strong><a href="/downloads/IrminsulSync-Windows.zip">Unduh / update companion</a></div>
    {busy&&<ol className="build-sync-steps" aria-label="Progres sync"><li>Sesi dibuat {session?'✓':'…'}</li><li>{connected?'Companion terhubung ✓':'Menunggu companion…'}</li><li>Login, baca build, lalu unggah di companion</li></ol>}
    {busy&&<p className="subtle">Jumlah karakter yang sedang dibaca terlihat di terminal companion. Web menunggu snapshot selesai; persentase tidak diperkirakan.</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="build-notice">{error}</p>}
    {session && <div className="tool-actions"><a className="secondary" href={session.protocol_uri}>Buka companion lagi</a><button className="text-button" onClick={cancel}>Batalkan</button></div>}
  </div>;
}

"use client";
import { useState } from "react";
import { apiFetch, API_BASE, type SyncSession } from "../lib/api";

export default function ConnectionCheck({ session }: { session: SyncSession | null }) {
  const [state, setState] = useState("Belum diperiksa");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true); setState("Memeriksa API dan database…");
    try {
      const response = await apiFetch(`${API_BASE}/health`, { cache: "no-store", signal: AbortSignal.timeout(115000) });
      const body = await response.json();
      if (!response.ok || body.status !== "ok") throw new Error();
      setState("API dan database terhubung.");
    } catch { setState("API belum bisa dihubungi. Pastikan server API berjalan dan alamatnya sesuai, lalu periksa lagi."); }
    finally { setBusy(false); }
  }
  return <section id="connection" className="content-section utility-panel"><h2>Bantuan koneksi</h2><p role="status">{state}</p><div className="tool-actions"><button className="secondary" onClick={check} disabled={busy}>{busy ? "Memeriksa…" : "Periksa koneksi"}</button><a className="secondary" href="/downloads/IrminsulSync-Windows.zip" download>Unduh companion Windows</a></div>
    <p>{session?.status === "syncing" || session?.status === "completed" ? "Companion sudah merespons sesi ini." : session?.status === "failed" ? session.message : "Companion belum terkonfirmasi pada sesi ini. Browser tidak dapat memeriksa registrasi Windows secara langsung."}</p>
    <details><summary>Companion tidak muncul?</summary><ol><li>Unduh dan ekstrak seluruh ZIP companion.</li><li>Jalankan Install.cmd pada akun Windows yang sama dengan browser. Installer memasang companion dan tautan irminsul://.</li><li>Refresh dashboard, buka Wish → History di Genshin, lalu mulai sync baru.</li><li>Izinkan browser membuka Irminsul Sync. Jika perlu, klik tautan Buka Irminsul Sync di panel sync.</li></ol><p>Untuk versi online, cukup buka website dan jalankan Genshin. Server web/API hanya perlu dijalankan sendiri jika memakai versi localhost. Akses pertama hosting gratis bisa lebih lama saat server bangun.</p></details>
  </section>;
}

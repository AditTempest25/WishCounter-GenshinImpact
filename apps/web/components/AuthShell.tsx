"use client";

import { useEffect, useState, type FormEvent } from "react";
import WishDashboard from "./WishDashboard";
import { API_BASE } from "../lib/api";

export type SignedInUser = { id: number; name: string; email: string };
export type OwnedAccount = { uid: string; region: string | null };
type Session = { user: SignedInUser; accounts: OwnedAccount[] };

async function authRequest(path: string, body?: Record<string, string>) {
  const response = await fetch(`${API_BASE}/auth/${path}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(115000) });
  const data = await response.json();
  if (!response.ok) {
    const details = data.errors ? Object.values(data.errors).flat().join(" ") : data.message;
    throw new Error(details || "Permintaan gagal. Coba lagi.");
  }
  return data;
}

export default function AuthShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [message, setMessage] = useState("");
  async function loadSession() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/me`, { cache: "no-store", signal: AbortSignal.timeout(115000) });
      if (response.status === 401) { setSession(null); return; }
      if (!response.ok) throw new Error();
      setSession(await response.json()); setMessage("");
    } catch { setMessage("Layanan login belum bisa dihubungi. Pastikan API aktif, lalu coba lagi."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void loadSession();
    const expired = () => { setSession(null); setMessage("Sesi berakhir. Silakan login kembali."); };
    window.addEventListener("irminsul:unauthorized", expired);
    // Prevent another open tab from retaining the previous user's rendered archive.
    const changed = (event: StorageEvent) => { if (event.key === "irminsul:auth-change") { setSession(null); void loadSession(); } };
    window.addEventListener("storage", changed);
    return () => { window.removeEventListener("irminsul:unauthorized", expired); window.removeEventListener("storage", changed); };
  }, []);
  function announceChange() { try { localStorage.setItem("irminsul:auth-change", String(Date.now())); } catch { /* Storage may be disabled. */ } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const fields = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try { await authRequest(register ? "register" : "login", fields); announceChange(); await loadSession(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Login gagal."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setMessage("");
    try { await authRequest("logout", {}); setSession(null); announceChange(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Logout gagal. Coba lagi."); }
    finally { setBusy(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await authRequest("password", Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>); setSession(null); announceChange(); setMessage("Password diubah. Silakan login kembali."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Password gagal diubah."); }
    finally { setBusy(false); }
  }
  if (loading) return <main className="auth-screen"><p role="status">Memeriksa sesi login…</p></main>;
  if (!session) return <main className="auth-screen"><section className="auth-card"><p className="eyebrow">IRminsul / YOUR PRIVATE ARCHIVE</p><h1>{register ? "Mulai arsipmu" : "Selamat datang kembali"}</h1><p>Login untuk menyimpan riwayat wish di akunmu sendiri. Gunakan password khusus Irminsul, bukan password HoYoverse.</p>
    <form onSubmit={submit}>{register && <label>Nama<input name="name" required maxLength={80} autoComplete="name" /></label>}<label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label><label>Password<input name="password" type="password" required minLength={register ? 12 : undefined} maxLength={72} autoComplete={register ? "new-password" : "current-password"} /></label>{register && <><label>Ulangi password<input name="password_confirmation" type="password" required maxLength={72} autoComplete="new-password" /></label><small>Minimal 12 karakter, maksimal 72 byte.</small></>}
    <button className="primary" disabled={busy}>{busy ? "Memproses…" : register ? "Buat akun" : "Login"}</button></form>
    {message && <p role="alert" className="auth-message">{message}</p>}<div className="tool-actions"><button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setMessage(""); }}>{register ? "Sudah punya akun? Login" : "Belum punya akun? Daftar"}</button><button className="text-button" disabled={busy} onClick={loadSession}>Periksa koneksi lagi</button></div><p className="data-note">Arsip lokal sebelum fitur login tetap tersimpan. Pemilik server dapat menghubungkannya ke akun yang benar setelah pendaftaran.</p></section></main>;
  return <><div className="session-bar"><div><strong>{session.user.name}</strong><span>Arsip pribadi</span></div><button className="secondary" disabled={busy} onClick={logout}>Logout</button><details><summary>Ganti password</summary><form className="password-form" onSubmit={changePassword}><label>Password saat ini<input name="current_password" type="password" required autoComplete="current-password" /></label><label>Password baru<input name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" /></label><label>Ulangi password baru<input name="password_confirmation" type="password" required maxLength={72} autoComplete="new-password" /></label><button className="secondary" disabled={busy}>Simpan & logout semua sesi</button></form></details>{message && <p role="alert">{message}</p>}</div><WishDashboard key={session.user.id} user={session.user} initialAccounts={session.accounts} /></>;
}

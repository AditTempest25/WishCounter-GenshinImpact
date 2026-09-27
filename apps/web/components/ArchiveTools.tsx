"use client";

import { useRef, useState } from "react";
import { apiFetch, API_BASE } from "../lib/api";

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Archive = { format: "irminsul-archive"; version: 1; account: { uid: string; region?: string | null }; wishes: unknown[] };
export default function ArchiveTools({ uid, privateMode, disabled, onImported }: { uid: string | null; privateMode: boolean; disabled: boolean; onImported: (uid: string) => Promise<void> }) {
  const [preview, setPreview] = useState<Archive | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function readFile(file?: File) {
    setPreview(null); setMessage("");
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("File terlalu besar. Batas 4 MB.");
      const data = JSON.parse(await file.text());
      if (data?.format !== "irminsul-archive" || data.version !== 1 || typeof data.account?.uid !== "string" || !/^\d{6,20}$/.test(data.account.uid) || !Array.isArray(data.wishes) || data.wishes.length > 50000) throw new Error("Gunakan file backup Irminsul versi 1 dengan maksimal 50.000 wish.");
      setPreview(data);
    } catch (e) { setMessage(e instanceof SyntaxError ? "File JSON rusak atau bukan backup Irminsul." : e instanceof Error ? e.message : "File tidak bisa dibaca."); }
  }
  async function exportArchive() {
    if (!uid) return;
    setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${API_BASE}/accounts/${encodeURIComponent(uid)}/archive`, { cache: "no-store", signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Ekspor gagal (API ${response.status}).`);
      downloadBlob(await response.blob(), `irminsul-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage("Backup diunduh. File berisi UID dan seluruh riwayat, termasuk saat mode privasi aktif.");
    } catch { setMessage("Backup belum bisa diunduh. Periksa koneksi API lalu coba lagi."); }
    finally { setBusy(false); }
  }
  async function importArchive() {
    if (!preview) return;
    setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${API_BASE}/archives/import`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(preview), signal: AbortSignal.timeout(120000) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const errors = body?.errors ? Object.values(body.errors).flat() : [];
        throw new Error(typeof errors[0] === "string" ? errors[0] : `Impor ditolak (API ${response.status}). Periksa format atau batas ukuran upload server.`);
      }
      const result = await response.json();
      setPreview(null); if (input.current) input.current.value = "";
      setMessage(`Impor selesai: ${result.added} wish baru, ${result.duplicates} duplikat dilewati.`);
      await onImported(result.uid);
    } catch (e) { setMessage(e instanceof Error && e.name === "TimeoutError" ? "API belum merespons. Impor mungkin masih berjalan; muat ulang akun atau impor ulang file yang sama. Duplikat akan dilewati." : e instanceof Error ? e.message : "Impor gagal."); }
    finally { setBusy(false); }
  }
  return <section id="backup" className="content-section utility-panel"><div className="section-heading"><div><p className="eyebrow">KEEP YOUR MEMORIES</p><h2>Backup & restore</h2></div></div>
    <p>Simpan arsip sebelum pindah PC. Impor menggabungkan wish tanpa menghapus data lama. Format ini khusus Irminsul, bukan UIGF.</p>
    <div className="tool-actions"><button className="secondary" disabled={!uid || busy || disabled} onClick={exportArchive}>Unduh backup JSON</button><label className="file-picker">Pilih backup<input ref={input} type="file" accept=".json,application/json" disabled={busy || disabled} onChange={e => void readFile(e.target.files?.[0])} /></label></div>
    {preview && <div className="import-preview"><strong>UID {privateMode ? "•••••••••" : preview.account.uid} · {preview.wishes.length.toLocaleString("id-ID")} wish</strong><p>{uid && uid !== preview.account.uid ? "Backup berasal dari akun berbeda. Setelah impor, dashboard akan menampilkan akun tersebut." : "Periksa akun sebelum menggabungkan arsip."}</p><button className="primary" disabled={busy || disabled} onClick={importArchive}>{busy ? "Memproses…" : "Impor & gabungkan"}</button> <button className="secondary" disabled={busy} onClick={() => { setPreview(null); if (input.current) input.current.value = ""; }}>Batal</button></div>}
    <p role="status">{message}</p><p className="data-note">Backup berisi UID asli. Simpan file secara pribadi. Maksimal 4 MB / 50.000 wish; server juga harus mengizinkan ukuran tersebut.</p>
  </section>;
}

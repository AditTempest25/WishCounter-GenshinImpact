"use client";

import { useEffect, useRef, useState } from "react";
import {
  createSyncSession,
  getAccountStats,
  getSyncSession,
  type AccountStats,
  type SyncSession,
} from "../lib/api";

const bannerMeta: Record<string, { name: string; fallbackCap: number; note: string }> = {
  "301": { name: "Character Event", fallbackCap: 90, note: "Featured guarantee metadata comes in V2" },
  "302": { name: "Weapon Event", fallbackCap: 80, note: "Fate Point is not inferred in V1" },
  "200": { name: "Standard", fallbackCap: 90, note: "Permanent Wish" },
  "500": { name: "Chronicled Wish", fallbackCap: 90, note: "UIGF pity group 500" },
};

export default function WishDashboard() {
  const [session, setSession] = useState<SyncSession | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncGeneration = useRef(0);

  useEffect(() => {
    const lastUid = window.localStorage.getItem("irminsul:lastUid");
    if (lastUid) getAccountStats(lastUid).then(setStats).catch(() => undefined);
    return () => {
      syncGeneration.current++;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function startSync() {
    const generation = ++syncGeneration.current;
    setBusy(true);
    setError(null);
    try {
      const created = await createSyncSession();
      if (generation !== syncGeneration.current) return;
      setSession(created);
      window.location.href = created.protocol_uri;

      if (timer.current) clearInterval(timer.current);
      let polling = false;
      timer.current = setInterval(async () => {
        if (generation !== syncGeneration.current) return;
        if (Date.now() >= Date.parse(created.expires_at)) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setBusy(false);
          setError("Sync session expired. Start a new sync.");
          return;
        }
        if (polling) return;
        polling = true;
        try {
          const current = await getSyncSession(created.token);
          if (generation !== syncGeneration.current) return;
          setSession({ ...current, protocol_uri: created.protocol_uri });

          if (current.status === "completed" || current.status === "failed") {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
            setBusy(false);

            if (current.status === "completed" && current.uid) {
              window.localStorage.setItem("irminsul:lastUid", current.uid);
              const updatedStats = await getAccountStats(current.uid);
              if (generation === syncGeneration.current) setStats(updatedStats);
            }
          }
        } catch {
          // Temporary API restart/network error: keep polling until session expiration.
        } finally {
          polling = false;
        }
      }, 1500);
    } catch (e) {
      if (generation !== syncGeneration.current) return;
      setError(e instanceof Error ? e.message : "Could not start sync");
      setBusy(false);
    }
  }

  function cancelSync() {
    syncGeneration.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setBusy(false);
    setSession(null);
    setError(null);
  }

  return (
    <>
      <section className="accountBar card">
        <div>
          <span className="muted">Connected account</span>
          <strong>{stats ? `UID ${stats.uid}` : "No account synced yet"}</strong>
          {stats?.region && <span className="muted">{stats.region}</span>}
        </div>
        <div>
          <span className="muted">Stored wishes</span>
          <strong>{stats?.total_wishes ?? 0}</strong>
        </div>
        <button className="primary compact" onClick={startSync} disabled={busy}>
          {busy ? "Syncing…" : "Start Sync"}
        </button>
      </section>

      {session && (
        <section className="sessionLine">
          <span>Sync: <strong>{session.status}</strong></span>
          {typeof session.new_wishes === "number" && <span>{session.new_wishes} new wishes</span>}
          {session.message && <span>{session.message}</span>}
        </section>
      )}
      {busy && session?.protocol_uri && (
        <section className="sessionLine">
          <span>Belum terbuka? Gunakan Chrome/Edge, buka companion, lalu izinkan jika diminta.</span>
          <a className="primary compact" href={session.protocol_uri}>Buka Irminsul Sync</a>
          <button onClick={cancelSync}>Batalkan</button>
        </section>
      )}
      {error && <p className="error">{error}</p>}

      <section className="grid">
        {Object.entries(bannerMeta).map(([type, meta]) => {
          const banner = stats?.banners[type];
          const pity = banner?.current_pity ?? 0;
          const cap = banner?.hard_pity ?? meta.fallbackCap;
          return (
            <article className="card" key={type}>
              <div className="cardHeader">
                <div>
                  <h2>{meta.name}</h2>
                  <span className="smallStat">{banner?.total_wishes ?? 0} stored pulls</span>
                </div>
                <span>{pity}/{cap}</span>
              </div>
              <div className="meter"><div style={{ width: `${Math.min(100, (pity / cap) * 100)}%` }} /></div>
              {banner?.last_5_star ? (
                <p className="muted">Last 5★: {banner.last_5_star.name} · {banner.last_5_star.time}</p>
              ) : (
                <p className="muted">No visible 5★ record yet.</p>
              )}
              <p className="muted">{meta.note}</p>
            </article>
          );
        })}
      </section>
    </>
  );
}

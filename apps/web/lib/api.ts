export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

export type SyncSession = {
  token: string;
  status: "waiting" | "syncing" | "completed" | "failed";
  protocol_uri: string;
  expires_at: string;
  new_wishes?: number;
  uid?: string | null;
  message?: string | null;
};

export async function createSyncSession(): Promise<SyncSession> {
  const response = await fetch(`${API_BASE}/sync-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export async function getSyncSession(token: string): Promise<SyncSession> {
  const response = await fetch(`${API_BASE}/sync-sessions/${encodeURIComponent(token)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export type BannerStats = {
  current_pity: number;
  hard_pity: number;
  total_wishes: number;
  last_5_star: { name: string; item_type: string; time: string } | null;
};

export type AccountStats = {
  uid: string;
  region: string | null;
  total_wishes: number;
  banners: Record<string, BannerStats>;
};

export async function getAccountStats(uid: string): Promise<AccountStats> {
  const response = await fetch(`${API_BASE}/accounts/${encodeURIComponent(uid)}/stats`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

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
  last_5_star: { name: string; item_id?: string | null; item_type: string; time: string } | null;
};

export type AccountStats = {
  uid: string;
  region: string | null;
  last_synced_at: string | null;
  next_guarantee?: Record<string, "guaranteed" | "not_guaranteed" | "unknown">;
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

export type WishRecord = {
  id: string;
  item_id?: string | null;
  banner: string;
  gacha_type: string;
  name: string;
  item_type: string;
  rarity: number;
  time: string;
  rate_up?: { result: "on" | "off" | "unknown"; guaranteed_before: boolean | null; label: string } | null;
};

export type WishHistoryPage = {
  data: WishRecord[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export async function getWishHistory(uid: string, page: number, banner: string, rarity: string, signal: AbortSignal): Promise<WishHistoryPage> {
  const query = new URLSearchParams({ page: String(page) });
  if (banner !== "all") query.set("banner", banner);
  if (rarity !== "all") query.set("rarity", rarity);
  const response = await fetch(`${API_BASE}/accounts/${encodeURIComponent(uid)}/wishes?${query}`, {
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error(`Gagal memuat history (API ${response.status}).`);
  return response.json();
}

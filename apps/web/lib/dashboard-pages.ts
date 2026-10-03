export const dashboardPages = [
  { slug: "", label: "Overview", description: "Ringkasan arsip, pity event, dan status pull berikutnya." },
  { slug: "insights", label: "Wish insights", description: "Statistik rarity dan jarak antar-5★ dari arsipmu." },
  { slug: "banners", label: "Banner pity", description: "Pity, hasil 5★ terakhir, dan status guaranteed setiap banner." },
  { slug: "timeline", label: "5★ timeline", description: "Telusuri momen 5★ dan hasil rate on atau rate off." },
  { slug: "history", label: "Wish history", description: "Cari dan filter seluruh riwayat wish yang tersimpan." },
  { slug: "journey", label: "Perjalanan wish", description: "Lihat aktivitas bulanan dan perjalanan pity kamu." },
  { slug: "characters", label: "Character builds", description: "Jelajahi karakter, muat showcase, dan evaluasi build." },
  { slug: "planner", label: "Target wish", description: "Rencanakan tabungan untuk karakter impianmu." },
  { slug: "backup", label: "Backup & restore", description: "Ekspor arsip dan pulihkan riwayat dari file backup." },
  { slug: "guide", label: "Sync guide", description: "Pasang companion dan hubungkan arsip dari Genshin." },
] as const;

export const legacyDashboardHashes: Record<string, string> = {
  overview: "/", insights: "/insights", banners: "/banners", recent: "/timeline",
  history: "/history", journey: "/journey", characters: "/characters",
  planner: "/planner", backup: "/backup", guide: "/guide",
};

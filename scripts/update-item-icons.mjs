import { writeFile } from "node:fs/promises";

// Keep only public catalog metadata; no account data is sent to the catalog API.
const catalog = {};
for (const kind of ["characters", "weapons"]) {
  const url = `https://genshin-db-api.vercel.app/api/v5/${kind}?query=names&matchCategories=true&verboseCategories=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Catalog ${kind}: HTTP ${response.status}`);
  const entries = await response.json();
  if (!Array.isArray(entries) || !entries.length) throw new Error(`Empty catalog: ${kind}`);
  for (const item of entries) {
    const icon = item.images?.filename_icon;
    if (item.id && item.name && /^UI_[a-zA-Z0-9_]+$/.test(icon ?? "")) {
      catalog[item.id] = { name: item.name, icon: `https://enka.network/ui/${icon}.png`, kind };
    }
  }
}
await writeFile(new URL("../apps/web/lib/data/item-icons.json", import.meta.url), JSON.stringify(catalog, null, 2) + "\n");
console.log(`Updated ${Object.keys(catalog).length} item icons.`);

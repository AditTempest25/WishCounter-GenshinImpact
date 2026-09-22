import { readFile, writeFile } from 'node:fs/promises';

const source = 'https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/banners.js';
const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Banner catalog: HTTP ${response.status}`);
const text = await response.text();
const banners = [];
for (const [kind, group] of [['characters', '301'], ['weapons', '302']]) {
  const section = text.match(new RegExp(`  ${kind}: \\[(.*?)(?=\\n  [a-zA-Z]+: \\[|\\n};)`, 's'))?.[1];
  if (!section) throw new Error(`Missing banner section: ${kind}`);
  for (const [object] of section.matchAll(/\{[^{}]*\}/gs)) {
    const start = object.match(/start: '([^']+)'/)?.[1]?.slice(0, 10);
    const end = object.match(/end: '([^']+)'/)?.[1]?.slice(0, 10);
    const featured = [...(object.match(/featured: \[(.*?)\]/s)?.[1] ?? '').matchAll(/'([^']+)'/g)]
      .map(match => match[1].toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (start && end && featured.length) banners.push({ group, start, end, featured });
  }
}
if (banners.length < 200) throw new Error('Unexpectedly incomplete banner catalog; keeping the existing files.');
const icons = JSON.parse(await readFile(new URL('../apps/web/lib/data/item-icons.json', import.meta.url), 'utf8'));
const items = Object.fromEntries(Object.entries(icons).map(([id, item]) => [id, item.name.toLowerCase().replace(/[^a-z0-9]/g, '')]));
const snapshot = JSON.stringify({ source, retrieved_at: new Date().toISOString().slice(0, 10), banners }, null, 2) + '\n';
// Keep the tracked overlay and the existing local Laravel installation in sync.
for (const root of ['api-overlay', 'api']) {
  await writeFile(new URL(`../apps/${root}/resources/data/banner-history.json`, import.meta.url), snapshot);
  await writeFile(new URL(`../apps/${root}/resources/data/item-catalog.json`, import.meta.url), JSON.stringify(items, null, 2) + '\n');
}
console.log(`Updated ${banners.length} banner periods. No account data sent.`);

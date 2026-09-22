"use client";

import Image from "next/image";
import { useState } from "react";
import { Sparkles, Swords } from "lucide-react";
import catalog from "../lib/data/item-icons.json";

type IconEntry = { name: string; icon: string; kind: string };
const byId: Record<string, IconEntry> = catalog;
const normalize = (name: string) => name.normalize("NFKC").replace(/[’‘]/g, "'").trim().toLowerCase();
const byName = new Map(Object.values(byId).map(entry => [normalize(entry.name), entry]));

export default function ItemIcon({ itemId, name, itemType, rarity = 5 }: {
  itemId?: string | null;
  name: string;
  itemType: string;
  rarity?: number;
}) {
  const entry = (itemId ? byId[itemId] : undefined) ?? byName.get(normalize(name));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const weapon = entry?.kind === "weapons" || /weapon|senjata/i.test(itemType);
  return <span className={`item-icon item-icon-${rarity}`}>
    {entry && failedUrl !== entry.icon
      ? <Image src={entry.icon} alt="" width={48} height={48} unoptimized loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(entry.icon)} />
      : weapon ? <Swords size={22} aria-hidden="true" /> : <Sparkles size={22} aria-hidden="true" />}
  </span>;
}

"use client";

// Klein inline SVG-setje in huisstijl-oranje (geen library), stijl van het
// voorbeeld. Plus de fase-lijst: de namen komen uit lib/fase-volgorde.ts, hier
// plakken we alleen het icoontje erbij.

import { FASE_VOLGORDE } from "../../../../../lib/fase-volgorde";
import type { FaseKey } from "./types";

export function Icoon({ d, className = "wp-fase-icoon" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

export const ICOON = {
  strategie: "M4 21V4|M4 4h12l-2 4 2 4H4",
  gelieerde: "M18 8a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z|M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z|M18 22a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z|M8.7 10.6l6.6-3.2|M8.7 13.4l6.6 3.2",
  analyse: "M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z|M21 21l-4.3-4.3",
  blauwdruk: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  copy: "M14 3H6v18h12V7l-4-4Z|M14 3v4h4",
  bouw: "M12 17V9|M12 9l-3 3|M12 9l3 3|M20 17a4 4 0 0 0-1-7.9A6 6 0 0 0 7.2 8 5 5 0 0 0 4 17",
  structured: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z|M20 6v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6|M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3",
  chat: "M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z",
  pin: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z|M12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  doel: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0|M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0|M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0",
};

export const FASEN: { key: FaseKey; label: string; kort: string; icoon: string }[] =
  FASE_VOLGORDE.map((f) => ({ ...f, icoon: ICOON[f.key] }));

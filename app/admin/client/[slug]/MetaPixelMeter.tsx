"use client";

import { metaPixelInfo, type MetaKind } from "@/lib/meta-rules";

// Live pixel-meter voor een meta-title of meta-description: balk + oordeel,
// exact dezelfde meting als de server (lib/meta-rules.ts is de enige bron).
const STATUS_STYLE: Record<string, { bar: string; text: string; woord: string }> = {
  ok: { bar: "#2e9e5b", text: "#2e7d32", woord: "past" },
  bijna: { bar: "#f0a020", text: "#b26a00", woord: "past, bijna vol" },
  kort: { bar: "#f0a020", text: "#b26a00", woord: "te kort, ruimte over" },
  over: { bar: "#d64545", text: "#c62828", woord: "te lang, wordt afgekapt" },
};

export default function MetaPixelMeter({ kind, text }: { kind: MetaKind; text: string }) {
  const info = metaPixelInfo(kind, text || "");
  const s = STATUS_STYLE[info.status] || STATUS_STYLE.ok;
  const pct = Math.min(100, (info.px / info.max) * 100);
  return (
    <div
      role="meter"
      aria-valuenow={info.px}
      aria-valuemin={0}
      aria-valuemax={info.max}
      aria-label={kind === "meta_title" ? "Breedte paginatitel" : "Breedte meta-beschrijving"}
      style={{ marginTop: 4, marginBottom: 6 }}
    >
      <div style={{ height: 4, borderRadius: 2, background: "#eee4da", overflow: "hidden", maxWidth: 340 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: s.bar, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, marginTop: 3, color: s.text }}>
        {info.px} px / max {info.max} px · {s.woord} · {info.chars} tekens
      </div>
    </div>
  );
}

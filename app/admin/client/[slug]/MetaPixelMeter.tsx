"use client";

import { metaPixelInfo, type MetaKind } from "@/lib/meta-rules";

// Live pixel-meter voor een meta-title of meta-description: balk + oordeel,
// exact dezelfde meting als de server (lib/meta-rules.ts is de enige bron).
const STATUS_STYLE: Record<string, { bar: string; text: string; woord: string }> = {
  ok: { bar: "#2e9e5b", text: "var(--kleur-goed)", woord: "past" },
  bijna: { bar: "#f0a020", text: "var(--kleur-let-op)", woord: "past, bijna vol" },
  kort: { bar: "#f0a020", text: "var(--kleur-let-op)", woord: "te kort, ruimte over" },
  over: { bar: "#d64545", text: "var(--bad)", woord: "te lang, wordt afgekapt" },
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
      style={{ marginTop: "var(--s-1)", marginBottom: "var(--s-2)" }}
    >
      <div style={{ height: 4, borderRadius: "var(--r-full)", background: "var(--card-border)", overflow: "hidden", maxWidth: 340 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: s.bar, borderRadius: "var(--r-full)" }} />
      </div>
      <div style={{ fontSize: "var(--fs-xs)", marginTop: "var(--s-1)", color: s.text }}>
        {info.px} px / max {info.max} px · {s.woord} · {info.chars} tekens
      </div>
    </div>
  );
}

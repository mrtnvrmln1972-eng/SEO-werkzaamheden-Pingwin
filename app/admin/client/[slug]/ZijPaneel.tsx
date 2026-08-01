"use client";

// Herbruikbaar zijpaneel met een tabje aan de rechter schermrand (huisstijl).
// Klik op het tabje = paneel schuift in; sluiten via kruisje, tabje of Escape.
// Het paneel klapt nooit vanzelf dicht (vaste huisregel). Meerdere panelen
// kunnen gestapeld worden via de top-offset.

import { useEffect, useState } from "react";

export default function ZijPaneel({ label, top = 140, children }: { label: string; top?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={"zp-tab" + (open ? " zp-tab-open" : "")} style={{ top }} onClick={() => setOpen((v) => !v)} title={open ? `${label} sluiten` : `${label} openen`}>
        {label}
      </button>
      <div className={"zp-paneel" + (open ? " zp-open" : "")} style={{ top }} role="dialog" aria-label={label} aria-hidden={!open}>
        <div className="zp-kop">
          <span className="zp-titel">{label}</span>
          <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="zp-inhoud">{children}</div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bel, Herhaal, Kalender } from "../../_ui/Pijl";

// Compacte datumknop: een badge die je aanklikt, en die dan een klein
// zwevend paneel toont met Datum/Duur, Herinnering en Herhalen. Domme schil
// zonder eigen logica, zelfde patroon als AgendaPopup: de aanroeper levert
// de inhoud, dit component regelt alleen positie/open-dicht.
export default function DatumKnop({
  label, datumSlot, duurSlot, reminderSlot, herhaalSlot, subtiel,
}: {
  label: string;
  datumSlot: React.ReactNode;
  duurSlot?: React.ReactNode;
  reminderSlot: React.ReactNode;
  herhaalSlot?: React.ReactNode;
  /** Naast een titel in plaats van als eigen rij: kleiner en minder nadrukkelijk. */
  subtiel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"datum" | "duur">("datum");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const openedAtRef = useRef(0);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    openedAtRef.current = Date.now();
    const btn = btnRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;
    const r = btn.getBoundingClientRect();
    const margin = 8;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - margin - w));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - margin) top = Math.max(margin, r.top - h - 6);
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (Date.now() - openedAtRef.current < 200) return;
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`ag-datumknop-wrap${subtiel ? " ag-datumknop-wrap-subtiel" : ""}`}>
      <button ref={btnRef} type="button" className={`ag-datumknop${subtiel ? " ag-datumknop-subtiel" : ""}`} onClick={() => setOpen((o) => !o)}>
        <Kalender /> {label}
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`ag-datumknop-panel${pos ? "" : " ag-datumknop-panel-meten"}`}
          style={pos ? { left: pos.left, top: pos.top } : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {duurSlot && (
            <div className="ag-weekday-row ag-datumknop-tabs">
              <button type="button" className={`schakel-knop${tab === "datum" ? " aan" : ""}`} onClick={() => setTab("datum")}>Datum</button>
              <button type="button" className={`schakel-knop${tab === "duur" ? " aan" : ""}`} onClick={() => setTab("duur")}>Duur</button>
            </div>
          )}
          <div className="ag-datumknop-tabcontent">{!duurSlot || tab === "datum" ? datumSlot : duurSlot}</div>
          <div className="ag-datumknop-section">
            <span className="ag-datumknop-section-kop"><Bel /> Herinnering</span>
            {reminderSlot}
          </div>
          {herhaalSlot && (
            <div className="ag-datumknop-section">
              <span className="ag-datumknop-section-kop"><Herhaal /> Herhalen</span>
              {herhaalSlot}
            </div>
          )}
          <div className="ag-datumknop-close-row">
            <button type="button" className="btn btn-primary btn-klein" onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

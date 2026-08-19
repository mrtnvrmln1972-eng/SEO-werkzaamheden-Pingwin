"use client";

// Los, groot en centraal venster: dezelfde sleep/formaat-mechaniek als het
// zijpaneel (ZijPaneel.tsx: "los" + "groter"), maar zonder tab aan de rand en
// zonder vastgeklikte stand. Dit venster is er zodra het gemount wordt, en
// verdwijnt alleen via het kruisje of Escape, nooit door ernaast te klikken
// (vaste huisregel: overlays sluiten alleen via kruisje of annuleren).
//
// Gebruikt bewust dezelfde CSS-klassen als ZijPaneel (.zp-paneel.zp-los, .zp-kop,
// .zp-knop, .zp-inhoud, .zp-formaat): die opmaak bestaat al, dus geen tweede stijl
// voor hetzelfde soort venster.

import { useEffect, useRef, useState } from "react";
import { Groter, Kleiner } from "../../../_ui/Pijl";

type Stand = { breedte: number; hoogte: number; x: number; y: number; vol?: boolean };

const MIN_BREED = 420;
const MIN_HOOG = 320;

export default function FloatVenster({ titel, onClose, children }: { titel: string; onClose: () => void; children: React.ReactNode }) {
  const sleutel = `pingwin-float:${titel}`;
  const [stand, setStand] = useState<Stand | null>(null);
  const standRef = useRef<Stand | null>(null);
  const sleep = useRef<{ soort: "verplaats" | "formaat"; muisX: number; muisY: number; begin: Stand } | null>(null);

  function zet(s: Stand) { standRef.current = s; setStand(s); }
  function bewaar(s: Stand) { zet(s); try { window.localStorage.setItem(sleutel, JSON.stringify(s)); } catch { /* stil */ } }

  useEffect(() => {
    let s: Stand | null = null;
    try { const r = window.localStorage.getItem(sleutel); if (r) s = JSON.parse(r); } catch { /* geen opslag */ }
    if (!s) {
      const breedte = Math.min(880, window.innerWidth - 80);
      const hoogte = Math.min(660, window.innerHeight - 120);
      s = { breedte, hoogte, x: Math.round((window.innerWidth - breedte) / 2), y: Math.round(Math.max(40, (window.innerHeight - hoogte) / 2)) };
    }
    zet(s);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sleutel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    function move(e: PointerEvent) {
      const s = sleep.current;
      if (!s) return;
      const dx = e.clientX - s.muisX;
      const dy = e.clientY - s.muisY;
      if (s.soort === "verplaats") {
        zet({ ...s.begin, x: Math.max(0, s.begin.x + dx), y: Math.max(0, s.begin.y + dy) });
      } else {
        zet({ ...s.begin, breedte: Math.max(MIN_BREED, s.begin.breedte + dx), hoogte: Math.max(MIN_HOOG, s.begin.hoogte + dy) });
      }
    }
    function up() {
      if (!sleep.current) return;
      sleep.current = null;
      document.body.classList.remove("zp-sleept");
      if (standRef.current) bewaar(standRef.current);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sleutel]);

  function startSleep(soort: "verplaats" | "formaat", e: React.PointerEvent) {
    if (!standRef.current) return;
    e.preventDefault();
    sleep.current = { soort, muisX: e.clientX, muisY: e.clientY, begin: standRef.current };
    document.body.classList.add("zp-sleept");
  }

  if (!stand) return null;

  const stijl: React.CSSProperties = stand.vol ? {} : { left: stand.x, top: stand.y, width: stand.breedte, height: stand.hoogte };

  return (
    <div className={"zp-paneel zp-los zp-open" + (stand.vol ? " zp-vol" : "")} style={stijl} role="dialog" aria-label={titel}>
      <div className="zp-kop zp-kop-sleep" onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("button")) startSleep("verplaats", e); }}>
        <span className="zp-titel">{titel}</span>
        <span className="zp-kop-knoppen">
          <button type="button" className="btn btn-klein" title={stand.vol ? "Terug naar je eigen maat" : "Zo groot als het scherm toelaat"} onClick={() => bewaar({ ...stand, vol: !stand.vol })}>
            {stand.vol ? <><Kleiner /> kleiner</> : <><Groter /> groter</>}
          </button>
          <button type="button" className="wp-icon wp-del" title="Terugzetten in de pagina" onClick={onClose}>×</button>
        </span>
      </div>
      <div className="zp-inhoud">{children}</div>
      {!stand.vol && <div className="zp-formaat" title="Sleep om het venster groter of kleiner te maken" onPointerDown={(e) => startSleep("formaat", e)} />}
    </div>
  );
}

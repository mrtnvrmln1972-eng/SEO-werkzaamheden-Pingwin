"use client";

// Herbruikbaar zijpaneel met een tabje aan de rechter schermrand (huisstijl).
// Klik op het tabje = paneel schuift in; sluiten via kruisje, tabje of Escape.
// Het paneel klapt nooit vanzelf dicht (vaste huisregel). Meerdere panelen
// kunnen gestapeld worden via de top-offset.
//
// Twee standen:
// - VAST: tegen de rechterrand, breedte te slepen aan de greep links.
// - LOS:  een venster midden op je scherm, te verslepen aan de kop en groter te
//         maken aan de rechteronderhoek.
// Stand, plek en formaat worden onthouden per paneel, zodat hij na dichtklappen
// terugkomt precies zoals je hem achterliet.
//
// Daarnaast een knop "groter": in één klik zo groot als het scherm toelaat, en
// weer terug naar jouw eigen maat. Aanleiding (6 augustus 2026): slepen kón al,
// maar niemand zag het. De greep was een doorzichtige strook van acht pixels en
// het hoekje was een vaag streepje. Een functie die je niet kunt vinden bestaat
// niet. Daarom is de greep nu zichtbaar én is er een knop voor wie niet wil
// slepen. Je eigen maat blijft bewaard terwijl "groter" aanstaat, dus terugklikken
// zet hem precies terug.

import { useEffect, useRef, useState } from "react";

type Stand = { los: boolean; breedte: number; hoogte: number; x: number; y: number; vol?: boolean };

const START: Stand = { los: false, breedte: 440, hoogte: 0, x: 0, y: 0 };
const MIN_BREED = 320;
const MIN_HOOG = 220;

export default function ZijPaneel({ label, top = 140, children }: { label: string; top?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [stand, setStand] = useState<Stand>(START);
  const standRef = useRef<Stand>(START);
  const sleep = useRef<{ soort: "breedte" | "verplaats" | "formaat"; muisX: number; muisY: number; begin: Stand } | null>(null);
  const sleutel = `pingwin-zp:${label}`;

  function zet(s: Stand) {
    standRef.current = s;
    setStand(s);
  }
  function bewaar(s: Stand) {
    zet(s);
    try { window.localStorage.setItem(sleutel, JSON.stringify(s)); } catch { /* stil */ }
  }

  useEffect(() => {
    try {
      const r = window.localStorage.getItem(sleutel);
      if (r) zet({ ...START, ...JSON.parse(r) });
    } catch { /* geen opslag: dan gewoon de standaardmaat */ }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sleutel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Slepen: breedte (vast), verplaatsen (los) en formaat (los). Eén paar
  // luisteraars op het venster, zodat slepen doorloopt als je muis het paneel
  // even verlaat.
  useEffect(() => {
    function move(e: PointerEvent) {
      const s = sleep.current;
      if (!s) return;
      const dx = e.clientX - s.muisX;
      const dy = e.clientY - s.muisY;
      if (s.soort === "breedte") {
        zet({ ...s.begin, breedte: Math.max(MIN_BREED, Math.min(window.innerWidth - 40, s.begin.breedte - dx)) });
      } else if (s.soort === "verplaats") {
        zet({ ...s.begin, x: s.begin.x + dx, y: Math.max(0, s.begin.y + dy) });
      } else {
        zet({
          ...s.begin,
          breedte: Math.max(MIN_BREED, s.begin.breedte + dx),
          hoogte: Math.max(MIN_HOOG, (s.begin.hoogte || 460) + dy),
        });
      }
    }
    function up() {
      if (!sleep.current) return;
      sleep.current = null;
      document.body.classList.remove("zp-sleept");
      bewaar(standRef.current);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sleutel]);

  function startSleep(soort: "breedte" | "verplaats" | "formaat", e: React.PointerEvent) {
    e.preventDefault();
    sleep.current = { soort, muisX: e.clientX, muisY: e.clientY, begin: standRef.current };
    document.body.classList.add("zp-sleept");
  }

  function losMaken() {
    const breedte = Math.max(MIN_BREED, Math.min(stand.breedte, window.innerWidth - 80));
    const hoogte = stand.hoogte || Math.min(560, window.innerHeight - 140);
    bewaar({
      los: true,
      breedte,
      hoogte,
      x: Math.round((window.innerWidth - breedte) / 2),
      y: Math.round(Math.max(40, (window.innerHeight - hoogte) / 2)),
    });
  }

  // Op volle breedte laten we de maat aan de stijlregels over (calc met vw/vh),
  // zodat hij meegroeit als je je browservenster verandert. Zou de maat hier als
  // getal staan, dan klopte hij niet meer zodra je het venster versleept.
  const stijl: React.CSSProperties = stand.vol
    ? (stand.los ? {} : { top })
    : stand.los
      ? { left: stand.x, top: stand.y, width: stand.breedte, height: stand.hoogte || undefined }
      : { top, width: stand.breedte };

  return (
    <>
      <button type="button" className={"zp-tab" + (open ? " zp-tab-open" : "")} style={{ top }} onClick={() => setOpen((v) => !v)} title={open ? `${label} sluiten` : `${label} openen`}>
        {label}
      </button>
      <div
        className={"zp-paneel" + (open ? " zp-open" : "") + (stand.los ? " zp-los" : "") + (stand.vol ? " zp-vol" : "")}
        style={stijl}
        role="dialog"
        aria-label={label}
        aria-hidden={!open}
      >
        {!stand.los && !stand.vol && (
          <div className="zp-greep" title="Sleep om het paneel breder of smaller te maken" onPointerDown={(e) => startSleep("breedte", e)}>
            <span className="zp-greep-dots" aria-hidden="true" />
          </div>
        )}
        <div
          className={"zp-kop" + (stand.los ? " zp-kop-sleep" : "")}
          onPointerDown={(e) => { if (stand.los && !(e.target as HTMLElement).closest("button")) startSleep("verplaats", e); }}
        >
          <span className="zp-titel">{label}</span>
          <span className="zp-kop-knoppen">
            <button type="button" className="btn btn-klein"
              title={stand.vol ? "Terug naar je eigen maat" : "Zo groot als het scherm toelaat. Je eigen maat blijft bewaard."}
              onClick={() => bewaar({ ...stand, vol: !stand.vol })}>
              {stand.vol ? "\u21F2 kleiner" : "\u21F1 groter"}
            </button>
            {stand.los
              ? <button type="button" className="btn btn-klein" title="Zet het paneel terug tegen de rechterrand" onClick={() => bewaar({ ...stand, los: false })}>&#8677; zijkant</button>
              : <button type="button" className="btn btn-klein" title="Losmaken: als venster midden op je scherm, te verslepen en te vergroten" onClick={losMaken}>&#10696; losmaken</button>}
            <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={() => setOpen(false)}>×</button>
          </span>
        </div>
        <div className="zp-inhoud">{children}</div>
        {stand.los && !stand.vol && <div className="zp-formaat" title="Sleep om het venster groter of kleiner te maken" onPointerDown={(e) => startSleep("formaat", e)} />}
      </div>
    </>
  );
}

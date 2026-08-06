"use client";

// ═══════════════════════════════════════════════════════════
// DE DATUMKIEZER: een maandkalender die uitklapt
// ═══════════════════════════════════════════════════════════
// Hiervoor lag er een onzichtbaar <input type="date"> over het veldje heen. Dat
// leek netjes (de kolom bleef smal) maar werkte niet zoals je verwacht: of de
// browser een kalender opent hangt af van de browser, en op een onzichtbaar veld
// klikken doet in Safari en Firefox helemaal niets. Een planning waarin je geen
// dag kunt kiezen is geen planning.
//
// Dit is daarom een eigen kalender: klik op het veldje, je krijgt de maand te
// zien, je klikt een dag aan en die krijgt een vinkje. Bladeren met de pijltjes,
// "Vandaag" springt terug, "Wissen" haalt de dag er weer af.
//
// Eén component, gebruikt door zowel het overzicht over alle klanten als de
// planning per klant. Zo kan de ene nooit anders werken dan de andere.

import { useEffect, useRef, useState } from "react";

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DAGLETTERS = ["m", "d", "w", "d", "v", "z", "z"];

/** Vandaag als "2026-08-06", in lokale tijd; de planning denkt in kalenderdagen. */
export function vandaagIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** "2026-08-06" naar "6 aug". Leeg blijft leeg. */
export function kortDatum(iso?: string | null): string {
  if (!iso) return "";
  const [j, m, d] = iso.split("-").map(Number);
  if (!j || !m || !d) return "";
  return new Date(Date.UTC(j, m - 1, d)).toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "2026-08-06" naar "donderdag 6 augustus". Voor titels en het overzicht. */
export function langDatum(iso?: string | null): string {
  if (!iso) return "";
  const [j, m, d] = iso.split("-").map(Number);
  if (!j || !m || !d) return "";
  return new Date(Date.UTC(j, m - 1, d)).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

const isoVanDelen = (j: number, m: number, d: number) =>
  `${j}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function DatumKiezer({
  waarde, onKies, klein,
}: {
  waarde: string | null | undefined;
  onKies: (iso: string) => void;
  /** Compacte variant voor in een regel; anders iets ruimer voor het overzicht. */
  klein?: boolean;
}) {
  const iso = waarde || "";
  const [open, setOpen] = useState(false);
  // Welke maand staat er in beeld. Standaard de maand van de gekozen dag, en
  // zonder gekozen dag deze maand; anders blader je altijd vanaf januari.
  const start = iso || vandaagIso();
  const [jaar, setJaar] = useState(() => Number(start.slice(0, 4)));
  const [maand, setMaand] = useState(() => Number(start.slice(5, 7)) - 1);
  const doosRef = useRef<HTMLDivElement>(null);

  // Opnieuw openen betekent: terug naar de maand van de gekozen dag. Zonder dit
  // blijf je hangen in de maand waar je de vorige keer naartoe bladerde.
  useEffect(() => {
    if (!open) return;
    const s = iso || vandaagIso();
    setJaar(Number(s.slice(0, 4)));
    setMaand(Number(s.slice(5, 7)) - 1);
  }, [open, iso]);

  // Buiten de kalender klikken sluit hem, net als Escape. Zonder dit blijft er
  // een kalender openstaan zodra je ergens anders verder werkt.
  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      if (doosRef.current && !doosRef.current.contains(e.target as Node)) setOpen(false);
    };
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", toets);
    return () => { document.removeEventListener("mousedown", buiten); document.removeEventListener("keydown", toets); };
  }, [open]);

  const vandaag = vandaagIso();
  const isVandaag = iso && iso === vandaag;

  // De vakjes van de maand: eerst de lege plekken tot de eerste maandag, dan de
  // dagen zelf. Zo staat elke dag onder de goede letter.
  const eerste = new Date(Date.UTC(jaar, maand, 1));
  const leeg = (eerste.getUTCDay() + 6) % 7;
  const aantal = new Date(Date.UTC(jaar, maand + 1, 0)).getUTCDate();
  const vakjes: (number | null)[] = [...Array<null>(leeg).fill(null), ...Array.from({ length: aantal }, (_, i) => i + 1)];

  const blader = (stap: number) => {
    const d = new Date(Date.UTC(jaar, maand + stap, 1));
    setJaar(d.getUTCFullYear()); setMaand(d.getUTCMonth());
  };
  const kies = (dag: number) => { onKies(isoVanDelen(jaar, maand, dag)); setOpen(false); };

  return (
    <div className={"dk" + (klein ? " dk-klein" : "")} ref={doosRef} onClick={(e) => e.stopPropagation()}>
      <button type="button"
        className={"dk-veld" + (isVandaag ? " dk-vandaag" : "") + (open ? " dk-veld-open" : "")}
        title={iso ? `Staat op ${langDatum(iso)}. Klik om te wijzigen.` : "Klik om een dag te kiezen"}
        onClick={() => setOpen(!open)}>
        <span className="dk-tekst">{iso ? kortDatum(iso) : "dag kiezen"}</span>
        <svg className="dk-pijl" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>

      {open && (
        <div className="dk-doos" role="dialog" aria-label="Kies een dag">
          <div className="dk-kop">
            <button type="button" className="dk-blader" title="Vorige maand" onClick={() => blader(-1)}>‹</button>
            <span className="dk-maand">{MAANDEN[maand]} {jaar}</span>
            <button type="button" className="dk-blader" title="Volgende maand" onClick={() => blader(1)}>›</button>
          </div>
          <div className="dk-letters">{DAGLETTERS.map((l, i) => <span key={i}>{l}</span>)}</div>
          <div className="dk-grid">
            {vakjes.map((dag, i) => {
              if (dag === null) return <span key={`leeg-${i}`} className="dk-leeg" />;
              const d = isoVanDelen(jaar, maand, dag);
              const gekozen = d === iso;
              return (
                <button key={d} type="button"
                  className={"dk-dag" + (gekozen ? " dk-gekozen" : "") + (d === vandaag ? " dk-nu" : "")}
                  title={langDatum(d)}
                  onClick={() => kies(dag)}>
                  {gekozen ? <span className="dk-vink" aria-hidden="true">✓</span> : dag}
                </button>
              );
            })}
          </div>
          <div className="dk-voet">
            <button type="button" className="dk-actie" onClick={() => { onKies(vandaag); setOpen(false); }}>Vandaag</button>
            <span className="dk-spacer" />
            {iso && <button type="button" className="dk-actie dk-wis" onClick={() => { onKies(""); setOpen(false); }}>Wissen</button>}
          </div>
        </div>
      )}
    </div>
  );
}

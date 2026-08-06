"use client";

// ═══════════════════════════════════════════════════════════
// HET BELLETJE IN DE KOPBALK
// ═══════════════════════════════════════════════════════════
// Vinkt de sitebouwer een taak af, dan gebeurde er tot nu toe niets zichtbaars:
// de status ging stil de database in en zij moest er een mail bij sturen. Dat
// mailtje is nu overbodig; het verschijnt hier, op elk beheerscherm.
//
// Zelfde patroon als het menu Intern: client component, haalt zijn eigen data op,
// tekent niets als de route geen toegang geeft. De route zit achter de
// eigenaar-poort, dus de sitebouwer ziet haar eigen meldingen niet.
//
// Bewust geen vinkje per melding: één "gezien tot"-tijdstip. Meldingen zijn geen
// takenlijst, ze zijn een belletje; een tweede lijst om af te werken is precies
// wat we niet willen.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";

type Melding = {
  id: number;
  soort: string;
  titel: string;
  regel: string;
  link: string | null;
  wie: string;
  gemaaktOp: string;
  nieuw: boolean;
};

const VERVERS_MS = 120_000;

function watGeleden(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return uur === 1 ? "een uur geleden" : `${uur} uur geleden`;
  const dag = Math.round(uur / 24);
  return dag === 1 ? "gisteren" : `${dag} dagen geleden`;
}

export default function MeldingenMenu() {
  const [meldingen, setMeldingen] = useState<Melding[] | null>(null);
  const [nieuw, setNieuw] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const haal = useCallback(() => {
    fetch("/api/admin/meldingen")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setMeldingen(j.meldingen as Melding[]);
        setNieuw(Number(j.nieuw) || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    haal();
    // Af en toe opnieuw kijken: de sitebouwer vinkt af terwijl dit scherm openstaat.
    // Twee minuten is vaak genoeg om het dezelfde werkdag te zien, en zeldzaam
    // genoeg om geen verkeer te zijn dat niemand merkt.
    const t = setInterval(haal, VERVERS_MS);
    return () => clearInterval(t);
  }, [haal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Openklappen is het lezen. Geen aparte knop "markeer als gelezen": dat is een
  // handeling erbij die niets oplevert.
  function klap() {
    const naar = !open;
    setOpen(naar);
    if (naar && nieuw > 0) {
      setNieuw(0);
      void fetch("/api/admin/meldingen", { method: "POST" }).catch(() => {});
    }
  }

  if (meldingen === null) return null;

  return (
    <div className="hm-wrap md-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"logout-btn md-knop" + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        title={nieuw > 0 ? `${nieuw} nieuwe melding${nieuw === 1 ? "" : "en"}` : "Meldingen"}
        onClick={klap}
      >
        <svg className="md-bel" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5c0 3-1.5 3.8-1.5 4.5h10c0-.7-1.5-1.5-1.5-4.5A3.5 3.5 0 0 0 8 1.5ZM6.5 12a1.5 1.5 0 0 0 3 0"
            stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span className="md-label">Meldingen</span>
        {nieuw > 0 && <span className="om-teller">{nieuw}</span>}
      </button>

      {open && (
        <div className="hm-paneel md-paneel" role="menu" aria-label="Meldingen">
          {meldingen.length === 0 ? (
            <div className="md-leeg">
              Nog niets te melden. Vinkt de sitebouwer een taak af, dan verschijnt het hier en hoeft
              zij er geen mail bij te sturen.
            </div>
          ) : (
            meldingen.map((m) => {
              const inhoud = (
                <>
                  <span className="hm-item-label">
                    {m.nieuw && <span className="md-stip" aria-label="nieuw" />}
                    {m.titel}
                  </span>
                  <span className="hm-item-hint">{m.regel}</span>
                  <span className="md-tijd">{watGeleden(m.gemaaktOp)}</span>
                </>
              );
              return m.link ? (
                <a key={m.id} role="menuitem" className="hm-item md-item" href={m.link}>{inhoud}</a>
              ) : (
                <div key={m.id} className="hm-item md-item">{inhoud}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

"use client";

// ═══════════════════════════════════════════════════════════
// HET MENU "INTERN" IN DE KOPBALK
// ═══════════════════════════════════════════════════════════
// Alles wat over het dashboard zelf gaat in plaats van over een klant: de
// ontwikkeling en de uitleg. Eén ingang op élk beheerscherm, zodat die links niet
// per scherm los in de balk hoeven te hangen.
//
// De routekaart was alleen bereikbaar vanaf het klantenoverzicht. Zat je in een
// klantcockpit, dan moest je eerst terug om de volgende ontwikkeltaak te pakken.
// Dit menu heeft de eerstvolgende taak meteen bij de hand: één klik en de
// startregel staat op je klembord, klaar voor een verse chat.
//
// Het haalt zijn gegevens zelf op bij /api/admin/ontwikkel-advies. Reden: er is
// geen gedeelde kopbalk in dit dashboard, elk scherm schrijft zijn eigen. Zou het
// menu zijn gegevens als prop willen, dan moest elke pagina eromheen aangepast
// worden. Nu is het overal één regel.
//
// Geen recht op de ontwikkelstraat (of geen adminsessie) = de route geeft een
// foutcode en dit component tekent niets. Er lekt dus niets naar een gast.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import Kopieer from "./Kopieer";

type Advies = { code: string; titel: string; prompt: string };
type Data = {
  advies: Advies | null;
  lopend: { code: string; titel: string }[];
  voortgang: { af: number; loopt: number; open: number; totaal: number };
};

export default function OntwikkelMenu() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let levend = true;
    fetch("/api/admin/ontwikkel-advies")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (levend && j?.ok) setData(j as Data); })
      .catch(() => {});
    return () => { levend = false; };
  }, []);

  // Zelfde sluitgedrag als het bestaande kopbalkmenu: Escape of een klik buiten.
  // Nooit dichtklappen bij het slepen van de muis erlangs (vaste huisregel).
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

  if (!data) return null;

  return (
    <div className="hm-wrap om-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"logout-btn om-knop" + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        title="Over het dashboard zelf: de ontwikkeling en de uitleg"
        onClick={() => setOpen((v) => !v)}
      >
        Intern
        {data.voortgang.loopt > 0 && <span className="om-teller">{data.voortgang.loopt}</span>}
        <svg className="hm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="hm-paneel om-paneel" role="menu" aria-label="Ontwikkeling">
          {data.advies ? (
            <div className="om-volgende">
              <div className="om-label">Volgende taak</div>
              <div className="om-titel">
                <span className="om-code">{data.advies.code}</span> {data.advies.titel}
              </div>
              <Kopieer tekst={data.advies.prompt} label="Kopieer de startregel" primair klein />
              <div className="om-hint">Plak dit in een verse chat, meer hoef je niet te doen.</div>
            </div>
          ) : (
            <div className="om-volgende">
              <div className="om-label">Volgende taak</div>
              <div className="om-hint">Geen punt dat nu kan beginnen. Kijk op de routekaart wat er wacht.</div>
            </div>
          )}

          {data.lopend.length > 0 && (
            <div className="om-lopend">
              <strong>Loopt al:</strong> {data.lopend.map((p) => p.code).join(", ")}. Begin daar geen tweede chat voor.
            </div>
          )}

          <div className="om-kop">Ontwikkeling</div>
          <a role="menuitem" className="hm-item" href="/admin/routekaart">
            <span className="hm-item-label">De hele routekaart</span>
            <span className="hm-item-hint">
              Alle {data.voortgang.totaal} punten, met per punt de beschrijving en de startregel.
            </span>
          </a>

          <div className="om-kop">Uitleg en verkoop</div>
          <a role="menuitem" className="hm-item" href="/uitleg">
            <span className="hm-item-label">Zo werkt het dashboard</span>
            <span className="hm-item-hint">
              Het hele verhaal in gewone taal. Openbaar leesbaar, dus deelbaar met een klant of een lead.
            </span>
          </a>
          <a role="menuitem" className="hm-item" href="/uitleg#onderscheid">
            <span className="hm-item-label">Wat dit onderscheidt</span>
            <span className="hm-item-hint">
              Het korte stuk voor een lead of investeerder: waarom dit moeilijk na te maken is.
            </span>
          </a>
          <a role="menuitem" className="hm-item" href="/uitleg#agenda">
            <span className="hm-item-label">Eerlijke agenda</span>
            <span className="hm-item-hint">
              De gaten en de risico&rsquo;s. Alleen zichtbaar met jouw sessie, niet voor een buitenstaander.
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

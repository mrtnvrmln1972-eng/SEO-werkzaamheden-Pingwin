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
  /** Waarom er niets wordt aangeraden: alles wacht, of alles botst met wat er loopt. */
  reden: "leeg" | "botst" | null;
  lopend: { code: string; titel: string }[];
  voortgang: { af: number; loopt: number; open: number; totaal: number };
};

/**
 * De vaste schermen van dit dashboard, met per stuk waar je het voor gebruikt.
 * Klantschermen staan er niet in: die bereik je via het klantenoverzicht, en ze
 * hebben allemaal een slug.
 *
 * Dit is de enige lijst; `proeven/opmaak.proef.ts` legt hem naast de mappen onder
 * `app/admin` en wordt rood zodra er een scherm bijkomt dat hier niet in staat.
 */
export const SCHERMEN: { pad: string; naam: string; waarvoor: string }[] = [
  { pad: "/admin", naam: "Klanten", waarvoor: "Het overzicht: alle klanten en leads, en hier maak je er een aan." },
  { pad: "/admin/schrijfstijl", naam: "Hoe jij schrijft", waarvoor: "Het schrijfprofiel dat in elke klantmail meegaat, afgeleid uit je eigen mails." },
  { pad: "/admin/beheer", naam: "Beheer", waarvoor: "Instellingen van het dashboard zelf: koppelingen, team en toegang." },
  { pad: "/admin/financien", naam: "Financiën", waarvoor: "Facturen en budgetten over alle klanten heen." },
  { pad: "/admin/developer", naam: "Developer", waarvoor: "Alles wat naar een sitebouwer moet, over alle klanten heen." },
  { pad: "/admin/usage", naam: "Verbruik", waarvoor: "Wat het dashboard aan denkwerk verbruikt, per soort taak." },
  { pad: "/admin/fundament", naam: "Fundament", waarvoor: "Per klant in één oogopslag: tone of voice, structured data, concurrenten, bedrijfsprofiel en positionering." },
  { pad: "/admin/routekaart", naam: "Routekaart", waarvoor: "De ontwikkeling van dit dashboard, punt voor punt." },
  { pad: "/admin/bronnen-gezondheid", naam: "Bronnen-gezondheid", waarvoor: "Per koppeling (Ahrefs, Google, Microsoft, Moneybird, WordPress): werkt hij, en sinds wanneer niet meer." },
  { pad: "/admin/agenda", naam: "Agenda", waarvoor: "Maartens eigen weekagenda: tijdblokken en taken, los van klantwerk." },
  { pad: "/admin/schermafbeeldingen", naam: "Schermafbeeldingen", waarvoor: "De beelden die /uitleg gebruikt: het dashboard fotografeert zichzelf, anoniem." },
  { pad: "/admin/veld-herstel", naam: "Veld terugzetten", waarvoor: "Eerdere versies van 'Zoekwoorden & links' en 'Top Prio's', met één klik terug te zetten." },
];

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
              <div className="om-label">Even niets beginnen</div>
              <div className="om-hint">
                {data.reden === "botst"
                  ? "Alles wat nu zou kunnen, raakt een scherm waar al aan gewerkt wordt. Laat die chat eerst afmaken."
                  : "Er staat niets open dat nu kan beginnen. Kijk op de routekaart wat er nog wacht."}
              </div>
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

          {/*
            Alle vaste schermen op één plek. Er komen er steeds meer bij en ze waren
            alleen te vinden als je het adres uit je hoofd wist; een scherm dat je
            niet terugvindt bestaat in de praktijk niet. Nieuw scherm erbij betekent
            één regel hier, en `proeven/opmaak.proef.ts` wordt rood als een scherm
            wel bestaat maar hier niet in staat.
          */}
          <div className="om-kop">Schermen</div>
          {SCHERMEN.map((s) => (
            <a role="menuitem" className="hm-item" key={s.pad} href={s.pad}>
              <span className="hm-item-label">{s.naam}</span>
              <span className="hm-item-hint">{s.waarvoor}</span>
            </a>
          ))}

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

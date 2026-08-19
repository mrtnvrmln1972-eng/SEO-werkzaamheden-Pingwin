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

import { Fragment, useEffect, useRef, useState } from "react";
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
/**
 * De groepen waarin het menu de schermen zet.
 *
 * Waarom dit er kwam (15-08-2026): dit was één lijst van vijftien, met daarboven
 * en daaronder nog losse blokken, waarvan er drie hetzelfde deden. Vijftien
 * gelijke regels lees je niet, die scan je en dan geef je het op. Drie kopjes
 * die zeggen wanneer je er moet zijn, doen wat een lijst niet kan.
 */
export const GROEPEN = ["Dagelijks werk", "Ontwikkeling van het dashboard", "Beheer en controle"] as const;
export type Groep = (typeof GROEPEN)[number];

export const SCHERMEN: { pad: string; naam: string; waarvoor: string; groep: Groep }[] = [
  { pad: "/admin", naam: "Klanten", waarvoor: "Het overzicht: alle klanten en leads, en hier maak je er een aan.", groep: "Dagelijks werk" },
  { pad: "/admin/schrijfstijl", naam: "Hoe jij schrijft", waarvoor: "Het schrijfprofiel dat in elke klantmail meegaat, afgeleid uit je eigen mails.", groep: "Dagelijks werk" },
  { pad: "/admin/beheer", naam: "Beheer", waarvoor: "Instellingen van het dashboard zelf: koppelingen, team en toegang.", groep: "Beheer en controle" },
  { pad: "/admin/financien", naam: "Financiën", waarvoor: "Facturen en budgetten over alle klanten heen.", groep: "Dagelijks werk" },
  { pad: "/admin/developer", naam: "Developer", waarvoor: "Alles wat naar een sitebouwer moet, over alle klanten heen.", groep: "Dagelijks werk" },
  { pad: "/admin/usage", naam: "Verbruik", waarvoor: "Wat het dashboard aan denkwerk verbruikt, per soort taak.", groep: "Beheer en controle" },
  { pad: "/admin/fundament", naam: "Fundament", waarvoor: "Per klant in één oogopslag: tone of voice, structured data, concurrenten, bedrijfsprofiel en positionering.", groep: "Dagelijks werk" },
  { pad: "/admin/routekaart", naam: "Routekaart", waarvoor: "De ontwikkeling van dit dashboard, punt voor punt.", groep: "Ontwikkeling van het dashboard" },
  { pad: "/admin/stijl", naam: "Stijl", waarvoor: "Wat de bedoeling is naast wat er werkelijk staat: hoeveel kleuren, maten en soorten knop het dashboard heeft, en hoeveel er zouden moeten zijn.", groep: "Ontwikkeling van het dashboard" },
  { pad: "/admin/tweaks", naam: "Tweaks", waarvoor: "De stapel kleine aanpassingen die je onderweg meldt, klaar om in één ronde door te voeren.", groep: "Ontwikkeling van het dashboard" },
  { pad: "/admin/grote-punten", naam: "Grote punten", waarvoor: "Wat te groot is voor een tweak: eerst samen een plan, jij keurt goed, en 's nachts wordt het één voor één gebouwd.", groep: "Ontwikkeling van het dashboard" },
  { pad: "/admin/bronnen-gezondheid", naam: "Bronnen-gezondheid", waarvoor: "Per koppeling (Ahrefs, Google, Microsoft, Moneybird, WordPress): werkt hij, en sinds wanneer niet meer.", groep: "Beheer en controle" },
  { pad: "/admin/agenda", naam: "Agenda", waarvoor: "Maartens eigen weekagenda: tijdblokken en taken, los van klantwerk.", groep: "Dagelijks werk" },
  { pad: "/admin/schermafbeeldingen", naam: "Schermafbeeldingen", waarvoor: "De beelden die /uitleg gebruikt: het dashboard fotografeert zichzelf, anoniem.", groep: "Beheer en controle" },
  { pad: "/admin/veld-herstel", naam: "Veld terugzetten", waarvoor: "Eerdere versies van 'Overzicht' en 'Top Prio's', met één klik terug te zetten.", groep: "Beheer en controle" },
  { pad: "/admin/verhuizen", naam: "Verhuizen", waarvoor: "Een klant met alles erin uit een losse omgeving hierheen halen, of andersom.", groep: "Beheer en controle" },
  { pad: "/admin/pagina-lab", naam: "Pagina-lab", waarvoor: "De kennisbank waartegen een pagina straks beoordeeld wordt op conversie, bruikbaarheid, vormgeving en interactie, met de bron erbij.", groep: "Ontwikkeling van het dashboard" },
  { pad: "/admin/claude-werkwijze", naam: "Claude-werkwijze", waarvoor: "Geheugensteun voor het werken met Claude zelf: repo's aanhaken, model en denkstand, traagheid herkennen, kosten laag houden.", groep: "Ontwikkeling van het dashboard" },
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
        className={"btn btn-klein om-knop" + (open ? " hm-open" : "")}
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

          {/*
            Drie groepen in plaats van één lijst van vijftien, en de dubbele
            ingangen zijn eruit. Hier stond bovenaan nog een los blok
            "Ontwikkeling" met een tweede link naar de routekaart (die ook in de
            lijst staat), en onderaan drie losse links naar dezelfde uitlegpagina.
            Negentien regels waarvan er drie hetzelfde deden. Nieuw scherm erbij
            betekent nog steeds één regel in SCHERMEN, nu met zijn groep erbij;
            `proeven/opmaak.proef.ts` wordt rood als een scherm hier ontbreekt.
          */}
          {GROEPEN.map((groep) => (
            <Fragment key={groep}>
              <div className="om-kop">{groep}</div>
              {SCHERMEN.filter((x) => x.groep === groep).map((s) => (
                <a role="menuitem" className="hm-item" key={s.pad} href={s.pad}>
                  <span className="hm-item-label">{s.naam}</span>
                  <span className="hm-item-hint">{s.waarvoor}</span>
                </a>
              ))}
            </Fragment>
          ))}

          <div className="om-kop">Uitleg</div>
          <a role="menuitem" className="hm-item" href="/uitleg">
            <span className="hm-item-label">Zo werkt het dashboard</span>
            <span className="hm-item-hint">
              Het hele verhaal in gewone taal, deelbaar met een klant of een lead. Wat dit
              onderscheidt en de eerlijke agenda met de gaten en risico&rsquo;s staan erin; die
              laatste alleen met jouw sessie.
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

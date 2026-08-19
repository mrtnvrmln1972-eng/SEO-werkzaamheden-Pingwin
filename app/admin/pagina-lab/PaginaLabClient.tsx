"use client";

// Het scherm van de kennisbank. Alleen tonen: er valt hier niets te bewerken,
// want de kennis leeft in `lib/pagina-lab/kennisbank/` en verandert via een
// wijziging in de code, met een commit eronder die zegt waarom. Dat is met opzet
// zo: een kennisbank die je in een veldje kunt overtypen, heeft binnen een maand
// twee versies.

import { useState } from "react";
import type { ReactNode } from "react";
import AdminKop from "../AdminKop";
import { PijlRechts } from "../../_ui/Pijl";
import { Chip, Chips, Paneel, Signaal, Tekst, Veldrij } from "../../_ui/Uitkomst";
import GedragPaneel from "./GedragPaneel";
import type { KlantStand } from "./GedragPaneel";
import {
  CRITERIA,
  DISCIPLINES,
  DISCIPLINE_UITLEG,
  VAKOORDEEL_WAARSCHUWING,
  VAKOORDELEN,
  oudsteControle,
} from "../../../lib/pagina-lab/kennisbank";
import type { Bewijs, Criterium, Discipline, Vakoordeel, Vaststellen, Weegt } from "../../../lib/pagina-lab/kennisbank";

const WEEGT_TOON: Record<Weegt, "accent" | "neutraal" | "uit"> = { hoog: "accent", midden: "neutraal", laag: "uit" };
const BEWIJS_TOON: Record<Bewijs, "goed" | "neutraal" | "let-op"> = { sterk: "goed", gemiddeld: "neutraal", zwak: "let-op" };

const VASTSTELLEN_UITLEG: Record<Vaststellen, string> = {
  meting: "Vast te stellen uit de pagina zelf of uit een cijfer.",
  beeld: "Alleen te zien op de schermfoto, niet uit de code.",
  oordeel: "Vraagt een oordeel van een mens of van de assistent.",
};

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function KopChips({ weegt, vaststellen, bewijs }: { weegt: Weegt; vaststellen: Vaststellen; bewijs?: Bewijs }) {
  return (
    <Chips>
      <Chip toon={WEEGT_TOON[weegt]} titel="Hoeveel dit meeweegt in een oordeel over een pagina">{`weegt ${weegt}`}</Chip>
      {bewijs ? <Chip toon={BEWIJS_TOON[bewijs]} titel="Hoe hard het bewijs onder dit criterium is">{`bewijs ${bewijs}`}</Chip> : null}
      <Chip toon="neutraal" titel={VASTSTELLEN_UITLEG[vaststellen]}>{vaststellen}</Chip>
    </Chips>
  );
}

/**
 * Eén punt als uitklapper, met dezelfde bouwsteen als de uitleg-pagina
 * (`.ut-blok`). Bewust geen eigen opmaak: dat zou een tweede uiterlijk voor
 * hetzelfde ding zijn. En bewust dicht bij het openen, want tweeëndertig
 * criteria onder elkaar is een muur, en dan lees je er nul.
 */
function Uitklapper({ kop, chips, children }: { kop: string; chips: ReactNode; children: ReactNode }) {
  return (
    <details className="ut-blok">
      <summary>
        <span className="ut-pijl"><PijlRechts /></span>
        <span className="ut-blok-kop">
          <span className="ut-blok-titel">{kop}</span>
          {chips}
        </span>
      </summary>
      <div className="ut-blok-body">{children}</div>
    </details>
  );
}

function CriteriumBlok({ c }: { c: Criterium }) {
  return (
    <Uitklapper kop={`${c.id} · ${c.titel}`} chips={<KopChips weegt={c.weegt} vaststellen={c.vaststellen} bewijs={c.bewijs} />}>
      <Tekst>
        {`**Waar we naar kijken.** ${c.waarNaarKijken}\n\n**Waarom.** ${c.waarom}${c.nuance ? `\n\n**Nuance.** ${c.nuance}` : ""}`}
      </Tekst>
      <Tekst klein>
        {`**Bron, nagekeken op ${datum(c.gecheckt)}:** ${c.bronnen.map((b) => `[${b.naam}](${b.url})`).join(" · ")}`}
      </Tekst>
    </Uitklapper>
  );
}

function VakoordeelBlok({ v }: { v: Vakoordeel }) {
  return (
    <Uitklapper kop={`${v.id} · ${v.titel}`} chips={<KopChips weegt={v.weegt} vaststellen={v.vaststellen} />}>
      <Tekst>
        {`**Waar we naar kijken.** ${v.waarNaarKijken}\n\n**Waarom wij dit vinden.** ${v.waarom}\n\n**Waar het vandaan komt.** ${v.grond}`}
      </Tekst>
      <Tekst klein>{`**Geen bron.** Opgeschreven op ${datum(v.sinds)}.`}</Tekst>
    </Uitklapper>
  );
}

export default function PaginaLabClient({ klanten, magSchrijven }: { klanten: KlantStand[]; magSchrijven: boolean }) {
  const [deel, setDeel] = useState<"kennisbank" | "gedrag">("kennisbank");
  const [filter, setFilter] = useState<Discipline | "alles">("alles");

  const criteria = filter === "alles" ? CRITERIA : CRITERIA.filter((c) => c.discipline === filter);
  const eigen = filter === "alles" ? VAKOORDELEN : VAKOORDELEN.filter((v) => v.discipline === filter);

  const knoppen = (
    <>
      <button
        className={"btn btn-klein " + (filter === "alles" ? "btn-primary" : "btn-ghost")}
        onClick={() => setFilter("alles")}
      >
        Alles
      </button>
      {DISCIPLINES.map((d) => (
        <button
          key={d}
          className={"btn btn-klein " + (filter === d ? "btn-primary" : "btn-ghost")}
          onClick={() => setFilter(d)}
          title={DISCIPLINE_UITLEG[d]}
        >
          {d.charAt(0).toUpperCase() + d.slice(1)}
        </button>
      ))}
    </>
  );

  return (
    <>
      <AdminKop titel="Pagina-lab" />
      <div className="beheer-container">
        {/* De twee helften van het lab: waartegen we een pagina houden, en wat
            bezoekers er werkelijk deden. */}
        <Veldrij>
          <button
            className={"btn btn-klein " + (deel === "kennisbank" ? "btn-primary" : "btn-ghost")}
            onClick={() => setDeel("kennisbank")}
          >
            Kennisbank
          </button>
          <button
            className={"btn btn-klein " + (deel === "gedrag" ? "btn-primary" : "btn-ghost")}
            onClick={() => setDeel("gedrag")}
          >
            Gedrag: Analytics en Clarity
          </button>
        </Veldrij>

        {deel === "gedrag" && <GedragPaneel klanten={klanten} magSchrijven={magSchrijven} />}
        {deel === "kennisbank" && (
        <>
        <Paneel
          titel="Kennisbank: waartegen het Pagina-lab een pagina houdt"
          uitleg={
            "Naast de SEO-criteria die er al zijn, staan hier de criteria voor conversie, bruikbaarheid, " +
            "vormgeving en interactie. Elk criterium heeft een bron en de datum waarop die bron is " +
            "nagekeken, zodat een advies aan een klant altijd terug te leiden is. Wat wij vinden zonder " +
            "dat er onderzoek onder ligt, staat apart, onderaan deze pagina."
          }
          knoppen={knoppen}
        >
          <Tekst klein>
            {`${CRITERIA.length} onderbouwde criteria en ${VAKOORDELEN.length} vakoordelen. Oudste broncontrole: ${datum(oudsteControle())}.`}
          </Tekst>
          {filter !== "alles" && <Tekst klein>{DISCIPLINE_UITLEG[filter]}</Tekst>}
          <div className="ut-blokken">
            {criteria.map((c) => <CriteriumBlok key={c.id} c={c} />)}
          </div>
        </Paneel>

        <Paneel
          titel="Vakoordeel van Pingwin"
          uitleg={
            "Wat wij uit ervaring vinden, zonder onderzoek eronder. Dit staat hier bewust apart: als " +
            "een mening tussen de onderbouwde criteria staat, komt hij vroeg of laat als bewijs in een " +
            "klantrapport terecht. Vinden we later een bron, dan verhuist het punt naar zijn discipline " +
            "hierboven; klopt het niet, dan gaat het weg."
          }
        >
          <Signaal soort="let-op">{VAKOORDEEL_WAARSCHUWING}</Signaal>
          <div className="ut-blokken">
            {eigen.map((v) => <VakoordeelBlok key={v.id} v={v} />)}
          </div>
        </Paneel>
        </>
        )}
      </div>
    </>
  );
}

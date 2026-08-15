"use client";

// ═══════════════════════════════════════════════════════════
// DE NULMETING: ÉÉN KEER LANGS ELK SCHERM
// ═══════════════════════════════════════════════════════════
// De stapel vult zich met wat Maarten toevallig tegenkomt. Een scherm waar hij
// zelden komt levert dus nooit een melding op, ook niet als er van alles aan
// mankeert; de stapel meet waar hij die week gewerkt heeft, niet hoe het
// dashboard ervoor staat.
//
// Dit blok sluit dat gat. Je loopt één keer elk scherm langs, meldt wat je ziet
// met het gewone Tweak-knopje, en vinkt het scherm hier af. Daarna weet je van
// élk scherm of het goed is of alleen ongezien, met een datum eronder.
//
// De lijst schermen komt uit twee lijsten die al bestaan: het Intern-menu en de
// tabbalk van een klant. Bewust geen eigen kopie, want een derde lijst zegt na
// een maand iets anders dan de twee die er al zijn, en dan mis je precies de
// schermen die er later bij zijn gekomen.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import { SCHERMEN } from "../OntwikkelMenu";
import { TAB_LEAD, TABS_VOOR, TABS_SITEBREED, TABS_KLANT, TABS_NA } from "../client/[slug]/KlantTabs";
import type { Nulmeting as NulmetingRij } from "../../../lib/nulmeting";
import type { Tweak } from "../../../lib/tweaks";

type Regel = {
  /** Waaronder dit scherm in de nulmeting staat. */
  sleutel: string;
  naam: string;
  waarvoor: string;
  /** Waar je heen gaat om te kijken. Leeg als er geen klant is om het op te tonen. */
  href: string | null;
  groep: "Beheerschermen" | "In de cockpit van een klant";
};

const COCKPIT_TABS = [TAB_LEAD, ...TABS_VOOR, ...TABS_SITEBREED, ...TABS_KLANT, ...TABS_NA];

function schermen(voorbeeldSlug: string | null): Regel[] {
  return [
    ...SCHERMEN.map((s): Regel => ({
      sleutel: s.pad, naam: s.naam, waarvoor: s.waarvoor, href: s.pad, groep: "Beheerschermen",
    })),
    ...COCKPIT_TABS.map((t): Regel => ({
      sleutel: `cockpit:${t.id}`,
      naam: t.label,
      waarvoor: t.hint,
      href: voorbeeldSlug ? `/admin/client/${voorbeeldSlug}?tab=${t.id}` : null,
      groep: "In de cockpit van een klant",
    })),
  ];
}

/** Hoeveel meldingen kwamen er ooit van dit scherm? Nul is geen bewijs, maar wel een aanwijzing. */
function tel(regel: Regel, tweaks: Tweak[]): number {
  if (regel.sleutel.startsWith("cockpit:")) {
    const tab = regel.sleutel.slice("cockpit:".length);
    return tweaks.filter((t) => t.scherm.endsWith(`(${tab})`)).length;
  }
  return tweaks.filter((t) => t.pad === regel.sleutel || t.pad.startsWith(regel.sleutel + "/")).length;
}

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

export default function Nulmeting({ begin, voorbeeldSlug, tweaks }: {
  begin: NulmetingRij[];
  voorbeeldSlug: string | null;
  tweaks: Tweak[];
}) {
  const [gedaan, setGedaan] = useState<NulmetingRij[]>(begin);
  // Zolang er nog niets is nagelopen staat de lijst open. Een dichtgeklapte
  // lijst van nul afgevinkte schermen is onzichtbaar werk: je moet weten dat
  // hij bestaat om hem te vinden, en dan bestaat hij dus niet. Zodra er iets is
  // afgevinkt klapt hij vanzelf dicht, want dan is de meter genoeg.
  const [open, setOpen] = useState(begin.length === 0);

  const lijst = schermen(voorbeeldSlug);
  const vinkje = (sleutel: string) => gedaan.find((n) => n.sleutel === sleutel) || null;
  const klaar = lijst.filter((r) => vinkje(r.sleutel)).length;

  async function wissel(sleutel: string) {
    const aan = !vinkje(sleutel);
    const r = await fetch("/api/admin/tweaks/nulmeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleutel, aan }),
    });
    const j = await r.json().catch(() => null);
    if (j?.ok) setGedaan(j.nulmeting);
  }

  const groepen: Regel["groep"][] = ["Beheerschermen", "In de cockpit van een klant"];

  return (
    <div className="beheer-blok">
      <h2 className="beheer-h2">Nulmeting van alle schermen ({klaar} van {lijst.length})</h2>
      <p className="beheer-uitleg">
        Eén keer langs elk scherm, zodat je van alles weet of het goed is en niet alleen of je er
        toevallig geweest bent. Open een scherm, meld wat je ziet met het Tweak-knopje, en vink het
        hier af. Het getal erachter is hoeveel meldingen er ooit van dat scherm kwamen.
      </p>

      <div className="tw-nul-balk">
        <div className="tw-nul-meter" role="img" aria-label={`${klaar} van ${lijst.length} schermen nagelopen`}>
          <span className="tw-nul-vulling" style={{ width: `${Math.round((klaar / lijst.length) * 100)}%` }} />
        </div>
        <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpen(!open)}>
          {open ? "Lijst dichtklappen" : "Lijst openklappen"}
        </button>
      </div>

      {open && groepen.map((groep) => (
        <div key={groep} className="tw-nul-groep">
          <h3 className="tw-nul-kop">{groep}</h3>
          <ul className="tw-nul-lijst">
            {lijst.filter((r) => r.groep === groep).map((r) => {
              const gezien = vinkje(r.sleutel);
              const meldingen = tel(r, tweaks);
              return (
                <li key={r.sleutel} className={"tw-nul-rij" + (gezien ? " tw-nul-af" : "")}>
                  <div className="tw-nul-tekst">
                    {r.href
                      ? <a className="tw-nul-naam" href={r.href}>{r.naam}</a>
                      : <span className="tw-nul-naam">{r.naam}</span>}
                    <span className="tw-nul-waarvoor">{r.waarvoor}</span>
                  </div>
                  <div className="tw-nul-acties">
                    {meldingen > 0 && (
                      <span className="tw-stand-chip" title="Zoveel meldingen kwamen er van dit scherm">
                        {meldingen}
                      </span>
                    )}
                    {gezien && <span className="tw-nul-datum">{datum(gezien.nagelopen)}</span>}
                    <button
                      type="button"
                      className={"btn btn-klein" + (gezien ? " btn-quiet" : " btn-ghost")}
                      onClick={() => void wissel(r.sleutel)}
                    >
                      {gezien ? "Toch niet" : "Nagelopen"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {!voorbeeldSlug && open && (
        <p className="beheer-klein">
          De cockpit-schermen zijn nog niet aan te klikken omdat er nog geen klant in het dashboard
          staat. Zodra die er is wijzen ze vanzelf naar de eerste klant.
        </p>
      )}
    </div>
  );
}

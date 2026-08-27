"use client";

// ═══════════════════════════════════════════════════════════
// WAT ER BUITEN DIT PLAN VALT
// ═══════════════════════════════════════════════════════════
// Een eigen bestand, om twee redenen. De maat-poort houdt WerkplanningProef.tsx
// onder de duizend regels, en belangrijker: dit blok is een eigen onderwerp. Het
// beantwoordt precies één vraag, namelijk welke pagina's níet in het plan staan
// en waarom.
//
// De vorm komt uit wat er misging. Eerst stond hier per reden een muur van
// driehonderd URL's onder elkaar. Maartens woorden: "hele lijsten met URL's graag
// onder een default dichte toggle" en "ik heb geen idee wat er bij al afgerond al
// is gedaan". Dus:
//
//   1. Elke reden is een eigen inklapper, standaard dicht.
//   2. Binnen een reden staan de pagina's op SOORT, grootste groep eerst. Zes
//      afspraak-maken-pagina's onder elkaar is een bevinding; zes losse URL's
//      tussen driehonderd andere is ruis.
//   3. Bij "al afgerond" staat per blok in één zin wat er gebeurd is en waarheen.

import type { ReactNode } from "react";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";
import { padVan } from "../../../../../lib/werk-clusters";
import { WEGLAAT_LABEL, WEGLAAT_UITLEG, type WeggelatenPagina, type WeglaatReden } from "../../../../../lib/opruim-weggelaten";
import { HANDELING_LABEL, type Werkcluster, type Handeling } from "../../../../../lib/werkplan";
import { REST_LABEL, REST_WAT_NU, type RestOordeel, type RestRegel } from "../../../../../lib/rest-duiding";

function Slug({ url, domein }: { url: string; domein?: string | null }) {
  if (!url) return null;
  const href = /^https?:\/\//i.test(url)
    ? url
    : domein ? `https://${domein.replace(/^www\./i, "")}${url}` : url;
  return <a className="uk-pad" href={href} target="_blank" rel="noreferrer">{padVan(url)}</a>;
}

/** Een inklapper bínnen een blok: zelfde vorm als de kaarten eromheen, een niveau lager. */
function Vouw({ titel, telling, uitleg, open, onToggle, children }: {
  titel: string; telling?: string; uitleg?: string;
  open: boolean | undefined; onToggle: (v: boolean) => void; children: ReactNode;
}) {
  const uit = !!open;
  return (
    <div className="wp-vouw">
      <button type="button" className="deelkop" aria-expanded={uit} onClick={() => onToggle(!uit)}>
        <span className="strategy-caret">{uit ? <Omlaag /> : <Uitklap />}</span>
        <span className="wp-clus-tekst">
          <span className="wp-kaart-titel">{titel}</span>
          {uitleg && <span className="wp-clus-sub">{uitleg}</span>}
        </span>
        {telling && <span className="deelkop-meta">{telling}</span>}
      </button>
      {uit && <div className="wp-vouw-body">{children}</div>}
    </div>
  );
}

/**
 * Weggelaten pagina's op soort, grootste groep eerst. Driehonderd losse URL's
 * zeggen niets; "zes keer een afspraak-maken-pagina" is meteen een bevinding.
 */
function groepeerOpSoort(lijst: WeggelatenPagina[]): { soort: string; lijst: WeggelatenPagina[] }[] {
  const per = new Map<string, WeggelatenPagina[]>();
  for (const p of lijst) {
    const k = p.soort || "overig";
    if (!per.has(k)) per.set(k, []);
    per.get(k)!.push(p);
  }
  return [...per.entries()]
    .map(([soort, l]) => ({ soort, lijst: l.sort((a, b) => a.pad.localeCompare(b.pad)) }))
    .sort((a, b) => b.lijst.length - a.lijst.length || a.soort.localeCompare(b.soort));
}

/**
 * Wat er met een afgerond blok gebeurd is, in één zin. Zonder dit is "al afgerond"
 * een lijst URL's waarvan je niet kunt zien wat ermee gedaan is.
 */
function watErGebeurdeIs(c: Werkcluster): string {
  const per = new Map<Handeling, number>();
  for (const p of c.paginas) per.set(p.handeling, (per.get(p.handeling) || 0) + 1);
  const stukken: string[] = [];
  for (const [h, n] of per) {
    if (h === "samenvoegen") stukken.push(`${n} pagina${n === 1 ? "" : "'s"} samengevoegd`);
    else if (h === "opruimen") stukken.push(`${n} pagina${n === 1 ? "" : "'s"} weggehaald en omgeleid`);
    else if (h === "blijft") stukken.push(`${n} blijft staan`);
    else if (h === "uitbouwen") stukken.push(`${n} uitgebouwd`);
    else stukken.push(`${n} keer ${HANDELING_LABEL[h]}`);
  }
  const naar = [...new Set(c.paginas.map((p) => p.naar).filter(Boolean))].map(padVan);
  const waarheen = naar.length === 1
    ? ` Alles wijst nu naar ${naar[0]}.`
    : naar.length > 1 ? ` Ze wijzen nu naar ${naar.slice(0, 2).join(" en ")}.` : "";
  return `${stukken.join(", ") || `${c.paginas.length} pagina's`}.${waarheen} Live nagemeten, dus de omleidingen staan er echt.`;
}

export default function WegBlok({ weggelaten, afgerond, rest, domein, open, onToggle }: {
  weggelaten: WeggelatenPagina[];
  afgerond: Werkcluster[];
  /** De overgebleven pagina's, elk met een oordeel en de cijfers eronder. */
  rest: { oordeel: RestOordeel; regels: RestRegel[] }[];
  domein?: string | null;
  open: Record<string, boolean | undefined>;
  onToggle: (sleutel: string, waarde: boolean) => void;
}) {
  // "Geen aanleiding gevonden" bestaat niet meer als groep: die pagina's krijgen
  // hieronder een echt oordeel. De andere twee redenen blijven, want daar is de
  // reden zelf het antwoord.
  const perReden = (["advertentie", "plaats-verweesd"] as WeglaatReden[])
    .map((reden) => ({ reden, paginas: weggelaten.filter((p) => p.reden === reden) }))
    .filter((x) => x.paginas.length > 0);

  return (
    <>
      {afgerond.length > 0 && (
        <Vouw
          titel="Al afgerond"
          telling={`${afgerond.length} ${afgerond.length === 1 ? "blok" : "blokken"}`}
          uitleg="Hier is niets meer te doen; dit is al doorgevoerd."
          open={open["weg-afgerond"]}
          onToggle={(v) => onToggle("weg-afgerond", v)}
        >
          {afgerond.map((c) => (
            <div key={c.sleutel} className="wp-weg-groep">
              <p className="wp-veldnaam">{c.naam}</p>
              <p className="muted">{watErGebeurdeIs(c)}</p>
              <div className="wp-weg-paden">
                {c.paginas.map((p) => <Slug key={p.pad} url={p.pad} domein={domein} />)}
              </div>
            </div>
          ))}
        </Vouw>
      )}

      {rest.map(({ oordeel, regels }) => (
        <Vouw
          key={oordeel}
          titel={REST_LABEL[oordeel]}
          telling={`${regels.length} pagina's`}
          uitleg={REST_WAT_NU[oordeel]}
          open={open[`rest-${oordeel}`]}
          onToggle={(v) => onToggle(`rest-${oordeel}`, v)}
        >
          <table className="opr-tabel">
            <thead>
              <tr>
                <th>Pagina</th>
                <th>Klikken</th>
                <th>Vertoningen</th>
                <th>Plek</th>
                <th>Waarom dit oordeel</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.pad}>
                  <td><Slug url={r.pad} domein={domein} /></td>
                  <td>{r.klikken || "—"}</td>
                  <td>{r.vertoningen ? r.vertoningen.toLocaleString("nl-NL") : "—"}</td>
                  <td>{r.positie != null ? String(Math.round(r.positie * 10) / 10).replace(".", ",") : "—"}</td>
                  <td className="wp-clus-sub">{r.onderbouwing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Vouw>
      ))}

      {perReden.map(({ reden, paginas }) => (
        <Vouw
          key={reden}
          titel={WEGLAAT_LABEL[reden]}
          telling={`${paginas.length} pagina's`}
          uitleg={WEGLAAT_UITLEG[reden]}
          open={open[`weg-${reden}`]}
          onToggle={(v) => onToggle(`weg-${reden}`, v)}
        >
          {groepeerOpSoort(paginas).map(({ soort, lijst }) => (
            <div key={soort} className="wp-weg-groep">
              <p className="wp-veldnaam">{soort} ({lijst.length})</p>
              <div className="wp-weg-paden">
                {lijst.map((p) => <Slug key={p.pad} url={p.pad} domein={domein} />)}
              </div>
            </div>
          ))}
        </Vouw>
      ))}
    </>
  );
}

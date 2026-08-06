"use client";

// ═══════════════════════════════════════════════════════════
// DE ENE LIJST: ALLE PAGINA'S, ÉÉN UITKOMST PER PAGINA
// ═══════════════════════════════════════════════════════════
// Het scherm had twaalf blokken die allemaal dezelfde vraag beantwoordden: wat
// gebeurt er met deze pagina. Ze verschilden alleen in waarom een pagina erin
// terechtkwam, en dat leverde 22 dubbele regels op van de 184.
//
// Hier staat elke pagina één keer, met één uitkomst. Waarom hij erin staat is
// een label geworden waarop je kunt filteren, en groeperen kan op uitkomst of op
// plaats/onderwerp. De losse blokken blijven eronder bestaan met de volledige
// onderbouwing; die zijn nu de verdieping, niet de hoofdmoot.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";

type Uitkomst = "uitbouwen" | "samenvoegen" | "blijft" | "opruimen" | "nieuw";
type Herkomst = "plaats" | "onderwerp" | "kans" | "gat" | "cannibalisatie";
type Regel = {
  pad: string; uitkomst: Uitkomst; naar: string; herkomst: Herkomst[]; reden: string; onderbouwing: string[];
  term: string; volume: number | null; klikken: number; vertoningen: number; positie: number | null; groep: string;
};
type Data = { regels: Regel[]; tellingen: Record<Uitkomst, number> & { totaal: number }; lijstDatum: string | null };

const CHIP: Record<Uitkomst, string> = {
  uitbouwen: "keep", nieuw: "merge", samenvoegen: "merge", blijft: "", opruimen: "nodig",
};
const LABEL: Record<Uitkomst, string> = {
  uitbouwen: "uitbouwen", nieuw: "nieuw maken", samenvoegen: "samenvoegen", blijft: "laten staan", opruimen: "opruimen",
};
const WAT: Record<Uitkomst, string> = {
  uitbouwen: "Hier valt iets te halen: de pagina blijft en verdient een betere invulling.",
  nieuw: "Hier wordt op gezocht en de site heeft er niets voor.",
  samenvoegen: "Gaat op in een andere pagina, zodat Google niet meer hoeft te kiezen.",
  blijft: "Blijft ongewijzigd staan; geen aanleiding om er nu tijd in te steken.",
  opruimen: "Levert niets op, er is geen vraag, en er valt niets te vertellen.",
};
const HERKOMST_LABEL: Record<Herkomst, string> = {
  plaats: "plaatspagina", onderwerp: "onderwerp", kans: "gemiste kans", gat: "ontbreekt", cannibalisatie: "zit elkaar in de weg",
};

// De onderbouwing komt als losse zinnen binnen, met hooguit **vet** erin. Nooit
// ruwe sterretjes in beeld; dat is een harde regel.
function Zin({ tekst }: { tekst: string }) {
  const delen = tekst.split(/\*\*(.+?)\*\*/g);
  return <p>{delen.map((d, i) => (i % 2 ? <strong key={i}>{d}</strong> : <span key={i}>{d}</span>))}</p>;
}

export default function OpruimEenLijst({ slug, domain }: { slug: string; domain: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [bezig, setBezig] = useState(true);
  const [filter, setFilter] = useState<Uitkomst | "alles">("alles");
  const [groep, setGroep] = useState<"uitkomst" | "groep">("uitkomst");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [uitleg, setUitleg] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!slug) return;
    let leeft = true;
    fetch(`/api/admin/opruim-werklijst?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (leeft && j?.ok) setD(j); })
      .catch(() => { /* stil */ })
      .finally(() => { if (leeft) setBezig(false); });
    return () => { leeft = false; };
  }, [slug]);

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  if (bezig) return <div className="muted opr-str-laden">De werklijst wordt samengesteld…</div>;
  if (!d || !d.regels.length) return null;

  const rijen = filter === "alles" ? d.regels : d.regels.filter((r) => r.uitkomst === filter);

  // Groeperen op plaats of onderwerp: dezelfde regels, andere indeling.
  //
  // Met één correctie die uit het nameten kwam: op besluit groeperen geeft vijf
  // groepen, op plaats of onderwerp gaf er 123. Dat is geen view maar een
  // opsomming van 123 tabelletjes van één regel. Een groep van één is geen groep;
  // die regels gaan samen onderaan, zodat de echte clusters overblijven.
  const ruw = new Map<string, Regel[]>();
  for (const r of rijen) {
    const k = groep === "uitkomst" ? LABEL[r.uitkomst] : (r.groep || "overig");
    if (!ruw.has(k)) ruw.set(k, []);
    ruw.get(k)!.push(r);
  }
  const groepen = new Map<string, Regel[]>();
  const los: Regel[] = [];
  for (const [k, lijst] of ruw) {
    if (groep === "groep" && lijst.length < 2) los.push(...lijst);
    else groepen.set(k, lijst);
  }
  if (los.length) groepen.set(`Losse pagina's (${los.length})`, los.sort((a, b) => (b.volume || 0) - (a.volume || 0)));
  const volgorde = [...groepen.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="opr-kaart">
      <div className="opr-str-kpi">
        <div><b>{d.tellingen.totaal}</b><span>pagina&rsquo;s met een besluit</span></div>
        <div><b>{d.tellingen.uitbouwen}</b><span>uitbouwen</span></div>
        <div><b>{d.tellingen.samenvoegen}</b><span>samenvoegen</span></div>
        <div><b>{d.tellingen.opruimen}</b><span>opruimen</span></div>
        <div><b>{d.tellingen.nieuw}</b><span>nieuw maken</span></div>
      </div>

      <div className="opr-kaart-tekst">
        <p>
          Dit is <strong>alles bij elkaar</strong>: elke pagina staat hier één keer, met één besluit. Waarom een pagina
          in de lijst staat is een label geworden waar je op kunt filteren; de volledige onderbouwing staat in de
          blokken hieronder.
        </p>
      </div>

      <div className="opr-vorm-rij">
        {(["alles", "uitbouwen", "samenvoegen", "nieuw", "opruimen", "blijft"] as const).map((k) => (
          <button key={k} type="button" className={"ghost-btn small" + (filter === k ? " actief" : "")} onClick={() => setFilter(k)}>
            {k === "alles" ? `alles (${d.tellingen.totaal})` : `${LABEL[k]} (${d.tellingen[k]})`}
          </button>
        ))}
        <span style={{ marginLeft: "var(--s-4)" }}>
          <button type="button" className={"ghost-btn small" + (groep === "uitkomst" ? " actief" : "")} onClick={() => setGroep("uitkomst")}>
            per besluit
          </button>
          <button type="button" className={"ghost-btn small" + (groep === "groep" ? " actief" : "")} onClick={() => setGroep("groep")}>
            per plaats of onderwerp
          </button>
        </span>
      </div>

      {volgorde.map(([naam, lijst]) => (
        <div key={naam} className="opr-onderwerp">
          <div className="opr-onderwerp-kop">
            <span className="opr-onderwerp-titel">{naam}</span>
            <span className="opr-chip">{lijst.length} pagina&rsquo;s</span>
          </div>
          <div className="opr-scroll">
            <table className="opr-tabel">
              <thead>
                <tr>
                  <th>Pagina</th><th>Besluit</th><th>Waarheen</th><th>Per maand</th><th>Nu</th><th>Waarom</th>
                </tr>
              </thead>
              <tbody>
                {lijst.slice(0, open[naam] ? 500 : 15).map((r) => (
                  <React.Fragment key={r.pad}>
                  <tr>
                    <td>
                      <Link p={r.pad} />
                      <div className="opr-eind-slokt">{r.herkomst.map((h) => HERKOMST_LABEL[h]).join(" · ")}</div>
                    </td>
                    <td><span className={`opr-chip ${CHIP[r.uitkomst]}`} title={WAT[r.uitkomst]}>{LABEL[r.uitkomst]}</span></td>
                    <td>{r.naar ? <Link p={r.naar} /> : <span className="opr-leeg">&mdash;</span>}</td>
                    <td>{r.volume != null ? `${r.volume}x` : <span className="opr-leeg">&mdash;</span>}</td>
                    <td>
                      {r.klikken > 0 ? <strong>{r.klikken} bezoekers</strong> : r.vertoningen > 0 ? `${r.vertoningen} vert.` : <span className="opr-leeg">niets</span>}
                      {r.positie != null && <div className="opr-eind-slokt">plek {Math.round(r.positie)}</div>}
                    </td>
                    <td className="opr-reden">
                      {r.reden}
                      {r.onderbouwing.length > 0 && (
                        <div>
                          <button type="button" className="opr-meer" onClick={() => setUitleg((m) => ({ ...m, [r.pad]: !m[r.pad] }))}>
                            {uitleg[r.pad] ? "▾ minder" : "▸ volledige onderbouwing"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* De volledige onderbouwing als eigen rij over alle kolommen, in
                      dezelfde kaart met drie kolommen als de losse blokken. Stond
                      alleen in die blokken, waardoor je vanuit de hoofdlijst niet
                      kon zien waarop een besluit rustte. */}
                  {uitleg[r.pad] && r.onderbouwing.length > 0 && (
                    <tr className="opr-redenrij">
                      <td colSpan={6}>
                        <div className="opr-uitleg">
                          <div className="opr-bewijs">
                            {r.onderbouwing.map((z, i) => <Zin key={i} tekst={z} />)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {lijst.length > 15 && (
            <button type="button" className="opr-meer" onClick={() => setOpen((m) => ({ ...m, [naam]: !m[naam] }))}>
              {open[naam] ? "▾ minder" : `▸ nog ${lijst.length - 15} pagina's`}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

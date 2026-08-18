"use client";

// ═══════════════════════════════════════════════════════════
// PLAATSPAGINA'S: ÉÉN BESLUIT PER PLAATS, NIET PER URL
// ═══════════════════════════════════════════════════════════
// Bij One Day Clinic staat dezelfde stad tot vier keer op de site, in vier
// verschillende URL-vormen. Die los voorleggen levert vier halve beslissingen op
// die elkaar tegenspreken. Hier staat één regel per plaats, met alle URL's die
// erbij horen, en één besluit.
//
// De onderbouwing is bewust geen scorewoord maar de redenering met de echte
// cijfers erin. Wie het er niet mee eens is, kan zien wáárop hij het oneens is.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import MailVenster from "./MailVenster";
import { KansChip, type Haalbaarheid } from "./OpruimOppakken";

type PlaatsPagina = { pad: string; vorm: string; term: string; klikken: number; vertoningen: number; positie: number | null };
type Uitkomst = "uitbouwen" | "blijft" | "samenvoegen" | "weg";
export type PlaatsAdvies = {
  plaats: string; naam: string; paginas: PlaatsPagina[];
  blijft: string; gaatWeg: string[]; uitkomst: Uitkomst; vestiging: boolean;
  term: string; volume: number | null; moeilijkheid: number | null; haalbaarheid: Haalbaarheid;
  klikken: number; vertoningen: number; bestePositie: number | null; onderbouwing: string[];
};
export type PlaatsenRapport = {
  adviezen: PlaatsAdvies[]; vestigingen: string[]; vormen: string[];
  gekozenVorm: string; autoriteit: number | null; paginasNu: number; paginasStraks: number;
};

const CHIP: Record<Uitkomst, string> = { uitbouwen: "keep", samenvoegen: "merge", blijft: "", weg: "nodig" };
const LABEL: Record<Uitkomst, string> = {
  uitbouwen: "uitbouwen", samenvoegen: "samenvoegen", blijft: "laten staan", weg: "opruimen",
};

// De onderbouwing komt als losse zinnen binnen, met hooguit **vet** erin. Geen
// ruwe sterretjes in beeld; dat is een harde regel.
function Zin({ tekst }: { tekst: string }) {
  const delen = tekst.split(/\*\*(.+?)\*\*/g);
  return <p>{delen.map((d, i) => (i % 2 ? <strong key={i}>{d}</strong> : <span key={i}>{d}</span>))}</p>;
}

export default function OpruimPlaatsen({ slug, domain, data, clientName, clientEmail, alleenLezen = false }: {
  slug: string; domain: string; data?: PlaatsenRapport | null;
  clientName?: string; clientEmail?: string; alleenLezen?: boolean;
}) {
  const [d, setD] = useState<PlaatsenRapport | null>(data || null);
  const [bezig, setBezig] = useState(!data);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Uitkomst | "alles">("alles");
  const [mailVoor, setMailVoor] = useState<PlaatsAdvies | null>(null);

  useEffect(() => {
    if (data) { setD(data); setBezig(false); return; }
    if (!slug) return;
    let leeft = true;
    fetch(`/api/admin/opruim-plaatsen?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (leeft && j?.ok) setD(j); })
      .catch(() => { /* stil */ })
      .finally(() => { if (leeft) setBezig(false); });
    return () => { leeft = false; };
  }, [slug, data]);

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  function mailBlok(a: PlaatsAdvies): string {
    return [
      `## ${a.naam}: ${LABEL[a.uitkomst]}`,
      "",
      `Op de website staan op dit moment ${a.paginas.length === 1 ? "één pagina" : `${a.paginas.length} pagina's`} over ${a.naam}: ${a.paginas.map((p) => p.pad).join(", ")}.`,
      "",
      ...a.onderbouwing.map((z) => `${z}\n`),
    ].join("\n");
  }

  if (bezig) return <div className="muted opr-str-laden">Het advies per plaats wordt bepaald…</div>;
  if (!d || !d.adviezen.length) return null;

  const tel = (u: Uitkomst) => d.adviezen.filter((a) => a.uitkomst === u).length;
  const rijen = filter === "alles" ? d.adviezen : d.adviezen.filter((a) => a.uitkomst === filter);

  return (
    <div className="opr-kaart">
      {/* De cijfers als tegels, de uitleg als kaartjes. Stond eerst als drie
          dichte alinea's met jargon erin (URL-vormen met haakjes, "62 plaatsen",
          "31 over"); dat leest niemand, ook Maarten niet, laat staan een klant. */}
      <div className="opr-str-kpi">
        <div><b>{d.paginasNu}</b><span>pagina&rsquo;s over een plaats</span></div>
        <div><b>{d.adviezen.length}</b><span>verschillende plaatsen</span></div>
        <div><b>{d.paginasStraks}</b><span>blijven er over</span></div>
        <div><b>{tel("uitbouwen")}</b><span>verdienen echt aandacht</span></div>
      </div>

      <div className="opr-intro-grid">
        <div className="opr-intro-kaart">
          <h4>Wat er aan de hand is</h4>
          <p>
            Er staan <strong>{d.paginasNu} pagina&rsquo;s</strong> op de site die over één plaats gaan, samen over{" "}
            <strong>{d.adviezen.length} plaatsen</strong>. Veel plaatsen staan er dus <strong>meer dan één keer</strong> op,
            met een net iets ander webadres.
          </p>
          <p>
            Dat is het probleem: Google moet dan kiezen tussen pagina&rsquo;s van dezelfde website die hetzelfde
            vertellen, en kiest er dan vaak geen enkele.
          </p>
        </div>
        <div className="opr-intro-kaart">
          <h4>Hoe we per plaats beslissen</h4>
          <ul>
            <li>Levert de pagina nu bezoekers op?</li>
            <li>Wordt er in die plaats gezocht?</li>
            <li>Kunnen we daar realistisch tussenkomen?</li>
            <li>Staat de plaats meerdere keren op de site?</li>
            <li>Zit er een vestiging, of is het bereikbaar vanuit een vestiging?</li>
          </ul>
        </div>
        <div className="opr-intro-kaart">
          <h4>Geen vestiging is geen doodvonnis</h4>
          <p>
            Een goede pagina voor een plaats zonder vestiging kan prima bezoekers opleveren, zolang er daar gezocht
            wordt en we er tussen kunnen komen.
          </p>
          <p>
            Zo&rsquo;n pagina moet wel eerlijk zijn over waar je dan terechtkomt, met de dichtstbijzijnde vestiging erop.
          </p>
        </div>
        <div className="opr-intro-kaart">
          <h4>Waar de gegevens vandaan komen</h4>
          <p>
            De vestigingen komen uit de bedrijfsgegevens die al zijn ingevuld
            {d.vestigingen.length > 0 ? <>: <strong>{d.vestigingen.map((v) => v.replace(/-/g, " ")).join(", ")}</strong></> : " (nog niet ingevuld)"}.
          </p>
          <p>
            Bezoekers en posities komen uit Search Console, het zoekvolume uit Ahrefs.
            {d.autoriteit != null ? ` Hoe zwaar een zoekterm is, wordt afgezet tegen hoe sterk deze website staat (${d.autoriteit} op 100).` : ""}
          </p>
        </div>
      </div>

      <div className="opr-vorm-rij" style={{ marginBottom: "var(--s-3)" }}>
        {(["alles", "uitbouwen", "samenvoegen", "blijft", "weg"] as const).map((k) => (
          <button key={k} type="button" className={"btn btn-klein" + (filter === k ? " actief" : "")}
            onClick={() => setFilter(k)}>
            {k === "alles" ? `alles (${d.adviezen.length})` : `${LABEL[k]} (${tel(k)})`}
          </button>
        ))}
      </div>

      <div className="opr-scroll">
        <table className="opr-tabel">
          <thead>
            <tr>
              <th>Plaats</th>
              <th>Wat er gebeurt</th>
              <th>Per maand</th>
              <th>Kans</th>
              <th>Nu</th>
              <th>Vestiging</th>
              <th>Pagina&rsquo;s</th>
              <th>Waarom</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((a) => (
              <React.Fragment key={a.plaats}>
              <tr>
                <td><strong>{a.naam}</strong><div className="opr-eind-slokt">{a.term}</div></td>
                <td><span className={`opr-chip ${CHIP[a.uitkomst]}`}>{LABEL[a.uitkomst]}</span></td>
                <td>{a.volume != null ? `${a.volume}x` : <span className="opr-leeg">&mdash;</span>}</td>
                <td><KansChip h={a.haalbaarheid} /></td>
                <td>
                  {a.klikken > 0 ? <strong>{a.klikken} bezoekers</strong> : a.vertoningen > 0 ? `${a.vertoningen} vertoningen` : <span className="opr-leeg">niets</span>}
                  {a.bestePositie != null && <div className="opr-eind-slokt">plek {Math.round(a.bestePositie)}</div>}
                </td>
                <td>{a.vestiging ? <span className="opr-chip keep">ja</span> : <span className="opr-leeg">nee</span>}</td>
                <td>
                  {a.blijft ? <div><Link p={a.blijft} /> <span className="opr-eind-slokt">blijft</span></div> : null}
                  {a.gaatWeg.map((p) => (
                    <div key={p} style={{ opacity: 0.7 }}><Link p={p} /> <span className="opr-eind-slokt">{a.blijft ? "gaat hierin op" : "weg"}</span></div>
                  ))}
                </td>
                <td className="opr-reden">
                  <button type="button" className="opr-meer" onClick={() => setOpen((m) => ({ ...m, [a.plaats]: !m[a.plaats] }))}>
                    {open[a.plaats] ? "▾ minder" : "▸ reden"}
                  </button>
                </td>
              </tr>
              {/* De onderbouwing als eigen rij over alle kolommen; in de cel werd
                  het een strook tegen de linkerrand. */}
              {open[a.plaats] && (
                <tr className="opr-redenrij">
                  <td colSpan={8}>
                    <div className="opr-uitleg">
                      <div className="opr-bewijs">
                        {a.onderbouwing.map((z, i) => <Zin key={i} tekst={z} />)}
                      </div>
                      {!alleenLezen && (
                        <button type="button" className="btn btn-klein opr-btn" style={{ marginTop: "var(--s-3)" }} onClick={() => setMailVoor(a)}>Mail naar klant</button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!alleenLezen && mailVoor && (
        <MailVenster
          slug={slug}
          titel="Mail dit advies naar de klant"
          onderwerpVan={`${mailVoor.naam}: ${LABEL[mailVoor.uitkomst]}`}
          taak={`Uitleg aan de klant over de pagina's voor ${mailVoor.naam}.`}
          toelichting={mailBlok(mailVoor)}
          blokMd={mailBlok(mailVoor)}
          siteUrl={domain}
          clientName={clientName}
          clientEmail={clientEmail}
          onClose={() => setMailVoor(null)}
        />
      )}
    </div>
  );
}

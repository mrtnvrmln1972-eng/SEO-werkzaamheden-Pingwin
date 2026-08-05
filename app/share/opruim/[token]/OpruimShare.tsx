"use client";

// ═══════════════════════════════════════════════════════════
// HET OPRUIMRAPPORT ALS DEELLINK
// ═══════════════════════════════════════════════════════════
// Precies dezelfde kaarten als in de cockpit, in leesmodus: uitklappen mag,
// alles wat iets vastlegt is er niet. Dat komt niet uit een tweede versie van
// het scherm maar uit dezelfde componenten met alleenLezen aan, zodat een
// verbetering aan de opmaak automatisch ook hier geldt.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { linkifyHtml } from "../../../../lib/linkify";
import OpruimTabel from "../../../admin/client/[slug]/OpruimTabel";
import OpruimStructuur from "../../../admin/client/[slug]/OpruimStructuur";
import OpruimOppakken, { type Oppakker } from "../../../admin/client/[slug]/OpruimOppakken";

type ClusterUrl = { url: string; positie?: number; klikken?: number; impressies?: number };
type Cluster = { keyword: string; winnaar: string; urls: ClusterUrl[]; onderbouwing?: string; signalen?: { urlFlip?: boolean; flipsIn90d?: number } };
type RedirectMapItem = { van: string; naar: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string };
type Result = {
  samenvatting: string; clusters: Cluster[]; redirectMap?: RedirectMapItem[];
  interneLinks?: InterneLink[]; oppakken?: Oppakker[]; generatedAt: string | null;
};
type Data = { clientName: string; domain: string; result: Result | null; updatedAt: string | null; structuur: { families: { vorm: string; aantal: number; dood: number; voorbeelden: string[] }[]; totaalLive: number; totaalVormen: number; dood: number; gemeten: boolean } | null };

const padVanUrl = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

export default function OpruimShare({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [fout, setFout] = useState("");

  useEffect(() => {
    fetch(`/api/share/opruim?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setD(j); else setFout(j?.error || "Deze link werkt niet meer."); })
      .catch(() => setFout("Deze link kon niet worden geladen."));
  }, [token]);

  if (fout) return <div className="opr-deel-leeg">{fout}</div>;
  if (!d) return <div className="opr-deel-leeg">Rapport wordt geladen…</div>;

  const r = d.result;
  const domain = d.domain;
  const siteUrl = (p: string) => {
    const pad = padVanUrl(p);
    return pad.startsWith("http") ? pad : `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${pad}`;
  };
  const regels = r?.redirectMap?.length || 0;

  // Het bewijs per pagina, net als in de cockpit, zodat de uitklappers hetzelfde
  // verhaal vertellen als wat Maarten ziet.
  const bewijsPerPad: Record<string, import("../../../admin/client/[slug]/OpruimTabel").Bewijs> = {};
  for (const c of r?.clusters || []) {
    for (const u of c.urls) {
      const p = padVanUrl(u.url);
      if (bewijsPerPad[p]) continue;
      bewijsPerPad[p] = { keyword: c.keyword, winnaar: c.winnaar, urls: c.urls, onderbouwing: c.onderbouwing, urlFlip: c.signalen?.urlFlip, flipsIn90d: c.signalen?.flipsIn90d };
    }
  }

  return (
    <div className="opr-deel">
      <header className="opr-deel-kop">
        <div className="opr-deel-merk">Pingwin</div>
        <h1>Opruimen en samenvoegen van pagina&rsquo;s</h1>
        <p>
          {d.clientName ? `${d.clientName}, ` : ""}
          {r?.generatedAt ? `analyse van ${new Date(r.generatedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}` : "actuele analyse"}
        </p>
      </header>

      <div className="cannibal-panel opr-deel-body">
        <div className="opr-kaart">
          <div className="opr-kop">Waar dit rapport over gaat</div>
          <div className="opr-kaart-tekst">
            <p>
              Op een website kunnen meerdere pagina&rsquo;s over hetzelfde onderwerp gaan. Google moet er dan één kiezen,
              en die keuze valt vaak wisselend uit. Het gevolg is dat geen van beide pagina&rsquo;s echt sterk wordt:
              de aandacht is verdeeld over twee halve pagina&rsquo;s in plaats van geconcentreerd in één goede.
            </p>
            <p>
              Deze analyse zoekt uit welke pagina&rsquo;s dat betreft, met behulp van de vertoningen en posities uit
              Search Console, het verloop daarvan door de tijd, en het zoekvolume per zoekwoord. Hieronder staat per
              pagina wat er gebeurt en waarom. Klap een regel open voor de onderbouwing.
            </p>
          </div>
        </div>

        {d.structuur && <OpruimStructuur slug="" data={d.structuur} />}

        {r?.oppakken && r.oppakken.length > 0 && (
          <OpruimOppakken slug="" domain={domain} rijen={r.oppakken} alleenLezen />
        )}

        {r?.redirectMap && r.redirectMap.length > 0 && (
          <div className="opr-kaart">
            <div className="opr-kop">Wat waar naartoe gaat ({regels})</div>
            <OpruimTabel slug="" domain={domain} rijen={r.redirectMap} bewijs={bewijsPerPad} alleenLezen />
          </div>
        )}

        {r?.interneLinks && r.interneLinks.length > 0 && (
          <div className="opr-kaart">
            <div className="opr-kop">Daarna: interne links leggen ({r.interneLinks.length})</div>
            <p className="opr-kaart-tekst">
              Doorverwijzen lost op dat twee pagina&rsquo;s om hetzelfde zoekwoord vechten. Deze links maken de
              overblijvende pagina daarna ook sterker: vanaf pagina&rsquo;s die over hetzelfde onderwerp gaan, met een
              linktekst die het zoekwoord bevat.
            </p>
            <div className="res-table-wrap">
              <table className="res-table">
                <thead><tr><th>Zet een link op deze pagina</th><th>Naar</th><th>Met deze tekst</th></tr></thead>
                <tbody>
                  {r.interneLinks.map((l, i) => (
                    <tr key={i}>
                      <td><a href={siteUrl(l.vanaf)} target="_blank" rel="noreferrer">{padVanUrl(l.vanaf)}</a></td>
                      <td><a href={siteUrl(l.naar)} target="_blank" rel="noreferrer">{padVanUrl(l.naar)}</a></td>
                      <td>{l.ankertekst || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {r?.samenvatting && (
          <div className="opr-kaart">
            <div className="opr-kop">Samengevat</div>
            <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: linkifyHtml(mdToHtml(r.samenvatting), domain) }} />
          </div>
        )}

        <p className="opr-deel-voet">Opgesteld door Pingwin Online Marketing. Vragen over dit rapport? Stel ze gerust.</p>
      </div>
    </div>
  );
}

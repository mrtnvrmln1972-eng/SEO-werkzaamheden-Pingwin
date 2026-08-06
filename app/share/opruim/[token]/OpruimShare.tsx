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
import OpruimTabel from "../../../admin/client/[slug]/OpruimTabel";
import OpruimStructuur from "../../../admin/client/[slug]/OpruimStructuur";
import OpruimOppakken, { type Oppakker } from "../../../admin/client/[slug]/OpruimOppakken";
import OpruimSamenvatting from "../../../admin/client/[slug]/OpruimSamenvatting";
import OpruimOnderwerpen, { type Onderwerp } from "../../../admin/client/[slug]/OpruimOnderwerpen";
import OpruimGaten, { type Gat } from "../../../admin/client/[slug]/OpruimGaten";
import OpruimEindstructuur, { type Eindstructuur } from "../../../admin/client/[slug]/OpruimEindstructuur";
import OpruimEenLijst from "../../../admin/client/[slug]/OpruimEenLijst";
import OpruimVergelijking from "../../../admin/client/[slug]/OpruimVergelijking";

type ClusterUrl = { url: string; positie?: number; klikken?: number; impressies?: number };
type Cluster = { keyword: string; winnaar: string; urls: ClusterUrl[]; onderbouwing?: string; signalen?: { urlFlip?: boolean; flipsIn90d?: number } };
type RedirectMapItem = { van: string; naar: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string };
type Result = {
  samenvatting: string; clusters: Cluster[]; redirectMap?: RedirectMapItem[];
  interneLinks?: InterneLink[]; oppakken?: Oppakker[]; onderwerpen?: Onderwerp[]; gaten?: Gat[]; generatedAt: string | null;
};
type Data = { clientName: string; domain: string; result: Result | null; updatedAt: string | null; structuur: { families: { vorm: string; aantal: number; dood: number; voorbeelden: string[] }[]; totaalLive: number; totaalVormen: number; dood: number; gemeten: boolean } | null; eindstructuur: Eindstructuur | null };

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
              Op een website kunnen meerdere pagina&rsquo;s over hetzelfde onderwerp gaan. Google moet er dan één van
              kiezen, en die keuze valt vaak wisselend uit. Het gevolg: <strong>geen van beide pagina&rsquo;s wordt echt
              sterk</strong>, omdat de aandacht verdeeld raakt over twee halve in plaats van geconcentreerd in één goede.
            </p>
            <p>Deze analyse zoekt uit om welke pagina&rsquo;s dat gaat. De basis daarvoor:</p>
            <ul className="opr-punten">
              <li><strong>Search Console:</strong> hoe vaak elke pagina in Google is getoond, op welke zoekopdracht, en op welke plek.</li>
              <li><strong>Het verloop door de tijd:</strong> of Google tussen twee pagina&rsquo;s heen en weer wisselt op dezelfde zoekopdracht.</li>
              <li><strong>Het zoekvolume per zoekwoord:</strong> hoe vaak er maandelijks op een term gezocht wordt, zodat een kansrijke pagina niet per ongeluk verdwijnt.</li>
              <li><strong>Wat iemand bedoelt met een zoekopdracht:</strong> wil hij iets regelen, of eerst iets weten. Dat bepaalt of twee pagina&rsquo;s wel of niet bij elkaar horen.</li>
              <li><strong>Hoe zwaar een zoekterm is</strong> vergeleken met hoe sterk deze website staat, zodat er geen werk wordt voorgesteld dat toch niet gaat lukken.</li>
            </ul>

            <p>
              <strong>Opruimen betekent niet zoveel mogelijk weghalen.</strong> Twee dingen worden bewust
              tegengehouden. Pagina&rsquo;s die over dezelfde woorden gaan maar over een andere vraag, blijven apart:
              iemand die een test wil bestellen heeft een andere pagina nodig dan iemand die eerst wil weten wat een
              test inhoudt, en die samenvoegen kost bezoekers in plaats van dat het ze oplevert. En een pagina die nu
              niets oplevert maar wél op een gevraagde zoekterm zit, wordt niet weggehaald maar opnieuw opgebouwd.
            </p>
            <p>
              Er wordt ook gekeken naar wat er <strong>niet</strong> is: zoekopdrachten waar maandelijks op gezocht
              wordt en waar deze website geen enkele pagina voor heeft. Die bezoekers komen nu bij een ander terecht.
            </p>
            <p>
              Hieronder staat <strong>per pagina wat er gebeurt en waarom</strong>. Klap een regel open voor de volledige
              onderbouwing, met de cijfers erbij. Helemaal onderaan staat hoe de website eruitziet als alles is
              doorgevoerd: netjes gegroepeerd per onderwerp.
            </p>
          </div>
        </div>

        {/* Met de hand geschreven voor One Day Clinic tegen Stadskliniek (7
            augustus 2026), dus alleen tonen bij dit domein. */}
        {domain === "onedayclinic.nl" && <OpruimVergelijking />}

        {/* De hoofdmoot, exact zoals in de cockpit: één regel per pagina, één
            besluit, met de onderbouwing eronder. De losse blokken die hierna
            komen zijn de verdieping per soort besluit. */}
        <OpruimEenLijst slug="" domain={domain} token={token} alleenLezen titel="Wat er met elke pagina gebeurt" />

        {d.structuur && <OpruimStructuur slug="" data={d.structuur} />}

        {r?.onderwerpen && r.onderwerpen.length > 0 && (
          <OpruimOnderwerpen slug="" domain={domain} rijen={r.onderwerpen} alleenLezen />
        )}

        {r?.oppakken && r.oppakken.length > 0 && (
          <OpruimOppakken slug="" domain={domain} rijen={r.oppakken} alleenLezen />
        )}

        {r?.gaten && r.gaten.length > 0 && (
          <OpruimGaten slug="" domain={domain} rijen={r.gaten} alleenLezen />
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

        {/* Het sluitstuk, ook voor de klant: niet het werk maar het resultaat. */}
        {d.eindstructuur && <OpruimEindstructuur slug="" domain={domain} data={d.eindstructuur} />}

        <OpruimSamenvatting
          domain={domain}
          samenvatting={r?.samenvatting}
          clusters={r?.clusters?.length || 0}
          regels={regels}
          oppakken={r?.oppakken?.length || 0}
          onderwerpen={r?.onderwerpen?.length || 0}
          gaten={r?.gaten?.length || 0}
          euroPerMaand={
            [...(r?.oppakken || []), ...(r?.onderwerpen || []), ...(r?.gaten || [])]
              .reduce((n, x) => n + ((x as { euro?: { perMaand?: number } }).euro?.perMaand || 0), 0)
          }
          blijftStaan={0}
          interneLinks={r?.interneLinks?.length || 0}
        />

        <p className="opr-deel-voet">Opgesteld door Pingwin Online Marketing. Vragen over dit rapport? Stel ze gerust.</p>
      </div>
    </div>
  );
}

"use client";

// ═══════════════════════════════════════════════════════════
// DE SITEMAP-CHECK ZOALS HIJ ERUITZIET
// ═══════════════════════════════════════════════════════════
// Eén weergave, twee plekken: het beheerscherm (met de knoppen die de controle
// opnieuw draaien) en de deel-link (alleen lezen). Bewust niet twee versies van
// hetzelfde scherm, want dan lopen ze uit elkaar zodra er één wordt bijgewerkt.
// Wat de twee plekken verschillend maakt komt binnen als knoppen of als extra
// blok; de blokken zelf staan hier één keer.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from "react";
import { Paneel, Blok, Signaal, Signalen, Pad, Tabel, Leeg, Tekst } from "../../../../_ui/Uitkomst";
import type { SitemapCheckUitkomst } from "../../../../../lib/sitemap-check";

export const datumNL = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "onbekend";
export const getalNL = (n: number) => n.toLocaleString("nl-NL");

/** De regels over de sitemap zelf, als signalen met een oordeel. */
function sitemapRegels(data: SitemapCheckUitkomst): { soort: "goed" | "let-op"; tekst: string }[] {
  const regels: { soort: "goed" | "let-op"; tekst: string }[] = [];
  if (data.gevonden) {
    regels.push({ soort: "goed", tekst: `De sitemap staat op ${data.sitemapUrl} en noemt ${getalNL(data.aantalInSitemap)} pagina's${data.bestanden.length > 1 ? `, verdeeld over ${data.bestanden.length} bestanden` : ""}.` });
    for (const b of data.bestanden.filter((x) => x.status !== 200)) {
      regels.push({ soort: "let-op", tekst: `Deelbestand ${b.url} is niet leesbaar (antwoord ${b.status === null ? "geen verbinding" : b.status}); de pagina's daarin telt Google niet mee.` });
    }
  } else {
    for (const p of data.pogingen) {
      regels.push({ soort: "let-op", tekst: `${p.url} gaf ${p.status === null ? "geen verbinding" : `antwoord ${p.status}`}${p.status === 429 || p.status === 403 ? "; de site blokkeert hier geautomatiseerde lezers, en zo'n blokkade kan ook Google raken" : ""}.` });
    }
    if (!data.pogingen.length) regels.push({ soort: "let-op", tekst: "Er is geen sitemap gevonden op de gangbare plekken." });
  }
  regels.push(data.robotsVerwijst
    ? { soort: "goed", tekst: "robots.txt verwijst naar de sitemap, zoals het hoort." }
    : { soort: "let-op", tekst: `robots.txt ${data.robotsStatus === 200 ? "verwijst niet naar de sitemap" : "is niet leesbaar"}; zoekmachines moeten de sitemap dan zelf maar zien te vinden. Dit staat in de instructie voor de sitebeheerder.` });
  return regels;
}

export default function SitemapWeergave({ data, domain, uitleg, knoppen, melding, laden, tussenblok, bedienbaar }: {
  data: SitemapCheckUitkomst | null;
  domain: string;
  /** De zin onder de paneelkop; verschilt per plek, want de klant leest anders mee. */
  uitleg: string;
  /** Wat er rechtsboven staat. Leeg op de deel-link: daar valt niets te bedienen. */
  knoppen?: ReactNode;
  melding?: string;
  laden?: boolean;
  /** Een blok dat alleen in het beheerscherm bestaat (de Googlebot-inspectie). */
  tussenblok?: ReactNode;
  /**
   * Staan de knoppen er? Zo ja, dan mag een tip ernaar verwijzen. Op de deel-link
   * staan ze er niet, en dan is "klik op de knop" een aanwijzing naar iets wat de
   * lezer niet ziet.
   */
  bedienbaar?: boolean;
}) {
  const spiegelOud = !!data?.spiegelDatum && Date.now() - new Date(data.spiegelDatum).getTime() > 14 * 86400000;

  return (
    <Paneel titel="De sitemap naast de echte site" uitleg={uitleg} knoppen={knoppen}>
      {melding && <Signaal soort="let-op">{melding}</Signaal>}
      {laden && !data && <Leeg>De sitemap wordt opgehaald en vergeleken; dit duurt een paar tellen.</Leeg>}

      {data && (
        <>
          <Blok titel="De sitemap zelf">
            <div className="uk-signalen">
              {sitemapRegels(data).map((r, i) => <Signaal key={i} soort={r.soort} domein={domain}>{r.tekst}</Signaal>)}
            </div>
          </Blok>

          {data.gevonden && (
            <Blok
              titel={data.missend.length ? `Live pagina's die niet in de sitemap staan (${getalNL(data.missend.length)})` : "Live pagina's die niet in de sitemap staan"}
              meta={`vergeleken met de paginalijst van ${datumNL(data.spiegelDatum)} (${getalNL(data.spiegelAantal)} pagina's)`}
            >
              {spiegelOud && <Signaal soort="notitie">{`De paginalijst is voor het laatst ingelezen op ${datumNL(data.spiegelDatum)}.${bedienbaar ? ' Klik "Site opnieuw inlezen" voor een vergelijking met vandaag.' : ""}`}</Signaal>}
              {data.missend.length === 0
                ? <Leeg>Alles wat live staat, staat ook in de sitemap. Zo hoort het.</Leeg>
                : <>
                    <Tekst klein>{"Deze pagina's bestaan en doen mee in Google, maar de site geeft ze niet op in zijn eigen inhoudsopgave. Google vindt ze dan alleen via links, dus later en minder betrouwbaar. De oplossing staat in de instructie voor de sitebeheerder."}</Tekst>
                    <Tabel kolommen={["Pagina", "Vertoningen (28 dgn)", "Klikken"]}>
                      {data.missend.map((m) => (
                        <tr key={m.url}>
                          <td><Pad pad={m.url} domein={domain} /></td>
                          <td>{getalNL(m.gscImpressions)}</td>
                          <td>{getalNL(m.gscClicks)}</td>
                        </tr>
                      ))}
                    </Tabel>
                  </>}
            </Blok>
          )}

          {data.gevonden && (
            <Blok titel={data.fouteRegels.length ? `Regels in de sitemap die niet meer kloppen (${getalNL(data.fouteRegels.length)})` : "Regels in de sitemap die niet meer kloppen"}>
              {data.fouteRegels.length === 0
                ? <Leeg>De sitemap noemt geen omgeleide of verdwenen pagina&rsquo;s. Zo hoort het.</Leeg>
                : <>
                    <Tekst klein>{"De sitemap hoort alleen levende pagina's te noemen. Deze regels wijzen naar een pagina die is omgeleid of weg is; ze horen uit de sitemap te verdwijnen."}</Tekst>
                    <Tabel kolommen={["Regel in de sitemap", "Wat er echt gebeurt"]}>
                      {data.fouteRegels.map((f) => (
                        <tr key={f.url}>
                          <td><Pad pad={f.url} domein={domain} /></td>
                          <td>{f.status !== null && f.status >= 300 && f.status < 400 ? <>omgeleid naar <Pad pad={f.redirectTarget || "onbekend"} domein={domain} /></> : `weg (antwoord ${f.status})`}</td>
                        </tr>
                      ))}
                    </Tabel>
                  </>}
            </Blok>
          )}

          {tussenblok}

          {data.gevonden && data.onbekendAantal > 0 && (
            <Blok titel={`In de sitemap, maar nog niet gescand (${getalNL(data.onbekendAantal)})`}>
              <Tekst klein>{bedienbaar
                ? "Deze adressen noemt de sitemap wel, maar de paginalijst kent ze nog niet. Meestal zijn het nieuwe pagina's; klik “Site opnieuw inlezen” om ze op te nemen en live te controleren."
                : "Deze adressen noemt de sitemap wel, maar de paginalijst kent ze nog niet. Meestal zijn het nieuwe pagina's die bij de eerstvolgende scan meegenomen worden."}</Tekst>
              <Signalen soort="notitie" domein={domain} regels={data.onbekend.map((u) => u)} />
            </Blok>
          )}
        </>
      )}
    </Paneel>
  );
}

"use client";

// De sitemap-check: haalt de sitemap van de klant vers op en legt hem naast de
// paginaspiegel. Drie vragen, drie blokken: is de sitemap zelf gezond, welke
// live pagina's missen erin, en welke regels erin kloppen niet meer. Gebouwd
// met de gedeelde bouwstenen uit app/_ui/Uitkomst.tsx; de logica staat in
// lib/sitemap-check.ts.

import { useCallback, useEffect, useState } from "react";
import { Paneel, Blok, Signaal, Signalen, Pad, Tabel, Leeg, Tekst } from "../../../../_ui/Uitkomst";
import { useKlus } from "../useKlus";
import type { SitemapCheckUitkomst } from "../../../../../lib/sitemap-check";
import type { GooglebotInspectie } from "../../../../../lib/googlebot-check";
import { PijlLinks } from "../../../../_ui/Pijl";

export default function SitemapCheck({ slug, clientName, domain }: { slug: string; clientName: string; domain: string }) {
  const [data, setData] = useState<SitemapCheckUitkomst | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");

  const laad = useCallback(async () => {
    setLaden(true); setFout("");
    try {
      const d = await fetch(`/api/admin/sitemap-check?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d?.ok) setData(d as SitemapCheckUitkomst);
      else setFout(d?.error || "De controle lukte niet; probeer het nog een keer.");
    } catch { setFout("De controle lukte niet; probeer het nog een keer."); }
    finally { setLaden(false); }
  }, [slug]);
  useEffect(() => { void laad(); }, [laad]);

  // "Site opnieuw inlezen" is de bestaande achtergrondklus van het Pagina's-tabje;
  // zodra die klaar is, vergelijken we opnieuw met de verse spiegel.
  const inlezen = useKlus(slug, "site-inlezen", () => { void laad(); });
  async function scan() {
    if (inlezen.bezig) return;
    setFout("");
    try {
      const d = await fetch("/api/admin/urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      if (d?.ok) { inlezen.zetBezig(); await inlezen.ververs(); }
      else setFout(d?.error || "Inlezen starten lukte niet.");
    } catch { setFout("Inlezen starten lukte niet."); }
  }

  // ── Wat ziet Googlebot? URL-inspectie op een dwarsdoorsnede van pagina's ──
  const [gb, setGb] = useState<GooglebotInspectie[] | null>(null);
  const [gbBezig, setGbBezig] = useState(false);
  const [gbFout, setGbFout] = useState("");
  async function vraagGoogle() {
    if (!data || gbBezig) return;
    setGbBezig(true); setGbFout("");
    // Dwarsdoorsnede: de voorpagina, de drukste en twee stille missende
    // pagina's, en één verouderde sitemap-regel. Acht is het maximum per klik.
    const sample = [...new Set([
      `https://${domain.replace(/^www\./, "")}/`,
      ...data.missend.slice(0, 3).map((m) => m.url),
      ...data.missend.filter((m) => m.gscImpressions === 0).slice(0, 3).map((m) => m.url),
      ...data.fouteRegels.slice(0, 1).map((f) => f.url),
    ])].slice(0, 8);
    try {
      const d = await fetch(`/api/admin/googlebot-check?slug=${encodeURIComponent(slug)}&urls=${encodeURIComponent(sample.join(","))}`).then((r) => r.json());
      if (d?.ok) setGb(d.resultaten as GooglebotInspectie[]);
      else setGbFout(d?.error || "De inspectie lukte niet; probeer het nog een keer.");
    } catch { setGbFout("De inspectie lukte niet; probeer het nog een keer."); }
    finally { setGbBezig(false); }
  }

  const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "onbekend");
  const getal = (n: number) => n.toLocaleString("nl-NL");
  const spiegelOud = !!data?.spiegelDatum && Date.now() - new Date(data.spiegelDatum).getTime() > 14 * 86400000;

  // ── De regels over de sitemap zelf, als signalen met een oordeel ──
  const sitemapRegels: { soort: "goed" | "let-op"; tekst: string }[] = [];
  if (data) {
    if (data.gevonden) {
      sitemapRegels.push({ soort: "goed", tekst: `De sitemap staat op ${data.sitemapUrl} en noemt ${getal(data.aantalInSitemap)} pagina's${data.bestanden.length > 1 ? `, verdeeld over ${data.bestanden.length} bestanden` : ""}.` });
      for (const b of data.bestanden.filter((x) => x.status !== 200)) {
        sitemapRegels.push({ soort: "let-op", tekst: `Deelbestand ${b.url} is niet leesbaar (antwoord ${b.status === null ? "geen verbinding" : b.status}); de pagina's daarin telt Google niet mee.` });
      }
    } else {
      for (const p of data.pogingen) {
        sitemapRegels.push({ soort: "let-op", tekst: `${p.url} gaf ${p.status === null ? "geen verbinding" : `antwoord ${p.status}`}${p.status === 429 || p.status === 403 ? "; de site blokkeert hier geautomatiseerde lezers, en zo'n blokkade kan ook Google raken" : ""}.` });
      }
      if (!data.pogingen.length) sitemapRegels.push({ soort: "let-op", tekst: "Er is geen sitemap gevonden op de gangbare plekken." });
    }
    sitemapRegels.push(data.robotsVerwijst
      ? { soort: "goed", tekst: "robots.txt verwijst naar de sitemap, zoals het hoort." }
      : { soort: "let-op", tekst: `robots.txt ${data.robotsStatus === 200 ? "verwijst niet naar de sitemap" : "is niet leesbaar"}; zoekmachines moeten de sitemap dan zelf maar zien te vinden. Dit staat in de instructie voor de sitebeheerder.` });
  }

  return (
    <div className="nv-wrap">
      <div className="nv-kop">
        <a className="nv-terug" href={`/admin/client/${slug}?tab=paginas`}><PijlLinks /> terug naar de cockpit</a>
        <h1>Sitemap-check: {clientName}</h1>
      </div>

      <Paneel
        titel="De sitemap naast de echte site"
        uitleg="De sitemap is de inhoudsopgave die de site aan Google geeft. Hieronder staat of die inhoudsopgave klopt: vers opgehaald en vergeleken met de pagina's die echt live staan."
        knoppen={<>
          <button type="button" className="btn btn-ghost btn-klein" disabled={laden} onClick={() => void laad()}>{laden ? "Controleren…" : "Opnieuw controleren"}</button>
          <button type="button" className="btn btn-primary btn-klein" disabled={inlezen.bezig} onClick={() => void scan()} title="Leest de hele site opnieuw in (sitemap, Search Console, Ahrefs en interne links); daarna klopt de vergelijking hieronder weer met vandaag.">
            {inlezen.bezig ? (inlezen.klus?.label || "Site inlezen…") : "Site opnieuw inlezen"}
          </button>
        </>}
      >
        {fout && <Signaal soort="let-op">{fout}</Signaal>}
        {laden && !data && <Leeg>De sitemap wordt opgehaald en vergeleken; dit duurt een paar tellen.</Leeg>}

        {data && (
          <>
            <Blok titel="De sitemap zelf">
              <div className="uk-signalen">
                {sitemapRegels.map((r, i) => <Signaal key={i} soort={r.soort} domein={domain}>{r.tekst}</Signaal>)}
              </div>
            </Blok>

            {data.gevonden && (
              <Blok
                titel={data.missend.length ? `Live pagina's die niet in de sitemap staan (${getal(data.missend.length)})` : "Live pagina's die niet in de sitemap staan"}
                meta={`vergeleken met de paginalijst van ${datum(data.spiegelDatum)} (${getal(data.spiegelAantal)} pagina's)`}
              >
                {spiegelOud && <Signaal soort="notitie">{`De paginalijst is voor het laatst ingelezen op ${datum(data.spiegelDatum)}. Klik "Site opnieuw inlezen" voor een vergelijking met vandaag.`}</Signaal>}
                {data.missend.length === 0
                  ? <Leeg>Alles wat live staat, staat ook in de sitemap. Zo hoort het.</Leeg>
                  : <>
                      <Tekst klein>{"Deze pagina's bestaan en doen mee in Google, maar de site geeft ze niet op in zijn eigen inhoudsopgave. Google vindt ze dan alleen via links, dus later en minder betrouwbaar. De oplossing staat in de instructie voor de sitebeheerder."}</Tekst>
                      <Tabel kolommen={["Pagina", "Vertoningen (28 dgn)", "Klikken"]}>
                        {data.missend.map((m) => (
                          <tr key={m.url}>
                            <td><Pad pad={m.url} domein={domain} /></td>
                            <td>{getal(m.gscImpressions)}</td>
                            <td>{getal(m.gscClicks)}</td>
                          </tr>
                        ))}
                      </Tabel>
                    </>}
              </Blok>
            )}

            {data.gevonden && (
              <Blok titel={data.fouteRegels.length ? `Regels in de sitemap die niet meer kloppen (${getal(data.fouteRegels.length)})` : "Regels in de sitemap die niet meer kloppen"}>
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

            <Blok titel="Wat ziet Googlebot?" meta="rechtstreeks uit Search Console, per pagina">
              <Tekst klein>{"Dit vraagt het aan Google zelf (URL-inspectie): wanneer kwam Googlebot voor het laatst langs, lukte het ophalen toen, en staat de pagina in de index. Zo zie je of een blokkade op de site ook Google raakt. Het totaaloverzicht van crawlfouten voor de hele site staat alleen in Search Console zelf, onder Instellingen en dan Crawlstatistieken."}</Tekst>
              {gbFout && <Signaal soort="let-op">{gbFout}</Signaal>}
              {!gb && (
                <div className="uk-knoppen uk-knoppen-onder">
                  <button type="button" className="btn btn-ghost btn-klein" disabled={gbBezig || !data.gevonden} onClick={() => void vraagGoogle()}>{gbBezig ? "Google vragen… (halve minuut)" : "Vraag het aan Google"}</button>
                </div>
              )}
              {gb && (
                <>
                  {gb.some((r) => r.geblokkeerd)
                    ? <Signaal soort="let-op">{`Googlebot liep bij ${gb.filter((r) => r.geblokkeerd).length} van de ${gb.length} gecontroleerde pagina's tegen een blokkade aan; de blokkade raakt dus ook Google.`}</Signaal>
                    : <Signaal soort="goed">{`Bij de ${gb.length} gecontroleerde pagina's zag Googlebot geen blokkade; de eerdere 429 raakt dus vooral meettools, niet Google zelf.`}</Signaal>}
                  <Tabel kolommen={["Pagina", "Laatst gecrawld", "Ophalen", "In de index"]}>
                    {gb.map((r) => (
                      <tr key={r.url}>
                        <td><Pad pad={r.url} domein={domain} /></td>
                        <td>{r.gelukt ? datum(r.laatstGecrawld) : ""}</td>
                        <td>{r.gelukt ? r.ophalen : (r.fout || "inspectie mislukt")}</td>
                        <td>{r.gelukt ? r.index : ""}</td>
                      </tr>
                    ))}
                  </Tabel>
                  <div className="uk-knoppen uk-knoppen-onder">
                    <button type="button" className="btn btn-quiet btn-klein" disabled={gbBezig} onClick={() => void vraagGoogle()}>{gbBezig ? "Google vragen…" : "Opnieuw vragen"}</button>
                  </div>
                </>
              )}
            </Blok>

            {data.gevonden && data.onbekendAantal > 0 && (
              <Blok titel={`In de sitemap, maar nog niet gescand (${getal(data.onbekendAantal)})`}>
                <Tekst klein>{"Deze adressen noemt de sitemap wel, maar de paginalijst kent ze nog niet. Meestal zijn het nieuwe pagina's; klik “Site opnieuw inlezen” om ze op te nemen en live te controleren."}</Tekst>
                <Signalen soort="notitie" domein={domain} regels={data.onbekend.map((u) => u)} />
              </Blok>
            )}
          </>
        )}
      </Paneel>
    </div>
  );
}

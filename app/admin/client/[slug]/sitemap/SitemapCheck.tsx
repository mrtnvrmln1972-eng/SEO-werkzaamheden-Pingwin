"use client";

// De sitemap-check: haalt de sitemap van de klant vers op en legt hem naast de
// paginaspiegel. Drie vragen, drie blokken: is de sitemap zelf gezond, welke
// live pagina's missen erin, en welke regels erin kloppen niet meer.
//
// Hoe het eruitziet staat in SitemapWeergave.tsx, want de deel-link toont exact
// dezelfde blokken; de logica staat in lib/sitemap-check.ts. Hier staat alleen
// wat dít scherm extra kan: opnieuw controleren, de site opnieuw inlezen, het
// aan Google zelf vragen, en de link maken waarmee je dit met iemand deelt.

import { useCallback, useEffect, useState } from "react";
import { Blok, Signaal, Pad, Tabel, Tekst } from "../../../../_ui/Uitkomst";
import DeelLinkBalk from "../../../../_ui/DeelLinkBalk";
import SitemapWeergave, { datumNL } from "./SitemapWeergave";
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

  const googlebotBlok = (
    <Blok titel="Wat ziet Googlebot?" meta="rechtstreeks uit Search Console, per pagina">
      <Tekst klein>{"Dit vraagt het aan Google zelf (URL-inspectie): wanneer kwam Googlebot voor het laatst langs, lukte het ophalen toen, en staat de pagina in de index. Zo zie je of een blokkade op de site ook Google raakt. Het totaaloverzicht van crawlfouten voor de hele site staat alleen in Search Console zelf, onder Instellingen en dan Crawlstatistieken."}</Tekst>
      {gbFout && <Signaal soort="let-op">{gbFout}</Signaal>}
      {!gb && (
        <div className="uk-knoppen uk-knoppen-onder">
          <button type="button" className="btn btn-ghost btn-klein" disabled={gbBezig || !data?.gevonden} onClick={() => void vraagGoogle()}>{gbBezig ? "Google vragen… (halve minuut)" : "Vraag het aan Google"}</button>
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
                <td>{r.gelukt ? datumNL(r.laatstGecrawld) : ""}</td>
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
  );

  return (
    <div className="nv-wrap">
      <div className="nv-kop">
        <a className="nv-terug" href={`/admin/client/${slug}?tab=paginas`}><PijlLinks /> terug naar de cockpit</a>
        <h1>Sitemap-check: {clientName}</h1>
      </div>

      <SitemapWeergave
        data={data}
        domain={domain}
        bedienbaar
        laden={laden}
        melding={fout}
        uitleg="De sitemap is de inhoudsopgave die de site aan Google geeft. Hieronder staat of die inhoudsopgave klopt: vers opgehaald en vergeleken met de pagina's die echt live staan."
        knoppen={<>
          <button type="button" className="btn btn-ghost btn-klein" disabled={laden} onClick={() => void laad()}>{laden ? "Controleren…" : "Opnieuw controleren"}</button>
          <button type="button" className="btn btn-primary btn-klein" disabled={inlezen.bezig} onClick={() => void scan()} title="Leest de hele site opnieuw in (sitemap, Search Console, Ahrefs en interne links); daarna klopt de vergelijking hieronder weer met vandaag.">
            {inlezen.bezig ? (inlezen.klus?.label || "Site inlezen…") : "Site opnieuw inlezen"}
          </button>
        </>}
        tussenblok={googlebotBlok}
      />

      <DeelLinkBalk
        slug={slug}
        soort="sitemap"
        titel="Deel deze check met iemand anders"
        uitleg={"Wie deze link krijgt, ziet precies deze controle: geen inlog, niets om te wijzigen, en geen weg naar de rest van het dashboard of naar een andere klant. Hij toont de stand van de laatste controle die je hier draaide, met de datum erbij. Klik “Opnieuw controleren” om ook de gedeelde stand te verversen."}
      />
    </div>
  );
}

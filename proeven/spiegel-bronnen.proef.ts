import { verenigBronnen } from "../lib/site-urls";

// ═══════════════════════════════════════════════════════════
// POORT: de paginaspiegel bouwt op de vereniging van vier bronnen
// ═══════════════════════════════════════════════════════════
// Waarom dit bestand er is. De spiegel bouwde eerst alleen op de sitemap, en
// daardoor was /snelle-soa-test-amsterdam/ van One Day Clinic onzichtbaar in
// het dashboard: live, ruim twintig zoektermen, maar niet in de sitemap, dus
// voor elk scherm onbestaand. Een lijst die volledigheid belooft en stil
// pagina's laat vallen is erger dan geen lijst.
//
// Wat hier vastligt:
//   - een pagina die alleen Search Console (of Ahrefs, of een interne link)
//     kent, komt tóch in de lijst, met de juiste herkomst;
//   - dubbelingen (http/https, met/zonder slash, met/zonder www) worden één
//     regel waarin de herkomsten samenkomen;
//   - andermans domein, bestanden (pdf/jpg/css) en tag-/filterpagina's blijven
//     erbuiten;
//   - de vorm uit de vroegste bron wint (sitemap boven gsc boven ahrefs boven
//     links), zodat bestaande regels niet van vorm wisselen.
// ═══════════════════════════════════════════════════════════

let fouten = 0;
function eis(naam: string, waar: boolean): void {
  if (!waar) { console.error(`  ✗ ${naam}`); fouten++; }
}

const uit = verenigBronnen("onedayclinic.nl", {
  sitemap: [
    "https://onedayclinic.nl/soa-test/",
    "https://onedayclinic.nl/tags/oud/",            // uitgesloten pad
    "https://onedayclinic.nl/brochure.pdf",         // bestand, geen pagina
  ],
  gsc: [
    "https://onedayclinic.nl/soa-test",              // dubbel met sitemap (zonder slash)
    "https://onedayclinic.nl/snelle-soa-test-amsterdam/", // alleen in GSC
    "https://www.ander-domein.nl/soa-test/",         // andermans domein
  ],
  ahrefs: [
    "https://www.onedayclinic.nl/snelle-soa-test-amsterdam/", // zelfde pagina, met www
  ],
  links: [
    "https://onedayclinic.nl/alleen-via-link/",
  ],
});

const perPad = new Map(uit.map((x) => [x.url, x.bronnen]));

eis("de sitemap-pagina staat erin", perPad.has("https://onedayclinic.nl/soa-test/"));
eis("de GSC-variant zonder slash is dezelfde regel geworden (geen tweede rij)",
  uit.filter((x) => x.url.includes("/soa-test")).filter((x) => !x.url.includes("amsterdam")).length === 1);
eis("die ene regel kent beide herkomsten",
  (perPad.get("https://onedayclinic.nl/soa-test/") || []).join(",") === "sitemap,gsc");
eis("een pagina die alleen GSC kent komt tóch in de lijst",
  uit.some((x) => x.url.includes("snelle-soa-test-amsterdam")));
eis("die pagina heeft herkomst gsc en ahrefs, maar niet sitemap",
  (() => { const b = uit.find((x) => x.url.includes("snelle-soa-test-amsterdam"))?.bronnen || []; return b.includes("gsc") && b.includes("ahrefs") && !b.includes("sitemap"); })());
eis("een pagina die alleen via een interne link gevonden is komt erin, met herkomst links",
  (uit.find((x) => x.url.includes("alleen-via-link"))?.bronnen || []).join(",") === "links");
eis("andermans domein blijft erbuiten", !uit.some((x) => x.url.includes("ander-domein")));
eis("bestanden blijven erbuiten", !uit.some((x) => x.url.endsWith(".pdf")));
eis("tag-/filterpagina's blijven erbuiten", !uit.some((x) => x.url.includes("/tags/")));
eis("de vorm van de vroegste bron wint (sitemap-vorm met slash)",
  perPad.has("https://onedayclinic.nl/soa-test/") && !perPad.has("https://onedayclinic.nl/soa-test"));

if (fouten > 0) {
  console.error(`spiegel-bronnen.proef: ${fouten} controle(s) mislukt.`);
  process.exit(1);
}
console.log("spiegel-bronnen.proef: alle controles goed.");

// ═══════════════════════════════════════════════════════════
// POORT: EEN MACHINEKOPPELING IS GEEN PAGINA
// ═══════════════════════════════════════════════════════════
// Wat er misging (21-08-2026, live bij Nationaal Oogcentrum). De sitemap-check
// meldde 103 live pagina's die niet in de sitemap staan. Daarvan waren er 77
// `/wp-json/...`, de REST API van WordPress: dezelfde inhoud als datablok voor de
// blokeditor en apps, geen pagina waar iemand op landt. Plus twee afbeeldingen
// uit de mediabibliotheek. Het echte aantal was 24, en die 24 vragen om een
// besluit per stuk (in de sitemap zetten, of juist op noindex).
//
// Waarom dat erger is dan een schoonheidsfout: dat getal is de kern van het
// advies dat naar een klant of sitebeheerder gaat. 103 leest als "je sitemap
// deugt niet", 24 leest als "er ontbreken een paar pagina's die er wel in horen".
// Ruis maakt een lijst niet langer maar ongeloofwaardig, en dan gelooft niemand
// de echte bevindingen ook nog.
//
// De filter staat op één plek (`isGeenPagina` in lib/site-urls.ts) en werkt aan
// twee kanten: bij het inlezen, zodat er niets nieuws bij komt, en bij het lezen
// van de paginalijst, zodat de spiegels die er al staan meteen eerlijk zijn.
// Deze proef legt vast wat wél en niet een pagina is, want die grens is precies
// het soort ding dat een halfjaar later ongemerkt verschuift.
// ═══════════════════════════════════════════════════════════

import { isGeenPagina, verenigBronnen } from "../lib/site-urls";

let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const D = "https://www.laatjeogenlaseren.nl";

// ── Dit is géén pagina ──
const RUIS = [
  `${D}/wp-json/`,
  `${D}/wp-json/wp/v2/pages/1006`,
  `${D}/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.laatjeogenlaseren.nl%2Fblog%2Fde-werking-van-je-ogen%2F`,
  `${D}/?rest_route=/wp/v2/pages/1006`,
  `${D}/wp-content/uploads/2025/05/Recover.avif`,
  `${D}/wp-content/uploads/2025/05/lensOK.avif`,
  `${D}/wp-content/themes/x/style.css`,
  `${D}/wp-admin/`,
  `${D}/wp-includes/js/x.js`,
  `${D}/xmlrpc.php`,
  `${D}/feed/`,
  `${D}/blog/feed`,
  `${D}/comments/feed/`,
  `${D}/brochure.pdf`,
  `${D}/foto.jpg`,
  `${D}/plaatje.avif`,
];
for (const u of RUIS) checkWaar(`geen pagina: ${u.replace(D, "")}`, isGeenPagina(u), "Dit adres hoort niet in de paginalijst te belanden.");

// ── Dit is WÉL een pagina, en moet dat blijven ──
// Bewust ook de randgevallen: een pad dat toevallig met "feed" begint, en een
// pagina met een streepje erin. Een te grove filter is net zo schadelijk als
// geen filter, want dan verdwijnt er stilletjes echt werk uit beeld.
const PAGINAS = [
  `${D}/`,
  `${D}/veelgestelde-vragen/`,
  `${D}/ben-ik-geschikt/jonger-dan-45-dichtbij-veraf/`,
  `${D}/blog/category/ooglaseren/`,
  `${D}/lensimplantaten/gratis-vooronderzoek/`,
  `${D}/privacy-policy/`,
  `${D}/nieuws/feed-inspiratie/`,
  `${D}/over-ons/team-json-de-vries/`,
  `${D}/behandelingen/lasik/?utm_source=nieuwsbrief`,
];
for (const u of PAGINAS) checkWaar(`wél een pagina: ${u.replace(D, "")}`, !isGeenPagina(u), "Dit is een echte pagina; de filter is te grof afgesteld.");

// ── En de zeef zit ook echt in de paginalijst zelf ──
// De vereniging van de vier bronnen is de plek waar de spiegel ontstaat. Dit is
// exact het geval van Nationaal Oogcentrum, in het klein.
const verenigd = verenigBronnen("www.laatjeogenlaseren.nl", {
  sitemap: [`${D}/`, `${D}/veelgestelde-vragen/`],
  gsc: [`${D}/wp-json/wp/v2/pages/1006`, `${D}/wp-content/uploads/2025/05/Recover.avif`, `${D}/ben-ik-geschikt/ouder-dan-60-klachten-veraf/`],
  ahrefs: [`${D}/wp-json/`],
  links: [`${D}/feed/`],
});
const paden = verenigd.map((r) => r.url.replace(D, ""));
checkWaar("de paginalijst houdt alleen echte pagina's over", verenigd.length === 3,
  `Gevonden: ${verenigd.length} regels (${paden.join(", ")}). Verwacht 3: de voorpagina, de FAQ en de keuzehulp-pagina.`);
checkWaar("de REST API staat er niet in", !paden.some((p) => p.includes("wp-json")), "");
checkWaar("de mediabestanden staan er niet in", !paden.some((p) => p.includes("wp-content")), "");
checkWaar("een echte pagina uit Search Console blijft wél staan", paden.some((p) => p.startsWith("/ben-ik-geschikt/")), "");

if (fouten) {
  console.error(`\n✗ Geen-pagina: ${fouten} punt(en) niet in orde.\n`);
  process.exit(1);
}
console.log(`\n✓ Geen-pagina: ${RUIS.length} machinekoppelingen geweerd, ${PAGINAS.length} echte pagina's behouden.`);

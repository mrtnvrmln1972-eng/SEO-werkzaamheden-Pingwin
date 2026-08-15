// Proef op de links in een mail vanuit een kaart.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Een aangevinkte link die niet in de mail belandt is de stilste fout die dit
// dashboard kent: de mail gaat weg, ziet er prima uit, en de ontvanger leest
// "zet deze tekst op de bijgevoegde link" zonder link. Dat is op 03-08-2026 echt
// gebeurd. Sindsdien plakt de route wat niet paste onderaan de mail, maar dat
// hing aan drie regexen in één routebestand, zonder dat iemand het narekende.
//
// Op 15-08-2026 kwam er een tweede eis bij: Maarten wil de links al zién terwijl
// hij de mail schrijft, met de volledige URL, zodat hij ze in een zin kan
// verwerken. Het venster zet daarom een regel "Naam: https://…" onderaan de
// tekst. Die vorm moet aan beide kanten hetzelfde zijn, anders staat er straks
// een kale URL van honderd tekens in de mail van de klant.
//
// Deze proef legt allebei vast.

import { readFileSync } from "fs";
import { join } from "path";
import { bouwMailHtml, linkRegel } from "../lib/mail-body";

let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const PAGINA = { label: "De pagina", url: "https://paulhoevenaars.nl/hovenier-uden/" };
const COPY = { label: "Copy: Paul-Hoevenaars-copy-hovenier-uden", url: "https://docs.google.com/document/d/abc123?usp=sharing&x=1" };
const DOMEIN = "paulhoevenaars.nl";

// ── 1. De regel die het venster onderaan zet, wordt één nette link ──
{
  const tekst = `Hoi Paul,\n\nDe nieuwe tekst staat klaar.\n\n${linkRegel(PAGINA)}\n${linkRegel(COPY)}`;
  const html = bouwMailHtml(tekst, [PAGINA, COPY], DOMEIN);
  checkWaar("de pagina-regel wordt een link met de naam als tekst",
    html.includes(`<a href="${PAGINA.url}">De pagina</a>`), html);
  checkWaar("de copy-regel wordt een link met de naam als tekst",
    html.includes(`<a href="${COPY.url}">`), html);
  checkWaar("de kale URL staat niet meer los in de mail",
    !html.includes(`: https://docs.google.com`), html);
  checkWaar("er staat geen link binnen een link",
    !/<a\b[^>]*>[^<]*<a\b/i.test(html), html);
}

// ── 2. Zet je de link zelf in een zin, dan blijft hij daar en wordt hij klikbaar ──
// En hij mag er dan NIET nog een keer onderaan bij komen; dat leest als dubbelop.
{
  const tekst = `Hoi,\n\nKun je deze tekst plaatsen op ${PAGINA.url} ? Graag deze week.`;
  const html = bouwMailHtml(tekst, [PAGINA], DOMEIN);
  checkWaar("de URL in de zin is klikbaar",
    html.includes(`<a href="${PAGINA.url}">${PAGINA.url}</a>`), html);
  checkWaar("de link komt er niet ook nog eens onderaan bij",
    (html.match(new RegExp(PAGINA.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 2, html);
}

// ── 3. REGRESSIE: een aangevinkte link verdwijnt nooit ──
// De tekst noemt het document niet en de URL staat er niet in. Dan hoort de link
// alsnog onderaan de mail te staan. Dit is de fout van 03-08-2026.
{
  const tekst = "Hoi Paul,\n\nZou je hier deze week naar willen kijken?";
  const html = bouwMailHtml(tekst, [PAGINA, COPY], DOMEIN);
  checkWaar("de pagina staat alsnog onderaan de mail", html.includes(PAGINA.url), html);
  checkWaar("de copy staat alsnog onderaan de mail", html.includes(COPY.url), html);
}

// ── 4. REGRESSIE: noemt de tekst de naam, dan hangt de link aan die naam ──
{
  const tekst = "Hoi Paul,\n\nDe nieuwe tekst staat in De pagina, kun je die overnemen?";
  const html = bouwMailHtml(tekst, [PAGINA], DOMEIN);
  checkWaar("de naam in de zin is de link geworden",
    html.includes(`<a href="${PAGINA.url}">De pagina</a>`), html);
}

// ── 4b. Élke vermelding van de naam wordt een link ──
// Het schrijfvenster toont die namen zelf al klikbaar. Zou de mail alleen de
// eerste linken, dan staat er in de verstuurde mail een dode naam onderaan
// terwijl hij in beeld nog een link was.
{
  const tekst = "Hoi Paul,\n\nZet de tekst uit De pagina erop.\n\nDe pagina";
  const html = bouwMailHtml(tekst, [PAGINA], DOMEIN);
  const aantal = (html.match(/<a href="https:\/\/paulhoevenaars\.nl\/hovenier-uden\/">De pagina<\/a>/g) || []).length;
  checkWaar("beide vermeldingen zijn een link", aantal === 2, `${aantal} gevonden in ${html}`);
}

// ── 4c. De naam van het document is de linktekst, nooit het Google Docs-adres ──
// Zo ziet de ontvanger "Copy: Paul-Hoevenaars-copy-hovenier-uden" en niet een
// adres met /document/d/… erin. Dit is wat het schrijfvenster ook toont.
{
  const tekst = `Hoi,\n\nDe tekst staat in ${COPY.label}.`;
  const html = bouwMailHtml(tekst, [COPY], DOMEIN);
  checkWaar("de naam staat als linktekst in de mail",
    html.includes(`>${COPY.label}</a>`), html);
  checkWaar("het kale documentadres staat nergens als tekst in beeld",
    !html.replace(/href="[^"]*"/g, "").includes("docs.google.com"), html);
}

// ── 5. REGRESSIE: een pad naar de site blijft klikbaar ──
{
  const html = bouwMailHtml("Hoi,\n\nHet gaat om /hovenier-uden/ op de site.", [], DOMEIN);
  checkWaar("een pad wordt een link naar de live pagina",
    html.includes(`<a href="https://paulhoevenaars.nl/hovenier-uden/">/hovenier-uden/</a>`), html);
}

// ── 6. REGRESSIE: de mail blijft een simpele mail ──
{
  const html = bouwMailHtml("Hoi,\n\n- eerste punt\n- tweede punt\n\nGroet, Maarten", [], DOMEIN);
  checkWaar("bullets worden een lijstje", html.includes("<ul>") && html.includes("<li>eerste punt</li>"), html);
  checkWaar("geen tabellen of kopjes in een mail", !/<table|<h[1-6]/i.test(html), html);
}

// ── 7. Een punt achter een URL hoort bij de zin, niet bij de link ──
{
  const html = bouwMailHtml(`Zie ${PAGINA.url}.`, [], DOMEIN);
  checkWaar("de punt valt buiten de link",
    html.includes(`<a href="${PAGINA.url}">${PAGINA.url}</a>.`), html);
}

// ── 8. Het schrijfvenster en de mail blijven op elkaar afgestemd ──
// De preview in "Mail vanuit deze kaart" zet de NAAM van het document in de
// tekst als klikbare link, en stuurt alleen die tekst mee; de mail hangt hier
// de adressen weer aan diezelfde namen. Zet het venster ooit weer een kaal
// adres in het tekstvak, dan klopt dat rijtje niet meer en ziet Maarten iets
// anders dan de ontvanger. Vandaar deze twee bewakingen op de bron.
{
  const venster = readFileSync(join(__dirname, "..", "app/admin/client/[slug]/MailUitKaart.tsx"), "utf8");
  checkWaar("het venster zet de naam van het document als linktekst",
    venster.includes("maakLink(l, l.label)"),
    "Zonder dit staat er weer een kaal Google Docs-adres in het schrijfvenster.");
  checkWaar("het venster stuurt de tekst mee, niet de opmaak",
    venster.includes("ref.current?.innerText"),
    "De mail wordt uit innerText opgebouwd; gaat dat naar innerHTML, pas dan lib/mail-body.ts mee aan.");
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);

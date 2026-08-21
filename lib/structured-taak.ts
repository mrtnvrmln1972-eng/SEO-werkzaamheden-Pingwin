// ═══════════════════════════════════════════════════════════
// WAT DE DEVELOPER KRIJGT BIJ SITE-BREDE STRUCTURED DATA
// ═══════════════════════════════════════════════════════════
// Eén bron voor de drie plekken waar dezelfde boodschap stond: de taak die naar
// de developer gaat, de mail die er direct achteraan gaat, en de deelbare pagina
// die de developer opent. Ze zeiden alle drie iets anders, en de taak zei het in
// één doorlopende lap tekst met twee kale webadressen erin.
//
// Wat er misging (21-08-2026, Bogard). De taaktekst was platte tekst met losse
// regeleindes. Het rijke tekstveld zette die tekst als HTML in beeld, en in HTML
// bestaat een regeleinde niet: alles plakte aan elkaar tot één blok van acht
// regels met twee volledige URL's erin. Maartens oordeel: "een brei aan woorden
// en letters die niemand wil lezen of kan lezen."
//
// En er stond echte onzin in. De plugin-detectie geeft bij een site zonder
// bekende SEO-plugin het label "handmatig/onbekend", en dat werd letterlijk in
// de zin geplakt: "het organisatie-schema dat handmatig/onbekend al op de
// homepage zet". Een label is geen onderwerp van een zin; daarom staat de zin
// hier per geval uitgeschreven.
//
// Vandaar dit bestand: de tekst is markdown (kopregel, opsomming, benoemde
// links) in plaats van een lap, hij wordt op één plek geschreven, en
// `proeven/structured-doorzetten.proef.ts` rekent na dat hij ook echt als
// kopjes, opsommingen en klikbare links op het scherm komt.
// ═══════════════════════════════════════════════════════════

/** De rich-results-test van Google; staat hier één keer. */
export const RICH_RESULTS_TEST = "https://search.google.com/test/rich-results";

export type PlaatsingsStand = {
  /** Het label uit de plugin-detectie ("Yoast SEO", "handmatig/onbekend", "geen"). */
  pluginLabel: string;
  /** Is er een organisatie-node met een @id gevonden om aan vast te knopen? */
  gekoppeld: boolean;
  /** Het @id van die node, als hij gevonden is. */
  anchorId?: string;
};

/** Herkennen we een echte plugin, of is het schema met de hand neergezet? */
function echtePlugin(label: string): boolean {
  const l = (label || "").trim().toLowerCase();
  return !!l && l !== "geen" && l !== "handmatig/onbekend";
}

/**
 * Wat de developer moet weten over het plaatsen: staat er al organisatie-schema
 * op de homepage, en knoopt dit blok daaraan vast of staat het op zichzelf?
 *
 * Vier gevallen, vier zinnen. Nooit een label midden in een zin plakken.
 */
export function plaatsingsZin({ pluginLabel, gekoppeld, anchorId }: PlaatsingsStand, opties: { markdown?: boolean } = {}): string {
  // Op de deelpagina van de developer komt deze zin als gewone tekst in beeld,
  // niet door de markdown-renderer. Daar horen dus geen sterretjes en backticks
  // in te staan; het is dezelfde zin, alleen zonder opmaaktekens.
  const md = opties.markdown !== false;
  const nadruk = (t: string) => (md ? `**${t}**` : t);
  const code = (t: string) => (md ? `\`${t}\`` : t);
  const bron = echtePlugin(pluginLabel) ? pluginLabel : "";
  const vast = "Naam, adres, telefoon en openingstijden blijven daarvandaan komen; hier staat alleen bij wat daar niet in zit (vestigingen, reviewcijfer, KVK en BTW, sociale profielen). Plaats dit blok ernaast en wijzig niets aan de bestaande code.";
  if (gekoppeld && anchorId) {
    const waar = bron
      ? `het organisatie-schema dat ${bron} al op de homepage zet`
      : "het organisatie-schema dat al met de hand op de homepage staat";
    return `Dit blok is ${nadruk("aanvullend")} op ${waar} en knoopt zich aan hetzelfde @id (${code(anchorId)}). ${vast}`;
  }
  if (bron) {
    return `${bron} staat al op de site, maar we konden daar geen organisatie-@id in vinden. Dit is daarom een zelfstandig blok: controleer voor het plaatsen even of er niets dubbel komt te staan.`;
  }
  return "Er staat nog geen organisatie-schema op de homepage; dit is dus het volledige, zelfstandige blok.";
}

export type DeelLinks = {
  /** De .json in Drive (openbaar leesbaar met de link). */
  jsonLink: string;
  /** De deelbare leespagina met de bedrijfsgegevens plus deze code. */
  devUrl?: string;
};

/**
 * De opdracht zoals hij in de taak komt te staan: markdown, dus kopregels,
 * een opsomming met benoemde links, en geen kaal webadres in de lopende tekst.
 *
 * Bewust kort. Alles wat de developer verder nodig heeft (alle bedrijfsgegevens,
 * de code met een kopieerknop) staat achter de tweede link, en dat is één pagina
 * die hij zonder inloggen opent.
 */
export function sitewideToelichting(links: DeelLinks, stand: PlaatsingsStand): string {
  const regels: string[] = [
    "**Wat er moet gebeuren:** zet het onzichtbare identiteitsblok (JSON-LD) op élke pagina, in de `<head>`, als los `<script type=\"application/ld+json\">`-blok naast wat er al staat.",
    "",
    `- [De code als JSON-bestand](${links.jsonLink}) (Drive, iedereen met de link kan hem openen)`,
  ];
  if (links.devUrl) {
    regels.push(`- [Alle bedrijfsgegevens plus deze code op één pagina](${links.devUrl}) (deelbare link, geen inlog nodig)`);
  }
  regels.push("", plaatsingsZin(stand), "", `**Daarna controleren:** haal een pagina door [de rich results-test van Google](${RICH_RESULTS_TEST}).`);
  return regels.join("\n");
}

/**
 * Dezelfde boodschap als mail. Bewust simpeler dan de taak: een mail hoort een
 * aanhef, korte alinea's en gewone opsommingspunten te hebben, geen kopjes en
 * geen tabellen (de mailregel in CLAUDE.md).
 *
 * Wat er bewust NIET meer in staat: een verwijzing naar /admin/developer. Dat
 * scherm zit achter een inlog, dus voor een externe sitebouwer is het een deur
 * die niet opengaat. Beide links hierboven kan hij wél openen.
 */
export function sitewideMailHtml(naam: string, links: DeelLinks): string {
  const wie = naam ? ` ${naam}` : " deze klant";
  // De volledige adressen staan er met opzet uitgeschreven: "Kopieer mailtekst"
  // haalt de opmaak eruit, en dan blijft van een link met een mooie naam alleen
  // die naam over en is het adres weg. Kort gehouden zodat de mail toch in één
  // scherm past: één zin uitleg boven de twee adressen in plaats van bij elk
  // adres een eigen regel.
  const punten = [
    `<li>De code (JSON): <a href="${links.jsonLink}">${links.jsonLink}</a></li>`,
    links.devUrl
      ? `<li>Alle bedrijfsgegevens plus deze code, alleen-lezen: <a href="${links.devUrl}">${links.devUrl}</a></li>`
      : "",
  ].filter(Boolean).join("");
  const test = RICH_RESULTS_TEST.replace(/^https?:\/\//, "");
  return [
    "<p>Hoi,</p>",
    `<p>Voor${wie} staat de structured data klaar: onzichtbare code (schema.org) die Google en AI-zoekmachines vertelt wie dit bedrijf is en wat het doet. Plakken in de &lt;head&gt; van elke pagina, als los blok naast wat er al staat; niets aan bestaande plugin-code wijzigen.</p>`,
    `<ul>${punten}</ul>`,
    `<p>Na plaatsing kun je het controleren met <a href="${RICH_RESULTS_TEST}">${test}</a>.</p>`,
    "<p>Alvast bedankt!</p>",
    "<p>Groet,<br>Maarten</p>",
  ].join("");
}

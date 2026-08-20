// ═══════════════════════════════════════════════════════════
// DE LINKJES UIT EEN TAAKKAART (één plek waar ze verzameld worden)
// ═══════════════════════════════════════════════════════════
// Wat er misging (20-08-2026, taak "Locaties aanhaken" bij Nationaal Oogcentrum):
// in de aantekeningen van de kaart stond het hele verhaal. Een link naar het
// stappenplan, een uitklapper met vijf vestigingen (adressen, mailadressen, een
// link naar de locatie), en onderaan een link naar de bespreekpunten. Ging die
// taak naar de developer, dan kreeg hij: de titel, de pagina en de documenten
// uit de pijplijn. Geen enkele van die links. En de mail die eruit kwam was
// "Kun jij de eerste vijf vestigingen aanmaken?", zonder één adres erbij.
//
// De aantekeningen zijn het enige veld op een kaart dat geen enkele automatische
// stap aanraakt: wat Maarten daar zet, zet hij er bewust neer. Juist dát veld
// bleef achter bij het doorzetten. Deze module haalt de links eruit, zodat ze
// meegaan naar de developerlijst, in het doorzet-venster te kiezen zijn en in de
// mail terechtkomen.
//
// Eén bron: de developerlijst, het doorzet-venster en de mail lezen hier. Nooit
// ergens een tweede regex op HTML; die lopen uiteen en dan gaat er in de ene weg
// wél een link mee en in de andere niet.
// ═══════════════════════════════════════════════════════════

export type KaartLink = {
  /** De linktekst zoals hij op de kaart staat ("stappenplan", "bespreekpunten"). */
  label: string;
  url: string;
};

/**
 * Wat telt als een link die meegaat: iets dat je kunt ópenen. Een document, een
 * pagina, een locatie.
 *
 * **Nadrukkelijk geen mailadressen en telefoonnummers.** De eerste versie pakte
 * die wél, en het resultaat was meteen te zien: het mailvenster kreeg zeven
 * vinkjes waarvan er vijf een mailadres van een vestiging waren, en onderaan de
 * mail stond een rijtje "oosterhof@oogwereld.nl, nijmegen@novio-oogzorg.nl,
 * gorinchem@novio-oogzorg.nl…". Maartens oordeel: "die heeft niet 96 e-mails
 * nodig; die adressen staan al in de context die meekomt."
 *
 * En dat klopt: de aantekeningen gaan in hun geheel mee (`notitieTekst`), dus
 * daar staan die adressen gewoon in, op de plek waar ze horen, bij de vestiging
 * waar ze bij horen. Als losse link zijn ze alleen ruis die de échte stukken
 * (het stappenplan, de bespreekpunten, de locatie) wegdrukt.
 */
function bruikbaar(href: string): boolean {
  const h = href.trim();
  if (!h || h.startsWith("#")) return false;
  return /^https?:\/\//i.test(h);
}

const ENTITEITEN: [RegExp, string][] = [
  [/&amp;/g, "&"], [/&quot;/g, '"'], [/&#39;/g, "'"], [/&lt;/g, "<"], [/&gt;/g, ">"], [/&nbsp;/g, " "],
];
function ontsnap(s: string): string {
  let uit = s;
  for (const [van, naar] of ENTITEITEN) uit = uit.replace(van, naar);
  return uit;
}

/** Tekst uit een stuk HTML, met de witruimte samengetrokken. */
function alsTekst(html: string): string {
  return ontsnap(String(html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Alle stukken uit een kaarttekst of aantekeningen die je kunt openen.
 *
 * Werkt op allebei de vormen die op een kaart voorkomen: opgemaakte HTML (wat
 * het rijke tekstveld opslaat) en platte tekst met kale webadressen erin. Een
 * kaal adres in de tekst is net zo goed een stuk waar de developer heen moet;
 * dat viel er anders tussenuit omdat er geen `<a>` omheen stond.
 *
 * Dubbele adressen komen er maar één keer uit, en het langste (dus meest
 * zeggende) label wint: "Elzentlaan 143, 5611 LL Eindhoven" is bruikbaarder dan
 * "hier".
 */
export function kaartLinks(...stukken: (string | null | undefined)[]): KaartLink[] {
  const perUrl = new Map<string, string>();
  const zet = (url: string, label: string) => {
    const u = url.trim().replace(/[.,;:)]+$/, "");
    if (!bruikbaar(u)) return;
    const l = (label || "").trim() || u;
    const bestaand = perUrl.get(u);
    // Het meest zeggende label wint, maar een label dat de URL zelf is verliest
    // altijd van een echt woord.
    if (bestaand === undefined) perUrl.set(u, l);
    else if (bestaand === u && l !== u) perUrl.set(u, l);
    else if (l !== u && l.length > bestaand.length) perUrl.set(u, l);
  };

  for (const stuk of stukken) {
    const html = String(stuk || "");
    if (!html.trim()) continue;

    // 1. Echte links, met hun linktekst als label.
    const ankers = html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const m of ankers) zet(ontsnap(m[1]), alsTekst(m[2]));

    // 2. Kale adressen in de lopende tekst. Alleen buiten de ankers hierboven,
    //    anders komt dezelfde link twee keer langs met een slechter label.
    const zonderAnkers = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ");
    const kaal = alsTekst(zonderAnkers);
    for (const m of kaal.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) zet(m[0], m[0]);
  }

  return [...perUrl.entries()].map(([url, label]) => ({ label, url }));
}

/**
 * De aantekeningen als leesbare tekst, begrensd op lengte.
 *
 * Voor de mail: die hoort simpel te blijven (aanhef, korte alinea's, geen
 * tabellen), dus daar gaat de tekst heen en niet de opmaak. Op het scherm van de
 * developer gaat de HTML zelf mee, want daar mag het er wél uitzien zoals op de
 * kaart.
 */
export function notitieTekst(html: string | null | undefined, max = 4000): string {
  const ruw = String(html || "");
  if (!ruw.trim()) return "";
  // Blokken worden regelovergangen, zodat een opsomming een opsomming blijft in
  // plaats van één doorlopende zin.
  const metRegels = ruw
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ");
  const tekst = ontsnap(metRegels.replace(/<[^>]*>/g, ""))
    .split("\n").map((r) => r.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
  return tekst.length > max ? tekst.slice(0, max).replace(/\s+\S*$/, "") + "…" : tekst;
}

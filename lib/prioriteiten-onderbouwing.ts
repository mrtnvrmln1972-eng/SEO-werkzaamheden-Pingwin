/**
 * WAAROM IS DEZE KANS INTERESSANT? OP ÉÉN PLEK
 * ════════════════════════════════════════════
 * Dezelfde uitleg komt op drie plaatsen terug: als reden onder een regel op het
 * prioriteitenscherm, als achtergrond op de weekplan-kaart, en als blok in de mail
 * naar de klant. Die drie mogen nooit uiteen gaan lopen, dus staan ze hier bij
 * elkaar (de brein-les van 2 augustus).
 *
 * De toon is bewust die van een mail aan de klant en niet die van een SEO-rapport:
 * de klant moet kunnen zien dát er naar kansen gezocht wordt en wát we gaan doen.
 * Geen jargon, geen scores, geen tier-namen. Cijfers alleen waar ze iets betekenen,
 * en altijd met de slag om de arm die erbij hoort: een verwachting is geen belofte.
 *
 * Bewust zonder server-afhankelijkheden (geen fs, geen database), want het scherm
 * draait in de browser en gebruikt dit bestand ook.
 */

import { categorieVan } from "./prioriteiten-categorie";

export type OnderbouwRegel = {
  type: string;
  titel: string;
  url: string;
  zoekwoord: string;
  maandvolume: number;
  huidigePositie: number;
  targetPositie: number;
  intentie?: string;
  effort: number;
  timeToEffect: number;
  confidence: number;
  extraKlikkenPerMaand?: number;
  rationale?: string;
  bron?: string;
};

const getal = (n?: number) => (n != null && Number.isFinite(n) ? new Intl.NumberFormat("nl-NL").format(Math.round(n)) : "");

/** Wat wil iemand die dit intikt? In gewone taal, want "transactional" zegt de klant niets. */
export function zoekerTekst(intentie?: string): string {
  switch (intentie) {
    case "transactional": return "iemand die dit intikt is er klaar voor om een offerte of prijs op te vragen";
    case "lokaal-commercial": return "iemand die dit intikt zoekt een bedrijf in de eigen omgeving";
    case "commercial": return "iemand die dit intikt is aan het vergelijken en kiezen";
    case "informational": return "iemand die dit intikt oriënteert zich nog en koopt meestal niet meteen";
    case "navigational": return "iemand die dit intikt zoekt gericht naar jullie of naar een bepaalde pagina";
    default: return "wat deze zoeker precies wil is uit het zoekwoord alleen niet af te lezen";
  }
}

/** Hoe hard is dit? Zelfde drie woorden als op het scherm. */
export function zekerheidTekst(confidence: number): string {
  return confidence >= 0.9 ? "hard gemeten" : confidence >= 0.6 ? "afgeleid uit de cijfers" : "een schatting";
}

/** Hoe lang duurt het voordat je er iets van ziet? */
function doorlooptijd(tte: number): string {
  if (tte <= 1) return "een tot twee weken";
  if (tte === 2) return "twee tot zes weken";
  if (tte === 3) return "één tot drie maanden";
  if (tte === 4) return "drie tot zes maanden";
  return "een half jaar of langer";
}

/** Wat gaan we concreet doen? Per soort werk, in de taal van de klant. */
function watWeDoen(type: string, nieuw: boolean, pad: string): string {
  switch (type) {
    case "striking_distance":
      return "We scherpen deze pagina aan op dit onderwerp: de kop, de tussenkopjes en de tekst, plus de titel die in Google staat. De pagina doet al mee, hij mist alleen net wat om in de top vijf te komen.";
    case "verouderde_topper":
      return "We halen deze pagina weer bij de tijd. Hij stond eerder hoger, dus de basis is er; meestal is een concurrent er overheen gegaan met een completer verhaal.";
    case "content_gap":
      return nieuw
        ? `We maken hier een eigen pagina voor${pad ? ` (voorstel voor het adres: ${pad})` : ""}. Eerst kijken we wat de best scorende pagina's op dit onderwerp behandelen, daarna schrijven we een pagina die dat compleet en beter doet.`
        : "We bouwen dit onderwerp uit op de pagina die er het dichtst bij ligt, zodat de bestaande pagina sterker wordt in plaats van dat er een concurrent van binnen de site bij komt.";
    case "ctr_underperform":
      return "We herschrijven de titel en de omschrijving die in Google onder jullie link staan. De pagina wordt al goed getoond, alleen klikken mensen te weinig door. Dit is klein werk met snel effect.";
    case "cannibalisatie":
      return "Er zijn meerdere pagina's die om hetzelfde zoekwoord strijden, waardoor Google niet weet welke hij moet laten zien. We kiezen de sterkste en laten de andere daarnaartoe verwijzen.";
    case "interne_links":
      return "We leggen vanaf sterke pagina's binnen de site meer verwijzingen naar deze pagina. Dat is de goedkoopste manier om een pagina omhoog te duwen: er hoeft geen nieuwe tekst voor geschreven te worden.";
    case "schema_gap":
      return "We voegen de achtergrondgegevens toe die Google en AI-assistenten uitlezen (wie jullie zijn, wat jullie aanbieden, waar jullie werken). Dat helpt om als bron genoemd te worden.";
    case "backlinks":
      return "Er verwijst een andere website naar een adres dat niet meer bestaat. Die waarde loopt nu weg; met een omleiding vangen we hem op.";
    case "aeo":
      return "We zorgen dat dit onderwerp op de site zo beantwoord wordt dat AI-assistenten jullie als bron kunnen aanhalen.";
    case "featured_snippet":
      return "We zetten er een kort, direct antwoord bovenaan de pagina, zodat de kans groeit dat Google jullie in het antwoordblok bovenaan zet.";
    default:
      return "We pakken dit op de pagina zelf op.";
  }
}

const hoofdletter = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** Alleen de feiten: waar wordt op gezocht en waar staan we nu. */
function feitenZin(r: OnderbouwRegel): string {
  const zoekt = r.maandvolume > 0 ? `Er wordt ongeveer ${getal(r.maandvolume)} keer per maand gezocht op "${r.zoekwoord}"` : `Op "${r.zoekwoord}"`;
  // Bij een klikdoor-kans is de positie niet het probleem: de pagina wordt al
  // getoond, er wordt alleen te weinig op geklikt. Dat is een ander verhaal, en
  // "net buiten waar geklikt wordt" zou de klant op het verkeerde been zetten.
  if (r.type === "ctr_underperform") {
    return `${zoekt}, en jullie worden daarbij al getoond${r.huidigePositie ? ` op plek ${r.huidigePositie}` : ""}. Alleen wordt er te weinig op geklikt.`;
  }
  const staat = r.huidigePositie
    ? `en jullie staan op plek ${r.huidigePositie}, net buiten waar geklikt wordt`
    : "en er is nog geen pagina van jullie die daar echt over gaat";
  return `${zoekt} ${staat}.`;
}

/** Eén zin voor onder de regel op het scherm: waarom staat dit hier? */
export function kortOm(r: OnderbouwRegel): string {
  return `${feitenZin(r)} ${hoofdletter(zoekerTekst(r.intentie))}.`;
}

/**
 * De interne reden meesturen mag alleen als het een echte zin is. De kansenlijst
 * levert steekwoorden aan ("Directe koopintentie, past bij totaalconcept Paul"),
 * en dat is een notitie voor onszelf, geen tekst die je een klant voorlegt.
 */
function bruikbareReden(rationale?: string): string {
  const t = (rationale || "").trim();
  if (t.length < 45 || !/[.!?]$/.test(t)) return "";
  return t;
}

/**
 * Het volledige verhaal, als opgemaakt blok. Gaat naar het scherm (uitklapbaar),
 * naar de weekplan-kaart en naar de mail aan de klant, zodat er nooit drie
 * verschillende versies van dezelfde uitleg ontstaan.
 */
/** Een pagina-adres als leesbare naam: "/hovenier-oss/" wordt "Hovenier Oss". */
export function paginaNaam(url: string): string {
  const laatste = (url || "").replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "").split("/").filter(Boolean).pop() || "";
  if (!laatste) return "de homepage";
  return laatste.replace(/[-_]+/g, " ").replace(/\.\w+$/, "").split(" ").filter(Boolean)
    .map((w) => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

/**
 * Het mailonderwerp. Bewust wat we gáán doen en niet wat we zagen: dit is de regel
 * die de klant in zijn inbox ziet staan. Hier stond eerder geen eigen onderwerp,
 * waardoor het mailvenster het eerste kopje van het blok pakte en er letterlijk
 * "Wat we zagen" in de onderwerpregel belandde.
 */
function mailOnderwerpVan(r: OnderbouwRegel, nieuw: boolean): string {
  const kw = r.zoekwoord ? `"${r.zoekwoord}"` : "dit onderwerp";
  const pg = r.url ? paginaNaam(r.url) : "";
  switch (r.type) {
    case "content_gap":
      return nieuw ? `Voorstel: een nieuwe pagina voor ${kw}` : `${kw} toevoegen aan de pagina ${pg}`;
    case "striking_distance":
      return `Kans om hoger te komen op ${kw}`;
    case "verouderde_topper":
      return `${kw} terugwinnen in Google`;
    case "ctr_underperform":
      return `Meer bezoekers uit ${pg || kw}, zonder hoger te hoeven staan`;
    case "cannibalisatie":
      return `Pagina's die elkaar in de weg zitten op ${kw}`;
    case "interne_links":
      return `${pg || kw} versterken vanuit de rest van de site`;
    case "schema_gap":
      return `Achtergrondgegevens toevoegen aan ${pg || "de site"}`;
    case "backlinks":
      return `Een verwijzing van buitenaf die nu doodloopt`;
    case "aeo":
      return `Beter zichtbaar worden in AI-antwoorden op ${kw}`;
    case "featured_snippet":
      return `Kans op het antwoordblok bovenaan voor ${kw}`;
    default:
      return `Kans gesignaleerd rond ${kw}`;
  }
}

export function onderbouwing(r: OnderbouwRegel, opties: { klantnaam?: string; pad?: string } = {}): {
  kort: string;
  /** De vier stukken los, zodat het scherm er kolommen van kan maken. */
  secties: { kop: string; tekst: string }[];
  blokMd: string;
  mailOnderwerp: string;
  mailTaak: string;
} {
  const cat = categorieVan(r.type);
  const nieuw = !r.url;
  const pad = opties.pad || r.url || "";
  const winst = r.extraKlikkenPerMaand && r.extraKlikkenPerMaand >= 1
    ? `Als dat lukt, verwachten we hier ongeveer ${getal(r.extraKlikkenPerMaand)} extra bezoekers per maand. Dat is ${zekerheidTekst(r.confidence)} en een verwachting, geen belofte.`
    : "";

  const reden = bruikbareReden(r.rationale);
  const waarom: string[] = [];
  if (r.type === "ctr_underperform") {
    waarom.push(`Het bereik is er al; er valt hier dus winst te halen zonder dat de pagina hoger hoeft te komen. Dat maakt dit een van de goedkoopste verbeteringen die er zijn.`);
  } else if (r.huidigePositie && r.huidigePositie <= 20) {
    waarom.push(`Deze pagina doet al mee in Google. Iets omhoog duwen wat er al staat kost bijna altijd minder werk dan met iets nieuws beginnen, en het effect komt sneller.`);
  } else if (nieuw) {
    waarom.push(`Er is aantoonbaar vraag naar dit onderwerp, maar er is nog geen pagina die erop mikt. Die zoekvraag gaat nu naar een ander.`);
  }
  waarom.push(r.intentie === "informational"
    ? `${hoofdletter(zoekerTekst(r.intentie))}. Dit bezoek levert dus niet meteen een aanvraag op, maar het brengt ons wel vroeg in beeld.`
    : `${hoofdletter(zoekerTekst(r.intentie))}, dus dit is bezoek dat ergens toe kan leiden.`);
  waarom.push(`Het werk is ${r.effort <= 3 ? "klein" : r.effort <= 6 ? "middelgroot" : "groot"} en het duurt naar verwachting ${doorlooptijd(r.timeToEffect)} voordat er iets van te zien is.`);

  // De vier stukken als losse secties. Het scherm zet ze naast elkaar in kolommen,
  // de mail plakt ze onder elkaar met kopjes. Eén bron, twee vormen.
  const secties = [
    { kop: "Wat we zagen", tekst: [feitenZin(r), reden].filter(Boolean).join(" ") },
    { kop: "Waarom dit de moeite waard is", tekst: waarom.join(" ") },
    { kop: "Wat we gaan doen", tekst: watWeDoen(r.type, nieuw, pad) },
    ...(winst ? [{ kop: "Wat het kan opleveren", tekst: winst }] : []),
  ];

  return {
    kort: kortOm(r),
    secties,
    blokMd: secties.map((s) => `### ${s.kop}\n\n${s.tekst}`).join("\n\n"),
    mailOnderwerp: mailOnderwerpVan(r, nieuw),
    mailTaak: [
      `Laat ${opties.klantnaam || "de klant"} weten dat we bij het doorlichten van de site een kans hebben gevonden en dat we die oppakken.`,
      `Het gaat om ${cat.naam.toLowerCase()}${pad ? ` voor ${pad}` : ""} rond het zoekwoord "${r.zoekwoord}".`,
      `Kort en positief: dit hebben we gezien, dit betekent het, hier gaan we mee aan de slag. Geen vragen stellen, geen actie vragen van de klant.`,
    ].join(" "),
  };
}

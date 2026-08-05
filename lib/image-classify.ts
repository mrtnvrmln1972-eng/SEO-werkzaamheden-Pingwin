// ═══════════════════════════════════════════════════════════
// AFBEELDINGEN INDELEN: welke moet écht uniek zijn per pagina?
// ═══════════════════════════════════════════════════════════
// De werklijst zette eerst élke afbeelding die op meer dan één pagina stond in
// het lijstje "maak uniek". Daar viel het logo en de vaste header dus ook onder,
// met een waslijst van tientallen pagina's erachter. Dat is verkeerd advies aan
// de sitebouwer: een logo hoort juist overal hetzelfde te zijn.
//
// Deze module beantwoordt per afbeelding drie vragen:
//   1. Heeft hij een alt-tekst nodig?  (decoratief niet: leeg alt is dan goed)
//   2. Moet hij uniek zijn per pagina? (alleen echte contentfoto's)
//   3. Mogen wij hem doorvoeren?       (alles behalve "moet nog uniek worden")
//
// Pure functies, geen database en geen netwerk, zodat de indeling overal
// hetzelfde uitpakt (motor, controle en scherm).
// ═══════════════════════════════════════════════════════════

export type ImageSoort = "sitebreed" | "gedeeld" | "uniek" | "decoratief";

export type ImageOordeel = {
  soort: ImageSoort;
  moetUniek: boolean;      // moet de sitebouwer hem per pagina vervangen?
  altNodig: boolean;       // heeft hij een beschrijvende alt-tekst nodig?
  reden: string;           // korte uitleg in gewone taal, komt in beeld
};

/** Vanaf dit aandeel van de gemeten pagina's noemen we het een vast onderdeel. */
export const SITEBREED_AANDEEL = 0.7;

/** Namen die vrijwel altijd een vast onderdeel van de site aanduiden. */
const VAST_ONDERDEEL = /(logo|favicon|avatar|keurmerk|badge|banner|header|footer|vlag|flag|sticker|zegel|award|partner|betaal|payment|ideal|klarna|social|facebook|instagram|linkedin|youtube|whatsapp|watermerk|briefpapier)/;

/** Namen die vrijwel altijd puur versiering zijn; die horen een leeg alt te krijgen. */
const VERSIERING = /(spacer|pixel|divider|separator|scheiding|arrow|pijl|chevron|bullet|ornament|pattern|patroon|shape|blob|swirl|curve|golf|dots?|stippel|lijn(tje)?|line|quote|aanhaling|placeholder|dummy|transparant|blank)/;

/** Mappen buiten de mediabibliotheek: thema- en plugin-assets zijn vaste onderdelen. */
const THEMA_MAP = /\/(themes?|plugins?|assets|static|dist|build|img|images|icons?)\//;
const MEDIABIBLIOTHEEK = /\/(uploads|media|bestanden)\//;

/** Haalt de bestandsnaam zonder formaatsuffix uit een naam of URL. */
export function normFile(f: string): string {
  return (f || "").toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
}

export type ClassifyInput = {
  file: string;          // bestandsnaam (mag onbewerkt zijn)
  src?: string;          // volledige afbeeldings-URL, als die bekend is
  paginas: number;       // op hoeveel gemeten pagina's staat hij
  totaalPaginas: number; // hoeveel pagina's zijn er in totaal gemeten
};

/**
 * Bepaalt het soort van één afbeelding. Volgorde is bewust: versiering eerst
 * (die hoeft überhaupt geen alt), dan vaste onderdelen, dan pas dubbel gebruik.
 */
export function classifyImage(input: ClassifyInput): ImageOordeel {
  const naam = normFile(input.file);
  const src = (input.src || "").toLowerCase();
  const ext = (naam.split(".").pop() || "").toLowerCase();
  const paginas = Math.max(0, input.paginas);
  const totaal = Math.max(1, input.totaalPaginas);
  const aandeel = paginas / totaal;

  // 1. Puur versiering: een leeg alt-attribuut is hier het juiste antwoord.
  //    Bewust smal gehouden: een logo als "decoratief" bestempelen zou een
  //    echte SEO-fout zijn, andersom kost het alleen een regel te veel.
  const versieringNaam = VERSIERING.test(naam);
  const iconSvg = ext === "svg" && /(icon|icoon|ico[-_]|symbol)/.test(naam);
  if (versieringNaam || iconSvg) {
    return { soort: "decoratief", moetUniek: false, altNodig: false, reden: "versiering, een leeg alt-veld is hier juist goed" };
  }

  // 2. Vast onderdeel van de site: logo, header, footer, keurmerk, icoonset.
  //    Eén goede alt-tekst volstaat; uniek maken slaat nergens op.
  const uitThema = !!src && THEMA_MAP.test(src) && !MEDIABIBLIOTHEEK.test(src);
  const overalOpDeSite = paginas >= 2 && aandeel >= SITEBREED_AANDEEL;
  if (overalOpDeSite || VAST_ONDERDEEL.test(naam) || uitThema || (ext === "svg" && paginas >= 2)) {
    const reden = overalOpDeSite
      ? `vast onderdeel, staat op ${paginas} van de ${totaal} pagina's`
      : uitThema ? "vast onderdeel, hoort bij het thema van de site"
      : ext === "svg" ? "vast onderdeel, een icoon of logo"
      : "vast onderdeel, te zien aan de bestandsnaam";
    return { soort: "sitebreed", moetUniek: false, altNodig: true, reden };
  }

  // 3. Echte contentfoto die op een handvol pagina's terugkomt. Alleen deze
  //    moet uniek worden: de alt hangt in WordPress aan de foto zelf en klopt
  //    dus maar op één van die pagina's.
  if (paginas >= 2) {
    return { soort: "gedeeld", moetUniek: true, altNodig: true, reden: `zelfde foto op ${paginas} pagina's` };
  }

  // 4. Staat maar op één pagina: alt-tekst kan er direct op.
  return { soort: "uniek", moetUniek: false, altNodig: true, reden: "staat op één pagina" };
}

/** Labeltje voor in beeld, per soort. */
export const SOORT_LABEL: Record<ImageSoort, string> = {
  sitebreed: "Vast onderdeel",
  gedeeld: "Moet uniek worden",
  uniek: "Unieke foto",
  decoratief: "Decoratief",
};

/** Een door een mens gezette keuze wint altijd van de automatische indeling. */
export function pasHandmatigToe(oordeel: ImageOordeel, keuze: ImageSoort | null): ImageOordeel {
  if (!keuze || keuze === oordeel.soort) return oordeel;
  const basis = classifyHandmatig(keuze);
  return { ...basis, reden: `${basis.reden} (door Pingwin ingesteld)` };
}

function classifyHandmatig(soort: ImageSoort): ImageOordeel {
  switch (soort) {
    case "sitebreed": return { soort, moetUniek: false, altNodig: true, reden: "vast onderdeel van de site" };
    case "gedeeld": return { soort, moetUniek: true, altNodig: true, reden: "moet per pagina uniek worden" };
    case "decoratief": return { soort, moetUniek: false, altNodig: false, reden: "versiering, leeg alt-veld is goed" };
    default: return { soort: "uniek", moetUniek: false, altNodig: true, reden: "staat op één pagina" };
  }
}

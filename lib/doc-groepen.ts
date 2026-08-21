// ═══════════════════════════════════════════════════════════
// TWEE DOCUMENTEN VAN HETZELFDE SOORT ZIJN NIET VANZELF TWEE VERSIES
// ═══════════════════════════════════════════════════════════
// Het documentenblok van een taak ging ervan uit: liggen er twee stukken copy,
// dan is de tweede een nieuwe versie van de eerste, dus wijs aan welke geldt. Bij
// een klant die zijn tekst terugstuurt klopt dat. Bij een taak waarin twee
// verschillende projecten zitten (twee blogs, twee pagina's) klopt er niets van:
// je krijgt een keuze voorgelegd die niet bestaat, en welke van de twee je ook
// aanvinkt, de andere lijkt daarmee vervallen. Maartens woorden op 19-08-2026:
// "het zijn gewoon twee verschillende projecten, die laatste versie verificatie
// is hier überhaupt niet aan de orde".
//
// De vraag "is dit een nieuwe versie of een los stuk" is te beantwoorden met wat
// er al is: de naam. "Strak natuurzwembad in IJsselstein" en "Natuurlijke
// zwemvijver in Zeeland" delen geen enkel woord dat ertoe doet; "Copy hovenier
// Etten-Leur" en "Copy hovenier Etten-Leur (klantversie)" delen alles.
//
// De vergissing valt bewust zacht uit. Zien we ze als losse stukken, dan geldt
// elk stuk gewoon en vraagt niemand iets; zien we ze als versies, dan verschijnt
// het vinkje. Het vinkje verdwijnt nooit helemaal: je kunt altijd zelf aanwijzen
// welke geldt.
// ═══════════════════════════════════════════════════════════

/** Woorden die niets zeggen over het ONDERWERP van een document. */
const GEEN_ONDERWERP = new Set([
  "copy", "analyse", "blauwdruk", "document", "documenten", "versie", "versies", "klantversie",
  "concept", "definitief", "final", "def", "kopie", "nieuw", "nieuwe", "oud", "oude", "def2",
  "pingwin", "intern", "extern", "docx", "pdf", "ondersteunend", "aan", "voor", "van", "met",
  "het", "een", "de", "en", "of", "op", "bij", "over", "naar", "dat", "die", "deze", "zijn",
]);

/** De woorden waar het in een documentnaam echt om gaat. */
export function onderwerpWoorden(naam: string): string[] {
  return (naam || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")            // bestandsextensie
    .replace(/\(.*?\)/g, " ")                    // "(klantversie)", "(ondersteunend aan /pad/)"
    .replace(/\bv\d+\b/g, " ")                   // v2, v3
    .replace(/\b\d{1,4}([-/]\d{1,2}){0,2}\b/g, " ") // datums en losse cijfers
    .replace(/[^a-z0-9À-ɏ]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !GEEN_ONDERWERP.has(w));
}

/**
 * Gaan deze twee documenten over hetzelfde? Ja als ze genoeg woorden delen.
 *
 * De drempel is bewust laag (de helft van het kortste rijtje, en minstens één
 * gedeeld woord): een klantversie heet vrijwel altijd bijna hetzelfde als wat we
 * stuurden, terwijl twee losse projecten in de praktijk niets delen. Weet je het
 * van geen van beide zeker (allebei zonder bruikbare woorden), dan zeggen we
 * "hetzelfde", want dat is de oude situatie en die vraagt hooguit iets te veel.
 */
export function zelfdeOnderwerp(naamA: string, naamB: string): boolean {
  const a = new Set(onderwerpWoorden(naamA));
  const b = new Set(onderwerpWoorden(naamB));
  if (!a.size || !b.size) return true;
  let gedeeld = 0;
  for (const w of a) if (b.has(w)) gedeeld++;
  const kleinste = Math.min(a.size, b.size);
  return gedeeld >= Math.max(1, Math.ceil(kleinste / 2));
}

export type Groepeerbaar = {
  id: number; kind: string; naam: string;
  /** Uit welk document dit voortkomt (0 of leeg = uit niets). Zie hieronder. */
  bronId?: number;
};

/**
 * Per document de groep waar het in valt: hetzelfde soort én hetzelfde
 * onderwerp. Geeft per document-id een groepsleutel terug.
 *
 * ── Een verwijzing wint van een gelijkende naam (21-08-2026) ──
 * Het onderwerp uit de naam halen werkt goed voor een klantversie die bijna
 * hetzelfde heet als wat wij stuurden. Het werkt juist NIET bij een stuk dat we
 * ondersteunend hebben gemaakt: dat krijgt vaak met opzet een andere titel, want
 * de oude botste met de landingspagina. Dan las het als een los project en
 * schoof er een document van iets heel anders tussen. Kent een document zijn
 * bron, dan is dat geen gok maar een feit, en die gaat dus vóór.
 */
export function groepeer(docs: Groepeerbaar[]): Record<number, string> {
  const uit: Record<number, string> = {};
  const groepen: { sleutel: string; kind: string; namen: string[]; ids: number[] }[] = [];
  for (const d of docs) {
    const kind = d.kind || "overig";
    const bestaand =
      groepen.find((g) => d.bronId && g.ids.includes(d.bronId))
      || groepen.find((g) => g.kind === kind && g.namen.some((n) => zelfdeOnderwerp(n, d.naam)));
    if (bestaand) {
      bestaand.namen.push(d.naam);
      bestaand.ids.push(d.id);
      uit[d.id] = bestaand.sleutel;
    } else {
      const sleutel = `${kind}#${groepen.filter((g) => g.kind === kind).length}`;
      groepen.push({ sleutel, kind, namen: [d.naam], ids: [d.id] });
      uit[d.id] = sleutel;
    }
  }
  // Een bron kan ná zijn afgeleide langskomen (de lijst staat op nieuwste eerst).
  // Dan zijn het nu twee groepen die één groep hadden moeten zijn; hier worden ze
  // alsnog samengevoegd, op de groep van de bron.
  for (const d of docs) {
    if (!d.bronId || !uit[d.bronId] || uit[d.bronId] === uit[d.id]) continue;
    const oud = uit[d.id];
    const nieuw = uit[d.bronId];
    for (const x of docs) if (uit[x.id] === oud) uit[x.id] = nieuw;
  }
  return uit;
}

/**
 * De volgorde waarin documenten in een lijst horen te staan.
 *
 * Drie regels, in deze volgorde:
 *  1. de proces-stap (analyse, blauwdruk, copy, structured data);
 *  2. daarbinnen per onderwerp bij elkaar, het onderwerp met het nieuwste stuk
 *     bovenaan (anders schuift een ander project ertussen);
 *  3. en binnen een onderwerp nieuwste eerst, behálve een stuk dat uit een ander
 *     stuk voortkomt: dat staat direct ónder zijn bron.
 *
 * Die laatste regel is van 21-08-2026. Een afgeleid stuk is altijd nieuwer, dus
 * "nieuwste eerst" zette het bovenaan, mét het inspringstreepje dat zegt "ik hoor
 * bij het stuk hierboven", terwijl dat stuk eronder stond. Maartens woorden: "het
 * is mij onduidelijk wat de bovenste versie is en welke later is."
 */
const STAP_RANG: Record<string, number> = { analyse: 1, blauwdruk: 2, copy: 3, structured: 4 };

export function documentVolgorde<T extends Groepeerbaar & { createdAt: string }>(
  docs: T[], groepVan: Record<number, string>,
): T[] {
  const sleutelVan = (d: T) => groepVan[d.id] || `los-${d.id}`;
  const nieuwsteInGroep: Record<string, string> = {};
  for (const d of docs) {
    const g = sleutelVan(d);
    if (!nieuwsteInGroep[g] || nieuwsteInGroep[g] < d.createdAt) nieuwsteInGroep[g] = d.createdAt;
  }
  const gesorteerd = [...docs].sort((a, b) => {
    const va = STAP_RANG[a.kind] || 9, vb = STAP_RANG[b.kind] || 9;
    if (va !== vb) return va - vb;
    const ga = sleutelVan(a), gb = sleutelVan(b);
    if (ga !== gb) return nieuwsteInGroep[ga] < nieuwsteInGroep[gb] ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
  const kinderen = new Map<number, T[]>();
  const isKind = new Set<number>();
  for (const d of gesorteerd) {
    const bron = d.bronId || 0;
    if (!bron || !gesorteerd.some((x) => x.id === bron)) continue;
    kinderen.set(bron, [...(kinderen.get(bron) || []), d]);
    isKind.add(d.id);
  }
  const uit: T[] = [];
  const gezet = new Set<number>();
  const zetNeer = (d: T) => {
    if (gezet.has(d.id)) return;                 // een kringetje kan nooit blijven hangen
    gezet.add(d.id);
    uit.push(d);
    for (const kind of kinderen.get(d.id) || []) zetNeer(kind);
  };
  for (const d of gesorteerd) if (!isKind.has(d.id)) zetNeer(d);
  for (const d of gesorteerd) zetNeer(d);        // een afgeleide zonder bron in beeld
  return uit;
}

/** Hoeveel documenten zitten er in elke groep? */
export function groepAantallen(docs: Groepeerbaar[], groepVan: Record<number, string>): Record<string, number> {
  const uit: Record<string, number> = {};
  for (const d of docs) {
    const g = groepVan[d.id];
    if (g) uit[g] = (uit[g] || 0) + 1;
  }
  return uit;
}

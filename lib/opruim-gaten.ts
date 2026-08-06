import { getKeywordIdeas } from "./ahrefs";
import { getGscQueryPagePairs } from "./google";
import { getClientUrls } from "./site-urls";
import { termUitPad, DREMPEL_VOLUME } from "./opruim-waarde";
import { onderwerpWoorden } from "./opruim-onderwerpen";
import { feitenPerTerm, intentieUitleg, type Intentie } from "./opruim-intentie";
import { weegHaalbaarheid, autoriteitVan, OORDEEL_RANG, type Haalbaarheid } from "./opruim-haalbaarheid";
import { getUrlStructuur } from "./opruim-regels";

// ═══════════════════════════════════════════════════════════
// DE ONTBREKENDE PAGINA: WAAR DE SITE HELEMAAL NIET OP MIKT
// ═══════════════════════════════════════════════════════════
// Tot nu toe keek het opruimen alleen naar wat er ís: welke pagina's zitten
// elkaar in de weg, welke leveren niets op, welk onderwerp ligt versnipperd.
// Dat is de ene helft. De andere helft is wat er niet is.
//
// Bij One Day Clinic gaat het om 433 pagina's, en de vraag "welke moeten weg"
// heeft daar maandenlang alle aandacht gekregen. Maar een site die alleen
// opgeruimd wordt, groeit niet. Een zoekterm met 800 zoekopdrachten per maand
// waar geen enkele pagina op mikt is een groter gemis dan drie dode pagina's
// samen, en hij staat in geen enkele lijst omdat er niets is om naar te kijken.
//
// Hiermee wordt dit pas echt een content mapping: niet alleen terugwerken vanaf
// de site zoals hij is, maar ook vooruitkijken naar wat de markt vraagt.
//
// De data lag er al. Ahrefs levert zoekwoord-ideeën rond een term, en Search
// Console weet precies waar de site al wél op meedoet. Het verschil daartussen
// is het gat. De twee remmen gelden hier onverkort: elk gat krijgt zijn
// zoekintentie (wat voor pagina hoort hier) en zijn haalbaarheidsoordeel (kan
// deze site dit winnen), want een gat dat buiten bereik ligt is geen kans.
// ═══════════════════════════════════════════════════════════

export type Gat = {
  term: string;
  volume: number;
  moeilijkheid: number | null;
  intentie: Intentie;
  haalbaarheid: Haalbaarheid;
  /** Het zaad waar dit idee uit voortkwam: het thema waar de site al in zit. */
  thema: string;
  /** Bestaande pagina's die er het dichtst bij liggen. Ligt er één heel dichtbij,
      dan is dit geen nieuwe pagina maar een uitbreiding van die bestaande. */
  dichtbij: string[];
  /** Het voorgestelde pad voor de nieuwe pagina. */
  voorstelPad: string;
  /** Nieuwe pagina, of een bestaande pagina die dit erbij moet krijgen. */
  soort: "nieuwe pagina" | "uitbreiden";
  /** Wat deze ontbrekende pagina waard zou zijn per maand; berekend bij uitlezen. */
  euro?: import("./opruim-euro").Euro | null;
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

/** Hoeveel thema's we uitvragen. Elk thema is één Ahrefs-opvraag (30 dagen gecachet). */
const MAX_THEMAS = 8;
/** Hoeveel gaten er uiteindelijk overblijven. Meer is geen lijst maar een dump. */
const MAX_GATEN = 25;
/** Vanaf welke positie telt "de site doet hier al aan mee" en is het dus geen gat. */
const DOET_AL_MEE = 20;

const woordSleutel = (t: string) => [...new Set(onderwerpWoorden(t))].sort().join(" ");

/** Term naar een pad: "soa test kopen" wordt /soa-test-kopen/. */
export function padUitTerm(term: string): string {
  const s = (term || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s ? `/${s}/` : "";
}

/**
 * De zoekwoorden met volume waar deze site nergens op mikt.
 *
 * Werkwijze in gewone taal: kijk waar de site het al goed doet (dat zijn de
 * thema's waar hij geloofwaardig in is), vraag Ahrefs wat mensen daar nog meer
 * omheen zoeken, en streep alles weg wat de site al heeft of al pakt. Wat
 * overblijft is het gat.
 */
export async function vindGaten(slug: string, domain: string): Promise<Gat[]> {
  const [urls, paren, vorm, autoriteit] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getGscQueryPagePairs(domain, 90).catch(() => []),
    getUrlStructuur(slug).catch(() => ""),
    autoriteitVan(domain).catch(() => null),
  ]);
  const live = urls.filter((u) => (u.status ?? 200) === 200).map((u) => padVan(u.url));
  if (!paren.length) return [];

  // Waar mikt de site al op? Twee bronnen: de termen die uit de URL's af te leiden
  // zijn, en alles waar hij in Search Console al fatsoenlijk op meedoet. Beide als
  // woordsleutel, zodat "soa thuistest" en "thuistest soa" dezelfde zijn.
  const bezet = new Set<string>();
  for (const p of live) { const s = woordSleutel(termUitPad(p)); if (s) bezet.add(s); }
  const alGezien = new Set<string>();
  for (const p of paren) {
    const k = p.keyword.trim().toLowerCase();
    alGezien.add(k);
    if (p.position > 0 && p.position <= DOET_AL_MEE) { const s = woordSleutel(k); if (s) bezet.add(s); }
  }

  // De thema's: de zoekopdrachten waar de site het al goed op doet. Dat is waar hij
  // geloofwaardig in is, en dus waar uitbreiden kans maakt. Zaaien rond een thema
  // waar de site niets mee heeft levert een lijst op die nergens over gaat.
  const perTerm = new Map<string, { vertoningen: number; beste: number }>();
  for (const p of paren) {
    const k = p.keyword.trim().toLowerCase();
    const e = perTerm.get(k) || { vertoningen: 0, beste: 999 };
    e.vertoningen += p.impressions;
    if (p.position < e.beste) e.beste = p.position;
    perTerm.set(k, e);
  }
  const themas: string[] = [];
  const themaSleutels = new Set<string>();
  for (const [term, e] of [...perTerm.entries()].sort((a, b) => b[1].vertoningen - a[1].vertoningen)) {
    if (themas.length >= MAX_THEMAS) break;
    if (e.beste > DOET_AL_MEE) continue;
    if (term.split(" ").length < 2) continue;      // één woord is te breed om op te zaaien
    // Niet twee keer bijna hetzelfde thema uitvragen; dat kost credits en levert
    // dezelfde ideeën op.
    const s = woordSleutel(term);
    if (!s || themaSleutels.has(s)) continue;
    themaSleutels.add(s);
    themas.push(term);
  }
  if (!themas.length) return [];

  // De ideeën ophalen. Elke opvraag zit achter de cache van 30 dagen.
  const ideeen = new Map<string, { volume: number; moeilijkheid: number | null; thema: string }>();
  for (const thema of themas) {
    const rijen = await getKeywordIdeas(thema, "nl", 40).catch(() => []);
    for (const r of rijen) {
      const term = (r.keyword || "").trim().toLowerCase();
      const volume = r.volume ?? 0;
      if (!term || volume < DREMPEL_VOLUME) continue;
      if (alGezien.has(term)) continue;                 // hier doet de site al aan mee
      const s = woordSleutel(term);
      if (!s || bezet.has(s)) continue;                 // hier is al een pagina voor
      const bestaand = ideeen.get(term);
      if (!bestaand || volume > bestaand.volume) ideeen.set(term, { volume, moeilijkheid: r.difficulty ?? null, thema });
    }
  }
  if (!ideeen.size) return [];

  // Alleen voor de sterkste kandidaten de intentie ophalen; dat is één extra
  // opvraag voor de hele set en scheelt credits ten opzichte van alles bevragen.
  const top = [...ideeen.entries()].sort((a, b) => b[1].volume - a[1].volume).slice(0, MAX_GATEN * 2);
  const feiten = await feitenPerTerm(top.map(([t]) => t)).catch(() => new Map());

  const gaten: Gat[] = top.map(([term, d]) => {
    const eigen = new Set(onderwerpWoorden(term));
    // Welke bestaande pagina's liggen hier het dichtst bij? Delen ze bijna alle
    // woorden, dan is dit geen nieuwe pagina maar iets dat op een bestaande hoort.
    const dichtbij = live
      .map((p) => {
        const w = new Set(onderwerpWoorden(p));
        let gedeeld = 0;
        for (const x of eigen) if (w.has(x)) gedeeld++;
        return { p, gedeeld, deel: eigen.size ? gedeeld / eigen.size : 0 };
      })
      .filter((x) => x.gedeeld > 0)
      .sort((a, b) => b.deel - a.deel || a.p.length - b.p.length)
      .slice(0, 3);
    const uitbreiden = (dichtbij[0]?.deel ?? 0) >= 0.75;
    const moeilijkheid = feiten.get(term)?.moeilijkheid ?? d.moeilijkheid;

    return {
      term,
      volume: d.volume,
      moeilijkheid,
      intentie: feiten.get(term)?.intentie ?? "",
      haalbaarheid: weegHaalbaarheid(moeilijkheid, autoriteit, null),
      thema: d.thema,
      dichtbij: dichtbij.map((x) => x.p),
      voorstelPad: uitbreiden ? (dichtbij[0]?.p || "") : padUitTerm(term),
      soort: uitbreiden ? "uitbreiden" : "nieuwe pagina",
    };
  });

  // Eerst wat kan, dan wat groot is. Zelfde volgorde als bij "oppakken", zodat de
  // twee lijsten hetzelfde lezen.
  gaten.sort((a, b) =>
    OORDEEL_RANG[a.haalbaarheid.oordeel] - OORDEEL_RANG[b.haalbaarheid.oordeel] ||
    b.volume - a.volume);

  // De gekozen URL-structuur telt ook hier. Staat er een vorm vast, dan hoort een
  // nieuwe pagina die vorm te volgen in plaats van er een negende bij te verzinnen.
  if (vorm) {
    for (const g of gaten) {
      if (g.soort === "nieuwe pagina") g.voorstelPad = `${g.voorstelPad}  (let op de vastgelegde vorm: ${vorm})`;
    }
  }

  return gaten.slice(0, MAX_GATEN);
}

/** Eén zin per gat, in gewone taal. Gebruikt op het scherm en in de klantmail. */
export function gatUitleg(g: Gat): string {
  const wie = intentieUitleg(g.intentie);
  const wat = g.soort === "uitbreiden"
    ? `Er staat al een pagina dichtbij (${g.dichtbij[0]}); daar hoort dit onderwerp bij, in plaats van er een aparte pagina voor te maken.`
    : "Geen enkele pagina van de site gaat hierover, dus hier valt niets te winnen zolang die pagina er niet is.";
  return `Er wordt ongeveer ${g.volume} keer per maand gezocht op "${g.term}"${wie !== "onbekend" ? `, door iemand die ${wie}` : ""}. ${wat} ${g.haalbaarheid.uitleg}`;
}

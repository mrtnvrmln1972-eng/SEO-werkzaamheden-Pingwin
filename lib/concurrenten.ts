import { getGscForPage, getGscQueryPagePairs } from "./google";
import { getClientUrls } from "./site-urls";

// ═══════════════════════════════════════════════════════════
// WELKE PAGINA'S ZITTEN DEZE PAGINA IN DE WEG?
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat. Dit werd gevraagd als taalvraag ("kijk eens welke pagina's
// concurreren") terwijl het een opzoekvraag is. Het model kreeg een afgeknotte
// lijst paden en moest het uitdenken. Gevolg, twee keer op rij: pagina's gemist
// die er echt toe deden (/testen-in-amsterdam-welke-opties-heb-je/ vecht met de
// hoofdpagina om "soa test amsterdam" op positie 11,5 met 1290 vertoningen) en
// pagina's verzonnen die niet bestaan. Beide fouten hebben dezelfde oorzaak:
// schatten in plaats van opzoeken.
//
// Hier wordt het opgezocht. De overlap komt uit Search Console: elke pagina die
// vertoningen krijgt op dezelfde zoekwoorden als de doelpagina. Niets gemist,
// want alles wordt gescand. Niets verzonnen, want er komen alleen URL's uit die
// echt vertoningen hebben.
//
// En even belangrijk: elke concurrent brengt zijn EIGEN beste zoekterm mee. Dat
// is het bestaansrecht. Zonder dat werd /snelle-soa-test-amsterdam/ voorgesteld
// als redirect, terwijl die op positie 4,5 staat voor "soatestuitslag" met 1060
// vertoningen. Een opruimadvies zonder die cijfers is een gok met andermans
// verkeer.
// ═══════════════════════════════════════════════════════════

export type Concurrent = {
  url: string;
  pad: string;
  status: number | null;
  redirectTarget: string;
  gedeeld: { keyword: string; positie: number; vertoningen: number; positieDoel: number | null }[];
  gedeeldeVertoningen: number;
  eigenTop: { keyword: string; positie: number; vertoningen: number; klikken: number } | null;
  eigenVertoningen: number;
  oordeel?: "kan-weg" | "bestaansrecht" | "al-opgeruimd";
};

export type OverlapResultaat = {
  ok: boolean;
  reden?: string;
  doelPad: string;
  doelZoekwoorden: number;
  concurrenten: Concurrent[];
  siteBrede?: string[];
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();

/**
 * Zoekt de pagina's die met de doelpagina om dezelfde zoekwoorden strijden.
 * Alles komt uit Search Console; er wordt niets afgeleid of geschat.
 */
export async function overlappendePaginas(slug: string, domain: string, doelUrl: string, dagen = 90): Promise<OverlapResultaat> {
  const doelPad = padVan(doelUrl);
  const leeg: OverlapResultaat = { ok: false, doelPad, doelZoekwoorden: 0, concurrenten: [] };
  if (!domain || !doelUrl) return { ...leeg, reden: "Geen domein of URL opgegeven." };

  const [doelKw, paren, urls] = await Promise.all([
    getGscForPage(domain, doelUrl, dagen).catch(() => []),
    getGscQueryPagePairs(domain, dagen).catch(() => []),
    getClientUrls(slug).catch(() => []),
  ]);

  if (!doelKw.length) return { ...leeg, reden: "Geen Search Console-data voor deze pagina (of de Google-koppeling ontbreekt). Doe hier geen uitspraak over concurrentie." };
  if (!paren.length) return { ...leeg, reden: "Search Console gaf geen zoekwoord/pagina-combinaties terug." };

  // Status per pagina uit de laatste scan, zodat een al omgeleide pagina er
  // meteen als "klaar" uit komt in plaats van als op te ruimen concurrent.
  const statusVan = new Map(urls.map((u) => [norm(u.url), { status: u.status, redirectTarget: u.redirectTarget }]));

  const doelSet = new Map(doelKw.map((k) => [k.keyword.toLowerCase(), k.position]));
  const doelNorm = norm(doelUrl);

  // Per pagina: welke zoekwoorden deelt hij met het doel, en wat is zijn eigen
  // sterkste zoekterm (ook als die NIET gedeeld wordt; dat is het bestaansrecht).
  const perPagina = new Map<string, Concurrent>();
  for (const p of paren) {
    if (norm(p.page) === doelNorm) continue;
    const sleutel = norm(p.page);
    let c = perPagina.get(sleutel);
    if (!c) {
      const s = statusVan.get(sleutel);
      c = {
        url: p.page, pad: padVan(p.page),
        status: s?.status ?? null, redirectTarget: s?.redirectTarget || "",
        gedeeld: [], gedeeldeVertoningen: 0, eigenTop: null, eigenVertoningen: 0,
      };
      perPagina.set(sleutel, c);
    }
    c.eigenVertoningen += p.impressions;
    if (!c.eigenTop || p.impressions > c.eigenTop.vertoningen) {
      c.eigenTop = { keyword: p.keyword, positie: p.position, vertoningen: p.impressions, klikken: p.clicks };
    }
    const doelPos = doelSet.get(p.keyword.toLowerCase());
    if (doelPos !== undefined) {
      c.gedeeld.push({ keyword: p.keyword, positie: p.position, vertoningen: p.impressions, positieDoel: doelPos });
      c.gedeeldeVertoningen += p.impressions;
    }
  }

  // ── Ruis eruit ─────────────────────────────────────────────────────────────
  // Zonder dit is de uitkomst onbruikbaar: bij One Day Clinic overlapt élke
  // pagina met élke pagina, want iedereen rankt op de merknaam en op de
  // site-brede term "soa test". Dan krijg je een muur van "heeft bestaansrecht"
  // en zie je de pagina's die er echt toe doen niet.
  //   - MERKTERMEN: bevatten een woord uit de merknaam/het domein. Overlap daarop
  //     is normaal en niet op te lossen met een redirect.
  //   - SITE-BREDE TERMEN: een zoekwoord waar veel pagina's tegelijk op ranken is
  //     een structureel probleem van de hele site, geen ruzie tussen twee pagina's.
  const merkWoorden = new Set(
    (domain.replace(/^https?:\/\//, "").split(".")[0] || "")
      .split(/[^a-z0-9]+/i).filter((w) => w.length > 3).map((w) => w.toLowerCase()),
  );
  const isMerk = (kw: string) => {
    const k = kw.toLowerCase().replace(/\s+/g, "");
    for (const m of merkWoorden) if (k.includes(m)) return true;
    return false;
  };
  const paginasPerTerm = new Map<string, Set<string>>();
  for (const p of paren) {
    if (p.impressions < 5) continue;
    const k = p.keyword.toLowerCase();
    if (!paginasPerTerm.has(k)) paginasPerTerm.set(k, new Set());
    paginasPerTerm.get(k)!.add(norm(p.page));
  }
  const isSiteBreed = (kw: string) => (paginasPerTerm.get(kw.toLowerCase())?.size || 0) >= 5;

  const siteBrede = new Set<string>();
  for (const c of perPagina.values()) {
    const scherp = c.gedeeld.filter((g) => {
      if (isMerk(g.keyword)) return false;
      if (isSiteBreed(g.keyword)) { siteBrede.add(g.keyword); return false; }
      return true;
    });
    c.gedeeld = scherp;
    c.gedeeldeVertoningen = scherp.reduce((n, g) => n + g.vertoningen, 0);
    // Heeft deze concurrent een EIGEN zoekterm, of leent hij alles? Dat bepaalt
    // of hij opgeruimd kan worden of juist met rust gelaten moet worden.
    const eigenWoorden = padVan(c.url).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const eigenNietMerk = c.eigenTop && !isMerk(c.eigenTop.keyword) && !isSiteBreed(c.eigenTop.keyword)
      && eigenWoorden.some((w) => c.eigenTop!.keyword.toLowerCase().includes(w));
    c.oordeel = c.status !== null && c.status >= 300 && c.status < 400 ? "al-opgeruimd"
      : eigenNietMerk ? "bestaansrecht" : "kan-weg";
  }

  const concurrenten = [...perPagina.values()]
    .filter((c) => c.gedeeld.length > 0)
    .map((c) => ({ ...c, gedeeld: c.gedeeld.sort((a, b) => b.vertoningen - a.vertoningen).slice(0, 6) }))
    // Wat je kunt opruimen eerst; daarna pas de pagina's die mogen blijven.
    .sort((a, b) => (a.oordeel === "kan-weg" ? 0 : 1) - (b.oordeel === "kan-weg" ? 0 : 1) || b.gedeeldeVertoningen - a.gedeeldeVertoningen)
    .slice(0, 25);

  return { ok: true, doelPad, doelZoekwoorden: doelKw.length, concurrenten, siteBrede: [...siteBrede].slice(0, 10) };
}

/** De uitkomst als tekst voor de chat: compleet, met de cijfers die een besluit dragen. */
export function overlapAlsTekst(r: OverlapResultaat): string {
  if (!r.ok) return r.reden || "Geen overlap-analyse mogelijk.";
  if (!r.concurrenten.length) return `Geen enkele andere pagina krijgt vertoningen op de zoekwoorden van ${r.doelPad}. Er is hier geen cannibalisatie; stel geen opruiming voor.`;

  const kanWeg = r.concurrenten.filter((c) => c.oordeel === "kan-weg");
  const rest = r.concurrenten.filter((c) => c.oordeel !== "kan-weg");
  const regels: string[] = [
    `OVERLAP-ANALYSE voor ${r.doelPad}, uit Search Console (90 dagen), vers opgehaald.`,
    `Merktermen en site-brede termen zijn eruit gefilterd: daar rankt élke pagina op, dus die zeggen niets over cannibalisatie tussen twee pagina's en zijn niet met een redirect op te lossen.${r.siteBrede?.length ? ` Als site-breed behandeld: ${r.siteBrede.map((k) => `"${k}"`).join(", ")}. Dat is een structureel vraagstuk voor de hele site, geen ruzie tussen twee pagina's; benoem het hooguit één keer en maak er geen redirectadvies van.` : ""}`,
    "",
    `HET ANTWOORD ZIT IN DE EERSTE GROEP. ${kanWeg.length} van de ${r.concurrenten.length} concurrenten heeft GEEN eigen zoekterm en kan dus opgeruimd of samengevoegd worden. De rest heeft bestaansrecht: die laat je met rust, en die noem je hooguit kort. Begin je antwoord met de eerste groep.`,
  ];
  if (!kanWeg.length) regels.push("LET OP: er is geen enkele concurrent zonder eigen zoekterm. Zeg dat er voor deze pagina niets op te ruimen valt, en gebruik dunne_paginas als Maarten site-breed wil opruimen.");

  regels.push("");
  regels.push(`=== KAN WEG OF SAMENVOEGEN (${kanWeg.length}) ===`);
  for (const c of kanWeg) {
    const statusTekst = c.status !== null && c.status >= 300 && c.status < 400
      ? `AL OMGELEID (${c.status} naar ${c.redirectTarget ? padVan(c.redirectTarget) : "onbekend"}), dus KLAAR: niet voorstellen om op te ruimen`
      : c.status !== null && c.status >= 400 ? `${c.status}, bestaat niet meer`
      : c.status === 200 ? "live" : "status onbekend, controleer met controleer_url";
    regels.push("");
    regels.push(`${c.pad} [${statusTekst}]`);
    regels.push(`  gedeeld met de doelpagina: ${c.gedeeld.map((g) => `"${g.keyword}" (deze pagina positie ${g.positie}, ${g.vertoningen} vertoningen; doelpagina staat daar op ${g.positieDoel ?? "?"})`).join("; ")}`);
    regels.push(`  gedeelde vertoningen totaal: ${c.gedeeldeVertoningen}`);
    if (c.eigenTop) {
      // Alleen "bestaansrecht" zeggen als het oordeel dat óók is. Anders stond er
      // bij een op te ruimen pagina "kan weg" en "wees voorzichtig" door elkaar.
      const duiding = c.oordeel === "bestaansrecht"
        ? " (eigen term die de doelpagina niet bedient: BESTAANSRECHT, niet omleiden)"
        : " (dit is een merk- of andermans term, geen eigen onderwerp: deze pagina verdient niets van zichzelf)";
      regels.push(`  sterkste zoekterm van deze pagina: "${c.eigenTop.keyword}" op positie ${c.eigenTop.positie}, ${c.eigenTop.vertoningen} vertoningen, ${c.eigenTop.klikken} klikken${duiding}`);
    }
    regels.push(`  vertoningen van deze pagina in totaal: ${c.eigenVertoningen}`);
  }

  regels.push("");
  regels.push(`=== HEBBEN BESTAANSRECHT, NIET OMLEIDEN (${rest.length}) ===`);
  for (const c of rest) {
    const st = c.oordeel === "al-opgeruimd" ? " [AL OMGELEID, klaar]" : "";
    regels.push(`${c.pad}${st}: eigen term "${c.eigenTop?.keyword ?? "?"}" op positie ${c.eigenTop?.positie ?? "?"} (${c.eigenTop?.vertoningen ?? 0} vertoningen); deelt ${c.gedeeldeVertoningen} vertoningen met de doelpagina`);
  }
  return regels.join("\n");
}

// ═══════════════════════════════════════════════════════════
// DUNNE PAGINA'S ZONDER EIGEN ZOEKTERM
// ═══════════════════════════════════════════════════════════
// Waarom dit náást de overlap-analyse bestaat. Die zoekt pagina's die dezelfde
// zoekwoorden delen, en dan komen juist de STERKE pagina's boven: die hebben de
// meeste vertoningen. Precies de pagina's die je wilt houden. Maarten zoekt het
// omgekeerde: de kleine locatiepaginaatjes (Mijdrecht, Abcoude, Veldhoven) die
// bijna niets doen en de autoriteit versnipperen. Die delen nauwelijks
// zoekwoorden, juist omdat ze niets opleveren, dus die zakken in een
// overlap-lijst naar de bodem of vallen er helemaal uit.
//
// De toets die het onderscheid maakt: heeft een pagina een EIGEN zoekterm?
// - /soa-klinieken/soa-test-zaandam/ rankt op "soa test zaandam" (positie 2,2).
//   Eigen term, eigen publiek: houden.
// - /soa-klinieken/soa-test-mijdrecht/ rankt nergens op "mijdrecht", alleen op
//   geleende merktermen als "onedayclinic amsterdam". Geen eigen bestaansrecht:
//   opruimkandidaat.
//
// Merk-neutraal opgezet: welke woorden onderscheidend zijn wordt geteld, niet
// ingebouwd. Voor een hovenier werkt dit net zo goed als voor een kliniek.
// ═══════════════════════════════════════════════════════════

export type ZwakkePagina = {
  pad: string; url: string;
  eigenWoorden: string[];
  klikken: number; vertoningen: number;
  eigenTerm: { keyword: string; positie: number; vertoningen: number } | null;
  geleendeTop: { keyword: string; positie: number; vertoningen: number } | null;
  dubbelMet: string[];   // andere pagina's over dezelfde plaats/dienst
};

const STOP = new Set(["de", "het", "een", "en", "van", "in", "op", "voor", "met", "bij", "je", "te", "www", "nl", "index", "home", "page"]);
const woordenVan = (pad: string) => pad.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Live pagina's die geen enkele zoekterm van zichzelf hebben: alles wat ze
 * binnenhalen is geleend van merk- of andere-stadstermen. Dat zijn de pagina's
 * die opgeruimd of samengevoegd kunnen worden, met de pagina die de term wél
 * bezit als voor de hand liggend doel.
 */
export async function zwakkePaginas(slug: string, domain: string, minVertoningen = 10, dagen = 90): Promise<{ ok: boolean; reden?: string; tekst: string }> {
  const [paren, urls] = await Promise.all([
    getGscQueryPagePairs(domain, dagen).catch(() => []),
    getClientUrls(slug).catch(() => []),
  ]);
  return bepaalZwakkePaginas(paren, urls.map((u) => ({ url: u.url, status: u.status })), minVertoningen, dagen);
}

/** De pure rekenkern, los van de bronnen zodat hij te testen is op echte cijfers. */
export function bepaalZwakkePaginas(
  paren: { keyword: string; page: string; clicks: number; impressions: number; position: number }[],
  urls: { url: string; status: number | null }[],
  minVertoningen = 10,
  dagen = 90,
  minKlikken = 10,
  minEigenVertoningen = 300,
): { ok: boolean; reden?: string; tekst: string } {
  if (!paren.length) return { ok: false, reden: "Geen Search Console-data beschikbaar.", tekst: "Geen Search Console-data beschikbaar; doe hier geen uitspraak over welke pagina's opgeruimd kunnen worden." };

  const live = urls.filter((u) => u.status === 200);
  if (!live.length) return { ok: false, reden: "Geen live pagina's bekend.", tekst: "Geen live pagina's bekend." };

  // Welke woorden zijn generiek op deze site (soa, test, kliniek) en welke
  // onderscheidend (zaandam, mijdrecht)? Tellen, niet aannemen.
  const freq = new Map<string, number>();
  for (const u of live) for (const w of new Set(woordenVan(padVan(u.url)))) freq.set(w, (freq.get(w) || 0) + 1);
  const generiekGrens = Math.max(3, Math.round(live.length * 0.06));
  const onderscheidend = (pad: string) => woordenVan(pad).filter((w) => (freq.get(w) || 0) <= generiekGrens);

  // GSC per pagina samenvoegen.
  const perPagina = new Map<string, { klikken: number; vertoningen: number; rijen: { keyword: string; positie: number; vertoningen: number }[] }>();
  for (const p of paren) {
    const k = norm(p.page);
    let e = perPagina.get(k);
    if (!e) { e = { klikken: 0, vertoningen: 0, rijen: [] }; perPagina.set(k, e); }
    e.klikken += p.clicks; e.vertoningen += p.impressions;
    e.rijen.push({ keyword: p.keyword, positie: p.position, vertoningen: p.impressions });
  }

  // Wie bezit welk onderscheidend woord? Nodig om een doel voor te stellen.
  const bezitter = new Map<string, { pad: string; vertoningen: number }>();
  const kandidaten: ZwakkePagina[] = [];
  const alles: { u: typeof live[number]; eigen: string[]; g: NonNullable<ReturnType<typeof perPagina.get>> | undefined }[] = [];

  for (const u of live) {
    const pad = padVan(u.url);
    const eigen = onderscheidend(pad);
    if (!eigen.length) continue;                       // geen eigen onderwerp, bijv. /contact/
    const g = perPagina.get(norm(u.url));
    alles.push({ u, eigen, g });
    if (!g) continue;
    for (const w of eigen) {
      const beste = g.rijen.filter((r) => r.keyword.toLowerCase().includes(w) && r.vertoningen >= minVertoningen)
        .sort((a, b) => b.vertoningen - a.vertoningen)[0];
      if (beste) {
        const huidig = bezitter.get(w);
        if (!huidig || beste.vertoningen > huidig.vertoningen) bezitter.set(w, { pad, vertoningen: beste.vertoningen });
      }
    }
  }

  const dubbelingen: ZwakkePagina[] = [];
  const twijfel: ZwakkePagina[] = [];
  const dubbelSet = new Set<string>();
  const zonderData: string[] = [];
  for (const { u, eigen, g } of alles) {
    const pad = padVan(u.url);
    const rijen = g?.rijen || [];
    // Geen enkele vertoning: dan valt er niets te beoordelen. Zo'n pagina als
    // opruimkandidaat opvoeren is precies het gokken dat we niet willen; een
    // functionele pagina (/contact/) hoort hier ook niet in.
    if (!g || g.vertoningen === 0) { zonderData.push(pad); continue; }

    const eigenTerm = rijen.filter((r) => eigen.some((w) => r.keyword.toLowerCase().includes(w)) && r.vertoningen >= minVertoningen)
      .sort((a, b) => b.vertoningen - a.vertoningen)[0] || null;
    const geleend = rijen.sort((a, b) => b.vertoningen - a.vertoningen)[0] || null;

    if (eigenTerm) {
      // Heeft wel een eigen term, maar bezit een ANDERE pagina die term duidelijk
      // sterker? Dan zijn het er twee voor hetzelfde onderwerp: samenvoegen.
      // Zo komt /soa-poli-zaandam/ naar boven naast /soa-klinieken/soa-test-zaandam/.
      const sterker = eigen.map((w) => bezitter.get(w))
        .filter((b): b is { pad: string; vertoningen: number } => !!b && b.pad !== pad && b.vertoningen >= eigenTerm.vertoningen * 1.5);
      if (sterker.length) {
        dubbelSet.add(pad);
        dubbelingen.push({
          pad, url: u.url, eigenWoorden: eigen,
          klikken: g.klikken, vertoningen: g.vertoningen,
          eigenTerm: { keyword: eigenTerm.keyword, positie: eigenTerm.positie, vertoningen: eigenTerm.vertoningen },
          geleendeTop: geleend, dubbelMet: [...new Set(sterker.map((b) => b.pad))],
        });
      }
      // Eigen term, maar levert die ook echt iets op? Leiden haalt 73 klikken op
      // positie 2,2; Haarlem haalt er 6 in negentig dagen. Allebei "eigen term",
      // maar dat is niet hetzelfde besluit. Het magere geval krijgt daarom een
      // eigen categorie in plaats van automatisch groen licht.
      const sterk = g.klikken >= minKlikken || eigenTerm.vertoningen >= minEigenVertoningen;
      if (!sterk && !dubbelSet.has(pad)) {
        twijfel.push({
          pad, url: u.url, eigenWoorden: eigen,
          klikken: g.klikken, vertoningen: g.vertoningen,
          eigenTerm: { keyword: eigenTerm.keyword, positie: eigenTerm.positie, vertoningen: eigenTerm.vertoningen },
          geleendeTop: geleend, dubbelMet: [],
        });
      }
      continue;                                        // eigen term: niet opruimen
    }

    // Waar moet deze pagina naartoe? Dat staat in de zoekwoorden die hij LEENT.
    // /soa-test-veldhoven/ haalt zijn vertoningen op "onedayclinic eindhoven";
    // de pagina die "eindhoven" bezit is dus het voor de hand liggende doel.
    // Zo komt het doel uit de data in plaats van uit aardrijkskunde die we niet
    // hebben. Leent een pagina van twee steden, dan noemen we ze allebei en
    // laten we de keuze aan Maarten, in plaats van er een te gokken.
    const uitEigenNaam = eigen.map((w) => bezitter.get(w)).filter((b): b is { pad: string; vertoningen: number } => !!b && b.pad !== pad);
    const uitGeleend = new Map<string, number>();
    for (const r2 of rijen) {
      for (const w of r2.keyword.toLowerCase().split(/[^a-z0-9]+/)) {
        if (w.length <= 3) continue;
        const b = bezitter.get(w);
        if (b && b.pad !== pad) uitGeleend.set(b.pad, (uitGeleend.get(b.pad) || 0) + r2.vertoningen);
      }
    }
    const dubbel = [
      ...uitEigenNaam.sort((a, b) => b.vertoningen - a.vertoningen).map((b) => b.pad),
      ...[...uitGeleend.entries()].sort((a, b) => b[1] - a[1]).map(([p2]) => p2),
    ];
    kandidaten.push({
      pad, url: u.url, eigenWoorden: eigen,
      klikken: g.klikken, vertoningen: g.vertoningen,
      eigenTerm: null, geleendeTop: geleend, dubbelMet: [...new Set(dubbel)],
    });
  }

  kandidaten.sort((a, b) => a.klikken - b.klikken || b.vertoningen - a.vertoningen);
  const top = kandidaten.slice(0, 60);

  const regels = [
    `PAGINA'S ZONDER EIGEN ZOEKTERM, uit Search Console (${dagen} dagen), vers opgehaald. Dit zijn de opruimkandidaten.`,
    `TOETS: een pagina heeft bestaansrecht als hij rankt op een zoekterm die zijn eigen onderwerp bevat (bijvoorbeeld /soa-test-zaandam/ op "soa test zaandam"). De pagina's hieronder halen dat NIET: alles wat ze binnenkrijgen is geleend van merk- of andere-plaatstermen. Daarom versnipperen ze autoriteit zonder er iets voor terug te geven.`,
    `Van ${live.length} live pagina's voldoen er ${kandidaten.length} aan dit criterium; hieronder de ${top.length} zwakste.`,
    `LET OP: pagina's die hier NIET in staan hebben wél een eigen term. Stel die nooit voor om op te ruimen.`,
    "",
  ];
  for (const k of top) {
    const doel = k.dubbelMet.length === 1
      ? ` -> voor de hand liggend doel: ${k.dubbelMet[0]}`
      : k.dubbelMet.length > 1
      ? ` -> mogelijk doel: ${k.dubbelMet.slice(0, 3).join(" of ")} (deze pagina leent van meerdere; laat Maarten kiezen, gok er zelf geen)`
      : " -> geen doel af te leiden uit de data; vraag Maarten waar deze pagina heen moet of laat hem staan";
    regels.push(`${k.pad} [${k.klikken} klikken, ${k.vertoningen} vertoningen]${doel}`);
    regels.push(`  geen eigen term op: ${k.eigenWoorden.join(", ")}${k.geleendeTop ? `; leent vooral "${k.geleendeTop.keyword}" (positie ${k.geleendeTop.positie}, ${k.geleendeTop.vertoningen} vertoningen)` : "; krijgt helemaal geen vertoningen"}`);
  }

  if (dubbelingen.length) {
    dubbelingen.sort((a, b) => a.klikken - b.klikken);
    regels.push("");
    regels.push(`DUBBELINGEN (${dubbelingen.length}): deze pagina's ranken wél op hun eigen term, maar een andere pagina doet dat duidelijk sterker op precies dezelfde term. Twee pagina's voor hetzelfde onderwerp: samenvoegen, de zwakste omleiden naar de sterkste.`);
    for (const d of dubbelingen.slice(0, 30)) {
      regels.push(`${d.pad} [${d.klikken} klikken, ${d.vertoningen} vertoningen] -> samenvoegen met ${d.dubbelMet[0]}`);
      regels.push(`  eigen term "${d.eigenTerm?.keyword}" op positie ${d.eigenTerm?.positie} met ${d.eigenTerm?.vertoningen} vertoningen, maar ${d.dubbelMet[0]} scoort daar sterker`);
    }
  }

  if (twijfel.length) {
    twijfel.sort((a, b) => a.klikken - b.klikken);
    regels.push("");
    regels.push(`TWIJFELGEVALLEN (${twijfel.length}): deze pagina's ranken op hun eigen term, maar leveren weinig op (minder dan ${minKlikken} klikken en minder dan ${minEigenVertoningen} vertoningen op die term). Ze hebben dus bestaansrecht op papier, maar nauwelijks in de praktijk. Beoordeel ze apart: houden en versterken, of samenvoegen met een sterkere pagina. Stel ze NOOIT zonder meer voor als opruimwerk.`);
    for (const t of twijfel.slice(0, 30)) {
      regels.push(`${t.pad} [${t.klikken} klikken, ${t.vertoningen} vertoningen] eigen term "${t.eigenTerm?.keyword}" op positie ${t.eigenTerm?.positie} met ${t.eigenTerm?.vertoningen} vertoningen`);
    }
  }

  if (zonderData.length) {
    regels.push("");
    regels.push(`NIET TE BEOORDELEN (${zonderData.length}): deze live pagina's krijgen in deze periode geen enkele vertoning. Dat kan betekenen dat ze niets doen, maar het kan ook een functionele pagina zijn (contact, afspraak maken). Doe hier GEEN opruimvoorstel over zonder ze eerst apart te bekijken: ${zonderData.slice(0, 40).join(", ")}${zonderData.length > 40 ? `, en nog ${zonderData.length - 40}` : ""}.`);
  }
  return { ok: true, tekst: regels.join("\n") };
}

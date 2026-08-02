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
};

export type OverlapResultaat = {
  ok: boolean;
  reden?: string;
  doelPad: string;
  doelZoekwoorden: number;
  concurrenten: Concurrent[];
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

  const concurrenten = [...perPagina.values()]
    .filter((c) => c.gedeeld.length > 0)
    .map((c) => ({ ...c, gedeeld: c.gedeeld.sort((a, b) => b.vertoningen - a.vertoningen).slice(0, 6) }))
    .sort((a, b) => b.gedeeldeVertoningen - a.gedeeldeVertoningen)
    .slice(0, 25);

  return { ok: true, doelPad, doelZoekwoorden: doelKw.length, concurrenten };
}

/** De uitkomst als tekst voor de chat: compleet, met de cijfers die een besluit dragen. */
export function overlapAlsTekst(r: OverlapResultaat): string {
  if (!r.ok) return r.reden || "Geen overlap-analyse mogelijk.";
  if (!r.concurrenten.length) return `Geen enkele andere pagina krijgt vertoningen op de zoekwoorden van ${r.doelPad}. Er is hier geen cannibalisatie; stel geen opruiming voor.`;

  const regels: string[] = [
    `OVERLAP-ANALYSE voor ${r.doelPad}, uit Search Console (90 dagen). Dit is de VOLLEDIGE lijst pagina's die vertoningen krijgen op dezelfde zoekwoorden; noem er geen andere bij en laat er geen weg.`,
    `Doelpagina heeft ${r.doelZoekwoorden} zoekwoorden. ${r.concurrenten.length} pagina('s) overlappen daarmee.`,
    "",
    "BESLISREGEL: 'gedeeld' is wat de doelpagina in de weg zit. 'Eigen sterkste zoekterm' is het BESTAANSRECHT van die pagina. Staat een pagina sterk op een eigen term die de doelpagina niet bedient, dan is omleiden verkeerd: dan verlies je dat verkeer. Stel alleen omleiden voor als de pagina vrijwel niets eigens heeft. Noem bij elk advies deze cijfers.",
  ];

  for (const c of r.concurrenten) {
    const statusTekst = c.status !== null && c.status >= 300 && c.status < 400
      ? `AL OMGELEID (${c.status} naar ${c.redirectTarget ? padVan(c.redirectTarget) : "onbekend"}), dus KLAAR: niet voorstellen om op te ruimen`
      : c.status !== null && c.status >= 400 ? `${c.status}, bestaat niet meer`
      : c.status === 200 ? "live" : "status onbekend, controleer met controleer_url";
    regels.push("");
    regels.push(`${c.pad} [${statusTekst}]`);
    regels.push(`  gedeeld met de doelpagina: ${c.gedeeld.map((g) => `"${g.keyword}" (deze pagina positie ${g.positie}, ${g.vertoningen} vertoningen; doelpagina staat daar op ${g.positieDoel ?? "?"})`).join("; ")}`);
    regels.push(`  gedeelde vertoningen totaal: ${c.gedeeldeVertoningen}`);
    if (c.eigenTop) {
      const eigen = r.concurrenten.length && !c.gedeeld.some((g) => g.keyword.toLowerCase() === c.eigenTop!.keyword.toLowerCase());
      regels.push(`  eigen sterkste zoekterm: "${c.eigenTop.keyword}" op positie ${c.eigenTop.positie}, ${c.eigenTop.vertoningen} vertoningen, ${c.eigenTop.klikken} klikken${eigen ? " (die term bedient de doelpagina NIET; dit is bestaansrecht, wees voorzichtig met omleiden)" : ""}`);
    }
    regels.push(`  vertoningen van deze pagina in totaal: ${c.eigenVertoningen}`);
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
        dubbelingen.push({
          pad, url: u.url, eigenWoorden: eigen,
          klikken: g.klikken, vertoningen: g.vertoningen,
          eigenTerm: { keyword: eigenTerm.keyword, positie: eigenTerm.positie, vertoningen: eigenTerm.vertoningen },
          geleendeTop: geleend, dubbelMet: [...new Set(sterker.map((b) => b.pad))],
        });
      }
      continue;                                        // eigen term: verder met rust laten
    }

    const dubbel = eigen.map((w) => bezitter.get(w)).filter((b): b is { pad: string; vertoningen: number } => !!b && b.pad !== pad).map((b) => b.pad);
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
    const doel = k.dubbelMet.length ? ` -> voor de hand liggend doel: ${k.dubbelMet[0]} (die bezit deze term wel)` : " -> geen andere pagina bezit deze term; kies zelf het juiste doel of laat staan";
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

  if (zonderData.length) {
    regels.push("");
    regels.push(`NIET TE BEOORDELEN (${zonderData.length}): deze live pagina's krijgen in deze periode geen enkele vertoning. Dat kan betekenen dat ze niets doen, maar het kan ook een functionele pagina zijn (contact, afspraak maken). Doe hier GEEN opruimvoorstel over zonder ze eerst apart te bekijken: ${zonderData.slice(0, 40).join(", ")}${zonderData.length > 40 ? `, en nog ${zonderData.length - 40}` : ""}.`);
  }
  return { ok: true, tekst: regels.join("\n") };
}

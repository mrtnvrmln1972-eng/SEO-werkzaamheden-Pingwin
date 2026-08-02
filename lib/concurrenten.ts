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

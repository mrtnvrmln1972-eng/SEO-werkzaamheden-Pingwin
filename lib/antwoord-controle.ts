// ═══════════════════════════════════════════════════════════
// FEITENCONTROLE OP EEN ANTWOORD, VOORDAT MAARTEN HET ZIET
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat. In de bird's eye van One Day Clinic stond een tabel met
// Ahrefs-posities (3/3/4/7) en verwijzende domeinen (112/84/77/63) die nooit
// was opgehaald, plus vier URL's die niet bestonden. In de prompt staat al
// "verzin geen cijfers" en "noem nooit een URL die niet in de context staat",
// maar dat zijn woorden. Er was niets dat het tegenhield, dus Maarten was de
// controle. Dat is precies de fout die we eerder ook bij de taak-knopjes
// maakten: erop vertrouwen dat het goed gaat in plaats van het af te dwingen.
//
// Wat dit wel doet: elk pad en elk hard cijfer in het antwoord wordt gelegd
// naast de context én naast wat de tools in DEZE beurt echt teruggaven. Wat
// daar niet in voorkomt, is niet bewezen.
//
// Wat dit NIET doet, en dat moet eerlijk gezegd worden: een verkeerde
// REDENERING over kloppende cijfers vangt dit niet. Het bewaakt herkomst, niet
// oordeel.
// ═══════════════════════════════════════════════════════════

export type ControleResultaat = {
  ok: boolean;
  paden: string[];    // genoemd, maar nergens terug te vinden
  cijfers: string[];  // beweerd, maar niet in bron of tool-uitvoer
};

// Normaliseren zodat /pad, /pad/ en /Pad/ hetzelfde zijn.
const normPad = (p: string) => "/" + (p || "").toLowerCase().replace(/^\/+|\/+$/g, "") + "/";

// Getallen los van opmaak vergelijken: 3.631 / 3631 / 3,6 / 3.6 zijn hetzelfde getal.
function getalVarianten(n: string): string[] {
  const kaal = n.replace(/[.\s]/g, "").replace(",", ".");
  const uit = new Set([n, kaal, kaal.replace(".", ","), n.replace(".", ""), n.replace(",", ".")]);
  const num = Number(kaal);
  if (Number.isFinite(num)) {
    uit.add(String(num));
    uit.add(String(Math.round(num)));
    uit.add(num.toFixed(1));
    uit.add(num.toFixed(1).replace(".", ","));
  }
  return [...uit].filter(Boolean);
}

// De claims die we hard kunnen toetsen, omdat ze letterlijk uit een bron komen.
// Bewust smal gehouden: liever een paar soorten goed bewaken dan overal vals alarm.
//
// Per soort staat er ook een patroon voor de BRON. Dat is essentieel: een losse
// "3" komt in elke tekst wel ergens voor, dus "positie 3" zou anders altijd als
// bewezen gelden terwijl het verzonnen is. Een positie telt daarom alleen als
// bewezen wanneer hij in de bron óók als positie is teruggegeven.
const CIJFER_PATRONEN: { label: string; inAntwoord: RegExp; inBron: RegExp }[] = [
  { label: "positie", inAntwoord: /\b(?:positie|pos\.?)\s*:?\s*(\d{1,3}(?:[.,]\d)?)/gi, inBron: /\b(?:positie|pos\.?)\s*:?\s*(\d{1,3}(?:[.,]\d+)?)/gi },
  { label: "domain rating", inAntwoord: /\bDR\s*:?\s*(\d{1,3})/gi, inBron: /\bDR\s*:?\s*(\d{1,3})/gi },
  { label: "verwijzende domeinen", inAntwoord: /(\d{1,6})\s*verwijzende\s+domeinen/gi, inBron: /verwijzende\s+domeinen[^0-9\n]{0,30}(\d{1,6})|(\d{1,6})\s*verwijzende\s+domeinen/gi },
  { label: "woorden", inAntwoord: /(\d{1,3}(?:[.,]\d{3})*|\d{2,6})\s*woorden/gi, inBron: /woorden\s*:?\s*(\d{1,3}(?:[.,]\d{3})*|\d{2,6})|(\d{1,3}(?:[.,]\d{3})*|\d{2,6})\s*woorden/gi },
  { label: "vertoningen", inAntwoord: /(\d{1,3}(?:[.,]\d{3})*|\d{2,7})\s*(?:vertoningen|impressies)/gi, inBron: /(\d{1,3}(?:[.,]\d{3})*|\d{2,7})\s*(?:vertoningen|impressies)/gi },
];

// Paden die niets met de klantsite te maken hebben (opmaak, mail-links, datums).
const NEGEER_PAD = /^\/(\d+|https?|www|search|thread|mail)\/?$/i;

// Welke bron een cijfersoort levert, voor een precieze waarschuwing. Zonder dit
// noemde de waarschuwing altijd alle drie bronnen ("Search Console, Ahrefs of de
// sitemap"), ook als er voor dát ene cijfer maar één relevant was: domain rating
// bijvoorbeeld bestaat alleen bij Ahrefs, Search Console kent dat begrip niet.
// Dat gaf de indruk dat de verkeerde bron was geraadpleegd, terwijl de bron er
// domweg (nog) niet bij was.
export const CIJFER_BRON: Record<string, string> = {
  "positie": "Search Console of Ahrefs",
  "domain rating": "Ahrefs",
  "verwijzende domeinen": "Ahrefs",
  "woorden": "de pagina zelf",
  "vertoningen": "Search Console",
};

/**
 * Toetst een antwoord tegen alles wat er in deze beurt echt beschikbaar was.
 * @param antwoord   de tekst die naar Maarten zou gaan
 * @param bronnen    context + alle tool-uitvoer van deze beurt, achter elkaar
 * @param bekendePaden alle paden die de klantsite echt heeft (uit client_urls)
 */
export function controleerAntwoord(antwoord: string, bronnen: string, bekendePaden: string[]): ControleResultaat {
  const tekst = antwoord || "";
  const bron = (bronnen || "").toLowerCase();
  const bekend = new Set(bekendePaden.map(normPad));

  // 1. Paden. Alleen echte site-paden met minstens één streepje of twee niveaus,
  //    zodat gewone tekst met een schuine streep geen vals alarm geeft.
  const paden = new Set<string>();
  for (const m of tekst.matchAll(/(?<![\w:])\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\/?(?![\w@])/gi)) {
    const rauw = m[0];
    if (NEGEER_PAD.test(rauw)) continue;
    if (!/[-/]/.test(rauw.replace(/^\/|\/$/g, ""))) continue;   // te generiek ("/test")
    const p = normPad(rauw);
    if (bekend.has(p)) continue;
    if (bron.includes(p.slice(0, -1)) || bron.includes(p)) continue;  // stond in context of tool-uitvoer
    paden.add(rauw);
  }

  // 2. Cijferclaims. Een getal telt als bewezen zodra het ergens in de bronnen
  //    voorkomt; we koppelen het niet aan de exacte pagina, want dat zou te veel
  //    vals alarm geven. Doel is verzonnen getallen vangen, niet muggenziften.
  const cijfers = new Set<string>();
  for (const { label, inAntwoord, inBron } of CIJFER_PATRONEN) {
    // Eerst: welke waarden gaf de bron voor dít soort claim echt terug?
    const toegestaan = new Set<string>();
    for (const b of bron.matchAll(inBron)) {
      const waarde = b[1] || b[2];
      if (waarde) for (const v of getalVarianten(waarde)) toegestaan.add(v.toLowerCase());
    }
    for (const m of tekst.matchAll(inAntwoord)) {
      const waarde = m[1];
      if (!waarde) continue;
      if (getalVarianten(waarde).some((v) => toegestaan.has(v.toLowerCase()))) continue;
      cijfers.add(`${label} ${waarde}`);
    }
  }

  return { ok: paden.size === 0 && cijfers.size === 0, paden: [...paden].slice(0, 12), cijfers: [...cijfers].slice(0, 12) };
}

/** De opdracht die de assistent krijgt om het antwoord te herstellen. */
export function herstelOpdracht(r: ControleResultaat): string {
  const delen: string[] = [
    "STOP. Je antwoord is tegengehouden door de feitencontrole en is NIET aan Maarten getoond.",
    "Het bevat dingen die nergens uit blijken: niet uit de context, en niet uit een tool die je in deze beurt hebt aangeroepen.",
  ];
  if (r.paden.length) {
    delen.push(`\nDeze paden staan niet in de bekende URL-lijst en komen in geen enkele tool-uitvoer voor: ${r.paden.join(", ")}.`);
    delen.push("Vorm nooit zelf een pad. Bestaat de pagina echt, controleer hem dan met controleer_url en gebruik het pad dat daar uitkomt. Kun je hem niet vinden, laat hem dan helemaal weg.");
  }
  if (r.cijfers.length) {
    delen.push(`\nDeze cijfers heb je niet opgehaald: ${r.cijfers.join("; ")}.`);
    delen.push("Haal ze NU echt op met het juiste gereedschap (gsc_pagina voor Search Console, ahrefs_pagina voor Ahrefs, meet_pagina voor woorden en meta, serp_top10 voor DR van concurrenten), of laat het cijfer weg en schrijf er 'niet gemeten' bij. Nooit een getal invullen dat plausibel lijkt.");
  }
  delen.push("\nGeef nu het volledige antwoord opnieuw, zonder de onbewezen delen. Zet achter elk rankingcijfer de bron, bijvoorbeeld 'positie 3,6 (Search Console, 90 dagen)'. Begin direct met het eerste kopje, zonder excuses of aankondiging.");
  return delen.join("\n");
}

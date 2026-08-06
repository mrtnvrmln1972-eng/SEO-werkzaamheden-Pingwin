// Wat de chat heeft opgezocht, in gewone taal.
//
// Waarom dit bestaat: je kon aan een antwoord niet zien of er echt gemeten was of
// dat er iets werd aangenomen. Daar zijn in de loop van de tijd tientallen
// "verzin geen cijfers"-regels en een hele feitencontrole voor gebouwd. Dit is de
// simpele kant van dezelfde vraag: laat gewoon zien welke bronnen zijn geraadpleegd.
// Onder elk antwoord komt een ingeklapt regeltje; standaard dicht, dus het staat niets
// in de weg.

export type Bron = { naam: string; detail: string };

// Per gereedschap: hoe noemen we het, en welk invoerveld is het interessante detail.
const LABELS: Record<string, { label: string; velden: string[] }> = {
  meet_pagina: { label: "Pagina gelezen", velden: ["url"] },
  controleer_url: { label: "Status gecontroleerd", velden: ["url"] },
  fetch_page_content: { label: "Pagina gelezen", velden: ["url"] },
  check_afbeeldingen_alt: { label: "Afbeeldingen gecontroleerd", velden: ["url"] },
  gsc_pagina: { label: "Search Console", velden: ["url"] },
  ahrefs_pagina: { label: "Ahrefs, pagina", velden: ["url"] },
  ahrefs_url_organic_keywords: { label: "Ahrefs, pagina", velden: ["url"] },
  ahrefs_site: { label: "Ahrefs, autoriteit", velden: ["target", "domein"] },
  ahrefs_site_authority: { label: "Ahrefs, autoriteit", velden: ["target"] },
  ahrefs_keyword_volume: { label: "Ahrefs, zoekvolume", velden: ["keywords", "keyword"] },
  ahrefs_keyword_ideas: { label: "Ahrefs, zoekwoord-ideeën", velden: ["seed"] },
  serp_top10: { label: "Top 10 bekeken", velden: ["keyword", "zoekwoord"] },
  ahrefs_serp_top10: { label: "Top 10 bekeken", velden: ["keyword"] },
  zoek_mail: { label: "Mail doorzocht", velden: ["zoekterm"] },
  lees_document: { label: "Document gelezen", velden: ["link"] },
  lees_dossier: { label: "Dossierstuk gelezen", velden: ["titel", "id"] },
  zoek_dossier: { label: "Dossier doorzocht", velden: ["zoekterm"] },
  pagina_dossier: { label: "Paginadossier bekeken", velden: ["url"] },
  site_overzicht: { label: "Site-breed overzicht opgehaald", velden: [] },
  concurrerende_paginas: { label: "Concurrerende pagina's opgezocht", velden: ["url"] },
  dunne_paginas: { label: "Dunne pagina's opgezocht", velden: [] },
  interne_link_kansen: { label: "Interne-linkkansen berekend", velden: ["url"] },
  cannibalisatie_analyse: { label: "Cannibalisatie-analyse geraadpleegd", velden: [] },
  bewaar_in_dossier: { label: "In het dossier bewaard", velden: ["titel"] },
  maak_document: { label: "Document gemaakt", velden: ["titel", "soort"] },
};

// Gereedschap dat iets DOET in plaats van iets opzoekt. Dat is geen bron en hoort
// niet in de strip; de gebruiker ziet het resultaat er al van (een kaart, een document).
const GEEN_BRON = new Set(["stel_acties_voor"]);

const kort = (s: string, max = 70): string => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
};

// Een pad is prettiger te lezen dan een volledige URL, en wordt in het scherm
// automatisch klikbaar. Externe URL's laten we heel.
const padOfUrl = (s: string, eigenDomein?: string): string => {
  try {
    const u = new URL(s);
    if (!eigenDomein || u.hostname.replace(/^www\./, "") === eigenDomein.replace(/^www\./, "")) {
      return u.pathname === "/" ? "de homepage" : u.pathname;
    }
    return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return s;
  }
};

const detailUit = (invoer: Record<string, unknown>, velden: string[], eigenDomein?: string): string => {
  for (const veld of velden) {
    const v = invoer[veld];
    if (Array.isArray(v) && v.length) return kort(v.map(String).join(", "));
    if (typeof v === "string" && v.trim()) {
      const s = v.trim();
      return kort(/^https?:\/\//i.test(s) ? padOfUrl(s, eigenDomein) : s);
    }
  }
  // Onbekend gereedschap: pak de eerste bruikbare tekstwaarde die er is.
  for (const v of Object.values(invoer)) {
    if (typeof v === "string" && v.trim()) return kort(v.trim());
    if (Array.isArray(v) && v.length) return kort(v.map(String).join(", "));
  }
  return "";
};

/** Zet één gereedschap-aanroep om in een leesbare bronregel. Geeft null voor
 *  gereedschap dat iets doet in plaats van opzoekt. */
export function bronVan(naam: string, invoer: Record<string, unknown>, eigenDomein?: string): Bron | null {
  if (GEEN_BRON.has(naam)) return null;
  const spec = LABELS[naam];
  const label = spec ? spec.label : naam.replace(/_/g, " ");
  const detail = detailUit(invoer || {}, spec ? spec.velden : [], eigenDomein);
  return { naam: label, detail };
}

/** Dubbele aanroepen samenvouwen, zodat drie keer dezelfde pagina één regel wordt. */
export function ontdubbel(bronnen: Bron[]): Bron[] {
  const gezien = new Set<string>();
  const uit: Bron[] = [];
  for (const b of bronnen) {
    const sleutel = `${b.naam}|${b.detail}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(b);
  }
  return uit;
}

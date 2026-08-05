// De meta's die al in een copy-document staan.
//
// Waarom dit bestaat: de copy-pijplijn schrijft in elk copy-document een
// meta-title en meta-description, met exact dezelfde regels en dezelfde
// pixel-correctielus als de meta-machine (zie enforceMetaInSpec in page-doc.ts).
// Er komt daar dus geen andere soort meta uit.
//
// Toch schreef de werklijst er nog een tweede, en zou de meta-machine er een
// derde bij schrijven. Dat is puur ruis: drie teksten voor één zoekresultaat,
// zonder dat iemand weet welke telt. Vanaf nu is de regel: staat er al een
// meta in het copydocument, dan is dát de tekst. De machine oordeelt over wat
// er live staat en of dat voldoet, niet over wie het geschreven heeft.
//
// Het document is platte tekst (specToText plat de DocSpec af). De meta kan er
// op twee manieren in staan, en beide vormen komen hier binnen:
//
//   1. Als regel uit de SEO-metadata-tabel:  Meta-title | De tekst | 52
//   2. Als kopje met de waarde eronder:      ### Paginatitel (meta-title)
//                                            De tekst
//
// Dezelfde twee patronen die findMetaSpots in page-doc.ts herkent; ze staan
// hier bewust náást elkaar en niet gedeeld, want daar werkt het op de
// gestructureerde DocSpec en hier op de opgeslagen platte tekst.

import { sql, ensureSchema } from "./db";

export type CopydocMeta = { title: string; desc: string };

/** Herkent "meta-title"/"paginatitel" en "meta-description"/"meta-beschrijving". */
function soortVan(label: string): "title" | "desc" | null {
  if (/meta[\s-]?description|meta[\s-]?beschrijving/i.test(label)) return "desc";
  if (/meta[\s-]?title|paginatitel/i.test(label)) return "title";
  return null;
}

/** Sterretjes, aanhalingstekens en losse dubbele punten eraf. */
function schoon(s: string): string {
  return (s || "")
    .replace(/\*\*/g, "")
    .trim()
    .replace(/^["'“”„]+|["'“”„]+$/g, "")
    .trim();
}

/**
 * Haalt de meta-title en meta-description uit de tekst van een copy-document.
 * Geeft lege strings terug als ze er niet in staan; dat is geen fout, niet elk
 * document heeft een metadata-sectie.
 */
export function metaUitCopydoc(content: string): CopydocMeta {
  const uit: CopydocMeta = { title: "", desc: "" };
  const regels = (content || "").split("\n");
  for (let i = 0; i < regels.length; i++) {
    const r = regels[i].trim();
    if (!r) continue;

    // Patroon 1: tabelregel "Meta-title | De tekst | 52". De kolom met het
    // tekenaantal negeren we; die is puur ter informatie in het document.
    if (r.includes("|")) {
      const cellen = r.split("|").map((c) => schoon(c));
      const soort = soortVan(cellen[0] || "");
      // Een kopregel ("Element | Waarde | Tekens") heeft geen echte waarde.
      if (soort && cellen[1] && !/^waarde$/i.test(cellen[1])) {
        if (!uit[soort]) uit[soort] = cellen[1];
        continue;
      }
    }

    // Patroon 2: kopje (of een korte labelregel), met de waarde op de
    // eerstvolgende gevulde regel. De lengtegrens houdt gewone alinea's die
    // toevallig het woord "meta-description" noemen buiten de deur.
    const kop = /^#{1,4}\s*(.+?)\s*$/.exec(r);
    const label = kop ? kop[1] : (r.length <= 80 ? r : "");
    const soort = soortVan(label);
    if (!soort || uit[soort]) continue;

    // Staat de waarde achter een dubbele punt op dezelfde regel, pak die.
    const opzelfde = /:\s*(.+)$/.exec(r);
    if (opzelfde && schoon(opzelfde[1])) { uit[soort] = schoon(opzelfde[1]); continue; }

    for (let j = i + 1; j < Math.min(i + 4, regels.length); j++) {
      const v = schoon(regels[j]);
      // Sla lege regels over; stop bij het volgende kopje.
      if (!v) continue;
      if (/^#{1,4}\s/.test(regels[j].trim())) break;
      uit[soort] = v;
      break;
    }
  }
  return uit;
}

/**
 * De copydoc-meta's van een klant, per pagina-URL. Leest de geldende versie van
 * elk copy-document; pagina's zonder meta in het document blijven weg.
 */
export async function getCopydocMetas(slug: string): Promise<Map<string, CopydocMeta>> {
  await ensureSchema();
  const uit = new Map<string, CopydocMeta>();
  const { rows } = await sql`
    SELECT url, content FROM page_doc_outputs
    WHERE client_slug = ${slug} AND kind = 'copy' AND content IS NOT NULL AND content <> ''`;
  for (const r of rows) {
    const m = metaUitCopydoc(String(r.content || ""));
    if (m.title || m.desc) uit.set(String(r.url), m);
  }
  return uit;
}

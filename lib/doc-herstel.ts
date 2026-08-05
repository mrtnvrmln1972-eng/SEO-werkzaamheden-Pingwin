// ═══════════════════════════════════════════════════════════
// ZOEKGERAAKTE DOCUMENTEN ALSNOG IN DRIVE
// ═══════════════════════════════════════════════════════════
// De pijplijn bewaart de tekst van een analyse, blauwdruk of copy ALTIJD in de
// database, maar maakt er alleen een bestand van als er op dat moment een
// Drive-map is ingesteld. Was die er niet, dan bleef de tekst achter zonder
// bestand en zonder melding.
//
// Zo staan er bij Paul Hoevenaars drie documenten van 2 juli: analyse, blauwdruk
// en copy. Ze bestaan, maar er is geen link, dus je kunt ze niet openen en niet
// naar de sitebouwer sturen.
//
// Dit maakt van die opgeslagen tekst alsnog het Pingwin-document in de huisstijl,
// zet het in de map van de pagina, en legt de link vast. De tekst is de bron, dus
// er wordt niets opnieuw verzonnen en de inhoud verandert niet.

import { sql, ensureSchema } from "./db";
import { getPageDriveFolder } from "./site-urls";
import { getStepLinksAll } from "./page-doc-run";
import { copyNaarSecties } from "./copy-doc-klant";
import { buildPingwinDoc, type DocSpec } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { registerGeneratedVersion } from "./doc-versions";
import { urlKey } from "./url-key";
import { getClientBySlug } from "./clients";

const LABEL: Record<string, string> = { analyse: "SEO-analyse", blauwdruk: "Blauwdruk", copy: "Copywriting" };

function padVan(u: string): string {
  try { const x = new URL(u); return x.pathname.replace(/\/+$/, "") || "/"; } catch { return u; }
}
// Bestandsnaam in dezelfde stijl als de pijplijn zelf gebruikt.
function bestandsnaam(kind: string, url: string, datum: string): string {
  const pad = padVan(url).replace(/^\//, "").replace(/\//g, "-") || "home";
  return `${LABEL[kind] || kind}-${pad}-${datum.slice(0, 10)}`;
}

// De opgeslagen tekst begint met "# Titel"; die halen we eruit voor de omslag.
function titelUit(tekst: string, kind: string, url: string): string {
  for (const raw of (tekst || "").split("\n")) {
    const m = /^#\s+(.+)$/.exec(raw.trim());
    if (m) return m[1].trim();
  }
  return `${LABEL[kind] || kind} ${padVan(url)}`;
}

export type HerstelResultaat = {
  bekeken: number;
  hersteld: number;
  overgeslagen: { url: string; kind: string; reden: string }[];
};

/**
 * Herstelt alle documenten van een klant die wel tekst maar geen bestand hebben.
 * Faalt nooit hard: wat niet lukt komt met een reden terug, de rest gaat door.
 */
export async function herstelDocumenten(slug: string): Promise<HerstelResultaat> {
  await ensureSchema();
  const client = await getClientBySlug(slug);

  const [outputs, links] = await Promise.all([
    sql`SELECT url, kind, content, updated_at FROM page_doc_outputs
        WHERE client_slug = ${slug} AND kind IN ('analyse','blauwdruk','copy')
          AND content IS NOT NULL AND content <> ''`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    getStepLinksAll(slug).catch(() => ({} as Record<string, { analyse: string; blauwdruk: string; copy: string }>)),
  ]);

  // Documenten die al een link hebben (uit de pijplijn of uit het versie-archief)
  // slaan we over: daar valt niets te herstellen.
  const metVersie = await sql`SELECT url, kind FROM page_doc_versions
                              WHERE client_slug = ${slug} AND drive_link IS NOT NULL AND drive_link <> ''`
    .then((r) => new Set(r.rows.map((x) => `${urlKey(String(x.url))}|${x.kind}`)))
    .catch(() => new Set<string>());

  const uit: HerstelResultaat = { bekeken: 0, hersteld: 0, overgeslagen: [] };

  for (const o of outputs) {
    const url = String(o.url || "");
    const kind = String(o.kind || "");
    const tekst = String(o.content || "");
    if (!url || !tekst) continue;
    const k = urlKey(url);
    if ((links[k] as Record<string, string> | undefined)?.[kind]) continue;   // pijplijn had al een link
    if (metVersie.has(`${k}|${kind}`)) continue;                              // archief had al een link
    uit.bekeken++;

    const map = await getPageDriveFolder(slug, url).catch(() => null);
    const folderId = map?.folderId || "";
    if (!folderId) {
      uit.overgeslagen.push({ url, kind, reden: "Voor deze pagina is nog geen Drive-map ingesteld." });
      continue;
    }

    try {
      const datum = o.updated_at ? new Date(o.updated_at as string).toISOString() : new Date().toISOString();
      const spec: DocSpec = {
        klant: client?.name || slug,
        rapporttype: LABEL[kind] || kind,
        titel: titelUit(tekst, kind, url),
        ondertitel: padVan(url),
        meta: { Klant: client?.name || slug, Pagina: padVan(url), Datum: datum.slice(0, 10) },
        // Hergebruikt de bestaande parser: de opgeslagen tekst heeft exact het
        // formaat dat copyNaarSecties verwacht (# titel, ## kop, ### subkop).
        sections: copyNaarSecties(tekst),
      };
      const buffer = await buildPingwinDoc(spec);
      const { link } = await uploadDocx(folderId, bestandsnaam(kind, url, datum), buffer);
      await registerGeneratedVersion(
        slug, url, kind, bestandsnaam(kind, url, datum), link, tekst,
        "Alsnog aangemaakt uit de eerder opgeslagen tekst; inhoud ongewijzigd.",
      );
      uit.hersteld++;
    } catch (e) {
      uit.overgeslagen.push({ url, kind, reden: (e as Error).message || "Aanmaken mislukte." });
    }
  }
  return uit;
}

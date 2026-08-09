// ═══════════════════════════════════════════════════════════
// ALLE DOCUMENTEN VAN EEN KLANT OP ÉÉN PLEK
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: analyses, blauwdrukken en copy zaten wél in het systeem,
// maar alleen verstopt per pagina. Er was nergens één lijst met "wat hebben we
// voor deze klant gemaakt, wanneer, en staat het inmiddels op de site". Daardoor
// raakte het overzicht kwijt zodra de takenpagina veranderde.
//
// Drie bronnen worden hier samengevoegd tot één beeld per pagina:
//  - page_doc_versions: het versie-archief (naam, Drive-link, datum). Leidend.
//  - page_doc_outputs:  de geldende tekst per pagina en soort, voor documenten van
//                       vóór het versie-archief.
//  - page_doc_runs:     de links die de pijplijn zelf opleverde (getStepLinksAll).
// Zo raakt niets uit beeld, ook niet wat er al lag.

import { sql, ensureSchema } from "./db";
import { KIND_LABEL } from "./doc-versions";
import { getStepLinksAll } from "./page-doc-run";
import { getCopyLiveAll } from "./copy-live";
import { urlKey } from "./url-key";

export type DocRij = {
  kind: string;
  label: string;
  naam: string;
  link: string;
  datum: string | null;
};

export type DocPagina = {
  url: string;
  pad: string;
  doorgevoerd: boolean | null;   // null = nog niet gemeten
  docs: DocRij[];
  laatste: string | null;        // datum van het jongste document, voor de maandindeling
};

function pathOf(u: string): string {
  try { const x = new URL(u); return x.pathname + x.search; } catch { return u; }
}

/**
 * Alle documenten per pagina, jongste eerst. Faalt nooit hard op een deelbron:
 * ontbreekt er één, dan is het overzicht magerder maar nog steeds bruikbaar.
 */
export async function getDocumentenOverzicht(slug: string): Promise<DocPagina[]> {
  await ensureSchema();

  const [versies, outputs, links, copyLive] = await Promise.all([
    sql`SELECT url, kind, naam, drive_link, created_at
        FROM page_doc_versions
        WHERE client_slug = ${slug} AND status = 'verwerkt'
        ORDER BY created_at DESC`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT url, kind, updated_at FROM page_doc_outputs WHERE client_slug = ${slug}`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    getStepLinksAll(slug).catch(() => ({} as Record<string, { analyse: string; blauwdruk: string; copy: string }>)),
    getCopyLiveAll(slug).catch(() => ({} as Record<string, { doorgevoerd: boolean; meetbaar: boolean }>)),
  ]);

  // Per pagina en soort houden we het jongste document. Het versie-archief wint,
  // want daar staat de echte naam en de Drive-link bij.
  const perPagina = new Map<string, { url: string; docs: Map<string, DocRij> }>();
  const zorg = (url: string) => {
    const k = urlKey(url);
    let p = perPagina.get(k);
    if (!p) { p = { url, docs: new Map() }; perPagina.set(k, p); }
    return p;
  };

  for (const r of versies) {
    const url = String(r.url || "");
    if (!url) continue;
    const kind = String(r.kind || "overig");
    const p = zorg(url);
    if (p.docs.has(kind)) continue;  // al een jongere versie gezien (query is DESC)
    p.docs.set(kind, {
      kind,
      label: KIND_LABEL[kind] || kind,
      naam: String(r.naam || "") || (KIND_LABEL[kind] || kind),
      link: String(r.drive_link || ""),
      datum: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    });
  }

  for (const r of outputs) {
    const url = String(r.url || "");
    if (!url) continue;
    const kind = String(r.kind || "overig");
    const p = zorg(url);
    if (p.docs.has(kind)) continue;  // het versie-archief is al vollediger
    const uitPijplijn = links[urlKey(url)] || { analyse: "", blauwdruk: "", copy: "" };
    p.docs.set(kind, {
      kind,
      label: KIND_LABEL[kind] || kind,
      naam: KIND_LABEL[kind] || kind,
      link: (uitPijplijn as Record<string, string>)[kind] || "",
      datum: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    });
  }

  // Documenten zonder link krijgen er alsnog een als de pijplijn er wel één heeft.
  for (const [k, p] of perPagina) {
    const uitPijplijn = links[k] as Record<string, string> | undefined;
    if (!uitPijplijn) continue;
    for (const [kind, doc] of p.docs) if (!doc.link && uitPijplijn[kind]) doc.link = uitPijplijn[kind];
  }

  const volgorde = ["analyse", "blauwdruk", "copy", "structured", "overig"];
  const uit: DocPagina[] = [];
  for (const [k, p] of perPagina) {
    const docs = [...p.docs.values()].sort((a, b) => volgorde.indexOf(a.kind) - volgorde.indexOf(b.kind));
    const datums = docs.map((d) => d.datum).filter(Boolean) as string[];
    uit.push({
      url: p.url,
      pad: pathOf(p.url),
      // Alleen een oordeel als de pagina echt gelezen kon worden.
      doorgevoerd: copyLive[k]?.meetbaar ? copyLive[k].doorgevoerd : null,
      docs,
      laatste: datums.length ? datums.sort().pop()! : null,
    });
  }
  // Jongste werk bovenaan; pagina's zonder datum onderaan.
  return uit.sort((a, b) => (b.laatste || "").localeCompare(a.laatste || ""));
}

/** Kort voor de Fundament-tegel en de onboarding-stand: alleen het aantal en de jongste datum. */
export async function telDocumenten(slug: string): Promise<{ aantal: number; sinds: string | null }> {
  try {
    const paginas = await getDocumentenOverzicht(slug);
    const aantal = paginas.reduce((n, p) => n + p.docs.length, 0);
    const sinds = paginas.reduce((s, p) => (p.laatste && (!s || p.laatste > s) ? p.laatste : s), null as string | null);
    return { aantal, sinds };
  } catch { return { aantal: 0, sinds: null }; }
}

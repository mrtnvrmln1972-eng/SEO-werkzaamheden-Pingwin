// Het logboek eenmalig vullen met wat er al achter ons ligt.
//
// De afgelopen maanden staan al in de bestaande tabellen, elk met een bruikbaar
// tijdstempel. Dit leest die één keer uit, zodat je meteen een gevulde tijdlijn hebt
// in plaats van vanaf nul te beginnen.
//
// Veilig te herhalen: elke regel draagt zijn herkomst mee en de tabel heeft daar een
// unieke index op, dus nog een keer draaien voegt niets toe.
//
// Vanaf nu schrijft het dashboard zelf mee op het moment dat er iets gebeurt; dit is
// puur de inhaalslag.

import { sql, ensureSchema } from "./db";
import { logActiviteiten, type LogInput, type ActiviteitSoort } from "./activiteit";
import { diffKlantTekst, type ContentDiff } from "./content-diff";
import { getAfgerondeTaken } from "./tasks";

const DOC_SOORT: Record<string, ActiviteitSoort> = {
  analyse: "analyse", blauwdruk: "blauwdruk", copy: "copy", structured: "structured",
};

export type VulResultaat = { gevonden: number; perSoort: Record<string, number> };

export async function vulActiviteitUitBestaandeData(slug: string): Promise<VulResultaat> {
  await ensureSchema();
  const rijen: LogInput[] = [];
  const stil = async <T>(p: Promise<T>, leeg: T): Promise<T> => p.catch(() => leeg);

  // 1. Opgeleverde documenten (versie-archief): analyse, blauwdruk, copy.
  const versies = await stil(
    sql`SELECT id, url, kind, naam, drive_link, created_at FROM page_doc_versions
        WHERE client_slug = ${slug} AND status = 'verwerkt' ORDER BY created_at`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const v of versies) {
    const soort = DOC_SOORT[String(v.kind || "")];
    if (!soort) continue;
    rijen.push({
      slug, soort, bron: "page_doc_versions", bronId: Number(v.id),
      gebeurdeOp: v.created_at as string, url: (v.url as string) || null,
      bewijs: (v.drive_link as string) || null,
    });
  }

  // 2. Documenten van vóór het versie-archief (alleen de geldende versie bekend).
  const outputs = await stil(
    sql`SELECT url, kind, updated_at FROM page_doc_outputs WHERE client_slug = ${slug}`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const o of outputs) {
    const soort = DOC_SOORT[String(o.kind || "")];
    if (!soort) continue;
    rijen.push({
      slug, soort, bron: "page_doc_outputs", bronId: `${o.url}|${o.kind}`,
      gebeurdeOp: o.updated_at as string, url: (o.url as string) || null,
    });
  }

  // 3. Meta-teksten die echt live zijn gezet (live_at, niet alleen voorgesteld).
  const metas = await stil(
    sql`SELECT id, page_url, live_at FROM meta_proposals
        WHERE client_slug = ${slug} AND live_at IS NOT NULL`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const m of metas) {
    rijen.push({
      slug, soort: "meta", bron: "meta_proposals", bronId: Number(m.id),
      gebeurdeOp: m.live_at as string, url: (m.page_url as string) || null,
    });
  }

  // 4. Werk dat de sitebouwer afvinkte op de deelbare werklijst.
  const dev = await stil(
    sql`SELECT client_slug, item_key, done_at, done_by FROM dev_worklist_marks
        WHERE client_slug = ${slug} AND done = true AND done_at IS NOT NULL`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const d of dev) {
    const key = String(d.item_key || "");
    // De sleutel vertelt of het om een alt-tekst of om een meta ging: dev-worklist.ts
    // bouwt ze als "a|bestand" (alt) en "m|url|veld" (meta).
    const soort: ActiviteitSoort = key.startsWith("a|") ? "alt" : "meta";
    rijen.push({
      slug, soort, bron: "dev_worklist_marks", bronId: key,
      gebeurdeOp: d.done_at as string, wie: "Sitebouwer",
      intern: `${soort === "alt" ? "Alt-tekst" : "Meta-tekst"} doorgevoerd door de sitebouwer${d.done_by ? ` (${d.done_by})` : ""}`,
    });
  }

  // 5. Structured data die is toegepast en gecontroleerd.
  const schemas = await stil(
    sql`SELECT url, status, updated_at FROM client_page_schema
        WHERE client_slug = ${slug} AND status = 'done'`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const s of schemas) {
    rijen.push({
      slug, soort: "structured", bron: "client_page_schema", bronId: String(s.url),
      gebeurdeOp: s.updated_at as string, url: (s.url as string) || null,
    });
  }

  // 6. Gezette redirects.
  const redirects = await stil(
    sql`SELECT id, page_url, from_path, to_path, executed_at FROM page_redirects
        WHERE slug = ${slug}`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const r of redirects) {
    rijen.push({
      slug, soort: "redirect", bron: "page_redirects", bronId: Number(r.id),
      gebeurdeOp: r.executed_at as string, url: (r.page_url as string) || null,
      intern: `Redirect ${r.from_path} → ${r.to_path}`,
    });
  }

  // 7. Wijzigingen die op een live pagina zijn gedetecteerd. Standaard niet zichtbaar
  //    voor de klant: dit kan net zo goed een aanpassing van henzelf zijn.
  const changes = await stil(
    sql`SELECT id, url, detected_at, change_summary, diff FROM page_change_events
        WHERE client_slug = ${slug} ORDER BY detected_at DESC LIMIT 300`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const c of changes) {
    const samenvatting = String(c.change_summary || "").trim();
    const diff = (c.diff as ContentDiff) || {};
    rijen.push({
      slug, soort: "paginawijziging", bron: "page_change_events", bronId: Number(c.id),
      gebeurdeOp: c.detected_at as string, url: (c.url as string) || null,
      intern: samenvatting ? `Pagina aangepast: ${samenvatting.slice(0, 200)}` : "Pagina aangepast",
      klant: diffKlantTekst(diff, samenvatting || "Pagina aangepast"),
    });
  }

  // 8. Copy die aantoonbaar live staat.
  const live = await stil(
    sql`SELECT url, checked_at FROM page_copy_live
        WHERE client_slug = ${slug} AND live = true`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const l of live) {
    rijen.push({
      slug, soort: "copy-live", bron: "page_copy_live", bronId: String(l.url),
      gebeurdeOp: l.checked_at as string, url: (l.url as string) || null,
    });
  }

  // 9. Taken die nu al op Klaar/Verwerkt staan (ook de taken van vóór deze
  //    uitbreiding). Geen exacte afrondingsdatum bekend, dus updated_at als
  //    beste benadering; zie de toelichting bij getAfgerondeTaken.
  const taken = await stil(getAfgerondeTaken(slug), [] as Awaited<ReturnType<typeof getAfgerondeTaken>>);
  for (const t of taken) {
    rijen.push({
      slug, soort: "taak", bron: "client_tasks", bronId: t.identiteit,
      gebeurdeOp: t.updatedAt, url: t.pageUrl, zichtbaar: t.klantZichtbaar,
      intern: `Taak afgerond: ${t.categorie ? `${t.categorie} – ` : ""}${t.tekst}`,
      klant: t.tekst,
    });
  }

  // 10. Verstuurde mail met werk erin, ook van vóór deze uitbreiding.
  const mails = await stil(
    sql`SELECT id, subject, received_at, superhuman_link, web_link FROM client_emails
        WHERE client_slug = ${slug} AND direction = 'out'`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const m of mails) {
    const onderwerp = `Mail: ${(m.subject as string) || "(geen onderwerp)"}`;
    rijen.push({
      slug, soort: "mail", bron: "client_emails", bronId: String(m.id),
      gebeurdeOp: (m.received_at as string) || undefined,
      bewijs: (m.superhuman_link as string) || (m.web_link as string) || null,
      intern: onderwerp, klant: onderwerp,
    });
  }

  await logActiviteiten(rijen);

  const perSoort: Record<string, number> = {};
  for (const r of rijen) perSoort[r.soort] = (perSoort[r.soort] || 0) + 1;
  return { gevonden: rijen.length, perSoort };
}

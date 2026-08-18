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

  // 11. Afgevinkte taken uit de planning (client_weekplan). De maand-takenlijst
  //     hierboven schreef al mee, de planning niet; taken die daar al op "klaar"
  //     stonden ontbraken dus in het logboek. Vanaf nu schrijft het afvinken zelf
  //     mee (lib/weekplan.ts), dit haalt het verleden erbij.
  const planTaken = await stil(
    sql`SELECT id, taak, url, updated_at FROM client_weekplan
        WHERE client_slug = ${slug} AND status = 'klaar'`.then((r) => r.rows),
    [] as Record<string, unknown>[],
  );
  for (const t of planTaken) {
    const tekst = String(t.taak || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!tekst) continue;
    rijen.push({
      slug, soort: "taak", bron: "client_weekplan", bronId: Number(t.id),
      gebeurdeOp: (t.updated_at as string) || undefined, url: (t.url as string) || null,
      intern: `Taak afgerond: ${tekst}`, klant: tekst,
    });
  }

  // 12. De correspondentie zelf, live uit de mailbox.
  rijen.push(...await stil(mailRegels(slug), [] as LogInput[]));

  await logActiviteiten(rijen);

  const perSoort: Record<string, number> = {};
  for (const r of rijen) perSoort[r.soort] = (perSoort[r.soort] || 0) + 1;
  return { gevonden: rijen.length, perSoort };
}

// ═══════════════════════════════════════════════════════════
// DE MAILS IN HET LOGBOEK
// ═══════════════════════════════════════════════════════════
// "Wat we doen" las tot nu toe alleen de mails die ooit via de brug in de
// database beland zijn (client_emails), en daarvan alleen de verzonden. Live
// mail komt sinds de Microsoft-koppeling rechtstreeks uit de mailbox en wordt
// niet opgeslagen, dus de recente correspondentie ontbrak precies daar waar je
// hem het hardst nodig hebt: bij de vraag "wanneer hebben we wat gedaan".
//
// Een mailwisseling is werk. Niet alleen wat wij sturen (een analyse, een
// contentplan, instructies voor de sitebouwer), ook wat er binnenkomt bepaalt
// wat we die week doen. Allebei dus, met de richting in de tekst zodat je in
// één oogopslag ziet wie er aan zet was.
//
// Twee zeven eroverheen, dezelfde als bij "Laatste mails", zodat er geen
// nieuwsbrieven en Ahrefs-meldingen in het logboek van een klant lopen:
//   1. de witte lijst met afzenders per klant (leeg = alles);
//   2. de ruisfilter op automatische afzenders en onderwerpen.
//
// Standaard intern (STANDAARD_ZICHTBAAR.mail is false): pas met de knop "delen"
// gaat een regel mee naar de klant.
async function mailRegels(slug: string): Promise<LogInput[]> {
  const { msStatus, msSearchClientEmails } = await import("./ms-graph");
  const { isRuisMail } = await import("./mail-tekst");
  const { parseAllowlist, fromMatchesAllowlist } = await import("./snapshots");

  const { rows: cRows } = await sql`
    SELECT email, domain, mail_allowlist FROM clients WHERE slug = ${slug} LIMIT 1`;
  const klant = cRows[0];
  if (!klant) return [];
  const zoek = String(klant.email || klant.domain || "").trim();
  if (!zoek) return [];

  const status = await msStatus();
  if (!status.connected) return [];
  const mails = await msSearchClientEmails(zoek, status.account || "", 60);
  if (!mails) return [];

  const toegestaan = parseAllowlist(String(klant.mail_allowlist || ""));
  const uit: LogInput[] = [];
  for (const m of mails) {
    if (isRuisMail(m)) continue;
    if (toegestaan.length && m.direction !== "out" && !fromMatchesAllowlist(m.fromAddress || "", toegestaan)) continue;
    const onderwerp = (m.subject || "").trim() || "(geen onderwerp)";
    const wie = (m.fromName || m.fromAddress || "").trim();
    uit.push({
      slug, soort: "mail", bron: "client_emails", bronId: m.id,
      gebeurdeOp: m.receivedAt || undefined,
      bewijs: m.superhumanLink || m.webLink || null,
      intern: m.direction === "out" ? `Mail verstuurd: ${onderwerp}` : `Mail ontvangen${wie ? ` van ${wie}` : ""}: ${onderwerp}`,
      klant: m.direction === "out" ? `Mail: ${onderwerp}` : `Mail van u: ${onderwerp}`,
    });
  }
  return uit;
}

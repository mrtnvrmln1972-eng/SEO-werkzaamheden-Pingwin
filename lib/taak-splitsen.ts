import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// ÉÉN TAAK, ÉÉN PROJECT: EEN KAART IN TWEEËN KNIPPEN
// ═══════════════════════════════════════════════════════════
// De kaart "Nieuw projecten op de site" bij GardenSwimm bevatte twee losse
// projecten: een natuurzwembad in IJsselmuiden en een zwemvijver in Zaamslag,
// elk met een aangeleverd stuk van de klant én de ondersteunende versie die wij
// ervan maakten. Vier documenten op één kaart, en dan loopt het vast op iets
// simpels: er kan maar ÉÉN versie "geldend" zijn per kaart. Vink je de ene aan,
// dan lijkt de andere vervallen, terwijl het gewoon een ander project is.
//
// En de developer krijgt zo twee opdrachten in één taak, terwijl de afspraak nu
// juist is dat hij één link plus één zin krijgt (zie lib/naar-developer.ts).
// Maartens woorden (25-08-2026): "ik denk dat ik deze taken had moeten splitsen
// in de twee verschillende projecten, omdat je er maar één geldend kan maken."
//
// Deze module knipt zo'n kaart in tweeën. Wat er gebeurt:
//   * er komt een tweede kaart naast de eerste, in dezelfde week, met dezelfde
//     achtergrond, en met een naam die jij zelf geeft;
//   * de documenten die jij aanwijst verhuizen mee naar die nieuwe kaart;
//   * de rest blijft staan waar hij staat.
//
// Wat er NIET gebeurt: er wordt niets weggegooid en niets gekopieerd. Een
// document staat na afloop op precies één kaart, want twee kopieën van hetzelfde
// stuk is exact het probleem dat we hier oplossen.
//
// ── Waarom dit veilig kan ──────────────────────────────────────────────────
// Weekplan-kaarten staan in hun eigen tabel (`client_weekplan`) en houden hun
// nummer. De oude takentabel doet dat niet (die wordt bij elke opslag opnieuw
// opgebouwd), en op zo'n kaart zou verhuizen dus na één opslag weer los kunnen
// raken. Daarom werkt dit alleen op weekplan-kaarten.
//
// ── De documenten van een kaart ────────────────────────────────────────────
// Documenten hangen aan een sleutel: de pagina van de kaart als die er is, en
// anders "taak:<nummer>". Alleen dat tweede geval verhuist hier. Hangt een
// document aan een PAGINA, dan hoort het bij die pagina en niet bij deze kaart;
// dat weghalen zou het bij de pagina laten verdwijnen. Een kaart met een eigen
// pagina gaat trouwens per definitie over één project, dus daar valt niets te
// splitsen.
// ═══════════════════════════════════════════════════════════

export const TAAK_SLEUTEL = (id: number) => `taak:${id}`;

export type SplitsResultaat =
  | { ok: true; nieuweId: number; verhuisd: number }
  | { ok: false; error: string };

/**
 * Knipt een weekplan-kaart in tweeën.
 *
 * `versieIds` zijn de documenten die naar de nieuwe kaart gaan. Laat je die leeg,
 * dan komt er wél een tweede kaart maar verhuist er niets; dat is een geldige
 * uitkomst (je wilt de documenten er misschien later pas bij zetten), maar het is
 * bijna nooit wat je bedoelt, dus het scherm vraagt er expliciet naar.
 */
export async function splitsTaak(opts: {
  slug: string;
  taakId: number;
  /** De naam van de NIEUWE kaart. */
  titel: string;
  /** De documenten die meeverhuizen (id's uit page_doc_versions). */
  versieIds: number[];
}): Promise<SplitsResultaat> {
  const { slug, taakId } = opts;
  const titel = (opts.titel || "").trim();
  const versieIds = (opts.versieIds || []).filter((n) => Number.isInteger(n) && n > 0);
  if (!slug || !Number.isInteger(taakId) || taakId <= 0) return { ok: false, error: "Geen taak opgegeven." };
  if (!titel) return { ok: false, error: "Geef de nieuwe taak een naam." };

  await ensureSchema();

  const { rows } = await sql`
    SELECT id, thread, taak, wie, url, week_year, week_no, status, sort_order, toelichting,
           taaktype, copy_url, bron_mail
    FROM client_weekplan WHERE client_slug = ${slug} AND id = ${taakId} LIMIT 1`;
  const kaart = rows[0];
  if (!kaart) return { ok: false, error: "Deze taak staat niet meer in de weekplanning." };

  // De nieuwe kaart staat direct naast de oude, in dezelfde week en met dezelfde
  // achtergrond. Bewust NIET met `naar_dev` erbij: de nieuwe helft is nog niet
  // doorgezet, ook al was de oude dat wel.
  const { rows: gemaakt } = await sql`
    INSERT INTO client_weekplan
      (client_slug, thread, taak, wie, url, week_year, week_no, status, sort_order, toelichting, taaktype, copy_url, bron_mail)
    VALUES
      (${slug}, ${kaart.thread as string | null}, ${titel}, ${(kaart.wie as string) || "SEO"},
       ${kaart.url as string | null}, ${Number(kaart.week_year) || 0}, ${Number(kaart.week_no) || 0},
       ${(kaart.status as string) || "gepland"}, ${(Number(kaart.sort_order) || 0) + 1},
       ${kaart.toelichting as string | null}, ${kaart.taaktype as string | null},
       ${kaart.copy_url as string | null}, ${kaart.bron_mail as string | null})
    RETURNING id`;
  const nieuweId = Number(gemaakt[0]?.id || 0);
  if (!nieuweId) return { ok: false, error: "De tweede taak kon niet aangemaakt worden." };

  // Verhuizen, en alleen wat écht aan deze kaart hangt. De `url`-voorwaarde is
  // het slot: een document dat aan een pagina hangt blijft bij die pagina staan,
  // ook als iemand zijn nummer meestuurt.
  // Eén voor één, want de database-koppeling neemt geen lijst als waarde aan. Het
  // gaat om een handvol documenten, dus dat is hier geen bezwaar.
  let verhuisd = 0;
  for (const versieId of versieIds) {
    const res = await sql`
      UPDATE page_doc_versions SET url = ${TAAK_SLEUTEL(nieuweId)}
      WHERE client_slug = ${slug} AND url = ${TAAK_SLEUTEL(taakId)} AND id = ${versieId}`;
    verhuisd += res.rowCount ?? 0;
  }

  return { ok: true, nieuweId, verhuisd };
}

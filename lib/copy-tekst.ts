import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { readDriveDoc } from "./drive";

// ═══════════════════════════════════════════════════════════
// WAAR LIGT DE GESCHREVEN COPY VAN DEZE PAGINA?
// ═══════════════════════════════════════════════════════════
// Eén antwoord op één vraag, voor iedereen die iets met de bedoelde tekst wil
// doen (nameten of de pagina de koppen heeft, een mail aan de sitebouwer, een
// vergelijking met de live tekst).
//
// Waarom dit bestaat: de controle "staan de aangeleverde koppen op de pagina?"
// zocht de tekst op precies één plek, met een letterlijke vergelijking van de
// URL. Vond hij daar niets, dan meldde hij "er is geen copydocument om tegen te
// vergelijken", terwijl het copydocument één regel lager in dezelfde kaart
// gewoon als link stond. Dat is het ergste soort onwaarheid: een scherm dat
// zichzelf tegenspreekt. Aangetroffen op /tuinontwerp/strandtuin/ (Kamsteeg),
// 11 augustus 2026.
//
// Daarom kijken we nu op alle plekken waar de copy kan liggen, in volgorde van
// hoe hard de bron is:
//
//  1. de geldende tekst in het dashboard (page_doc_outputs);
//  2. het versie-archief (page_doc_versions), de nieuwste met tekst;
//  3. het gekoppelde document zelf (Drive/Google Docs), uitgelezen als tekst.
//
// De URL wordt daarbij vergeleken op zijn genormaliseerde vorm (urlKey), niet
// letterlijk: een schuine streep of een www ervoor mag nooit het verschil maken
// tussen "gevonden" en "bestaat niet".
//
// En als er niets te lezen valt, is het antwoord preciezer dan vroeger: er is
// verschil tussen "er ligt geen copydocument" en "het ligt er wel, maar ik kon
// de tekst er niet uit halen". Het eerste is werk dat nog moet gebeuren, het
// tweede is een leesprobleem aan onze kant.
// ═══════════════════════════════════════════════════════════

export type CopyTekstBron = {
  /** De gevonden tekst; leeg als er niets leesbaars was. */
  tekst: string;
  /** Waar hij vandaan komt, in gewone taal, voor in het bewijs. */
  herkomst: string;
  /** De link naar het document, als die er is. */
  link: string;
  /** Alleen gevuld als tekst leeg is: waarom er niets te vergelijken viel. */
  reden: string;
};

/** Het pad van een URL of van een kaal pad, zonder slot-streep, in kleine letters. */
function padVan(u: string): string {
  const s = String(u || "").trim();
  try {
    const x = new URL(/^https?:\/\//i.test(s) ? s : `https://x${s.startsWith("/") ? "" : "/"}${s}`);
    return x.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return s.replace(/\/+$/, "").toLowerCase();
  }
}

/**
 * Gaat een opgeslagen rij over dezelfde pagina als waar we naar vragen? Zowel de
 * hele URL als alleen het pad telt, want de vraag komt van beide kanten binnen
 * (een kaart kent de volledige URL, een mailcontrole vaak alleen het pad). Binnen
 * één klant is het pad genoeg om te weten welke pagina bedoeld wordt.
 */
export function zelfdePagina(opgeslagen: string, doel: string): boolean {
  if (urlKey(opgeslagen) === urlKey(doel)) return true;
  const a = padVan(opgeslagen);
  return !!a && a === padVan(doel);
}

/** Alle bekende documentlinks van de copy van deze pagina, nieuwste eerst. */
async function copyLinks(slug: string, url: string): Promise<string[]> {
  const uit: string[] = [];
  const voegToe = (l: unknown) => {
    const s = String(l || "").trim();
    if (s && !uit.includes(s)) uit.push(s);
  };
  const [runs, versies, kaarten] = await Promise.all([
    sql`SELECT url, copy_link FROM page_doc_runs
        WHERE client_slug = ${slug} AND copy_link IS NOT NULL AND copy_link <> '' ORDER BY id DESC`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT url, drive_link FROM page_doc_versions
        WHERE client_slug = ${slug} AND kind = 'copy' AND status = 'verwerkt'
          AND drive_link IS NOT NULL AND drive_link <> ''
        ORDER BY goedgekeurd DESC, id DESC`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT url, copy_url FROM client_weekplan
        WHERE client_slug = ${slug} AND copy_url IS NOT NULL AND copy_url <> '' ORDER BY id DESC`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
  ]);
  for (const r of versies) if (zelfdePagina(String(r.url || ""), url)) voegToe(r.drive_link);
  for (const r of runs) if (zelfdePagina(String(r.url || ""), url)) voegToe(r.copy_link);
  for (const r of kaarten) if (zelfdePagina(String(r.url || ""), url)) voegToe(r.copy_url);
  return uit;
}

/**
 * Ligt er überhaupt een copydocument voor deze pagina? Het goedkope antwoord:
 * alleen de database, geen netwerk. Hiermee bepaalt het dashboard of "staan de
 * koppen erop" een afspraak is die je kunt nameten.
 */
export async function heeftCopyDocument(slug: string, url: string): Promise<boolean> {
  await ensureSchema();
  const [outputs, versies] = await Promise.all([
    sql`SELECT url FROM page_doc_outputs
        WHERE client_slug = ${slug} AND kind = 'copy' AND content IS NOT NULL AND content <> ''`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT url FROM page_doc_versions
        WHERE client_slug = ${slug} AND kind = 'copy' AND status = 'verwerkt'
          AND ((tekst IS NOT NULL AND tekst <> '') OR (drive_link IS NOT NULL AND drive_link <> ''))`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
  ]);
  if ([...outputs, ...versies].some((r) => zelfdePagina(String(r.url || ""), url))) return true;
  return (await copyLinks(slug, url).catch(() => [])).length > 0;
}

/**
 * Alle plekken waar de copy van deze pagina ligt, met hun tekst, in volgorde van
 * hoe hard de bron is. Losgetrokken van de keuze eronder, want twee vragen die
 * door elkaar liepen: "waar ligt het" en "welke gebruik ik". Zonder deze lijst
 * kon niemand zien dat er drie documenten aan een pagina hingen waarvan er maar
 * één de webteksten bevatte.
 */
export async function alleCopyBronnen(slug: string, url: string): Promise<CopyTekstBron[]> {
  await ensureSchema();
  const uit: CopyTekstBron[] = [];

  // 1. De geldende tekst in het dashboard.
  const outputs = await sql`
    SELECT url, content FROM page_doc_outputs
    WHERE client_slug = ${slug} AND kind = 'copy' AND content IS NOT NULL AND content <> ''
    ORDER BY updated_at DESC NULLS LAST`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]);
  for (const r of outputs) {
    if (!zelfdePagina(String(r.url || ""), url)) continue;
    const tekst = String(r.content || "");
    if (tekst.trim()) uit.push({ tekst, herkomst: "het copydocument in het dashboard", link: "", reden: "" });
  }

  // 2. Het versie-archief: de goedgekeurde versie eerst, anders de nieuwste.
  const versies = await sql`
    SELECT url, naam, tekst, drive_link FROM page_doc_versions
    WHERE client_slug = ${slug} AND kind = 'copy' AND status = 'verwerkt'
      AND tekst IS NOT NULL AND tekst <> ''
    ORDER BY goedgekeurd DESC, id DESC`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]);
  for (const r of versies) {
    if (!zelfdePagina(String(r.url || ""), url)) continue;
    const tekst = String(r.tekst || "");
    if (tekst.trim()) {
      uit.push({ tekst, herkomst: `de bewaarde versie ${String(r.naam || "van de copy")}`, link: String(r.drive_link || ""), reden: "" });
    }
  }

  // 3. De gekoppelde documenten zelf. Hooguit twee ophalen: een controle mag geen
  // minuut aan Drive-verzoeken worden.
  const links = await copyLinks(slug, url).catch(() => [] as string[]);
  for (const link of links.slice(0, 2)) {
    const gelezen = await readDriveDoc(link, 60000).catch((e) => ({ ok: false as const, error: (e as Error).message }));
    if (gelezen.ok && String(gelezen.text || "").trim()) {
      uit.push({ tekst: String(gelezen.text || ""), herkomst: `het gekoppelde document${gelezen.name ? ` ${gelezen.name}` : ""}`, link, reden: "" });
    } else {
      uit.push({ tekst: "", herkomst: "het gekoppelde copydocument", link, reden: ("error" in gelezen && gelezen.error) || "er kwam geen tekst uit" });
    }
  }

  return uit;
}

/**
 * De geschreven copy van deze pagina: de eerste bron die bruikbaar is.
 *
 * `bruikbaar` bepaalt wat dat betekent. De koppencontrole geeft hier de eis mee
 * dat er webtekst-koppen in moeten staan, en dat is niet vanzelfsprekend: het
 * copydocument dat de klant krijgt is een briefing, met hoofdstukken als "1. Waar
 * de nieuwe teksten over gaan". Zonder die eis legde de controle die
 * hoofdstuktitels naast de pagina, vond er nul terug, en concludeerde dat de
 * sitebouwer niets gedaan had, terwijl de teksten er gewoon op stonden.
 * Aangetroffen op /tuinontwerp/strandtuin/, 11 augustus 2026.
 */
export async function haalCopyTekst(
  slug: string, url: string, bruikbaar?: (tekst: string) => boolean,
): Promise<CopyTekstBron> {
  const bronnen = await alleCopyBronnen(slug, url).catch(() => [] as CopyTekstBron[]);
  const metTekst = bronnen.filter((b) => b.tekst.trim());
  const goed = bruikbaar ? metTekst.find((b) => bruikbaar(b.tekst)) : metTekst[0];
  if (goed) return goed;

  // Niets bruikbaars. Zeg dan precies welk van de drie gevallen het is, want er
  // hoort iets anders te gebeuren: werk maken, een leesprobleem oplossen, of het
  // juiste document koppelen.
  if (metTekst.length) {
    const namen = metTekst.map((b) => b.herkomst).join(" en ");
    return {
      tekst: "", herkomst: "", link: metTekst[0].link,
      reden: `ik vond ${namen}, maar daar staan geen webtekst-koppen in om mee te vergelijken (het lijkt de begeleidende uitleg, niet de teksten zelf)`,
    };
  }
  const onleesbaar = bronnen.find((b) => b.link);
  if (onleesbaar) {
    return {
      tekst: "", herkomst: "", link: onleesbaar.link,
      reden: `er hangt wel een copydocument aan deze pagina, maar ik kon de tekst er niet uit lezen (${onleesbaar.reden || "onbekende reden"})`,
    };
  }
  return { tekst: "", herkomst: "", link: "", reden: "er is geen copydocument om tegen te vergelijken" };
}

import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { controleerAntwoord, herstelOpdracht } from "./antwoord-controle";
import { striptToeschrijvingen } from "./herkomst";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { HARD_BEWIJS } from "./page-emails";
import { getPageDossier, dossierToText, dossierPaden, type PageDossier } from "./page-dossier";
import { SOORT_LABEL } from "./activiteit";

// ═══════════════════════════════════════════════════════════
// DE GESCHREVEN SAMENVATTING BIJ EEN PAGINA
// ═══════════════════════════════════════════════════════════
// Eén alinea in gewone taal: wie wat wilde, wie wat heeft gemaakt, wat er nog
// niet gebeurd is en door wie. De FEITEN komen uit het dossier (code), het model
// doet alleen de formulering.
//
// Hij wordt één keer geschreven en opgeslagen. Alle plekken (bird's eye-chat,
// voorgestelde taak, weekplankaart, Pagina's) lezen dezelfde rij, dus ze kunnen
// niet uit de pas lopen. Veranderen de feiten, dan verandert de vingerafdruk en
// wordt hij bij de eerstvolgende weergave opnieuw geschreven. Geen losse
// invalidatie op zeven schrijfpaden, want daar vergeet je er altijd één van.
// ═══════════════════════════════════════════════════════════

export type DossierTekst = {
  tekst: string;
  controle: "ok" | "hersteld" | "afgekeurd" | "feiten";
  gemaaktOp: string;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_dossier_summary (
      client_slug  TEXT NOT NULL,
      url_key      TEXT NOT NULL,
      url          TEXT NOT NULL,
      tekst        TEXT,
      feiten       TEXT,
      vingerafdruk TEXT,
      model        TEXT,
      controle     TEXT,
      gemaakt_op   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url_key)
    )`;
}

// Kleine stabiele hash over de feiten. Verandert er iets aan de pagina, dan
// verandert deze waarde en wordt de alinea opnieuw geschreven.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const SYSTEEM = `Je schrijft voor Maarten van SEO-bureau Pingwin de stand van zaken van één webpagina.

DOEL: Maarten opent een taak en wil in vijf seconden weten wat er speelt. Wie wilde wat, wie heeft wat gemaakt, wat is er nog niet gebeurd en door wie.

VORM, houd je hier exact aan:
Regel 1: één zin met waar het nu staat en wie aan zet is. Geen opsomming, geen datum.
Daarna een lege regel.
Daarna de stappen in chronologische volgorde, oudste eerst, elk op een eigen regel die begint met "- ".
Elke stap begint met de datum als "dag maand" (dus "14 juli"), dan een dubbele punt, dan in gewone taal wat er gebeurde.
De laatste stap begint met "- nu:" en zegt wat er nu moet gebeuren en wie aan zet is.

Voorbeeld van de vorm (niet van de inhoud):
Copy is klaar en geredigeerd, dev moet hem nu live zetten.

- 14 juli: jij stelde de nieuwe opzet voor, deze pagina informatief en de andere om te boeken.
- 22 juli: de klant stuurde de aangepaste teksten terug als pdf.
- nu: de tekst staat nog niet op de pagina. Dev is aan zet.

Maximaal vijf stappen. Zijn er meer, laat dan de minst belangrijke weg.

WAT ER IN MOET, in deze volgorde van belang:
1. Wat er met deze pagina aan de hand is of afgesproken is, en met wie.
2. Of iemand iets heeft aangeleverd of teruggestuurd (teksten, correcties, een document), en of dat nog verwerkt moet worden. Dit is het belangrijkste punt: als de klant teksten heeft teruggestuurd, moet dat er ALTIJD in staan.
3. Wat er nog niet gebeurd is, en wie daarvoor aan zet is.

WAT ER NIET IN MOET:
- Een opsomming van welke stappen af zijn. Noem alleen wat NOG moet gebeuren.
- Losse afspraken die niet over deze pagina gaan (een belafspraak, een vergadering, een onderwerp uit dezelfde mailthread dat een andere pagina betreft). Staat er in een mail iets dat niet over deze pagina gaat, laat het weg.
- De vertoningen en klikken, tenzij ze het punt van de taak zijn; die staan al apart op de kaart.

REGELS, hard:
- Kort. De openingszin maximaal 20 woorden, elke stap maximaal 20 woorden.
- Gewone spreektaal, zoals je het tegen een collega zegt. Nederlands. Spreek Maarten aan met "jij".
- Gebruik UITSLUITEND feiten uit het blok hieronder. Verzin nooit een cijfer, een naam, een datum of een pagina.
- De datum vooraan een stap wordt automatisch een link naar die mail. Zet er zelf nooit een link, adres of "(mail)" bij.
- Noem alleen mails die gemarkeerd staan als VASTGEPIND of HARD BEWIJS. Mails met "mogelijk relevant" laat je weg.
- Noem een pagina als pad, dus /crp-test/, nooit als volledig webadres.
- Nooit een los liggend streepje als zinsscheiding. Gebruik een komma, dubbele punt of nieuwe zin.
- Geen aanhef, geen afsluiting, geen kopjes, geen vetgedrukte tekst, geen "hier is de samenvatting".`;

// Als het model niets bruikbaars oplevert: een sobere regel uit de feiten zelf.
// Liever saai dan onwaar.
function feitenRegel(d: PageDossier): string {
  const delen: string[] = [];
  if (d.stand) {
    const open = (["strategie", "analyse", "blauwdruk", "copy", "bouw", "structured"] as const).filter((f) => !d.stand![f]);
    delen.push(d.stand.live ? "De pagina staat live." : "De pagina staat nog niet live.");
    if (open.length) delen.push(`Nog niet af: ${open.join(", ")}.`);
  }
  if (d.copyLive && !d.copyLive.doorgevoerd && d.copyLive.totaal > 0) {
    delen.push("De geschreven copy staat nog niet op de pagina.");
  }
  if (d.klantvoorstellen.length) delen.push(`Er ligt ${d.klantvoorstellen.length === 1 ? "een teruggekregen document" : `${d.klantvoorstellen.length} teruggekregen documenten`} klaar om te verwerken.`);
  const laatste = d.activiteit[0];
  if (laatste) {
    const datum = new Date(laatste.gebeurdeOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
    delen.push(`Laatste actie: ${SOORT_LABEL[laatste.soort].toLowerCase()} op ${datum}.`);
  }
  return delen.join(" ") || "Nog geen bijzonderheden vastgelegd voor deze pagina.";
}

/**
 * De alinea bij een pagina. Ververst zichzelf zodra de feiten veranderen.
 * `ververs` forceert opnieuw schrijven.
 */
export async function getDossierTekst(
  slug: string,
  url: string,
  opts: { ververs?: boolean; dossier?: PageDossier } = {},
): Promise<DossierTekst & { dossier: PageDossier }> {
  await ensureSchema();
  await ensureTable();
  const k = urlKey(url);
  const d = opts.dossier || await getPageDossier(slug, url, { verseMail: true });
  const feiten = dossierToText(d);
  const vinger = hash(feiten);

  if (!opts.ververs) {
    const { rows } = await sql`
      SELECT tekst, controle, gemaakt_op FROM page_dossier_summary
      WHERE client_slug = ${slug} AND url_key = ${k} AND vingerafdruk = ${vinger} LIMIT 1`;
    if (rows[0]?.tekst) {
      return {
        tekst: String(rows[0].tekst),
        controle: ((rows[0].controle as string) || "ok") as DossierTekst["controle"],
        gemaaktOp: new Date(rows[0].gemaakt_op as string).toISOString(),
        dossier: d,
      };
    }
  }

  // Niets te vertellen? Dan ook geen modelcall.
  const magIets = !!(d.mails.length || d.documenten.length || d.klantvoorstellen.length || d.activiteit.length || d.plan);
  let tekst = "";
  let controle: DossierTekst["controle"] = "feiten";

  if (magIets) {
    const client = await getClientBySlug(slug).catch(() => null);
    const urls = await getClientUrls(slug).catch(() => []);
    const bekendePaden = urls.map((u) => { try { return new URL(u.url).pathname; } catch { return u.url; } });
    // Mails die niet hard genoeg zijn gaan niet mee de prompt in: dan kán het
    // model er geen verhaal op bouwen.
    const feitenVoorModel = dossierToText({
      ...d,
      mails: d.mails.filter((m) => m.bron === "pin" || m.score >= HARD_BEWIJS),
    });

    try {
      let kandidaat = (await callClaude(SYSTEEM, [{ role: "user", content: feitenVoorModel }], 500, { slug, action: "dossier-tekst" }, LIGHT_MODEL)).trim();
      let r = controleerAntwoord(kandidaat, feitenVoorModel, [...bekendePaden, ...dossierPaden(d)]);
      if (!r.ok) {
        // Eén herstelronde, met precies benoemd wat er niet klopte.
        kandidaat = (await callClaude(
          SYSTEEM,
          [
            { role: "user", content: feitenVoorModel },
            { role: "assistant", content: kandidaat },
            { role: "user", content: herstelOpdracht(r) },
          ],
          500, { slug, action: "dossier-tekst-herstel" }, LIGHT_MODEL,
        )).trim();
        r = controleerAntwoord(kandidaat, feitenVoorModel, [...bekendePaden, ...dossierPaden(d)]);
        controle = r.ok ? "hersteld" : "afgekeurd";
      } else {
        controle = "ok";
      }
      if (r.ok) {
        // Namen die niet aantoonbaar bij deze klant horen eruit, zelfde vangrail
        // als op de kaarten.
        tekst = striptToeschrijvingen(kandidaat, {
          bekend: d.mails.flatMap((m) => [m.vanNaam, m.vanAdres]),
          eigen: [client?.name, "Pingwin", "Maarten"],
        }).trim();
      }
    } catch {
      /* geen sleutel, time-out of API-fout: dan de feitenregel */
    }
  }

  if (!tekst) {
    tekst = feitenRegel(d);
    if (controle !== "afgekeurd") controle = "feiten";
  }

  await sql`
    INSERT INTO page_dossier_summary (client_slug, url_key, url, tekst, feiten, vingerafdruk, model, controle, gemaakt_op)
    VALUES (${slug}, ${k}, ${url}, ${tekst}, ${feiten.slice(0, 20000)}, ${vinger}, ${LIGHT_MODEL}, ${controle}, now())
    ON CONFLICT (client_slug, url_key) DO UPDATE
      SET tekst = EXCLUDED.tekst, feiten = EXCLUDED.feiten, vingerafdruk = EXCLUDED.vingerafdruk,
          url = EXCLUDED.url, model = EXCLUDED.model, controle = EXCLUDED.controle, gemaakt_op = now()`;

  return { tekst, controle, gemaaktOp: new Date().toISOString(), dossier: d };
}

/** Alleen de opgeslagen alinea, zonder het dossier op te bouwen (voor prompts). */
export async function getOpgeslagenTekst(slug: string, url: string): Promise<string> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT tekst FROM page_dossier_summary WHERE client_slug = ${slug} AND url_key = ${urlKey(url)} LIMIT 1`;
  return (rows[0]?.tekst as string) || "";
}

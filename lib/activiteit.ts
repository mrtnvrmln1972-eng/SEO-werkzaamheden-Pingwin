// ═══════════════════════════════════════════════════════════
// WAT HEBBEN WE VOOR DEZE KLANT GEDAAN
// ═══════════════════════════════════════════════════════════
// Het werk gebeurt al in het dashboard: analyses, blauwdrukken, copy, meta-teksten,
// alt-teksten, structured data, redirects, en alles wat via de sitebouwer loopt.
// Alleen: die gegevens zitten verspreid over een stuk of tien tabellen, elk met een
// eigen vorm. Er was dus nergens een antwoord op "wat hebben we in juli gedaan".
//
// Dit is dat antwoord: één regel per gebeurtenis, weggeschreven op het moment dat
// het gebeurt. Bewust NIET achteraf tien tabellen uitkammen, want dan mis je dingen
// en breekt het bij elke volgende wijziging aan een van die tabellen.
//
// Elke regel draagt zijn herkomst (bron + bronId). Daardoor is wegschrijven
// idempotent: dezelfde gebeurtenis twee keer loggen levert één regel op. Dat maakt
// ook het terugwerkend vullen veilig, want nog een keer klikken verandert niets.

import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

export type ActiviteitSoort =
  | "analyse" | "blauwdruk" | "copy" | "copy-live" | "copy-concept"
  | "meta" | "alt" | "intern-link" | "structured" | "redirect" | "paginawijziging"
  | "gmb-profiel" | "gmb-review" | "taak" | "mail";

export type Uitvoerder = "Pingwin" | "Sitebouwer";

export type Activiteit = {
  id: number;
  gebeurdeOp: string;
  soort: ActiviteitSoort;
  url: string | null;
  intern: string;
  klant: string;
  wie: Uitvoerder;
  bewijs: string | null;
  zichtbaar: boolean;
};

// ── Klanttaal ──
// Vaste zinnen per soort, geen AI. Voorspelbaar, kost niets, en klinkt elke maand
// hetzelfde. "Meta-description aangepast op /hovenier-uden/" zegt een klant niets;
// "Zoekresultaat-tekst verbeterd" wel.
const KLANTTAAL: Record<ActiviteitSoort, string> = {
  analyse: "Pagina geanalyseerd: gekeken waarop hij gevonden wordt en wat er beter kan",
  blauwdruk: "Opzet gemaakt voor de nieuwe pagina-indeling",
  copy: "Nieuwe paginatekst geschreven",
  "copy-concept": "Nieuwe paginatekst als concept in de site gezet, klaar om te publiceren",
  "copy-live": "Nieuwe paginatekst staat live op de site",
  meta: "Zoekresultaat-tekst verbeterd, zodat meer mensen erop klikken",
  alt: "Afbeeldingen voorzien van een beschrijving, goed voor vindbaarheid en toegankelijkheid",
  "intern-link": "Interne links gelegd, zodat bezoekers en Google de pagina beter vinden",
  structured: "Extra informatie voor Google toegevoegd (structured data)",
  redirect: "Oud webadres doorgestuurd naar het nieuwe, zodat er geen bezoekers verloren gaan",
  paginawijziging: "Pagina aangepast op de site",
  "gmb-profiel": "Google-bedrijfsprofiel bijgewerkt, zodat u beter gevonden wordt op de kaart",
  "gmb-review": "Nieuwe review op Google",
  taak: "Taak afgerond",
  mail: "Mail verstuurd",
};

// Labels voor jouw eigen scherm.
export const SOORT_LABEL: Record<ActiviteitSoort, string> = {
  analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", "copy-concept": "Copy als concept", "copy-live": "Copy live",
  meta: "Meta-teksten", alt: "Alt-teksten", "intern-link": "Interne links",
  structured: "Structured data", redirect: "Redirect", paginawijziging: "Paginawijziging",
  "gmb-profiel": "Google-profiel", "gmb-review": "Google-review",
  taak: "Taak", mail: "Mail",
};

// Wat je standaard met een klant zou delen. Een gedetecteerde paginawijziging is
// vaak ruis (de klant paste zelf iets aan), dus die staat standaard uit.
const STANDAARD_ZICHTBAAR: Record<ActiviteitSoort, boolean> = {
  // Een concept is nog geen opgeleverd werk (de klant kan het nog niet zien op de
  // site); pas "copy-live" is dat. Intern zichtbaar, niet standaard gedeeld.
  analyse: true, blauwdruk: false, copy: true, "copy-concept": false, "copy-live": true,
  meta: true, alt: true, "intern-link": true, structured: true,
  redirect: true, paginawijziging: false,
  // Een profielwijziging is werk dat de klant mag zien. Een binnengekomen review
  // is een seintje voor ons, geen werk van ons: die blijft intern.
  "gmb-profiel": true, "gmb-review": false,
  // Een taak volgt de eigen klant-zichtbaar-keuze die er al per taak is (wordt
  // altijd expliciet meegegeven); deze waarde is alleen een achtervang.
  taak: true,
  // Elke uitgaande mail komt in het logboek, maar pas na een bewuste "delen"-klik
  // ook bij de klant: net als bij een blauwdruk weten we pas achteraf of een mail
  // de moeite waard is om te laten zien.
  mail: false,
};

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "activiteit-dcf749c9";

function ensureTable(): Promise<void> {
  return eenmalig("activiteit", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_activiteit (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      gebeurde_op TIMESTAMPTZ NOT NULL,
      soort       TEXT NOT NULL,
      url         TEXT,
      intern      TEXT NOT NULL,
      klant       TEXT NOT NULL,
      wie         TEXT NOT NULL DEFAULT 'Pingwin',
      bewijs      TEXT,
      zichtbaar   BOOLEAN NOT NULL DEFAULT true,
      bron        TEXT NOT NULL,
      bron_id     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // De herkomst is de sleutel tegen dubbele regels: dezelfde gebeurtenis kan maar
  // één keer in het logboek staan, hoe vaak je het vullen ook herhaalt.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_activiteit_bron ON client_activiteit (client_slug, bron, bron_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ix_activiteit_slug_datum ON client_activiteit (client_slug, gebeurde_op DESC)`;
}

function pad(u?: string | null): string {
  const s = (u || "").trim();
  if (!s) return "";
  try { const x = new URL(s); return x.pathname + x.search; } catch { return s; }
}

export type LogInput = {
  slug: string;
  soort: ActiviteitSoort;
  bron: string;              // uit welke tabel/handeling dit komt
  bronId: string | number;   // uniek daarbinnen
  gebeurdeOp?: Date | string;
  url?: string | null;
  intern?: string;           // eigen omschrijving; anders afgeleid uit soort + pagina
  klant?: string;            // eigen klanttaal; anders het vaste sjabloon
  wie?: Uitvoerder;
  bewijs?: string | null;
  zichtbaar?: boolean;
};

/**
 * Schrijft één gebeurtenis weg. Stil bij een fout: het logboek mag nooit een
 * echte handeling laten mislukken. Een ontbrekende regel is vervelend, een
 * mislukte doorzet naar WordPress is erger.
 */
export async function logActiviteit(input: LogInput): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const p = pad(input.url);
    const intern = input.intern || `${SOORT_LABEL[input.soort]}${p ? ` voor ${p}` : ""}`;
    const klant = input.klant || `${KLANTTAAL[input.soort]}${p ? ` (${p})` : ""}`;
    const wanneer = input.gebeurdeOp ? new Date(input.gebeurdeOp) : new Date();
    if (Number.isNaN(wanneer.getTime())) return;
    await sql`
      INSERT INTO client_activiteit (client_slug, gebeurde_op, soort, url, intern, klant, wie, bewijs, zichtbaar, bron, bron_id)
      VALUES (${input.slug}, ${wanneer.toISOString()}, ${input.soort}, ${input.url || null},
              ${intern.slice(0, 400)}, ${klant.slice(0, 400)}, ${input.wie || "Pingwin"},
              ${input.bewijs || null}, ${input.zichtbaar ?? STANDAARD_ZICHTBAAR[input.soort]},
              ${input.bron}, ${String(input.bronId)})
      ON CONFLICT (client_slug, bron, bron_id) DO NOTHING`;
  } catch {
    /* stil: het logboek mag nooit een echte handeling breken */
  }
}

/** Meerdere gebeurtenissen tegelijk (voor het terugwerkend vullen). */
export async function logActiviteiten(rijen: LogInput[]): Promise<number> {
  let n = 0;
  for (const r of rijen) { await logActiviteit(r); n++; }
  return n;
}

/** Alle activiteit van een klant, jongste eerst. */
export async function getActiviteit(slug: string, opts: { alleenZichtbaar?: boolean } = {}): Promise<Activiteit[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = opts.alleenZichtbaar
    ? await sql`SELECT id, gebeurde_op, soort, url, intern, klant, wie, bewijs, zichtbaar
                FROM client_activiteit WHERE client_slug = ${slug} AND zichtbaar = true
                ORDER BY gebeurde_op DESC, id DESC LIMIT 500`
    : await sql`SELECT id, gebeurde_op, soort, url, intern, klant, wie, bewijs, zichtbaar
                FROM client_activiteit WHERE client_slug = ${slug}
                ORDER BY gebeurde_op DESC, id DESC LIMIT 500`;
  return rows.map((r) => ({
    id: Number(r.id),
    gebeurdeOp: new Date(r.gebeurde_op as string).toISOString(),
    soort: r.soort as ActiviteitSoort,
    url: (r.url as string) || null,
    intern: (r.intern as string) || "",
    klant: (r.klant as string) || "",
    wie: (r.wie as Uitvoerder) || "Pingwin",
    bewijs: (r.bewijs as string) || null,
    zichtbaar: r.zichtbaar === true,
  }));
}

/** Zet één regel wel of niet zichtbaar voor de klant. */
export async function zetZichtbaar(slug: string, id: number, zichtbaar: boolean): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE client_activiteit SET zichtbaar = ${zichtbaar} WHERE client_slug = ${slug} AND id = ${id}`;
}

import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// JOUW CORRECTIES ZIJN VOORTAAN VASTE REGELS
// ═══════════════════════════════════════════════════════════
// Dit is de "self-learning"-laag, en die is simpeler dan hij klinkt. Corrigeert
// Maarten een regel in de opruimlijst (deze pagina houden we; dit doel klopt
// niet, hij hoort bij Den Haag), dan wordt dat hier vastgelegd. De volgende
// analyse krijgt die correcties mee als harde regels en maakt dezelfde fout
// nooit meer.
//
// Waarom dat nodig is: de analyse leidt het redirect-doel af uit de zoekwoorden
// die een pagina leent. Dat is een goede aanwijzing, geen feit. Bij
// /soa-test-monster/ kwam Nijmegen eruit terwijl Monster bij Den Haag hoort.
// Zulke dingen weet alleen een mens, en die kennis hoort niet verloren te gaan
// in een chat.
// ═══════════════════════════════════════════════════════════

export type OpruimRegel = {
  van: string;
  besluit: "houden" | "redirect" | "genegeerd";
  naar: string;
  notitie: string;
  doorgevoerd: boolean;
  updatedAt: string | null;
};

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) ready = doEnsure().catch((e) => { ready = null; throw e; });
  return ready;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_opruim_regels (
      client_slug  TEXT NOT NULL,
      van          TEXT NOT NULL,
      besluit      TEXT NOT NULL DEFAULT 'redirect',
      naar         TEXT,
      notitie      TEXT,
      doorgevoerd  BOOLEAN NOT NULL DEFAULT false,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, van)
    )`;
}

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

export async function getOpruimRegels(slug: string): Promise<OpruimRegel[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT van, besluit, naar, notitie, doorgevoerd, updated_at
    FROM client_opruim_regels WHERE client_slug = ${slug} ORDER BY van`;
  return rows.map((r) => ({
    van: r.van as string,
    besluit: ((r.besluit as string) || "redirect") as OpruimRegel["besluit"],
    naar: (r.naar as string) || "",
    notitie: (r.notitie as string) || "",
    doorgevoerd: !!r.doorgevoerd,
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  }));
}

export async function zetOpruimRegel(slug: string, van: string, patch: Partial<Omit<OpruimRegel, "van" | "updatedAt">>): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const p = padVan(van);
  if (!p) return;
  const besluit = patch.besluit ?? null;
  const naar = patch.naar === undefined ? null : padVan(patch.naar);
  const notitie = patch.notitie === undefined ? null : patch.notitie.slice(0, 600);
  const doorgevoerd = patch.doorgevoerd === undefined ? null : patch.doorgevoerd;
  await sql`
    INSERT INTO client_opruim_regels (client_slug, van, besluit, naar, notitie, doorgevoerd, updated_at)
    VALUES (${slug}, ${p}, ${besluit || "redirect"}, ${naar}, ${notitie}, ${doorgevoerd ?? false}, now())
    ON CONFLICT (client_slug, van) DO UPDATE SET
      besluit     = COALESCE(${besluit}, client_opruim_regels.besluit),
      naar        = COALESCE(${naar}, client_opruim_regels.naar),
      notitie     = COALESCE(${notitie}, client_opruim_regels.notitie),
      doorgevoerd = COALESCE(${doorgevoerd}, client_opruim_regels.doorgevoerd),
      updated_at  = now()`;
}

/**
 * De correcties als instructie voor de volgende analyse. Dit gaat mee de motor
 * in, zodat een besluit van Maarten nooit twee keer genomen hoeft te worden.
 */
export async function regelsAlsInstructie(slug: string): Promise<string> {
  const regels = await getOpruimRegels(slug).catch(() => []);
  if (!regels.length) return "";
  const houden = regels.filter((r) => r.besluit === "houden");
  const gecorrigeerd = regels.filter((r) => r.besluit === "redirect" && r.naar);
  const genegeerd = regels.filter((r) => r.besluit === "genegeerd");
  const uit: string[] = ["EERDERE BESLUITEN VAN MAARTEN. Dit zijn HARDE regels; ze overrulen je eigen analyse zonder discussie."];
  if (houden.length) uit.push(`NOOIT omleiden of opruimen (Maarten heeft besloten dat deze blijven): ${houden.map((r) => r.van + (r.notitie ? ` (${r.notitie})` : "")).join(", ")}.`);
  if (gecorrigeerd.length) uit.push(`Vast redirect-doel, gebruik EXACT dit doel en verzin er geen ander: ${gecorrigeerd.map((r) => `${r.van} -> ${r.naar}`).join("; ")}.`);
  if (genegeerd.length) uit.push(`Niet meer noemen, Maarten heeft ze bewust weggezet: ${genegeerd.map((r) => r.van).join(", ")}.`);
  return uit.join("\n");
}

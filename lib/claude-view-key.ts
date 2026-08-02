import { sql, ensureSchema } from "./db";
import { hashPassword, verifyPassword, generatePassword } from "./password";

// ═══════════════════════════════════════════════════════════
// KIJK-SLEUTEL VOOR CLAUDE
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: Maarten wil dat Claude standaard kan meekijken in het
// dashboard, in elke sessie en elke wereld, zonder per keer een link te delen
// en zonder wachtwoorden heen en weer te sturen.
//
// Hoe het werkt: hij drukt één keer op de knop in de cockpit, krijgt een lange
// sleutel, en zet die als omgevingsvariabele in zijn Claude-omgeving. Claude
// wisselt die sleutel in voor een alleen-lezen sessie (/api/kijk).
//
// Drie bewuste keuzes:
//  - De sleutel staat als scrypt-hash in de database, niet plat en niet in een
//    env-var van Vercel. Zo kan hij met één knop ingetrokken worden zonder een
//    deploy, en staat de waarde nergens leesbaar.
//  - Alleen lezen. De rechten zitten in lib/admin-scope.ts; hier gaat het puur
//    om "is deze sleutel geldig".
//  - Eén sleutel tegelijk. Een nieuwe aanmaken trekt de oude in, zodat er nooit
//    een vergeten sleutel blijft rondslingeren.
// ═══════════════════════════════════════════════════════════

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS claude_view_key (
      id         SERIAL PRIMARY KEY,
      key_hash   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ,
      last_used  TIMESTAMPTZ
    )`;
  // Mislukte pogingen worden apart bijgehouden, los van de sleutelrijen: ook
  // als er helemaal geen sleutel klaarstaat wil de cockpit kunnen laten zien
  // dat Claude het geprobeerd heeft. Eén rij, altijd id = 1.
  await sql`
    CREATE TABLE IF NOT EXISTS claude_view_fail (
      id       INTEGER PRIMARY KEY,
      failed_at TIMESTAMPTZ NOT NULL,
      reason    TEXT NOT NULL
    )`;
}

export type ViewKeyStatus = {
  actief: boolean;
  aangemaakt: string | null;
  laatstGebruikt: string | null;
  laatstMislukt: string | null;
  mislukteReden: ViewKeyFailReason | null;
};

/**
 * De enige plek waar "welke sleutel staat er klaar" wordt opgezocht.
 *
 * Waarom dit één functie is: dezelfde vraag stond eerder op drie plekken apart
 * uitgetypt (de status in de cockpit, de controle bij binnenkomst, en het
 * meetpunt). Ze gaven verschillende antwoorden op hetzelfde moment, over
 * dezelfde tabel: het meetpunt vond sleutel 5, de controle zag er nul. Daardoor
 * bleef de cockpit "staat uit" tonen terwijl er wel degelijk een sleutel klaar
 * stond, en werd elke nieuwe sleutel voor niets aangemaakt. Met één opzoeking
 * kunnen ze niet meer uit elkaar lopen. Nooit meer een eigen kopie maken.
 */
export type ActiveKeyRow = { id: number; key_hash: string | null; created_at: string | null; last_used: string | null };

export async function getActiveKey(): Promise<ActiveKeyRow | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT id, key_hash, created_at, last_used FROM claude_view_key WHERE revoked_at IS NULL ORDER BY id DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    key_hash: (r.key_hash as string) ?? null,
    created_at: (r.created_at as string) ?? null,
    last_used: (r.last_used as string) ?? null,
  };
}

/** Staat er een geldige kijk-sleutel klaar, en wanneer is hij voor het laatst gebruikt? */
export async function getViewKeyStatus(): Promise<ViewKeyStatus> {
  const [actief, mislukt] = await Promise.all([
    getActiveKey(),
    sql`SELECT failed_at, reason FROM claude_view_fail WHERE id = 1`,
  ]);
  const f = mislukt.rows[0];
  const fail = {
    laatstMislukt: f?.failed_at ? new Date(f.failed_at as string).toISOString() : null,
    mislukteReden: (f?.reason as ViewKeyFailReason) ?? null,
  };
  if (!actief) return { actief: false, aangemaakt: null, laatstGebruikt: null, ...fail };
  return {
    actief: true,
    aangemaakt: actief.created_at ? new Date(actief.created_at).toISOString() : null,
    laatstGebruikt: actief.last_used ? new Date(actief.last_used).toISOString() : null,
    ...fail,
  };
}

/**
 * Maakt een nieuwe sleutel en trekt alle oude in. De platte waarde komt hier
 * één keer uit; daarna bestaat alleen de hash nog. Kwijt = nieuwe maken.
 */
export async function createViewKey(): Promise<string> {
  await ensureSchema();
  await ensureTable();
  // 40 tekens uit de alfabet-generator: ruim te lang om te raden, en zonder
  // tekens die in een URL of een .env-regel voor verwarring zorgen.
  const plat = `pw-kijk-${generatePassword(40)}`;
  // Intrekken en aanmaken zitten bewust in één statement. Als losse stappen kan
  // de tweede mislukken nadat de eerste is gelukt, en dan staat er ineens geen
  // enkele sleutel meer klaar terwijl het scherm niets laat merken; meekijken
  // staat dan uit zonder dat iemand het doorheeft.
  await sql`
    WITH ingetrokken AS (
      UPDATE claude_view_key SET revoked_at = now() WHERE revoked_at IS NULL RETURNING id
    )
    INSERT INTO claude_view_key (key_hash) VALUES (${hashPassword(plat)})`;
  return plat;
}

/** Trekt de huidige sleutel in. Daarna komt Claude er niet meer bij. */
export async function revokeViewKey(): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE claude_view_key SET revoked_at = now() WHERE revoked_at IS NULL`;
}

// Waarom een poging mislukte. Bewust drie aparte redenen in plaats van één
// "ongeldig": ze vragen om drie verschillende acties van Maarten, en zonder dit
// onderscheid is een geweigerde sleutel van buitenaf niet te onderzoeken.
export type ViewKeyFailReason =
  | "geen-sleutel"   // er staat er helemaal geen klaar: meekijken is uit of ingetrokken
  | "andere-sleutel" // er staat er wél een klaar, maar niet deze: waarschijnlijk een nieuwere
  | "leeg";          // er kwam niets mee

// gezien: hoeveel rijen de controle zelf terugkreeg. Staat er volgens de telling
// wél een sleutel klaar en ziet de controle er nul, dan is dit het bewijs dat het
// verschil in de opzoeking zit en niet in de gegevens.
export type ViewKeyCheck =
  | { ok: true }
  | { ok: false; reden: ViewKeyFailReason; gezien?: number; kolomLeeg?: boolean };

/**
 * Telling voor het geval een sleutel geweigerd wordt terwijl de knop in de
 * cockpit wél een sleutel teruggaf. Dan is de vraag: komt de knopdruk in
 * dezelfde database terecht als deze controle, en blijft de rij daar staan?
 * Alleen aantallen en tijdstippen, nooit een sleutel of een hash, zodat dit
 * ook op de open ingang mee mag zonder iets weg te geven.
 */
export type ViewKeyDiagnose = {
  totaal: number;         // alle sleutels ooit, ook ingetrokken
  ingetrokken: number;    // hoeveel daarvan zijn ingetrokken
  laatsteAangemaakt: string | null;
  // Precies dezelfde opzoeking als de controle doet. Vindt de telling hierboven
  // wél een actieve sleutel en deze niet, dan zit het verschil in de opzoeking
  // en niet in de gegevens.
  gevondenId: number | null;
  hashAanwezig: boolean;
  variantOudId: number | null;
  rijen: { id: number; aangemaakt: string | null; ingetrokken: boolean }[];
};

export async function viewKeyDiagnose(): Promise<ViewKeyDiagnose> {
  await ensureSchema();
  await ensureTable();
  const [tel, zoek, zoekOud, lijst] = await Promise.all([
    sql`SELECT COUNT(*)::int AS totaal, COUNT(revoked_at)::int AS ingetrokken, MAX(created_at) AS laatste
        FROM claude_view_key`,
    // Twee keer dezelfde vraag: de gedeelde opzoeking die de controle nu gebruikt,
    // en de oude losse variant. Ze horen hetzelfde te zeggen. Zeggen ze dat niet,
    // dan is dat hier meteen zichtbaar in plaats van pas na een ronde gokken.
    sql`SELECT id, key_hash FROM claude_view_key WHERE revoked_at IS NULL ORDER BY id DESC LIMIT 1`,
    sql`
      SELECT id, key_hash FROM claude_view_key
      WHERE revoked_at IS NULL ORDER BY id DESC LIMIT 1`,
    sql`SELECT id, created_at, revoked_at FROM claude_view_key ORDER BY id DESC LIMIT 8`,
  ]);
  const r = tel.rows[0];
  return {
    totaal: Number(r?.totaal ?? 0),
    ingetrokken: Number(r?.ingetrokken ?? 0),
    laatsteAangemaakt: r?.laatste ? new Date(r.laatste as string).toISOString() : null,
    gevondenId: zoek.rows[0] ? Number(zoek.rows[0].id) : null,
    hashAanwezig: zoek.rows[0] ? Boolean(zoek.rows[0].key_hash) : false,
    variantOudId: zoekOud.rows[0] ? Number(zoekOud.rows[0].id) : null,
    rijen: lijst.rows.map((x) => ({
      id: Number(x.id),
      aangemaakt: x.created_at ? new Date(x.created_at as string).toISOString() : null,
      ingetrokken: x.revoked_at !== null,
    })),
  };
}

async function noteFail(reden: ViewKeyFailReason): Promise<void> {
  await sql`
    INSERT INTO claude_view_fail (id, failed_at, reason) VALUES (1, now(), ${reden})
    ON CONFLICT (id) DO UPDATE SET failed_at = now(), reason = ${reden}`;
}

/**
 * Klopt deze sleutel? Zo ja, stempelt hij meteen "laatst gebruikt", zodat in de
 * cockpit te zien is of Claude er nog gebruik van maakt. Zo nee, legt hij de
 * mislukte poging vast, zodat de cockpit kan tonen dát Claude het probeerde en
 * waarom het niet lukte. Gooit door als de database niet meewerkt; dat is iets
 * anders dan een sleutel die niet klopt en mag niet als afwijzing eindigen.
 */
export async function checkViewKey(sleutel: string): Promise<ViewKeyCheck> {
  const s = (sleutel || "").trim();
  await ensureSchema();
  await ensureTable();
  if (!s) {
    await noteFail("leeg");
    return { ok: false, reden: "leeg" };
  }
  const r = await getActiveKey();
  if (!r) {
    await noteFail("geen-sleutel");
    return { ok: false, reden: "geen-sleutel", gezien: 0 };
  }
  if (!r.key_hash) {
    // Een rij zonder hash valt niet te controleren. Dat is iets anders dan geen
    // sleutel, en moet apart zichtbaar zijn in plaats van als "verkeerde sleutel".
    await noteFail("andere-sleutel");
    return { ok: false, reden: "andere-sleutel", gezien: 1, kolomLeeg: true };
  }
  if (!verifyPassword(s, r.key_hash)) {
    await noteFail("andere-sleutel");
    return { ok: false, reden: "andere-sleutel", gezien: 1 };
  }
  await sql`UPDATE claude_view_key SET last_used = now() WHERE id = ${r.id}`;
  return { ok: true };
}

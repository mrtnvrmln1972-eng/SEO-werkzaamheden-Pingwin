// ═══════════════════════════════════════════════════════════
// DE CONTROLE-MOTOR: IS DIT ECHT VERWERKT IN DE SITE?
// ═══════════════════════════════════════════════════════════
// Eén knop bij een mail. Hij leest de thread (en de vraag die Maarten intypt),
// haalt daar de afspraken uit, meet de live site, oordeelt per punt en legt een
// concept-antwoord klaar voor de websitebouwer.
//
// De rolverdeling is streng, en dat is het hele punt van dit bestand:
//   - lib/mail-afspraken.ts bepaalt WAT er gevraagd is (model, met nacontroles)
//   - lib/site-controle.ts bepaalt WAT ER STAAT (code, geen model)
//   - hier worden die twee naast elkaar gelegd, en pas daarna mag een model iets
//     opschrijven, uitsluitend op basis van de gemeten waarden.
//
// Achtergrondwerk, want één controle is een handvol pagina's door een echte
// browser plus drie AI-calls. Zelfde stramien als de documentgeneraties: een rij
// met een status, een werker die hem oppakt, een scherm dat pollt, en een cron
// als vangnet voor als de werker halverwege sneuvelt.
// ═══════════════════════════════════════════════════════════

import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { msStatus, msGetThread, type LiveEmail } from "./ms-graph";
import { haalAfspraken, type Afspraak } from "./mail-afspraken";
import {
  bouwSitebeeld, bestaatPagina, beoordeelInterneLink, beoordeelUitNavigatie, beoordeelBron,
  type Sitebeeld, type Meting, type Uitslag,
} from "./site-controle";
import { pagePath } from "./page-internal-links";
import { callClaudeForcedTool, type ToolDef } from "./anthropic";
import { mdToHtml } from "./markdown";
import { voornaamUitAdres } from "./aanhef";

export type ControleStatus = "running" | "done" | "error" | "verstuurd";

export type ControlePunt = {
  puntKey: string;
  soort: string;
  hard: boolean;
  titel: string;
  gevraagd: string;
  gevraagdOp: string;
  devClaim: string;
  devClaimOp: string;
  bronPad: string;
  doelPad: string;
  plek: string;
  uitslag: Uitslag;
  bewijs: string;
  details: Record<string, unknown>;
  /** Maartens eigen oordeel; wint altijd van de meting. */
  handmatig: "" | "goed" | "niet";
};

export type Controle = {
  id: number;
  slug: string;
  conversationId: string;
  messageId: string;
  onderwerp: string;
  devNaam: string;
  devAdres: string;
  vraag: string;
  status: ControleStatus;
  stap: string;
  samenvatting: string;
  conceptOnderwerp: string;
  conceptHtml: string;
  openVragen: string[];
  onduidelijk: { tekst: string; reden: string }[];
  error: string;
  bijgewerkt: string | null;
  punten: ControlePunt[];
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS mail_controles (
      id                SERIAL PRIMARY KEY,
      client_slug       TEXT NOT NULL,
      conversation_id   TEXT NOT NULL DEFAULT '',
      message_id        TEXT NOT NULL DEFAULT '',
      onderwerp         TEXT NOT NULL DEFAULT '',
      dev_naam          TEXT NOT NULL DEFAULT '',
      dev_adres         TEXT NOT NULL DEFAULT '',
      vraag             TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'running',
      stap              TEXT NOT NULL DEFAULT '',
      samenvatting      TEXT NOT NULL DEFAULT '',
      concept_onderwerp TEXT NOT NULL DEFAULT '',
      concept_html      TEXT NOT NULL DEFAULT '',
      open_vragen       JSONB NOT NULL DEFAULT '[]'::jsonb,
      onduidelijk       JSONB NOT NULL DEFAULT '[]'::jsonb,
      error             TEXT NOT NULL DEFAULT '',
      retries           INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS ix_mail_controles_klant ON mail_controles (client_slug, conversation_id, id DESC)`;
  // Eén rij per afspraak. Bewust per controle bewaard en NOOIT overschreven: een
  // link die er in augustus stond en in september weg is, moet zichtbaar blijven.
  // Precies dat gebeurde in januari bij Kamsteeg en toen kon niemand het navertellen.
  await sql`
    CREATE TABLE IF NOT EXISTS mail_controle_punten (
      id           SERIAL PRIMARY KEY,
      controle_id  INTEGER NOT NULL,
      punt_key     TEXT NOT NULL,
      soort        TEXT NOT NULL DEFAULT 'anders',
      hard         BOOLEAN NOT NULL DEFAULT false,
      titel        TEXT NOT NULL DEFAULT '',
      gevraagd     TEXT NOT NULL DEFAULT '',
      gevraagd_op  TEXT NOT NULL DEFAULT '',
      dev_claim    TEXT NOT NULL DEFAULT '',
      dev_claim_op TEXT NOT NULL DEFAULT '',
      bron_pad     TEXT NOT NULL DEFAULT '',
      doel_pad     TEXT NOT NULL DEFAULT '',
      plek         TEXT NOT NULL DEFAULT '',
      uitslag      TEXT NOT NULL DEFAULT 'onmeetbaar',
      bewijs       TEXT NOT NULL DEFAULT '',
      details      JSONB NOT NULL DEFAULT '{}'::jsonb,
      handmatig    TEXT NOT NULL DEFAULT '',
      UNIQUE (controle_id, punt_key)
    )`;
}

async function stap(id: number, tekst: string): Promise<void> {
  await sql`UPDATE mail_controles SET stap = ${tekst}, updated_at = now() WHERE id = ${id}`;
}

// ── Lezen ──

function rijNaarControle(r: Record<string, unknown>, punten: ControlePunt[]): Controle {
  return {
    id: Number(r.id),
    slug: String(r.client_slug || ""),
    conversationId: String(r.conversation_id || ""),
    messageId: String(r.message_id || ""),
    onderwerp: String(r.onderwerp || ""),
    devNaam: String(r.dev_naam || ""),
    devAdres: String(r.dev_adres || ""),
    vraag: String(r.vraag || ""),
    status: (String(r.status || "running") as ControleStatus),
    stap: String(r.stap || ""),
    samenvatting: String(r.samenvatting || ""),
    conceptOnderwerp: String(r.concept_onderwerp || ""),
    conceptHtml: String(r.concept_html || ""),
    openVragen: Array.isArray(r.open_vragen) ? (r.open_vragen as string[]) : [],
    onduidelijk: Array.isArray(r.onduidelijk) ? (r.onduidelijk as { tekst: string; reden: string }[]) : [],
    error: String(r.error || ""),
    bijgewerkt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    punten,
  };
}

export async function getControle(slug: string, id: number): Promise<Controle | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM mail_controles WHERE id = ${id} AND client_slug = ${slug} LIMIT 1`;
  if (!rows[0]) return null;
  const p = await sql`SELECT * FROM mail_controle_punten WHERE controle_id = ${id} ORDER BY id`;
  const punten: ControlePunt[] = p.rows.map((x) => ({
    puntKey: String(x.punt_key), soort: String(x.soort), hard: x.hard === true, titel: String(x.titel),
    gevraagd: String(x.gevraagd), gevraagdOp: String(x.gevraagd_op), devClaim: String(x.dev_claim), devClaimOp: String(x.dev_claim_op),
    bronPad: String(x.bron_pad), doelPad: String(x.doel_pad), plek: String(x.plek),
    uitslag: String(x.uitslag) as Uitslag, bewijs: String(x.bewijs),
    details: (x.details as Record<string, unknown>) || {},
    handmatig: (String(x.handmatig || "") as "" | "goed" | "niet"),
  }));
  return rijNaarControle(rows[0] as Record<string, unknown>, punten);
}

/** De laatste controle voor deze mailthread, voor als het scherm opnieuw opent. */
export async function laatsteControle(slug: string, conversationId: string): Promise<Controle | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id FROM mail_controles
    WHERE client_slug = ${slug} AND conversation_id = ${conversationId}
    ORDER BY id DESC LIMIT 1`;
  if (!rows[0]) return null;
  return getControle(slug, Number(rows[0].id));
}

// ── Starten ──

export async function maakControle(opts: {
  slug: string; conversationId: string; messageId: string; onderwerp: string; vraag: string;
}): Promise<number> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    INSERT INTO mail_controles (client_slug, conversation_id, message_id, onderwerp, vraag, status, stap)
    VALUES (${opts.slug}, ${opts.conversationId}, ${opts.messageId}, ${opts.onderwerp.slice(0, 300)}, ${opts.vraag.slice(0, 2000)}, 'running', 'de mailwisseling lezen')
    RETURNING id`;
  return Number(rows[0].id);
}

async function faal(id: number, boodschap: string): Promise<void> {
  await sql`UPDATE mail_controles SET status = 'error', error = ${boodschap}, stap = '', updated_at = now() WHERE id = ${id}`;
}

// ── Het concept-antwoord ──

const MAIL_TOOL: ToolDef = {
  name: "schrijf_antwoord",
  description: "Schrijft het concept-antwoord aan de websitebouwer.",
  input_schema: {
    type: "object",
    properties: {
      onderwerp: { type: "string", description: "Onderwerpregel, kort." },
      tekst: { type: "string", description: "De mail in eenvoudige markdown: aanhef, korte alinea's, eventueel simpele opsomming met streepjes. Geen kopjes, geen tabellen, geen vetgedrukte woorden." },
    },
    required: ["onderwerp", "tekst"],
  },
};

const MAIL_SYSTEM = `Je schrijft namens Maarten Vermeulen (Pingwin Online Marketing) een kort, collegiaal mailtje aan de websitebouwer over wat er nog niet goed op de site staat.

TOON
Vriendelijk en gewoon, alsof je een collega even bijpraat. Geen verwijten, geen "je hebt niet gedaan wat ik vroeg". De bouwer heeft vaak wél iets gedaan; het gaat om wat er nog rest.

WAT ER IN MOET
- Per punt: wat er nog niet goed staat, met de GEMETEN waarde erbij en de URL. Dus niet "de footerlinks kloppen niet" maar "Hovenier Etten-Leur staat nog in de footer op 12 van de 14 pagina's die ik heb bekeken".
- Neem uitsluitend de bewijsregels over die je hieronder krijgt. Verzin geen cijfers, geen paden en geen extra punten. Staat er iets niet bij, dan noem je het niet.
- Openstaande vragen van de bouwer beantwoord je niet zelf; die noem je kort zodat Maarten er zelf op reageert.
- Punten die niet gemeten konden worden: eerlijk zo benoemen ("die pagina kon ik niet inladen"), nooit als fout.

OPMAAK
Aanhef, twee of drie korte alinea's, eventueel een simpele opsomming met streepjes. Geen kopjes, geen tabellen, geen streepjeslijnen, geen vetgedrukte woorden. Sluit af met een gewone groet.

Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, puntkomma, haakjes of een nieuwe zin.`;

async function schrijfConcept(
  id: number, slug: string, onderwerp: string, devNaam: string, devAdres: string,
  punten: ControlePunt[], openVragen: string[],
): Promise<{ onderwerp: string; html: string }> {
  const teDoen = punten.filter((p) => (p.handmatig || p.uitslag) !== "goed" && p.uitslag !== "vervallen");
  const naam = devNaam || voornaamUitAdres(devAdres) || "";

  const regels = punten.map((p) => {
    const staat = p.handmatig || p.uitslag;
    return `- [${staat}] ${p.titel}\n    gevraagd: "${p.gevraagd}"${p.devClaim ? `\n    de bouwer zei: "${p.devClaim}"` : ""}\n    gemeten: ${p.bewijs || "(geen meting)"}`;
  });

  const context = [
    `AAN: ${naam || devAdres || "de websitebouwer"}`,
    `ONDERWERP VAN DE THREAD: ${onderwerp}`,
    "",
    teDoen.length
      ? "DIT STAAT NOG NIET GOED (alleen hierover schrijven):"
      : "ALLES STAAT GOED. Schrijf dan een kort bedankje en bevestig wat er nu klopt.",
    ...regels,
    "",
    openVragen.length ? `OPENSTAANDE VRAGEN VAN DE BOUWER (kort noemen, niet zelf beantwoorden):\n${openVragen.map((v) => `- "${v}"`).join("\n")}` : "",
  ].filter(Boolean).join("\n");

  const ruw = await callClaudeForcedTool(
    MAIL_SYSTEM,
    [{ role: "user", content: context.slice(0, 30000) }],
    MAIL_TOOL,
    { slug, action: "mail_controle_concept" },
    2000,
  );
  const tekst = String(ruw?.tekst || "").trim();
  const ond = String(ruw?.onderwerp || "").trim() || (/^\s*re:/i.test(onderwerp) ? onderwerp : `RE: ${onderwerp}`);
  if (!tekst) return { onderwerp: ond, html: "" };
  const html = mdToHtml(tekst);
  await sql`UPDATE mail_controles SET concept_onderwerp = ${ond.slice(0, 300)}, concept_html = ${html}, updated_at = now() WHERE id = ${id}`;
  return { onderwerp: ond, html };
}

// ── De run ──

/** Welke pagina's crawlen we? Genoeg om menu en footer te kunnen herkennen. */
function kiesCrawlPaden(afspraken: Afspraak[], urls: { url: string; gscClicks: number; status: number | null }[]): string[] {
  const nodig = new Set<string>(["/"]);
  for (const a of afspraken) {
    if (a.bronPad) nodig.add(a.bronPad);
    if (a.doelPad) nodig.add(a.doelPad);
  }
  // Aanvullen met de drukst bezochte pagina's van de site. Zonder die extra
  // pagina's is niet vast te stellen wat site-breed is, en dan zou elke menu-link
  // als gewone link tellen.
  //
  // De grens staat op twaalf en niet op tien: één verzoek kan zes bronpagina's
  // noemen, en dan zijn er al zeven verplichte paden. Met maar drie opvulpagina's
  // wordt de drempel voor "dit is navigatie" te wankel om op te bouwen.
  const extra = urls
    .filter((u) => (u.status ?? 200) < 400)
    .sort((a, b) => (b.gscClicks || 0) - (a.gscClicks || 0))
    .map((u) => pagePath(u.url));
  for (const p of extra) {
    if (nodig.size >= 12) break;
    nodig.add(p);
  }
  return [...nodig];
}

/** Bestaan-controle voor alle paden die we nodig hebben, in één keer. */
async function bestaanKaart(domein: string, paden: string[]): Promise<Map<string, Awaited<ReturnType<typeof bestaatPagina>>>> {
  const bare = domein.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  const uniek = [...new Set(paden)].filter(Boolean);
  const kaart = new Map<string, Awaited<ReturnType<typeof bestaatPagina>>>();
  for (let i = 0; i < uniek.length; i += 6) {
    const deel = await Promise.all(
      uniek.slice(i, i + 6).map(async (p) => ({ p, r: await bestaatPagina(`https://${bare}${p === "/" ? "/" : p}`) })),
    );
    for (const d of deel) kaart.set(d.p, d.r);
  }
  return kaart;
}

function meetPunt(a: Afspraak, beeld: Sitebeeld, bestaan: Map<string, Awaited<ReturnType<typeof bestaatPagina>>>, doelTitel: string): Meting {
  // Eerst: kan dit punt überhaupt nog? Een bronpagina die niet meer bestaat maakt
  // het verzoek onuitvoerbaar, en dat is iets anders dan niet uitgevoerd. Dit is
  // precies het geval van /hovenier/hovenier-breda/, waar de bouwer zelf op wees.
  const bronOordeel = beoordeelBron(a.bronPad, bestaan.get(a.bronPad));
  if (bronOordeel) return bronOordeel;

  if (a.soort === "uit-navigatie") return beoordeelUitNavigatie(beeld, a.doelPad);

  if (a.soort === "interne-link") {
    const doel = bestaan.get(a.doelPad) || { bestaat: true, status: null, omleiding: "" };
    return beoordeelInterneLink(beeld, a.bronPad, a.doelPad, doelTitel, doel);
  }

  // Richtinggevende punten (styling, kleuren, teksten) meet deze versie nog niet.
  // Liever eerlijk zwijgen dan een oordeel geven dat nergens op steunt.
  return {
    uitslag: "onmeetbaar",
    bewijs: "dit punt gaat niet over links; dat meet ik in deze versie nog niet automatisch",
    details: { soort: a.soort },
  };
}

function maakSamenvatting(punten: ControlePunt[]): string {
  const telling = (u: string) => punten.filter((p) => (p.handmatig || p.uitslag) === u).length;
  const goed = telling("goed"), deels = telling("deels"), niet = telling("niet");
  const onmeetbaar = telling("onmeetbaar"), vervallen = telling("vervallen");
  const meetbaar = goed + deels + niet;
  if (!punten.length) return "Ik heb in deze mailwisseling geen concrete verzoeken aan de websitebouwer gevonden.";
  const delen = [`Live gecontroleerd: ${goed} van de ${meetbaar} meetbare punten staan goed op de site.`];
  if (deels) delen.push(`${deels} ${deels === 1 ? "punt staat" : "punten staan"} er half op.`);
  if (niet) delen.push(`${niet} ${niet === 1 ? "punt staat" : "punten staan"} er niet op.`);
  if (vervallen) delen.push(`${vervallen} ${vervallen === 1 ? "punt is" : "punten zijn"} vervallen omdat de pagina niet meer bestaat.`);
  if (onmeetbaar) delen.push(`${onmeetbaar} ${onmeetbaar === 1 ? "punt kon ik" : "punten kon ik"} niet meten.`);
  return delen.join(" ");
}

/** De hele controle draaien. Aangeroepen vanuit de route (waitUntil) en de cron. */
export async function runControle(id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM mail_controles WHERE id = ${id} LIMIT 1`;
  const rij = rows[0] as Record<string, unknown> | undefined;
  if (!rij || rij.status !== "running") return;
  const slug = String(rij.client_slug);

  try {
    const client = await getClientBySlug(slug);
    if (!client) return faal(id, "Deze klant bestaat niet meer.");
    if (!client.domain) return faal(id, "Deze klant heeft nog geen website ingevuld, dus valt er niets te controleren.");

    // 1. De mailwisseling.
    await stap(id, "de mailwisseling lezen");
    const status = await msStatus();
    let mails: LiveEmail[] = [];
    const conversationId = String(rij.conversation_id || "");
    if (status.connected && conversationId) {
      const t = await msGetThread(conversationId, status.account || "", 40, client.email || client.domain || "");
      mails = t || [];
    }
    const vraag = String(rij.vraag || "");
    if (!mails.length && !vraag.trim()) {
      return faal(id, "Ik kon de mailwisseling niet ophalen en er stond ook geen vraag bij. Typ zelf wat ik moet controleren, dan kan ik verder.");
    }

    // 2. Wat is er gevraagd?
    await stap(id, "uitzoeken wat er gevraagd is");
    const urls = await getClientUrls(slug).catch(() => []);
    const lijst = await haalAfspraken({
      slug, mails, vraag, urls,
      klantNaam: client.name || slug,
      domein: client.domain,
      // Het maildomein van de klant zelf, zodat de klant niet voor de
      // websitebouwer wordt aangezien. Bij Kamsteeg mailen Helma en Sander
      // Kamsteeg vanaf het klantdomein en zit de bouwer op een ander domein.
      klantMailDomein: ((client.email || "").split("@")[1] || client.domain || "").replace(/^www\./i, ""),
    });

    await sql`
      UPDATE mail_controles
      SET dev_naam = ${lijst.devNaam}, dev_adres = ${lijst.devAdres},
          open_vragen = ${JSON.stringify(lijst.openVragen)}::jsonb,
          onduidelijk = ${JSON.stringify(lijst.onduidelijk)}::jsonb,
          updated_at = now()
      WHERE id = ${id}`;

    if (!lijst.afspraken.length) {
      const boodschap = lijst.onduidelijk.length
        ? "Ik vond wel punten, maar kon ze niet aan een pagina op deze website koppelen. Ze staan hieronder; vul aan om welke pagina het gaat."
        : "Ik heb in deze mailwisseling geen concrete verzoeken aan de websitebouwer gevonden. Typ zelf wat ik moet controleren.";
      await sql`UPDATE mail_controles SET status = 'done', stap = '', samenvatting = ${boodschap}, updated_at = now() WHERE id = ${id}`;
      return;
    }

    // 3. De site meten.
    const paden = kiesCrawlPaden(lijst.afspraken, urls);
    await stap(id, `de site lezen (${paden.length} pagina's)`);
    const beeld = await bouwSitebeeld(client.domain, paden);

    await stap(id, "controleren of de pagina's bestaan");
    const bestaan = await bestaanKaart(
      client.domain,
      [...new Set(lijst.afspraken.flatMap((a) => [a.bronPad, a.doelPad]).filter(Boolean))],
    );

    // Geen enkele pagina leesbaar: dan is er niets gemeten en zeggen we dat, in
    // plaats van alle punten op "niet gedaan" te zetten.
    const leesbaar = beeld.paginas.filter((p) => p.meetbaar).length;
    if (!leesbaar) {
      const reden = beeld.paginas.find((p) => p.reden)?.reden || "de site liet zich niet lezen";
      return faal(id, `Ik kon geen enkele pagina van ${client.domain} lezen: ${reden}. Zolang dat zo is kan ik niets over deze site beweren.`);
    }

    // 4. Oordelen.
    await stap(id, "de punten beoordelen");
    const titelVan = new Map(beeld.paginas.map((p) => [p.pad, p.titel]));
    const punten: ControlePunt[] = [];
    for (const a of lijst.afspraken) {
      const m = meetPunt(a, beeld, bestaan, titelVan.get(a.doelPad) || "");
      punten.push({
        puntKey: a.puntKey, soort: a.soort, hard: a.hard, titel: a.titel,
        gevraagd: a.gevraagd, gevraagdOp: a.gevraagdOp, devClaim: a.devClaim, devClaimOp: a.devClaimOp,
        bronPad: a.bronPad, doelPad: a.doelPad, plek: a.plek,
        uitslag: m.uitslag, bewijs: m.bewijs, details: m.details, handmatig: "",
      });
      await sql`
        INSERT INTO mail_controle_punten
          (controle_id, punt_key, soort, hard, titel, gevraagd, gevraagd_op, dev_claim, dev_claim_op, bron_pad, doel_pad, plek, uitslag, bewijs, details)
        VALUES
          (${id}, ${a.puntKey}, ${a.soort}, ${a.hard}, ${a.titel}, ${a.gevraagd}, ${a.gevraagdOp}, ${a.devClaim}, ${a.devClaimOp},
           ${a.bronPad}, ${a.doelPad}, ${a.plek}, ${m.uitslag}, ${m.bewijs}, ${JSON.stringify(m.details)}::jsonb)
        ON CONFLICT (controle_id, punt_key) DO UPDATE
          SET uitslag = ${m.uitslag}, bewijs = ${m.bewijs}, details = ${JSON.stringify(m.details)}::jsonb`;
    }

    const samenvatting = maakSamenvatting(punten);
    await sql`UPDATE mail_controles SET samenvatting = ${samenvatting}, updated_at = now() WHERE id = ${id}`;

    // 5. Het concept-antwoord.
    await stap(id, "een concept-antwoord opstellen");
    await schrijfConcept(id, slug, String(rij.onderwerp || ""), lijst.devNaam, lijst.devAdres, punten, lijst.openVragen).catch(() => null);

    await sql`UPDATE mail_controles SET status = 'done', stap = '', updated_at = now() WHERE id = ${id}`;
  } catch (e) {
    await faal(id, e instanceof Error ? e.message.slice(0, 400) : "Er ging iets mis tijdens de controle.");
  }
}

/** Maartens eigen oordeel over een punt; wint altijd van de meting. */
export async function zetHandmatig(slug: string, id: number, puntKey: string, waarde: "" | "goed" | "niet"): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    UPDATE mail_controle_punten p SET handmatig = ${waarde}
    FROM mail_controles c
    WHERE p.controle_id = c.id AND c.id = ${id} AND c.client_slug = ${slug} AND p.punt_key = ${puntKey}`;
}

export async function bewaarConcept(slug: string, id: number, onderwerp: string, html: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    UPDATE mail_controles SET concept_onderwerp = ${onderwerp.slice(0, 300)}, concept_html = ${html}, updated_at = now()
    WHERE id = ${id} AND client_slug = ${slug}`;
}

export async function markeerVerstuurd(slug: string, id: number): Promise<void> {
  await sql`UPDATE mail_controles SET status = 'verstuurd', updated_at = now() WHERE id = ${id} AND client_slug = ${slug}`;
}

/**
 * Vangnet voor de cron: controles die blijven hangen. De werker geeft bij elke
 * stap een hartslag (updated_at); tien minuten stil betekent dat hij dood is,
 * bijvoorbeeld door een deploy. Na drie pogingen stoppen we definitief, zodat een
 * controle die telkens sneuvelt niet eindeloos AI-kosten blijft maken.
 */
export async function herstelVastgelopen(): Promise<number[]> {
  await ensureSchema();
  await ensureTable();
  await sql`
    UPDATE mail_controles
    SET status = 'error', error = 'De controle bleef hangen en is drie keer opnieuw geprobeerd. Start hem opnieuw als je hem nog nodig hebt.', updated_at = now()
    WHERE status = 'running' AND retries >= 3 AND updated_at < now() - interval '10 minutes'`;
  const { rows } = await sql`
    UPDATE mail_controles SET retries = retries + 1, updated_at = now()
    WHERE status = 'running' AND updated_at < now() - interval '10 minutes'
    RETURNING id`;
  return rows.map((r) => Number(r.id));
}

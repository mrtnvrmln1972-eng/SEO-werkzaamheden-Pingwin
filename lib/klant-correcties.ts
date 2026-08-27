import { sql, ensureSchema } from "./db";
import { callClaudeForcedTool } from "./anthropic";
import { msStatus, msSearchClientEmails, type LiveEmail } from "./ms-graph";
import { isRuisMail } from "./mail-tekst";

// ═══════════════════════════════════════════════════════════
// WAT DE KLANT ZELF ZEGT
// ═══════════════════════════════════════════════════════════
// Eén plakvak per klant. Je plakt er rauwe tekst in (een mail, een appje, een
// notitie uit een gesprek) en die wordt hier omgezet in korte regels in drie
// bakjes: feiten, wat we wel en niet doen, en woorden. Die regels gaan daarna
// automatisch mee in ELKE opdracht aan de AI, bovenaan, met de mededeling dat
// ze vóór de site-analyse gaan.
//
// Waarom dit een eigen tabel is en geen stuk tekst in het klantprofiel:
// het profielveld wordt overschreven door de knoppen "Klantprofiel opstellen"
// en "Tone-of-voice analyse". Op 27-08-2026 verdween de nuancering die Paul
// Hoevenaars had aangeleverd (vestigingsplaats, geen HOOG-partner meer, welke
// woorden hij niet wil) in één misklik op zo'n knop, omdat de samenvoeging
// alles vanaf de tone-of-voice-kop tot het eind verving en de eigen know-how
// daar nu eenmaal onder stond. Wat buiten dat veld leeft, kan geen enkele
// analyseknop meer aanraken. Dat is de hele reden van bestaan van dit bestand.
//
// Tweede reden, even belangrijk: bijna elke motor kapt het klantprofiel af
// (1.200 tot 3.500 tekens). Wat achteraan staat sneuvelt dus als eerste, en dat
// was precies de door de klant aangeleverde kennis. Dit blok gaat er altijd
// VOOR, dus het wordt nooit het eerste dat wegvalt.
// ═══════════════════════════════════════════════════════════

/** De drie bakjes. Meer worden het er niet; bij twijfel kiest de AI "feit". */
export const CATEGORIEEN = ["feit", "aanbod", "woorden"] as const;
export type Categorie = (typeof CATEGORIEEN)[number];

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  feit: "Feiten",
  aanbod: "Wat we wel en niet doen",
  woorden: "Woorden en toon",
};

/** De vaste kop van het blok dat in élke AI-opdracht bovenaan komt te staan. */
export const CORRECTIE_HEADER = "## Wat de klant zelf zegt (LEIDEND)";

/**
 * De voorrangsregel, letterlijk. Staat als één zin in het blok zelf, zodat hij
 * meereist naar elke motor en niet op twintig plekken apart uitgeschreven hoeft
 * te worden (dat is precies de fout die dit dashboard al vaker heeft gemaakt).
 */
export const VOORRANG_ZIN =
  "Deze regels zijn NA de website-analyse door de klant zelf aangeleverd en gaan VOOR alles wat hieronder uit die analyse komt. Spreekt het automatische klantprofiel, de tone-of-voice-analyse, een eerder document of de live site een regel hieronder tegen, dan wint deze regel. Schrijf nooit iets dat hier verboden wordt, ook niet als het elders nog wel zo staat.";

export type CorrectieRegel = {
  id: number;
  correctieId: number | null;
  categorie: Categorie;
  regel: string;
  bron: string;
  datum: string | null;
  vervallenDoor: number | null;
};

export type Correctie = {
  id: number;
  bron: string;
  datum: string | null;
  ruw: string;
  regels: CorrectieRegel[];
};

function alsCategorie(v: unknown): Categorie {
  const t = String(v || "").trim().toLowerCase();
  return (CATEGORIEEN as readonly string[]).includes(t) ? (t as Categorie) : "feit";
}

function alsDag(v: unknown): string | null {
  if (!v) return null;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Datum als "20-08-2026"; leeg als er geen datum bekend is. */
export function datumKort(d: string | null): string {
  if (!d) return "";
  const [j, m, dag] = d.split("-");
  return `${dag}-${m}-${j}`;
}

/** Bronvermelding zoals hij achter een regel komt te staan. */
export function bronLabel(bron: string, datum: string | null): string {
  const b = (bron || "").trim();
  const d = datumKort(datum);
  if (b && d) return `${b}, ${d}`;
  return b || d;
}

// ── Lezen ────────────────────────────────────────────────────────────────────

type RegelRij = {
  id: number; correctie_id: number | null; categorie: string; regel: string;
  bron: string; datum: string | Date | null; vervallen_door: number | null;
};

/** Alle regels van een klant, geldig én vervallen, nieuwste eerst. */
export async function alleRegels(slug: string): Promise<CorrectieRegel[]> {
  await ensureSchema();
  const { rows } = await sql<RegelRij>`
    SELECT id, correctie_id, categorie, regel, bron, datum, vervallen_door
    FROM klant_correctie_regels WHERE client_slug = ${slug}
    ORDER BY datum DESC NULLS LAST, id DESC`;
  return rows.map((r) => ({
    id: r.id,
    correctieId: r.correctie_id,
    categorie: alsCategorie(r.categorie),
    regel: r.regel,
    bron: r.bron || "",
    datum: alsDag(r.datum),
    vervallenDoor: r.vervallen_door,
  }));
}

/** De regels die nu gelden (dus niet achterhaald door een latere regel). */
export async function geldigeRegels(slug: string): Promise<CorrectieRegel[]> {
  return (await alleRegels(slug)).filter((r) => r.vervallenDoor === null);
}

/** De ruwe stukken tekst met hun regels eronder, nieuwste eerst. */
export async function alleCorrecties(slug: string): Promise<Correctie[]> {
  await ensureSchema();
  const [{ rows }, regels] = await Promise.all([
    sql<{ id: number; bron: string; datum: string | Date | null; ruw: string }>`
      SELECT id, bron, datum, ruw FROM klant_correcties
      WHERE client_slug = ${slug} ORDER BY datum DESC NULLS LAST, id DESC`,
    alleRegels(slug),
  ]);
  return rows.map((r) => ({
    id: r.id,
    bron: r.bron || "",
    datum: alsDag(r.datum),
    ruw: r.ruw || "",
    regels: regels.filter((g) => g.correctieId === r.id),
  }));
}

// ── Het blok dat de AI leest ─────────────────────────────────────────────────

/**
 * De geldige regels als markdown-blok, met de voorrangszin erboven. Leeg als er
 * niets is: dan verandert er ook niets aan wat de motoren al deden.
 */
export function regelsNaarBlok(regels: CorrectieRegel[]): string {
  const geldig = regels.filter((r) => r.vervallenDoor === null && r.regel.trim());
  if (!geldig.length) return "";
  const delen: string[] = [CORRECTIE_HEADER, "", VOORRANG_ZIN];
  for (const cat of CATEGORIEEN) {
    const van = geldig.filter((r) => r.categorie === cat);
    if (!van.length) continue;
    delen.push("", `**${CATEGORIE_LABEL[cat]}**`);
    for (const r of van) {
      const bron = bronLabel(r.bron, r.datum);
      delen.push(`- ${r.regel.trim()}${bron ? ` (${bron})` : ""}`);
    }
  }
  return delen.join("\n");
}

/** Hetzelfde blok, rechtstreeks uit de database. */
export async function correctieBlok(slug: string): Promise<string> {
  try {
    return regelsNaarBlok(await alleRegels(slug));
  } catch {
    // Nooit een motor laten struikelen over dit blok: zonder correcties werkt
    // alles precies zoals het werkte voordat dit bestond.
    return "";
  }
}

/**
 * Zet het correctieblok VÓÓR de opgeslagen profieltekst. Dit is de enige plek
 * waar die twee samenkomen; `getClientBySlug` roept hem aan, zodat elke motor,
 * chat en document het automatisch meekrijgt zonder eigen regel.
 */
export function voegCorrectiesVoor(blok: string, profiel: string | null): string | null {
  const b = (blok || "").trim();
  const p = (profiel || "").trim();
  if (!b) return profiel;
  return p ? `${b}\n\n${p}` : b;
}

// ── Verwerken: van geplakte tekst naar regels ────────────────────────────────

const VERWERK_SYSTEM = `Je bent de kennisbeheerder van SEO-bureau Pingwin. Je krijgt een stuk tekst dat een klant zelf heeft aangeleverd (meestal een mail) met correcties of aanvullingen op wat wij over zijn bedrijf dachten te weten. Jouw taak: dat omzetten in korte, harde werkregels die een copywriter of AI letterlijk kan volgen.

REGELS VOOR JE UITVOER:
- Eén regel is één afspraak, in gewone taal, maximaal ongeveer 25 woorden, als gebiedende instructie of feit. Niet "Paul geeft aan dat hij liever geen exclusief gebruikt" maar "Gebruik het woord exclusief niet".
- Verzin niets en vul niets aan. Staat het niet in de tekst, dan maak je er geen regel van.
- Laat beleefdheden, vragen aan ons, planning en bedankjes weg. Alleen wat iets zegt over het bedrijf, het aanbod, de positionering of het taalgebruik.
- Kies per regel één bakje:
  - "feit": harde, controleerbare gegevens (vestigingsplaats, werkgebied, oprichtingsjaar, partnerschappen, samenwerkingen, cijfers, namen, wat wel of niet vermeld mag worden omdat het niet meer klopt).
  - "aanbod": wat het bedrijf wel en niet doet, voor wie, welke diensten, welke projecten, prijsniveau, hoe het werkproces loopt.
  - "woorden": taalgebruik, toon, welke woorden wel of niet gebruikt mogen worden, formuleringen die te zwaar of te absoluut zijn.
- Is iets een verbod, schrijf het als verbod ("Noem ... niet", "Gebruik ... niet"), want een verbod dat als suggestie is opgeschreven wordt genegeerd.
- Verwerk ook nuances die geen verbod zijn maar een correctie op de nadruk ("wij doen X ook, maar profileren ons er niet op").

ACHTERHAALDE REGELS:
Je krijgt de regels die nu gelden, met hun nummer. Spreekt een nieuwe regel er één tegen, of vervangt hij hem, zet dat nummer dan in "vervangt". Alleen bij een echte tegenspraak of vervanging; een regel die iets anders zegt over een ander onderwerp vervangt niets.

BEDRIJFSGEGEVENS:
Noemt de tekst een gegeven dat in de structured data hoort (plaats, straat, postcode, telefoon, e-mail, oprichtingsjaar, werkgebied, openingstijden, prijsindicatie, KvK, BTW), zet dat dan ook in "bedrijfsgegevens" met de exacte veldnaam en de waarde. Werkgebied is een lijst plaatsen of regio's, gescheiden door een puntkomma. Noemt de tekst zoiets niet, laat de lijst dan leeg.`;

const VERWERK_TOOL = {
  name: "correcties",
  description: "De regels die uit de aangeleverde tekst volgen.",
  input_schema: {
    type: "object" as const,
    properties: {
      bron: { type: "string", description: "Wie dit aanleverde en waarin, bijv. 'mail Paul'. Leeg als het niet uit de tekst blijkt." },
      datum: { type: "string", description: "Datum van de tekst als JJJJ-MM-DD, als die eruit blijkt. Anders leeg." },
      regels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            categorie: { type: "string", enum: ["feit", "aanbod", "woorden"] },
            regel: { type: "string" },
            vervangt: { type: "array", items: { type: "number" }, description: "Nummers van geldende regels die hierdoor achterhaald zijn." },
          },
          required: ["categorie", "regel"],
        },
      },
      bedrijfsgegevens: {
        type: "array",
        items: {
          type: "object",
          properties: {
            veld: { type: "string", enum: ["plaats", "straat", "postcode", "telefoon", "email", "oprichtingsjaar", "areaServed", "openingstijden", "priceRange", "kvk", "btw"] },
            waarde: { type: "string" },
          },
          required: ["veld", "waarde"],
        },
      },
    },
    required: ["regels"],
  },
};

export type OrgVoorstel = { veld: string; waarde: string };

export type VerwerkResultaat = {
  ok: boolean;
  correctieId?: number;
  aantal?: number;
  vervallen?: number;
  orgVoorstellen?: OrgVoorstel[];
  error?: string;
};

const ORG_VELDEN = new Set(["plaats", "straat", "postcode", "telefoon", "email", "oprichtingsjaar", "areaServed", "openingstijden", "priceRange", "kvk", "btw"]);

/**
 * Slaat de geplakte tekst op, laat er regels uit destilleren en zet die klaar.
 * De ruwe tekst blijft altijd bewaard, ook als het destilleren mislukt: dan is
 * er hooguit werk blijven liggen, maar er is nooit iets kwijt.
 */
export async function verwerkPlaksel(
  slug: string,
  ruw: string,
  handmatig?: { bron?: string; datum?: string | null },
): Promise<VerwerkResultaat> {
  const tekst = (ruw || "").trim();
  if (!tekst) return { ok: false, error: "Er staat nog niets in het plakvak." };
  await ensureSchema();

  // Het plakvak levert HTML (het is een rijk tekstveld, zodat een geplakte mail
  // zijn kopjes en opsommingen houdt). De AI leest platte tekst: tags eruit,
  // blokken worden regeleinden. De HTML zelf blijft bewaard voor het scherm.
  const plat = tekst
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const geldig = await geldigeRegels(slug);
  const bestaand = geldig.length
    ? geldig.map((r) => `${r.id}. [${r.categorie}] ${r.regel}`).join("\n")
    : "(nog geen regels)";

  let uit: Record<string, unknown> | null = null;
  let fout = "onbekende fout";
  try {
    uit = await callClaudeForcedTool(
      VERWERK_SYSTEM,
      [{ role: "user", content: `REGELS DIE NU GELDEN:\n${bestaand}\n\nAANGELEVERDE TEKST:\n${(plat || tekst).slice(0, 24000)}` }],
      VERWERK_TOOL,
      { slug, action: "klant-correcties" },
      4000,
    );
  } catch (e) {
    // De ruwe tekst gaat hieronder alsnog de kast in, zodat hij niet verloren is.
    uit = null;
    fout = (e as Error).message;
  }

  const bron = (handmatig?.bron || String(uit?.bron || "") || "").trim();
  const datum = alsDag(handmatig?.datum || uit?.datum) || alsDag(new Date().toISOString());

  const { rows } = await sql<{ id: number }>`
    INSERT INTO klant_correcties (client_slug, bron, datum, ruw)
    VALUES (${slug}, ${bron}, ${datum}, ${tekst}) RETURNING id`;
  const correctieId = rows[0].id;

  if (!uit) return { ok: false, correctieId, error: `De tekst is bewaard, maar het uitwerken naar regels mislukte: ${fout}. Klik op "Opnieuw uitwerken".` };

  const binnen = Array.isArray(uit.regels) ? (uit.regels as Record<string, unknown>[]) : [];
  const geldigeIds = new Set(geldig.map((r) => r.id));
  let vervallen = 0;
  let aantal = 0;

  for (const r of binnen) {
    const regel = String(r.regel || "").trim();
    if (!regel) continue;
    const { rows: nieuw } = await sql<{ id: number }>`
      INSERT INTO klant_correctie_regels (client_slug, correctie_id, categorie, regel, bron, datum)
      VALUES (${slug}, ${correctieId}, ${alsCategorie(r.categorie)}, ${regel}, ${bron}, ${datum})
      RETURNING id`;
    aantal++;
    const vervangt = Array.isArray(r.vervangt) ? (r.vervangt as unknown[]) : [];
    for (const v of vervangt) {
      const oud = Number(v);
      // Alleen een regel die écht bestond en nu nog gold mag vervallen; zo kan
      // een verzonnen nummer nooit iets anders omzeggen.
      if (!geldigeIds.has(oud)) continue;
      await sql`UPDATE klant_correctie_regels SET vervallen_door = ${nieuw[0].id}
        WHERE id = ${oud} AND client_slug = ${slug} AND vervallen_door IS NULL`;
      vervallen++;
    }
  }

  const orgRuw = Array.isArray(uit.bedrijfsgegevens) ? (uit.bedrijfsgegevens as Record<string, unknown>[]) : [];
  const orgVoorstellen: OrgVoorstel[] = orgRuw
    .map((o) => ({ veld: String(o.veld || "").trim(), waarde: String(o.waarde || "").trim() }))
    .filter((o) => ORG_VELDEN.has(o.veld) && o.waarde);

  return { ok: true, correctieId, aantal, vervallen, orgVoorstellen };
}

/**
 * Rechtstreeks uit de mailbox: de binnengekomen mails van deze klant, met de
 * mails die al verwerkt zijn eruit gefilterd.
 *
 * Dit bestaat omdat kopiëren en plakken de enige handeling was die overbleef, en
 * dat is precies het soort handeling dat overgeslagen wordt zodra het druk is.
 * De mail staat al in het dashboard; er is geen reden om hem eerst ergens anders
 * te openen.
 */
export async function mailsOmTeVerwerken(slug: string, limiet = 100): Promise<
  { id: string; onderwerp: string; van: string; datum: string | null; aanhef: string; link: string; verwerkt: boolean }[]
> {
  await ensureSchema();
  const [live, gedaan, eigen] = await Promise.all([liveMails(slug, limiet), verwerkteBronnen(slug), eigenDomeinen(slug)]);
  return live
    .filter((m) => m.direction === "in" && (m.bodyHtml || m.preview || "").trim())
    // Alleen mail van de klant zelf, en geen automatische ruis. Zonder dit filter
    // stonden er bij Paul Hoevenaars vierentwintig regels in de kiezer waarvan er
    // twee van hem waren; de rest was Ahrefs, Search Console en Stiply. Dan zoek
    // je alsnog, en zoeken is precies wat dit blok moest wegnemen.
    .filter((m) => !isRuisMail({ fromAddress: m.fromAddress, subject: m.subject }))
    .filter((m) => {
      if (!eigen.length) return true;
      const adres = (m.fromAddress || "").toLowerCase();
      return eigen.some((d) => adres.endsWith(`@${d}`) || adres === d);
    })
    .map((m) => ({
      id: m.id,
      onderwerp: (m.subject || "(zonder onderwerp)").trim(),
      van: (m.fromName || m.fromAddress || "").trim(),
      datum: alsDag(m.receivedAt),
      aanhef: (m.preview || "").replace(/\s+/g, " ").trim().slice(0, 140),
      // Superhuman opent de thread meteen; de Outlook-link is de terugval, zoals
      // overal in dit dashboard (zie superhumanThreadLink in lib/ms-graph.ts).
      link: (m.superhumanLink || m.webLink || "").trim(),
    }))
    // Verwerkte mails blijven staan met een vinkje erachter, in plaats van uit de
    // lijst te verdwijnen. Verdwijnen leest namelijk precies hetzelfde als "er is
    // niets gebeurd": op 27-08-2026 dacht Maarten daardoor dat de knop niet
    // werkte, terwijl beide mails gewoon verwerkt waren.
    .map((m) => ({ ...m, verwerkt: gedaan.has(mailBron(m.van, m.onderwerp)) }))
    .sort((a, b) => Number(a.verwerkt) - Number(b.verwerkt));
}

/** Vaste bronnaam voor een mail, zodat een verwerkte mail herkenbaar blijft. */
export function mailBron(van: string, onderwerp: string): string {
  const naam = (van || "").split(/[<@]/)[0].trim() || "mail";
  return `mail ${naam}: ${(onderwerp || "").trim()}`.slice(0, 200);
}

/** De domeinen die bij deze klant horen (uit het klantmailadres en het domein). */
async function eigenDomeinen(slug: string): Promise<string[]> {
  const { rows } = await sql<{ email: string | null; domain: string | null }>`
    SELECT email, domain FROM clients WHERE slug = ${slug} LIMIT 1`;
  const uit = new Set<string>();
  const mail = (rows[0]?.email || "").toLowerCase().trim();
  if (mail.includes("@")) uit.add(mail.split("@")[1]);
  const dom = (rows[0]?.domain || "").toLowerCase().trim()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (dom) uit.add(dom);
  return [...uit].filter(Boolean);
}

async function verwerkteBronnen(slug: string): Promise<Set<string>> {
  const { rows } = await sql<{ bron: string }>`SELECT bron FROM klant_correcties WHERE client_slug = ${slug}`;
  return new Set(rows.map((r) => (r.bron || "").trim()).filter(Boolean));
}

/**
 * De mails met deze klant, live uit Microsoft 365 met de opgeslagen mails als
 * terugval. Live is nodig omdat de mailtabel lang niet voor elke klant gevuld
 * is: bij Paul Hoevenaars stond er niets in, terwijl het cockpitscherm zijn
 * mails gewoon toonde. Een kiezer die daardoor leeg blijft, is geen kiezer.
 */
async function liveMails(slug: string, limiet: number): Promise<LiveEmail[]> {
  // Bewust een eigen query en niet getClientBySlug: dat bestand leest juist ons
  // correctieblok, en dan wijzen de twee bestanden naar elkaar.
  const { rows: kl } = await sql<{ email: string | null; domain: string | null }>`
    SELECT email, domain FROM clients WHERE slug = ${slug} LIMIT 1`;
  const zoek = (kl[0]?.email || kl[0]?.domain || "").trim();
  if (zoek) {
    try {
      const status = await msStatus();
      if (status.connected) {
        const uit = await msSearchClientEmails(zoek, status.account || "", Math.min(100, Math.max(15, limiet)));
        if (uit && uit.length) return uit;
      }
    } catch { /* terugval hieronder */ }
  }
  const { rows } = await sql<{ id: string; subject: string | null; from_name: string | null; from_address: string | null; received_at: string | Date | null; preview: string | null; body_html: string | null; direction: string | null }>`
    SELECT id, subject, from_name, from_address, received_at, preview, body_html, direction
    FROM client_emails WHERE client_slug = ${slug}
    ORDER BY received_at DESC NULLS LAST LIMIT ${limiet}`;
  return rows.map((r) => ({
    id: r.id, subject: r.subject, fromName: r.from_name, fromAddress: r.from_address,
    receivedAt: r.received_at ? new Date(r.received_at as string).toISOString() : null,
    preview: r.preview, webLink: null, superhumanLink: null, bodyHtml: r.body_html,
    direction: r.direction, toAddresses: [],
  }));
}

/** Eén mail uit het dashboard rechtstreeks verwerken, zonder kopiëren en plakken. */
export async function verwerkMail(slug: string, messageId: string): Promise<VerwerkResultaat> {
  await ensureSchema();
  const m = (await liveMails(slug, 60)).find((x) => x.id === messageId);
  if (!m) return { ok: false, error: "Die mail is niet meer te vinden bij deze klant." };
  const tekst = (m.bodyHtml || m.preview || "").trim();
  if (!tekst) return { ok: false, error: "Van deze mail is de tekst niet op te halen. Plak hem met de hand." };
  const van = (m.fromName || m.fromAddress || "").trim();
  return verwerkPlaksel(slug, tekst, { bron: mailBron(van, m.subject || ""), datum: alsDag(m.receivedAt) });
}

/** Eén geplakt stuk tekst opnieuw uitwerken (na een mislukte ronde of een correctie). */
export async function opnieuwUitwerken(slug: string, correctieId: number): Promise<VerwerkResultaat> {
  await ensureSchema();
  const { rows } = await sql<{ ruw: string; bron: string; datum: string | Date | null }>`
    SELECT ruw, bron, datum FROM klant_correcties WHERE id = ${correctieId} AND client_slug = ${slug} LIMIT 1`;
  if (!rows[0]) return { ok: false, error: "Deze tekst bestaat niet (meer)." };
  // Eerst de regels van deze ronde weg, anders komt alles dubbel te staan. De
  // regels die híerdoor vervallen waren, worden weer geldig.
  const { rows: oud } = await sql<{ id: number }>`
    SELECT id FROM klant_correctie_regels WHERE correctie_id = ${correctieId} AND client_slug = ${slug}`;
  for (const o of oud) {
    await sql`UPDATE klant_correctie_regels SET vervallen_door = NULL WHERE vervallen_door = ${o.id} AND client_slug = ${slug}`;
  }
  await sql`DELETE FROM klant_correctie_regels WHERE correctie_id = ${correctieId} AND client_slug = ${slug}`;
  await sql`DELETE FROM klant_correcties WHERE id = ${correctieId} AND client_slug = ${slug}`;
  return verwerkPlaksel(slug, rows[0].ruw, { bron: rows[0].bron || "", datum: alsDag(rows[0].datum) });
}

/** Eén geplakt stuk tekst met alle regels eruit verwijderen. */
export async function verwijderCorrectie(slug: string, correctieId: number): Promise<boolean> {
  await ensureSchema();
  const { rows } = await sql<{ id: number }>`
    SELECT id FROM klant_correctie_regels WHERE correctie_id = ${correctieId} AND client_slug = ${slug}`;
  for (const o of rows) {
    await sql`UPDATE klant_correctie_regels SET vervallen_door = NULL WHERE vervallen_door = ${o.id} AND client_slug = ${slug}`;
  }
  await sql`DELETE FROM klant_correcties WHERE id = ${correctieId} AND client_slug = ${slug}`;
  return true;
}

/** Eén losse regel aanpassen of weghalen (handwerk boven een nieuwe AI-ronde). */
export async function wijzigRegel(slug: string, id: number, tekst: string): Promise<boolean> {
  await ensureSchema();
  const t = (tekst || "").trim();
  if (!t) {
    await sql`UPDATE klant_correctie_regels SET vervallen_door = NULL WHERE vervallen_door = ${id} AND client_slug = ${slug}`;
    await sql`DELETE FROM klant_correctie_regels WHERE id = ${id} AND client_slug = ${slug}`;
    return true;
  }
  await sql`UPDATE klant_correctie_regels SET regel = ${t} WHERE id = ${id} AND client_slug = ${slug}`;
  return true;
}

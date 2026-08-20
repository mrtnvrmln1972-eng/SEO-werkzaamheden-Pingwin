import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getSetting, setSetting } from "./settings";
import { listClients, createLead, setClientFase, deleteClient, normalizeDomain, slugify, type ClientConfig } from "./clients";
import { addDossierItem } from "./lead-dossier";
import { meldingToevoegen } from "./meldingen";
import { saveRegelUitBron } from "./prognose";
import {
  hubspotConfigured, hsDeals, hsPijplijnen, hsBedrijfVanDeal, hsContactenVanDeal,
  hsGesprekkenVanDeal, hsTakenVanDeal, hsEigenaren, hsDealLink, hsContactLink,
  hsContacten, hsVelden, veldAlsDatum,
  type HsDeal, type HsPijplijn, type HsVeld,
} from "./hubspot";

// ═══════════════════════════════════════════════════════════
// VAN HUBSPOT-DEAL NAAR LEAD IN HET DASHBOARD
// ═══════════════════════════════════════════════════════════
// In HubSpot staat de verkoop, hier staat het werk. Deze laag haalt het eerste
// naar het tweede toe, en houdt zich aan één regel die alles simpel houdt:
//
//   ELK VELD HEEFT ÉÉN BAAS.
//
//   HubSpot is de baas over: naam, fase, verwachte sluitingsdatum, het
//   eerstvolgende contactmoment, en de kans die bij de fase hoort.
//   Het dashboard is de baas over: het beoogde maandbudget (want een deal in
//   HubSpot is meestal een totaalbedrag, en de prognose rekent met maandbedragen)
//   en alles wat we hier maken (dossier, documenten, metingen).
//
// Zet Maarten de kans of de startmaand met de hand, dan wint dat voorgoed; de
// ronde hieronder schrijft alleen waar niemand aan gezeten heeft. Zie ook
// HUBSPOT-LEADS.md.
//
// Wat deze ronde NOOIT doet: een klant terugzetten naar lead, een bedrag
// overschrijven, of iets weggooien. Verdwijnt een deal, dan blijft de lead staan
// met zijn laatste stand.
// ═══════════════════════════════════════════════════════════

export const SETTING_PIJPLIJNEN = "hubspot_pijplijnen";
export const SETTING_LAATSTE_RONDE = "hubspot_laatste_ronde";
export const SETTING_NOTITIES_TERUG = "hubspot_notities_terug";
export const SETTING_AUTO_LEADS = "hubspot_auto_leads";
export const SETTING_BRON = "hubspot_bron";
export const SETTING_FILTER_VELD = "hubspot_filter_veld";
export const SETTING_FILTER_WAARDE = "hubspot_filter_waarde";
export const SETTING_VELDEN = "hubspot_velden";
export const SETTING_KANS = "hubspot_kans";
export const SETTING_EIGENAAR = "hubspot_eigenaar";

/**
 * Welke betekenis welk HubSpot-veld heeft. Leeg = dat gegeven komt niet uit
 * HubSpot, en dan blijft het gewoon in het dashboard te zetten.
 *
 * Bewust een koppeling en geen vaste veldnaam: elk HubSpot-account heeft zijn
 * eigen velden met eigen namen, en een gegokte naam levert stilletjes lege
 * kolommen op. Maarten kiest ze op /admin/beheer uit zijn eigen lijst.
 */
export type Veldkoppeling = {
  /** Datumveld: wanneer verwacht je dat ze klant worden. */
  startDatum: string;
  /** Datumveld: wanneer spreek je ze weer (leeg = de openstaande taak in HubSpot). */
  opvolgDatum: string;
};

const LEGE_VELDEN: Veldkoppeling = { startDatum: "", opvolgDatum: "" };

// Bewust GEEN bedragen uit HubSpot. Dat was het eerste ontwerp, en het is er op
// 19-08-2026 weer uit gehaald omdat Maarten ze zelf in het dashboard zet: de
// SEO-fee, de advertentiefee, de kosten per maand en een eenmalig bedrag voor
// een website. HubSpot levert wie er hot is, de contactgegevens en de twee
// datums; het geld staat op de plek waar de prognose ermee rekent. Eén baas per
// veld, en de baas van het geld is hier.

// De tabellen worden één keer gebouwd per database, niet bij elke koude server
// opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(), hoog dan
// het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "hubspot-leads-b70e17cf";

function ensureTable(): Promise<void> {
  return eenmalig("hubspot-leads", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS hubspot_lead (
      client_slug     TEXT PRIMARY KEY,
      deal_id         TEXT NOT NULL,
      deal_naam       TEXT NOT NULL DEFAULT '',
      pijplijn        TEXT NOT NULL DEFAULT '',
      pijplijn_naam   TEXT NOT NULL DEFAULT '',
      fase            TEXT NOT NULL DEFAULT '',
      fase_naam       TEXT NOT NULL DEFAULT '',
      bedrag          NUMERIC,
      kans            INTEGER,
      sluit_datum     DATE,
      gesloten        BOOLEAN NOT NULL DEFAULT false,
      gewonnen        BOOLEAN NOT NULL DEFAULT false,
      opvolg_datum    DATE,
      opvolg_titel    TEXT NOT NULL DEFAULT '',
      laatste_contact DATE,
      contact_naam    TEXT NOT NULL DEFAULT '',
      contact_mail    TEXT NOT NULL DEFAULT '',
      bedrijf_naam    TEXT NOT NULL DEFAULT '',
      bedrijf_domein  TEXT NOT NULL DEFAULT '',
      eigenaar        TEXT NOT NULL DEFAULT '',
      hubspot_url     TEXT NOT NULL DEFAULT '',
      melding_op      DATE,
      bijgewerkt_op   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_hubspot_lead_deal ON hubspot_lead (deal_id)`;
  // Waar deze lead vandaan komt: "contact" (de gewone weg bij Pingwin) of "deal".
  await sql`ALTER TABLE hubspot_lead ADD COLUMN IF NOT EXISTS soort TEXT NOT NULL DEFAULT 'deal'`;
}

// ── De stand van één lead, voor op het scherm ───────────────

export type HubspotLead = {
  slug: string;
  /** "contact" of "deal": waar deze lead in HubSpot vandaan komt. */
  soort: string;
  dealId: string;
  dealNaam: string;
  pijplijnNaam: string;
  faseNaam: string;
  bedrag: number | null;
  kans: number | null;
  sluitDatum: string | null;
  gesloten: boolean;
  gewonnen: boolean;
  opvolgDatum: string | null;
  opvolgTitel: string;
  laatsteContact: string | null;
  contactNaam: string;
  contactMail: string;
  bedrijfNaam: string;
  eigenaar: string;
  hubspotUrl: string;
  bijgewerktOp: string;
};

type LeadRow = {
  client_slug: string; deal_id: string; deal_naam: string; pijplijn_naam: string; fase_naam: string;
  bedrag: string | number | null; kans: number | null; sluit_datum: string | null;
  gesloten: boolean; gewonnen: boolean; opvolg_datum: string | null; opvolg_titel: string;
  laatste_contact: string | null; contact_naam: string; contact_mail: string;
  bedrijf_naam: string; eigenaar: string; hubspot_url: string; bijgewerkt_op: string;
  soort: string;
};

const alsDag = (v: string | null): string | null => (v ? new Date(v).toISOString().slice(0, 10) : null);

function toLead(r: LeadRow): HubspotLead {
  return {
    slug: r.client_slug,
    soort: r.soort || "deal",
    dealId: r.deal_id,
    dealNaam: r.deal_naam,
    pijplijnNaam: r.pijplijn_naam,
    faseNaam: r.fase_naam,
    bedrag: r.bedrag === null ? null : Number(r.bedrag),
    kans: r.kans === null ? null : Number(r.kans),
    sluitDatum: alsDag(r.sluit_datum),
    gesloten: !!r.gesloten,
    gewonnen: !!r.gewonnen,
    opvolgDatum: alsDag(r.opvolg_datum),
    opvolgTitel: r.opvolg_titel || "",
    laatsteContact: alsDag(r.laatste_contact),
    contactNaam: r.contact_naam || "",
    contactMail: r.contact_mail || "",
    bedrijfNaam: r.bedrijf_naam || "",
    eigenaar: r.eigenaar || "",
    hubspotUrl: r.hubspot_url || "",
    bijgewerktOp: new Date(r.bijgewerkt_op).toISOString(),
  };
}

export async function getHubspotLead(slug: string): Promise<HubspotLead | null> {
  await ensureTable();
  const { rows } = await sql<LeadRow>`
    SELECT client_slug, deal_id, deal_naam, pijplijn_naam, fase_naam, bedrag, kans, sluit_datum,
           gesloten, gewonnen, opvolg_datum, opvolg_titel, laatste_contact, contact_naam, contact_mail,
           bedrijf_naam, eigenaar, hubspot_url, bijgewerkt_op, soort
    FROM hubspot_lead WHERE client_slug = ${slug} LIMIT 1`;
  return rows[0] ? toLead(rows[0]) : null;
}

/** Alle gekoppelde leads, voor de kolommen in de klantenlijst. */
export async function listHubspotLeads(): Promise<HubspotLead[]> {
  await ensureTable();
  const { rows } = await sql<LeadRow>`
    SELECT client_slug, deal_id, deal_naam, pijplijn_naam, fase_naam, bedrag, kans, sluit_datum,
           gesloten, gewonnen, opvolg_datum, opvolg_titel, laatste_contact, contact_naam, contact_mail,
           bedrijf_naam, eigenaar, hubspot_url, bijgewerkt_op, soort
    FROM hubspot_lead ORDER BY opvolg_datum NULLS LAST`;
  return rows.map(toLead);
}

export async function ontkoppelLead(slug: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM hubspot_lead WHERE client_slug = ${slug}`;
}

// ── Instellingen ────────────────────────────────────────────

export type HubspotInstelling = {
  /**
   * Waar de leads vandaan komen. "contacten" is de standaard: niet elk bureau
   * werkt met deals, en bij Pingwin staan de leads als contact met een
   * leadstatus. "deals" is er voor wie de pijplijn wél gebruikt.
   */
  bron: "contacten" | "deals";
  /** Bij contacten: welk veld en welke waarde een lead maken (bijvoorbeeld leadstatus = hot). */
  filterVeld: string;
  filterWaarde: string;
  /** Alleen contacten van deze HubSpot-eigenaar. Leeg = van iedereen. */
  eigenaar: string;
  /** Welke velden welke betekenis hebben. */
  velden: Veldkoppeling;
  /** De kans die een verse lead uit HubSpot krijgt, tot Maarten hem bijstelt. */
  kans: number;
  /** Welke pijplijnen als lead tellen. Leeg = alle. */
  pijplijnen: string[];
  /** Mag het dashboard een notitie terugschrijven naar HubSpot? Standaard uit. */
  notitiesTerug: boolean;
  /** Mag een onbekende deal vanzelf een nieuwe lead worden? Standaard aan. */
  autoLeads: boolean;
  laatsteRonde: string | null;
};

export async function getHubspotInstelling(): Promise<HubspotInstelling> {
  const [p, n, a, r, bron, fv, fw, velden, kans, eigenaar] = await Promise.all([
    getSetting(SETTING_PIJPLIJNEN),
    getSetting(SETTING_NOTITIES_TERUG),
    getSetting(SETTING_AUTO_LEADS),
    getSetting(SETTING_LAATSTE_RONDE),
    getSetting(SETTING_BRON),
    getSetting(SETTING_FILTER_VELD),
    getSetting(SETTING_FILTER_WAARDE),
    getSetting(SETTING_VELDEN),
    getSetting(SETTING_KANS),
    getSetting(SETTING_EIGENAAR),
  ]);
  let gekoppeld = LEGE_VELDEN;
  try { gekoppeld = { ...LEGE_VELDEN, ...(velden ? JSON.parse(velden) : {}) }; } catch { /* stukke instelling telt als leeg */ }
  const k = Number(kans);
  return {
    bron: bron === "deals" ? "deals" : "contacten",
    filterVeld: fv || "",
    filterWaarde: fw || "",
    eigenaar: eigenaar || "",
    velden: gekoppeld,
    kans: Number.isFinite(k) && k >= 0 && k <= 100 ? Math.round(k) : 50,
    pijplijnen: String(p || "").split(",").map((x) => x.trim()).filter(Boolean),
    notitiesTerug: n === "aan",
    autoLeads: a !== "uit",
    laatsteRonde: r || null,
  };
}

export async function saveHubspotInstelling(p: Partial<HubspotInstelling>): Promise<void> {
  const taken: Promise<void>[] = [];
  if (p.bron !== undefined) taken.push(setSetting(SETTING_BRON, p.bron === "deals" ? "deals" : "contacten"));
  if (p.filterVeld !== undefined) taken.push(setSetting(SETTING_FILTER_VELD, p.filterVeld));
  if (p.filterWaarde !== undefined) taken.push(setSetting(SETTING_FILTER_WAARDE, p.filterWaarde));
  if (p.eigenaar !== undefined) taken.push(setSetting(SETTING_EIGENAAR, p.eigenaar));
  if (p.velden !== undefined) taken.push(setSetting(SETTING_VELDEN, JSON.stringify({ ...LEGE_VELDEN, ...p.velden })));
  if (p.kans !== undefined) taken.push(setSetting(SETTING_KANS, String(Math.min(100, Math.max(0, Math.round(p.kans))))));
  if (p.pijplijnen !== undefined) taken.push(setSetting(SETTING_PIJPLIJNEN, p.pijplijnen.join(",")));
  if (p.notitiesTerug !== undefined) taken.push(setSetting(SETTING_NOTITIES_TERUG, p.notitiesTerug ? "aan" : "uit"));
  if (p.autoLeads !== undefined) taken.push(setSetting(SETTING_AUTO_LEADS, p.autoLeads ? "aan" : "uit"));
  await Promise.all(taken);
}

/** De pijplijnen zoals ze in HubSpot staan, om ze te kunnen aanvinken. */
export async function hubspotPijplijnKeuze(): Promise<HsPijplijn[]> {
  return hsPijplijnen();
}

/** De contactvelden zoals ze in HubSpot staan, om ze te kunnen kiezen. */
export async function hubspotVeldKeuze(): Promise<HsVeld[]> {
  return hsVelden("contacts");
}

/** De eigenaren uit HubSpot, om te kunnen kiezen van wie de leads mogen komen. */
export async function hubspotEigenaarKeuze(): Promise<{ id: string; naam: string }[]> {
  const map = await hsEigenaren();
  return [...map.entries()].map(([id, naam]) => ({ id, naam })).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

// ── De ronde zelf ───────────────────────────────────────────

export type SyncUitkomst = {
  ok: boolean;
  melding: string;
  gelezen: number;
  nieuweLeads: number;
  bijgewerkt: number;
  dossierStukken: number;
};

/** Zoekt het bedrijf in het dashboard dat bij deze deal hoort. */
function vindKlant(
  klanten: ClientConfig[],
  gekoppeld: Map<string, string>,
  deal: HsDeal,
  bedrijfNaam: string,
  bedrijfDomein: string,
): ClientConfig | null {
  const bestaandeSlug = gekoppeld.get(deal.id);
  if (bestaandeSlug) {
    const c = klanten.find((k) => k.slug === bestaandeSlug);
    if (c) return c;
  }
  const domein = normalizeDomain(bedrijfDomein || "");
  if (domein) {
    const opDomein = klanten.find((k) => (k.domain || "").toLowerCase() === domein.toLowerCase());
    if (opDomein) return opDomein;
  }
  const naamSlug = slugify(bedrijfNaam || deal.naam);
  if (naamSlug) {
    const opNaam = klanten.find((k) => k.slug === naamSlug || k.name.trim().toLowerCase() === (bedrijfNaam || "").trim().toLowerCase());
    if (opNaam) return opNaam;
  }
  return null;
}

/** De maand waarin een lead naar verwachting gaat lopen (JJJJ-MM). */
function startMaandUit(sluitDatum: string | null): string | null {
  if (!sluitDatum) return null;
  const d = new Date(sluitDatum);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Haalt de deals op en zet ze neer als lead. `volledig` negeert de vorige ronde
 * en leest alles opnieuw; dat is de knop op het beheerscherm, niet het rondje
 * van elk kwartier.
 */
const LEEG: SyncUitkomst = { ok: false, melding: "", gelezen: 0, nieuweLeads: 0, bijgewerkt: 0, dossierStukken: 0 };

/**
 * Eén ronde langs HubSpot.
 *
 * Welke kant hij op kijkt hangt af van hoe je werkt. Bij Pingwin staan de leads
 * als CONTACT met een leadstatus ("hot"), niet als deal; daarom is dat de
 * standaard. Wie de dealpijplijn wél gebruikt, zet de bron op deals.
 */
export async function syncHubspot(opties: { volledig?: boolean } = {}): Promise<SyncUitkomst> {
  if (!hubspotConfigured()) {
    return { ...LEEG, melding: "HubSpot is nog niet gekoppeld: zet HUBSPOT_TOKEN in Vercel." };
  }
  await ensureTable();
  const instelling = await getHubspotInstelling();
  const sinds = opties.volledig || !instelling.laatsteRonde
    ? null
    // Vijf minuten marge, want de klok van HubSpot en die van ons lopen nooit
    // exact gelijk en een gemiste wijziging komt anders nooit meer binnen.
    : new Date(new Date(instelling.laatsteRonde).getTime() - 5 * 60 * 1000);

  // ── Deals leveren geen leads meer (20-08-2026) ──
  // De ronde stond op deals en er was geen pijplijn gekozen, dus élke deal in het
  // account werd een lead: 127 stuks in de klantenlijst, tot tien jaar oude
  // klusjes aan toe. Bij Pingwin is een lead een contact met een leadstatus, niet
  // een deal; Maarten: "HubSpot moet helemaal geen deals aanleveren, alleen
  // contacten die op leadstatus hot staan."
  //
  // Daarom levert alleen de contacten-weg nog leads op. De deal-weg blijft in de
  // code staan (een ander bureau kan er wél mee werken en het dashboard wordt een
  // product), maar hij moet dan bewust aangezet worden mét gekozen pijplijnen. De
  // combinatie "deals, alles" bestaat niet meer: dat is precies wat er misging.
  const dealsMag = instelling.bron === "deals" && instelling.pijplijnen.length > 0;
  if (instelling.bron === "deals" && !dealsMag) {
    return { ...LEEG, ok: true, melding: "De ronde staat op deals zonder gekozen pijplijn, en dan zou élke deal in je account een lead worden. Er is niets opgehaald. Zet op Beheer de bron op contacten (leadstatus), of kies eerst de pijplijnen die als lead tellen." };
  }
  const uitkomst = dealsMag
    ? await syncDeals(instelling, sinds)
    : await syncContacten(instelling, sinds);
  if (uitkomst.ok) await setSetting(SETTING_LAATSTE_RONDE, new Date().toISOString());
  return uitkomst;
}

/**
 * De leads uit je contacten: iedereen met de leadstatus die jij hebt aangewezen.
 *
 * Wat er meekomt: wie het is, het bedrijf, mailadres en telefoon, de website, en
 * wanneer je ze weer moet spreken. De bedragen en de datum waarop ze naar
 * verwachting starten komen NIET uit HubSpot; die zet Maarten in het dashboard,
 * want daar rekent de prognose ermee en daar staan ze maar op één plek.
 */
async function syncContacten(instelling: HubspotInstelling, sinds: Date | null): Promise<SyncUitkomst> {
  if (!instelling.filterVeld || !instelling.filterWaarde) {
    return { ...LEEG, ok: true, melding: "Nog niet ingesteld welke contacten een lead zijn. Kies op Beheer het veld en de waarde (bijvoorbeeld leadstatus is hot)." };
  }

  let contacten;
  let eigenaren: Map<string, string>;
  try {
    [contacten, eigenaren] = await Promise.all([
      hsContacten(sinds, { veld: instelling.filterVeld, waarde: instelling.filterWaarde, eigenaar: instelling.eigenaar },
        [instelling.velden.opvolgDatum].filter(Boolean)),
      hsEigenaren().catch(() => new Map<string, string>()),
    ]);
  } catch (e) {
    return { ...LEEG, melding: (e as Error).message };
  }

  const { rows: gekoppeldeRijen } = await sql<{ client_slug: string; deal_id: string }>`
    SELECT client_slug, deal_id FROM hubspot_lead`;
  const gekoppeld = new Map(gekoppeldeRijen.map((r) => [r.deal_id, r.client_slug]));
  let klanten = await listClients();

  const vandaag = new Date().toISOString().slice(0, 10);
  let nieuweLeads = 0;
  let bijgewerkt = 0;
  let dossierStukken = 0;

  for (const c of contacten) {
    try {
      // Het bedrijf is wat we in het dashboard neerzetten. Drie bronnen, in
      // volgorde: het veld op het contact, het bedrijf dat eraan gekoppeld is, en
      // anders de naam van de persoon. In HubSpot staat "Company Name" vaak op
      // "Onbekend" terwijl er rechts wél een bedrijf aan hangt; dan hoort dat
      // bedrijf in het dashboard te staan, niet "Onbekend".
      let bedrijfNaam = (c.bedrijf || "").trim();
      let domein = normalizeDomain(c.domein || "") || "";
      if (!bedrijfNaam || bedrijfNaam.toLowerCase() === "onbekend" || !domein) {
        const bedrijf = await hsBedrijfVanDeal(c.id, "contacts").catch(() => null);
        if (bedrijf) {
          if (!bedrijfNaam || bedrijfNaam.toLowerCase() === "onbekend") bedrijfNaam = bedrijf.naam || bedrijfNaam;
          if (!domein) domein = normalizeDomain(bedrijf.domein || "") || "";
        }
      }
      if (!bedrijfNaam) bedrijfNaam = c.naam || "Naamloze lead";
      if (!domein) domein = domeinUitMail(c.mail);

      let klant = vindKlantVoorContact(klanten, gekoppeld, c.id, bedrijfNaam, domein);
      if (!klant) {
        if (!instelling.autoLeads) continue;
        klant = await createLead({ name: bedrijfNaam, domain: domein, email: c.mail });
        klanten = [...klanten, klant];
        nieuweLeads++;
      } else {
        bijgewerkt++;
      }

      // De opvolgdatum: het veld dat Maarten heeft aangewezen, anders wat HubSpot
      // zelf als volgende activiteit noteert, anders de eerstvolgende openstaande
      // taak. Drie bronnen, in die volgorde, en nooit een gok.
      const uitVeld = instelling.velden.opvolgDatum ? veldAlsDatum(c.extra[instelling.velden.opvolgDatum]) : null;
      let opvolgDatum = uitVeld || c.volgendeActie || null;
      let opvolgTitel = uitVeld ? "Uit je opvolgveld in HubSpot" : c.volgendeActie ? "Volgende activiteit in HubSpot" : "";
      if (!opvolgDatum) {
        const taken = await hsTakenVanDeal(c.id, "contacts").catch(() => []);
        const open = taken.filter((t) => !t.afgerond && t.datum).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
        if (open[0]) { opvolgDatum = open[0].datum; opvolgTitel = open[0].titel; }
      }

      const url = await hsContactLink(c.id);
      const eigenaar = c.eigenaarId ? eigenaren.get(c.eigenaarId) || "" : "";

      await sql`DELETE FROM hubspot_lead WHERE deal_id = ${c.id} AND client_slug <> ${klant.slug}`;
      await sql`
        INSERT INTO hubspot_lead (
          client_slug, deal_id, deal_naam, fase_naam, opvolg_datum, opvolg_titel,
          laatste_contact, contact_naam, contact_mail, bedrijf_naam, bedrijf_domein,
          eigenaar, hubspot_url, soort, bijgewerkt_op)
        VALUES (
          ${klant.slug}, ${c.id}, ${c.naam || bedrijfNaam}, ${c.status}, ${opvolgDatum}, ${opvolgTitel},
          ${c.laatsteContact}, ${c.naam}, ${c.mail}, ${bedrijfNaam}, ${domein || ""},
          ${eigenaar}, ${url}, 'contact', now())
        ON CONFLICT (client_slug) DO UPDATE SET
          deal_id = EXCLUDED.deal_id, deal_naam = EXCLUDED.deal_naam, fase_naam = EXCLUDED.fase_naam,
          opvolg_datum = EXCLUDED.opvolg_datum, opvolg_titel = EXCLUDED.opvolg_titel,
          laatste_contact = EXCLUDED.laatste_contact, contact_naam = EXCLUDED.contact_naam,
          contact_mail = EXCLUDED.contact_mail, bedrijf_naam = EXCLUDED.bedrijf_naam,
          bedrijf_domein = EXCLUDED.bedrijf_domein, eigenaar = EXCLUDED.eigenaar,
          hubspot_url = EXCLUDED.hubspot_url, soort = 'contact', bijgewerkt_op = now()`;
      gekoppeld.set(c.id, klant.slug);

      // Alleen de kans wordt alvast gezet, zodat een verse lead niet op 100%
      // staat. Het bedrag en de startmaand zet Maarten zelf; die raakt deze
      // ronde nooit aan.
      await saveRegelUitBron(klant.slug, { kans: instelling.kans }).catch(() => {});

      dossierStukken += await gesprekkenNaarDossier(klant.slug, c.id, "contacts");

      if (opvolgDatum && opvolgDatum <= vandaag && klant.fase === "lead") {
        const { rows: gemeld } = await sql<{ melding_op: string | null }>`
          SELECT melding_op FROM hubspot_lead WHERE client_slug = ${klant.slug} LIMIT 1`;
        if (alsDag(gemeld[0]?.melding_op ?? null) !== opvolgDatum) {
          await meldingToevoegen({
            soort: "lead-opvolg",
            titel: `Opvolgen: ${klant.name}`,
            regel: opvolgTitel ? `${opvolgTitel} (stond gepland op ${opvolgDatum})` : `Stond gepland op ${opvolgDatum}`,
            link: `/admin/client/${klant.slug}?tab=lead`,
            wie: "HubSpot",
            bron: "hubspot",
            bronId: `${klant.slug}:${opvolgDatum}`,
          });
          await sql`UPDATE hubspot_lead SET melding_op = ${opvolgDatum} WHERE client_slug = ${klant.slug}`;
        }
      }
    } catch {
      // Eén contact dat stukloopt mag de ronde niet tegenhouden.
    }
  }

  return {
    ok: true,
    melding: contacten.length === 0 ? "Niets veranderd in HubSpot sinds de vorige ronde." : "Klaar.",
    gelezen: contacten.length,
    nieuweLeads,
    bijgewerkt,
    dossierStukken,
  };
}

/** Het domein uit een mailadres, als het bedrijf zelf geen website heeft staan. */
function domeinUitMail(mail: string): string {
  const deel = String(mail || "").split("@")[1] || "";
  const vrij = /^(gmail|hotmail|outlook|live|icloud|yahoo|ziggo|kpnmail|telfort|planet|home)\./i.test(deel);
  return vrij ? "" : (normalizeDomain(deel) || "");
}

/** Zoekt het bedrijf in het dashboard dat bij dit contact hoort. */
function vindKlantVoorContact(
  klanten: ClientConfig[],
  gekoppeld: Map<string, string>,
  contactId: string,
  bedrijfNaam: string,
  domein: string,
): ClientConfig | null {
  const bestaande = gekoppeld.get(contactId);
  if (bestaande) {
    const c = klanten.find((k) => k.slug === bestaande);
    if (c) return c;
  }
  if (domein) {
    const opDomein = klanten.find((k) => (k.domain || "").toLowerCase() === domein.toLowerCase());
    if (opDomein) return opDomein;
  }
  const naamSlug = slugify(bedrijfNaam);
  if (naamSlug) {
    const opNaam = klanten.find((k) => k.slug === naamSlug || k.name.trim().toLowerCase() === bedrijfNaam.trim().toLowerCase());
    if (opNaam) return opNaam;
  }
  return null;
}

async function syncDeals(instelling: HubspotInstelling, sinds: Date | null): Promise<SyncUitkomst> {
  const leeg = LEEG;
  // Zonder gekozen pijplijn zou élke deal in het account een lead worden. Dat is
  // op 19-08-2026 één keer echt gebeurd (127 oude klusjes in de klantenlijst),
  // dus dit is nu een rem en geen standaardwaarde.
  if (!instelling.pijplijnen.length) {
    return { ...leeg, ok: true, melding: "Nog niet ingesteld welke pijplijnen een lead zijn. Vink ze aan op Beheer; zolang er geen keuze staat wordt er niets opgehaald." };
  }
  let deals: HsDeal[];
  let pijplijnen: HsPijplijn[];
  let eigenaren: Map<string, string>;
  try {
    [deals, pijplijnen, eigenaren] = await Promise.all([
      hsDeals(sinds, instelling.pijplijnen),
      hsPijplijnen(),
      hsEigenaren().catch(() => new Map<string, string>()),
    ]);
  } catch (e) {
    return { ...leeg, melding: (e as Error).message };
  }

  const faseNamen = new Map<string, { naam: string; kans: number | null; gesloten: boolean; gewonnen: boolean; pijplijn: string }>();
  const pijplijnNamen = new Map<string, string>();
  for (const p of pijplijnen) {
    pijplijnNamen.set(p.id, p.naam);
    for (const f of p.fases) faseNamen.set(f.id, { naam: f.naam, kans: f.kans, gesloten: f.gesloten, gewonnen: f.gewonnen, pijplijn: p.id });
  }

  const { rows: gekoppeldeRijen } = await sql<{ client_slug: string; deal_id: string }>`
    SELECT client_slug, deal_id FROM hubspot_lead`;
  const gekoppeld = new Map(gekoppeldeRijen.map((r) => [r.deal_id, r.client_slug]));
  let klanten = await listClients();

  const vandaag = new Date().toISOString().slice(0, 10);
  let nieuweLeads = 0;
  let bijgewerkt = 0;
  let dossierStukken = 0;

  for (const deal of deals) {
    try {
      const bedrijf = await hsBedrijfVanDeal(deal.id).catch(() => null);
      const contacten = await hsContactenVanDeal(deal.id).catch(() => []);
      const bedrijfNaam = (bedrijf?.naam || "").trim() || deal.naam;
      const bedrijfDomein = normalizeDomain(bedrijf?.domein || "") || "";

      let klant = vindKlant(klanten, gekoppeld, deal, bedrijfNaam, bedrijfDomein);
      if (!klant) {
        if (!instelling.autoLeads) continue;
        klant = await createLead({
          name: bedrijfNaam,
          domain: bedrijfDomein,
          email: contacten[0]?.mail || "",
        });
        klanten = [...klanten, klant];
        nieuweLeads++;
      } else {
        bijgewerkt++;
      }

      const fase = faseNamen.get(deal.fase);
      const kans = deal.kans ?? fase?.kans ?? null;

      // Het eerstvolgende contactmoment: de eerstvolgende openstaande taak in
      // HubSpot, en anders wat HubSpot zelf als volgende activiteit noteert.
      const taken = await hsTakenVanDeal(deal.id).catch(() => []);
      const open = taken
        .filter((t) => !t.afgerond && t.datum)
        .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
      const opvolgDatum = open[0]?.datum || deal.volgendeActie || null;
      const opvolgTitel = open[0]?.titel || (deal.volgendeActie ? "Volgende activiteit in HubSpot" : "");

      const url = await hsDealLink(deal.id);
      const eigenaar = deal.eigenaarId ? eigenaren.get(deal.eigenaarId) || "" : "";

      // Hing deze deal eerder aan een ander bedrijf in het dashboard (naam
      // veranderd, verkeerd gekoppeld), dan is de nieuwste koppeling de juiste.
      await sql`DELETE FROM hubspot_lead WHERE deal_id = ${deal.id} AND client_slug <> ${klant.slug}`;

      await sql`
        INSERT INTO hubspot_lead (
          client_slug, deal_id, deal_naam, pijplijn, pijplijn_naam, fase, fase_naam,
          bedrag, kans, sluit_datum, gesloten, gewonnen, opvolg_datum, opvolg_titel,
          laatste_contact, contact_naam, contact_mail, bedrijf_naam, bedrijf_domein,
          eigenaar, hubspot_url, bijgewerkt_op)
        VALUES (
          ${klant.slug}, ${deal.id}, ${deal.naam}, ${deal.pijplijn}, ${pijplijnNamen.get(deal.pijplijn) || ""},
          ${deal.fase}, ${fase?.naam || ""}, ${deal.bedrag}, ${kans}, ${deal.sluitDatum},
          ${!!fase?.gesloten}, ${!!fase?.gewonnen}, ${opvolgDatum}, ${opvolgTitel},
          ${deal.laatsteContact}, ${contacten[0]?.naam || ""}, ${contacten[0]?.mail || ""},
          ${bedrijfNaam}, ${bedrijfDomein}, ${eigenaar}, ${url}, now())
        ON CONFLICT (client_slug) DO UPDATE SET
          deal_id = EXCLUDED.deal_id, deal_naam = EXCLUDED.deal_naam,
          pijplijn = EXCLUDED.pijplijn, pijplijn_naam = EXCLUDED.pijplijn_naam,
          fase = EXCLUDED.fase, fase_naam = EXCLUDED.fase_naam, bedrag = EXCLUDED.bedrag,
          kans = EXCLUDED.kans, sluit_datum = EXCLUDED.sluit_datum,
          gesloten = EXCLUDED.gesloten, gewonnen = EXCLUDED.gewonnen,
          opvolg_datum = EXCLUDED.opvolg_datum, opvolg_titel = EXCLUDED.opvolg_titel,
          laatste_contact = EXCLUDED.laatste_contact, contact_naam = EXCLUDED.contact_naam,
          contact_mail = EXCLUDED.contact_mail, bedrijf_naam = EXCLUDED.bedrijf_naam,
          bedrijf_domein = EXCLUDED.bedrijf_domein, eigenaar = EXCLUDED.eigenaar,
          hubspot_url = EXCLUDED.hubspot_url, bijgewerkt_op = now()`;
      gekoppeld.set(deal.id, klant.slug);

      // De prognose: kans en startmaand komen uit HubSpot, maar alleen zolang
      // Maarten er zelf niet aan gezeten heeft.
      await saveRegelUitBron(klant.slug, { kans, startMaand: startMaandUit(deal.sluitDatum) }).catch(() => {});

      // Een verloren deal zet de lead op "niet doorgegaan"; een klant blijft
      // altijd klant, want die beslissing hoort bij Maarten.
      if (fase?.gesloten && !fase.gewonnen && klant.fase === "lead") {
        await setClientFase(klant.slug, "verloren").catch(() => {});
      }

      dossierStukken += await gesprekkenNaarDossier(klant.slug, deal.id);

      // Eén melding per contactmoment, op de dag zelf of als hij verstreken is.
      if (opvolgDatum && opvolgDatum <= vandaag && klant.fase === "lead") {
        const { rows: gemeld } = await sql<{ melding_op: string | null }>`
          SELECT melding_op FROM hubspot_lead WHERE client_slug = ${klant.slug} LIMIT 1`;
        if (alsDag(gemeld[0]?.melding_op ?? null) !== opvolgDatum) {
          await meldingToevoegen({
            soort: "lead-opvolg",
            titel: `Opvolgen: ${klant.name}`,
            regel: opvolgTitel ? `${opvolgTitel} (stond gepland op ${opvolgDatum})` : `Stond gepland op ${opvolgDatum}`,
            link: `/admin/client/${klant.slug}?tab=lead`,
            wie: "HubSpot",
            bron: "hubspot",
            bronId: `${klant.slug}:${opvolgDatum}`,
          });
          await sql`UPDATE hubspot_lead SET melding_op = ${opvolgDatum} WHERE client_slug = ${klant.slug}`;
        }
      }
    } catch {
      // Eén deal die stukloopt mag de hele ronde niet tegenhouden; de volgende
      // ronde pakt hem gewoon opnieuw op.
    }
  }

  return {
    ok: true,
    melding: deals.length === 0 ? "Niets veranderd in HubSpot sinds de vorige ronde." : "Klaar.",
    gelezen: deals.length,
    nieuweLeads,
    bijgewerkt,
    dossierStukken,
  };
}

/**
 * Notities, telefoongesprekken en afspraakverslagen uit HubSpot in het dossier
 * van de lead. Dat is de plek waar de leadchat uit leest, dus vanaf nu weet die
 * chat wat er in HubSpot besproken is.
 *
 * Dedupe op de herkomst (`hubspot:notes:123`): het dossier is bewust
 * append-only, dus hetzelfde stuk mag er nooit twee keer in komen.
 */
async function gesprekkenNaarDossier(slug: string, id: string, van = "deals"): Promise<number> {
  const gesprekken = await hsGesprekkenVanDeal(id, van).catch(() => []);
  if (!gesprekken.length) return 0;

  const { rows } = await sql<{ bron: string }>`
    SELECT bron FROM lead_dossier WHERE client_slug = ${slug} AND bron LIKE 'hubspot:%'`;
  const gezien = new Set(rows.map((r) => r.bron));

  let toegevoegd = 0;
  for (const g of gesprekken) {
    const bron = `hubspot:${g.id}`;
    if (gezien.has(bron)) continue;
    const tekst = g.tekst.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!tekst) continue;
    const label = g.soort === "notitie" ? "Notitie" : g.soort === "gesprek" ? "Telefoongesprek" : "Afspraak";
    await addDossierItem(slug, {
      inhoud: tekst,
      titel: `${label} uit HubSpot${g.datum ? ` (${g.datum})` : ""}: ${g.titel}`.slice(0, 190),
      // Geen AI-samenvatting laten maken: dit is al de aantekening zelf, en een
      // ronde van elk kwartier mag geen verbruik opstoken.
      samenvatting: tekst.slice(0, 300),
      soort: "notitie",
      bron,
    }).catch(() => null);
    toegevoegd++;
  }
  return toegevoegd;
}

// ═══════════════════════════════════════════════════════════
// OPRUIMEN: WAT DE RONDE TEVEEL HEEFT AANGEMAAKT
// ═══════════════════════════════════════════════════════════
// Op 19-08-2026 stond de koppeling nog op deals en was er geen pijplijn gekozen.
// Gevolg: élke deal in het HubSpot-account werd een lead, ook tien jaar oude
// klusjes ("AdWords Diabetes Centrale"). Er stonden er twintig als lead en
// honderdzeventig als "niet doorgegaan" (want die deals waren in HubSpot verloren
// afgesloten), samen bijna tweehonderd rijen die er niet horen. Twee dingen zijn daarna veranderd: zonder gekozen pijplijn (of
// zonder gekozen leadstatus) komt er niets meer binnen, en hieronder staat de
// knop die de rommel in één keer opruimt.
//
// De regel voor wat weg mag is streng, want weggooien is onomkeerbaar. Vijf
// voorwaarden tegelijk: het is een lead of een afgesloten deal, hij is door de
// DEAL-ronde aangemaakt (soort "deal"; wat uit je contacten komt blijft altijd
// staan), er hangt geen inlog aan, er staat geen bedrag bij, en niemand heeft er
// iets mee gedaan (geen dossier, geen document, geen gesprek). Alles wat daar
// niet aan voldoet blijft staan.
// ═══════════════════════════════════════════════════════════

export type OnterechteLead = { slug: string; naam: string; dealNaam: string };

export async function lijstOnterechteLeads(): Promise<OnterechteLead[]> {
  await ensureTable();
  const instelling = await getHubspotInstelling();
  // Bewust in losse stappen en niet als één grote query met JOIN's: die tabellen
  // worden pas aangemaakt zodra iemand ze voor het eerst gebruikt, en een query
  // over een tabel die nog niet bestaat mislukt in zijn geheel. Dan zou deze
  // lijst leeg lijken terwijl er honderd leads staan, en dat is precies wat er
  // op 19-08-2026 gebeurde: de opruimknop verscheen niet.
  const { rows } = await sql<{ slug: string; naam: string; deal_naam: string }>`
    SELECT c.slug, c.name AS naam, h.deal_naam
    FROM clients c
    JOIN hubspot_lead h ON h.client_slug = c.slug
    WHERE c.fase IN ('lead', 'verloren')
      AND COALESCE(c.maandbudget, 0) = 0
      AND c.login_id IS NULL
      -- Uit de dealronde (die had hier nooit mogen staan), of uit een
      -- contactronde met een andere status dan wat er nu is ingesteld. Een lead
      -- die wél aan je huidige filter voldoet blijft altijd staan.
      AND (h.soort = 'deal' OR h.fase_naam IS DISTINCT FROM ${instelling.filterWaarde})
    ORDER BY c.name`;
  if (!rows.length) return [];

  const bezet = new Set<string>();
  const vul = async (query: Promise<{ rows: { client_slug: string }[] }>) => {
    try { for (const r of (await query).rows) bezet.add(r.client_slug); } catch { /* tabel bestaat nog niet */ }
  };
  // Alleen wat een MENS heeft toegevoegd telt. De ronde zette bij elk van die
  // oude deals ook de HubSpot-notities in het dossier, en met "heeft een dossier,
  // dus blijf eraf" bleef daardoor bijna de hele rommel staan. Wat de koppeling
  // zelf heeft aangemaakt (bron begint met "hubspot:") beschermt niets.
  await vul(sql<{ client_slug: string }>`
    SELECT DISTINCT client_slug FROM lead_dossier
    WHERE bron IS NULL OR bron NOT LIKE 'hubspot:%'`);
  await vul(sql<{ client_slug: string }>`SELECT DISTINCT client_slug FROM lead_docs`);
  await vul(sql<{ client_slug: string }>`SELECT DISTINCT client_slug FROM client_chat`);

  return rows
    .filter((r) => !bezet.has(r.slug))
    .map((r) => ({ slug: r.slug, naam: r.naam, dealNaam: r.deal_naam || "" }));
}

export async function verwijderOnterechteLeads(): Promise<{ verwijderd: number; namen: string[] }> {
  const lijst = await lijstOnterechteLeads();
  for (const l of lijst) {
    await sql`DELETE FROM hubspot_lead WHERE client_slug = ${l.slug}`;
    await sql`DELETE FROM prognose_regel WHERE client_slug = ${l.slug}`;
    await deleteClient(l.slug).catch(() => false);
  }
  return { verwijderd: lijst.length, namen: lijst.map((l) => l.naam) };
}

/** Koppelt een bestaande lead met de hand aan een deal, en haalt hem meteen op. */
export async function koppelDeal(slug: string, dealId: string): Promise<SyncUitkomst> {
  await ensureTable();
  const schoon = String(dealId || "").trim();
  if (!schoon) throw new Error("Geen deal-nummer opgegeven.");
  await sql`DELETE FROM hubspot_lead WHERE deal_id = ${schoon} AND client_slug <> ${slug}`;
  await sql`
    INSERT INTO hubspot_lead (client_slug, deal_id) VALUES (${slug}, ${schoon})
    ON CONFLICT (client_slug) DO UPDATE SET deal_id = ${schoon}, bijgewerkt_op = now()`;
  return syncHubspot({ volledig: true });
}

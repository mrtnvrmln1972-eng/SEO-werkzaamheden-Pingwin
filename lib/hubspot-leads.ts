import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getSetting, setSetting } from "./settings";
import { listClients, createLead, setClientFase, normalizeDomain, slugify, type ClientConfig } from "./clients";
import { addDossierItem } from "./lead-dossier";
import { meldingToevoegen } from "./meldingen";
import { saveRegelUitBron } from "./prognose";
import {
  hubspotConfigured, hsDeals, hsPijplijnen, hsBedrijfVanDeal, hsContactenVanDeal,
  hsGesprekkenVanDeal, hsTakenVanDeal, hsEigenaren, hsDealLink,
  type HsDeal, type HsPijplijn,
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

// De tabellen worden één keer gebouwd per database, niet bij elke koude server
// opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(), hoog dan
// het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "hubspot-leads-115f5280";

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
}

// ── De stand van één lead, voor op het scherm ───────────────

export type HubspotLead = {
  slug: string;
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
};

const alsDag = (v: string | null): string | null => (v ? new Date(v).toISOString().slice(0, 10) : null);

function toLead(r: LeadRow): HubspotLead {
  return {
    slug: r.client_slug,
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
           bedrijf_naam, eigenaar, hubspot_url, bijgewerkt_op
    FROM hubspot_lead WHERE client_slug = ${slug} LIMIT 1`;
  return rows[0] ? toLead(rows[0]) : null;
}

/** Alle gekoppelde leads, voor de kolommen in de klantenlijst. */
export async function listHubspotLeads(): Promise<HubspotLead[]> {
  await ensureTable();
  const { rows } = await sql<LeadRow>`
    SELECT client_slug, deal_id, deal_naam, pijplijn_naam, fase_naam, bedrag, kans, sluit_datum,
           gesloten, gewonnen, opvolg_datum, opvolg_titel, laatste_contact, contact_naam, contact_mail,
           bedrijf_naam, eigenaar, hubspot_url, bijgewerkt_op
    FROM hubspot_lead ORDER BY opvolg_datum NULLS LAST`;
  return rows.map(toLead);
}

export async function ontkoppelLead(slug: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM hubspot_lead WHERE client_slug = ${slug}`;
}

// ── Instellingen ────────────────────────────────────────────

export type HubspotInstelling = {
  /** Welke pijplijnen als lead tellen. Leeg = alle. */
  pijplijnen: string[];
  /** Mag het dashboard een notitie terugschrijven naar HubSpot? Standaard uit. */
  notitiesTerug: boolean;
  /** Mag een onbekende deal vanzelf een nieuwe lead worden? Standaard aan. */
  autoLeads: boolean;
  laatsteRonde: string | null;
};

export async function getHubspotInstelling(): Promise<HubspotInstelling> {
  const [p, n, a, r] = await Promise.all([
    getSetting(SETTING_PIJPLIJNEN),
    getSetting(SETTING_NOTITIES_TERUG),
    getSetting(SETTING_AUTO_LEADS),
    getSetting(SETTING_LAATSTE_RONDE),
  ]);
  return {
    pijplijnen: String(p || "").split(",").map((x) => x.trim()).filter(Boolean),
    notitiesTerug: n === "aan",
    autoLeads: a !== "uit",
    laatsteRonde: r || null,
  };
}

export async function saveHubspotInstelling(p: Partial<HubspotInstelling>): Promise<void> {
  const taken: Promise<void>[] = [];
  if (p.pijplijnen !== undefined) taken.push(setSetting(SETTING_PIJPLIJNEN, p.pijplijnen.join(",")));
  if (p.notitiesTerug !== undefined) taken.push(setSetting(SETTING_NOTITIES_TERUG, p.notitiesTerug ? "aan" : "uit"));
  if (p.autoLeads !== undefined) taken.push(setSetting(SETTING_AUTO_LEADS, p.autoLeads ? "aan" : "uit"));
  await Promise.all(taken);
}

/** De pijplijnen zoals ze in HubSpot staan, om ze te kunnen aanvinken. */
export async function hubspotPijplijnKeuze(): Promise<HsPijplijn[]> {
  return hsPijplijnen();
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
export async function syncHubspot(opties: { volledig?: boolean } = {}): Promise<SyncUitkomst> {
  const leeg: SyncUitkomst = { ok: false, melding: "", gelezen: 0, nieuweLeads: 0, bijgewerkt: 0, dossierStukken: 0 };
  if (!hubspotConfigured()) {
    return { ...leeg, melding: "HubSpot is nog niet gekoppeld: zet HUBSPOT_TOKEN in Vercel." };
  }
  await ensureTable();
  const instelling = await getHubspotInstelling();
  const sinds = opties.volledig || !instelling.laatsteRonde
    ? null
    // Vijf minuten marge, want de klok van HubSpot en die van ons lopen nooit
    // exact gelijk en een gemiste wijziging komt anders nooit meer binnen.
    : new Date(new Date(instelling.laatsteRonde).getTime() - 5 * 60 * 1000);

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

  await setSetting(SETTING_LAATSTE_RONDE, new Date().toISOString());
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
async function gesprekkenNaarDossier(slug: string, dealId: string): Promise<number> {
  const gesprekken = await hsGesprekkenVanDeal(dealId).catch(() => []);
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

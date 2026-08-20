import { logBronGebeurtenis } from "./bron-gezondheid";

// ═══════════════════════════════════════════════════════════
// HUBSPOT API v3/v4 — de verkoopkant, vrijwel alleen lezen
// ═══════════════════════════════════════════════════════════
// Vereist HUBSPOT_TOKEN in Vercel: een service key uit HubSpot (instellingen,
// Integraties, Service keys). Een oudere private app-sleutel werkt ook; het is
// dezelfde Bearer-sleutel met dezelfde scopes.
// De sleutel staat nooit in een bestand; hier staat alleen de naam.
//
// DEZE LAAG LEEST. Er is precies één schrijfactie in dit bestand
// (`hsMaakNotitie`) en die zet een NOTITIE bij een deal. Er wordt nooit een veld
// van een deal overschreven, nooit een fase versleept, nooit iets verwijderd.
// Dat is geen toeval maar de afspraak uit HUBSPOT-LEADS.md: elk veld heeft één
// baas, en twee systemen die allebei mogen schrijven worden twee waarheden.
// `proeven/hubspot.proef.ts` rekent dat na en laat de bouw mislukken zodra er
// een tweede schrijfactie bijkomt.
//
// Over de limieten: een private app mag 100 verzoeken per 10 seconden doen, en
// het zoek-endpoint 5 per seconde. We halen alleen op wat sinds de vorige ronde
// gewijzigd is, dus in de praktijk zijn dat een paar verzoeken per kwartier.
// ═══════════════════════════════════════════════════════════

const BASE = "https://api.hubapi.com";

export function hubspotConfigured(): boolean {
  return !!(process.env.HUBSPOT_TOKEN || "").trim();
}

function token(): string {
  return (process.env.HUBSPOT_TOKEN || "").trim();
}

/** Vertaalt een HubSpot-fout naar een zin die op het scherm te begrijpen is. */
function leesbareFout(status: number, body: string): string {
  if (status === 401) return "HubSpot: de sleutel is ongeldig of ingetrokken (401). Maak in HubSpot een nieuwe service key en zet hem in Vercel als HUBSPOT_TOKEN.";
  if (status === 403) {
    const mist = /required (?:granular )?scopes?: ?([^"]+)/i.exec(body);
    return `HubSpot: de sleutel mist leesrechten (403)${mist ? ` op ${mist[1]}` : ""}. Vink in HubSpot bij deze service key de ontbrekende scopes aan.`;
  }
  if (status === 429) return "HubSpot: te veel verzoeken (429). De volgende ronde pakt het vanzelf weer op.";
  return `HubSpot gaf ${status}: ${body.slice(0, 300)}`;
}

type Methode = "GET" | "POST";

// Eén doorgang naar HubSpot. `POST` is hier bewust toegestaan: het zoek-endpoint
// en het batch-lezen van HubSpot zijn POST-verzoeken die alleen maar lezen.
// Wat er wél of niet geschreven mag worden, staat in de proef, niet in de vorm
// van het verzoek.
async function hs(pad: string, methode: Methode = "GET", body?: unknown, params: Record<string, string> = {}): Promise<unknown> {
  if (!hubspotConfigured()) {
    await logBronGebeurtenis("hubspot", false, "HUBSPOT_TOKEN ontbreekt.");
    throw new Error("HUBSPOT_TOKEN ontbreekt. Zet je HubSpot service key in Vercel.");
  }
  const url = new URL(`${BASE}${pad}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url.toString(), {
      method: methode,
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!res.ok) {
      const tekst = await res.text().catch(() => "");
      const melding = leesbareFout(res.status, tekst);
      await logBronGebeurtenis("hubspot", false, melding);
      throw new Error(melding);
    }
    await logBronGebeurtenis("hubspot", true);
    return await res.json();
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      const melding = "HubSpot reageerde niet binnen 25 seconden.";
      await logBronGebeurtenis("hubspot", false, melding);
      throw new Error(melding);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Werkt de koppeling? Eén klein verzoek, voor het gezondheidsscherm. */
export async function hubspotHealthCheck(): Promise<{ ok: boolean; melding: string }> {
  try {
    const info = (await hs("/account-info/v3/details")) as { portalId?: number; uiDomain?: string };
    return { ok: true, melding: info?.portalId ? `Verbonden met HubSpot-account ${info.portalId}.` : "Verbonden met HubSpot." };
  } catch (e) {
    return { ok: false, melding: (e as Error).message };
  }
}

// Het accountnummer wordt één keer per server opgehaald; het verandert nooit en
// is alleen nodig om een deal-link te kunnen maken.
let portaalBelofte: Promise<string> | null = null;
export function hubspotPortaal(): Promise<string> {
  if (!portaalBelofte) {
    portaalBelofte = hs("/account-info/v3/details")
      .then((d) => String((d as { portalId?: number }).portalId || ""))
      .catch(() => "");
  }
  return portaalBelofte;
}

/** De link naar de deal in HubSpot zelf, zodat je er met één klik heen kunt. */
export async function hsDealLink(dealId: string): Promise<string> {
  const portaal = await hubspotPortaal();
  return portaal ? `https://app.hubspot.com/contacts/${portaal}/record/0-3/${dealId}` : "";
}

// ── Pijplijnen en fases ─────────────────────────────────────

export type HsFase = { id: string; naam: string; kans: number | null; gesloten: boolean; gewonnen: boolean };
export type HsPijplijn = { id: string; naam: string; fases: HsFase[] };

type RuwePijplijn = {
  id: string; label: string;
  stages?: { id: string; label: string; displayOrder?: number; metadata?: { probability?: string; isClosed?: string } }[];
};

/**
 * De pijplijnen met hun fases. Hieruit komt ook de kans per fase: HubSpot zet
 * daar zelf een percentage op (0 tot 1), en dat is precies het getal dat de
 * prognose nodig heeft.
 */
export async function hsPijplijnen(): Promise<HsPijplijn[]> {
  const d = (await hs("/crm/v3/pipelines/deals")) as { results?: RuwePijplijn[] };
  return (d.results || []).map((p) => ({
    id: String(p.id),
    naam: String(p.label || p.id),
    fases: (p.stages || [])
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((s) => {
        const kans = Number(s.metadata?.probability);
        const gesloten = String(s.metadata?.isClosed || "").toLowerCase() === "true";
        return {
          id: String(s.id),
          naam: String(s.label || s.id),
          kans: Number.isFinite(kans) ? Math.round(kans * 100) : null,
          gesloten,
          // Een gesloten fase met kans 100% is "gewonnen", met 0% is "verloren".
          gewonnen: gesloten && Number.isFinite(kans) && kans >= 1,
        };
      }),
  }));
}

// ── Deals ───────────────────────────────────────────────────

export type HsDeal = {
  id: string;
  naam: string;
  pijplijn: string;
  fase: string;
  bedrag: number | null;
  sluitDatum: string | null;       // JJJJ-MM-DD
  kans: number | null;             // 0 tot 100, uit de fase
  volgendeActie: string | null;    // JJJJ-MM-DD, uit HubSpot zelf
  laatsteContact: string | null;   // JJJJ-MM-DD
  gewijzigdOp: string | null;      // ISO, om de volgende ronde vanaf hier te lezen
  eigenaarId: string | null;
};

const DEAL_VELDEN = [
  "dealname", "pipeline", "dealstage", "amount", "closedate",
  "hs_deal_stage_probability", "notes_next_activity_date", "notes_last_contacted",
  "hs_lastmodifieddate", "hubspot_owner_id",
];

type RuweDeal = { id: string; properties?: Record<string, string | null> };

function alsDatum(v: string | null | undefined): string | null {
  const t = String(v || "").trim();
  if (!t) return null;
  const d = new Date(/^\d+$/.test(t) ? Number(t) : t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function alsGetal(v: string | null | undefined): number | null {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * De deals die sinds `sinds` gewijzigd zijn, eventueel beperkt tot een paar
 * pijplijnen. Zonder `sinds` komt alles binnen; dat is de knop "alles opnieuw
 * ophalen" en niet wat het kwartierrondje doet.
 */
export async function hsDeals(sinds: Date | null, pijplijnen: string[] = [], maximum = 300): Promise<HsDeal[]> {
  const filters: Record<string, unknown>[] = [];
  if (sinds) filters.push({ propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(sinds.getTime()) });
  if (pijplijnen.length) filters.push({ propertyName: "pipeline", operator: "IN", values: pijplijnen });

  const uit: HsDeal[] = [];
  let na: string | undefined;
  for (let ronde = 0; ronde < 10 && uit.length < maximum; ronde++) {
    const d = (await hs("/crm/v3/objects/deals/search", "POST", {
      filterGroups: filters.length ? [{ filters }] : [],
      properties: DEAL_VELDEN,
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
      limit: 100,
      ...(na ? { after: na } : {}),
    })) as { results?: RuweDeal[]; paging?: { next?: { after?: string } } };

    for (const r of d.results || []) {
      const p = r.properties || {};
      const kans = alsGetal(p.hs_deal_stage_probability);
      uit.push({
        id: String(r.id),
        naam: String(p.dealname || "").trim() || "Naamloze deal",
        pijplijn: String(p.pipeline || ""),
        fase: String(p.dealstage || ""),
        bedrag: alsGetal(p.amount),
        sluitDatum: alsDatum(p.closedate),
        kans: kans === null ? null : Math.round(kans <= 1 ? kans * 100 : kans),
        volgendeActie: alsDatum(p.notes_next_activity_date),
        laatsteContact: alsDatum(p.notes_last_contacted),
        gewijzigdOp: p.hs_lastmodifieddate ? new Date(Number(p.hs_lastmodifieddate) || Date.parse(p.hs_lastmodifieddate)).toISOString() : null,
        eigenaarId: p.hubspot_owner_id ? String(p.hubspot_owner_id) : null,
      });
    }
    na = d.paging?.next?.after;
    if (!na) break;
  }
  return uit.slice(0, maximum);
}

// ── Wat er aan een deal hangt ───────────────────────────────

/** De id's van de gekoppelde objecten (bedrijven, contacten, notities, taken). */
async function hsGekoppeld(dealId: string, soort: string, limiet = 50): Promise<string[]> {
  const d = (await hs(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/${soort}`, "GET", undefined, { limit: String(limiet) })) as {
    results?: { toObjectId?: string | number }[];
  };
  return (d.results || []).map((r) => String(r.toObjectId || "")).filter(Boolean);
}

async function hsBatchLees(soort: string, ids: string[], velden: string[]): Promise<Record<string, Record<string, string | null>>> {
  if (!ids.length) return {};
  const d = (await hs(`/crm/v3/objects/${soort}/batch/read`, "POST", {
    properties: velden,
    inputs: ids.slice(0, 100).map((id) => ({ id })),
  })) as { results?: RuweDeal[] };
  const uit: Record<string, Record<string, string | null>> = {};
  for (const r of d.results || []) uit[String(r.id)] = r.properties || {};
  return uit;
}

export type HsBedrijf = { id: string; naam: string; domein: string };
export type HsContact = { id: string; naam: string; mail: string; telefoon: string };

export async function hsBedrijfVanDeal(dealId: string): Promise<HsBedrijf | null> {
  const ids = await hsGekoppeld(dealId, "companies", 5);
  if (!ids.length) return null;
  const rijen = await hsBatchLees("companies", ids.slice(0, 1), ["name", "domain", "website"]);
  const id = ids[0];
  const p = rijen[id] || {};
  return {
    id,
    naam: String(p.name || "").trim(),
    domein: String(p.domain || p.website || "").trim(),
  };
}

export async function hsContactenVanDeal(dealId: string): Promise<HsContact[]> {
  const ids = await hsGekoppeld(dealId, "contacts", 10);
  if (!ids.length) return [];
  const rijen = await hsBatchLees("contacts", ids, ["firstname", "lastname", "email", "phone", "jobtitle"]);
  return ids.map((id) => {
    const p = rijen[id] || {};
    return {
      id,
      naam: [p.firstname, p.lastname].map((x) => String(x || "").trim()).filter(Boolean).join(" "),
      mail: String(p.email || "").trim(),
      telefoon: String(p.phone || "").trim(),
    };
  }).filter((c) => c.naam || c.mail);
}

export type HsGesprek = {
  id: string;
  soort: "notitie" | "gesprek" | "afspraak";
  titel: string;
  tekst: string;
  datum: string | null;
};

/** Notities, telefoongesprekken en afspraakverslagen die aan de deal hangen. */
export async function hsGesprekkenVanDeal(dealId: string): Promise<HsGesprek[]> {
  const uit: HsGesprek[] = [];

  const notitieIds = await hsGekoppeld(dealId, "notes", 50).catch(() => []);
  if (notitieIds.length) {
    const rijen = await hsBatchLees("notes", notitieIds, ["hs_note_body", "hs_timestamp"]);
    for (const id of notitieIds) {
      const p = rijen[id];
      if (!p) continue;
      uit.push({ id: `notes:${id}`, soort: "notitie", titel: "Notitie uit HubSpot", tekst: String(p.hs_note_body || ""), datum: alsDatum(p.hs_timestamp) });
    }
  }

  const gesprekIds = await hsGekoppeld(dealId, "calls", 50).catch(() => []);
  if (gesprekIds.length) {
    const rijen = await hsBatchLees("calls", gesprekIds, ["hs_call_title", "hs_call_body", "hs_timestamp"]);
    for (const id of gesprekIds) {
      const p = rijen[id];
      if (!p) continue;
      uit.push({ id: `calls:${id}`, soort: "gesprek", titel: String(p.hs_call_title || "Telefoongesprek"), tekst: String(p.hs_call_body || ""), datum: alsDatum(p.hs_timestamp) });
    }
  }

  const afspraakIds = await hsGekoppeld(dealId, "meetings", 50).catch(() => []);
  if (afspraakIds.length) {
    const rijen = await hsBatchLees("meetings", afspraakIds, ["hs_meeting_title", "hs_meeting_body", "hs_meeting_start_time", "hs_timestamp"]);
    for (const id of afspraakIds) {
      const p = rijen[id];
      if (!p) continue;
      uit.push({ id: `meetings:${id}`, soort: "afspraak", titel: String(p.hs_meeting_title || "Afspraak"), tekst: String(p.hs_meeting_body || ""), datum: alsDatum(p.hs_meeting_start_time || p.hs_timestamp) });
    }
  }

  return uit.sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
}

export type HsTaak = { id: string; titel: string; datum: string | null; afgerond: boolean };

/** De openstaande taken bij een deal: hieruit komt het eerstvolgende contactmoment. */
export async function hsTakenVanDeal(dealId: string): Promise<HsTaak[]> {
  const ids = await hsGekoppeld(dealId, "tasks", 30).catch(() => []);
  if (!ids.length) return [];
  const rijen = await hsBatchLees("tasks", ids, ["hs_task_subject", "hs_task_status", "hs_timestamp"]);
  return ids.map((id) => {
    const p = rijen[id] || {};
    return {
      id,
      titel: String(p.hs_task_subject || "Taak").trim(),
      datum: alsDatum(p.hs_timestamp),
      afgerond: String(p.hs_task_status || "").toUpperCase() === "COMPLETED",
    };
  });
}

/** De namen achter de eigenaar-id's, zodat er niet een nummer op het scherm staat. */
export async function hsEigenaren(): Promise<Map<string, string>> {
  const d = (await hs("/crm/v3/owners", "GET", undefined, { limit: "100" })) as {
    results?: { id?: string | number; firstName?: string; lastName?: string; email?: string }[];
  };
  const uit = new Map<string, string>();
  for (const o of d.results || []) {
    const naam = [o.firstName, o.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ") || String(o.email || "");
    if (o.id) uit.set(String(o.id), naam);
  }
  return uit;
}

// ── De enige schrijfactie ───────────────────────────────────
// Een notitie bij de deal, zodat je verkoopadministratie klopt zonder dat je hem
// bijhoudt. Verder wordt er in HubSpot niets aangeraakt: geen fase, geen bedrag,
// geen datum. Zie de kop van dit bestand en proeven/hubspot.proef.ts.
const NOTITIE_BIJ_DEAL = 214; // vaste HubSpot-code voor "notitie hoort bij deal"

export async function hsMaakNotitie(dealId: string, tekst: string): Promise<{ ok: boolean; error?: string }> {
  const schoon = String(tekst || "").trim();
  if (!schoon) return { ok: false, error: "Lege notitie." };
  try {
    await hs("/crm/v3/objects/notes", "POST", {
      properties: { hs_note_body: schoon.slice(0, 60000), hs_timestamp: new Date().toISOString() },
      associations: [{
        to: { id: dealId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTITIE_BIJ_DEAL }],
      }],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

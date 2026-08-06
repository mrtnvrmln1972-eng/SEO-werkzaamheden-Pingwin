import { addWeekplanTasks, isoWeek } from "./weekplan";

// ═══════════════════════════════════════════════════════════
// VAN SIGNAAL NAAR KAART: ÉÉN MANIER, VOOR ELK SCHERM
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat. Het dashboard signaleert op steeds meer plekken iets dat
// gedaan moet worden: de prioriteitenscan, Meta & CTR, Opruimen, de interne
// links, het Google-profiel. Elk van die schermen had zijn eigen weg naar de
// planning kunnen krijgen, met elk een eigen kaartopmaak en een eigen manier om
// terug te wijzen naar waar het vandaan kwam. Dat is precies het patroon dat
// hier al drie keer misging: dezelfde regel op vijf plekken uitschrijven
// betekent dat ze uit elkaar gaan lopen zonder dat iemand het merkt.
//
// Dus: één laag. Een scherm levert alleen wélke punten er op de planning moeten;
// wát er dan in de kaart komt te staan, en hoe, staat hier één keer.
//
// DRIE DINGEN STAAN ALTIJD OP ZO'N KAART, en dat is niet onderhandelbaar:
//
// 1. WAT JE DOET. De actie, niet een herhaling van het probleem. "Er staan te
//    weinig foto's" is geen taak; "zet er tien echte foto's op, binnen en
//    buiten" wel.
// 2. WAAROM, met het bewijs erbij. Zonder dat is de kaart over drie weken een
//    raadsel, en kun je er ook niets zinnigs over aan de klant vertellen.
// 3. WAAR HET VANDAAN KOMT. Een link terug naar exact het punt op het scherm dat
//    het signaleerde. Veel van deze kaarten hangen niet aan een pagina van de
//    site, dus zonder die link is er geen weg terug naar de context.
//
// EEN SCHERM AANSLUITEN is daarom één ding: een bron registreren met een
// resolver die uit de opgeslagen analyse van dát scherm de punten opdiept. Geen
// nieuwe route, geen nieuwe kaartopmaak, geen nieuwe knop-logica.
// ═══════════════════════════════════════════════════════════

/** Eén punt dat op de planning kan. Dit is wat een scherm moet kunnen leveren. */
export type SignaalPunt = {
  /** Uniek binnen deze bron. Wordt de sleutel van het anker. */
  key: string;
  /** Wat er aan de hand is, in gewone taal. Wordt de kaarttitel. */
  titel: string;
  /** Wat er moet gebeuren. Concreet genoeg om morgen op te pakken. */
  actie: string;
  /** Waarom het uitmaakt. Eén zin. */
  waarom: string;
  /** Wat er gemeten is. Leeg mag: niet elk signaal is een meting. */
  bewijs?: string;
  /** Extra links die bij dit punt horen (het profiel, de pagina, een document). */
  links?: { label: string; url: string }[];
  /** Het anker op het bronscherm. Leeg = terug naar het scherm zelf. */
  anker?: string;
  /** Hoe vaak, als dat bij dit punt hoort (bijvoorbeeld "wekelijks"). */
  ritme?: string;
  /** Wie het doet. Standaard SEO. */
  wie?: string;
};

/**
 * Diept de punten op uit de opgeslagen analyse van één scherm. Zo blijft dát
 * scherm de enige bron van zijn eigen teksten: de browser stuurt alleen welke
 * punten, nooit wat er in de kaart moet komen. Dat scheelt niet alleen
 * dubbele tekst, het voorkomt ook dat iemand via de browser een kaart met
 * verzonnen inhoud kan laten aanmaken.
 */
export type Resolver = (slug: string, keys: string[], ctx: Record<string, string>) => Promise<SignaalPunt[]>;

export type BronDef = {
  /** Hoe deze bron in de kaart genoemd wordt. */
  label: string;
  /** Het tabblad waar dit signaal vandaan komt (voor de terugweg-link). */
  tab: string;
  /** Waar de kaarten van deze bron onder gebundeld worden in de planning. */
  thread: string;
  /** Het taaktype op de kaart, zodat je later kunt filteren op soort werk. */
  taaktype: string;
  resolver: Resolver;
};

// ── Het register ────────────────────────────────────────────
// Bewust een register en geen import-per-scherm: zo staat op één plek welke
// schermen hun signalen op de planning kunnen zetten, en zie je meteen welke nog
// niet aangesloten zijn.
const BRONNEN = new Map<string, BronDef>();

export function registreerBron(key: string, def: BronDef): void {
  BRONNEN.set(key, def);
}

export function bronBestaat(key: string): boolean {
  return BRONNEN.has(key);
}

export function bekendeBronnen(): string[] {
  return [...BRONNEN.keys()];
}

// ── De kaartopmaak: de enige plek waar de vorm van een kaart vastligt ──

/** De terugweg naar het punt dat de kaart veroorzaakte. */
export function terugLink(slug: string, tab: string, anker?: string): string {
  return `/admin/client/${slug}?tab=${tab}${anker ? `#${anker}` : ""}`;
}

function kaartTekst(slug: string, bron: BronDef, p: SignaalPunt): string {
  const regels = [
    `**Wat je doet:** ${p.actie}`,
    p.bewijs ? `**Wat we gemeten hebben:** ${p.bewijs}` : "",
    `**Waarom dit uitmaakt:** ${p.waarom}`,
    p.ritme ? `**Hoe vaak:** ${p.ritme}` : "",
    ...(p.links || []).map((l) => `**${l.label}:** ${l.url}`),
    `**Waar dit vandaan komt:** ${bron.label} — ${terugLink(slug, bron.tab, p.anker)}`,
  ];
  return regels.filter(Boolean).join("\n\n");
}

// ── De ene ingang ───────────────────────────────────────────

export type OpPlanningUitslag = { ok: boolean; added: number; merged: number; melding: string; error?: string };

/**
 * Zet de gekozen punten van één bron op de planning. Dit is de enige functie die
 * een scherm nodig heeft; alles daarboven (welke punten, welk vinkje) is scherm-
 * werk, alles daaronder (hoe de kaart eruitziet, hoe de terugweg loopt) is van
 * deze laag.
 */
export async function zetOpPlanning(
  slug: string,
  bronKey: string,
  keys: string[],
  ctx: Record<string, string> = {},
): Promise<OpPlanningUitslag> {
  const bron = BRONNEN.get(bronKey);
  if (!bron) return { ok: false, added: 0, merged: 0, melding: "", error: `Onbekende bron "${bronKey}".` };
  if (!keys.length) return { ok: false, added: 0, merged: 0, melding: "", error: "Er is niets aangevinkt om op de planning te zetten." };

  const punten = await bron.resolver(slug, keys, ctx);
  if (!punten.length) {
    return { ok: false, added: 0, merged: 0, melding: "", error: "Deze punten staan niet (meer) in de laatste analyse. Meet opnieuw en probeer het dan nog eens." };
  }

  const week = isoWeek(new Date());
  const r = await addWeekplanTasks(slug, bron.thread, punten.map((p) => ({
    taak: p.titel,
    toelichting: kaartTekst(slug, bron, p),
    wie: p.wie || "SEO",
    taaktype: bron.taaktype,
    week,
  })));

  const n = r.added + r.merged;
  return {
    ok: true, added: r.added, merged: r.merged,
    melding: `${n} ${n === 1 ? "taak" : "taken"} op de planning gezet${r.merged ? `, waarvan ${r.merged} samengevoegd met een bestaande kaart` : ""}.`,
  };
}

// ── De aangesloten schermen ─────────────────────────────────
// Registreren gebeurt in lib/signaal-bronnen.ts, dat door de API-route wordt
// geladen. Bewust een apart bestand: deze laag mag niets weten van de motoren,
// anders sleept elke aanroeper alle scans mee.

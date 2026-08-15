import { sql } from "@vercel/postgres";
import { ensureTweaks, haalTweaks, type Tweak } from "./tweaks";

// ═══════════════════════════════════════════════════════════
// DE WACHTRIJ BEWAAKT ZICHZELF: ÉÉN RONDE TEGELIJK, OP VOLGORDE
// ═══════════════════════════════════════════════════════════
// De stapel werkt met rondes: één chat pakt alles wat openstaat, bouwt het, en
// zet het in één keer live. Zolang Maarten die rondes zelf startte kon dat niet
// misgaan, want hij startte er één. Nu draait er ook elk uur vanzelf een ronde
// én zit er een knop "nu draaien" op het scherm, en dan kan het wél misgaan:
// twee rondes die tegelijk dezelfde meldingen oppakken, in dezelfde repo, in
// dezelfde bestanden. Dat is precies het patroon achter bijna elk "dit brak"
// in het beslissingen-log (dubbel werk, conflictmarkeringen meegecommit,
// noodreparaties die weer weggehaald moesten worden).
//
// Een afspraak ("start geen tweede ronde") lost dat niet op; die wordt gebroken
// zodra iemand haast heeft, en een cron heeft altijd haast. Daarom bewaakt de
// wachtrij het zelf, met twee dingen die geen geheugen nodig hebben:
//
//  1. EEN SLOT. Er is precies één rij in `tweak_ronde`. Een ronde begint door
//     die rij op zijn eigen naam te zetten, in één opdracht die of lukt of niet
//     lukt. Lukt hij niet, dan loopt er al een ronde en stopt de tweede meteen.
//  2. EEN VERVALTIJD. Een ronde die halverwege doodvalt (chat afgebroken, bouw
//     mislukt) zou het slot anders voor altijd vasthouden. Na CLAIM_MINUTEN
//     valt het slot vanzelf vrij en gaan de meldingen terug de wachtrij in, op
//     hun eigen plek, zodat de volgende ronde ze gewoon weer meepakt.
//
// De volgorde komt uit dezelfde opdracht die de meldingen claimt: eerst wat op
// "direct doorvoeren" staat, daarna de volgorde die Maarten zelf gesleept heeft.
// Zo kán een ronde niet iets anders doen dan wat het scherm laat zien.
// ═══════════════════════════════════════════════════════════

/** Hoe lang een ronde het slot mag houden voor hij als vastgelopen geldt. */
export const CLAIM_MINUTEN = 45;

/** Hoeveel meldingen één ronde maximaal oppakt. Meer dan dit is geen ronde meer. */
export const MAX_PER_RONDE = 25;

export type RondeStand = {
  /** De ronde die nu loopt, of null als de wachtrij vrij is. */
  ronde: string | null;
  gestart: string | null;
  /** Hoeveel meldingen deze ronde onder handen heeft. */
  bezig: number;
};

/**
 * Een ronde die te lang stilstaat teruggeven aan de wachtrij.
 *
 * Draait vóór elke claim en bij elke keer dat het scherm de stapel ophaalt, dus
 * niemand hoeft iets op te ruimen; een vastgelopen ronde ruimt zichzelf op.
 * Geeft terug hoeveel meldingen zijn vrijgegeven.
 */
export async function bevrijdVastgelopen(): Promise<number> {
  await ensureTweaks();
  const vervallen = await sql`
    UPDATE tweak_ronde
    SET ronde = NULL
    WHERE id = 1 AND ronde IS NOT NULL AND gestart < now() - (${CLAIM_MINUTEN} * INTERVAL '1 minute')
    RETURNING ronde`;
  if (vervallen.rowCount === 0) return 0;

  const oude = String(vervallen.rows[0]?.ronde ?? "");
  const terug = await sql`
    UPDATE tweaks
    SET stand = 'wachtrij', ronde = NULL, bezig_sinds = NULL
    WHERE stand = 'bezig' AND (ronde = ${oude} OR ronde IS NULL)
    RETURNING id`;
  return terug.rowCount ?? 0;
}

/**
 * Loopt de ronde van de knop nog écht, of is hij allang klaar?
 *
 * Dit is het verschil tussen een wachtrij die vrijkomt als het werk klaar is, en
 * een wachtrij die vrijkomt als de klok het zegt. Dat tweede is wat het was, en
 * dat is precies verkeerd: op 15-08-2026 stond het scherm drie kwartier "er
 * loopt een ronde" te zeggen terwijl de werkstroom na 79 seconden klaar was.
 *
 * Een ronde die vanaf de knop start heet `gh-<nummer van de draaibeurt>`, en dat
 * nummer is precies wat je bij GitHub kunt navragen. Zegt GitHub dat hij klaar
 * is, dan is het slot van niemand meer en gaat het meteen open. Lukt navragen
 * niet (geen sleutel, GitHub plat), dan verandert er niets en blijft de
 * vervaltijd het vangnet; hij mag alleen nooit meer de gewone weg zijn.
 */
async function loopthijEcht(ronde: string): Promise<boolean> {
  const nummer = /^gh-(\d+)$/.exec(ronde)?.[1];
  if (!nummer) return true; // Een ronde uit een chat kunnen we niet navragen.
  const token = process.env.GITHUB_TWEAK_TOKEN;
  if (!token) return true;
  const repo = process.env.GITHUB_TWEAK_REPO || "mrtnvrmln1972-eng/SEO-werkzaamheden-Pingwin";
  const antwoord = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${nummer}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  }).catch(() => null);
  if (!antwoord || antwoord.status !== 200) return true;
  const gegevens = await antwoord.json().catch(() => null);
  return String(gegevens?.status ?? "") !== "completed";
}

/** Loopt er een ronde, en zo ja sinds wanneer? */
export async function rondeStand(): Promise<RondeStand> {
  await ensureTweaks();
  await bevrijdVastgelopen();

  // Eerst navragen of de ronde van de knop nog leeft. Zo niet, dan gaat het slot
  // meteen open in plaats van na de vervaltijd.
  const houder = await sql`SELECT ronde FROM tweak_ronde WHERE id = 1`;
  const naam = houder.rows[0]?.ronde ? String(houder.rows[0].ronde) : null;
  if (naam && !(await loopthijEcht(naam))) await geefRondeTerug(naam);
  const r = await sql`
    SELECT (SELECT ronde FROM tweak_ronde WHERE id = 1)                        AS ronde,
           (SELECT gestart FROM tweak_ronde WHERE id = 1)                      AS gestart,
           (SELECT count(*) FROM tweaks WHERE stand = 'bezig')::int            AS bezig`;
  const ronde = r.rows[0]?.ronde ? String(r.rows[0].ronde) : null;
  return {
    ronde,
    gestart: ronde && r.rows[0]?.gestart ? new Date(String(r.rows[0].gestart)).toISOString() : null,
    bezig: Number(r.rows[0]?.bezig ?? 0),
  };
}

export type ClaimUitslag =
  | { ok: true; ronde: string; tweaks: Tweak[] }
  | { ok: false; reden: "bezet"; stand: RondeStand }
  | { ok: false; reden: "leeg"; stand: RondeStand };

/**
 * Het begin van een ronde: pak het slot, en daarmee de meldingen die erbij horen.
 *
 * Twee rondes die op dezelfde seconde beginnen kunnen niet allebei slagen: de
 * UPDATE hieronder wijzigt precies één rij en de tweede krijgt er nul terug.
 * Wie niets krijgt, hoort niets te bouwen.
 */
export async function claimRonde(ronde: string): Promise<ClaimUitslag> {
  await ensureTweaks();
  await bevrijdVastgelopen();

  const slot = await sql`
    UPDATE tweak_ronde
    SET ronde = ${ronde}, gestart = now()
    WHERE id = 1 AND ronde IS NULL
    RETURNING ronde`;
  if (slot.rowCount === 0) return { ok: false, reden: "bezet", stand: await rondeStand() };

  // Alleen echte tweaks, niet geparkeerd, in de volgorde die op het scherm staat.
  const r = await sql`
    UPDATE tweaks
    SET stand = 'bezig', ronde = ${ronde}, bezig_sinds = now()
    WHERE id IN (
      SELECT id FROM tweaks
      WHERE stand = 'wachtrij' AND soort = 'tweak' AND prioriteit <> 'geparkeerd'
      ORDER BY (prioriteit = 'nu') DESC, volgorde ASC, id ASC
      LIMIT ${MAX_PER_RONDE}
    )
    RETURNING id`;

  if ((r.rowCount ?? 0) === 0) {
    // Niets te doen: het slot meteen weer teruggeven, anders houdt een lege
    // ronde de wachtrij drie kwartier dicht voor niets.
    await geefRondeTerug(ronde);
    return { ok: false, reden: "leeg", stand: await rondeStand() };
  }

  const ids = r.rows.map((x) => Number(x.id));
  const alles = await haalTweaks(true);
  const gepakt = ids
    .map((id) => alles.find((t) => t.id === id))
    .filter((t): t is Tweak => Boolean(t));
  return { ok: true, ronde, tweaks: gepakt };
}

/**
 * De noodrem: breek af wat er ook loopt, ongeacht de naam.
 *
 * De vervaltijd hierboven is een vangnet, geen bediening. Een ronde die
 * aantoonbaar dood is (de werkstroom staat op "klaar" bij GitHub, er is niets
 * gebeurd) hield de wachtrij drie kwartier dicht, en dan sta je te wachten op
 * een klok terwijl je weet dat er niets meer komt. Dat is precies het soort
 * machteloosheid waar dit dashboard vanaf moet.
 *
 * Alleen Maarten mag dit; de meekijk-sessie niet. Anders kan een ronde zichzelf
 * of een ander losbreken en is het slot geen slot meer.
 */
export async function breekRondeAf(): Promise<number> {
  await ensureTweaks();
  await sql`UPDATE tweak_ronde SET ronde = NULL WHERE id = 1`;
  const terug = await sql`
    UPDATE tweaks SET stand = 'wachtrij', ronde = NULL, bezig_sinds = NULL
    WHERE stand = 'bezig' RETURNING id`;
  return terug.rowCount ?? 0;
}

/**
 * Het slot teruggeven. Meldingen die nog op "bezig" staan gaan terug de wachtrij
 * in: een ronde die stopt zonder ze op "controleer" te zetten heeft ze niet
 * gedaan, en dan horen ze gewoon weer in de rij te staan.
 */
export async function geefRondeTerug(ronde: string): Promise<void> {
  await ensureTweaks();
  await sql`UPDATE tweak_ronde SET ronde = NULL WHERE id = 1 AND ronde = ${ronde}`;
  await sql`
    UPDATE tweaks SET stand = 'wachtrij', ronde = NULL, bezig_sinds = NULL
    WHERE stand = 'bezig' AND ronde = ${ronde}`;
}

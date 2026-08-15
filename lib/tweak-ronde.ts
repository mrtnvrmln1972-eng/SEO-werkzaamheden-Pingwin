import { sql } from "@vercel/postgres";
import { ensureTweaks, haalTweaks, type Tweak } from "./tweaks";
import { bevrijdSlot, geefSlot, pakSlot, slotStand, VERVAL_MINUTEN } from "./bouwslot";

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

// Sinds er ook een nachtelijke bouwronde voor grote punten bestaat, is het slot
// gedeeld en woont het in `lib/bouwslot.ts`. Dit bestand gaat nog steeds alleen
// over de tweak-baan; wat er veranderde is dat "bezet" nu ook bezet kan zijn
// door een groot punt. Dat is precies de bedoeling: overdag de tweaks, 's nachts
// de grote punten, nooit allebei tegelijk in dezelfde bestanden.

/** Hoe lang een ronde het slot mag houden voor hij als vastgelopen geldt. */
export const CLAIM_MINUTEN = VERVAL_MINUTEN.tweak;

/** Hoeveel meldingen één ronde maximaal oppakt. Meer dan dit is geen ronde meer. */
export const MAX_PER_RONDE = 25;

export type RondeStand = {
  /** De ronde die nu loopt, of null als de wachtrij vrij is. */
  ronde: string | null;
  gestart: string | null;
  /** Hoeveel meldingen deze ronde onder handen heeft. */
  bezig: number;
  /** In welke baan de lopende ronde werkt: de tweaks, of een groot punt. */
  baan: "tweak" | "punt" | null;
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
  const vrij = await bevrijdSlot();
  if (!vrij) return 0;
  // Het opruimen zelf doet `bevrijdSlot` al, voor beide banen. Hier telt alleen
  // nog hoeveel meldingen daardoor weer in de wachtrij staan, voor de melding
  // op het scherm.
  const terug = await sql`SELECT count(*)::int AS n FROM tweaks WHERE stand = 'wachtrij'`;
  return vrij.baan === "tweak" ? Number(terug.rows[0]?.n ?? 0) : 0;
}

/** Loopt er een ronde, en zo ja sinds wanneer en in welke baan? */
export async function rondeStand(): Promise<RondeStand> {
  await ensureTweaks();
  const slot = await slotStand();
  const r = await sql`SELECT count(*) FILTER (WHERE stand = 'bezig')::int AS bezig FROM tweaks`;
  return {
    ronde: slot.ronde,
    gestart: slot.gestart,
    baan: slot.baan,
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

  // Het slot is gedeeld met de nachtelijke bouwronde voor grote punten. "Bezet"
  // kan hier dus ook betekenen: er wordt op dit moment een groot punt gebouwd.
  // Dat is precies de bedoeling; twee rondes in dezelfde bestanden gaat mis,
  // ongeacht wat voor werk ze doen.
  if (!(await pakSlot(ronde, "tweak"))) {
    return { ok: false, reden: "bezet", stand: await rondeStand() };
  }

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
  await geefSlot(ronde);
  await sql`
    UPDATE tweaks SET stand = 'wachtrij', ronde = NULL, bezig_sinds = NULL
    WHERE stand = 'bezig' AND ronde = ${ronde}`;
}

import { sql } from "@vercel/postgres";
import { ensureTweaks } from "./tweaks";
import { ensureGrotePunten } from "./grote-punten";

// ═══════════════════════════════════════════════════════════
// ÉÉN SLOT VOOR ALLE BOUWRONDES, IN WELKE BAAN DAN OOK
// ═══════════════════════════════════════════════════════════
// Er zijn nu twee soorten rondes die zonder toezicht code schrijven en naar
// `main` pushen: de tweak-ronde (overdag, de stapel kleine aanpassingen) en de
// bouwronde voor een groot punt ('s nachts, één punt tegelijk). Allebei werken
// ze in dezelfde repo en vaak in dezelfde bestanden.
//
// Twee rondes tegelijk is precies het patroon achter bijna elk "dit brak" in
// het beslissingen-log: dubbel werk, conflictmarkeringen meegecommit,
// noodreparaties die er weer uit moesten. Een afspraak ("start er geen twee")
// lost dat niet op, want een cron heeft altijd haast en weet niets van
// afspraken.
//
// Daarom is er precies ÉÉN rij in `tweak_ronde` en delen beide banen hem. Een
// ronde begint door die rij op zijn eigen naam te zetten, in één opdracht die
// of lukt of niet lukt. Lukt hij niet, dan loopt er al een ronde, in welke baan
// dan ook, en stopt de tweede meteen. Dat is het kader "grote punten en tweaks
// bouwen nooit tegelijk", uitgevoerd in plaats van opgeschreven.
//
// De tabel heet nog `tweak_ronde` omdat hij daar begon. Hernoemen zou een
// migratie kosten en niets opleveren; wat hij betekent staat hier.
// ═══════════════════════════════════════════════════════════

/** De twee soorten werk die het slot kunnen pakken. */
export type Baan = "tweak" | "punt";

/**
 * Hoe lang een ronde het slot mag houden voor hij als vastgelopen geldt.
 *
 * Per baan verschillend, want het gaat om heel ander werk. Een tweak-ronde die
 * drie kwartier bezig is, is stuk. Een groot punt van drie kwartier is normaal;
 * die krijgt tweeënhalf uur, ruim boven de tijdslimiet van de werkstroom zelf
 * (twee uur), zodat het vangnet nooit vóór de werkstroom dichtklapt.
 */
export const VERVAL_MINUTEN: Record<Baan, number> = { tweak: 45, punt: 150 };

export type SlotStand = {
  /** De ronde die nu loopt, of null als er niets loopt. */
  ronde: string | null;
  /** In welke baan die ronde werkt. */
  baan: Baan | null;
  gestart: string | null;
  /**
   * Een ronde die gestart is maar zich nog niet gemeld heeft.
   *
   * Tussen de knopdruk en de eerste melding zit ongeveer een minuut: de
   * werkstroom moet opgestart worden, de code ophalen en de pakketten
   * installeren. In die minuut stond er "er wordt nu niets gebouwd", en dat is
   * niet alleen onaardig maar ook onwaar; het is precies het moment waarop je
   * juist wilt zien dat je klik is aangekomen. Live gemeld op 15-08-2026.
   */
  opstarten: { baan: Baan; sinds: string } | null;
};

/**
 * Hoe lang "hij start op" een geldig antwoord blijft.
 *
 * Ruim boven de minuut die het normaal kost, en ruim onder "voor altijd": komt
 * een ronde binnen deze tijd niet opdagen, dan is hij niet opgekomen en hoort
 * het scherm dát te zeggen in plaats van te blijven hangen op opstarten.
 */
export const OPSTART_MINUTEN = 4;

async function klaar(): Promise<void> {
  await Promise.all([ensureTweaks(), ensureGrotePunten()]);
}

/**
 * Een ronde die te lang stilstaat teruggeven.
 *
 * Draait vóór elke claim en bij elke keer dat een scherm de stand opvraagt, dus
 * niemand hoeft iets op te ruimen. Het opruimen gebeurt hier voor BEIDE banen,
 * ongeacht wie het vangnet aftrapt: zou elke baan alleen zijn eigen rijen
 * opruimen, dan blijft een vastgelopen punt-ronde eeuwig op "bouwt" staan zodra
 * het de tweak-kant is die het slot vrijmaakt.
 *
 * Geeft terug welke ronde is vrijgegeven, of null als er niets verlopen was.
 */
export async function bevrijdSlot(): Promise<{ ronde: string; baan: Baan } | null> {
  await klaar();
  // Let op de `::int` achter elke ingevulde waarde: die zijn niet optioneel.
  // Een ingevulde waarde gaat als parameter naar de database, en die heeft dan
  // nog geen type. In een gewone vergelijking leidt Postgres dat zelf af, maar
  // hier wordt hij vermenigvuldigd met een INTERVAL, en dan gokt hij op tekst.
  // `text * interval` bestaat niet, dus mislukte élke pagina die deze vraag
  // stelt, inclusief de tweak-stapel. Live aangetroffen op 15-08-2026, meteen
  // nadat dit gedeelde slot er kwam; `proeven/sql-vorm.proef.ts` rekent het nu na.
  //
  // Twee losse voorwaarden in plaats van één CASE, met dezelfde reden: zo staat
  // elke waarde in zijn eigen vergelijking en is er geen twijfel mogelijk.
  const vervallen = await sql`
    UPDATE tweak_ronde
    SET ronde = NULL
    WHERE id = 1
      AND ronde IS NOT NULL
      AND (
        (baan = 'punt'  AND gestart < now() - (${VERVAL_MINUTEN.punt}::int * INTERVAL '1 minute'))
        OR
        (baan <> 'punt' AND gestart < now() - (${VERVAL_MINUTEN.tweak}::int * INTERVAL '1 minute'))
      )
    RETURNING ronde, baan`;
  if (vervallen.rowCount === 0) return null;

  const ronde = String(vervallen.rows[0]?.ronde ?? "");
  const baan = (String(vervallen.rows[0]?.baan || "tweak") as Baan);
  await ruimOp(ronde);
  return { ronde, baan };
}

/**
 * Het werk van een afgelopen ronde teruggeven aan de wachtrij, in BEIDE banen.
 *
 * Eén functie voor allebei, want het slot is gedeeld: wie hem vrijmaakt weet
 * niet per se welke baan hem had. Zou elke baan alleen zijn eigen rijen
 * opruimen, dan blijft een vastgelopen punt-ronde eeuwig op "bouwt" staan zodra
 * het de tweak-kant is die het slot vrijmaakt.
 */
async function ruimOp(ronde: string): Promise<void> {
  // Een ronde die halverwege omviel heeft het werk niet gedaan, dus het hoort
  // weer te wachten in plaats van te verdwijnen.
  await sql`
    UPDATE tweaks SET stand = 'wachtrij', ronde = NULL, bezig_sinds = NULL
    WHERE stand = 'bezig' AND (ronde = ${ronde} OR ronde IS NULL)`;
  // Een groot punt kan op twee manieren geclaimd zijn: het wordt gebouwd
  // (stand "bouwt"), of er wordt een plan voor geschreven (stand blijft
  // "plan-maken", alleen `ronde` staat gezet). Allebei moeten ze los.
  await sql`
    UPDATE grote_punten
    SET stand = CASE WHEN stand = 'bouwt' THEN 'wachtrij' ELSE stand END,
        ronde = NULL, gestart = NULL, stap = '', stap_nr = 0, stap_sinds = NULL
    WHERE (stand = 'bouwt' OR ronde IS NOT NULL) AND (ronde = ${ronde} OR ronde IS NULL)`;
}

/**
 * Loopt de ronde van een werkstroom nog écht, of is hij allang klaar?
 *
 * Dit is het verschil tussen een wachtrij die vrijkomt als het werk klaar is, en
 * een wachtrij die vrijkomt als de klok het zegt. Dat tweede is wat het was, en
 * dat is precies verkeerd: op 15-08-2026 stond het scherm drie kwartier "er
 * loopt een ronde" te zeggen terwijl de werkstroom na 79 seconden klaar was.
 *
 * Een ronde die vanuit GitHub start heet `gh-<nummer van de draaibeurt>`, en dat
 * nummer is precies wat je bij GitHub kunt navragen. Zegt GitHub dat hij klaar
 * is, dan is het slot van niemand meer en gaat het meteen open. Lukt navragen
 * niet (geen sleutel, GitHub plat), dan verandert er niets en blijft de
 * vervaltijd het vangnet; hij mag alleen nooit meer de gewone weg zijn.
 *
 * Staat hier en niet in tweak-ronde.ts omdat het slot gedeeld is: de nachtelijke
 * bouwronde start op precies dezelfde manier, dus dezelfde vraag geldt daar. Eén
 * bron, allebei de banen.
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

/**
 * Melden dat er een werkstroom gestart is, vóór hij zich zelf meldt.
 *
 * Wordt aangeroepen door lib/werkstroom.ts, dus élke start telt mee, uit welke
 * baan of welke knop dan ook. Eén plek, zodat een nieuwe startknop dit niet kan
 * vergeten.
 */
export async function meldOpstart(baan: Baan): Promise<void> {
  await klaar();
  await sql`UPDATE tweak_ronde SET opstart_baan = ${baan}, opstart_sinds = now() WHERE id = 1`;
}

/** Loopt er een ronde, in welke baan, en sinds wanneer? */
export async function slotStand(): Promise<SlotStand> {
  await klaar();
  await bevrijdSlot();

  // Navragen of de werkstroom die het slot heeft nog leeft. Zo niet, dan gaat
  // het slot meteen open in plaats van pas na de vervaltijd.
  const houder = await sql`SELECT ronde FROM tweak_ronde WHERE id = 1`;
  const naam = houder.rows[0]?.ronde ? String(houder.rows[0].ronde) : null;
  if (naam && !(await loopthijEcht(naam))) await geefSlot(naam);

  const r = await sql`SELECT ronde, baan, gestart, opstart_baan, opstart_sinds FROM tweak_ronde WHERE id = 1`;
  const ronde = r.rows[0]?.ronde ? String(r.rows[0].ronde) : null;

  // Opstarten geldt alleen zolang er nog niets geclaimd is en het kort geleden
  // is. Heeft de ronde zich gemeld, dan is de echte stand interessanter; is het
  // te lang geleden, dan is hij niet opgekomen en moet het scherm dat zeggen.
  const sinds = r.rows[0]?.opstart_sinds ? new Date(String(r.rows[0].opstart_sinds)) : null;
  const vers = sinds ? Date.now() - sinds.getTime() < OPSTART_MINUTEN * 60_000 : false;
  const opstarten = !ronde && sinds && vers
    ? { baan: (String(r.rows[0]?.opstart_baan || "tweak") as Baan), sinds: sinds.toISOString() }
    : null;

  return {
    ronde,
    baan: ronde ? ((String(r.rows[0]?.baan || "tweak")) as Baan) : null,
    gestart: ronde && r.rows[0]?.gestart ? new Date(String(r.rows[0].gestart)).toISOString() : null,
    opstarten,
  };
}

/**
 * Het slot pakken. Geeft `true` als het gelukt is.
 *
 * Twee rondes die op dezelfde seconde beginnen kunnen niet allebei slagen: deze
 * UPDATE wijzigt precies één rij en de tweede krijgt er nul terug. Wie niets
 * krijgt, hoort niets te bouwen.
 */
export async function pakSlot(ronde: string, baan: Baan): Promise<boolean> {
  await klaar();
  await bevrijdSlot();
  const slot = await sql`
    UPDATE tweak_ronde
    SET ronde = ${ronde}, baan = ${baan}, gestart = now(),
        opstart_baan = NULL, opstart_sinds = NULL
    WHERE id = 1 AND ronde IS NULL
    RETURNING ronde`;
  return (slot.rowCount ?? 0) > 0;
}

/**
 * Het slot teruggeven. Alleen de ronde die hem heeft, kan hem teruggeven.
 *
 * Het werk dat nog geclaimd stond gaat mee terug de wachtrij in, in beide banen.
 * Elke baan ruimt daarna nog zijn eigen kant op (geefRondeTerug in
 * tweak-ronde.ts, geefPuntRondeTerug in punt-ronde.ts); dat is expres dubbel,
 * want een ronde die stopt zonder zijn werk weg te zetten mag nooit een melding
 * of een punt op "bezig" achterlaten.
 */
export async function geefSlot(ronde: string): Promise<void> {
  await klaar();
  const terug = await sql`UPDATE tweak_ronde SET ronde = NULL WHERE id = 1 AND ronde = ${ronde} RETURNING ronde`;
  if (terug.rowCount) await ruimOp(ronde);
}

import { sql } from "@vercel/postgres";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// HOE LANG EEN RONDE DUURT: GEMETEN, NIET GEGOKT
// ═══════════════════════════════════════════════════════════
// Op 15-08-2026 stond er twee keer een tijd op het scherm die ik zelf had
// ingevuld. De eerste keer voorspelde hij achttien minuten voor werk van negen.
// Ik verving hem door een betere gok (vijf minuten vast plus anderhalf per
// aanpassing), en de eerstvolgende ronde duurde veertien minuten in plaats van
// de voorspelde negen. Twee keer een getal verzinnen, twee keer mis.
//
// Een verzonnen tijd is erger dan geen tijd: je gaat erop plannen, en dan klopt
// je hele dag niet. Dus: het dashboard onthoudt vanaf nu van elke afgeronde
// ronde hoe lang hij duurde en hoeveel er in zat, en rekent de verwachting
// daaruit uit. Wordt het bouwen sneller of trager, dan beweegt de schatting
// mee zonder dat iemand iets hoeft aan te passen.
//
// WAT ER GEMETEN WORDT, EN WAAROM TWEE GETALLEN
// ───────────────────────────────────────────────────────────
// Een ronde bestaat uit een vast deel en een deel dat met het aantal meegroeit:
//
//   duur ≈ VAST + AANTAL × PER_STUK
//
// Het vaste deel is de omgeving opstarten, de laatste code ophalen, de proeven
// draaien, en na het pushen wachten tot de nieuwe versie er echt staat. Dat is
// even lang voor één aanpassing als voor tien, en het is precies de reden dat
// deze stapel bestaat: tien tweaks in één ronde betalen dat één keer.
//
// Met een handvol metingen zijn die twee getallen uit de cijfers te halen (een
// rechte lijn door de punten). Zolang er te weinig meetpunten zijn, of zolang
// alle rondes toevallig even groot waren, blijft de startwaarde staan; een lijn
// door één punt zegt namelijk niets.
// ═══════════════════════════════════════════════════════════

// Vingerafdruk van `doeBouw()` hieronder; `proeven/schema-versie.proef.ts`
// rekent hem na en noemt zelf de waarde die hier hoort te staan.
export const BOUW_HISTORIE_SCHEMA_VERSIE = "bh1-930d8520";

async function doeBouw(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS bouw_historie (
      id      SERIAL PRIMARY KEY,
      baan    TEXT NOT NULL,
      aantal  INTEGER NOT NULL,
      minuten INTEGER NOT NULL,
      klaar   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS bouw_historie_baan_idx ON bouw_historie (baan, id DESC)`;
}

export function ensureBouwHistorie(): Promise<void> {
  return eenmalig("bouw-historie", BOUW_HISTORIE_SCHEMA_VERSIE, doeBouw);
}

export type Baan = "tweak" | "punt";

/** Waar de schatting mee begint zolang er te weinig gemeten is. */
export const START_VAST = 5;
export const START_PER_STUK = 2;

export type Schatting = {
  /** Minuten die elke ronde kost, ongeacht het aantal. */
  vast: number;
  /** Minuten per aanpassing erbovenop. */
  perStuk: number;
  /** Op hoeveel afgeronde rondes dit rust. 0 = dit is nog de startwaarde. */
  metingen: number;
};

/**
 * Een afgeronde ronde vastleggen.
 *
 * Alleen rondes die écht iets hebben opgeleverd tellen mee; een ronde die niets
 * vond zegt niets over hoe lang bouwen duurt en zou de schatting alleen maar
 * omlaag trekken. Stilletjes mislukken mag hier: een meting die niet wordt
 * opgeslagen is jammer, maar mag nooit een ronde laten struikelen.
 */
export async function noteerRonde(baan: Baan, aantal: number, minuten: number): Promise<void> {
  if (aantal < 1 || minuten < 1 || minuten > 600) return;
  try {
    await ensureBouwHistorie();
    await sql`INSERT INTO bouw_historie (baan, aantal, minuten) VALUES (${baan}, ${aantal}, ${minuten})`;
  } catch {
    // stil
  }
}

/**
 * De verwachting, uitgerekend uit de laatste rondes.
 *
 * Een rechte lijn door de meetpunten (kleinste kwadraten): de doorsnee is het
 * vaste deel, de helling is het deel per aanpassing. Twee dingen houden dat
 * eerlijk:
 *
 *  - minstens drie rondes én minstens twee verschillende aantallen, anders is
 *    er geen lijn te trekken en blijft de startwaarde staan;
 *  - de uitkomst wordt binnen redelijke grenzen gehouden. Eén ronde die vastliep
 *    of één die toevallig heel snel ging, mag de schatting niet laten ontsporen.
 */
export async function schatting(baan: Baan): Promise<Schatting> {
  const terug: Schatting = { vast: START_VAST, perStuk: START_PER_STUK, metingen: 0 };
  try {
    await ensureBouwHistorie();
    const r = await sql`
      SELECT aantal, minuten FROM bouw_historie
      WHERE baan = ${baan} ORDER BY id DESC LIMIT 20`;
    const punten = r.rows.map((x) => ({ n: Number(x.aantal), m: Number(x.minuten) }));
    terug.metingen = punten.length;
    if (punten.length < 3) return terug;

    const gem = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const nGem = gem(punten.map((p) => p.n));
    const mGem = gem(punten.map((p) => p.m));
    const spreiding = punten.reduce((s, p) => s + (p.n - nGem) ** 2, 0);
    if (spreiding === 0) return terug; // alle rondes even groot: geen helling te bepalen

    const helling = punten.reduce((s, p) => s + (p.n - nGem) * (p.m - mGem), 0) / spreiding;
    const doorsnee = mGem - helling * nGem;

    // Binnen redelijke grenzen: een negatieve vaste kost of een halve minuut per
    // aanpassing bestaat niet, en een uur per aanpassing is een uitschieter.
    terug.vast = Math.min(30, Math.max(2, Math.round(doorsnee)));
    terug.perStuk = Math.min(30, Math.max(0.5, Math.round(helling * 10) / 10));
    return terug;
  } catch {
    return terug;
  }
}

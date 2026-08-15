import { sql } from "@vercel/postgres";
import { geefSlot, pakSlot, slotStand, type SlotStand } from "./bouwslot";
import {
  ensureGrotePunten, gemetenDuur, haalPunt, magNaarWachtrij, STAPPEN,
  type Omvang, type Punt,
} from "./grote-punten";
import { baanNu, eindeVanDeNacht, isNacht, verwachteStarts, voortgang, volgendeNacht, type Voortgang } from "./punt-tempo";

// ═══════════════════════════════════════════════════════════
// DE NACHTELIJKE RONDE: ÉÉN PUNT TEGELIJK, EN NOOIT ZONDER AKKOORD
// ═══════════════════════════════════════════════════════════
// De tweak-ronde pakt de hele stapel in één keer; dat kan, want een tweak is
// klein en de meldingen raken elkaar zelden. Voor grote punten is dat juist de
// verkeerde vorm: twee grote wijzigingen in één ronde betekent twee halve
// wijzigingen als er onderweg iets misgaat, en het is achteraf niet meer uit
// elkaar te trekken welke commit waarbij hoorde.
//
// Vandaar: ÉÉN PUNT PER RONDE. Loopt het mis, dan is er precies één punt dat
// terug de wachtrij in gaat, met de reden in zijn eigen draadje.
//
// Een ronde kan twee soorten werk oppakken, in deze volgorde:
//
//  1. BOUWEN. Het bovenste punt in de bouwwachtrij, dus met een plan waar
//     Maarten ja tegen gezegd heeft. `claimPunt` controleert dat kader nóg een
//     keer op het moment van claimen, ook al kan een punt zonder akkoord die
//     stand niet eens krijgen. Dat is expres dubbel: dit is de laatste poort
//     vóór er 's nachts zonder toezicht code geschreven wordt.
//  2. EEN PLAN SCHRIJVEN. Staat er niets klaar om te bouwen, dan pakt de ronde
//     een punt waar Maarten een plan van gevraagd heeft. Dat kost geen code en
//     verandert niets aan het dashboard; het levert 's ochtends een plan op om
//     te beoordelen. Zo staat de nacht nooit voor niets aan.
//
// Buiten het nachtvenster start een automatische ronde niet (`baanNu`); dan is
// de tweak-baan aan de beurt. Maarten zelf mag altijd, met de knop.
// ═══════════════════════════════════════════════════════════

export type Werk = "bouwen" | "plan";

export type PuntClaim =
  | { ok: true; ronde: string; werk: Werk; punt: Punt }
  | { ok: false; reden: "bezet" | "leeg" | "overdag"; uitleg: string; stand: PuntStand };

export type PuntStand = {
  slot: SlotStand;
  /** Wordt er gebouwd, of wordt er een plan geschreven? */
  werk: "bouw" | "plan";
  /** Het punt dat nu gebouwd wordt (of waarvoor een plan geschreven wordt). */
  bezig: Punt | null;
  /** De voortgang van dat punt: welke stap, en hoe lang nog. */
  voortgang: Voortgang | null;
  /** Is het nu nacht (dus: mag de bouwronde vanzelf draaien)? */
  nacht: boolean;
  /** Wanneer het eerstvolgende nachtvenster opengaat. */
  volgendVenster: string;
};

/** Een naam voor deze ronde, zodat te zien is wie het slot heeft. */
export function rondeNaam(bron: string): string {
  const tijd = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return `${bron}-${tijd}`;
}

/**
 * Wat zou een ronde nu oppakken, zonder iets te claimen?
 *
 * Bestaat voor de werkstroom: die moet vóór het claimen weten of het bouwwerk
 * of denkwerk wordt, want daar hangt het model aan (het middelste model voor
 * bouwen, het zwaarste voor een plan; zie brein/12-zuinig-werken.md). En voor
 * het scherm, dat wil kunnen zeggen wat er vannacht gaat gebeuren.
 */
export async function volgendeTaak(): Promise<{ werk: Werk | null; punt: Punt | null }> {
  await ensureGrotePunten();
  const bouwen = await sql`
    SELECT * FROM grote_punten WHERE stand = 'wachtrij'
    ORDER BY volgorde ASC, id ASC LIMIT 1`;
  if (bouwen.rows[0]) {
    const punt = await haalPunt(Number(bouwen.rows[0].id));
    if (punt) return { werk: "bouwen", punt };
  }
  const plan = await sql`
    SELECT id FROM grote_punten WHERE stand = 'plan-maken' AND ronde IS NULL
    ORDER BY volgorde ASC, id ASC LIMIT 1`;
  if (plan.rows[0]) {
    const punt = await haalPunt(Number(plan.rows[0].id));
    if (punt) return { werk: "plan", punt };
  }
  return { werk: null, punt: null };
}

/** Loopt er iets, waar is het mee bezig, en hoe lang nog? */
export async function puntStand(nu: Date = new Date()): Promise<PuntStand> {
  await ensureGrotePunten();
  const slot = await slotStand();
  const r = await sql`
    SELECT * FROM grote_punten
    WHERE ronde IS NOT NULL OR stand = 'bouwt'
    ORDER BY id ASC LIMIT 1`;
  const bezig = r.rows[0] ? await haalPunt(Number(r.rows[0].id)) : null;
  const gemeten = bezig ? await gemetenDuur() : { klein: [], middel: [], groot: [] } as Record<Omvang, number[]>;
  // Ook een plan-ronde krijgt een voortgang. Dat stond er eerst niet in, en dan
  // zag je bij het schrijven van een plan alleen "er wordt aan gewerkt": geen
  // stap, geen balk, geen tijd. Bij werk dat je niet ziet gebeuren is dat
  // hetzelfde als niets weten.
  const werk = bezig?.stand === "plan-maken" ? "plan" : "bouw";
  const loopt = bezig ? bezig.stand === "bouwt" || (bezig.stand === "plan-maken" && Boolean(bezig.ronde)) : false;
  return {
    slot,
    bezig,
    werk,
    voortgang: bezig && loopt ? voortgang(bezig, gemeten, nu, werk) : null,
    nacht: isNacht(nu),
    volgendVenster: volgendeNacht(nu).toISOString(),
  };
}

/**
 * De bouwwachtrij met per punt wanneer hij naar verwachting aan de beurt is.
 * Wat er nu loopt telt mee: het volgende punt begint pas als dat klaar is.
 */
export async function wachtrijMetTijden(nu: Date = new Date()): Promise<{
  punten: Punt[];
  starts: { id: number; begint: string; minuten: number }[];
}> {
  await ensureGrotePunten();
  const r = await sql`
    SELECT * FROM grote_punten WHERE stand = 'wachtrij'
    ORDER BY volgorde ASC, id ASC LIMIT 50`;
  const ids = r.rows.map((x) => Number(x.id));
  const punten = (await Promise.all(ids.map(haalPunt))).filter((p): p is Punt => Boolean(p));
  const gemeten = await gemetenDuur();
  const stand = await puntStand(nu);
  const bezigTot = stand.voortgang ? stand.voortgang.rest : 0;
  return { punten, starts: verwachteStarts(punten, gemeten, nu, bezigTot) };
}

/**
 * Het begin van een ronde: pak het slot en het punt dat erbij hoort.
 *
 * `handmatig` betekent: Maarten drukte zelf op de knop. Dan geldt het
 * nachtvenster niet, want hij zit erbij en kan zien wat er gebeurt. Het slot
 * geldt wél, altijd: dat is de enige reden dat een tweak-ronde en een
 * bouwronde elkaar niet in dezelfde bestanden kunnen tegenkomen.
 */
export async function claimPunt(ronde: string, opties: { handmatig?: boolean } = {}): Promise<PuntClaim> {
  await ensureGrotePunten();
  const nu = new Date();

  if (!opties.handmatig && baanNu(nu) !== "punt") {
    return {
      ok: false, reden: "overdag",
      uitleg: "Overdag zijn de tweaks aan de beurt; grote punten worden 's nachts gebouwd.",
      stand: await puntStand(nu),
    };
  }

  const taak = await volgendeTaak();
  if (!taak.werk || !taak.punt) {
    return {
      ok: false, reden: "leeg",
      uitleg: "Er staat niets klaar: geen goedgekeurd punt om te bouwen en geen plan om te schrijven.",
      stand: await puntStand(nu),
    };
  }

  if (!(await pakSlot(ronde, "punt"))) {
    return {
      ok: false, reden: "bezet",
      uitleg: "Er loopt al een ronde (een tweak-ronde of een ander punt). Twee rondes tegelijk in dezelfde bestanden gaat mis.",
      stand: await puntStand(nu),
    };
  }

  if (taak.werk === "bouwen") {
    // De laatste poort vóór er zonder toezicht gebouwd wordt. Zou het akkoord
    // tussen het uitkiezen en het claimen ingetrokken zijn (Maarten wijzigde
    // net het plan), dan stopt het hier en gaat het slot meteen terug.
    const mag = magNaarWachtrij(taak.punt);
    if (!mag.ok) {
      await geefSlot(ronde);
      return { ok: false, reden: "leeg", uitleg: mag.reden, stand: await puntStand(nu) };
    }
    const r = await sql`
      UPDATE grote_punten
      SET stand = 'bouwt', ronde = ${ronde}, gestart = now(),
          stap = ${STAPPEN[0]}, stap_nr = 0, stap_sinds = now(), rondes = rondes + 1
      WHERE id = ${taak.punt.id} AND stand = 'wachtrij'
      RETURNING id`;
    if (r.rowCount === 0) {
      // Iemand was net eerder; niets gedaan, slot meteen terug.
      await geefSlot(ronde);
      return { ok: false, reden: "leeg", uitleg: "Dit punt was net al opgepakt.", stand: await puntStand(nu) };
    }
  } else {
    const r = await sql`
      UPDATE grote_punten
      SET ronde = ${ronde}, gestart = now()
      WHERE id = ${taak.punt.id} AND stand = 'plan-maken' AND ronde IS NULL
      RETURNING id`;
    if (r.rowCount === 0) {
      await geefSlot(ronde);
      return { ok: false, reden: "leeg", uitleg: "Dit punt was net al opgepakt.", stand: await puntStand(nu) };
    }
  }

  const punt = await haalPunt(taak.punt.id);
  return { ok: true, ronde, werk: taak.werk, punt: punt ?? taak.punt };
}

/**
 * Het slot teruggeven. Staat het punt nog op "bouwt", dan is het niet af en
 * gaat het terug de wachtrij in, op zijn eigen plek.
 *
 * Dit is geen beleefdheid maar de sluiting: zolang het slot van deze ronde is
 * kan er niets anders draaien, ook geen tweak-ronde.
 */
export async function geefPuntRondeTerug(ronde: string): Promise<void> {
  await ensureGrotePunten();
  await geefSlot(ronde);
  await sql`
    UPDATE grote_punten
    SET stand = CASE WHEN stand = 'bouwt' THEN 'wachtrij' ELSE stand END,
        ronde = NULL, gestart = NULL, stap = '', stap_nr = 0, stap_sinds = NULL
    WHERE ronde = ${ronde}`;
}

/** Hoeveel er vannacht nog in het venster past; voor de zin op het scherm. */
export function ruimteVannacht(nu: Date = new Date()): number {
  const begin = volgendeNacht(nu);
  return Math.max(0, Math.round((eindeVanDeNacht(begin).getTime() - begin.getTime()) / 60000));
}

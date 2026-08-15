import { sql } from "@vercel/postgres";
import { ensureTweaks } from "./tweaks";

// ═══════════════════════════════════════════════════════════
// DE NULMETING: ELK SCHERM ÉÉN KEER HELEMAAL NAGELOPEN
// ═══════════════════════════════════════════════════════════
// De tweak-stapel vult zich met wat Maarten toevallig tegenkomt terwijl hij aan
// het werk is. Dat is precies de bedoeling, maar het heeft één gat: een scherm
// waar hij zelden komt levert nooit een melding op, ook niet als er van alles
// aan mankeert. De stapel meet dus niet hoe het dashboard ervoor staat, hij
// meet waar hij die week gewerkt heeft.
//
// De nulmeting sluit dat gat met één ronde langs álle schermen. Niet als een
// nieuwe lijst om bij te houden, maar als een afvinklijst die vanzelf ontstaat:
// de schermen komen uit het Intern-menu en de tabbalk van een klant, dus die
// lijsten bestaan al en lopen nooit achter. Hier staat alleen de uitkomst: dit
// scherm is nagelopen, op deze datum.
//
// Waarom dat het waard is om vast te leggen: zonder deze meting weet je na een
// maand niet of een scherm goed is of alleen ongezien. Met de meting is
// "iedereen is één keer langs geweest" een feit met een datum eronder, en dat
// is precies wat je nodig hebt zodra er iemand anders in dit dashboard werkt.
// ═══════════════════════════════════════════════════════════

export type Nulmeting = {
  /** Het scherm, bijvoorbeeld "/admin/financien" of "cockpit:paginas". */
  sleutel: string;
  nagelopen: string;
  /** Eén regel: wat er opviel, of leeg als er niets aan de hand was. */
  notitie: string;
};

export async function haalNulmeting(): Promise<Nulmeting[]> {
  await ensureTweaks();
  const r = await sql`SELECT sleutel, nagelopen, notitie FROM scherm_nulmeting ORDER BY sleutel`;
  return r.rows.map((x) => ({
    sleutel: String(x.sleutel),
    nagelopen: new Date(String(x.nagelopen)).toISOString(),
    notitie: String(x.notitie ?? ""),
  }));
}

/** Een scherm afvinken (of, met `aan: false`, het vinkje weer weghalen). */
export async function zetNagelopen(sleutel: string, aan: boolean, notitie = ""): Promise<void> {
  await ensureTweaks();
  const s = sleutel.trim().slice(0, 200);
  if (!s) return;
  if (!aan) {
    await sql`DELETE FROM scherm_nulmeting WHERE sleutel = ${s}`;
    return;
  }
  await sql`
    INSERT INTO scherm_nulmeting (sleutel, nagelopen, notitie)
    VALUES (${s}, now(), ${notitie.slice(0, 500)})
    ON CONFLICT (sleutel) DO UPDATE SET nagelopen = now(), notitie = EXCLUDED.notitie`;
}

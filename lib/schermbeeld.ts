import { metBrowser } from "./browser";
import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { ADMIN_COOKIE, makeAdminSession } from "./admin-auth";
import { themaNaarCss, type Thema } from "./proefstijl";

// ═══════════════════════════════════════════════════════════
// SCHERMAFBEELDINGEN (R14): HET DASHBOARD FOTOGRAFEERT ZICHZELF
// ═══════════════════════════════════════════════════════════
// Gebruikt dezelfde headless browser als lib/render-page.ts (die klantpagina's
// meet), maar dan op een eigen /admin-scherm, ingelogd met een echte
// adminsessie. Vóór de opname wordt elke echte klantnaam, elk domein en elk
// e-mailadres in de pagina vervangen door een neutrale naam: zo'n beeld mag
// altijd openbaar op /uitleg staan.
//
// De vaste lijst hieronder koppelt elk hoofdstuk op /uitleg aan één scherm.
// Nieuw hoofdstuk erbij? Eén regel toevoegen, dan "Alles vernieuwen" draaien.
// ═══════════════════════════════════════════════════════════

export type SchermDef = { hoofdstuk: string; label: string; pad: string };

// Bron voor de klantgebonden schermen: One Day Clinic, de eerste en meest
// gevulde klant. Een verzonnen lege demo-klant zou op de meeste tabjes leeg
// ogen; een echte, gevulde klant met de naam vóór de opname weggehaald geeft
// een eerlijk beeld van wat het dashboard laat zien.
const BRON_SLUG = "one-day-clinic";

export const NEUTRALE_NAAM = "Voorbeeldklant";
export const NEUTRAAL_DOMEIN = "voorbeeldklant.nl";
export const NEUTRAAL_MAIL = `info@${NEUTRAAL_DOMEIN}`;

export const SCHERMEN: SchermDef[] = [
  { hoofdstuk: "waarom", label: "De klantenlijst", pad: "/admin" },
  { hoofdstuk: "koppelingen", label: "Status van de koppelingen", pad: "/admin/bronnen-gezondheid" },
  { hoofdstuk: "motoren", label: "De prioriteitenscan", pad: `/admin/client/${BRON_SLUG}?tab=prioriteiten` },
  { hoofdstuk: "documenten", label: "De documentenfabriek", pad: `/admin/client/${BRON_SLUG}?tab=documenten` },
  { hoofdstuk: "werk", label: "Taken en planning", pad: `/admin/client/${BRON_SLUG}?tab=werkzaamheden` },
  { hoofdstuk: "bedrijfsvoering", label: "Financieel overzicht", pad: "/admin/financien" },
  { hoofdstuk: "gebruik", label: "Verbruik en kosten", pad: "/admin/usage" },
  { hoofdstuk: "agenda", label: "De routekaart", pad: "/admin/routekaart" },
];

const BREEDTE = 1440;

let tabelKlaar: Promise<void> | null = null;
// De tabel wordt één keer gebouwd per database, niet bij elke aanroep
// opnieuw. Zie lib/schema-stand.ts. Verander je iets aan bouwEnsureTabel(), hoog
// dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHERMBEELD_VERSIE = "schermbeeld-002e6919";

function ensureTabel(): Promise<void> {
  return eenmalig("schermbeeld", SCHERMBEELD_VERSIE, bouwEnsureTabel);
}

async function bouwEnsureTabel(): Promise<void> {
  await ensureSchema();
  if (!tabelKlaar) tabelKlaar = doEnsureTabel().catch((e) => { tabelKlaar = null; throw e; });
  return tabelKlaar;
}
async function doEnsureTabel(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schermafbeeldingen (
      hoofdstuk  TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      pad        TEXT NOT NULL,
      png_base64 TEXT NOT NULL,
      bytes      INTEGER NOT NULL DEFAULT 0,
      gemaakt_op TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

/** Namen/domeinen/mailadressen van échte klanten, langste eerst (voorkomt dat een korte match een langere overschrijft). */
async function haalVervangingenOp(): Promise<{ van: string; naar: string }[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT name, domain, email_domain, email FROM clients`;
  const vervang: { van: string; naar: string }[] = [];
  for (const r of rows as { name: string | null; domain: string | null; email_domain: string | null; email: string | null }[]) {
    const naam = (r.name || "").trim();
    if (naam && naam.length >= 3 && naam.toLowerCase() !== NEUTRALE_NAAM.toLowerCase()) {
      vervang.push({ van: naam, naar: NEUTRALE_NAAM });
    }
    const domein = (r.domain || r.email_domain || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (domein && domein.length >= 4) vervang.push({ van: domein, naar: NEUTRAAL_DOMEIN });
    const mail = (r.email || "").trim();
    if (mail && mail.includes("@")) vervang.push({ van: mail, naar: NEUTRAAL_MAIL });
  }
  return vervang.sort((a, b) => b.van.length - a.van.length);
}

/** Vervangt in de geladen pagina elke tekstnode die een klantnaam/domein/mailadres bevat. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function anonimiseerPagina(page: any, vervang: { van: string; naar: string }[]): Promise<void> {
  if (!vervang.length) return;
  await page.evaluate((lijst: { van: string; naar: string }[]) => {
    function escapeRe(s: string): string {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    // eslint-disable-next-line no-cond-assign
    while ((n = walker.nextNode())) nodes.push(n as Text);
    for (const node of nodes) {
      let tekst = node.nodeValue || "";
      let gewijzigd = false;
      for (const { van, naar } of lijst) {
        if (!van) continue;
        const re = new RegExp(escapeRe(van), "gi");
        if (re.test(tekst)) {
          tekst = tekst.replace(re, naar);
          gewijzigd = true;
        }
      }
      if (gewijzigd) node.nodeValue = tekst;
    }
  }, vervang);
}

/** Maakt één schermafbeelding, anonimiseert hem, en geeft de PNG-bytes terug (of null als de browser niet kan). */
/**
 * @param wachtMs extra wachttijd ná het laden, vóór de foto. Standaard 600 ms.
 *   Een scherm dat zijn lijst zelf nabezorgt (Meta & CTR, de Prioriteitenscan)
 *   staat op dat moment nog op "bezig met opbouwen", en dan fotografeer je de
 *   wachtboodschap in plaats van het scherm. Zet hem dan hoger.
 * @param thema optioneel: fotografeer het scherm in een andere stijlrichting.
 *   Waarom dit hier hoort en niet in de browser van Maarten: een proefstijl leeft
 *   in localStorage, dus je ziet altijd één richting tegelijk en nooit twee naast
 *   elkaar. Kiezen doe je door te vergelijken, en dat kan pas als een scherm in
 *   twee standen tegelijk op tafel kan liggen. Deze foto is precies wat er zou
 *   staan als je die richting vastlegt: dezelfde som (themaNaarCss) als de
 *   vastgelegde huisstijl gebruikt.
 */
export async function maakSchermafbeelding(
  pad: string, baseUrl: string, wachtMs = 600, thema?: Thema | null
): Promise<Buffer | null> {
  const sessie = makeAdminSession();
  const vervang = await haalVervangingenOp();
  const uit = await metBrowser(async (page) => {
    await page.setViewport({ width: BREEDTE, height: 900, deviceScaleFactor: 1 });
    const url = new URL(pad, baseUrl);
    await page.setCookie({ name: ADMIN_COOKIE, value: sessie, url: url.origin, path: "/" });
    await page.goto(url.toString(), { waitUntil: "networkidle2", timeout: 25000 });
    // Achteraan in de kop, dus ná het blok van de vastgelegde huisstijl. Bij
    // gelijke zwaarte wint de laatste, en dat is hier de bedoeling: je wilt de
    // richting zien die je uitprobeert, niet de stijl die al vaststaat.
    if (thema) await page.addStyleTag({ content: themaNaarCss(thema) });
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(20000, wachtMs))));
    await anonimiseerPagina(page, vervang);
    const shot = await page.screenshot({ type: "png", fullPage: true });
    return shot as Buffer;
  });
  return uit || null;
}

export type VernieuwUitslag = { hoofdstuk: string; ok: boolean; bytes?: number; fout?: string };

/** Maakt alle schermen uit SCHERMEN opnieuw en slaat ze op. Eén opdracht, alles vernieuwd. */
export async function vernieuwAlleSchermen(baseUrl: string): Promise<VernieuwUitslag[]> {
  await ensureTabel();
  const uitslagen: VernieuwUitslag[] = [];
  for (const scherm of SCHERMEN) {
    try {
      const png = await maakSchermafbeelding(scherm.pad, baseUrl);
      if (!png) {
        uitslagen.push({ hoofdstuk: scherm.hoofdstuk, ok: false, fout: "de browser kon niet starten op deze server" });
        continue;
      }
      // Buffer.from() eromheen, en dat is geen overbodige beleefdheid: de browser
      // geeft tegenwoordig een Uint8Array terug in plaats van een Buffer, en
      // Uint8Array.toString() negeert het argument "base64" stilzwijgend. Je krijgt
      // dan "137,80,78,71,…" (de bytes als getallen) in de database, en op de
      // uitlegpagina een kapot beeldje. Dat stond er dagen zonder dat iemand het zag.
      const b64 = Buffer.from(png).toString("base64");
      await sql`
        INSERT INTO schermafbeeldingen (hoofdstuk, label, pad, png_base64, bytes, gemaakt_op)
        VALUES (${scherm.hoofdstuk}, ${scherm.label}, ${scherm.pad}, ${b64}, ${png.length}, now())
        ON CONFLICT (hoofdstuk) DO UPDATE SET
          label = EXCLUDED.label, pad = EXCLUDED.pad, png_base64 = EXCLUDED.png_base64,
          bytes = EXCLUDED.bytes, gemaakt_op = now()
      `;
      uitslagen.push({ hoofdstuk: scherm.hoofdstuk, ok: true, bytes: png.length });
    } catch (e) {
      uitslagen.push({ hoofdstuk: scherm.hoofdstuk, ok: false, fout: e instanceof Error ? e.message : String(e) });
    }
  }
  return uitslagen;
}

export type OpgeslagenScherm = { hoofdstuk: string; label: string; pad: string; dataUrl: string; gemaaktOp: string };

/**
 * De opgeslagen tekst als bruikbare afbeelding, of null.
 *
 * Repareert onderweg wat er van de kapotte periode nog in de database staat:
 * "137,80,78,…" is geen base64 maar de losse bytes, en dat levert een kapot
 * beeldje op elke pagina waar het staat. Zelf herstellen is hier beter dan een
 * knop laten indrukken, want niemand wéét dat hij moet drukken; de eerstvolgende
 * keer dat het scherm opnieuw gefotografeerd wordt, staat het goed in de database
 * en doet deze omweg niets meer.
 */
function alsBeeld(opgeslagen: string | null | undefined): string | null {
  if (!opgeslagen) return null;
  // Geen anker aan het eind: er wordt naar het begín van de tekst gekeken, en een
  // afgeknipt stuk eindigt net zo vaak midden in een getal of op een komma. Met
  // een anker mislukte de herkenning precies daar, dus stond de helft van de
  // foto's nog steeds kapot in beeld terwijl de andere helft goed was.
  const bytes = /^\d{1,3}(,\d{1,3}){8,}/.test(opgeslagen.slice(0, 200));
  const b64 = bytes
    ? Buffer.from(Uint8Array.from(opgeslagen.split(",").map(Number))).toString("base64")
    : opgeslagen;
  return `data:image/png;base64,${b64}`;
}

/** Voor het admin-scherm: alle opgeslagen beelden, met wanneer ze gemaakt zijn. */
export async function alleSchermen(): Promise<OpgeslagenScherm[]> {
  await ensureTabel();
  const { rows } = await sql`SELECT hoofdstuk, label, pad, png_base64, gemaakt_op FROM schermafbeeldingen ORDER BY hoofdstuk`;
  return (rows as { hoofdstuk: string; label: string; pad: string; png_base64: string; gemaakt_op: string }[]).map((r) => ({
    hoofdstuk: r.hoofdstuk,
    label: r.label,
    pad: r.pad,
    dataUrl: alsBeeld(r.png_base64) ?? "",
    gemaaktOp: r.gemaakt_op,
  }));
}

/** Voor /uitleg (openbaar): alleen het beeld bij één hoofdstuk, of null als het er nog niet is. */
export async function schermVoorHoofdstuk(hoofdstuk: string): Promise<string | null> {
  await ensureTabel();
  const { rows } = await sql`SELECT png_base64 FROM schermafbeeldingen WHERE hoofdstuk = ${hoofdstuk}`;
  const rij = (rows as { png_base64: string }[])[0];
  return alsBeeld(rij?.png_base64);
}

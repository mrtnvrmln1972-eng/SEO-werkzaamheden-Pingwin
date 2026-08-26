// ═══════════════════════════════════════════════════════════
// EEN NET AANGEMAAKTE KIJK-SLEUTEL MOET DIRECT WERKEN
// ═══════════════════════════════════════════════════════════
// Op 26-08-2026 werd élke verse sleutel meteen geweigerd met "andere-sleutel",
// ook door de zelftest in de cockpit zelf. De oorzaak zat niet in het hashen
// maar in de bovengrens: die sorteerde de geldige sleutels op "laatst gebruikt",
// en een sleutel van één seconde oud is nog nooit gebruikt, dus die stond
// achteraan. Waren er al twaalf gestempelde sleutels, dan viel de nieuwe erbuiten
// en trok hij zichzelf in, één opdracht nadat hij was uitgedeeld.
//
// `kijk-sleutel.proef.ts` stond ernaast en werd groen, want die leest alleen de
// brontekst: hij ziet dát er een bovengrens is, niet wie eruit valt. Daarom deze
// proef, die de echte code draait: sleutel aanmaken, en meteen daarna langs de
// deur die Claude gebruikt. Dat is de enige controle die deze fout vangt.
//
// Er is geen database nodig en dat is met opzet: de proef draait bij élke bouw,
// ook op Vercel, en mag nooit afhangen van een verbinding. De database wordt
// vervangen door een klein nagemaakt exemplaar dat precies de opdrachten kent
// die dit onderdeel geeft. Het rekenwerk dat fout ging (wie valt af) staat sinds
// de reparatie in gewone code (`vervallenSleutels`), dus dat draait hier écht mee
// en wordt niet nagespeeld.
// ═══════════════════════════════════════════════════════════

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) {
    fouten++;
    if (uitleg) console.log(`     | ${uitleg}`);
  }
}

// ── Het nagemaakte database-tafeltje ──
type Rij = { id: number; key_hash: string; created_at: Date; revoked_at: Date | null; last_used: Date | null };
const tabel: Rij[] = [];
let volgendId = 1;
// Staat er een standaardwaarde op revoked_at, dan komt elke nieuwe rij binnen
// als ingetrokken. Zie proef 8 onderaan.
let standaardIngetrokken = false;

function tijd(d: Date | null): number {
  return d ? d.getTime() : 0;
}

function nepSql(strings: TemplateStringsArray, ...waarden: unknown[]) {
  const tekst = strings.join("§").replace(/\s+/g, " ").trim();
  const k = tekst.toLowerCase();
  const leeg = { rows: [] as Record<string, unknown>[], rowCount: 0 };

  if (!k.includes("claude_view_key")) return Promise.resolve(leeg); // schema, log, rest: niet ons onderwerp

  if (k.startsWith("insert into claude_view_key")) {
    const rij: Rij = {
      id: volgendId++,
      key_hash: String(waarden[0]),
      created_at: new Date(),
      // Een tabel kán een standaardwaarde op revoked_at hebben staan; dan komt
      // elke nieuwe sleutel binnen als al ingetrokken. Precies dat gebeurde op
      // 26-08-2026. Met deze schakelaar spelen we die database na.
      revoked_at: standaardIngetrokken ? new Date() : null,
      last_used: null,
    };
    tabel.push(rij);
    return Promise.resolve({ rows: [{ id: rij.id }], rowCount: 1 });
  }

  if (k.startsWith("update claude_view_key")) {
    if (k.includes("set last_used")) {
      const rij = tabel.find((r) => r.id === Number(waarden[0]));
      if (rij) rij.last_used = new Date();
      return Promise.resolve({ ...leeg, rowCount: rij ? 1 : 0 });
    }
    if (k.includes("set revoked_at = null")) {
      // Twee opdrachten zetten revoked_at leeg: het rechtzetten van één rij
      // (createViewKey, op id) en de eenmalige herstelactie van 15-08 (op
      // datum). Alleen de eerste doet in deze proef iets.
      if (!k.includes("where id =")) return Promise.resolve(leeg);
      const rij = tabel.find((r) => r.id === Number(waarden[0]));
      if (rij) rij.revoked_at = null;
      return Promise.resolve({ ...leeg, rowCount: rij ? 1 : 0 });
    }
    const ids = k.includes("string_to_array")
      ? String(waarden[0]).split(",").map(Number)
      : tabel.filter((r) => !r.revoked_at).map((r) => r.id);
    let n = 0;
    for (const r of tabel) {
      if (ids.includes(r.id) && !r.revoked_at) {
        r.revoked_at = new Date();
        n++;
      }
    }
    return Promise.resolve({ ...leeg, rowCount: n });
  }

  if (k.startsWith("select")) {
    let rijen = tabel.filter((r) => r.revoked_at === null);
    if (k.includes("order by coalesce(last_used, created_at)")) {
      rijen = [...rijen].sort(
        (a, b) => tijd(a.last_used ?? a.created_at) - tijd(b.last_used ?? b.created_at) || a.id - b.id,
      ).reverse();
    } else if (k.includes("order by id desc")) {
      rijen = [...rijen].sort((a, b) => b.id - a.id);
    }
    const grens = /limit (\d+)/.exec(k);
    if (grens) rijen = rijen.slice(0, Number(grens[1]));
    return Promise.resolve({ rows: rijen as unknown as Record<string, unknown>[], rowCount: rijen.length });
  }

  return Promise.resolve(leeg);
}

// De echte database-module vervangen vóórdat het onderdeel geladen wordt. Daarom
// staat hier `require` en geen `import`: een import zou al gedraaid zijn.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require("module");
const origineel = Module._load;
Module._load = function (naam: string, ...rest: unknown[]) {
  if (naam === "@vercel/postgres") return { sql: nepSql };
  return origineel.call(this, naam, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const kv = require("../lib/claude-view-key") as typeof import("../lib/claude-view-key");

async function draai() {
  // ── 1. Een verse sleutel opent de deur, meteen ──
  const eerste = await kv.createViewKey();
  const meteen = await kv.checkViewKey(eerste);
  proef(
    "een net aangemaakte sleutel wordt meteen geaccepteerd",
    meteen.ok,
    `kreeg: ${JSON.stringify(meteen)}`,
  );

  // ── 2. Ook met de bovengrens vol aan gestempelde sleutels ──
  // Dit is precies de stand waarin het op 26-08-2026 misging: MAX_ACTIEF
  // sleutels die allemaal al eens gebruikt zijn. De verse sleutel heeft nog geen
  // stempel en mag daar niet door verdrongen worden.
  for (let i = 0; i < kv.MAX_ACTIEF; i++) {
    const s = await kv.createViewKey();
    await kv.checkViewKey(s); // stempelt "laatst gebruikt"
  }
  const verse = await kv.createViewKey();
  const nogSteeds = await kv.checkViewKey(verse);
  proef(
    "een verse sleutel wint van twaalf gestempelde sleutels",
    nogSteeds.ok,
    "De bovengrens heeft de nieuwe sleutel ingetrokken op het moment dat hij werd\n" +
      "     | uitgedeeld. Dat is de fout van 26-08-2026: sorteren op 'laatst gebruikt'\n" +
      "     | zet een sleutel van één seconde oud achteraan.\n" +
      `     | kreeg: ${JSON.stringify(nogSteeds)}`,
  );

  // ── 3. De bovengrens doet nog steeds zijn werk ──
  const geldig = await kv.getActiveKeys();
  proef(
    `er zijn nooit meer dan ${kv.MAX_ACTIEF} geldige sleutels tegelijk`,
    geldig.length <= kv.MAX_ACTIEF,
    `er staan er ${geldig.length} open`,
  );

  // ── 4. Een sleutel die er al was blijft werken ──
  // De les van 15-08-2026: een nieuwe maken mag nooit de sleutel breken die al
  // in een Claude-omgeving geplakt staat.
  const oud = await kv.createViewKey();
  await kv.checkViewKey(oud);
  await kv.createViewKey();
  const oudNog = await kv.checkViewKey(oud);
  proef("een bestaande, gebruikte sleutel blijft geldig na een nieuwe", oudNog.ok);

  // ── 5. Wat níet mag werken, werkt ook niet ──
  const mis = await kv.checkViewKey("pw-kijk-ditisnietdejuistesleutel");
  proef("een verzonnen sleutel wordt geweigerd", !mis.ok && mis.reden === "andere-sleutel");
  const niets = await kv.checkViewKey("");
  proef("een lege sleutel wordt geweigerd", !niets.ok && niets.reden === "leeg");

  // ── 6. Intrekken sluit de deur echt ──
  const laatste = await kv.createViewKey();
  await kv.revokeViewKey();
  const na = await kv.checkViewKey(laatste);
  proef("na intrekken komt niemand er meer in", !na.ok && na.reden === "geen-sleutel");

  // ── 7. Het rekenwerk zelf, los ──
  const rijen = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, last_used: new Date(2026, 0, i + 1) }));
  rijen.push({ id: 99, last_used: null as unknown as Date }); // de verse sleutel
  const weg = kv.vervallenSleutels(rijen, 99, 12);
  proef("de nieuwe sleutel valt nooit af", !weg.includes(99));
  proef("er blijven er precies twaalf over", 21 - weg.length === 12, `er blijven er ${21 - weg.length} over`);
  proef(
    "de sleutels die het langst niet gebruikt zijn vallen af",
    weg.includes(1) && weg.includes(9) && !weg.includes(20),
    `viel af: ${weg.join(", ")}`,
  );

  // ── 8. De knop deelt nooit een sleutel uit die niet werkt ──
  // Dit is de echte fout van 26-08-2026: de rij kwam binnen als al ingetrokken,
  // dus de controle zag hem nooit. Het aanmaken lukte, de sleutel was dood, en
  // op het scherm was daar niets van te zien. createViewKey haalt zijn eigen
  // sleutel nu eerst door dezelfde deur en zet hem recht; lukt dat niet, dan
  // gooit hij. Wat er níét meer mag gebeuren is dat er een sleutel uitkomt die
  // de controle weigert.
  standaardIngetrokken = true;
  let uitkomst = "";
  try {
    const s = await kv.createViewKey();
    uitkomst = (await kv.checkViewKey(s)).ok ? "werkende sleutel" : "DODE SLEUTEL";
  } catch {
    uitkomst = "eerlijke fout";
  }
  standaardIngetrokken = false;
  proef(
    "een rij die als ingetrokken binnenkomt levert nooit een dode sleutel op",
    uitkomst !== "DODE SLEUTEL",
    "createViewKey gaf een sleutel terug die de controle daarna weigert. Dat is\n" +
      "     | precies wat Maarten op 26-08-2026 in handen kreeg: plakken, 'andere-sleutel',\n" +
      "     | nog een maken, en zo door.",
  );
  proef("en hij zet hem het liefst gewoon recht", uitkomst === "werkende sleutel", `kreeg: ${uitkomst}`);

  console.log(fouten === 0 ? "\nAlles goed.\n" : `\n${fouten} fout(en).\n`);
  if (fouten) process.exit(1);
}

void draai();

// Dit bestand is een module (geen los script), zodat zijn hulpnamen niet botsen
// met die van een andere proef. Zonder dit ziet TypeScript ze als globale namen.
export {};

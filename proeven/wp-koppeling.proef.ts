// ═══════════════════════════════════════════════════════════
// ÉÉN WORDPRESS-KOPPELING: ÉÉN OPSLAG, ÉÉN FORMULIER, ALTIJD GETEST
// ═══════════════════════════════════════════════════════════
// Op 21-08-2026 bleek het applicatiewachtwoord van een klantsite op twee plekken
// te leven, met twee formulieren en twee opslagen:
//   * het tabblad Wijzigingen schreef naar de tabel `client_wp_creds`, en testte
//     eerst bij WordPress of de gegevens klopten;
//   * het tabblad Meta & CTR schreef naar `clients.wp_user` en
//     `clients.wp_app_pass_enc`, zonder test.
// Bij GardenSwimm gaf dat twee waarheden tegelijk: "WordPress is gekoppeld" op
// het ene scherm (mét opgehaalde bewerkingshistorie) en "De site weigert de
// koppeling" op het andere. Maartens woorden: "ik snap niet waarom die het hier
// niet doet, want de site is gekoppeld".
//
// Dat is precies de vaste les van deze repo: dezelfde regel op twee plekken
// uitschrijven loopt uit elkaar zonder dat iemand het merkt. Deze proef houdt de
// samenvoeging op zijn plek, want zonder poort komt de tweede kopie terug.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WORTEL = join(__dirname, "..");

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

function alleBestanden(map: string, uit: string[] = []): string[] {
  for (const naam of readdirSync(map, { withFileTypes: true })) {
    const pad = join(map, naam.name);
    if (naam.isDirectory()) alleBestanden(pad, uit);
    else if (/\.tsx?$/.test(naam.name)) uit.push(pad);
  }
  return uit;
}

const bestanden = [...alleBestanden(join(WORTEL, "app")), ...alleBestanden(join(WORTEL, "lib"))];

// ── 1. Eén opslag ───────────────────────────────────────────────────────────
// Alleen lib/wp-creds.ts mag de kolommen en de oude tabel aanraken.
const SCHRIJFT_KOLOM = /(UPDATE\s+clients\s+SET[^`]*wp_app_pass_enc|INSERT\s+INTO\s+client_wp_creds)/i;
const schrijvers = bestanden.filter((p) => {
  const rel = p.slice(WORTEL.length + 1);
  if (rel === "lib/wp-creds.ts") return false;
  return SCHRIJFT_KOLOM.test(readFileSync(p, "utf8"));
}).map((p) => p.slice(WORTEL.length + 1));
proef(
  "alleen lib/wp-creds.ts schrijft de koppeling weg",
  schrijvers.length === 0,
  schrijvers.length ? `Deze schrijven er zelf naartoe: ${schrijvers.join(", ")}. Gebruik bewaarKoppeling() uit lib/wp-creds.ts.` : "",
);

// ── 2. Bewaren gaat altijd langs de test ────────────────────────────────────
for (const route of ["app/api/admin/wp-creds/route.ts", "app/api/admin/wp-koppeling/route.ts"]) {
  const inhoud = readFileSync(join(WORTEL, route), "utf8");
  proef(
    `${route.split("/").slice(-2)[0]} bewaart via de gedeelde, testende ingang`,
    inhoud.includes("bewaarKoppeling("),
    "Zonder de test kan er een wachtwoord in dat WordPress weigert, terwijl het dashboard 'gekoppeld' blijft melden.",
  );
}
{
  const creds = readFileSync(join(WORTEL, "lib", "wp-creds.ts"), "utf8");
  proef(
    "de gedeelde ingang test écht bij WordPress",
    creds.includes("testWordpressAuth("),
    "bewaarKoppeling hoort de gegevens eerst bij de site te controleren.",
  );
  proef(
    "de oude, platte opslag wordt overgezet en niet meer gevuld",
    creds.includes("zetOudeOpslagOver") && !/INSERT\s+INTO\s+client_wp_creds/i.test(creds),
    "De rijen uit client_wp_creds horen naar de versleutelde opslag te verhuizen; er mag niets meer bij komen.",
  );
}

// ── 3. Eén formulier ────────────────────────────────────────────────────────
// Een tweede invulveld voor hetzelfde wachtwoord is hoe dit uit elkaar liep.
const FORMULIER = /placeholder="[^"]*xxxx xxxx|aria-label="WordPress[^"]*wachtwoord|pw_site_apptoken/i;
const formulieren = bestanden.filter((p) => {
  const rel = p.slice(WORTEL.length + 1);
  if (rel === "app/admin/client/[slug]/WpKoppeling.tsx") return false;
  return FORMULIER.test(readFileSync(p, "utf8"));
}).map((p) => p.slice(WORTEL.length + 1));
proef(
  "er is maar één invulformulier voor het applicatiewachtwoord",
  formulieren.length === 0,
  formulieren.length ? `Ook hier staat er een: ${formulieren.join(", ")}. Zet WpKoppeling.tsx neer in plaats van een eigen formulier.` : "",
);

// ── 4. En het staat waar je tegen het probleem aanloopt ─────────────────────
{
  const meta = readFileSync(join(WORTEL, "app/admin/client/[slug]/MetaCtrPanel.tsx"), "utf8");
  proef(
    "Meta & CTR toont het formulier zodra de site de koppeling weigert",
    meta.includes("<WpKoppeling") && meta.includes("probleem="),
    "Precies dáár liep Maarten vast; dan hoort het invullen niet achter een knop te zitten die als status leest.",
  );
  const wijz = readFileSync(join(WORTEL, "app/admin/client/[slug]/WijzigingenPanel.tsx"), "utf8");
  proef("het tabblad Wijzigingen gebruikt hetzelfde formulier", wijz.includes("<WpKoppeling"));
}

console.log(fouten ? `\n${fouten} fout(en).` : "\nAlles goed.");
if (fouten) process.exit(1);

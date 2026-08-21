// ═══════════════════════════════════════════════════════════
// EEN FOUTMELDING WIJST NAAR IETS DAT JE KUNT KRIJGEN
// ═══════════════════════════════════════════════════════════
// Rank Math bewaart de SEO-titel en de meta-omschrijving als post meta, maar
// meldt die velden niet aan bij de WordPress-API. De site accepteert onze
// wijziging dus met een "gelukt" en gooit hem daarna weg. Het dashboard leest het
// veld terug en ziet dat, en dát deel klopte.
//
// Wat niet klopte (21-08-2026): de melding zei "laat het Pingwin-snippet op de
// site installeren", en dat snippet bestond nergens in deze repo. Maarten kreeg
// dus een opdracht die hij niet kón uitvoeren. Nu is het er, met de instructie
// erbij, op het scherm waar je vastloopt.
//
// Deze proef bewaakt twee dingen die stilletjes kunnen wegdrijven: dat de velden
// in het bestand dezelfde zijn als de velden die het dashboard wegschrijft, en
// dat de melding blijft verwijzen naar iets dat er echt is.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SNIPPET_BESTAND, WP_SNIPPET, snippetInstructie } from "../lib/wp-snippet";

const WORTEL = join(__dirname, "..");

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const push = readFileSync(join(WORTEL, "lib", "wp-push.ts"), "utf8");

// ── 1. Het bestand doet waar het voor is ────────────────────────────────────
proef("het bestand is een WordPress-plugin", /^<\?php/.test(WP_SNIPPET) && WP_SNIPPET.includes("Plugin Name:"), WP_SNIPPET.slice(0, 80));
proef("het meldt de velden aan bij de API", WP_SNIPPET.includes("register_post_meta") && WP_SNIPPET.includes("'show_in_rest'      => true"));
proef(
  "en niet zonder rechtencontrole",
  WP_SNIPPET.includes("auth_callback") && WP_SNIPPET.includes("current_user_can"),
  "Zonder auth_callback mag iedereen met API-toegang die velden schrijven.",
);
proef("het heet .php, want zo moet het op de site landen", SNIPPET_BESTAND.endsWith(".php"));

// ── 2. De velden lopen niet weg van wat het dashboard schrijft ──────────────
// Komt er ooit een derde plugin bij in META_VELDEN, dan moet het bestand mee.
// Anders krijgt de sitebouwer een bestand dat het probleem niet oplost.
const velden = [...push.matchAll(/(?:title|desc):\s*"([a-z_]+)"/g)].map((m) => m[1]);
proef("de velden in wp-push.ts zijn gevonden", velden.length >= 4, velden.join(", "));
const ontbreekt = velden.filter((v) => !WP_SNIPPET.includes(v));
proef(
  "elk veld dat het dashboard schrijft, staat ook in het bestand",
  ontbreekt.length === 0,
  ontbreekt.length ? `Deze staan er niet in: ${ontbreekt.join(", ")}. Vul lib/wp-snippet.ts aan.` : "",
);

// ── 3. De melding verwijst naar iets dat bestaat ────────────────────────────
proef(
  "de melding stuurt je niet meer naar een snippet dat nergens te krijgen is",
  !/vraag Maarten of de sitebouwer/.test(push),
  "Een melding hoort te wijzen naar de knop die het oplost, niet naar een verzoek.",
);
proef(
  "de melding wijst naar de uitleg op het scherm",
  push.includes("Uitleg voor de sitebouwer"),
);

// ── 4. En die uitleg staat er echt, met het bestand erbij ───────────────────
const meta = readFileSync(join(WORTEL, "app/admin/client/[slug]/MetaCtrPanel.tsx"), "utf8");
proef("het meta-scherm toont de uitleg zodra de site het veld niet bewaart", meta.includes("<WpSnippet"));
proef("het bestand is op te halen", !!readFileSync(join(WORTEL, "app/api/admin/wp-snippet/route.ts"), "utf8").includes("WP_SNIPPET"));

// ── 5. De instructie is er één, en compleet ─────────────────────────────────
const instructie = snippetInstructie("voorbeeld.nl");
for (const moet of ["mu-plugins", "Code Snippets", "register_post_meta", "voorbeeld.nl", SNIPPET_BESTAND]) {
  proef(`de instructie noemt ${moet}`, instructie.includes(moet));
}
proef(
  "de instructie zegt hoe je het terugdraait",
  /TERUGDRAAIEN/i.test(instructie),
  "Een sitebouwer plaatst niets zonder te weten hoe het er weer af gaat.",
);

// ── 6. Er is nog een uitweg vóór de sitebouwer ──────────────────────────────
// Rank Math schrijft in zijn eigen editor via een eigen route. Werkt die, dan is
// er niets te installeren. De uitkomst wordt aan de pagina zelf gevraagd, want
// via de API valt dat veld juist niet terug te lezen.
proef("de eigen route van Rank Math wordt eerst geprobeerd", push.includes("rankmath/v1") && push.includes("updateMeta"));
proef(
  "en de uitkomst daarvan wordt op de pagina zelf nagekeken",
  push.includes("staatHetErOpDePagina"),
  "Zonder die controle zou een route die 'ok' zegt en niets doet, als gelukt gelden.",
);

console.log(fouten ? `\n${fouten} fout(en).` : "\nAlles goed.");
if (fouten) process.exit(1);

// ═══════════════════════════════════════════════════════════
// DOORZETTEN NAAR DE DEVELOPER: LEESBAAR, ÉÉN VERHAAL, EN TE OPENEN
// ═══════════════════════════════════════════════════════════
// Wat Maarten op 21-08-2026 in beeld had, in drie schermen:
//
//  1. In het taakvenster van de developer stond de opdracht als één blok tekst
//     van acht regels aan elkaar, met twee volledige webadressen erin. "Een brei
//     aan woorden en letters die niemand wil lezen of kan lezen." Oorzaak: de
//     tekst was platte tekst met regeleindes, en het rijke tekstveld zette hem
//     als HTML in beeld; daar bestaat een regeleinde niet.
//  2. In diezelfde tekst stond een zin met een label als onderwerp: "het
//     organisatie-schema dat handmatig/onbekend al op de homepage zet".
//  3. In het mailvenster stond een link naar /admin/developer, en dat scherm zit
//     achter een inlog: voor een externe sitebouwer een deur die niet opengaat.
//
// Alle drie zijn het soort fout dat terugkomt zodra iemand haast heeft, want ze
// zien er in de code onschuldig uit. Vandaar deze proef.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { netteHtml } from "../lib/nette-html";
import { plaatsingsZin, sitewideMailHtml, sitewideToelichting } from "../lib/structured-taak";
import { kaartLinks, linkNaam } from "../lib/kaart-links";
import { bronUitNaam, docLabel, zelfdeBestand } from "../lib/doc-naam";

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf8");

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

// ── 1. De opdracht is leesbaar in beeld ──────────────────────────────────────
const JSON_LINK = "https://drive.google.com/file/d/1KMCBBn4LHmuFhHBaecRZDNZJ3-cB0F84/view?usp=sharing";
const DEV_URL = "https://pingwin-seo-dashboard.vercel.app/share/org-dev/xOZkxuMVTKVBiNnL78fxpF69";
const tekst = sitewideToelichting(
  { jsonLink: JSON_LINK, devUrl: DEV_URL },
  { pluginLabel: "handmatig/onbekend", gekoppeld: true, anchorId: "https://bogard.eu/#organization" },
);
const html = netteHtml(tekst);

proef("de opdracht wordt een opsomming, geen lap tekst", /<ul>\s*<li>/.test(html), html);
proef("er staat vette tekst in plaats van hoofdletterwoorden", /<strong>/.test(html) && !/AANVULLEND/.test(tekst), tekst);
proef("de links heten naar wat ze zijn", /<a href="[^"]+"[^>]*>De code als JSON-bestand<\/a>/.test(html), html);
proef(
  "er staat geen kaal webadres als linktekst",
  !/>https?:\/\/[^<]{40,}</.test(html),
  "Een adres van tachtig tekens als linktekst is precies wat het venster uit elkaar duwde.",
);
proef("er blijft geen ruw opmaakteken staan", !/(^|>)[^<]*(\*\*|\[[^\]]+\]\()/.test(html), html);

// ── 2. Geen label als onderwerp van een zin ──────────────────────────────────
const gevallen = [
  { pluginLabel: "handmatig/onbekend", gekoppeld: true, anchorId: "https://x.nl/#organization" },
  { pluginLabel: "handmatig/onbekend", gekoppeld: false },
  { pluginLabel: "Yoast SEO", gekoppeld: true, anchorId: "https://x.nl/#/schema/organization" },
  { pluginLabel: "Yoast SEO", gekoppeld: false },
  { pluginLabel: "geen", gekoppeld: false },
];
for (const g of gevallen) {
  const zin = plaatsingsZin(g);
  proef(
    `de zin over plaatsen klopt bij "${g.pluginLabel}"${g.gekoppeld ? " (gekoppeld)" : ""}`,
    !/handmatig\/onbekend/.test(zin) && !/\bgeen al\b|dat geen /.test(zin) && zin.trim().length > 40,
    zin,
  );
}
proef(
  "een echte plugin wordt wél bij naam genoemd",
  /Yoast SEO/.test(plaatsingsZin({ pluginLabel: "Yoast SEO", gekoppeld: true, anchorId: "https://x.nl/#org" })),
);

// ── 3. Eén bron voor die tekst ───────────────────────────────────────────────
const route = lees("app/api/admin/org-data/sitewide/route.ts");
const paneel = lees("app/admin/client/[slug]/OrgDataPanel.tsx");
proef("de taak leest de tekst uit de gedeelde bron", /sitewideToelichting\(/.test(route), "lib/structured-taak.ts");
proef("de mail leest dezelfde bron", /sitewideMailHtml\(/.test(paneel), "lib/structured-taak.ts");
proef(
  "het paneel schrijft de mailtekst niet zelf nog een keer uit",
  !/staat de structured data klaar/.test(paneel),
  "De mailtekst hoort alleen in lib/structured-taak.ts te staan; twee kopieën lopen uit elkaar.",
);

// ── 4. Alles wat meegaat, kan de developer ook openen ────────────────────────
const mail = sitewideMailHtml("Bogard", { jsonLink: JSON_LINK, devUrl: DEV_URL });
proef(
  "de mail stuurt hem niet naar een scherm achter de inlog",
  !/\/admin\//.test(mail),
  "/admin/developer vraagt een teamlogin; voor een externe sitebouwer gaat die deur niet open.",
);
proef("de mail bevat het JSON-bestand", mail.includes(JSON_LINK));
proef("de mail bevat de deelbare overzichtspagina", mail.includes(DEV_URL));
proef(
  "het venster laat zien of het bestand echt gedeeld is",
  /gedeeld/.test(route) && /devGedeeld/.test(paneel),
  "uploadPlainFile geeft terug of Drive het op 'iedereen met de link' kon zetten; dat hoort in beeld vóór de mail weggaat.",
);
proef(
  "de deelpagina zegt hetzelfde als de taak en de mail",
  /plaatsingsZin\(/.test(lees("app/share/org-dev/[token]/OrgDevShareClient.tsx")),
  "Daar stond een eigen versie van die zin, met hetzelfde label-in-de-zin-probleem.",
);
proef(
  "de deelbare pagina blijft zonder inlog te lezen",
  !/verifyAdminSession|ADMIN_COOKIE/.test(lees("app/api/share/org-dev/route.ts")),
  "Deze pagina ís het antwoord op 'kan de developer erbij'; zet er nooit een inlog voor.",
);

// ── 5. Een link in een taak heet naar waar hij heen gaat ─────────────────────
const links = kaartLinks(sitewideToelichting({ jsonLink: JSON_LINK, devUrl: DEV_URL }, { pluginLabel: "geen", gekoppeld: false }));
proef(
  "een markdown-link houdt zijn naam",
  links.some((l) => l.url === JSON_LINK && l.label === "De code als JSON-bestand"),
  JSON.stringify(links),
);
proef("een kaal Drive-adres krijgt alsnog een naam", linkNaam(JSON_LINK) === "Bestand in Google Drive", linkNaam(JSON_LINK));
proef("een deel-link krijgt alsnog een naam", /deelbare link/.test(linkNaam(DEV_URL)), linkNaam(DEV_URL));
proef(
  "geen enkel label is nog een adres van tachtig tekens",
  links.every((l) => l.label.length < 60),
  JSON.stringify(links.map((l) => l.label)),
);

// ── 6. Documentnamen in een lijst ────────────────────────────────────────────
const LANG = 'Geldende versie na verwerken van "Bogard_Structured-Data_Advies-en-Inventarisatie v2.docx"';
proef("de zin eromheen valt weg", docLabel(LANG).toon === "Bogard_Structured-Data_Advies-en-Inventarisatie v2.docx", docLabel(LANG).toon);
proef("er komt een merkje voor in de plaats", docLabel(LANG).merk === "verwerkte kopie");
proef("een gewone naam blijft precies zoals hij is", docLabel("Copy hovenier Etten-Leur.docx").toon === "Copy hovenier Etten-Leur.docx");
proef("een gewone naam krijgt geen merkje", docLabel("Copy hovenier Etten-Leur.docx").merk === "");
proef(
  "een naam wordt nooit afgekapt met puntjes",
  !docLabel(LANG).toon.includes("…"),
  "Afkappen is op 19-08-2026 bewust teruggedraaid: dan lezen twee documenten hetzelfde.",
);
proef("de bron uit de naam wordt herkend", bronUitNaam(LANG).startsWith("Bogard_Structured-Data"));
proef("een extensie telt niet mee bij het koppelen", zelfdeBestand("Advies v2.docx", "Advies v2"));
proef("twee verschillende stukken worden niet gekoppeld", !zelfdeBestand("Advies v2.docx", "Advies v3.docx"));

const docversies = lees("app/admin/client/[slug]/DocVersies.tsx");
proef(
  "de lijst gebruikt die naamregel",
  /docLabel\(/.test(docversies) && /bronUitNaam\(/.test(docversies),
  "Anders staat de zin van vier regels er zo weer.",
);
proef(
  "de volledige naam blijft zichtbaar",
  /title=\{`\$\{v\.naam/.test(docversies),
  "De echte naam hoort in de tooltip te staan; hij is de naam van een bestand in Drive.",
);
proef(
  "structured data krijgt geen SEO-criteria-toets",
  /v\.source === "klant" && v\.kind !== "structured"/.test(docversies),
  "Een inventarisatie van bedrijfsgegevens langs de criteria voor een landingspagina leggen levert een oordeel op dat nergens over gaat.",
);
proef(
  "bij structured data staat wat geldt en wat de developer krijgt",
  /wp-doc-uitleg/.test(docversies) && /share\/org-dev/.test(docversies),
  "Zonder die regel open je een Word-document terwijl je een JSON-bestand zoekt.",
);

// ── 7. Het rijke tekstveld en het mailveld ───────────────────────────────────
const veld = lees("app/_velden/RijkTekstVeld.tsx");
proef(
  "het rijke tekstveld zet platte tekst door de gedeelde poort",
  /bevatHtmlOpmaak\(/.test(veld) && /netteHtml\(/.test(veld),
  "Zonder dit plakt de tekst van een doorgezette taak aan elkaar tot één blok.",
);
proef(
  "opgemaakte inhoud gaat ongemoeid naar binnen",
  /bevatHtmlOpmaak\(waarde \|\| ""\) \? \(waarde \|\| ""\)/.test(veld),
  "De eigen HTML van het veld (uitklappers, vinklijstjes, beelden) mag nooit opnieuw gerenderd worden.",
);
const css = lees("app/globals.css");
proef(
  "de mail heeft geen eigen schuifbalk in het venster",
  /\.compose-rich \.klant-pop-editor \{[^}]*max-height: none/.test(css),
  "Met een eigen hoogtegrens scrol je eerst in de mail en daarna in het venster.",
);

console.log(fouten === 0
  ? "\nWat naar de developer gaat, is leesbaar en te openen."
  : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);

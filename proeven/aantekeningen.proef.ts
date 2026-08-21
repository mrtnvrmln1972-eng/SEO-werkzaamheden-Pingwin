// Proef op de drie dingen die op 21-08-2026 aan de aantekeningen bij een taak
// zijn toegevoegd of gerepareerd.
//
// WAAROM DIT BESTAAT
// ══════════════════
// 1. INSPRINGEN. Een punt onder een punt, met Tab. Dat is geen opmaakje maar een
//    verhuizing in de boom: een lijstregel gaat in een échte lijst binnen de
//    regel erboven, want alleen dan telt een genummerde lijst binnenin weer
//    vanaf 1 en krijgt een opsomming een ander bolletje. Bij zo'n verhuizing kan
//    inhoud kwijtraken, en precies dát is met dit veld al twee keer gebeurd
//    (Kamsteeg 11-08, Paul Hoevenaars 14-08). Dus: elke stap wordt hier nageteld
//    op woorden, niet op code.
//
// 2. EEN BEELD IN DE TEKST. Een gesleepte screendump staat in de tekst als kort
//    adres naar de server. Twee dingen mogen nooit veranderen: het herstellen
//    van de vorm mag hem niet opeten, en plakken mag alleen ONS eigen beeld
//    doorlaten. Een plaatje van een vreemde site zou een adres worden dat morgen
//    weg kan zijn, en dan staat er een kapot vak in je aantekening.
//
// 3. DE BEWAAR-STAND ALS STIPJE. Hier stond "bewaren…", dan "bewaard", dan weer
//    niets, in de knoppenbalk. Die balk is een omslaande rij die precies vol
//    staat, dus dat woord duwde hem naar twee regels en het tekstvak eronder
//    sprong 29 pixels op en neer, elke keer dat je even ophield met typen.
//    Gemeten in een echte browser op 21-08-2026: balk 32px zonder, 61px met.
//    Maartens woorden: "verspringt dat hele venster de hele tijd". Een woord dat
//    komt en gaat hoort daar dus niet meer, en dat is wat hieronder nagerekend
//    wordt.
//
// Draait bij élke bouw (`prebuild`), dus ook op Vercel.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import {
  beeldHtml,
  diepteVan,
  herstelStructuur,
  springIn,
  springUit,
  KL_BEELD,
  KL_CHECK_ITEM,
} from "../lib/rijke-tekst";
import { cleanPastedHtml } from "../lib/rich-paste";

const WORTEL = join(__dirname, "..");

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

// Het opschonen van geplakte tekst draait in de browser en gebruikt daar
// `DOMParser` en `Node`; die worden hier nagebouwd, zodat deze proef de échte
// uitkomst nakijkt in plaats van naar de code te turen. Zelfde omweg als in
// proeven/geplakte-opmaak.proef.ts: de eigen DOMParser van linkedom doet raar
// met losse fragmenten.
const basis = parseHTML("<html><body></body></html>");
const document = basis.document;
(globalThis as unknown as { document: unknown }).document = document;
(globalThis as unknown as { Node: unknown }).Node = basis.Node;
(globalThis as unknown as { DOMParser: unknown }).DOMParser = class {
  parseFromString(html: string) {
    return parseHTML(`<html><body>${html}</body></html>`).document;
  }
};

function veldMet(html: string) {
  const veld = document.createElement("div");
  veld.innerHTML = html;
  document.body.appendChild(veld);
  return veld as unknown as HTMLElement;
}
function woorden(el: HTMLElement): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

// ── 1. Inspringen in een opsomming ───────────────────────────────────────────
{
  const veld = veldMet("<ul><li>Tony</li><li>Marijke</li><li>Leonie</li></ul>");
  const voor = woorden(veld);
  const tweede = veld.querySelectorAll("li")[1] as unknown as HTMLElement;
  check("een tweede regel springt in", springIn(tweede));
  check("hij hangt nu ónder de regel erboven",
    !!veld.querySelector("li > ul > li"), veld.innerHTML);
  check("de regel erboven is nog steeds die van Tony",
    (veld.querySelector("li")?.textContent || "").startsWith("Tony"), veld.innerHTML);
  check("er is geen woord kwijt", woorden(veld) === voor, `${voor}\n       ${woorden(veld)}`);

  // De derde regel gaat er onder aansluiten in dezelfde sublijst, niet in een
  // tweede lijstje ernaast: anders staan twee bolletjes met een gat ertussen.
  const buitenlijst = veld.firstElementChild as unknown as HTMLElement;
  const derde = buitenlijst.children[1] as HTMLElement;
  springIn(derde);
  check("een volgende regel sluit aan in dezelfde sublijst",
    veld.querySelectorAll("li > ul").length === 1 && veld.querySelectorAll("li > ul > li").length === 2,
    veld.innerHTML);

  check("terug naar buiten lukt", springUit(veld.querySelectorAll("li > ul > li")[0] as unknown as HTMLElement));
  check("en dan is er nog steeds geen woord kwijt", woorden(veld) === voor, woorden(veld));
}

// ── 2. De eerste regel van een lijst kan nergens onder hangen ────────────────
{
  const veld = veldMet("<ul><li>Tony</li><li>Marijke</li></ul>");
  check("de eerste regel springt niet in",
    !springIn(veld.querySelector("li") as unknown as HTMLElement),
    veld.innerHTML);
  check("een regel op het hoogste niveau springt niet verder uit",
    !springUit(veld.querySelector("li") as unknown as HTMLElement));
}

// ── 3. Wat onder een regel hangt, blijft eronder hangen ─────────────────────
// Shift+Tab op een middelste punt mag de punten daarónder niet stilletjes een
// niveau omhoog trekken; die horen bij dit punt, niet bij de regel erboven.
{
  const veld = veldMet("<ol><li>Kop<ol><li>een</li><li>twee</li><li>drie</li></ol></li></ol>");
  const voor = woorden(veld);
  const tweede = veld.querySelectorAll("li li")[1] as unknown as HTMLElement;
  springUit(tweede);
  const buiten = veld.firstElementChild as unknown as HTMLElement;
  check("het punt staat nu naast de kop", buiten.children.length === 2, veld.innerHTML);
  check("en 'drie' hangt er nu onder, niet onder 'Kop'",
    (buiten.children[1]?.querySelector("ol")?.textContent || "").includes("drie"), veld.innerHTML);
  check("er is niets kwijt", woorden(veld) === voor, `${voor}\n       ${woorden(veld)}`);
}

// ── 4. Inspringen in een vinklijst ──────────────────────────────────────────
// Een vinklijst is geen lijst maar een rij losse blokjes (zie de uitleg bij
// haalVinkpuntenUitLijsten), dus die springt in met een niveau in plaats van
// met nesten. Het niveau moet wel een echte trap blijven: geen punt dat drie
// stappen inspringt onder een punt dat er nul doet.
{
  const item = (t: string) => `<div class="${KL_CHECK_ITEM}"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label><span class="rtv-check-tekst">${t}</span></div>`;
  const veld = veldMet(item("Tony") + item("Marijke"));
  const voor = woorden(veld);
  const tweede = veld.querySelectorAll(`.${KL_CHECK_ITEM}`)[1] as unknown as HTMLElement;
  check("het eerste vinkpunt springt niet in",
    !springIn(veld.querySelector(`.${KL_CHECK_ITEM}`) as unknown as HTMLElement));
  check("het tweede vinkpunt wel", springIn(tweede));
  check("en staat één niveau dieper", diepteVan(tweede) === 1, veld.innerHTML);
  check("een niveau overslaan kan niet", !springIn(tweede) || diepteVan(tweede) === 2);
  check("terug naar buiten lukt", springUit(tweede) && diepteVan(tweede) < 2);
  check("herstellen laat het niveau staan",
    (herstelStructuur(veld), veld.querySelectorAll(`.${KL_CHECK_ITEM}`).length === 2),
    veld.innerHTML);
  check("en er is geen woord kwijt", woorden(veld) === voor, woorden(veld));
}

// ── 5. Een beeld overleeft het herstellen ───────────────────────────────────
{
  const veld = veldMet("<p>voor</p>" + beeldHtml("/api/admin/beeld/12", "schermafbeelding") + "<p>na</p>");
  herstelStructuur(veld);
  const img = veld.querySelector("img");
  check("het beeld staat er na het herstellen nog", !!img, veld.innerHTML);
  check("met zijn adres", img?.getAttribute("src") === "/api/admin/beeld/12", veld.innerHTML);
  check("en zijn klasse", !!img?.classList.contains(KL_BEELD), veld.innerHTML);
}

// ── 6. Plakken: ons eigen beeld blijft, dat van een vreemde niet ────────────
{
  const eigen = cleanPastedHtml('<p>zie <img src="https://pingwin-seo-dashboard.vercel.app/api/admin/beeld/7" alt="stand"></p>', { keepTables: true, rich: true });
  check("een geplakt beeld uit het dashboard zelf blijft staan", /<img[^>]+src="\/api\/admin\/beeld\/7"/.test(eigen), eigen);
  const vreemd = cleanPastedHtml('<p>zie <img src="https://ergensanders.nl/plaatje.png"></p>', { keepTables: true, rich: true });
  check("een beeld van buiten gaat eruit", !/<img/.test(vreemd), vreemd);
}

// ── 7. De bewaar-stand mag de knoppenbalk niet breder maken ────────────────
{
  const bron = readFileSync(join(WORTEL, "app/admin/client/[slug]/KaartNotitie.tsx"), "utf8");
  const css = readFileSync(join(WORTEL, "app/globals.css"), "utf8");
  check("de bewaar-stand is een stipje van vaste maat", bron.includes("wp-notitie-stip"),
    "Zonder het stipje komt er weer een woord in de knoppenbalk, en die slaat dan om naar twee regels.");
  check("het stipje heeft een vaste breedte in de opmaak", /\.wp-notitie-stip \{[^}]*width:/.test(css), "Zonder vaste breedte springt de balk alsnog.");
  check("er staat geen woord meer bij 'bezig' of 'bewaard'",
    !/stand === "bezig" && </.test(bron) && !/stand === "bewaard" && </.test(bron),
    "Een woord dat komt en gaat maakt de knoppenbalk breder; gebruik het stipje.");
}

// ── 8. Het bord tekent niet opnieuw bij elke bewaarde aantekening ──────────
// Dat was de tweede helft van hetzelfde verspringen: elke bewaaractie (om de
// 400 ms tijdens het typen) bouwde de hele takenlijst opnieuw op.
{
  const bron = readFileSync(join(WORTEL, "app/admin/client/[slug]/Planning.tsx"), "utf8");
  const fn = /function notitieBewaard\([^)]*\)\s*\{([\s\S]*?)\n  \}/.exec(bron);
  check("een bewaarde aantekening tekent het bord niet opnieuw",
    !!fn && !fn[1].includes("setTaken"),
    "Zet in notitieBewaard geen setTaken; de verse tekst gaat via metVerseNotitie mee bij het tekenen.");
  check("de verse tekst wordt wél meegegeven aan de kaart",
    bron.includes("metVerseNotitie(t) as unknown as WpTask"),
    "Anders komt een kaart die dichtklapt en weer opengaat terug met de oude aantekening.");
}

console.log(fouten ? `\n${fouten} fout(en).` : "\nAlles goed.");
if (fouten) process.exit(1);

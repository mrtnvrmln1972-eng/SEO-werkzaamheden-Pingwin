// Proef op het opmaakbare tekstveld: uitklappers, vinkpunten en slepen.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Dit veld (Zoekwoorden & links, Top Prio's, de bespreekpunten, de aantekeningen
// bij een taak) heeft twee keer inhoud gewist die niet terug te halen was:
// 11-08-2026 bij Kamsteeg en 14-08-2026 bij Paul Hoevenaars, allebei door een
// sleepactie. Beide keren is er daarna één regel in de code bijgezet, met een
// uitleg erboven. En allebei die regels dekten precies dat ene geval.
//
// Een tekstvak waarin je zelf blokken verschuift heeft te veel paden om ze stuk
// voor stuk dicht te timmeren. Daarom is de vorm nu één keer vastgelegd in
// `lib/rijke-tekst.ts`, met `herstelStructuur` als enige poortwachter, en trekt
// deze proef die na in een échte DOM (linkedom) in plaats van door naar de code
// te kijken.
//
// De harde regel die hier bewaakt wordt: HERSTELLEN MAG NOOIT INHOUD KOSTEN.
// Wat er aan tekst en links in gaat, komt er ook weer uit. Staat iets op een
// verkeerde plek, dan verhuist het; het verdwijnt niet.
//
// Draait bij élke bouw (`prebuild`), dus ook op Vercel.

import { parseHTML } from "linkedom";
import {
  blokVoorSlepen,
  checklistItemHtml,
  herstelStructuur,
  magSlepenNaar,
  regelsUitFragment,
  uitklapperHtml,
  verplaatsBlok,
  KL_CHECK_ITEM,
  KL_CHECK_TEKST,
  KL_VOUW_BODY,
} from "../lib/rijke-tekst";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const { document } = parseHTML("<html><body></body></html>");
(globalThis as unknown as { document: unknown }).document = document;

function veldMet(html: string) {
  const veld = document.createElement("div");
  veld.innerHTML = html;
  document.body.appendChild(veld);
  return veld as unknown as HTMLElement;
}

/** Alle woorden in het veld, in volgorde. Zo zien we of er iets kwijt is. */
function woorden(el: HTMLElement): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Elk stukje tekst dat in het veld staat, gesorteerd.
 *
 * Bewust niet als één lange string vergelijken: herstellen mag een blok
 * verplaatsen (dat is juist het punt) en mag een ontbrekend kopje aanvullen.
 * Wat het NIET mag, is een stukje tekst laten verdwijnen. Daarom is de test:
 * alles wat er voor het herstellen stond, staat er daarna nog steeds.
 */
function stukjes(el: HTMLElement): string[] {
  const uit: string[] = [];
  const loop = (knoop: Node) => {
    knoop.childNodes.forEach((kind) => {
      if (kind.nodeType === 3) {
        const t = (kind.textContent || "").replace(/\s+/g, " ").trim();
        if (t) uit.push(t);
        return;
      }
      loop(kind);
    });
  };
  loop(el);
  return uit.sort();
}

/** Staat elk stukje van "voor" ook nog in "na"? (dubbelen tellen apart mee) */
function nietsKwijt(voor: string[], na: string[]): boolean {
  const rest = [...na];
  for (const stuk of voor) {
    const i = rest.indexOf(stuk);
    if (i === -1) return false;
    rest.splice(i, 1);
  }
  return true;
}

/** Elke link die er in staat, als adres. Een link die tekst wordt is ook verlies. */
function links(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll("a")).map((a) => (a as HTMLAnchorElement).getAttribute("href") || "");
}

// ═══════════════════════════════════════════════════════════
// 1. HERSTELLEN KOST NOOIT INHOUD
// ═══════════════════════════════════════════════════════════
// Elk van deze stukken is een vorm die in de praktijk kan ontstaan: door een
// sleepactie, door plakken, door Backspace op de verkeerde plek, of doordat het
// veld ooit met oudere code gevuld is. Voor allemaal geldt hetzelfde: na het
// herstellen staat er geen woord minder en geen link minder.
const SCHEVE_INHOUD: Array<[string, string]> = [
  [
    "uitklapper zonder body (het geval Paul Hoevenaars)",
    `<details class="rtv-vouw" open><summary>SEO-strategie</summary><p>hovenier breda 300</p><p>hovenier zundert 150</p></details>`,
  ],
  [
    "uitklapper zonder kopje",
    `<details class="rtv-vouw" open><div class="rtv-vouw-body">losse inhoud</div></details>`,
  ],
  [
    "uitklapper met twee kopjes",
    `<details class="rtv-vouw" open><summary>Eerste</summary><summary>Tweede</summary><div class="rtv-vouw-body">inhoud</div></details>`,
  ],
  [
    "vinkpunten midden in een genummerde lijst",
    `<ol><li>eerste</li><div class="rtv-check-item"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label><span class="rtv-check-tekst"><a href="/hovenier/breda/">/hovenier/breda/</a></span></div><li>laatste</li></ol>`,
  ],
  [
    "vinkpunt in een lijstregel",
    `<ul><li>bovenaan<div class="rtv-check-item"><span class="rtv-check-tekst">verdwaald</span></div></li></ul>`,
  ],
  [
    "vinkpunt waarvan het vakje met Backspace is gewist",
    `<div class="rtv-check-item"><span class="rtv-check-tekst">/hovenier/etten-leur/</span></div>`,
  ],
  [
    "vinkpunt met losse tekst naast het vakje",
    `<div class="rtv-check-item"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label>voor<span class="rtv-check-tekst">midden</span>achter</div>`,
  ],
  [
    "vinkpunt in een vinkpunt",
    `<div class="rtv-check-item"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label><span class="rtv-check-tekst">buiten<div class="rtv-check-item"><span class="rtv-check-tekst">binnen</span></div></span></div>`,
  ],
  [
    "restje van een afgebroken sleepactie",
    `<p class="rtv-blok-sleept">halverwege blijven hangen</p>`,
  ],
  [
    "uitklapper in een uitklapper",
    `<details class="rtv-vouw" open><summary>Buiten</summary><div class="rtv-vouw-body"><details class="rtv-vouw" open><summary>Binnen</summary><p>diepe inhoud</p></details></div></details>`,
  ],
];

for (const [naam, html] of SCHEVE_INHOUD) {
  const veld = veldMet(html);
  const voorWoorden = stukjes(veld);
  const voorLinks = links(veld).sort();
  herstelStructuur(veld);
  const naWoorden = stukjes(veld);
  const naLinks = links(veld).sort();
  check(`geen woord kwijt: ${naam}`, nietsKwijt(voorWoorden, naWoorden), `voor: ${JSON.stringify(voorWoorden)}\n       na:   ${JSON.stringify(naWoorden)}`);
  check(`geen link kwijt: ${naam}`, JSON.stringify(voorLinks) === JSON.stringify(naLinks), `voor: ${voorLinks} na: ${naLinks}`);

  // Twee keer herstellen mag niets meer veranderen: anders blijft het veld bij
  // elke toetsaanslag aan zichzelf sleutelen en springt de cursor.
  const naEen = veld.innerHTML;
  const veranderdeNogEens = herstelStructuur(veld);
  check(`tweede ronde verandert niets: ${naam}`, !veranderdeNogEens && veld.innerHTML === naEen);
}

// ═══════════════════════════════════════════════════════════
// 2. DE VORM KLOPT NA HET HERSTELLEN
// ═══════════════════════════════════════════════════════════

{
  const veld = veldMet(`<details class="rtv-vouw" open><summary>Kop</summary><p>een</p><p>twee</p></details>`);
  herstelStructuur(veld);
  const body = veld.querySelector(`.${KL_VOUW_BODY}`);
  check("losse inhoud van een uitklapper komt in één body terecht", !!body && body.children.length === 2);
  check("het kopje staat vooraan", veld.querySelector("details")?.firstElementChild?.tagName === "SUMMARY");
}

{
  const veld = veldMet(`<ol><li>een</li><div class="rtv-check-item"><span class="rtv-check-tekst">tussenin</span></div><li>twee</li></ol>`);
  herstelStructuur(veld);
  check("een vinkpunt staat nooit meer in een lijst", veld.querySelectorAll(`ol .${KL_CHECK_ITEM}, ul .${KL_CHECK_ITEM}`).length === 0);
  check("de lijst wordt opgeknipt, dus de volgorde blijft", woorden(veld) === "eentussenintwee", woorden(veld));
}

{
  // Precies wat Chrome maakt als je twee regels van een genummerde lijst
  // selecteert en op "vinklijst" klikt: beide vinkpunten belanden in ÉÉN
  // lijstregel. Ze kwamen er toen in omgekeerde volgorde uit, omdat het vinkpunt
  // achter de hele lijstregel werd gezet in plaats van dat de regel werd
  // doorgeknipt. Vandaar dat dit een vaste proef is en geen losse waarneming.
  const veld = veldMet(
    `<p>begin</p><ol><li>`
    + `<div class="rtv-check-item"><span class="rtv-check-tekst">eerste</span></div>`
    + `<div class="rtv-check-item"><span class="rtv-check-tekst">tweede</span></div>`
    + `</li></ol>`
  );
  herstelStructuur(veld);
  check("twee vinkpunten uit één lijstregel houden hun volgorde",
    woorden(veld) === "begineerstetweede", woorden(veld));
  check("en er staat geen lege lijst meer omheen", veld.querySelectorAll("ol, li").length === 0, veld.innerHTML);
}

{
  const veld = veldMet(`<ol><li>een</li><li>twee</li><div class="rtv-check-item"><span class="rtv-check-tekst">punt</span></div><li>drie</li></ol>`);
  herstelStructuur(veld);
  const staart = veld.querySelectorAll("ol")[1];
  check("een genummerde lijst telt na de knip door in plaats van opnieuw",
    staart?.getAttribute("start") === "3", veld.innerHTML);
}

{
  const veld = veldMet(`<div class="rtv-check-item"><label contenteditable="false" class="rtv-check-box"><input type="checkbox" checked></label><span class="rtv-check-tekst">af</span></div>`);
  herstelStructuur(veld);
  const item = veld.querySelector(`.${KL_CHECK_ITEM}`)!;
  check("aangevinkt en doorgestreept zeggen hetzelfde", item.classList.contains("rtv-check-af"));
}

{
  const veld = veldMet(`<div class="rtv-check-item rtv-check-af"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label><span class="rtv-check-tekst">niet af</span></div>`);
  herstelStructuur(veld);
  const item = veld.querySelector(`.${KL_CHECK_ITEM}`)!;
  check("een doorstreping zonder vinkje wordt rechtgezet", !item.classList.contains("rtv-check-af"));
}

{
  const veld = veldMet(uitklapperHtml());
  herstelStructuur(veld);
  check("boven een uitklapper staat altijd een gewone regel", veld.firstElementChild?.tagName === "P");
  check("onder een uitklapper staat altijd een gewone regel", veld.lastElementChild?.tagName === "P");
}

{
  const veld = veldMet(checklistItemHtml("eerste punt"));
  herstelStructuur(veld);
  check("boven een vinkpunt staat altijd een gewone regel", veld.firstElementChild?.tagName === "P");
}

{
  const veld = veldMet(`<div class="rtv-check-item"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label><span class="rtv-check-tekst"><br></span></div>`);
  herstelStructuur(veld);
  const doos = veld.querySelector(".rtv-check-box")!;
  check("het vakje blijft onbewerkbaar", doos.getAttribute("contenteditable") === "false");
}

// ═══════════════════════════════════════════════════════════
// 3. WELK ONDERDEEL PAK JE BEET
// ═══════════════════════════════════════════════════════════

{
  const veld = veldMet(`<p>los</p><details class="rtv-vouw" open><summary>Kop</summary><div class="rtv-vouw-body"><p id="diep">diepe inhoud</p></div></details>`);
  const diep = veld.querySelector("#diep") as unknown as HTMLElement;
  const kop = veld.querySelector("summary") as unknown as HTMLElement;
  const details = veld.querySelector("details") as unknown as HTMLElement;
  check("een alinea in een uitklapper pak je als alinea beet", blokVoorSlepen(veld, diep) === diep);
  check("het kopje pakt de hele uitklapper beet", blokVoorSlepen(veld, kop) === details);
  check("de body van een uitklapper komt er nooit los uit",
    blokVoorSlepen(veld, veld.querySelector(`.${KL_VOUW_BODY}`) as unknown as HTMLElement) === details);

  const buiten = document.createElement("p");
  document.body.appendChild(buiten);
  check("iets buiten het tekstvak levert geen onderdeel op", blokVoorSlepen(veld, buiten as unknown as HTMLElement) === null);
  check("het tekstvak zelf is geen onderdeel", blokVoorSlepen(veld, veld) === null);
}

{
  const veld = veldMet(`<ul><li id="a">een</li><li id="b">twee</li></ul><p id="c">alinea</p>`);
  const a = veld.querySelector("#a") as unknown as HTMLElement;
  const b = veld.querySelector("#b") as unknown as HTMLElement;
  const c = veld.querySelector("#c") as unknown as HTMLElement;
  check("een lijstregel mag naar een andere lijstregel", magSlepenNaar(a, b));
  check("een lijstregel mag niet midden in de lopende tekst", !magSlepenNaar(a, c));
  check("een blok mag niet op zichzelf landen", !magSlepenNaar(a, a));
}

{
  const veld = veldMet(`<details class="rtv-vouw" open><summary>Kop</summary><div class="rtv-vouw-body"><p id="binnen">binnen</p></div></details>`);
  const details = veld.querySelector("details") as unknown as HTMLElement;
  const binnen = veld.querySelector("#binnen") as unknown as HTMLElement;
  check("een uitklapper kan niet in zijn eigen inhoud verdwijnen", !magSlepenNaar(details, binnen));
  check("en verplaatsen weigert dat dus ook", !verplaatsBlok(veld, details, binnen, true));
  check("de uitklapper staat er na die weigering nog gewoon", veld.querySelector("details") === details);
}

// ═══════════════════════════════════════════════════════════
// 4. SLEPEN VERPLAATST, HET VERWIJDERT NOOIT
// ═══════════════════════════════════════════════════════════

{
  const veld = veldMet(
    `<p id="een">een</p>`
    + `<details class="rtv-vouw" open><summary>Lokale pagina's</summary><div class="rtv-vouw-body"><p>hovenier breda</p></div></details>`
    + `<p id="drie">drie</p>`
  );
  herstelStructuur(veld);
  const voor = stukjes(veld);
  const details = veld.querySelector("details") as unknown as HTMLElement;
  const een = veld.querySelector("#een") as unknown as HTMLElement;
  const verplaatst = verplaatsBlok(veld, details, een, true);
  check("een uitklapper verslepen lukt", verplaatst);
  check("en de uitklapper houdt zijn hele inhoud", nietsKwijt(voor, stukjes(veld)),
    `voor: ${JSON.stringify(voor)}\n       na:   ${JSON.stringify(stukjes(veld))}`);
  // Bovenaan, met de lege regel ervoor die er altijd hoort te staan.
  check("de uitklapper staat nu bovenaan", veld.children[1]?.tagName === "DETAILS");
  check("de uitklapper heeft nog steeds een kopje en een body",
    !!veld.querySelector("details > summary") && !!veld.querySelector(`details > .${KL_VOUW_BODY}`));
}

{
  const veld = veldMet(`<p id="een">een</p><p id="twee">twee</p>`);
  const buiten = document.createElement("p");
  document.body.appendChild(buiten);
  const een = veld.querySelector("#een") as unknown as HTMLElement;
  check("verplaatsen naar buiten het tekstvak wordt geweigerd",
    !verplaatsBlok(veld, een, buiten as unknown as HTMLElement, true));
  check("en dat blok staat er dus nog", !!veld.querySelector("#een"));
}

// ═══════════════════════════════════════════════════════════
// 5. VAN GESELECTEERDE REGELS NAAR VINKPUNTEN
// ═══════════════════════════════════════════════════════════
// Dit ging via `innerText`, en dan hield je van een geplakt rijtje pagina's
// alleen de tekst over: elke link was weg. Dat is stille informatie-schade, want
// je ziet er pas iets van als je later op zo'n regel wilt klikken.

{
  const bak = document.createElement("div");
  bak.innerHTML = `<div><a href="/hovenier/breda/">/hovenier/breda/</a></div><div>hovenier zundert<br>hovenier bavel</div>`;
  const regels = regelsUitFragment(bak as unknown as HTMLElement);
  check("elke regel wordt een eigen punt", regels.length === 3, JSON.stringify(regels));
  check("een link blijft een link", regels[0].includes('href="/hovenier/breda/"'), regels[0]);
  check("een regelafbreking knipt ook", regels[1] === "hovenier zundert" && regels[2] === "hovenier bavel", JSON.stringify(regels));
}

{
  const bak = document.createElement("div");
  bak.innerHTML = `<p>  </p><p>echte regel</p><p><br></p>`;
  check("lege regels leveren geen leeg vinkpunt op", regelsUitFragment(bak as unknown as HTMLElement).length === 1);
}

{
  const bak = document.createElement("div");
  bak.innerHTML = checklistItemHtml("al een punt");
  const regels = regelsUitFragment(bak as unknown as HTMLElement);
  check("het vakje van een bestaand punt komt niet als tekst mee",
    regels.length === 1 && regels[0] === "al een punt", JSON.stringify(regels));
}

// ═══════════════════════════════════════════════════════════
// 6. HET VERSE VINKPUNT EN DE VERSE UITKLAPPER KLOPPEN METEEN
// ═══════════════════════════════════════════════════════════

{
  const veld = veldMet(`<p>boven</p>` + checklistItemHtml("", false) + checklistItemHtml("af punt", true));
  const voor = veld.innerHTML;
  herstelStructuur(veld);
  check("een vers gemaakt vinkpunt hoeft niet hersteld te worden", veld.innerHTML === voor);
  check("een leeg vinkpunt heeft een tekstvak om in te typen", !!veld.querySelector(`.${KL_CHECK_TEKST}`));
}

{
  const veld = veldMet(`<p>boven</p>` + uitklapperHtml());
  const voor = veld.innerHTML;
  herstelStructuur(veld);
  check("een vers gemaakte uitklapper hoeft niet hersteld te worden", veld.innerHTML === voor, veld.innerHTML);
}

console.log(fouten === 0
  ? "\nHet opmaakbare tekstveld houdt zijn vorm, en herstellen kost geen inhoud."
  : `\n${fouten} punt(en) mis.`);
process.exit(fouten === 0 ? 0 : 1);

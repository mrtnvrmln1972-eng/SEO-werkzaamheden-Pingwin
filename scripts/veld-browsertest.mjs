// Browsertest op het opmaakbare tekstveld (uitklappers, vinkpunten, slepen).
//
// WAAROM DIT NAAST DE PROEF STAAT
// ═══════════════════════════════
// `proeven/rijk-tekst.proef.ts` draait bij élke bouw en bewaakt de vórm: wat mag
// waar staan, en herstelt scheve inhoud zonder er iets van kwijt te raken. Wat
// hij niet kan, is een toets indrukken of een blok verslepen. En juist daar zat
// de ellende, want de browser doet bij "voeg een uitklapper in" iets heel anders
// dan je zou verwachten.
//
// Deze test heeft op 16-08-2026 drie fouten gevonden die in de code niet te zien
// waren: vinkpunten die in omgekeerde volgorde uit een genummerde lijst kwamen
// (Chrome propt ze allemaal in één lijstregel), een alinea die bij het invoegen
// doormidden werd geknipt met een stuk vetgedrukte rommel als restant, en een
// voorbeeldtekst waar je vóór typte in plaats van eroverheen.
//
// Hij draait NIET mee met de bouw: daar is een echte browser voor nodig, en die
// staat niet op de bouwserver. Draaien doe je zo, in twee vensters:
//
//     npm run dev
//     npm run veldproef
//
// Verandert er iets aan `app/_velden/RijkTekstVeld.tsx` of `lib/rijke-tekst.ts`,
// draai hem dan even. Het kost een minuut en het is de enige manier om te zien
// wat de browser er zélf van maakt.

import { chromium } from "playwright";

const url = process.env.VELD_URL || "http://localhost:3000/proefveld";
let fouten = 0;
const check = (naam, waar, extra = "") => {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !extra ? "" : `\n       ${extra}`}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PAD || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on("pageerror", (e) => { console.log("PAGINAFOUT:", e.message); fouten++; });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".focus-editable");

const uit = async () => (await page.locator("#uit").innerText());
const veld = page.locator(".focus-editable");

// ── 1. Vinklijst maken vanuit een selectie over een genummerde lijst ──
await page.evaluate(() => {
  const lis = document.querySelectorAll(".focus-editable li");
  const r = document.createRange();
  r.setStartBefore(lis[0]);
  r.setEndAfter(lis[lis.length - 1]);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});
await page.locator('button[title^="Afvinklijstje"]').click();
await page.waitForTimeout(200);
let html = await uit();
check("de vinkpunten staan niet in de genummerde lijst",
  (await page.locator("ol .rtv-check-item, ul .rtv-check-item").count()) === 0, html);
check("beide regels zijn een vinkpunt geworden",
  (await page.locator(".rtv-check-item").count()) === 2, html);
check("de tekst is niet kwijt",
  html.includes("Lokale pagina") && html.includes("Belangrijke navigatie"), html);

// ── 2. Enter aan het eind van een vinkregel geeft een nieuw punt ──
await page.evaluate(() => {
  const t = document.querySelectorAll(".rtv-check-tekst")[0];
  const r = document.createRange(); r.selectNodeContents(t); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.querySelector(".focus-editable").focus();
});
await page.keyboard.press("Enter");
await page.keyboard.type("nieuw punt");
await page.waitForTimeout(150);
html = await uit();
check("Enter aan het eind maakt een nieuw vinkpunt",
  (await page.locator(".rtv-check-item").count()) === 3, html);
check("en je typt meteen in dat nieuwe punt", html.includes("nieuw punt"), html);
check("de volgorde van de omgezette regels klopt", /Lokale pagina[\s\S]*nieuw punt[\s\S]*Belangrijke/.test(html), html);

// ── 3. Enter midden in een regel splitst hem ──
await page.evaluate(() => {
  const items = document.querySelectorAll(".rtv-check-tekst");
  const t = items[1]; // "nieuw punt"
  const knoop = t.firstChild;
  const r = document.createRange(); r.setStart(knoop, 5); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.querySelector(".focus-editable").focus();
});
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
html = await uit();
check("Enter middenin splitst de regel in twee punten",
  (await page.locator(".rtv-check-item").count()) === 4, html);
check("en de tekst na de cursor gaat mee naar het nieuwe punt",
  /nieuw<\/span>[\s\S]*punt/.test(html.replace(/\s+/g, " ")), html);

// ── 4. Enter op een leeg punt stapt uit de lijst ──
await page.evaluate(() => {
  const items = document.querySelectorAll(".rtv-check-item");
  const laatste = items[items.length - 1].querySelector(".rtv-check-tekst");
  laatste.innerHTML = "<br>";
  const r = document.createRange(); r.selectNodeContents(laatste); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.querySelector(".focus-editable").focus();
});
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
check("Enter op een leeg punt stapt uit de vinklijst",
  (await page.locator(".rtv-check-item").count()) === 3, await uit());

// ── 5. Backspace vooraan maakt er een gewone regel van, met behoud van tekst ──
const voorBackspace = await page.locator(".rtv-check-item").count();
await page.evaluate(() => {
  const t = document.querySelectorAll(".rtv-check-tekst")[0];
  const r = document.createRange(); r.setStart(t.firstChild, 0); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.querySelector(".focus-editable").focus();
});
await page.keyboard.press("Backspace");
await page.waitForTimeout(150);
html = await uit();
check("Backspace vooraan haalt het vinkje weg",
  (await page.locator(".rtv-check-item").count()) === voorBackspace - 1, html);
check("maar de tekst blijft gewoon staan", /<p>Lokale pagina/.test(html), html);
check("er blijft geen halve vinkregel achter",
  (await page.locator(".rtv-check-item:not(:has(.rtv-check-box))").count()) === 0, html);

// ── 6. Uitklapper: invoegen, Enter in het kopje, dichtklappen ──
await page.evaluate(() => {
  const veld = document.querySelector(".focus-editable");
  const p = veld.querySelector("p");
  const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  veld.focus();
});
await page.locator('button[title^="Uitklapper"]').click();
await page.waitForTimeout(250);
await page.keyboard.type("Lokale pagina's uitwerken");
await page.waitForTimeout(100);
html = await uit();
check("een uitklapper invoegen lukt", (await page.locator("details.rtv-vouw").count()) === 1, html);
check("de alinea waar de cursor stond wordt niet doormidden geknipt",
  !/beginOnderwerp|begin<span/.test(html), html);
check("er blijft geen stuk vetgedrukte rommel met eigen lettergroottes achter",
  !/style="[^"]*font-size/.test(html), html);
check("de titel typ je meteen over het voorbeeldwoord heen",
  html.includes("Lokale pagina&#x27;s uitwerken") || html.includes("Lokale pagina's uitwerken"), html);
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
await page.keyboard.type("hovenier breda");
await page.waitForTimeout(150);
html = await uit();
check("Enter in het kopje springt naar de inhoud eronder",
  /rtv-vouw-body[\s\S]*hovenier breda/.test(html), html);
check("en je typt over de voorbeeldtekst heen in plaats van ervoor",
  !html.includes("Zet hier neer wat erbij hoort"), html);
check("de titel is niet in tweeën gebroken",
  (await page.locator("details.rtv-vouw > summary").innerText()).includes("Lokale pagina"), html);

check("elke uitklapper heeft een kopje en een body",
  (await page.locator("details.rtv-vouw > summary").count()) === (await page.locator("details.rtv-vouw > .rtv-vouw-body").count()));

// Dichtklappen via het driehoekje, en die stand moet bewaard worden.
const kop = page.locator("details.rtv-vouw > summary");
const box = await kop.boundingBox();
await page.mouse.click(box.x + 6, box.y + box.height / 2);
await page.waitForTimeout(200);
html = await uit();
check("dichtklappen via het driehoekje werkt", !(await page.locator("details.rtv-vouw[open]").count()), html);
check("en die stand komt in de opgeslagen tekst", !/details[^>]*\sopen/.test(html), html);

// ── 7. Het grijpvlekje staat naast de tekst, niet erover ──
await page.evaluate(() => {
  document.querySelector(".focus-editable").insertAdjacentHTML("beforeend", "<ol><li id=nummer>Eerste genummerde regel</li><li>Tweede</li></ol>");
});
await page.waitForTimeout(100);
const li = page.locator("#nummer");
const liBox = await li.boundingBox();
await page.mouse.move(liBox.x + 40, liBox.y + liBox.height / 2);
await page.waitForTimeout(200);
const handleZichtbaar = await page.locator(".rtv-drag-handle-actief").count();
check("het grijpvlekje verschijnt bij een genummerde regel", handleZichtbaar === 1);
const hBox = await page.locator(".rtv-drag-handle").boundingBox();
const editorBox = await veld.boundingBox();
check("het grijpvlekje staat links búiten het tekstvak, dus nooit over het nummer",
  hBox.x + hBox.width <= editorBox.x + 1,
  `vlekje eindigt op ${Math.round(hBox.x + hBox.width)}, tekstvak begint op ${Math.round(editorBox.x)}`);
check("en het staat op de hoogte van die regel",
  Math.abs((hBox.y + hBox.height / 2) - (liBox.y + Math.min(liBox.height, 24) / 2)) < 8,
  `vlekje ${Math.round(hBox.y)}, regel ${Math.round(liBox.y)}`);

// ── 7b. Het vlekje blijft staan terwijl je ernaartoe beweegt ──
// Dit is precies waar het misging (18-08-2026): het vlekje verscheen netjes
// boven de tekst en verdween zodra je ernaartoe bewoog, dus je kon het niet
// pakken. De reden is met een teleporterende muis onzichtbaar, en test 8
// hieronder teleporteert: die zet de muis in één keer op het vlekje. Een echte
// muis legt de weg af, en die weg loopt door de inspringing van de lijst. Daar
// zit geen lijstregel onder de muis, alleen het tekstvak zelf, en dáár werd het
// vlekje verborgen. Vandaar: stapje voor stapje, zoals een hand het doet.
await page.mouse.move(liBox.x + 40, liBox.y + liBox.height / 2);
await page.waitForTimeout(150);
const naarX = hBox.x + hBox.width / 2, naarY = hBox.y + hBox.height / 2;
const vanX = liBox.x + 40, vanY = liBox.y + liBox.height / 2;
let kwijtOp = null;
for (let i = 1; i <= 14; i++) {
  const x = vanX + (naarX - vanX) * (i / 14);
  const y = vanY + (naarY - vanY) * (i / 14);
  await page.mouse.move(x, y);
  await page.waitForTimeout(40);
  if ((await page.locator(".rtv-drag-handle-actief").count()) === 0) { kwijtOp = Math.round(x); break; }
}
check("het vlekje blijft staan op de hele weg ernaartoe",
  kwijtOp === null,
  `hij verdween op x=${kwijtOp} (tekstvak begint op ${Math.round(editorBox.x)}, vlekje op ${Math.round(hBox.x)}); je kunt hem dan niet pakken`);

await page.screenshot({ path: "veld-proef.png" });

// ── 8. Slepen verplaatst en verliest niets ──
const voorSleep = (await veld.innerText()).replace(/\s+/g, " ").trim();
const doel = page.locator(".focus-editable > p").first();
const doelBox = await doel.boundingBox();
await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
await page.mouse.down();
await page.mouse.move(doelBox.x + 30, doelBox.y + 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
const naSleep = (await veld.innerText()).replace(/\s+/g, " ").trim();
const woordenVoor = voorSleep.split(" ").sort().join(" ");
const woordenNa = naSleep.split(" ").sort().join(" ");
check("slepen kost geen woord", woordenVoor === woordenNa, `voor: ${voorSleep}\n       na:   ${naSleep}`);

console.log(fouten === 0 ? "\nAlles goed in een echte browser." : `\n${fouten} punt(en) mis.`);
await browser.close();
process.exit(fouten === 0 ? 0 : 1);

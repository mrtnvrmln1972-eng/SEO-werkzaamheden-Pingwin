// Browsertest op het mega menu van de klantcockpit.
//
// WAAROM DIT NAAST DE PROEF STAAT
// ═══════════════════════════════
// `proeven/menu-indeling.proef.ts` bewaakt de INDELING (staat elk scherm in
// precies één groep, is elke groep een vraag). Wat hij niet kan zien is of het
// paneel ook echt binnen beeld valt. Dat is precies wat hier misging: het paneel
// hing onder zijn eigen knopje in plaats van onder de balk, en op een venster
// van 900 pixels stak het 532 pixels links buiten het scherm. In de code is daar
// niets aan te zien.
//
// Draait NIET mee met de bouw: daar is een echte browser voor nodig, en die
// staat niet op de bouwserver. Draaien doe je zo, in twee vensters:
//
//     npm run dev
//     npm run menuproef
//
// Verandert er iets aan het menu of aan de indeling, draai hem dan even.

import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PAD || undefined });
let fout = 0;
const check = (n, ok, extra="") => { if (!ok) fout++; console.log(`${ok?"OK  ":"FOUT"} | ${n}${ok||!extra?"":"\n       "+extra}`); };

for (const breed of [1600, 1200, 900]) {
  const p = await b.newPage({ viewport: { width: breed, height: 900 } });
  p.on("pageerror", (e) => { console.log("PAGINAFOUT:", e.message); fout++; });
  await p.goto(process.env.MENU_URL || "http://localhost:3000/proefveld/menu", { waitUntil: "networkidle" });
  await p.locator(".kmm-knop").click();
  await p.waitForTimeout(250);
  const paneel = p.locator(".kmm-paneel");
  check(`[${breed}] paneel gaat open`, await paneel.count() === 1);
  const box = await paneel.boundingBox();
  check(`[${breed}] paneel blijft links binnen beeld`, box.x >= -1, `x=${Math.round(box.x)}`);
  check(`[${breed}] paneel blijft rechts binnen beeld`, box.x + box.width <= breed + 1, `rechterrand=${Math.round(box.x+box.width)} venster=${breed}`);
  const kolommen = await p.locator(".kmm-kolom").count();
  check(`[${breed}] vijf groepen zichtbaar`, kolommen === 5, `${kolommen}`);
  const items = await p.locator(".kmm-item").count();
  check(`[${breed}] alle dertien schermen staan erin`, items === 13, `${items}`);
  const hints = await p.locator(".kmm-item-hint").allInnerTexts();
  check(`[${breed}] elk item toont zijn uitleg`, hints.length === items && hints.every((h) => h.trim().length > 10));
  if (breed === 1600) {
    await p.screenshot({ path: "mega-menu.png", clip: { x: 0, y: 0, width: 1600, height: 620 } });
  }
  // Escape sluit
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  check(`[${breed}] Escape sluit het menu`, await p.locator(".kmm-paneel").count() === 0);
  // klik buiten sluit
  await p.locator(".kmm-knop").click();
  await p.waitForTimeout(150);
  await p.mouse.click(breed - 20, 700);
  await p.waitForTimeout(150);
  check(`[${breed}] klikken buiten het menu sluit het`, await p.locator(".kmm-paneel").count() === 0);
  await p.close();
}
console.log(fout === 0 ? "\nHet mega menu valt goed op elke breedte." : `\n${fout} punt(en) mis.`);
await b.close();
process.exit(fout === 0 ? 0 : 1);

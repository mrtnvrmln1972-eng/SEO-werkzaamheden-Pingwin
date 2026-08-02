/* eslint-disable @typescript-eslint/no-explicit-any */
// De omslag uit de huisstijl: kleurverloop, sfeerbeeld van de klantsite, rond
// portret, handgetekende pijl en het citaat. Die vormen kan Word niet tekenen,
// dus renderen we de omslag één keer met de Chromium die er al staat en zetten
// hem als afbeelding op de eerste pagina. Het is beeld, geen tekst, dus er valt
// niets aan te bewerken.
//
// Lukt het renderen niet (geen browser, geen netwerk), dan geeft dit null terug
// en valt het document terug op een tekst-omslag. Nooit een kapotte afbeelding.

import { PINGWIN_LOGO_BASE64 } from "../pingwin-logo";
import { MONTSERRAT_WOFF2, MAARTEN_JPG } from "./beelden";

export type OmslagGegevens = {
  kicker: string;
  titel: string;
  ondertitel?: string;
  meta?: Record<string, string>;
  citaat?: string;
  sfeerbeeld?: string | null;   // data-URI van een screenshot van de klantsite
};

export const OMSLAG_BREEDTE = 650;   // px, gelijk aan de tekstbreedte op A4
export const OMSLAG_HOOGTE = 294;

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ic = (d: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONEN: Record<string, string> = {
  klant: ic('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  type: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  datum: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  pagina: ic('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
};
const icoonVoor = (k: string) => ICONEN[k.toLowerCase()] || ICONEN.type;

export function omslagHtml(g: OmslagGegevens): string {
  const rijen = Object.entries(g.meta || {}).slice(0, 4).map(([k, v]) =>
    `<div class="rij"><div class="ic">${icoonVoor(k)}</div><div class="k">${esc(k).toUpperCase()}</div><div class="w">${esc(v)}</div></div>`).join("");
  const hero = g.sfeerbeeld
    ? `<img class="hero" src="${g.sfeerbeeld}" alt="">`
    : `<div class="hero leeg"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Montserrat";font-weight:400 800;src:url(data:font/woff2;base64,${MONTSERRAT_WOFF2}) format("woff2")}
:root{--oranje:#F15829;--peach:#F8DABC;--peach-licht:#FDF3E7;--inkt:#2F2A2A;--lijn:#F0E7DF}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Montserrat",sans-serif;color:var(--inkt);font-size:13.5px;line-height:1.65;background:#fff;width:1000px}
.cover{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:start;background:linear-gradient(228deg,rgba(199,226,235,.45) 20%,rgba(248,218,188,.6) 85%);border-radius:30px;padding:30px 32px}
.kicker{color:var(--oranje);font-weight:800;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:12px}
h1{font-size:37px;line-height:1.16;font-weight:800;margin-bottom:12px;letter-spacing:.2px;word-break:break-word}
.sub{font-size:16.5px;color:#5d564e;margin-bottom:26px}
.meta{border-top:1px solid var(--lijn)}
.meta .rij{display:flex;align-items:center;gap:14px;padding:12px 2px;border-bottom:1px solid var(--lijn)}
.meta .ic{width:30px;height:30px;border-radius:50%;background:var(--peach-licht);display:flex;align-items:center;justify-content:center;color:var(--oranje);flex:none}
.meta .k{font-size:10.5px;font-weight:800;letter-spacing:.12em;width:64px;flex:none}
.meta .w{color:#5d564e}
.beeld{position:relative;min-height:392px}
.beeld .hero{width:100%;height:330px;object-fit:cover;border-radius:130px 30px 30px 30px;display:block}
.beeld .hero.leeg{background:linear-gradient(215deg,#C7E2EB 10%,#F8DABC 90%)}
.beeld .portret{position:absolute;left:-14px;top:150px;width:118px;height:118px;border-radius:50%;object-fit:cover;border:5px solid #fff;box-shadow:0 6px 18px rgba(47,42,42,.18)}
.beeld .quote{position:absolute;left:34px;bottom:0;right:26px;background:var(--peach-licht);border:1.5px solid var(--peach);border-radius:18px;padding:14px 18px;font-size:12.5px;box-shadow:0 8px 22px rgba(47,42,42,.12)}
.beeld .quote .wie{margin-top:6px;color:#6b6157}
.beeld svg.pijl{position:absolute;color:var(--oranje)}
</style></head><body>
<div class="cover">
  <div>
    <div class="kicker">${esc(g.kicker)}</div>
    <h1>${esc(g.titel)}</h1>
    ${g.ondertitel ? `<div class="sub">${esc(g.ondertitel)}</div>` : ``}
    <div class="meta">${rijen}</div>
  </div>
  <div class="beeld">
    ${hero}
    <img class="portret" src="data:image/jpeg;base64,${MAARTEN_JPG}" alt="Maarten van Pingwin">
    <svg class="pijl" style="left:96px;top:132px" width="52" height="44" viewBox="0 0 52 44" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 40 C 18 34, 30 22, 44 10"/><path d="M32 8 L 45 9 L 42 22"/></svg>
    <div class="quote">&ldquo;${esc(g.citaat || "Geschreven om gevonden te worden én om te overtuigen.")}&rdquo;<div class="wie">&ndash; Maarten van Pingwin</div></div>
  </div>
</div></body></html>`;
}

let browserOnbeschikbaar = false;

async function metBrowser<T>(werk: (page: any) => Promise<T>): Promise<T | null> {
  if (browserOnbeschikbaar) return null;
  let browser: any = null;
  try {
    const chromium: any = await import("@sparticuz/chromium").catch(() => null);
    const puppeteer: any = await import("puppeteer-core").catch(() => null);
    if (!chromium || !puppeteer) { browserOnbeschikbaar = true; return null; }
    const chr = chromium.default || chromium;
    const pup = puppeteer.default || puppeteer;
    browser = await pup.launch({
      args: [...(chr.args || []), "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chr.executablePath(),
      headless: true,
    });
    return await werk(await browser.newPage());
  } catch {
    return null;
  } finally {
    try { if (browser) await browser.close(); } catch { /* niet kritisch */ }
  }
}

/** Eén screenshot van de klantpagina, als data-URI voor op de omslag. */
export async function sfeerbeeld(url: string): Promise<string | null> {
  if (!url) return null;
  return metBrowser(async (page) => {
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
    await page.setUserAgent("Mozilla/5.0 (compatible; PingwinBot/1.0; +https://pingwin.nl)");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 700));
    const buf = await page.screenshot({ type: "jpeg", quality: 72 });
    return `data:image/jpeg;base64,${Buffer.from(buf).toString("base64")}`;
  });
}

/** De omslag als PNG. Null betekent: gebruik de tekst-omslag. */
export async function omslagPng(g: OmslagGegevens): Promise<Buffer | null> {
  const html = omslagHtml(g);
  return metBrowser(async (page) => {
    await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 2.4 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
    const el = await page.$(".cover");
    const buf = await el.screenshot({ type: "png" });
    return Buffer.from(buf);
  });
}

export { PINGWIN_LOGO_BASE64 };

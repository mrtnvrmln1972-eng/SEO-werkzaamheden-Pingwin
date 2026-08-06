// ═══════════════════════════════════════════════════════════
// HEADLESS-BROWSER RENDERING (stap 3 richting Cowork-pariteit).
// Rendert een pagina met een echte Chromium zodat JavaScript-gegenereerde
// content (React/Vue/lazy DOM) volledig zichtbaar wordt, net als de Chrome
// van Cowork.
//
// Het starten van de browser zit in lib/browser.ts, samen met de omslag van de
// documenten. Daar staat ook waarom dat nodig was: op Vercel werden de
// systeembibliotheken van Chromium niet uitgepakt, waardoor de browser nooit
// startte en dit stilletjes terugviel op de statische HTML.
//
// VEILIGE TERUGVAL: faalt de browser alsnog, dan komt er rendered: false terug
// en valt de meting terug op de statische HTML. De site breekt nooit hierdoor.
// ═══════════════════════════════════════════════════════════

import { metBrowser } from "./browser";

export type RenderResult = { html: string; status: number | null; rendered: boolean };

// Onze eigen bot maakt zich normaal netjes bekend. Sommige klantsites (of hun
// firewall) weigeren elke user-agent die naar een bot ruikt met een 403, en dan
// meet je niets meer terwijl er niets mis is met de pagina. Voor die gevallen kan
// de aanroeper zich als een gewone bezoeker voordoen; het blijft lezen, we
// veranderen niets aan de site.
export const BOT_UA = "Mozilla/5.0 (compatible; PingwinBot/1.0; +https://pingwin.nl)";
export const BEZOEKER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function renderHtml(url: string, opts?: { userAgent?: string }): Promise<RenderResult> {
  const uit = await metBrowser(async (page) => {
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent(opts?.userAgent || BOT_UA);
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    const status = resp ? resp.status() : null;
    // Even wachten op eventueel na-ingeladen content.
    await new Promise((r) => setTimeout(r, 800));
    const html = await page.content();
    return { html: html || "", status, rendered: true } as RenderResult;
  });
  return uit || { html: "", status: null, rendered: false };
}

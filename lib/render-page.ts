// ═══════════════════════════════════════════════════════════
// HEADLESS-BROWSER RENDERING (stap 3 richting Cowork-pariteit).
// Rendert een pagina met een echte Chromium zodat JavaScript-gegenereerde
// content (React/Vue/lazy DOM) volledig zichtbaar wordt, net als de Chrome
// van Cowork. Werkt op Vercel via @sparticuz/chromium + puppeteer-core.
//
// VEILIGE TERUGVAL: de packages worden lui geladen. Zijn ze (nog) niet
// geïnstalleerd of faalt de browser, dan geeft dit null terug en valt de
// meting terug op de statische HTML. De site breekt dus nooit hierdoor.
// ═══════════════════════════════════════════════════════════

export type RenderResult = { html: string; status: number | null; rendered: boolean };

let unavailable = false; // eenmalig gedetecteerd dat de browser niet kan -> niet opnieuw proberen

export async function renderHtml(url: string): Promise<RenderResult> {
  const fail: RenderResult = { html: "", status: null, rendered: false };
  if (unavailable) return fail;

  let browser: { close: () => Promise<void> } | null = null;
  try {
    // Lui laden zodat de build niet breekt als de packages ontbreken.
    const chromium = (await import("@sparticuz/chromium").catch(() => null)) as any;
    const puppeteer = (await import("puppeteer-core").catch(() => null)) as any;
    if (!chromium || !puppeteer) { unavailable = true; return fail; }
    const chr = chromium.default || chromium;
    const pup = puppeteer.default || puppeteer;

    const executablePath = await chr.executablePath();
    browser = await pup.launch({
      args: [...(chr.args || []), "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1366, height: 900 },
      executablePath,
      headless: true,
    });
    const page = await (browser as any).newPage();
    await page.setUserAgent("Mozilla/5.0 (compatible; PingwinBot/1.0; +https://pingwin.nl)");
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    const status = resp ? resp.status() : null;
    // Even wachten op eventueel na-ingeladen content.
    await new Promise((r) => setTimeout(r, 800));
    const html = await page.content();
    return { html: html || "", status, rendered: true };
  } catch {
    return fail;
  } finally {
    try { if (browser) await browser.close(); } catch { /* */ }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════
// DE HEADLESS BROWSER, OP ÉÉN PLEK
// ═══════════════════════════════════════════════════════════
// Gebruikt voor het renderen van een pagina (JavaScript-content meten) en voor
// de omslag van een document.
//
// Waarom dit bestand er is: op Vercel startte de browser niet, met
// "libnss3.so: cannot open shared object file". @sparticuz/chromium levert die
// systeembibliotheken wél mee (al2023.tar.br), maar pakt ze alleen uit als het
// AWS_EXECUTION_ENV of AWS_LAMBDA_JS_RUNTIME ziet met "20.x" of "22.x" erin.
// Vercel zet die variabelen niet, dus bleef het uitpakken achterwege en viel de
// omslag van elk document stil terug op de tekst-versie.
//
// De oplossing is die variabele zelf zetten, vóór het inladen van het pakket
// (het pakket doet zijn instelwerk op het moment van importeren). Daarnaast: als
// /tmp/chromium al bestaat, stopt het pakket meteen en pakt het niets meer uit.
// Staat de bibliotheek-map er dan nog niet, dan ruimen we /tmp/chromium op zodat
// alles alsnog in één keer goed wordt uitgepakt.
// ═══════════════════════════════════════════════════════════

const LIB_MAP = "/tmp/al2023/lib";

function bereidOmgevingVoor(): void {
  // Alleen op een server zonder eigen Chromium (Vercel/Lambda). Lokaal met een
  // echte browser verandert er niets, want daar bestaat /tmp/chromium niet en is
  // de variabele verder onschadelijk.
  if (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_LAMBDA_JS_RUNTIME) {
    process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs20.x";
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    if (fs.existsSync("/tmp/chromium") && !fs.existsSync(LIB_MAP)) {
      // Half uitgepakt uit een eerdere poging: opnieuw laten doen.
      fs.rmSync("/tmp/chromium", { force: true });
    }
  } catch { /* niet kritisch */ }
}

let onbeschikbaar: string | null = null;

/** De reden dat de browser niet kan, of null als hij (nog) niet geprobeerd is. */
export function browserProbleem(): string | null {
  return onbeschikbaar;
}

/**
 * Start één browser, doet het werk, en ruimt op. Geeft null terug als de browser
 * niet kan; de aanroeper valt dan terug op iets zonder browser.
 */
export async function metBrowser<T>(werk: (page: any) => Promise<T>): Promise<T | null> {
  if (onbeschikbaar) return null;
  let browser: any = null;
  try {
    bereidOmgevingVoor();
    const chromium: any = await import("@sparticuz/chromium").catch(() => null);
    const puppeteer: any = await import("puppeteer-core").catch(() => null);
    if (!chromium || !puppeteer) { onbeschikbaar = "pakketten ontbreken"; return null; }
    const chr = chromium.default || chromium;
    const pup = puppeteer.default || puppeteer;
    browser = await pup.launch({
      args: [...(chr.args || []), "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chr.executablePath(),
      headless: true,
    });
    return await werk(await browser.newPage());
  } catch (e) {
    // Eén keer onthouden dat het niet kan, zodat niet elke aanroep opnieuw
    // seconden verspilt aan een browser die toch niet start.
    const melding = e instanceof Error ? e.message : String(e);
    if (/launch the browser|shared libraries|ENOENT|does not exist/i.test(melding)) onbeschikbaar = melding;
    return null;
  } finally {
    try { if (browser) await browser.close(); } catch { /* niet kritisch */ }
  }
}

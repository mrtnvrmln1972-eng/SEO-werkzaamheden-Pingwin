import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";

export const runtime = "nodejs";
export const maxDuration = 60;

// Zegt of de headless browser het op deze server doet, en zo niet: waarom.
//
// Waarom dit bestaat: de omslag van een document wordt met Chromium getekend, en
// die stap valt stil terug op een tekst-omslag als de browser niet start. Dat is
// goed (nooit een kapotte afbeelding), maar het verbergt ook de oorzaak. Hier
// staat de echte foutmelding, zodat we niet hoeven te gokken.
export async function GET(req: NextRequest) {
  const g = await guardSlug(req, req.nextUrl.searchParams.get("slug") || "");
  if (!g.ok) return g.res;

  const stap: Record<string, unknown> = {};
  let browser: { close: () => Promise<void> } | null = null;
  try {
    // Dezelfde voorbereiding als lib/browser.ts doet, anders meet je iets anders
    // dan wat de documenten in het echt gebruiken.
    await import("../../../../lib/browser");
    if (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_LAMBDA_JS_RUNTIME) {
      process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs20.x";
    }
    {
      const fs = await import("fs");
      if (fs.existsSync("/tmp/chromium") && !fs.existsSync("/tmp/al2023/lib")) {
        fs.rmSync("/tmp/chromium", { force: true });
        stap.opgeruimd = "half uitgepakte /tmp/chromium verwijderd";
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium: any = await import("@sparticuz/chromium").catch((e) => { stap.importChromium = String(e); return null; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer: any = await import("puppeteer-core").catch((e) => { stap.importPuppeteer = String(e); return null; });
    if (!chromium || !puppeteer) return NextResponse.json({ ok: false, waar: "import", stap });
    const chr = chromium.default || chromium;
    const pup = puppeteer.default || puppeteer;

    stap.pad = await chr.executablePath().catch((e: unknown) => { stap.padFout = String(e); return null; });
    if (!stap.pad) return NextResponse.json({ ok: false, waar: "executablePath", stap });

    // Uitgepakt of niet: hier zie je of de systeembibliotheken echt zijn meegekomen.
    try {
      const fs = await import("fs");
      stap.tmp = fs.readdirSync("/tmp").slice(0, 25);
      stap.ldPath = process.env.LD_LIBRARY_PATH || "(leeg)";
      stap.libs = fs.existsSync("/tmp/al2023") ? fs.readdirSync("/tmp/al2023").slice(0, 10) : "(geen /tmp/al2023)";
    } catch (e) { stap.tmpFout = String(e); }

    browser = await pup.launch({
      args: [...(chr.args || []), "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: stap.pad as string,
      headless: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (browser as any).newPage();
    await page.setContent("<b>ok</b>", { waitUntil: "domcontentloaded" });
    const shot = await page.screenshot({ type: "png" });
    return NextResponse.json({ ok: true, stap, bytes: (shot as Buffer).length });
  } catch (e) {
    return NextResponse.json({ ok: false, waar: "launch", fout: e instanceof Error ? `${e.message}` : String(e), stap });
  } finally {
    try { if (browser) await browser.close(); } catch { /* niet kritisch */ }
  }
}

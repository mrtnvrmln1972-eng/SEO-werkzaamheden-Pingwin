// Genereert een A4-PDF uit een gevuld Pingwin-rapport (HTML).
// Gebruik: NODE_PATH=<map met playwright-core> node genereer-pdf.js <rapport.html> <uit.pdf>
// De schaal wordt automatisch berekend zodat de hoogste .page precies op één A4 past.
const { chromium } = require("playwright-core");

(async () => {
  const [, , inFile, outFile] = process.argv;
  if (!inFile || !outFile) { console.error("gebruik: node genereer-pdf.js <in.html> <uit.pdf>"); process.exit(1); }
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1040, height: 1550 } });
  await p.goto("file://" + require("path").resolve(inFile));
  await p.waitForTimeout(700);
  const hoogtes = await p.evaluate(() => Array.from(document.querySelectorAll(".page")).map(pg => pg.offsetHeight));
  // A4 bij 96dpi is 1123px hoog; 1% marge tegen afronding.
  const scale = Math.min(0.9, Math.floor((1123 / Math.max(...hoogtes)) * 100) / 100 * 0.99);
  console.log("paginahoogtes:", hoogtes, "schaal:", scale);
  await p.pdf({ path: outFile, format: "A4", printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" }, scale });
  await b.close();
  console.log("PDF geschreven:", outFile);
})();

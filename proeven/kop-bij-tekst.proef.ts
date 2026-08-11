// ═══════════════════════════════════════════════════════════
// EEN KOP STAAT NOOIT ALLEEN ONDERAAN EEN BLADZIJDE
// ═══════════════════════════════════════════════════════════
// Op 11 augustus 2026 kwam er een copy-briefing terug waarin kop 2 en kop 3
// alleen onderaan een bladzijde stonden en hun tekst pas op de volgende begon.
// Dat leest als een lege sectie. De oplossing is Words "bij volgende alinea
// houden" (keepNext) op elke kop en op de witregel eronder.
//
// Deze proef bouwt een echt document en kijkt in de Word-XML of die eigenschap
// er ook echt in staat. Zonder deze proef is de regel alleen een afspraak, en
// die sneuvelt bij de eerste verbouwing van de bouwstenen.

import { inflateRawSync } from "node:zlib";

import { buildPingwinDoc } from "../lib/pingwin-docx";

/** Eén bestand uit een zip halen, via de inhoudsopgave achterin (de central directory). */
function uitZip(zip: Buffer, naam: string): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Geen zip-inhoudsopgave gevonden.");
  let p = zip.readUInt32LE(eocd + 16);
  const aantal = zip.readUInt16LE(eocd + 10);
  for (let i = 0; i < aantal; i++) {
    const nLen = zip.readUInt16LE(p + 28), eLen = zip.readUInt16LE(p + 30), cLen = zip.readUInt16LE(p + 32);
    const bestand = zip.subarray(p + 46, p + 46 + nLen).toString("utf8");
    if (bestand === naam) {
      const methode = zip.readUInt16LE(p + 10);
      const grootte = zip.readUInt32LE(p + 20);
      const off = zip.readUInt32LE(p + 42);
      const lnLen = zip.readUInt16LE(off + 26), leLen = zip.readUInt16LE(off + 28);
      const start = off + 30 + lnLen + leLen;
      const data = zip.subarray(start, start + grootte);
      return (methode === 0 ? data : inflateRawSync(data)).toString("utf8");
    }
    p += 46 + nLen + eLen + cLen;
  }
  throw new Error(`${naam} zit niet in het document.`);
}

let fouten = 0;
function proef(naam: string, goed: boolean) {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) fouten++;
}

async function main() {
  const buffer = await buildPingwinDoc({
    klant: "Proefklant",
    rapporttype: "Copy-briefing",
    titel: "Nieuwe teksten voor /proef/pagina/",
    sections: [
      { heading: "Lees na, pas aan en stuur terug", blocks: [{ type: "paragraph", text: "De eerste alinea onder de kop." }] },
      { heading: "Hoe deze nieuwe tekst tot stand kwam", blocks: [{ type: "highlight", text: "Een kaartje direct onder de kop." }] },
      { heading: "H2 — Waar de nieuwe teksten over gaan", blocks: [{ type: "paragraph", text: "Tekst onder een copy-kop." }] },
    ],
  });

  // Het .docx is een zip. Zelf uitpakken met alleen Node erbij: een los
  // uitpak-programma aanroepen zou betekenen dat elke bouw op Vercel afhangt van
  // een hulpprogramma dat daar toevallig staat, en dan blokkeert deze proef ooit
  // een deploy om een reden die niets met de opmaak te maken heeft.
  const xml = uitZip(buffer, "word/document.xml");

  proef("het document is gebouwd", buffer.length > 5000);
  proef("er staat minstens één 'houd bij de volgende alinea' in", /<w:keepNext\b/.test(xml));
  // Zoveel koppen als er secties zijn: elke kop plus zijn witregel, en de
  // startmarkering van een kaartje. Ruim onder wat er echt in hoort te staan,
  // zodat de proef niet knapt bij een kleine opmaakwijziging.
  const aantal = (xml.match(/<w:keepNext\b/g) || []).length;
  proef(`elke kop heeft hem, niet alleen de eerste (${aantal} gevonden)`, aantal >= 6);
  proef("een kop mag zelf ook niet over twee bladzijden vallen", /<w:keepLines\b/.test(xml));
  proef("de koprij van een sectie splitst niet", /<w:cantSplit\b/.test(xml));

  console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
  process.exit(fouten === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

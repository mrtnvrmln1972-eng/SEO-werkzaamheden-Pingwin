// ═══════════════════════════════════════════════════════════
// HET DASHBOARD KIEST ZELF, EN ALLEEN OP EEN ECHTE DATUM
// ═══════════════════════════════════════════════════════════
// De afspraak (18-08-2026): bij een nieuwe aanlevering wint per gegeven de
// nieuwste waarde, gemeten aan de datum van het materiaal zelf. Drie dingen
// mogen daarbij nooit stilletjes veranderen, want dan gaan er gegevens verloren
// zonder dat iemand het merkt:
//
//  1. Zonder datum wordt er niet overschreven. Alleen lege plekken vullen.
//  2. Vergelijken gebeurt per gegeven, niet per document. Een schermafdruk van
//     alleen de openingstijden mag het adres niet weggooien.
//  3. Een gelijke waarde houdt zijn oorspronkelijke datum. Anders verjongt onze
//     eigen controle-ronde de gegevens en verliest een klantdocument het van
//     iets dat al jaren onveranderd op de site staat.
//
// Deze proef rekent dat na met echte gevallen in plaats van het te vertrouwen.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { voegVeldenSamen, kennisNaarOrg, type KennisEntiteit, type VeldStempels } from "../lib/schema-knowledge";
import { EMPTY_ORG, plattePaden } from "../lib/org-data";
import { LEGE_VESTIGING } from "../lib/org-vereist";
import { bruikbareDatum, datumUitBestand, isNieuwerDan, maakBronDatum, GEEN_DATUM } from "../lib/bron-datum";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const MEI = "2026-05-01T10:00:00.000Z";
const AUG = "2026-08-12T10:00:00.000Z";
const stempels = (d: string): VeldStempels => ({
  adres: { datum: d, bron: "document", waar: "eerdere aanlevering" },
  telefoon: { datum: d, bron: "document", waar: "eerdere aanlevering" },
});
const aanlevering = (datum: string) => ({ datum, bron: "document" as const, uitleg: "proef" });

// ── 1. Nieuwer wint, ouder wint niet ──
const nieuwer = voegVeldenSamen(
  { adres: "Oude straat 1", telefoon: "010-1111111" }, stempels(MEI),
  { adres: "Nieuwe straat 9" }, aanlevering(AUG), "klantdocument",
);
proef("een nieuwer document vervangt de waarde", nieuwer.velden.adres === "Nieuwe straat 9");
proef("een nieuwer document laat de rest met rust", nieuwer.velden.telefoon === "010-1111111",
  "Alleen velden die in het aangeleverde stuk staan mogen veranderen.");
proef("de nieuwe waarde krijgt de datum van het materiaal", nieuwer.stempels.adres?.datum === AUG);

const ouder = voegVeldenSamen(
  { adres: "Nieuwe straat 9" }, stempels(AUG),
  { adres: "Oude straat 1" }, aanlevering(MEI), "oud document",
);
proef("een ouder document overschrijft niet", ouder.velden.adres === "Nieuwe straat 9");
proef("en dat wordt gemeld in plaats van stil weggelaten", ouder.botsingen.length === 1 && ouder.botsingen[0].veld === "adres",
  "Zonder melding zou je denken dat het verwerkt is terwijl er niets veranderde.");

// ── 2. Zonder datum wordt er niet overschreven, wel aangevuld ──
const zonder = voegVeldenSamen(
  { adres: "Nieuwe straat 9" }, stempels(AUG),
  { adres: "Iets anders 3", email: "info@klant.nl" }, GEEN_DATUM, "materiaal zonder datum",
);
proef("zonder datum blijft de bestaande waarde staan", zonder.velden.adres === "Nieuwe straat 9",
  "Dit is de kern van de afspraak: onbekend overschrijft nooit.");
proef("zonder datum wordt een leeg veld wél gevuld", zonder.velden.email === "info@klant.nl",
  "Aanvullen kan geen kwaad, er gaat niets verloren.");

// ── 3. Dezelfde waarde houdt zijn oorspronkelijke datum ──
const zelfde = voegVeldenSamen(
  { adres: "Nieuwe straat 9" }, stempels(MEI),
  { adres: "Nieuwe straat 9" }, aanlevering(AUG), "controle-ronde",
);
proef("een ongewijzigde waarde houdt zijn oude datum", zelfde.stempels.adres?.datum === MEI,
  "Anders verjongt elke controle onze eigen gegevens en verliest een klantdocument het altijd.");

// ── 4. Onzin-datums tellen niet mee ──
proef("1970 telt niet als datum", !bruikbareDatum(new Date(0)));
proef("volgend jaar telt niet als datum", !bruikbareDatum(new Date(Date.now() + 400 * 864e5)));
proef("een gewone datum telt wel", bruikbareDatum(new Date(AUG)));
proef("een onbekende datum wint nooit", !isNieuwerDan("", AUG) && !isNieuwerDan(AUG, ""));
proef("een onbruikbare datum levert geen stempel op", maakBronDatum(new Date(0), "bestand").datum === "");

// ── 5. De regel staat op één plek en wordt nergens nagebouwd ──
const wortel = join(__dirname, "..");
const lees = (...p: string[]) => readFileSync(join(wortel, ...p), "utf8");
const kennis = lees("lib", "schema-knowledge.ts");
proef("de kennisbank beslist met de datumvergelijking uit bron-datum.ts",
  /from "\.\/bron-datum"/.test(kennis) && /isNieuwerDan\(/.test(kennis),
  "Wordt hier weer met de hand vergeleken, dan loopt de regel uit de pas met de rest.");
proef("elke waarde krijgt een stempel opgeslagen", /veld_stempels/.test(kennis),
  "Zonder stempel per veld is er niets om de volgende aanlevering mee te vergelijken.");

for (const [naam, pad] of [
  ["de kennisbank", ["app", "admin", "client", "[slug]", "Kennisbank.tsx"]],
  ["de documenten bij een taak", ["app", "admin", "client", "[slug]", "DocVersies.tsx"]],
] as const) {
  proef(`${naam} stuurt de datum van het bestand mee`, /form\.append\("gewijzigd"/.test(lees(...pad)),
    "De browser kent die datum, maar hij gaat niet vanzelf mee bij een upload. Zonder deze regel is elk bestand \"vandaag\".");
}

// ── 6. Doorgetrokken naar het formulier Bedrijfsgegevens ──
// De datumregel gold eerst alleen in de kennisbank. Het formulier ernaast werd
// alleen aangevuld waar het leeg was, dus nieuwe openingstijden landden wel in de
// kennisbank en niet in de velden. Nu geldt overal dezelfde regel, gemeten tegen
// de laatste keer dat het formulier is opgeslagen.
const JUNI = "2026-06-01T10:00:00.000Z";
const orgMet = (velden: Record<string, string>, stempelDatum: string): KennisEntiteit[] => [{
  id: 1, categorie: "organisatie", naam: "Testklant", velden, bron: "", updatedAt: "",
  stempels: Object.fromEntries(Object.keys(velden).map((k) => [k, { datum: stempelDatum, bron: "document" as const, waar: "proef" }])),
}];
const formulier = { ...EMPTY_ORG, telefoon: "010-1111111", openingstijden: "ma-vr 9-17" };

const nieuwerDanFormulier = kennisNaarOrg(formulier, orgMet({ openingstijden: "ma-vr 8-18" }, AUG), "", JUNI);
proef("materiaal van ná je laatste wijziging vervangt een ingevuld veld",
  nieuwerDanFormulier.data.openingstijden === "ma-vr 8-18" && nieuwerDanFormulier.vervangen.length === 1,
  "Dit was de laatste schakel: zonder dit landt een nieuwe openingstijd wel in de kennisbank en niet in het formulier.");

const ouderDanFormulier = kennisNaarOrg(formulier, orgMet({ openingstijden: "ma-vr 8-18" }, MEI), "", JUNI);
proef("materiaal van vóór je laatste wijziging laat het veld met rust",
  ouderDanFormulier.data.openingstijden === "ma-vr 9-17" && ouderDanFormulier.vervangen.length === 0,
  "Wat jij zelf invult wint, tot er materiaal komt van ná jouw wijziging.");

const zonderStempel = kennisNaarOrg(formulier, [{ ...orgMet({ openingstijden: "ma-vr 8-18" }, AUG)[0], stempels: {} }], "", JUNI);
proef("zonder datum verandert er niets aan een ingevuld veld", zonderStempel.data.openingstijden === "ma-vr 9-17");

const legeVulling = kennisNaarOrg(formulier, orgMet({ kvk: "12345678" }, MEI), "", JUNI);
proef("een leeg veld wordt nog steeds gewoon gevuld, ook met ouder materiaal",
  legeVulling.data.kvk === "12345678" && legeVulling.vervangen.length === 0,
  "Aanvullen kan geen kwaad; er gaat niets verloren.");

// ── 6b. Per veld een eigen datum, niet één datum voor het hele formulier ──
// Met één datum voor alles verzet je met één keer opslaan de grens voor élk veld.
// Dan verliest een klantdocument van vorige week ineens van een adres dat je nooit
// hebt aangeraakt. Per veld is dat opgelost: alleen het veld dat je zelf hebt
// gezet is "vers", de rest niet.
const stempelsVanFormulier = {
  openingstijden: { datum: AUG, bron: "handmatig" as const, waar: "zelf ingevuld" },
};
const gemengd = kennisNaarOrg(
  { ...EMPTY_ORG, telefoon: "010-1111111", openingstijden: "ma-vr 9-17" },
  orgMet({ openingstijden: "ma-vr 8-18", telefoon: "020-2222222" }, "2026-07-01T10:00:00.000Z"),
  "", MEI, stempelsVanFormulier,
);
proef("een veld dat jij zelf later zette, blijft staan",
  gemengd.data.openingstijden === "ma-vr 9-17",
  "De openingstijden zijn door jou gezet in augustus; materiaal van juli mag daar niet overheen.");
proef("en een veld dat je niet aanraakte beweegt gewoon mee",
  gemengd.data.telefoon === "020-2222222",
  "Dit is precies wat één datum voor het hele formulier onmogelijk maakte.");

// Het pad van een vestiging moet aan de rij hangen, niet aan zijn plek in de
// lijst; anders verhuizen de datums bij het slepen naar de buurman.
const metVestiging = { ...EMPTY_ORG, vestigingen: [
  { ...LEGE_VESTIGING, naam: "Loods 5 Maastricht", straat: "Sphinxcour 5", postcode: "6211 XZ", plaats: "Maastricht", openingstijden: "ma 11:00-17:30" },
] };
const paden = plattePaden(metVestiging);
proef("een vestiging krijgt een pad dat aan de rij hangt",
  Object.keys(paden).some((k) => k === "vestiging|6211-xz|openingstijden"),
  `Gevonden paden: ${Object.keys(paden).filter((k) => k.startsWith("vestiging")).join(", ") || "geen"}`);

// ── 7. De datum echt uit een bestand halen ──
// Niet nagespeeld maar echt gedaan: hieronder staan een Word-bestand, een pdf,
// een schermafdruk en een foto zoals ze binnenkomen, en de vraag is of de datum
// die erin zit er ook uit komt. Zonder deze stap is de hele afspraak theorie.
async function bestandsproeven(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip: typeof import("jszip") = require("jszip");

  // Word: de datum staat in docProps/core.xml.
  const zip = new JSZip();
  zip.file("docProps/core.xml",
    `<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dcterms="y">
     <dcterms:created>2019-01-01T09:00:00Z</dcterms:created>
     <dcterms:modified>2026-05-14T11:22:33Z</dcterms:modified></cp:coreProperties>`);
  zip.file("word/document.xml", "<w:document/>");
  const docx = await zip.generateAsync({ type: "nodebuffer" });
  const uitWord = await datumUitBestand("inventarisatie.docx", docx, Date.now());
  proef("Word: de datum uit het document zelf wint van de bestandsdatum",
    uitWord.bron === "document" && uitWord.datum.slice(0, 10) === "2026-05-14",
    `Gevonden: ${uitWord.datum || "niets"} (${uitWord.bron}). Dit is het geval van een klant die vandaag stuurt wat hij in mei schreef.`);

  // Pdf: /ModDate gaat voor /CreationDate.
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n" +
    "trailer<</Info 2 0 R>>\n2 0 obj<</CreationDate(D:20240101120000+01'00')/ModDate(D:20260703084500+02'00')>>endobj\n%%EOF",
    "latin1");
  const uitPdfBestand = await datumUitBestand("advies.pdf", pdf);
  proef("Pdf: de laatst-opgeslagen datum komt eruit",
    uitPdfBestand.bron === "document" && uitPdfBestand.datum.slice(0, 10) === "2026-07-03",
    `Gevonden: ${uitPdfBestand.datum || "niets"} (${uitPdfBestand.bron}).`);

  // Png met tIME-blokje: het plaatje weet zelf wanneer het gemaakt is.
  const stuk = (soort: string, data: Buffer) => Buffer.concat([
    Buffer.from([data.length >> 24 & 255, data.length >> 16 & 255, data.length >> 8 & 255, data.length & 255]),
    Buffer.from(soort, "latin1"), data, Buffer.alloc(4),
  ]);
  const tijd = Buffer.alloc(7);
  tijd.writeUInt16BE(2026, 0); tijd[2] = 6; tijd[3] = 21; tijd[4] = 14; tijd[5] = 5; tijd[6] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stuk("IHDR", Buffer.alloc(13)), stuk("tIME", tijd), stuk("IEND", Buffer.alloc(0)),
  ]);
  const uitPngBestand = await datumUitBestand("schermafdruk.png", png, Date.now());
  proef("Png: het gemaakt-op-blokje wordt gelezen",
    uitPngBestand.bron === "document" && uitPngBestand.datum.slice(0, 10) === "2026-06-21",
    `Gevonden: ${uitPngBestand.datum || "niets"} (${uitPngBestand.bron}).`);

  // Schermafdruk zonder tIME: dan telt de datum van het bestand, en dat is voor
  // een schermafdruk die je zelf net gemaakt hebt precies goed.
  const kaalPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stuk("IHDR", Buffer.alloc(13)), stuk("IDAT", Buffer.alloc(4)), stuk("IEND", Buffer.alloc(0)),
  ]);
  const gemaakt = Date.parse("2026-08-01T09:30:00Z");
  const uitKaal = await datumUitBestand("schermafdruk.png", kaalPng, gemaakt);
  proef("Schermafdruk zonder eigen datum: de bestandsdatum telt",
    uitKaal.bron === "bestand" && uitKaal.datum.slice(0, 10) === "2026-08-01",
    `Gevonden: ${uitKaal.datum || "niets"} (${uitKaal.bron}).`);
  const uitNiets = await datumUitBestand("schermafdruk.png", kaalPng);
  proef("Geen enkele datum: dan blijft het eerlijk onbekend", uitNiets.datum === "" && uitNiets.bron === "onbekend",
    "Liever geen datum dan een verzonnen datum, want een verzonnen datum overschrijft alles.");

  // Foto met EXIF: wanneer de foto genomen is.
  const exifTekst = Buffer.from("2026:02:09 08:15:00\0", "latin1");
  const tiff = Buffer.alloc(26 + exifTekst.length);
  tiff.write("II", 0, "latin1"); tiff.writeUInt16LE(0x2a, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);                       // één veld in IFD0
  tiff.writeUInt16LE(0x0132, 10);                 // DateTime
  tiff.writeUInt16LE(2, 12); tiff.writeUInt32LE(exifTekst.length, 14);
  tiff.writeUInt32LE(26, 18);                     // waar de tekst staat
  tiff.writeUInt32LE(0, 22);                      // geen volgende IFD
  exifTekst.copy(tiff, 26);
  const app1 = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const kop = Buffer.alloc(4);
  kop.writeUInt16BE(0xffe1, 0); kop.writeUInt16BE(app1.length + 2, 2);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), kop, app1, Buffer.from([0xff, 0xd9])]);
  const uitFoto = await datumUitBestand("foto.jpg", jpeg, Date.now());
  proef("Foto: de datum waarop hij genomen is komt eruit",
    uitFoto.bron === "document" && uitFoto.datum.slice(0, 10) === "2026-02-09",
    `Gevonden: ${uitFoto.datum || "niets"} (${uitFoto.bron}).`);
}

void bestandsproeven()
  .catch((e) => { proef("de bestandsproeven konden draaien", false, (e as Error).message); })
  .then(() => {
    console.log(fouten === 0 ? "\nAlles goed: de nieuwste wint, en zonder datum wint niemand." : `\n${fouten} fout(en).`);
    if (fouten > 0) process.exit(1);
  });

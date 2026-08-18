// ═══════════════════════════════════════════════════════════
// VAN WANNEER IS DEZE INFORMATIE? (één plek waar dat bepaald wordt)
// ═══════════════════════════════════════════════════════════
// Het dashboard mag pas zelf beslissen welke waarde wint als het van elk stuk
// informatie weet hoe oud het is. Dat is niet het moment waarop iets in het
// dashboard kwam: een klant kan vandaag een Word-document sturen dat hij in mei
// voor het laatst heeft bijgewerkt, en dat mag een adres van vorige week niet
// overschrijven.
//
// De volgorde is bewust, van betrouwbaar naar zwak:
//  1. de datum ín het document zelf (Word, Excel en pdf schrijven op wanneer ze
//     voor het laatst zijn opgeslagen; een foto schrijft op wanneer hij genomen
//     is). Dit reist mee met het bestand, ook als het doorgestuurd wordt.
//  2. de datum van het bestand op de computer (meegestuurd door de browser).
//     Klopt voor een screenshot die je zelf maakt, maar springt naar vandaag
//     zodra je iets uit een mail of Drive downloadt. Daarom pas als tweede.
//  3. niets. En dan is het antwoord ook echt "onbekend", geen slimme gok:
//     zonder datum mag een waarde niets overschrijven.
//
// Alles wat een datum nodig heeft, vraagt hem hier. Nooit ergens een tweede
// manier om dit uit te rekenen; dan lopen ze uit elkaar en weet niemand meer
// waarom het ene scherm iets anders zegt dan het andere.
// ═══════════════════════════════════════════════════════════

/** Waar een datum vandaan komt. De volgorde hierboven, plus "onbekend". */
export type DatumBron = "document" | "bestand" | "drive" | "geplakt" | "handmatig" | "opgehaald" | "mail" | "onbekend";

export type BronDatum = {
  /** ISO-datum, of leeg als er niets betrouwbaars te vinden was. */
  datum: string;
  bron: DatumBron;
  /** Eén zin in gewone taal, voor op het scherm. */
  uitleg: string;
};

export const GEEN_DATUM: BronDatum = { datum: "", bron: "onbekend", uitleg: "Van dit materiaal is geen datum te vinden." };

const BRON_TEKST: Record<DatumBron, string> = {
  document: "staat in het document zelf",
  bestand: "datum van het bestand",
  drive: "laatst gewijzigd in Drive",
  geplakt: "door jou geplakt",
  handmatig: "zelf ingevuld",
  opgehaald: "door ons opgehaald",
  mail: "datum van de mail",
  onbekend: "geen datum bekend",
};

/**
 * Is dit een datum waar we iets mee kunnen?
 *
 * Twee soorten onzin komen echt voor en zouden allebei het verkeerde laten
 * winnen: 1970 (een leeg veld dat als tijdstempel wordt gelezen) en een datum
 * in de toekomst (een computer met een verkeerde klok, of een sjabloon met een
 * verzonnen datum). Allebei tellen ze als "geen datum", want fout is erger dan
 * onbekend: onbekend overschrijft niets, fout overschrijft alles.
 */
export function bruikbareDatum(d: Date | null | undefined): boolean {
  if (!d || isNaN(d.getTime())) return false;
  const jaar = d.getFullYear();
  const morgen = Date.now() + 36 * 60 * 60 * 1000; // een dag speling voor tijdzones
  return jaar >= 2000 && d.getTime() <= morgen;
}

export function maakBronDatum(d: Date | null | undefined, bron: DatumBron, extra = ""): BronDatum {
  if (!bruikbareDatum(d)) return GEEN_DATUM;
  const iso = (d as Date).toISOString();
  return { datum: iso, bron, uitleg: `${leesbaar(iso)} (${BRON_TEKST[bron]}${extra ? `, ${extra}` : ""})` };
}

/** Datum als "12 aug 2026", voor op het scherm. */
export function leesbaar(iso: string): string {
  if (!iso) return "datum onbekend";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso.slice(0, 10); }
}

// ─── 1. De datum in het document zelf ───

/** Word en Excel: docProps/core.xml bewaart wanneer het bestand is opgeslagen. */
async function uitOfficeBestand(buf: Buffer): Promise<Date | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSZip: typeof import("jszip") = require("jszip");
    const zip = await JSZip.loadAsync(buf);
    const kern = zip.file("docProps/core.xml");
    if (!kern) return null;
    const xml = await kern.async("string");
    // Bij voorkeur "modified": dat is wanneer de inhoud voor het laatst is
    // aangepast. "created" is wanneer het bestand ooit is aangemaakt, en dat is
    // bij een sjabloon dat al jaren rondgaat misleidend oud.
    const m = xml.match(/<dcterms:modified[^>]*>([^<]+)</) || xml.match(/<dcterms:created[^>]*>([^<]+)</);
    return m ? new Date(m[1]) : null;
  } catch { return null; }
}

/** Pdf: /ModDate of /CreationDate, geschreven als D:20260812101100+02'00'. */
function uitPdf(buf: Buffer): Date | null {
  try {
    // Alleen de kop en de staart doorzoeken: de metadata staat daar, en een pdf
    // van tientallen megabytes hoeven we niet helemaal als tekst te lezen.
    const kop = buf.subarray(0, Math.min(buf.length, 40000)).toString("latin1");
    const staart = buf.subarray(Math.max(0, buf.length - 40000)).toString("latin1");
    const tekst = kop + staart;
    const m = tekst.match(/\/ModDate\s*\(\s*D:(\d{14}|\d{12}|\d{8})/) || tekst.match(/\/CreationDate\s*\(\s*D:(\d{14}|\d{12}|\d{8})/);
    if (!m) return null;
    const s = m[1];
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10) || "12"}:${s.slice(10, 12) || "00"}:${s.slice(12, 14) || "00"}Z`;
    return new Date(iso);
  } catch { return null; }
}

/** "2026:08:12 10:11:00" (de notatie van een fototoestel) naar een echte datum. */
function uitExifTekst(s: string): Date | null {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : null;
}

/**
 * Foto (jpeg): de EXIF-gegevens bewaren wanneer de foto genomen is.
 *
 * Met de hand uitgelezen in plaats van met een pakket erbij: het is één blokje
 * met een vaste indeling, en een extra afhankelijkheid voor twee tags erbij
 * halen kost meer dan het oplevert.
 */
function uitJpeg(buf: Buffer): Date | null {
  try {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let p = 2;
    while (p + 4 < buf.length) {
      if (buf[p] !== 0xff) break;
      const merk = buf[p + 1];
      const lengte = buf.readUInt16BE(p + 2);
      if (merk === 0xe1 && buf.subarray(p + 4, p + 10).toString("latin1") === "Exif\0\0") {
        const tiff = p + 10;
        const groot = buf.subarray(tiff, tiff + 2).toString("latin1") === "MM";
        const u16 = (o: number) => (groot ? buf.readUInt16BE(o) : buf.readUInt16LE(o));
        const u32 = (o: number) => (groot ? buf.readUInt32BE(o) : buf.readUInt32LE(o));
        const leesIfd = (start: number, zoek: number[]): { tekst?: string; exifOffset?: number } => {
          if (start + 2 > buf.length) return {};
          const aantal = u16(start);
          const uit: { tekst?: string; exifOffset?: number } = {};
          for (let i = 0; i < aantal; i++) {
            const veld = start + 2 + i * 12;
            if (veld + 12 > buf.length) break;
            const tag = u16(veld);
            if (tag === 0x8769) uit.exifOffset = tiff + u32(veld + 8);
            if (zoek.includes(tag) && !uit.tekst) {
              const lang = u32(veld + 4);
              const waar = tiff + u32(veld + 8);
              if (waar + lang <= buf.length) uit.tekst = buf.subarray(waar, waar + Math.min(lang, 32)).toString("latin1");
            }
          }
          return uit;
        };
        const ifd0 = leesIfd(tiff + u32(tiff + 4), [0x0132]);
        // DateTimeOriginal (wanneer de foto genomen is) gaat voor DateTime
        // (wanneer het bestand voor het laatst is aangeraakt).
        const exif = ifd0.exifOffset ? leesIfd(ifd0.exifOffset, [0x9003, 0x9004]) : {};
        return uitExifTekst(exif.tekst || ifd0.tekst || "");
      }
      if (merk === 0xda) break;                 // hierna komt de beeldinhoud
      p += 2 + (lengte > 0 ? lengte : 0);
    }
    return null;
  } catch { return null; }
}

/**
 * Png: het tIME-blokje bewaart wanneer het plaatje is gemaakt.
 *
 * Let op: veel schermafdrukken hebben dit blokje niet. Dan valt de bepaling
 * hieronder terug op de datum van het bestand, en dat is voor een schermafdruk
 * die je zelf net gemaakt hebt precies goed.
 */
function uitPng(buf: Buffer): Date | null {
  try {
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    let p = 8;
    while (p + 8 <= buf.length) {
      const lengte = buf.readUInt32BE(p);
      const soort = buf.subarray(p + 4, p + 8).toString("latin1");
      if (soort === "tIME" && lengte === 7 && p + 15 <= buf.length) {
        const d = buf.subarray(p + 8, p + 15);
        return new Date(Date.UTC(d.readUInt16BE(0), d[2] - 1, d[3], d[4], d[5], d[6]));
      }
      if (soort === "IDAT" || soort === "IEND") break;  // hierna komt alleen beeld
      p += 12 + lengte;
    }
    return null;
  } catch { return null; }
}

/**
 * Van wanneer is de inhoud van dit bestand?
 *
 * `bestandMs` is de datum die de browser meestuurt (wanneer het bestand op de
 * computer voor het laatst is gewijzigd). Die telt alleen mee als er in het
 * document zelf niets staat.
 */
export async function datumUitBestand(naam: string, buf: Buffer, bestandMs?: number): Promise<BronDatum> {
  const n = (naam || "").toLowerCase();
  let uitInhoud: Date | null = null;
  let wat = "";
  if (/\.(docx|xlsx|xlsm|pptx)$/.test(n)) { uitInhoud = await uitOfficeBestand(buf); wat = "laatst opgeslagen"; }
  else if (/\.pdf$/.test(n)) { uitInhoud = uitPdf(buf); wat = "laatst opgeslagen"; }
  else if (/\.(jpe?g)$/.test(n)) { uitInhoud = uitJpeg(buf); wat = "foto genomen"; }
  else if (/\.png$/.test(n)) { uitInhoud = uitPng(buf); wat = "plaatje gemaakt"; }
  if (bruikbareDatum(uitInhoud)) return maakBronDatum(uitInhoud, "document", wat);

  const uitBestand = bestandMs ? new Date(bestandMs) : null;
  if (bruikbareDatum(uitBestand)) return maakBronDatum(uitBestand, "bestand");
  return GEEN_DATUM;
}

/**
 * Welke van twee datums is nieuwer?
 *
 * Geeft true als `nieuw` echt later is dan `oud`. Ontbreekt een van beide, dan
 * is het antwoord false: dat is de hele afspraak, zonder datum wint niets. Een
 * bestaande waarde zonder datum blijft dus staan, en dat is met opzet, want die
 * heb jij ooit gecontroleerd.
 */
export function isNieuwerDan(nieuw: string, oud: string): boolean {
  if (!nieuw || !oud) return false;
  const a = new Date(nieuw).getTime(), b = new Date(oud).getTime();
  if (isNaN(a) || isNaN(b)) return false;
  return a > b;
}

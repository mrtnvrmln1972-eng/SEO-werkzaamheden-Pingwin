// ═══════════════════════════════════════════════════════════
// DE MAIL DIE AL IN HET GESPREK STAAT
// ═══════════════════════════════════════════════════════════
// Schrijft de assistent in een gesprek een complete mail (aanhef, alinea's,
// afsluiting), dan hoort die in het mailvenster te staan zodra je dat opent.
// Dat gebeurde niet: het venster begon leeg en de gesprekstekst ging alleen als
// achtergrond naar de achterkant, waar er een NIEUWE mail van gemaakt werd.
//
// Het venster blijft bewust leeg als er géén mail in het gesprek staat. Een
// analyse of een lijstje is geen mail; die als voorzet neerzetten betekent dat
// je hem eerst moet weggooien voor je zelf kunt dicteren. Vandaar dat we op
// vorm herkennen: een aanhef én een afsluiting.

export type MailConcept = { onderwerp: string; body: string };

const AANHEF = /^(beste|hallo|hoi|dag|geachte)\b[^\n]{0,60}$/i;
const AFSLUITING = /^(met vriendelijke groet|vriendelijke groet|hartelijke groet|groeten|groet|met hartelijke groet)\b/i;

// Kopregels en opmaakruis die niet in een mail thuishoren.
function kaal(regel: string): string {
  return regel.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
}

export function mailUitTekst(tekst: string): MailConcept | null {
  const regels = (tekst || "").split("\n");
  let start = -1;
  for (let i = 0; i < regels.length; i++) {
    if (AANHEF.test(kaal(regels[i]))) { start = i; break; }
  }
  if (start < 0) return null;

  // De afsluiting hoort ná de aanhef te komen; alles daarna (naam, bedrijf) hoort
  // er nog bij, maar een vraag van de assistent eronder ("Wil je nog iets
  // aanpassen?") niet.
  let eind = -1;
  for (let i = start + 1; i < regels.length; i++) {
    if (AFSLUITING.test(kaal(regels[i]))) { eind = i; break; }
  }
  if (eind < 0) return null;

  // Na de afsluiting hoogstens drie korte regels meenemen (naam, functie,
  // bedrijf). Een lege regel gevolgd door een lange zin is de assistent die weer
  // tegen Maarten praat, niet de mail.
  let laatste = eind;
  for (let i = eind + 1; i < Math.min(regels.length, eind + 5); i++) {
    const r = kaal(regels[i]);
    if (!r) continue;
    if (r.length > 60 || /\?$/.test(r)) break;
    laatste = i;
  }

  const body = regels.slice(start, laatste + 1).map(kaal).join("\n").trim();
  if (!body) return null;

  // Staat er vlak boven de aanhef een onderwerpregel, neem die dan mee.
  let onderwerp = "";
  for (let i = start - 1; i >= Math.max(0, start - 4); i--) {
    const m = /^\s*onderwerp\s*:\s*(.+)$/i.exec(kaal(regels[i]));
    if (m) { onderwerp = m[1].replace(/^["']|["']$/g, "").trim(); break; }
  }

  return { onderwerp, body };
}

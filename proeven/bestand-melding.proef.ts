// Proef op het herkennen van oude "document toegevoegd aan het dossier"-blokken.
//
// Waarom dit bestand er is: die blokken worden in de weergave samengevouwen tot
// één regel. Dat mag maar op één manier misgaan, en dan meteen goed: als het
// patroon te ruim is, verdwijnt een vraag die Maarten zélf typte achter een
// pijltje. Daarom staat hier vast wat er wél en wat er niet onder valt, en dat de
// samenvatting eronder volledig bewaard blijft (er wordt niets weggegooid).

import { bestandMelding } from "../lib/bestand-melding";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = JSON.stringify(gekregen) === JSON.stringify(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

// Zoals het er in de gesprekken van Kamsteeg Tuinen echt in staat.
const ECHT = [
  "Document toegevoegd aan het dossier: [Kamsteeg-zoekwoorden-samenvatting.docx](https://drive.google.com/file/d/abc123/view?usp=sharing)",
  "",
  "Het document beschrijft de zoekwoordstrategie voor Kamsteeg Tuinen, gericht op lokale plaatsen rondom Breda.",
].join("\n");

const m = bestandMelding(ECHT);
check("wat", m?.wat, "Document");
check("naam", m?.naam, "Kamsteeg-zoekwoorden-samenvatting.docx");
check("link", m?.link, "https://drive.google.com/file/d/abc123/view?usp=sharing");
check("de samenvatting blijft volledig bewaard", m?.kern,
  "Het document beschrijft de zoekwoordstrategie voor Kamsteeg Tuinen, gericht op lokale plaatsen rondom Breda.");

// Een afbeelding meldde zich met hetzelfde patroon, maar zonder Drive-link.
const beeld = bestandMelding("Afbeelding toegevoegd aan het dossier: schermafdruk.png");
check("afbeelding zonder link, wat", beeld?.wat, "Afbeelding");
check("afbeelding zonder link, naam", beeld?.naam, "schermafdruk.png");
check("afbeelding zonder link, geen link", beeld?.link, "");
check("afbeelding zonder link, geen samenvatting", beeld?.kern, "");

// En dit is waar het niet mag toeslaan: gewone tekst van Maarten zelf.
check("een eigen vraag blijft een vraag",
  bestandMelding("Kun je het document dat ik aan het dossier toegevoegd heb even lezen?"), null);
check("een melding zonder naam telt niet",
  bestandMelding("Document toegevoegd aan het dossier:"), null);
check("alleen de eerste regel telt, niet ergens middenin",
  bestandMelding("Even kijken.\nDocument toegevoegd aan het dossier: iets.docx"), null);
check("lege inhoud", bestandMelding(""), null);

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

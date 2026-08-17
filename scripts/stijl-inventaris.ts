// Schrijft de stijlmeting weg naar lib/stijl-inventaris.json.
//
// WAAROM DIT EEN BESTAND WORDT EN GEEN LIVE METING
// ════════════════════════════════════════════════
// `/admin/stijl` zou de meting net zo goed zelf kunnen doen, maar dan leest een
// draaiende server broncode van schijf. Op Vercel staat die broncode er niet
// altijd (de bouw pakt alleen in wat hij denkt nodig te hebben), dus dat scherm
// zou het lokaal doen en live niet. Daarom meten we bij de bouw en zetten we de
// uitkomst in een bestand dat gewoon meegaat.
//
// Draait als onderdeel van `prebuild`, dus bij élke bouw en dus ook op Vercel.
// Het bestand dat eruit komt staat in git, zodat je in een diff ziet dat het
// aantal kleuren omlaag ging. Dat is het hele punt van meten.

import fs from "fs";
import path from "path";
import { meet, WORTEL } from "../lib/stijl-meting";

const doel = path.join(WORTEL, "lib", "stijl-inventaris.json");
const meting = meet();

// Zonder tijdstempel, met opzet. Een datum in dit bestand betekent dat élke
// bouw een wijziging oplevert, en dan staat er straks bij elke commit een
// verandering die niets betekent. Nu verandert het bestand alleen als de stijl
// echt verandert.
fs.writeFileSync(doel, JSON.stringify(meting, null, 2) + "\n");

console.log(
  `Stijlmeting weggeschreven: ${meting.kleuren.verschillend} kleuren, ` +
  `${meting.lettergroottes.verschillend} lettergroottes, ` +
  `${meting.afstanden.verschillend} afstanden, ` +
  `${meting.inline.metVasteWaarde} losse opmaakregels in schermen.`
);

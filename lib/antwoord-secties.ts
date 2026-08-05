// Een assistent-antwoord opdelen in secties, op één plek.
//
// Het scherm knipt een antwoord per "## "-kop in blokken: de kop wordt een oranje
// titel boven een eigen kaart, de rest van de sectie is de inhoud. Die knip stond
// alleen in AntwoordBlokken.tsx, dus toen we hetzelfde antwoord gingen mailen
// kreeg de mail de tekst in één stuk. Gevolg: geen kaarten, en de koppen bleven
// gewone tekst die als grijs regeltje aankwam in plaats van als oranje titel.
//
// Nu delen scherm en mail deze functie, zodat ze niet meer uit elkaar kunnen lopen.

import { striptVulzinnen } from "./vulzinnen";

export type Sectie = { kop: string; md: string };

/**
 * Splitst een antwoord per "## "-kop. Tekst vóór de eerste kop wordt een
 * intro-sectie zonder kop. De kop-regel zelf verdwijnt uit de inhoud, want die
 * wordt apart gerenderd (als titel op het scherm, als titelbalk in de mail).
 */
export function splitsAntwoord(content: string): Sectie[] {
  // Aankondigingszinnen ("Dan heb ik nu het volledige beeld. Hier is wat er
  // speelt:") gaan eruit vóór het opsplitsen, anders wordt zo'n zin een eigen blok.
  const schoon = striptVulzinnen(content || "");
  const secties: Sectie[] = [];
  let kop = "";
  let buf: string[] = [];
  const triviaal = (md: string) => !md.split("\n").some((r) => r.replace(/[-*_#\s]/g, "").length > 0);
  const push = () => {
    const md = buf.join("\n").trim();
    if (kop || (md && !triviaal(md))) secties.push({ kop, md });
    buf = [];
  };
  for (const r of schoon.split("\n")) {
    const m = /^##\s+(.*)$/.exec(r.trim());
    if (m) { push(); kop = m[1].replace(/[#*]/g, "").trim(); }
    else buf.push(r);
  }
  push();
  return secties;
}

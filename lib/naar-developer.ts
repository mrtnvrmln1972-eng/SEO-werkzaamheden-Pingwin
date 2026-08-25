// ═══════════════════════════════════════════════════════════
// WAT EEN DEVELOPER KRIJGT: DE LINK NAAR HET DOCUMENT, EN VERDER NIETS
// ═══════════════════════════════════════════════════════════
// Op 25-08-2026 ging de taak met de ondersteunende teksten van GardenSwimm naar
// de developer, en wat hij kreeg was onbruikbaar. In het taakvenster stonden
// "Aantekeningen bij deze taak" en "Links uit deze taak" met daarin twee keer een
// linkje dat letterlijk "Mail" heette; in het mailvenster stonden diezelfde drie
// vinkjes nog een keer, en in de mailtekst kwam het woord "mail" zes keer voor.
// Maartens oordeel: "aan deze twee versies heb ik natuurlijk geen klote. Een
// developer moet niet hoeven nadenken; die moet een eenduidige tekst krijgen om
// meteen helder te hebben wat je moet doen."
//
// De regel die daaruit volgt geldt vanaf nu voor ÉLKE taak en ÉLKE mail die naar
// een developer gaat, in het hele dashboard:
//
//   * Alleen de link naar de geldende versie van het document. Dat is het stuk
//     waar wij over nagedacht hebben en dat hij op de site moet zetten.
//   * Geen context. Geen aantekeningen, geen links die in die aantekeningen
//     stonden, geen mailverwijzingen, geen "waar het over gaat"-lijstje.
//   * Maarten zet er zelf één zin bij ("kun je deze aangepaste teksten op de
//     website van X zetten?"). Die zin is de opdracht; de rest is ruis.
//
// Dit draait de keuze van 20-08-2026 terug. Toen ging er bij Nationaal Oogcentrum
// een taak weg zonder de stukken die in de aantekeningen stonden, en is besloten
// om élke link uit dat veld mee te sturen. Dat loste één geval op en maakte de
// standaard slechter: bij elke andere taak kwam er een rij losse verwijzingen mee
// die niemand nodig had. Wat er nu ligt is de omgekeerde standaard, met een
// ontsnapping: die links staan nog steeds in het venster en je kunt ze
// aanvinken, ze staan alleen niet meer vanzelf aan.
//
// Let op het verschil met een mail aan de KLANT. Daar mag context wél; een klant
// leest een verhaal, een developer voert iets uit. Deze module gaat alleen over
// de developer-route.
// ═══════════════════════════════════════════════════════════

/** Het minimale dat een document moet hebben om mee te kunnen. */
export type MeeTeSturenDoc = { url: string; ouder?: boolean };

/**
 * Wat er bij een developer standaard aanstaat: de geldende documenten.
 *
 * "Geldend" is wat `lib/laatste-versie.ts` bepaalt: van elke soort de nieuwste,
 * de rest krijgt `ouder`. Een oudere versie meesturen is precies de fout die je
 * niet wilt maken, dus die staat uit; hij blijft wel aanvinkbaar.
 *
 * De pagina zelf staat er bewust NIET standaard bij. Dat leek behulpzaam, maar
 * het is de eerste stap terug naar een lijstje: het document zegt zelf al bij
 * welke pagina het hoort, en Maarten schrijft de zin erbij.
 */
export function standaardMee(docs: MeeTeSturenDoc[]): string[] {
  return (docs || []).filter((d) => d.url && !d.ouder).map((d) => d.url);
}

/**
 * De mail aan een developer: jouw zin, en daaronder de links. Verder niets.
 *
 * Geen aanhef vol context, geen "Over deze taak uit de developerlijst" met een
 * opsomming van klant, taak en pagina eronder. Wat hij moet doen staat in de zin
 * die Maarten schrijft; waar het staat, staat in de link.
 */
export function developerMailHtml(opts: {
  /** De zin die Maarten zelf schrijft. */
  zin: string;
  /** De documenten die aanstaan, in volgorde. */
  docs: { label: string; url: string }[];
  /** Ontsnapt HTML-tekens; meegegeven zodat dit bestand niets hoeft te importeren. */
  esc: (s: string) => string;
}): string {
  const { zin, docs, esc } = opts;
  const regels = (docs || [])
    .filter((d) => (d.url || "").trim())
    .map((d) => `<li><a href="${esc(d.url)}">${esc(d.label || d.url)}</a></li>`);
  const tekst = (zin || "").trim();
  return [
    "<p>Hoi,</p>",
    tekst ? `<p>${esc(tekst).replace(/\n/g, "<br>")}</p>` : "",
    regels.length ? `<ul>${regels.join("")}</ul>` : "",
    "<p>Groet</p>",
  ].filter(Boolean).join("");
}

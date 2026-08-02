// ═══════════════════════════════════════════════════════════
// VULZINNEN: NOOIT MEER, NERGENS MEER
// ═══════════════════════════════════════════════════════════
// "Dan heb ik nu het volledige beeld." "Hier is wat er speelt:" Zinnen die alleen
// aankondigen dat er iets komt, zonder zelf iets te zeggen. Ze kosten leestijd,
// nemen ruimte in beeld, en in de Bird's eye werd zo'n zin zelfs een eigen blokje
// met een knop om er een taak van te maken.
//
// Dit filter bestond al, maar als losse functie in OverviewChat.tsx met een smallere
// lijst: hij kende "Nu heb ik" en niet "Dan heb ik", dus precies die zin glipte er
// doorheen. En hij keek alleen naar het BEGIN van een antwoord en draaide alleen in
// de Bird's eye, niet in de kaart-chat of de documenten.
//
// Weergave-laag, dus het geldt meteen voor alles wat er al staat.

// Bewust NAUW omschreven in plaats van een ruime vangst. Een eerdere, lossere versie
// haalde ook echte inhoud weg ("Hier is een concreet probleem: de meta-description
// ontbreekt op vier pagina's"). Informatie kwijtraken is erger dan een vulzin laten
// staan, dus liever een enkele die ontsnapt dan één regel te veel weg.
const AANKONDIGING = new RegExp(
  "^(" +
  "(dan |nu |zo |ok[eé][,.]? |goed[,.]? |prima[,.]? )*" +
  "(" +
  "(nu )?heb ik (nu )?(het|een|de) (volledige|complete|hele|scherpe|goede) (beeld|overzicht|plaatje)" +
  "|(nu )?heb ik alles( wat ik nodig heb)?" +
  "|ik heb alles wat ik nodig heb" +
  "|hier (is|komt|volgt|zie je) (de|het|een|wat|mijn)\\b" +
  "|hieronder (volgt|staat|zie je|vind je)\\b" +
  "|dit is wat er speelt" +
  "|ik ga (nu |dan |even )?(aan de slag|beginnen|starten|het uitzoeken|de kaarten|hieronder)" +
  "|laten we (dan )?(even |eerst )?(kijken|beginnen|starten)\\b" +
  "|even (kijken|checken|nagaan)\\b" +
  "|keur ze goed" +
  "|laat (het )?maar weten" +
  "|zeg het maar" +
  ")" +
  ")",
  "i",
);

// Bevat deze zin iets concreets? Dan is het per definitie geen vulzin, hoe hij ook
// begint. Een cijfer, een pad of een geciteerde term is altijd inhoud.
function bevatFeit(zin: string): boolean {
  return /\d/.test(zin) || /\//.test(zin) || /["'“”„]/.test(zin);
}

// Eén regel kan meerdere zinnen bevatten ("Dan heb ik nu het volledige beeld. Hier
// is wat er speelt:"). Alleen als ELKE zin een vulzin is, mag de regel weg.
function zinnenVan(regel: string): string[] {
  return regel.split(/(?<=[.!?:])\s+/).map((z) => z.trim()).filter(Boolean);
}

function zinIsVulzin(zin: string): boolean {
  if (bevatFeit(zin)) return false;
  if (zin.split(/\s+/).length > 10) return false;   // te lang voor een loze aankondiging
  return AANKONDIGING.test(zin);
}

/** Is dit een regel die alleen aankondigt en verder niets zegt? */
export function isVulzin(regel: string): boolean {
  const r = (regel || "").trim();
  if (!r || r.length > 160) return false;
  if (/^#{1,6}\s/.test(r)) return false;        // kopje
  if (/^[-*]\s/.test(r)) return false;          // bullet kan echte inhoud zijn
  if (/^\|/.test(r)) return false;              // tabelrij
  if (/^-{3,}$/.test(r)) return false;          // scheidingslijn
  const zinnen = zinnenVan(r);
  return zinnen.length > 0 && zinnen.every(zinIsVulzin);
}

/**
 * Haalt vulzinnen uit een tekst. Niet alleen bovenaan: ze duiken ook op na een
 * scheidingslijn of tussen twee blokken, en daar zijn ze net zo overbodig.
 *
 * Levert nooit een lege tekst op: blijft er niets over, dan komt het origineel
 * terug. Liever een vulzin dan een leeg scherm.
 */
export function striptVulzinnen(md: string): string {
  const uit = (md || "").split("\n").filter((r) => !isVulzin(r));
  const samen = uit.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return samen || (md || "").trim();
}

/** Houdt dit blok tekst nog iets inhoudelijks over, of bleef er alleen ruis? */
export function heeftInhoud(md: string): boolean {
  return (md || "").split("\n").some((r) => {
    const t = r.trim();
    if (!t || isVulzin(t)) return false;
    return t.replace(/[-*_#|\s]/g, "").length > 0;   // kale opmaaktekens tellen niet
  });
}

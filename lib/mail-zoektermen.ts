// ═══════════════════════════════════════════════════════════
// WAAR ZOEK JE OP ALS IEMAND EEN VRAAG STELT OVER ZIJN MAIL?
// ═══════════════════════════════════════════════════════════
// Wat er misging (20-08-2026, Nationaal Oogcentrum): Maarten vroeg in het
// dashboard naar "mail van pehlevian" en kreeg één mailwisseling terug, over
// inkoopprijzen. In Superhuman stond precies de mail die hij zocht: een thread
// van 31 juli met Emre Pehlivan over de nieuwe lenzenpagina's. Het dashboard
// vond hem niet.
//
// De oorzaak was niet het zoeken maar het NIET zoeken. Het vraagveld haalde de
// zestig meest recente mails van die klant op en legde die aan de AI voor; met
// de woorden van de vraag werd nooit iets gedaan. Staat de mail die je zoekt
// niet in die zestig, dan bestaat hij voor het antwoord domweg niet.
//
// Deze module maakt van een vraag in gewone taal een paar zoekwoorden, en
// corrigeert een verschreven naam tegen de mensen met wie je écht mailt.
// "pehlevian" wordt "Pehlivan" omdat die naam in de correspondentie voorkomt;
// zonder dat blijft een typefout een lege zoekopdracht.
// ═══════════════════════════════════════════════════════════

// Woorden die in élke vraag zitten en dus niets zeggen over wat je zoekt.
// Bewust kort gehouden: liever één ruis-woord te veel opzoeken dan het woord
// missen waar het om ging.
const STOPWOORDEN = new Set([
  "de", "het", "een", "en", "of", "van", "voor", "met", "over", "bij", "aan", "in", "op", "om", "te", "dat", "die", "dit",
  "is", "zijn", "was", "waren", "wordt", "worden", "heb", "heeft", "hebben", "had", "kan", "kun", "kunt", "kunnen",
  "wat", "wie", "waar", "wanneer", "hoe", "welke", "welk", "waarom",
  "ik", "je", "jij", "we", "wij", "hij", "zij", "ze", "er", "mijn", "onze",
  "mail", "mails", "mailtje", "mailwisseling", "bericht", "berichten", "e-mail", "email",
  "zoek", "zoeken", "vind", "vinden", "even", "nog", "ook", "wel", "niet", "graag", "alles", "iets",
]);

/**
 * De woorden uit een vraag waarop het zin heeft te zoeken.
 *
 * Tekst tussen aanhalingstekens blijft als één term staan (een documentnaam of
 * een onderwerpregel hoort niet uit elkaar getrokken te worden). Verder: alles
 * van drie letters of meer dat geen stopwoord is, hoogstens vijf termen, want
 * elke term is een aparte vraag aan de mailbox.
 */
export function zoektermenUitVraag(vraag: string, max = 5): string[] {
  const tekst = String(vraag || "");
  const uit: string[] = [];
  const gezien = new Set<string>();
  const voegToe = (t: string) => {
    const s = t.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (s.length < 3) return;
    const k = s.toLowerCase();
    if (gezien.has(k)) return;
    gezien.add(k);
    uit.push(s);
  };

  // 1. Alles tussen aanhalingstekens blijft één geheel.
  const rest = tekst.replace(/["'«»„”]([^"'«»„”]{3,80})["'«»„”]/gu, (_m, inhoud: string) => {
    voegToe(inhoud);
    return " ";
  });

  // 2. Losse woorden, stopwoorden eruit.
  for (const w of rest.split(/[\s,.;:!?()[\]/\\]+/u)) {
    if (STOPWOORDEN.has(w.toLowerCase())) continue;
    voegToe(w);
  }
  return uit.slice(0, max);
}

/** Hoeveel losse wijzigingen scheiden twee woorden? (Levenshtein, klein en genoeg.) */
export function afstand(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  const rij = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    let vorig = rij[0];
    rij[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const tijdelijk = rij[j];
      rij[j] = Math.min(
        rij[j] + 1,              // weglaten
        rij[j - 1] + 1,          // toevoegen
        vorig + (s[i - 1] === t[j - 1] ? 0 : 1), // vervangen
      );
      vorig = tijdelijk;
    }
  }
  return rij[t.length];
}

/**
 * Een verschreven naam bijtrekken naar iemand met wie je echt mailt.
 *
 * "pehlevian" tegen de namen uit de correspondentie levert "Pehlivan": twee
 * wijzigingen. Boven de drempel laten we het woord met rust, want dan is het
 * geen typefout maar gewoon een ander woord. De drempel schaalt mee met de
 * lengte: bij een kort woord is één wijziging al een heel ander woord.
 */
export function corrigeerNaam(term: string, bekendeNamen: string[]): string {
  const t = term.trim();
  if (t.length < 4) return t;
  const drempel = t.length <= 6 ? 1 : t.length <= 9 ? 2 : 3;
  let beste = t;
  let besteAfstand = drempel + 1;
  for (const naam of bekendeNamen) {
    // Een volledige naam ("Emre Pehlivan") toetsen we per woord: je zoekt op
    // een achternaam, niet op de hele regel.
    for (const deel of String(naam || "").split(/[\s<>@.,;]+/u)) {
      if (deel.length < 4) continue;
      if (deel.toLowerCase() === t.toLowerCase()) return deel;   // exact, klaar
      const d = afstand(t, deel);
      if (d > 0 && d <= drempel && d < besteAfstand) { beste = deel; besteAfstand = d; }
    }
  }
  return beste;
}

// ═══════════════════════════════════════════════════════════
// AFGEKAPTE AI-JSON REDDEN IN PLAATS VAN WEGGOOIEN
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat. Bij One Day Clinic mislukte het automatisch vullen van de
// bedrijfsgegevens met "Expected ',' or ']' after array element in JSON at
// position 6597". Dat is geen kapot antwoord: het antwoord was op dat punt
// gewoon afgeknipt omdat de tokenlimiet bereikt was. Alles daarvóór (de naam, het
// adres, de vestigingen, de eerste artsen) was prima, en werd toch weggegooid.
//
// Twee dingen doet dit bestand, in deze volgorde:
//
//  1. HET OBJECT UIT DE TEKST HALEN. Modellen zetten er soms een zin of een
//     ```json-blok omheen.
//  2. EEN AFGEKAPT OBJECT AFMAKEN. We lopen de tekst één keer door, onthouden de
//     laatste plek waar de structuur nog compleet was (het einde van een afgerond
//     element), knippen de halve staart eraf en sluiten de nog openstaande haakjes.
//     De halve arts die net begonnen was verdwijnt; de negen ervoor blijven staan.
//
// Bewust géén stille reparatie van écht kapotte JSON: alleen afgekapte staarten
// worden gered. Een antwoord dat halverwege onzin werd, hoort gewoon te falen.
// ═══════════════════════════════════════════════════════════

/** Haalt het buitenste JSON-object of de buitenste array uit een antwoord met tekst eromheen. */
export function pakJsonUitTekst(ruw: string): string {
  const schoon = String(ruw || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const startObj = schoon.indexOf("{");
  const startArr = schoon.indexOf("[");
  const start = startObj < 0 ? startArr : startArr < 0 ? startObj : Math.min(startObj, startArr);
  if (start < 0) return schoon;
  const open = schoon[start];
  const eind = schoon.lastIndexOf(open === "{" ? "}" : "]");
  return eind > start ? schoon.slice(start, eind + 1) : schoon.slice(start);
}

/**
 * Maakt een afgekapte JSON-tekst weer geldig door de onafgemaakte staart weg te
 * knippen en de openstaande haakjes te sluiten. Geeft null als er niets open
 * staat (dan is het een ander soort fout en mag hij gewoon falen).
 */
export function herstelAfgekapteJson(tekst: string): string | null {
  const t = String(tekst || "");
  const stapel: string[] = [];
  let inTekst = false, ontsnapt = false;
  let veiligTot = -1;
  let veiligeStapel: string[] = [];

  const merkVeilig = (index: number) => { veiligTot = index; veiligeStapel = [...stapel]; };

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inTekst) {
      if (ontsnapt) ontsnapt = false;
      else if (c === "\\") ontsnapt = true;
      else if (c === '"') inTekst = false;
      continue;
    }
    if (c === '"') { inTekst = true; continue; }
    if (c === "{" || c === "[") { stapel.push(c === "{" ? "}" : "]"); continue; }
    if (c === "}" || c === "]") { stapel.pop(); merkVeilig(i); continue; }
    // Een komma betekent: alles vóór deze komma was een afgerond element. Knip
    // daar desnoods, zodat een half element erna verdwijnt.
    if (c === ",") merkVeilig(i - 1);
  }

  if (!stapel.length) return null;      // niets open: geen afgekapte staart
  if (veiligTot < 0) return null;       // niets bruikbaars gevonden
  return t.slice(0, veiligTot + 1) + veiligeStapel.reverse().join("");
}

/**
 * Parseert het antwoord van een model. Lukt dat niet, dan wordt eerst geprobeerd
 * een afgekapte staart te herstellen. `afgekapt` zegt of dat nodig was, zodat de
 * aanroeper dat eerlijk kan melden ("gedeeltelijk ingevuld") in plaats van te doen
 * alsof alles er staat.
 */
export function parseJsonSoepel<T = unknown>(ruw: string): { ok: true; data: T; afgekapt: boolean } | { ok: false; error: string } {
  const kern = pakJsonUitTekst(ruw);
  try {
    return { ok: true, data: JSON.parse(kern) as T, afgekapt: false };
  } catch (e) {
    const hersteld = herstelAfgekapteJson(kern);
    if (hersteld) {
      try { return { ok: true, data: JSON.parse(hersteld) as T, afgekapt: true }; } catch { /* niet te redden */ }
    }
    return { ok: false, error: e instanceof Error ? e.message : "Ongeldige JSON." };
  }
}

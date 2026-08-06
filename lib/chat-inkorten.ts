import type { ChatMsg } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// GESPREKSGESCHIEDENIS INKORTEN
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: de pagina-chat stuurde bij elke vraag de laatste twaalf
// berichten ongekort mee. De AI las dus een stapel eigen rapporten terug en
// schreef er een nieuw rapport bij dat alles herhaalde plus een beetje nieuw.
// Het gesprek groeide zo elke beurt, en het bruikbare deel verdween onderaan.
//
// De oplossing is dezelfde als in beeld: jouw vragen blijven volledig staan
// (die zijn kort en bepalen de lijn), het laatste antwoord blijft volledig
// staan (daar gaat het gesprek over), en de antwoorden daarvoor gaan ingekort
// mee: de kopjes en de eerste regels. Genoeg om de draad vast te houden, te
// weinig om te kopiëren.
//
// LET OP: bij het samenvatten ("Vat samen & leg strategie vast") mag er níet
// ingekort worden; die stap hoort juist alles te overzien. Daarvoor bestaat de
// vlag `volledig` op het API-eindpunt.

const MAX_OUD_ANTWOORD = 900;   // tekens die van een ouder antwoord meegaan
const MAX_BERICHTEN = 12;       // hoeveel berichten er sowieso hoogstens meegaan

// De kern van een ouder antwoord: de kopjes plus de eerste regels eronder.
// Zonder kopjes gewoon het begin van de tekst.
function kern(tekst: string): string {
  const regels = (tekst || "").split("\n");
  const uit: string[] = [];
  let na = 0;
  for (const raw of regels) {
    const r = raw.trim();
    if (/^#{1,6}\s+/.test(r)) { uit.push(r); na = 2; continue; }
    if (na > 0 && r) { uit.push(r); na--; }
  }
  const samen = (uit.length ? uit.join("\n") : (tekst || "").trim()).slice(0, MAX_OUD_ANTWOORD);
  return samen.trim();
}

export function korteGeschiedenis(messages: ChatMsg[]): ChatMsg[] {
  const laatste = messages.slice(-MAX_BERICHTEN);
  let laatsteAntwoord = -1;
  for (let i = laatste.length - 1; i >= 0; i--) { if (laatste[i].role === "assistant") { laatsteAntwoord = i; break; } }
  return laatste.map((m, i) => {
    if (m.role !== "assistant" || i === laatsteAntwoord) return m;
    const tekst = String(m.content || "");
    if (tekst.length <= MAX_OUD_ANTWOORD) return m;
    return {
      ...m,
      content: `${kern(tekst)}\n\n(Dit eerdere antwoord staat hierboven volledig in het gesprek; hier ingekort. Herhaal het niet, verwijs ernaar.)`,
    };
  });
}

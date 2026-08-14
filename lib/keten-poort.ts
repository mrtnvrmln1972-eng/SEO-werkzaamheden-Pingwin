// ═══════════════════════════════════════════════════════════
// DE KETEN-POORT: GEEN DOCUMENT ALS DE STAPPEN ELKAAR TEGENSPREKEN
// ═══════════════════════════════════════════════════════════
// De documentketen (strategie → analyse → blauwdruk → copy) bouwt elke stap op
// de vorige. Als de verse meting van de pagina de vastgelegde strategie of een
// eerdere stap hard tegenspreekt (het plan zegt dat een sectie ontbreekt die
// live al bestaat, kiest een redirect-doel dat 404 geeft, noemt posities die
// niet kloppen), dan moet de keten BLOKKEREN in plaats van beide versies op te
// leveren. Eén ongeverifieerde claim richting een klant kost meer vertrouwen
// dan tien juiste claims opleveren (les uit de NOC-bijziendheid-casus,
// augustus 2026: de strategie noemde content-gaps die de sitebouwer net had
// gedicht, en de klant prikte daar direct doorheen).
//
// Bewuste keuzes:
// - Alleen HARDE, meetbare tegenspraken blokkeren. Een nuanceverschil of een
//   andere formulering is geen conflict; bij twijfel gaat de poort open.
// - Faalt de controle zelf (AI niet bereikbaar, JSON stuk), dan gaat de poort
//   open: de controle is een vangnet en mag nooit zelf de reden zijn dat er
//   niets meer gegenereerd kan worden.
// - De melding zegt precies wélke claim botst met wélk gemeten feit, en wat de
//   gebruiker moet doen (het plan bijwerken of de strategie opnieuw vastleggen).
// ═══════════════════════════════════════════════════════════

import { callClaude, LIGHT_MODEL } from "./anthropic";

export type KetenConflict = { claim: string; feit: string };

const POORT_SYSTEM = `Je controleert een SEO-documentketen op HARDE tegenspraken voordat de volgende stap gegenereerd wordt.
Je krijgt: (1) de verse, zojuist gemeten feiten van een pagina (live koppen, titel, Search Console, top-10), en (2) het vastgelegde plan en eventuele eerdere ketenstappen.
Vind UITSLUITEND harde, meetbare tegenspraken: een BEWERING OVER DE HUIDIGE WERKELIJKHEID die de verse meting weerlegt. Voorbeelden van een hard conflict:
- het plan of een eerdere stap zegt dat een sectie/kop/CTA/link NU AL ONTBREEKT of NU AL BESTAAT, terwijl de live koppen of de meting het tegendeel laten zien;
- er wordt een redirect of interne link voorgesteld naar een URL die volgens de meting niet bestaat (404);
- het plan noemt een HUIDIGE positie, een HUIDIG volume of een andere HUIDIGE gemeten waarde die meer dan een factor 2 afwijkt van de verse data;
- het plan kiest een primair zoekwoord dat lijnrecht ingaat tegen wat een eerdere ketenstap vastlegde.
GEEN conflict (poort open laten), dit is GEEN uitputtende lijst maar de meest voorkomende valkuil:
- een NORM, DOEL of CRITERIUM dat de volgende stap nog moet BEREIKEN (bijvoorbeeld "H2-dekking moet 60-80% zijn", "meta-description moet 120-155 tekens zijn"), ook als de huidige, gemeten waarde daar ver vanaf zit. Dat is geen tegenspraak, dat IS het gat dat de analyse hoort te signaleren en de volgende stap hoort te dichten; alleen een norm die het plan ten onrechte als AL BEHAALD beschrijft ("dekking is al 70%, dus klaar") is wél een conflict als de meting iets anders laat zien.
- een andere formulering, een mening, een dosering, iets dat de meting niet kan zien (bijvoorbeeld tekst onderaan de pagina die niet in de eerste koppen zit), of ontbrekende data.
Bij twijfel: geen conflict.
Antwoord met UITSLUITEND geldige JSON, exact dit formaat, niets eromheen:
{"conflicten":[{"claim":"wat het plan of de eerdere stap beweert, kort","feit":"wat de verse meting laat zien, kort"}]}
Geen tegenspraken: {"conflicten":[]}. Maximaal 5 conflicten, de hardste eerst. Geen emoji.`;

// Vindt harde tegenspraken tussen de verse meting en het plan/de eerdere
// ketenstappen. Geeft [] terug bij twijfel én bij een falende controle.
export async function vindKetenConflicten(slug: string, contextText: string, chain: string): Promise<KetenConflict[]> {
  // Zonder plan en zonder eerdere stappen valt er niets tegen te spreken.
  const heeftPlan = /OVERGENOMEN PLAN VOOR DEZE PAGINA \(de strategische conclusie, leidend\): (?!\(nog geen plan)/.test(contextText);
  if (!heeftPlan && !chain.trim()) return [];
  try {
    const user = `VERSE METING EN VASTGELEGD PLAN:\n${contextText.slice(0, 16000)}\n${chain ? `\nEERDERE KETENSTAPPEN:\n${chain.slice(0, 8000)}` : ""}`;
    const raw = await callClaude(POORT_SYSTEM, [{ role: "user", content: user }], 1200, { slug, action: "keten_poort" }, LIGHT_MODEL);
    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    const lijst = Array.isArray(parsed.conflicten) ? parsed.conflicten : [];
    return lijst
      .filter((c: { claim?: string; feit?: string }) => c && typeof c.claim === "string" && c.claim.trim() && typeof c.feit === "string" && c.feit.trim())
      .slice(0, 5)
      .map((c: { claim: string; feit: string }) => ({ claim: c.claim.trim(), feit: c.feit.trim() }));
  } catch {
    return [];
  }
}

// De nette blokkade-melding voor in het scherm: welke claim botst met welk
// feit, en wat de gebruiker moet doen om verder te kunnen.
export function ketenBlokkade(conflicten: KetenConflict[]): string {
  const regels = conflicten.map((c) => `• Het plan zegt: ${c.claim} — maar de verse meting laat zien: ${c.feit}`).join("\n");
  return `Document niet gegenereerd: de verse meting van de pagina spreekt de vastgelegde strategie of een eerdere stap tegen.\n${regels}\nWerk eerst het plan bij (of leg de strategie opnieuw vast via de chat, die meet de pagina dan vers), en genereer het document daarna opnieuw. Zo kan er nooit een document naar buiten met een claim die live al niet meer klopt.`;
}

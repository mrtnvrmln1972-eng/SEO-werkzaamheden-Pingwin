import { getFocus, laatsteWijziging } from "./focus";
import { listChatThreads } from "./chat";

// ═══════════════════════════════════════════════════════════
// LOOPT "WAT WE NU OPPAKKEN" ACHTER?
// ═══════════════════════════════════════════════════════════
// Dit veld is een notitieblok: het verandert alleen als er iemand in typt. Bij
// Kamsteeg stond er daardoor op 17 augustus 2026 nog het oude lijstje, terwijl
// de strategie een dag eerder in een gesprek volledig herzien was. Niets op het
// scherm liet dat zien, en erger: die verouderde tekst ging bij élke chatvraag
// mee als "wat Maarten zelf bovenaan heeft gezet", dus het gesprek dat de
// strategie herzag zat te praten tegen de oude versie in zijn eigen geheugen.
//
// Deze module beantwoordt één vraag: is er ná de laatste keer dat je dit veld
// aanraakte nog ergens iets bepaald? Hij LEEST alleen wat er al ligt. Geen
// motor, geen Ahrefs, geen Search Console, en ook geen model: dit draait bij
// elk openen van de takenpagina en mag dus niets kosten.

export type NieuwerePlek = {
  soort: "gesprek" | "strategie";
  /** Waar het staat, in gewone taal. Wordt letterlijk op het scherm getoond. */
  titel: string;
  datum: string;
  /** Eén regel over wat daar besloten is; leeg als die er niet is. */
  samenvatting: string;
  /** Alleen bij een gesprek: het onderwerp waar de chat op opengaat. */
  thread?: string;
};

export type OppakStand = {
  /** Wanneer de tekst voor het laatst veranderde. Null = nooit, of te oud om te weten. */
  bijgewerkt: string | null;
  /** Wanneer je voor het laatst zei dat het lijstje bij was. Null = nog nooit. */
  verwerktTot: string | null;
  /** Alles wat sindsdien is vastgelegd en dus nog niet verwerkt is, nieuwste eerst. */
  nieuwer: NieuwerePlek[];
};

/** Meer dan dit tonen leest niet, en dan is het weer een muur in plaats van een seintje. */
const MAX_PLEKKEN = 5;

export async function getOppakStand(slug: string): Promise<OppakStand> {
  const focus = await getFocus(slug).catch(() => null);
  const bijgewerkt = await laatsteWijziging(slug, "prioHtml");
  const verwerktTot = focus?.verwerktTot || null;

  // ── Waarom de grens de verwerkt-stempel is en niet de wijzigdatum ──
  // Aangeraakt is niet hetzelfde als bijgewerkt. Bij Kamsteeg werd op 17
  // augustus 2026 een komma in het lijstje veranderd, ná het gesprek waarin de
  // hele strategie herzien was. Op de wijzigdatum alléén zou het lijstje zich
  // daarmee "bij" noemen terwijl er nog exact hetzelfde verouderde plan stond.
  // Alleen een klik van Maarten (overnemen, of "dit klopt al") verzet de grens.
  //
  // Is er nog nooit zo'n klik geweest, dan is de grens 0 en komt álles wat er
  // aan besluiten ligt in beeld. Dat is geen ruis maar de eerlijke stand: er is
  // dan namelijk ook nooit vastgesteld dat het lijstje ergens bij is.
  const grens = verwerktTot ? Date.parse(verwerktTot) : 0;

  const nieuwer: NieuwerePlek[] = [];

  // ── Gesprekken die na die datum nog gelopen hebben ──
  // Alleen onderwerpen met een naam: een naamloos gesprek is een losse vraag,
  // geen besluit, en die zou het seintje alleen maar verwateren.
  try {
    for (const t of await listChatThreads(slug)) {
      const titel = (t.title || "").trim();
      if (!titel || t.count === 0) continue;
      if (Date.parse(t.updatedAt) <= grens) continue;
      nieuwer.push({ soort: "gesprek", titel, datum: t.updatedAt, samenvatting: (t.summary || "").trim(), thread: t.thread });
    }
  } catch { /* geen gesprekken is geen reden om het hele seintje te laten vallen */ }

  // ── Het strategiestuk in het dossier ──
  // Dat is hetzelfde soort handwerk als dit veld, en het loopt er net zo hard
  // van weg: bij Kamsteeg is de herziene strategie dáár geplakt, niet hier.
  try {
    const strategie = focus?.html?.trim() ? await laatsteWijziging(slug, "html") : null;
    if (strategie && Date.parse(strategie) > grens) {
      nieuwer.push({
        soort: "strategie",
        titel: "De strategie in het dossier",
        datum: strategie,
        samenvatting: "Het strategiestuk bij deze klant is hierna nog bijgewerkt.",
      });
    }
  } catch { /* zie boven */ }

  nieuwer.sort((a, b) => Date.parse(b.datum) - Date.parse(a.datum));
  return { bijgewerkt, verwerktTot, nieuwer: nieuwer.slice(0, MAX_PLEKKEN) };
}

/**
 * HOE MAARTEN SCHRIJFT
 * ════════════════════
 * De assistent schrijft "netjes Nederlands", en dat is precies wat iedereen
 * schrijft. Een mail die uit dit dashboard komt hoort te klinken alsof Maarten
 * hem zelf getikt heeft, niet alsof er een knop is ingedrukt.
 *
 * Dit bestand leidt daarom één schrijfprofiel af uit zijn ÉÉCHTE verzonden mails.
 * Eén profiel voor heel Pingwin, niet per klant: zijn stijl is zijn stijl, wat per
 * klant verschilt is de inhoud en niet de pen.
 *
 * Drie filters, en alle drie zijn ze nodig:
 *
 * 1. **Alleen mails aan klanten.** Hij mailt ook met collega's, met partnerbureaus
 *    en met sitebouwers, en dat is een heel andere toon. Alleen adressen die bij
 *    een klant in dit dashboard horen tellen mee.
 * 2. **Alleen wat hij zelf typte.** `splitsMail` knipt de geciteerde mail eronder
 *    weg; daar staat de tekst van iemand anders in.
 * 3. **Niet leren van onszelf.** Mails die dit dashboard heeft verstuurd staan óók
 *    in zijn verzonden map, met dezelfde afzender. Dat is AI-tekst. Leer je daarvan,
 *    dan wordt het profiel elke ronde een beetje meer assistent en een beetje minder
 *    Maarten, en dat merk je pas als het te laat is.
 *
 * Het profiel bevat naast de beschrijving een handvol ECHTE zinnen van hem.
 * Voorbeelden sturen een model beter dan bijvoeglijke naamwoorden: "direct en warm"
 * kan alle kanten op, "Zou je mij alsjeblieft even terug willen bellen?" niet.
 */

import { getSetting, setSetting } from "./settings";
import { listClients } from "./clients";
import { msStatus, msSearchClientEmails, type LiveEmail } from "./ms-graph";
import { splitsMail, naarTekst, isRuisMail } from "./mail-tekst";
import { callClaude } from "./anthropic";

const SLEUTEL = "pingwin_schrijfstijl";

export type Schrijfstijl = {
  /** De beschrijving van de stijl, in gewone taal. Gaat mee in elke mailopdracht. */
  profiel: string;
  /** Echte zinnen uit zijn eigen mails. */
  voorbeelden: string[];
  /** Wanneer voor het laatst afgeleid, en waaruit. */
  gemaaktOp: string;
  aantalMails: number;
  /** Heeft Maarten het zelf aangepast? Dan overschrijft de maandronde het niet. */
  handmatig: boolean;
};

export const LEEG: Schrijfstijl = { profiel: "", voorbeelden: [], gemaaktOp: "", aantalMails: 0, handmatig: false };

export async function getSchrijfstijl(): Promise<Schrijfstijl> {
  const ruw = await getSetting(SLEUTEL).catch(() => null);
  if (!ruw) return LEEG;
  try {
    const d = JSON.parse(ruw) as Partial<Schrijfstijl>;
    return {
      profiel: String(d.profiel || ""),
      voorbeelden: Array.isArray(d.voorbeelden) ? d.voorbeelden.map(String).slice(0, 12) : [],
      gemaaktOp: String(d.gemaaktOp || ""),
      aantalMails: Number(d.aantalMails || 0),
      handmatig: !!d.handmatig,
    };
  } catch { return LEEG; }
}

export async function setSchrijfstijl(s: Schrijfstijl): Promise<void> {
  await setSetting(SLEUTEL, JSON.stringify(s));
}

// ── Herkennen wat NIET van Maarten zelf is ────────────────────────────────
/**
 * Mails die dit dashboard verstuurd heeft. De opgemaakte variant is te herkennen
 * aan de kopbalk en de voetregel uit `lib/mail-opmaak.ts`; de platte variant aan
 * de vaste ondertekening die de assistent meekrijgt. Dit is een herkenning achteraf
 * en dus niet waterdicht, maar hij vangt de opvallende gevallen. Wie het waterdicht
 * wil, moet bij het verzenden een merkteken meesturen; dat is een aparte stap.
 */
const UIT_HET_DASHBOARD = [
  "opgesteld in het pingwin seo-dashboard",
  "letter-spacing:1.2px;text-transform:uppercase",   // de oranje kopbalk
  "niet alles hieronder is nagetrokken",             // het feitencontrole-blok
];
function uitHetDashboard(m: LiveEmail): boolean {
  const h = (m.bodyHtml || "").toLowerCase();
  return UIT_HET_DASHBOARD.some((k) => h.includes(k));
}

/** Te kort, te lang of geen echte mail: niets aan te leren. */
function bruikbaar(tekst: string): boolean {
  const t = (tekst || "").trim();
  if (t.length < 120 || t.length > 4000) return false;
  // Een doorgestuurde mail zonder eigen woorden erboven.
  if (/^(fwd|doorgestuurd)/i.test(t)) return false;
  return true;
}

export type Bron = { klant: string; onderwerp: string; tekst: string; datum: string };

/**
 * Verzamelt Maartens eigen mails aan klanten. Per klant apart opgehaald, want
 * Graph zoekt op het adres of domein van die klant; er is geen enkele zoekopdracht
 * die "alles aan al mijn klanten" oplevert.
 */
export async function verzamelEigenKlantmails(maxPerKlant = 12): Promise<Bron[]> {
  const st = await msStatus().catch(() => null);
  if (!st?.connected || !st.account) return [];
  const account = st.account;
  // Alleen echte klanten, geen leads en geen oud-klanten: hun mailtoon is anders
  // (een lead krijgt verkoop, een oud-klant een afronding).
  const klanten = (await listClients().catch(() => [])).filter((k) => !k.fase || k.fase === "klant");

  const uit: Bron[] = [];
  for (const k of klanten) {
    // Het zoekwoord: het mailadres van de klant, anders het maildomein, anders het
    // websitedomein. Zonder een van die drie weten we niet wie de klant is.
    const zoek = (k.email || k.cockpit?.emailDomain || k.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").trim();
    if (!zoek) continue;
    const mails = await msSearchClientEmails(zoek, account, maxPerKlant).catch(() => null);
    if (!mails) continue;
    for (const m of mails) {
      if (m.direction !== "out") continue;              // alleen wat hij zelf stuurde
      if (isRuisMail(m)) continue;                      // nieuwsbrieven, systeemmail
      if (uitHetDashboard(m)) continue;                 // niet van onszelf leren
      const eigen = naarTekst(splitsMail(m.bodyHtml || "").eigen).trim();
      if (!bruikbaar(eigen)) continue;
      uit.push({
        klant: k.name || k.slug,
        onderwerp: m.subject || "",
        tekst: eigen.slice(0, 2000),
        datum: (m.receivedAt || "").slice(0, 10),
      });
    }
  }
  // Nieuwste eerst, zodat een verschoven stijl zwaarder weegt dan mail van vorig jaar.
  uit.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  return uit.slice(0, 60);
}

const SYSTEM = `Je analyseert de schrijfstijl van één persoon: Maarten Vermeulen van Pingwin, een SEO- en online-marketingbureau. Je krijgt e-mails die hij zelf aan zijn KLANTEN heeft geschreven.

Doel: een profiel waarmee een ander die stijl kan nabootsen. Het profiel wordt letterlijk meegegeven aan een assistent die concepten voor hém schrijft, die hij daarna nog naleest.

Let op deze dingen en beschrijf ze concreet, niet in bijvoeglijke naamwoorden:
- Hoe begint hij? Welke aanhef, en stapt hij meteen in of niet?
- Hoe sluit hij af? Welke ondertekening?
- Zinslengte en alinealengte. Korte zinnen of lange? Veel witregels?
- Aanspreekvorm: je/jij/jullie/u.
- Hoe direct is hij? Zegt hij waar het op staat, of verpakt hij het?
- Welke woorden en wendingen keren terug? Welke stopwoordjes?
- Waar zit humor of luchtigheid, en waar juist niet?
- Wat doet hij NOOIT? (Denk aan: verkooppraat, uitroeptekens, jargon, lange inleidingen.)

Geef terug in exact dit formaat, zonder inleiding:

PROFIEL:
(acht tot twaalf korte regels, elk beginnend met "- ", die samen de stijl beschrijven)

VOORBEELDEN:
(vijf zinnen LETTERLIJK overgenomen uit de mails, elk op een eigen regel beginnend met "- ". Kies zinnen die typerend zijn voor zijn toon, geen zinnen met namen van personen, bedrijven, bedragen of andere gevoelige gegevens erin.)

Nederlands. Geen enkele opmerking buiten dit formaat.`;

/** Leidt het profiel af en bewaart het. Overschrijft niet wat Maarten zelf typte. */
export async function leidSchrijfstijlAf(forceer = false): Promise<{ ok: boolean; error?: string; stijl?: Schrijfstijl }> {
  const huidig = await getSchrijfstijl();
  if (huidig.handmatig && !forceer) {
    return { ok: true, stijl: huidig };   // met de hand bijgesteld: afblijven
  }
  const bronnen = await verzamelEigenKlantmails();
  if (bronnen.length < 5) {
    return { ok: false, error: `Te weinig eigen klantmails gevonden om een stijl uit af te leiden (${bronnen.length}). Is de mailkoppeling actief?` };
  }
  const materiaal = bronnen.slice(0, 40)
    .map((b, i) => `--- mail ${i + 1} (${b.datum}) ---\nOnderwerp: ${b.onderwerp}\n${b.tekst}`)
    .join("\n\n");

  let tekst = "";
  try {
    tekst = (await callClaude(SYSTEM, [{ role: "user", content: materiaal }], 1500, { action: "schrijfstijl" })) || "";
  } catch {
    return { ok: false, error: "De assistent is niet bereikbaar." };
  }
  const { profiel, voorbeelden } = leesAntwoord(tekst);
  if (!profiel) return { ok: false, error: "De analyse leverde geen bruikbaar profiel op." };

  const stijl: Schrijfstijl = {
    profiel, voorbeelden,
    gemaaktOp: new Date().toISOString(),
    aantalMails: bronnen.length,
    handmatig: false,
  };
  await setSchrijfstijl(stijl);
  return { ok: true, stijl };
}

/** Splitst het antwoord in de twee blokken. Los getest in de proef. */
export function leesAntwoord(tekst: string): { profiel: string; voorbeelden: string[] } {
  const t = (tekst || "").replace(/\r/g, "");
  const i = t.search(/^\s*VOORBEELDEN\s*:/im);
  const profielDeel = (i >= 0 ? t.slice(0, i) : t).replace(/^\s*PROFIEL\s*:/im, "").trim();
  const voorbeeldDeel = i >= 0 ? t.slice(i).replace(/^\s*VOORBEELDEN\s*:/im, "") : "";
  const voorbeelden = voorbeeldDeel.split("\n")
    .map((r) => r.replace(/^\s*[-*]\s*/, "").trim())
    .filter((r) => r.length > 15)
    .slice(0, 6);
  return { profiel: profielDeel, voorbeelden };
}

/**
 * Het blok zoals het in een mailopdracht terechtkomt. Leeg als er nog geen profiel
 * is; dan gedraagt elke mail zich precies zoals daarvoor.
 */
export function schrijfstijlBlok(s: Schrijfstijl): string {
  if (!s.profiel.trim()) return "";
  const regels = [
    `ZO SCHRIJFT MAARTEN ZELF. Je schrijft een concept dat hij onder zijn eigen naam verstuurt, dus dit is geen suggestie maar de norm:`,
    s.profiel.trim(),
  ];
  if (s.voorbeelden.length) {
    regels.push(
      `Zinnen die hij echt zo geschreven heeft, als ijkpunt voor de toon (niet overnemen, wel de klank ervan raken):`,
      s.voorbeelden.map((v) => `- ${v}`).join("\n"),
    );
  }
  return regels.join("\n\n");
}

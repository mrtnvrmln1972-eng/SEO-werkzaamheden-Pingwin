// ═══════════════════════════════════════════════════════════
// VAN MAILTHREAD NAAR MEETBARE PUNTEN
// ═══════════════════════════════════════════════════════════
// Wat is er eigenlijk gevraagd? Een thread van zeventien berichten met vier
// mensen erin bevat verzoeken, antwoorden, koetjes en kalfjes, en dezelfde vraag
// vijf keer omdat iedereen elkaar citeert. Hier komt daar één lijst uit van
// punten die je kunt méten.
//
// Twee bronnen, gelijkwaardig: de thread zelf, en de zin die Maarten intypt
// ("kun je even kijken of dit en dat verwerkt is"). Voor de rest van de motor
// maakt het niet uit waar een punt vandaan komt.
//
// DRIE HARDE NACONTROLES, want een model dat afspraken mag verzinnen doet dat:
//  1. Geen afspraak zonder een citaat dat LETTERLIJK in de tekst voorkomt.
//  2. Of iets hard meetbaar is, bepaalt de code. Nooit het model.
//  3. Een punt dat niet naar een concreet pad te herleiden is, gaat naar Maarten
//     toe als vraag in plaats van naar de meter toe als oordeel.
//
// Die derde is hier geen theorie. Kamsteegtuinen.nl en strandtuin.nl zijn van
// dezelfde mensen, hebben dezelfde developer, en allebei een pagina over
// strandtuinen; de thread die over kamsteegtuinen.nl gaat heet "Optimalisatie 2
// nieuwe pagina's Strandtuin". Wie de site uit het onderwerp afleidt, meet de
// verkeerde website en heeft daar zelf geen weet van.
// ═══════════════════════════════════════════════════════════

import { callClaudeForcedTool, type ToolDef } from "./anthropic";
import { eigenTekst, isRuisMail } from "./mail-tekst";
import { pagePath } from "./page-internal-links";
import type { LiveEmail } from "./ms-graph";
import type { ClientUrl } from "./site-urls";

export type AfspraakSoort = "interne-link" | "uit-navigatie" | "anders";

export type Afspraak = {
  /** Stabiele sleutel, zodat twee controles van dezelfde thread vergelijkbaar zijn. */
  puntKey: string;
  soort: AfspraakSoort;
  /** Hard meetbaar (code beslist) of richtinggevend (oordeel, mag afwijken)? */
  hard: boolean;
  titel: string;
  /** Letterlijk citaat uit de mail of uit Maartens vraag. Verplicht. */
  gevraagd: string;
  gevraagdOp: string;
  /** Wat de developer erover terugzei, letterlijk. Mag leeg zijn. */
  devClaim: string;
  devClaimOp: string;
  /** Voor een interne link: vanaf welke pagina. Leeg bij uit-navigatie. */
  bronPad: string;
  /** De pagina waar het om draait. */
  doelPad: string;
  ankerHint: string;
  /** Waar op de pagina het zou moeten komen, in gewone taal. */
  plek: string;
};

export type OnduidelijkPunt = { tekst: string; reden: string };

export type Afsprakenlijst = {
  afspraken: Afspraak[];
  /** Punten die niet naar een pagina te herleiden waren: die gaan naar Maarten. */
  onduidelijk: OnduidelijkPunt[];
  /** Vragen van de developer die nog op een antwoord wachten. */
  openVragen: string[];
  devNaam: string;
  devAdres: string;
};

// Welke soort hard meetbaar is, staat hier en nergens anders. Het model mag dit
// niet bepalen; anders verschuift bij elke run de grens tussen feit en mening.
const HARD: Record<AfspraakSoort, boolean> = {
  "interne-link": true,
  "uit-navigatie": true,
  anders: false,
};

function normaliseer(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[‘’‚‛']/g, "'")
    .replace(/[“”„‟"]/g, '"')
    .replace(/[^a-z0-9à-ÿ'"]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Korte, stabiele sleutel per punt. */
function maakKey(soort: string, doelPad: string, bronPad: string, citaat: string): string {
  let h = 0;
  const n = normaliseer(citaat);
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return `${soort}|${doelPad}|${bronPad}|${h.toString(36)}`;
}

const TOOL: ToolDef = {
  name: "leg_afspraken_vast",
  description: "Legt vast wat er in deze mailwisseling aan de websitebouwer gevraagd is, wat hij daarover terugzei, en welke vragen nog openstaan.",
  input_schema: {
    type: "object",
    properties: {
      developerNaam: { type: "string", description: "Voornaam van de websitebouwer aan wie gevraagd is." },
      punten: {
        type: "array",
        description: "Elk concreet verzoek aan de websitebouwer. Alleen verzoeken over de website, geen beleefdheden of resultaten-updates.",
        items: {
          type: "object",
          properties: {
            soort: {
              type: "string",
              enum: ["interne-link", "uit-navigatie", "anders"],
              description: "interne-link = er moet een link vanaf een pagina naar een andere pagina komen. uit-navigatie = een pagina moet juist UIT het menu of de footer. anders = al het overige (styling, kleur, teksten, afbeeldingen).",
            },
            titel: { type: "string", description: "Korte omschrijving van het punt in gewone taal, maximaal 80 tekens." },
            citaat: { type: "string", description: "De zin uit de tekst waarin dit gevraagd wordt, LETTERLIJK overgenomen. Verzin niets; neem exact over wat er staat." },
            gevraagdOp: { type: "string", description: "Datum van die mail als JJJJ-MM-DD, of leeg als het uit de vraag van de gebruiker komt." },
            devCitaat: { type: "string", description: "Wat de websitebouwer hierover terugzei, LETTERLIJK overgenomen. Leeg als hij er niets over zei." },
            devCitaatOp: { type: "string", description: "Datum van dat antwoord als JJJJ-MM-DD, of leeg." },
            bronPad: { type: "string", description: "Bij interne-link: het pad van de pagina waar de link op moet komen, bijvoorbeeld /hovenier/. Leeg bij de andere soorten." },
            doelPad: { type: "string", description: "Het pad van de pagina waar het om draait, bijvoorbeeld /tuinontwerp/strandtuin/. Kies uitsluitend uit de lijst met bestaande pagina's, tenzij de tekst een pad noemt dat er niet in staat; neem dat dan letterlijk over." },
            ankerHint: { type: "string", description: "De ankertekst die gevraagd of gesuggereerd is, als die genoemd wordt. Anders leeg." },
            plek: { type: "string", description: "Waar op de pagina het zou moeten komen, als dat genoemd wordt (bijvoorbeeld: onder de H2 'Werkgebied'). Anders leeg." },
          },
          required: ["soort", "titel", "citaat"],
        },
      },
      openVragen: {
        type: "array",
        description: "Vragen die de websitebouwer stelde en die nog niet beantwoord zijn. Letterlijk overnemen.",
        items: { type: "string" },
      },
    },
    required: ["punten"],
  },
};

const SYSTEM = `Je haalt uit een mailwisseling wat er aan de websitebouwer gevraagd is over een website, zodat een ander systeem daarna op de live site kan controleren of het ook echt gedaan is.

WAT JE WEL OPNEEMT
- Elk concreet verzoek aan de websitebouwer over de website: een interne link plaatsen, een pagina uit het menu of de footer halen, een tekst of afbeelding aanpassen, een kleur veranderen.
- Ook verzoeken die eerder in de thread staan en later niet herhaald zijn; die gelden nog steeds, tenzij ze expliciet ingetrokken zijn.

WAT JE NIET OPNEEMT
- Beleefdheden, vakantiegroeten, rapportages over rankings of bezoekersaantallen.
- Dingen die de afzender ZELF gaat doen ("ik zal de interne links aanbrengen"). Alleen wat aan de bouwer gevraagd wordt.
- Verzoeken die al ingetrokken of achterhaald zijn in een latere mail.

CITATEN ZIJN HEILIG
Het veld "citaat" moet LETTERLIJK in de aangeleverde tekst voorkomen, woord voor woord. Kun je geen letterlijk citaat vinden, neem het punt dan niet op. Een verzonnen citaat is erger dan een gemist punt: het systeem gooit punten met een niet-bestaand citaat automatisch weg.

PADEN
Gebruik alleen paden die in de meegeleverde lijst met bestaande pagina's staan. Noemt de tekst uitdrukkelijk een pad dat niet in die lijst staat, neem dat dan letterlijk over; het systeem controleert zelf of die pagina nog bestaat. Verzin nooit een pad dat nergens genoemd wordt. Weet je niet zeker om welke pagina het gaat, laat het pad dan leeg.

LET OP DE JUISTE WEBSITE
Deze klant kan meerdere websites hebben, en een onderwerpregel zegt niets over welke site bedoeld wordt. Ga alleen af op wat er in de tekst zelf staat en op de meegeleverde lijst met pagina's.`;

/** De thread omzetten naar leesbare tekst, ontdaan van citaten en ruis. */
function threadNaarTekst(mails: LiveEmail[]): { tekst: string; bronTekst: string } {
  const bruikbaar = mails
    .filter((m) => !isRuisMail(m))
    .slice()
    .sort((a, b) => (a.receivedAt || "").localeCompare(b.receivedAt || ""));

  const regels: string[] = [];
  const bron: string[] = [];
  for (const m of bruikbaar) {
    // Alleen de eigen tekst: zonder dit telt hetzelfde verzoek vijf keer mee
    // omdat iedereen elkaar citeert, en dan levert de controle vijf keer
    // hetzelfde punt op.
    const tekst = eigenTekst(m.bodyHtml || "", m.preview || "", 2500);
    if (!tekst.trim()) continue;
    const datum = (m.receivedAt || "").slice(0, 10);
    const wie = m.fromName || m.fromAddress || "onbekend";
    const richting = m.direction === "out" ? "VERZOEK VAN ONS" : "ANTWOORD";
    regels.push(`--- ${datum} | ${wie} | ${richting} ---\n${tekst}`);
    bron.push(tekst);
  }
  return { tekst: regels.join("\n\n"), bronTekst: bron.join("\n") };
}

/** Wie in deze thread is de developer? De externe deelnemer, niet wij en niet de klant. */
function bepaalDeveloper(mails: LiveEmail[], onsDomein: string, klantDomein: string): { naam: string; adres: string } {
  const tellers = new Map<string, { naam: string; aantal: number }>();
  for (const m of mails) {
    const adres = (m.fromAddress || "").toLowerCase();
    if (!adres) continue;
    const domein = adres.split("@")[1] || "";
    if (!domein) continue;
    if (onsDomein && domein.endsWith(onsDomein)) continue;
    if (klantDomein && domein.endsWith(klantDomein)) continue;
    const cur = tellers.get(adres) || { naam: m.fromName || adres, aantal: 0 };
    cur.aantal++;
    tellers.set(adres, cur);
  }
  const beste = [...tellers.entries()].sort((a, b) => b[1].aantal - a[1].aantal)[0];
  if (!beste) return { naam: "", adres: "" };
  return { naam: (beste[1].naam || "").split(/\s+/)[0] || "", adres: beste[0] };
}

function schoonPad(p: string): string {
  const s = (p || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return pagePath(s);
  if (!s.startsWith("/")) return "";
  return pagePath(s);
}

/**
 * Haalt de afspraken uit een thread plus de vrije vraag van Maarten.
 *
 * De vraag van Maarten is geen bijzaak: hij mag ook het enige zijn dat er ligt
 * ("kun je even kijken of de footerlinks kloppen"), en dan is de thread alleen
 * context.
 */
export async function haalAfspraken(opts: {
  slug: string;
  mails: LiveEmail[];
  vraag: string;
  urls: ClientUrl[];
  klantNaam: string;
  domein: string;
  onsDomein?: string;
  klantMailDomein?: string;
}): Promise<Afsprakenlijst> {
  const { tekst, bronTekst } = threadNaarTekst(opts.mails);
  const vraag = (opts.vraag || "").trim();
  if (!tekst && !vraag) {
    return { afspraken: [], onduidelijk: [], openVragen: [], devNaam: "", devAdres: "" };
  }

  const dev = bepaalDeveloper(opts.mails, opts.onsDomein || "pingwin.nl", opts.klantMailDomein || "");

  // Alleen bestaande, werkende pagina's aanbieden. Zo hoeft het model niet te
  // raden hoe een pad heet, en herkennen we een verzonnen pad meteen.
  const bekend = opts.urls
    .filter((u) => (u.status ?? 200) < 400)
    .map((u) => ({ pad: pagePath(u.url), titel: (u.title || "").slice(0, 90) }))
    .filter((u) => u.pad);
  const padLijst = bekend.slice(0, 300).map((u) => `${u.pad}${u.titel ? ` — ${u.titel}` : ""}`).join("\n");

  const context = [
    `KLANT: ${opts.klantNaam} — website: ${opts.domein}`,
    "",
    "BESTAANDE PAGINA'S OP DEZE WEBSITE (kies paden hieruit):",
    padLijst || "(nog geen pagina-lijst beschikbaar)",
    "",
    vraag ? `WAT MAARTEN NU GECONTROLEERD WIL HEBBEN:\n${vraag}` : "",
    "",
    tekst ? `DE MAILWISSELING (oudste eerst):\n${tekst}` : "(geen mailwisseling meegegeven)",
  ].filter(Boolean).join("\n");

  const ruw = await callClaudeForcedTool(
    SYSTEM,
    [{ role: "user", content: context.slice(0, 60000) }],
    TOOL,
    { slug: opts.slug, action: "mail_controle_afspraken" },
    4000,
  );

  const punten = Array.isArray(ruw?.punten) ? (ruw!.punten as Record<string, unknown>[]) : [];
  const openVragen = Array.isArray(ruw?.openVragen) ? (ruw!.openVragen as unknown[]).map((v) => String(v || "").trim()).filter(Boolean).slice(0, 6) : [];

  // Waartegen we citaten controleren: de mailtekst plus Maartens eigen vraag.
  const bronGenormaliseerd = normaliseer(`${bronTekst}\n${vraag}`);
  const bekendePaden = new Set(bekend.map((b) => b.pad));

  const afspraken: Afspraak[] = [];
  const onduidelijk: OnduidelijkPunt[] = [];
  const gezien = new Set<string>();

  for (const p of punten) {
    const citaat = String(p.citaat || "").trim();
    const titel = String(p.titel || "").trim().slice(0, 90);
    if (!citaat || !titel) continue;

    // Nacontrole 1: geen afspraak zonder bron. Korte citaten slaan we over als
    // controle (te veel toevalstreffers), maar die zijn ook zelden een verzoek.
    const genormaliseerdCitaat = normaliseer(citaat);
    if (genormaliseerdCitaat.length < 12 || !bronGenormaliseerd.includes(genormaliseerdCitaat)) {
      onduidelijk.push({
        tekst: titel,
        reden: "dit stond niet letterlijk in de mail, dus ik heb het niet als afspraak geteld",
      });
      continue;
    }

    const soortRuw = String(p.soort || "anders");
    const soort: AfspraakSoort = soortRuw === "interne-link" || soortRuw === "uit-navigatie" ? soortRuw : "anders";
    const doelPad = schoonPad(String(p.doelPad || ""));
    const bronPad = schoonPad(String(p.bronPad || ""));

    // Nacontrole 3: zonder pagina valt er niets te meten. Naar Maarten dus, niet
    // naar de meter. Dit vangt ook het geval waarin een punt eigenlijk over de
    // andere website van dezelfde klant gaat.
    if (!doelPad) {
      onduidelijk.push({ tekst: titel, reden: "ik kon er geen pagina op deze website bij vinden" });
      continue;
    }
    if (soort === "interne-link" && !bronPad) {
      onduidelijk.push({ tekst: titel, reden: "het is me niet duidelijk vanaf welke pagina de link moet komen" });
      continue;
    }

    const key = maakKey(soort, doelPad, bronPad, citaat);
    if (gezien.has(key)) continue;
    gezien.add(key);

    afspraken.push({
      puntKey: key,
      soort,
      // Nacontrole 2: hardheid komt uit de tabel hierboven, niet uit het model.
      hard: HARD[soort],
      titel,
      gevraagd: citaat.slice(0, 400),
      gevraagdOp: String(p.gevraagdOp || "").slice(0, 10),
      devClaim: String(p.devCitaat || "").trim().slice(0, 400),
      devClaimOp: String(p.devCitaatOp || "").slice(0, 10),
      bronPad,
      doelPad,
      ankerHint: String(p.ankerHint || "").trim().slice(0, 120),
      plek: String(p.plek || "").trim().slice(0, 200),
    });
  }

  // Paden die het model noemde maar die we niet kennen, zijn niet per se fout:
  // client_urls kan achterlopen. De meetlaag zoekt live uit of ze bestaan. We
  // noteren het alleen, zodat het scherm het kan tonen.
  for (const a of afspraken) {
    if (a.doelPad && bekendePaden.size && !bekendePaden.has(a.doelPad)) {
      a.plek = a.plek ? `${a.plek} (pagina stond niet in onze paginalijst)` : "pagina stond niet in onze paginalijst";
    }
  }

  return { afspraken, onduidelijk, openVragen, devNaam: dev.naam, devAdres: dev.adres };
}

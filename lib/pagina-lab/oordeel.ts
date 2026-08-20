// ═══════════════════════════════════════════════════════════
// HET OORDEEL: CRITERIA, METING EN FOTO NAAST ELKAAR
// ═══════════════════════════════════════════════════════════
// Tot nu toe kon het lab drie dingen los van elkaar: een pagina lezen en
// fotograferen (`bron.ts`), zeggen waar je naar kijkt (`kennisbank/`), en tonen
// wat bezoekers er deden (`gedrag.ts`). Dit bestand legt ze op elkaar en levert
// per criterium één bevinding op.
//
// DE DRIE REGELS DIE DIT OORDEEL BRUIKBAAR MAKEN
// ══════════════════════════════════════════════
// 1. **Alleen tegen de criterialijst.** Een bevinding zonder geldige code uit de
//    kennisbank wordt weggegooid. Zonder die grens verzint een model er een
//    zesendertigste criterium bij dat plausibel klinkt en nergens op rust.
// 2. **Wat gemeten kan worden, wordt gemeten.** Staat een criterium op
//    `vaststellen: "meting"` en is er geen meting voor, dan is de uitkomst
//    "niet vast te stellen". Nooit een indruk in de vorm van een cijfer.
// 3. **De reden en de bron komen uit de code, niet uit het model.** Het model
//    zegt wat het ziet en wat het zou doen; het waarom en het bronadres worden
//    er hier aan vastgeplakt, letterlijk uit de kennisbank. Zo kan een advies aan
//    een klant nooit een verzonnen onderzoek als onderbouwing meekrijgen.
//
// En de vierde, die uit de kennisbank zelf komt: een vakoordeel blijft een
// vakoordeel. Het staat apart, met de waarschuwing erbij, ook als het model het
// net zo stellig opschrijft als de rest.
//
// DIT BESTAND SCHRIJFT NIETS WEG. Een oordeel is nu een uitkomst op het scherm,
// geen taak en geen regel in een tabel; zie
// `proeven/pagina-lab-schrijft-niet.proef.ts`.
// ═══════════════════════════════════════════════════════════

import { callClaudeImagesForcedTool, type ToolDef, type VisionImage } from "../anthropic";
import {
  CRITERIA,
  DISCIPLINES,
  VAKOORDEEL_WAARSCHUWING,
  VAKOORDELEN,
  alsTekst,
  opId,
} from "./kennisbank";
import type { Bron, Criterium, Discipline, Vakoordeel, Weegt } from "./kennisbank";
import { metingAlsTekst, metingenVoor, type MetingWaarde, type Opname } from "./meting";
import type { PaginaGedragUitkomst } from "./gedrag";

export type Stand = "goed" | "kan beter" | "mis" | "niet vast te stellen";

export const STANDEN: Stand[] = ["goed", "kan beter", "mis", "niet vast te stellen"];

export type Bevinding = {
  criterium: string;
  titel: string;
  discipline: Discipline;
  plank: "onderbouwd" | "vakoordeel";
  weegt: Weegt;
  stand: Stand;
  /** Wat er op déze pagina staat of gebeurt. Een feit, geen mening. */
  wat: string;
  /** Waarom het uitmaakt. Komt letterlijk uit de kennisbank. */
  waarom: string;
  /** Wat we zouden doen. Leeg als er niets te doen is. */
  advies: string;
  /** Waar dit oordeel op rust: welke meting, de foto, de cijfers van bezoekers. */
  vastgesteldUit: string[];
  /** De bron onder het criterium. Leeg bij een vakoordeel, en dat is het punt. */
  bronnen: Bron[];
  nuance?: string;
};

export type Oordeel = {
  url: string;
  beoordeeldOp: string;
  bevindingen: Bevinding[];
  /** Wat er van het model afviel en waarom. Zichtbaar, niet stilletjes weg. */
  opmerkingen: string[];
  eerstDit: Bevinding[];
  telling: { stand: Stand; aantal: number }[];
};

// Hoe zwaar iets weegt in de volgorde. Bewust in code en niet door het model
// bepaald: dan is de volgorde elke keer dezelfde en uit te leggen.
const STAND_GEWICHT: Record<Stand, number> = { mis: 3, "kan beter": 2, goed: 0, "niet vast te stellen": 0 };
const WEEGT_GEWICHT: Record<Weegt, number> = { hoog: 3, midden: 2, laag: 1 };

/** De vorm waarin het model zijn bevindingen aanlevert. */
export type RuweBevinding = {
  criterium?: string;
  stand?: string;
  wat?: string;
  advies?: string;
  gezienOpFoto?: boolean;
};

export const BEVINDING_TOOL: ToolDef = {
  name: "geef_bevindingen",
  description: "Geef per criterium uit de kennisbank één bevinding over deze pagina.",
  input_schema: {
    type: "object",
    properties: {
      bevindingen: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criterium: { type: "string", description: "De code uit de kennisbank, bijvoorbeeld CONV-02 of VAK-01. Verzin er nooit een." },
            stand: { type: "string", enum: STANDEN, description: "'niet vast te stellen' is een volwaardig antwoord en beter dan gokken." },
            wat: { type: "string", description: "Wat er op DEZE pagina staat of gebeurt. Een feit, in gewone taal, met wat je gezien of gemeten hebt. Geen mening en geen herhaling van het criterium." },
            advies: { type: "string", description: "Wat je zou doen. Leeg laten als de stand 'goed' of 'niet vast te stellen' is." },
            gezienOpFoto: { type: "boolean", description: "Waar dit oordeel op de schermfoto te zien is." },
          },
          required: ["criterium", "stand", "wat"],
        },
      },
    },
    required: ["bevindingen"],
  },
};

const REGELS = `Je beoordeelt één webpagina voor Pingwin, een SEO- en marketingbureau. Je krijgt drie dingen:
de criteria waartegen we beoordelen, de meting van die pagina, en schermfoto's van desktop en mobiel.

Harde regels:
- Beoordeel ALLEEN tegen de criteria die je krijgt, en gebruik altijd hun code. Verzin er nooit een bij.
- Ga langs ELK criterium. Kun je iets niet vaststellen uit de meting, de foto of de tekst, kies dan
  "niet vast te stellen" en zeg in één zin wat je zou moeten zien om het wel te kunnen. Dat is een goed
  antwoord, geen zwaktebod.
- Neem bij een criterium dat op een meting rust het gemeten getal letterlijk over. Verzin nooit een
  getal, een percentage of een laadtijd die je niet in de meting ziet staan.
- "wat" gaat over DEZE pagina en is een waarneming. Niet het criterium herhalen, niet "dit is belangrijk
  omdat", niet in algemeenheden. Als je de foto gebruikt, benoem waar op het scherm.
- Schrijf in gewoon Nederlands, zoals je het aan een ondernemer uitlegt. Geen jargon, geen Engels waar
  Nederlands kan. Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, een
  puntkomma, haakjes of een nieuwe zin.
- Kort: "wat" hooguit drie zinnen, "advies" hooguit twee.
- De punten met code VAK zijn ons eigen vakoordeel zonder onderzoek eronder. Beoordeel ze wel, maar
  schrijf ze nooit alsof er bewijs onder ligt.
- Vleien heeft geen zin en streng doen ook niet. Staat iets gewoon goed, zeg dan "goed" en houd het kort;
  is iets echt mis, zeg dat dan zonder verzachting.`;

/** Wat er van de pagina zelf in de opdracht komt. Kort, want de foto zegt meer. */
function paginaFeiten(opname: Opname): string {
  const b = opname.bron;
  const koppen = b.koppen.filter((k) => k.zichtbaar).slice(0, 25).map((k) => `H${k.niveau}: ${k.tekst}`).join("\n");
  const knoppen = Array.from(new Set(b.knoppen)).slice(0, 20).join(" | ");
  return [
    `URL: ${b.eindUrl || b.url}`,
    `Status: ${b.status ?? "onbekend"}`,
    `Titel: ${b.titel}`,
    `Omschrijving: ${b.omschrijving || "(geen)"}`,
    `Taal: ${b.taal || "(niet ingesteld)"}`,
    `Aantal woorden: ${b.woorden}, paginahoogte ${b.hoogte}px`,
    `Interne links: ${b.links.filter((l) => !l.extern).length}, externe links: ${b.links.filter((l) => l.extern).length}`,
    `Afbeeldingen: ${b.beelden.length}`,
    `Knoppen en knop-achtige links: ${knoppen || "(geen)"}`,
    "",
    "Koppen zoals een bezoeker ze ziet:",
    koppen || "(geen koppen gevonden)",
    "",
    "De eerste tekst van de pagina:",
    b.tekst.slice(0, 2500),
  ].join("\n");
}

/** Wat bezoekers werkelijk deden, als die cijfers er zijn. */
function gedragFeiten(gedrag: PaginaGedragUitkomst | null): string {
  if (!gedrag) return "Er zijn geen cijfers over bezoekers bij deze pagina. Zeg dus niets over hoe hij het doet.";
  const a = gedrag.analytics;
  if (!a?.gekoppeld || !a.totaal) {
    return `Analytics is voor deze klant niet gekoppeld (${a?.melding || "geen property bekend"}). Zeg dus niets over hoe de pagina het doet.`;
  }
  const regels = [
    `Analytics over ${a.dagen} dagen: ${a.totaal.weergaven} weergaven, ${a.totaal.instappen} instappen, ${a.totaal.betrokkenheid}% betrokken, gemiddeld ${a.totaal.seconden} seconden, ${a.totaal.conversies} conversies.`,
    ...a.perApparaat.map((p) => `  ${p.apparaat}: ${p.gedrag.weergaven} weergaven, ${p.gedrag.betrokkenheid}% betrokken, ${p.gedrag.conversies} conversies.`),
  ];
  const c = gedrag.clarity?.pagina;
  if (c) {
    regels.push(`Clarity (opgehaald ${c.opgehaaldOp}, ${c.dagen} dagen): ${c.regels.map((r) => `${r.metriek} ${JSON.stringify(r.waarden)}`).join("; ")}`);
  }
  return regels.join("\n");
}

/**
 * De volledige opdracht aan het model. Apart en puur, zodat de proef kan
 * narekenen dat de criteria, de meting en de regels er echt in zitten.
 */
export function bouwOpdracht(desktop: Opname, mobiel: Opname | null, gedrag: PaginaGedragUitkomst | null): string {
  const metingen = [
    `Meting op desktop (${desktop.bron.eindUrl || desktop.bron.url}):`,
    metingAlsTekst(desktop.meting),
    ...(mobiel ? ["", "Meting op mobiel (390 pixels breed):", metingAlsTekst(mobiel.meting)] : []),
  ].join("\n");

  return [
    "## De criteria waartegen je beoordeelt",
    alsTekst(DISCIPLINES),
    "",
    "## De pagina zelf",
    paginaFeiten(desktop),
    "",
    "## De meting",
    "Elke regel begint met zijn sleutel tussen haken. Neem getallen hieruit letterlijk over.",
    metingen,
    "",
    "## Wat bezoekers deden",
    gedragFeiten(gedrag),
    "",
    "## Je opdracht",
    "Ga langs elk criterium hierboven en geef per criterium één bevinding via het gereedschap.",
    "De schermfoto's staan hierboven, in de volgorde waarin ze benoemd zijn.",
  ].join("\n");
}

/**
 * De bevindingen van het model tegen de kennisbank en de meting houden.
 *
 * Dit is de poort. Wat hier gebeurt is bewust streng: liever een lege lijst dan
 * een lijst die er goed uitziet en niet klopt.
 */
export function keur(ruw: RuweBevinding[], metingen: MetingWaarde[]): { bevindingen: Bevinding[]; opmerkingen: string[] } {
  const bevindingen: Bevinding[] = [];
  const opmerkingen: string[] = [];
  const gezien = new Set<string>();

  for (const r of ruw || []) {
    const code = String(r.criterium || "").trim().toUpperCase();
    const punt = code ? opId(code) : null;
    if (!punt) {
      opmerkingen.push(`Bevinding over "${code || "(zonder code)"}" is weggelaten: die code staat niet in de kennisbank.`);
      continue;
    }
    if (gezien.has(punt.id)) {
      opmerkingen.push(`Tweede bevinding over ${punt.id} is weggelaten; de eerste telt.`);
      continue;
    }
    const wat = String(r.wat || "").trim();
    if (wat.length < 10) {
      opmerkingen.push(`Bevinding over ${punt.id} is weggelaten: er stond niet in wat er op deze pagina te zien is.`);
      continue;
    }
    gezien.add(punt.id);

    const isVakoordeel = !("bronnen" in punt);
    const criterium = isVakoordeel ? null : (punt as Criterium);
    const vakoordeel = isVakoordeel ? (punt as Vakoordeel) : null;

    let stand: Stand = (STANDEN as string[]).includes(String(r.stand)) ? (r.stand as Stand) : "niet vast te stellen";
    const gebruikt = metingenVoor(metingen, punt.id);
    const vastgesteldUit: string[] = gebruikt.map((m) => `Meting: ${m.label} — ${m.waarde}`);

    // Regel 2: een criterium dat uit een meting moet komen, maar waar geen meting
    // voor is, levert geen oordeel op. Dat gebeurt bijvoorbeeld als de browser de
    // snelheid niet kon meten; dan lijkt elk oordeel over snelheid onderbouwd
    // terwijl er niets gemeten is.
    if (punt.vaststellen === "meting" && gebruikt.length === 0) {
      stand = "niet vast te stellen";
      opmerkingen.push(`${punt.id} staat op "niet vast te stellen": dit criterium hoort uit een meting te komen en die meting is er niet.`);
    }
    if (r.gezienOpFoto) vastgesteldUit.push("Op de schermfoto gezien");
    if (!vastgesteldUit.length) vastgesteldUit.push(punt.vaststellen === "oordeel" ? "Uit de tekst van de pagina" : "Niet onderbouwd met een meting of de foto");

    bevindingen.push({
      criterium: punt.id,
      titel: punt.titel,
      discipline: punt.discipline,
      plank: isVakoordeel ? "vakoordeel" : "onderbouwd",
      weegt: punt.weegt,
      stand,
      wat,
      // Het waarom komt uit de kennisbank, nooit uit het model.
      waarom: criterium ? criterium.waarom : `${vakoordeel!.waarom} (${VAKOORDEEL_WAARSCHUWING})`,
      advies: stand === "goed" || stand === "niet vast te stellen" ? "" : String(r.advies || "").trim(),
      vastgesteldUit,
      bronnen: criterium ? criterium.bronnen : [],
      nuance: criterium?.nuance,
    });
  }

  const ontbreekt = [...CRITERIA, ...VAKOORDELEN].filter((p) => !gezien.has(p.id));
  if (ontbreekt.length) {
    opmerkingen.push(`Niet langsgelopen: ${ontbreekt.map((p) => p.id).join(", ")}. Die criteria zijn dus níet beoordeeld, ook niet stilzwijgend goedgekeurd.`);
  }
  return { bevindingen, opmerkingen };
}

/** De volgorde: wat mis is en zwaar weegt eerst. Berekend, niet gevoeld. */
export function opVolgorde(bevindingen: Bevinding[]): Bevinding[] {
  return [...bevindingen].sort((a, b) => {
    const s = STAND_GEWICHT[b.stand] * 10 + WEEGT_GEWICHT[b.weegt] - (STAND_GEWICHT[a.stand] * 10 + WEEGT_GEWICHT[a.weegt]);
    if (s !== 0) return s;
    // Onderbouwd gaat vóór vakoordeel: wat bewijs heeft, pak je eerder op.
    if (a.plank !== b.plank) return a.plank === "onderbouwd" ? -1 : 1;
    return a.criterium.localeCompare(b.criterium);
  });
}

/** Beoordeel één pagina. Geeft null terug als er geen bruikbaar antwoord kwam. */
export async function beoordeelPagina(
  desktop: Opname,
  mobiel: Opname | null,
  gedrag: PaginaGedragUitkomst | null,
  slug?: string,
): Promise<Oordeel> {
  const beelden: VisionImage[] = [
    { url: "", label: "Schermfoto 1: het eerste scherm op desktop (1440 breed), zonder scrollen.", base64: desktop.eersteScherm, mediaType: "image/jpeg" },
  ];
  if (desktop.helePagina) {
    beelden.push({
      url: "",
      label: `Schermfoto 2: de hele pagina op desktop van boven naar beneden${desktop.paginaHoogte > 6000 ? " (afgekapt op 6000 pixels, de pagina is langer)" : ""}.`,
      base64: desktop.helePagina,
      mediaType: "image/jpeg",
    });
  }
  if (mobiel) {
    beelden.push({ url: "", label: "Schermfoto 3: het eerste scherm op een telefoon (390 breed), zonder scrollen.", base64: mobiel.eersteScherm, mediaType: "image/jpeg" });
  }

  // De mobiele meting krijgt een eigen naam, anders staan dezelfde sleutel en
  // hetzelfde label er twee keer met een andere waarde en is niet meer te zien
  // welke van de twee onder een bevinding ligt.
  const metingen = [
    ...desktop.meting,
    ...(mobiel ? mobiel.meting.map((m) => ({ ...m, sleutel: `${m.sleutel}@mobiel`, label: `${m.label} (mobiel)` })) : []),
  ];
  const antwoord = await callClaudeImagesForcedTool(
    REGELS,
    bouwOpdracht(desktop, mobiel, gedrag),
    beelden,
    BEVINDING_TOOL,
    { slug, action: "pagina-lab-oordeel" },
    8000,
  );
  const ruw = (antwoord?.bevindingen as RuweBevinding[]) || [];
  const { bevindingen, opmerkingen } = keur(ruw, metingen);
  const gesorteerd = opVolgorde(bevindingen);
  return {
    url: desktop.bron.eindUrl || desktop.bron.url,
    beoordeeldOp: new Date().toISOString(),
    bevindingen: gesorteerd,
    opmerkingen,
    eerstDit: gesorteerd.filter((b) => b.stand === "mis" || b.stand === "kan beter").slice(0, 3),
    telling: STANDEN.map((s) => ({ stand: s, aantal: bevindingen.filter((b) => b.stand === s).length })),
  };
}

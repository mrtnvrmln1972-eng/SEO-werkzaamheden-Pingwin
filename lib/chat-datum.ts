// ═══════════════════════════════════════════════════════════
// VAN WANNEER IS DIT GESPREK? (één plek waar dat bepaald wordt)
// ═══════════════════════════════════════════════════════════
// Een chat zonder datum is niet te wegen. Precies dat ging mis bij Paul
// Hoevenaars: op /hovenier-oss/ stond een uitgewerkt gesprek uit juli en op
// /hovenier-uden/ een gesprek van 14 augustus met de herziene strategie, en op
// het scherm zagen die twee er identiek uit. Wie alleen de titel ziet, kan niet
// vaststellen welke afspraak nog geldt. Dat is geen detail: de fases erna
// (analyse, blauwdruk, copy) draaien op de laatste conclusie, dus als je de
// verkeerde voor de meest recente aanziet, genereer je een document op een
// achterhaald uitgangspunt.
//
// Deze module is de enige plek waar een gespreksdatum tot tekst wordt gemaakt.
// Er stonden al twee losse `korteDatum`-functies in de code (OverviewChat en
// DocumentenPanel), met elk hun eigen manier om de maand af te korten; dat is
// exact het patroon dat in dit project steeds opnieuw uit elkaar loopt. Alles
// wat een gespreksdatum toont, vraagt hem hier. Nooit een tweede versie.
// ═══════════════════════════════════════════════════════════

/** Wat er op het scherm komt: een kort label plus de volle uitleg als tooltip. */
export type GesprekDatum = {
  /** "14 aug", of "14 aug 2025" als het een ander jaar is. Leeg = geen datum. */
  label: string;
  /** Eén zin voor de tooltip: de volledige datum plus hoe lang geleden. */
  titel: string;
};

export const GEEN_GESPREK_DATUM: GesprekDatum = { label: "", titel: "" };

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Dezelfde twee soorten onzin als in bron-datum.ts: een leeg veld dat als
  // tijdstempel wordt gelezen (1970) en een datum in de toekomst. Allebei
  // "geen datum", want fout is erger dan onbekend.
  const jaar = d.getFullYear();
  if (jaar < 2000 || d.getTime() > Date.now() + 24 * 3600 * 1000) return null;
  return d;
}

/**
 * "14 aug", zoals je het zelf zou opschrijven. Het jaartal komt er alleen bij
 * als het gesprek niet uit dit jaar is; anders staat er ruis in elke rij.
 */
export function korteDatum(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "";
  const zelfdeJaar = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", ...(zelfdeJaar ? {} : { year: "numeric" }) });
}

/** Hele dagen tussen toen en nu. Negatief kan niet: de toekomst is al gefilterd. */
function dagenGeleden(d: Date): number {
  const dag = 24 * 3600 * 1000;
  const toen = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime();
  return Math.max(0, Math.round((vandaag - toen) / dag));
}

/** "vandaag", "gisteren", "6 dagen geleden", "3 weken geleden", "5 maanden geleden". */
export function hoeLangGeleden(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "";
  const n = dagenGeleden(d);
  if (n === 0) return "vandaag";
  if (n === 1) return "gisteren";
  if (n < 14) return `${n} dagen geleden`;
  if (n < 60) return `${Math.round(n / 7)} weken geleden`;
  return `${Math.round(n / 30)} maanden geleden`;
}

// ── Er loopt een antwoord op dit gesprek (25-08-2026) ──────────────────────
// Een gesprek draait op de server, dus een gesloten tabblad breekt niets af.
// Alleen was daar niets van te zien: heropende je het onderwerp, dan stond je
// vraag er zonder antwoord, en dat is precies hoe een mislukking er ook uitziet.
// Maartens vraag die ochtend: "draait hij nog in de achtergrond of wat, want ik
// zie hem niet meer". Het antwoord kwam gewoon binnen, maar dat was nergens aan
// af te lezen. Dit is de tekst die dat wél zegt, op één plek, net als de datum
// hierboven.

/** Wat er op het scherm komt terwijl er een antwoord onderweg is. */
export type GesprekBezig = {
  /** "bezig sinds 09:24", of "niet afgemaakt". Leeg = er loopt niets. */
  label: string;
  /** Eén zin voor de tooltip. */
  titel: string;
  /** true als het antwoord er nooit meer komt; dan staat het merkteken stil. */
  afgebroken: boolean;
};

export const NIET_BEZIG: GesprekBezig = { label: "", titel: "", afgebroken: false };

/**
 * `bezigSinds` is het moment waarop de vraag binnenkwam; `stand` komt uit
 * `bezigStand` in lib/chat.ts, want die grens (hoe lang "bezig" nog geloofwaardig
 * is) hoort bij de server die het werk doet, niet bij de opmaak.
 */
export function gesprekBezig(bezigSinds: string | null | undefined, stand: "nee" | "bezig" | "afgebroken"): GesprekBezig {
  const d = parse(bezigSinds);
  if (!d || stand === "nee") return NIET_BEZIG;
  const klok = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (stand === "afgebroken") {
    return {
      label: "niet afgemaakt",
      titel: `Je vraag van ${klok} is bewaard, maar er is nooit een antwoord op gekomen. Stel hem opnieuw; de tekst staat er nog.`,
      afgebroken: true,
    };
  }
  return {
    label: `bezig sinds ${klok}`,
    titel: `Het antwoord wordt gemaakt sinds ${klok}. Dat gebeurt op de server, dus je kunt dit scherm gerust sluiten; het antwoord staat er zodra het klaar is.`,
    afgebroken: false,
  };
}

/**
 * De datum van een gesprek, klaar om neer te zetten.
 *
 * `laatste` is het moment van het laatste bericht; dat is de datum die telt,
 * want die bepaalt of een afspraak nog de meest recente is. `gestart` is
 * optioneel: is dat een andere dag, dan komt het in de tooltip te staan, zodat
 * je ziet dat een gesprek langer heeft gelopen dan één middag.
 */
export function gesprekDatum(laatste: string | null | undefined, gestart?: string | null): GesprekDatum {
  const eind = parse(laatste);
  if (!eind) return GEEN_GESPREK_DATUM;
  const vol = eind.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const begin = parse(gestart);
  const andereDag = begin && begin.toDateString() !== eind.toDateString();
  const start = andereDag ? `, gestart op ${begin.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}` : "";
  return { label: korteDatum(laatste), titel: `Laatste bericht: ${vol} (${hoeLangGeleden(laatste)})${start}` };
}

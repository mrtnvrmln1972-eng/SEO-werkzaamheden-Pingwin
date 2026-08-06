// ═══════════════════════════════════════════════════════════
// DE AHREFS-TELLER: VAN TWEE GETALLEN NAAR EEN OORDEEL
// ═══════════════════════════════════════════════════════════
// Ahrefs geeft twee kale getallen terug: hoeveel units er op zijn en hoeveel er
// in het abonnement zitten. Een percentage daarvan is misleidend. 80% op is prima
// als de maand bijna om is, en alarmerend als hij net begonnen is.
//
// Daarom rekent dit bestand het tempo mee: hoe ver de abonnementsmaand is tegenover
// hoe ver de teller is. Dat levert het enige antwoord op dat er in de kopbalk toe
// doet: red ik het tot de volgende reset, of niet.
//
// Bewust een los bestand zonder database en zonder netwerk: pure rekenregels, dus
// na te rekenen in een proef (`proeven/ahrefs-teller.proef.ts`) in plaats van in
// het echt te moeten afwachten tot een teller een keer vol loopt.
// ═══════════════════════════════════════════════════════════

/** Hoe de teller ervoor staat. Bepaalt de kleur in de kopbalk. */
export type Sein = "rustig" | "let-op" | "krap" | "onbekend";

export type TellerStand = {
  used: number | null;
  limit: number | null;
  /** 0 tot 1, of null als er geen limiet bekend is. */
  deel: number | null;
  sein: Sein;
  /** Hele dagen tot de teller op nul gaat, of null als Ahrefs geen datum meldt. */
  dagenTotReset: number | null;
  /** Waar de teller op uitkomt als het huidige tempo doorzet tot de reset. */
  prognose: number | null;
  /** Eén zin in gewone taal: wat betekent dit. Nooit leeg. */
  oordeel: string;
};

/** Lengte van een abonnementsperiode. Ahrefs rekent per maand af. */
const PERIODE_DAGEN = 30;
const DAG_MS = 86400000;

function afgerond(n: number): number {
  return Math.round(n);
}

/**
 * Zet de ruwe Ahrefs-cijfers om in een stand met een oordeel.
 *
 * `nu` is een parameter en geen `new Date()` binnenin, zodat de proef een vaste
 * datum kan meegeven en de uitkomst niet elke dag verandert.
 */
export function tellerStand(
  ruw: { used: number | null; limit: number | null; resetIso: string | null } | null,
  nu: Date = new Date(),
): TellerStand {
  const leeg: TellerStand = {
    used: null, limit: null, deel: null, sein: "onbekend",
    dagenTotReset: null, prognose: null,
    oordeel: "Ahrefs meldt op dit moment geen tegoed.",
  };
  if (!ruw || ruw.used === null) return leeg;

  const used = ruw.used;
  const limit = ruw.limit !== null && ruw.limit > 0 ? ruw.limit : null;
  const deel = limit === null ? null : Math.min(used / limit, 1);

  // Dagen tot de reset. Een datum die al voorbij is (Ahrefs loopt soms een uur
  // achter op zijn eigen reset) telt als 0 en niet als een negatief getal.
  let dagenTotReset: number | null = null;
  if (ruw.resetIso) {
    const reset = new Date(ruw.resetIso);
    if (!Number.isNaN(reset.getTime())) {
      dagenTotReset = Math.max(0, Math.ceil((reset.getTime() - nu.getTime()) / DAG_MS));
    }
  }

  // Prognose: het tempo van de dagen die al verstreken zijn, doorgetrokken tot de
  // reset. Op dag 1 van een periode is dat tempo nog nietszeggend (één zware scan
  // maakt er dan een raket van), dus daaronder rekenen we niet.
  let prognose: number | null = null;
  if (dagenTotReset !== null) {
    const verstreken = PERIODE_DAGEN - dagenTotReset;
    if (verstreken >= 3) prognose = afgerond((used / verstreken) * PERIODE_DAGEN);
  }

  // Het sein. Twee dingen kunnen rood maken: de teller staat al hoog, óf het tempo
  // wijst erop dat hij vóór de reset op is. Dat tweede is het signaal dat je wilt
  // hebben op de dag dat het nog uitmaakt, niet op de dag dat je er al doorheen bent.
  let sein: Sein = "onbekend";
  if (deel !== null) {
    const teSnel = prognose !== null && limit !== null && prognose > limit;
    if (deel >= 0.9 || (teSnel && deel >= 0.6)) sein = "krap";
    else if (deel >= 0.7 || teSnel) sein = "let-op";
    else sein = "rustig";
  }

  return { used, limit, deel, sein, dagenTotReset, prognose, oordeel: oordeelVan({ deel, limit, sein, dagenTotReset, prognose }) };
}

function oordeelVan(s: { deel: number | null; limit: number | null; sein: Sein; dagenTotReset: number | null; prognose: number | null }): string {
  if (s.deel === null || s.limit === null) return "Ahrefs meldt wel verbruik, maar geen limiet; een percentage is er dus niet.";
  const pct = Math.round(s.deel * 100);
  const rest = s.dagenTotReset === null
    ? ""
    : s.dagenTotReset === 0
      ? " De teller gaat vandaag weer op nul."
      : s.dagenTotReset === 1
        ? " Morgen gaat de teller weer op nul."
        : ` Nog ${s.dagenTotReset} dagen tot de teller weer op nul gaat.`;
  const teSnel = s.prognose !== null && s.prognose > s.limit;
  if (s.sein === "krap") {
    return teSnel
      ? `${pct}% op, en op dit tempo raakt het tegoed op vóór de reset.${rest} Zware analyses nu even uitstellen.`
      : `${pct}% van het tegoed is op.${rest} Zware analyses nu even uitstellen.`;
  }
  if (s.sein === "let-op") {
    return teSnel
      ? `${pct}% op. Op dit tempo kom je tegen de grens aan vóór de reset.${rest}`
      : `${pct}% van het tegoed is op.${rest} Nog ruimte, maar het loopt.`;
  }
  return `${pct}% van het tegoed is op.${rest} Ruim voldoende over.`;
}

/** Kleur per sein. Eén plek, zodat kopbalk en paneel nooit uit elkaar lopen. */
export const SEIN_KLEUR: Record<Sein, string> = {
  rustig: "var(--brand-teal)",
  "let-op": "var(--orange)",
  krap: "var(--red)",
  onbekend: "var(--gray)",
};

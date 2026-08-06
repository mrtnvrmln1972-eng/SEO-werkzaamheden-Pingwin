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

// Het sein en zijn kleuren staan in lib/sein.ts: er hangt meer dan één teller in
// de kopbalk, en die moeten dezelfde kleurtaal spreken. Hier blijven ze bereikbaar
// zodat bestaande schermen niets hoeven te wijzigen.
import type { Sein } from "./sein";
export { SEIN_KLEUR } from "./sein";
export type { Sein };

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
  /**
   * Dezelfde boodschap, maar opgeknipt voor een smal paneel. `oordeel` is één
   * volle zin en leest goed in een tooltip of op een brede pagina; achter elkaar
   * in een uitklappaneel wordt hij een tekstmuur van vier regels. Daarom staan de
   * drie delen hier los, zodat het paneel ze onder elkaar kan zetten en het
   * percentage niet herhaalt (dat staat er al groot boven).
   */
  kern: string;
  /** "Nog 9 dagen tot de reset", of null als Ahrefs geen datum meldt. */
  resetZin: string | null;
  /** Alleen gevuld als het tempo écht iets te zeggen heeft; anders ruis. */
  tempoZin: string | null;
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
    kern: "Geen tegoed gemeld.", resetZin: null, tempoZin: null,
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

  // De drie losse zinnen, en daarna dezelfde inhoud als één doorlopende zin. Zo
  // is er één bron: het paneel en de tooltip kunnen nooit iets anders beweren.
  const kern = kernVan(sein, deel, prognose, limit);
  const resetZin = resetZinVan(dagenTotReset);
  const tempoZin = tempoZinVan(prognose, limit);
  const pct = deel === null ? null : Math.round(deel * 100);
  const oordeel = deel === null || limit === null
    ? "Ahrefs meldt wel verbruik, maar geen limiet; een percentage is er dus niet."
    : [`${pct}% van het tegoed is op.`, resetZin ? `${resetZin}.` : "", kern].filter(Boolean).join(" ");

  return { used, limit, deel, sein, dagenTotReset, prognose, oordeel, kern, resetZin, tempoZin };
}

/** De kwalificatie zonder het percentage; dat staat in het paneel al groot boven. */
function kernVan(sein: Sein, deel: number | null, prognose: number | null, limit: number | null): string {
  if (deel === null || limit === null) return "Geen limiet bekend, dus geen percentage.";
  const teSnel = prognose !== null && prognose > limit;
  if (sein === "krap") return teSnel ? "Raakt op vóór de reset. Zware analyses even uitstellen." : "Bijna op. Zware analyses even uitstellen.";
  if (sein === "let-op") return teSnel ? "Op dit tempo kom je tegen de grens aan." : "Nog ruimte, maar het loopt.";
  return "Ruim voldoende over.";
}

function resetZinVan(dagen: number | null): string | null {
  if (dagen === null) return null;
  if (dagen === 0) return "De teller gaat vandaag op nul";
  if (dagen === 1) return "Morgen gaat de teller op nul";
  return `Nog ${dagen} dagen tot de teller op nul gaat`;
}

/**
 * Het tempo alleen noemen als het iets betekent. Een prognose die ruim onder de
 * limiet blijft is een getal zonder boodschap, en juist zulke regels maken van
 * een paneel een muur. Vanaf viervijfde van de limiet gaat het ergens over.
 */
function tempoZinVan(prognose: number | null, limit: number | null): string | null {
  if (prognose === null || limit === null || prognose < limit * 0.8) return null;
  const n = prognose.toLocaleString("nl-NL");
  return prognose > limit
    ? `Op dit tempo kom je uit op ${n} units, meer dan er in het abonnement zit`
    : `Op dit tempo eindigt de maand rond ${n} units`;
}

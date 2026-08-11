import { ensureSchema } from "./db";
import { bestaatPagina } from "./site-controle";
import { meetCopyLive } from "./copy-live";
import { haalCopyTekst, heeftCopyDocument } from "./copy-tekst";
import { fetchRawJsonLd } from "./page-schema";

// ═══════════════════════════════════════════════════════════
// WAT ER MEETBAAR AF MOET ZIJN
// ═══════════════════════════════════════════════════════════
// Bij het doorzetten naar de sitebouwer spreek je af wat er straks te zien moet
// zijn: staat de pagina live, staan de geschreven koppen erop, staat de
// structured data erop. Later meet één knop precies díe punten op de live pagina.
//
// Waarom dit als een lijstje wordt vastgelegd en niet als vrije tekst: een
// afspraak in een zin ("zet hem live en verwerk de copy") is niet na te meten. En
// zonder nameten blijft "is dit nou gedaan?" een vraag die je met de hand op de
// site beantwoordt, of helemaal niet. In januari 2026 kon niemand vaststellen of
// zes interne links nu wel of niet verdwenen waren; dat is precies dit gat.
//
// Harde regel: een mislukte meting is nooit een oordeel. Kunnen we de pagina niet
// lezen (site weigert ons, time-out), dan is de uitslag "kon ik niet meten" en
// verandert er niets. Beweren dat iets niet gedaan is terwijl je het niet gezien
// hebt, is erger dan niets weten.

export type PuntId = "live" | "koppen" | "schema";

export type DevPunt = { id: PuntId; label: string };

export const ALLE_PUNTEN: DevPunt[] = [
  { id: "live", label: "De pagina staat live en geeft geen foutmelding" },
  { id: "koppen", label: "De aangeleverde koppen staan op de pagina" },
  { id: "schema", label: "De structured data staat op de pagina" },
];

export type PuntUitslag = {
  id: PuntId;
  label: string;
  uitslag: "goed" | "niet" | "onmeetbaar";
  bewijs: string;
};

export type Doorgevoerd = {
  url: string;
  gemeten: string;
  punten: PuntUitslag[];
  /** Alle gemeten punten in orde? Onmeetbare punten tellen niet als "goed". */
  alles: boolean;
  /** Kon er überhaupt iets gemeten worden? */
  meetbaar: boolean;
  samenvatting: string;
  /**
   * De ruwe koppen-meting, als die punt is gemeten. Zodat de aanroeper hem kan
   * doorzetten naar de gedeelde stand (persistCopyLive in copy-live.ts): zonder
   * dat blijft deze meting op zichzelf staan en weet de rest van het dashboard
   * (fase "Bouw en publicatie", het bordoverzicht) niet dat de copy net bevestigd
   * live bleek.
   */
  copyLive?: Awaited<ReturnType<typeof meetCopyLive>>;
};

/**
 * Welke punten stellen we standaard voor bij deze pagina? Alleen wat we ook echt
 * kunnen nameten: is er geen copydocument, dan is "de koppen staan erop" geen
 * afspraak maar een belofte die niemand kan controleren.
 *
 * "Is er een copydocument" is bewust de brede vraag (zie copy-tekst.ts): ook een
 * document dat alleen als link bekend is telt mee. Anders stelt het dashboard een
 * controle niet voor terwijl het document in dezelfde kaart staat.
 */
export async function voorstelPunten(slug: string, url: string): Promise<PuntId[]> {
  await ensureSchema();
  const uit: PuntId[] = ["live"];
  if (await heeftCopyDocument(slug, url).catch(() => false)) uit.push("koppen");
  return uit;
}

/**
 * Meet de afgesproken punten op de live pagina.
 *
 * Elk punt geeft zijn eigen bewijs terug, in gewone taal, zodat het in de kaart
 * en in een mail aan de sitebouwer kan zonder vertaalslag.
 */
export async function meetDoorgevoerd(slug: string, url: string, punten: PuntId[]): Promise<Doorgevoerd> {
  await ensureSchema();
  const wanneer = new Date().toISOString();
  const lijst = punten.length ? punten : (["live"] as PuntId[]);
  const uit: PuntUitslag[] = [];
  const labelVan = (id: PuntId) => ALLE_PUNTEN.find((p) => p.id === id)?.label || id;

  // Eerst of de pagina er is. Is hij dat niet, dan hebben de andere punten geen
  // betekenis meer: je kunt geen koppen zoeken op een pagina die 404 geeft.
  const bestaat = await bestaatPagina(url).catch(() => null);
  const status = bestaat?.status ?? null;
  const leesbaar = !!bestaat && bestaat.bestaat;

  if (lijst.includes("live")) {
    uit.push(bestaat === null
      ? { id: "live", label: labelVan("live"), uitslag: "onmeetbaar", bewijs: "de pagina reageerde niet; kon ik niet meten" }
      : bestaat.bestaat
        ? { id: "live", label: labelVan("live"), uitslag: "goed", bewijs: `pagina laadt (${status})${bestaat.omleiding ? `, via een omleiding naar ${bestaat.omleiding}` : ""}` }
        : { id: "live", label: labelVan("live"), uitslag: "niet", bewijs: `pagina geeft ${status ?? "geen antwoord"}` });
  }

  // De ruwe koppen-meting, als die punt gemeten wordt: de aanroeper zet hem door
  // naar de gedeelde stand (persistCopyLive), zodat een meting hier niet op
  // zichzelf blijft staan (zie het commentaar bij Doorgevoerd.copyLive).
  let copyLive: Doorgevoerd["copyLive"];
  if (lijst.includes("koppen")) {
    const bron = await haalCopyTekst(slug, url).catch(() => ({ tekst: "", herkomst: "", link: "", reden: "ik kon niet nagaan of er een copydocument is" }));
    if (!bron.tekst) {
      // De reden komt uit copy-tekst.ts en is bewust specifiek: "er is er geen"
      // is iets anders dan "hij is er wel, maar onleesbaar".
      uit.push({ id: "koppen", label: labelVan("koppen"), uitslag: "onmeetbaar", bewijs: bron.reden });
    } else if (!leesbaar) {
      uit.push({ id: "koppen", label: labelVan("koppen"), uitslag: "onmeetbaar", bewijs: "de pagina laadt niet, dus er valt niets te vergelijken" });
    } else {
      const m = await meetCopyLive(url, bron.tekst).catch(() => null);
      if (!m || !m.meetbaar) {
        // Geen koppen in het document is iets anders dan een pagina die we niet
        // konden lezen; zonder dat onderscheid ga je de site zitten controleren
        // terwijl het aan het document ligt.
        const geenKoppen = !!m && m.totaal === 0;
        uit.push({
          id: "koppen", label: labelVan("koppen"), uitslag: "onmeetbaar",
          bewijs: geenKoppen
            ? `in ${bron.herkomst} staan geen herkenbare koppen om tegen te vergelijken`
            : "kon de koppen van de pagina niet uitlezen",
        });
      } else {
        copyLive = m;
        uit.push({
          id: "koppen", label: labelVan("koppen"),
          uitslag: m.doorgevoerd ? "goed" : "niet",
          bewijs: `${m.gevonden} van de ${m.totaal} koppen uit ${bron.herkomst} gevonden`,
        });
      }
    }
  }

  if (lijst.includes("schema")) {
    if (!leesbaar) {
      uit.push({ id: "schema", label: labelVan("schema"), uitslag: "onmeetbaar", bewijs: "de pagina laadt niet" });
    } else {
      const rauw = await fetchRawJsonLd(url).catch(() => null);
      const blokken = Array.isArray(rauw) ? rauw.length : rauw ? 1 : 0;
      uit.push(blokken > 0
        ? { id: "schema", label: labelVan("schema"), uitslag: "goed", bewijs: `${blokken} schema-blok${blokken === 1 ? "" : "ken"} gevonden` }
        : { id: "schema", label: labelVan("schema"), uitslag: "niet", bewijs: "geen structured data op de pagina gevonden" });
    }
  }

  const gemeten = uit.filter((p) => p.uitslag !== "onmeetbaar");
  const goed = gemeten.filter((p) => p.uitslag === "goed").length;
  const alles = gemeten.length > 0 && goed === gemeten.length;
  const samenvatting = gemeten.length === 0
    ? "kon niets meten"
    : `${goed} van de ${gemeten.length} punten in orde${uit.length > gemeten.length ? `, ${uit.length - gemeten.length} niet te meten` : ""}`;

  return { url, gemeten: wanneer, punten: uit, alles, meetbaar: gemeten.length > 0, samenvatting, copyLive };
}

/**
 * De regel die in de kaarttekst komt. Eén regel per controle, en een volgende
 * controle VERVANGT hem. Zonder die regel stapelt "Gecontroleerd op…" zich op tot
 * precies de muur waar we deze kaart net van bevrijd hebben.
 */
export const CONTROLE_PREFIX = "Gecontroleerd";

export function controleRegel(d: Doorgevoerd): string {
  const datum = new Date(d.gemeten).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const details = d.punten.map((p) => `${p.label.toLowerCase()}: ${p.bewijs}`).join("; ");
  return `${CONTROLE_PREFIX} ${datum}: ${d.samenvatting}. ${details}.`;
}

/** De kaarttekst met de nieuwe controleregel, en zonder de vorige. */
export function vervangControleRegel(toelichting: string, regel: string): string {
  const regels = (toelichting || "").split("\n").filter((r) => !r.trim().replace(/^[-*]\s*/, "").startsWith(CONTROLE_PREFIX));
  return [...regels, `- ${regel}`].join("\n").trim();
}

import { sql, ensureSchema } from "./db";
import { bestaatPagina } from "./site-controle";
import { meetCopyLive } from "./copy-live";
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
};

/**
 * Welke punten stellen we standaard voor bij deze pagina? Alleen wat we ook echt
 * kunnen nameten: is er geen copydocument, dan is "de koppen staan erop" geen
 * afspraak maar een belofte die niemand kan controleren.
 */
export async function voorstelPunten(slug: string, url: string): Promise<PuntId[]> {
  await ensureSchema();
  const uit: PuntId[] = ["live"];
  const { rows } = await sql`
    SELECT 1 FROM page_doc_outputs
    WHERE client_slug = ${slug} AND url = ${url} AND kind = 'copy' AND content IS NOT NULL AND content <> ''
    LIMIT 1`;
  if (rows.length) uit.push("koppen");
  return uit;
}

/** De copytekst van deze pagina, als die er is. */
async function copyTekst(slug: string, url: string): Promise<string> {
  const { rows } = await sql`
    SELECT content FROM page_doc_outputs
    WHERE client_slug = ${slug} AND url = ${url} AND kind = 'copy' AND content IS NOT NULL AND content <> ''
    ORDER BY id DESC LIMIT 1`;
  return String(rows[0]?.content || "");
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

  if (lijst.includes("koppen")) {
    const tekst = await copyTekst(slug, url).catch(() => "");
    if (!tekst) {
      uit.push({ id: "koppen", label: labelVan("koppen"), uitslag: "onmeetbaar", bewijs: "er is geen copydocument om tegen te vergelijken" });
    } else if (!leesbaar) {
      uit.push({ id: "koppen", label: labelVan("koppen"), uitslag: "onmeetbaar", bewijs: "de pagina laadt niet, dus er valt niets te vergelijken" });
    } else {
      const m = await meetCopyLive(url, tekst).catch(() => null);
      if (!m || !m.meetbaar) {
        uit.push({ id: "koppen", label: labelVan("koppen"), uitslag: "onmeetbaar", bewijs: "kon de koppen van de pagina niet uitlezen" });
      } else {
        uit.push({
          id: "koppen", label: labelVan("koppen"),
          uitslag: m.doorgevoerd ? "goed" : "niet",
          bewijs: `${m.gevonden} van de ${m.totaal} koppen gevonden`,
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

  return { url, gemeten: wanneer, punten: uit, alles, meetbaar: gemeten.length > 0, samenvatting };
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

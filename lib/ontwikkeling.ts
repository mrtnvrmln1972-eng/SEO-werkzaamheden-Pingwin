import { getClientTrend } from "./trends";
import { getChangeEvents } from "./content-tracking";

// ═══════════════════════════════════════════════════════════
// R9: "ONTWIKKELING DEZE MAAND" VOOR HET KLANTDASHBOARD
// ═══════════════════════════════════════════════════════════
// Dit bestand verzint niets nieuws: het zet twee metingen die al bestaan om in
// gewone taal voor de klant.
//  - client_trends (lib/trends.ts, gevuld door de nachtelijke cron
//    client-trends): klikken/vertoningen nu vs. de periode ervoor, uit GSC.
//    Dat IS de voor-en-na-meting waar de routekaart naar verwijst.
//  - page_change_events (lib/content-tracking.ts): wat er de afgelopen
//    dertig dagen op de site is aangepast.
// Bewust geen AI-samenvatting: de cijfers zijn er al, en een sjabloon met de
// echte getallen is te controleren. "Verifieer, gok nooit" geldt ook voor wat
// de klant te lezen krijgt.
// ═══════════════════════════════════════════════════════════

export type OntwikkelingDezeMaand = {
  heeftKlikdata: boolean;
  klikkenNu: number;
  klikkenVorige: number;
  klikkenDeltaPct: number | null;
  vertoningenNu: number;
  vertoningenVorige: number;
  vertoningenDeltaPct: number | null;
  isGoed: boolean;
  gemetenOp: string | null;
  aantalWijzigingen: number;
  aantalPaginas: number;
  laatsteWijzigingen: { url: string; samenvatting: string; datum: string }[];
  kop: string;
  regels: string[];
};

function deltaPct(nu: number, vorige: number): number | null {
  if (vorige <= 0) return null;
  return Math.round(((nu - vorige) / vorige) * 100);
}

function fmtPct(p: number | null): string {
  if (p === null) return "";
  return ` (${p > 0 ? "+" : ""}${p}%)`;
}

function kortePad(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname || "/").replace(/\/+$/, "/") || "/";
  } catch {
    return url;
  }
}

export async function getOntwikkelingDezeMaand(slug: string): Promise<OntwikkelingDezeMaand> {
  const [trend, wijzigingen] = await Promise.all([
    getClientTrend(slug, "28d"),
    getChangeEvents(slug, 200),
  ]);

  const dertigDagenGeleden = Date.now() - 30 * 86400000;
  const recent = wijzigingen.filter((w) => new Date(w.detectedAt).getTime() >= dertigDagenGeleden);
  const paginas = new Set(recent.map((w) => kortePad(w.url)));
  // Nieuwste wijziging per pagina, voor een korte lijst zonder dubbele regels.
  const perPagina = new Map<string, (typeof recent)[number]>();
  for (const w of recent) {
    const key = kortePad(w.url);
    const bestaand = perPagina.get(key);
    if (!bestaand || new Date(w.detectedAt) > new Date(bestaand.detectedAt)) perPagina.set(key, w);
  }
  const laatsteWijzigingen = [...perPagina.entries()]
    .sort((a, b) => new Date(b[1].detectedAt).getTime() - new Date(a[1].detectedAt).getTime())
    .slice(0, 5)
    .map(([url, w]) => ({ url, samenvatting: w.summary || "aangepast", datum: w.detectedAt }));

  const heeftKlikdata = !!trend;
  const klikkenNu = trend?.clicksNow ?? 0;
  const klikkenVorige = trend?.clicksPrev ?? 0;
  const vertoningenNu = trend?.impressionsNow ?? 0;
  const vertoningenVorige = trend?.impressionsPrev ?? 0;
  const klikkenDeltaPct = trend ? deltaPct(klikkenNu, klikkenVorige) : null;
  const vertoningenDeltaPct = trend ? deltaPct(vertoningenNu, vertoningenVorige) : null;
  const isGoed = !!trend?.isGood;

  let kop: string;
  if (!heeftKlikdata) {
    kop = "De meting vanuit Google loopt nog niet lang genoeg voor een uitspraak over deze maand.";
  } else if (isGoed) {
    kop = "Deze maand gaat de vindbaarheid duidelijk de goede kant op.";
  } else if ((klikkenDeltaPct ?? 0) <= -10) {
    kop = "Deze maand liep het bezoek vanuit Google terug; daar wordt naar gekeken.";
  } else {
    kop = "Deze maand bleef het bezoek vanuit Google ongeveer gelijk.";
  }

  const regels: string[] = [];
  if (heeftKlikdata) {
    regels.push(
      `Vanuit Google kwamen de afgelopen 28 dagen ${klikkenNu} klikken, tegen ${klikkenVorige} de periode ` +
        `ervoor${fmtPct(klikkenDeltaPct)}.`,
    );
    regels.push(
      `De pagina's verschenen ${vertoningenNu} keer in de zoekresultaten, tegen ${vertoningenVorige} keer ` +
        `ervoor${fmtPct(vertoningenDeltaPct)}.`,
    );
  }
  if (recent.length > 0) {
    regels.push(
      `Er zijn de afgelopen maand ${recent.length} aanpassing${recent.length === 1 ? "" : "en"} doorgevoerd op ` +
        `${paginas.size} pagina${paginas.size === 1 ? "" : "'s"}.`,
    );
  } else {
    regels.push("Er zijn de afgelopen maand geen aanpassingen aan de site vastgelegd.");
  }

  return {
    heeftKlikdata,
    klikkenNu,
    klikkenVorige,
    klikkenDeltaPct,
    vertoningenNu,
    vertoningenVorige,
    vertoningenDeltaPct,
    isGoed,
    gemetenOp: trend?.computedAt ?? null,
    aantalWijzigingen: recent.length,
    aantalPaginas: paginas.size,
    laatsteWijzigingen,
    kop,
    regels,
  };
}

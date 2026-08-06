import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// IS HET ECHT AF? DE ROUTEKAART CONTROLEERT ZICHZELF
// ═══════════════════════════════════════════════════════════
// De stand in lib/routekaart.ts is een BEWERING: een chat zet hem op "af". Dat
// ging op 6 augustus 2026 meteen mis: R1 stond op af terwijl er nog aan gewerkt
// werd, en Maarten kon dat op geen enkele manier zien.
//
// Dit bestand meet het in plaats van het te geloven, met precies dezelfde regel
// die de rest van het dashboard hanteert: meten en oordelen zijn gescheiden, en
// elke uitkomst draagt zijn eigen bewijs mee.
//
// Waarom dit automatisch over de LIVE versie gaat: deze controle draait in de
// applicatie zelf. Wat hier "ja" zegt, zegt "ja" op de code die op dat moment
// draait en op de database die eronder hangt. Er is geen versie-vergelijking
// nodig; het antwoord kán niet over een andere versie gaan dan die je bekijkt.
//
// Drie soorten bewijs, alle drie betrouwbaar in productie:
//
//  1. `gedeployd` — bestaat het stukje code echt in de draaiende versie? Dat
//     controleren we door de module in te laden en te kijken of de functie er is.
//     Bewust GEEN bestand van schijf lezen: broncode staat niet gegarandeerd in
//     een serverless-omgeving, en een controle die zelf soms faalt is nutteloos.
//  2. `kolom` — bestaat de kolom in de database? Uit information_schema.
//  3. `data` — is het ook echt gebruikt? Eén telling die groter dan nul moet zijn.
//
// Een punt is pas "aangetoond" als álle bewijzen kloppen. Ontbreekt de data maar
// staat de code er wel, dan is dat een eigen uitkomst ("gedeployd, nog niet in
// gebruik gezien"), want dat is precies het verschil tussen gebouwd en werkend.
//
// Punten zonder bewijs krijgen "geen controle". Dat is geen luiheid maar een
// keuze: een verzonnen controle op iets dat nog niet bestaat zou een kolomnaam
// gokken en daarna eeuwig rood staan. Het vastleggen van de controle hoort bij
// het oppakken van het punt (zie .claude/commands/ontwikkelpunt.md).
// ═══════════════════════════════════════════════════════════

export type BewijsRegel =
  | { soort: "gedeployd"; wat: string; laad: () => Promise<Record<string, unknown>>; functie: string }
  | { soort: "kolom"; wat: string; tabel: string; kolom: string }
  | { soort: "data"; wat: string; telling: () => Promise<number> };

export type RegelUitslag = { wat: string; ok: boolean; toelichting?: string };

export type Uitslag = {
  /** aangetoond = alles klopt. half = code staat er, in gebruik nog niet gezien. */
  stand: "aangetoond" | "half" | "niet-aangetoond" | "geen-controle";
  regels: RegelUitslag[];
};

// ── De bewijzen per punt ──────────────────────────────────────────────────
// Alleen punten waarvoor een échte controle bestaat staan hier. Groeit mee met
// het werk: wie een punt oppakt, legt hier de controle vast.
const BEWIJZEN: Record<string, BewijsRegel[]> = {
  R1: [
    {
      soort: "gedeployd",
      wat: "De autoriteit per pagina wordt bij Ahrefs opgehaald",
      laad: () => import("./ahrefs") as Promise<Record<string, unknown>>,
      functie: "getUrlRatings",
    },
    {
      soort: "gedeployd",
      wat: "De interne-links-motor weegt op die gemeten autoriteit",
      laad: () => import("./internal-links") as Promise<Record<string, unknown>>,
      functie: "runInternalLinks",
    },
    {
      soort: "data",
      wat: "Er staat een analyse met een gemeten autoriteit in",
      telling: async () => {
        await ensureSchema();
        // De opgeslagen analyse is JSON; we zoeken het veld dat R1 toevoegde.
        const { rows } = await sql`
          SELECT COUNT(*)::int AS n FROM client_internal_links
          WHERE result LIKE '%urlRating%'
        `;
        return Number(rows[0]?.n || 0);
      },
    },
  ],

  R4: [
    {
      soort: "data",
      wat: "Er staat Ahrefs-verbruik in de verbruiksmeting",
      telling: async () => {
        await ensureSchema();
        const { rows } = await sql`
          SELECT COUNT(*)::int AS n FROM service_usage WHERE service = 'ahrefs'
        `;
        return Number(rows[0]?.n || 0);
      },
    },
  ],
};

async function toetsRegel(r: BewijsRegel): Promise<RegelUitslag> {
  try {
    if (r.soort === "gedeployd") {
      const mod = await r.laad();
      const ok = typeof mod[r.functie] === "function";
      return { wat: r.wat, ok, toelichting: ok ? undefined : "zit niet in de versie die nu draait" };
    }
    if (r.soort === "kolom") {
      await ensureSchema();
      const { rows } = await sql`
        SELECT COUNT(*)::int AS n FROM information_schema.columns
        WHERE table_name = ${r.tabel} AND column_name = ${r.kolom}
      `;
      const ok = Number(rows[0]?.n || 0) > 0;
      return { wat: r.wat, ok, toelichting: ok ? undefined : "staat nog niet in de database" };
    }
    const n = await r.telling();
    return {
      wat: r.wat,
      ok: n > 0,
      toelichting: n > 0 ? `${n} keer gevonden` : "nog niet één keer gezien",
    };
  } catch {
    // Een controle die zelf stukloopt mag nooit als "af" gelden.
    return { wat: r.wat, ok: false, toelichting: "de controle kon niet uitgevoerd worden" };
  }
}

/** Controleert één punt. Geen bewijzen vastgelegd = eerlijk "geen controle". */
export async function controleerPunt(code: string): Promise<Uitslag> {
  const regels = BEWIJZEN[code];
  if (!regels?.length) return { stand: "geen-controle", regels: [] };

  const uitslagen = await Promise.all(regels.map(toetsRegel));
  const codeRegels = uitslagen.filter((_, i) => regels[i].soort !== "data");
  const dataRegels = uitslagen.filter((_, i) => regels[i].soort === "data");

  if (uitslagen.every((u) => u.ok)) return { stand: "aangetoond", regels: uitslagen };
  // Code staat er wel, maar er is nog geen spoor van gebruik: dat is iets anders
  // dan "niet gebouwd", en het verschil is precies wat Maarten wil zien.
  if (codeRegels.length > 0 && codeRegels.every((u) => u.ok) && dataRegels.some((u) => !u.ok)) {
    return { stand: "half", regels: uitslagen };
  }
  return { stand: "niet-aangetoond", regels: uitslagen };
}

/** Controleert een reeks punten tegelijk. */
export async function controleerAlles(codes: string[]): Promise<Record<string, Uitslag>> {
  const paren = await Promise.all(codes.map(async (c) => [c, await controleerPunt(c)] as const));
  return Object.fromEntries(paren);
}

/** Heeft dit punt een controle? Voor de tekst op het scherm. */
export function heeftControle(code: string): boolean {
  return Boolean(BEWIJZEN[code]?.length);
}

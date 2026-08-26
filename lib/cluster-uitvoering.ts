// ═══════════════════════════════════════════════════════════
// WAT DE STAPPEN VAN EEN BLOK OPLEVEREN
// ═══════════════════════════════════════════════════════════
// Het draaiboek (`lib/cluster-draaiboek.ts`) kent de route en de sloten. Dit
// bestand doet het rekenwerk van de stappen die géén AI nodig hebben: de
// termverdeling, het verdict per pagina, het linkplan en het bouwpakket.
//
// Dat onderscheid is niet toevallig. Bij honderd blokken is het verschil tussen
// betaalbaar en onbetaalbaar precies dit: alleen de copy heeft het zware model
// nodig, de rest is uit te rekenen. Alles hier is een pure functie, dus
// `proeven/cluster-uitvoering.proef.ts` kan het narekenen met een echt cluster.

import { padVan } from "./werk-clusters";
import { urenTekst, paginaRegel, HANDELING_LABEL, type ClusterPagina, type Werkcluster } from "./werkplan";

const nl = new Intl.NumberFormat("nl-NL");
const getal = (n: number | null | undefined) => (n == null ? "onbekend" : nl.format(n));

// ═══════════════════════════════════════════════════════════
// 1. DE TERMVERDELING
// ═══════════════════════════════════════════════════════════
// Het besluit dat één keer voor het hele blok valt, vóór er een letter
// geschreven wordt: welke pagina mag welke zoekterm hebben, en welke moet hij
// afstaan. Zonder dit schrijven twee pagina's over hetzelfde en houdt de
// cannibalisatie zichzelf in stand.

export type TermRegel = { pad: string; krijgt: string[]; staatAf: string[]; rol: string };

export function bouwTermverdeling(cluster: Werkcluster): TermRegel[] {
  const doel = padVan(cluster.doel || "");
  const verdwijners = cluster.paginas.filter((p) => p.handeling === "samenvoegen" || p.handeling === "opruimen");
  const overgenomen = verdwijners.map((p) => p.term).filter(Boolean);

  return cluster.paginas.map((p) => {
    const pad = padVan(p.pad);
    const eigen = p.term ? [p.term] : [];
    if (p.handeling === "samenvoegen" || p.handeling === "opruimen") {
      return {
        pad, krijgt: [], staatAf: eigen,
        rol: p.handeling === "samenvoegen" ? "gaat op in de hoofdpagina" : "verdwijnt",
      };
    }
    if (pad === doel) {
      return {
        pad, krijgt: [...new Set([...eigen, ...overgenomen])], staatAf: [],
        rol: "hoofdpagina van dit blok",
      };
    }
    return { pad, krijgt: eigen, staatAf: [], rol: "blijft met een eigen zoekvraag" };
  });
}

// ═══════════════════════════════════════════════════════════
// 2. HET VERDICT PER PAGINA
// ═══════════════════════════════════════════════════════════
// Aanvullen of herschrijven, en dat is geen smaak maar een tabel. De harde regel
// zit in het midden: een pagina die al posities of klikken heeft, wordt NOOIT
// volledig herschreven. Daar gooi je weg wat werkt.

export type Verdict = { pad: string; verdict: string; waarom: string; risico: boolean };

export function bouwVerdict(cluster: Werkcluster): Verdict[] {
  return cluster.paginas.map((p) => {
    const pad = padVan(p.pad);
    if (p.handeling === "opruimen") {
      return { pad, verdict: "weg", waarom: p.naar ? `Omleiden naar ${padVan(p.naar)}.` : "Levert niets op.", risico: false };
    }
    if (p.handeling === "samenvoegen") {
      return { pad, verdict: "opgaan in de hoofdpagina", waarom: "De bruikbare passages verhuizen mee, daarna de omleiding.", risico: false };
    }
    if (p.handeling === "meta") {
      return { pad, verdict: "alleen titel en description", waarom: "Aan de inhoud van deze pagina verandert niets.", risico: false };
    }
    if (p.handeling === "nieuw") {
      return { pad, verdict: "nieuw schrijven", waarom: "Deze pagina bestaat nog niet.", risico: false };
    }
    // Blijft of uitbouwen: heeft hij iets te verliezen?
    const heeftPositie = p.positie != null && p.positie <= 20;
    const heeftKlikken = (p.klikken || 0) > 0;
    if (heeftPositie || heeftKlikken) {
      const bewijs = [
        heeftPositie ? `staat op positie ${String(p.positie).replace(".", ",")}` : "",
        heeftKlikken ? `${getal(p.klikken)} klikken` : "",
      ].filter(Boolean).join(" en ");
      return {
        pad, verdict: "aanvullen, niet herschrijven",
        waarom: `Deze pagina ${bewijs}. Wat werkt blijft staan; we vullen alleen aan en scherpen aan.`,
        risico: true,
      };
    }
    return {
      pad, verdict: "gericht herschrijven",
      waarom: "Geen posities en geen klikken om te beschermen, dus de tekst mag sectie voor sectie om.",
      risico: false,
    };
  });
}

// ═══════════════════════════════════════════════════════════
// 3. HET LINKPLAN
// ═══════════════════════════════════════════════════════════
// Interne links zijn een eigenschap van het blok en niet van één pagina, en
// daarom lukt het per pagina nooit: je legt ze over en weer of je legt ze niet.
// Een pagina die straks wordt omgeleid krijgt geen links; daar zou je linkwaarde
// naar een omleiding sturen.

export type LinkRegel = { van: string; naar: string; anker: string; waarom: string };

export function bouwLinkplan(cluster: Werkcluster): LinkRegel[] {
  const doel = padVan(cluster.doel || "");
  if (!doel) return [];
  const blijvers = cluster.paginas.filter(
    (p) => p.handeling !== "samenvoegen" && p.handeling !== "opruimen" && padVan(p.pad) !== doel,
  );
  const doelPagina = cluster.paginas.find((p) => padVan(p.pad) === doel);
  const doelTerm = doelPagina?.term || "";

  const uit: LinkRegel[] = [];
  for (const p of blijvers) {
    uit.push({
      van: padVan(p.pad), naar: doel,
      anker: doelTerm || "de hoofdpagina van dit onderwerp",
      waarom: "Stuurt bezoekers en linkwaarde naar de pagina die dit onderwerp moet winnen.",
    });
    if (p.term) {
      uit.push({
        van: doel, naar: padVan(p.pad), anker: p.term,
        waarom: "Terug, zodat de eigen zoekvraag van deze pagina vindbaar blijft vanaf de hoofdpagina.",
      });
    }
  }
  return uit;
}

// ═══════════════════════════════════════════════════════════
// 4. HET BOUWPAKKET
// ═══════════════════════════════════════════════════════════
// Eén document dat de bouwer van boven naar beneden kan afwerken. Bewust in
// gewone taal en per pagina, want hij leest geen SEO-rapport.

export function bouwBouwpakket(
  cluster: Werkcluster,
  termen: TermRegel[],
  verdicten: Verdict[],
  links: LinkRegel[],
): string {
  const r: string[] = [];
  const term = (pad: string) => termen.find((t) => t.pad === padVan(pad));
  const verdict = (pad: string) => verdicten.find((v) => v.pad === padVan(pad));

  r.push(`## Bouwpakket: ${cluster.naam}`);
  r.push("");
  r.push(`${cluster.samenvatting}. Samen ongeveer ${urenTekst(cluster.minuten)} werk.`);
  if (cluster.doel) r.push(`De hoofdpagina van dit blok is ${padVan(cluster.doel)}; daar wijst alles naartoe.`);
  r.push("");

  if (cluster.gedeeld.length) {
    r.push("### Waarom dit blok bij elkaar hoort");
    r.push("");
    for (const regel of cluster.gedeeld) r.push(regel);
    r.push("");
  }

  r.push("### Wat er per pagina moet gebeuren");
  r.push("");
  for (const p of cluster.paginas) {
    const pad = padVan(p.pad);
    const t = term(pad);
    const v = verdict(pad);
    r.push(`#### ${pad}`);
    r.push("");
    r.push(`**Wat we doen:** ${HANDELING_LABEL[p.handeling]}, ${paginaRegel(p)}.`);
    if (v) r.push(`**Aanpak:** ${v.verdict}. ${v.waarom}`);
    if (t?.krijgt.length) r.push(`**Deze pagina moet gaan over:** ${t.krijgt.join(", ")}.`);
    if (t?.staatAf.length) r.push(`**Haal weg uit titel, H1 en eerste alinea:** ${t.staatAf.join(", ")}.`);
    if (p.meta) {
      r.push(`**Titel nu:** ${p.meta.curTitle || "ontbreekt"}`);
      r.push(`**Description nu:** ${p.meta.curDesc || "ontbreekt"}`);
    }
    if (p.onderbouwing.length) {
      r.push("");
      r.push("**Onderbouwing:**");
      for (const o of p.onderbouwing) r.push(`- ${o}`);
    }
    r.push("");
  }

  if (links.length) {
    r.push("### Interne links die gelegd moeten worden");
    r.push("");
    r.push("| Op deze pagina | Link naar | Met deze ankertekst |");
    r.push("|---|---|---|");
    for (const l of links) r.push(`| ${l.van} | ${l.naar} | ${l.anker} |`);
    r.push("");
  }

  const omleidingen = cluster.paginas.filter((p) => p.handeling === "samenvoegen" || p.handeling === "opruimen");
  if (omleidingen.length) {
    r.push("### Omleidingen, als allerlaatste stap");
    r.push("");
    r.push("Zet deze pas nadat de teksten hierboven live staan en de passages zijn overgezet.");
    r.push("");
    r.push("| Van | Naar |");
    r.push("|---|---|");
    for (const p of omleidingen) r.push(`| ${padVan(p.pad)} | ${padVan(p.naar) || padVan(cluster.doel)} |`);
    r.push("");
  }

  return r.join("\n");
}

/** Alles in één keer, voor de stap die het pakket samenstelt. */
export function bouwAlles(cluster: Werkcluster) {
  const termen = bouwTermverdeling(cluster);
  const verdicten = bouwVerdict(cluster);
  const links = bouwLinkplan(cluster);
  return { termen, verdicten, links, pakket: bouwBouwpakket(cluster, termen, verdicten, links) };
}

/** De pagina's van een blok waar de AI-motor op moet draaien: alleen wat blijft. */
export function blijvendePaginas(cluster: Werkcluster): ClusterPagina[] {
  return cluster.paginas.filter((p) => p.handeling !== "samenvoegen" && p.handeling !== "opruimen" && !p.doorgevoerd);
}

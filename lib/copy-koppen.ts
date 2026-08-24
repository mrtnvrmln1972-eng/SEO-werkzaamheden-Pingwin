import { callClaude, LIGHT_MODEL } from "./anthropic";
import type { DocSpec } from "./pingwin-docx";

// ═══════════════════════════════════════════════════════════
// DE KOPPEN VAN EEN COPY-DOCUMENT
// ═══════════════════════════════════════════════════════════
// Twee vangnetten die na het schrijven over de koppen heen gaan: de H1/H2/H3-labels
// die de sitebouwer nodig heeft, en de rem op een plaats- of merknaam die in te veel
// koppen achter elkaar staat. Losgeknipt uit lib/page-doc.ts op 24-08-2026, toen dat
// bestand boven de duizend regels kwam; er is niets aan de werking veranderd.
// ═══════════════════════════════════════════════════════════

// ── Zelfcontrole op kop-herhaling in copy (tegen lokaal/eigennaam keyword stuffing) ──
const HEADING_STOP = new Set("de het een en of van voor met naar bij uit op in aan te je jij jullie uw we wij ons onze wat wie hoe waar waarom welke wanneer kan kunt ook nog al alle als dat dit die deze er is zijn was wordt worden meer per over tot dan om zo goede nieuwe hun ze zij ook ons".split(/\s+/));
function headingCore(text: string): string {
  return text.replace(/^\s*H[1-3]\s*[—:–\-]*\s*/i, "").trim();
}
// Meest herhaalde EIGENNAAM (plaats/merk) over de koppen: een woord dat MIDDEN in een kop
// met een hoofdletter voorkomt (dus geen gewoon onderwerp-woord als "strandtuin", dat alleen
// aan het kopbegin een hoofdletter krijgt). Plus hoe geclusterd het staat (reeks achter elkaar).
function dominantProperToken(headings: string[]): { token: string; count: number; pct: number; run: number } | null {
  if (headings.length < 4) return null;
  const cores = headings.map(headingCore);
  const inHeading = new Map<string, number>();
  const proper = new Set<string>();
  for (const core of cores) {
    const seen = new Set<string>();
    for (const m of core.matchAll(/[A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ-]{2,}/g)) {
      const w = m[0]; const lw = w.toLowerCase();
      if (HEADING_STOP.has(lw)) continue;
      if (!seen.has(lw)) { seen.add(lw); inHeading.set(lw, (inHeading.get(lw) || 0) + 1); }
      if (m.index !== 0 && /^[A-ZÀ-Ý]/.test(w)) proper.add(lw); // hoofdletter, niet aan het kopbegin
    }
  }
  let token = "", count = 0;
  for (const [w, c] of inHeading) if (proper.has(w) && c > count) { token = w; count = c; }
  if (!token) return null;
  let run = 0, mx = 0;
  const re = new RegExp(`(^|[^a-z0-9\\u00e0-\\u00ff-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9\\u00e0-\\u00ff-]|$)`, "i");
  for (const core of cores) { if (re.test(core)) { run++; if (run > mx) mx = run; } else run = 0; }
  return { token, count, pct: count / headings.length, run: mx };
}
async function reviseCopyHeadings(headings: string[], token: string, slug: string): Promise<string[] | null> {
  const system = `Je bent een senior SEO-copywriter. Hieronder de koppen van een landingspagina (met een H1/H2/H3-label vooraan). De naam/plaats "${token}" wordt te vaak in de koppen gebruikt (keyword stuffing), met reeksen achter elkaar en te veel in de FAQ. Herschrijf de koppen zo dat:
- hooguit ~40% van de koppen "${token}" bevat;
- NOOIT meer dan 1 à 2 koppen ACHTER ELKAAR "${token}" bevatten;
- FAQ-vragen vooral over de DIENST gaan (kosten, planten, onderhoud, werkwijze, doorlooptijd, garantie), niet over de plaats; hooguit 1 à 2 FAQ-vragen met "${token}";
- de koppen natuurlijk en gevarieerd blijven, als echte sectietitels.
Behoud de betekenis, de VOLGORDE en het H1/H2/H3-label vooraan elke kop. Verander een kop ALLEEN als dat nodig is om "${token}" te verminderen; laat goede koppen ongemoeid.
Geef UITSLUITEND een JSON-array met exact ${headings.length} strings in dezelfde volgorde terug. Geen tekst eromheen.`;
  const user = headings.map((h, i) => `${i + 1}. ${h}`).join("\n");
  const raw = await callClaude(system, [{ role: "user", content: user }], 1800, { slug, action: "copy_koppen_revisie" });
  try {
    const arr = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (Array.isArray(arr) && arr.length === headings.length && arr.every((x) => typeof x === "string" && x.trim())) return arr as string[];
  } catch { /* ongeldige JSON: origineel laten staan */ }
  return null;
}
// ── Vangnet: H1/H2/H3-labels op de copy-koppen afdwingen ──
// De prompt vraagt vóór elke koptitel een niveau-label (H1/H2/H3) voor de sitebouwer,
// maar het model laat dat soms weg. Ontbreekt het bij de meeste paginakoppen, dan
// kennen we de labels alsnog toe via één kleine herstel-aanroep.
export async function ensureHeadingLabels(spec: DocSpec, slug: string): Promise<void> {
  const blocks: { type: "subheading"; text: string }[] = [];
  for (const sec of spec.sections) for (const b of sec.blocks || []) {
    if (b.type === "subheading" && typeof b.text === "string" && b.text.trim()) blocks.push(b);
  }
  if (blocks.length < 3) return;
  const unlabeled = blocks.filter((b) => !/^\s*H[1-3]\b/i.test(b.text));
  if (unlabeled.length <= 1) return; // (vrijwel) alles heeft al een label
  const system = `Je bent een senior SEO-copywriter. Hieronder alle tussenkoppen van een copy-document voor een landingspagina, in volgorde. Zet vóór elke kop die een PAGINAKOP is de juiste niveau-aanduiding: "H1 — " (precies één keer, de hoofdkop van de pagina), "H2 — " (sectiekoppen) of "H3 — " (subsecties, praktijkvoorbeelden, FAQ-vragen, call-to-action). Regels die GEEN paginakop zijn (zoals "Paginatitel (meta-title)", "Meta-description" of document-tussenkopjes) laat je EXACT ongewijzigd. Koppen die al een H-label hebben laat je ook ongewijzigd. Verander verder NIETS aan de tekst.
Geef UITSLUITEND een JSON-array met exact ${blocks.length} strings in dezelfde volgorde terug. Geen tekst eromheen.`;
  const user = blocks.map((b, i) => `${i + 1}. ${b.text}`).join("\n");
  const raw = await callClaude(system, [{ role: "user", content: user }], 2500, { slug, action: "copy_koplabels" }, LIGHT_MODEL);
  try {
    const arr = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (Array.isArray(arr) && arr.length === blocks.length && arr.every((x) => typeof x === "string" && x.trim())) {
      blocks.forEach((b, i) => { b.text = arr[i]; });
    }
  } catch { /* ongeldige JSON: origineel laten staan */ }
}

// Deterministische controle op de copy-koppen; corrigeert ALLEEN bij over-optimalisatie van
// een eigennaam/plaats (te veel koppen of reeksen achter elkaar). Gewone onderwerp-zoekwoorden
// (bv. "strandtuin" op 70%) blijven ongemoeid.
export async function selfCheckCopyHeadings(spec: DocSpec, slug: string): Promise<void> {
  const blocks: { type: "subheading"; text: string }[] = [];
  for (const sec of spec.sections) for (const b of sec.blocks || []) {
    if (b.type === "subheading" && typeof b.text === "string" && /^\s*H[1-3]\b/i.test(b.text)) blocks.push(b);
  }
  const headings = blocks.map((b) => b.text);
  const rep = dominantProperToken(headings);
  if (!rep || (rep.pct < 0.5 && rep.run < 3)) return; // binnen de norm
  const revised = await reviseCopyHeadings(headings, rep.token, slug).catch(() => null);
  if (revised) blocks.forEach((b, i) => { b.text = revised[i]; });
}

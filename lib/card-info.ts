// Nette weergave van het info-blok op een projectkaart (weekplanning).
// Werkt met terugwerkende kracht op ALLE bestaande kaarten (Pingwin én NOC):
// de platte kaarttekst wordt gesplitst in het unieke verhaal (Doel, Afspraken en
// herkomst) en fase-specifieke sturing die bij de fase-rijen hoort. Zo staat elk
// ding op precies één plek en dubbelt het bovenblok niet met de fase-checklist.
// De opgeslagen data blijft ongemoeid; dit is puur de weergave-laag.

import { linkifyHtml } from "./linkify";

export type CardFaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

export type CardInfo = {
  achtergrond: string[];   // het unieke verhaal: wat is er mis, cijfers, waarom nu
  afspraken: string[];     // mail-datums, wie, referenties
  overig: string[];        // punten die nergens anders passen
  perFase: Partial<Record<CardFaseKey, string[]>>;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inline-opmaak binnen één regel: **vet** renderen, nooit ruwe sterretjes tonen.
function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*/g, "");
}

// Genormaliseerde sleutel voor regel-dedup (zelfde logica als de merge in weekplan.ts).
function lineKey(s: string): string {
  return s.trim().toLowerCase().replace(/^-\s*/, "").replace(/\s+/g, " ");
}

// Een kort regeltje dat op ':' eindigt is een sectiekopje ("Achtergrond:", "Deeltaken:").
function isKopje(s: string): boolean {
  const t = s.trim();
  return /^[A-ZÀ-Ž][^:]{1,40}:$/.test(t);
}

// Herkent fase-specifieke regels (oud én nieuw formaat), hoofdletterongevoelig,
// met of zonder leidend '- '. Geeft de fase plus de sturingstekst terug.
function faseVanRegel(regel: string): { fase: CardFaseKey; tekst: string } | null {
  const kaal = regel.replace(/^-\s*/, "").trim();
  const m = /^([a-zà-ž][a-zà-ž -]{2,24}?)\s*:\s*(.+)$/i.exec(kaal);
  const prefix = (m ? m[1] : kaal.split(/\s+/).slice(0, 2).join(" ")).toLowerCase();
  const rest = m ? m[2].trim() : kaal;
  const map: [RegExp, CardFaseKey][] = [
    [/^analyse\b/, "analyse"],
    [/^blauwdruk\b/, "blauwdruk"],
    [/^copy\b/, "copy"],
    [/^meta[- ]?(title|titel|description|descriptions)?\b/, "copy"],
    [/^strategie\b/, "strategie"],
    [/^(structured data|structured|schema)\b/, "structured"],
    [/^(bouw|bouwen|publiceer|publicatie)\b/, "bouw"],
    [/^dev\b/, "bouw"],
    [/^alt[- ]?tekst/, "bouw"],
    [/^interne links?\b/, "bouw"],
    [/^gelieerde?\b/, "gelieerde"],
  ];
  for (const [re, fase] of map) {
    if (re.test(prefix)) {
      // Bij een expliciete "Fase: ..." prefix tonen we alleen de sturing; bij een
      // zin die toevallig zo begint ("Dev week 2: ...") houden we de hele regel.
      const toon = m && /^(analyse|blauwdruk|copy|strategie|structured data|schema|bouw|gelieerde pagina's|gelieerde)$/i.test(m[1].trim()) ? rest : kaal;
      return { fase, tekst: toon };
    }
  }
  return null;
}

// Splitst de kaarttekst in het unieke verhaal en fase-sturing. Werkt op oude
// platte bullets én op het nieuwe formaat met kopjes (Achtergrond/Afspraken/Aanpak).
export function splitCardInfo(toelichting: string): CardInfo {
  const info: CardInfo = { achtergrond: [], afspraken: [], overig: [], perFase: {} };
  const seen = new Set<string>();
  let sectie: "achtergrond" | "afspraken" | "aanpak" = "achtergrond";
  for (const raw of (toelichting || "").split("\n")) {
    const regel = raw.trim();
    if (!regel) continue;
    const k = lineKey(regel);
    if (seen.has(k)) continue;
    seen.add(k);
    if (isKopje(regel)) {
      const kop = regel.replace(/:$/, "").toLowerCase();
      if (/afspraken|herkomst|bron/.test(kop)) sectie = "afspraken";
      else if (/aanpak|deeltaken|taken|stappen/.test(kop)) sectie = "aanpak";
      else sectie = "achtergrond";
      continue; // het kopje zelf niet dubbel tonen; de render zet eigen kopjes
    }
    const fase = faseVanRegel(regel);
    if (fase) {
      (info.perFase[fase.fase] ||= []).push(fase.tekst);
      continue;
    }
    const kaal = regel.replace(/^-\s*/, "").trim();
    if (sectie === "afspraken") info.afspraken.push(kaal);
    else if (sectie === "aanpak") info.overig.push(kaal);
    else info.achtergrond.push(kaal);
  }
  return info;
}

const heeftFases = (info: CardInfo) => Object.values(info.perFase).some((r) => r && r.length);

// De korte, gerichte sturing die meegaat als een fase vanaf de kaart start:
// de achtergrond plus specifiek de sturing van díe fase (niet de hele lap).
export function faseSturing(info: CardInfo, fase: CardFaseKey, max = 1500): string {
  const delen: string[] = [];
  if (info.achtergrond.length) delen.push(info.achtergrond.join(" "));
  const eigen = info.perFase[fase] || [];
  if (eigen.length) delen.push(`Sturing voor deze stap: ${eigen.join("; ")}`);
  return delen.join("\n\n").slice(0, max);
}

function lijst(regels: string[]): string {
  return `<ul>${regels.map((r) => `<li>${inline(r)}</li>`).join("")}</ul>`;
}

export function cardInfoHtml(toelichting: string, pageUrl?: string): string {
  const domain = (() => { try { return pageUrl ? new URL(pageUrl).host : ""; } catch { return ""; } })();
  const info = splitCardInfo(toelichting);
  const links: string[] = [];
  if (info.achtergrond.length) {
    links.push(`<div class="wp-info-kop">Doel</div>`);
    links.push(info.achtergrond.map((r) => `<p>${inline(r)}</p>`).join(""));
  }
  if (info.overig.length) {
    links.push(`<div class="wp-info-kop">Overige punten</div>`);
    links.push(lijst(info.overig));
  }
  const rechts: string[] = [];
  if (info.afspraken.length) {
    rechts.push(`<div class="wp-info-kop">Afspraken en herkomst</div>`);
    rechts.push(lijst(info.afspraken));
  }
  const kolommen = rechts.length
    ? `<div class="wp-info-doel"><div>${links.join("")}</div><div>${rechts.join("")}</div></div>`
    : links.join("");
  const verwijzing = heeftFases(info) ? `<div class="wp-info-verwijzing">De aanpak staat hieronder in de fases.</div>` : "";
  return linkifyHtml(kolommen + verwijzing, domain);
}

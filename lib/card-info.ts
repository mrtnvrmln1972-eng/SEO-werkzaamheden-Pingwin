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
// Mail-verwijzingen ("Mail 9-7-2026", "mail van 25 juli") worden klikbaar: de
// kaart opent die mail dan in het venster Laatste mails (delegate in de kaart).
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*/g, "")
    .replace(/\b([Mm]ail(?:tje)?(?:\s+van)?\s+)(\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+\d{2,4})?)/g,
      '$1<span class="wp-maildatum" data-datum="$2" role="button" title="Open deze mail in Laatste mails">$2</span>');
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
  // Inhoud-herkenning voor opdracht-zinnen zonder nette prefix ("Controleer en
  // finaliseer de copy…"). Werkwoord-vangrail: alleen regels die als instructie
  // beginnen; kenniszinnen ("De blauwdruk ligt al klaar…") blijven in Doel.
  const isInstructie = /^(controleer|finaliseer|schrijf|maak|voeg|verwerk|corrigeer|optimaliseer|herstel|verkort|plaats|bouw|publiceer|pas\b|zet\b|update|implementeer)/i.test(kaal);
  if (isInstructie) {
    const laag = kaal.toLowerCase();
    if (/structured data|schema(\.org)?\b/.test(laag)) return { fase: "structured", tekst: kaal };
    if (/alt[- ]?tekst|interne links?|publiceer|\bbouw\b|live zetten/.test(laag)) return { fase: "bouw", tekst: kaal };
    if (/\bcopy\b|webtekst|paginatekst|meta[- ]?(titel|title|description)|prijstabel/.test(laag)) return { fase: "copy", tekst: kaal };
    if (/blauwdruk/.test(laag)) return { fase: "blauwdruk", tekst: kaal };
    if (/analyse/.test(laag)) return { fase: "analyse", tekst: kaal };
    if (/strategie/.test(laag)) return { fase: "strategie", tekst: kaal };
  }
  return null;
}

// Communicatie- en referentieregels zijn geen taken: die horen als geheugensteun
// onder Afspraken en herkomst (mail naar de klant gaat via de kaart-knoppen).
function isCommunicatie(regel: string): boolean {
  const kaal = regel.replace(/^-\s*/, "").trim().toLowerCase();
  return /(stuur|verstuur|mail)\b.*?(bevestiging|mail|richting|naar)|bevestigingsmail|bekijk (de )?(website|site)\b.*(richtlijn|referentie)/.test(kaal);
}

// Splitst de kaarttekst in het unieke verhaal en fase-sturing. Werkt op oude
// platte bullets én op het nieuwe formaat met kopjes (Achtergrond/Afspraken/Aanpak).
// Generieke nul-informatie-regels die alleen ruimte kosten (retroactief wegfilteren).
const RUIS: RegExp[] = [
  /^dev bouwt en publiceert de pagina/i,
  /^de aanpak staat hieronder/i,
];

export function splitCardInfo(toelichting: string): CardInfo {
  const info: CardInfo = { achtergrond: [], afspraken: [], overig: [], perFase: {} };
  const seen = new Set<string>();
  let sectie: "achtergrond" | "afspraken" | "aanpak" = "achtergrond";
  for (const raw of (toelichting || "").split("\n")) {
    const regel = raw.trim();
    if (!regel) continue;
    if (RUIS.some((re) => re.test(regel.replace(/^-\s*/, "")))) continue;
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
    if (isCommunicatie(regel)) {
      info.afspraken.push(regel.replace(/^-\s*/, "").trim());
      continue;
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


// De korte, gerichte sturing die meegaat als een fase vanaf de kaart start:
// de achtergrond plus specifiek de sturing van díe fase (niet de hele lap).
export function faseSturing(info: CardInfo, fase: CardFaseKey, max = 1500): string {
  const delen: string[] = [];
  if (info.achtergrond.length) delen.push(info.achtergrond.join(" "));
  const eigen = info.perFase[fase] || [];
  if (eigen.length) delen.push(`Sturing voor deze stap: ${eigen.join("; ")}`);
  return delen.join("\n\n").slice(0, max);
}

// Inline SVG-iconen (huisstijl-oranje via currentColor), stijl van het voorbeeld.
const SVG = (paden: string, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paden.split("|").map((d) => `<path d="${d}"></path>`).join("")}</svg>`;
const ICO_VLAG = SVG("M4 21V4|M4 4h12l-2 4 2 4H4");
const ICO_KLEMBORD = SVG("M9 4h6v3H9z|M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2|M9 12h6|M9 16h4");

function lijst(regels: string[], cls: string): string {
  // Elk punt (Doel én Aanpak) krijgt een klein »-knopje: zet dit punt op een
  // bespreeklijst (Sander, klant, ...). De kaart-component vangt de klik af.
  const knop = '<button type="button" class="wp-info-lijstbtn" title="Zet dit punt op een bespreeklijst">&raquo;</button>';
  return `<ul class="${cls}">${regels.map((r) => `<li>${knop}${inline(r)}</li>`).join("")}</ul>`;
}

function infoKaart(icoon: string, kop: string, inhoud: string): string {
  return `<div class="wp-info-kaart"><div class="wp-info-kaarthead"><span class="wp-info-icoon">${icoon}</span><span class="wp-info-kop">${kop}</span></div>${inhoud}</div>`;
}

export function cardInfoHtml(toelichting: string, pageUrl?: string): string {
  const domain = (() => { try { return pageUrl ? new URL(pageUrl).host : ""; } catch { return ""; } })();
  const info = splitCardInfo(toelichting);
  const kaarten: string[] = [];
  if (info.achtergrond.length) {
    kaarten.push(infoKaart(ICO_VLAG, "Doel", lijst(info.achtergrond, "wp-check-lijst")));
  }
  const aanpak = [...info.overig, ...info.afspraken];
  if (aanpak.length) {
    kaarten.push(infoKaart(ICO_KLEMBORD, "Aanpak en taken", lijst(aanpak, "wp-punt-lijst")));
  }
  const kolommen = kaarten.length ? `<div class="wp-info-doel${kaarten.length === 1 ? " wp-info-een" : ""}">${kaarten.join("")}</div>` : "";
  // Geen emoji's in het dashboard: status-emoji's uit oudere kaartteksten worden
  // retroactief nette stipjes (zelfde betekenis, rustiger beeld).
  const zonderEmoji = linkifyHtml(kolommen, domain)
    .replace(/✅|✔️|✔/g, '<span class="st-dot st-ok" title="In orde"></span>')
    .replace(/❌|✖️|✖|⛔/g, '<span class="st-dot st-fout" title="Probleem"></span>')
    .replace(/⚠️|⚠/g, '<span class="st-dot st-warn" title="Let op"></span>');
  return zonderEmoji;
}

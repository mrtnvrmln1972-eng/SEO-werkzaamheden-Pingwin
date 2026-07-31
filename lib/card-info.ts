// Nette weergave van het info-blok op een projectkaart (weekplanning).
// Werkt met terugwerkende kracht op ALLE bestaande kaarten: platte tekst met
// bullets wordt gestructureerde HTML met oranje sectiekopjes, nette lijsten,
// gededupliceerde regels en klikbare slugs/URL's. De opgeslagen data blijft
// ongemoeid; dit is puur de weergave-laag (harde opmaakregel, CLAUDE.md par. 0).

import { linkifyHtml } from "./linkify";

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

export function cardInfoHtml(toelichting: string, pageUrl?: string): string {
  const domain = (() => { try { return pageUrl ? new URL(pageUrl).host : ""; } catch { return ""; } })();
  const regels = (toelichting || "").split("\n");
  const seen = new Set<string>();
  const out: string[] = [];
  let lijst: string[] = [];
  const flushLijst = () => {
    if (lijst.length) { out.push(`<ul>${lijst.map((li) => `<li>${li}</li>`).join("")}</ul>`); lijst = []; }
  };
  for (const raw of regels) {
    const regel = raw.trim();
    if (!regel) { flushLijst(); continue; }
    const k = lineKey(regel);
    if (seen.has(k)) continue; // dubbele regels (uit eerdere merges) niet nog eens tonen
    seen.add(k);
    if (isKopje(regel)) {
      flushLijst();
      out.push(`<div class="wp-info-kop">${inline(regel.replace(/:$/, ""))}</div>`);
    } else if (/^-\s+/.test(regel)) {
      lijst.push(inline(regel.replace(/^-\s+/, "")));
    } else {
      flushLijst();
      out.push(`<p>${inline(regel)}</p>`);
    }
  }
  flushLijst();
  return linkifyHtml(out.join(""), domain);
}

// Nette weergave van het info-blok op een projectkaart (weekplanning).
// Werkt met terugwerkende kracht op ALLE bestaande kaarten (Pingwin én NOC):
// de platte kaarttekst wordt gesplitst in het unieke verhaal (Doel, Afspraken en
// herkomst) en fase-specifieke sturing die bij de fase-rijen hoort. Zo staat elk
// ding op precies één plek en dubbelt het bovenblok niet met de fase-checklist.
// De opgeslagen data blijft ongemoeid; dit is puur de weergave-laag.

import { linkifyHtml } from "./linkify";
import { puntSoort } from "./punt-soort";

export type CardFaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

export type CardInfo = {
  achtergrond: string[];   // het unieke verhaal: wat is er mis, cijfers, waarom nu
  afspraken: string[];     // mail-datums, wie, referenties
  overig: string[];        // punten die nergens anders passen
  perFase: Partial<Record<CardFaseKey, string[]>>;
  // Wat er niet in de begrensde kaart past. Gaat NIET verloren: het staat ingeklapt
  // onderaan onder "Eerdere notities", voor als je het voor een blauwdruk nodig hebt.
  rest: string[];
};

// Hoeveel regels een kaart in één blik mag tonen. Een kaart hoort te bevatten wat je
// nodig hebt om díe klus te doen, niet alles wat we ooit over de pagina wisten. Bij
// Paul Hoevenaars stonden er twaalf regels onder Doel voor een pagina waar drie
// dingen over te zeggen zijn.
const MAX_WAAROM = 4;
const MAX_AFSPRAKEN = 4;

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

// ── Ontdubbelen op betekenis, niet op letters ──
// Het samenvoegen van kaarten plakte nieuwe regels erbij en herkende alleen
// LETTERLIJK gelijke regels als dubbel. Daardoor stond er drie keer hetzelfde in
// andere woorden: "De pagina heeft 77 vertoningen en 0 klikken: zichtbaar maar
// trekt geen verkeer aan" naast "De pagina staat op 77 vertoningen en 0 klikken,
// dus er is zichtbaarheid maar geen conversie".
//
// Hier vergelijken we op de inhoudswoorden van een regel. Delen twee regels het
// merendeel van hun woorden, dan is het hetzelfde punt en houden we de langste
// (die bevat meestal de meeste informatie). Dit zit in de WEERGAVE-laag, dus het
// geldt meteen voor alle kaarten die er al staan.
const STOPWOORDEN = new Set([
  "de", "het", "een", "en", "of", "maar", "dus", "want", "die", "dat", "er", "is", "zijn", "was", "wordt",
  "worden", "heeft", "hebben", "met", "voor", "van", "op", "in", "aan", "bij", "naar", "te", "als", "ook",
  "nog", "geen", "niet", "wel", "al", "om", "per", "deze", "dit", "we", "ze", "je", "meer", "veel", "tot",
]);
function inhoudswoorden(s: string): Set<string> {
  return new Set(
    lineKey(s)
      .replace(/[^a-z0-9à-ÿ/.\- ]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWOORDEN.has(w)),
  );
}
function zelfdePunt(a: Set<string>, b: Set<string>, drempel = 0.7): boolean {
  if (!a.size || !b.size) return false;
  let gedeeld = 0;
  for (const w of a) if (b.has(w)) gedeeld++;
  if (drempel !== 0.7) return gedeeld / Math.min(a.size, b.size) >= drempel;
  // Ten opzichte van de KORTSTE regel: een korte samenvatting van een lange regel
  // is ook een dubbeling, en die zou bij delen door de langste onder de drempel vallen.
  return gedeeld / Math.min(a.size, b.size) >= 0.7;
}

/** Houdt per punt één regel over: de langste van een groep die hetzelfde zegt. */
export function ontdubbel(regels: string[]): string[] {
  const uit: { tekst: string; woorden: Set<string> }[] = [];
  for (const r of regels) {
    const w = inhoudswoorden(r);
    const bestaand = uit.find((x) => zelfdePunt(x.woorden, w));
    if (!bestaand) { uit.push({ tekst: r, woorden: w }); continue; }
    // De langere formulering wint: die bevat doorgaans het cijfer of de nuance.
    if (r.length > bestaand.tekst.length) { bestaand.tekst = r; bestaand.woorden = w; }
  }
  return uit.map((x) => x.tekst);
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

export function splitCardInfo(toelichting: string, taak?: string): CardInfo {
  const info: CardInfo = { achtergrond: [], afspraken: [], overig: [], perFase: {}, rest: [] };
  const seen = new Set<string>();
  // De titel van de kaart hoort niet als bullet IN de kaart. Bij het samenvoegen
  // werd de titel van het nieuwe punt er telkens bij geplakt, dus stond hij er
  // soms twee keer in, licht anders geformuleerd.
  const titelWoorden = taak ? inhoudswoorden(taak) : null;
  let sectie: "achtergrond" | "afspraken" | "aanpak" = "achtergrond";
  for (const raw of (toelichting || "").split("\n")) {
    const regel = raw.trim();
    if (!regel) continue;
    if (RUIS.some((re) => re.test(regel.replace(/^-\s*/, "")))) continue;
    const k = lineKey(regel);
    if (seen.has(k)) continue;
    seen.add(k);
    // Herhaalt deze regel de kaarttitel? Bij het samenvoegen werd de titel van het
    // nieuwe punt telkens als bullet aangeplakt, dus stond hij er soms twee keer in,
    // net anders geformuleerd ("Ontwikkel /diensten/tuinontwerp/ (uitbreiding met
    // beplantingsplan)" naast de titel "Breid /diensten/tuinontwerp/ uit en verwerk
    // beplantingsplan"). Ruimere drempel dan elders, want een misser hier kost niets:
    // de regel verdwijnt niet maar zakt naar Eerdere notities.
    if (titelWoorden && zelfdePunt(titelWoorden, inhoudswoorden(regel), 0.55)) {
      info.rest.push(regel.replace(/^-\s*/, "").trim());
      continue;
    }
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
  // Aangeplakte regels erven de sectie van het blok ervóór, want bij het
  // samenvoegen komen ze zonder eigen kopje binnen. Daardoor belandden
  // constateringen onder "Aanpak en taken" en kregen ze een knopje om door te
  // zetten. Een constatering hoort bij Doel, wat er ook boven stond.
  const echtWerk: string[] = [];
  for (const r of info.overig) {
    if (puntSoort(r) === "feit") info.achtergrond.push(r);
    else echtWerk.push(r);
  }
  info.overig = echtWerk;

  info.achtergrond = ontdubbel(info.achtergrond);
  info.afspraken = ontdubbel(info.afspraken);
  info.overig = ontdubbel(info.overig);
  for (const f of Object.keys(info.perFase) as CardFaseKey[]) {
    info.perFase[f] = ontdubbel(info.perFase[f] || []);
  }

  // Begrenzen: wat er boven de limiet uitkomt verhuist naar "Eerdere notities".
  // Weggooien doen we nooit; het staat straks ingeklapt onderaan de kaart.
  if (info.achtergrond.length > MAX_WAAROM) {
    info.rest.push(...info.achtergrond.slice(MAX_WAAROM));
    info.achtergrond = info.achtergrond.slice(0, MAX_WAAROM);
  }
  if (info.afspraken.length > MAX_AFSPRAKEN) {
    info.rest.push(...info.afspraken.slice(MAX_AFSPRAKEN));
    info.afspraken = info.afspraken.slice(0, MAX_AFSPRAKEN);
  }
  // Per fase één regel; de rest is bijna altijd een andere formulering van dezelfde
  // instructie en hoort niet naast de stap te staan waar je mee bezig bent.
  for (const f of Object.keys(info.perFase) as CardFaseKey[]) {
    const v = info.perFase[f] || [];
    if (v.length > 1) { info.rest.push(...v.slice(1)); info.perFase[f] = v.slice(0, 1); }
  }
  info.rest = ontdubbel(info.rest);
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

export function cardInfoHtml(toelichting: string, pageUrl?: string, taak?: string, cijfers?: string): string {
  const domain = (() => { try { return pageUrl ? new URL(pageUrl).host : ""; } catch { return ""; } })();
  const info = splitCardInfo(toelichting, taak);
  const kaarten: string[] = [];
  if (info.achtergrond.length) {
    kaarten.push(infoKaart(ICO_VLAG, "Waarom deze pagina", lijst(info.achtergrond, "wp-check-lijst")));
  }
  const aanpak = ontdubbel([...info.overig, ...info.afspraken]);
  if (aanpak.length) {
    kaarten.push(infoKaart(ICO_KLEMBORD, "Aanpak en afspraken", lijst(aanpak, "wp-punt-lijst")));
  }
  const kolommen = kaarten.length ? `<div class="wp-info-doel${kaarten.length === 1 ? " wp-info-een" : ""}">${kaarten.join("")}</div>` : "";

  // De cijfers komen uit de METING, nooit uit geschreven tekst. Zolang een getal in
  // een zin stond, konden er twee metingen naast elkaar blijven staan (positie 27.9
  // met 869 vertoningen én positie 30.1 met 615). Eén vaste plek maakt dat onmogelijk.
  const cijferRegel = cijfers ? `<div class="wp-info-cijfers">${escapeHtml(cijfers)}</div>` : "";

  // Wat niet in de begrensde kaart past staat hier, ingeklapt. Niets raakt kwijt;
  // het staat alleen niet meer in de weg. <details> heeft geen JavaScript nodig.
  const notities = info.rest.length
    ? `<details class="wp-info-rest"><summary>Eerdere notities (${info.rest.length})</summary>${lijst(info.rest, "wp-punt-lijst")}</details>`
    : "";
  // Geen emoji's in het dashboard: status-emoji's uit oudere kaartteksten worden
  // retroactief nette stipjes (zelfde betekenis, rustiger beeld).
  const zonderEmoji = linkifyHtml(cijferRegel + kolommen + notities, domain)
    .replace(/✅|✔️|✔/g, '<span class="st-dot st-ok" title="In orde"></span>')
    .replace(/❌|✖️|✖|⛔/g, '<span class="st-dot st-fout" title="Probleem"></span>')
    .replace(/⚠️|⚠/g, '<span class="st-dot st-warn" title="Let op"></span>');
  return zonderEmoji;
}

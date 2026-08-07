"use client";

// Gedeelde weergave van een assistent-antwoord als sectie-kaartjes (per "## "-kop).
// De Bird's eye is de BRIEVENBUS, maar NIET elk punt is een taak: lib/punt-soort.ts
// bepaalt per regel of het werk, een constatering of een vraag aan iemand is, en
// alleen de knopjes die daarbij horen blijven staan. Eerder kreeg elke <li> alle
// vier de knopjes, waardoor een statusregel ("wat er live is en hoe het presteert")
// een plusje kreeg; dat maakte de lijst onbruikbaar. De soort wordt in de
// weergave-laag bepaald, dus het geldt ook voor alle antwoorden die er al staan.
// Vier knopjes (+ = kaart in de weekplanning, » = bespreeklijst, × = negeren,
// ✓ = gedaan). Doorzetten is verplaatsen: zodra een punt een bestemming heeft,
// klapt het in; onderaan de sectie blijft één samenvattingsregeltje ("N
// afgehandeld: ...") dat je kunt openklappen om keuzes terug te draaien.
// De keuzes staan centraal in de database (zelfde stand op elk apparaat; een
// herhaald punt in een later antwoord staat automatisch al ingeklapt).

import { useEffect, useMemo, useRef, useState } from "react";
import { puntSoort, knopjesVoor, isGroepskop, stripMarker, type PuntSoort } from "../../../../lib/punt-soort";
import { devLabel } from "../../../../lib/personen";
import { heeftInhoud } from "../../../../lib/vulzinnen";
import { splitsAntwoord, type Sectie } from "../../../../lib/antwoord-secties";
import { analyseNaarMailHtml } from "../../../../lib/mail-opmaak";
import PaginaDossier from "./PaginaDossier";

type Feedback = { key: string; msg: string; ok: boolean };
type PuntStaat = "taak" | "weg" | "klaar" | "lijst";
type Teller = { taak: number; lijst: number; weg: number; klaar: number };

// Titel-terugval voor "Kopieer als taak" op een sectie zonder eigen kop: de
// eerste inhoudelijke regel, ontdaan van markdown-tekens.
function eersteZinVan(md: string): string {
  for (const raw of (md || "").split("\n")) {
    const regel = raw.replace(/^[-*]\s+/, "").replace(/^#{1,6}\s+/, "").replace(/[*_`]/g, "").trim();
    if (regel) return regel;
  }
  return "";
}

// Klein en stabiel: hash om een punt te herkennen over herlaadbeurten heen.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 220);

// Status-emoji's (uit oudere antwoorden) → nette gekleurde stipjes.
function vervangEmoji(html: string): string {
  return html
    .replace(/✅|✔️|✔/g, '<span class="st-dot st-ok" title="In orde"></span>')
    .replace(/❌|✖️|✖|⛔/g, '<span class="st-dot st-fout" title="Probleem"></span>')
    .replace(/⚠️|⚠/g, '<span class="st-dot st-warn" title="Let op"></span>');
}

export default function AntwoordBlokken({ slug, thread, content, mdToHtml, siteUrl, onWeekplanChanged }: {
  slug: string;
  thread: string;
  content: string;
  mdToHtml: (md: string) => string;
  /** Host van de klantsite, zodat een slug als /prijs-en-kosten/ ook in de mail
      naar de echte pagina linkt (harde huisregel: nooit een dode slug tonen). */
  siteUrl?: string;
  onWeekplanChanged?: () => void;
}) {
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [marks, setMarks] = useState<Record<string, PuntStaat>>({});
  const [toon, setToon] = useState<Record<string, boolean>>({}); // afgehandelde punten tonen per sectie
  const [tellers, setTellers] = useState<Record<string, Teller>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  // Deze analyse doorsturen met behoud van opmaak.
  const [stuurOpen, setStuurOpen] = useState(false);
  const [stuurAan, setStuurAan] = useState("");
  const [stuurOnderwerp, setStuurOnderwerp] = useState("");
  const [stuurIntro, setStuurIntro] = useState("");
  const [stuurBezig, setStuurBezig] = useState(false);
  const [stuurMsg, setStuurMsg] = useState<{ ok: boolean; tekst: string } | null>(null);

  // Het onderwerp voorinvullen met de eerste kop uit het antwoord, zodat je meestal
  // alleen nog de ontvanger hoeft te typen.
  useEffect(() => {
    if (stuurOnderwerp) return;
    const kop = /^#{1,3}\s+(.+)$/m.exec(content || "");
    if (kop) setStuurOnderwerp(kop[1].replace(/[*_`]/g, "").trim().slice(0, 120));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  async function stuurAnalyse() {
    if (stuurBezig || !stuurAan.trim()) return;
    setStuurBezig(true); setStuurMsg(null);
    try {
      // Bewust de RUWE markdown, niet mdToHtml(): de mail knipt zelf per sectie, want
      // de "## "-koppen moeten uit de tekst vóór ze een oranje titel boven een kaart
      // kunnen worden. Gaf je de voorgerenderde HTML mee, dan bleven het grijze
      // regeltjes en bestonden de kaarten niet.
      const html = analyseNaarMailHtml(content || "", {
        siteUrl,
        titel: stuurOnderwerp.trim() || "Analyse",
        intro: stuurIntro.trim() || undefined,
        bron: "Opgesteld in het Pingwin SEO-dashboard.",
      });
      const d = await fetch("/api/admin/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "compose", slug, to: stuurAan.trim(), subject: stuurOnderwerp.trim() || "Analyse", html }),
      }).then((r) => r.json());
      if (d?.ok) {
        setStuurMsg({ ok: true, tekst: `Verstuurd aan ${(d.sentTo || []).join(", ") || stuurAan.trim()}.` });
        setStuurOpen(false);
      } else setStuurMsg({ ok: false, tekst: d?.error || "Versturen lukte niet." });
    } catch { setStuurMsg({ ok: false, tekst: "Versturen lukte niet." }); }
    finally { setStuurBezig(false); }
  }

  // Over welke pagina's gáát dit antwoord? Van die pagina's tonen we onderaan het
  // dossierblok: dezelfde alinea en dezelfde linkjes als op de kaart in de
  // weekplanning. Bewust hooguit twee en in compacte vorm, anders wordt een
  // antwoord alsnog een muur. Bestaat een genoemd pad niet bij deze klant, dan
  // komt er niets terug (de server controleert dat).
  const genoemdePaden = useMemo(() => {
    const uit: string[] = [];
    const zien = new Set<string>();
    for (const m of (content || "").matchAll(/(?<![\w:])\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)*\//gi)) {
      const p = m[0].toLowerCase();
      if (zien.has(p)) continue;
      zien.add(p);
      uit.push(p);
      if (uit.length >= 2) break;
    }
    return uit;
  }, [content]);

  // Centrale markeringen laden; oude browser-opslag eenmalig meenemen.
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await fetch(`/api/admin/answer-marks?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(thread)}`).then((r) => r.json()).catch(() => null);
      if (!alive) return;
      const server: Record<string, PuntStaat> = (d?.ok && d.marks) || {};
      // Migratie van de oude localStorage-vorm (één keer, daarna leidt de database).
      try {
        const oud1 = JSON.parse(window.localStorage.getItem(`pingwin-wp-punten2:${slug}`) || "{}") as Record<string, PuntStaat>;
        const oud2 = JSON.parse(window.localStorage.getItem(`pingwin-wp-punten:${slug}`) || "[]") as string[];
        const bulk: Record<string, PuntStaat> = {};
        for (const [k, v] of Object.entries(oud1)) if (!server[k]) bulk[k] = v;
        for (const k of oud2) if (!server[k] && !bulk[k]) bulk[k] = "taak";
        if (Object.keys(bulk).length) {
          await fetch("/api/admin/answer-marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, bulk }) }).catch(() => {});
          Object.assign(server, bulk);
        }
        window.localStorage.removeItem(`pingwin-wp-punten2:${slug}`);
        window.localStorage.removeItem(`pingwin-wp-punten:${slug}`);
      } catch { /* migratie is best effort */ }
      setMarks(server);
    })();
    return () => { alive = false; };
  }, [slug, thread]);

  const zetStaat = (key: string, staat: PuntStaat | null) => {
    setMarks((m) => { const n = { ...m }; if (staat) n[key] = staat; else delete n[key]; return n; });
    void fetch("/api/admin/answer-marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, hash: key, staat }) }).catch(() => {});
  };
  const zetStaatBulk = (keys: string[], staat: PuntStaat) => {
    if (!keys.length) return;
    setMarks((m) => { const n = { ...m }; for (const k of keys) n[k] = staat; return n; });
    const bulk = Object.fromEntries(keys.map((k) => [k, staat]));
    void fetch("/api/admin/answer-marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, bulk }) }).catch(() => {});
  };

  // De knip per "## "-kop staat in lib/antwoord-secties.ts, want de mail moet exact
  // dezelfde indeling gebruiken. Stond die logica alleen hier, dan kregen scherm en
  // mail na de eerste wijziging een andere indeling.
  const secties: Sectie[] = splitsAntwoord(content || "");
  const heeftKoppen = secties.some((s) => s.kop);

  // Punt-tekst van het element (zonder de knopjes).
  function puntTekst(el: Element): string {
    const kloon = el.cloneNode(true) as HTMLElement;
    kloon.querySelectorAll(".ovc-acties").forEach((b) => b.remove());
    return (kloon.textContent || "").replace(/\s+/g, " ").trim();
  }
  // De sleutel gaat over de KALE tekst (zonder "Doen:"-markering), zodat hij
  // hetzelfde blijft nadat de markering uit beeld is gehaald. Oude antwoorden
  // hebben geen markering, dus hun bestaande sleutels blijven precies gelijk.
  const puntKey = (tekst: string) => hash(`${thread}|${norm(stripMarker(tekst))}`);

  // Bepaalt de soort één keer per regel en onthoudt hem op het element, zodat de
  // uitkomst niet verandert nadat de markering uit beeld is gehaald.
  function soortVan(doel: Element, ruw: string): PuntSoort {
    const bewaard = (doel as HTMLElement).dataset.soort as PuntSoort | undefined;
    if (bewaard) return bewaard;
    const s = puntSoort(ruw);
    (doel as HTMLElement).dataset.soort = s;
    return s;
  }

  // Haalt een "Doen: "-achtige markering uit het eerste tekstknooppunt weg; die is
  // voor de indeling bedoeld en hoort nooit in beeld te komen.
  function verbergMarkering(doel: Element): void {
    const loop = document.createTreeWalker(doel, NodeFilter.SHOW_TEXT);
    let n = loop.nextNode();
    while (n && !(n.nodeValue || "").trim()) n = loop.nextNode();
    if (!n) return;
    const kaal = stripMarker(n.nodeValue || "");
    if (kaal !== (n.nodeValue || "").trim()) n.nodeValue = kaal;
  }
  // Sectie-herkenning: ook een hele sectie (bijv. een tabel-sectie) kan als
  // "verwerkt in de weekplanning" gemarkeerd worden en klapt dan in.
  const sectieSleutel = (s: Sectie) => hash(`${thread}|sectie|${norm(`${s.kop}|${s.md.slice(0, 200)}`)}`);

  // Alle WERK-sleutels binnen een sectie-blok. Groepskopjes en constateringen
  // tellen niet mee: die worden geen kaart, dus ze horen ook niet als "verwerkt"
  // gemarkeerd te worden als je de hele sectie doorzet.
  function sleutelsVan(blok: Element): string[] {
    const uit: string[] = [];
    blok.querySelectorAll(".ovc-acties").forEach((acties) => {
      const doel = acties.closest("li, p");
      if (!doel) return;
      const t = puntTekst(doel);
      if (!t || isGroepskop(t)) return;
      if (soortVan(doel, t) !== "werk") return;
      uit.push(puntKey(t));
    });
    return uit;
  }

  // Na elke render: staat per punt toepassen (knopjes, doorstrepen, inklappen)
  // en de samenvattingstellers per sectie bijwerken.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nieuweTellers: Record<string, Teller> = {};
    root.querySelectorAll(".ovc-blok").forEach((blok) => {
      const sKey = (blok as HTMLElement).dataset.skey || "";
      const teller: Teller = { taak: 0, lijst: 0, weg: 0, klaar: 0 };
      blok.querySelectorAll(".ovc-acties").forEach((acties) => {
        const doel = acties.closest("li, p");
        if (!doel) return;
        const t = puntTekst(doel);
        // Groepskopjes ("Lokale hovenierspagina's ...:") zijn geen taken.
        if (isGroepskop(t)) { doel.classList.add("ovc-groepkop"); acties.remove(); return; }
        // Alleen de knopjes die bij de soort horen; de rest verdwijnt. Een
        // constatering houdt dus alleen de bespreeklijst over, geen plusje.
        const soort = soortVan(doel, t);
        verbergMarkering(doel);
        const mag = knopjesVoor(soort);
        if (!mag.plus) acties.querySelector(".ovc-act-plus")?.remove();
        if (!mag.lijst) acties.querySelector(".ovc-act-lijst")?.remove();
        if (!mag.weg) acties.querySelector(".ovc-act-x")?.remove();
        if (!mag.vink) acties.querySelector(".ovc-act-v")?.remove();
        doel.classList.toggle("ovc-punt-feit", soort === "feit");
        const staat = marks[puntKey(t)] || "";
        if (staat) teller[staat as PuntStaat]++;
        doel.classList.toggle("ovc-gedaan", staat === "klaar");
        doel.classList.toggle("ovc-weg", staat === "weg");
        doel.classList.toggle("ovc-afgehandeld", !!staat);
        // Afgehandeld = ingeklapt, tenzij Maarten de sectie heeft opengeklapt.
        doel.classList.toggle("ovc-dicht", !!staat && !toon[sKey]);
        acties.querySelector(".ovc-act-plus")?.classList.toggle("ovc-act-aan", staat === "taak");
        acties.querySelector(".ovc-act-x")?.classList.toggle("ovc-act-aan", staat === "weg");
        acties.querySelector(".ovc-act-v")?.classList.toggle("ovc-act-aan", staat === "klaar");
        acties.querySelector(".ovc-act-lijst")?.classList.toggle("ovc-act-aan", staat === "lijst");
      });
      if (sKey) nieuweTellers[sKey] = teller;
    });
    setTellers((oud) => (JSON.stringify(oud) === JSON.stringify(nieuweTellers) ? oud : nieuweTellers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, marks, toon, slug, thread]);

  // Een knop buiten dit component die een heel antwoord doorzet, meldt
  // zich via een window-event: heel het antwoord is dan verwerkt → alles inklappen.
  useEffect(() => {
    const handler = (e: Event) => {
      const det = (e as CustomEvent).detail as { thread?: string } | undefined;
      if (det?.thread && det.thread !== thread) return;
      const root = rootRef.current;
      if (!root) return;
      const alle: string[] = [];
      root.querySelectorAll(".ovc-blok").forEach((blok) => alle.push(...sleutelsVan(blok)));
      for (const s of secties) alle.push(sectieSleutel(s));
      zetStaatBulk(alle.filter((k) => !marks[k]), "taak");
    };
    window.addEventListener("pingwin-antwoord-verwerkt", handler);
    return () => window.removeEventListener("pingwin-antwoord-verwerkt", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, marks]);

  async function maakTaak(key: string, tekst: string, puntSleutel?: string, sectieKeys?: string[]) {
    if (busyKey) return;
    setBusyKey(key); setFeedback(null);
    // Nooit stil blijven hangen op "Bezig…": na 90 seconden een nette melding.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const r = await fetch("/api/admin/weekplan/from-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, answer: tekst, enkel: true }), signal: ctrl.signal });
      const d = await r.json();
      if (d?.ok && (d.added || d.merged)) {
        const delen: string[] = [];
        if (d.added) delen.push(`${d.added} ${d.added === 1 ? "kaart toegevoegd" : "kaarten toegevoegd"}`);
        if (d.merged) delen.push(`${d.merged} bestaande ${d.merged === 1 ? "paginakaart" : "paginakaarten"} aangevuld`);
        setFeedback({ key, msg: `${delen.join(" en ")}`, ok: true });
        if (puntSleutel) zetStaat(puntSleutel, "taak");
        if (sectieKeys?.length) zetStaatBulk(sectieKeys.filter((k) => !marks[k]), "taak");
        onWeekplanChanged?.();
      } else setFeedback({ key, msg: d?.error || "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } catch (e) {
      const teLang = (e as Error)?.name === "AbortError";
      setFeedback({ key, msg: teLang ? "Dit duurde te lang. Mogelijk zijn de kaarten tóch gemaakt; kijk in de weekplanning en probeer het anders nog een keer." : "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } finally { clearTimeout(timer); setBusyKey(""); }
  }

  // Voor kant-en-klare inhoud (een contentagenda, een uitgewerkt voorstel): geen
  // AI, geen context, geen splitsing. Precies deze sectie wordt letterlijk één
  // taak, zodat hij meteen als kaart klaarstaat om naar de klant te sturen.
  async function kopieerAlsTaak(key: string, s: Sectie, sectieKeys?: string[]) {
    if (busyKey) return;
    setBusyKey(key); setFeedback(null);
    try {
      const titel = (s.kop || eersteZinVan(s.md) || "Kopie uit het gesprek").slice(0, 200);
      const r = await fetch("/api/admin/weekplan/quick-task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, thread, taak: titel, toelichting: s.md }),
      });
      const d = await r.json();
      if (d?.ok) {
        setFeedback({ key, msg: "Kaart toegevoegd, ongewijzigd overgenomen.", ok: true });
        if (sectieKeys?.length) zetStaatBulk(sectieKeys.filter((k) => !marks[k]), "taak");
        onWeekplanChanged?.();
      } else setFeedback({ key, msg: d?.error || "Kopiëren mislukte. Probeer het nog een keer.", ok: false });
    } catch { setFeedback({ key, msg: "Kopiëren mislukte. Probeer het nog een keer.", ok: false }); }
    finally { setBusyKey(""); }
  }

  // "Op bespreeklijst": kies de persoon in een menuutje naast de aangeklikte regel.
  const [lijstVoor, setLijstVoor] = useState<{ key: string; tekst: string; sleutel: string; x: number; y: number } | null>(null);
  const [personen, setPersonen] = useState<string[]>(["Klant", "Dev"]);
  // De developer van DEZE klant; leeg = we tonen gewoon "Dev" en verzinnen niemand.
  const [devNaam, setDevNaam] = useState<string | null>(null);
  useEffect(() => {
    if (!lijstVoor) return;
    const sluit = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".ovc-lijstpop")) setLijstVoor(null); };
    document.addEventListener("mousedown", sluit);
    return () => document.removeEventListener("mousedown", sluit);
  }, [lijstVoor]);
  useEffect(() => {
    fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (d?.ok) {
        setPersonen([...new Set(["Klant", "Dev", ...(d.items || []).map((i: { persoon: string }) => i.persoon)])] as string[]);
        setDevNaam(d.devName || null);
      }
    }).catch(() => {});
  }, [slug]);
  async function zetOpLijst(persoon: string) {
    if (!lijstVoor) return;
    const { key, tekst, sleutel } = lijstVoor;
    setLijstVoor(null);
    try {
      const d = await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", slug, persoon, tekst }) }).then((r) => r.json());
      if (d?.ok) { zetStaat(sleutel, "lijst"); setFeedback({ key, msg: `Op de bespreeklijst van ${persoon === "Dev" ? devLabel(devNaam) : persoon} gezet.`, ok: true }); }
      else setFeedback({ key, msg: d?.error || "Op de lijst zetten mislukte.", ok: false });
    } catch { setFeedback({ key, msg: "Op de lijst zetten mislukte.", ok: false }); }
  }

  // Klik op een knopje bij een punt: + = kaart, × = negeren, ✓ = afvinken, » = bespreeklijst.
  function klikOpPunt(e: React.MouseEvent, s: Sectie, key: string) {
    const btn = (e.target as HTMLElement).closest?.(".ovc-act") as HTMLElement | null;
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const doel = btn.closest("li, p");
    if (!doel) return;
    const punt = puntTekst(doel);
    if (!punt) return;
    const sleutel = puntKey(punt);
    const huidig = marks[sleutel] || "";
    if (btn.classList.contains("ovc-act-plus")) {
      if (huidig === "taak") { zetStaat(sleutel, null); return; }
      void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}Punt: ${punt}`, sleutel);
    } else if (btn.classList.contains("ovc-act-x")) {
      zetStaat(sleutel, huidig === "weg" ? null : "weg");
    } else if (btn.classList.contains("ovc-act-v")) {
      zetStaat(sleutel, huidig === "klaar" ? null : "klaar");
    } else if (btn.classList.contains("ovc-act-lijst")) {
      if (huidig === "lijst") { zetStaat(sleutel, null); return; }
      setFeedback(null);
      const r = btn.getBoundingClientRect();
      setLijstVoor({ key, tekst: punt, sleutel, x: r.left, y: r.bottom });
    }
  }

  // Elk herkenbaar punt wordt een taakrijtje met rechts de vier knopjes.
  const ACTIES = '<span class="ovc-acties">'
    + '<button type="button" class="ovc-act ovc-act-plus" title="Voeg toe als kaart in de weekplanning">+</button>'
    + '<button type="button" class="ovc-act ovc-act-lijst" title="Zet dit punt op een bespreeklijst (klant, developer, ...)">&raquo;</button>'
    + '<button type="button" class="ovc-act ovc-act-x" title="Negeer dit voorstel">×</button>'
    + '<button type="button" class="ovc-act ovc-act-v" title="Vink af: dit is gedaan">✓</button>'
    + "</span>";
  const metKnopjes = (html: string) => vervangEmoji(html)
    .replace(/<li>/g, `<li>${ACTIES}`)
    .replace(/<p><strong>/g, `<p class="ovc-punt">${ACTIES}<strong>`);

  const samenvatting = (t: Teller): string => {
    const delen: string[] = [];
    if (t.taak) delen.push(`${t.taak} in de weekplanning`);
    if (t.lijst) delen.push(`${t.lijst} op een bespreeklijst`);
    if (t.weg) delen.push(`${t.weg} genegeerd`);
    if (t.klaar) delen.push(`${t.klaar} gedaan`);
    return delen.join(" · ");
  };

  return (
    <div className="ovc-blokken" ref={rootRef}>
      {secties.map((s, i) => {
        const key = `s${i}`;
        const klikKey = `${key}-punt`;
        const t = tellers[key];
        const afgehandeld = t ? t.taak + t.lijst + t.weg + t.klaar : 0;
        const sHash = sectieSleutel(s);
        const sectieVerwerkt = marks[sHash] === "taak";
        return (
          <div key={i} className={"ovc-blok" + (s.kop ? "" : " ovc-blok-intro")} data-skey={key}>
            {(s.kop || heeftKoppen) && (
              <div className="ovc-blok-kop">
                {s.kop && <span className="ovc-blok-titel">{s.kop}</span>}
                <span className="ovc-blok-spacer" />
                {!sectieVerwerkt && heeftInhoud(s.md) && (
                  <>
                    <button type="button" className="ovc-blok-taakbtn ovc-blok-taakbtn-licht" disabled={!!busyKey}
                      title="Zet deze sectie ONGEWIJZIGD als één taak neer: geen AI, geen splitsing. Voor kant-en-klare inhoud die al af is."
                      onClick={(e) => {
                        const blok = (e.currentTarget as HTMLElement).closest(".ovc-blok");
                        void kopieerAlsTaak(key, s, [...(blok ? sleutelsVan(blok) : []), sHash]);
                      }}>
                      {busyKey === key ? "Bezig…" : "Kopieer als taak"}
                    </button>
                    <button type="button" className="ovc-blok-taakbtn" disabled={!!busyKey}
                      title="Maak kaarten van deze hele sectie (één per pagina) en klap de sectie in"
                      onClick={(e) => {
                        const blok = (e.currentTarget as HTMLElement).closest(".ovc-blok");
                        void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}${s.md}`, undefined, [...(blok ? sleutelsVan(blok) : []), sHash]);
                      }}>
                      {busyKey === key ? "Bezig…" : "+ Taak"}
                    </button>
                  </>
                )}
              </div>
            )}
            {/* Sectie verwerkt (ook tabel-secties): ingeklapt tot één regeltje. */}
            {sectieVerwerkt && (
              <div className="ovc-afgerond-rij ovc-sectie-verwerkt">
                <span className="st-dot st-ok" />
                <button type="button" className="ovc-verwerkt-tekst" onClick={() => setToon((v) => ({ ...v, [key]: !v[key] }))}>
                  Verwerkt in de weekplanning <span className="ovc-afgerond-toggle">{toon[key] ? "verberg ▴" : "toon ▾"}</span>
                </button>
                <button type="button" className="ovc-herstel" title="Terugdraaien: de sectie weer als open suggestie tonen" onClick={() => zetStaat(sHash, null)}>herstel</button>
              </div>
            )}
            {(!sectieVerwerkt || toon[key]) && (
              <div className={"chat-md ovc-blok-inhoud" + (sectieVerwerkt ? " ovc-sectie-gedempt" : "")} onClick={(e) => klikOpPunt(e, s, klikKey)}
                dangerouslySetInnerHTML={{ __html: metKnopjes(mdToHtml(s.md)) }} />
            )}
            {!sectieVerwerkt && afgehandeld > 0 && (
              <button type="button" className="ovc-afgerond-rij" onClick={() => setToon((v) => ({ ...v, [key]: !v[key] }))}>
                <span className="st-dot st-ok" /> {afgehandeld} {afgehandeld === 1 ? "punt" : "punten"} afgehandeld: {samenvatting(t)} <span className="ovc-afgerond-toggle">{toon[key] ? "verberg ▴" : "toon ▾"}</span>
              </button>
            )}
            {busyKey === klikKey && <div className="ovc-blok-feedback">Kaart maken…</div>}
            {feedback && (feedback.key === key || feedback.key === klikKey) && (
              <div className={"ovc-blok-feedback" + (feedback.ok ? " ok" : " err")}>
                {feedback.ok && <span className="st-dot st-ok" />} {feedback.msg}
              </div>
            )}
          </div>
        );
      })}
      {genoemdePaden.map((p) => <PaginaDossier key={p} slug={slug} url={p} compact />)}

      {/* Een analyse als deze kon je alleen als platte tekst doorsturen: het gewone
          mailvenster leest innerText, dus de koppen, tabellen en lijstjes vielen weg.
          Juist het werk dat je wilt laten zien ging kapot in de laatste stap. Deze
          knop stuurt het antwoord door zoals het hier staat. */}
      <div className="ovc-doorstuur">
        {!stuurOpen ? (
          <button type="button" className="wp-fase-btn" onClick={() => setStuurOpen(true)}
            title="Stuur deze analyse door met dezelfde opmaak: koppen, tabellen en lijsten blijven staan">
            Mail deze analyse
          </button>
        ) : (
          <div className="ovc-doorstuur-venster">
            <div className="ovc-doorstuur-rij">
              <label>Aan</label>
              <input value={stuurAan} onChange={(e) => setStuurAan(e.target.value)}
                placeholder="naam@bedrijf.nl, tweede@bedrijf.nl" />
            </div>
            <div className="ovc-doorstuur-rij">
              <label>Onderwerp</label>
              <input value={stuurOnderwerp} onChange={(e) => setStuurOnderwerp(e.target.value)} />
            </div>
            <div className="ovc-doorstuur-rij">
              <label>Vooraf</label>
              <textarea value={stuurIntro} onChange={(e) => setStuurIntro(e.target.value)} rows={3}
                placeholder="Korte begeleidende zin (mag leeg)" />
            </div>
            <div className="ovc-doorstuur-acties">
              <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={stuurBezig || !stuurAan.trim()}
                onClick={() => void stuurAnalyse()}>{stuurBezig ? "Versturen…" : "Verstuur"}</button>
              <button type="button" className="wp-fase-btn" disabled={stuurBezig} onClick={() => { setStuurOpen(false); setStuurMsg(null); }}>Annuleren</button>
              <span className="muted">De opmaak gaat mee zoals hierboven.</span>
            </div>
            {stuurMsg && <div className={stuurMsg.ok ? "wp-doc-ok" : "wp-doc-fout"}>{stuurMsg.tekst}</div>}
          </div>
        )}
      </div>
      {lijstVoor && typeof window !== "undefined" && (
        <div className="ovc-lijstpop" style={{ left: Math.max(8, Math.min(lijstVoor.x, window.innerWidth - 300)), top: lijstVoor.y + 6 }}>
          <span className="ovc-lijstpop-kop">Op welke bespreeklijst?</span>
          {personen.map((p) => (
            <button key={p} type="button" className="wp-fase-btn" onClick={() => void zetOpLijst(p)}>{p === "Dev" ? devLabel(devNaam) : p}</button>
          ))}
          <button type="button" className="wp-icon wp-del" title="Annuleren" onClick={() => setLijstVoor(null)}>×</button>
        </div>
      )}
    </div>
  );
}

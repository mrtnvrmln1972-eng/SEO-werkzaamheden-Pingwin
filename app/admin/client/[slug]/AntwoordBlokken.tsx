"use client";

// Gedeelde weergave van een assistent-antwoord als sectie-kaartjes (per "## "-kop).
// Elk afzonderlijk herkenbaar punt (bullet én vetgedrukt punt) krijgt een plusje om
// er direct een kaart in de weekplanning van te maken; na het aanmaken wordt het
// plusje een groen vinkje en wordt de regel doorgestreept (onthouden per klant).
// Status-emoji's uit oude antwoorden worden vervangen door nette stipjes.
// Puur weergave-laag, dus met terugwerkende kracht op alle bestaande chats.

import { useEffect, useRef, useState } from "react";

type Sectie = { kop: string; md: string };
type Feedback = { key: string; msg: string; ok: boolean };

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

export default function AntwoordBlokken({ slug, thread, content, toHtml, onWeekplanChanged }: {
  slug: string;
  thread: string;
  content: string;
  toHtml: (md: string) => string;
  onWeekplanChanged?: () => void;
}) {
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [versie, setVersie] = useState(0); // her-toepassen van vinkjes na een klik
  const rootRef = useRef<HTMLDivElement>(null);
  const opslag = `pingwin-wp-punten:${slug}`;

  const gedaan = (): Set<string> => {
    try { return new Set(JSON.parse(window.localStorage.getItem(opslag) || "[]") as string[]); } catch { return new Set(); }
  };
  const markeerGedaan = (key: string) => {
    try {
      const s = gedaan(); s.add(key);
      window.localStorage.setItem(opslag, JSON.stringify([...s].slice(-400)));
    } catch { /* opslag is best effort */ }
    setVersie((v) => v + 1);
  };

  // Splits de ruwe markdown per "## "-kop; tekst vóór de eerste kop is een intro-blok.
  const secties: Sectie[] = [];
  {
    let kop = "";
    let buf: string[] = [];
    const triviaal = (md: string) => !md.split("\n").some((r) => r.replace(/[-*_#\s]/g, "").length > 0);
    const push = () => { const md = buf.join("\n").trim(); if (kop || (md && !triviaal(md))) secties.push({ kop, md }); buf = []; };
    for (const r of (content || "").split("\n")) {
      const m = /^##\s+(.*)$/.exec(r.trim());
      if (m) { push(); kop = m[1].replace(/[#*]/g, "").trim(); } else buf.push(r);
    }
    push();
  }
  const heeftKoppen = secties.some((s) => s.kop);

  // Punt-tekst van het element achter een plusje (zonder het knopje zelf).
  function puntTekst(el: Element): string {
    const kloon = el.cloneNode(true) as HTMLElement;
    kloon.querySelectorAll(".ovc-li-plus").forEach((b) => b.remove());
    return (kloon.textContent || "").replace(/\s+/g, " ").trim();
  }
  const puntKey = (tekst: string) => hash(`${thread}|${norm(tekst)}`);

  // Na elke render: eerder aangemaakte punten hun vinkje + doorstreping teruggeven.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const done = gedaan();
    root.querySelectorAll(".ovc-li-plus").forEach((btn) => {
      const doel = btn.closest("li, p");
      if (!doel) return;
      const key = puntKey(puntTekst(doel));
      const is = done.has(key);
      btn.classList.toggle("ovc-plus-done", is);
      (btn as HTMLElement).textContent = is ? "✓" : "+";
      (btn as HTMLElement).title = is ? "Hier is al een kaart van gemaakt" : "Maak van dit punt een kaart in de weekplanning";
      doel.classList.toggle("ovc-gedaan", is);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, versie, slug, thread]);

  async function maakTaak(key: string, tekst: string, puntSleutel?: string) {
    if (busyKey) return;
    setBusyKey(key); setFeedback(null);
    try {
      const r = await fetch("/api/admin/weekplan/from-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, answer: tekst, enkel: true }) });
      const d = await r.json();
      if (d?.ok && (d.added || d.merged)) {
        const delen: string[] = [];
        if (d.added) delen.push(`${d.added} ${d.added === 1 ? "kaart toegevoegd" : "kaarten toegevoegd"}`);
        if (d.merged) delen.push(`${d.merged} bestaande ${d.merged === 1 ? "paginakaart" : "paginakaarten"} aangevuld`);
        setFeedback({ key, msg: `${delen.join(" en ")}`, ok: true });
        if (puntSleutel) markeerGedaan(puntSleutel);
        onWeekplanChanged?.();
      } else setFeedback({ key, msg: d?.error || "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } catch {
      setFeedback({ key, msg: "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } finally { setBusyKey(""); }
  }

  // Klik op een punt-plusje: precies dat punt (bullet of vetgedrukt punt) als kaart.
  function klikOpPunt(e: React.MouseEvent, s: Sectie, key: string) {
    const btn = (e.target as HTMLElement).closest?.(".ovc-li-plus") as HTMLElement | null;
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    if (btn.classList.contains("ovc-plus-done")) return;
    const doel = btn.closest("li, p");
    if (!doel) return;
    const punt = puntTekst(doel);
    if (!punt) return;
    void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}Punt: ${punt}`, puntKey(punt));
  }

  // Elk herkenbaar punt krijgt een plusje: bullets én paragrafen die met een
  // vetgedrukt kopwoord beginnen ("Zwemvijver — ...", "Structured data — ...").
  // Elk punt als echt taakrijtje: vinkvakje links (gaat aan zodra er een kaart
  // van gemaakt is), de tekst ernaast, en rechts het oranje plus-rondje.
  const PUNT_PREFIX = '<span class="ovc-check" aria-hidden="true"></span><button type="button" class="ovc-li-plus" title="Maak van dit punt een kaart in de weekplanning">+</button>';
  const metPlusjes = (html: string) => vervangEmoji(html)
    .replace(/<li>/g, `<li>${PUNT_PREFIX}`)
    .replace(/<p><strong>/g, `<p class="ovc-punt">${PUNT_PREFIX}<strong>`);

  return (
    <div className="ovc-blokken" ref={rootRef}>
      {secties.map((s, i) => {
        const key = `s${i}`;
        const klikKey = `${key}-punt`;
        return (
          <div key={i} className={"ovc-blok" + (s.kop ? "" : " ovc-blok-intro")}>
            {(s.kop || heeftKoppen) && (
              <div className="ovc-blok-kop">
                {s.kop && <span className="ovc-blok-titel">{s.kop}</span>}
                <span className="ovc-blok-spacer" />
                <button type="button" className="ovc-blok-taakbtn" disabled={!!busyKey}
                  title="Maak kaarten van deze hele sectie: één per pagina die erin voorkomt"
                  onClick={() => void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}${s.md}`)}>
                  {busyKey === key ? "Bezig…" : "+ Taak"}
                </button>
              </div>
            )}
            <div className="chat-md ovc-blok-inhoud" onClick={(e) => klikOpPunt(e, s, klikKey)}
              dangerouslySetInnerHTML={{ __html: metPlusjes(toHtml(s.md)) }} />
            {busyKey === klikKey && <div className="ovc-blok-feedback">Kaart maken…</div>}
            {feedback && (feedback.key === key || feedback.key === klikKey) && (
              <div className={"ovc-blok-feedback" + (feedback.ok ? " ok" : " err")}>
                {feedback.ok && <span className="st-dot st-ok" />} {feedback.msg}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

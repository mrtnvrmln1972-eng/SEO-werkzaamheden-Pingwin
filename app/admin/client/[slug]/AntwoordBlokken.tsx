"use client";

// Gedeelde weergave van een assistent-antwoord als sectie-kaartjes (per "## "-kop),
// met per sectie een "+ Taak"-knopje en per bullet een plusje: zo beslist Maarten
// per punt zelf wat een kaart in de weekplanning wordt. Puur weergave-laag, dus
// met terugwerkende kracht op alle bestaande chats (Pingwin én NOC).

import { useState } from "react";

type Sectie = { kop: string; md: string };
type Feedback = { key: string; msg: string; ok: boolean };

export default function AntwoordBlokken({ slug, thread, content, toHtml, onWeekplanChanged }: {
  slug: string;
  thread: string;
  content: string;
  toHtml: (md: string) => string;
  onWeekplanChanged?: () => void;
}) {
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Splits de ruwe markdown per "## "-kop; tekst vóór de eerste kop is een intro-blok.
  const secties: Sectie[] = [];
  {
    let kop = "";
    let buf: string[] = [];
    const push = () => { const md = buf.join("\n").trim(); if (md || kop) secties.push({ kop, md }); buf = []; };
    for (const r of (content || "").split("\n")) {
      const m = /^##\s+(.*)$/.exec(r.trim());
      if (m) { push(); kop = m[1].replace(/[#*]/g, "").trim(); } else buf.push(r);
    }
    push();
  }
  const heeftKoppen = secties.some((s) => s.kop);

  async function maakTaak(key: string, tekst: string) {
    if (busyKey) return;
    setBusyKey(key); setFeedback(null);
    try {
      const r = await fetch("/api/admin/weekplan/from-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, answer: tekst, enkel: true }) });
      const d = await r.json();
      if (d?.ok && (d.added || d.merged)) {
        const delen: string[] = [];
        if (d.added) delen.push(`${d.added} ${d.added === 1 ? "kaart toegevoegd" : "kaarten toegevoegd"}`);
        if (d.merged) delen.push(`${d.merged} bestaande ${d.merged === 1 ? "paginakaart" : "paginakaarten"} aangevuld`);
        setFeedback({ key, msg: `✓ ${delen.join(" en ")}`, ok: true });
        onWeekplanChanged?.();
      } else setFeedback({ key, msg: d?.error || "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } catch {
      setFeedback({ key, msg: "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } finally { setBusyKey(""); }
  }

  // Klik op een bullet-plusje: pak de tekst van precies die bullet (zonder het knopje).
  function klikOpPunt(e: React.MouseEvent, s: Sectie, key: string) {
    const btn = (e.target as HTMLElement).closest?.(".ovc-li-plus") as HTMLElement | null;
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const li = btn.closest("li");
    if (!li) return;
    const kloon = li.cloneNode(true) as HTMLElement;
    kloon.querySelectorAll(".ovc-li-plus").forEach((b) => b.remove());
    const punt = (kloon.textContent || "").replace(/\s+/g, " ").trim();
    if (!punt) return;
    void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}Punt: ${punt}`);
  }

  // Elk lijstpunt krijgt vooraan een plusje (weergave-laag, dus ook op oude berichten).
  const metPlusjes = (html: string) => html.replace(/<li>/g, '<li><button type="button" class="ovc-li-plus" title="Maak van dit punt een kaart in de weekplanning">+</button>');

  return (
    <div className="ovc-blokken">
      {secties.map((s, i) => {
        const key = `s${i}`;
        const puntKey = `${key}-punt`;
        return (
          <div key={i} className={"ovc-blok" + (s.kop ? "" : " ovc-blok-intro")}>
            {(s.kop || heeftKoppen) && (
              <div className="ovc-blok-kop">
                {s.kop && <span className="ovc-blok-titel">{s.kop}</span>}
                <span className="ovc-blok-spacer" />
                <button type="button" className="ovc-blok-taakbtn" disabled={!!busyKey}
                  title="Maak van deze hele sectie één kaart in de weekplanning"
                  onClick={() => void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}${s.md}`)}>
                  {busyKey === key ? "Bezig…" : "+ Taak"}
                </button>
              </div>
            )}
            <div className="chat-md ovc-blok-inhoud" onClick={(e) => klikOpPunt(e, s, puntKey)}
              dangerouslySetInnerHTML={{ __html: metPlusjes(toHtml(s.md)) }} />
            {busyKey === puntKey && <div className="ovc-blok-feedback">Kaart maken…</div>}
            {feedback && (feedback.key === key || feedback.key === puntKey) && (
              <div className={"ovc-blok-feedback" + (feedback.ok ? " ok" : " err")}>{feedback.msg}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

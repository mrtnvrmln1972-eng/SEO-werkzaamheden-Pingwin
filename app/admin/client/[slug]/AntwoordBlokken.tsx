"use client";

// Gedeelde weergave van een assistent-antwoord als sectie-kaartjes (per "## "-kop).
// Elk afzonderlijk herkenbaar punt (bullet én vetgedrukt punt) is een taakrijtje
// met rechts drie knopjes: groen plusje (voeg toe als kaart in de weekplanning),
// rood kruisje (negeer het voorstel) en groen vinkje (afvinken, gedaan =
// doorgestreept). De keuze wordt per klant onthouden, dus ook na herladen.
// Status-emoji's uit oude antwoorden worden vervangen door nette stipjes.
// Puur weergave-laag, dus met terugwerkende kracht op alle bestaande chats.

import { useEffect, useRef, useState } from "react";

type Sectie = { kop: string; md: string };
type Feedback = { key: string; msg: string; ok: boolean };
type PuntStaat = "taak" | "weg" | "klaar" | "lijst";

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
  const [versie, setVersie] = useState(0); // her-toepassen van staten na een klik
  const rootRef = useRef<HTMLDivElement>(null);
  const opslag = `pingwin-wp-punten2:${slug}`;
  const opslagOud = `pingwin-wp-punten:${slug}`;

  // Staat per punt (hash → taak/weg/klaar); oude vorm (lijst van "kaart gemaakt") migreert mee.
  const staten = (): Record<string, PuntStaat> => {
    try {
      const nieuw = JSON.parse(window.localStorage.getItem(opslag) || "{}") as Record<string, PuntStaat>;
      const oud = JSON.parse(window.localStorage.getItem(opslagOud) || "[]") as string[];
      for (const k of oud) if (!nieuw[k]) nieuw[k] = "taak";
      return nieuw;
    } catch { return {}; }
  };
  const zetStaat = (key: string, staat: PuntStaat | null) => {
    try {
      const s = staten();
      if (staat) s[key] = staat; else delete s[key];
      window.localStorage.setItem(opslag, JSON.stringify(s));
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

  // Punt-tekst van het element (zonder de knopjes).
  function puntTekst(el: Element): string {
    const kloon = el.cloneNode(true) as HTMLElement;
    kloon.querySelectorAll(".ovc-acties").forEach((b) => b.remove());
    return (kloon.textContent || "").replace(/\s+/g, " ").trim();
  }
  const puntKey = (tekst: string) => hash(`${thread}|${norm(tekst)}`);

  // Na elke render: de onthouden staat per punt terugzetten op de knopjes en de regel.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = staten();
    root.querySelectorAll(".ovc-acties").forEach((acties) => {
      const doel = acties.closest("li, p");
      if (!doel) return;
      // Groepskopjes ("Lokale hovenierspagina's ...:") zijn geen taken: geen
      // kader en geen knopjes, gewoon een tussenkopje boven de rijtjes.
      if (/:\s*$/.test(puntTekst(doel))) { doel.classList.add("ovc-groepkop"); acties.remove(); return; }
      const staat = s[puntKey(puntTekst(doel))] || "";
      doel.classList.toggle("ovc-gedaan", staat === "klaar");
      doel.classList.toggle("ovc-weg", staat === "weg");
      acties.querySelector(".ovc-act-plus")?.classList.toggle("ovc-act-aan", staat === "taak");
      acties.querySelector(".ovc-act-x")?.classList.toggle("ovc-act-aan", staat === "weg");
      acties.querySelector(".ovc-act-v")?.classList.toggle("ovc-act-aan", staat === "klaar");
      acties.querySelector(".ovc-act-lijst")?.classList.toggle("ovc-act-aan", staat === "lijst");
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
        if (puntSleutel) zetStaat(puntSleutel, "taak");
        onWeekplanChanged?.();
      } else setFeedback({ key, msg: d?.error || "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } catch {
      setFeedback({ key, msg: "Kon hier geen kaart van maken. Probeer het nog een keer.", ok: false });
    } finally { setBusyKey(""); }
  }

  // "Op bespreeklijst": kies de persoon; het punt gaat naar diens afvinklijstje.
  const [lijstVoor, setLijstVoor] = useState<{ key: string; tekst: string; sleutel: string } | null>(null);
  const [personen, setPersonen] = useState<string[]>(["Klant", "Dev"]);
  useEffect(() => {
    fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (d?.ok) setPersonen([...new Set(["Klant", "Dev", ...(d.items || []).map((i: { persoon: string }) => i.persoon)])] as string[]);
    }).catch(() => {});
  }, [slug]);
  async function zetOpLijst(persoon: string) {
    if (!lijstVoor) return;
    const { key, tekst, sleutel } = lijstVoor;
    setLijstVoor(null);
    try {
      const d = await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", slug, persoon, tekst }) }).then((r) => r.json());
      if (d?.ok) { zetStaat(sleutel, "lijst"); setFeedback({ key, msg: `Op de bespreeklijst van ${persoon === "Dev" ? "Sander (Dev)" : persoon} gezet.`, ok: true }); }
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
    const huidig = staten()[sleutel] || "";
    if (btn.classList.contains("ovc-act-plus")) {
      if (huidig === "taak") { zetStaat(sleutel, null); return; }
      void maakTaak(key, `${s.kop ? `Sectie: ${s.kop}\n` : ""}Punt: ${punt}`, sleutel);
    } else if (btn.classList.contains("ovc-act-x")) {
      zetStaat(sleutel, huidig === "weg" ? null : "weg");
    } else if (btn.classList.contains("ovc-act-v")) {
      zetStaat(sleutel, huidig === "klaar" ? null : "klaar");
    } else if (btn.classList.contains("ovc-act-lijst")) {
      setFeedback(null);
      setLijstVoor({ key, tekst: punt, sleutel });
    }
  }

  // Elk herkenbaar punt wordt een taakrijtje met rechts de drie knopjes.
  const ACTIES = '<span class="ovc-acties">'
    + '<button type="button" class="ovc-act ovc-act-plus" title="Voeg toe als kaart in de weekplanning">+</button>'
    + '<button type="button" class="ovc-act ovc-act-lijst" title="Zet dit punt op een bespreeklijst (Sander, klant, ...)">&raquo;</button>'
    + '<button type="button" class="ovc-act ovc-act-x" title="Negeer dit voorstel">×</button>'
    + '<button type="button" class="ovc-act ovc-act-v" title="Vink af: dit is gedaan">✓</button>'
    + "</span>";
  const metKnopjes = (html: string) => vervangEmoji(html)
    .replace(/<li>/g, `<li>${ACTIES}`)
    .replace(/<p><strong>/g, `<p class="ovc-punt">${ACTIES}<strong>`);

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
              dangerouslySetInnerHTML={{ __html: metKnopjes(toHtml(s.md)) }} />
            {lijstVoor && (lijstVoor.key === klikKey) && (
              <div className="ovc-lijstkeuze">
                <span>Op welke bespreeklijst?</span>
                {personen.map((p) => (
                  <button key={p} type="button" className="wp-fase-btn" onClick={() => void zetOpLijst(p)}>{p === "Dev" ? "Sander (Dev)" : p}</button>
                ))}
                <button type="button" className="wp-icon wp-del" title="Annuleren" onClick={() => setLijstVoor(null)}>×</button>
              </div>
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
    </div>
  );
}

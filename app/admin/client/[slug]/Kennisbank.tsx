"use client";

// Structured data-kennisbank: de centrale verzamelbak op de Klant-tab. Maarten
// sleept of plakt hier alles in (documenten, artsen-gegevens, schema-code); het
// dashboard structureert dat tot entiteiten met een voorstel dat hij eerst
// bevestigt. Het rode lijstje toont wat er voor dit soort bedrijf nog mist.

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Entiteit = { id: number; categorie: string; naam: string; velden: Record<string, string>; bron: string; updatedAt: string };
type Voorstel = { id: number; bron: string; samenvatting: string; entiteiten: { categorie: string; naam: string; velden: Record<string, string>; oordeel: string }[] };

const CAT_LABEL: Record<string, string> = { organisatie: "Organisatie", persoon: "Personen", locatie: "Locaties", dienst: "Diensten", overig: "Overig" };
const CAT_VOLGORDE = ["organisatie", "persoon", "locatie", "dienst", "overig"];
const OORDEEL: Record<string, string> = { nieuw: "nieuw", aanvulling: "aanvulling", ouder: "let op: ouder" };

export default function Kennisbank({ slug }: { slug: string }) {
  const [entiteiten, setEntiteiten] = useState<Entiteit[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [voorstel, setVoorstel] = useState<Voorstel | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [plakVeld, setPlakVeld] = useState("");

  async function laad() {
    const d = await fetch(`/api/admin/schema-knowledge?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setEntiteiten(d.entities || []); setGaps(d.gaps || []); setVoorstel(d.proposal || null); }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function verstuur(init: RequestInit, foutTekst: string) {
    setBusy("lezen"); setFout(""); setOkMsg("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", init).then((r) => r.json());
      if (d?.ok && d.proposal) { setVoorstel(d.proposal); setPlakVeld(""); }
      else if (d?.ok) void laad();
      else setFout(d?.error || foutTekst);
    } catch { setFout(foutTekst); }
    finally { setBusy(""); }
  }

  function drop(file: File) {
    const form = new FormData();
    form.append("file", file); form.append("slug", slug);
    void verstuur({ method: "POST", body: form }, "Kon het bestand niet verwerken.");
  }
  function plak() {
    const v = plakVeld.trim();
    if (!v) return;
    const isLink = /^https?:\/\//i.test(v) && /drive\.google|docs\.google/.test(v);
    void verstuur({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isLink ? { action: "link", slug, driveLink: v } : { action: "tekst", slug, tekst: v }) }, "Kon dit niet verwerken.");
  }
  async function besluit(actie: "verwerk" | "negeer") {
    if (!voorstel) return;
    setBusy(actie); setFout("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actie, slug, id: voorstel.id }) }).then((r) => r.json());
      if (d?.ok) { setVoorstel(null); if (actie === "verwerk") setOkMsg(`${d.verwerkt || 0} gegevens verwerkt in de kennisbank.`); void laad(); }
      else setFout(d?.error || "Dat lukte niet.");
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }
  async function maakTaak() {
    setBusy("taak"); setFout("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "taak", slug }) }).then((r) => r.json());
      if (d?.ok) setOkMsg("Kaart aangemaakt in de weekplanning met het uitvraaglijstje.");
      else setFout(d?.error || "Kon geen kaart maken.");
    } catch { setFout("Kon geen kaart maken."); }
    finally { setBusy(""); }
  }

  // Laatste stand structured data (app-breed, via websearch; maandelijks verversen).
  const [stand, setStand] = useState<{ datum: string; tekst: string; verouderd: boolean } | null>(null);
  const [standOpen, setStandOpen] = useState(false);
  useEffect(() => {
    fetch("/api/admin/schema-actueel").then((r) => r.json()).then((d) => { if (d?.ok) setStand(d.stand || null); }).catch(() => {});
  }, []);
  async function ververStand() {
    setBusy("stand"); setFout("");
    try {
      const d = await fetch("/api/admin/schema-actueel", { method: "POST" }).then((r) => r.json());
      if (d?.ok) { setStand(d.stand); setStandOpen(true); }
      else setFout(d?.error || "Onderzoek mislukte.");
    } catch { setFout("Onderzoek mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }
  const standDatum = stand ? new Date(stand.datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "";

  const perCat = CAT_VOLGORDE.map((c) => ({ cat: c, items: entiteiten.filter((e) => e.categorie === c) })).filter((g) => g.items.length);

  return (
    <div className="kb-wrap">
      <div className="org-sitewide-head" style={{ marginTop: 18 }}>
        <strong>Kennisbank structured data</strong>
        <span className="muted">Gooi hier alles in: documenten, artsen-gegevens, schema-code. Verwerken gebeurt pas na jouw akkoord.</span>
      </div>
      <div className={"wp-docdrop" + (drag ? " wp-docdrop-actief" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) drop(f); }}>
        {busy === "lezen" ? <span className="muted">Materiaal lezen en structureren…</span> : (
          <>
            <span className="wp-docdrop-tekst">Sleep hier een bestand naartoe (.docx, .txt, .md, .json)</span>
            <span className="wp-docdrop-of">of plak tekst of een Drive-link:</span>
            <span className="wp-docdrop-linkrij">
              <input className="wp-docdrop-input" value={plakVeld} placeholder="Tekst of https://docs.google.com/…"
                onChange={(e) => setPlakVeld(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") plak(); }} />
              <button type="button" className="wp-fase-btn" disabled={!plakVeld.trim() || !!busy} onClick={plak}>Lees</button>
            </span>
          </>
        )}
      </div>
      {voorstel && (
        <div className="wp-docvoorstel">
          <div className="wp-docvoorstel-kop">Voorstel uit &ldquo;{voorstel.bron}&rdquo;</div>
          <div className="wp-docvoorstel-tekst">{voorstel.samenvatting}</div>
          <ul className="kb-voorstel-lijst">
            {voorstel.entiteiten.map((e, i) => (
              <li key={i}>
                <span className="wp-docversie-kind">{CAT_LABEL[e.categorie] || e.categorie}: {e.naam}</span>
                <span className={"wp-doc-vergelijk" + (e.oordeel === "ouder" ? " wp-doc-ouder" : "")}>{OORDEEL[e.oordeel] || ""}</span>
                <span className="muted kb-velden">{Object.entries(e.velden).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
              </li>
            ))}
          </ul>
          <div className="wp-docvoorstel-acties">
            <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void besluit("verwerk")}>{busy === "verwerk" ? "Verwerken…" : "Verwerk in kennisbank"}</button>
            <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void besluit("negeer")}>Negeer</button>
            <span className="muted">Bestaande gegevens blijven bewaard; nieuwe waarden vullen aan.</span>
          </div>
        </div>
      )}
      {okMsg && <div className="wp-doc-ok">{okMsg}</div>}
      {fout && <div className="wp-doc-fout">{fout}</div>}
      {gaps.length > 0 && (
        <div className="kb-gaps">
          <div className="kb-gaps-kop">Nog aan te leveren ({gaps.length})</div>
          <ul>{gaps.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void maakTaak()}>{busy === "taak" ? "Bezig…" : "Zet als kaart in de weekplanning"}</button>
        </div>
      )}
      <div className="kb-stand">
        <div className="kb-stand-kop">
          <button type="button" className="wp-chat-toggle" onClick={() => setStandOpen(!standOpen)}>
            Laatste stand structured data {stand ? `(${standDatum})` : ""} {standOpen ? "▾" : "▸"}
          </button>
          {stand?.verouderd && <span className="kb-stand-oud">ouder dan een maand</span>}
          <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void ververStand()}>{busy === "stand" ? "Onderzoeken… (kan een minuut duren)" : stand ? "Ververs" : "Onderzoek nu"}</button>
        </div>
        {standOpen && stand && <div className="md kb-stand-tekst" dangerouslySetInnerHTML={{ __html: mdToHtml(stand.tekst) }} />}
        {!stand && <div className="muted">Nog geen onderzoek gedaan; klik op &ldquo;Onderzoek nu&rdquo; voor de actuele richtlijnen (Google en AI) en hoe wij ze toepassen.</div>}
      </div>
      {perCat.length > 0 && (
        <div className="kb-entiteiten">
          {perCat.map((g) => (
            <div key={g.cat} className="kb-cat">
              <div className="kb-cat-kop">{CAT_LABEL[g.cat]} ({g.items.length})</div>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id}>
                    <strong>{e.naam}</strong>
                    <span className="muted kb-velden">{Object.entries(e.velden).map(([k, v]) => `${k}: ${v}`).join(" · ") || "(nog geen details)"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

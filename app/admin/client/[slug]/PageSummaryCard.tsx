"use client";

import { useEffect, useRef, useState } from "react";

type Summary = { nu: string; doel: string; zet: string; related: string };
const EMPTY: Summary = { nu: "", doel: "", zet: "", related: "" };

// De KORTE samenvatting bovenaan een opengeklapte pagina: de "toplaag" boven de
// volledige (lange) vastgelegde strategie. Drie vaste regels in gewone taal, plus
// een optionele samenhang-regel, zodat je in één oogopslag weet wat deze pagina nu
// doet en moet worden, zonder de hele analyse te lezen. Wordt uit het plan
// gedestilleerd en is met de hand bij te stellen.
//
// Samenvatten is GEEN aparte handeling meer (19-08-2026 gemeld, 21-08 opgelost).
// Sinds de server hem meteen bij het vastleggen maakt, staat hij er vanzelf.
// Voor de pagina's die hun strategie eerder kregen, maakt dit blok hem alsnog
// één keer zelf zodra je de pagina opent: ligt er een strategie en nog geen
// samenvatting, dan gebeurt dat zonder klik. Anders had elke oude pagina nog
// steeds die tweede knop nodig, en dat was precies de klacht.
export default function PageSummaryCard({ slug, url, planDone, autoGenSignal }: {
  slug: string; url: string; planDone: boolean; autoGenSignal?: number;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Summary>(EMPTY);
  const [err, setErr] = useState("");

  const cacheKey = `pw_psum_${slug}_${url}`;

  // Cache-first: toon de vorige samenvatting direct, ververs daarna op de achtergrond.
  useEffect(() => {
    let alive = true;
    try { const c = localStorage.getItem(cacheKey); if (c) { const p = JSON.parse(c); if (p && typeof p === "object") { setSummary(p); setLoading(false); } } } catch { /* geen cache */ }
    fetch(`/api/admin/page-summary?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => {
        if (!alive) return;
        if (d.ok) {
          setSummary(d.summary || null);
          try { localStorage.setItem(cacheKey, JSON.stringify(d.summary || null)); } catch { /* extra */ }
          // Ligt er een strategie maar nog geen samenvatting (een pagina van
          // vóór 21-08-2026), maak hem dan zelf. Eén keer per pagina per
          // browser: lukt het niet, dan blijft de knop hieronder staan in
          // plaats van dat elke keer opnieuw een poging kost.
          if (!d.summary && planDone) {
            let alGeprobeerd = false;
            try { alGeprobeerd = localStorage.getItem(`${cacheKey}_poging`) === "1"; } catch { /* geen opslag */ }
            if (!alGeprobeerd) {
              try { localStorage.setItem(`${cacheKey}_poging`, "1"); } catch { /* extra */ }
              void generate();
            }
          }
        }
      }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug, url, planDone]);

  async function generate() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/page-summary/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) });
      const d = await r.json();
      if (d.ok) { setSummary(d.summary); try { localStorage.setItem(cacheKey, JSON.stringify(d.summary)); } catch { /* extra */ } }
      else setErr(d.error || "Samenvatten mislukt.");
    } catch { setErr("Samenvatten mislukt."); } finally { setBusy(false); }
  }

  // Haalt de opgeslagen samenvatting opnieuw op. Geeft terug of er nu een staat.
  async function verversVanServer(): Promise<boolean> {
    try {
      const d = await fetch(`/api/admin/page-summary?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d?.ok && d.summary) {
        setSummary(d.summary);
        try { localStorage.setItem(cacheKey, JSON.stringify(d.summary)); } catch { /* extra */ }
        return true;
      }
    } catch { /* dan proberen we hem alsnog te maken */ }
    return false;
  }

  // Na 'Vat samen & leg strategie vast' in de chat: de server heeft de
  // samenvatting bij het vastleggen al gemaakt, dus eerst ophalen. Alleen als
  // dat niets oplevert maken we hem hier alsnog; zo staat er nooit een tweede
  // samenvat-ronde (en een tweede rekening) tegenover één handeling.
  const firstSignal = useRef(true);
  useEffect(() => {
    if (autoGenSignal === undefined) return;
    if (firstSignal.current) { firstSignal.current = false; return; }
    void (async () => { if (!(await verversVanServer())) await generate(); })(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [autoGenSignal]);

  function startEdit() { setDraft(summary || EMPTY); setEditing(true); setErr(""); }
  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/page-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, summary: draft }) });
      const d = await r.json();
      if (d.ok) { setSummary(draft); try { localStorage.setItem(cacheKey, JSON.stringify(draft)); } catch { /* extra */ } setEditing(false); }
      else setErr(d.error || "Opslaan mislukt.");
    } catch { setErr("Opslaan mislukt."); } finally { setBusy(false); }
  }

  const has = !!summary && !!(summary.nu || summary.doel || summary.zet);

  return (
    <div className="page-summary-card">
      <div className="psc-head">
        <span className="psc-title">In het kort</span>
        {has && !editing && <button type="button" className="btn btn-klein" onClick={startEdit}>Bewerken</button>}
        {has && !editing && <button type="button" className={"btn btn-klein" + (busy ? " busy" : "")} onClick={generate} disabled={busy} title="Maak de samenvatting opnieuw uit de vastgelegde strategie.">{busy ? "Vernieuwen…" : "Vernieuw uit strategie"}</button>}
      </div>

      {err && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{err}</div>}

      {editing ? (
        <div className="psc-edit">
          <label className="psc-row"><span className="psc-label">Nu</span><input className="psc-input" value={draft.nu} placeholder="Wat deze pagina vandaag is en waar hij op scoort…" onChange={(e) => setDraft({ ...draft, nu: e.target.value })} /></label>
          <label className="psc-row"><span className="psc-label">Doel</span><input className="psc-input" value={draft.doel} placeholder="Wat deze pagina moet worden en op welk zoekwoord…" onChange={(e) => setDraft({ ...draft, doel: e.target.value })} /></label>
          <label className="psc-row"><span className="psc-label">Zet</span><input className="psc-input" value={draft.zet} placeholder="De één belangrijkste actie…" onChange={(e) => setDraft({ ...draft, zet: e.target.value })} /></label>
          <label className="psc-row"><span className="psc-label">Samenhang</span><input className="psc-input" value={draft.related} placeholder="Optioneel: hangt samen met /andere-pagina/…" onChange={(e) => setDraft({ ...draft, related: e.target.value })} /></label>
          <div className="psc-actions">
            <button type="button" className="btn btn-primary btn-klein" onClick={save} disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</button>
            <button type="button" className="btn btn-klein" onClick={() => setEditing(false)} disabled={busy}>Annuleren</button>
          </div>
        </div>
      ) : has ? (
        <div className="psc-body">
          {summary!.nu && <div className="psc-row"><span className="psc-label">Nu</span><span className="psc-text">{summary!.nu}</span></div>}
          {summary!.doel && <div className="psc-row"><span className="psc-label">Doel</span><span className="psc-text">{summary!.doel}</span></div>}
          {summary!.zet && <div className="psc-row"><span className="psc-label psc-label-key">Zet</span><span className="psc-text psc-text-key">{summary!.zet}</span></div>}
          {summary!.related && <div className="psc-related">{summary!.related}</div>}
        </div>
      ) : loading ? (
        <div className="muted psc-empty">Samenvatting laden…</div>
      ) : planDone ? (
        <div className="psc-empty">
          {/* Sinds de samenvatting bij het vastleggen gemaakt wordt (en anders
              bij het openen van de pagina), betekent deze stand dat die poging
              niet lukte. Dat hoort er ook zo te staan, anders lijkt het weer een
              stap die jij nog moet doen. */}
          <span className="muted">{busy ? "De samenvatting wordt gemaakt uit de vastgelegde strategie…" : "De samenvatting is niet gelukt. Probeer het hier nog een keer."}</span>
          <button type="button" className={"btn btn-klein pcd-btn pcd-btn-primary" + (busy ? " busy" : "")} onClick={generate} disabled={busy}>{busy ? "Samenvatten…" : "Vat de strategie samen"}</button>
        </div>
      ) : (
        <div className="muted psc-empty">Zodra de strategie hieronder is vastgelegd, verschijnt hier vanzelf de korte samenvatting: wat deze pagina nu doet, wat hij moet worden en de belangrijkste zet.</div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { urlKey } from "../../../../lib/url-key";
import { mdToHtml } from "../../../../lib/markdown";
import Voortgang from "./Voortgang";

type SuggestedLink = { bronUrl: string; relevantie?: number; autoriteit?: string; verkeer?: number; linkbudget?: string; score?: string; passage?: string; nieuweZin?: boolean; ankertekst?: string; ankertype?: string; positie?: string; verwachteImpact?: string; urlRating?: number | null; urGemeten?: boolean; urDatum?: string };
type AnchorItem = { anker: string; type?: string; aantal?: number; status?: string };
type TargetPage = { url: string; laag?: string; cluster?: string; primairZoekwoord?: string; huidigePositie?: number; doel?: string; baselineInterneLinks?: number; score?: string; voorgesteldeLinks: SuggestedLink[]; ankerprofiel?: AnchorItem[]; gaten?: string[]; waarschuwingen?: string[] };
type Structure = { wezen?: string[]; pillarGaten?: string[]; clusterNotities?: string };
type Datakwaliteit = { crawl?: boolean; gsc?: boolean; ahrefsUrlRating?: boolean; contentMapping?: boolean; opmerking?: string; urDatum?: string; urGemeten?: number };
type Result = { samenvatting: string; datakwaliteit?: Datakwaliteit; doelpaginas: TargetPage[]; structuur?: Structure; generatedAt: string | null };
type Suggestion = { url: string; positie: number; primairZoekwoord: string; impressies: number };
type State = { status: string; result: Result | null; targets: string[]; error: string; updatedAt: string | null; fase?: string };

function scoreClass(s?: string): string {
  const v = (s || "").toLowerCase();
  if (v.includes("hoog")) return "hoog";
  if (v.includes("midden")) return "midden";
  return "laag";
}
function num(n?: number): string { return n != null && Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "—"; }
function dag(iso?: string): string { return iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : ""; }

// De autoriteit van een bronpagina, met de datum en of het gemeten of benaderd is.
// Het cijfer komt uit de meting van het dashboard, niet uit de tekst van het model.
function Autoriteit({ l }: { l: SuggestedLink }) {
  if (l.urlRating == null) return l.autoriteit ? <span className="muted il-ur">autoriteit {l.autoriteit}</span> : null;
  return (
    <span className={"il-ur " + (l.urGemeten ? "gemeten" : "benaderd")}>
      autoriteit {String(l.urlRating).replace(".", ",")}
      <span className="il-ur-bron">{l.urGemeten ? `gemeten ${dag(l.urDatum)}` : "benaderd (Ahrefs kent deze pagina niet)"}</span>
    </span>
  );
}

// Vast herkenningspunt per doelpagina, zodat een ander scherm hierheen kan scrollen.
const ilBlokId = (url: string) => "ilrow-" + (url || "").replace(/[^a-zA-Z0-9]/g, "-");

export default function InternalLinksPanel({ slug, openTarget }: {
  slug: string;
  /** Van buiten meteen op het blok van één doelpagina landen. */
  openTarget?: { url: string; n: number } | null;
}) {
  const [state, setState] = useState<State | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rows, setRows] = useState<{ url: string; positie?: number; primairZoekwoord?: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [loadingSug, setLoadingSug] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [configuring, setConfiguring] = useState(false);

  // Binnenkomen vanuit de prioriteitenscan: scrol naar het blok van die doelpagina.
  // Matchen met de gedeelde urlKey, want deze lijst draagt volledige URL's en de
  // scan werkt met paden.
  const openHandledRef = useRef(0);
  useEffect(() => {
    const doelen = state?.result?.doelpaginas;
    if (!openTarget || !doelen?.length) return;
    if (openHandledRef.current === openTarget.n) return;
    openHandledRef.current = openTarget.n;
    const doel = urlKey(openTarget.url);
    const match = doelen.find((t) => urlKey(t.url) === doel);
    if (!match) return;
    setTimeout(() => {
      document.getElementById(ilBlokId(match.url))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [openTarget, state]);

  async function load() {
    try {
      const d = await fetch(`/api/admin/internal-links?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, targets: d.targets || [], error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  async function loadSuggestions() {
    setLoadingSug(true);
    try {
      const d = await fetch(`/api/admin/internal-links?slug=${encodeURIComponent(slug)}&suggest=1`).then((r) => r.json());
      if (d.ok) setSuggestions(d.suggestions || []);
    } catch { /* stil */ } finally { setLoadingSug(false); }
  }
  useEffect(() => { load(); loadSuggestions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Vul de kieslijst zodra suggesties + vorige doelen binnen zijn (voorstel is standaard aangevinkt).
  useEffect(() => {
    const map = new Map<string, { url: string; positie?: number; primairZoekwoord?: string }>();
    for (const s of suggestions) map.set(s.url, { url: s.url, positie: s.positie, primairZoekwoord: s.primairZoekwoord });
    for (const t of state?.targets || []) if (!map.has(t)) map.set(t, { url: t });
    setRows([...map.values()]);
    if (selected.size === 0) {
      const init = new Set<string>(suggestions.map((s) => s.url));
      for (const t of state?.targets || []) init.add(t);
      setSelected(init);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [suggestions, state?.targets]);

  useEffect(() => {
    if (state?.status !== "running") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [state?.status, slug]);

  function toggle(url: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(url)) n.delete(url); else n.add(url); return n; });
  }
  function addCustom() {
    let u = custom.trim(); if (!u) return;
    try { if (/^https?:\/\//i.test(u)) u = new URL(u).pathname; } catch { /* laat staan */ }
    if (!u.startsWith("/")) u = "/" + u;
    if (u.length > 1) u = u.replace(/\/+$/, "");
    setRows((prev) => prev.some((r) => r.url === u) ? prev : [...prev, { url: u }]);
    setSelected((prev) => new Set(prev).add(u));
    setCustom("");
  }

  async function run() {
    const targets = [...selected];
    if (busy || state?.status === "running") return;
    if (!targets.length) { setErr("Kies minstens één doelpagina."); return; }
    setBusy(true); setErr("");
    try {
      const d = await fetch("/api/admin/internal-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, targets }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); return; }
      setConfiguring(false);
      await load();
    } catch { setErr("Starten mislukt."); } finally { setBusy(false); }
  }

  const running = state?.status === "running";
  const result = state?.result;
  const dk = result?.datakwaliteit;
  const showPicker = !running && (configuring || !result);

  return (
    <div className="cannibal-panel">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Interne-links-optimalisatie</span>
          {result && !running && !configuring && (
            <button type="button" className="pcd-btn" onClick={() => setConfiguring(true)}>Doelpagina&rsquo;s aanpassen</button>
          )}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "2px 0 12px" }}>
          Draait de agentic skill <em>interne-links-optimalisatie</em> (dezelfde methodiek als in Cowork): vindt per doelpagina de best passende interne links op relevantie, autoriteit, verkeer en linkbudget, met een gevarieerd ankerprofiel, de pillar-dochter-structuur bewaakt, en nooit een link naar een te-redirecten pagina. Je kunt wegklikken; het draait op de achtergrond.
        </p>
        {err && <div className="login-error" style={{ marginBottom: 8 }}>{err}</div>}
        {state?.status === "error" && state.error && <div className="login-error" style={{ marginBottom: 8 }}>{state.error}</div>}

        {showPicker && (
          <div className="il-picker">
            <div className="pcd-docs-head">Doelpagina&rsquo;s (de te versterken pagina&rsquo;s)</div>
            <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
              Voorstel: striking-distance pagina&rsquo;s (positie 5-15). Vink af/aan of voeg een eigen URL toe.
            </p>
            {loadingSug && <div className="muted">Voorstel laden…</div>}
            {!loadingSug && rows.length === 0 && <div className="muted" style={{ marginBottom: 8 }}>Geen striking-distance pagina&rsquo;s gevonden. Voeg hieronder zelf een doelpagina toe.</div>}
            <div className="il-target-list">
              {rows.map((r) => (
                <label key={r.url} className={"il-target-row" + (selected.has(r.url) ? " on" : "")}>
                  <input type="checkbox" checked={selected.has(r.url)} onChange={() => toggle(r.url)} />
                  <span className="il-target-url">{r.url}</span>
                  {r.positie != null && <span className="il-target-meta">positie {num(r.positie)}</span>}
                  {r.primairZoekwoord && <span className="muted il-target-kw">{r.primairZoekwoord}</span>}
                </label>
              ))}
            </div>
            <div className="il-add">
              <input type="text" value={custom} placeholder="/eigen-url/ toevoegen…" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
              <button type="button" className="pcd-btn" onClick={addCustom}>Toevoegen</button>
            </div>
            <div className="il-run-row">
              <button type="button" className={"pcd-btn pcd-btn-primary" + (busy ? " busy" : "")} onClick={run} disabled={busy}>
                {busy ? "Starten…" : `Analyse draaien (${selected.size})`}
              </button>
              {result && <button type="button" className="pcd-btn" onClick={() => setConfiguring(false)}>Annuleren</button>}
            </div>
          </div>
        )}

        {running && (
          <div style={{ marginTop: "var(--s-3)" }}>
            <Voortgang
              titel="Interne links"
              label={state?.fase || "De bronpagina's worden gecrawld en gewogen op autoriteit en relevantie; dit duurt een paar minuten."}
              sinds={state?.updatedAt}
            />
          </div>
        )}

        {result && !showPicker && (
          <>
            {state?.updatedAt && <div className="ck-updated" style={{ marginBottom: 10 }}>bijgewerkt {new Date(state.updatedAt).toLocaleString("nl-NL")}{running ? " · nieuwe analyse draait…" : ""}</div>}

            {dk && (
              <div className="cannibal-dk">
                <span className={"cannibal-dk-pill " + (dk.crawl ? "on" : "off")}>Crawl/linkgraaf {dk.crawl ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.gsc ? "on" : "off")}>Search Console {dk.gsc ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.ahrefsUrlRating ? "on" : "off")}>
                  Autoriteit per pagina {dk.ahrefsUrlRating ? `✓ ${dk.urGemeten ?? ""} gemeten${dk.urDatum ? ` op ${dag(dk.urDatum)}` : ""}` : "✗"}
                </span>
                {dk.opmerking && <div className="muted" style={{ fontSize: 12, marginTop: 6, width: "100%" }}>{dk.opmerking}</div>}
              </div>
            )}

            {result.samenvatting && <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: mdToHtml(result.samenvatting) }} />}

            {result.doelpaginas.length === 0 && <div className="muted" style={{ marginTop: 8 }}>Geen link-adviezen gegenereerd.</div>}

            {result.doelpaginas.map((tp, i) => (
              <div className="cannibal-cluster" key={i} id={ilBlokId(tp.url)}>
                <div className="cannibal-cluster-head">
                  <strong><a href={tp.url} target="_blank" rel="noreferrer">{tp.url}</a></strong>
                  {tp.laag && <span className={"il-laag " + (tp.laag.toLowerCase().includes("pillar") ? "pillar" : "dochter")}>{tp.laag}</span>}
                  {tp.huidigePositie != null && <span className="muted">positie {num(tp.huidigePositie)}{tp.doel ? ` → ${tp.doel}` : ""}</span>}
                  {tp.score && <span className={"cannibal-score " + scoreClass(tp.score)}>{tp.score}</span>}
                </div>
                {(tp.primairZoekwoord || tp.baselineInterneLinks != null) && (
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    {tp.primairZoekwoord ? `zoekwoord: ${tp.primairZoekwoord}` : ""}{tp.primairZoekwoord && tp.baselineInterneLinks != null ? " · " : ""}{tp.baselineInterneLinks != null ? `interne inkomende links nu: ${tp.baselineInterneLinks}` : ""}
                  </div>
                )}

                {tp.voorgesteldeLinks?.length > 0 && (
                  <div className="res-table-wrap">
                    <table className="res-table">
                      <thead><tr><th>Bronpagina</th><th>Score</th><th>Ankertekst</th><th>Positie</th><th>Waarom / passage</th></tr></thead>
                      <tbody>
                        {tp.voorgesteldeLinks.map((l, j) => (
                          <tr key={j}>
                            <td>
                              <a href={l.bronUrl} target="_blank" rel="noreferrer">{l.bronUrl}</a>
                              <Autoriteit l={l} />
                              {l.relevantie != null ? <span className="muted" style={{ display: "block", fontSize: 11 }}>relevantie {l.relevantie}</span> : null}
                            </td>
                            <td><span className={"cannibal-score " + scoreClass(l.score)}>{l.score || "—"}</span></td>
                            <td><strong>{l.ankertekst || "—"}</strong>{l.ankertype ? <span className="il-anktype">{l.ankertype}</span> : null}</td>
                            <td className="muted" style={{ fontSize: 12 }}>{l.positie || "—"}{l.nieuweZin ? " · nieuwe zin" : ""}</td>
                            <td className="muted" style={{ fontSize: 12 }}>{l.passage || l.verwachteImpact || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tp.ankerprofiel && tp.ankerprofiel.length > 0 && (
                  <div className="il-anchors">
                    <span className="il-anchors-label">Ankerprofiel:</span>
                    {tp.ankerprofiel.map((a, k) => (
                      <span key={k} className={"il-anchor-chip " + (a.status === "voorgesteld" ? "new" : "old")}>
                        {a.anker}{a.type ? ` · ${a.type}` : ""}{a.aantal ? ` ×${a.aantal}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {tp.gaten && tp.gaten.length > 0 && (
                  <div className="il-gaps">{tp.gaten.map((g, k) => <div key={k} className="il-gap">⚠ {g}</div>)}</div>
                )}
                {tp.waarschuwingen && tp.waarschuwingen.length > 0 && (
                  <div className="il-warns">{tp.waarschuwingen.map((w, k) => <div key={k} className="muted il-warn">{w}</div>)}</div>
                )}
              </div>
            ))}

            {result.structuur && (result.structuur.wezen?.length || result.structuur.pillarGaten?.length || result.structuur.clusterNotities) && (
              <div className="cannibal-tech">
                <div className="pcd-docs-head">Structuur</div>
                {result.structuur.clusterNotities && <div style={{ fontSize: 13, marginBottom: 8 }}>{result.structuur.clusterNotities}</div>}
                {result.structuur.pillarGaten && result.structuur.pillarGaten.length > 0 && (
                  <div className="il-gaps">{result.structuur.pillarGaten.map((g, k) => <div key={k} className="il-gap">⚠ {g}</div>)}</div>
                )}
                {result.structuur.wezen && result.structuur.wezen.length > 0 && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Wees-pagina&rsquo;s (geen interne inkomende links): {result.structuur.wezen.join(", ")}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

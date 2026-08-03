"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import OpruimTabel from "./OpruimTabel";

type ClusterUrl = { url: string; rol?: string; positie?: number; klikken?: number; impressies?: number; verwijzendeDomeinen?: number; intentie?: string };
type Signalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
type Cluster = { keyword: string; volume?: number; score?: string; signalen?: Signalen; intentie?: string; urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string };
type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
type Result = { samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: Cluster[]; redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null };
type State = { status: string; result: Result | null; error: string; updatedAt: string | null };

function actionClass(a: string): string {
  const s = (a || "").toLowerCase();
  if (s.includes("301") || s.includes("merge")) return "redir";
  if (s.includes("noindex") || s.includes("de-opt") || s.includes("differenti") || s.includes("canonical")) return "deopt";
  return "keep";
}
function scoreClass(s?: string): string {
  const v = (s || "").toLowerCase();
  if (v.includes("hoog")) return "hoog";
  if (v.includes("midden")) return "midden";
  return "laag";
}
function num(n?: number): string { return n != null && Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "—"; }

export default function CannibalPanel({ slug, domain = "" }: { slug: string; domain?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const d = await fetch(`/api/admin/cannibal-redirect?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  useEffect(() => {
    if (state?.status !== "running") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [state?.status, slug]);

  async function run() {
    if (busy || state?.status === "running") return;
    setBusy(true); setErr("");
    // Verberg een eventuele vorige foutmelding meteen (geen rode flits tijdens het starten).
    setState((s) => (s ? { ...s, status: "running", error: "" } : s));
    try {
      const d = await fetch("/api/admin/cannibal-redirect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await load(); return; }
      await load();
    } catch { setErr("Starten mislukt."); await load(); } finally { setBusy(false); }
  }

  const running = state?.status === "running";
  const result = state?.result;
  const dk = result?.datakwaliteit;

  return (
    <div className="cannibal-panel">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Keyword-cannibalisatie-analyse</span>
          <button type="button" className={"pcd-btn pcd-btn-primary" + (running ? " busy" : "")} onClick={run} disabled={busy || running}>
            {running ? "Analyse draait…" : result ? "Opnieuw analyseren" : "Analyse draaien"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "2px 0 12px" }}>
          Draait de agentic skill <em>keyword-cannibalisatie-analyse</em> (dezelfde methodiek als in Cowork): onderscheidt echte cannibalisatie van false positives via URL-flip-detectie over tijd, positie-plafond, klik-verdeling en intentie-check, en geeft per cluster een winnaar met de lichtste effectieve actie. Je kunt wegklikken; het draait op de achtergrond.
        </p>
        {err && <div className="login-error" style={{ marginBottom: 8 }}>{err}</div>}
        {state?.status === "error" && state.error && <div className="login-error" style={{ marginBottom: 8 }}>{state.error}</div>}
        {running && !result && <div className="muted">Analyse draait op de achtergrond… (dit kan een minuut duren)</div>}
        {!result && !running && state?.status !== "error" && <div className="muted">Nog geen analyse. Klik &ldquo;Analyse draaien&rdquo;.</div>}

        {result && (
          <>
            {state?.updatedAt && <div className="ck-updated" style={{ marginBottom: 10 }}>bijgewerkt {new Date(state.updatedAt).toLocaleString("nl-NL")}{running ? " · nieuwe analyse draait…" : ""}</div>}

            {dk && (
              <div className="cannibal-dk">
                <span className={"cannibal-dk-pill " + (dk.gsc ? "on" : "off")}>Search Console {dk.gsc ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.gscTijdreeks ? "on" : "off")}>Flip-tijdreeks {dk.gscTijdreeks ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.ahrefsZoekwoorden ? "on" : "off")}>Ahrefs per pagina {dk.ahrefsZoekwoorden ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.ahrefsBacklinks ? "on" : "off")}>Verwijzende domeinen {dk.ahrefsBacklinks ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.crawl ? "on" : "off")}>Crawl {dk.crawl ? "✓" : "✗"}</span>
                {dk.opmerking && <div className="muted" style={{ fontSize: 12, marginTop: 6, width: "100%" }}>{dk.opmerking}</div>}
              </div>
            )}

            {/* De werklijst eerst. Het verhaal eronder: een lijst is om af te werken,
                proza is om te begrijpen, en in die volgorde. */}
            {result.redirectMap && result.redirectMap.length > 0 && (
              <div className="opr-blok">
                <div className="opr-kop">Werklijst: wat waar naartoe</div>
                <OpruimTabel slug={slug} domain={domain} rijen={result.redirectMap} />
              </div>
            )}

            {result.samenvatting && (
              <details className="opr-details">
                <summary>Samenvatting en onderbouwing per cluster</summary>
                <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: mdToHtml(result.samenvatting) }} />
              </details>
            )}

            {result.clusters.length === 0 && <div className="muted" style={{ marginTop: 8 }}>Geen echte cannibalisatie-clusters gevonden.</div>}

            {result.clusters.map((c, i) => {
              const sig = c.signalen || {};
              return (
                <div className="cannibal-cluster" key={i}>
                  <div className="cannibal-cluster-head">
                    <strong>{c.keyword}</strong>
                    {c.volume != null && <span className="muted">vol {c.volume}</span>}
                    {c.score && <span className={"cannibal-score " + scoreClass(c.score)}>{c.score}</span>}
                    {c.intentie && <span className="cannibal-ptype">intentie: {c.intentie}</span>}
                  </div>
                  <div className="cannibal-signals">
                    {sig.urlFlip && <span className="cannibal-sig flip">URL-flip{sig.flipsIn90d ? ` ×${sig.flipsIn90d}` : ""}</span>}
                    {sig.positiePlafond && <span className="cannibal-sig">positie-plafond 5-20</span>}
                    {sig.klikVerdeling && <span className="cannibal-sig">klikken verdeeld</span>}
                    <span className="muted" style={{ fontSize: 12 }}>winnaar: <strong>{c.winnaar}</strong></span>
                    <span className={"cannibal-act " + actionClass(c.actie)}>{c.actie}</span>
                  </div>
                  <div className="res-table-wrap">
                    <table className="res-table">
                      <thead><tr><th>Pagina</th><th>Rol</th><th>Positie</th><th>Clicks</th><th>Vert.</th><th>Intentie</th></tr></thead>
                      <tbody>
                        {c.urls.map((u, j) => (
                          <tr key={j} className={"cannibal-row " + (u.url === c.winnaar ? "redir" : "")}>
                            <td><a href={u.url} target="_blank" rel="noreferrer">{u.url}</a></td>
                            <td>{u.rol || "—"}</td>
                            <td>{num(u.positie)}</td>
                            <td>{u.klikken != null ? u.klikken : "—"}</td>
                            <td>{u.impressies != null ? u.impressies : "—"}</td>
                            <td className="muted" style={{ fontSize: 12 }}>{u.intentie || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {c.onderbouwing && <div className="cannibal-reason"><strong>Onderbouwing:</strong> {c.onderbouwing}</div>}
                  {c.verwachteImpact && <div className="cannibal-reason muted"><strong>Verwachte impact:</strong> {c.verwachteImpact}</div>}
                </div>
              );
            })}

            {result.redirectMap && result.redirectMap.length > 0 && (
              <div className="cannibal-tech">
                <div className="pcd-docs-head">301-redirectmap</div>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Van</th><th>Naar</th><th>Type</th><th>Content mergen</th><th>Reden</th></tr></thead>
                    <tbody>
                      {result.redirectMap.map((r, i) => (
                        <tr key={i}>
                          <td>{r.van}</td>
                          <td>{r.naar}</td>
                          <td>{r.type || "301"}</td>
                          <td>{r.mergeContent ? "ja" : "—"}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{r.reden || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.interneLinks && result.interneLinks.length > 0 && (
              <div className="cannibal-tech">
                <div className="pcd-docs-head">Interne-link-acties</div>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Vanaf</th><th>Naar</th><th>Ankertekst</th><th>Reden</th></tr></thead>
                    <tbody>
                      {result.interneLinks.map((l, i) => (
                        <tr key={i}>
                          <td>{l.vanaf}</td>
                          <td>{l.naar}</td>
                          <td>{l.ankertekst || "—"}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{l.reden || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

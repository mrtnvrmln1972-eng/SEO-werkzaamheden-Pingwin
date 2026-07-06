"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Member = { url: string; role: string; action: string; target: string; reason: string; clicks?: number; impressions?: number };
type Cluster = { place: string; winner: string; problemType: string; members: Member[] };
type Technical = { onderwerp: string; bevinding: string; advies: string };
type Result = { summary: string; clusters: Cluster[]; technical: Technical[]; generatedAt: string | null };
type State = { status: string; result: Result | null; error: string; updatedAt: string | null };

function actionClass(a: string): string {
  const s = (a || "").toLowerCase();
  if (s.includes("301")) return "redir";
  if (s.includes("de-opt") || s.includes("optimalis")) return "deopt";
  return "keep";
}

export default function CannibalPanel({ slug }: { slug: string }) {
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
    try {
      const d = await fetch("/api/admin/cannibal-redirect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); return; }
      await load();
    } catch { setErr("Starten mislukt."); } finally { setBusy(false); }
  }

  const running = state?.status === "running";
  const result = state?.result;

  return (
    <div className="cannibal-panel">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Cannibalisatie &amp; redirect (site-breed)</span>
          <button type="button" className={"pcd-btn pcd-btn-primary" + (running ? " busy" : "")} onClick={run} disabled={busy || running}>
            {running ? "Analyse draait…" : result ? "Opnieuw analyseren" : "Analyse draaien"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "2px 0 12px" }}>
          Clustert alle pagina&rsquo;s per plaats/thema en geeft per cluster een winnaar + redirect-acties (301 / de-optimaliseren / behouden), gegrond op je URL-lijst, Search Console en Ahrefs-volumes. Je kunt wegklikken; het draait op de achtergrond.
        </p>
        {err && <div className="login-error" style={{ marginBottom: 8 }}>{err}</div>}
        {state?.status === "error" && state.error && <div className="login-error" style={{ marginBottom: 8 }}>{state.error}</div>}
        {running && !result && <div className="muted">Analyse draait op de achtergrond… (dit kan een minuut duren)</div>}
        {!result && !running && state?.status !== "error" && <div className="muted">Nog geen analyse. Klik &ldquo;Analyse draaien&rdquo;.</div>}

        {result && (
          <>
            {state?.updatedAt && <div className="ck-updated" style={{ marginBottom: 10 }}>bijgewerkt {new Date(state.updatedAt).toLocaleString("nl-NL")}{running ? " · nieuwe analyse draait…" : ""}</div>}
            {result.summary && <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: mdToHtml(result.summary) }} />}

            {result.clusters.map((c, i) => (
              <div className="cannibal-cluster" key={i}>
                <div className="cannibal-cluster-head">
                  <strong>{c.place}</strong>
                  <span className="muted">winnaar: {c.winner}</span>
                  {c.problemType && <span className="cannibal-ptype">{c.problemType}</span>}
                </div>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Pagina</th><th>Rol</th><th>Clicks</th><th>Actie</th><th>Doel</th><th>Reden</th></tr></thead>
                    <tbody>
                      {c.members.map((m, j) => (
                        <tr key={j} className={"cannibal-row " + actionClass(m.action)}>
                          <td><a href={m.url} target="_blank" rel="noreferrer">{m.url}</a></td>
                          <td>{m.role}</td>
                          <td>{m.clicks != null ? m.clicks : "—"}</td>
                          <td><span className={"cannibal-act " + actionClass(m.action)}>{m.action}</span></td>
                          <td>{m.target && m.target !== "-" ? m.target : "—"}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{m.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {result.technical.length > 0 && (
              <div className="cannibal-tech">
                <div className="pcd-docs-head">Technisch</div>
                {result.technical.map((t, i) => (
                  <div className="cannibal-tech-item" key={i}>
                    <strong>{t.onderwerp}</strong>
                    <div>{t.bevinding}</div>
                    <div className="muted">Advies: {t.advies}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

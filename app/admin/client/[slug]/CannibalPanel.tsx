"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import OpruimTabel from "./OpruimTabel";
import OpruimStructuur from "./OpruimStructuur";

type ClusterUrl = { url: string; rol?: string; positie?: number; klikken?: number; impressies?: number; verwijzendeDomeinen?: number; intentie?: string };
type Signalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
type Cluster = { keyword: string; volume?: number; score?: string; signalen?: Signalen; intentie?: string; urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string };
type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
type Result = { samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: Cluster[]; redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null };
type State = { status: string; result: Result | null; error: string; updatedAt: string | null; stap?: number; stappen?: number; stapLabel?: string; cronTik?: string | null; cronStil?: boolean };

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
      if (d.ok) setState({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt, stap: d.stap, stappen: d.stappen, stapLabel: d.stapLabel, cronTik: d.cronTik, cronStil: d.cronStil });
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

  // Hervatten zonder opnieuw te beginnen: de ontsnapping als het vangnet wegblijft.
  async function hervat() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const d = await fetch("/api/admin/cannibal-redirect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, hervat: true }) }).then((r) => r.json());
      if (!d.ok) setErr(d.error || "Hervatten mislukt.");
      await load();
    } catch { setErr("Hervatten mislukt."); await load(); } finally { setBusy(false); }
  }

  const running = state?.status === "running";
  const result = state?.result;
  const dk = result?.datakwaliteit;
  // De datum van de lijst die je NU ziet. Niet updatedAt: dat is tijdens een run de
  // hartslag van de werker, dus een oude lijst zou vers lijken.
  const lijstDatum = result?.generatedAt || (state?.status === "done" ? state?.updatedAt : null);
  const regels = result?.redirectMap?.length || 0;
  const stappen = state?.stappen || 5;

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
        {/* Voortgang, want een spinner zonder stand is niet te onderscheiden van
            vastgelopen. Precies dat gebeurde op 03-08-2026: de run was al dood en
            het scherm bleef "draait…" tonen. */}
        {running && (
          <div className="opr-voortgang">
            <span className="opr-voortgang-stap">Stap {state?.stap || 1} van {stappen}</span>
            <span className="opr-voortgang-label">{state?.stapLabel || "De analyse wordt gestart"}</span>
            {regels > 0 && <span className="opr-voortgang-tel">{regels} regels tot nu toe</span>}
            <button type="button" className="ghost-btn small" onClick={hervat} disabled={busy} title="Draait de eerstvolgende stap meteen, zonder de analyse opnieuw te beginnen.">Nu hervatten</button>
            <span className="opr-voortgang-tijd">
              De hele analyse duurt een kwartier tot twintig minuten. Je kunt wegklikken; hij loopt door.
              {" "}{state?.cronStil
                ? "Let op: het vangnet dat vastgelopen analyses oppakt, draait nu niet. Blijft de stap hangen, klik dan op Nu hervatten."
                : `Vangnet draaide voor het laatst om ${new Date(state?.cronTik as string).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}.`}
            </span>
          </div>
        )}
        {!result && !running && state?.status !== "error" && <div className="muted">Nog geen analyse. Klik &ldquo;Analyse draaien&rdquo;.</div>}

        {result && (
          <>
            <div className="ck-updated" style={{ marginBottom: 10 }}>
              {lijstDatum ? `Deze lijst is van ${new Date(lijstDatum).toLocaleString("nl-NL")}` : "Deze lijst heeft geen datum"}
              {running ? " · de nieuwe analyse draait nog, dit is nog de vorige" : ""}
            </div>

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

            <OpruimStructuur slug={slug} />

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

            {/* Alle onderbouwing bij elkaar en dichtgeklapt. Stond eerst als zeven
                lappen proza vóór de tabel; dat is om te begrijpen, niet om af te
                werken. Openklappen kan altijd, het gaat nergens heen. */}
            <details className="opr-details">
              <summary>Onderbouwing per cluster ({result.clusters.length}) en interne-link-acties</summary>
              <div className="opr-details-body">
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
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

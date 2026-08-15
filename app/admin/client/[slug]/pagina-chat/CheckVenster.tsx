"use client";

// De pagina-check overlay: hoe staat een rij-pagina er echt voor (GSC, Ahrefs,
// verwijzende domeinen), met de diepere duiding en dezelfde actie-knoppen als
// de tabel-rij zelf.
import { mdToHtml } from "../../../../../lib/markdown";
import type { useCannibalisatie } from "./useCannibalisatie";

export default function CheckVenster({ canni, siteBase }: { canni: ReturnType<typeof useCannibalisatie>; siteBase: string }) {
  const { checkPath, setCheckPath, checkData, checkBusy, checkErr, duidingMd, duidingBusy, loadDuiding, rowStatus, rowReason, rowRedirectRef, setRowStatus, wpRedirects, wpDone, wpBusy, wpMsg, runWpRedirect, openInBackend, sendRowToPage, makeRowTask, setRejectPath, setRejectReason } = canni;
  if (!checkPath) return null;
  return (
        <div className="compose-overlay">
          <div className="canni-check-pop">
            <div className="ccp-head">
              <strong>Pagina-check</strong>
              <code className="ccp-path">{checkPath}</code>
              {checkData && <a href={checkData.fullUrl} target="_blank" rel="noreferrer" className="ccp-live">bekijk live ↗</a>}
              <button type="button" className="ghost-btn small ccp-close" onClick={() => setCheckPath("")} title="Sluiten">✕</button>
            </div>
            {checkBusy && <div className="muted" style={{ padding: "var(--s-4) 0" }}>Gegevens ophalen (GSC en Ahrefs)…</div>}
            {checkErr && <div className="login-error">{checkErr}</div>}
            {checkData && (
              <div className="ccp-body md">
                <p className="ccp-meta"><strong>Verwijzende domeinen:</strong> {checkData.refDomains ?? "onbekend"}</p>
                <p className="ccp-sub">Search Console, laatste 90 dagen (waar Google deze pagina echt op toont):</p>
                {checkData.gsc.length ? (
                  <table className="md-table"><thead><tr><th>Zoekwoord</th><th>Positie</th><th>Klikken</th><th>Vertoningen</th></tr></thead>
                    <tbody>{checkData.gsc.map((r) => <tr key={r.keyword}><td>{r.keyword}</td><td>{r.position ? r.position.toFixed(1) : "-"}</td><td>{r.clicks}</td><td>{r.impressions}</td></tr>)}</tbody></table>
                ) : <p className="muted">Geen GSC-gegevens voor deze pagina.</p>}
                <p className="ccp-sub">Ahrefs (rankings met zoekvolume):</p>
                {checkData.ahrefs.length ? (
                  <table className="md-table"><thead><tr><th>Zoekwoord</th><th>Positie</th><th>Volume</th><th>Verkeer</th></tr></thead>
                    <tbody>{checkData.ahrefs.map((r) => <tr key={r.keyword}><td>{r.keyword}</td><td>{r.position ?? "-"}</td><td>{r.volume ?? "-"}</td><td>{r.traffic ?? "-"}</td></tr>)}</tbody></table>
                ) : <p className="muted">Geen Ahrefs-rankings voor deze pagina.</p>}
                {duidingMd
                  ? (<><p className="ccp-sub">Diepere duiding (op basis van de GSC-data van beide pagina&rsquo;s):</p><div className="md ccp-duiding" dangerouslySetInnerHTML={{ __html: mdToHtml(duidingMd, siteBase) }} /></>)
                  : <button type="button" className="ghost-btn small" style={{ marginTop: "var(--s-3)" }} disabled={duidingBusy} onClick={loadDuiding} title="AI legt de zoektermen van deze pagina naast die van de winnaar: echte splitsing of niet, en klopt de voorgestelde actie. Duurt 15-30 seconden.">{duidingBusy ? "Duiding maken…" : "Diepere duiding"}</button>}
                <div className="ccp-actions">
                  {(() => {
                    const to = rowRedirectRef.current[checkPath] || wpRedirects.find((x) => x.from === checkPath)?.to || "";
                    const redirect = to ? { from: checkPath, to } : null;
                    const status = rowStatus[checkPath];
                    if (status === "afgewezen") return <button type="button" className="pcd-btn small pcd-warn" onClick={() => setRowStatus(checkPath, null)}>Afgewezen, herstel</button>;
                    if (status === "doorgezet") return <button type="button" className="pcd-btn small pcd-blue" onClick={() => setRowStatus(checkPath, null)}>→ Bij pagina&rsquo;s, herstel</button>;
                    if (status === "taak") return <button type="button" className="pcd-btn small pcd-purple" onClick={() => setRowStatus(checkPath, null)}>Taak gemaakt, herstel</button>;
                    return (<>
                      {redirect
                        ? <button type="button" className={"pcd-btn small" + (wpDone[redirect.from]?.verified ? " pcd-done" : "")} disabled={!!wpBusy} onClick={() => runWpRedirect(redirect.from, redirect.to)}>{wpDone[redirect.from]?.verified ? "Uitgevoerd" : "Uitvoeren (301)"}</button>
                        : <button type="button" className={"pcd-btn small" + (status === "uitgevoerd" ? " pcd-done" : "")} disabled={!!wpBusy} onClick={() => openInBackend(checkPath)}>{status === "uitgevoerd" ? "✓ Uitgevoerd" : "Uitvoeren (open backend)"}</button>}
                      {!redirect && <button type="button" className="pcd-btn small wp-ghost-blue" disabled={!!wpBusy} onClick={() => sendRowToPage(checkPath)}>Naar pagina&rsquo;s</button>}
                      <button type="button" className="pcd-btn small wp-ghost-purple" disabled={!!wpBusy} onClick={() => makeRowTask(checkPath)} title="Maakt een taak in Werkzaamheden met een werkdocument (met de diepere duiding als achtergrond).">{wpBusy === checkPath ? "Bezig…" : "Taak maken"}</button>
                      <button type="button" className="pcd-btn small wp-ghost" disabled={!!wpBusy} onClick={() => { setRejectPath(checkPath); setRejectReason(rowReason[checkPath] || ""); }}>Afwijzen</button>
                    </>);
                  })()}
                </div>
                {wpMsg && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{wpMsg}</div>}
              </div>
            )}
          </div>
        </div>
  );
}

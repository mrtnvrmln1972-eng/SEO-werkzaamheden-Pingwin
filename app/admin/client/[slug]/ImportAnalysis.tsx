"use client";

import { useState } from "react";
import type { ImportItem } from "../../../../lib/analysis-import";

export default function ImportAnalysis({ slug, onClose, onDone }: { slug: string; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [cluster, setCluster] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [picked, setPicked] = useState("");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function parse(sheet?: string) {
    if (!file) { setMsg("Kies eerst een bestand."); return; }
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("cluster", cluster);
      if (sheet) fd.append("sheet", sheet);
      const r = await fetch("/api/admin/import-analysis", { method: "POST", body: fd });
      const d = await r.json();
      if (!d.ok) { setMsg(d.error || "Inlezen mislukt."); return; }
      setSheets(d.sheets || []);
      setPicked(d.picked || "");
      setItems(d.items || []);
      setStep("review");
    } catch { setMsg("Inlezen mislukt."); } finally { setBusy(false); }
  }

  function toggle(i: number) { setItems((its) => its.map((it, idx) => idx === i ? { ...it, accept: !it.accept } : it)); }
  function setAll(v: boolean) { setItems((its) => its.map((it) => ({ ...it, accept: v }))); }

  async function accept() {
    const chosen = items.filter((it) => it.accept);
    if (chosen.length === 0) { setMsg("Vink minstens één voorstel aan."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/import-analysis/accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, cluster: cluster || (file?.name || "").replace(/\.[^.]+$/, ""), source: file?.name || "", items: chosen, snapshot: items }),
      });
      const d = await r.json();
      if (d.ok) { onDone(); onClose(); } else setMsg(d.error || "Overnemen mislukt.");
    } catch { setMsg("Overnemen mislukt."); } finally { setBusy(false); }
  }

  const chosen = items.filter((it) => it.accept).length;

  return (
    <div className="compose-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compose-head">
          <span>Analyse importeren</span>
          <button type="button" className="chat-float-close" onClick={onClose}>&times;</button>
        </div>

        {step === "upload" && (
          <div className="compose-body">
            <p className="muted" style={{ marginTop: 0 }}>Upload de analyse (xlsx of csv). Het dashboard maakt er voorstellen van: een plan-alinea plus een taak per rij, met een live-vlag. Niks wordt opgeslagen tot je accepteert.</p>
            <label className="compose-label">Bestand</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label className="compose-label" style={{ marginTop: 12 }}>Cluster-naam (label op de taken)</label>
            <input className="compose-input" value={cluster} onChange={(e) => setCluster(e.target.value)} placeholder="Bv. SOA-test cluster" />
            {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}
            <div className="compose-foot" style={{ marginTop: 14 }}>
              <button type="button" className="logout-btn" onClick={onClose}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={() => parse()} disabled={busy || !file}>{busy ? "Inlezen..." : "Inlezen"}</button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="compose-body">
            <div className="import-review-top">
              <div>
                {sheets.length > 1 && (
                  <label className="import-sheet">Tabblad:{" "}
                    <select value={picked} onChange={(e) => { setPicked(e.target.value); parse(e.target.value); }}>
                      {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                )}
                <span className="muted" style={{ marginLeft: 10 }}>{items.length} rijen, {chosen} aangevinkt</span>
              </div>
              <div className="import-bulk">
                <button type="button" className="ghost-btn small" onClick={() => setAll(true)}>Alles aan</button>
                <button type="button" className="ghost-btn small" onClick={() => setAll(false)}>Alles uit</button>
              </div>
            </div>

            <div className="import-table-wrap">
              <table className="res-table import-table">
                <thead><tr><th></th><th>Vlag</th><th>Pagina</th><th>Actie</th><th>Wordt taak</th><th>Fase</th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.url + i} className={it.accept ? "" : "import-off"}>
                      <td><input type="checkbox" checked={it.accept} onChange={() => toggle(i)} /></td>
                      <td><span className={"import-flag " + it.flag} title={it.flagReason}>{it.flag === "green" ? "●" : "▲"}</span></td>
                      <td className="import-url">{it.url}{it.stad ? <span className="muted"> · {it.stad}</span> : null}</td>
                      <td>{it.actie || <span className="muted">&mdash;</span>}{it.task.geblokkeerd && <span className="import-lock" title={it.task.blokkadeReden}> 🔒</span>}</td>
                      <td className="import-taak">{it.task.taak}</td>
                      <td>{it.task.fase ? <span className="import-fase">{it.task.fase}</span> : <span className="muted">&mdash;</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}
            <div className="compose-foot" style={{ marginTop: 12 }}>
              <button type="button" className="logout-btn" onClick={() => setStep("upload")}>&larr; Terug</button>
              <button type="button" className="primary-btn small" onClick={accept} disabled={busy || chosen === 0}>{busy ? "Overnemen..." : `Neem ${chosen} over`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { TaskRow } from "../../../../lib/tasks";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const STATUSES = ["Te doen", "Bezig", "Gepland", "Klaar"];
const WIE = ["SEO", "Dev"];

const EMPTY: TaskRow = { categorie: "", taak: "", toelichting: "", uren: null, status: "Te doen", maand: "", link: "", wie: "SEO", klantZichtbaar: true };

export default function TasksEditor({ slug, initialTasks }: { slug: string; initialTasks: TaskRow[] }) {
  const [rows, setRows] = useState<TaskRow[]>(initialTasks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function update(i: number, patch: Partial<TaskRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setMsg("");
  }
  function addRow() { setRows((r) => [...r, { ...EMPTY }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }

  function onDrop(target: number) {
    if (dragIdx === null || dragIdx === target) return;
    setRows((r) => {
      const copy = [...r];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setDragIdx(null);
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tasks: rows }),
      });
      const data = await res.json();
      setMsg(data.ok ? `Opgeslagen (${data.saved} taken).` : (data.error || "Opslaan mislukt."));
    } catch {
      setMsg("Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  // Urentotalen per maand (in de huidige, ongeslagen volgorde).
  const totals = MONTHS.map((m) => {
    const inM = rows.filter((r) => (r.maand || "").toLowerCase() === m);
    const uren = inM.reduce((s, r) => s + (Number(r.uren) || 0), 0);
    return { m, count: inM.length, uren };
  }).filter((t) => t.count > 0);

  return (
    <div className="cockpit-card">
      <div className="ck-section-head">
        <span>Werkzaamheden</span>
        <span>
          <button type="button" className="logout-btn" onClick={addRow}>+ Taak</button>{" "}
          <button type="button" className="primary-btn small" onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Opslaan"}</button>
        </span>
      </div>
      {msg && <div className={msg.startsWith("Opgeslagen") ? "saved-msg" : "login-error"} style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="res-table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th></th><th>Wie</th><th>Maand</th><th>Taak</th><th>Toelichting</th><th>Uren</th><th>Status</th><th>Link</th><th title="Zichtbaar in klant-dashboard">Klant</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className={dragIdx === i ? "dragging" : ""}
              >
                <td className="drag-handle" title="Sleep om te verplaatsen">⠿</td>
                <td><select value={r.wie} onChange={(e) => update(i, { wie: e.target.value })}>{["", ...WIE].map((w) => <option key={w} value={w}>{w || "—"}</option>)}</select></td>
                <td><select value={r.maand} onChange={(e) => update(i, { maand: e.target.value })}><option value="">—</option>{MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                <td><input value={r.taak} onChange={(e) => update(i, { taak: e.target.value })} placeholder="Taak" /></td>
                <td><input value={r.toelichting} onChange={(e) => update(i, { toelichting: e.target.value })} placeholder="Toelichting" /></td>
                <td><input className="cell-num" type="number" value={r.uren ?? ""} onChange={(e) => update(i, { uren: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                <td><select value={r.status} onChange={(e) => update(i, { status: e.target.value })}><option value="">—</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                <td>
                  <div className="cell-link">
                    <input value={r.link} onChange={(e) => update(i, { link: e.target.value })} placeholder="https://..." />
                    {r.link && <a href={r.link} target="_blank" rel="noreferrer" title="Open link">↗</a>}
                  </div>
                </td>
                <td className="cell-check"><input type="checkbox" checked={r.klantZichtbaar} onChange={(e) => update(i, { klantZichtbaar: e.target.checked })} /></td>
                <td><button type="button" className="row-del" onClick={() => removeRow(i)} title="Verwijderen">×</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: 20, textAlign: "center" }}>Nog geen werkzaamheden. Klik op &ldquo;+ Taak&rdquo;.</td></tr>}
          </tbody>
        </table>
      </div>

      {totals.length > 0 && (
        <div className="task-totals">
          <span className="task-totals-head">Uren per maand:</span>
          {totals.map((t) => (
            <span key={t.m} className="task-total"><strong>{t.m}</strong> {t.uren} uur ({t.count})</span>
          ))}
        </div>
      )}
    </div>
  );
}

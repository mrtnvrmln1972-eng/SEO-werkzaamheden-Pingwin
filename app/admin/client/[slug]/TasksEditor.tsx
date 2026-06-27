"use client";

import { useState } from "react";
import type { TaskRow } from "../../../../lib/tasks";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const STATUSES = ["Te doen", "Bezig", "Gepland", "Klaar"];

type Budget = { maandbudget: number; linkbuilding: number; uurtarief: number; beschikbareUren: number };

export default function TasksEditor({ slug, initialTasks, budget }: { slug: string; initialTasks: TaskRow[]; budget: Budget }) {
  const [rows, setRows] = useState<TaskRow[]>(initialTasks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function update(i: number, patch: Partial<TaskRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setMsg("");
  }
  function addRow(maand: string, wie: string) {
    setRows((r) => [...r, { categorie: "", taak: "", toelichting: "", uren: null, status: "Te doen", maand, link: "", wie, klantZichtbaar: wie !== "Dev" }]);
  }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }

  function onDrop(target: number) {
    if (dragIdx === null || dragIdx === target) return;
    setRows((r) => { const c = [...r]; const [m] = c.splice(dragIdx, 1); c.splice(target, 0, m); return c; });
    setDragIdx(null);
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tasks: rows }) });
      const data = await res.json();
      setMsg(data.ok ? `Opgeslagen (${data.saved} taken).` : (data.error || "Opslaan mislukt."));
    } catch { setMsg("Opslaan mislukt."); } finally { setBusy(false); }
  }

  // Groeperen per maand (in huidige volgorde), met behoud van originele index.
  const indexed = rows.map((r, i) => ({ r, i }));
  const monthsPresent = MONTHS.filter((m) => indexed.some((x) => (x.r.maand || "").toLowerCase() === m));
  const noMonth = indexed.filter((x) => !MONTHS.includes((x.r.maand || "").toLowerCase()));

  const urenInGeld = budget.maandbudget - budget.linkbuilding;
  const beschikbareUren = budget.beschikbareUren || (budget.uurtarief ? Math.round((urenInGeld / budget.uurtarief) * 10) / 10 : 0);

  function MonthCard({ maand }: { maand: string }) {
    const items = indexed.filter((x) => (x.r.maand || "").toLowerCase() === maand);
    const minutes = items.reduce((s, x) => s + (Number(x.r.uren) || 0), 0);
    const urenBesteed = Math.round((minutes / 60) * 10) / 10;
    const resterend = Math.round((beschikbareUren - urenBesteed) * 10) / 10;
    const seo = items.filter((x) => (x.r.wie || "").toLowerCase() !== "dev");
    const dev = items.filter((x) => (x.r.wie || "").toLowerCase() === "dev");

    return (
      <div className="cockpit-card month-card">
        <div className="month-card-head"><span className="month-card-title">{maand}</span><span className="month-card-uren">{urenBesteed} uur</span></div>

        <Section label="SEO" rows={seo} maand={maand} wie="SEO" />
        <Section label="Developer" rows={dev} maand={maand} wie="Dev" />

        {budget.maandbudget > 0 && (
          <div className="budget-block">
            <div><span>Maandbudget</span><strong>&euro;{budget.maandbudget.toFixed(0)}</strong></div>
            <div><span>Budget linkbuilding</span><strong>&euro;{budget.linkbuilding.toFixed(0)}</strong></div>
            <div><span>Uren in geld</span><strong>&euro;{urenInGeld.toFixed(0)}</strong></div>
            <div><span>Beschikbare uren</span><strong>{beschikbareUren} u</strong></div>
            <div><span>Uren besteed</span><strong>{urenBesteed} u</strong></div>
            <div className={resterend < 0 ? "neg" : ""}><span>Resterende uren</span><strong>{resterend} u</strong></div>
          </div>
        )}
      </div>
    );
  }

  function Section({ label, rows: secRows, maand, wie }: { label: string; rows: { r: TaskRow; i: number }[]; maand: string; wie: string }) {
    return (
      <div className="task-section">
        <div className="task-section-head">{label}</div>
        <div className="res-table-wrap">
          <table className="task-table">
            <colgroup>
              <col style={{ width: "22px" }} />
              <col />
              <col />
              <col style={{ width: "52px" }} />
              <col style={{ width: "104px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "92px" }} />
              <col style={{ width: "30px" }} />
            </colgroup>
            <thead><tr><th></th><th>Taak</th><th>Toelichting</th><th>Uren</th><th>Status</th><th>Link</th><th title="Zichtbaar in klant-dashboard">Klant</th><th>Maand</th><th></th></tr></thead>
            <tbody>
              {secRows.map(({ r, i }) => (
                <tr key={i} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)} className={dragIdx === i ? "dragging" : ""}>
                  <td className="drag-handle" title="Sleep">⠿</td>
                  <td><input value={r.taak} onChange={(e) => update(i, { taak: e.target.value })} placeholder="Taak" /></td>
                  <td><input value={r.toelichting} onChange={(e) => update(i, { toelichting: e.target.value })} placeholder="Toelichting" /></td>
                  <td><input className="cell-num" type="number" value={r.uren ?? ""} onChange={(e) => update(i, { uren: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                  <td><select value={r.status} onChange={(e) => update(i, { status: e.target.value })}><option value="">—</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td><div className="cell-link"><input value={r.link} onChange={(e) => update(i, { link: e.target.value })} placeholder="https://..." />{r.link && <a href={r.link} target="_blank" rel="noreferrer">↗</a>}</div></td>
                  <td className="cell-check"><input type="checkbox" checked={r.klantZichtbaar} onChange={(e) => update(i, { klantZichtbaar: e.target.checked })} /></td>
                  <td><select value={r.maand} onChange={(e) => update(i, { maand: e.target.value })}><option value="">—</option>{MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                  <td><button type="button" className="row-del" onClick={() => removeRow(i)} title="Verwijderen">×</button></td>
                </tr>
              ))}
              {secRows.length === 0 && <tr><td colSpan={9} className="muted" style={{ padding: 8 }}>Geen {label}-taken.</td></tr>}
            </tbody>
          </table>
        </div>
        <button type="button" className="add-task-btn" onClick={() => addRow(maand, wie)}>+ {label}-taak</button>
      </div>
    );
  }

  return (
    <>
      <div className="cockpit-card">
        <div className="ck-section-head">
          <span>Werkzaamheden</span>
          <button type="button" className="primary-btn small" onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Alles opslaan"}</button>
        </div>
        {msg && <div className={msg.startsWith("Opgeslagen") ? "saved-msg" : "login-error"}>{msg}</div>}
        {rows.length === 0 && <div className="muted">Nog geen werkzaamheden.</div>}
        <div className="add-month-row">
          Nieuwe maand toevoegen:&nbsp;
          {MONTHS.filter((m) => !monthsPresent.includes(m)).map((m) => (
            <button key={m} type="button" className="add-month-btn" onClick={() => addRow(m, "SEO")}>{m}</button>
          ))}
        </div>
      </div>

      {monthsPresent.map((m) => <MonthCard key={m} maand={m} />)}

      {noMonth.length > 0 && (
        <div className="cockpit-card month-card">
          <div className="month-card-head"><span className="month-card-title">Zonder maand</span></div>
          <Section label="SEO" rows={noMonth.filter((x) => (x.r.wie || "").toLowerCase() !== "dev")} maand="" wie="SEO" />
          <Section label="Developer" rows={noMonth.filter((x) => (x.r.wie || "").toLowerCase() === "dev")} maand="" wie="Dev" />
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import type { TaskRow } from "../../../../lib/tasks";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const STATUSES = ["Te doen", "Bezig", "Gepland", "Klaar"];

type Budget = { maandbudget: number; linkbuilding: number; uurtarief: number; beschikbareUren: number };

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function TasksEditor({ slug, initialTasks, budget, clientName }: { slug: string; initialTasks: TaskRow[]; budget: Budget; clientName: string }) {
  const [rows, setRows] = useState<TaskRow[]>(initialTasks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // "Verstuur naar developer"
  const [showCompose, setShowCompose] = useState(false);
  const [devTo, setDevTo] = useState("");
  const [devNote, setDevNote] = useState("");
  const [devSel, setDevSel] = useState<Set<number>>(new Set());
  const [devBusy, setDevBusy] = useState(false);
  const [devMsg, setDevMsg] = useState("");

  const now = new Date();
  const curMonth = MONTHS[now.getMonth()];
  const nextMonth = MONTHS[(now.getMonth() + 1) % 12];
  // Standaard open: huidige + volgende maand (+ zonder-maand). Rest dicht.
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({ [curMonth]: true, [nextMonth]: true, "": true });
  const isOpen = (m: string) => openMonths[m] ?? false;
  const toggleMonth = (m: string) => setOpenMonths((o) => ({ ...o, [m]: !(o[m] ?? false) }));

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
      // Developer-taken zijn altijd intern (nooit zichtbaar in het klant-dashboard).
      const toSave = rows.map((r) => ((r.wie || "").toLowerCase() === "dev" ? { ...r, klantZichtbaar: false } : r));
      const res = await fetch("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tasks: toSave }) });
      const data = await res.json();
      setMsg(data.ok ? `Opgeslagen (${data.saved} taken).` : (data.error || "Opslaan mislukt."));
    } catch { setMsg("Opslaan mislukt."); } finally { setBusy(false); }
  }

  // Open het mail-venster. Zonder argument: alle open developer-taken voorgevinkt.
  // Met indices (de ✉-knop op een rij): precies die taak/taken voorgevinkt.
  function openComposeFor(idxs?: number[]) {
    const sel = idxs ?? rows.map((r, i) => ({ r, i })).filter((x) => (x.r.wie || "").toLowerCase() === "dev" && !DONE.test(x.r.status || "")).map((x) => x.i);
    setDevSel(new Set(sel));
    try { setDevTo(localStorage.getItem("pingwin-dev-email") || ""); } catch { setDevTo(""); }
    setDevNote(""); setDevMsg(""); setShowCompose(true);
  }
  function toggleDevSel(i: number) {
    setDevSel((s) => { const c = new Set(s); if (c.has(i)) c.delete(i); else c.add(i); return c; });
  }
  async function sendDev() {
    const selected = rows.map((r, i) => ({ r, i })).filter((x) => devSel.has(x.i)).map((x) => x.r);
    if (!devTo.trim() || selected.length === 0) { setDevMsg("Vul een ontvanger in en kies minstens één taak."); return; }
    const list = selected.map((t) =>
      `<li><strong>${esc(t.taak)}</strong>${t.maand ? ` <em>(${esc(t.maand)})</em>` : ""}${t.toelichting ? ` — ${esc(t.toelichting)}` : ""}${t.link ? ` — <a href="${esc(t.link)}">document</a>` : ""}</li>`,
    ).join("");
    const note = devNote.trim() ? `<p>${esc(devNote).replace(/\n/g, "<br>")}</p>` : "";
    const dashUrl = typeof window !== "undefined" ? `${window.location.origin}/admin/client/${slug}` : "";
    const dashLink = dashUrl ? `<p style="margin-top:14px;color:#555;font-size:13px">Bekijk deze taken in het dashboard: <a href="${esc(dashUrl)}">${esc(dashUrl)}</a></p>` : "";
    const html = `${note}<p><strong>Werkzaamheden:</strong></p><ul>${list}</ul>${dashLink}`;
    setDevBusy(true); setDevMsg("");
    try {
      const res = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to: devTo, subject: `Werkzaamheden — ${clientName}`, html }) });
      const data = await res.json();
      if (data.ok) {
        try { localStorage.setItem("pingwin-dev-email", devTo.trim()); } catch { /* ignore */ }
        setDevMsg(`Verstuurd naar ${(data.sentTo || []).join(", ") || devTo}.`);
        setTimeout(() => setShowCompose(false), 1400);
      } else setDevMsg(data.error || "Versturen mislukt.");
    } catch { setDevMsg("Versturen mislukt."); } finally { setDevBusy(false); }
  }

  const indexed = rows.map((r, i) => ({ r, i }));
  const monthsPresent = MONTHS.filter((m) => indexed.some((x) => (x.r.maand || "").toLowerCase() === m));
  const noMonth = indexed.filter((x) => !MONTHS.includes((x.r.maand || "").toLowerCase()));

  const urenInGeld = budget.maandbudget - budget.linkbuilding;
  const beschikbareUren = budget.beschikbareUren || (budget.uurtarief ? Math.round((urenInGeld / budget.uurtarief) * 10) / 10 : 0);

  // Render-functies (geen sub-componenten → geen remount, focus blijft behouden).
  function section(label: string, secRows: { r: TaskRow; i: number }[], maand: string, wie: string, showKlant: boolean) {
    const cols = showKlant ? 9 : 8;
    return (
      <div className="task-section">
        <div className="task-section-head">{label}</div>
        <div className="res-table-wrap">
          <table className="task-table">
            <colgroup>
              <col style={{ width: "22px" }} /><col /><col />
              <col style={{ width: "66px" }} /><col style={{ width: "104px" }} /><col style={{ width: "160px" }} />
              {showKlant && <col style={{ width: "62px" }} />}<col style={{ width: "92px" }} /><col style={{ width: "56px" }} />
            </colgroup>
            <thead><tr><th></th><th>Taak</th><th>Toelichting</th><th>Uren</th><th>Status</th><th>Link</th>{showKlant && <th title="Zichtbaar in klant-dashboard">Klant</th>}<th>Maand</th><th></th></tr></thead>
            <tbody>
              {secRows.map(({ r, i }) => (
                <tr key={i} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)} className={dragIdx === i ? "dragging" : ""}>
                  <td className="drag-handle" title="Sleep">⠿</td>
                  <td><input value={r.taak} onChange={(e) => update(i, { taak: e.target.value })} placeholder="Taak" /></td>
                  <td><input value={r.toelichting} onChange={(e) => update(i, { toelichting: e.target.value })} placeholder="Toelichting" /></td>
                  <td><input className="cell-num" type="number" value={r.uren ?? ""} onChange={(e) => update(i, { uren: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                  <td><select value={r.status} onChange={(e) => update(i, { status: e.target.value })}><option value="">—</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td><div className="cell-link"><input value={r.link} onChange={(e) => update(i, { link: e.target.value })} placeholder="https://..." />{r.link && <a href={r.link} target="_blank" rel="noreferrer">↗</a>}</div></td>
                  {showKlant && <td className="cell-check"><input type="checkbox" checked={r.klantZichtbaar} onChange={(e) => update(i, { klantZichtbaar: e.target.checked })} /></td>}
                  <td><select value={r.maand} onChange={(e) => update(i, { maand: e.target.value })}><option value="">—</option>{MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                  <td className="row-actions">
                    <button type="button" className="row-send" onClick={() => openComposeFor([i])} title="Naar developer mailen">✉</button>
                    <button type="button" className="row-del" onClick={() => removeRow(i)} title="Verwijderen">×</button>
                  </td>
                </tr>
              ))}
              {secRows.length === 0 && <tr><td colSpan={cols} className="muted" style={{ padding: 8 }}>Geen {label}-taken.</td></tr>}
            </tbody>
          </table>
        </div>
        <button type="button" className="add-task-btn" onClick={() => addRow(maand, wie)}>+ {label}-taak</button>
      </div>
    );
  }

  // Compact budget-overzicht, horizontaal, bedoeld rechts van de maandnaam.
  function budgetInline(urenBesteed: number, urenGepland: number) {
    if (budget.maandbudget <= 0) {
      return <span className="month-card-uren">{urenBesteed} u besteed · {urenGepland} u gepland</span>;
    }
    const resterend = Math.round((beschikbareUren - urenBesteed) * 10) / 10;
    return (
      <div className="budget-inline">
        <div><span>Maandbudget</span><strong>&euro;{budget.maandbudget.toFixed(0)}</strong></div>
        <div><span>Budget linkbuilding</span><strong>&euro;{budget.linkbuilding.toFixed(0)}</strong></div>
        <div><span>Uren in geld</span><strong>&euro;{urenInGeld.toFixed(0)}</strong></div>
        <div><span>Beschikbare uren</span><strong>{beschikbareUren} u</strong></div>
        <div><span>Uren gepland</span><strong>{urenGepland} u</strong></div>
        <div><span>Uren besteed</span><strong>{urenBesteed} u</strong></div>
        <div className={resterend < 0 ? "neg" : ""}><span>Resterende uren</span><strong>{resterend} u</strong></div>
      </div>
    );
  }

  const DONE = /klaar|afgerond|gereed|done|voltooid/i;
  function monthCard(maand: string, label: string, items: { r: TaskRow; i: number }[]) {
    const doneMin = items.filter((x) => DONE.test(x.r.status || "")).reduce((s, x) => s + (Number(x.r.uren) || 0), 0);
    const planMin = items.filter((x) => !DONE.test(x.r.status || "")).reduce((s, x) => s + (Number(x.r.uren) || 0), 0);
    const urenBesteed = Math.round((doneMin / 60) * 10) / 10;
    const urenGepland = Math.round((planMin / 60) * 10) / 10;
    const open = isOpen(maand);
    const seo = items.filter((x) => (x.r.wie || "").toLowerCase() !== "dev");
    const dev = items.filter((x) => (x.r.wie || "").toLowerCase() === "dev");
    return (
      <div className="cockpit-card month-card" key={maand || "none"}>
        <div className="month-card-head clickable" onClick={() => toggleMonth(maand)}>
          <span className="month-card-title">{label} <span className="month-caret">{open ? "▾" : "▸"}</span> <span className="month-card-count">({items.length})</span></span>
          {budgetInline(urenBesteed, urenGepland)}
        </div>
        {open && (
          <div className="month-cards">
            <div className="task-card seo-card">{section("SEO", seo, maand, "SEO", true)}</div>
            <div className="task-card dev-card">{section("Developer", dev, maand, "Dev", false)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="cockpit-card">
        <div className="ck-section-head">
          <span>Werkzaamheden</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="logout-btn" onClick={() => openComposeFor()}>✉ Naar developer</button>
            <button type="button" className="primary-btn small" onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Alles opslaan"}</button>
          </span>
        </div>
        {msg && <div className={msg.startsWith("Opgeslagen") ? "saved-msg" : "login-error"}>{msg}</div>}
        {rows.length === 0 && <div className="muted">Nog geen werkzaamheden.</div>}
        <div className="add-month-row">
          Nieuwe maand toevoegen:&nbsp;
          {MONTHS.filter((m) => !monthsPresent.includes(m)).map((m) => (
            <button key={m} type="button" className="add-month-btn" onClick={() => { addRow(m, "SEO"); setOpenMonths((o) => ({ ...o, [m]: true })); }}>{m}</button>
          ))}
        </div>
      </div>

      {(() => {
        const top = [curMonth, nextMonth].filter((m) => monthsPresent.includes(m));
        const past = monthsPresent.filter((m) => !top.includes(m)).sort((a, b) => MONTHS.indexOf(b) - MONTHS.indexOf(a));
        const card = (m: string, label: string) => monthCard(m, label, indexed.filter((x) => (x.r.maand || "").toLowerCase() === m));
        return (
          <>
            {top.map((m) => card(m, m))}
            {noMonth.length > 0 && monthCard("", "Zonder maand", noMonth)}
            {past.map((m) => card(m, m))}
          </>
        );
      })()}

      {showCompose && (
        <div className="compose-overlay" onClick={() => setShowCompose(false)}>
          <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-head"><span>Werkzaamheden naar developer</span><button type="button" className="chat-float-close" onClick={() => setShowCompose(false)}>&times;</button></div>
            <div className="compose-body">
              <label className="compose-label">Aan (e-mail developer)</label>
              <input className="compose-input" value={devTo} onChange={(e) => setDevTo(e.target.value)} placeholder="tonny@..." />
              <label className="compose-label">Bericht (optioneel)</label>
              <textarea className="compose-input" rows={3} value={devNote} onChange={(e) => setDevNote(e.target.value)} placeholder="Korte begeleidende tekst..." />
              <label className="compose-label">Taken (vink aan wat mee moet)</label>
              <div className="compose-list">
                {rows.map((r, i) => (r.wie || "").toLowerCase() === "dev" ? (
                  <label key={i} className="compose-item">
                    <input type="checkbox" checked={devSel.has(i)} onChange={() => toggleDevSel(i)} />
                    <span>{r.maand ? <em>[{r.maand}] </em> : ""}{r.taak || "(leeg)"}{r.status ? ` — ${r.status}` : ""}</span>
                  </label>
                ) : null)}
                {!rows.some((r) => (r.wie || "").toLowerCase() === "dev") && <div className="muted">Geen developer-taken.</div>}
              </div>
              {devMsg && <div className={devMsg.startsWith("Verstuurd") ? "saved-msg" : "login-error"} style={{ marginTop: 8 }}>{devMsg}</div>}
            </div>
            <div className="compose-foot">
              <button type="button" className="logout-btn" onClick={() => setShowCompose(false)}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={sendDev} disabled={devBusy}>{devBusy ? "Versturen..." : "Verstuur per mail"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DevTask } from "../../../lib/developer";

// Verwijdert scripts/handlers/inline font-kleur uit opgeslagen taak-HTML, houdt
// links en basis-opmaak. De inhoud is bij invoer al geschoond; dit is de vangnet.
function safeHtml(html: string): string {
  return (html || "")
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\s*(?:color|font-size|font-family|background(?:-color)?)\s*:[^;"]+;?/gi, "")
    .replace(/\s*style=""\s*/gi, " ");
}

const DONE = /klaar|afgerond|gereed|done|voltooid/i;
function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const cls = DONE.test(s) ? "klaar" : s.includes("bezig") ? "bezig" : "gepland";
  const label = DONE.test(s) ? "Klaar" : s.includes("bezig") ? "Bezig" : (status || "Gepland");
  return <span className={`badge-done ${cls}`}>{label}</span>;
}

type Row = DevTask;

const WEEKDAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Maandag van de week met de gegeven week-offset (0 = deze week).
function mondayOf(offsetWeeks: number): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = maandag
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  return d;
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function stripText(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export default function DeveloperOverview({ initialTasks, embedded }: { initialTasks?: DevTask[]; embedded?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialTasks ?? []);
  const rowsRef = useRef<Row[]>(initialTasks ?? []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(!initialTasks);
  const [view, setView] = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragTaskIdx, setDragTaskIdx] = useState<number | null>(null);

  // Ingebed in de cockpit: laad de dev-taken zelf (geen server-props).
  useEffect(() => {
    if (initialTasks) return;
    let off = false;
    fetch("/api/admin/developer")
      .then((r) => r.json())
      .then((d) => { if (!off && d.ok) { setRows(d.tasks); rowsRef.current = d.tasks; } })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [initialTasks]);

  function commit(next: Row[]) {
    rowsRef.current = next;
    setRows(next);
    triggerSave();
  }

  function triggerSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving("idle");
    saveTimerRef.current = setTimeout(async () => {
      setSaving("saving");
      try {
        const items = rowsRef.current.map((r) => ({ clientSlug: r.clientSlug, taskKey: r.taskKey, execDate: r.execDate || "" }));
        const res = await fetch("/api/admin/developer", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
        });
        const d = await res.json();
        if (d.ok) { setSaving("saved"); setTimeout(() => setSaving("idle"), 2500); } else setSaving("idle");
      } catch { setSaving("idle"); }
    }, 800);
  }

  function setDate(i: number, date: string) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, execDate: date } : r)));
  }

  function moveTo(beforeIdx: number) {
    if (dragIdx === null || dragIdx === beforeIdx) return;
    // Alleen binnen dezelfde klant herordenen (taken horen bij hun klant).
    if (rows[dragIdx]?.clientSlug !== rows[beforeIdx]?.clientSlug) { setDragIdx(null); return; }
    const c = [...rows];
    const [moved] = c.splice(dragIdx, 1);
    const ins = beforeIdx > dragIdx ? beforeIdx - 1 : beforeIdx;
    c.splice(ins, 0, moved);
    setDragIdx(null);
    commit(c);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const saveLabel = saving === "saving" ? "Opslaan..." : saving === "saved" ? "✓ Opgeslagen" : "";

  // Groepeer de taken per klant (de array is al per klant gesorteerd).
  const groups: { clientSlug: string; clientName: string; items: { r: Row; idx: number }[] }[] = [];
  rows.forEach((r, idx) => {
    let g = groups.find((g) => g.clientSlug === r.clientSlug);
    if (!g) { g = { clientSlug: r.clientSlug, clientName: r.clientName, items: [] }; groups.push(g); }
    g.items.push({ r, idx });
  });

  // Weekplanning: taken per uitvoerdatum + de nog niet ingeplande taken.
  const weekStart = mondayOf(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const todayIso = isoOf(new Date());
  const tasksByDay = new Map<string, { r: Row; idx: number }[]>();
  rows.forEach((r, idx) => { if (r.execDate) { if (!tasksByDay.has(r.execDate)) tasksByDay.set(r.execDate, []); tasksByDay.get(r.execDate)!.push({ r, idx }); } });
  const undated = rows.map((r, idx) => ({ r, idx })).filter((x) => !x.r.execDate);

  const taskCard = (r: Row, idx: number) => (
    <div key={r.clientSlug + "|" + r.taskKey} className="dev-task-card" draggable
      onDragStart={() => setDragTaskIdx(idx)} onDragEnd={() => setDragTaskIdx(null)} title={stripText(r.taak)}>
      <div className="dev-task-client">{r.clientName}</div>
      <div className="dev-task-desc">{stripText(r.taak)}</div>
    </div>
  );

  const content = (
    <>
        <div className="section-title">
          Taken voor de developer ({rows.length})
          {saveLabel && <span className="focus-save-status" style={{ marginLeft: 12 }}>{saveLabel}</span>}
          <span className="dev-view-toggle">
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Lijst per klant</button>
            <button type="button" className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Weekplanning</button>
          </span>
        </div>
        <p className="dev-intro">
          {view === "list"
            ? "Per klant de taken die op status “Naar Dev” staan. Sleep een taak binnen een klant om de prioriteit te bepalen en zet per taak een uitvoerdatum."
            : "Sleep taken naar een dag om ze in te plannen. De datum blijft bewaard (dezelfde als de uitvoerdatum in de lijst)."}
        </p>
        {loading && <p className="muted">Taken laden…</p>}
        {!loading && rows.length === 0 && (
          <p className="muted">Nog geen taken op &ldquo;Naar Dev&rdquo;. Zet in een klant-cockpit een taak op status &ldquo;Naar Dev&rdquo;.</p>
        )}

        {view === "week" && rows.length > 0 && (
          <div className="cockpit-card dev-week">
            <div className="dev-week-nav">
              <button type="button" onClick={() => setWeekOffset((w) => w - 1)}>&larr; Vorige</button>
              <span className="dev-week-label">Week van {weekStart.getDate()} {MONTHS_SHORT[weekStart.getMonth()]} {weekStart.getFullYear()}</span>
              <button type="button" onClick={() => setWeekOffset(0)}>Deze week</button>
              <button type="button" onClick={() => setWeekOffset((w) => w + 1)}>Volgende &rarr;</button>
            </div>
            <div className="dev-week-grid">
              {weekDays.map((d, i) => {
                const iso = isoOf(d);
                const items = tasksByDay.get(iso) || [];
                return (
                  <div key={iso} className={"dev-day" + (iso === todayIso ? " today" : "")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragTaskIdx !== null) { setDate(dragTaskIdx, iso); setDragTaskIdx(null); } }}>
                    <div className="dev-day-head">{WEEKDAYS[i]}<span>{d.getDate()} {MONTHS_SHORT[d.getMonth()]}</span></div>
                    <div className="dev-day-body">{items.map(({ r, idx }) => taskCard(r, idx))}</div>
                  </div>
                );
              })}
            </div>
            <div className="dev-pool" onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragTaskIdx !== null) { setDate(dragTaskIdx, ""); setDragTaskIdx(null); } }}>
              <div className="dev-pool-head">Nog niet ingepland ({undated.length}) — sleep naar een dag</div>
              <div className="dev-pool-body">
                {undated.map(({ r, idx }) => taskCard(r, idx))}
                {undated.length === 0 && <div className="muted">Alles is ingepland.</div>}
              </div>
            </div>
          </div>
        )}

        {view === "list" && groups.map((g) => (
          <div className="cockpit-card dev-client-card" key={g.clientSlug}>
            <div className="dev-client-card-head">{g.clientName} <span className="dev-client-count">({g.items.length})</span></div>
            <div className="task-table-wrap">
              <table className="task-table dev-table">
                <colgroup>
                  <col style={{ width: "22px" }} />
                  <col />
                  <col />
                  <col style={{ width: "104px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "60px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th></th>
                    <th>Taak</th>
                    <th>Opm. developer</th>
                    <th>Status</th>
                    <th>Uitvoerdatum</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(({ r, idx }) => {
                    const isUrl = r.link && /^https?:\/\//i.test(r.link.trim());
                    return (
                      <tr
                        key={r.clientSlug + "|" + r.taskKey}
                        className={dragIdx === idx ? "dragging" : ""}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.stopPropagation(); moveTo(idx); }}
                      >
                        <td className="drag-handle" draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => setDragIdx(null)} title="Sleep om de prioriteit te wijzigen">⠿</td>
                        <td><span className="dev-cell" dangerouslySetInnerHTML={{ __html: safeHtml(r.taak) }} /></td>
                        <td><span className="dev-cell dev-muted" dangerouslySetInnerHTML={{ __html: safeHtml(r.toelichting) }} /></td>
                        <td>{statusBadge(r.status)}</td>
                        <td><input type="date" className="dev-date" value={r.execDate || ""} onChange={(e) => setDate(idx, e.target.value)} /></td>
                        <td>{isUrl ? <a href={r.link.trim()} target="_blank" rel="noreferrer" className="doc-link">Open</a> : <span className="muted">&mdash;</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </>
  );

  // Ingebed in de cockpit: alleen de inhoud (de topbar komt van de cockpit zelf).
  if (embedded) return content;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <a href="/admin" className="logo-link" title="Naar het klantenoverzicht">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <div className="header-client">Developer Overview</div>
          </div>
        </div>
        <div className="header-right">
          <a className="logout-btn" href="/admin">&larr; Alle klanten</a>
          <button className="logout-btn" onClick={logout} style={{ marginLeft: 8 }}>Uitloggen</button>
        </div>
      </div>

      <div className="container">{content}</div>

      <div className="footer">Pingwin Online Marketing &middot; Developer Overview</div>
    </>
  );
}

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

export default function DeveloperOverview({ initialTasks, embedded }: { initialTasks?: DevTask[]; embedded?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialTasks ?? []);
  const rowsRef = useRef<Row[]>(initialTasks ?? []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(!initialTasks);

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

  const content = (
    <>
        <div className="section-title">
          Taken voor de developer ({rows.length})
          {saveLabel && <span className="focus-save-status" style={{ marginLeft: 12 }}>{saveLabel}</span>}
        </div>
        <p className="dev-intro">
          Per klant de taken die op status &ldquo;Naar Dev&rdquo; staan. Sleep een taak binnen een klant omhoog of
          omlaag om de prioriteit te bepalen en zet per taak een uitvoerdatum. Volgorde en datum blijven staan.
        </p>
        {loading && <p className="muted">Taken laden…</p>}
        {!loading && rows.length === 0 && (
          <p className="muted">Nog geen taken op &ldquo;Naar Dev&rdquo;. Zet in een klant-cockpit een taak op status &ldquo;Naar Dev&rdquo;.</p>
        )}

        {groups.map((g) => (
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

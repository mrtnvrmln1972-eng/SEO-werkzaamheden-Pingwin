"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DevTask } from "../../../lib/developer";
import RijkTekstVeld from "../../_velden/RijkTekstVeld";
import OntwikkelMenu from "../OntwikkelMenu";
import Tellers from "../Tellers";
import MeldingenMenu from "../MeldingenMenu";

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
const MAARTEN_EMAIL = "maarten@pingwin.nl";

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

export default function DeveloperOverview({ initialTasks, embedded, slug, clientName }: {
  initialTasks?: DevTask[];
  embedded?: boolean;
  /** Ingebed in één klant: nieuwe taken landen bij die klant en zijn groep staat bovenaan. */
  slug?: string;
  clientName?: string;
}) {
  const router = useRouter();
  // Dit scherm toont ALTIJD alle klanten, ook als het in de cockpit van één klant
  // hangt: het is het overzicht dat Maarten met de developer deelt, en die werkt
  // over klanten heen. Wat de klant-cockpit toevoegt is alleen dat een nieuwe taak
  // vanzelf bij díe klant landt en dat zijn groep bovenaan staat.
  const [rows, setRows] = useState<Row[]>(initialTasks ?? []);
  const rowsRef = useRef<Row[]>(initialTasks ?? []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(!initialTasks);
  const [view, setView] = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragTaskIdx, setDragTaskIdx] = useState<number | null>(null);
  // Terugkoppeling-popup bij het afvinken van een taak als klaar.
  const [feedbackFor, setFeedbackFor] = useState<number | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  // Het taakvenster: een bestaande taak bewerken, of een nieuwe taak aanmaken
  // bij een klant (dan staat er geen taak in, alleen de klant).
  const [venster, setVenster] = useState<{ taak: Row | null; clientSlug: string; clientName: string } | null>(null);
  // Welke klanten hun "Afgerond"-blok hebben opengeklapt. Standaard dicht: dat
  // is nou juist het archief, dat hoeft niet standaard in beeld te staan.
  const [afgerondOpen, setAfgerondOpen] = useState<Record<string, boolean>>({});

  // Na aanmaken, bewerken of weggooien komt de hele lijst terug van de server.
  function zetLijst(list: DevTask[]) {
    rowsRef.current = list;
    setRows(list);
  }

  // Opent de mailclient met een kant-en-klare terugkoppeling aan Maarten.
  function mailMaarten(r: Row, note: string) {
    const subject = `Terugkoppeling dev-taak: ${stripText(r.taak).slice(0, 80)} (${r.clientName})`;
    const lines = [`Klant: ${r.clientName}`, `Taak: ${stripText(r.taak)}`];
    if (r.link && /^https?:/i.test(r.link)) lines.push(`Pagina: ${r.link}`);
    for (const d of r.docs || []) lines.push(`${d.label}: ${d.url}`);
    lines.push("", `Terugkoppeling: ${note || ""}`);
    window.location.href = `mailto:${MAARTEN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  // Slaat de developer-status (klaar + terugkoppeling) van één taak op. Raakt de
  // volgorde/uitvoerdatum niet aan.
  function applyStatus(idx: number, done: boolean, note: string) {
    const r = rowsRef.current[idx];
    if (!r) return;
    // Afvinken zet de echte status op 'Klaar' (of terug naar 'Naar Dev').
    const status = done ? "Klaar" : "Naar Dev";
    const next = rowsRef.current.map((x, i) => (i === idx ? { ...x, devDone: done, devNote: note, status } : x));
    rowsRef.current = next; setRows(next);
    fetch("/api/admin/developer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", clientSlug: r.clientSlug, taskKey: r.taskKey, done, note }) }).catch(() => {});
  }
  function toggleDone(idx: number, checked: boolean) {
    if (checked) { setFeedbackFor(idx); setFeedbackNote(rows[idx]?.devNote || ""); }
    else applyStatus(idx, false, rows[idx]?.devNote || "");
  }
  function confirmDone(alsoMail: boolean) {
    if (feedbackFor === null) return;
    const idx = feedbackFor; const r = rows[idx];
    // Status op 'Klaar' + afgevinkt; de taak blijft groen zichtbaar in het overzicht.
    applyStatus(idx, true, feedbackNote);
    if (alsoMail && r) mailMaarten(r, feedbackNote);
    setFeedbackFor(null); setFeedbackNote("");
  }

  // Maartens eigen vinkje: los van wat de developer al deed, bevestigt hij
  // hiermee dat een taak echt klaar is. De taak verhuist dan naar het
  // dichtgeklapte "Afgerond"-blok van die klant; ontvinken zet hem weer terug.
  function toggleAfgerond(idx: number, checked: boolean) {
    const r = rowsRef.current[idx];
    if (!r) return;
    const next = rowsRef.current.map((x, i) => (i === idx ? { ...x, ownerDone: checked } : x));
    rowsRef.current = next; setRows(next);
    fetch("/api/admin/developer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "afgerond", clientSlug: r.clientSlug, taskKey: r.taskKey, done: checked }) }).catch(() => {});
  }

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

  // Taken die Maarten zelf al heeft afgerond tellen niet meer mee als openstaand
  // werk; ze staan alleen nog in het Afgerond-blok van hun klant.
  const activeRows = rows.filter((r) => !r.ownerDone);

  // Groepeer de taken per klant (de array is al per klant gesorteerd), open en
  // afgerond apart: open staat in de gewone tabel, afgerond in het archiefje.
  const groups: { clientSlug: string; clientName: string; items: { r: Row; idx: number }[]; afgerond: { r: Row; idx: number }[] }[] = [];
  rows.forEach((r, idx) => {
    let g = groups.find((g) => g.clientSlug === r.clientSlug);
    if (!g) { g = { clientSlug: r.clientSlug, clientName: r.clientName, items: [], afgerond: [] }; groups.push(g); }
    (r.ownerDone ? g.afgerond : g.items).push({ r, idx });
  });
  // Afgevinkte (klaar) taken onderaan per klant; de rest houdt zijn volgorde.
  groups.forEach((g) => g.items.sort((a, b) => (a.r.devDone ? 1 : 0) - (b.r.devDone ? 1 : 0)));
  // Sta je in de cockpit van een klant, dan staat díe klant bovenaan. De rest blijft
  // gewoon staan: dit is en blijft het overzicht over alle klanten heen.
  if (slug) groups.sort((a, b) => (a.clientSlug === slug ? -1 : 0) - (b.clientSlug === slug ? -1 : 0));

  // Weekplanning: taken per uitvoerdatum + de nog niet ingeplande taken. Zelf
  // afgeronde taken horen niet meer op het bord.
  const weekStart = mondayOf(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const todayIso = isoOf(new Date());
  const tasksByDay = new Map<string, { r: Row; idx: number }[]>();
  rows.forEach((r, idx) => { if (r.ownerDone) return; if (r.execDate) { if (!tasksByDay.has(r.execDate)) tasksByDay.set(r.execDate, []); tasksByDay.get(r.execDate)!.push({ r, idx }); } });
  const undated = rows.map((r, idx) => ({ r, idx })).filter((x) => !x.r.ownerDone && !x.r.execDate);

  const taskCard = (r: Row, idx: number) => (
    <div key={r.clientSlug + "|" + r.taskKey} className={"dev-task-card " + (r.devDone ? "dev-done" : "dev-todo")}>
      <div className="dev-task-top">
        {/* Alleen het handvat sleept; de kaarttekst blijft selecteerbaar/kopieerbaar. */}
        <span className="drag-handle" draggable onDragStart={() => setDragTaskIdx(idx)} onDragEnd={() => setDragTaskIdx(null)} title="Sleep naar een dag">⠿</span>
        <span className="dev-task-client">{r.clientName}</span>
        {r.fase && <span className="dev-task-fase">{r.fase}</span>}
      </div>
      <div className="dev-task-desc" dangerouslySetInnerHTML={{ __html: safeHtml(r.taak) }} />
      {stripText(r.toelichting) && <div className="dev-task-note" dangerouslySetInnerHTML={{ __html: safeHtml(r.toelichting) }} />}
      <div className="dev-task-meta">
        {statusBadge(r.status)}
        {r.uren ? <span className="dev-task-uren">{r.uren} min</span> : null}
        {r.link && /^https?:/i.test(r.link) ? <a href={r.link} target="_blank" rel="noreferrer" className="dev-task-doc" onClick={(e) => e.stopPropagation()}>pagina ↗</a> : null}
      </div>
      {/* De documenten die bij deze taak horen. Een opdracht als "zet de nieuwe
          copy live" zonder de copy erbij is geen opdracht; dan moet de
          sitebouwer alsnog gaan mailen. */}
      {r.docs && r.docs.length > 0 && (
        <div className="dev-task-docs" onClick={(e) => e.stopPropagation()}>
          {r.docs.map((d) => (
            <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="dev-doc-link">{d.label}</a>
          ))}
        </div>
      )}
      <div className="dev-task-actions" onClick={(e) => e.stopPropagation()}>
        <label className="dev-check-label"><input type="checkbox" checked={r.devDone} onChange={(e) => toggleDone(idx, e.target.checked)} /> Klaar</label>
        <label className="dev-check-label dev-check-afgerond"><input type="checkbox" checked={r.ownerDone} onChange={(e) => toggleAfgerond(idx, e.target.checked)} /> Afgerond</label>
        <button type="button" className="ghost-btn small" onClick={() => setVenster({ taak: r, clientSlug: r.clientSlug, clientName: r.clientName })} title="Taak, opmerking en documenten aanpassen">✎ Bewerk</button>
        <button type="button" className="ghost-btn small dev-mail-btn" onClick={() => mailMaarten(r, r.devNote)}>✉ Mail Maarten</button>
      </div>
    </div>
  );

  // Kop + kolombreedtes van de taaktabel; open en Afgerond-tabel delen dezelfde vorm.
  const devTableHead = (
    <>
      <colgroup>
        <col style={{ width: "22px" }} />
        <col />
        <col />
        <col style={{ width: "150px" }} />
        <col style={{ width: "72px" }} />
        <col style={{ width: "80px" }} />
        <col style={{ width: "150px" }} />
        <col style={{ width: "190px" }} />
      </colgroup>
      <thead>
        <tr>
          <th></th>
          <th>Taak</th>
          <th>Opm. developer</th>
          <th>Documenten</th>
          <th className="col-center">Klaar</th>
          <th className="col-center">Afgerond</th>
          <th>Uitvoerdatum</th>
          <th></th>
        </tr>
      </thead>
    </>
  );

  // Eén rij van de taaktabel. Slepen (prioriteit wijzigen) kan alleen in de
  // open lijst; het Afgerond-archief staat vast, daar hoeft niets herordend.
  const devRow = (r: Row, idx: number, sleepbaar: boolean) => (
    <tr
      key={r.clientSlug + "|" + r.taskKey}
      className={(dragIdx === idx ? "dragging " : "") + (r.devDone ? "dev-done" : "dev-todo")}
      onDragOver={sleepbaar ? (e) => e.preventDefault() : undefined}
      onDrop={sleepbaar ? (e) => { e.stopPropagation(); moveTo(idx); } : undefined}
    >
      <td className="drag-handle" draggable={sleepbaar} onDragStart={sleepbaar ? () => setDragIdx(idx) : undefined} onDragEnd={sleepbaar ? () => setDragIdx(null) : undefined} title={sleepbaar ? "Sleep om de prioriteit te wijzigen" : undefined}>{sleepbaar ? "⠿" : ""}</td>
      <td><span className="dev-cell" dangerouslySetInnerHTML={{ __html: safeHtml(r.taak) }} /></td>
      <td><span className="dev-cell dev-muted" dangerouslySetInnerHTML={{ __html: safeHtml(r.toelichting) }} /></td>
      <td>
        {r.docs && r.docs.length > 0 ? (
          <span className="dev-task-docs">
            {r.docs.map((d) => (
              <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="dev-doc-link" onClick={(e) => e.stopPropagation()}>{d.label}</a>
            ))}
          </span>
        ) : <span className="muted">&mdash;</span>}
      </td>
      <td className="col-center"><button type="button" className={"dev-done-toggle" + (r.devDone ? " on" : "")} onClick={(e) => { e.stopPropagation(); toggleDone(idx, !r.devDone); }} title={r.devDone ? "Gereed (klik om terug te zetten)" : "Afvinken als klaar"}>{r.devDone ? "☑" : "☐"}</button></td>
      <td className="col-center"><button type="button" className={"dev-done-toggle dev-afgerond-toggle-cell" + (r.ownerDone ? " on" : "")} onClick={(e) => { e.stopPropagation(); toggleAfgerond(idx, !r.ownerDone); }} title={r.ownerDone ? "Afgerond (klik om terug naar open te zetten)" : "Zelf afronden"}>{r.ownerDone ? "☑" : "☐"}</button></td>
      <td><input type="date" className="dev-date" value={r.execDate || ""} onChange={(e) => setDate(idx, e.target.value)} /></td>
      <td className="dev-rij-acties">
        <button type="button" className="ghost-btn small" onClick={(e) => { e.stopPropagation(); setVenster({ taak: r, clientSlug: r.clientSlug, clientName: r.clientName }); }} title="Taak, opmerking en documenten aanpassen">✎ Bewerk</button>
        <button type="button" className="ghost-btn small dev-mail-btn" onClick={(e) => { e.stopPropagation(); mailMaarten(r, r.devNote); }}>✉ Mail</button>
      </td>
    </tr>
  );

  const content = (
    <>
        <div className="section-title">
          Taken voor de developer ({activeRows.length})
          {saveLabel && <span className="focus-save-status" style={{ marginLeft: "var(--s-3)" }}>{saveLabel}</span>}
          <span className="dev-view-toggle">
            {slug && (
              <button type="button" className="dev-nieuw-btn" onClick={() => setVenster({ taak: null, clientSlug: slug, clientName: clientName || slug })}>+ Nieuwe taak</button>
            )}
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Lijst per klant</button>
            <button type="button" className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Weekplanning</button>
          </span>
        </div>
        <p className="dev-intro">
          {view === "list"
            ? "Alle klanten bij elkaar: de taken die op status “Naar Dev” staan, plus de taken die je zelf aanmaakt. Sleep een taak binnen een klant om de prioriteit te bepalen, zet een uitvoerdatum, en open “Bewerk” om de opdracht, de opmerking en de documenten (ook een zip) bij te werken. Vink zelf “Afgerond” aan om een taak naar het archief van die klant te verplaatsen, los van het vinkje van de developer."
            : "Sleep taken naar een dag om ze in te plannen. De datum blijft bewaard (dezelfde als de uitvoerdatum in de lijst)."}
        </p>
        {loading && <p className="muted">Taken laden…</p>}
        {!loading && rows.length === 0 && (
          <p className="muted">
            Nog geen taken op &ldquo;Naar Dev&rdquo;. Zet een kaart in de weekplanning door naar de developer, of maak hier zelf een taak aan
            {slug ? " met de knop “Nieuwe taak” hierboven." : " met de knop “Taak” bij een klant."}
          </p>
        )}
        {!loading && rows.length > 0 && activeRows.length === 0 && (
          <p className="muted">Alle taken zijn afgerond. Klap “Afgerond” open bij een klant hieronder om ze terug te zien.</p>
        )}

        {view === "week" && activeRows.length > 0 && (
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
            <div className="dev-client-card-head">
              {g.clientName} <span className="dev-client-count">({g.items.length})</span>
              <button type="button" className="dev-nieuw-btn" onClick={() => setVenster({ taak: null, clientSlug: g.clientSlug, clientName: g.clientName })}>+ Taak</button>
            </div>
            {g.items.length > 0 ? (
              <div className="task-table-wrap">
                <table className="task-table dev-table">
                  {devTableHead}
                  <tbody>{g.items.map(({ r, idx }) => devRow(r, idx, true))}</tbody>
                </table>
              </div>
            ) : (
              <p className="muted dev-niets-open">Niets open voor deze klant.</p>
            )}
            {g.afgerond.length > 0 && (
              <div className="dev-afgerond-blok">
                <button
                  type="button"
                  className="dev-afgerond-knop"
                  onClick={() => setAfgerondOpen((o) => ({ ...o, [g.clientSlug]: !o[g.clientSlug] }))}
                >
                  <span className={"dev-afgerond-pijl" + (afgerondOpen[g.clientSlug] ? " open" : "")}>▸</span>
                  Afgerond ({g.afgerond.length})
                </button>
                {afgerondOpen[g.clientSlug] && (
                  <div className="task-table-wrap dev-afgerond-tabel">
                    <table className="task-table dev-table">
                      {devTableHead}
                      <tbody>{g.afgerond.map(({ r, idx }) => devRow(r, idx, false))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {venster && (
          <TaakVenster
            taak={venster.taak}
            clientSlug={venster.clientSlug}
            clientName={venster.clientName}
            onLijst={zetLijst}
            onSluiten={() => setVenster(null)}
          />
        )}

        {feedbackFor !== null && rows[feedbackFor] && (
          <div className="compose-overlay">
            <div className="compose-modal">
              <div className="compose-head"><span>Taak afronden</span><button type="button" className="chat-float-close" onClick={() => setFeedbackFor(null)}>&times;</button></div>
              <div className="compose-body">
                <div className="muted" style={{ marginBottom: "var(--s-2)" }}>{rows[feedbackFor].clientName}: {stripText(rows[feedbackFor].taak)}</div>
                <label className="compose-label">Opmerkingen of terugkoppeling (optioneel)</label>
                <textarea className="compose-input" style={{ minHeight: 120, resize: "vertical" }} value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} placeholder="Wat is er gedaan, aandachtspunten, vragen voor Maarten…" />
                {/* Mailen was hiervoor de enige manier om te laten weten dat iets af
                    was. Dat hoeft niet meer: opslaan zet meteen een melding in
                    Maartens dashboard, met deze terugkoppeling erbij. */}
                <p className="muted" style={{ marginTop: "var(--s-2)", marginBottom: "var(--s-0)" }}>
                  Maarten krijgt hier vanzelf een melding van in zijn dashboard, met wat je hierboven
                  schrijft. Mailen hoeft alleen nog als je echt antwoord nodig hebt.
                </p>
              </div>
              <div className="compose-foot">
                <button type="button" className="logout-btn" onClick={() => setFeedbackFor(null)}>Annuleren</button>
                <button type="button" className="ghost-btn small" onClick={() => confirmDone(true)}>Opslaan + ook mailen</button>
                <button type="button" className="primary-btn small" onClick={() => confirmDone(false)}>Opslaan als klaar</button>
              </div>
            </div>
          </div>
        )}
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
            <div className="header-client">Developer</div>
          </div>
        </div>
        <div className="header-right">
          <MeldingenMenu />
          <Tellers />
        <OntwikkelMenu />
          <a className="logout-btn" href="/admin">&larr; Alle klanten</a>
          <button className="logout-btn" onClick={logout} style={{ marginLeft: "var(--s-2)" }}>Uitloggen</button>
        </div>
      </div>

      <div className="container">{content}</div>

      <div className="footer">Pingwin Online Marketing &middot; Developer</div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// HET TAAKVENSTER: zelf een taak maken of een taak bijstellen
// ═══════════════════════════════════════════════════════════
// Eén venster voor allebei, omdat het om precies dezelfde velden gaat: wat moet
// er gebeuren, wat moet de developer weten, welke pagina is het, en welke
// documenten of bestanden horen erbij. Bij een nieuwe taak wordt hij eerst
// bewaard; daarna kun je er documenten aan hangen, want die horen bij een taak
// die al bestaat.
function TaakVenster({ taak, clientSlug, clientName, onLijst, onSluiten }: {
  taak: DevTask | null;
  clientSlug: string;
  clientName: string;
  onLijst: (tasks: DevTask[]) => void;
  onSluiten: () => void;
}) {
  const [taskKey, setTaskKey] = useState(taak?.taskKey || "");
  const [tekst, setTekst] = useState(taak?.taak || "");
  const [opm, setOpm] = useState(taak?.toelichting || "");
  const [link, setLink] = useState(taak?.link || "");
  const [docs, setDocs] = useState<{ label: string; url: string }[]>(taak?.docs || []);
  const [docLabel, setDocLabel] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const bestandRef = useRef<HTMLInputElement | null>(null);
  const eigen = taak ? !!taak.eigen : true;

  // De lijst komt na elke wijziging compleet terug; daar halen we de documenten
  // van déze taak weer uit, zodat het venster laat zien wat er echt hangt.
  function verwerk(list: DevTask[], key: string) {
    onLijst(list);
    const mijn = list.find((t) => t.clientSlug === clientSlug && t.taskKey === key);
    if (mijn) setDocs(mijn.docs || []);
  }

  async function stuur(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const r = await fetch("/api/admin/developer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSlug, taskKey, ...body }),
    }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) { setMsg((r && r.error) || "Dat lukte niet. Probeer het nog een keer."); return null; }
    setMsg("");
    return r;
  }

  async function bewaar(sluiten: boolean) {
    if (busy) return;
    if (!stripText(tekst).trim()) { setMsg("Zet er in elk geval een taak bij."); return; }
    setBusy("bewaren");
    try {
      if (!taskKey) {
        const r = await stuur({ action: "nieuw", taak: tekst, toelichting: opm, link });
        if (r) {
          const key = String(r.taskKey || "");
          setTaskKey(key);
          verwerk((r.tasks as DevTask[]) || [], key);
          setMsg(sluiten ? "" : "Taak aangemaakt. Je kunt er nu documenten en bestanden bij zetten.");
          if (sluiten) onSluiten();
        }
      } else {
        const r = await stuur({ action: "bewerk", taak: tekst, toelichting: opm, link });
        if (r) {
          verwerk((r.tasks as DevTask[]) || [], taskKey);
          setMsg(sluiten ? "" : "Bewaard.");
          if (sluiten) onSluiten();
        }
      }
    } finally { setBusy(""); }
  }

  async function docToevoegen() {
    const url = docUrl.trim();
    if (!url || busy) return;
    setBusy("doc");
    try {
      const r = await stuur({ action: "doc", url, label: docLabel.trim() });
      if (r) { verwerk((r.tasks as DevTask[]) || [], taskKey); setDocLabel(""); setDocUrl(""); }
    } finally { setBusy(""); }
  }

  async function docWeg(url: string) {
    if (busy) return;
    setBusy("doc");
    try {
      const r = await stuur({ action: "docWeg", url });
      if (r) verwerk((r.tasks as DevTask[]) || [], taskKey);
    } finally { setBusy(""); }
  }

  // Een zip, een pdf, een export: het bestand gaat naar de Drive-map van deze
  // klant en hangt daarna als klikbare link aan de taak. De developer hoeft dus
  // nergens in te loggen en niets op te vragen.
  async function bestandKiezen(f: File | null) {
    if (!f || busy) return;
    setBusy("upload"); setMsg("");
    try {
      const fd = new FormData();
      fd.append("clientSlug", clientSlug);
      fd.append("taskKey", taskKey);
      fd.append("file", f);
      const r = await fetch("/api/admin/developer", { method: "POST", body: fd }).then((x) => x.json()).catch(() => null);
      if (!r || !r.ok) setMsg((r && r.error) || "Uploaden mislukte.");
      else verwerk((r.tasks as DevTask[]) || [], taskKey);
    } finally {
      setBusy("");
      if (bestandRef.current) bestandRef.current.value = "";
    }
  }

  async function taakWeg() {
    if (busy || !taskKey) return;
    if (!window.confirm(eigen
      ? "Deze taak weggooien? Hij bestaat alleen hier, dus hij is daarna weg."
      : "Deze taak van de developerlijst halen? De kaart zelf blijft in de weekplanning staan.")) return;
    setBusy("weg");
    try {
      const r = await stuur({ action: "verwijder" });
      if (r) { onLijst((r.tasks as DevTask[]) || []); onSluiten(); }
    } finally { setBusy(""); }
  }

  return (
    <div className="compose-overlay">
      <div className="compose-modal dev-venster">
        <div className="compose-head">
          <span>{taak ? "Taak bijwerken" : "Nieuwe taak voor de developer"} &middot; {clientName}</span>
          <button type="button" className="chat-float-close" onClick={onSluiten}>&times;</button>
        </div>
        <div className="compose-body">
          <label className="compose-label">Taak: wat moet er gebeuren</label>
          <RijkTekstVeld waarde={tekst} onChange={setTekst} klasse="dev-veld-rijk" placeholder="Bijvoorbeeld: vervang de header-afbeelding op de homepage" autoFocus={!taak} />

          <label className="compose-label">Opmerking voor de developer</label>
          <RijkTekstVeld waarde={opm} onChange={setOpm} klasse="dev-veld-rijk" placeholder="Achtergrond, aandachtspunten, links naar documenten (plakken mag)" />

          <label className="compose-label">Pagina op de site (mag leeg)</label>
          <input className="compose-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />

          <div className="dev-docs-blok">
            <div className="ck-section-head"><span>Documenten en bestanden</span></div>
            {!taskKey && <p className="muted">Bewaar de taak eerst; daarna kun je er documenten en bestanden aan hangen.</p>}
            {taskKey && (
              <>
                {docs.length > 0 ? (
                  <ul className="dev-docs-lijst">
                    {docs.map((d) => (
                      <li key={d.url}>
                        <a href={d.url} target="_blank" rel="noreferrer" className="dev-doc-link">{d.label}</a>
                        <button type="button" className="dev-doc-weg" onClick={() => void docWeg(d.url)} title="Van deze taak afhalen">&times;</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted">Nog niets gekoppeld.</p>}
                <div className="dev-doc-toevoegen">
                  <input className="compose-input" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="Naam (bijv. Nieuwe copy)" />
                  <input className="compose-input" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void docToevoegen(); }} placeholder="https://… (Drive, Docs, waar dan ook)" />
                  <button type="button" className="ghost-btn small" onClick={() => void docToevoegen()} disabled={!docUrl.trim() || !!busy}>Link koppelen</button>
                </div>
                <div className="dev-doc-upload">
                  <input ref={bestandRef} type="file" onChange={(e) => void bestandKiezen(e.target.files?.[0] || null)} />
                  <span className="muted">
                    {busy === "upload" ? "Bezig met uploaden…" : "Een zip, pdf of afbeelding gaat naar de Drive-map van deze klant en hangt daarna als link aan de taak (tot 20 MB)."}
                  </span>
                </div>
                <p className="muted dev-doc-hint">
                  Documenten die het dashboard zelf bij de pagina vindt (copy, blauwdruk, analyse) blijven staan; die horen bij de pagina, niet bij deze ene taak.
                </p>
              </>
            )}
          </div>

          {msg && <p className="dev-venster-msg">{msg}</p>}
        </div>
        <div className="compose-foot">
          {/* Ook voor taken die hier niet zelf zijn aangemaakt. Een doorgezette
              kaart gaat alleen van de developerlijst af en blijft gewoon in de
              weekplanning staan; daarom staat dat ook op de knop. */}
          {taskKey && (
            <button type="button" className="logout-btn dev-weg-btn" onClick={() => void taakWeg()} disabled={!!busy}
              title={eigen ? "Deze taak bestaat alleen hier en wordt echt weggegooid." : "Haalt de taak van de developerlijst af. De kaart zelf blijft in de weekplanning staan."}>
              {eigen ? "Taak weggooien" : "Van de lijst halen"}
            </button>
          )}
          <button type="button" className="logout-btn" onClick={onSluiten}>Sluiten</button>
          <button type="button" className="ghost-btn small" onClick={() => void bewaar(false)} disabled={!!busy}>Bewaren</button>
          <button type="button" className="primary-btn small" onClick={() => void bewaar(true)} disabled={!!busy}>
            {busy === "bewaren" ? "Bezig…" : "Bewaren en sluiten"}
          </button>
        </div>
      </div>
    </div>
  );
}

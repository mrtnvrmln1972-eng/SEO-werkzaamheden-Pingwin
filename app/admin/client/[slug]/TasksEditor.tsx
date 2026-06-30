"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TaskRow } from "../../../../lib/tasks";
import { cleanPastedHtml, linkifyPlainText } from "../../../../lib/rich-paste";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const STATUSES = ["Gepland", "Bezig", "Klaar"];

type Budget = { maandbudget: number; linkbuilding: number; uurtarief: number; beschikbareUren: number };

// Rij = taak plus client-only velden: "_mail" (meegaan in de mail-batch) en
// "_uid" (stabiele sleutel zodat de rich-text-cellen netjes blijven bij slepen).
// Worden niet opgeslagen.
type Row = TaskRow & { _mail?: boolean; _uid: string };

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Haalt opmaak weg → platte tekst (voor de developer-mail en losse weergaven).
function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// Strip inline kleur/font-stijlen zodat tekst overal consistent donker is.
function sanitizeRichHtml(html: string): string {
  return html
    .replace(/\s*(?:color|font-size|font-family|background(?:-color)?)\s*:[^;"]+;?/gi, "")
    .replace(/\s*style=""\s*/gi, " ");
}

// Bewerkbare rich-text-cel: typ tekst, selecteer een woord en druk Cmd/Ctrl+K
// om er een link aan te hangen. Niet door React gestuurd (innerHTML alleen bij
// het opbouwen gezet), zodat de cursor niet verspringt tijdens typen.
function RichCell({ html, onChange, placeholder }: { html: string; onChange: (html: string) => void; placeholder: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (html || "")) ref.current.innerHTML = html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function emit() { onChange(sanitizeRichHtml(ref.current?.innerHTML || "")); }
  // Zet target="_blank" op alle links in de cel (ook nieuw aangemaakte).
  function fixLinks() {
    ref.current?.querySelectorAll("a[href]").forEach((a) => {
      (a as HTMLAnchorElement).target = "_blank";
      (a as HTMLAnchorElement).rel = "noreferrer";
    });
  }
  function onKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const sel = window.getSelection();
      const url = window.prompt("Link naar (URL of document):", "https://");
      if (!url) return;
      if (sel && !sel.isCollapsed) document.execCommand("createLink", false, url);
      else document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer">${esc(url)}</a>`);
      fixLinks();
      emit();
    }
    // Cmd+Shift+V (zonder opmaak) handelt de browser zelf af: dan komt er geen
    // text/html mee, dus onPaste plakt vanzelf platte tekst.
  }
  // Klik op een link opent hem in een nieuw tabblad (ook tijdens bewerken).
  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const a = (t.tagName === "A" ? t : t.closest("a")) as HTMLAnchorElement | null;
    if (a && a.href && !a.href.startsWith("javascript:")) { e.preventDefault(); window.open(a.href, "_blank", "noreferrer"); }
  }
  function onPaste(e: React.ClipboardEvent) {
    const pasteHtml = e.clipboardData.getData("text/html");
    const pasteText = e.clipboardData.getData("text/plain");
    // HTML (cellen, links, opmaak): opschonen tot kale tekst + klikbare links.
    if (pasteHtml && /<\w/.test(pasteHtml)) {
      const cleaned = cleanPastedHtml(pasteHtml);
      if (cleaned) {
        e.preventDefault();
        document.execCommand("insertHTML", false, cleaned);
        fixLinks();
        emit();
        return;
      }
    }
    // Platte tekst met URL's: auto-linken.
    if (pasteText && /https?:\/\//i.test(pasteText)) {
      e.preventDefault();
      document.execCommand("insertHTML", false, linkifyPlainText(pasteText));
      fixLinks();
      emit();
      return;
    }
    // Overige platte tekst: standaard browser-paste, daarna opschonen.
    setTimeout(() => { fixLinks(); emit(); }, 0);
  }
  return <div ref={ref} className="rich-cell" contentEditable suppressContentEditableWarning data-ph={placeholder} onInput={emit} onBlur={emit} onClick={onClick} onKeyDown={onKey} onPaste={onPaste} />;
}

// Volwaardige rijke editor voor de klant-toelichting-popover: toolbar (vet,
// cursief, lijsten, link) + dezelfde plak-opschoning als "Zoekwoorden & links".
function PopEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function emit() { onChange(sanitizeRichHtml(ref.current?.innerHTML || "")); }
  function fixLinks() {
    ref.current?.querySelectorAll("a[href]").forEach((a) => {
      (a as HTMLAnchorElement).target = "_blank";
      (a as HTMLAnchorElement).rel = "noreferrer";
    });
  }
  function cmd(c: string) { ref.current?.focus(); document.execCommand(c, false); }
  function addLink() {
    ref.current?.focus();
    const url = window.prompt("Link naar (URL):", "https://");
    if (!url) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer">${esc(url)}</a>`);
    fixLinks(); emit();
  }
  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const a = (t.tagName === "A" ? t : t.closest("a")) as HTMLAnchorElement | null;
    if (a && a.href && !a.href.startsWith("javascript:")) { e.preventDefault(); window.open(a.href, "_blank", "noreferrer"); }
  }
  function onKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); addLink(); }
  }
  function onPaste(e: React.ClipboardEvent) {
    const h = e.clipboardData.getData("text/html");
    const txt = e.clipboardData.getData("text/plain");
    if (h && /<\w/.test(h)) {
      const c = cleanPastedHtml(h, { keepTables: true });
      if (c) { e.preventDefault(); document.execCommand("insertHTML", false, c); fixLinks(); emit(); return; }
    }
    if (txt && /https?:\/\//i.test(txt)) {
      e.preventDefault(); document.execCommand("insertHTML", false, linkifyPlainText(txt)); fixLinks(); emit(); return;
    }
    setTimeout(() => { fixLinks(); emit(); }, 0);
  }
  const tb = (e: React.MouseEvent) => e.preventDefault(); // selectie niet verliezen
  return (
    <>
      <div className="klant-pop-toolbar">
        <button type="button" onMouseDown={tb} onClick={() => cmd("bold")} title="Vet"><strong>B</strong></button>
        <button type="button" onMouseDown={tb} onClick={() => cmd("italic")} title="Cursief"><em>I</em></button>
        <button type="button" onMouseDown={tb} onClick={() => cmd("insertUnorderedList")} title="Opsomming">&bull; lijst</button>
        <button type="button" onMouseDown={tb} onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
        <button type="button" onMouseDown={tb} onClick={addLink} title="Link toevoegen (Cmd+K)">&#128279; link</button>
        <button type="button" onMouseDown={tb} onClick={() => cmd("unlink")} title="Link verwijderen">link weg</button>
      </div>
      <div ref={ref} className="klant-pop-editor focus-rich" contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit} onClick={onClick} onKeyDown={onKey} onPaste={onPaste} />
    </>
  );
}

export default function TasksEditor({ slug, initialTasks, budget, clientName, highlight }: { slug: string; initialTasks: TaskRow[]; budget: Budget; clientName: string; highlight?: string }) {
  const uidRef = useRef(1);
  // "Te doen" is verwijderd; migreer bestaande taken naar "Gepland" bij laden.
  const normalizeStatus = (s: string) => s === "Te doen" ? "Gepland" : s;
  const [rows, setRows] = useState<Row[]>(() => initialTasks.map((t, i) => ({ ...t, status: normalizeStatus(t.status || ""), _uid: t.id != null ? `id-${t.id}` : `init-${i}` })));
  const rowsRef = useRef<Row[]>(rows);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [klantPopRow, setKlantPopRow] = useState<number | null>(null);

  // "Verstuur naar developer"
  const [showCompose, setShowCompose] = useState(false);
  const [devTo, setDevTo] = useState("");
  const [devNote, setDevNote] = useState("");
  const [devSel, setDevSel] = useState<Set<number>>(new Set());
  const [devBusy, setDevBusy] = useState(false);
  const [devMsg, setDevMsg] = useState("");

  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());

  const now = new Date();
  const curMonth = MONTHS[now.getMonth()];
  const nextMonth = MONTHS[(now.getMonth() + 1) % 12];

  // Komt de gebruiker via een mail-link binnen (?highlight=id,id), open dan de
  // betreffende maanden, scroll naar de taak en laat 'm even oplichten.
  useEffect(() => {
    if (!highlight) return;
    const ids = new Set(highlight.split(",").map((s) => Number(s)).filter((n) => !Number.isNaN(n)));
    if (ids.size === 0) return;
    setHighlightIds(ids);
    setOpenMonths((o) => {
      const c = { ...o };
      initialTasks.forEach((r) => { if (typeof r.id === "number" && ids.has(r.id)) c[(r.maand || "").toLowerCase()] = true; });
      return c;
    });
    const first = [...ids][0];
    setTimeout(() => {
      const el = document.getElementById(`task-row-${first}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 500);
  }, [highlight, initialTasks]);
  // Standaard open: huidige + volgende maand (+ zonder-maand). Rest dicht.
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({ [curMonth]: true, [nextMonth]: true, "": true });
  const isOpen = (m: string) => openMonths[m] ?? false;
  const toggleMonth = (m: string) => setOpenMonths((o) => ({ ...o, [m]: !(o[m] ?? false) }));

  // Auto-save: 800ms na de laatste wijziging wordt de huidige staat opgeslagen.
  function triggerAutoSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveRows(rowsRef.current), 800);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
      rowsRef.current = next;
      return next;
    });
    setMsg("");
    triggerAutoSave();
  }

  // Sla een specifieke rijen-array direct op (zonder van state afhankelijk te zijn).
  function saveRows(rowsToSave: Row[]) {
    fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, tasks: rowsToSave.map((r) => ({ ...r, klantZichtbaar: true })) }),
    }).catch(() => {});
  }

  function addRow(maand: string, wie: string) {
    const newRow: Row = { categorie: "", taak: "", toelichting: "", uren: null, status: "Gepland", maand, link: "", wie, klantZichtbaar: true, _uid: `new-${uidRef.current++}` };
    setRows((prev) => {
      const newRows = [...prev, newRow];
      rowsRef.current = newRows;
      saveRows(newRows);
      return newRows;
    });
  }
  function removeRow(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      rowsRef.current = next;
      return next;
    });
    triggerAutoSave();
  }

  // Versleep een taak. beforeIdx = de rij waarop gedropt wordt (binnen of tussen
  // maanden); null = ergens op de maandkaart (achteraan die maand). De maand van
  // de gesleepte taak wordt op de doelmaand gezet, zo verhuist hij van kaart.
  function moveRow(toMaand: string, beforeIdx: number | null) {
    if (dragIdx === null) return;
    setRows((prev) => {
      const c = [...prev];
      const [moved] = c.splice(dragIdx, 1);
      const nm = { ...moved, maand: toMaand };
      if (beforeIdx == null || beforeIdx < 0) { c.push(nm); }
      else { const ins = beforeIdx > dragIdx ? beforeIdx - 1 : beforeIdx; c.splice(ins, 0, nm); }
      rowsRef.current = c;
      return c;
    });
    setDragIdx(null);
    setMsg("");
    triggerAutoSave();
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      // Alle taken (ook developer-taken) zijn zichtbaar in het klant-overzicht.
      const toSave = rows.map((r) => ({ ...r, klantZichtbaar: true }));
      const res = await fetch("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tasks: toSave }) });
      const data = await res.json();
      setMsg(data.ok ? `Opgeslagen (${data.saved} taken).` : (data.error || "Opslaan mislukt."));
    } catch { setMsg("Opslaan mislukt."); } finally { setBusy(false); }
  }

  // Open het mail-venster. Zonder argument: alle open developer-taken voorgevinkt.
  // Met indices (de ✉-knop op een rij): precies die taak/taken voorgevinkt.
  function openComposeFor(idxs?: number[]) {
    let sel = idxs ?? rows.map((r, i) => ({ r, i })).filter((x) => x.r._mail).map((x) => x.i);
    // Niets aangevinkt? Val terug op alle developer-taken.
    if (sel.length === 0) sel = rows.map((r, i) => ({ r, i })).filter((x) => (x.r.wie || "").toLowerCase() === "dev").map((x) => x.i);
    setDevSel(new Set(sel));
    try { setDevTo(localStorage.getItem("pingwin-dev-email") || "tony@pingwin.nl"); } catch { setDevTo("tony@pingwin.nl"); }
    setDevNote(""); setDevMsg(""); setShowCompose(true);
  }
  function toggleDevSel(i: number) {
    setDevSel((s) => { const c = new Set(s); if (c.has(i)) c.delete(i); else c.add(i); return c; });
  }
  async function sendDev() {
    const selected = rows.map((r, i) => ({ r, i })).filter((x) => devSel.has(x.i)).map((x) => x.r);
    if (!devTo.trim() || selected.length === 0) { setDevMsg("Vul een ontvanger in en kies minstens één taak."); return; }
    const list = selected.map((t) =>
      `<li><strong>${esc(stripHtml(t.taak))}</strong>${t.maand ? ` <em>(${esc(t.maand)})</em>` : ""}${t.toelichting ? ` — ${esc(stripHtml(t.toelichting))}` : ""}${t.link ? ` — <a href="${esc(t.link)}">document</a>` : ""}</li>`,
    ).join("");
    const note = devNote.trim() ? `<p>${esc(devNote).replace(/\n/g, "<br>")}</p>` : "";
    const ids = selected.map((t) => t.id).filter((x): x is number => typeof x === "number");
    const dashUrl = typeof window !== "undefined"
      ? `${window.location.origin}/admin/client/${slug}?tab=werkzaamheden${ids.length ? `&highlight=${ids.join(",")}` : ""}`
      : "";
    const dashLink = dashUrl ? `<p style="margin-top:14px;color:#555;font-size:13px">Bekijk deze taken in het dashboard: <a href="${esc(dashUrl)}">open in het dashboard &rarr;</a></p>` : "";
    const html = `${note}<p><strong>Werkzaamheden:</strong></p><ul>${list}</ul>${dashLink}`;
    setDevBusy(true); setDevMsg("");
    try {
      const res = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to: devTo, subject: `Werkzaamheden — ${clientName}`, html }) });
      const data = await res.json();
      if (data.ok) {
        try { localStorage.setItem("pingwin-dev-email", devTo.trim()); } catch { /* ignore */ }
        // Gemailde taken markeren (blijven oranje tot status 'Klaar') en direct opslaan.
        const newRows = rows.map((r, i) => devSel.has(i) ? { ...r, gemaild: true } : r);
        setRows(newRows);
        fetch("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tasks: newRows.map((r) => ({ ...r, klantZichtbaar: true })) }) }).catch(() => {});
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
  function section(secRows: { r: Row; i: number }[], maand: string) {
    // Klaar-taken naar onderen, open taken (gepland/bezig) bovenaan. Stabiel:
    // binnen elke groep blijft de handmatige (sleep-)volgorde behouden.
    const ordered = secRows
      .map((x, idx) => ({ x, idx }))
      .sort((a, b) => {
        const da = DONE.test(a.x.r.status || "") ? 1 : 0;
        const db = DONE.test(b.x.r.status || "") ? 1 : 0;
        return da - db || a.idx - b.idx;
      })
      .map((o) => o.x);
    return (
      <div className="task-section">
        <table className="task-table">
            <colgroup>
              <col style={{ width: "22px" }} /><col /><col />
              <col style={{ width: "66px" }} /><col style={{ width: "104px" }} /><col style={{ width: "150px" }} />
              <col style={{ width: "118px" }} /><col style={{ width: "92px" }} /><col style={{ width: "44px" }} /><col style={{ width: "78px" }} />
            </colgroup>
            <thead><tr><th></th><th>Taak</th><th>Opm. developer</th><th>Uren</th><th>Status</th><th>Link</th><th>Wie</th><th>Maand</th><th title="Aanvinken om mee te nemen in een mail-batch naar de developer" className="col-center">Mail</th><th></th></tr></thead>
            <tbody>
              {ordered.map(({ r, i }) => {
                const isDev = (r.wie || "").toLowerCase() === "dev";
                const hl = typeof r.id === "number" && highlightIds.has(r.id);
                const done = DONE.test(r.status || "");
                const mailed = !!r.gemaild && !done;
                const statusCls = done ? "task-done " : "task-open ";
                return (
                  <tr key={r._uid} id={typeof r.id === "number" ? `task-row-${r.id}` : undefined} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); moveRow(maand, i); }} className={`${statusCls}${dragIdx === i ? "dragging " : ""}${isDev ? "dev-row " : ""}${mailed ? "mailed-row " : ""}${klantPopRow === i ? "klant-pop-open " : ""}${hl ? "highlight-row" : ""}`}>
                    <td className="drag-handle" draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => setDragIdx(null)} title="Sleep (ook naar een andere maand)">⠿</td>
                    <td>
                      <div className="taak-cell">
                        <RichCell html={r.taak} onChange={(v) => update(i, { taak: v })} placeholder="Taak" />
                        <button type="button" className={"row-info" + (r.klantToelichting ? " has" : "")} onClick={() => setKlantPopRow(klantPopRow === i ? null : i)} title="Toelichting voor de klant (verschijnt als ?-tooltip in het klantdashboard)">?</button>
                        {klantPopRow === i && (
                          <div className="klant-pop" onClick={(e) => e.stopPropagation()}>
                            <div className="klant-pop-head">Toelichting voor de klant</div>
                            <PopEditor html={r.klantToelichting || ""} onChange={(v) => update(i, { klantToelichting: v })} />
                            <div className="klant-pop-foot">
                              <span className="klant-pop-hint">Wordt automatisch opgeslagen.</span>
                              <button type="button" className="primary-btn small" onClick={() => setKlantPopRow(null)}>Klaar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td><RichCell html={r.toelichting} onChange={(v) => update(i, { toelichting: v })} placeholder="Toelichting" /></td>
                    <td><input className="cell-num" type="number" value={r.uren ?? ""} onChange={(e) => update(i, { uren: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                    <td><select value={r.status} onChange={(e) => update(i, { status: e.target.value })}><option value="">—</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                    <td><div className="cell-link"><input value={r.link} onChange={(e) => update(i, { link: e.target.value })} placeholder="https://..." />{r.link && <a href={r.link} target="_blank" rel="noreferrer">↗</a>}</div></td>
                    <td><button type="button" className={"wie-badge " + (isDev ? "wie-dev" : "wie-seo")} onClick={() => update(i, { wie: isDev ? "SEO" : "Dev" })} title="Klik om te wisselen tussen SEO en Developer">{isDev ? "Developer" : "SEO"}</button></td>
                    <td><select value={r.maand} onChange={(e) => update(i, { maand: e.target.value })}><option value="">—</option>{MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}</select></td>
                    <td className="cell-check col-center"><input type="checkbox" checked={!!r._mail} onChange={(e) => update(i, { _mail: e.target.checked })} title="Meenemen in de mail-batch naar de developer" /></td>
                    <td className="row-actions">
                      <button type="button" className="row-send" onClick={() => openComposeFor([i])} title="Deze taak mailen naar de developer">✉</button>
                      <button type="button" className="row-del" onClick={() => removeRow(i)} title="Verwijderen">×</button>
                    </td>
                  </tr>
                );
              })}
              {secRows.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: 8 }}>Nog geen taken deze maand. Sleep er een hierheen of voeg toe.</td></tr>}
            </tbody>
          </table>
        <button type="button" className="add-task-btn" onClick={() => addRow(maand, "SEO")}>+ taak</button>
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
  function monthCard(maand: string, label: string, items: { r: Row; i: number }[]) {
    const doneMin = items.filter((x) => DONE.test(x.r.status || "")).reduce((s, x) => s + (Number(x.r.uren) || 0), 0);
    const planMin = items.filter((x) => !DONE.test(x.r.status || "")).reduce((s, x) => s + (Number(x.r.uren) || 0), 0);
    const urenBesteed = Math.round((doneMin / 60) * 10) / 10;
    const urenGepland = Math.round((planMin / 60) * 10) / 10;
    const open = isOpen(maand);
    // Op de kaart of de kop droppen verplaatst de taak naar (het einde van) deze maand.
    return (
      <div className="cockpit-card month-card" key={maand || "none"} onDragOver={(e) => e.preventDefault()} onDrop={() => moveRow(maand, null)}>
        <div className="month-card-head clickable" onClick={() => toggleMonth(maand)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); moveRow(maand, null); setOpenMonths((o) => ({ ...o, [maand]: true })); }}>
          <span className="month-card-title">{label} <span className="month-caret">{open ? "▾" : "▸"}</span> <span className="month-card-count">({items.length})</span></span>
          {budgetInline(urenBesteed, urenGepland)}
        </div>
        {open && <div className="month-cards">{section(items, maand)}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="cockpit-card werk-bar">
        <div className="werk-head">
          <div className="werk-head-left">
            <span className="werk-title">Werkzaamheden</span>
            <select className="add-month-select" value="" onChange={(e) => { const m = e.target.value; if (m) { addRow(m, "SEO"); setOpenMonths((o) => ({ ...o, [m]: true })); } }}>
              <option value="">+ Nieuwe maand…</option>
              {MONTHS.filter((m) => !monthsPresent.includes(m)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <span className="werk-head-actions">
            <button type="button" className="ghost-btn" onClick={() => openComposeFor()}>✉ Naar developer</button>
            <button type="button" className="primary-btn small" onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Alles opslaan"}</button>
          </span>
        </div>
        {msg && <div className={msg.startsWith("Opgeslagen") ? "saved-msg" : "login-error"}>{msg}</div>}
        {rows.length === 0 && <div className="muted">Nog geen werkzaamheden. Voeg een maand toe om te beginnen.</div>}
      </div>

      {klantPopRow !== null && <div className="klant-pop-overlay" onClick={() => setKlantPopRow(null)} />}

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
              <input className="compose-input" value={devTo} onChange={(e) => setDevTo(e.target.value)} placeholder="tony@pingwin.nl" />
              <label className="compose-label">Bericht (optioneel)</label>
              <textarea className="compose-input" rows={3} value={devNote} onChange={(e) => setDevNote(e.target.value)} placeholder="Korte begeleidende tekst..." />
              <label className="compose-label">Taken (vink aan wat mee moet)</label>
              <div className="compose-list">
                {rows.map((r, i) => devSel.has(i) ? (
                  <label key={i} className="compose-item">
                    <input type="checkbox" checked={devSel.has(i)} onChange={() => toggleDevSel(i)} />
                    <span>{r.maand ? <em>[{r.maand}] </em> : ""}{stripHtml(r.taak) || "(leeg)"}{r.status ? ` — ${r.status}` : ""}</span>
                  </label>
                ) : null)}
                {devSel.size === 0 && <div className="muted">Geen taken geselecteerd. Vink in de tabel taken aan in de kolom &ldquo;Mail&rdquo;.</div>}
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

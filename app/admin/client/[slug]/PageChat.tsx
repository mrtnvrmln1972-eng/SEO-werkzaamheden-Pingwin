"use client";

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Task = { taak: string; fase?: string; wie?: string };
type Proposal = { plan?: string; tasks?: Task[] };
type ChatSummary = { id: number; title: string; updatedAt: string; count: number };

export default function PageChat({ slug, url, clientEmail, clientName, onApplied, onGoToTask }: { slug: string; url: string; clientEmail?: string; clientName?: string; onApplied: (plan?: string) => void; onGoToTask?: (taskId: number) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [planSel, setPlanSel] = useState(true);
  const [taskSel, setTaskSel] = useState<boolean[]>([]);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState("");
  // Klant-mail
  const [mailOpen, setMailOpen] = useState(false);
  const [mailGen, setMailGen] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailHtml, setMailHtml] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState("");
  const mailRef = useRef<HTMLDivElement | null>(null);

  // Zet de opgemaakte mail in de bewerkbare preview zodra het venster opent.
  useEffect(() => { if (mailOpen && mailRef.current) mailRef.current.innerHTML = mailHtml; }, [mailOpen, mailHtml]);

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";

  const [taskGen, setTaskGen] = useState(false);
  async function makeWorkItem() {
    if (!lastAssistant || taskGen) return;
    setTaskGen(true); setErr(""); setApplied("");
    try {
      const r = await fetch("/api/admin/page-chat/to-task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, analysis: lastAssistant }) });
      const d = await r.json();
      if (d.ok) {
        setApplied(`Werkzaamheid aangemaakt: "${d.title}".`);
        // Spring naar de Werkzaamheden-tab en licht de nieuwe taak op (zonder de
        // Pagina's-tab te herladen); de staat hier blijft behouden.
        if (typeof d.taskId === "number" && onGoToTask) onGoToTask(d.taskId);
      }
      else setErr(d.error || "Werkzaamheid maken mislukt.");
    } catch { setErr("Werkzaamheid maken mislukt."); } finally { setTaskGen(false); }
  }

  const [docBusy, setDocBusy] = useState("");
  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const soort: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy" };
  async function genDoc(kind: "analyse" | "blauwdruk" | "copy") {
    if (docBusy) return;
    setDocBusy(kind); setErr(""); setApplied("");
    try {
      // deliver=download alleen als er geen bestemmingsmap is gekozen.
      const payload = { slug, url, kind, ...(driveFolder ? { folderId: driveFolder.id } : { deliver: "download" }) };
      const r = await fetch("/api/admin/page-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const ct = r.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        const d = await r.json();
        if (!d.ok) { setErr(d.error || "Document maken mislukt."); return; }
        setApplied(`${soort[kind]}-document in Pingwin-huisstijl opgeslagen in Google Drive${driveFolder ? ` (map: ${driveFolder.name})` : ""}. <a href="${d.link}" target="_blank" rel="noopener">Open document</a>.${kind === "copy" ? " De developer heeft een bouwtaak met deze link gekregen." : ""}`);
        if (kind === "copy") onApplied();
        return;
      }
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Document maken mislukt."); return; }
      // Download-blob.
      const blob = await r.blob();
      const a = document.createElement("a");
      const dispo = r.headers.get("Content-Disposition") || "";
      const m = dispo.match(/filename="([^"]+)"/);
      a.href = URL.createObjectURL(blob);
      a.download = m ? m[1] : `${kind}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setApplied(`${soort[kind]}-document gedownload in Pingwin-huisstijl.${kind === "copy" ? " Er is een bouwtaak voor de developer aangemaakt." : ""}`);
      if (kind === "copy") onApplied();
    } catch { setErr("Document maken mislukt."); } finally { setDocBusy(""); }
  }

  // ── Google Drive bestemmingsmap ─────────────────────────────
  type Folder = { id: string; name: string };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stack, setStack] = useState<Folder[]>([{ id: "root", name: "Mijn Drive" }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickErr, setPickErr] = useState("");
  const [newFolder, setNewFolder] = useState("");

  // Bij laden: toon de eventueel al gekozen map (lichte call, geen Drive-lijst).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/drive/folders?chosenOnly=1&slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok && d.chosen) setDriveFolder({ id: d.chosen.folderId, name: d.chosen.folderName, path: d.chosen.folderPath }); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [slug, url]);

  async function loadFolders(parentId: string) {
    setPickBusy(true); setPickErr("");
    try {
      const r = await fetch(`/api/admin/drive/folders?parent=${encodeURIComponent(parentId)}`);
      const d = await r.json();
      if (!d.ok) { setPickErr(d.error || "Kon Drive-mappen niet laden."); setFolders([]); return; }
      setFolders(d.folders || []);
    } catch { setPickErr("Kon Drive-mappen niet laden."); } finally { setPickBusy(false); }
  }
  function openPicker() { setPickerOpen(true); const s = [{ id: "root", name: "Mijn Drive" }]; setStack(s); loadFolders("root"); }
  function enterFolder(f: Folder) { const s = [...stack, f]; setStack(s); loadFolders(f.id); }
  function jumpTo(i: number) { const s = stack.slice(0, i + 1); setStack(s); loadFolders(s[s.length - 1].id); }
  async function makeSubfolder() {
    const name = newFolder.trim(); if (!name) return;
    setPickBusy(true); setPickErr("");
    try {
      const parent = stack[stack.length - 1].id;
      const r = await fetch("/api/admin/drive/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", parent, name }) });
      const d = await r.json();
      if (!d.ok) { setPickErr(d.error || "Map maken mislukt."); return; }
      setNewFolder(""); await loadFolders(parent);
    } catch { setPickErr("Map maken mislukt."); } finally { setPickBusy(false); }
  }
  async function chooseCurrent() {
    const cur = stack[stack.length - 1];
    if (cur.id === "root") { setPickErr("Kies eerst een map (niet de hoofdmap zelf)."); return; }
    const path = stack.slice(1).map((f) => f.name).join(" / ");
    setPickBusy(true); setPickErr("");
    try {
      const r = await fetch("/api/admin/drive/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", slug, url, folderId: cur.id, folderName: cur.name, folderPath: path }) });
      const d = await r.json();
      if (!d.ok) { setPickErr(d.error || "Opslaan mislukt."); return; }
      setDriveFolder({ id: cur.id, name: cur.name, path }); setPickerOpen(false);
    } catch { setPickErr("Opslaan mislukt."); } finally { setPickBusy(false); }
  }

  // Opent een lege mail; de tekst schrijft Maarten zelf (geen AI-voorbeeldtekst).
  function makeClientMail() {
    setErr("");
    setMailHtml("");
    setMailTo(clientEmail || "");
    setMailSubject("");
    setMailMsg("");
    setMailOpen(true);
  }

  async function sendClientMail() {
    const html = (mailRef.current?.innerHTML || mailHtml).trim();
    if (!mailTo.trim() || !html) { setMailMsg("Vul een ontvanger en tekst in."); return; }
    setMailBusy(true); setMailMsg("");
    try {
      const r = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to: mailTo, subject: mailSubject || "SEO-analyse", html }) });
      const d = await r.json();
      if (d.ok) { setMailMsg(`Verstuurd naar ${(d.sentTo || []).join(", ") || mailTo}.`); setTimeout(() => setMailOpen(false), 1400); }
      else setMailMsg(d.error || "Versturen mislukt.");
    } catch { setMailMsg("Versturen mislukt."); } finally { setMailBusy(false); }
  }

  async function loadChats() {
    try {
      const r = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`);
      const d = await r.json();
      if (d.ok) setChats(d.chats);
    } catch { /* stil */ }
  }
  useEffect(() => { loadChats(); /* eslint-disable-next-line */ }, [slug, url]);

  function newChat() { setMsgs([]); setChatId(null); setProposal(null); setApplied(""); setErr(""); }

  async function openChat(id: number) {
    setProposal(null); setApplied(""); setErr("");
    try {
      const r = await fetch(`/api/admin/page-chats?id=${id}`);
      const d = await r.json();
      if (d.ok && d.chat) { setMsgs(d.chat.messages); setChatId(d.chat.id); }
    } catch { /* stil */ }
  }

  async function removeChat(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Deze chat verwijderen?")) return;
    await fetch(`/api/admin/page-chats?id=${id}`, { method: "DELETE" }).catch(() => {});
    if (chatId === id) newChat();
    loadChats();
  }

  async function persist(all: Msg[]) {
    try {
      const r = await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, id: chatId, messages: all }) });
      const d = await r.json();
      if (d.ok && d.id) { setChatId(d.id); loadChats(); }
    } catch { /* stil */ }
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setErr(""); setApplied(""); setProposal(null);
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/admin/page-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, messages: next }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Chat mislukt."); setBusy(false); return; }
      const withReply = [...next, { role: "assistant" as const, content: d.reply }];
      setMsgs(withReply);
      const p: Proposal | null = d.proposal || null;
      setProposal(p);
      setPlanSel(true);
      setTaskSel(p?.tasks?.map(() => true) || []);
      persist(withReply); // altijd bewaren, ook zonder overnemen
    } catch { setErr("Chat mislukt."); } finally { setBusy(false); }
  }

  async function applySelected() {
    if (!proposal) return;
    const plan = planSel && proposal.plan ? proposal.plan : undefined;
    const tasks = (proposal.tasks || []).filter((_, i) => taskSel[i]);
    if (!plan && tasks.length === 0) { setErr("Vink minstens één ding aan."); return; }
    try {
      const r = await fetch("/api/admin/page-chat/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, plan, tasks }) });
      const d = await r.json();
      if (d.ok) {
        setApplied(`Overgenomen${d.planSaved ? " (plan bijgewerkt)" : ""}${d.tasksAdded ? ` (${d.tasksAdded} taken toegevoegd)` : ""}.`);
        setProposal(null);
        onApplied(plan);
      } else setErr(d.error || "Overnemen mislukt.");
    } catch { setErr("Overnemen mislukt."); }
  }

  const selCount = (planSel && proposal?.plan ? 1 : 0) + taskSel.filter(Boolean).length;

  return (
    <div className="page-chat">
      <div className="page-chat-head">
        <span>Chat over deze pagina (gegrond in live status, GSC-ranking en het cluster)</span>
        {msgs.length > 0 && <button type="button" className="ghost-btn small" onClick={newChat}>+ Nieuwe chat</button>}
      </div>

      {chats.length > 0 && (
        <div className="page-chat-history">
          <div className="page-chat-history-head">Eerdere chats</div>
          {chats.map((c) => (
            <div key={c.id} className={"page-chat-history-item" + (chatId === c.id ? " active" : "")} onClick={() => openChat(c.id)}>
              <span className="pch-title">{c.title}</span>
              <button type="button" className="pch-del" title="Chat verwijderen" onClick={(e) => removeChat(c.id, e)}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {msgs.length > 0 && (
        <div className="page-chat-log">
          {msgs.map((m, i) => (
            m.role === "user"
              ? <div key={i} className="page-chat-msg user">{m.content}</div>
              : <div key={i} className="page-chat-msg assistant md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
          ))}
          {busy && <div className="page-chat-msg assistant muted">Aan het denken…</div>}
        </div>
      )}

      {proposal && (
        <div className="page-chat-proposal">
          <div className="page-chat-proposal-head">Voorstel (vink aan wat je overneemt)</div>
          {proposal.plan && (
            <label className="pch-prop-item">
              <input type="checkbox" checked={planSel} onChange={() => setPlanSel((v) => !v)} />
              <span><span className="pch-badge plan">Plan</span> {proposal.plan}</span>
            </label>
          )}
          {(proposal.tasks || []).map((t, i) => (
            <label key={i} className="pch-prop-item">
              <input type="checkbox" checked={taskSel[i] ?? false} onChange={() => setTaskSel((s) => s.map((v, idx) => idx === i ? !v : v))} />
              <span><span className={"pch-badge " + (t.fase ? "fase" : "task")}>{t.fase || "Taak"}</span> {t.taak} <span className="muted">({t.wie || "SEO"})</span></span>
            </label>
          ))}
          <div className="page-chat-proposal-actions">
            <button type="button" className="primary-btn small" onClick={applySelected} disabled={selCount === 0}>Neem {selCount} over</button>
          </div>
        </div>
      )}

      {lastAssistant && (
        <>
          <div className="page-chat-drive">
            <span className="pcd-label">Opslaan in:</span>
            {driveFolder
              ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
              : <span className="pcd-folder muted">nog geen Drive-map (documenten worden gedownload)</span>}
            <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Map wijzigen" : "Kies Drive-map"}</button>
            {driveFolder && <button type="button" className="ghost-btn small" onClick={() => setDriveFolder(null)}>Naar download</button>}
          </div>
          <div className="page-chat-tools">
            <button type="button" className="ghost-btn small" onClick={makeWorkItem} disabled={taskGen}>{taskGen ? "Aanmaken…" : "Maak werkzaamheid van deze analyse"}</button>
            <button type="button" className="ghost-btn small" onClick={makeClientMail}>Mail naar de klant</button>
            <button type="button" className="ghost-btn small" onClick={() => genDoc("analyse")} disabled={!!docBusy}>{docBusy === "analyse" ? "Analyse maken…" : "Analyse-document"}</button>
            <button type="button" className="ghost-btn small" onClick={() => genDoc("blauwdruk")} disabled={!!docBusy}>{docBusy === "blauwdruk" ? "Blauwdruk maken…" : "Blauwdruk-document"}</button>
            <button type="button" className="ghost-btn small" onClick={() => genDoc("copy")} disabled={!!docBusy}>{docBusy === "copy" ? "Copy maken…" : "Copy-document (+ dev-taak)"}</button>
          </div>
        </>
      )}

      {applied && <div className="saved-msg" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: applied }} />}
      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}

      <div className="page-chat-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag over deze pagina…" disabled={busy} />
        <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
      </div>

      {mailOpen && (
        <div className="compose-overlay">
          <div className="compose-modal mail-modal">
            <div className="compose-head"><span>Analyse mailen naar de klant</span><button type="button" className="chat-float-close" onClick={() => setMailOpen(false)}>&times;</button></div>
            <div className="compose-body">
              <label className="compose-label">Aan (e-mail klant)</label>
              <input className="compose-input" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="klant@bedrijf.nl" />
              <label className="compose-label">Onderwerp</label>
              <input className="compose-input" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
              <label className="compose-label">Bericht (opgemaakt, je kunt hier direct in typen)</label>
              <div ref={mailRef} className="mail-edit md" contentEditable suppressContentEditableWarning />
              {mailMsg && <div className={mailMsg.startsWith("Verstuurd") ? "saved-msg" : "login-error"} style={{ marginTop: 8 }}>{mailMsg}</div>}
            </div>
            <div className="compose-foot">
              <button type="button" className="logout-btn" onClick={() => setMailOpen(false)}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={sendClientMail} disabled={mailBusy}>{mailBusy ? "Versturen..." : "Verstuur per mail"}</button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="compose-overlay">
          <div className="compose-modal drive-modal">
            <div className="compose-head"><span>Kies de Google Drive-map voor deze pagina</span><button type="button" className="chat-float-close" onClick={() => setPickerOpen(false)}>&times;</button></div>
            <div className="compose-body">
              <div className="drive-crumbs">
                {stack.map((f, i) => (
                  <span key={f.id}>
                    <button type="button" className="drive-crumb" onClick={() => jumpTo(i)}>{f.name}</button>
                    {i < stack.length - 1 && <span className="drive-sep"> / </span>}
                  </span>
                ))}
              </div>
              {pickErr && <div className="login-error" style={{ marginTop: 6 }}>{pickErr}</div>}
              <div className="drive-list">
                {pickBusy && <div className="muted" style={{ padding: 8 }}>Laden…</div>}
                {!pickBusy && folders.length === 0 && <div className="muted" style={{ padding: 8 }}>Geen submappen hier. Kies deze map, of maak een nieuwe submap.</div>}
                {!pickBusy && folders.map((f) => (
                  <button key={f.id} type="button" className="drive-row" onClick={() => enterFolder(f)}>{f.name} <span className="muted">openen ›</span></button>
                ))}
              </div>
              <div className="drive-newfolder">
                <input className="compose-input" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Nieuwe submap maken (naam)…" />
                <button type="button" className="ghost-btn small" onClick={makeSubfolder} disabled={pickBusy || !newFolder.trim()}>Map maken</button>
              </div>
            </div>
            <div className="compose-foot">
              <button type="button" className="logout-btn" onClick={() => setPickerOpen(false)}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={chooseCurrent} disabled={pickBusy}>Kies “{stack[stack.length - 1].name}”</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

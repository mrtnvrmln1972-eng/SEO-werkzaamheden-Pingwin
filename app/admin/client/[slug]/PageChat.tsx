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
  // Vat de chat-analyse samen tot één document (Drive of download) en legt de
  // analyse vast als ÉÉN werkzaamheid met dat document eraan gekoppeld.
  async function makeWorkItem() {
    if (!lastAssistant || taskGen) return;
    setTaskGen(true); setErr(""); setApplied("");
    try {
      const payload = { slug, url, analysis: lastAssistant, extra: nuance.trim() || undefined, ...(driveFolder ? { folderId: driveFolder.id } : { deliver: "download" }) };
      const r = await fetch("/api/admin/page-analysis-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const ct = r.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        const d = await r.json();
        if (!d.ok) { setErr(d.error || "Vastleggen mislukt."); return; }
        setApplied(`Analyse samengevat en opgeslagen in Google Drive${d.folder ? `, map "${d.folder}"` : ""}${d.owner ? `, account ${d.owner}` : ""} als ${d.isDoc ? "Google Doc" : "Word-bestand"}${!d.isDoc && d.note ? ` (omzetten naar Google Doc lukte niet: ${d.note})` : ""}. <a href="${d.link}" target="_blank" rel="noopener">Open document</a>.${d.shared ? " Iedereen met de link kan het bekijken." : " (Delen lukte niet automatisch.)"} Vastgelegd als één werkzaamheid; je springt nu naar Werkzaamheden om hem in te plannen.`);
        onApplied();
        if (typeof d.taskId === "number" && onGoToTask) onGoToTask(d.taskId);
        return;
      }
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Vastleggen mislukt."); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      const m = (r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/);
      a.href = URL.createObjectURL(blob);
      a.download = m ? m[1] : "analyse.docx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const tid = Number(r.headers.get("X-Task-Id") || "");
      setApplied("Analyse samengevat en gedownload. Vastgelegd als één werkzaamheid; kies een Drive-map om het document ook te koppelen.");
      onApplied();
      if (!Number.isNaN(tid) && tid && onGoToTask) onGoToTask(tid);
    } catch { setErr("Vastleggen mislukt."); } finally { setTaskGen(false); }
  }

  const [docBusy, setDocBusy] = useState("");
  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const [nuance, setNuance] = useState("");
  const soort: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy" };
  async function genDoc(kind: "analyse" | "blauwdruk" | "copy") {
    if (docBusy) return;
    setDocBusy(kind); setErr(""); setApplied("");
    try {
      // deliver=download alleen als er geen bestemmingsmap is gekozen.
      const payload = { slug, url, kind, extra: nuance.trim() || undefined, ...(driveFolder ? { folderId: driveFolder.id } : { deliver: "download" }) };
      const r = await fetch("/api/admin/page-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const ct = r.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        const d = await r.json();
        if (!d.ok) { setErr(d.error || "Document maken mislukt."); return; }
        setApplied(`${soort[kind]}-document opgeslagen in Google Drive${d.folder ? `, map "${d.folder}"` : ""}${d.owner ? `, account ${d.owner}` : ""} als ${d.isDoc ? "Google Doc" : "Word-bestand"}. <a href="${d.link}" target="_blank" rel="noopener">Open technische versie</a>.${d.clientLink ? ` <a href="${d.clientLink}" target="_blank" rel="noopener">Open klantversie</a>.` : ""}${d.shared ? " Iedereen met de link kan het bekijken." : ""} Vastgelegd als werkzaamheid: de titel linkt naar de technische versie, "(klantversie)" ernaast naar de klantversie. Het klantdashboard toont alleen de klantversie.`);
        onApplied(); // ververst de takenlijst van deze pagina
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
      setApplied(`${soort[kind]}-document gedownload in Pingwin-huisstijl. Vastgelegd als werkzaamheid; plan of wijs hem toe in de Werkzaamheden-tab. Kies een Drive-map om het document ook automatisch te koppelen.`);
      onApplied(); // ververst de takenlijst van deze pagina
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
  function openPicker() {
    setPickerOpen(true);
    // Start waar je vorige keer was (per klant onthouden), zodat je niet elke keer
    // vanaf Mijn Drive naar de klantmap hoeft te klikken.
    let s: Folder[] = [{ id: "root", name: "Mijn Drive" }];
    try {
      const c = localStorage.getItem(`pw_drivestack_${slug}`);
      if (c) { const p = JSON.parse(c); if (Array.isArray(p) && p.length && p[0]?.id === "root") s = p; }
    } catch { /* geen geheugen */ }
    setStack(s); loadFolders(s[s.length - 1].id);
  }
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
      try { localStorage.setItem(`pw_drivestack_${slug}`, JSON.stringify(stack)); } catch { /* geheugen is extra */ }
      setDriveFolder({ id: cur.id, name: cur.name, path }); setPickerOpen(false);
    } catch { setPickErr("Opslaan mislukt."); } finally { setPickBusy(false); }
  }

  // Opent de mail met de CONCLUSIE van de analyse als kern; de tekst eromheen
  // (aanhef, inleiding, afsluiting) schrijft Maarten zelf.
  async function makeClientMail() {
    setErr("");
    setMailTo(clientEmail || "");
    setMailSubject("");
    setMailMsg("");
    setMailHtml("");
    setMailOpen(true);
    if (!lastAssistant) return;
    setMailGen(true);
    try {
      const r = await fetch("/api/admin/page-chat/client-mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, clientName, analysis: lastAssistant }) });
      const d = await r.json();
      if (d.ok && d.email) {
        const html = `<p><em>Schrijf hier je aanhef en inleiding.</em></p>${mdToHtml(d.email)}<p><em>Schrijf hier je afsluiting.</em></p>`;
        setMailHtml(html);
        if (mailRef.current) mailRef.current.innerHTML = html;
      }
    } catch { /* leeg laten als het niet lukt */ } finally { setMailGen(false); }
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
      if (d.ok) { setChats(d.chats); try { localStorage.setItem(`pw_chats_${slug}_${url}`, JSON.stringify(d.chats)); } catch { /* cache is extra */ } }
    } catch { /* stil */ }
  }
  // Cache-first: toon de vorige chatlijst direct, ververs daarna.
  useEffect(() => {
    try { const c = localStorage.getItem(`pw_chats_${slug}_${url}`); if (c) { const p = JSON.parse(c); if (Array.isArray(p)) setChats(p); } } catch { /* geen cache */ }
    loadChats(); /* eslint-disable-next-line */
  }, [slug, url]);

  function newChat() { setMsgs([]); setChatId(null); setProposal(null); setApplied(""); setErr(""); }

  async function openChat(id: number) {
    setProposal(null); setApplied(""); setErr("");
    // Cache-first: toon de berichten direct uit de cache, ververs daarna.
    try { const c = localStorage.getItem(`pw_chat_${id}`); if (c) { const p = JSON.parse(c); if (p?.messages) { setMsgs(p.messages); setChatId(id); } } } catch { /* geen cache */ }
    try {
      const r = await fetch(`/api/admin/page-chats?id=${id}`);
      const d = await r.json();
      if (d.ok && d.chat) { setMsgs(d.chat.messages); setChatId(d.chat.id); try { localStorage.setItem(`pw_chat_${id}`, JSON.stringify(d.chat)); } catch { /* cache is extra */ } }
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
      persist(withReply); // altijd bewaren, ook zonder overnemen
    } catch { setErr("Chat mislukt."); } finally { setBusy(false); }
  }

  // Neemt alleen het PLAN over (met de acties erin). De losse acties worden GEEN
  // aparte werkzaamheden; die lopen via de analyse/blauwdruk/copy-stappen.
  async function applySelected() {
    const plan = proposal?.plan;
    if (!plan) { setErr("Er is geen plan om over te nemen."); return; }
    try {
      const r = await fetch("/api/admin/page-chat/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, plan }) });
      const d = await r.json();
      if (d.ok) {
        setApplied("Plan overgenomen. De acties staan in het plan; leg de analyse vast als werkzaamheid met de knop hieronder.");
        setProposal(null);
        onApplied(plan);
      } else setErr(d.error || "Overnemen mislukt.");
    } catch { setErr("Overnemen mislukt."); }
  }

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

      {proposal?.plan && (
        <div className="page-chat-proposal">
          <div className="page-chat-proposal-head">Voorstel: plan voor deze pagina</div>
          <div className="pch-prop-plan md" dangerouslySetInnerHTML={{ __html: mdToHtml(proposal.plan) }} />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>De losse acties staan in dit plan. Ze worden uitgevoerd via de SEO-analyse, blauwdruk en copy, niet als aparte werkzaamheden.</div>
          <div className="page-chat-proposal-actions">
            <button type="button" className="primary-btn small" onClick={applySelected}>Neem plan over</button>
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
            <button type="button" className="ghost-btn small" onClick={makeWorkItem} disabled={taskGen}>{taskGen ? "Vastleggen…" : "Analyse vastleggen (document + werkzaamheid)"}</button>
            <button type="button" className="ghost-btn small" onClick={makeClientMail}>Mail naar de klant</button>
          </div>
          <div className="page-chat-docs">
            <div className="pcd-docs-head">Documenten (bouwen voort op het plan, de taken en de vorige stap)</div>
            <input className="pcd-nuance" value={nuance} onChange={(e) => setNuance(e.target.value)} placeholder="Extra sturing (optioneel), bijv. leg de nadruk op de regio, of behoud de tarieventabel." />
            <div className="pcd-docs-buttons">
              <button type="button" className="ghost-btn small" onClick={() => genDoc("analyse")} disabled={!!docBusy}>{docBusy === "analyse" ? "Analyse maken…" : "1. Analyse-document"}</button>
              <button type="button" className="ghost-btn small" onClick={() => genDoc("blauwdruk")} disabled={!!docBusy}>{docBusy === "blauwdruk" ? "Blauwdruk maken…" : "2. Blauwdruk-document"}</button>
              <button type="button" className="ghost-btn small" onClick={() => genDoc("copy")} disabled={!!docBusy}>{docBusy === "copy" ? "Copy maken…" : "3. Copy-document (+ dev-taak)"}</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Van elk document wordt automatisch ook een klantversie gemaakt en in de Drive-map opgeslagen. De taaktitel linkt naar de technische versie, met "(klantversie)" ernaast; het klantdashboard toont alleen de klantversie.</div>
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
              <label className="compose-label">Bericht (de conclusie staat er als kern in; schrijf zelf de aanhef en afsluiting eromheen)</label>
              {mailGen && <div className="muted" style={{ marginBottom: 6 }}>Conclusie van de analyse wordt opgehaald…</div>}
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

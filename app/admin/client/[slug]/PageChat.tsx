"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Task = { taak: string; fase?: string; wie?: string };
type Proposal = { plan?: string; tasks?: Task[] };
type ChatSummary = { id: number; title: string; updatedAt: string; count: number };

export default function PageChat({ slug, url, clientEmail, clientName, onApplied }: { slug: string; url: string; clientEmail?: string; clientName?: string; onApplied: (plan?: string) => void }) {
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
  const [mailBody, setMailBody] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState("");

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";

  async function makeClientMail() {
    if (!lastAssistant || mailGen) return;
    setMailGen(true); setErr("");
    try {
      const r = await fetch("/api/admin/page-chat/client-mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, clientName, analysis: lastAssistant }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Mail maken mislukt."); return; }
      setMailBody(d.email || "");
      setMailTo(clientEmail || "");
      setMailSubject(`SEO-analyse ${clientName || ""}`.trim());
      setMailMsg("");
      setMailOpen(true);
    } catch { setErr("Mail maken mislukt."); } finally { setMailGen(false); }
  }

  async function sendClientMail() {
    if (!mailTo.trim() || !mailBody.trim()) { setMailMsg("Vul een ontvanger en tekst in."); return; }
    setMailBusy(true); setMailMsg("");
    try {
      const html = mdToHtml(mailBody);
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
        <div className="page-chat-tools">
          <button type="button" className="ghost-btn small" onClick={makeClientMail} disabled={mailGen}>{mailGen ? "Mail maken…" : "✉ Klant-mail van deze analyse"}</button>
        </div>
      )}

      {applied && <div className="saved-msg" style={{ marginTop: 8 }}>{applied}</div>}
      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}

      <div className="page-chat-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag over deze pagina…" disabled={busy} />
        <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
      </div>

      {mailOpen && (
        <div className="compose-overlay" onClick={() => setMailOpen(false)}>
          <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-head"><span>Analyse mailen naar de klant</span><button type="button" className="chat-float-close" onClick={() => setMailOpen(false)}>&times;</button></div>
            <div className="compose-body">
              <label className="compose-label">Aan (e-mail klant)</label>
              <input className="compose-input" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="klant@bedrijf.nl" />
              <label className="compose-label">Onderwerp</label>
              <input className="compose-input" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
              <label className="compose-label">Bericht (in gewone taal, aanpasbaar)</label>
              <textarea className="compose-input" rows={16} value={mailBody} onChange={(e) => setMailBody(e.target.value)} />
              {mailMsg && <div className={mailMsg.startsWith("Verstuurd") ? "saved-msg" : "login-error"} style={{ marginTop: 8 }}>{mailMsg}</div>}
            </div>
            <div className="compose-foot">
              <button type="button" className="logout-btn" onClick={() => setMailOpen(false)}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={sendClientMail} disabled={mailBusy}>{mailBusy ? "Versturen..." : "Verstuur per mail"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

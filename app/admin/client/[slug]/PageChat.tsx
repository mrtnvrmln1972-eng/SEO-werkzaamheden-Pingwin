"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Proposal = { plan?: string; tasks?: { taak: string; fase?: string; wie?: string }[] };

const QUICK = [
  "Concurreert deze pagina met andere? Analyseer de top 10 en of dit de juiste invulling is.",
  "Klopt de voorgestelde actie in het plan, gezien de live ranking?",
  "Welke zoekwoorden zou deze pagina moeten targeten, en hoe verhoudt dat zich tot de andere clusterpagina's?",
];

export default function PageChat({ slug, url, onApplied }: { slug: string; url: string; onApplied: (plan?: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState("");

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
      setMsgs([...next, { role: "assistant", content: d.reply }]);
      setProposal(d.proposal || null);
    } catch { setErr("Chat mislukt."); } finally { setBusy(false); }
  }

  async function apply(kind: "plan" | "tasks" | "all") {
    if (!proposal) return;
    const payload: { slug: string; url: string; plan?: string; tasks?: Proposal["tasks"] } = { slug, url };
    if (kind !== "tasks" && proposal.plan) payload.plan = proposal.plan;
    if (kind !== "plan" && proposal.tasks?.length) payload.tasks = proposal.tasks;
    try {
      const r = await fetch("/api/admin/page-chat/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.ok) {
        setApplied(`Overgenomen${d.planSaved ? " (plan bijgewerkt)" : ""}${d.tasksAdded ? ` (${d.tasksAdded} taken toegevoegd)` : ""}.`);
        setProposal(null);
        onApplied(payload.plan);
      } else setErr(d.error || "Overnemen mislukt.");
    } catch { setErr("Overnemen mislukt."); }
  }

  return (
    <div className="page-chat">
      <div className="page-chat-head">Chat over deze pagina (gegrond in live status, GSC-ranking en het cluster)</div>

      {msgs.length === 0 && (
        <div className="page-chat-quick">
          {QUICK.map((q) => <button key={q} type="button" onClick={() => send(q)}>{q}</button>)}
        </div>
      )}

      {msgs.length > 0 && (
        <div className="page-chat-log">
          {msgs.map((m, i) => (
            <div key={i} className={"page-chat-msg " + m.role}>{m.content}</div>
          ))}
          {busy && <div className="page-chat-msg assistant muted">Aan het denken…</div>}
        </div>
      )}

      {proposal && (
        <div className="page-chat-proposal">
          <div className="page-chat-proposal-head">Voorstel</div>
          {proposal.plan && <div className="page-chat-plan"><strong>Nieuw plan:</strong> {proposal.plan}</div>}
          {proposal.tasks && proposal.tasks.length > 0 && (
            <ul className="page-chat-tasks">
              {proposal.tasks.map((t, i) => <li key={i}>[{t.fase || "geen fase"}] {t.taak} <span className="muted">({t.wie || "SEO"})</span></li>)}
            </ul>
          )}
          <div className="page-chat-proposal-actions">
            {proposal.plan && <button type="button" className="ghost-btn small" onClick={() => apply("plan")}>Neem plan over</button>}
            {proposal.tasks && proposal.tasks.length > 0 && <button type="button" className="ghost-btn small" onClick={() => apply("tasks")}>Voeg {proposal.tasks.length} taken toe</button>}
            {proposal.plan && proposal.tasks && proposal.tasks.length > 0 && <button type="button" className="primary-btn small" onClick={() => apply("all")}>Neem alles over</button>}
          </div>
        </div>
      )}

      {applied && <div className="saved-msg" style={{ marginTop: 8 }}>{applied}</div>}
      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}

      <div className="page-chat-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag over deze pagina…" disabled={busy} />
        <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
      </div>
    </div>
  );
}

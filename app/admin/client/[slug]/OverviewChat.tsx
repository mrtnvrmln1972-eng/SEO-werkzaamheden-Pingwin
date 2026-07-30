"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

// Lichte Markdown → HTML (kopjes, bullets, vet, links, tabellen). Zelfde regels
// als de zwevende chat, zodat antwoorden overal netjes renderen.
function mdToHtml(md: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escape(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const isSep = (s: string) => /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(s.trim());
  const cells = (s: string) => s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { closeList(); i++; continue; }
    if (line.startsWith("|") && i + 1 < lines.length && isSep(lines[i + 1])) {
      closeList();
      const header = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { body.push(cells(lines[i])); i++; }
      out.push("<table class='chat-table'><thead><tr>" + header.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>");
      for (const row of body) out.push("<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      out.push("</tbody></table>");
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const lvl = Math.min(6, h[1].length + 2); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { closeList(); out.push("<hr/>"); i++; continue; }
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); i++; continue; }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); i++; continue; }
    closeList(); out.push(`<p>${inline(line)}</p>`); i++;
  }
  closeList();
  return out.join("");
}

const BASE = "overzicht";
const labelOf = (t: string) => (t === BASE ? "Overzicht" : t.replace(/^overzicht:/, ""));

// De gedokte bird's eye-chat in de Overzicht-tab. Gebruikt dezelfde chat-backend
// als de zwevende assistent, maar met thread-namespace "overzicht" (de agent is
// dan gegrond in de afgesproken strategie en de site-brede werkstatus).
export default function OverviewChat({ slug, configured, onGoToPage }: { slug: string; configured: boolean; onGoToPage?: (url: string) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [thread, setThread] = useState(BASE);
  const [threads, setThreads] = useState<{ thread: string; count: number }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  // Threads + historie van het actieve gesprek laden.
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(BASE)}`)
      .then((r) => r.json()).then((d) => {
        if (!alive || !d?.ok) return;
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setThreads((d.threads || []).filter((t: { thread: string }) => t.thread.startsWith("overzicht")));
      }).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  async function switchThread(t: string) {
    if (t === thread) return;
    setThread(t); setMessages([]); setError("");
    const d = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(t)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setMessages(d.messages || []); setThreads((d.threads || []).filter((x: { thread: string }) => x.thread.startsWith("overzicht"))); }
  }

  function newThread() {
    const name = window.prompt("Naam van het nieuwe bird's eye-gesprek (bijv. 'Q3-prioriteiten'):", "");
    const clean = (name || "").trim().slice(0, 60);
    if (!clean) return;
    const t = "overzicht:" + clean;
    setThread(t); setMessages([]); setError("");
    setThreads((ts) => (ts.some((x) => x.thread === t) ? ts : [{ thread: t, count: 0 }, ...ts]));
  }

  async function clearChat() {
    if (!window.confirm("Dit gesprek wissen?")) return;
    setMessages([]); setError("");
    await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(thread)}`, { method: "DELETE" }).catch(() => {});
    setThreads((ts) => ts.filter((x) => x.thread !== thread));
    if (thread !== BASE) setThread(BASE);
  }

  function deleteMessage(idx: number) {
    setMessages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      fetch("/api/admin/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, messages: next }) }).catch(() => {});
      return next;
    });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(""); setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setBusy(true);
    try {
      const res = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, messages: next }) });
      const data = await res.json();
      if (data.ok) { setMessages((m) => [...m, { role: "assistant", content: data.answer }]); setThreads((ts) => (ts.some((x) => x.thread === thread) ? ts : [{ thread, count: next.length + 1 }, ...ts])); }
      else setError(data.error || "Er ging iets mis.");
    } catch { setError("De assistent is niet bereikbaar."); } finally { setBusy(false); }
  }

  if (!configured) {
    return <div className="cockpit-card ovc-card"><div className="phase2-note">De bird&rsquo;s eye-assistent staat klaar, maar mist nog de AI-sleutel (<code>ANTHROPIC_API_KEY</code> in Vercel).</div></div>;
  }

  return (
    <div className="cockpit-card ovc-card">
      <div className="ovc-head">
        <span className="ovc-title"><span className="chat-fab-dot" /> Bird&rsquo;s eye-assistent</span>
        <select className="chat-thread-select" value={thread} onChange={(e) => switchThread(e.target.value)}>
          {(threads.some((t) => t.thread === thread) ? threads : [{ thread, count: messages.length }, ...threads]).map((t) => (
            <option key={t.thread} value={t.thread}>{labelOf(t.thread)}{t.count ? ` (${t.count})` : ""}</option>
          ))}
        </select>
        <button type="button" className="ghost-btn small" onClick={newThread}>+ Nieuw</button>
        {messages.length > 0 && <button type="button" className="ghost-btn small" onClick={clearChat}>Wissen</button>}
      </div>

      <div className="ovc-log">
        {messages.length === 0 && !busy && (
          <div className="ovc-intro muted">
            Vraag bijvoorbeeld: <em>&ldquo;Waar staan we, wat pakken we als eerste op?&rdquo;</em>, <em>&ldquo;Welke pagina&rsquo;s uit onze afgesproken navigatie moeten we nog bouwen?&rdquo;</em>, of <em>&ldquo;Wat hebben we de afgelopen tijd gedaan?&rdquo;</em>. Ik werk vanuit jullie afgesproken strategie en de stand van zaken.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"ovc-msg " + m.role}>
            <button type="button" className="chat-msg-del" title="Dit blok verwijderen" onClick={() => deleteMessage(i)}>&times;</button>
            {m.role === "assistant"
              ? <div className="ovc-bubble chat-md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
              : <div className="ovc-bubble">{m.content}</div>}
          </div>
        ))}
        {busy && <div className="ovc-msg assistant"><div className="ovc-bubble muted">Aan het nadenken (ik lees zo nodig de strategie en meet pagina&rsquo;s na)…</div></div>}
        <div ref={endRef} />
      </div>

      {error && <div className="login-error" style={{ margin: "6px 0" }}>{error}</div>}

      <div className="ovc-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag of geef een instructie…" disabled={busy} />
        <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
      </div>
    </div>
  );
}

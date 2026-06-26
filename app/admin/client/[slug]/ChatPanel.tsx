"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

// Lichte Markdown → HTML voor nette antwoorden (kopjes, bullets, vet, links).
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
    // Markdown-tabel
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

const SUGGESTIONS = [
  "Wat is de laatste stand van zaken?",
  "Wat staat er nog open bij de klant?",
  "Wat zijn de laatste vragen over en weer?",
  "Hoe staan we ervoor in Search Console?",
];

export default function ChatPanel({ slug, configured, initialMessages }: { slug: string; configured: boolean; initialMessages: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages || []);
  const [collapsed, setCollapsed] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError("");
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages: next }),
      });
      const data = await res.json();
      if (data.ok) setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      else setError(data.error || "Er ging iets mis.");
    } catch {
      setError("De assistent is niet bereikbaar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-fab-wrap">
      {collapsed ? (
        <button type="button" className="chat-fab" onClick={() => setCollapsed(false)}>
          <span className="chat-fab-dot" /> SEO-assistent{messages.length > 0 ? ` (${messages.length})` : ""}
        </button>
      ) : (
        <div className="chat-float">
          <div className="chat-float-head">
            <span>SEO-assistent</span>
            <button type="button" className="chat-float-close" onClick={() => setCollapsed(true)} aria-label="Sluiten">&times;</button>
          </div>
          <div className="chat-float-body">
            {!configured ? (
              <div className="phase2-note">
                De assistent staat klaar, maar mist nog de AI-sleutel (<code>ANTHROPIC_API_KEY</code> in Vercel).
                Zodra die er staat, kun je hier vragen stellen over deze klant (mail, stand van zaken, taken, Search Console, Ahrefs).
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="chat-suggest">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" className="ql ql-btn" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                )}

                <div className="chat-log">
                  {messages.map((m, i) => (
                    <div key={i} className={"chat-msg " + m.role}>
                      {m.role === "assistant"
                        ? <div className="chat-bubble chat-md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                        : <div className="chat-bubble">{m.content}</div>}
                    </div>
                  ))}
                  {busy && <div className="chat-msg assistant"><div className="chat-bubble muted">Aan het denken…</div></div>}
                  <div ref={endRef} />
                </div>

                {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}

                <div className="chat-input">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
                    placeholder="Stel een vraag over dit project…"
                    disabled={busy}
                  />
                  <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>
                    Vraag
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

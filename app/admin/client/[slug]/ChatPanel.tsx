"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Wat is de laatste stand van zaken?",
  "Wat staat er nog open bij de klant?",
  "Wat zijn de laatste vragen over en weer?",
  "Hoe staan we ervoor in Search Console?",
];

export default function ChatPanel({ slug, configured }: { slug: string; configured: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
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
    <div className="cockpit-card">
      <div className="ck-section-head"><span>Vraag het de assistent</span></div>

      {!configured ? (
        <div className="phase2-note">
          De projectchat staat klaar, maar mist nog de AI-sleutel (<code>ANTHROPIC_API_KEY</code> in Vercel).
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
                <div className="chat-bubble">{m.content}</div>
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
  );
}

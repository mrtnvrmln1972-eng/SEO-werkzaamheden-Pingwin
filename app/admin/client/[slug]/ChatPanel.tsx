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
  const [thread, setThread] = useState("algemeen");
  const [threads, setThreads] = useState<{ thread: string; count: number; updatedAt: string }[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Sleepbare positie van het venster (per klant onthouden), zodat het niet vast in
  // de rechteronderhoek zit en je eronder kunt kijken.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // Zelf ingestelde grootte van het venster (per klant onthouden). null = standaard uit de CSS.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    try { const c = localStorage.getItem(`pw_chatpos_${slug}`); if (c) { const p = JSON.parse(c); if (typeof p?.x === "number") setPos(p); } } catch { /* geen opslag */ }
    try { const c = localStorage.getItem(`pw_chatsize_${slug}`); if (c) { const s = JSON.parse(c); if (typeof s?.w === "number" && typeof s?.h === "number") setSize(s); } } catch { /* geen opslag */ }
  }, [slug]);

  function onDragStart(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return; // knoppen niet als sleep
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const rect = wrapRef.current?.getBoundingClientRect();
    const origX = rect ? rect.left : window.innerWidth - 660, origY = rect ? rect.top : window.innerHeight - 560;
    const move = (ev: MouseEvent) => {
      const nx = Math.max(4, Math.min(window.innerWidth - 80, origX + (ev.clientX - startX)));
      const ny = Math.max(4, Math.min(window.innerHeight - 60, origY + (ev.clientY - startY)));
      setPos({ x: nx, y: ny });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setPos((p) => { if (p) { try { localStorage.setItem(`pw_chatpos_${slug}`, JSON.stringify(p)); } catch { /* geheugen is extra */ } } return p; });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  // Grootte aanpassen via de hoek linksboven: de rechteronderhoek blijft vast, zodat
  // het venster de schermin (naar linksboven) groeit i.p.v. buiten beeld te lopen.
  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX, startY = e.clientY, startW = rect.width, startH = rect.height;
    const rightEdge = rect.left + rect.width, bottomEdge = rect.top + rect.height;
    const minW = 360, minH = 340;
    const maxW = Math.min(920, rightEdge - 8), maxH = Math.min(Math.round(window.innerHeight * 0.92), bottomEdge - 8);
    const move = (ev: MouseEvent) => {
      const w = Math.max(minW, Math.min(maxW, startW - (ev.clientX - startX)));
      const h = Math.max(minH, Math.min(maxH, startH - (ev.clientY - startY)));
      setSize({ w, h });
      setPos({ x: Math.max(4, rightEdge - w), y: Math.max(4, bottomEdge - h) });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setSize((s) => { if (s) { try { localStorage.setItem(`pw_chatsize_${slug}`, JSON.stringify(s)); } catch { /* extra */ } } return s; });
      setPos((p) => { if (p) { try { localStorage.setItem(`pw_chatpos_${slug}`, JSON.stringify(p)); } catch { /* extra */ } } return p; });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  // Alle gesprekken (threads) van deze klant laden voor de keuzelijst.
  useEffect(() => {
    fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) setThreads(d.threads || []); }).catch(() => {});
  }, [slug]);

  // Wisselen naar een ander gesprek: de historie van dat gesprek laden.
  async function switchThread(t: string) {
    if (t === thread) return;
    setThread(t); setMessages([]); setError("");
    const d = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(t)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setMessages(d.messages || []); setThreads(d.threads || []); }
  }

  // Nieuw gesprek starten (bijv. over een pagina, situatie of onderwerp).
  function newThread() {
    const name = window.prompt("Naam van het nieuwe gesprek (bijv. een pagina, situatie of onderwerp):", "");
    const t = (name || "").trim().slice(0, 80);
    if (!t) return;
    setThread(t); setMessages([]); setError("");
    setThreads((ts) => (ts.some((x) => x.thread === t) ? ts : [{ thread: t, count: 0, updatedAt: "" }, ...ts]));
  }

  // Wist het huidige gesprek (lokaal + op de server) zodat de assistent schoon begint.
  async function clearChat() {
    if (!window.confirm("Dit gesprek wissen?")) return;
    setMessages([]); setError("");
    await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(thread)}`, { method: "DELETE" }).catch(() => {});
    setThreads((ts) => ts.filter((x) => x.thread !== thread));
    if (thread !== "algemeen") setThread("algemeen");
  }

  // Legt het huidige gesprek vast als site-wide strategie-sessie (Taken-tabblad):
  // AI maakt er een beschrijvende titel, de conclusie en de actiepunten van.
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [strategyMsg, setStrategyMsg] = useState("");
  async function saveStrategy() {
    if (strategyBusy || messages.length < 2) return;
    setStrategyBusy(true); setStrategyMsg(""); setError("");
    try {
      const res = await fetch("/api/admin/strategy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages }),
      });
      const d = await res.json();
      if (d.ok) setStrategyMsg(`Vastgelegd als strategie-sessie "${d.session?.title || ""}". Je vindt hem bovenaan het Taken-tabblad onder Site-wide strategie, met de actiepunten om als taak toe te voegen.`);
      else setError(d.error || "Vastleggen mislukt.");
    } catch { setError("Vastleggen mislukt."); } finally { setStrategyBusy(false); }
  }

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
        body: JSON.stringify({ slug, thread, messages: next }),
      });
      const data = await res.json();
      if (data.ok) { setMessages((m) => [...m, { role: "assistant", content: data.answer }]); setThreads((ts) => (ts.some((x) => x.thread === thread) ? ts : [{ thread, count: next.length + 1, updatedAt: "" }, ...ts])); }
      else setError(data.error || "Er ging iets mis.");
    } catch {
      setError("De assistent is niet bereikbaar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-fab-wrap" ref={wrapRef} style={!collapsed && pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}>
      {collapsed ? (
        <button type="button" className="chat-fab" onClick={() => setCollapsed(false)}>
          <span className="chat-fab-dot" /> SEO-assistent{messages.length > 0 ? ` (${messages.length})` : ""}
        </button>
      ) : (
        <div className="chat-float" style={size ? { width: size.w, height: size.h, maxWidth: "none", maxHeight: "none" } : undefined}>
          <div className="chat-resize" onMouseDown={onResizeStart} title="Sleep deze hoek om het venster groter of kleiner te maken" />
          <div className="chat-float-head" onMouseDown={onDragStart} style={{ cursor: "move" }} title="Sleep om te verplaatsen">
            <span>SEO-assistent</span>
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              {messages.length > 0 && <button type="button" className="chat-float-clear" onClick={clearChat}>Wissen</button>}
              <button type="button" className="chat-float-close" onClick={() => setCollapsed(true)} aria-label="Sluiten">&times;</button>
            </span>
          </div>
          <div className="chat-float-body">
            {!configured ? (
              <div className="phase2-note">
                De assistent staat klaar, maar mist nog de AI-sleutel (<code>ANTHROPIC_API_KEY</code> in Vercel).
                Zodra die er staat, kun je hier vragen stellen over deze klant (mail, stand van zaken, taken, Search Console, Ahrefs).
              </div>
            ) : (
              <>
                <div className="chat-threads">
                  <span className="chat-threads-label">Gesprek:</span>
                  <select className="chat-thread-select" value={thread} onChange={(e) => switchThread(e.target.value)}>
                    {(threads.some((t) => t.thread === thread) ? threads : [{ thread, count: messages.length, updatedAt: "" }, ...threads]).map((t) => (
                      <option key={t.thread} value={t.thread}>{t.thread === "algemeen" ? "Algemeen" : t.thread}{t.count ? ` (${t.count})` : ""}</option>
                    ))}
                  </select>
                  <button type="button" className="ghost-btn small" onClick={newThread}>+ Nieuw</button>
                  {messages.length >= 2 && (
                    <button type="button" className="ghost-btn small" onClick={saveStrategy} disabled={strategyBusy} title="Legt dit hele gesprek (met conclusie en actiepunten) vast als sessie onder Site-wide strategie, bovenaan het Taken-tabblad.">
                      {strategyBusy ? "Vastleggen…" : "→ Site-wide strategie"}
                    </button>
                  )}
                </div>
                {strategyMsg && <div className="saved-msg" style={{ margin: "6px 0" }}>{strategyMsg}</div>}
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

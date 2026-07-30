"use client";

import { useState, useRef, useEffect } from "react";
import ActionCard, { type Action } from "./ActionCard";

type Msg = { role: "user" | "assistant"; content: string; actions?: Action[] };
type Topic = { thread: string; count: number; title: string; summary: string; done: boolean };

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
const labelOf = (t: string) => (t === BASE ? "Algemeen" : t.startsWith("overzicht:~") ? "Nieuw onderwerp" : t.replace(/^overzicht:/, ""));

// De gedokte bird's eye-assistent, nu per ONDERWERP (toggle). Elk onderwerp is
// standaard dichtgeklapt en toont zijn titel plus een korte samenvatting; je klapt
// er een open om het gesprek en de actie-kaarten te zien, en je kunt een onderwerp
// afvinken als "gedaan". Zo zie je in één oogopslag wat er speelt, zonder muur.
export default function OverviewChat({ slug, configured, onGoToPage, onGoToTask }: { slug: string; configured: boolean; onGoToPage?: (url: string) => void; onGoToTask?: (taskId: number) => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [open, setOpen] = useState<string | null>(null);      // welk onderwerp is uitgeklapt (accordion)
  const [messages, setMessages] = useState<Msg[]>([]);        // berichten van het open onderwerp
  const [titleDraft, setTitleDraft] = useState("");           // bewerkbare titel van het open onderwerp
  const [sumDraft, setSumDraft] = useState("");               // bewerkbare samenvatting van het open onderwerp
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadSeq = useRef(0);
  const openRef = useRef<string | null>(null);
  useEffect(() => { openRef.current = open; }, [open]);

  // Onderwerpen (threads) laden, alleen de bird's eye-namespace ("overzicht*").
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => {
        if (!alive || !d?.ok) return;
        setTopics(normalizeTopics(d.threads || []));
      }).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  // Zorg dat het basisonderwerp altijd bestaat, en sorteer: openstaand eerst,
  // "gedaan" onderaan.
  function normalizeTopics(threads: { thread: string; count?: number; title?: string; summary?: string; done?: boolean }[]): Topic[] {
    const mine = threads.filter((t) => t.thread.startsWith("overzicht"));
    const list: Topic[] = mine.map((t) => ({ thread: t.thread, count: t.count || 0, title: t.title || "", summary: t.summary || "", done: !!t.done }));
    if (!list.some((t) => t.thread === BASE)) list.unshift({ thread: BASE, count: 0, title: "", summary: "", done: false });
    return list.sort((a, b) => Number(a.done) - Number(b.done));
  }

  // Groeit mee en springt naar het laatste bericht van het open onderwerp.
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);
  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; }
  }, [input, open]);

  async function toggleOpen(t: Topic) {
    if (open === t.thread) { setOpen(null); setMessages([]); setError(""); return; }
    setOpen(t.thread); setMessages([]); setError(""); setInput(""); setTitleDraft(t.title || ""); setSumDraft(t.summary || "");
    const seq = ++loadSeq.current;
    const d = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(t.thread)}`).then((r) => r.json()).catch(() => null);
    if (seq !== loadSeq.current) return;               // een nieuwer onderwerp is intussen geopend
    if (d?.ok) { setMessages(d.messages || []); setTopics(normalizeTopics(d.threads || [])); }
  }

  // Nieuw onderwerp: geen naam-prompt. Je begint gewoon met een vraag; de titel en
  // samenvatting worden daarna automatisch ingevuld.
  function newTopic() {
    const t = "overzicht:~" + Date.now().toString(36);
    setTopics((ts) => [{ thread: t, count: 0, title: "", summary: "", done: false }, ...ts]);
    setOpen(t); setMessages([]); setError(""); setInput(""); setTitleDraft(""); setSumDraft("");
  }

  // Weergavetitel: eigen titel als die er is, anders de naam uit de thread.
  const titleOf = (t: Topic) => (t.title && t.title.trim()) || labelOf(t.thread);

  async function saveTitle(thread: string, title: string) {
    setTopics((ts) => ts.map((x) => x.thread === thread ? { ...x, title } : x));
    await fetch("/api/admin/overview/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, title }) }).catch(() => {});
  }

  async function saveSummary(thread: string, summary: string) {
    setTopics((ts) => ts.map((x) => x.thread === thread ? { ...x, summary } : x));
    await fetch("/api/admin/overview/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, summary }) }).catch(() => {});
  }

  async function toggleDone(thread: string, done: boolean) {
    setTopics((ts) => normalizeTopics(ts.map((x) => x.thread === thread ? { ...x, done } : x)));
    if (done && open === thread) { setOpen(null); setMessages([]); }
    await fetch("/api/admin/overview/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, done }) }).catch(() => {});
  }

  async function clearChat(thread: string) {
    if (!window.confirm("Dit onderwerp wissen?")) return;
    setMessages([]); setOpen(null);
    setTopics((ts) => ts.filter((x) => x.thread !== thread || x.thread === BASE).map((x) => x.thread === thread ? { ...x, count: 0, summary: "", done: false } : x));
    await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(thread)}`, { method: "DELETE" }).catch(() => {});
  }

  function handleExecuted(id: string, result: NonNullable<Action["result"]>, executed: boolean) {
    setMessages((prev) => prev.map((m) => m.actions ? { ...m, actions: m.actions.map((a) => a.id === id ? { ...a, executed, result } : a) } : m));
  }

  function deleteMessage(idx: number) {
    if (!open) return;
    const t = open;
    setMessages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      fetch("/api/admin/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: t, messages: next }) }).catch(() => {});
      return next;
    });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !open) return;
    const t = open;
    setError(""); setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setBusy(true);
    try {
      const res = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: t, messages: next }) });
      const data = await res.json();
      if (data.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.answer, ...(Array.isArray(data.actions) && data.actions.length ? { actions: data.actions } : {}) }]);
        const newTitle = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "";
        const newSum = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : "";
        setTopics((ts) => ts.map((x) => x.thread === t ? { ...x, count: next.length + 1, ...(newTitle ? { title: newTitle } : {}), ...(newSum ? { summary: newSum } : {}) } : x));
        if (openRef.current === t) { if (newTitle) setTitleDraft(newTitle); if (newSum) setSumDraft(newSum); }
      } else setError(data.error || "Er ging iets mis.");
    } catch { setError("De assistent is niet bereikbaar."); } finally { setBusy(false); }
  }

  if (!configured) {
    return <div className="cockpit-card ovc-card"><div className="phase2-note">De bird&rsquo;s eye-assistent staat klaar, maar mist nog de AI-sleutel (<code>ANTHROPIC_API_KEY</code> in Vercel).</div></div>;
  }

  return (
    <div className="cockpit-card ovc-card">
      <div className="ovc-head">
        <span className="ovc-title"><span className="chat-fab-dot" /> Bird&rsquo;s eye-assistent</span>
        <button type="button" className="ghost-btn small" onClick={newTopic}>+ Nieuw onderwerp</button>
      </div>

      <div className="ovc-topics">
        {topics.map((t) => {
          const isOpen = open === t.thread;
          return (
            <div key={t.thread} className={"ovc-topic" + (t.done ? " done" : "") + (isOpen ? " open" : "")}>
              <div className="ovc-topic-head" onClick={() => toggleOpen(t)}>
                <span className="ovc-caret">{isOpen ? "▾" : "▸"}</span>
                <input
                  type="checkbox"
                  className="ovc-done"
                  checked={t.done}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => toggleDone(t.thread, e.target.checked)}
                  title="Markeer dit onderwerp als gedaan"
                />
                <span className="ovc-topic-title">{titleOf(t)}</span>
                {!isOpen && t.summary && <span className="ovc-topic-sum">{t.summary}</span>}
              </div>

              {isOpen && (
                <div className="ovc-topic-body">
                  <input
                    className="ovc-title-edit"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => { if (titleDraft.trim() !== (t.title || "").trim()) saveTitle(t.thread, titleDraft.trim()); }}
                    placeholder="Titel van dit onderwerp (bijv. 'Trifocale lenzenpagina's')"
                    maxLength={80}
                  />
                  <input
                    className="ovc-sum-edit"
                    value={sumDraft}
                    onChange={(e) => setSumDraft(e.target.value)}
                    onBlur={() => { if (sumDraft.trim() !== (t.summary || "").trim()) saveSummary(t.thread, sumDraft.trim()); }}
                    placeholder="Korte samenvatting (1 regel): wat speelt er in dit onderwerp?"
                    maxLength={200}
                  />

                  <div className="ovc-log">
                    {messages.map((m, i) => (
                      <div key={i} className={"ovc-msg " + m.role}>
                        <button type="button" className="chat-msg-del" title="Dit blok verwijderen" onClick={() => deleteMessage(i)}>&times;</button>
                        {m.role === "assistant"
                          ? <div className="ovc-bubble chat-md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                          : <div className="ovc-bubble">{m.content}</div>}
                        {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                          <div className="ovc-actions">
                            {m.actions.map((a) => (
                              <ActionCard key={a.id} action={a} slug={slug} thread={t.thread} onExecuted={handleExecuted} onGoToPage={onGoToPage} onGoToTask={onGoToTask} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {busy && <div className="ovc-msg assistant"><div className="ovc-bubble muted">Aan het nadenken (ik lees zo nodig de strategie en meet pagina&rsquo;s na)…</div></div>}
                    <div ref={endRef} />
                  </div>

                  {error && <div className="login-error" style={{ margin: "6px 0" }}>{error}</div>}

                  <div className="ovc-input">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                      placeholder="Stel een vraag of geef een instructie… (Shift+Enter voor een nieuwe regel)"
                      disabled={busy}
                    />
                    <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
                    {messages.length > 0 && <button type="button" className="ghost-btn small" onClick={() => clearChat(t.thread)}>Wissen</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

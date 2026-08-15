"use client";

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import HelpHint from "./HelpHint";

// ═══════════════════════════════════════════════════════════
// SITE-WIDE STRATEGIE, bovenaan het Taken-tabblad
// ═══════════════════════════════════════════════════════════
// Toont de strategie-sessies die vanuit de SEO-assistent zijn vastgelegd, elk als
// eigen toggle: de conclusie/terugkoppeling, het volledige gesprek (uitklapbaar)
// en de actiepunten, die je met één klik als taak (zonder maand) toevoegt.
// ═══════════════════════════════════════════════════════════

type StrategyAction = { taak: string; wie: string; fase: string; taskId?: number; done?: boolean };
type StrategySession = { id: number; title: string; summary: string; transcript: string; actions: StrategyAction[]; createdAt: string };
export type StrategySessionData = StrategySession;

function dNl(iso: string): string {
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; }
}

export default function StrategyPanel({ slug, initialSessions, openSessionId, onTaskAdded }: { slug: string; initialSessions?: StrategySession[]; openSessionId?: number; onTaskAdded?: () => void }) {
  // Sessies komen server-side mee (initialSessions), zodat het blok direct samen
  // met de rest van het tabblad in beeld staat; zonder die prop halen we ze op.
  const [sessions, setSessions] = useState<StrategySession[]>(initialSessions || []);
  const [open, setOpen] = useState(false);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [openTranscript, setOpenTranscript] = useState<Set<number>>(new Set());
  const [busyKey, setBusyKey] = useState("");
  const [msg, setMsg] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const d = await fetch(`/api/admin/strategy?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setSessions(d.sessions || []);
    } catch { /* stil */ }
  }
  useEffect(() => { if (!initialSessions) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Vanuit een taak-link (?strategie=<id>): sectie én die sessie openklappen en erheen scrollen.
  useEffect(() => {
    if (!openSessionId || !sessions.some((s) => s.id === openSessionId)) return;
    setOpen(true);
    setOpenIds((s) => new Set(s).add(openSessionId));
    setTimeout(() => wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [openSessionId, sessions.length]);

  const toggleId = (id: number, set: Set<number>, setter: (s: Set<number>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    setter(n);
  };

  async function addTask(sessionId: number, actionIndex: number) {
    const key = `${sessionId}:${actionIndex}`;
    if (busyKey) return;
    setBusyKey(key); setMsg("");
    try {
      const d = await fetch("/api/admin/strategy/task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sessionId, actionIndex }),
      }).then((r) => r.json());
      if (d.ok) {
        setSessions((ss) => ss.map((s) => s.id !== sessionId ? s : { ...s, actions: s.actions.map((a, i) => (i === actionIndex ? { ...a, taskId: d.taskId } : a)) }));
        setMsg("Taak toegevoegd (zonder maand); hij staat hieronder tussen de werkzaamheden.");
        onTaskAdded?.();
      } else setMsg(d.error || "Toevoegen mislukt.");
    } catch { setMsg("Toevoegen mislukt."); } finally { setBusyKey(""); }
  }

  // Actiepunt afvinken als verwerkt (of terugdraaien); wordt opgeslagen op de sessie.
  async function toggleDone(sessionId: number, actionIndex: number, done: boolean) {
    setSessions((ss) => ss.map((s) => s.id !== sessionId ? s : { ...s, actions: s.actions.map((a, i) => (i === actionIndex ? { ...a, done } : a)) }));
    try {
      await fetch("/api/admin/strategy", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sessionId, actionIndex, done }),
      });
    } catch { /* status is hulpinfo */ }
  }

  async function removeSession(id: number) {
    if (!window.confirm("Deze strategie-sessie verwijderen? (Al toegevoegde taken blijven bestaan.)")) return;
    try {
      const d = await fetch(`/api/admin/strategy?slug=${encodeURIComponent(slug)}&id=${id}`, { method: "DELETE" }).then((r) => r.json());
      if (d.ok) setSessions((ss) => ss.filter((s) => s.id !== id));
    } catch { /* stil */ }
  }

  if (sessions.length === 0) return null;

  return (
    <div className="cockpit-card acc-blue strategy-card" ref={wrapRef}>
      <button type="button" className="strategy-head" onClick={() => setOpen((v) => !v)}>
        <span className="strategy-caret">{open ? "▾" : "▸"}</span>
        <span className="strategy-title">Site-wide strategie ({sessions.length}) <HelpHint xl title="Site-wide strategie: de rode draad boven de pagina's" text={"Waar de strategie-stap per pagina over één URL gaat, gaat dit blok over de **site als geheel**: sitestructuur, thema-keuzes, welke clusters prioriteit krijgen, hoe de autoriteit verdeeld wordt.\n## Hoe een sessie ontstaat\nJe voert het gesprek met de **SEO-assistent** (de zwevende chat rechtsonder, met dezelfde databronnen als de pagina-chat: Search Console, Ahrefs, de paginalijst en het klantprofiel) en klikt daar op 'Naar Site-wide strategie'. Het hele gesprek wordt dan hier vastgelegd als sessie.\n## Wat je hier ziet en doet\n- **Per sessie een toggle** met de conclusie bovenaan, het volledige gesprek eronder en de concrete actiepunten eruit gelicht.\n- **Actiepunten worden werk:** één klik maakt van een actiepunt een taak in Werkzaamheden, of je vinkt hem af als al verwerkt.\n- Zo kun je vrij sparren en filosoferen in de chat, terwijl hier alleen de bruikbare, uitvoerbare strategie overblijft; met de onderbouwing er voor altijd bij."} /></span>
      </button>
      {open && (
        <div className="strategy-body">
          {msg && <div className="saved-msg" style={{ marginBottom: "var(--s-2)" }}>{msg}</div>}
          {sessions.map((s) => {
            const isOpen = openIds.has(s.id);
            return (
              <div key={s.id} className="strategy-session" id={`strategie-${s.id}`}>
                <div className="strategy-session-head">
                  <button type="button" className="strategy-session-toggle" onClick={() => toggleId(s.id, openIds, setOpenIds)}>
                    <span className="strategy-caret">{isOpen ? "▾" : "▸"}</span>
                    <span className="strategy-session-title">{s.title}</span>
                    <span className="strategy-session-date">{dNl(s.createdAt)}</span>
                  </button>
                  <button type="button" className="ghost-btn small strategy-del" onClick={() => removeSession(s.id)} title="Sessie verwijderen">verwijderen</button>
                </div>
                {isOpen && (
                  <div className="strategy-session-body">
                    {s.summary && <div className="md strategy-summary" dangerouslySetInnerHTML={{ __html: mdToHtml(s.summary) }} />}
                    {s.actions.length > 0 && (
                      <div className="strategy-actions">
                        <div className="strategy-actions-title">Actiepunten uit dit gesprek</div>
                        {s.actions.map((a, i) => (
                          <div key={i} className={"strategy-action" + (a.done ? " strategy-action-verwerkt" : "")}>
                            <span className="strategy-action-taak">{a.taak}</span>
                            {a.done
                              ? <button type="button" className="ghost-btn small strategy-verwerkt-btn on" onClick={() => toggleDone(s.id, i, false)} title="Klik om het verwerkt-vinkje weer weg te halen">Verwerkt</button>
                              : <button type="button" className="ghost-btn small strategy-verwerkt-btn" onClick={() => toggleDone(s.id, i, true)} title="Markeer dit actiepunt als verwerkt (zonder er een taak van te maken)">Verwerkt</button>}
                            {a.taskId
                              ? <span className="strategy-action-done" title="Deze staat al tussen de werkzaamheden">✓ in taken</span>
                              : <button type="button" className="ghost-btn small" disabled={busyKey === `${s.id}:${i}`} onClick={() => addTask(s.id, i)}>{busyKey === `${s.id}:${i}` ? "Bezig…" : "+ Toevoegen aan taken"}</button>}
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" className="ghost-btn small" style={{ marginTop: "var(--s-2)" }} onClick={() => toggleId(s.id, openTranscript, setOpenTranscript)}>
                      {openTranscript.has(s.id) ? "Volledig gesprek verbergen" : "Volledig gesprek tonen"}
                    </button>
                    {openTranscript.has(s.id) && <div className="md strategy-transcript" dangerouslySetInnerHTML={{ __html: mdToHtml(s.transcript) }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import HelpHint from "./HelpHint";

type Msg = { role: "user" | "assistant"; content: string };
type Task = { taak: string; fase?: string; wie?: string };
type Proposal = { plan?: string; tasks?: Task[] };
type ChatSummary = { id: number; title: string; updatedAt: string; count: number };

// Kant-en-klare opdracht voor de "Vat samen tot conclusie & strategie"-knop.
// Consolideert het hele gesprek tot één definitieve conclusie/strategie, die via
// het bestaande voorstel-mechanisme als plan voor de pagina overgenomen wordt.
const SUMMARIZE_PROMPT =
  "Vat ons hele gesprek over deze pagina samen tot één definitieve conclusie en strategie, gegrond op wat we hierboven hebben besproken en de live feiten. Dit is de eindconclusie die ik als plan voor deze pagina wil overnemen, dus stel geen nieuwe vragen meer. Geef scherp en uitvoerbaar: de rol en het doel van de pagina in één zin; het primaire en secundaire zoekwoord (met de onderbouwing die we bespraken, zoals volume en zoekintentie); en de concrete acties, elk met de fase (Bouwen/Herbedraden/Opschonen) en of het SEO- of Dev-werk is. Sluit af met de doel-URL.";

export default function PageChat({ slug, url, clientEmail, clientName, onApplied, onGoToTask, onClusterApplied }: { slug: string; url: string; clientEmail?: string; clientName?: string; onApplied: (plan?: string) => void; onGoToTask?: (taskId: number) => void; onClusterApplied?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  // Of het gesprek van de actieve chat uitgeklapt is (toggle in de lijst).
  const [convoOpen, setConvoOpen] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState("");
  // Cluster-advies doorgeven aan betrokken pagina's (null = nog niet gezocht).
  const [clusterBusy, setClusterBusy] = useState(false);
  const [clusterItems, setClusterItems] = useState<{ url: string; advice: string }[] | null>(null);
  const [clusterSel, setClusterSel] = useState<string[]>([]);
  const [clusterMsg, setClusterMsg] = useState("");
  // Aantal pagina's waaraan het advies is doorgegeven (>0 = knop wordt groen "doorgegeven").
  const [clusterDone, setClusterDone] = useState(0);
  // Achtergrond-run (analyse -> blauwdruk -> copy los van de browser).
  type DocRun = { id: number; status: string; steps: Record<string, string>; links: Record<string, string>; error: string };
  const [run, setRun] = useState<DocRun | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  // Per-pagina cannibalisatie- + content-mapping-analyse (achtergrond).
  const [pc, setPc] = useState<{ status: string; result: string; error: string; updatedAt: string | null } | null>(null);
  const [pcBusy, setPcBusy] = useState(false);
  const [pcOpen, setPcOpen] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  // Een chat-bericht bewerken (welke index) — gerenderde contentEditable, geen ruwe textarea.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  // Cluster-advies dat AAN deze pagina is meegegeven (vertrekpunt van een andere analyse).
  const [incoming, setIncoming] = useState<{ advice: string; sourceUrl: string; sourceAnalysis: string }[]>([]);
  const [incomingOpen, setIncomingOpen] = useState(false);
  // Per-pagina cannibalisatie-analyse: laden + pollen tijdens het draaien.
  async function loadPc() {
    try {
      const d = await fetch(`/api/admin/page-cannibal?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d.ok) setPc({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  useEffect(() => { loadPc(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, url]);
  useEffect(() => {
    if (pc?.status !== "running") return;
    const t = setInterval(loadPc, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [pc?.status, slug, url]);
  async function runPc() {
    if (pcBusy || pc?.status === "running") return;
    setPcBusy(true);
    setPc((s) => (s ? { ...s, status: "running", error: "" } : { status: "running", result: "", error: "", updatedAt: null }));
    try {
      const d = await fetch("/api/admin/page-cannibal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await loadPc(); return; }
      setPcOpen(true);
      await loadPc();
    } catch { setErr("Starten mislukt."); await loadPc(); } finally { setPcBusy(false); }
  }
  // "Aanbevelingen overnemen": redirects + interne links als Dev-taak met document,
  // en de de-optimalisatie-info als basis naar de betreffende pagina's.
  async function applyRec() {
    if (applyBusy) return;
    setApplyBusy(true); setApplyMsg("");
    try {
      const d = await fetch("/api/admin/page-cannibal/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setApplyMsg(d.error || "Overnemen mislukt."); return; }
      const parts = ["Dev-taak aangemaakt in Werkzaamheden"];
      if (d.docLink) parts.push("met document");
      if (d.advicePages) parts.push(`, basisinfo doorgezet naar ${d.advicePages} pagina('s)`);
      setApplyMsg(parts.join(" ") + ".");
      onApplied();
    } catch { setApplyMsg("Overnemen mislukt."); } finally { setApplyBusy(false); }
  }

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";
  // Wordt het gesprek nu uitgeklapt getoond? Zo ja, staat de vervolgvraag al in het
  // gesprek zelf (boven de knoppen) en verbergen we het losse invoerveld onderaan.
  const convoShown = msgs.length > 0 && convoOpen;
  // Titel voor de analyse-toggle: "ANALYSE: /pad/" van deze pagina.
  const analyseTitle = "ANALYSE: " + ((url || "").replace(/^https?:\/\/[^/]+/i, "").trim() || url).toUpperCase();

  const [taskGen, setTaskGen] = useState(false);
  // Analyse vastgelegd (taak + document) → knop wordt groen "Analyse vastgelegd".
  const [taskDone, setTaskDone] = useState(false);
  // Vat de chat-analyse samen tot één document (Drive of download) en legt de
  // analyse vast als ÉÉN werkzaamheid met dat document eraan gekoppeld.
  async function makeWorkItem() {
    if (!lastAssistant || taskGen) return;
    setTaskGen(true); setErr(""); setApplied("");
    try {
      const payload = { slug, url, analysis: lastAssistant, extra: nuance.trim() || undefined, background: true, ...(driveFolder ? { folderId: driveFolder.id } : {}) };
      const r = await fetch("/api/admin/page-analysis-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const ct = r.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        const d = await r.json();
        if (!d.ok) { setErr(d.error || "Vastleggen mislukt."); return; }
        setTaskDone(true);
        if (d.started) { setApplied("De analyse wordt op de achtergrond vastgelegd; je kunt wegklikken. Hij verschijnt zo als werkzaamheid in Werkzaamheden."); onApplied(); return; }
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
      setTaskDone(true);
      onApplied();
      if (!Number.isNaN(tid) && tid && onGoToTask) onGoToTask(tid);
    } catch { setErr("Vastleggen mislukt."); } finally { setTaskGen(false); }
  }

  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const [nuance, setNuance] = useState("");

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

  // Laatste achtergrond-run ophalen bij openen (toont een lopende of net afgeronde run).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) setRun(d.run); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [slug, url]);

  // Zolang een run loopt: elke 5s de status verversen (stopt vanzelf bij klaar/fout).
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`);
        const d = await r.json();
        if (d.ok) setRun(d.run);
      } catch { /* stil */ }
    }, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [run?.status, run?.id, slug, url]);

  // Meegegeven cluster-advies voor deze pagina ophalen (toont de vertrekpunt-kaart).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/page-chat/cluster-advice?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) setIncoming(d.incoming || []); })
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

  function newChat() { setMsgs([]); setChatId(null); setProposal(null); setApplied(""); setErr(""); setConvoOpen(true); setClusterItems(null); setClusterMsg(""); }

  async function openChat(id: number) {
    setProposal(null); setApplied(""); setErr(""); setClusterItems(null); setClusterMsg("");
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

  // Een bericht is markdown (van het model) óf al bewerkte HTML; render de juiste.
  function renderMsgHtml(content: string): string {
    return /<(p|table|ul|ol|h[1-6]|div|br|strong|em|a)\b/i.test(content) ? content : mdToHtml(content);
  }
  function deleteMsg(i: number) {
    if (!window.confirm("Dit bericht uit de chat verwijderen?")) return;
    const next = msgs.filter((_, j) => j !== i);
    setMsgs(next); setEditIdx(null);
    if (next.length) persist(next); else newChat();
  }
  function saveEdit(i: number) {
    const html = (editRef.current?.innerHTML || "").trim();
    const next = msgs.map((m, j) => (j === i ? { ...m, content: html } : m));
    setMsgs(next); setEditIdx(null); persist(next);
  }
  // Vul de bewerk-preview met de gerenderde inhoud zodra je een bericht gaat bewerken.
  useEffect(() => {
    if (editIdx != null && editRef.current) editRef.current.innerHTML = renderMsgHtml(msgs[editIdx]?.content || "");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [editIdx]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setErr(""); setApplied(""); setProposal(null); setClusterItems(null); setClusterMsg("");
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

  // ── Cluster-advies doorgeven aan andere betrokken pagina's ──
  async function findClusterAdvice() {
    if (!lastAssistant || clusterBusy) return;
    setClusterBusy(true); setClusterMsg(""); setErr("");
    try {
      const r = await fetch("/api/admin/page-chat/cluster-advice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, analysis: lastAssistant }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Betrokken pagina's zoeken mislukt."); return; }
      const items: { url: string; advice: string }[] = d.items || [];
      setClusterItems(items);
      setClusterSel(items.map((it) => it.url));
    } catch { setErr("Betrokken pagina's zoeken mislukt."); } finally { setClusterBusy(false); }
  }
  function toggleCluster(u: string) { setClusterSel((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u])); }
  async function applyClusterAdvice() {
    const items = (clusterItems || []).filter((it) => clusterSel.includes(it.url));
    if (!items.length || clusterBusy) return;
    setClusterBusy(true); setClusterMsg(""); setErr("");
    try {
      const r = await fetch("/api/admin/page-chat/cluster-advice/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, sourceUrl: url, sourceAnalysis: lastAssistant, items }) });
      const d = await r.json();
      if (d.ok) {
        setClusterDone(d.saved || items.length);
        setClusterMsg(`Advies doorgegeven aan ${d.saved} pagina('s). Hun eigen chat neemt dit voortaan als vertrekpunt mee; in het overzicht krijgen ze de markering "half plan".`);
        setClusterItems(null);
        onClusterApplied?.();
      } else setErr(d.error || "Doorgeven mislukt.");
    } catch { setErr("Doorgeven mislukt."); } finally { setClusterBusy(false); }
  }

  // Start de achtergrond-run: de drie stappen draaien server-side door; wegklikken mag.
  async function startBackgroundRun(steps: string[]) {
    if (runBusy) return;
    setRunBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/page-doc/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, steps, extra: nuance.trim() || undefined, folderId: driveFolder?.id || undefined }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Achtergrond-run starten mislukt."); return; }
      const s = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((x) => x.json()).catch(() => null);
      if (s?.ok) setRun(s.run);
    } catch { setErr("Achtergrond-run starten mislukt."); } finally { setRunBusy(false); }
  }

  // Het gesprek van de actieve chat (de eerste vraag staat al als titel, dus die
  // slaan we over) plus het voorstel en de vastleg/mail-knoppen.
  const renderConvo = () => (
    <>
      <div className="page-chat-log">
        {msgs.map((m, i) => {
          if (i === 0 && m.role === "user") return null;
          if (editIdx === i) {
            return (
              <div key={i} className="pch-msg-edit">
                <div className="pch-msg-editable md" contentEditable suppressContentEditableWarning ref={editRef} />
                <div className="pch-msg-edit-actions">
                  <button type="button" className="ghost-btn small" onClick={() => saveEdit(i)}>Opslaan</button>
                  <button type="button" className="ghost-btn small" onClick={() => setEditIdx(null)}>Annuleren</button>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={"pch-msg-wrap " + m.role}>
              {m.role === "user"
                ? <div className="page-chat-msg user">{m.content}</div>
                : <div className="page-chat-msg assistant md" dangerouslySetInnerHTML={{ __html: renderMsgHtml(m.content) }} />}
              <div className="pch-msg-ctrl">
                {m.role === "assistant" && <button type="button" className="pch-msg-btn" title="Bewerken" onClick={() => setEditIdx(i)}>✎</button>}
                <button type="button" className="pch-msg-btn" title="Verwijderen" onClick={() => deleteMsg(i)}>×</button>
              </div>
            </div>
          );
        })}
        {busy && <div className="page-chat-msg assistant muted">Aan het denken…</div>}
      </div>
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
          <div className="page-chat-followup">
            <div className="pchf-lead">Nog een vervolgvraag over de invulling of de zoekwoorden? Stel hem hier. Ben je klaar met doorpraten, vat het gesprek dan samen tot de conclusie en strategie; die neem je daarna over als plan met &ldquo;Neem plan over&rdquo;.</div>
            <div className="pchf-row">
              <input className="pchf-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Vervolgvraag over deze pagina…" disabled={busy} />
              <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
            </div>
            <button type="button" className="pcd-btn pcd-btn-primary" onClick={() => send(SUMMARIZE_PROMPT)} disabled={busy} title="Vat het hele gesprek samen tot de definitieve conclusie en strategie, klaar om over te nemen als plan">Vat samen tot conclusie &amp; strategie</button>
          </div>
          <div className="page-chat-cluster">
            <div className="pchf-lead">Raakt deze analyse ook andere pagina&rsquo;s in het cluster? Geef het advies dat over hén gaat alvast door. Naast het advies per pagina gaat ook de volledige conclusie van deze chat mee, zodat die pagina&rsquo;s de hele strategie als vertrekpunt hebben.</div>
            {clusterDone > 0 ? (
              <button type="button" className="pcd-btn pcd-btn-done" disabled>&#10003; Doorgegeven aan {clusterDone} pagina&rsquo;s</button>
            ) : clusterItems === null ? (
              <button type="button" className="pcd-btn" onClick={findClusterAdvice} disabled={clusterBusy}>{clusterBusy ? "Betrokken pagina's zoeken…" : "Advies doorgeven aan betrokken pagina's"}</button>
            ) : clusterItems.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>Geen andere pagina&rsquo;s gevonden waarover deze analyse concreet advies geeft.</div>
            ) : (
              <>
                <ul className="pch-cluster-list">
                  {clusterItems.map((it) => (
                    <li key={it.url} className="pch-cluster-item">
                      <label className="pch-cluster-head">
                        <input type="checkbox" checked={clusterSel.includes(it.url)} onChange={() => toggleCluster(it.url)} />
                        <span className="pch-cluster-url">{it.url}</span>
                      </label>
                      <div className="pch-cluster-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice) }} />
                    </li>
                  ))}
                </ul>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <button type="button" className="pcd-btn pcd-btn-primary" onClick={applyClusterAdvice} disabled={clusterBusy || clusterSel.length === 0}>{clusterBusy ? "Doorgeven…" : `Doorgeven aan ${clusterSel.length} pagina('s)`}</button>
                  <HelpHint text="Geeft de basisinfo uit deze analyse door aan de aangevinkte pagina's; die krijgen het als vertrekpunt ('half plan') mee in hun eigen chat en in het overzicht." />
                </span>
              </>
            )}
            {clusterMsg && <div className="saved-msg" style={{ marginTop: 8 }}>{clusterMsg}</div>}
          </div>
          <div className="page-chat-drive">
            <span className="pcd-label">Opslaan in:</span>
            {driveFolder
              ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
              : <span className="pcd-folder muted">nog geen Drive-map (documenten worden gedownload)</span>}
            <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Map wijzigen" : "Kies Drive-map"}</button>
            {driveFolder && <button type="button" className="ghost-btn small" onClick={() => setDriveFolder(null)}>Naar download</button>}
          </div>
          <div className="page-chat-tools">
            <button type="button" className={"pcd-btn " + (taskDone ? "pcd-btn-done" : "pcd-btn-primary") + (taskGen ? " busy" : "")} onClick={makeWorkItem} disabled={taskGen}>{taskGen ? "Vastleggen…" : taskDone ? "✓ Analyse vastgelegd." : "Analyse vastleggen"}</button>
            <HelpHint text="Vat deze analyse samen tot één document (Google Drive of download) en legt hem vast als één werkzaamheid met dat document eraan gekoppeld." />
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="page-chat-wrap">
      {incoming.length > 0 && (
        <div className="page-chat-incoming">
          <div className="pchf-lead"><strong>Meegegeven vanuit een clusteranalyse.</strong> Dit is als vertrekpunt voor deze pagina bewaard; de chat hieronder neemt het advies én de volledige conclusie automatisch mee.</div>
          {incoming.map((it, i) => (
            <div key={i} className="pchi-item">
              <div className="pchi-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice) }} />
              {it.sourceUrl && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uit de analyse van <a href={it.sourceUrl} target="_blank" rel="noreferrer">{it.sourceUrl}</a></div>}
            </div>
          ))}
          {incoming.some((it) => it.sourceAnalysis) && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="ghost-btn small" onClick={() => setIncomingOpen((o) => !o)}>{incomingOpen ? "Verberg de volledige clusteranalyse" : "Toon de volledige clusteranalyse"}</button>
              {incomingOpen && incoming.filter((it) => it.sourceAnalysis).map((it, i) => (
                <div key={i} className="pchi-full md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.sourceAnalysis) }} />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="page-chat">
        <div className="page-chat-head">
          <span>Chat over deze pagina (gegrond in live status, GSC-ranking en het cluster)</span>
          {(chats.length > 0 || msgs.length > 0) && <button type="button" className="ghost-btn small" onClick={newChat}>+ Nieuwe chat</button>}
        </div>

        <div className="page-chat-history">
          <div className="page-chat-history-head">Eerdere chats</div>

          {chatId === null && msgs.length > 0 && (
            <div className={"pch-item active" + (convoOpen ? " open" : "")}>
              <div className="pch-item-head" onClick={() => setConvoOpen((o) => !o)}>
                <span className="pch-caret">{convoOpen ? "▾" : "▸"}</span>
                <span className="pch-title">{analyseTitle}</span>
              </div>
              {convoOpen && <div className="pch-item-body">{renderConvo()}</div>}
            </div>
          )}

          {chats.map((c) => {
            const active = chatId === c.id;
            const open = active && convoOpen;
            return (
              <div key={c.id} className={"pch-item" + (open ? " open" : "") + (active ? " active" : "")}>
                <div className="pch-item-head" onClick={() => { if (active) setConvoOpen((o) => !o); else { openChat(c.id); setConvoOpen(true); } }}>
                  <span className="pch-caret">{open ? "▾" : "▸"}</span>
                  <span className="pch-title">{active ? analyseTitle : c.title}</span>
                  <button type="button" className="pch-del" title="Chat verwijderen" onClick={(e) => removeChat(c.id, e)}>&times;</button>
                </div>
                {open && <div className="pch-item-body">{renderConvo()}</div>}
              </div>
            );
          })}

          {chats.length === 0 && msgs.length === 0 && (
            <div className="muted" style={{ fontSize: 12 }}>Nog geen chats. Stel hieronder een vraag over deze pagina.</div>
          )}
        </div>
      </div>

      {applied && <div className="saved-msg" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: applied }} />}
      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}

      {run && (
        <div className="doc-run-status">
          <div className="pcd-docs-head">Achtergrond-run {run.status === "running" ? "— bezig (wegklikken mag)" : run.status === "done" ? "— klaar" : "— gestopt door een fout"}</div>
          <ul className="doc-run-steps">
            {(["analyse", "blauwdruk", "copy"] as const).filter((k) => run.steps[k] !== "skipped").map((k) => (
              <li key={k} className={"drs " + (run.steps[k] || "pending")}>
                <span className="drs-name">{k === "analyse" ? "1. Analyse" : k === "blauwdruk" ? "2. Blauwdruk" : "3. Copy"}</span>
                <span className="drs-state">{run.steps[k] === "done" ? "klaar" : run.steps[k] === "running" ? "bezig…" : run.steps[k] === "error" ? "fout" : "wacht"}</span>
                {run.links[k] && <a href={run.links[k]} target="_blank" rel="noreferrer">document</a>}
              </li>
            ))}
          </ul>
          {run.status === "running" && <div className="muted" style={{ fontSize: 12 }}>Dit loopt server-side door. Je kunt gerust wegklikken en later terugkomen; de resultaten verschijnen hier en als werkzaamheid in de takenlijst.</div>}
          {run.status === "error" && run.error && <div className="login-error" style={{ marginTop: 6 }}>{run.error}</div>}
        </div>
      )}

      {lastAssistant && (
        <div className="page-chat-docs">
          <div className="pcd-docs-head">Vervolgstappen op strategische analyse voor deze pagina</div>
          <input className="pcd-nuance" value={nuance} onChange={(e) => setNuance(e.target.value)} placeholder="Extra sturing (optioneel), bijv. leg de nadruk op de regio, of behoud de tarieventabel." />
          <div className="pcd-docs-buttons">
            <button type="button" className="pcd-btn" onClick={() => startBackgroundRun(["analyse"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">1. Analyse-document</button>
            <button type="button" className="pcd-btn" onClick={() => startBackgroundRun(["blauwdruk"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">2. Blauwdruk-document</button>
            <button type="button" className="pcd-btn" onClick={() => startBackgroundRun(["copy"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">3. Copy-document (+ dev-taak)</button>
            <button type="button" className="pcd-btn pcd-btn-primary" onClick={() => startBackgroundRun(["analyse", "blauwdruk", "copy"])} disabled={runBusy} title="Draait de drie stappen op de achtergrond door; wegklikken mag.">{runBusy ? "Starten…" : "Alles achter elkaar (1 → 2 → 3)"}</button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Je klikt en het draait op de achtergrond door: je kunt meteen wegklikken naar iets anders. De voortgang zie je in het kaartje hierboven en later in Werkzaamheden. Van elk document wordt automatisch ook een klantversie gemaakt en in de Drive-map opgeslagen (taaktitel → technische versie, "(klantversie)" ernaast; het klantdashboard toont alleen de klantversie). Tip: kies eerst een Drive-map, dan komen de bestanden daar te staan.</div>
        </div>
      )}

      <div className="page-chat-canni">
        <div className="pch-canni-row">
          <span className="pch-canni-lead">Vervolgstap: los de cannibalisatie voor deze pagina op. Brengt per zoekwoord in kaart (top-10 + volume) of het een eigen pagina verdient of naar deze pagina geclusterd wordt, en welke pagina&rsquo;s deze pagina kapen, met de actie per pagina.</span>
          <button type="button" className={"pcd-btn" + (pcBusy || pc?.status === "running" ? " busy" : "")} disabled={pcBusy || pc?.status === "running"} onClick={runPc} title="Draait op de achtergrond met echte Ahrefs-data; je kunt wegklikken.">{pc?.status === "running" ? "Analyse draait…" : pc?.result ? "Opnieuw analyseren" : "Cannibalisatie oplossen"}</button>
        </div>
        {pc?.status === "error" && pc.error && <div className="login-error" style={{ marginTop: 8 }}>{pc.error}</div>}
        {pc?.status === "running" && !pc.result && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Analyse draait op de achtergrond (verzamelt per pagina de Ahrefs-zoekwoorden + top-10; dit kan een paar minuten duren).</div>}
        {pc?.result && (
          <div className="pch-canni-doc">
            <button type="button" className="pch-canni-toggle" onClick={() => setPcOpen((o) => !o)}>{pcOpen ? "▾" : "▸"} Cannibalisatie- &amp; content-mapping-analyse{pc.updatedAt ? ` · ${new Date(pc.updatedAt).toLocaleString("nl-NL")}` : ""}{pc.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
            {pcOpen && <div className="md pch-canni-md" dangerouslySetInnerHTML={{ __html: mdToHtml(pc.result) }} />}
            {pcOpen && (
              <div className="pch-canni-apply">
                <button type="button" className={"pcd-btn pcd-btn-primary" + (applyBusy ? " busy" : "")} disabled={applyBusy} onClick={applyRec} title="Zet de redirects + interne links door als Dev-taak met document, en de de-optimalisatie-info als basis naar de betreffende pagina's.">{applyBusy ? "Overnemen…" : "Aanbevelingen overnemen"}</button>
                {applyMsg && <span className="saved-msg" style={{ marginLeft: 10 }}>{applyMsg}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {!convoShown && (
        <div className="page-chat-input">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag over deze pagina…" disabled={busy} />
          <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
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

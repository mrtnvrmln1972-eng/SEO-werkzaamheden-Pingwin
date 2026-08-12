"use client";

// De logica van de strategie-chat (stap 1): het gesprek zelf, de chatlijst,
// bewerken/weghalen van berichten, en de afsluitknop "Vat samen & leg strategie
// vast" (samenvatten -> vastgelegde strategie -> document + werkzaamheid).
// De weergave staat in StrategieKaart.tsx; dit bestand houdt alleen de staat
// en de serverkant vast.
import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../../lib/markdown";
import { striptVulzinnen } from "../../../../../lib/vulzinnen";
import { SUMMARIZE_PROMPT } from "../../../../../lib/strategie-prompt";
import type { Bron } from "../Bronnenstrip";
import type { Msg, Proposal, ChatSummary, DriveFolder } from "./types";

// De opdracht voor "Vat samen & leg strategie vast" staat in lib/strategie-prompt.ts
// (gedeeld met de kaart-chat in de planning, zodat beide knoppen hetzelfde vragen).

export function useStrategieChat({ slug, url, siteBase, planDone, onApplied, onGoToTask, driveFolder, nuance, taskDone, setTaskDone, clusterDone, setClusterDone, setChatOpen, setErr, setApplied, setSummaryAutoGen, setClusterItems, setClusterMsg }: {
  slug: string; url: string; siteBase: string; planDone?: boolean;
  onApplied: (plan?: string) => void; onGoToTask?: (taskId: number) => void;
  driveFolder: DriveFolder | null; nuance: string;
  taskDone: boolean; setTaskDone: (v: boolean) => void;
  clusterDone: number; setClusterDone: (v: number) => void;
  setChatOpen: (v: boolean) => void;
  setErr: (v: string) => void; setApplied: (v: string) => void;
  setSummaryAutoGen: React.Dispatch<React.SetStateAction<number>>;
  setClusterItems: (v: { url: string; advice: string }[] | null) => void;
  setClusterMsg: (v: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  // Of het gesprek van de actieve chat uitgeklapt is (toggle in de lijst).
  const [convoOpen, setConvoOpen] = useState(false);
  // Welke eerdere antwoorden je zelf hebt opengeklapt. Standaard staat alleen het
  // LAATSTE antwoord open; de antwoorden daarvoor vouwen samen tot hun eigen
  // kopje. Hiervoor stond er één alles-of-niets-knop ("toon het hele gesprek"),
  // die ook de tussenliggende vragen verstopte. Zelfde patroon als de Overview-chat.
  const [openBericht, setOpenBericht] = useState<Record<number, boolean>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // Een chat-bericht bewerken (welke index) — gerenderde contentEditable, geen ruwe textarea.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";

  function markStrategieDone() { setTaskDone(true); try { localStorage.setItem(`pw_stratdone_${slug}_${url}`, "1"); } catch { /* geen opslag */ } if (clusterDone > 0) setChatOpen(false); }

  const [taskGen, setTaskGen] = useState(false);
  const [stratLink, setStratLink] = useState(""); // link naar het vastgelegde strategie-document
  // Haalt de documentlink van de strategie-taak (chat_analyse) van deze pagina op.
  async function loadStratLink(): Promise<boolean> {
    try {
      const d = await fetch(`/api/admin/page-tasks?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d.ok && Array.isArray(d.tasks)) {
        const t = d.tasks.find((x: { stepKind?: string; docLink?: string }) => x.stepKind === "chat_analyse" && x.docLink);
        if (t?.docLink) { setStratLink(t.docLink); return true; }
      }
    } catch { /* niet kritisch */ }
    return false;
  }
  function pollStratLink() {
    let tries = 0;
    const iv = setInterval(async () => { tries++; if ((await loadStratLink()) || tries >= 60) clearInterval(iv); }, 4000);
  }
  useEffect(() => { setStratLink(""); loadStratLink(); /* eslint-disable-next-line */ }, [slug, url]);
  // Vat de chat-analyse samen tot één document (Drive of download) en legt de
  // analyse vast als ÉÉN werkzaamheid met dat document eraan gekoppeld.
  async function makeWorkItem(analysisOverride?: string) {
    const analysis = (analysisOverride || lastAssistant || "").trim();
    if (!analysis || taskGen) return;
    setTaskGen(true); setErr(""); setApplied("");
    try {
      const payload = { slug, url, analysis, extra: nuance.trim() || undefined, background: true, ...(driveFolder ? { folderId: driveFolder.id } : {}) };
      const r = await fetch("/api/admin/page-analysis-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const ct = r.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        const d = await r.json();
        if (!d.ok) { setErr(d.error || `Vastleggen mislukt (status ${r.status}).`); return; }
        markStrategieDone();
        if (d.started) { setApplied("De analyse wordt op de achtergrond vastgelegd; je kunt wegklikken. Hij verschijnt zo als werkzaamheid in Werkzaamheden, met de link hier zodra hij klaar is."); onApplied(); pollStratLink(); return; }
        if (d.link) setStratLink(d.link);
        setApplied(`Analyse samengevat en opgeslagen in Google Drive${d.folder ? `, map "${d.folder}"` : ""}${d.owner ? `, account ${d.owner}` : ""} als Word-bestand in de Pingwin-huisstijl.<a href="${d.link}" target="_blank" rel="noopener">Open document</a>.${d.shared ? " Iedereen met de link kan het bekijken." : " (Delen lukte niet automatisch.)"} Vastgelegd als één werkzaamheid; je springt nu naar Werkzaamheden om hem in te plannen.`);
        onApplied();
        if (typeof d.taskId === "number" && onGoToTask) onGoToTask(d.taskId);
        return;
      }
      if (!r.ok) { const t = await r.text().catch(() => ""); setErr(`Vastleggen mislukt (status ${r.status}). ${t.slice(0, 200)}`.trim()); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      const m = (r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/);
      a.href = URL.createObjectURL(blob);
      a.download = m ? m[1] : "analyse.docx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const tid = Number(r.headers.get("X-Task-Id") || "");
      setApplied("Analyse samengevat en gedownload. Vastgelegd als één werkzaamheid; kies een Drive-map om het document ook te koppelen.");
      markStrategieDone();
      onApplied();
      if (!Number.isNaN(tid) && tid && onGoToTask) onGoToTask(tid);
    } catch (e) { setErr(`Vastleggen mislukt: ${e instanceof Error ? e.message : "netwerkfout"}`); } finally { setTaskGen(false); }
  }

  async function loadChats() {
    try {
      const r = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`);
      const d = await r.json();
      if (d.ok) {
        setChats(d.chats);
        try { localStorage.setItem(`pw_chats_${slug}_${url}`, JSON.stringify(d.chats)); } catch { /* cache is extra */ }
        // Laad meteen de laatste chat in (voor lastAssistant), zonder hem uit te klappen,
        // zodat "doorgeven" en "vervolgstappen" standaard zichtbaar zijn i.p.v. pas na openen.
        if (Array.isArray(d.chats) && d.chats.length > 0 && chatId === null && msgs.length === 0) {
          const latest = d.chats.reduce((a: ChatSummary, b: ChatSummary) => (b.id > a.id ? b : a));
          openChat(latest.id);
        }
      }
    } catch { /* stil */ }
  }
  // Cache-first: toon de vorige chatlijst direct, ververs daarna.
  useEffect(() => {
    try { const c = localStorage.getItem(`pw_chats_${slug}_${url}`); if (c) { const p = JSON.parse(c); if (Array.isArray(p)) setChats(p); } } catch { /* geen cache */ }
    loadChats(); /* eslint-disable-next-line */
  }, [slug, url]);

  // Welke chat vraagt om bevestiging voordat hij weggaat ("nieuw" = de chat die
  // nog niet bewaard is; die had helemaal geen kruisje).
  const [wegChat, setWegChat] = useState<number | "nieuw" | null>(null);
  function newChat() { setMsgs([]); setChatId(null); setProposal(null); setApplied(""); setErr(""); setConvoOpen(true); setClusterItems(null); setClusterMsg(""); setClusterDone(0); try { localStorage.removeItem(`pw_clusterdone_${slug}_${url}`); } catch { /* geen opslag */ } }

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

  // Een hele chat weggooien. Ook hier bevestig je in de rij zelf; een browserpopup
  // ziet er niet uit en het was niet te zien of er iets gebeurde.
  async function removeChat(id: number) {
    setWegChat(null);
    setChats((lijst) => lijst.filter((c) => c.id !== id));
    if (chatId === id) newChat();
    await fetch(`/api/admin/page-chats?id=${id}`, { method: "DELETE" }).catch(() => {});
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
  // Alleen als het ECHT al HTML is (sluittags) én GEEN markdown-syntax bevat, laten we het staan.
  // Anders altijd via mdToHtml, dat '<' escapet — zo verschijnt een genoemde tag als `<h1>`
  // als leestekst i.p.v. dat hij als echte kop wordt gerenderd (en de markdown blijft ruw).
  function renderMsgHtml(ruw: string): string {
    // Aankondigingszinnen eruit, net als in de Bird's eye: dit filter draaide daar
    // wel en hier niet, dus in de kaart-chat stonden ze er nog gewoon.
    const content = striptVulzinnen(ruw);
    const hasClosingTag = /<\/[a-z][a-z0-9]*>/i.test(content);
    const looksMarkdown = /(^|\n)#{1,6}\s|\*\*[^*]|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|\|[^|]*\|/.test(content);
    return hasClosingTag && !looksMarkdown ? content : mdToHtml(content, siteBase);
  }
  // Een bericht weghalen. Bevestigen gebeurt in de regel zelf (geen browserpopup),
  // en wat je weghaalt is meteen bewaard. Is dit het laatste bericht, dan is de
  // hele chat leeg: die gooien we dan ook echt weg in plaats van een lege rij te
  // laten staan.
  const [wegIdx, setWegIdx] = useState<number | null>(null);
  function deleteMsg(i: number) {
    setWegIdx(null);
    const next = msgs.filter((_, j) => j !== i);
    setMsgs(next); setEditIdx(null); setOpenBericht({});
    if (next.length) { persist(next); return; }
    if (chatId !== null) { void fetch(`/api/admin/page-chats?id=${chatId}`, { method: "DELETE" }).then(loadChats).catch(() => {}); }
    newChat();
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

  // Onderbreken (het kruisje bij "Aan het denken…"): het antwoord wordt weggegooid
  // en niet bewaard; de eigen vraag blijft in het invoerveld staan zodat je hem kunt
  // aanvullen en opnieuw versturen.
  const sendAbortRef = useRef<AbortController | null>(null);
  function cancelSend() {
    sendAbortRef.current?.abort();
  }

  // volledig = stuur het hele gesprek ongekort mee. Alleen voor het samenvatten;
  // een gewone vraag krijgt de ingekorte geschiedenis (zie lib/chat-inkorten.ts).
  async function send(text: string, volledig = false): Promise<{ reply: string; proposal: Proposal | null } | null> {
    const t = text.trim();
    if (!t || busy) return null;
    setErr(""); setApplied(""); setProposal(null); setClusterItems(null); setClusterMsg("");
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setInput(""); setBusy(true);
    const ctrl = new AbortController();
    sendAbortRef.current = ctrl;
    try {
      const r = await fetch("/api/admin/page-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, messages: next, volledig }), signal: ctrl.signal });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Chat mislukt."); setBusy(false); return null; }
      const withReply = [...next, { role: "assistant" as const, content: d.reply, ...(Array.isArray(d.bronnen) && d.bronnen.length ? { bronnen: d.bronnen as Bron[] } : {}) }];
      setMsgs(withReply);
      const p: Proposal | null = d.proposal || null;
      setProposal(p);
      persist(withReply); // altijd bewaren, ook zonder overnemen
      return { reply: String(d.reply || ""), proposal: p };
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // Onderbroken: antwoord weggooien, vraag terug in het invoerveld.
        setMsgs(msgs);
        setInput(t);
      } else {
        setErr("Chat mislukt.");
      }
    } finally { setBusy(false); sendAbortRef.current = null; }
    return null;
  }

  // Slaat een plantekst op als de vastgelegde strategie bovenaan (onderdeel van
  // de gecombineerde knop; de acties erin lopen via analyse/blauwdruk/copy).
  async function acceptPlan(plan: string): Promise<boolean> {
    try {
      const r = await fetch("/api/admin/page-chat/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, plan }) });
      const d = await r.json();
      if (d.ok) { setProposal(null); onApplied(plan); return true; }
      setErr(d.error || "Strategie vastleggen mislukte.");
      return false;
    } catch { setErr("Strategie vastleggen mislukte."); return false; }
  }

  // De gecombineerde knop: samenvatten -> vastgelegde strategie bovenaan ->
  // document in Drive + afgeronde werkzaamheid. Onderbreken kan tijdens het
  // samenvatten (kruisje bij "Aan het denken"); dan stopt de hele keten.
  const [finalizePhase, setFinalizePhase] = useState<"" | "samenvatten" | "vastleggen" | "document">("");
  async function summarizeAndFinalize() {
    if (busy || taskGen || finalizePhase) return;
    setFinalizePhase("samenvatten");
    try {
      const d = await send(SUMMARIZE_PROMPT, true);
      if (!d || !d.reply.trim()) return; // onderbroken of mislukt: niets vastleggen
      setFinalizePhase("vastleggen");
      const plan = d.proposal?.plan?.trim() ? d.proposal.plan : d.reply;
      await acceptPlan(plan);
      // De vastgelegde strategie is vernieuwd: laat de korte samenvatting bovenaan
      // automatisch meelopen zodat de toplaag altijd klopt met de laatste strategie.
      setSummaryAutoGen((n) => n + 1);
      setFinalizePhase("document");
      await makeWorkItem(d.reply);
    } finally { setFinalizePhase(""); }
  }

  return {
    msgs, chatId, chats, convoOpen, setConvoOpen, openBericht, setOpenBericht,
    input, setInput, busy, editIdx, setEditIdx, editRef,
    wegChat, setWegChat, wegIdx, setWegIdx,
    taskGen, stratLink, finalizePhase, lastAssistant,
    send, newChat, openChat, removeChat, deleteMsg, saveEdit, cancelSend,
    renderMsgHtml, makeWorkItem, acceptPlan, summarizeAndFinalize,
  };
}

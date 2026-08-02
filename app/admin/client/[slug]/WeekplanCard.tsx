"use client";

// De projectkaart in het weekplanning-bord: één pagina = één kaart, met de hele
// cyclus (7 fases) verticaal erin. Elke fase toont live de stand, is te starten
// waar een motor bestaat, en handmatig af te vinken. De chat is dezelfde chat
// als bij de pagina in Pagina's (één geheugen per pagina); de kaart-achtergrond
// reist als context mee in de chat en als extra sturing in de document-runs.

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { cardInfoHtml, splitCardInfo, faseSturing, type CardFaseKey } from "../../../../lib/card-info";
import { linkifyHtml } from "../../../../lib/linkify";
import { urlKey } from "../../../../lib/url-key";
import { devLabel } from "../../../../lib/personen";
import AntwoordBlokken from "./AntwoordBlokken";
import DocVersies from "./DocVersies";

export type WpTask = { id: number; thread: string; taak: string; toelichting: string; wie: string; url: string; taaktype: string; copyUrl: string; bronMail: string; weekYear: number; weekNo: number; status: string; sortOrder: number; naarDev?: boolean };
export type WpPageInfo = { url: string; live: boolean; klikken?: number; vertoningen?: number; doorgevoerd?: boolean | null; strategie: boolean; gelieerde: boolean; analyse: boolean; blauwdruk: boolean; copy: boolean; bouw: boolean; structured: boolean; structuredStatus: string; next: string; links: { analyse: string; blauwdruk: string; copy: string } };

// Bij welk taaktype hoort welk dashboard-tabblad (voor de deep-link "doe het hier").
const TAB_FOR_TYPE: Record<string, { tab: string; label: string }> = {
  meta: { tab: "meta", label: "Meta & CTR" },
  alt: { tab: "paginas", label: "Pagina's" },
  copy: { tab: "paginas", label: "Pagina's" },
  intern: { tab: "paginas", label: "Pagina's" },
  structured: { tab: "paginas", label: "Pagina's" },
  strategie: { tab: "paginas", label: "Pagina's" },
  pijplijn: { tab: "paginas", label: "Pagina's" },
  overig: { tab: "paginas", label: "Pagina's" },
};
const STATUS_LABEL: Record<string, string> = { gepland: "Gepland", bezig: "Bezig", klaar: "Klaar" };

type FaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

// De cijferregel op de kaart, opgebouwd uit de meting. Leeg als er niets gemeten is;
// dan tonen we liever niets dan een nul die niets betekent.
function cijferRegel(p?: { vertoningen?: number; klikken?: number; doorgevoerd?: boolean | null; live?: boolean }): string {
  if (!p) return "";
  const delen: string[] = [];
  if (p.vertoningen) delen.push(`${p.vertoningen.toLocaleString("nl-NL")} vertoningen`);
  if (p.klikken) delen.push(`${p.klikken.toLocaleString("nl-NL")} klikken`);
  if (p.live === false) delen.push("nog niet live");
  if (p.doorgevoerd === true) delen.push("copy staat live");
  else if (p.doorgevoerd === false) delen.push("copy nog niet doorgevoerd");
  return delen.join(" · ");
}

// Klein inline SVG-setje in huisstijl-oranje (geen library), stijl van het voorbeeld.
function Icoon({ d, className = "wp-fase-icoon" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const ICOON = {
  strategie: "M4 21V4|M4 4h12l-2 4 2 4H4",
  gelieerde: "M18 8a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z|M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z|M18 22a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z|M8.7 10.6l6.6-3.2|M8.7 13.4l6.6 3.2",
  analyse: "M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z|M21 21l-4.3-4.3",
  blauwdruk: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  copy: "M14 3H6v18h12V7l-4-4Z|M14 3v4h4",
  bouw: "M12 17V9|M12 9l-3 3|M12 9l3 3|M20 17a4 4 0 0 0-1-7.9A6 6 0 0 0 7.2 8 5 5 0 0 0 4 17",
  structured: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z|M20 6v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6|M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3",
  chat: "M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z",
  pin: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z|M12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  doel: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0|M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0|M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0",
};

const FASEN: { key: FaseKey; label: string; kort: string; icoon: string }[] = [
  { key: "strategie", label: "Strategie", kort: "Strategie", icoon: ICOON.strategie },
  { key: "gelieerde", label: "Gelieerde pagina's", kort: "Gelieerd", icoon: ICOON.gelieerde },
  { key: "analyse", label: "Analyse", kort: "Analyse", icoon: ICOON.analyse },
  { key: "blauwdruk", label: "Blauwdruk", kort: "Blauwdruk", icoon: ICOON.blauwdruk },
  { key: "copy", label: "Copy", kort: "Copy", icoon: ICOON.copy },
  { key: "bouw", label: "Bouw en publicatie", kort: "Bouw", icoon: ICOON.bouw },
  { key: "structured", label: "Structured data", kort: "Schema", icoon: ICOON.structured },
];

type RunInfo = { status: string; steps: Record<string, string>; links: Record<string, string> } | null;
type ChatMsg = { role: "user" | "assistant"; content: string };

function shortUrl(url: string): string { try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; } }

export default function WeekplanCard({ slug, t, page, open, onToggleOpen, onDragStart, onDragEnd, onStatus, onRemove, onMail, onGoToPage, onGoToTab, onOpenMailDate, refreshBoard }: {
  slug: string; t: WpTask; page?: WpPageInfo; open: boolean;
  onToggleOpen: () => void; onDragStart: () => void; onDragEnd: () => void;
  onStatus: () => void; onRemove: () => void; onMail: (aud: "klant" | "dev") => void;
  onGoToPage?: (url: string) => void; onGoToTab?: (tab: string) => void;
  onOpenMailDate?: (datum: string) => void; refreshBoard: () => void;
}) {
  // Dashboard-deeplinks vanuit een kaart openen in een NIEUW browsertabblad,
  // zodat je het bord niet kwijtraakt terwijl je iets uitzoekt.
  const openPaginaNieuwTab = () => window.open(`/admin/client/${slug}?tab=paginas&page=${encodeURIComponent(t.url)}`, "_blank");
  const openTabNieuwTab = (tabNaam: string) => window.open(`/admin/client/${slug}?tab=${tabNaam}${tabNaam === "paginas" && t.url ? `&page=${encodeURIComponent(t.url)}` : ""}`, "_blank");
  const hasInfo = !!t.toelichting.trim();
  const [run, setRun] = useState<RunInfo>(null);
  const [everLinks, setEverLinks] = useState<Record<string, string>>({});
  const [schemaStatus, setSchemaStatus] = useState<string>(page?.structuredStatus || "idle");
  const [busy, setBusy] = useState<string>("");
  const [foutje, setFoutje] = useState<string>("");
  const [melding, setMelding] = useState<string>("");
  const [opruimMsg, setOpruimMsg] = useState<string>("");
  // Chat (zelfde geheugen als de pagina-chat in Pagina's).
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [planVoorstel, setPlanVoorstel] = useState<string>("");
  const msgsRef = useRef<HTMLDivElement>(null);

  const runActive = !!run && run.status === "running";
  const schemaRunning = schemaStatus === "running";

  useEffect(() => { setSchemaStatus(page?.structuredStatus || "idle"); }, [page?.structuredStatus]);

  // Run-status laden bij openen; pollen zolang er iets loopt (alleen deze open kaart).
  useEffect(() => {
    if (!open || !t.url) return;
    let stop = false;
    const loadRun = async () => {
      try {
        const d = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
        if (stop || !d?.ok) return;
        setRun(d.run || null);
        setEverLinks(d.everLinks || {});
      } catch { /* stil */ }
    };
    void loadRun();
    const iv = setInterval(async () => {
      if (stop) return;
      const wasRunning = runActive || schemaRunning;
      await loadRun();
      if (schemaRunning) {
        try {
          const s = await fetch(`/api/admin/page-schema?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
          if (!stop && s?.ok) setSchemaStatus(String(s.status || "idle"));
        } catch { /* stil */ }
      }
      if (wasRunning) refreshBoard();
    }, 5000);
    return () => { stop = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t.url, runActive, schemaRunning]);

  useEffect(() => { msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight }); }, [msgs, chatBusy]);

  // De laatste chat-conclusie (assistent-antwoord) van deze pagina, ingekort en
  // plat, zodat hij als sturing mee kan bij het starten van een fase.
  async function chatConclusie(): Promise<string> {
    let laatste = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";
    if (!laatste && t.url) {
      try {
        const d = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
        const eerste = d?.chats?.[0];
        if (eerste?.id) {
          const c = await fetch(`/api/admin/page-chats?id=${eerste.id}`).then((r) => r.json());
          const lijst = Array.isArray(c?.chat?.messages) ? (c.chat.messages as ChatMsg[]) : [];
          laatste = [...lijst].reverse().find((m) => m.role === "assistant")?.content || "";
        }
      } catch { /* geen chat, geen conclusie */ }
    }
    return laatste.replace(/<[^>]*>/g, " ").replace(/[#*|]/g, "").replace(/\s+/g, " ").trim().slice(0, 600);
  }

  async function bouwExtra(steps: ("analyse" | "blauwdruk" | "copy")[]): Promise<string> {
    const parsed = splitCardInfo(t.toelichting, t.taak);
    const delen = steps.map((s) => faseSturing(parsed, s)).filter(Boolean);
    const basis = delen[0] || t.toelichting.slice(0, 900);
    const extraFases = delen.slice(1).map((d) => d.split("Sturing voor deze stap:")[1] || "").filter(Boolean).join("; ");
    const conclusie = await chatConclusie();
    return [basis, extraFases ? `Ook: ${extraFases}` : "", conclusie ? `Conclusie uit de kaart-chat: ${conclusie}` : ""].filter(Boolean).join("\n\n").slice(0, 1500);
  }

  async function startDocStep(steps: ("analyse" | "blauwdruk" | "copy")[]) {
    if (busy || runActive) return;
    setBusy(steps.join("+")); setFoutje(""); setMelding("");
    try {
      // Gerichte sturing: achtergrond + de sturing van deze fase(s) + de laatste
      // chat-conclusie, niet de hele kaarttekst (scherpere documenten, minder ruis).
      const extra = await bouwExtra(steps);
      const d = await fetch("/api/admin/page-doc/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, steps, extra, folderId: "", audience: "klant" }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else setRun({ status: "running", steps: Object.fromEntries(steps.map((s, i) => [s, i === 0 ? "running" : "pending"])), links: {} });
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  // Start "Gelieerde pagina's": de vastgelegde strategie wordt server-side de bron
  // voor het advies aan de andere cluster-pagina's (half plan), in één klik.
  async function startGelieerde() {
    if (busy) return;
    setBusy("gelieerde"); setFoutje(""); setMelding("");
    try {
      const d = await fetch("/api/admin/page-cluster-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else if (!d.saved) setFoutje(d.message || "Geen concreet advies voor gelieerde pagina's gevonden.");
      else { setMelding(`Advies op ${d.saved} gelieerde ${d.saved === 1 ? "pagina" : "pagina's"} klaargezet.`); refreshBoard(); }
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  async function startSchema() {
    if (busy || schemaRunning) return;
    setBusy("structured"); setFoutje("");
    try {
      const d = await fetch("/api/admin/page-schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else setSchemaStatus("running");
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  // "Op bespreeklijst": een aanpak-punt van deze kaart naar iemands afvinklijstje.
  const [lijstPunt, setLijstPunt] = useState("");
  const [lijstMsg, setLijstMsg] = useState("");
  const [lijstPersonen, setLijstPersonen] = useState<string[]>(["Klant", "Dev"]);
  // Developer van DEZE klant; leeg = gewoon "Dev" tonen.
  const [devNaam, setDevNaam] = useState<string | null>(null);
  // Welke fases hun sturing tonen. Dicht is de standaard: je wilt de instructie
  // van de stap waar je mee bezig bent, niet die van alle vijf tegelijk.
  const [faseOpen, setFaseOpen] = useState<Record<string, boolean>>({});
  // Staat deze kaart op de developerpagina?
  const [naarDev, setNaarDev] = useState<boolean>(t.naarDev === true);
  const [devBezig, setDevBezig] = useState(false);

  async function zetNaarDev() {
    if (devBezig) return;
    const nieuw = !naarDev;
    setDevBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: t.id, naarDev: nieuw }),
      }).then((r) => r.json());
      if (d?.ok) setNaarDev(nieuw);
      else setFoutje(d?.error || "Doorzetten naar de developer mislukte.");
    } catch { setFoutje("Doorzetten naar de developer mislukte."); }
    finally { setDevBezig(false); }
  }
  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (d?.ok) {
        setLijstPersonen([...new Set(["Klant", "Dev", ...(d.items || []).map((i: { persoon: string }) => i.persoon)])] as string[]);
        setDevNaam(d.devName || null);
      }
    }).catch(() => {});
  }, [open, slug]);
  async function zetOpLijst(persoon: string) {
    const tekst = lijstPunt;
    setLijstPunt("");
    try {
      const d = await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", slug, persoon, tekst: `${tekst}${t.url ? ` (${t.url})` : ""}` }) }).then((r) => r.json());
      setLijstMsg(d?.ok ? `Op de bespreeklijst van ${persoon === "Dev" ? devLabel(devNaam) : persoon} gezet.` : (d?.error || "Op de lijst zetten mislukte."));
    } catch { setLijstMsg("Op de lijst zetten mislukte."); }
  }

  // "Controleer live": staat het geadviseerde schema nu echt op de pagina?
  const [verifyMsg, setVerifyMsg] = useState<{ tekst: string; ok: boolean } | null>(null);
  async function controleerLive() {
    if (busy) return;
    setBusy("verify"); setVerifyMsg(null); setFoutje("");
    try {
      const d = await fetch("/api/admin/page-schema/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (d?.ok) setVerifyMsg({ tekst: d.melding || "", ok: !!d.geplaatst && !(d.dubbel || []).length });
      else setFoutje(d?.error || "Controleren mislukte.");
    } catch { setFoutje("Controleren mislukte; probeer het nog een keer."); } finally { setBusy(""); }
  }

  // "Ruim op": herschrijft de kaarttekst server-side naar het strakke formaat.
  async function ruimOp() {
    if (busy) return;
    setBusy("opruimen"); setOpruimMsg("");
    try {
      const d = await fetch("/api/admin/weekplan/tidy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id }) }).then((r) => r.json());
      if (d?.ok) { setOpruimMsg("Kaarttekst herschreven naar het vaste formaat (zelfde inhoud, geen dubbelingen)."); refreshBoard(); }
      else setOpruimMsg(d?.error || "Opruimen mislukt; er is niets gewijzigd.");
    } catch { setOpruimMsg("Opruimen mislukt; er is niets gewijzigd."); } finally { setBusy(""); }
  }

  // Een kaart zonder pagina krijgt een eigen bird's eye-gesprek (volledige
  // site-context en tools), gekoppeld aan deze kaart via een vaste thread.
  const kaartThread = `overzicht:kaart:${t.id}`;

  // Chat: laden bij eerste keer openklappen. Met pagina: de meest recente
  // pagina-chat (zelfde geheugen als Pagina's); zonder pagina: het eigen
  // kaart-gesprek via de bird's eye-chat.
  async function openChat(prefill?: string) {
    setChatOpen(true);
    if (prefill) setInput(prefill);
    if (msgs.length) return;
    try {
      if (t.url) {
        const d = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
        const eerste = d?.chats?.[0];
        if (eerste?.id) {
          const c = await fetch(`/api/admin/page-chats?id=${eerste.id}`).then((r) => r.json());
          if (c?.ok && Array.isArray(c.chat?.messages)) { setMsgs(c.chat.messages); setChatId(eerste.id); }
        }
      } else {
        const d = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(kaartThread)}&nothreads=1`).then((r) => r.json());
        if (d?.ok && Array.isArray(d.messages)) {
          // Alleen de tekst; actie-kaarten uit dit gesprek renderen we hier niet.
          setMsgs((d.messages as ChatMsg[]).map((m) => ({ role: m.role, content: m.content })).filter((m) => (m.content || "").trim()));
        }
      }
    } catch { /* stil */ }
  }

  async function sendChat() {
    const tekst = input.trim();
    if (!tekst || chatBusy) return;
    setInput(""); setChatBusy(true); setFoutje("");
    const next: ChatMsg[] = [...msgs, { role: "user", content: tekst }];
    setMsgs(next);
    try {
      // De kaart-achtergrond reist als los context-bericht mee (niet opgeslagen,
      // dus de chat-titel blijft de echte vraag en de context is altijd actueel).
      const seed: ChatMsg | null = hasInfo ? { role: "user", content: `Achtergrond van deze projectkaart "${t.taak}" (context, hoeft geen apart antwoord):\n${t.toelichting.slice(0, 2000)}` } : null;
      const outgoing = seed ? [seed, ...next.slice(-11)] : next.slice(-12);
      if (t.url) {
        const d = await fetch("/api/admin/page-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, messages: outgoing }) }).then((r) => r.json());
        if (!d?.ok) { setFoutje(d?.error || "De assistent is niet bereikbaar."); setChatBusy(false); return; }
        const withReply: ChatMsg[] = [...next, { role: "assistant", content: String(d.reply || "") }];
        setMsgs(withReply);
        if (d.proposal?.plan) setPlanVoorstel(String(d.proposal.plan));
        const s = await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, id: chatId, messages: withReply }) }).then((r) => r.json()).catch(() => null);
        if (s?.ok && s.id) setChatId(s.id);
      } else {
        const d = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: kaartThread, messages: outgoing }) }).then((r) => r.json());
        if (!d?.ok) { setFoutje(d?.error || "De assistent is niet bereikbaar."); setChatBusy(false); return; }
        const withReply: ChatMsg[] = [...next, { role: "assistant", content: String(d.answer || "") }];
        setMsgs(withReply);
        // De server slaat inclusief het context-bericht op; vervang de historie
        // meteen door de schone lijst zodat de seed nooit in beeld komt.
        await fetch("/api/admin/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: kaartThread, messages: withReply }) }).catch(() => {});
      }
    } catch { setFoutje("De assistent is niet bereikbaar."); } finally { setChatBusy(false); }
  }

  // Eén chatbericht weghalen (kruisje); de opgeslagen historie gaat meteen mee.
  async function verwijderChatBericht(i: number) {
    const nieuw = msgs.filter((_, idx) => idx !== i);
    setMsgs(nieuw);
    try {
      if (t.url) await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, id: chatId, messages: nieuw }) });
      else await fetch("/api/admin/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: kaartThread, messages: nieuw }) });
    } catch { /* stil */ }
  }

  async function legStrategieVast() {
    const plan = planVoorstel.trim() || [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";
    if (!plan || !t.url) return;
    setBusy("strategie"); setFoutje("");
    try {
      const d = await fetch("/api/admin/page-chat/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, plan }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Vastleggen mislukt.");
      else { setPlanVoorstel(""); refreshBoard(); }
    } catch { setFoutje("Vastleggen mislukt."); } finally { setBusy(""); }
  }

  function faseStand(key: FaseKey): { label: string; cls: string } {
    // Een lopende run wint van "Klaar": bij een herrun moet je zíen dat hij draait.
    if ((key === "analyse" || key === "blauwdruk" || key === "copy") && runActive) {
      const st = run?.steps?.[key] || "";
      if (st === "running") return { label: "Bezig…", cls: "wp-fase-bezig" };
      if (st === "pending") return { label: "Wacht", cls: "wp-fase-bezig" };
      if (st === "error") return { label: "Fout", cls: "wp-fase-fout" };
    }
    if (key === "structured" && schemaRunning) return { label: "Bezig…", cls: "wp-fase-bezig" };
    if (page && page[key]) return { label: "✓", cls: "wp-fase-klaar" };
    return { label: "Nog niet", cls: "" };
  }

  function docLink(key: FaseKey): string {
    if (key === "analyse" || key === "blauwdruk" || key === "copy") return everLinks[key] || page?.links?.[key] || (key === "copy" ? t.copyUrl : "") || "";
    return "";
  }

  function faseActie(key: FaseKey): JSX.Element | null {
    const p = page;
    if (!p) return null;
    if (key === "strategie") {
      return <button type="button" className="wp-fase-btn" title={p.strategie ? "Bespreek of stel de strategie bij in de kaart-chat" : "Stel in de kaart-chat een strategie voor deze pagina op"} onClick={() => void openChat("Stel een strategie voor deze pagina voor. Houd rekening met de achtergrond van deze kaart.")}>Bespreek</button>;
    }
    if (key === "gelieerde") {
      const kan = p.strategie;
      return <button type="button" className="wp-fase-btn" disabled={!kan || busy === "gelieerde"} title={kan ? "Haal advies voor gelieerde pagina's uit de vastgelegde strategie en zet het bij die pagina's klaar" : "Leg eerst de strategie vast; die is de bron voor het advies"} onClick={() => void startGelieerde()}>{busy === "gelieerde" ? "Bezig…" : p.gelieerde ? "Opnieuw ↻" : "Start ▷"}</button>;
    }
    if (key === "analyse" || key === "blauwdruk" || key === "copy") {
      const geblokkeerd = key === "analyse" ? !p.live : (!p.live && !p.strategie);
      const titel = key === "analyse"
        ? (p.live ? "Analyseer de huidige live pagina (met de kaart-achtergrond als sturing)" : "De pagina is nog niet live; een analyse kan pas daarna")
        : (geblokkeerd ? "Eerst de strategie goedkeuren (nieuwe pagina)" : "Start dit document (met de kaart-achtergrond en chat-conclusie als sturing)");
      const tekst = key === "analyse" && !p.live ? "Na livegang" : p[key] ? "Opnieuw ↻" : "Start ▷";
      return <button type="button" className="wp-fase-btn" disabled={geblokkeerd || runActive || !!busy} title={titel} onClick={() => void startDocStep([key])}>{tekst}</button>;
    }
    if (key === "bouw") {
      return <button type="button" className="wp-fase-btn" title="Mail over de bouw of publicatie (ontvanger kies je in het venster)" onClick={() => onMail("dev")}>Mail</button>;
    }
    if (key === "structured") {
      return (
        <>
          <button type="button" className="wp-fase-btn" disabled={schemaRunning || !!busy} title={!p.bouw && p.copy ? "Let op: staat de nieuwe copy al live? Anders is de analyse te vroeg." : "Start de structured-data-analyse"} onClick={() => void startSchema()}>{p.structured ? "Opnieuw ↻" : "Start ▷"}</button>
          <button type="button" className="wp-fase-btn wp-fase-btn-licht" disabled={!!busy || schemaRunning} title="Her-fetcht de live pagina en checkt of het geadviseerde schema er nu echt staat (en niet dubbel)." onClick={() => void controleerLive()}>{busy === "verify" ? "Checken…" : "Controleer live"}</button>
        </>
      );
    }
    return null;
  }

  const tab0 = TAB_FOR_TYPE[t.taaktype];
  const tab = tab0 && (tab0.tab !== "paginas" || t.url) ? tab0 : undefined;
  const anyLink = t.url || t.copyUrl || t.bronMail || (tab && onGoToTab);
  // Titel en subtitel splitsen: "Ontwikkel /pad/ (copy, bouw, ...)" leest rustiger
  // met het haakjes-deel als eigen regel eronder (stijl weekplanner-voorbeeld).
  const titelMatch = /^(.*?)\s*(\([^()]{3,}\))\s*$/.exec(t.taak);
  const titel = titelMatch ? titelMatch[1] : t.taak;
  const subtitel = titelMatch ? titelMatch[2] : "";
  // Eén keer parsen: het unieke verhaal voor het bovenblok, de fase-sturing voor de rijen.
  const info = splitCardInfo(t.toelichting, t.taak);

  // Dichtklappen mag nooit een lopende tekstselectie opeten (kopiëren gaat voor).
  const toggleAlsGeenSelectie = () => {
    const s = typeof window !== "undefined" ? window.getSelection() : null;
    if (s && !s.isCollapsed) return;
    onToggleOpen();
  };

  return (
    <div className={"wp-card wp-" + t.status + (open ? " wp-open" : "")}>
      <div className="wp-card-grid">
        {/* Alleen dit handvat is sleepbaar; de rest van de kaart blijft selecteerbare tekst. */}
        <span className="wp-card-grip" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="Sleep de kaart naar een andere week">⋮⋮</span>
        <div className="wp-card-main">
          <div className="wp-kop-rij">
            <div className="wp-kop-tekst">
              <div className="wp-card-taak wp-clickable" onClick={toggleAlsGeenSelectie} title={open ? "Klik om dicht te klappen" : "Klik voor de fases, info en chat"}>
                <span className="wp-caret">{open ? "▾" : "▸"}</span>
                {titel}
              </div>
              {subtitel && <div className="wp-card-sub wp-clickable" onClick={toggleAlsGeenSelectie}>{subtitel}</div>}
            </div>
            <span className="wp-kop-acties">
              <button type="button" className={"wp-status wp-status-" + t.status} onClick={onStatus} title="Klik om de status te wisselen">{STATUS_LABEL[t.status] || t.status}</button>
              <button type="button" className="wp-icon wp-del" title="Verwijderen" onClick={onRemove}>×</button>
            </span>
          </div>

      {open && hasInfo && (
        <div className="wp-opruim-rij">
          <button type="button" className="wp-fase-btn" disabled={busy === "opruimen"}
            title="Laat de AI de kaarttekst één keer herschrijven naar het strakke formaat (niets verzinnen, niets weggooien)."
            onClick={() => void ruimOp()}>{busy === "opruimen" ? "Bezig…" : "Ruim op"}</button>
          {opruimMsg && <span className={opruimMsg.startsWith("Kaart") ? "wp-opruim-ok" : "wp-opruim-fout"}>{opruimMsg}</span>}
        </div>
      )}
      {open && hasInfo && (
        <div className="wp-card-info wp-info-net"
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest?.(".wp-maildatum") as HTMLElement | null;
            if (el && onOpenMailDate) { e.stopPropagation(); onOpenMailDate(el.dataset.datum || ""); return; }
            const lb = (e.target as HTMLElement).closest?.(".wp-info-lijstbtn") as HTMLElement | null;
            if (lb) {
              e.stopPropagation();
              const li = lb.closest("li");
              const kloon = li?.cloneNode(true) as HTMLElement | undefined;
              kloon?.querySelectorAll(".wp-info-lijstbtn").forEach((b) => b.remove());
              const tekst = (kloon?.textContent || "").replace(/\s+/g, " ").trim();
              if (tekst) { setLijstPunt(tekst); setLijstMsg(""); }
            }
          }}
          dangerouslySetInnerHTML={{ __html: cardInfoHtml(t.toelichting, t.url, t.taak, cijferRegel(page)) }} />
      )}
      {open && lijstPunt && (
        <div className="ovc-lijstkeuze">
          <span>Op welke bespreeklijst?</span>
          {lijstPersonen.map((p) => (
            <button key={p} type="button" className="wp-fase-btn" onClick={() => void zetOpLijst(p)}>{p === "Dev" ? devLabel(devNaam) : p}</button>
          ))}
          <button type="button" className="wp-icon wp-del" title="Annuleren" onClick={() => setLijstPunt("")}>×</button>
        </div>
      )}
      {open && lijstMsg && <div className="wp-doc-ok">{lijstMsg}</div>}

      {/* Dichtgeklapt: compacte fase-chips. Klik = naar de pagina in Pagina's. */}
      {!open && page && (
        <div className="wp-steps" title="Waar deze pagina staat in de pijplijn. Klik open voor starten en afvinken."
          role="button" onClick={onToggleOpen}>
          {FASEN.map((f) => <span key={f.key} className={"wp-step" + (page[f.key] ? " wp-step-done" : "")}>{page[f.key] ? "✓ " : ""}{f.kort}</span>)}
          {(() => { const eerste = FASEN.find((f) => !page[f.key]); return eerste ? <span className="wp-step wp-step-next">Volgende: {eerste.label}</span> : <span className="wp-step wp-step-done">Alles klaar</span>; })()}
        </div>
      )}

      {/* Documenten: klantversies erin slepen; verwerken is een bewuste klik. */}
      {open && t.url && <DocVersies slug={slug} url={t.url} />}

      {/* Werklijst-sitebouwer-kaart: hier hoort het echte werk te staan, niet
          alleen een omschrijving. Knop, status en het kant-en-klare document. */}
      {open && !t.url && /werklijst sitebouwer|site-?breed/i.test(t.taak) && <WerklijstBlok slug={slug} refreshBoard={refreshBoard} />}

      {/* Chat direct onder het Doel-blok: de uitkomst hiervan voedt de fases eronder.
          Ook op kaarten zonder pagina, dan met een eigen bird's eye-gesprek. */}
      {open && (
        <div className="wp-chat">
          <button type="button" className={"wp-chat-toggle wp-chat-toggle-groot" + (chatOpen ? " wp-chat-open" : "")} onClick={() => (chatOpen ? setChatOpen(false) : void openChat())}>
            <Icoon d={ICOON.chat} className="wp-sectie-icoon" /> {t.url ? "Chat over deze pagina" : "Chat over deze taak"} {chatOpen ? "▾" : "▸"}
          </button>
          {chatOpen && (
            <div className="wp-chat-body">
              <div className="wp-chat-msgs" ref={msgsRef}>
                {msgs.length === 0 && !chatBusy && (
                  <div className="muted wp-chat-leeg">
                    {t.url
                      ? "Stel een vraag of spar over deze pagina. De kaart-achtergrond gaat automatisch mee als context."
                      : "Stel een vraag of zoek dit verder uit; de assistent kent de hele site. Van elk punt in het antwoord kun je direct een kaart maken."}
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={"wp-chat-blok " + (m.role === "user" ? "wp-chat-blok-vraag" : "")}>
                    <button type="button" className="wp-chat-del" title="Dit bericht verwijderen" onClick={() => void verwijderChatBericht(i)}>×</button>
                    {m.role === "user"
                      ? <div className="wp-chat-vraag">{m.content}</div>
                      : <div className="wp-chat-antwoord md">
                          <AntwoordBlokken
                            slug={slug}
                            thread={t.thread}
                            content={m.content}
                            toHtml={(md) => linkifyHtml(mdToHtml(md), (() => { try { return new URL(t.url).host; } catch { return ""; } })())}
                            onWeekplanChanged={refreshBoard}
                          />
                        </div>}
                  </div>
                ))}
                {chatBusy && <div className="muted wp-chat-leeg">Aan het nadenken…</div>}
              </div>
              {planVoorstel && (
                <div className="wp-chat-acties">
                  <button type="button" className="primary-btn small" disabled={busy === "strategie"} onClick={() => void legStrategieVast()}>Strategie vastleggen</button>
                </div>
              )}
              <div className="wp-chat-input">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vraag of instructie…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }} />
                <button type="button" className="primary-btn small" disabled={chatBusy || !input.trim()} onClick={() => void sendChat()}>Vraag</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* De cyclus verticaal, per fase status + start + vinkje. */}
      {open && page && <div className="wp-sectie-label">Fases</div>}
      {open && page && (
        <div className="wp-fases">
          {FASEN.map((f) => {
            const stand = faseStand(f.key);
            const link = docLink(f.key);
            // Eén regel sturing per fase, en pas zichtbaar als je die fase opent.
            // Stonden ze alle vijf tegelijk open, dan las je de instructie voor Copy
            // terwijl je bij Analyse zat en paste de kaart nergens meer in één blik.
            const sturing = (info.perFase[f.key as CardFaseKey] || []).join(" · ");
            const sturingOpen = !!faseOpen[f.key];
            const rij = (
              <div key={f.key} className="wp-fase">
                <div className="wp-fase-rij">
                  {/* Was een aankruisvakje, maar dat leek op iets dat je moest doen
                      terwijl het alleen een aantekening maakte. Het dashboard meet
                      elke fase inmiddels zelf, dus er blijft per rij één ding over dat
                      iets doet (de knop) en één dat iets zegt (het chipje rechts). */}
                  <span className={"wp-fase-bullet" + (page[f.key] ? " aan" : "")} aria-hidden="true" />
                  <span className="wp-fase-label">{f.label}</span>
                  {sturing && (
                    <button type="button" className="wp-fase-uitleg"
                      title={sturingOpen ? "Verberg de sturing voor deze stap" : "Toon de sturing voor deze stap"}
                      onClick={() => setFaseOpen((v) => ({ ...v, [f.key]: !v[f.key] }))}>
                      {sturingOpen ? "uitleg ▴" : "uitleg ▾"}
                    </button>
                  )}
                  <span className="wp-fase-spacer" />
                  {/* Alle pillen rechts, in vaste volgorde: Document | In Pagina's | actie | status. */}
                  {link && <a className="wp-fase-btn wp-fase-doc" href={link} target="_blank" rel="noreferrer" title="Open het document">Document</a>}
                  <button type="button" className="wp-fase-btn wp-fase-btn-licht" title="Bekijk of doe deze stap in Pagina's (nieuw tabblad)" onClick={openPaginaNieuwTab}>In Pagina&rsquo;s</button>
                  {faseActie(f.key)}
                  <span className={"wp-fase-chip " + stand.cls} title={stand.label === "✓" ? "Klaar" : undefined}>{stand.label}</span>
                </div>
                {/* Slugs/URL's in de sturing zijn altijd klikbaar (harde huisregel). */}
                {sturing && sturingOpen && <div className="wp-fase-sturing" dangerouslySetInnerHTML={{ __html: linkifyHtml(sturing.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), (() => { try { return new URL(t.url).host; } catch { return ""; } })()) }} />}
              </div>
            );
            if (f.key !== "copy") return rij;
            // Na Copy: de alles-in-één-rij (analyse, blauwdruk en copy achter elkaar).
            const alleStappen: ("analyse" | "blauwdruk" | "copy")[] = page.live ? ["analyse", "blauwdruk", "copy"] : ["blauwdruk", "copy"];
            const allesGeblokkeerd = !page.live && !page.strategie;
            return (
              <div key="copy-en-alles">
                {rij}
                <div className="wp-fase wp-fase-alles">
                  <div className="wp-fase-rij">
                    <span className="wp-fase-alles-label">{page.live ? "Analyse, blauwdruk en copy in één keer" : "Blauwdruk en copy in één keer"}</span>
                    <span className="wp-fase-spacer" />
                    <button type="button" className="wp-fase-btn" disabled={allesGeblokkeerd || runActive || !!busy}
                      title={allesGeblokkeerd ? "Eerst de strategie goedkeuren (nieuwe pagina)" : "Draait de documenten achter elkaar, met de kaart-achtergrond en chat-conclusie als sturing"}
                      onClick={() => void startDocStep(alleStappen)}>Start alles ▷</button>
                  </div>
                </div>
              </div>
            );
          })}
          {verifyMsg && <div className={verifyMsg.ok ? "wp-doc-ok" : "wp-doc-fout"}>{verifyMsg.tekst}</div>}
          {page.live && page.copy && !page.bouw && <div className="wp-fase-hint">De copy is klaar en de pagina staat live. Is de nieuwe tekst verwerkt, vink dan Bouw en publicatie af.</div>}
          {foutje && <div className="wp-fase-fouttekst">{foutje}</div>}
          {melding && <div className="wp-fase-melding">{melding}</div>}
        </div>
      )}

      {/* Eén nette onderste regel, alles rechts uitgelijnd: links plus de Mail-knop.
          Alleen op de open kaart; dichtgeklapt blijft de kaart compact. */}
      {open && <div className="wp-card-links wp-onder-regel">
        {t.url && <a className="wp-link" href={t.url} target="_blank" rel="noreferrer" title="De live pagina">{shortUrl(t.url)}</a>}
        {t.copyUrl && <a className="wp-link" href={t.copyUrl} target="_blank" rel="noreferrer" title="De aangeleverde copy">Copy</a>}
        {t.bronMail && <a className="wp-link" href={t.bronMail} target="_blank" rel="noreferrer" title="De mail waar deze taak uit voortkomt">Bronmail</a>}
        {/* Geen dubbele knop: bij paginakaarten dekt de Pagina's-knop hieronder het al. */}
        {tab && tab.tab !== "paginas" && <button type="button" className="wp-link wp-link-btn" title="Open dit dashboard-onderdeel in een nieuw tabblad" onClick={() => openTabNieuwTab(tab.tab)}>{tab.label}</button>}
        {t.url && <button type="button" className="wp-link wp-link-btn" title="Open de pagina in Pagina's (nieuw tabblad)" onClick={openPaginaNieuwTab}>Pagina&rsquo;s</button>}
        {/* De developerpagina werd alleen gevoed door de oude takentabel, dus met de
            weekplanning was mailen het enige wat er nog over was. Hiermee staat de
            kaart weer gewoon op die pagina, waar jij en de sitebouwer hem allebei zien. */}
        <button type="button" className={"wp-link wp-link-btn" + (naarDev ? " wp-link-aan" : "")}
          disabled={devBezig}
          title={naarDev ? "Staat op de developerpagina. Klik om hem er weer af te halen." : "Zet deze kaart op de developerpagina, naast de andere taken voor de sitebouwer."}
          onClick={() => void zetNaarDev()}>
          {devBezig ? "Bezig…" : naarDev ? "✓ Op developerpagina" : "Naar developer"}
        </button>
        <button type="button" className="wp-act wp-act-klant" title="Mail over deze kaart; de ontvanger (klant, developer of anders) kies je in het venster." onClick={() => onMail("klant")}>Mail</button>
      </div>}
        </div>
      </div>
    </div>
  );
}

// Blok op de werklijst-sitebouwer-kaart: maak of ververs de site-brede werklijst
// (meta's en alt-teksten kant-en-klaar) en toon de status, samenvatting en het
// document. De motor zet na afloop zelf de doc-link en samenvatting op de kaart.
function WerklijstBlok({ slug, refreshBoard }: { slug: string; refreshBoard: () => void }) {
  const [status, setStatus] = useState<string>("idle");
  const [docLink, setDocLink] = useState("");
  const [resultaat, setResultaat] = useState("");
  const [fout, setFout] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [teller, setTeller] = useState<{ totaal: number; gedaan: number; geverifieerd: number } | null>(null);
  const [actieBusy, setActieBusy] = useState("");
  const [actieMsg, setActieMsg] = useState("");

  async function haal(): Promise<string> {
    const d = await fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) {
      setStatus(d.status || "idle"); setDocLink(d.docLink || ""); setResultaat(d.result || "");
      setShareToken(d.shareToken || "");
      setTeller(d.totaal ? { totaal: d.totaal, gedaan: d.gedaan || 0, geverifieerd: d.geverifieerd || 0 } : null);
      if (d.status === "error") setFout(d.error || "");
    }
    return d?.status || "idle";
  }

  // Live-controle of WordPress-doorvoer vanaf de kaart.
  async function actie(soort: "verify" | "meta" | "alt") {
    if (actieBusy) return;
    setActieBusy(soort); setActieMsg("");
    try {
      const url = soort === "verify" ? "/api/admin/dev-worklist/verify" : "/api/admin/dev-worklist/push";
      const body = soort === "verify" ? { slug } : { slug, wat: soort };
      const d = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      setActieMsg(d?.ok ? (d.samenvatting || d.melding || "Klaar.") : (d?.error || "Dat lukte niet; probeer het nog een keer."));
      void haal();
    } catch { setActieMsg("Dat lukte niet; probeer het nog een keer."); }
    finally { setActieBusy(""); }
  }
  useEffect(() => {
    void haal().then((s) => { if (s === "running") void volg(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function volg() {
    for (let i = 0; i < 70; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await haal();
      if (s === "done" || s === "error") { if (s === "done") refreshBoard(); return; }
    }
  }
  function start() {
    setStatus("running"); setFout(""); setResultaat("");
    fetch("/api/admin/dev-worklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
    void volg();
  }

  return (
    <div className="wp-werklijst">
      <div className="wp-werklijst-rij">
        <span className="wp-sectie-label" style={{ margin: 0 }}>Werklijst voor de sitebouwer</span>
        {teller && <span className="wp-werklijst-teller">{teller.gedaan}/{teller.totaal} gedaan · {teller.geverifieerd} gecontroleerd</span>}
        <span className="wp-fase-spacer" />
        <a className="wp-fase-btn wp-fase-btn-primair" href={`/admin/client/${slug}/werklijst`} target="_blank" rel="noreferrer" title="De Pingwin-versie: huidige meta naast ons voorstel, met de knop Voer door in de site">Onze werklijst</a>
        {shareToken && <a className="wp-fase-btn" href={`/share/werklijst/${shareToken}`} target="_blank" rel="noreferrer" title="De klikbare afwerkpagina voor de sitebouwer (deelbare link, geen inlog nodig)">Voor de sitebouwer</a>}
        {docLink && <a className="wp-fase-btn wp-fase-doc" href={docLink} target="_blank" rel="noreferrer" title="Hetzelfde overzicht als document">Document</a>}
        <button type="button" className="wp-fase-btn" disabled={status === "running"} onClick={start}>
          {status === "running" ? "Bezig… (paar minuten)" : docLink || shareToken ? "Ververs werklijst" : "Maak de werklijst"}
        </button>
      </div>
      {shareToken && (
        <div className="wp-werklijst-rij">
          <button type="button" className="wp-fase-btn" disabled={!!actieBusy} title="Meet de live pagina's en zet groene gecontroleerd-vinkjes op alles wat er echt goed op staat" onClick={() => void actie("verify")}>{actieBusy === "verify" ? "Controleren…" : "Controleer live"}</button>
          <button type="button" className="wp-fase-btn" disabled={!!actieBusy} title="Zet alle nieuwe meta-titles en descriptions rechtstreeks in WordPress (site moet gekoppeld zijn via Meta & CTR)" onClick={() => void actie("meta")}>{actieBusy === "meta" ? "Doorvoeren…" : "Zet meta's in WordPress"}</button>
          <button type="button" className="wp-fase-btn" disabled={!!actieBusy} title="Zet de alt-teksten van unieke afbeeldingen rechtstreeks in WordPress; dubbel gebruikte blijven voor de sitebouwer" onClick={() => void actie("alt")}>{actieBusy === "alt" ? "Doorvoeren…" : "Zet alt-teksten in WordPress"}</button>
        </div>
      )}
      {actieMsg && <div className="wp-werklijst-sam">{actieMsg}</div>}
      {status === "running" && <div className="muted">De pagina's worden gemeten en de meta's en alt-teksten geschreven; dit duurt een paar minuten. Je kunt intussen gewoon verder.</div>}
      {resultaat && status === "done" && !actieMsg && <div className="wp-werklijst-sam">{resultaat}</div>}
      {fout && <div className="wp-doc-fout">{fout}</div>}
      {!docLink && !shareToken && status !== "running" && !resultaat && (
        <div className="muted">Nog geen werklijst gemaakt. De werklijst meet alle live pagina&rsquo;s en zet per pagina de nieuwe meta&rsquo;s en alt-teksten klaar op een klikbare afwerkpagina voor de sitebouwer.</div>
      )}
    </div>
  );
}

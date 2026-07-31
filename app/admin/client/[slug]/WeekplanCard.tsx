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

export type WpTask = { id: number; thread: string; taak: string; toelichting: string; wie: string; url: string; taaktype: string; copyUrl: string; bronMail: string; weekYear: number; weekNo: number; status: string; sortOrder: number };
export type WpPageInfo = { url: string; live: boolean; strategie: boolean; gelieerde: boolean; analyse: boolean; blauwdruk: boolean; copy: boolean; bouw: boolean; structured: boolean; structuredStatus: string; next: string; links: { analyse: string; blauwdruk: string; copy: string } };

// Bij welk taaktype hoort welk dashboard-tabblad (voor de deep-link "doe het hier").
const TAB_FOR_TYPE: Record<string, { tab: string; label: string }> = {
  meta: { tab: "meta", label: "Meta & CTR ↗" },
  alt: { tab: "paginas", label: "Pagina's ↗" },
  copy: { tab: "paginas", label: "Pagina's ↗" },
  intern: { tab: "paginas", label: "Pagina's ↗" },
  structured: { tab: "paginas", label: "Pagina's ↗" },
  strategie: { tab: "paginas", label: "Pagina's ↗" },
  pijplijn: { tab: "paginas", label: "Pagina's ↗" },
  overig: { tab: "paginas", label: "Pagina's ↗" },
};
const STATUS_LABEL: Record<string, string> = { gepland: "Gepland", bezig: "Bezig", klaar: "Klaar" };

type FaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

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

export default function WeekplanCard({ slug, t, page, open, onToggleOpen, onDragStart, onDragEnd, onStatus, onRemove, onMail, onGoToPage, onGoToTab, refreshBoard }: {
  slug: string; t: WpTask; page?: WpPageInfo; open: boolean;
  onToggleOpen: () => void; onDragStart: () => void; onDragEnd: () => void;
  onStatus: () => void; onRemove: () => void; onMail: (aud: "klant" | "dev") => void;
  onGoToPage?: (url: string) => void; onGoToTab?: (tab: string) => void; refreshBoard: () => void;
}) {
  const hasInfo = !!t.toelichting.trim();
  const [run, setRun] = useState<RunInfo>(null);
  const [everLinks, setEverLinks] = useState<Record<string, string>>({});
  const [schemaStatus, setSchemaStatus] = useState<string>(page?.structuredStatus || "idle");
  const [busy, setBusy] = useState<string>("");
  const [foutje, setFoutje] = useState<string>("");
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

  async function startDocStep(step: "analyse" | "blauwdruk" | "copy") {
    if (busy || runActive) return;
    setBusy(step); setFoutje("");
    try {
      // Gerichte sturing: de achtergrond plus specifiek de sturing van déze fase,
      // niet de hele kaarttekst (scherpere documenten, minder ruis).
      const extra = faseSturing(splitCardInfo(t.toelichting), step) || t.toelichting.slice(0, 1500);
      const d = await fetch("/api/admin/page-doc/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, steps: [step], extra, folderId: "", audience: "klant" }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else setRun({ status: "running", steps: { [step]: "running" }, links: {} });
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  // Start "Gelieerde pagina's": de vastgelegde strategie wordt server-side de bron
  // voor het advies aan de andere cluster-pagina's (half plan), in één klik.
  async function startGelieerde() {
    if (busy) return;
    setBusy("gelieerde"); setFoutje("");
    try {
      const d = await fetch("/api/admin/page-cluster-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else if (!d.saved) setFoutje(d.message || "Geen concreet advies voor gelieerde pagina's gevonden.");
      else refreshBoard();
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

  async function vink(fase: FaseKey, done: boolean) {
    try {
      await fetch("/api/admin/weekplan/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, fase, done }) });
      refreshBoard();
    } catch { /* stil */ }
  }

  // Chat: laden (meest recente pagina-chat) bij eerste keer openklappen.
  async function openChat(prefill?: string) {
    setChatOpen(true);
    if (prefill) setInput(prefill);
    if (msgs.length || !t.url) return;
    try {
      const d = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
      const eerste = d?.chats?.[0];
      if (eerste?.id) {
        const c = await fetch(`/api/admin/page-chats?id=${eerste.id}`).then((r) => r.json());
        if (c?.ok && Array.isArray(c.chat?.messages)) { setMsgs(c.chat.messages); setChatId(eerste.id); }
      }
    } catch { /* stil */ }
  }

  async function sendChat() {
    const tekst = input.trim();
    if (!tekst || chatBusy || !t.url) return;
    setInput(""); setChatBusy(true); setFoutje("");
    const next: ChatMsg[] = [...msgs, { role: "user", content: tekst }];
    setMsgs(next);
    try {
      // De kaart-achtergrond reist als los context-bericht mee (niet opgeslagen,
      // dus de chat-titel blijft de echte vraag en de context is altijd actueel).
      const seed: ChatMsg | null = hasInfo ? { role: "user", content: `Achtergrond van deze projectkaart (context, hoeft geen apart antwoord):\n${t.toelichting.slice(0, 2000)}` } : null;
      const outgoing = seed ? [seed, ...next.slice(-11)] : next.slice(-12);
      const d = await fetch("/api/admin/page-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, messages: outgoing }) }).then((r) => r.json());
      if (!d?.ok) { setFoutje(d?.error || "De assistent is niet bereikbaar."); setChatBusy(false); return; }
      const withReply: ChatMsg[] = [...next, { role: "assistant", content: String(d.reply || "") }];
      setMsgs(withReply);
      if (d.proposal?.plan) setPlanVoorstel(String(d.proposal.plan));
      const s = await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, id: chatId, messages: withReply }) }).then((r) => r.json()).catch(() => null);
      if (s?.ok && s.id) setChatId(s.id);
    } catch { setFoutje("De assistent is niet bereikbaar."); } finally { setChatBusy(false); }
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
    if (page && page[key]) return { label: "✓ Klaar", cls: "wp-fase-klaar" };
    if ((key === "analyse" || key === "blauwdruk" || key === "copy") && runActive) {
      const st = run?.steps?.[key] || "";
      if (st === "running") return { label: "Bezig…", cls: "wp-fase-bezig" };
      if (st === "pending") return { label: "Wacht", cls: "wp-fase-bezig" };
      if (st === "error") return { label: "Fout", cls: "wp-fase-fout" };
    }
    if (key === "structured" && schemaRunning) return { label: "Bezig…", cls: "wp-fase-bezig" };
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
      return <button type="button" className="wp-fase-btn" onClick={() => void openChat("Stel een strategie voor deze pagina voor. Houd rekening met de achtergrond van deze kaart.")}>{p.strategie ? "Bespreek" : "Bespreek strategie"}</button>;
    }
    if (key === "gelieerde") {
      const kan = p.strategie;
      return <button type="button" className="wp-fase-btn" disabled={!kan || busy === "gelieerde"} title={kan ? "Haal advies voor gelieerde pagina's uit de vastgelegde strategie en zet het bij die pagina's klaar" : "Leg eerst de strategie vast; die is de bron voor het advies"} onClick={() => void startGelieerde()}>{busy === "gelieerde" ? "Bezig…" : p.gelieerde ? "Opnieuw ↻" : "Start ▷"}</button>;
    }
    if (key === "analyse" || key === "blauwdruk" || key === "copy") {
      const geblokkeerd = key === "analyse" ? !p.live : (!p.live && !p.strategie);
      const titel = key === "analyse"
        ? (p.live ? "Analyseer de huidige live pagina (met de kaart-achtergrond als sturing)" : "De pagina is nog niet live; een analyse kan pas daarna")
        : (geblokkeerd ? "Eerst de strategie goedkeuren (nieuwe pagina)" : "Start dit document (met de kaart-achtergrond als sturing)");
      return <button type="button" className="wp-fase-btn" disabled={geblokkeerd || runActive || !!busy} title={titel} onClick={() => void startDocStep(key)}>{p[key] ? "Opnieuw ↻" : "Start ▷"}</button>;
    }
    if (key === "bouw") {
      return <button type="button" className="wp-fase-btn" title="Mail de developer/sitebouwer over de bouw of publicatie" onClick={() => onMail("dev")}>Dev {"</>"}</button>;
    }
    if (key === "structured") {
      return <button type="button" className="wp-fase-btn" disabled={schemaRunning || !!busy} title={!p.bouw && p.copy ? "Let op: staat de nieuwe copy al live? Anders is de analyse te vroeg." : "Start de structured-data-analyse"} onClick={() => void startSchema()}>{p.structured ? "Opnieuw ↻" : "Start ▷"}</button>;
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
  const info = splitCardInfo(t.toelichting);

  // Dichtklappen mag nooit een lopende tekstselectie opeten (kopiëren gaat voor).
  const toggleAlsGeenSelectie = () => {
    const s = typeof window !== "undefined" ? window.getSelection() : null;
    if (s && !s.isCollapsed) return;
    onToggleOpen();
  };

  return (
    <div className={"wp-card wp-" + t.status + (open ? " wp-open" : "")}>
      <div className="wp-card-kop">
        {/* Alleen dit handvat is sleepbaar; de rest van de kaart blijft selecteerbare tekst. */}
        <span className="wp-card-grip" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="Sleep de kaart naar een andere week">⠿</span>
        <div className="wp-card-koptekst">
          <div className="wp-card-taak wp-clickable" onClick={toggleAlsGeenSelectie} title={open ? "Klik om dicht te klappen" : "Klik voor de fases, info en chat"}>
            <span className="wp-caret">{open ? "▾" : "▸"}</span>
            {titel}
          </div>
          {subtitel && <div className="wp-card-sub wp-clickable" onClick={toggleAlsGeenSelectie}>{subtitel}</div>}
        </div>
      </div>

      {open && hasInfo && <div className="wp-card-info wp-info-net" dangerouslySetInnerHTML={{ __html: cardInfoHtml(t.toelichting, t.url) }} />}

      {/* Dichtgeklapt: compacte fase-chips. Klik = naar de pagina in Pagina's. */}
      {!open && page && (
        <div className="wp-steps" title="Waar deze pagina staat in de pijplijn. Klik open voor starten en afvinken."
          role="button" onClick={onToggleOpen}>
          {FASEN.map((f) => <span key={f.key} className={"wp-step" + (page[f.key] ? " wp-step-done" : "")}>{page[f.key] ? "✓ " : ""}{f.kort}</span>)}
          {(() => { const eerste = FASEN.find((f) => !page[f.key]); return eerste ? <span className="wp-step wp-step-next">Volgende: {eerste.label}</span> : <span className="wp-step wp-step-done">Alles klaar</span>; })()}
        </div>
      )}

      {/* Open: de hele cyclus verticaal, per fase status + start + vinkje. */}
      {open && page && <div className="wp-sectie-label">Fases</div>}
      {open && page && (
        <div className="wp-fases">
          {FASEN.map((f) => {
            const stand = faseStand(f.key);
            const link = docLink(f.key);
            const sturing = (info.perFase[f.key as CardFaseKey] || []).join(" · ");
            return (
              <div key={f.key} className="wp-fase">
                <div className="wp-fase-rij">
                  <label className="wp-fase-check" title="Handmatig afvinken of terugzetten">
                    <input type="checkbox" checked={!!page[f.key]} onChange={(e) => void vink(f.key, e.target.checked)} />
                  </label>
                  <Icoon d={f.icoon} />
                  <span className="wp-fase-label">{f.label}</span>
                  <span className={"wp-fase-chip " + stand.cls}>{stand.label}</span>
                  {link && <a className="wp-link" href={link} target="_blank" rel="noreferrer" title="Open het document">Document ↗</a>}
                  <span className="wp-fase-spacer" />
                  {onGoToPage && <button type="button" className="wp-fase-btn wp-fase-btn-licht" title="Bekijk of doe deze stap in Pagina's" onClick={() => onGoToPage(t.url)}>In Pagina&rsquo;s ↗</button>}
                  {faseActie(f.key)}
                </div>
                {sturing && <div className="wp-fase-sturing">{sturing}</div>}
              </div>
            );
          })}
          {page.live && page.copy && !page.bouw && <div className="wp-fase-hint">De copy is klaar en de pagina staat live. Is de nieuwe tekst verwerkt, vink dan Bouw en publicatie af.</div>}
          {foutje && <div className="wp-fase-fouttekst">{foutje}</div>}
        </div>
      )}

      {/* Chat en Locatie naast elkaar (stijl voorbeeld); de chat klapt eronder uit. */}
      {open && (t.url || anyLink) && (
        <div className="wp-onder-rij">
          {t.url && (
            <button type="button" className="wp-chat-toggle" onClick={() => (chatOpen ? setChatOpen(false) : void openChat())}>
              <Icoon d={ICOON.chat} className="wp-sectie-icoon" /> Chat over deze pagina {chatOpen ? "▾" : "▸"}
            </button>
          )}
          {anyLink && (
            <div className="wp-onder-blok">
              <div className="wp-sectie-label wp-sectie-metikoon"><Icoon d={ICOON.pin} className="wp-sectie-icoon" /> Locatie</div>
              <div className="wp-card-links">
                {t.url && <a className="wp-link" href={t.url} target="_blank" rel="noreferrer" title="De live pagina">{shortUrl(t.url)}</a>}
                {t.copyUrl && <a className="wp-link" href={t.copyUrl} target="_blank" rel="noreferrer" title="De aangeleverde copy">Copy ↗</a>}
                {t.bronMail && <a className="wp-link" href={t.bronMail} target="_blank" rel="noreferrer" title="De mail waar deze taak uit voortkomt">✉ bronmail</a>}
                {tab && onGoToTab && <button type="button" className="wp-link wp-link-btn" title="Doe het hier in het dashboard" onClick={() => onGoToTab(tab.tab)}>{tab.label}</button>}
              </div>
            </div>
          )}
        </div>
      )}
      {open && t.url && (
        <div className="wp-chat">
          {chatOpen && (
            <div className="wp-chat-body">
              <div className="wp-chat-msgs" ref={msgsRef}>
                {msgs.length === 0 && !chatBusy && <div className="muted wp-chat-leeg">Stel een vraag of spar over deze pagina. De kaart-achtergrond gaat automatisch mee als context.</div>}
                {msgs.map((m, i) => m.role === "user"
                  ? <div key={i} className="wp-chat-vraag">{m.content}</div>
                  : <div key={i} className="wp-chat-antwoord md" dangerouslySetInnerHTML={{ __html: linkifyHtml(mdToHtml(m.content), (() => { try { return new URL(t.url).host; } catch { return ""; } })()) }} />)}
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

      {!open && anyLink && (
        <div className="wp-card-links">
          {t.url && <a className="wp-link" href={t.url} target="_blank" rel="noreferrer" title="De live pagina">{shortUrl(t.url)}</a>}
          {t.copyUrl && <a className="wp-link" href={t.copyUrl} target="_blank" rel="noreferrer" title="De aangeleverde copy">Copy ↗</a>}
          {t.bronMail && <a className="wp-link" href={t.bronMail} target="_blank" rel="noreferrer" title="De mail waar deze taak uit voortkomt">✉ bronmail</a>}
          {tab && onGoToTab && <button type="button" className="wp-link wp-link-btn" title="Doe het hier in het dashboard" onClick={() => onGoToTab(tab.tab)}>{tab.label}</button>}
        </div>
      )}

      <div className="wp-card-foot">
        <span className={"wp-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
        <button type="button" className={"wp-status wp-status-" + t.status} onClick={onStatus} title="Klik om de status te wisselen">{STATUS_LABEL[t.status] || t.status}</button>
        <span className="wp-card-actions">
          <button type="button" className="wp-act wp-act-klant" title="Mail naar klant: een klantvriendelijke uitleg van deze kaart." onClick={() => onMail("klant")}>Mail klant</button>
          <button type="button" className="wp-act" title="Mail deze taak naar je developer/sitebouwer." onClick={() => onMail("dev")}>Dev ✉</button>
          {t.url && onGoToPage && <button type="button" className="wp-act" title="Open de pagina in Pagina's voor het diepe werk." onClick={() => onGoToPage(t.url)}>Pagina&rsquo;s ↗</button>}
          <button type="button" className="wp-icon wp-del" title="Verwijderen" onClick={onRemove}>×</button>
        </span>
      </div>
    </div>
  );
}

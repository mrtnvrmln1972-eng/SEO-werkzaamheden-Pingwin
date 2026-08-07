"use client";

import { useState, useRef, useEffect } from "react";
import ActionCard, { type Action } from "./ActionCard";
import TakenVoorstel, { type Oogst } from "./TakenVoorstel";
import DeelKnoppen from "./DeelKnoppen";
import ChatBestanden from "./ChatBestanden";
import { linkifyHtml as linkify } from "../../../../lib/linkify";
import { vraagHtml } from "../../../../lib/vraag-opmaak";
import { striptVulzinnen } from "../../../../lib/vulzinnen";
import { eersteKop } from "../../../../lib/chat-vouw";
import { bestandMelding } from "../../../../lib/bestand-melding";
import MailVenster from "./MailVenster";
import Bronnenstrip, { type Bron } from "./Bronnenstrip";

type Msg = { role: "user" | "assistant"; content: string; actions?: Action[]; soort?: "conclusie" | "oogst"; oogst?: Oogst; bronnen?: Bron[] };
type Topic = { thread: string; count: number; title: string; summary: string; done: boolean };

// ── Diep denken ──
// De bird's eye draait op het zware model, want dit is het gesprek waarin de opzet
// zelf ter discussie staat. Dat kost meer dan een gewoon antwoord, dus de knop
// staat hier, waar het gesprek is, en niet ergens in de code. Alleen de eigenaar
// mag de instelling lezen en zetten; kan hij dat niet, dan blijft de knop weg in
// plaats van een foutmelding te tonen.
const DIEP_SLEUTEL = "overview_diep_denken";
function DiepDenken() {
  const [aan, setAan] = useState<boolean | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    let weg = false;
    void fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!weg && d?.ok) setAan(d.settings?.[DIEP_SLEUTEL] !== "uit"); })
      .catch(() => { /* geen toegang: knop blijft weg */ });
    return () => { weg = true; };
  }, []);
  if (aan === null) return null;
  const zet = async (waarde: boolean) => {
    setBezig(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: DIEP_SLEUTEL, value: waarde ? "aan" : "uit" }),
      });
      if (r.ok) setAan(waarde);
    } catch { /* stand blijft staan */ } finally { setBezig(false); }
  };
  return (
    <button
      type="button"
      className={"ghost-btn small" + (aan ? " actief" : "")}
      disabled={bezig}
      title={aan
        ? "Overview denkt diep: het zware model, voor strategie en tegenspraak. Kost meer per antwoord. Klik om uit te zetten."
        : "Overview draait op het gewone model: sneller en goedkoper, minder diepgang. Klik om diep denken aan te zetten."}
      onClick={() => void zet(!aan)}
    >
      Diep denken: {aan ? "aan" : "uit"}
    </button>
  );
}

// Slugs/URL's klikbaar maken: gedeelde bron in lib/linkify.ts (zelfde gedrag als
// voorheen, nu herbruikbaar voor de projectkaarten en andere output-plekken).

// De weekplanning stond twee keer in hetzelfde antwoord: als opsomming in de tekst
// ("Week 1 — ... Week 2 — ...") én als voorstel-blok met exact dezelfde taken. Dat
// leverde ook twee tellingen op die elkaar leken tegen te spreken ("3 punten
// afgehandeld" naast "3 van de 5 staan nog niet in de weekplanning"). Het blok is de
// waarheid, want dat is wat je echt kunt doorzetten; de opsomming gaat eruit. De
// prompt verbiedt die opsomming al, maar de assistent houdt zich daar niet altijd
// aan, en dit werkt ook op alle antwoorden die er al staan.
function zonderWeekrecap(md: string, heeftVoorstel: boolean): string {
  if (!heeftVoorstel) return md;
  const regels = (md || "").split("\n");
  const uit = regels.filter((r) => {
    const t = r.trim().replace(/^[-*]\s*/, "").replace(/\*\*/g, "");
    return !/^week\s*\d+\s*[—–:-]/i.test(t);
  });
  const samen = uit.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return samen || md;
}

// Wat er gedeeld wordt als je er een document of een mail van maakt. Is er een
// conclusie getrokken, dan is dát het stuk: dat is de gewogen samenvatting van het
// hele gesprek. Anders alle antwoorden achter elkaar, want één los antwoord mist
// vaak de helft van de redenering.
// Alle antwoorden achter elkaar. Het mailvenster kijkt hierin of er al een
// geschreven mail in het gesprek staat; `deelTekst` hieronder knijpt terug tot de
// laatste conclusie (goed voor een document), en juist dan viel zo'n mail eruit.
function alleAntwoorden(msgs: Msg[]): string {
  return msgs.filter((m) => m.role === "assistant" && m.soort !== "oogst")
    .map((m) => (m.content || "").trim()).filter(Boolean).join("\n\n");
}

// Het laatste blok: het laatste echte antwoord na jouw laatste vraag. Dat is wat
// de knop "Zet dit blok in een mail" onderaan meeneemt. Het taken-voorstel
// ("oogst") telt niet mee; dat is een knoppenlijst, geen tekst.
function laatsteBlok(msgs: Msg[]): string {
  const m = [...msgs].reverse().find((x) => x.role === "assistant" && x.soort !== "oogst" && (x.content || "").trim());
  return (m?.content || "").trim();
}

function deelTekst(msgs: Msg[]): string {
  const conclusie = msgs.filter((m) => m.soort === "conclusie").map((m) => m.content || "").filter(Boolean);
  if (conclusie.length) return conclusie[conclusie.length - 1];
  return msgs.filter((m) => m.role === "assistant" && m.soort !== "oogst").map((m) => (m.content || "").trim()).filter(Boolean).join("\n\n");
}

// Lichte Markdown → HTML (kopjes, bullets, vet, links, tabellen). Zelfde regels
// als de zwevende chat, zodat antwoorden overal netjes renderen. Slugs en URL's
// worden aan het eind automatisch klikbaar gemaakt (linkify).
function mdToHtml(md: string, domain = ""): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escape(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      // Markdown-link met relatief pad: alleen het kale pad tonen (linkify maakt
      // het klikbaar); zo nooit rommelige [tekst](/pad/)-brackets in beeld.
      .replace(/\[([^\]]*)\]\((\/[^\s)]+)\)/g, "$2")
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
  return linkify(out.join(""), domain);
}

const BASE = "overzicht";
const labelOf = (t: string) => (t === BASE ? "Algemeen" : t.startsWith("overzicht:~") ? "Nieuw onderwerp" : t.replace(/^overzicht:/, ""));

// De gedokte bird's eye-assistent, nu per ONDERWERP (toggle). Elk onderwerp is
// standaard dichtgeklapt en toont zijn titel plus een korte samenvatting; je klapt
// er een open om het gesprek en de actie-kaarten te zien, en je kunt een onderwerp
// afvinken als "gedaan". Zo zie je in één oogopslag wat er speelt, zonder muur.
export default function OverviewChat({ slug, domain = "", configured, onGoToPage, onGoToTask, onWeekplanChanged, clientName, clientEmail, kaal }: { slug: string; kaal?: boolean; domain?: string; configured: boolean; onGoToPage?: (url: string) => void; onGoToTask?: (taskId: number) => void; onWeekplanChanged?: () => void; clientName?: string; clientEmail?: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [open, setOpen] = useState<string | null>(null);      // welk onderwerp is uitgeklapt (accordion)
  const [bevestig, setBevestig] = useState<string | null>(null); // welk onderwerp vraagt om bevestiging voor wissen
  const [messages, setMessages] = useState<Msg[]>([]);        // berichten van het open onderwerp
  const [titleDraft, setTitleDraft] = useState("");           // bewerkbare titel van het open onderwerp
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [oogstBusy, setOogstBusy] = useState<"" | "conclusie" | "taken">("");   // welke oogst-knop draait
  // Welke eerdere antwoorden Maarten weer heeft opengeklapt (bericht-index).
  const [openBericht, setOpenBericht] = useState<Record<number, boolean>>({});
  // Welk blok staat er in het mailvenster? Leeg = venster dicht.
  const [blokVoorMail, setBlokVoorMail] = useState<string>("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadSeq = useRef(0);
  const openRef = useRef<string | null>(null);
  useEffect(() => { openRef.current = open; }, [open]);
  const backfilled = useRef<Set<string>>(new Set());

  // Onderwerpen (threads) laden, alleen de bird's eye-namespace ("overzicht*").
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => {
        if (!alive || !d?.ok) return;
        const list = normalizeTopics(d.threads || []);
        setTopics(list);
        backfillMeta(list);   // met terugwerkende kracht: titel/samenvatting voor bestaande onderwerpen
      }).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  // Genereer titel + samenvatting voor één onderwerp (met terugwerkende kracht).
  // Markeert vooraf om dubbele calls te voorkomen; bij mislukken weer vrijgeven
  // zodat een volgende poging (openen/herladen) het opnieuw probeert.
  async function genMeta(thread: string) {
    if (backfilled.current.has(thread)) return;
    backfilled.current.add(thread);
    try {
      const d = await fetch("/api/admin/overview/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, generate: true }) }).then((r) => r.json());
      if (d?.ok && (d.title || d.summary)) {
        setTopics((ts) => normalizeTopics(ts.map((x) => x.thread === thread ? { ...x, ...(d.title ? { title: d.title } : {}), ...(d.summary ? { summary: d.summary } : {}) } : x)));
        if (openRef.current === thread && d.title) setTitleDraft(d.title);
        return;
      }
    } catch { /* stil, meta is optioneel */ }
    backfilled.current.delete(thread);
  }

  // Inhaalslag bij het openen van de tab: bestaande onderwerpen zonder titel of
  // samenvatting krijgen die automatisch, één voor één (rustig aan).
  async function backfillMeta(list: Topic[]) {
    const need = list.filter((t) => t.count > 0 && (!t.title.trim() || !t.summary.trim()));
    for (const t of need) await genMeta(t.thread);
  }

  // Zorg dat het basisonderwerp altijd bestaat, en sorteer: openstaand eerst,
  // "gedaan" onderaan.
  function normalizeTopics(threads: { thread: string; count?: number; title?: string; summary?: string; done?: boolean }[]): Topic[] {
    // De eigen gesprekken van projectkaarten ("overzicht:kaart:<id>") horen bij
    // die kaart, niet in deze onderwerpenlijst.
    const mine = threads.filter((t) => t.thread.startsWith("overzicht") && !t.thread.startsWith("overzicht:kaart:"));
    const list: Topic[] = mine.map((t) => ({ thread: t.thread, count: t.count || 0, title: t.title || "", summary: t.summary || "", done: !!t.done }));
    if (!list.some((t) => t.thread === BASE)) list.unshift({ thread: BASE, count: 0, title: "", summary: "", done: false });
    return list.sort((a, b) => Number(a.done) - Number(b.done));
  }

  // Groeit mee en springt naar het laatste bericht van het open onderwerp.
  // Niet springen terwijl Maarten tekst aan het selecteren is (kopiëren gaat voor).
  useEffect(() => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && !sel.isCollapsed) return;
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);
  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; }
  }, [input, open]);

  async function toggleOpen(t: Topic) {
    if (open === t.thread) { setOpen(null); setMessages([]); setError(""); return; }
    setOpen(t.thread); setMessages([]); setError(""); setInput(""); setTitleDraft(t.title || "");
    const seq = ++loadSeq.current;
    const d = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(t.thread)}&nothreads=1`).then((r) => r.json()).catch(() => null);
    if (seq !== loadSeq.current) return;               // een nieuwer onderwerp is intussen geopend
    if (d?.ok) {
      const msgs = d.messages || [];
      setMessages(msgs);
      // Titel/samenvatting ontbreekt maar er is wél gesprek? Maak ze (met terugwerkende kracht).
      if (msgs.length && (!t.title.trim() || !t.summary.trim())) genMeta(t.thread);
    }
  }

  // Nieuw onderwerp: geen naam-prompt. Je begint gewoon met een vraag; de titel en
  // samenvatting worden daarna automatisch ingevuld.
  function newTopic() {
    const t = "overzicht:~" + Date.now().toString(36);
    setTopics((ts) => [{ thread: t, count: 0, title: "", summary: "", done: false }, ...ts]);
    setOpen(t); setMessages([]); setError(""); setInput(""); setTitleDraft("");
  }

  // Weergavetitel: eigen titel als die er is, anders de naam uit de thread.
  const titleOf = (t: Topic) => (t.title && t.title.trim()) || labelOf(t.thread);

  async function saveTitle(thread: string, title: string) {
    setTopics((ts) => ts.map((x) => x.thread === thread ? { ...x, title } : x));
    await fetch("/api/admin/overview/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, title }) }).catch(() => {});
  }

  async function toggleDone(thread: string, done: boolean) {
    setTopics((ts) => normalizeTopics(ts.map((x) => x.thread === thread ? { ...x, done } : x)));
    if (done && open === thread) { setOpen(null); setMessages([]); }
    await fetch("/api/admin/overview/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, done }) }).catch(() => {});
  }

  async function clearChat(thread: string) {
    setBevestig(null);
    setMessages([]); setOpen(null);
    // Ook de titel weg. Het eerste gesprek blijft als rij bestaan (er moet er altijd
    // één zijn), maar met alleen de inhoud gewist bleef de oude titel staan en zag je
    // dus precies hetzelfde als daarvoor: het leek alsof er niets gebeurde, terwijl
    // het gesprek wél leeg was.
    setTopics((ts) => ts
      .filter((x) => x.thread !== thread || x.thread === BASE)
      .map((x) => x.thread === thread ? { ...x, count: 0, summary: "", title: "", done: false } : x));
    await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(thread)}`, { method: "DELETE" }).catch(() => {});
  }

  // Een binnengekomen bestand meldt zich NIET meer in het gesprek. Dat schreef een
  // heel blok met de link en de complete samenvatting tussen je vragen in, terwijl
  // de dropzone eronder al laat zien dat het bestand er is; de samenvatting staat
  // daar nu uitklapbaar bij. De assistent kende het bestand toch al langs een
  // andere weg: de server zet de inhoud zelf bij de context.

  function handleExecuted(id: string, result: NonNullable<Action["result"]>, executed: boolean) {
    setMessages((prev) => prev.map((m) => m.actions ? { ...m, actions: m.actions.map((a) => a.id === id ? { ...a, executed, result } : a) } : m));
  }

  // Eerst sparren, dan concluderen, dan pas taken. Beide stappen wegen het HELE
  // gesprek (niet één antwoord, niet één bullet) en worden door Maarten getriggerd.
  async function oogst(stap: "conclusie" | "taken") {
    if (oogstBusy || !open) return;
    const t = open;
    setOogstBusy(stap); setError("");
    try {
      const r = await fetch("/api/admin/overview/oogst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: t, stap }) });
      const d = await r.json();
      if (openRef.current !== t) return;                 // Maarten is intussen naar een ander onderwerp
      if (d?.ok) {
        if (stap === "conclusie") setMessages((m) => [...m, { role: "assistant", content: d.answer, soort: "conclusie" }]);
        else setMessages((m) => {
          // Nog een keer op "Welke taken volgen hieruit?" drukken gaf een tweede,
          // bijna identiek voorstel-blok eronder. Een nog niet verwerkt voorstel
          // wordt daarom vervángen: er is er altijd maar één actueel.
          const nieuw: Msg = { role: "assistant", content: "Voorstel: dit werk volgt uit dit gesprek.", soort: "oogst", oogst: d.oogst };
          const idx = m.map((x) => (x.soort === "oogst" && !x.oogst?.verwerkt ? 1 : 0)).lastIndexOf(1);
          if (idx < 0) return [...m, nieuw];
          const kopie = [...m];
          kopie[idx] = nieuw;
          return kopie;
        });
      } else setError(d?.error || `Er ging iets mis (server gaf status ${r.status}).`);
    } catch { setError("De assistent is niet bereikbaar."); }
    finally { setOogstBusy(""); }
  }

  // Een verwerkt voorstel blijft staan, maar onthoudt dat het verwerkt is (ook na
  // herladen, want de server zet dezelfde vlag in de historie).
  function markeerVerwerkt(idx: number) {
    setMessages((prev) => prev.map((m, i) => (i === idx && m.oogst ? { ...m, oogst: { ...m.oogst, verwerkt: true } } : m)));
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
        setMessages((m) => [...m, { role: "assistant", content: data.answer, ...(Array.isArray(data.actions) && data.actions.length ? { actions: data.actions } : {}), ...(Array.isArray(data.bronnen) && data.bronnen.length ? { bronnen: data.bronnen } : {}) }]);
        const newTitle = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "";
        const newSum = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : "";
        setTopics((ts) => ts.map((x) => x.thread === t ? { ...x, count: next.length + 1, ...(newTitle ? { title: newTitle } : {}), ...(newSum ? { summary: newSum } : {}) } : x));
        if (openRef.current === t && newTitle) setTitleDraft(newTitle);
      } else setError(data.error || "Er ging iets mis.");
    } catch { setError("De assistent is niet bereikbaar."); } finally { setBusy(false); }
  }

  if (!configured) {
    return <div className="cockpit-card ovc-card"><div className="phase2-note">Overview staat klaar, maar mist nog de AI-sleutel (<code>ANTHROPIC_API_KEY</code> in Vercel).</div></div>;
  }

  // "kaal" laat de eigen kaart en kop weg: dan hangt dit blok in het Overview-paneel,
  // waar de kop al boven de drie secties staat. Zonder dat zou je twee koppen en twee
  // kaders om elkaar heen krijgen.
  const Omhulsel = kaal ? "div" : "div";
  return (
    <Omhulsel className={kaal ? "ovc-kaal" : "cockpit-card ovc-card"}>
      {kaal ? (
        <div className="ovc-kaal-acties">
          <DiepDenken />
          <button type="button" className="ghost-btn small" onClick={newTopic}>+ Nieuw onderwerp</button>
        </div>
      ) : (
      <div className="ovc-head">
        <span className="ovc-icontile" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        </span>
        <span className="ovc-title">Overview</span>
        <DiepDenken />
        <button type="button" className="ghost-btn small" onClick={newTopic}>+ Nieuw onderwerp</button>
      </div>
      )}

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
                <div className="ovc-topic-textcol">
                  {isOpen
                    ? <input
                        className="ovc-title-inline"
                        value={titleDraft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={() => { if (titleDraft.trim() !== (t.title || "").trim()) saveTitle(t.thread, titleDraft.trim()); }}
                        placeholder="Titel (vult zichzelf in na je eerste vraag)"
                        maxLength={80}
                      />
                    : <span className="ovc-topic-title">{titleOf(t)}</span>}
                  {!isOpen && t.summary && <span className="ovc-topic-sum">{t.summary}</span>}
                </div>
                {/* Het eerste gesprek (de basis) mag niet verdwijnen, want er moet er
                    altijd één zijn. Maar het kruisje werd daarvoor helemáál weggelaten,
                    en dan lijkt die rij gewoon kapot: je zoekt een knop die er niet is.
                    Nu staat hij er wel en maakt hij dat onderwerp leeg in plaats van
                    het weg te gooien. Dat kon clearChat al. */}
                {/* De bevestiging staat in de rij zelf. Het was een browser-popup, en
                    die valt buiten de huisstijl en leest als een systeemmelding. */}
                {bevestig === t.thread ? (
                  <span className="ovc-topic-bevestig" onClick={(e) => e.stopPropagation()}>
                    <span>{t.thread === BASE ? "Leegmaken?" : "Verwijderen?"}</span>
                    <button type="button" className="ovc-bev-ja" onClick={() => void clearChat(t.thread)}>Ja</button>
                    <button type="button" className="ovc-bev-nee" onClick={() => setBevestig(null)}>Nee</button>
                  </span>
                ) : (
                  <button type="button" className="wp-icon wp-del ovc-topic-del"
                    title={t.thread === BASE ? "Dit onderwerp leegmaken (het eerste gesprek blijft bestaan)" : "Dit onderwerp verwijderen"}
                    onClick={(e) => { e.stopPropagation(); setBevestig(t.thread); }}>×</button>
                )}
              </div>

              {isOpen && (
                <div className="ovc-topic-body">
                  <div className="ovc-log">
                    {messages.map((m, i) => {
                    // Alleen het LAATSTE antwoord staat open. De eerdere vouwen samen
                    // tot hun eerste kopje, want elk antwoord herhaalde de complete
                    // paginatabel: vier antwoorden, elfduizend tekens, en het bruikbare
                    // stond onderaan. Er verdwijnt niets; één klik zet het weer open.
                    const laatsteAntwoord = messages.map((x) => x.role).lastIndexOf("assistant");
                    const inklapbaar = m.role === "assistant" && i < laatsteAntwoord;
                    const dicht = inklapbaar && !openBericht[i];
                    // Er is maar ÉÉN actueel takenvoorstel. Twee keer op "Welke taken
                    // volgen hieruit?" drukken zette er vroeger een tweede blok onder;
                    // die staan nu nog in bestaande gesprekken. Alleen het laatste
                    // voorstel tonen, dus ook met terugwerkende kracht opgeruimd.
                    if (m.soort === "oogst") {
                      const laatsteOogst = messages.map((x) => (x.soort === "oogst" ? 1 : 0)).lastIndexOf(1);
                      if (i !== laatsteOogst) return null;
                    }
                    // Oude "document toegevoegd aan het dossier"-blokken: die schreven de
                    // hele samenvatting uit tussen je vragen in. Ze worden hier herkend en
                    // tot één regel gevouwen, ook in gesprekken die er al stonden.
                    const melding = m.role === "user" ? bestandMelding(m.content || "") : null;
                    return (
                      <div key={i} className={"ovc-msg " + m.role + (dicht ? " ovc-msg-dicht" : "")}>
                        <button type="button" className="chat-msg-del" title="Dit blok verwijderen" onClick={() => deleteMessage(i)}>&times;</button>
                        {inklapbaar && (
                          <button type="button" className="ovc-msg-vouw" onClick={() => setOpenBericht((v) => ({ ...v, [i]: !v[i] }))}>
                            <span className="ovc-msg-vouw-pijl">{dicht ? "▸" : "▾"}</span>
                            <span className="ovc-msg-vouw-titel">{eersteKop(m.content || "")}</span>
                            {dicht && <span className="ovc-msg-vouw-meta">eerder antwoord</span>}
                          </button>
                        )}
                        {dicht ? null : m.soort === "oogst" && m.oogst
                          ? (
                              // Het takenvoorstel: geen gewone tekst maar een lijst met
                              // vinkjes. Dit is de ENIGE weg van gesprek naar taak.
                              <TakenVoorstel
                                slug={slug}
                                thread={t.thread}
                                index={i}
                                oogst={m.oogst}
                                domain={domain}
                                onWeekplanChanged={onWeekplanChanged}
                                onVerwerkt={() => markeerVerwerkt(i)}
                              />
                            )
                          : m.role === "assistant"
                          ? (
                              // Gewoon leesbaar antwoord, zonder knopjes achter de regels.
                              // Het raden per bullet is eruit: welk werk uit een gesprek
                              // volgt bepaalt de knop "Welke taken volgen hieruit?", die
                              // het hele gesprek weegt. Vulzinnen gaan er retroactief uit,
                              // dus ook bij antwoorden die er al stonden.
                              <div className={"ovc-bubble chat-md" + (m.soort === "conclusie" ? " ovc-conclusie" : "")}>
                                {m.soort === "conclusie" && <div className="ovc-conclusie-label">Conclusie van dit gesprek</div>}
                                <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(striptVulzinnen(zonderWeekrecap(m.content || "", (m.actions || []).some((a) => a.type === "weekplan_taken"))), domain) }} />
                              </div>
                            )
                          : melding
                          ? (
                              // Een oude bestandsmelding: vroeger een blok met de link én
                              // de complete samenvatting, nu één regel. De tekst is niet
                              // weg, hij staat één klik verderop.
                              <div className="ovc-bestand">
                                <span className="cb-icoon" aria-hidden="true">{melding.wat === "Afbeelding" ? "🖼" : "📄"}</span>
                                {melding.link
                                  ? <a className="cb-naam" href={melding.link} target="_blank" rel="noreferrer">{melding.naam}</a>
                                  : <span className="cb-naam">{melding.naam}</span>}
                                <span className="ovc-bestand-meta">toegevoegd aan het dossier</span>
                                {melding.kern && (
                                  <button type="button" className="ovc-bestand-vouw"
                                    onClick={() => setOpenBericht((v) => ({ ...v, [i]: !v[i] }))}>
                                    {openBericht[i] ? "▾ samenvatting" : "▸ samenvatting"}
                                  </button>
                                )}
                                {melding.kern && openBericht[i] && (
                                  <div className="ovc-bestand-kern chat-md"
                                    dangerouslySetInnerHTML={{ __html: mdToHtml(melding.kern, domain) }} />
                                )}
                              </div>
                            )
                          : (
                              // Jouw eigen vraag compact: alinea's achter elkaar en de
                              // kernwoorden vet, zodat je hem kunt scannen. De witregels
                              // kostten een half scherm per gesprek.
                              <div className="ovc-bubble ovc-bubble-vraag md"
                                dangerouslySetInnerHTML={{ __html: vraagHtml(m.content || "") }} />
                            )}
                        {m.role === "assistant" && !dicht && <Bronnenstrip bronnen={m.bronnen} domain={domain} />}
                        {/* Elk antwoord kan los de mail in, niet alleen het laatste.
                            Stel je na een analyse nog een vervolgvraag, dan is die
                            analyse ingeklapt; klap hem open en de knop staat er. */}
                        {m.role === "assistant" && m.soort !== "oogst" && !dicht && (m.content || "").trim() && (
                          <button type="button" className="ovc-blokmail" title="Zet dit blok in een mail: opgemaakt, met jouw eigen intro erboven."
                            onClick={() => setBlokVoorMail(m.content || "")}>
                            Zet dit blok in een mail
                          </button>
                        )}
                        {m.role === "assistant" && m.actions && m.actions.length > 0 && (() => {
                          // Van het blok "Taken → weekplanning" is er maar ÉÉN actueel.
                          // Vraag je later nog eens welk werk eruit volgt, dan komt er
                          // een tweede blok met vrijwel dezelfde taken en zie je twee
                          // overzichten onder elkaar. Alleen het laatste tonen; de
                          // eerdere blijven bewaard, ze worden niet meer getekend.
                          const laatsteTaken = messages
                            .map((x) => ((x.actions || []).some((a) => a.type === "weekplan_taken") ? 1 : 0))
                            .lastIndexOf(1);
                          const zichtbaar = m.actions.filter((a) => a.type !== "weekplan_taken" || i === laatsteTaken);
                          if (!zichtbaar.length) return null;
                          return (
                            <div className="ovc-actions">
                              {zichtbaar.map((a) => (
                                <ActionCard key={a.id} action={a} slug={slug} thread={t.thread} onExecuted={handleExecuted} onGoToPage={onGoToPage} onGoToTask={onGoToTask} onWeekplanChanged={onWeekplanChanged} />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                    })}
                    {busy && <div className="ovc-msg assistant"><div className="ovc-bubble muted">Aan het nadenken (ik lees zo nodig de strategie en meet pagina&rsquo;s na)…</div></div>}
                    {oogstBusy === "conclusie" && <div className="ovc-msg assistant"><div className="ovc-bubble muted">Het hele gesprek aan het teruglezen…</div></div>}
                    {oogstBusy === "taken" && <div className="ovc-msg assistant"><div className="ovc-bubble muted">Aan het wegen welk werk hier echt uit volgt…</div></div>}
                    <div ref={endRef} />
                  </div>

                  {/* Eerst sparren, dan concluderen, dan pas taken. De tweede knop
                      verschijnt pas als er een conclusie ligt: taken bepalen zonder
                      conclusie is precies het raden dat we eruit wilden hebben. */}
                  {messages.some((m) => m.role === "assistant") && (
                    <div className="ovc-oogst">
                      <button type="button" className="ghost-btn small" disabled={!!oogstBusy || busy} onClick={() => void oogst("conclusie")}
                        title="Lees het hele gesprek terug en vat samen waar we op uitkomen, wat we weten en wat nog open staat.">
                        {oogstBusy === "conclusie" ? "Bezig…" : "Trek de conclusie"}
                      </button>
                      {messages.some((m) => m.soort === "conclusie") && (
                        <button type="button" className="primary-btn small" disabled={!!oogstBusy || busy} onClick={() => void oogst("taken")}
                          title="Bepaal op basis van het hele gesprek welk werk hieruit volgt. Je krijgt een voorstel dat je zelf aanvinkt.">
                          {oogstBusy === "taken" ? "Bezig…" : "Welke taken volgen hieruit?"}
                        </button>
                      )}
                      <span className="ovc-oogst-uitleg">Taken maak je hier, niet per regel: beide stappen wegen het hele gesprek.</span>
                    </div>
                  )}

                  {/* Delen met de klant. Een analyse over de hele site (cannibalisatie,
                      link equity, locatiepagina's) stond alleen in de chat; hiermee wordt
                      het een document in huisstijl of een mail. Gedeeld met wat je op een
                      weekplan-kaart ziet, zodat het overal hetzelfde werkt. */}
                  {messages.some((m) => m.role === "assistant") && (
                    <div className="ovc-deel">
                      <span className="ovc-deel-label">Delen met de klant</span>
                      <DeelKnoppen
                        slug={slug}
                        titel={titleOf(t)}
                        tekst={deelTekst(messages)}
                        mailBron={alleAntwoorden(messages)}
                        blokMd={laatsteBlok(messages)}
                        siteUrl={domain}
                        clientName={clientName}
                        clientEmail={clientEmail}
                      />
                    </div>
                  )}

                  {error && <div className="login-error" style={{ margin: "var(--s-2) 0" }}>{error}</div>}

                  {/* De dropzone van dit gesprek: wat je hier laat vallen komt in de
                      klantmap in Drive én in de context van dit gesprek. */}
                  <ChatBestanden slug={slug} thread={t.thread} />

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
      {blokVoorMail && (
        <MailVenster
          slug={slug}
          titel="Dit blok in een mail"
          onderwerpVan={clientName || "Analyse"}
          taak={clientName || "Analyse"}
          toelichting={blokVoorMail}
          blokMd={blokVoorMail}
          siteUrl={domain}
          clientName={clientName}
          clientEmail={clientEmail}
          onClose={() => setBlokVoorMail("")}
        />
      )}
    </Omhulsel>
  );
}

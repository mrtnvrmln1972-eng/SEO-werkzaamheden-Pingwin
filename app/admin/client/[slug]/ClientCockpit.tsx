"use client";

import {useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ClientConfig } from "../../../../lib/clients";
import type {
  EmailSnapshot, MetricSnapshot, KeywordSnapshot, PageSnapshot, ClientStatus,
} from "../../../../lib/snapshots";
import type { TaskRow } from "../../../../lib/tasks";
import type { StrategySession } from "../../../../lib/strategy";
import ChatPanel from "./ChatPanel";
import OverviewTab from "./OverviewTab";
import TasksEditor from "./TasksEditor";
import OrgDataPanel from "./OrgDataPanel";
import FocusBlock from "./FocusBlock";
import ShareLinkBar from "./ShareLinkBar";
import HelpHint from "./HelpHint";
import MailAllowlist from "./MailAllowlist";
import LinkPreview from "./LinkPreview";
import DeveloperOverview from "../../developer/DeveloperOverview";
import KpiPanel from "./KpiPanel";
import PagesPanel from "./PagesPanel";
import WijzigingenPanel from "./WijzigingenPanel";
import MetaCtrPanel from "./MetaCtrPanel";
import InvoiceAlert from "./InvoiceAlert";
import SelectionActions from "./SelectionActions";

type Tab = "overzicht" | "werkzaamheden" | "paginas" | "resultaten" | "klant" | "developer" | "wijzigingen" | "cannibalisatie" | "interne-links" | "meta";

// Jouw Superhuman-account (Microsoft 365 hangt hieronder).
const SUPERHUMAN_ACCOUNT = "Maarten@pingwin.nl";

type CockpitData = {
  emails: EmailSnapshot[];
  metrics: MetricSnapshot[];
  keywords: KeywordSnapshot[];
  pages: PageSnapshot[];
  lastIngest: string | null;
  status: ClientStatus;
  statusUpdatedAt: string | null;
  msConfigured: boolean;
  msConnected: boolean;
  myEmail: string | null;
  monthTasks: {
    thisMonth: { text: string; link: string; done: boolean; wie: string }[];
    nextMonth: { text: string; link: string; done: boolean; wie: string }[];
    thisLabel: string;
    nextLabel: string;
  };
  allClients: { slug: string; name: string; grp?: string | null; good28?: boolean; good90?: boolean }[];
  googleConfigured: boolean;
  googleConnected: boolean;
  chatConfigured: boolean;
  tasks: TaskRow[];
};

// Taaknaam kan opmaak/links bevatten; in compacte lijstjes tonen we platte tekst.
function stripTags(html: string): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

export default function ClientCockpit({
  client, emails: initialEmails, metrics, keywords, pages, lastIngest, status, statusUpdatedAt,
  msConfigured, msConnected, myEmail, allClients,
  googleConfigured, googleConnected, chatConfigured, tasks, initialTab, highlight,
  showMailSections = true,
}: { client: ClientConfig; initialTab?: string; highlight?: string; showMailSections?: boolean } & CockpitData) {
  // Live mail komt NA het tonen binnen (achtergrond-verversing): het scherm opent
  // met de opgeslagen mails, en zodra Microsoft antwoordt worden ze ververst.
  const [emails, setEmails] = useState(initialEmails);
  const [mailLive, setMailLive] = useState(false);
  useEffect(() => {
    if (!msConnected || !showMailSections) return;
    let off = false;
    fetch(`/api/admin/mail?slug=${encodeURIComponent(client.slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off || !d.ok || !Array.isArray(d.emails) || d.emails.length === 0) return;
        setEmails(d.emails.filter((e: { fromAddress?: string }) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim())));
        setMailLive(true);
      })
      .catch(() => { /* opgeslagen mails blijven staan */ });
    return () => { off = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [client.slug]);

  const router = useRouter();
  const pathname = usePathname();
  // Directe feedback bij het wisselen van klant: de nieuwe pagina moet server-
  // side data ophalen en dat duurt even; zonder signaal voelt dat als bevroren.
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const validTab = (t?: string): Tab => (t === "overzicht" || t === "werkzaamheden" || t === "paginas" || t === "resultaten" || t === "klant" || t === "developer" || t === "wijzigingen" || t === "meta") ? t : "werkzaamheden";
  const [tab, setTab] = useState<Tab>(validTab(initialTab));
  // Demo-filter voor de klanten-dropdown: alleen klanten met mooie ontwikkeling
  // (28 dagen of 3 maanden), voor schermdelen met potentiële klanten.
  const [demoFilter, setDemoFilter] = useState<null | "28" | "90">(null);
  // Toggles bovenaan de (samengevoegde) Werkzaamheden-pagina, standaard gesloten.
  const [showStatusBox, setShowStatusBox] = useState(false);
  const [showMailsBox, setShowMailsBox] = useState(false);

  // Pagina's blijven na het eerste bezoek in het geheugen (verborgen i.p.v.
  // uitgekleed), zodat je chat/plan-staat bewaard blijft als je van tab wisselt.
  const [paginasVisited, setPaginasVisited] = useState(validTab(initialTab) === "paginas");

  // Wissel van tab én update de URL zodat reload op dezelfde tab uitkomt.
  function changeTab(newTab: Tab) {
    if (newTab === "paginas") setPaginasVisited(true);
    setTab(newTab);
    router.replace(`${pathname}?tab=${newTab}`, { scroll: false });
  }

  // Vanuit de pagina-chat een werkzaamheid gemaakt: spring naar Werkzaamheden en
  // licht de nieuwe taak op. Verse laadbeurt zodat de taak er echt in staat.
  function goToNewTask(taskId: number) {
    setTab("werkzaamheden");
    router.replace(`${pathname}?tab=werkzaamheden&highlight=${taskId}`, { scroll: false });
    router.refresh();
  }

  // Vanuit de KPI's een pagina openen in het Pagina's-tabje: wissel van tab en geef
  // de doel-URL door (met oplopende teller zodat herhaald klikken op dezelfde pagina
  // opnieuw opent en scrollt).
  const [pagesTarget, setPagesTarget] = useState<{ url: string; n: number } | null>(null);
  function goToPage(url: string) {
    setPaginasVisited(true);
    setTab("paginas");
    setPagesTarget((t) => ({ url, n: (t?.n || 0) + 1 }));
    router.replace(`${pathname}?tab=paginas&page=${encodeURIComponent(url)}`, { scroll: false });
  }
  const [shQuery, setShQuery] = useState("");
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const replyRef = useRef<HTMLDivElement>(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyMsg, setReplyMsg] = useState("");
  const [replyToAddr, setReplyToAddr] = useState("");

  function fmt(cmd: string) {
    document.execCommand(cmd, false);
    replyRef.current?.focus();
  }
  function addLink() {
    const url = window.prompt("Link-adres (URL):", "https://");
    if (url) document.execCommand("createLink", false, url);
  }

  // Optimistische override: het vinkje verschijnt meteen, de server volgt op de achtergrond.
  const [statusOverride, setStatusOverride] = useState<Record<number, boolean>>({});

  async function toggleStatus(index: number, done: boolean) {
    setStatusOverride((o) => ({ ...o, [index]: done }));
    try {
      await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: client.slug, index, status: done ? "done" : "open" }),
      });
      router.refresh();
    } catch { /* de optimistische stand blijft staan */ }
  }

  // Naar wie het antwoord gaat: deelnemers van de mail (afzender + to) minus jezelf.
  const myLow = (myEmail || "").toLowerCase();
  function recipientsFor(e: EmailSnapshot): string[] {
    const all = [e.fromAddress || "", ...(e.toAddresses || [])];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of all) {
      const low = a.toLowerCase();
      if (!a || low === myLow || seen.has(low)) continue;
      seen.add(low);
      out.push(a);
    }
    return out;
  }

  // Meest voorkomende klant-adres in de mails (niet jezelf, niet @pingwin.nl):
  // dient als terugval als de geopende mail zelf geen klant-ontvanger heeft.
  const addrCount = new Map<string, number>();
  for (const e of emails) {
    for (const a of [e.fromAddress || "", ...(e.toAddresses || [])]) {
      const low = a.toLowerCase();
      if (!a || low === myLow || low.endsWith("@pingwin.nl")) continue;
      addrCount.set(a, (addrCount.get(a) || 0) + 1);
    }
  }
  let primaryClientAddress = client.email || "";
  let bestCount = 0;
  for (const [a, c] of addrCount) if (c > bestCount) { bestCount = c; primaryClientAddress = a; }

  function defaultRecipient(e: EmailSnapshot): string {
    const r = recipientsFor(e).filter((a) => !a.toLowerCase().endsWith("@pingwin.nl"));
    return (r.length > 0 ? r.join(", ") : primaryClientAddress) || "";
  }

  function openMail(e: EmailSnapshot, isOpen: boolean) {
    setOpenEmail(isOpen ? null : e.id);
    setReplyMsg("");
    setReplyToAddr(isOpen ? "" : defaultRecipient(e));
  }

  async function sendReply(id: string) {
    const html = cleanReplyHtml(replyRef.current?.innerHTML || "");
    const text = (replyRef.current?.innerText || "").trim();
    if (!text) return;
    setReplyBusy(true);
    setReplyMsg("");
    try {
      const res = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, html, to: replyToAddr }),
      });
      const data = await res.json();
      if (data.ok) {
        const naar = Array.isArray(data.sentTo) && data.sentTo.length > 0 ? data.sentTo.join(", ") : "de klant";
        setReplyMsg(`Verstuurd naar ${naar}.`);
        if (replyRef.current) replyRef.current.innerHTML = "";
      } else setReplyMsg(data.error || "Versturen mislukt.");
    } catch {
      setReplyMsg("Versturen mislukt.");
    } finally {
      setReplyBusy(false);
    }
  }

  const workDocUrl = client.cockpit.workDocUrl || "";
  const resultsUrl = client.cockpit.resultsUrl || "";
  const clientMailQuery = (client.email || client.domain || "").trim();
  const lastMailDate = emails.find((e) => e.receivedAt)?.receivedAt || null;

  // Map onderwerp → de exacte mail in de lijst (voor zowel de Superhuman-link
  // als "hier openen" binnen het dashboard).
  const emailMatch = new Map<string, { id: string; idx: number; superhumanLink: string | null }>();
  emails.forEach((e, idx) => {
    if (e.subject) {
      const k = normSubject(e.subject);
      if (!emailMatch.has(k)) emailMatch.set(k, { id: e.id, idx, superhumanLink: e.superhumanLink });
    }
  });

  function openInDashboard(id: string, idx: number) {
    setTab("werkzaamheden");
    setShowMailsBox(true);
    setOpenEmail(id);
    setReplyMsg("");
    const target = emails.find((x) => x.id === id);
    setReplyToAddr(target ? defaultRecipient(target) : "");
    setTimeout(() => {
      document.getElementById(`mail-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function openSuperhuman() {
    if (!clientMailQuery) return;
    const q = [clientMailQuery, shQuery.trim()].filter(Boolean).join(" ");
    window.open(`https://mail.superhuman.com/${SUPERHUMAN_ACCOUNT}/search/${encodeURIComponent(q)}`, "_blank");
  }


  return (
    <>
      {switchingTo && (
        <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10001, background: "var(--dark, #33302e)", color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 600, boxShadow: "0 6px 24px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
          {switchingTo} laden…
        </div>
      )}
      <div className="header">
        <div className="header-left">
          <a href="/admin" className="logo-link" title="Naar het klantenoverzicht">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <select
            className="client-switch"
            value={client.slug}
            onChange={(e) => { setSwitchingTo(e.target.options[e.target.selectedIndex]?.text || "…"); router.push(`/admin/client/${e.target.value}`); }}
            title="Wissel van klant"
          >
            {(() => {
              // Vinkje = mooie ontwikkeling (uit de nachtelijke trend-berekening).
              // In demo-stand tonen we alleen die klanten (voor schermdelen).
              const good = (c: typeof allClients[number]) => (demoFilter === "90" ? c.good90 : c.good28);
              const shown = demoFilter ? allClients.filter((c) => good(c) || c.slug === client.slug) : allClients;
              const opt = (c: typeof allClients[number]) => (
                <option key={c.slug} value={c.slug}>{good(c) ? "✓ " : ""}{c.name}</option>
              );
              return shown.some((c) => c.grp === "mmc") ? (
                <>
                  <optgroup label="Mijn eigen klanten">{shown.filter((c) => c.grp !== "mmc").map(opt)}</optgroup>
                  <optgroup label="Multimedia Concepts">{shown.filter((c) => c.grp === "mmc").map(opt)}</optgroup>
                </>
              ) : shown.map(opt);
            })()}
          </select>
          {/* Demo-filter (schermdelen): alleen tonen als er trend-data is om op te
              filteren. In een verse wereld zonder nachtelijke trend-berekening zou
              de knop de dropdown ogenschijnlijk leegmaken; dan verbergen we hem. */}
          {allClients.some((c) => c.good28 || c.good90) && (
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => setDemoFilter(demoFilter === null ? "28" : demoFilter === "28" ? "90" : null)}
              title="Filtert de klanten-dropdown op klanten met een mooie ontwikkeling (voor schermdelen met potentiële klanten). Klik om te wisselen tussen alle klanten, mooie ontwikkeling laatste 28 dagen en laatste 3 maanden."
            >
              {demoFilter === null ? "Alle klanten" : demoFilter === "28" ? "✓ Mooie ontwikkeling (28 dgn)" : "✓ Mooie ontwikkeling (3 mnd)"}
            </button>
          )}
          <nav className="header-tabs">
            {([
              ["overzicht", "Overzicht", "Site-breed overzicht en de bird's eye-assistent die meedenkt over prioriteiten"],
              ["paginas", "Pagina’s", ""],
              ["werkzaamheden", "Taken", ""],
              ["meta", "Meta & CTR", "Pagina's met veel vertoningen maar te weinig klikken: betere meta-teksten = direct meer bezoekers"],
              ["resultaten", "KPI’s", ""],
              ["wijzigingen", "Wijzigingen", ""],
              ["klant", "Klant", ""],
              ["developer", "Developer", "Alle developer-taken over alle klanten"],
            ] as [Tab, string, string][]).map(([id, label, title]) => (
              // Echte link (href) zodat cmd/middel-klik in een nieuw tabblad opent;
              // gewone klik wisselt client-side van tab.
              <a
                key={id}
                href={`${pathname}?tab=${id}`}
                title={title || undefined}
                className={"tab" + (tab === id ? " active" : "")}
                onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); changeTab(id); }}
              >{label}</a>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <span id="werk-month-slot" className="header-month-slot" />
          {lastMailDate && (
            <span className={"contact-chip " + contactColor(lastMailDate)} title={`Laatste contact: ${fmtDate(lastMailDate)}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              {daysAgoLabel(lastMailDate)}
            </span>
          )}
        </div>
      </div>

      <div className="container">

        <InvoiceAlert slug={client.slug} clientName={client.name} />
        <SelectionActions slug={client.slug} clientName={client.name} />

        {tab === "werkzaamheden" && (
          <>
            {(workDocUrl || resultsUrl) && (
              <div className="cockpit-card">
                <div className="quicklinks">
                  {workDocUrl && <a className="ql" href={workDocUrl} target="_blank" rel="noreferrer">Werkdocument</a>}
                  {resultsUrl && <a className="ql" href={resultsUrl} target="_blank" rel="noreferrer">Resultaten</a>}
                </div>
              </div>
            )}

            {/* Zonder mail-secties (COCKPIT_MAIL=uit) blijft alleen Zoekwoorden & links staan,
                in dezelfde kaartstijl als de andere inklapbare secties. */}
            {!showMailSections && (
              <div className="cockpit-card strategy-card">
                <FocusBlock slug={client.slug} standalone />
              </div>
            )}

            {showMailSections && (<>
            <div className="cockpit-card strategy-card">
              <button type="button" className="strategy-head" onClick={() => setShowStatusBox((v) => !v)}>
                <span className="strategy-caret">{showStatusBox ? "▾" : "▸"}</span>
                <span className="strategy-title">Actuele stand van zaken <HelpHint xl title="Actuele stand van zaken" text={"Het lopende gesprek met de klant in één oogopslag, zodat je vóór elk contactmoment in tien seconden weet waar jullie staan.\n## Waar de data vandaan komt\nDe tijdlijn wordt **automatisch samengevat uit de echte mailwisseling** met deze klant (uit de gekoppelde mailbox). Elke ballon is een punt uit de correspondentie: links de klant, rechts Pingwin, met datum en de status open of afgehandeld.\n## Wat je ermee doet\n- **Afvinken:** handel een punt af met het vinkje 'afgerond'; zo blijft alleen het openstaande werk rood.\n- **Terug naar de bron:** 'mail openen' springt naar de originele mail, zodat je nooit hoeft te zoeken.\n- **Vaste kennis rechts:** het blok Zoekwoorden & links is jouw eigen spiekbriefje per klant (afspraken, focus-zoekwoorden, handige links); dat vult zichzelf niet, dat is bewust jouw plek."} /></span>
                {statusUpdatedAt && <span className="strategy-meta-right">bijgewerkt {fmtDate(statusUpdatedAt)}</span>}
              </button>
              <div className="sov-layout strategy-body" style={{ display: showStatusBox ? undefined : "none" }}>
                  <div className="sov-thread">
                    <div className="sov-legend">
                      <span><span className="sov-dot client" /> Klant</span>
                      <span><span className="sov-dot us" /> Wij</span>
                      <span className="sov-legend-status"><span className="sov-pill open">open</span><span className="sov-pill done">afgehandeld</span></span>
                    </div>
                    {status.exchanges
                      .map((ex, i) => ({ ex, i }))
                      .sort((a, b) => (b.ex.date || "").localeCompare(a.ex.date || ""))
                      .map(({ ex, i }) => {
                      const isClient = ex.side === "client";
                      const done = statusOverride[i] !== undefined ? statusOverride[i] : ex.status === "done";
                      const cls = "sov-row " + (isClient ? "left" : "right") + " " + (done ? "done" : "open");
                      const m = ex.subject ? emailMatch.get(normSubject(ex.subject)) : undefined;
                      const exLink = m?.superhumanLink || ex.mailLink || null;
                      return (
                        <div className={cls} key={i}>
                          <div className="sov-bubble">
                            <div className="sov-bubble-top">
                              <span className="sov-who">{isClient ? (client.name || "Klant") : "Pingwin"}</span>
                              {ex.date && <span className="sov-date">{fmtDate(ex.date)}</span>}
                              <label className="sov-check" title="Markeer als afgehandeld">
                                <input type="checkbox" checked={done} onChange={(e) => toggleStatus(i, e.target.checked)} />
                                afgerond
                              </label>
                            </div>
                            <div className="sov-text">{ex.text}</div>
                            <div className="sov-links">
                              {m
                                ? <button type="button" className="sov-maillink as-btn" onClick={() => openInDashboard(m.id, m.idx)}>mail openen &darr;</button>
                                : exLink && <a className="sov-maillink" href={exLink} target="_blank" rel="noreferrer">mail openen (Superhuman) &rarr;</a>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {status.exchanges.length === 0 && <div className="muted">Nog geen correspondentie samengevat.</div>}
                  </div>

                  <div className="sov-side">
                    <FocusBlock slug={client.slug} />
                  </div>
                </div>
              </div>

            <div className="cockpit-card strategy-card">
              <button type="button" className="strategy-head" onClick={() => setShowMailsBox((v) => !v)}>
                <span className="strategy-caret">{showMailsBox ? "▾" : "▸"}</span>
                <span className="strategy-title">Laatste mails <HelpHint xl title="Laatste mails" text={"De recentste e-mails met deze klant, **live uit de gekoppelde mailbox** (Microsoft 365); je hoeft dus niet te wisselen tussen dashboard en mailprogramma om de context te zien.\n## Wat je ermee kunt\n- **Lezen:** klik een mail aan om hem volledig in het dashboard te lezen.\n- **Zoeken:** doorzoek de correspondentie via het zoekveld, of open dezelfde zoekopdracht direct in Superhuman voor het volledige archief.\n- **Filteren:** via de filterlijst bepaal je welke afzenders hier meetellen, zodat nieuwsbrieven en automatische mails de tijdlijn niet vervuilen.\n## Goed om te weten\nGasten zonder mail-recht zien dit blok nooit (privacy is hard afgedwongen op de server), en de 'Actuele stand van zaken' hierboven wordt uit deze zelfde mailstroom samengevat."} /></span>
              </button>
              <div className="strategy-body" style={{ display: showMailsBox ? undefined : "none" }}>
              <MailAllowlist slug={client.slug} />
              <div className="sh-search" style={{ marginBottom: 12 }}>
                <input
                  value={shQuery}
                  onChange={(e) => setShQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") openSuperhuman(); }}
                  placeholder="Zoek bij deze klant, bijv. reviewsterren..."
                />
                <button type="button" className="primary-btn small" onClick={openSuperhuman} disabled={!clientMailQuery}>
                  Zoek in Superhuman
                </button>
              </div>
              {lastIngest && <div className="ck-updated" style={{ marginBottom: 12 }}>bijgewerkt {fmtDate(lastIngest)}</div>}
              {mailLive && (
                <div className="mail-live-badge">
                  ● Live uit Microsoft 365
                  <a className="mail-reconnect" href="/api/ms/auth/start">opnieuw koppelen</a>
                </div>
              )}
              {msConfigured && !msConnected && (
                <div className="mail-connect">
                  Koppel Microsoft 365 om de volledige mails te zien en vanuit het dashboard te beantwoorden.{" "}
                  <a className="primary-btn small" href="/api/ms/auth/start">Koppel Microsoft</a>
                </div>
              )}
              {emails.length === 0 ? (
                <div className="phase2-note">
                  Nog geen mails ingeladen. Deze lijst vult zich met de laatste e-mails met deze klant
                  en opent ze rechtstreeks in Superhuman.
                </div>
              ) : (
                <div className="email-list">
                  {emails.map((e, idx) => {
                    const open = openEmail === e.id;
                    const shLink = e.superhumanLink || e.webLink || "";
                    return (
                      <div className={"email-row" + (open ? " open" : "")} key={e.id} id={`mail-${idx}`}>
                        <div className="email-head" onClick={() => openMail(e, open)}>
                          <div className="email-head-main">
                            <div className="email-top">
                              <span className={"email-dir " + (e.direction === "out" ? "out" : "in")}>
                                {e.direction === "out" ? "verzonden" : "ontvangen"}
                              </span>
                              <span className="email-from">{e.fromName || e.fromAddress || "—"}</span>
                              <span className="email-date">{e.receivedAt ? fmtDateTime(e.receivedAt) : ""}</span>
                            </div>
                            <div className="email-subject">{e.subject || "(geen onderwerp)"}</div>
                            {!open && e.preview && <div className="email-preview">{e.preview}</div>}
                          </div>
                          <div className="email-head-actions">
                            {shLink && (
                              <a className="ql ql-mini" href={shLink} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>Superhuman</a>
                            )}
                            <span className="email-caret">{open ? "▲" : "▼"}</span>
                          </div>
                        </div>
                        {open && (
                          <div className="email-body">
                            <div className="email-actions">
                              {shLink && <a className="ql" href={shLink} target="_blank" rel="noreferrer">Open in Superhuman</a>}
                              {shLink && <a className="ql" href={shLink} target="_blank" rel="noreferrer">Beantwoorden in Superhuman</a>}
                            </div>
                            {e.bodyHtml ? (
                              <div className="email-html" dangerouslySetInnerHTML={{ __html: sanitizeEmail(e.bodyHtml) }} />
                            ) : (
                              <div className="email-preview-full">
                                {e.preview}
                                <div className="muted" style={{ marginTop: 8 }}>Volledige tekst nog niet ingeladen, open de mail in Superhuman.</div>
                              </div>
                            )}
                            {mailLive && (
                              <div className="email-reply">
                                <div className="reply-target">
                                  <div>Je beantwoordt: <strong>{e.subject || "(geen onderwerp)"}</strong>{e.receivedAt && <> &middot; {fmtDateTime(e.receivedAt)}</>}</div>
                                  <div className="reply-to-row">
                                    <label>Aan:</label>
                                    <input
                                      className="reply-to-input"
                                      value={replyToAddr}
                                      onChange={(ev) => setReplyToAddr(ev.target.value)}
                                      placeholder="e-mailadres van de klant"
                                    />
                                  </div>
                                </div>
                                <div className="rt-toolbar">
                                  <button type="button" title="Vet" onMouseDown={(ev) => { ev.preventDefault(); fmt("bold"); }}><b>B</b></button>
                                  <button type="button" title="Cursief" onMouseDown={(ev) => { ev.preventDefault(); fmt("italic"); }}><i>I</i></button>
                                  <button type="button" title="Opsomming (bullets)" onMouseDown={(ev) => { ev.preventDefault(); fmt("insertUnorderedList"); }}>&bull; Lijst</button>
                                  <button type="button" title="Selecteer eerst tekst, dan link toevoegen" onMouseDown={(ev) => { ev.preventDefault(); addLink(); }}>Link</button>
                                </div>
                                <div
                                  className="rt-editor"
                                  contentEditable
                                  suppressContentEditableWarning
                                  ref={replyRef}
                                  data-placeholder="Typ je antwoord, met opmaak..."
                                />
                                <div className="email-reply-bar">
                                  <button type="button" className="primary-btn small" onClick={() => sendReply(e.id)} disabled={replyBusy || !replyToAddr.trim()}>
                                    {replyBusy ? "Versturen..." : "Verstuur antwoord"}
                                  </button>
                                  {replyMsg && <span className={"reply-msg" + (replyMsg.startsWith("Verstuurd") ? " ok" : " err")}>{replyMsg}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
            </>)}

          </>
        )}

        {tab === "werkzaamheden" && (
          <TasksEditor key={`tasks-${highlight || "x"}`} slug={client.slug} initialTasks={tasks} budget={client.budget} clientName={client.name} clientEmail={client.email || ""} highlight={highlight} />
        )}

        {tab === "resultaten" && (
          <>
            <KpiPanel slug={client.slug} domain={client.domain || ""} onOpenPage={goToPage} />
          </>
        )}

        {tab === "klant" && (<>
          <OrgDataPanel slug={client.slug} clientEmail={client.email || ""} />
          <div className="cockpit-card client-frame-card">
            <div className="ck-section-head"><span>Klant (zo ziet de klant het)</span>
              <a className="logout-btn" href={`/admin/preview/${client.slug}`} target="_blank" rel="noreferrer">Openen in nieuw tabblad ↗</a>
            </div>
            <ShareLinkBar slug={client.slug} />
            <iframe src={`/admin/preview/${client.slug}`} className="client-frame" title="Klant-dashboard" />
          </div>
        </>)}

        {paginasVisited && (
          <div style={{ display: tab === "paginas" ? "block" : "none" }}>
            <PagesPanel slug={client.slug} initialProfile={client.seoProfile || ""} clientEmail={client.email || ""} clientName={client.name} domain={client.domain || ""} onGoToTask={goToNewTask} openTarget={pagesTarget} />
          </div>
        )}

        {tab === "wijzigingen" && <WijzigingenPanel slug={client.slug} />}

        {tab === "meta" && <MetaCtrPanel slug={client.slug} backendUrl={client.backendUrl} onOpenPage={goToPage} />}

        {tab === "developer" && <DeveloperOverview embedded />}

        {tab === "overzicht" && <OverviewTab slug={client.slug} clientName={client.name} domain={client.domain || ""} onGoToPage={goToPage} onGoToTask={goToNewTask} onGoToMeta={() => changeTab("meta")} chatConfigured={chatConfigured} />}
      </div>

      <div className="footer">Pingwin Online Marketing &middot; Beheer</div>

      <ChatPanel slug={client.slug} configured={chatConfigured} />
      <LinkPreview />
    </>
  );
}

const SOURCES = [
  { key: "gsc", label: "Search Console" },
  { key: "ga4", label: "Google Analytics" },
  { key: "ahrefs", label: "Ahrefs" },
];

const METRIC_LABELS: Record<string, string> = {
  clicks: "Klikken",
  impressions: "Vertoningen",
  ctr: "CTR",
  position: "Gem. positie",
  users: "Bezoekers",
  totalUsers: "Bezoekers",
  sessions: "Sessies",
  conversions: "Conversies",
  org_traffic: "Organisch verkeer",
  org_keywords: "Organische zoekwoorden",
  domain_rating: "Domain Rating",
};

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] || metric;
}

function fmtMetric(metric: string, value: number | null): string {
  if (value == null) return "—";
  if (metric === "ctr") return `${value.toFixed(1)}%`;
  if (metric === "position") return value.toFixed(1);
  if (metric === "domain_rating") return value.toFixed(0);
  return value.toLocaleString("nl-NL");
}

function periodLabel(period: string): string {
  if (period === "last28") return "laatste 28 dagen";
  if (period === "last7") return "laatste 7 dagen";
  if (period === "last90") return "laatste 90 dagen";
  if (period === "now") return "nu";
  return period;
}

// Lichte opschoning van mail-HTML voor weergave in het dashboard:
// scripts/styles/event-handlers en javascript-links eruit.
function sanitizeEmail(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<a\s/gi, '<a target="_blank" rel="noreferrer" ');
}

function normSubject(s: string): string {
  return s.replace(/^((re|fw|fwd):\s*)+/i, "").trim().toLowerCase();
}

// Schoont de HTML uit de editor op: paragrafen/divs naar gewone regels (zonder
// de grote standaard-marges van <p>), hoogstens één witregel, en getypte
// **vet** wordt echt vet. Lijsten (ul/li) blijven intact.
function cleanReplyHtml(html: string): string {
  return html
    // lege blokken (alleen een regeleinde) volledig weg
    .replace(/<(p|div)[^>]*>\s*(<br\s*\/?>)?\s*<\/(p|div)>/gi, "")
    // grens tussen twee paragrafen → één witregel
    .replace(/<\/(p|div)>\s*<(p|div)[^>]*>/gi, "<br><br>")
    // overige blok-tags weghalen (marges veroorzaken de grote witgaten)
    .replace(/<\/?(p|div)[^>]*>/gi, "")
    // getypte markdown-vet omzetten
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // nooit meer dan één witregel
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/^(\s*<br\s*\/?>)+/i, "")
    .replace(/(<br\s*\/?>\s*)+$/i, "")
    .trim();
}

function daysSince(iso: string): number | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function daysAgoLabel(iso: string): string {
  const n = daysSince(iso);
  if (n == null) return "";
  if (n <= 0) return "vandaag";
  if (n === 1) return "1 dag geleden";
  return `${n} dagen geleden`;
}

function contactColor(iso: string): string {
  const n = daysSince(iso);
  if (n == null) return "gray";
  if (n < 7) return "green";
  if (n < 14) return "orange";
  return "red";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === "/" ? u.hostname : u.pathname).replace(/\/$/, "") || url;
  } catch {
    return url;
  }
}


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
import OverviewChat from "./OverviewChat";
import WeekplanBoard from "./WeekplanBoard";
import ZijPaneel from "./ZijPaneel";
import HeaderMenu from "./HeaderMenu";
import OrgDataPanel from "./OrgDataPanel";
import FocusBlock from "./FocusBlock";
import ShareLinkBar from "./ShareLinkBar";
import HelpHint from "./HelpHint";
import MailAllowlist from "./MailAllowlist";
import LinkPreview from "./LinkPreview";
import { mdToHtml } from "../../../../lib/markdown";
import BespreekLijsten from "./BespreekLijsten";
import DeveloperOverview from "../../developer/DeveloperOverview";
import KpiPanel from "./KpiPanel";
import PagesPanel from "./PagesPanel";
import WijzigingenPanel from "./WijzigingenPanel";
import CannibalPanel from "./CannibalPanel";
import InternalLinksPanel from "./InternalLinksPanel";
import MetaCtrPanel from "./MetaCtrPanel";
import PrioriteitenPanel from "./PrioriteitenPanel";
import DocumentenPanel from "./DocumentenPanel";
import ActiviteitPanel from "./ActiviteitPanel";
import InvoiceAlert from "./InvoiceAlert";
import SelectionActions from "./SelectionActions";
import LeadTab from "./LeadTab";

type Tab = "lead" | "werkzaamheden" | "paginas" | "documenten" | "activiteit" | "resultaten" | "klant" | "developer" | "wijzigingen" | "cannibalisatie" | "interne-links" | "meta" | "prioriteiten";

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
  googleConfigured, googleConnected, chatConfigured, tasks, initialTab, initialPage, highlight,
  showMailSections = true,
}: { client: ClientConfig; initialTab?: string; initialPage?: string; highlight?: string; showMailSections?: boolean } & CockpitData) {
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
  // Is dit een lead, dan is de leadomgeving het startscherm. Voor klanten
  // verandert er niets: die beginnen zoals altijd op Taken.
  const isLead = client.fase === "lead";
  const validTab = (t?: string): Tab => (t === "lead" || t === "werkzaamheden" || t === "paginas" || t === "documenten" || t === "activiteit" || t === "resultaten" || t === "klant" || t === "developer" || t === "wijzigingen" || t === "meta" || t === "cannibalisatie" || t === "interne-links" || t === "prioriteiten") ? t : (isLead ? "lead" : "werkzaamheden");
  const [tab, setTab] = useState<Tab>(validTab(initialTab));
  // Teller die de weekplanning laat herladen zodra er vanuit de chat een taak is
  // toegevoegd (of iets in het bord verandert).
  const [weekplanReload, setWeekplanReload] = useState(0);
  // De drie Overview-blokken beginnen dicht. Wat je openzet onthoudt de browser, zodat
  // je niet elke keer opnieuw hoeft te klikken op het blok waar je die dag in werkt.
  const [ovOpen, setOvOpen] = useState<{ prio: boolean; chats: boolean; week: boolean }>({ prio: false, chats: false, week: false });
  useEffect(() => {
    try {
      const r = window.localStorage.getItem(`pingwin-ov-open:${client.slug}`);
      if (r) setOvOpen({ prio: false, chats: false, week: false, ...JSON.parse(r) });
    } catch { /* geen opslag: dan gewoon alles dicht */ }
  }, [client.slug]);
  useEffect(() => {
    try { window.localStorage.setItem(`pingwin-ov-open:${client.slug}`, JSON.stringify(ovOpen)); } catch { /* stil */ }
  }, [ovOpen, client.slug]);
  // Demo-filter voor de klanten-dropdown: alleen klanten met mooie ontwikkeling
  // (28 dagen of 3 maanden), voor schermdelen met potentiële klanten.
  const [demoFilter, setDemoFilter] = useState<null | "28" | "90">(null);
  // Toggles bovenaan de (samengevoegde) Werkzaamheden-pagina, standaard gesloten.
  const [showStatusBox, setShowStatusBox] = useState(false);
  const [showMailsBox, setShowMailsBox] = useState(false);

  // Afzender-filter als klein popovertje in de Laatste mails-kop.
  const [showAfzenders, setShowAfzenders] = useState(false);

  // Deeplink vanuit een nieuw tabblad (?tab=paginas&page=...): open direct de
  // juiste pagina-rij zodra de cockpit geladen is.
  const initialPageRef = useRef(false);
  useEffect(() => {
    if (initialPageRef.current || !initialPage) return;
    initialPageRef.current = true;
    const timer = setTimeout(() => goToPage(initialPage), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // De stand van zaken bijwerken uit de recente mails (server-side samenvatting).
  const [statusBusy, setStatusBusy] = useState(false);
  const statusAutoRef = useRef(false);
  async function refreshStatus() {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const d = await fetch("/api/admin/status-refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: client.slug }) }).then((r) => r.json());
      if (d?.ok) router.refresh();
    } catch { /* stil; knop kan opnieuw */ } finally { setStatusBusy(false); }
  }
  // Loopt de tijdlijn meer dan twee dagen achter, ververs hem dan stil op de achtergrond.
  useEffect(() => {
    if (statusAutoRef.current) return;
    statusAutoRef.current = true;
    const oud = !statusUpdatedAt || (Date.now() - new Date(statusUpdatedAt).getTime()) > 2 * 24 * 3600 * 1000;
    if (oud) void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Vanuit de prioriteitenscan naar de plek waar het werk gebeurt: wissel van tab
  // EN geef de pagina door, zodat je daar op de juiste regel landt in plaats van
  // opnieuw te moeten zoeken. De teller zorgt dat twee keer klikken op dezelfde
  // pagina ook twee keer werkt.
  const [metaTarget, setMetaTarget] = useState<{ url: string; n: number } | null>(null);
  const [opruimTarget, setOpruimTarget] = useState<{ url: string; n: number } | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ url: string; n: number } | null>(null);
  function gaNaar(doelTab: string, url: string) {
    if (doelTab === "paginas" && url) { goToPage(url); return; }
    const t = validTab(doelTab);
    if (url) {
      const bump = (v: { url: string; n: number } | null) => ({ url, n: (v?.n || 0) + 1 });
      if (t === "meta") setMetaTarget(bump);
      else if (t === "cannibalisatie") setOpruimTarget(bump);
      else if (t === "interne-links") setLinkTarget(bump);
    }
    changeTab(t);
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

  // Een mail-verwijzing in een projectkaart ("Mail 9-7-2026") opent die mail in
  // het venster Laatste mails: datum parsen en de eerste mail van die dag openen.
  function openMailByDate(datum: string) {
    const mnd: Record<string, number> = { januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12 };
    let d = 0, m = 0, y = 0;
    const num = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/.exec(datum.trim());
    if (num) { d = +num[1]; m = +num[2]; y = num[3] ? +num[3] : 0; }
    else {
      const t = /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{2,4}))?$/i.exec(datum.trim());
      if (t) { d = +t[1]; m = mnd[t[2].toLowerCase()] || 0; y = t[3] ? +t[3] : 0; }
    }
    if (!d || !m) return;
    const jaar = y ? (y < 100 ? 2000 + y : y) : 0;
    const idx = emails.findIndex((e) => {
      if (!e.receivedAt) return false;
      const dt = new Date(e.receivedAt);
      return dt.getDate() === d && dt.getMonth() + 1 === m && (!jaar || dt.getFullYear() === jaar);
    });
    if (idx >= 0) openInDashboard(emails[idx].id, idx);
  }

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

  // Slim vraagveld: een vraag in gewone taal wordt beantwoord uit de mails die
  // al in het dashboard hangen; de relevante mails komen bovenaan te staan.
  const [vraagBusy, setVraagBusy] = useState(false);
  const [vraagAntwoord, setVraagAntwoord] = useState("");
  const [vraagIds, setVraagIds] = useState<string[]>([]);
  const [vraagFout, setVraagFout] = useState("");
  async function vraagMails() {
    const vraag = shQuery.trim();
    if (!vraag || vraagBusy) return;
    setVraagBusy(true); setVraagFout(""); setVraagAntwoord(""); setVraagIds([]);
    try {
      const d = await fetch("/api/admin/mail-vraag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: client.slug, vraag }) }).then((r) => r.json());
      if (d?.ok) { setVraagAntwoord(d.antwoord || ""); setVraagIds(Array.isArray(d.ids) ? d.ids : []); }
      else setVraagFout(d?.error || "Zoeken mislukte; probeer het nog een keer.");
    } catch { setVraagFout("Zoeken mislukte; probeer het nog een keer."); }
    finally { setVraagBusy(false); }
  }
  // Een mail uit dit overzicht weghalen. Bevestigen gebeurt in de rij zelf
  // (geen browser-popup), en de rij verdwijnt meteen: hij komt ook na verversen
  // niet terug. De mail zelf blijft gewoon in de mailbox staan.
  const [mailWeg, setMailWeg] = useState<string | null>(null);
  async function verwijderMail(id: string) {
    setMailWeg(null);
    setEmails((lijst) => lijst.filter((m) => m.id !== id));
    try {
      await fetch(`/api/admin/mail?slug=${encodeURIComponent(client.slug)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch { /* de rij is al weg; bij verversen komt hij hooguit terug */ }
  }

  const getoondeEmails = vraagIds.length
    ? [...emails].sort((a, b) => {
        const ra = vraagIds.indexOf(a.id), rb = vraagIds.indexOf(b.id);
        return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      })
    : emails;


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
          {/* Zes knoppen in plaats van elf tabjes. Wat bij elkaar hoort zit onder een
              uitklapmenu: "Klant" toont wat we voor deze klant doen, "Site-breed" de
              gereedschappen die over de hele site kijken. De tab-waarden in de URL
              blijven ongewijzigd, dus bestaande bookmarks komen nog goed uit. */}
          <nav className="header-tabs">
            {([
              // Het lead-tabje verschijnt alleen bij een lead; bij een klant is
              // de tabbalk exact zoals hij was.
              ...(isLead ? [["lead", "Lead", "De werkplek voor deze lead: gesprek, dossier en documenten"] as [Tab, string, string]] : []),
              ["werkzaamheden", "Taken", "Overview: je prioriteiten, de chats en de weekplanning"],
              ["paginas", "Pagina’s", "Elke pagina van deze site: hoe hij scoort, wat eraan gedaan is en wat er nog moet"],
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

            <HeaderMenu<Tab>
              label="Site-breed"
              active={tab}
              hrefFor={(id) => `${pathname}?tab=${id}`}
              onPick={changeTab}
              items={[
                { id: "prioriteiten", label: "Prioriteitenscan", hint: "Waar zit de snelste winst op deze site: alle kansen op volgorde, van deze week tot strategisch" },
                { id: "meta", label: "Meta & CTR", hint: "Veel vertoningen, te weinig klikken: betere meta-teksten leveren direct bezoekers op" },
                { id: "cannibalisatie", label: "Opruimen", hint: "Welke pagina's elkaar in de weg zitten, met de volledige redirectlijst: van, naar en waarom" },
                { id: "interne-links", label: "Interne links", hint: "Vanaf welke pagina's je het beste naar een doelpagina linkt, gewogen op autoriteit en relevantie" },
              ]}
            />

            <HeaderMenu<Tab>
              label="Klant"
              active={tab}
              hrefFor={(id) => `${pathname}?tab=${id}`}
              onPick={changeTab}
              items={[
                { id: "documenten", label: "Documenten", hint: "Alle analyses, blauwdrukken en copy per pagina en per maand, met of het al op de site staat" },
                { id: "activiteit", label: "Wat we doen", hint: "Alles wat we voor deze klant uitvoerden, per maand: copy, meta, alt-teksten, structured data en redirects" },
                { id: "wijzigingen", label: "Wijzigingen", hint: "Wat er op de site van de klant veranderd is sinds de vorige controle" },
                { id: "klant", label: "Klantgegevens", hint: "Profiel, bedrijfsgegevens, kennisbank en de instellingen van deze klant" },
              ]}
            />

            {([
              ["resultaten", "KPI’s", "Hoe deze klant ervoor staat: posities, vertoningen, klikken en de ontwikkeling daarvan"],
              ["developer", "Developer", "Alle developer-taken over alle klanten"],
            ] as [Tab, string, string][]).map(([id, label, title]) => (
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
        {/* Zoekwoorden & links als inschuifbaar zijpaneel: altijd binnen handbereik
            via het tabje aan de rechterrand, op elk tabblad van de cockpit. */}
        <ZijPaneel label="Zoekwoorden & links">
          <FocusBlock slug={client.slug} />
        </ZijPaneel>

        {tab === "lead" && (
          <LeadTab slug={client.slug} naam={client.name} domain={client.domain || ""} />
        )}

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

            {/* Twee kolommen: links (2/3) het kloppend hart, rechts (1/3) stand van
                zaken, zoekwoorden & links, en de laatste mails.

                Links stond alles onder elkaar open: de assistent met al zijn
                onderwerpen, en daaronder de hele weekplanning. Je scrolde dus altijd
                langs dingen die je op dat moment niet nodig had. Nu één kop met drie
                blokken die dicht beginnen, zodat je zelf kiest wat je openzet. */}
            <div className="tk-grid">
            <div className="tk-links">
            <div className="cockpit-card ovc-card">
              <div className="ovc-head">
                <span className="ovc-icontile" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
                </span>
                <span className="ovc-title">Overview</span>
              </div>

              <div className="ov-blok">
                <button type="button" className="strategy-head" onClick={() => setOvOpen((v) => ({ ...v, prio: !v.prio }))}>
                  <span className="strategy-caret">{ovOpen.prio ? "▾" : "▸"}</span>
                  <span className="strategy-title">Top Prio&rsquo;s</span>
                </button>
                {ovOpen.prio && (
                  <div className="strategy-body">
                    <FocusBlock slug={client.slug} soort="prio" titel="Top Prio's" />
                  </div>
                )}
              </div>

              <div className="ov-blok">
                <button type="button" className="strategy-head" onClick={() => setOvOpen((v) => ({ ...v, chats: !v.chats }))}>
                  <span className="strategy-caret">{ovOpen.chats ? "▾" : "▸"}</span>
                  <span className="strategy-title">Chats</span>
                </button>
                {ovOpen.chats && (
                  <div className="strategy-body">
                    <OverviewChat kaal slug={client.slug} domain={client.domain || ""} configured={chatConfigured !== false} onGoToPage={goToPage} onGoToTask={goToNewTask} onWeekplanChanged={() => setWeekplanReload((n) => n + 1)} clientName={client.name} clientEmail={client.email || ""} />
                  </div>
                )}
              </div>

              <div className="ov-blok">
                <button type="button" className="strategy-head" onClick={() => setOvOpen((v) => ({ ...v, week: !v.week }))}>
                  <span className="strategy-caret">{ovOpen.week ? "▾" : "▸"}</span>
                  <span className="strategy-title">Week Planning</span>
                </button>
                {ovOpen.week && (
                  <div className="strategy-body">
                    <WeekplanBoard kaal slug={client.slug} onGoToPage={goToPage} onGoToTab={(t) => changeTab(validTab(t))} onOpenMailDate={openMailByDate} clientName={client.name} clientEmail={client.email || ""} reloadSignal={weekplanReload} />
                  </div>
                )}
              </div>
            </div>
            </div>
            <div className="tk-rechts">

            {showMailSections && (<>
            <div className="cockpit-card strategy-card">
              <button type="button" className="strategy-head" onClick={() => setShowStatusBox((v) => !v)}>
                <span className="strategy-caret">{showStatusBox ? "▾" : "▸"}</span>
                <span className="strategy-title">Actuele stand van zaken <HelpHint xl title="Actuele stand van zaken" text={"Het lopende gesprek met de klant in één oogopslag, zodat je vóór elk contactmoment in tien seconden weet waar jullie staan.\n## Waar de data vandaan komt\nDe tijdlijn wordt **automatisch samengevat uit de echte mailwisseling** met deze klant (uit de gekoppelde mailbox). Elke ballon is een punt uit de correspondentie: links de klant, rechts Pingwin, met datum en de status open of afgehandeld.\n## Wat je ermee doet\n- **Afvinken:** handel een punt af met het vinkje 'afgerond'; zo blijft alleen het openstaande werk rood.\n- **Terug naar de bron:** 'mail openen' springt naar de originele mail, zodat je nooit hoeft te zoeken.\n- **Vaste kennis rechts:** het blok Zoekwoorden & links is jouw eigen spiekbriefje per klant (afspraken, focus-zoekwoorden, handige links); dat vult zichzelf niet, dat is bewust jouw plek."} /></span>
                <span className="strategy-meta-right">
                  {statusUpdatedAt && <>bijgewerkt {fmtDate(statusUpdatedAt)} · </>}
                  <span role="button" className="sov-refresh" title="Vat de recente mails opnieuw samen tot de actuele stand van zaken"
                    onClick={(e) => { e.stopPropagation(); void refreshStatus(); }}>{statusBusy ? "Bezig…" : "Vernieuwen"}</span>
                </span>
              </button>
              <div className="strategy-body" style={{ display: showStatusBox ? undefined : "none" }}>
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
                </div>
              </div>

            {/* Bespreeklijsten per persoon, direct onder de actuele stand. */}
            <BespreekLijsten slug={client.slug} clientName={client.name} clientEmail={client.email || clientMailQuery} domain={client.domain} />

            <div className="cockpit-card strategy-card">
              <button type="button" className="strategy-head" onClick={() => setShowMailsBox((v) => !v)}>
                <span className="strategy-caret">{showMailsBox ? "▾" : "▸"}</span>
                <span className="strategy-title">Laatste mails <HelpHint xl title="Laatste mails" text={"De recentste e-mails met deze klant, **live uit de gekoppelde mailbox** (Microsoft 365); je hoeft dus niet te wisselen tussen dashboard en mailprogramma om de context te zien.\n## Wat je ermee kunt\n- **Lezen:** klik een mail aan om hem volledig in het dashboard te lezen.\n- **Zoeken:** doorzoek de correspondentie via het zoekveld, of open dezelfde zoekopdracht direct in Superhuman voor het volledige archief.\n- **Filteren:** via de filterlijst bepaal je welke afzenders hier meetellen, zodat nieuwsbrieven en automatische mails de tijdlijn niet vervuilen.\n## Goed om te weten\nGasten zonder mail-recht zien dit blok nooit (privacy is hard afgedwongen op de server), en de 'Actuele stand van zaken' hierboven wordt uit deze zelfde mailstroom samengevat."} /></span>
                <span className="mails-kop-mini">
                  <span className="afz-link" role="button" title="Welke afzenders horen bij deze klant? Klik om ze te bekijken of aan te passen."
                    onClick={(e) => { e.stopPropagation(); setShowAfzenders((v) => !v); }}>afzenders ?</span>
                  {mailLive
                    ? <span className="ms-dot" title="Live gekoppeld met Microsoft 365" />
                    : msConfigured && <a className="afz-link" href="/api/ms/auth/start" onClick={(e) => e.stopPropagation()} title="Koppel Microsoft 365 om live mail te zien">koppelen</a>}
                </span>
              </button>
              {showAfzenders && (
                <div className="afz-popover">
                  <MailAllowlist slug={client.slug} />
                  <div className="afz-voet muted">
                    Loopt de live mail achter of is de koppeling verlopen, dan helpt <a className="afz-link" href="/api/ms/auth/start">opnieuw koppelen</a>.
                  </div>
                </div>
              )}
              <div className="strategy-body" style={{ display: showMailsBox ? undefined : "none" }}>
              <div className="sh-search" style={{ marginBottom: 12 }}>
                <input
                  value={shQuery}
                  onChange={(e) => setShQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void vraagMails(); }}
                  placeholder='Stel een vraag, bijv. "staat er iets in de mail over het document klantenservice Bogart?"'
                />
                <button type="button" className="primary-btn small" onClick={() => void vraagMails()} disabled={vraagBusy || !shQuery.trim()}>
                  {vraagBusy ? "Zoeken…" : "Vraag"}
                </button>
                <button type="button" className="btn-omrand" onClick={openSuperhuman} disabled={!clientMailQuery} title="Doorzoek het volledige archief in Superhuman">
                  Zoek in Superhuman
                </button>
              </div>
              {vraagFout && <div className="wp-doc-fout" style={{ marginBottom: 10 }}>{vraagFout}</div>}
              {vraagAntwoord && (
                <div className="mail-vraag-antwoord">
                  <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(vraagAntwoord) }} />
                  <button type="button" className="ghost-btn small" onClick={() => { setVraagAntwoord(""); setVraagIds([]); }}>Wis</button>
                </div>
              )}
              {lastIngest && <div className="ck-updated" style={{ marginBottom: 12 }}>bijgewerkt {fmtDate(lastIngest)}</div>}
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
                  {getoondeEmails.map((e) => {
                    const idx = emails.indexOf(e);
                    const open = openEmail === e.id;
                    const shLink = e.superhumanLink || e.webLink || "";
                    return (
                      <div className={"email-row" + (open ? " open" : "") + (vraagIds.includes(e.id) ? " email-hit" : "")} key={e.id} id={`mail-${idx}`}>
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
                            {mailWeg === e.id ? (
                              <span className="email-weg-vraag" onClick={(ev) => ev.stopPropagation()}>
                                Weghalen?
                                <button type="button" className="email-weg-ja" onClick={() => void verwijderMail(e.id)}>ja</button>
                                <button type="button" className="email-weg-nee" onClick={() => setMailWeg(null)}>nee</button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="email-del"
                                title="Haal deze mail uit dit overzicht (blijft in je mailbox staan)"
                                onClick={(ev) => { ev.stopPropagation(); setMailWeg(e.id); }}
                              >×</button>
                            )}
                            <span className="email-caret">{open ? "▲" : "▼"}</span>
                          </div>
                        </div>
                        {open && (
                          <div className="email-body">
                            {/* Eén klein Superhuman-knopje in de kop is genoeg; de drie
                                losse links deden alle drie hetzelfde. */}
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

            </div>
            </div>

          </>
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

        {tab === "documenten" && <DocumentenPanel slug={client.slug} onGoToPage={goToPage} />}
        {tab === "activiteit" && <ActiviteitPanel slug={client.slug} />}
        {tab === "wijzigingen" && <WijzigingenPanel slug={client.slug} />}

        {tab === "meta" && <MetaCtrPanel slug={client.slug} domain={client.domain || ""} backendUrl={client.backendUrl} onOpenPage={goToPage} openTarget={metaTarget} />}

        {/* Deze twee schermen bestonden al maar hingen nergens in de UI, dus niemand
            kon erbij. Hier hoort de volledige redirectlijst thuis, niet in de chat:
            een lijst is een scherm, een oordeel is een gesprek. */}
        {tab === "prioriteiten" && <PrioriteitenPanel slug={client.slug} domain={client.domain || ""} onGaNaar={gaNaar} />}
        {tab === "cannibalisatie" && <CannibalPanel slug={client.slug} domain={client.domain || ""} openTarget={opruimTarget} />}
        {tab === "interne-links" && <InternalLinksPanel slug={client.slug} openTarget={linkTarget} />}

        {tab === "developer" && (<>
          {/* De naam van de sitebouwer hoort bij het developer-werk, niet bovenaan
              het klantscherm. De naam zelf werkt overal hetzelfde door. */}
          <SitebouwerVeld slug={client.slug} start={client.cockpit.devName || ""} />
          <DeveloperOverview embedded />
        </>)}
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
    // Inline-bijlagen (cid:) kunnen in de browser niet laden en tonen als kapotte
    // plaatjes; die halen we weg. Gewone (https-)afbeeldingen blijven staan.
    .replace(/<img[^>]*src\s*=\s*["']cid:[^"']*["'][^>]*>/gi, "")
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


// Wie bouwt de site van DEZE klant. Stond eerder hardgecodeerd als "Sander" in
// zes schermen, waardoor bij elke klant dezelfde naam in beeld kwam. Leeg laten
// mag: dan noemt het dashboard hem gewoon "Dev" en verzint het niemand.
function SitebouwerVeld({ slug, start }: { slug: string; start: string }) {
  const [naam, setNaam] = useState(start);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const gewijzigd = naam.trim() !== start.trim();

  async function bewaar() {
    if (busy || !gewijzigd) return;
    setBusy(true); setMsg("");
    try {
      const d = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: "devName", devName: naam.trim() }),
      }).then((r) => r.json());
      setMsg(d?.ok ? "Bewaard." : (d?.error || "Bewaren mislukte."));
    } catch { setMsg("Bewaren mislukte."); }
    finally { setBusy(false); }
  }

  return (
    <div className="cockpit-card">
      <div className="ck-section-head"><span>Sitebouwer</span></div>
      <div className="dev-veld">
        <input
          className="compose-input"
          value={naam}
          onChange={(e) => { setNaam(e.target.value); setMsg(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") void bewaar(); }}
          placeholder="Naam van de sitebouwer (leeg laten mag)"
        />
        <button type="button" className="btn" onClick={() => void bewaar()} disabled={busy || !gewijzigd}>
          {busy ? "Bezig…" : "Bewaar"}
        </button>
        {msg && <span className="dev-veld-msg">{msg}</span>}
      </div>
      <div className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-2)" }}>
        Deze naam komt terug op de bespreeklijsten en bij de werklijst. Vul je niets in, dan staat er gewoon &ldquo;Dev&rdquo;.
      </div>
    </div>
  );
}

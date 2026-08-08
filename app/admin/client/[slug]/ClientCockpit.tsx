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
import Planning from "./Planning";
import ZijPaneel from "./ZijPaneel";
import KlantTabs, { type Tab } from "./KlantTabs";
import OrgDataPanel from "./OrgDataPanel";
import Concurrenten from "./Concurrenten";
import FundamentPanel from "./FundamentPanel";
import FocusBlock from "./FocusBlock";
import ShareLinkBar from "./ShareLinkBar";
import HelpHint from "./HelpHint";
import MailAllowlist from "./MailAllowlist";
import LinkPreview from "./LinkPreview";
import { mdToHtml } from "../../../../lib/markdown";
import BespreekLijsten from "./BespreekLijsten";
import LinksPaneel from "./LinksPaneel";
import FloatVenster from "./FloatVenster";
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
import MailControlePanel from "./MailControlePanel";
import MailBijlagen from "./MailBijlagen";
import OnboardingPanel from "./OnboardingPanel";
import OntwikkelMenu from "../../OntwikkelMenu";
import Tellers from "../../Tellers";
import KlantKiezer from "./KlantKiezer";
import GmbPanel from "./GmbPanel";
import KlussenChip from "./KlussenChip";
import MeldingenMenu from "../../MeldingenMenu";


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
  allClients: { slug: string; name: string; grp?: string | null; fase?: string | null; good28?: boolean; good90?: boolean }[];
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
  // Het tabblad uit de URL. Een waarde die we niet kennen viel stilzwijgend terug
  // op Taken, en dat is een val: een link die er goed uitziet (?tab=cannibal, of de
  // schermnaam ?tab=opruimen) zet je op een heel ander scherm zonder dat iets zegt
  // dat er iets misging. De namen die iemand logischerwijs intikt wijzen daarom nu
  // naar het juiste tabblad.
  const TAB_NAMEN: Record<string, Tab> = {
    cannibal: "cannibalisatie", opruimen: "cannibalisatie", opruim: "cannibalisatie",
    taken: "werkzaamheden", "pagina's": "paginas", pages: "paginas",
    "meta-ctr": "meta", links: "interne-links", "interne links": "interne-links",
    "prioriteiten scan": "prioriteiten",
  };
  const GELDIGE_TABS: Tab[] = ["lead", "onboarding", "werkzaamheden", "paginas", "documenten", "activiteit",
    "resultaten", "klant", "developer", "wijzigingen", "meta", "cannibalisatie", "interne-links",
    "prioriteiten", "google-profiel"];
  const validTab = (t?: string): Tab => {
    const k = (t || "").trim().toLowerCase();
    if ((GELDIGE_TABS as string[]).includes(k)) return k as Tab;
    if (TAB_NAMEN[k]) return TAB_NAMEN[k];
    return isLead ? "lead" : "werkzaamheden";
  };
  const [tab, setTab] = useState<Tab>(validTab(initialTab));
  // Teller die de weekplanning laat herladen zodra er vanuit de chat een taak is
  // toegevoegd (of iets in het bord verandert).
  const [weekplanReload, setWeekplanReload] = useState(0);
  // De Overview-blokken beginnen dicht. Wat je openzet onthoudt de browser, zodat
  // je niet elke keer opnieuw hoeft te klikken op het blok waar je die dag in werkt.
  const [ovOpen, setOvOpen] = useState<{ chats: boolean; week: boolean }>({ chats: false, week: false });
  useEffect(() => {
    try {
      const r = window.localStorage.getItem(`pingwin-ov-open:${client.slug}`);
      if (r) setOvOpen({ chats: false, week: false, ...JSON.parse(r) });
    } catch { /* geen opslag: dan gewoon alles dicht */ }
  }, [client.slug]);
  useEffect(() => {
    try { window.localStorage.setItem(`pingwin-ov-open:${client.slug}`, JSON.stringify(ovOpen)); } catch { /* stil */ }
  }, [ovOpen, client.slug]);
  // Demo-filter voor de klanten-dropdown: alleen klanten met mooie ontwikkeling
  // (28 dagen of 3 maanden), voor schermdelen met potentiële klanten.
  const [demoFilter, setDemoFilter] = useState<null | "28" | "90">(null);
  // Toggles bovenaan de (samengevoegde) Werkzaamheden-pagina, standaard gesloten.
  const [showMailsBox, setShowMailsBox] = useState(false);
  // Laatste mails los en groot in beeld, in plaats van in de smalle kolom.
  const [mailsFloating, setMailsFloating] = useState(false);

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
        <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10001, background: "var(--dark, #33302e)", color: "var(--white)", borderRadius: "var(--r-full)", padding: "var(--s-2) var(--s-5)", fontSize: "var(--fs-sm)", fontWeight: 600, boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
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
          {(() => {
            // Vinkje = mooie ontwikkeling (uit de nachtelijke trend-berekening).
            // In demo-stand tonen we alleen die klanten (voor schermdelen).
            const good = (c: typeof allClients[number]) => (demoFilter === "90" ? c.good90 : c.good28);
            const shown = demoFilter ? allClients.filter((c) => good(c) || c.slug === client.slug) : allClients;
            return (
              <KlantKiezer
                klanten={shown.map((c) => ({ slug: c.slug, name: c.name, grp: c.grp, fase: c.fase, goed: !!good(c) }))}
                huidig={client.slug}
                onKies={(slug, naam) => { setSwitchingTo(naam); router.push(`/admin/client/${slug}`); }}
              />
            );
          })()}
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
          <KlantTabs basisPad={pathname} actief={tab} isLead={isLead} onKies={changeTab} />
        </div>
        <div className="header-right">
          <MeldingenMenu />
          <Tellers />
        <OntwikkelMenu />
          {/* Wat er op de achtergrond draait, zichtbaar op élk tabblad. Zonder dit
              was een scan alleen te volgen op de plek waar je hem startte. */}
          <KlussenChip slug={client.slug} onGaNaar={(t) => changeTab(validTab(t))} />
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
        {/* Eén blik op alle bronnen die het overzicht voeden of zouden moeten
            voeden (Search Console, GMB, klantprofiel, structured data, ...),
            met een directe link naar het scherm waar je hem beheert. */}
        <ZijPaneel label="Links" top={420}>
          <LinksPaneel slug={client.slug} seoProfile={client.seoProfile || ""} googleConnected={googleConnected} onGaNaar={(t) => changeTab(validTab(t))} />
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
                  <span className="strategy-title">Planning</span>
                  {/* Naar het compacte weekbord. Stond eerst in de kop van de
                      weekplanning zelf, maar die kop is hier verborgen (de titel
                      staat al op deze toggle), dus daar was hij onbereikbaar. */}
                  <a className="wp-bordlink" href={`/admin/client/${client.slug}/weekbord`}
                     onClick={(e) => e.stopPropagation()}
                     title="Dezelfde planning op volle breedte, over al je klanten heen">alle klanten &rarr;</a>
                </button>
                {ovOpen.week && (
                  <div className="strategy-body">
                    <Planning kaal slug={client.slug} onGoToPage={goToPage} onGoToTab={(t) => changeTab(validTab(t))} onOpenMailDate={openMailByDate} clientName={client.name} clientEmail={client.email || ""} reloadSignal={weekplanReload} />
                  </div>
                )}
              </div>
            </div>
            </div>
            <div className="tk-rechts">

            {showMailSections && (<>
            {/* Bespreeklijsten per persoon. */}
            <BespreekLijsten slug={client.slug} clientName={client.name} clientEmail={client.email || clientMailQuery} domain={client.domain} />

            {(() => {
              const mailsInner = (
                <>
              <div className="sh-search" style={{ marginBottom: "var(--s-3)" }}>
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
              {vraagFout && <div className="wp-doc-fout" style={{ marginBottom: "var(--s-3)" }}>{vraagFout}</div>}
              {vraagAntwoord && (
                <div className="mail-vraag-antwoord">
                  <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(vraagAntwoord) }} />
                  <button type="button" className="ghost-btn small" onClick={() => { setVraagAntwoord(""); setVraagIds([]); }}>Wis</button>
                </div>
              )}
              {lastIngest && <div className="ck-updated" style={{ marginBottom: "var(--s-3)" }}>bijgewerkt {fmtDate(lastIngest)}</div>}
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
                                <div className="muted" style={{ marginTop: "var(--s-2)" }}>Volledige tekst nog niet ingeladen, open de mail in Superhuman.</div>
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
                            {/* Controleren of de verzoeken uit deze thread ook echt
                                in de site verwerkt zijn. Staat hier omdat Maarten
                                hier toch al is als hij de mail leest. */}
                            {/* De bijlagen van deze mail, sleepbaar naar een taak.
                                Een teruggestuurd copy-document hoeft zo niet meer
                                gedownload en opnieuw geüpload te worden. */}
                            {mailLive && <MailBijlagen slug={client.slug} messageId={e.id} />}
                            {mailLive && e.conversationId && (
                              <MailControlePanel
                                slug={client.slug}
                                domein={client.domain || ""}
                                conversationId={e.conversationId}
                                messageId={e.id}
                                onderwerp={e.subject || ""}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
                </>
              );
              return (
                <>
                  {!mailsFloating ? (
                    <div className="cockpit-card strategy-card">
                      <button type="button" className="strategy-head" onClick={() => setShowMailsBox((v) => !v)}>
                        <span className="strategy-caret">{showMailsBox ? "▾" : "▸"}</span>
                        <span className="strategy-title">Laatste mails <HelpHint xl title="Laatste mails" text={"De recentste e-mails met deze klant, **live uit de gekoppelde mailbox** (Microsoft 365); je hoeft dus niet te wisselen tussen dashboard en mailprogramma om de context te zien.\n## Wat je ermee kunt\n- **Lezen:** klik een mail aan om hem volledig in het dashboard te lezen.\n- **Zoeken:** doorzoek de correspondentie via het zoekveld, of open dezelfde zoekopdracht direct in Superhuman voor het volledige archief.\n- **Filteren:** via de filterlijst bepaal je welke afzenders hier meetellen, zodat nieuwsbrieven en automatische mails de tijdlijn niet vervuilen.\n- **Los zetten:** met het knopje 'los' zwaait dit venster groot en centraal open, los van de smalle kolom."} /></span>
                        <span className="mails-kop-mini">
                          <span className="afz-link" role="button" title="Los en groot in beeld zetten"
                            onClick={(e) => { e.stopPropagation(); setShowMailsBox(true); setMailsFloating(true); }}>&#10696; los</span>
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
                        {mailsInner}
                      </div>
                    </div>
                  ) : (
                    <div className="cockpit-card strategy-card">
                      <button type="button" className="strategy-head" onClick={() => setMailsFloating(false)}>
                        <span className="strategy-caret">&#10696;</span>
                        <span className="strategy-title">Laatste mails</span>
                        <span className="strategy-meta-right">losgemaakt &middot; klik om terug te zetten</span>
                      </button>
                    </div>
                  )}
                  {mailsFloating && (
                    <FloatVenster titel="Laatste mails" onClose={() => setMailsFloating(false)}>
                      {mailsInner}
                    </FloatVenster>
                  )}
                </>
              );
            })()}
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

        {tab === "onboarding" && <OnboardingPanel slug={client.slug} onGaNaar={(t) => changeTab(validTab(t))} />}

        {tab === "klant" && (<>
          <FundamentPanel slug={client.slug} seoProfile={client.seoProfile || ""} positioneringUrl={client.cockpit.positioneringUrl || ""} onGaNaar={(t) => changeTab(validTab(t))} />
          <OrgDataPanel slug={client.slug} clientEmail={client.email || ""} />
          {/* Wie de concurrentie is, is klantkennis en hoort hier, niet verstopt
              achter een knopje in een scan-blok. Zelfde component als daar. */}
          <Concurrenten slug={client.slug} />
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
        {tab === "prioriteiten" && <PrioriteitenPanel slug={client.slug} domain={client.domain || ""} onGaNaar={gaNaar} clientName={client.name} clientEmail={client.email || ""} />}
        {tab === "cannibalisatie" && <CannibalPanel slug={client.slug} domain={client.domain || ""} openTarget={opruimTarget} clientName={client.name} clientEmail={client.email || ""} />}
        {tab === "interne-links" && <InternalLinksPanel slug={client.slug} domein={client.domain || ""} openTarget={linkTarget} />}
        {tab === "google-profiel" && <GmbPanel slug={client.slug} clientName={client.name} clientEmail={client.email || ""} pingwinEmail={myEmail || SUPERHUMAN_ACCOUNT} onGaNaar={(t) => changeTab(validTab(t))} />}

        {/* Hetzelfde overzicht als /admin/developer: ALLE klanten bij elkaar, want
            dit is de lijst die met de developer wordt gedeeld en die werkt over
            klanten heen. Deze klant staat wel bovenaan, en een nieuwe taak die je
            hier aanmaakt landt vanzelf bij hem. */}
        {tab === "developer" && <DeveloperOverview embedded slug={client.slug} clientName={client.name} />}
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



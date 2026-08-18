"use client";

import {useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ClientConfig } from "../../../../lib/clients";
import type {
  EmailSnapshot, MetricSnapshot, KeywordSnapshot, PageSnapshot, ClientStatus,
} from "../../../../lib/snapshots";
import type { TaskRow } from "../../../../lib/tasks";
import type { StrategySession } from "../../../../lib/strategy";
import dynamic from "next/dynamic";

// ── Per tabblad nabezorgd, niet vooraf ──────────────────────────────
// Deze panelen horen elk bij één tabblad, maar ze zaten allemaal in de eerste
// download van de cockpit. Dat was op 11-08-2026 goed voor 721 KB JavaScript
// (ingepakt) voordat er ook maar iets in beeld kwam: je wachtte op de
// Prioriteitenscan, de Opruimtabellen en het Google-profiel terwijl je naar de
// Taken keek. Ze worden nu pas opgehaald zodra je hun tabblad opent.
//
// Nieuw paneel dat bij precies één tabblad hoort? Zet hem hieronder, niet
// bovenaan bij de gewone imports.
const Wacht = () => <div className="muted pl-leeg">Bezig met laden…</div>;
const DeveloperOverview = dynamic(() => import("../../developer/DeveloperOverview"), { ssr: false, loading: Wacht });
const KpiPanel = dynamic(() => import("./KpiPanel"), { ssr: false, loading: Wacht });
const PagesPanel = dynamic(() => import("./PagesPanel"), { ssr: false, loading: Wacht });
const WijzigingenPanel = dynamic(() => import("./WijzigingenPanel"), { ssr: false, loading: Wacht });
const CannibalPanel = dynamic(() => import("./CannibalPanel"), { ssr: false, loading: Wacht });
const InternalLinksPanel = dynamic(() => import("./InternalLinksPanel"), { ssr: false, loading: Wacht });
const MetaCtrPanel = dynamic(() => import("./MetaCtrPanel"), { ssr: false, loading: Wacht });
const PrioriteitenPanel = dynamic(() => import("./PrioriteitenPanel"), { ssr: false, loading: Wacht });
const DocumentenPanel = dynamic(() => import("./DocumentenPanel"), { ssr: false, loading: Wacht });
const ActiviteitPanel = dynamic(() => import("./ActiviteitPanel"), { ssr: false, loading: Wacht });
const LeadTab = dynamic(() => import("./LeadTab"), { ssr: false, loading: Wacht });
const OnboardingPanel = dynamic(() => import("./OnboardingPanel"), { ssr: false, loading: Wacht });
const GmbPanel = dynamic(() => import("./GmbPanel"), { ssr: false, loading: Wacht });
const OrgDataPanel = dynamic(() => import("./OrgDataPanel"), { ssr: false, loading: Wacht });
const Concurrenten = dynamic(() => import("./Concurrenten"), { ssr: false, loading: Wacht });
const FundamentPanel = dynamic(() => import("./FundamentPanel"), { ssr: false, loading: Wacht });

import ChatPanel from "./ChatPanel";
import OverviewChat from "./OverviewChat";
import Planning from "./Planning";
import KlantTabs, { type Tab } from "./KlantTabs";
import FocusBlock from "./FocusBlock";
import KoersBlok from "./KoersBlok";
import StrategyPanel from "./StrategyPanel";
import ShareLinkBar from "./ShareLinkBar";
import HelpHint from "./HelpHint";
import MailAllowlist from "./MailAllowlist";
import LinkPreview from "./LinkPreview";
import { mdToHtml } from "../../../../lib/markdown";
import FloatVenster from "./FloatVenster";
import InvoiceAlert from "./InvoiceAlert";
import SelectionActions from "./SelectionActions";
import MailControlePanel from "./MailControlePanel";
import MailBijlagen from "./MailBijlagen";
import OntwikkelMenu from "../../OntwikkelMenu";
import Tellers from "../../Tellers";
import KlantKiezer from "./KlantKiezer";
import KlussenChip from "./KlussenChip";
import MeldingenMenu from "../../MeldingenMenu";
import { LosVenster, PijlRechts } from "../../../_ui/Pijl";
import {
  metricLabel, fmtMetric, periodLabel, sanitizeEmail, cleanReplyHtml,
  daysSince, daysAgoLabel, contactColor, fmtDate, fmtDateTime, shortUrl,
} from "./cockpit-tekst";


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

// ── Het omhulsel dat een bezocht tabblad laat staan ─────────────────
// Vóór het eerste bezoek staat er niets (dus geen enkel verzoek en geen
// JavaScript-download voor een tabblad waar je nooit komt). Ná het eerste
// bezoek blijft het staan, alleen verborgen, zodat terugkomen niets kost en je
// filters, uitgeklapte rijen en halve teksten bewaard blijven.
function Bezocht({ tab, nu, bezocht, children }: { tab: Tab; nu: Tab; bezocht: Set<Tab>; children: React.ReactNode }) {
  if (!bezocht.has(tab)) return null;
  return <div style={{ display: nu === tab ? "block" : "none" }}>{children}</div>;
}

// Taaknaam kan opmaak/links bevatten; in compacte lijstjes tonen we platte tekst.
function stripTags(html: string): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

export default function ClientCockpit({
  client, emails: initialEmails, metrics, keywords, pages, lastIngest, status, statusUpdatedAt,
  msConfigured, msConnected, myEmail, allClients,
  googleConfigured, googleConnected, chatConfigured, tasks, initialTab, initialPage, highlight,
  initialStrategie, showMailSections = true,
}: { client: ClientConfig; initialTab?: string; initialPage?: string; highlight?: string; initialStrategie?: string; showMailSections?: boolean } & CockpitData) {
  // Live mail komt NA het tonen binnen (achtergrond-verversing): het scherm opent
  // met de opgeslagen mails, en zodra Microsoft antwoordt worden ze ververst.
  const [emails, setEmails] = useState(initialEmails);
  const [mailLive, setMailLive] = useState(false);
  // Hoeveel mails er nu gevraagd worden, en of er nog dieper terug te kijken
  // valt. De lijst begint op vijftien; de knop "Meer" onderaan haalt er twintig
  // bij, net zolang tot de mailbox niets ouders meer teruggeeft.
  const [mailAantal, setMailAantal] = useState(15);
  const [meerMails, setMeerMails] = useState(false);
  const [meerBezig, setMeerBezig] = useState(false);
  const geenAhrefs = (lijst: { fromAddress?: string }[]) =>
    lijst.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));
  useEffect(() => {
    if (!msConnected || !showMailSections) return;
    let off = false;
    fetch(`/api/admin/mail?slug=${encodeURIComponent(client.slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off || !d.ok || !Array.isArray(d.emails) || d.emails.length === 0) return;
        setEmails(geenAhrefs(d.emails) as typeof initialEmails);
        setMeerMails(d.meer === true);
        setMailLive(true);
      })
      .catch(() => { /* opgeslagen mails blijven staan */ });
    return () => { off = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [client.slug]);

  async function haalMeerMails() {
    if (meerBezig) return;
    const volgende = mailAantal + 20;
    setMeerBezig(true);
    try {
      const d = await fetch(`/api/admin/mail?slug=${encodeURIComponent(client.slug)}&aantal=${volgende}`).then((r) => r.json());
      if (d?.ok && Array.isArray(d.emails)) {
        setEmails(geenAhrefs(d.emails) as typeof initialEmails);
        setMailAantal(d.aantal || volgende);
        setMeerMails(d.meer === true);
        setMailLive(true);
      } else setMeerMails(false);
    } catch { /* de lijst blijft staan zoals hij stond */ }
    finally { setMeerBezig(false); }
  }

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
    // Oude bookmarks en links naar "Klantgegevens" komen op het dossier uit.
    klantgegevens: "klant", dossier: "klant", preview: "klantweergave",
    // Onboarding is geen eigen scherm meer: hij staat als de kop van het dossier,
    // boven precies dezelfde stappen. Oude links komen daar dus gewoon uit.
    onboarding: "klant",
  };
  const GELDIGE_TABS: Tab[] = ["lead", "werkzaamheden", "paginas", "documenten", "activiteit",
    "resultaten", "klant", "klantweergave", "developer", "wijzigingen", "meta", "cannibalisatie", "interne-links",
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
  // Toggles bovenaan de (samengevoegde) Werkzaamheden-pagina, standaard gesloten.
  const [showMailsBox, setShowMailsBox] = useState(false);
  // Laatste mails los en groot in beeld, in plaats van in de smalle kolom.
  const [mailsFloating, setMailsFloating] = useState(false);
  // Zoekwoorden & links stond als los tabje aan de rechterrand (op elk tabblad
  // bereikbaar); dat gaf twee plekken voor hetzelfde blok. Nu één plek: een
  // toggle onder Laatste mails, zelfde vormgeving, standaard dicht.

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

  // ── Een tabblad dat je bezocht hebt blijft staan ────────────────────
  // Dit gold alleen voor Pagina's; elk ander tabblad werd bij het wegklikken
  // helemaal opgeruimd en haalde bij terugkomst álles opnieuw op. Heen en weer
  // kijken tussen twee tabbladen was daardoor het duurste wat je kon doen: op
  // 17-08-2026 kostte één keer terug naar Resultaten opnieuw tien seconden, en
  // naar Meta & CTR tot achtentwintig.
  //
  // Nu blijft een bezocht tabblad in het geheugen staan (verborgen, niet
  // weggegooid), dus terugkomen is gratis en je openstaande filters, uitgeklapte
  // rijen en halve teksten staan er nog. Dat kan veilig omdat elk paneel dat
  // periodiek bijwerkt dat alleen doet zolang er echt iets draait; een verborgen
  // paneel dat stilstaat vraagt niets. Draait er wél iets (een scan, een
  // meting), dan loopt dat nu netjes door terwijl je ergens anders kijkt.
  //
  // Nieuw paneel erbij? Zet het hieronder in een <Bezocht>-omhulsel, niet achter
  // een `tab === "..." &&`. Uitzondering: schermen die zwaar blijven doorwerken
  // als je ze niet ziet (zoals de klantweergave met zijn ingesloten dashboard).
  const [bezocht, setBezocht] = useState<Set<Tab>>(() => new Set<Tab>([validTab(initialTab)]));
  const paginasVisited = bezocht.has("paginas");

  // ── De adresbalk bijwerken zonder de server erbij te halen ──────────
  // Hier stond router.replace(). Dat lijkt gratis (het scherm is al gewisseld
  // door setTab hierboven), maar het is het niet: Next haalt daarvoor de hele
  // serverpagina opnieuw op. En deze pagina is force-dynamic, dus dat betekent
  // elf databasevragen plus de Microsoft- en Google-status, bij ELKE tabklik.
  // Gemeten op 17-08-2026: 1,0 tot 1,5 seconde en 70 KB per klik, voor niets
  // anders dan `?tab=` in de adresbalk.
  //
  // window.history vervangt precies dat ene stukje. Next 14 kent dit en houdt
  // zijn eigen boekhouding bij, dus een herlaadbeurt of de terugknop komt nog
  // steeds op het juiste tabblad uit.
  //
  // Let op: gebruik dit ALLEEN als er niets van de server nodig is. Moet de
  // pagina echt verse data hebben (zoals bij een nieuwe taak hieronder), dan
  // hoort daar router.refresh() bij.
  function zetAdres(zoek: string) {
    try { window.history.replaceState(null, "", `${pathname}?${zoek}`); } catch { /* oude browser: adresbalk blijft staan, verder niets aan de hand */ }
  }

  // Wissel van tab én update de URL zodat reload op dezelfde tab uitkomt.
  function changeTab(newTab: Tab) {
    setBezocht((b) => (b.has(newTab) ? b : new Set(b).add(newTab)));
    setTab(newTab);
    zetAdres(`tab=${newTab}`);
  }

  // Vanuit de pagina-chat een werkzaamheid gemaakt: spring naar Werkzaamheden en
  // licht de nieuwe taak op. Verse laadbeurt zodat de taak er echt in staat.
  function goToNewTask(taskId: number) {
    setTab("werkzaamheden");
    zetAdres(`tab=werkzaamheden&highlight=${taskId}`);
    // Hier hoort de server er wél bij: de nieuwe taak moet uit de database komen.
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
    setBezocht((b) => (b.has("paginas") ? b : new Set(b).add("paginas")));
    setTab("paginas");
    setPagesTarget((t) => ({ url, n: (t?.n || 0) + 1 }));
    zetAdres(`tab=paginas&page=${encodeURIComponent(url)}`);
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

  // ── Van mail naar taak ──
  // Een mail met werk erin ("de web-foutmelding op de knippatronen-pagina") werd
  // handwerk: taak typen, onderwerp samenvatten, link erbij zoeken. Dit knopje
  // doet die drie dingen zelf en zet de korte beschrijving in het bestaande veld
  // Aantekeningen van de kaart, met de link naar de mail eronder.
  const [taakBezig, setTaakBezig] = useState<string | null>(null);
  const [taakMelding, setTaakMelding] = useState<{ id: string; tekst: string; fout: boolean } | null>(null);
  async function maakTaakVanMail(e: typeof emails[number]) {
    if (taakBezig) return;
    setTaakBezig(e.id); setTaakMelding(null);
    try {
      const d = await fetch("/api/admin/mail-taak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: client.slug,
          onderwerp: e.subject || "",
          van: e.fromName || e.fromAddress || "",
          datum: e.receivedAt || "",
          link: e.superhumanLink || e.webLink || "",
          tekst: e.bodyHtml || e.preview || "",
        }),
      }).then((r) => r.json());
      if (d?.ok) {
        setTaakMelding({ id: e.id, tekst: `Taak aangemaakt: ${d.titel}`, fout: false });
        setWeekplanReload((n) => n + 1);
      } else setTaakMelding({ id: e.id, tekst: d?.error || "Taak aanmaken mislukte.", fout: true });
    } catch { setTaakMelding({ id: e.id, tekst: "Taak aanmaken mislukte.", fout: true }); }
    finally { setTaakBezig(null); }
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
        <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10001, background: "var(--dark, var(--kleur-kop))", color: "var(--white)", borderRadius: "var(--r-full)", padding: "var(--s-2) var(--s-5)", fontSize: "var(--fs-sm)", fontWeight: 600, boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
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
          {/* Vinkje = mooie ontwikkeling (uit de nachtelijke trend-berekening,
              laatste 28 dagen). */}
          <KlantKiezer
            klanten={allClients.map((c) => ({ slug: c.slug, name: c.name, grp: c.grp, fase: c.fase, goed: !!c.good28 }))}
            huidig={client.slug}
            onVooruit={(slug) => router.prefetch(`/admin/client/${slug}`)}
            onKies={(slug, naam) => { setSwitchingTo(naam); router.push(`/admin/client/${slug}`); }}
          />
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

            {/* Twee kolommen, allebei even breed: links de Overview (assistent +
                weekplanning), rechts Bespreeklijsten, Laatste mails en Zoekwoorden &
                links onder elkaar. tk-wide breekt bewust uit de standaard
                .container-breedte (1700px bleek op een breed scherm nog steeds
                een flink leeg stuk over te laten); alleen een klein vast randje.

                Links stond alles onder elkaar open: de assistent met al zijn
                onderwerpen, en daaronder de hele weekplanning. Je scrolde dus altijd
                langs dingen die je op dat moment niet nodig had. Nu één kop met drie
                blokken die dicht beginnen, zodat je zelf kiest wat je openzet. */}
            <div className="tk-wide">
            {/* De strategiegesprekken uit de assistent, met per actiepunt één klik
                naar de takenlijst. Dit blok bestond al en werd door de chat ook
                beloofd ("je vindt hem bovenaan het Taken-tabblad"), maar hing na
                de herindeling nergens meer op het scherm. */}
            <StrategyPanel slug={client.slug}
              openSessionId={initialStrategie ? Number(initialStrategie) || undefined : undefined} />
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
                     title="Dezelfde planning op volle breedte, over al je klanten heen">alle klanten <PijlRechts /></a>
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

            {/* Waar we naartoe werken staat bovenaan deze kolom, op dezelfde
                hoogte als de kop "Overview" links. Het is de vraag waarmee je
                hier binnenkomt, en als kop van de kolom hoort hij dus naast de
                kop van de andere kolom; daaronder komt de naslag (de mails, het
                vrije overzichtsveld). Hij stond onderaan, onder twee blokken
                die je pas nodig hebt als je al aan het werk bent. Verplaatst op
                18 augustus 2026, op verzoek. */}
            <KoersBlok slug={client.slug} onGaNaarTab={(t) => changeTab(validTab(t))} />

            {showMailSections && (<>
            {/* De bespreeklijsten stonden hier. Weggehaald op 18-08-2026: de
                takenpagina moest korter, en dit blok hoorde bij de vraag "wat wil
                ik met wie bespreken", niet bij "wat doen we deze periode". Het
                component staat er nog, dus terugzetten is één regel. */}

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
                <button type="button" className="btn btn-primary btn-klein" onClick={() => void vraagMails()} disabled={vraagBusy || !shQuery.trim()}>
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
                  <button type="button" className="btn btn-klein" onClick={() => { setVraagAntwoord(""); setVraagIds([]); }}>Wis</button>
                </div>
              )}
              {lastIngest && <div className="ck-updated" style={{ marginBottom: "var(--s-3)" }}>bijgewerkt {fmtDate(lastIngest)}</div>}
              {msConfigured && !msConnected && (
                <div className="mail-connect">
                  Koppel Microsoft 365 om de volledige mails te zien en vanuit het dashboard te beantwoorden.{" "}
                  <a className="btn btn-primary btn-klein" href="/api/ms/auth/start">Koppel Microsoft</a>
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
                            {/* Naast Superhuman, want daar kijk je toch al: van deze
                                mail een taak maken, met titel, korte beschrijving in
                                de aantekeningen en de link naar de mail erbij. */}
                            <button type="button" className="btn btn-ghost btn-klein email-taak"
                              disabled={taakBezig === e.id}
                              title="Maak van deze mail een taak, met een korte beschrijving en de link naar de mail"
                              onClick={(ev) => { ev.stopPropagation(); void maakTaakVanMail(e); }}>
                              {taakBezig === e.id ? "Bezig…" : "Taak"}
                            </button>
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
                        {taakMelding?.id === e.id && (
                          <div className={"email-taak-melding" + (taakMelding.fout ? " err" : "")}>{taakMelding.tekst}</div>
                        )}
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
                                  <button type="button" className="btn btn-primary btn-klein" onClick={() => sendReply(e.id)} disabled={replyBusy || !replyToAddr.trim()}>
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
                            {mailLive && <MailBijlagen slug={client.slug} messageId={e.id} mailDatum={e.receivedAt || ""} />}
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
                  {/* Verder terug kijken. De lijst begint bij de laatste vijftien;
                      dit haalt er telkens twintig bij, tot de mailbox niets ouders
                      meer teruggeeft. */}
                  {meerMails && (
                    <div className="email-meer">
                      <button type="button" className="btn btn-ghost btn-klein" disabled={meerBezig} onClick={() => void haalMeerMails()}>
                        {meerBezig ? "Bezig…" : "Meer mails"}
                      </button>
                      <span className="muted">{emails.length} getoond</span>
                    </div>
                  )}
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
                            onClick={(e) => { e.stopPropagation(); setShowMailsBox(true); setMailsFloating(true); }}><LosVenster /> los</span>
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
                        <span className="strategy-caret"><LosVenster /></span>
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

            {/* Het vrije overzichtsveld (heette "Zoekwoorden & links"). Het stond
                een tijd op het Dossier-tabblad, omdat een afspraak die maanden
                meegaat geen taak van deze week is. In de praktijk is het breder
                dan zoekwoorden alleen: het is de plek waar je losse aantekeningen
                over deze klant kwijt kunt, en die wil je zien terwijl je aan het
                werk bent. Dus terug op Taken, onder de mails en boven "Waar we
                naartoe werken", en met een naam die de inhoud dekt. Eén plek, niet
                twee: op het Dossier staat hij niet meer. */}
            <div className="cockpit-card strategy-card">
              <FocusBlock slug={client.slug} standalone titel="Overzicht" />
            </div>

            </div>
            </div>
            </div>

          </>
        )}

        <Bezocht tab="resultaten" nu={tab} bezocht={bezocht}>
          <KpiPanel slug={client.slug} domain={client.domain || ""} onOpenPage={goToPage} />
        </Bezocht>


        <Bezocht tab="klant" nu={tab} bezocht={bezocht}>
          {/* Hoe ver deze klant staat, met de knop die aanvult wat nog ontbreekt.
              Dit stond op een eigen tabblad Onboarding, met dezelfde cijfers uit
              dezelfde bron als het fundament eronder. Twee schermen voor dezelfde
              vraag betekent dat je altijd de verkeerde openhebt. */}
          <OnboardingPanel alleenKop slug={client.slug} onGaNaar={(t) => changeTab(validTab(t))} />
          {/* Wie is deze klant: eerst de stand van het fundament, dan de vaste
              briefing (profiel en tone of voice), dan de afgesproken strategie,
              dan de harde gegevens en de concurrenten. Van "wie is dit bedrijf"
              naar "wat spraken we af" naar "tegen wie nemen we het op". */}
          <FundamentPanel
            slug={client.slug}
            positioneringUrl={client.cockpit.positioneringUrl || ""}
            huisstijlUrl={client.cockpit.huisstijlUrl || ""}
            adsAccountUrl={client.cockpit.adsAccountUrl || ""}
            onGaNaar={(t) => changeTab(validTab(t))}
          />
          {/* Het klantprofiel en de tone of voice stonden boven de paginalijst.
              Ze gaan niet over pagina's maar over wie het bedrijf is, en bijna
              elke motor leest ze. Zelfde code als daar, dus één bron. */}
          <PagesPanel alleenProfiel slug={client.slug} initialProfile={client.seoProfile || ""} domain={client.domain || ""} />
          {/* Hier stond het vrije veld "Zoekwoorden & links". Dat heet nu
              "Overzicht" en staat weer op Taken, in de rechterkolom onder de
              mails: je houdt het bij terwijl je werkt, niet terwijl je het
              dossier naleest. Eén plek, dus hier niet nog een keer. */}
          <OrgDataPanel slug={client.slug} clientEmail={client.email || ""} />
          {/* Wie de concurrentie is, is klantkennis en hoort hier, niet verstopt
              achter een knopje in een scan-blok. Zelfde component als daar. */}
          <Concurrenten slug={client.slug} />
        </Bezocht>

        {/* Wat de klant ziet is geen dossierkennis maar een oplevering: het is het
            scherm dat je deelt. Daarom een eigen tabblad onder "wat hebben we
            geleverd" in plaats van onderaan het dossier, waar het onder de
            bedrijfsgegevens en de concurrenten verstopt zat. */}
        {tab === "klantweergave" && (
          <div className="cockpit-card client-frame-card">
            <div className="ck-section-head"><span>Zo ziet de klant het</span>
              <a className="btn btn-klein" href={`/admin/preview/${client.slug}`} target="_blank" rel="noreferrer">Openen in nieuw tabblad ↗</a>
            </div>
            <ShareLinkBar slug={client.slug} />
            <iframe src={`/admin/preview/${client.slug}`} className="client-frame" title="Klant-dashboard" />
          </div>
        )}

        <Bezocht tab="paginas" nu={tab} bezocht={bezocht}>
          <PagesPanel slug={client.slug} initialProfile={client.seoProfile || ""} clientEmail={client.email || ""} clientName={client.name} domain={client.domain || ""} onGoToTask={goToNewTask} openTarget={pagesTarget} />
        </Bezocht>

        <Bezocht tab="documenten" nu={tab} bezocht={bezocht}><DocumentenPanel slug={client.slug} onGoToPage={goToPage} /></Bezocht>
        <Bezocht tab="activiteit" nu={tab} bezocht={bezocht}><ActiviteitPanel slug={client.slug} /></Bezocht>
        <Bezocht tab="wijzigingen" nu={tab} bezocht={bezocht}><WijzigingenPanel slug={client.slug} /></Bezocht>

        <Bezocht tab="meta" nu={tab} bezocht={bezocht}><MetaCtrPanel slug={client.slug} domain={client.domain || ""} backendUrl={client.backendUrl} onOpenPage={goToPage} openTarget={metaTarget} /></Bezocht>

        {/* Deze twee schermen bestonden al maar hingen nergens in de UI, dus niemand
            kon erbij. Hier hoort de volledige redirectlijst thuis, niet in de chat:
            een lijst is een scherm, een oordeel is een gesprek. */}
        <Bezocht tab="prioriteiten" nu={tab} bezocht={bezocht}><PrioriteitenPanel slug={client.slug} domain={client.domain || ""} onGaNaar={gaNaar} clientName={client.name} clientEmail={client.email || ""} /></Bezocht>
        <Bezocht tab="cannibalisatie" nu={tab} bezocht={bezocht}><CannibalPanel slug={client.slug} domain={client.domain || ""} openTarget={opruimTarget} clientName={client.name} clientEmail={client.email || ""} /></Bezocht>
        <Bezocht tab="interne-links" nu={tab} bezocht={bezocht}><InternalLinksPanel slug={client.slug} domein={client.domain || ""} openTarget={linkTarget} /></Bezocht>
        <Bezocht tab="google-profiel" nu={tab} bezocht={bezocht}><GmbPanel slug={client.slug} clientName={client.name} clientEmail={client.email || ""} pingwinEmail={myEmail || SUPERHUMAN_ACCOUNT} onGaNaar={(t) => changeTab(validTab(t))} /></Bezocht>

        {/* Hetzelfde overzicht als /admin/developer: ALLE klanten bij elkaar, want
            dit is de lijst die met de developer wordt gedeeld en die werkt over
            klanten heen. Deze klant staat wel bovenaan, en een nieuwe taak die je
            hier aanmaakt landt vanzelf bij hem. */}
        <Bezocht tab="developer" nu={tab} bezocht={bezocht}><DeveloperOverview embedded slug={client.slug} clientName={client.name} /></Bezocht>
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

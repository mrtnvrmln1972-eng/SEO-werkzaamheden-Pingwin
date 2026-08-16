"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientUrl } from "../../../../lib/site-urls";
import { mdToHtml } from "../../../../lib/markdown";
import { sanitizeHtml } from "../../../../lib/veilige-html";
import ImportAnalysis from "./ImportAnalysis";
import PageChat from "./PageChat";
import PaginaDossier from "./PaginaDossier";
import { CLIENT_FOLDER_KEY } from "../../../../lib/constants";
import HelpHint from "./HelpHint";
import { urlKey } from "../../../../lib/url-key";
import { kaartTekst, faseVoorstel } from "../../../../lib/weekplan-kaarttekst";
import { FASE_VOLGORDE } from "../../../../lib/fase-volgorde";
import { PROFILE_HEADER, TOV_HEADER } from "../../../../lib/constants";
import Voortgang from "./Voortgang";
import { useKlus } from "./useKlus";

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function statusBadge(status: number | null, redirectTarget: string) {
  if (status === null) return <span className="url-badge url-unknown"><HelpHint title="Status onbekend" text={"Deze pagina is nog niet gescand of was niet bereikbaar bij de laatste scan.\n- Klik op 'Website inlezen' bovenaan om alle pagina's opnieuw te scannen.\n- Blijft de status leeg, controleer dan of de pagina echt bestaat en bereikbaar is."} /></span>;
  if (status >= 200 && status < 300) return <span className="url-badge url-ok">{status}</span>;
  if (status >= 300 && status < 400) return <span className="url-badge url-redir" title={redirectTarget ? `→ ${redirectTarget}` : "redirect"}>{status}</span>;
  return <span className="url-badge url-bad">{status}</span>;
}

// Voegt een gegenereerde sectie (met een "## Kop"-regel bovenaan) samen met de
// bestaande profieltekst: vervangt een sectie met dezelfde kop, of plakt hem
// eronder als hij nog niet bestaat. Zo kun je profiel en tone-of-voice los
// (her)genereren zonder elkaar te overschrijven.
function mergeSection(current: string, section: string): string {
  const cur = current || "";
  const header = (section.split("\n")[0] || "").trim();
  if (!header.startsWith("##")) return cur.trim() ? cur.trim() + "\n\n" + section.trim() : section.trim();
  const lines = cur.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === header);
  if (startIdx === -1) return (cur.trim() ? cur.trim() + "\n\n" : "") + section.trim();
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) { if (/^##\s/.test(lines[i])) { endIdx = i; break; } }
  const before = lines.slice(0, startIdx).join("\n").trim();
  const after = lines.slice(endIdx).join("\n").trim();
  return [before, section.trim(), after].filter(Boolean).join("\n\n");
}

// De twee automatisch gegenereerde secties dragen een vaste kop; alles daarbuiten
// is de eigen know-how van de strateeg over de klant. De koppen zelf staan in
// lib/constants.ts, want de onboarding leest ze ook: één bron, anders lopen ze
// een keer uit elkaar en ziet de onboarding een profiel dat er wél staat als leeg.

// Splitst de opgeslagen profieltekst in drie delen: uit klantprofiel, uit
// tone-of-voice-analyse, en de eigen know-how (de rest). Zo kunnen de eerste twee
// netjes gerenderd worden en blijft het derde deel een bewerkbaar veld.
function splitProfile(md: string): { profileMd: string; tovMd: string; knowhow: string } {
  const lines = (md || "").split("\n");
  const sections: { header: string; body: string[] }[] = [{ header: "", body: [] }];
  for (const l of lines) {
    if (/^##\s/.test(l)) sections.push({ header: l.trim(), body: [l] });
    else sections[sections.length - 1].body.push(l);
  }
  let profileMd = "", tovMd = "";
  const know: string[] = [];
  for (const s of sections) {
    const text = s.body.join("\n").trim();
    if (!text) continue;
    if (s.header === PROFILE_HEADER) profileMd = text;
    else if (s.header === TOV_HEADER) tovMd = text;
    else know.push(text);
  }
  return { profileMd, tovMd, knowhow: know.join("\n\n").trim() };
}
// Zet de drie delen weer om naar één opgeslagen tekst (vaste volgorde).
function recombineProfile(profileMd: string, tovMd: string, knowhow: string): string {
  return [profileMd.trim(), tovMd.trim(), knowhow.trim()].filter(Boolean).join("\n\n");
}

// Stabiele DOM-id per pagina-rij, zodat we er vanuit de KPI's naartoe kunnen scrollen.
const rowDomId = (url: string) => "pgrow-" + (url || "").replace(/[^a-zA-Z0-9]/g, "-");

// ── Fases per pagina (dezelfde zeven als op de kaart in de weekplanning) ──
// Bewust dezelfde volgorde en labels als in WeekplanCard: één pagina heeft één
// pijplijn, dus die mag op twee schermen niet anders heten of anders staan.
type FaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";
// De namen komen uit lib/fase-volgorde.ts, zodat deze lijst nooit iets anders
// zegt dan de kaart of de planning.
const PG_FASEN: { key: FaseKey; label: string }[] = FASE_VOLGORDE.map((f) => ({ key: f.key, label: f.label }));
// Zelfde sleutel als de server (lib/url-key.ts): protocol, www., slot-slash en
// hoofdletters doen er niet toe.
const faseKey = (u: string) => (u || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

// De zeven fases als heel kleine streepjes: gedaan is groen, open is grijs, en het
// eerstvolgende streepje krijgt de oranje rand. Subtiel genoeg voor een lijst met
// tientallen rijen; de tooltip vertelt het hele verhaal.
function FaseRail({ f }: { f?: Partial<Record<FaseKey, boolean>> }) {
  if (!f) return <span className="muted">&mdash;</span>;
  const volgende = PG_FASEN.find((x) => !f[x.key]);
  const gedaan = PG_FASEN.filter((x) => f[x.key]).length;
  const titel = PG_FASEN.map((x) => (f[x.key] ? "✓ " : "· ") + x.label).join("\n")
    + "\n\n" + (volgende ? `Volgende: ${volgende.label}` : "Alle fases klaar");
  return (
    <span className="pg-fases" title={titel} aria-label={`${gedaan} van ${PG_FASEN.length} fases gedaan`}>
      {PG_FASEN.map((x) => (
        <i key={x.key} className={"pg-fase" + (f[x.key] ? " done" : volgende && volgende.key === x.key ? " next" : "")} />
      ))}
      <span className="pg-fases-tel">{gedaan}/{PG_FASEN.length}</span>
    </span>
  );
}

export default function PagesPanel({ slug, initialProfile, clientEmail, clientName, onGoToTask, domain, openTarget, alleenProfiel }: { slug: string; initialProfile?: string; clientEmail?: string; clientName?: string; onGoToTask?: (taskId: number) => void; domain?: string; openTarget?: { url: string; n: number } | null;
  /** Alleen het klantprofiel tonen, zonder de paginalijst. Zo staat het profiel op
      de tab Klantgegevens (waar het hoort) zonder dat de code twee keer bestaat:
      één bron, twee plekken waar hij te zien is. In deze stand wordt de
      paginalijst ook niet opgehaald, want die is dan toch niet in beeld. */
  alleenProfiel?: boolean }) {
  type Opp = { impressions: number; clicks: number; ctr: number; position: number; bestKeyword: string; bestPosition: number | null; bestVolume: number | null; score: number; label: string; level: string };
  const [opps, setOpps] = useState<Record<string, Opp>>({});
  // Sortering: "prio" (standaard) = sterretjes bovenaan, dan plan, dan kans.
  // Elke andere kolom sorteert PUUR op die kolom, los van de sterretjes.
  const [sortKey, setSortKey] = useState<"prio" | "status" | "pagina" | "kans" | "vertoningen" | "positie" | "klikken" | "volume" | "fases" | "plan">("prio");
  // Fase-stand per pagina (zelfde bron als de kaarten in de weekplanning).
  const [phases, setPhases] = useState<Record<string, Partial<Record<FaseKey, boolean>>>>({});
  const [urls, setUrls] = useState<ClientUrl[]>([]);
  const [loading, setLoading] = useState(true);
  // De site inlezen is een achtergrondklus geworden: starten, en de stand volgen.
  const inlezen = useKlus(slug, "site-inlezen", () => { void load(); });
  const [q, setQ] = useState("");
  // Prioriteit-pagina's (ster), gedeeld met de KPI- en Wijzigingen-tab. Aangevinkte
  // pagina's springen naar boven in dit overzicht.
  const [priority, setPriority] = useState<Set<string>>(new Set());
  const prioKey = (u: string) => (u || "").replace(/\/+$/, "");
  // Welke pagina's staan al als kaart in de weekplanning? Afgelezen uit de
  // planning zelf (niet apart bijgehouden), zodat de knop vanzelf omslaat naar
  // "in planning" en je niet per ongeluk een tweede kaart maakt.
  const [gepland, setGepland] = useState<Set<string>>(new Set());
  async function laadPlanning() {
    try {
      const d = await fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      const open = (d?.tasks || []).filter((t: { url?: string; status?: string }) => t.url && t.status !== "klaar");
      setGepland(new Set(open.map((t: { url: string }) => urlKey(t.url))));
    } catch { /* zonder deze lijst toont de knop gewoon "+ planning" */ }
  }
  useEffect(() => { if (!alleenProfiel) void laadPlanning(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, alleenProfiel]);
  // Nieuwe (nog niet bestaande) pagina handmatig toevoegen.
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addingPage, setAddingPage] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  // Website-adres van de klant (kaal domein). Bewerkbaar hier, want er is verder
  // geen invoerveld voor; wordt bij "Website inlezen" meegestuurd en opgeslagen.
  const [domainInput, setDomainInput] = useState(domain || "");
  const [profile, setProfile] = useState(initialProfile || "");
  const [profileOpen, setProfileOpen] = useState(!!alleenProfiel);
  const [profileSaved, setProfileSaved] = useState(false);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [genBusy, setGenBusy] = useState<"" | "profile" | "tov">("");
  // De gegenereerde profieldelen (klantprofiel en tone of voice) standaard dicht.
  const [genPartOpen, setGenPartOpen] = useState<{ profile: boolean; tov: boolean }>({ profile: false, tov: false });
  const [genErr, setGenErr] = useState("");
  const [genMsg, setGenMsg] = useState("");
  const [made, setMade] = useState<Record<string, { link: string; driveError: string; taskId: number | null }>>({});

  // ── Google Drive klantmap (voor het klantprofiel- en tone-of-voice-document) ──
  // Sleutel komt uit lib/constants.ts (klant-breed,
  // niet per pagina), zodat beide documenten in dezelfde gekozen klantmap landen.
  type Folder = { id: string; name: string };
  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stack, setStack] = useState<Folder[]>([{ id: "root", name: "Mijn Drive" }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickErr, setPickErr] = useState("");
  const [newFolder, setNewFolder] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/drive/folders?chosenOnly=1&slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(CLIENT_FOLDER_KEY)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok && d.chosen) setDriveFolder({ id: d.chosen.folderId, name: d.chosen.folderName, path: d.chosen.folderPath }); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; }; /* eslint-disable-next-line */
  }, [slug]);

  // Vanuit de KPI's een pagina openen: klap de juiste rij open en scroll ernaartoe.
  // openTarget.n is een teller zodat herhaald klikken op dezelfde pagina opnieuw werkt.
  const openHandledRef = useRef(0);
  useEffect(() => {
    if (!openTarget || loading) return;
    if (openHandledRef.current === openTarget.n) return;
    openHandledRef.current = openTarget.n;
    const norm = (u: string) => (u || "").replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
    const match = urls.find((x) => norm(x.url) === norm(openTarget.url));
    if (match) {
      setQ("");
      setOpen(match.url);
      setTimeout(() => { document.getElementById(rowDomId(match.url))?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
    } else {
      setQ(shortUrl(openTarget.url));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [openTarget, loading, urls]);

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
    let s: Folder[] = [{ id: "root", name: "Mijn Drive" }];
    try { const c = localStorage.getItem(`pw_drivestack_${slug}`); if (c) { const p = JSON.parse(c); if (Array.isArray(p) && p.length && p[0]?.id === "root") s = p; } } catch { /* geen geheugen */ }
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
      const r = await fetch("/api/admin/drive/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", slug, url: CLIENT_FOLDER_KEY, folderId: cur.id, folderName: cur.name, folderPath: path }) });
      const d = await r.json();
      if (!d.ok) { setPickErr(d.error || "Opslaan mislukt."); return; }
      try { localStorage.setItem(`pw_drivestack_${slug}`, JSON.stringify(stack)); } catch { /* geheugen is extra */ }
      setDriveFolder({ id: cur.id, name: cur.name, path }); setPickerOpen(false);
    } catch { setPickErr("Opslaan mislukt."); } finally { setPickBusy(false); }
  }

  // Genereert het klantprofiel of de tone-of-voice uit de live site, zet de
  // samenvatting in het veld, en maakt er een Pingwin-huisstijl document +
  // mailbare werkzaamheid van (zichtbaar in werkzaamheden en klantdash).
  async function generateProfile(kind: "profile" | "tov") {
    if (genBusy) return;
    setGenBusy(kind); setGenErr(""); setGenMsg(""); setProfileOpen(true);
    const before = profile;
    try {
      const r = await fetch("/api/admin/client-profile/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, kind, folderId: driveFolder?.id || undefined, background: true }) });
      const d = await r.json();
      if (!d.ok) { setGenErr(d.error || "Genereren mislukt."); setGenBusy(""); return; }
      // Draait op de achtergrond: poll het profiel tot het is bijgewerkt (wegklikken mag).
      setGenMsg(kind === "tov"
        ? "Tone-of-voice draait op de achtergrond; hij verschijnt hier zodra hij klaar is. Je kunt gerust wegklikken (staat straks ook in Werkzaamheden)."
        : "Klantprofiel draait op de achtergrond; het verschijnt hier zodra het klaar is. Je kunt gerust wegklikken (staat straks ook in Werkzaamheden).");
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        try {
          const p = await fetch(`/api/admin/client-profile?slug=${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
          if (p?.ok && typeof p.profile === "string" && p.profile.trim() && p.profile !== before) {
            setProfile(p.profile); setGenMsg(""); setGenBusy(""); clearInterval(poll);
          }
        } catch { /* blijf pollen */ }
        if (tries > 60) { setGenBusy(""); setGenMsg("Het duurt langer dan verwacht; ververs de pagina om te kijken of het profiel klaar is."); clearInterval(poll); }
      }, 5000);
    } catch { setGenErr("Genereren mislukt."); setGenBusy(""); }
  }

  function changeProfile(v: string) {
    setProfile(v); setProfileSaved(false);
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(async () => {
      await fetch("/api/admin/client-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, profile: v }) }).catch(() => {});
      setProfileSaved(true);
    }, 700);
  }

  // De drie delen afgeleid uit de opgeslagen tekst; alleen de know-how is bewerkbaar.
  const parts = useMemo(() => splitProfile(profile), [profile]);
  function changeKnowhow(v: string) { changeProfile(recombineProfile(parts.profileMd, parts.tovMd, v)); }

  async function load(background = false) {
    if (!background) setLoading(true);
    try {
      const r = await fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`);
      const d = await r.json();
      if (d.ok) {
        setUrls(d.urls);
        try { localStorage.setItem(`pw_urls_${slug}`, JSON.stringify(d.urls)); } catch { /* cache is extra */ }
      }
    } finally { setLoading(false); }
  }
  // Cache-first: toon direct de vorige lijst uit de browsercache (instant), en
  // ververs daarna in de achtergrond. In verreweg de meeste gevallen klopt de cache.
  useEffect(() => {
    let hadCache = false;
    try {
      const c = localStorage.getItem(`pw_urls_${slug}`);
      if (c) { const parsed = JSON.parse(c); if (Array.isArray(parsed) && parsed.length) { setUrls(parsed); setLoading(false); hadCache = true; } }
    } catch { /* geen cache */ }
    load(hadCache); /* eslint-disable-next-line */
  }, [slug]);

  // Het inlezen draait op de server; dit scherm volgt alleen de stand. Wegklikken
  // mag dus, en bij terugkomen staat hij er nog.
  async function scan() {
    if (inlezen.bezig) return;
    setMsg("");
    try {
      const r = await fetch("/api/admin/urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, domain: domainInput.trim() || undefined }) });
      const d = await r.json();
      if (d.ok) { inlezen.zetBezig(); await inlezen.ververs(); }
      else setMsg(d.error || "Inlezen mislukt.");
    } catch { setMsg("Inlezen mislukt."); }
  }

  // Nieuwe pagina toevoegen: bouw een volledige URL uit het website-adres + het pad
  // (of gebruik een geplakte volledige URL), sla op, ververs en open de pagina meteen.
  async function addPage() {
    if (addingPage) return;
    const raw = newPath.trim();
    if (!raw) { setMsg("Geef een pad of volledige URL voor de nieuwe pagina."); return; }
    const base = (domainInput || domain || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    let full: string;
    if (/^https?:\/\//i.test(raw)) full = raw;
    else if (!base) { setMsg("Vul eerst het website-adres in (of plak de volledige URL)."); return; }
    else full = `https://${base}/${raw.replace(/^\/+/, "")}`;
    if (!/\/$/.test(full) && !/\.[a-z0-9]{2,5}$/i.test(full)) full += "/";
    setAddingPage(true); setMsg("");
    try {
      const r = await fetch("/api/admin/urls/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: full, title: newTitle.trim() }) });
      const d = await r.json();
      if (d.ok) {
        const added = d.url || full;
        setMsg(`Nieuwe pagina toegevoegd: ${shortUrl(added)}. Je kunt er nu een plan, blauwdruk en copywriting voor maken.`);
        setNewPageOpen(false); setNewPath(""); setNewTitle("");
        await load();
        setQ(""); setOpen(added);
        setTimeout(() => { document.getElementById(rowDomId(added))?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 120);
      } else setMsg(d.error || "Toevoegen mislukt.");
    } catch { setMsg("Toevoegen mislukt."); } finally { setAddingPage(false); }
  }

  // Kans-data (vertoningen/positie/beste zoekwoord): cache-eerst uit de browser
  // (instant), daarna verse data op de achtergrond. Zelfde patroon als de lijst.
  useEffect(() => {
    try {
      const c = localStorage.getItem(`pw_opps_${slug}`);
      if (c) { const parsed = JSON.parse(c); if (parsed && typeof parsed === "object") setOpps(parsed); }
    } catch { /* geen cache */ }
    fetch(`/api/admin/page-opportunities?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => {
        if (d.ok) {
          setOpps(d.pages || {});
          try { localStorage.setItem(`pw_opps_${slug}`, JSON.stringify(d.pages || {})); } catch { /* cache is extra */ }
        }
      }).catch(() => {});
  }, [slug]);

  // Fase-stand per pagina: cache-eerst uit de browser (de streepjes staan er dan
  // meteen), daarna verse stand op de achtergrond. Zelfde patroon als de kans-data.
  useEffect(() => {
    try {
      const c = localStorage.getItem(`pw_phases_${slug}`);
      if (c) { const parsed = JSON.parse(c); if (parsed && typeof parsed === "object") setPhases(parsed); }
    } catch { /* geen cache */ }
    fetch(`/api/admin/page-phases?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => {
        if (d.ok) {
          setPhases(d.pages || {});
          try { localStorage.setItem(`pw_phases_${slug}`, JSON.stringify(d.pages || {})); } catch { /* cache is extra */ }
        }
      }).catch(() => {});
  }, [slug]);

  // Prio-pagina's (sterren): ook cache-eerst, dan verversen.
  useEffect(() => {
    try {
      const c = localStorage.getItem(`pw_prio_${slug}`);
      if (c) { const parsed = JSON.parse(c); if (Array.isArray(parsed)) setPriority(new Set(parsed)); }
    } catch { /* geen cache */ }
    fetch(`/api/admin/changes/priority?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => {
        if (d.ok) {
          const keys = (d.urls || []).map((u: string) => prioKey(u));
          setPriority(new Set(keys));
          try { localStorage.setItem(`pw_prio_${slug}`, JSON.stringify(keys)); } catch { /* cache is extra */ }
        }
      }).catch(() => {}); /* eslint-disable-next-line */
  }, [slug]);
  function togglePriority(url: string) {
    const key = prioKey(url);
    const on = !priority.has(key);
    setPriority((s) => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
    fetch("/api/admin/changes/priority", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, priority: on }) }).catch(() => {});
  }

  const normUrl = (u: string) => (u || "").trim().replace(/\/+$/, "");
  const oppOf = (u: ClientUrl): Opp | undefined => opps[normUrl(u.url)];
  const phaseOf = (u: ClientUrl) => phases[faseKey(u.url)];
  const faseTel = (u: ClientUrl) => { const f = phaseOf(u); return f ? PG_FASEN.filter((x) => f[x.key]).length : -1; };

  const filtered = q.trim()
    ? urls.filter((u) => (u.url + " " + u.title).toLowerCase().includes(q.trim().toLowerCase()))
    : urls;
  const sorted = [...filtered].sort((a, b) => {
    const prio = (u: ClientUrl) => (priority.has(prioKey(u.url)) ? 1 : 0);
    // Vol plan eerst, dan half plan (cluster-advies), dan leeg.
    const rank = (u: ClientUrl) => ((u.plan || "").trim() ? 2 : u.hasClusterAdvice ? 1 : 0);
    const oa = oppOf(a), ob = oppOf(b);
    const imp = (u: ClientUrl, o?: Opp) => o?.impressions ?? u.gscImpressions ?? 0;
    switch (sortKey) {
      case "prio": {
        // Sterretjes bovenaan, daarbinnen plan-status en dan kans.
        if (prio(a) !== prio(b)) return prio(b) - prio(a);
        if (rank(a) !== rank(b)) return rank(b) - rank(a);
        return (ob?.score || 0) - (oa?.score || 0);
      }
      case "status": return (a.status || 999) - (b.status || 999) || a.url.localeCompare(b.url);
      case "pagina": return a.url.localeCompare(b.url);
      case "klikken": return ((ob && ob.clicks > 0 ? ob.clicks : b.gscClicks) || 0) - ((oa && oa.clicks > 0 ? oa.clicks : a.gscClicks) || 0);
      case "vertoningen": return imp(b, ob) - imp(a, oa);
      case "positie": return (oa?.position ?? 999) - (ob?.position ?? 999);
      case "volume": return (ob?.bestVolume ?? -1) - (oa?.bestVolume ?? -1);
      case "kans": return (ob?.score || 0) - (oa?.score || 0);
      // Pagina's die het verst in de pijplijn staan eerst; bij gelijke stand op kans.
      case "fases": return (faseTel(b) - faseTel(a)) || ((ob?.score || 0) - (oa?.score || 0));
      case "plan": return rank(b) - rank(a);
    }
  });

  // Het klantprofiel als los blok. Het stond hier boven de paginalijst, maar het
  // gaat niet over pagina's: het is de vaste briefing over wie de klant is, en
  // bijna elke motor leest het. Het hoort dus bij Klantgegevens, en dat beloofde
  // die tab in zijn eigen omschrijving trouwens al. Zie KlantTabs.tsx voor de
  // regel: elk blok staat bij de vraag die het beantwoordt.
  const profielBlok = (
    <>
      <div className="profile-search-row">
        <button type="button" className="client-profile-toggle" onClick={() => setProfileOpen((v) => !v)}>
        {profileOpen ? "▾" : "▸"} Klantprofiel {(profile || "").trim() ? <span className="plan-chip has">ingevuld</span> : <span className="plan-chip">leeg</span>}
        {profileSaved && <span className="focus-save-status" style={{ marginLeft: "var(--s-2)" }}>opgeslagen</span>}
        </button>
        <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Wat is het klantprofiel en waar wordt het gebruikt?" text={"Het klantprofiel is de vaste briefing over deze klant: wie het bedrijf is, wat het aanbiedt, voor wie (doelgroep en hun twijfels), het werkgebied (lokaal, regionaal of landelijk), de positionering (prijs, kwaliteit, exclusief, duurzaam) en de tone of voice. Het is het geheugen dat de AI bij ELKE actie voor deze klant meekrijgt.\nHet profiel wordt automatisch gebruikt door:\n- De strategie-chat per pagina (stap 1): het advies houdt rekening met positionering en werkgebied; is het profiel leeg, dan gaat de chat er eerst naar vragen.\n- De documenten (analyse, blauwdruk en copy): de teksten klinken naar dit bedrijf in plaats van als generieke AI-tekst.\n- Strategie- en clusterbepaling: welke zoekwoorden en pagina's passen bij wat dit bedrijf wil zijn.\nHoe beter dit profiel, hoe scherper alle adviezen en teksten. Vul het één keer goed in (of laat het opstellen met de knoppen hieronder) en werk het bij wanneer de klant zijn koers wijzigt. Het profiel bestaat uit drie delen: het klantprofiel en de tone-of-voice kun je automatisch laten genereren; het derde deel is jullie eigen kennis over de klant (afspraken, voorkeuren, no-go's), die vul je zelf aan."} /></span>
        <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Wat is het klantprofiel en waar wordt het gebruikt?" text={"Het klantprofiel is de vaste briefing over deze klant: wie het bedrijf is, wat het aanbiedt, voor wie (doelgroep en hun twijfels), het werkgebied (lokaal, regionaal of landelijk), de positionering (prijs, kwaliteit, exclusief, duurzaam) en de tone of voice. Het is het geheugen dat de AI bij ELKE actie voor deze klant meekrijgt.\nHet profiel wordt automatisch gebruikt door:\n- De strategie-chat per pagina (stap 1): het advies houdt rekening met positionering en werkgebied; is het profiel leeg, dan gaat de chat er eerst naar vragen.\n- De documenten (analyse, blauwdruk en copy): de teksten klinken naar dit bedrijf in plaats van als generieke AI-tekst.\n- Strategie- en clusterbepaling: welke zoekwoorden en pagina's passen bij wat dit bedrijf wil zijn.\nHoe beter dit profiel, hoe scherper alle adviezen en teksten. Vul het één keer goed in (of laat het opstellen met de knoppen hieronder) en werk het bij wanneer de klant zijn koers wijzigt. Het profiel bestaat uit drie delen: het klantprofiel en de tone-of-voice kun je automatisch laten genereren; het derde deel is jullie eigen kennis over de klant (afspraken, voorkeuren, no-go's), die vul je zelf aan."} /></span>
      </div>
      {profileOpen && (
      <div className="client-profile-body">
      <div className="profile-gen-buttons">
      <button type="button" className={"pcd-btn" + (genBusy === "profile" ? " busy" : "")} onClick={() => generateProfile("profile")} disabled={!!genBusy}>{genBusy === "profile" ? "Klantprofiel opstellen…" : made.profile ? "Klantprofiel gemaakt ✓" : "Klantprofiel opstellen"}</button>
      <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Wat gebeurt er bij 'Klantprofiel opstellen'?" text={"Deze knop laat de AI de LIVE website van de klant lezen (homepage plus de belangrijkste pagina's) en daaruit een compleet klantprofiel opstellen. Dat gaat in vier stappen:\n- De AI leest de site en destilleert daaruit: wie het bedrijf is, het aanbod en de diensten, de doelgroep en hun vragen of twijfels, het werkgebied en de positionering (waarin onderscheidt dit bedrijf zich).\n- Het resultaat komt als concept in het veld 'Uit klantprofiel' hieronder te staan. Je kunt het daar gewoon nalezen en aanpassen; het is een vertrekpunt, geen eindstation.\n- Er wordt een net opgemaakt Pingwin-document van gemaakt, dat in de gekozen Drive-klantmap komt (of als download als er geen map of Drive-koppeling is).\n- Het verschijnt als afgeronde werkzaamheid in de takenlijst én op het klantdashboard, zodat de klant ziet dat dit werk gedaan is.\nHet profiel wordt daarna automatisch gebruikt door alle chats, analyses en documenten voor deze klant (zie het vraagteken bij 'Klantprofiel' hierboven). Draait op de achtergrond en kost een klein beetje Claude-tegoed; je kunt hem later gewoon opnieuw draaien als de site wezenlijk verandert."} /></span>
      <button type="button" className={"pcd-btn" + (genBusy === "tov" ? " busy" : "")} onClick={() => generateProfile("tov")} disabled={!!genBusy}>{genBusy === "tov" ? "Tone-of-voice analyseren…" : made.tov ? "Tone-of-voice gemaakt ✓" : "Tone-of-voice analyse"}</button>
      <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Wat gebeurt er bij 'Tone-of-voice analyse'?" text={"Deze knop laat de AI de bestaande teksten op de live website analyseren op schrijfstijl: hoe klinkt dit bedrijf?\n- De AI kijkt naar aanspreekvorm (je/u), toon (zakelijk, warm, nuchter, speels), zinslengte en woordkeuze, hoe claims worden onderbouwd, en wat het bedrijf juist NIET zegt.\n- Het resultaat komt als apart tone-of-voice-blok in het klantprofiel-veld te staan (onder de kop 'Tone of voice'), naast het inhoudelijke profiel; je kunt het nalezen en bijstellen.\n- Er wordt een Pingwin-document van gemaakt in de Drive-klantmap (of als download) en een afgeronde werkzaamheid in de takenlijst en het klantdashboard.\nWaarom dit belangrijk is: de copy-stap (stap 3) en alle andere teksten die de AI voor deze klant schrijft, volgen deze tone-of-voice. Zo klinken nieuwe teksten als de klant zelf en niet als een willekeurige tekstrobot, en blijft de site consistent als meerdere mensen eraan werken. Draait op de achtergrond; opnieuw draaien mag altijd."} /></span>
      <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>Leest de live site, zet een concept in het veld en maakt er een Pingwin-document + taak van.</span>
      </div>
      <div className="page-chat-drive" style={{ marginBottom: "var(--s-2)" }}>
      <span className="pcd-label">Documenten opslaan in:</span>
      {driveFolder
      ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
      : <span className="pcd-folder muted">nog geen Drive-map (zonder map worden ze in je hoofdmap gezet)</span>}
      <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Klantmap wijzigen" : "Kies klantmap"}</button>
      </div>
      {genErr && <div className="login-error" style={{ marginBottom: "var(--s-2)" }}>{genErr}</div>}
      {genMsg && <div className="saved-msg" style={{ marginBottom: "var(--s-2)" }}>{genMsg}</div>}
      {(["profile", "tov"] as const).map((k) => made[k] && (
      <div key={k} className="profile-made-note">
      {k === "profile" ? "Klantprofiel-document" : "Tone-of-voice-document"} gemaakt en als taak toegevoegd (zichtbaar in Werkzaamheden en de klantdash).
      {made[k].link ? <> <a href={made[k].link} target="_blank" rel="noreferrer">Open document</a>.</> : made[k].driveError ? <> <span className="muted">Nog geen deelbare link: {made[k].driveError}</span></> : null}
      </div>
      ))}

      {/* De twee gegenereerde delen als toggle, standaard dicht. */}
      <div className="profile-part acc-teal">
      <button type="button" className="profile-part-head" style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", width: "100%", background: "none", border: "none", padding: "var(--s-0)", cursor: "pointer", textAlign: "left" }} onClick={() => setGenPartOpen((o) => ({ ...o, profile: !o.profile }))}>
      <span>{genPartOpen.profile ? "▾" : "▸"}</span> Klantprofiel (automatisch gegenereerd)
      {!parts.profileMd && <span className="plan-chip" style={{ marginLeft: "var(--s-2)" }}>leeg</span>}
      </button>
      {genPartOpen.profile && (parts.profileMd
      ? <div className="md profile-part-body" dangerouslySetInnerHTML={{ __html: mdToHtml(parts.profileMd.replace(/^##[^\n]*\n?/, ""), domain) }} />
      : <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Nog niet opgesteld. Klik &ldquo;Klantprofiel opstellen&rdquo; hierboven.</div>)}
      </div>

      <div className="profile-part acc-blue">
      <button type="button" className="profile-part-head" style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", width: "100%", background: "none", border: "none", padding: "var(--s-0)", cursor: "pointer", textAlign: "left" }} onClick={() => setGenPartOpen((o) => ({ ...o, tov: !o.tov }))}>
      <span>{genPartOpen.tov ? "▾" : "▸"}</span> Tone of voice (automatisch gegenereerd)
      {!parts.tovMd && <span className="plan-chip" style={{ marginLeft: "var(--s-2)" }}>leeg</span>}
      </button>
      {genPartOpen.tov && (parts.tovMd
      ? <div className="md profile-part-body" dangerouslySetInnerHTML={{ __html: mdToHtml(parts.tovMd.replace(/^##[^\n]*\n?/, ""), domain) }} />
      : <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Nog niet opgesteld. Klik &ldquo;Tone-of-voice analyse&rdquo; hierboven.</div>)}
      </div>

      <div className="profile-part acc-taupe">
      <div className="profile-part-head">Jouw know-how over de klant</div>
      <textarea
      className="client-profile-area"
      value={parts.knowhow}
      onChange={(e) => changeKnowhow(e.target.value)}
      placeholder="Wat weet jij zelf over deze klant? Bv. werkgebied (regionaal Uden/Oss/Den Bosch, of landelijk), positionering (prijs / exclusieve designtuinen / duurzaam), doelgroep, belangrijkste diensten, afspraken. De chat gebruikt dit samen met de twee analyses hierboven als context."
      />
      </div>
      </div>
      )}
    </>
  );

  // De tab Klantgegevens toont alleen dit blok. Bewust dezelfde code en niet een
  // tweede scherm ernaast: twee versies van hetzelfde veld lopen gegarandeerd uit
  // elkaar, en dat is in dit dashboard al vaker misgegaan.
  if (alleenProfiel) {
    return (
      <div className="cockpit-card acc-teal client-profile-card">
        {profielBlok}
      </div>
    );
  }

  return (
    <div className="pages-panel">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Pagina&rsquo;s ({urls.length}) <HelpHint xl title="Pagina's: de spiegel van de live site" text={"Dit is de complete werkomgeving per pagina: elke rij is een echte, live pagina van de klant, en openklikken geeft de zes stappen (strategie tot en met structured data) voor precies die pagina.\n## Waar de lijst vandaan komt\n'**Website inlezen**' leest de sitemap van de site en controleert elke pagina live op status en titel (automatische tag- en filterpagina's van webshopsystemen worden overgeslagen). Daarnaast worden per pagina de Search Console-cijfers (klikken, vertoningen, positie) en het beste zoekwoord met Ahrefs-volume erbij gezet.\n## De kolommen die het werk sturen\n- **Kans** rekent per pagina uit waar het meeste te winnen valt: veel vertoningen met een positie net buiten de top (11-20) is een grote kans, positie 4-10 een quick win. Sorteer hierop en werk van boven naar beneden.\n- **Ster** = prioriteit; gedeeld met de KPI's- en Wijzigingen-tab.\n- **Plan** toont of er al een vastgelegde strategie ligt (leeg, half plan uit een doorgegeven advies, of plan).\n## Eén principe om te onthouden\nDeze lijst is de **werkelijkheid van nu**. Het toekomstige adres van een pagina (een redirect of een nieuwe pagina) leeft in het plan en in de taken, niet in deze lijst; pas als het live staat, verschijnt het hier bij de volgende scan."} /></span>
          <span style={{ display: "inline-flex", gap: "var(--s-2)", alignItems: "center" }}>
            <input
              className="pages-search"
              style={{ width: 240 }}
              placeholder="Website-adres, bijv. laatjeogenlaseren.nl"
              title="Het website-adres van de klant. Wordt opgeslagen zodra je op 'Website inlezen' klikt."
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
            <button type="button" className="pcd-btn" onClick={() => setImporting(true)}>Analyse importeren</button>
            <button type="button" className={"pcd-btn" + (inlezen.bezig ? " busy" : "")} onClick={scan} disabled={inlezen.bezig}>{inlezen.bezig ? "Inlezen…" : "Website inlezen"}</button>
            <button type="button" className={"pcd-btn" + (newPageOpen ? " active" : "")} onClick={() => setNewPageOpen((v) => !v)}>+ Nieuwe pagina</button>
          </span>
        </div>

        {(inlezen.bezig || inlezen.klus?.status === "vastgelopen") && (
          <div style={{ marginBottom: "var(--s-4)" }}>
            <Voortgang
              titel={inlezen.klus?.naam || "De site inlezen"}
              label={inlezen.klus?.label}
              stap={inlezen.klus?.stap}
              stappen={inlezen.klus?.stappen}
              sinds={inlezen.klus?.gestart}
              stil={inlezen.klus?.status === "vastgelopen"}
              actie={inlezen.klus?.status === "vastgelopen" ? { label: "Opnieuw proberen", onClick: () => { void scan(); } } : undefined}
            />
          </div>
        )}

        {newPageOpen && (
          <div className="new-page-form">
            <div className="muted" style={{ fontSize: "var(--fs-sm)", marginBottom: "var(--s-2)" }}>Voeg een pagina toe die nog niet bestaat (bijvoorbeeld een nieuwe dienst of locatie). Er is nog geen Search Console-data, maar je kunt er wel meteen een plan, blauwdruk en copywriting voor maken.</div>
            <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", alignItems: "center" }}>
              <input className="pages-search" style={{ flex: "1 1 280px", minWidth: 220 }} placeholder="Pad of volledige URL, bijv. /nieuwe-dienst/" value={newPath} onChange={(e) => setNewPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPage(); }} />
              <input className="pages-search" style={{ flex: "1 1 220px", minWidth: 180 }} placeholder="Titel (optioneel)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPage(); }} />
              <button type="button" className={"pcd-btn" + (addingPage ? " busy" : "")} onClick={addPage} disabled={addingPage}>{addingPage ? "Toevoegen…" : "Toevoegen"}</button>
              <button type="button" className="ghost-btn small" onClick={() => { setNewPageOpen(false); setNewPath(""); setNewTitle(""); }}>Annuleren</button>
            </div>
          </div>
        )}
        {msg && <div className="saved-msg" style={{ marginBottom: "var(--s-3)" }}>{msg}</div>}

        <div className="profile-search-row profile-search-row-zoek">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
            {q.trim() && <span className="sov-sub" style={{ whiteSpace: "nowrap" }}>{filtered.length} van {urls.length}</span>}
            <input className="pages-search" placeholder="Zoek in URL of titel…" value={q} onChange={(e) => setQ(e.target.value)} />
          </span>
        </div>

        {loading && <div className="muted" style={{ marginTop: "var(--s-3)" }}>Pagina&rsquo;s laden…</div>}
        {!loading && urls.length === 0 && (
          <div className="muted" style={{ marginTop: "var(--s-3)" }}>Nog geen pagina&rsquo;s ingelezen. Klik &ldquo;Website inlezen&rdquo; (de klant moet een domein hebben).</div>
        )}

        {/* Volledigheid van de spiegel: een live pagina die niet in de sitemap
            staat is zelf een SEO-bevinding en mag niet stil wegvallen. De
            herkomst per pagina komt uit de verenigde scan (vier bronnen). */}
        {!loading && (() => {
          const buitenSitemap = urls.filter((u) => u.status != null && u.status >= 200 && u.status < 300 && u.bronnen.length > 0 && !u.bronnen.includes("sitemap"));
          if (!buitenSitemap.length) return null;
          return (
            <div className="muted" style={{ marginTop: "var(--s-3)" }}>
              {buitenSitemap.length === 1 ? "1 pagina staat" : `${buitenSitemap.length} pagina's staan`} live maar niet in de sitemap
              (gevonden via Search Console, Ahrefs of interne links); zie het label &ldquo;niet in sitemap&rdquo; in de lijst,
              of open de <a href={`/admin/client/${slug}/sitemap`} target="_blank" rel="noreferrer">sitemap-check</a> voor het hele verhaal.
            </div>
          );
        })()}

        {!loading && filtered.length > 0 && (
          <div className="res-table-wrap pages-table-wrap" style={{ marginTop: "var(--s-3)" }}>
            <table className="res-table pages-table">
              <thead><tr>
                <th className="pg-sort" onClick={() => setSortKey("prio")} title="Sorteer op prioriteit: sterretjes bovenaan, dan pagina's met een plan, dan op kans">★{sortKey === "prio" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("status")}>Status{sortKey === "status" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("pagina")} title="Sorteer alfabetisch op URL">Pagina{sortKey === "pagina" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("klikken")}>Klikken{sortKey === "klikken" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("vertoningen")}>Vertoningen{sortKey === "vertoningen" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("positie")}>Positie{sortKey === "positie" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("volume")} title="Zoekvolume van het hoofdzoekwoord (meeste vertoningen)">Volume{sortKey === "volume" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("kans")} title="Veel vertoningen + positie net buiten de top 10 = grote kans">Kans{sortKey === "kans" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("fases")} title={`De zeven fases van deze pagina: ${PG_FASEN.map((f) => f.label.toLowerCase()).join(", ")}.\nGroen = gedaan, oranje randje = de eerstvolgende stap. Wijs een rijtje aan om te zien welke fase welke is. Klik om te sorteren op hoe ver een pagina is.`}>Fases{sortKey === "fases" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("plan")} title="Sorteer op plan-status: vol plan eerst, dan half plan, dan leeg">Plan{sortKey === "plan" ? " ▾" : ""}</th>
                <th title="Zet deze pagina als projectkaart in de weekplanning van deze week, met de fases en de pagina-context erin.">Planning</th>
              </tr></thead>
              <tbody>
                {sorted.map((u) => (
                  <PageRow key={u.url} slug={slug} u={u} opp={oppOf(u)} fases={phaseOf(u)} open={open === u.url} onToggle={() => setOpen(open === u.url ? null : u.url)} clientEmail={clientEmail || ""} clientName={clientName || ""} onGoToTask={onGoToTask} onDataChanged={() => load(true)} isPrio={priority.has(prioKey(u.url))} onTogglePriority={() => togglePriority(u.url)} inPlanning={gepland.has(urlKey(u.url))} onGepland={() => laadPlanning()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {importing && (
        <ImportAnalysis
          slug={slug}
          onClose={() => setImporting(false)}
          onDone={() => { setMsg("Analyse overgenomen: plan-alinea's en taken aangemaakt."); load(); }}
        />
      )}

      {pickerOpen && (
        <div className="compose-overlay">
          <div className="compose-modal drive-modal">
            <div className="compose-head"><span>Kies de Google Drive-klantmap</span><button type="button" className="chat-float-close" onClick={() => setPickerOpen(false)}>&times;</button></div>
            <div className="compose-body">
              <div className="drive-crumbs">
                {stack.map((f, i) => (
                  <span key={f.id}>
                    <button type="button" className="drive-crumb" onClick={() => jumpTo(i)}>{f.name}</button>
                    {i < stack.length - 1 && <span className="drive-sep"> / </span>}
                  </span>
                ))}
              </div>
              {pickErr && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{pickErr}</div>}
              <div className="drive-list">
                {pickBusy && <div className="muted" style={{ padding: "var(--s-2)" }}>Laden…</div>}
                {!pickBusy && folders.length === 0 && <div className="muted" style={{ padding: "var(--s-2)" }}>Geen submappen hier. Kies deze map, of maak een nieuwe submap.</div>}
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
              <button type="button" className="primary-btn small" onClick={chooseCurrent} disabled={pickBusy}>Kies &ldquo;{stack[stack.length - 1].name}&rdquo;</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PageOpp = { impressions: number; clicks: number; ctr: number; position: number; bestKeyword: string; bestPosition: number | null; bestVolume: number | null; score: number; label: string; level: string };
function PageRow({ slug, u, opp, fases, open, onToggle, clientEmail, clientName, onGoToTask, onDataChanged, isPrio, onTogglePriority, inPlanning, onGepland }: { slug: string; u: ClientUrl; opp?: PageOpp; fases?: Partial<Record<FaseKey, boolean>>; open: boolean; onToggle: () => void; clientEmail: string; clientName: string; onGoToTask?: (taskId: number) => void; onDataChanged?: () => void; isPrio?: boolean; onTogglePriority?: () => void; inPlanning?: boolean; onGepland?: () => void }) {
  const [plan, setPlan] = useState(u.plan);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [tasks, setTasks] = useState<{ id: number | null; taak: string; fase: string; wie: string; status: string; docLink?: string; stepKind?: string }[]>([]);
  const [cleaning, setCleaning] = useState(false);
  // Tweede uitklap: alle zoekwoorden waar deze pagina nu op scoort (Search Console).
  const [kwOpen, setKwOpen] = useState(false);
  const [kws, setKws] = useState<{ keyword: string; clicks: number; impressions: number; position: number; volume: number | null }[] | null>(null);
  // Sortering van de zoekwoorden-uitklap; positie sorteert oplopend (laag = goed).
  const [kwSort, setKwSort] = useState<"klikken" | "vertoningen" | "positie" | "volume">("klikken");
  const [planBusy, setPlanBusy] = useState(false);

  // Deze pagina als volwaardige projectkaart in de weekplanning van deze week.
  // De kaarttekst gaat door dezelfde bouwer als de kaarten uit een gesprek
  // (lib/weekplan-kaarttekst.ts), zodat "Waarom deze pagina", "Aanpak en
  // afspraken" en de fase-sturing gevuld zijn in plaats van leeg.
  async function naarPlanning() {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const pad = (() => { try { return new URL(u.url).pathname; } catch { return u.url; } })();
      const kw = opp?.bestKeyword || "";
      const pos = opp?.bestPosition ?? (opp?.position ? Math.round(opp.position) : null);
      const achtergrond: string[] = [];
      if (opp?.label) achtergrond.push(`${opp.label}${kw ? ` op "${kw}"` : ""}${pos ? `, nu positie ${pos}` : ""}.`);
      if (opp && opp.impressions > 0) achtergrond.push(`${opp.impressions.toLocaleString("nl-NL")} vertoningen en ${opp.clicks.toLocaleString("nl-NL")} klikken in de laatste periode${opp.bestVolume != null ? `; zoekvolume ${opp.bestVolume.toLocaleString("nl-NL")} per maand` : ""}.`);
      // Bewust GEEN vulzin als er niets te melden is. "Nog geen Search
      // Console-data" en "nog geen vastgelegde strategie" stonden hier als vaste
      // regels, dus een kaart zonder cijfers kreeg gegarandeerd een blok
      // "Waarom deze pagina" waar niets in stond wat je niet al wist. Geen
      // reden betekent nu: geen blok.
      const toelichting = kaartTekst({
        achtergrond,
        fases: faseVoorstel({ zoekwoord: kw, positie: pos, doel: pos && pos > 3 ? 3 : null, pad }),
      });
      await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak: `Pagina oppakken: ${pad}`, url: u.url, week: 1, wie: "SEO", taaktype: "pijplijn", thread: "paginas", toelichting }),
      });
      onGepland?.();
    } catch { /* stil; de knop kan opnieuw */ }
    finally { setPlanBusy(false); }
  }

  async function toggleKeywords() {
    const next = !kwOpen;
    setKwOpen(next);
    if (!next || kws !== null) return;
    try {
      const r = await fetch(`/api/admin/page-keywords?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(u.url)}`);
      const d = await r.json();
      setKws(d.ok ? (d.keywords || []) : []);
    } catch { setKws([]); }
  }

  async function loadTasks() {
    try {
      const r = await fetch(`/api/admin/page-tasks?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(u.url)}`);
      const d = await r.json();
      if (d.ok) { setTasks(d.tasks || []); try { localStorage.setItem(`pw_ptasks_${slug}_${u.url}`, JSON.stringify(d.tasks || [])); } catch { /* cache is extra */ } }
    } catch { /* stil */ }
  }
  // Cache-first bij openklappen: toon de vorige taken direct, ververs daarna.
  useEffect(() => {
    if (!open) return;
    try { const c = localStorage.getItem(`pw_ptasks_${slug}_${u.url}`); if (c) { const p = JSON.parse(c); if (Array.isArray(p)) setTasks(p); } } catch { /* geen cache */ }
    loadTasks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open]);

  async function cleanupLoose() {
    if (cleaning) return;
    setCleaning(true);
    try {
      await fetch(`/api/admin/page-tasks?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(u.url)}`, { method: "DELETE" });
      await loadTasks();
    } catch { /* stil */ } finally { setCleaning(false); }
  }

  // Gerenderde, bewerkbare plan-preview (contentEditable), geen ruwe textarea. Het plan
  // kan markdown zijn (van de chat) of al bewerkte HTML; render de juiste.
  const planRef = useRef<HTMLDivElement | null>(null);
  const renderPlanHtml = (p: string) => (/<\/[a-z][a-z0-9]*>/i.test(p) && !/(^|\n)#{1,6}\s|\*\*[^*]|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|\|[^|]*\|/.test(p) ? p : mdToHtml(p, (u.url.match(/^https?:\/\/[^/]+/i) || [""])[0]));
  useEffect(() => {
    if (editing && planRef.current) planRef.current.innerHTML = renderPlanHtml(plan || "");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [editing]);
  function savePlan() {
    const html = (planRef.current?.innerHTML || "").trim();
    setPlan(html); setSaved(false); setEditing(false);
    fetch("/api/admin/page-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: u.url, plan: html }) }).then(() => setSaved(true)).catch(() => {});
  }

  return (
    <>
      <tr id={rowDomId(u.url)} className={"pages-row" + (open ? " open" : "")} onClick={onToggle}>
        <td className="pages-prio-cell" onClick={(e) => e.stopPropagation()}>
          <span className={"wz-star" + (isPrio ? " on" : "")} title={isPrio ? "Prioriteit aan, klik om uit te zetten" : "Markeer als prioriteit (komt bovenaan)"} onClick={onTogglePriority}>{isPrio ? "★" : "☆"}</span>
        </td>
        <td>{statusBadge(u.status, u.redirectTarget)}</td>
        <td>
          <a href={u.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{shortUrl(u.url)}</a>
          {u.status != null && u.status >= 200 && u.status < 300 && u.bronnen.length > 0 && !u.bronnen.includes("sitemap") && (
            <span className="plan-chip half" style={{ marginLeft: "var(--s-2)" }}
              title={`Deze pagina staat live maar niet in de sitemap; gevonden via ${u.bronnen.map((b) => b === "gsc" ? "Search Console" : b === "ahrefs" ? "Ahrefs" : b === "links" ? "interne links" : b).join(", ")}. Voor Google is hij daardoor slechter vindbaar: opnemen in de sitemap, of bewust opruimen.`}>
              niet in sitemap
            </span>
          )}
          {opp?.bestKeyword && <div className="pg-kw" title="Beste zoekwoord (meeste vertoningen), met zoekvolume en huidige positie">{opp.bestKeyword}{opp.bestVolume != null ? ` · vol ${opp.bestVolume.toLocaleString("nl-NL")}` : ""}{opp.bestPosition != null ? ` / pos ${opp.bestPosition}` : ""}</div>}
        </td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); void toggleKeywords(); }}
              title="Alle zoekwoorden en posities waar deze pagina nu op scoort (Search Console, 90 dagen)"
              style={{ border: "1px solid var(--border)", background: kwOpen ? "var(--orange-light)" : "var(--white)", borderRadius: "var(--r-sm)", cursor: "pointer", padding: "var(--s-1) var(--s-2)", fontSize: "var(--fs-xs)", color: "var(--gray)", flex: "0 0 auto" }}>
              {kwOpen ? "▾" : "▸"} zw
            </button>
            {opp && opp.clicks > 0 ? opp.clicks.toLocaleString("nl-NL") : (u.gscClicks > 0 ? u.gscClicks.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>)}
          </div>
        </td>
        <td>{opp && opp.impressions > 0 ? opp.impressions.toLocaleString("nl-NL") : (u.gscImpressions > 0 ? u.gscImpressions.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>)}</td>
        <td>{opp && opp.position ? opp.position : <span className="muted">&mdash;</span>}</td>
        <td>{opp?.bestVolume != null ? opp.bestVolume.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>}</td>
        <td>{opp?.label ? <span className={"pg-kans " + opp.level}>{opp.label}</span> : <span className="muted">&mdash;</span>}</td>
        <td className="pg-fases-cell"><FaseRail f={fases} /></td>
        <td>{(plan || "").trim()
          ? <span className="plan-chip has">plan</span>
          : u.hasClusterAdvice
            ? <span className="plan-chip half" title="Half plan: al meegewogen in de strategie van een andere pagina, nog niet zelf afgerond.">half plan</span>
            : <span className="plan-chip">leeg</span>}</td>
        <td className="pg-plan-cell" onClick={(e) => e.stopPropagation()}>
          {inPlanning
            ? <span className="plan-chip has" title="Deze pagina staat al als kaart in de weekplanning.">in planning</span>
            : <button type="button" className="pg-planknop" disabled={planBusy} title="Zet deze pagina als projectkaart in de weekplanning van deze week, met de fases en de pagina-context erin." onClick={() => void naarPlanning()}>{planBusy ? "…" : "+ planning"}</button>}
        </td>
      </tr>
      {kwOpen && (
        <tr className="pages-detail-row">
          <td colSpan={11}>
            <div className="pages-detail" style={{ padding: "var(--s-3) var(--s-4)" }}>
              {kws === null && <div className="muted">Zoekwoorden laden uit Search Console&hellip;</div>}
              {kws !== null && kws.length === 0 && <div className="muted">Geen zoekwoorden gevonden voor deze pagina (of Search Console heeft nog geen data).</div>}
              {kws !== null && kws.length > 0 && (
                <table className="res-table" style={{ maxWidth: 860 }}>
                  <thead><tr>
                    <th>Zoekwoord</th>
                    <th className="pg-sort" onClick={() => setKwSort("positie")}>Positie{kwSort === "positie" ? " ▾" : ""}</th>
                    <th className="pg-sort" onClick={() => setKwSort("klikken")}>Klikken{kwSort === "klikken" ? " ▾" : ""}</th>
                    <th className="pg-sort" onClick={() => setKwSort("vertoningen")}>Vertoningen{kwSort === "vertoningen" ? " ▾" : ""}</th>
                    <th className="pg-sort" onClick={() => setKwSort("volume")} title="Maandelijks zoekvolume (Ahrefs)">Volume{kwSort === "volume" ? " ▾" : ""}</th>
                  </tr></thead>
                  <tbody>
                    {[...kws].sort((a, b) =>
                      kwSort === "positie" ? (a.position || 999) - (b.position || 999)
                        : kwSort === "vertoningen" ? b.impressions - a.impressions
                          : kwSort === "volume" ? (b.volume || 0) - (a.volume || 0)
                            : (b.clicks - a.clicks) || (b.impressions - a.impressions),
                    ).map((k, i) => (
                      <tr key={i}>
                        <td>{k.keyword}</td>
                        <td>{k.position ? Math.round(k.position * 10) / 10 : "—"}</td>
                        <td>{k.clicks.toLocaleString("nl-NL")}</td>
                        <td>{k.impressions.toLocaleString("nl-NL")}</td>
                        <td>{k.volume != null ? k.volume.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
      {open && (
        <tr className="pages-detail-row">
          <td colSpan={11}>
            <div className="pages-detail">
              {/* Het paginadossier bovenaan: wat er speelt, met de mails en
                  documenten erbij. Zelfde blok als op de kaart in de weekplanning
                  en op de voorgestelde taak in de chat. */}
              <PaginaDossier slug={slug} url={u.url} />

              {(() => {
                // Een taak hoort bij de pijplijn (blijft staan) als hij een stap-kenmerk
                // heeft, een gekoppeld document, of een link in de titel (de analyse/
                // blauwdruk/copy/strategie-documenten). Alleen een echt los subtaakje
                // (platte tekst zonder document) is "oude werkwijze" en mag opgeruimd.
                const isDoc = (t: { stepKind?: string; docLink?: string; taak: string }) =>
                  !!(t.stepKind || "").trim() || !!(t.docLink || "").trim() || /<a\s/i.test(t.taak || "");
                const loose = tasks.filter((t) => !isDoc(t));
                return (
                  <>
                    {loose.length > 0 && (
                      <div className="page-tasks-cleanup">
                        Er staan nog {loose.length} losse taken van de oude werkwijze bij deze pagina. Die horen nu in het plan, niet als aparte werkzaamheden. Kijk hieronder wat erin staat, zet over wat je wilt bewaren in het plan, en ruim dan op.
                        <ul className="page-tasks-list" style={{ marginTop: "var(--s-2)" }}>
                          {loose.map((t, i) => (
                            <li key={t.id ?? i} className="page-task">
                              {t.wie && <span className={"pt-wie" + (t.wie === "Dev" ? " dev" : "")}>{t.wie}</span>}
                              <span className="pt-taak" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.taak) }} />
                              {t.status && <span className="pt-status">{t.status}</span>}
                            </li>
                          ))}
                        </ul>
                        <button type="button" className="ghost-btn small" style={{ marginTop: "var(--s-2)" }} onClick={cleanupLoose} disabled={cleaning}>{cleaning ? "Opruimen…" : `Opruimen (${loose.length})`}</button>
                      </div>
                    )}
                  </>
                );
              })()}

              <PageChat
                slug={slug} url={u.url} clientEmail={clientEmail} clientName={clientName}
                onApplied={(newPlan) => { if (newPlan) setPlan(newPlan); loadTasks(); }}
                onGoToTask={onGoToTask} onClusterApplied={onDataChanged} pageLive={u.status === 200}
                planDone={!!(plan || "").trim()}
                planSlot={
                  // De vastgelegde strategie (het plan) hoort bij stap 1 en staat
                  // bovenin het strategie-blok; de chat eronder werkt ernaartoe.
                  <div className={"pages-plan-inline" + ((plan || "").trim() ? " done" : "")} style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--orange)", borderRadius: "var(--r-md)", padding: "var(--s-3) var(--s-4)", marginBottom: "var(--s-3)", background: "var(--white)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap", marginBottom: "var(--s-2)" }}>
                      <strong style={{ fontSize: "var(--fs-sm)" }}>Vastgelegde strategie (de conclusie van deze stap)</strong>
                      {!(plan || "").trim() && <span className="plan-chip">nog geen strategie</span>}
                      {saved && <span className="focus-save-status">opgeslagen</span>}
                      <span style={{ marginLeft: "auto" }}><button type="button" className="ghost-btn small" onClick={() => { if (editing) savePlan(); else setEditing(true); }}>{editing ? "Klaar" : "Bewerken"}</button></span>
                    </div>
                    {editing ? (
                      <div ref={planRef} className="pages-plan-edit md" contentEditable suppressContentEditableWarning />
                    ) : (
                      (plan || "").trim()
                        ? <div className="pages-plan-view md" dangerouslySetInnerHTML={{ __html: renderPlanHtml(plan) }} />
                        : <div className="pages-plan-view muted">Nog geen strategie vastgelegd. Werk hem uit in de chat hieronder en klik &ldquo;Vat samen &amp; leg strategie vast&rdquo;, of klik Bewerken om hem zelf te typen.</div>
                    )}
                    {u.redirectTarget && <div className="muted" style={{ marginTop: "var(--s-2)" }}>Live redirect: → <a href={u.redirectTarget} target="_blank" rel="noreferrer">{u.redirectTarget}</a></div>}
                  </div>
                }
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

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

export default function PageChat({ slug, url, clientEmail, clientName, onApplied, onGoToTask, onClusterApplied, pageLive }: { slug: string; url: string; clientEmail?: string; clientName?: string; onApplied: (plan?: string) => void; onGoToTask?: (taskId: number) => void; onClusterApplied?: () => void; pageLive?: boolean }) {
  // Site-URL van de klant (uit de pagina-URL), zodat slugs als /lensimplantatie/
  // in alle gerenderde teksten klikbaar naar de live pagina linken.
  const siteBase = (url.match(/^https?:\/\/[^/]+/i) || [""])[0];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  // Of het gesprek van de actieve chat uitgeklapt is (toggle in de lijst).
  const [convoOpen, setConvoOpen] = useState(false);
  // De chat-kaart in/uitklappen: je maakt hem een keer, dus zodra de strategie is
  // vastgelegd staat hij standaard dicht (scheelt scrollen).
  const [chatOpen, setChatOpen] = useState(false);
  // Elke stap is een inklapbare, genummerde kaart (toggle).
  const [doorgevenOpen, setDoorgevenOpen] = useState(false);
  const [vervolgOpen, setVervolgOpen] = useState(false);
  const [canniOpen, setCanniOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
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
  // Per-stap "klaar"-status (groene knop), per pagina onthouden en gevoed door de run.
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>({});
  const allStepsDone = !!(stepsDone.analyse && stepsDone.blauwdruk && stepsDone.copy);
  // Per-pagina cannibalisatie- + content-mapping-analyse (achtergrond).
  const [pc, setPc] = useState<{ status: string; result: string; error: string; updatedAt: string | null } | null>(null);
  const [pcBusy, setPcBusy] = useState(false);
  const [pcOpen, setPcOpen] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState(""); // alleen foutmeldingen
  // Resultaat van "Aanbevelingen overnemen"; blijft staan (browseropslag) na herladen.
  const [applyInfo, setApplyInfo] = useState<{ doc: boolean; urls: string[]; counts?: { executed: number; deferred: number; rejected: number; tasked: number; unreviewed: number } } | null>(null);
  const [canniDone, setCanniDone] = useState(false); // stap 5 afgerond (aanbevelingen overgenomen)
  // Per-pagina interne-links-analyse (stap 6, achtergrond) — spiegelt de cannibalisatiestap.
  const [il, setIl] = useState<{ status: string; result: string; error: string; updatedAt: string | null } | null>(null);
  const [ilBusy, setIlBusy] = useState(false);
  const [ilDocOpen, setIlDocOpen] = useState(true);
  async function loadIl() {
    try {
      const d = await fetch(`/api/admin/page-internal-links?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d.ok) setIl({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  useEffect(() => { loadIl(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, url]);
  useEffect(() => {
    if (il?.status !== "running") return;
    const t = setInterval(loadIl, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [il?.status, slug, url]);
  async function runIl() {
    if (ilBusy || il?.status === "running") return;
    setIlBusy(true);
    setIl((s) => (s ? { ...s, status: "running", error: "" } : { status: "running", result: "", error: "", updatedAt: null }));
    try {
      const d = await fetch("/api/admin/page-internal-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await loadIl(); return; }
      setLinksOpen(true);
      await loadIl();
    } catch { setErr("Starten mislukt."); await loadIl(); } finally { setIlBusy(false); }
  }
  // "Overnemen" bij stap 6: document in de Drive-map + Dev-taak (spiegelt stap 5).
  const [ilApplyBusy, setIlApplyBusy] = useState(false);
  const [ilApplyMsg, setIlApplyMsg] = useState(""); // alleen foutmeldingen
  const [ilApplyInfo, setIlApplyInfo] = useState<{ doc: boolean } | null>(null);
  const [ilDone, setIlDone] = useState(false); // stap 6 afgerond (aanbevelingen overgenomen)
  useEffect(() => {
    try {
      setIlDone(localStorage.getItem(`pw_ildone_${slug}_${url}`) === "1");
      const raw = localStorage.getItem(`pw_ilinfo_${slug}_${url}`);
      setIlApplyInfo(raw ? JSON.parse(raw) : null);
    } catch { /* geen opslag */ }
  }, [slug, url]);
  async function applyIl() {
    if (ilApplyBusy) return;
    setIlApplyBusy(true); setIlApplyMsg("");
    try {
      const d = await fetch("/api/admin/page-internal-links/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setIlApplyMsg(d.error || "Overnemen mislukt."); return; }
      const info = { doc: !!d.docLink };
      setIlApplyInfo(info);
      try { localStorage.setItem(`pw_ilinfo_${slug}_${url}`, JSON.stringify(info)); } catch { /* geen opslag */ }
      setIlDone(true); try { localStorage.setItem(`pw_ildone_${slug}_${url}`, "1"); } catch { /* geen opslag */ }
      onApplied();
    } catch { setIlApplyMsg("Overnemen mislukt."); } finally { setIlApplyBusy(false); }
  }
  // Stap 7: structured data (achtergrond-analyse + overnemen), spiegelt stap 6.
  const [sch, setSch] = useState<{ status: string; result: string; jsonld: string; warnings: string[]; error: string; updatedAt: string | null } | null>(null);
  const [schBusy, setSchBusy] = useState(false);
  const [schDocOpen, setSchDocOpen] = useState(true);
  const [schJsonOpen, setSchJsonOpen] = useState(false);
  const [schCopied, setSchCopied] = useState(false);
  async function loadSch() {
    try {
      const d = await fetch(`/api/admin/page-schema?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d.ok) setSch({ status: d.status, result: d.result, jsonld: d.jsonld, warnings: d.warnings || [], error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  useEffect(() => { loadSch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, url]);
  useEffect(() => {
    if (sch?.status !== "running") return;
    const t = setInterval(loadSch, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sch?.status, slug, url]);
  async function runSch() {
    if (schBusy || sch?.status === "running") return;
    setSchBusy(true);
    setSch((s2) => (s2 ? { ...s2, status: "running", error: "" } : { status: "running", result: "", jsonld: "", warnings: [], error: "", updatedAt: null }));
    try {
      const d = await fetch("/api/admin/page-schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await loadSch(); return; }
      setSchemaOpen(true);
      await loadSch();
    } catch { setErr("Starten mislukt."); await loadSch(); } finally { setSchBusy(false); }
  }
  async function copySchJson() {
    if (!sch?.jsonld) return;
    try { await navigator.clipboard.writeText(sch.jsonld); setSchCopied(true); setTimeout(() => setSchCopied(false), 2000); } catch { /* selecteer handmatig */ }
  }
  const [schApplyBusy, setSchApplyBusy] = useState(false);
  const [schApplyMsg, setSchApplyMsg] = useState("");
  const [schApplyInfo, setSchApplyInfo] = useState<{ doc: boolean } | null>(null);
  const [schDone, setSchDone] = useState(false);
  useEffect(() => {
    try {
      setSchDone(localStorage.getItem(`pw_schdone_${slug}_${url}`) === "1");
      const raw = localStorage.getItem(`pw_schinfo_${slug}_${url}`);
      setSchApplyInfo(raw ? JSON.parse(raw) : null);
    } catch { /* geen opslag */ }
  }, [slug, url]);
  async function applySch() {
    if (schApplyBusy) return;
    setSchApplyBusy(true); setSchApplyMsg("");
    try {
      const d = await fetch("/api/admin/page-schema/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setSchApplyMsg(d.error || "Overnemen mislukt."); return; }
      const info = { doc: !!d.docLink };
      setSchApplyInfo(info);
      try { localStorage.setItem(`pw_schinfo_${slug}_${url}`, JSON.stringify(info)); } catch { /* geen opslag */ }
      setSchDone(true); try { localStorage.setItem(`pw_schdone_${slug}_${url}`, "1"); } catch { /* geen opslag */ }
      onApplied();
    } catch { setSchApplyMsg("Overnemen mislukt."); } finally { setSchApplyBusy(false); }
  }
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
  // "Aanbevelingen overnemen": redirects + interne links als Dev-taak met document.
  // (Basisinfo doorzetten gebeurt per tabel-rij met de knop "Naar pagina's".)
  async function applyRec() {
    if (applyBusy) return;
    // Bevestigingsmoment: waarschuw als er nog onbeoordeelde voorstellen zijn;
    // die blijven buiten het document.
    const open = actionableRef.current.filter((p) => !rowStatus[p]);
    if (open.length && !window.confirm(`Let op: ${open.length} voorstel${open.length === 1 ? " is" : "len zijn"} nog niet beoordeeld (uitvoeren, naar pagina's of afwijzen). ${open.length === 1 ? "Dit voorstel blijft" : "Deze voorstellen blijven"} buiten het document. Toch doorgaan?`)) return;
    setApplyBusy(true); setApplyMsg("");
    try {
      const d = await fetch("/api/admin/page-cannibal/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setApplyMsg(d.error || "Overnemen mislukt."); return; }
      const info = { doc: !!d.docLink, urls: [] as string[], counts: { executed: Number(d.executed) || 0, deferred: Number(d.deferred) || 0, rejected: Number(d.rejected) || 0, tasked: Number(d.tasked) || 0, unreviewed: Number(d.unreviewed) || 0 } };
      setApplyInfo(info);
      try { localStorage.setItem(`pw_canniinfo_${slug}_${url}`, JSON.stringify(info)); } catch { /* geen opslag */ }
      setCanniDone(true); try { localStorage.setItem(`pw_cannidone_${slug}_${url}`, "1"); } catch { /* geen opslag */ }
      onApplied();
    } catch { setApplyMsg("Overnemen mislukt."); } finally { setApplyBusy(false); }
  }

  // ── 301-redirects per stuk uitvoeren in de WordPress-website (Redirection-plugin) ──
  // Gebruikt de bestaande WordPress-koppeling per klant (client_wp_creds, zelfde
  // als de bewerkingshistorie in Wijzigingen) + het klant-domein als site-URL.
  const [wpConf, setWpConf] = useState<{ configured: boolean; user: string } | null>(null);
  const [wpDone, setWpDone] = useState<Record<string, { verified: boolean }>>({});
  const [wpBusy, setWpBusy] = useState(""); // van-pad dat nu wordt doorgevoerd
  const [wpMsg, setWpMsg] = useState("");
  const [wpFormOpen, setWpFormOpen] = useState(false);
  const [wpForm, setWpForm] = useState({ user: "", pass: "" });
  const [wpSaving, setWpSaving] = useState(false);
  // Status per tabel-rij (pad → uitgevoerd/afgewezen/doorgezet), bewaard in de
  // database, plus de reden bij afwijzen (komt in het klantdocument).
  const [rowStatus, setRowStatusMap] = useState<Record<string, "uitgevoerd" | "afgewezen" | "doorgezet" | "taak">>({});
  const [rowReason, setRowReason] = useState<Record<string, string>>({});
  // Paden van rijen met een actie-voorstel (gevuld tijdens het renderen van de
  // tabel); gebruikt voor de "nog niet beoordeeld"-teller bij het bevestigen.
  const actionableRef = useRef<string[]>([]);
  // Per rij het 301-doel (uit de Doel-kolom), zodat ook de check-overlay weet
  // dat "Uitvoeren" daar een redirect is.
  const rowRedirectRef = useRef<Record<string, string>>({});
  // Afwijs-venstertje: welk pad wordt afgewezen + de ingevulde reden.
  const [rejectPath, setRejectPath] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // De redirect-regels ("- `/oud/` → `/nieuw/`") uit de cannibalisatie-analyse
  // halen; de paden staan tussen backticks. Interne-link-regels vallen af
  // doordat daar tekst achter staat (ankertekst).
  function parseRedirects(md: string): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    const seen = new Set<string>();
    for (const line of (md || "").split("\n")) {
      const m = line.match(/^\s*(?:[-*]\s*)?`?(\/[^\s`]*)`?\s*(?:→|->)\s*`?(\/[^\s`]*)`?\s*$/);
      if (m && !seen.has(m[1]) && m[1] !== m[2]) { seen.add(m[1]); out.push({ from: m[1], to: m[2] }); }
    }
    return out;
  }
  const wpRedirects = parseRedirects(pc?.result || "");

  // Het losse "301-redirects:"-lijstje uit de analysetekst halen: die informatie
  // staat al in de tabel (kolom Actie/Doel) en de knop komt in de tabel zelf.
  function stripRedirectList(md: string): string {
    const out: string[] = [];
    let skip = false;
    for (const line of (md || "").split("\n")) {
      if (!line.includes("|") && /301-redirects/i.test(line)) { skip = true; continue; }
      if (skip) {
        if (!line.trim() || /^\s*(?:[-*]\s*)?`?\//.test(line)) continue;
        skip = false;
      }
      out.push(line);
    }
    return out.join("\n");
  }

  const escAttr = (s: string) => s.replace(/"/g, "&quot;");

  // Knoppen per tabel-rij, in de Reden-kolom. Per actie-type:
  // - 301-rij: "Uitvoeren" voert de redirect door (Redirection-plugin) + live check.
  // - de-optimaliseren/intern-linken-rij: "Uitvoeren" opent de pagina in de
  //   WordPress-backend (bewerk-modus) en markeert de rij als uitgevoerd;
  //   "Naar pagina's" zet het advies klaar bij die pagina (Pagina's-tabblad)
  //   voor het moment dat je die pagina zelf aanpakt.
  // - "Afwijzen" zet de rij op afgewezen (grijs); herstel draait het terug.
  function rowButtonsHtml(rowPath: string, redirect: { from: string; to: string } | null, extra = ""): string {
    const status = rowStatus[rowPath];
    const busy = wpBusy === rowPath || (redirect ? wpBusy === redirect.from : false);
    if (status === "afgewezen") {
      const why = rowReason[rowPath] ? ` Reden: ${rowReason[rowPath]}` : "";
      return `<span class="canni-actions"><button type="button" class="pcd-btn wp-mini pcd-warn" data-act="restore" data-path="${escAttr(rowPath)}" title="${escAttr(`Deze rij is afgewezen.${why} Klik om dat terug te draaien.`)}">Afgewezen, herstel</button>${extra}</span>`;
    }
    if (status === "doorgezet") {
      return `<span class="canni-actions"><button type="button" class="pcd-btn wp-mini pcd-blue" data-act="restore" data-path="${escAttr(rowPath)}" title="Het advies staat klaar bij die pagina in het Pagina's-tabblad ('half plan'); je pakt het op wanneer je die pagina aanpakt. Klik om dit terug te draaien (haalt het advies daar ook weer weg).">→ Bij pagina's, herstel</button>${extra}</span>`;
    }
    if (status === "taak") {
      return `<span class="canni-actions"><button type="button" class="pcd-btn wp-mini pcd-purple" data-act="restore" data-path="${escAttr(rowPath)}" title="Voor deze rij staat een taak met werkdocument in Werkzaamheden. Klik om de rij-status terug te draaien (de taak zelf blijft bestaan).">✓ Taak gemaakt, herstel</button>${extra}</span>`;
    }
    const reject = `<button type="button" class="pcd-btn wp-mini wp-ghost" data-act="reject" data-path="${escAttr(rowPath)}" title="Wijs deze aanbeveling af; de rij wordt grijs.">Afwijzen</button>`;
    const maketask = `<button type="button" class="pcd-btn wp-mini wp-ghost-purple" data-act="maketask" data-path="${escAttr(rowPath)}"${busy ? " disabled" : ""} title="Voor groter werk dat op de kortetermijnplanning hoort: maakt een taak in Werkzaamheden met een werkdocument (met diepere duiding op echte GSC-data).">Taak maken</button>`;
    if (redirect) {
      const done = wpDone[redirect.from];
      const label = busy ? (done ? "Controleren…" : "Doorvoeren…") : done?.verified ? "✓ Uitgevoerd" : done ? "Opnieuw controleren" : "Uitvoeren";
      const cls = "pcd-btn wp-mini" + (done?.verified ? " pcd-done" : done ? " pcd-warn" : "");
      const title = done?.verified ? "301 staat in de website en is live gecontroleerd. Klik om opnieuw te controleren." : done ? "De redirect is doorgevoerd, maar de live-controle lukte nog niet. Klik om opnieuw te controleren." : wpConf?.configured ? "Zet deze 301-redirect via de Redirection-plugin in de website en controleer hem direct live." : "Koppel eerst WordPress (onder de tabel).";
      const dis = busy || (!wpConf?.configured && !done) ? " disabled" : "";
      return `<span class="canni-actions"><button type="button" class="${cls}" data-act="redirect" data-wpfrom="${escAttr(redirect.from)}" data-wpto="${escAttr(redirect.to)}" title="${escAttr(title)}"${dis}>${label}</button>${done?.verified ? "" : maketask + reject}${extra}</span>`;
    }
    const doneEdit = status === "uitgevoerd";
    const label = busy ? "Bezig…" : doneEdit ? "✓ Uitgevoerd" : "Uitvoeren";
    const cls = "pcd-btn wp-mini" + (doneEdit ? " pcd-done" : "");
    const title = doneEdit ? "Als uitgevoerd gemarkeerd. Klik om de pagina nogmaals in de WordPress-backend te openen." : wpConf?.configured ? "Opent deze pagina in de WordPress-backend (bewerk-modus), zodat je de aanpassing/interne link kunt doorvoeren. De rij wordt dan als uitgevoerd gemarkeerd." : "Koppel eerst WordPress (onder de tabel).";
    const dis = busy || (!wpConf?.configured && !doneEdit) ? " disabled" : "";
    const topage = `<button type="button" class="pcd-btn wp-mini wp-ghost-blue" data-act="topage" data-path="${escAttr(rowPath)}"${busy ? " disabled" : ""} title="Zet het advies van deze rij klaar bij die pagina in het Pagina's-tabblad ('half plan'), zodat je het meeneemt wanneer je die pagina aanpakt.">Naar pagina's</button>`;
    return `<span class="canni-actions"><button type="button" class="${cls}" data-act="edit" data-path="${escAttr(rowPath)}" title="${escAttr(title)}"${dis}>${label}</button>${doneEdit ? "" : topage + maketask + reject}${extra}</span>`;
  }

  // Tabel verrijken: korte kolomkoppen, "intern linken" vet, knoppen + check in
  // de Reden-cel, cannibalisatiescore ingekleurd, en afgewezen rijen grijs.
  function enrichCanniTable(html: string): string {
    let out = html
      .replace(/>\s*GSC\s*klik\s*</gi, ">klik<")
      .replace(/>\s*GSC\s*vert\s*</gi, ">vert<")
      .replace(/>\s*Verw\.?\s*dom(?:einen)?\s*</gi, ">RD<");
    // Positie van de Score-kolom uit de koprij (bestaat alleen bij nieuwe analyses).
    let scoreIdx = -1;
    const head = out.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
    if (head) scoreIdx = head[1].split("</th>").findIndex((h) => /score\s*$/i.test(h.replace(/<[^>]*>/g, "").trim()));
    // 9-koloms tabel (met Score) krijgt eigen kolombreedtes, anders wordt Reden platgedrukt.
    if (scoreIdx >= 0) out = out.replace('<table class="md-table">', '<table class="md-table canni-9">');
    const actionable: string[] = [];
    const redirects: Record<string, string> = {};
    out = out.replace(/<tr>((?:<td>[\s\S]*?<\/td>)+)<\/tr>/g, (row: string, inner: string) => {
      const cells = inner.split("</td>");
      const pathMatch = (cells[0] || "").match(/>(\/[^<]*)</);
      const rowPath = pathMatch ? pathMatch[1].trim() : "";
      if (!rowPath) return row;
      const redenIdx = cells.length - 2; // laatste echte cel (na de laatste </td> splitst een lege string af)
      if (redenIdx < 1) return row;
      cells[redenIdx] = cells[redenIdx].replace(/intern(?:e)?\s+link(?:en|s)?/gi, "<strong>$&</strong>");
      // Score inkleuren: rood = urgent (nu oplossen), oranje = middel, groen = kan later.
      if (scoreIdx > 0 && scoreIdx < redenIdx) {
        cells[scoreIdx] = cells[scoreIdx].replace(/>\s*(\d{1,3})\s*$/, (_m, n: string) => {
          const v = Number(n);
          const cls = v >= 70 ? "hi" : v >= 40 ? "mid" : "lo";
          return `><span class="canni-score canni-score-${cls}" title="Cannibalisatiescore 1-100: hoe hard deze pagina met deze landingspagina concurreert. 70+ = urgent, nu oplossen; 40-69 = middel; onder 40 = kan via 'Naar pagina's' later.">${n}</span>`;
        });
      }
      // Winnaar-rij (de geanalyseerde pagina zelf) krijgt geen actie-knoppen;
      // ALLE andere rijen wel, ongeacht de actie (301, de-optimaliseren,
      // canonical, behouden): Uitvoeren doet dan het passende (redirect of
      // backend openen) en Naar pagina's/Taak maken/Afwijzen kunnen altijd.
      const curPath = ((url || "").replace(/^https?:\/\/[^/]+/i, "") || "/").replace(/\/+$/, "");
      const isWinner = rowPath.replace(/\/+$/, "") === curPath || />\s*WINNAAR\s*</i.test(inner);
      // 301-doel direct uit de Actie/Doel-kolommen van de rij zelf (laatste drie
      // cellen zijn Actie, Doel, Reden); nieuwe analyses hebben geen los
      // redirect-lijstje meer.
      const actieCell = cells[redenIdx - 2] || "";
      const doelCell = cells[redenIdx - 1] || "";
      let redirect = wpRedirects.find((x) => x.from === rowPath) || null;
      if (!redirect && /301/.test(actieCell)) {
        const dm = doelCell.match(/>(\/[^<]*)</);
        if (dm && dm[1].trim() !== rowPath) redirect = { from: rowPath, to: dm[1].trim() };
      }
      if (redirect) redirects[rowPath] = redirect.to;
      if (!isWinner) actionable.push(rowPath);
      // Cross-check-linkje bij elke rij, rechts van de knoppen in de Reden-cel.
      const checkBtn = `<button type="button" class="canni-check" data-act="check" data-path="${escAttr(rowPath)}" title="Bekijk hoe deze pagina er echt voor staat (GSC-zoekwoorden, Ahrefs-rankings, verwijzende domeinen) voordat je kiest.">check</button>`;
      if (!isWinner) cells[redenIdx] += rowButtonsHtml(rowPath, redirect, checkBtn);
      else cells[redenIdx] += `<span class="canni-actions">${checkBtn}</span>`;
      const rowCls = rowStatus[rowPath] === "afgewezen" ? "canni-rejected" : rowStatus[rowPath] === "doorgezet" ? "canni-deferred" : rowStatus[rowPath] === "taak" ? "canni-tasked" : "";
      return `<tr${rowCls ? ` class="${rowCls}"` : ""}>` + cells.join("</td>") + "</tr>";
    });
    actionableRef.current = actionable;
    rowRedirectRef.current = redirects;
    return out;
  }
  const canniHtml = pc?.result ? enrichCanniTable(mdToHtml(stripRedirectList(pc.result), siteBase)) : "";
  const ilHtml = il?.result ? mdToHtml(il.result, siteBase) : "";

  async function setRowStatus(rowPath: string, status: "uitgevoerd" | "afgewezen" | null, reason = "") {
    setRowStatusMap((m) => { const n = { ...m }; if (status) n[rowPath] = status; else delete n[rowPath]; return n; });
    setRowReason((m) => { const n = { ...m }; if (status === "afgewezen" && reason) n[rowPath] = reason; else delete n[rowPath]; return n; });
    try { await fetch("/api/admin/canni-row", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, pageUrl: url, rowPath, status, reason }) }); } catch { /* status is hulpinfo */ }
  }

  // Afwijzen gaat via een klein venstertje dat om de reden vraagt; die reden
  // komt als onderbouwing in het klantdocument.
  function confirmReject() {
    if (!rejectPath) return;
    setRowStatus(rejectPath, "afgewezen", rejectReason.trim());
    setRejectPath(""); setRejectReason("");
  }

  // ── Pagina-check overlay: hoe staat een rij-pagina er echt voor? ──
  type CheckData = { fullUrl: string; refDomains: number | null; gsc: { keyword: string; clicks: number; impressions: number; position: number }[]; ahrefs: { keyword: string; position: number | null; volume: number | null; traffic: number | null }[] };
  const [checkPath, setCheckPath] = useState("");
  const [checkData, setCheckData] = useState<CheckData | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkErr, setCheckErr] = useState("");
  // Diepere duiding (op aanvraag; kost een AI-call en ~15-30 seconden).
  const [duidingMd, setDuidingMd] = useState("");
  const [duidingBusy, setDuidingBusy] = useState(false);

  async function loadDuiding() {
    if (duidingBusy || !checkPath) return;
    setDuidingBusy(true);
    try {
      const d = await fetch("/api/admin/canni-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, pageUrl: url, rowPath: checkPath }) }).then((r) => r.json());
      if (!d.ok) { setCheckErr(d.error || "Duiding mislukt."); return; }
      setDuidingMd(String(d.duiding || ""));
    } catch { setCheckErr("Duiding mislukt."); } finally { setDuidingBusy(false); }
  }

  async function openCheck(rowPath: string) {
    setCheckPath(rowPath); setCheckData(null); setCheckErr(""); setCheckBusy(true); setDuidingMd("");
    try {
      const d = await fetch(`/api/admin/canni-check?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}&path=${encodeURIComponent(rowPath)}`).then((r) => r.json());
      if (!d.ok) { setCheckErr(d.error || "Check mislukt."); return; }
      setCheckData(d);
    } catch { setCheckErr("Check mislukt."); } finally { setCheckBusy(false); }
  }

  // "Taak maken": groter werk op de kortetermijnplanning. Maakt server-side de
  // diepere duiding + een werkdocument in de Drive-map + een taak in Werkzaamheden.
  async function makeRowTask(rowPath: string) {
    if (wpBusy) return;
    setWpBusy(rowPath); setWpMsg("");
    try {
      const d = await fetch("/api/admin/canni-row", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, pageUrl: url, rowPath, action: "maketask" }) }).then((r) => r.json());
      if (!d.ok) { setWpMsg(d.error || "Taak maken mislukt."); return; }
      setRowStatusMap((m) => ({ ...m, [rowPath]: "taak" }));
      if (!d.docLink) setWpMsg("Taak aangemaakt, maar zonder document (geen Drive-map gekozen voor deze pagina).");
      onApplied();
    } catch { setWpMsg("Taak maken mislukt."); } finally { setWpBusy(""); }
  }

  // "Naar pagina's": zet het advies van deze rij klaar bij die pagina (als
  // vertrekpunt/half plan in het Pagina's-tabblad) en markeer de rij blauw.
  async function sendRowToPage(rowPath: string) {
    if (wpBusy) return;
    setWpBusy(rowPath); setWpMsg("");
    try {
      const d = await fetch("/api/admin/canni-row", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, pageUrl: url, rowPath, action: "topage" }) }).then((r) => r.json());
      if (!d.ok) { setWpMsg(d.error || "Doorzetten mislukt."); return; }
      setRowStatusMap((m) => ({ ...m, [rowPath]: "doorgezet" }));
      onApplied();
    } catch { setWpMsg("Doorzetten mislukt."); } finally { setWpBusy(""); }
  }

  // "Uitvoeren" bij een intern-linken/de-optimaliseren-rij: open de pagina in de
  // WordPress-backend. Het venster gaat synchroon open (anders blokkeert de
  // browser de popup) en krijgt daarna de bewerk-URL.
  async function openInBackend(rowPath: string) {
    if (wpBusy) return;
    setWpBusy(rowPath); setWpMsg("");
    const win = window.open("", "_blank");
    try {
      const d = await fetch("/api/admin/canni-row", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, pageUrl: url, rowPath, action: "editlink" }) }).then((r) => r.json());
      if (!d.ok || !d.editUrl) { win?.close(); setWpMsg(d.error || "De pagina is niet gevonden in WordPress."); return; }
      if (win) win.location.href = d.editUrl;
      await setRowStatus(rowPath, "uitgevoerd");
    } catch { win?.close(); setWpMsg("Openen in de backend mislukte."); } finally { setWpBusy(""); }
  }

  function onCanniClick(e: React.MouseEvent) {
    const btn = (e.target as HTMLElement).closest?.("button[data-act]");
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const act = btn.getAttribute("data-act") || "";
    const path = btn.getAttribute("data-path") || "";
    if (act === "redirect") {
      const from = btn.getAttribute("data-wpfrom") || "";
      const to = btn.getAttribute("data-wpto") || "";
      if (from && to) runWpRedirect(from, to);
    } else if (act === "edit" && path) {
      openInBackend(path);
    } else if (act === "topage" && path) {
      sendRowToPage(path);
    } else if (act === "maketask" && path) {
      makeRowTask(path);
    } else if (act === "check" && path) {
      openCheck(path);
    } else if (act === "reject" && path) {
      setRejectPath(path); setRejectReason(rowReason[path] || "");
    } else if (act === "restore" && path) {
      setRowStatus(path, null);
    }
  }

  useEffect(() => {
    (async () => {
      try { const d = await fetch(`/api/admin/wp-creds?slug=${encodeURIComponent(slug)}`).then((r) => r.json()); if (d.ok) setWpConf({ configured: !!d.set, user: d.user || "" }); } catch { /* stil */ }
      try {
        const d = await fetch(`/api/admin/wp-redirect?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
        if (d.ok && Array.isArray(d.done)) { const m: Record<string, { verified: boolean }> = {}; for (const r of d.done) m[r.fromPath] = { verified: !!r.verified }; setWpDone(m); }
      } catch { /* stil */ }
      try {
        const d = await fetch(`/api/admin/canni-row?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
        if (d.ok && d.statuses && typeof d.statuses === "object") {
          const st: Record<string, "uitgevoerd" | "afgewezen" | "doorgezet" | "taak"> = {};
          const rs: Record<string, string> = {};
          for (const [p, v] of Object.entries(d.statuses as Record<string, unknown>)) {
            if (typeof v === "string") { st[p] = v as typeof st[string]; continue; } // oude vorm
            const o = v as { status?: string; reason?: string };
            if (o?.status === "uitgevoerd" || o?.status === "afgewezen" || o?.status === "doorgezet" || o?.status === "taak") { st[p] = o.status; if (o.reason) rs[p] = o.reason; }
          }
          setRowStatusMap(st); setRowReason(rs);
        }
      } catch { /* stil */ }
    })();
  }, [slug, url]);

  async function saveWpConn() {
    if (wpSaving) return;
    setWpSaving(true); setWpMsg("");
    try {
      const d = await fetch("/api/admin/wp-creds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, user: wpForm.user, appPassword: wpForm.pass }) }).then((r) => r.json());
      if (!d.ok) { setWpMsg(d.error || "Opslaan mislukt."); return; }
      setWpConf({ configured: true, user: wpForm.user });
      setWpForm((f) => ({ ...f, pass: "" })); setWpFormOpen(false);
    } catch { setWpMsg("Opslaan mislukt."); } finally { setWpSaving(false); }
  }

  async function runWpRedirect(from: string, to: string) {
    if (wpBusy) return;
    setWpBusy(from); setWpMsg("");
    try {
      const d = await fetch("/api/admin/wp-redirect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, pageUrl: url, from, to }) }).then((r) => r.json());
      if (!d.ok) { setWpMsg(d.error || "Doorvoeren mislukt."); return; }
      setWpDone((m) => ({ ...m, [from]: { verified: !!d.verified } }));
      if (!d.verified) setWpMsg(`De redirect staat in de website, maar de live-controle zegt: ${d.detail || "nog niet actief"}. Soms moet de cache van de site eerst verlopen; probeer zo de controle opnieuw.`);
    } catch { setWpMsg("Doorvoeren mislukt."); } finally { setWpBusy(""); }
  }

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";
  // Wordt het gesprek nu uitgeklapt getoond? Zo ja, staat de vervolgvraag al in het
  // gesprek zelf (boven de knoppen) en verbergen we het losse invoerveld onderaan.
  // De vraag-input onderaan verbergen we alleen als het gesprek echt zichtbaar is (kaart
   // open én gesprek open). Bij een automatisch ingeladen, ingeklapte chat blijft de input dus staan.
  const convoShown = msgs.length > 0 && convoOpen && chatOpen;
  // Titel voor de strategie-toggle: "STRATEGIE: /pad/" van deze pagina. (De chat-analyse
  // heet "strategie" om hem te onderscheiden van de SEO-analyse bij de vervolgstappen.)
  const analyseTitle = "STRATEGIE: " + ((url || "").replace(/^https?:\/\/[^/]+/i, "").trim() || url).toUpperCase();

  // Groene "klaar"-status onthouden (browseropslag), beide per pagina zodat ze groen
  // blijven na heropenen. Doorgeven wordt gewist bij een nieuwe chat (weer oranje).
  // De chat-kaart staat ALTIJD standaard dicht (bewuste keuze); alleen de klaar-statussen
  // worden hier hersteld.
  useEffect(() => {
    let stratD = false, clusterN = 0;
    try { stratD = localStorage.getItem(`pw_stratdone_${slug}_${url}`) === "1"; } catch { /* geen opslag */ }
    try { const n = Number(localStorage.getItem(`pw_clusterdone_${slug}_${url}`) || "0"); clusterN = Number.isFinite(n) ? n : 0; } catch { clusterN = 0; }
    setTaskDone(stratD); setClusterDone(clusterN);
    try { const sd: Record<string, boolean> = {}; (["analyse", "blauwdruk", "copy"] as const).forEach((k) => { if (localStorage.getItem(`pw_stepdone_${slug}_${url}_${k}`) === "1") sd[k] = true; }); setStepsDone(sd); } catch { setStepsDone({}); }
    try { setCanniDone(localStorage.getItem(`pw_cannidone_${slug}_${url}`) === "1"); } catch { setCanniDone(false); }
    try { const c = localStorage.getItem(`pw_canniinfo_${slug}_${url}`); if (c) { const p = JSON.parse(c); if (p && typeof p.doc === "boolean" && Array.isArray(p.urls)) setApplyInfo(p); } } catch { /* geen opslag */ }
  }, [slug, url]);
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
    const iv = setInterval(async () => { tries++; if ((await loadStratLink()) || tries >= 12) clearInterval(iv); }, 4000);
  }
  useEffect(() => { setStratLink(""); loadStratLink(); /* eslint-disable-next-line */ }, [slug, url]);
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
        if (!d.ok) { setErr(d.error || `Vastleggen mislukt (status ${r.status}).`); return; }
        markStrategieDone();
        if (d.started) { setApplied("De analyse wordt op de achtergrond vastgelegd; je kunt wegklikken. Hij verschijnt zo als werkzaamheid in Werkzaamheden, met de link hier zodra hij klaar is."); onApplied(); pollStratLink(); return; }
        if (d.link) setStratLink(d.link);
        setApplied(`Analyse samengevat en opgeslagen in Google Drive${d.folder ? `, map "${d.folder}"` : ""}${d.owner ? `, account ${d.owner}` : ""} als ${d.isDoc ? "Google Doc" : "Word-bestand"}${!d.isDoc && d.note ? ` (omzetten naar Google Doc lukte niet: ${d.note})` : ""}. <a href="${d.link}" target="_blank" rel="noopener">Open document</a>.${d.shared ? " Iedereen met de link kan het bekijken." : " (Delen lukte niet automatisch.)"} Vastgelegd als één werkzaamheid; je springt nu naar Werkzaamheden om hem in te plannen.`);
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

  const [driveFolder, setDriveFolder] = useState<{ id: string; name: string; path: string } | null>(null);
  // Stappen die na het kiezen van een Drive-map (pop-up) alsnog moeten draaien.
  const [pendingRun, setPendingRun] = useState<{ steps: string[]; audience: "intern" | "klant" } | null>(null);
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
      .then((r) => r.json()).then((d) => {
        if (!alive || !d.ok) return;
        setRun(d.run);
        // Retroactief groen: stappen die in ÉÉN van de runs ooit klaar zijn.
        if (d.everDone) {
          const upd: Record<string, boolean> = {};
          (["analyse", "blauwdruk", "copy"] as const).forEach((k) => { if (d.everDone[k]) { upd[k] = true; try { localStorage.setItem(`pw_stepdone_${slug}_${url}_${k}`, "1"); } catch { /* geen opslag */ } } });
          if (Object.keys(upd).length) setStepsDone((s) => ({ ...s, ...upd }));
        }
      })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [slug, url]);

  // Zodra een stap "done" is in de run: onthoud dat per pagina (knop blijft groen).
  useEffect(() => {
    if (!run) return;
    const upd: Record<string, boolean> = {};
    (["analyse", "blauwdruk", "copy"] as const).forEach((k) => {
      if (run.steps[k] === "done") { upd[k] = true; try { localStorage.setItem(`pw_stepdone_${slug}_${url}_${k}`, "1"); } catch { /* geen opslag */ } }
    });
    if (Object.keys(upd).length) setStepsDone((s) => ({ ...s, ...upd }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [run, slug, url]);

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
      if (pendingRun) { const pr = pendingRun; setPendingRun(null); startBackgroundRun(pr.steps, cur.id, pr.audience); }
    } catch { setPickErr("Opslaan mislukt."); } finally { setPickBusy(false); }
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
  // Alleen als het ECHT al HTML is (sluittags) én GEEN markdown-syntax bevat, laten we het staan.
  // Anders altijd via mdToHtml, dat '<' escapet — zo verschijnt een genoemde tag als `<h1>`
  // als leestekst i.p.v. dat hij als echte kop wordt gerenderd (en de markdown blijft ruw).
  function renderMsgHtml(content: string): string {
    const hasClosingTag = /<\/[a-z][a-z0-9]*>/i.test(content);
    const looksMarkdown = /(^|\n)#{1,6}\s|\*\*[^*]|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|\|[^|]*\|/.test(content);
    return hasClosingTag && !looksMarkdown ? content : mdToHtml(content, siteBase);
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
        { const n = d.saved || items.length; setClusterDone(n); try { localStorage.setItem(`pw_clusterdone_${slug}_${url}`, String(n)); } catch { /* geen opslag */ } if (n > 0 && taskDone) setChatOpen(false); }
        setClusterMsg(`Advies doorgegeven aan ${d.saved} pagina('s). Hun eigen chat neemt dit voortaan als vertrekpunt mee; in het overzicht krijgen ze de markering "half plan".`);
        setClusterItems(null);
        onClusterApplied?.();
      } else setErr(d.error || "Doorgeven mislukt.");
    } catch { setErr("Doorgeven mislukt."); } finally { setClusterBusy(false); }
  }

  // Start de achtergrond-run: de drie stappen draaien server-side door; wegklikken mag.
  async function startBackgroundRun(steps: string[], folderIdOverride?: string, audience: "intern" | "klant" = "klant") {
    if (runBusy) return;
    setRunBusy(true); setErr("");
    try {
      const fid = folderIdOverride ?? driveFolder?.id;
      const r = await fetch("/api/admin/page-doc/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, steps, extra: nuance.trim() || undefined, folderId: fid || undefined, audience }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Achtergrond-run starten mislukt."); return; }
      const s = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((x) => x.json()).catch(() => null);
      if (s?.ok) setRun(s.run);
    } catch { setErr("Achtergrond-run starten mislukt."); } finally { setRunBusy(false); }
  }

  // Vraagt eerst een Drive-map (pop-up) als er nog geen gekozen is, en start dan de run,
  // zodat je altijd weet waar het document terechtkomt. Is er al een map, dan draait hij direct.
  function ensureFolderThenRun(steps: string[], audience: "intern" | "klant" = "klant") {
    if (runBusy) return;
    if (driveFolder) { startBackgroundRun(steps, undefined, audience); return; }
    setPendingRun({ steps, audience });
    openPicker();
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
          <div className="pch-prop-plan md" dangerouslySetInnerHTML={{ __html: mdToHtml(proposal.plan, siteBase) }} />
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <button type="button" className="pcd-btn pcd-btn-primary" onClick={() => send(SUMMARIZE_PROMPT)} disabled={busy} title="Vat het hele gesprek samen tot de definitieve conclusie en strategie, klaar om over te nemen als plan">Vat samen tot conclusie &amp; strategie</button>
              <HelpHint text="Laat de AI het gesprek samenvatten tot de definitieve conclusie + strategie. Die neem je daarna met 'Neem plan over' over als het PLAN van deze pagina (stap 1). Dit maakt geen document; het document maak je met 'Strategie vastleggen' onderaan." />
            </span>
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
            <button type="button" className={"pcd-btn " + (taskDone ? "pcd-btn-done" : "pcd-btn-primary") + (taskGen ? " busy" : "")} onClick={makeWorkItem} disabled={taskGen}>{taskGen ? "Vastleggen…" : taskDone ? "✓ Strategie vastgelegd." : "Strategie vastleggen"}</button>
            {stratLink
              ? <a href={stratLink} target="_blank" rel="noreferrer" className="pcd-doclink">Document openen ↗</a>
              : taskDone && <span className="muted" style={{ fontSize: 12 }}>document nog niet gekoppeld (kies een Drive-map en leg opnieuw vast)</span>}
            <HelpHint text="Maakt van de strategie uit deze chat één DOCUMENT (in je Drive-map, of een download als er geen map is gekozen) en legt hem vast als werkzaamheid, met de link ernaast. Dit is iets anders dan 'Vat samen' hierboven: die maakt geen document maar de plantekst." />
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
              <div className="pchi-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice, siteBase) }} />
              {it.sourceUrl && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uit de analyse van <a href={it.sourceUrl} target="_blank" rel="noreferrer">{it.sourceUrl}</a></div>}
            </div>
          ))}
          {incoming.some((it) => it.sourceAnalysis) && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="ghost-btn small" onClick={() => setIncomingOpen((o) => !o)}>{incomingOpen ? "Verberg de volledige clusteranalyse" : "Toon de volledige clusteranalyse"}</button>
              {incomingOpen && incoming.filter((it) => it.sourceAnalysis).map((it, i) => (
                <div key={i} className="pchi-full md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.sourceAnalysis, siteBase) }} />
              ))}
            </div>
          )}
        </div>
      )}
      <div className={"page-chat step-card step-card-2" + (taskDone ? " done" : "")}>
        <div className="step-head" onClick={() => setChatOpen((o) => !o)} title={chatOpen ? "Chat inklappen" : "Chat uitklappen"}>
          <span className="step-caret">{chatOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{taskDone ? "✓" : "2"}</span>
          <span className="step-title">Chat over deze pagina</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint wide text="Praat hier met de AI over deze pagina om de strategie uit te werken. De chat is gegrond in de live status van de pagina, de Search Console-ranking en de andere pagina's in het cluster, zodat het advies klopt met de werkelijkheid. Ben je klaar: vat samen tot een plan, geef het door aan betrokken pagina's en leg de strategie vast." /></span>
          {chatOpen && (chats.length > 0 || msgs.length > 0) && <span className="step-head-right"><button type="button" className="ghost-btn small" onClick={(e) => { e.stopPropagation(); newChat(); }}>+ Nieuwe chat</button></span>}
        </div>

        {chatOpen && (
        <div className="page-chat-history step-body">
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
          {!convoShown && (
            <div className="page-chat-input" style={{ marginTop: 10 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag over deze pagina…" disabled={busy} />
              <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
            </div>
          )}
        </div>
        )}
      </div>

      {applied && <div className="saved-msg" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: applied }} />}
      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}

      <div className={"page-chat-cluster-card step-card step-card-3" + (clusterDone > 0 ? " done" : "")}>
        <div className="step-head" onClick={() => setDoorgevenOpen((o) => !o)}>
          <span className="step-caret">{doorgevenOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{clusterDone > 0 ? "✓" : "3"}</span>
          <span className="step-title">Doorgeven aan gelieerde pagina&rsquo;s</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint wide text="Raakt deze analyse ook andere pagina's in het cluster? Geef het advies dat over hén gaat alvast door. Naast het advies per pagina gaat ook de volledige conclusie van deze chat mee, zodat die pagina's de hele strategie als vertrekpunt hebben (ze krijgen de markering 'half plan')." /></span>
        </div>
        {doorgevenOpen && (
        <div className="page-chat-cluster step-body">
          {!lastAssistant ? (
            <div className="muted" style={{ fontSize: 13 }}>Werk eerst de strategie uit in de chat (stap 2); daarna kun je het advies doorgeven aan gelieerde pagina&rsquo;s.</div>
          ) : (<>
            <div className="pchf-lead">Raakt deze analyse ook andere pagina&rsquo;s in het cluster? Geef hun advies alvast door.</div>
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
                      <div className="pch-cluster-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice, siteBase) }} />
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
          </>)}
          </div>
          )}
        </div>

      <div className={"page-chat-docs step-card step-card-4" + (allStepsDone ? " done" : "")}>
          <div className="step-head" onClick={() => setVervolgOpen((o) => !o)}>
            <span className="step-caret">{vervolgOpen ? "▾" : "▸"}</span>
            <span className="step-badge">{allStepsDone ? "✓" : "4"}</span>
            <span className="step-title">Vervolgstappen op de strategie</span>
            <span onClick={(e) => e.stopPropagation()}><HelpHint wide text="Hier maak je de documenten die uit de vastgelegde strategie volgen: de SEO-analyse, de blauwdruk en de copy voor deze pagina. Elke stap draait op de achtergrond en komt in je Drive-map te staan én als werkzaamheid in de takenlijst. Onder elke stap kun je een uitgebreide interne versie laten maken." /></span>
          </div>
          {vervolgOpen && (
          !lastAssistant ? <div className="step-body muted" style={{ fontSize: 13 }}>Werk eerst de strategie uit in de chat (stap 2) en leg hem vast; daarna maak je hier de analyse, blauwdruk en copy.</div> : (<div className="step-body">
          <div className="page-chat-drive" style={{ margin: "4px 0 14px" }}>
            <span className="pcd-label">Opslaan in:</span>
            {driveFolder
              ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
              : <span className="pcd-folder muted">nog geen Drive-map, je kiest hem zodra je op een knop hieronder klikt</span>}
            <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Map wijzigen" : "Kies Drive-map"}</button>
          </div>
          <input className="pcd-nuance" value={nuance} onChange={(e) => setNuance(e.target.value)} placeholder="Extra sturing (optioneel), bijv. leg de nadruk op de regio, of behoud de tarieventabel." />
          <div className="pcd-docs-buttons">
            <div className="pcd-step">
              <button type="button" className={"pcd-btn" + (stepsDone.analyse ? " pcd-btn-done" : "")} onClick={() => ensureFolderThenRun(["analyse"])} disabled={runBusy || pageLive === false} title={pageLive === false ? "Deze pagina bestaat nog niet live, dus er valt nog niets te analyseren. Blauwdruk en copy kunnen wel." : "Draait op de achtergrond door; wegklikken mag."}>{stepsDone.analyse ? "✓ 1. Analyse-document" : "1. Analyse-document"}</button>
              <button type="button" className="pcd-step-intern" onClick={() => ensureFolderThenRun(["analyse"], "intern")} disabled={runBusy || pageLive === false} title="Maakt de uitgebreide interne/technische versie van deze stap (op verzoek; ~3x zo lang). Voor eigen inzicht. Niet klant-zichtbaar.">Interne / uitgebreide versie</button>
            </div>
            <div className="pcd-step">
              <button type="button" className={"pcd-btn" + (stepsDone.blauwdruk ? " pcd-btn-done" : "")} onClick={() => ensureFolderThenRun(["blauwdruk"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">{stepsDone.blauwdruk ? "✓ 2. Blauwdruk-document" : "2. Blauwdruk-document"}</button>
              <button type="button" className="pcd-step-intern" onClick={() => ensureFolderThenRun(["blauwdruk"], "intern")} disabled={runBusy} title="Maakt de uitgebreide interne/technische versie van deze stap (op verzoek; ~3x zo lang). Voor eigen inzicht. Niet klant-zichtbaar.">Interne / uitgebreide versie</button>
            </div>
            <div className="pcd-step">
              <button type="button" className={"pcd-btn" + (stepsDone.copy ? " pcd-btn-done" : "")} onClick={() => ensureFolderThenRun(["copy"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">{stepsDone.copy ? "✓ 3. Copy-document" : "3. Copy-document"}</button>
              <button type="button" className="pcd-step-intern" onClick={() => ensureFolderThenRun(["copy"], "intern")} disabled={runBusy} title="Maakt de uitgebreide interne/technische versie van deze stap (op verzoek; ~3x zo lang). Voor eigen inzicht. Niet klant-zichtbaar.">Interne / uitgebreide versie</button>
            </div>
            <div className="pcd-step">
              <button type="button" className={"pcd-btn " + (allStepsDone ? "pcd-btn-done" : "pcd-btn-primary") + (runBusy ? " busy" : "")} onClick={() => ensureFolderThenRun(pageLive === false ? ["blauwdruk", "copy"] : ["analyse", "blauwdruk", "copy"])} disabled={runBusy} title={pageLive === false ? "Deze pagina bestaat nog niet live: de analyse wordt overgeslagen, alleen blauwdruk en copy draaien." : "Draait de drie stappen op de achtergrond door; wegklikken mag."}>{runBusy ? "Starten…" : allStepsDone ? "✓ Alles klaar" : pageLive === false ? "Blauwdruk + copy (2 → 3)" : "Alles achter elkaar (1 → 2 → 3)"}</button>
            </div>
          </div>
          <div className="muted pcd-docs-note">Draait op de achtergrond, wegklikken mag. Eén korte klantversie die jij, de developer én de klant lezen. Tip: kies eerst een Drive-map.</div>

          {run && (
            <div className="pcd-run-inline">
              <div className="pcd-run-line">
                {(["analyse", "blauwdruk", "copy"] as const).filter((k) => run.steps[k] !== "skipped").map((k) => {
                  const nm = k === "analyse" ? "Analyse" : k === "blauwdruk" ? "Blauwdruk" : "Copy";
                  const st = run.steps[k] === "done" ? "klaar" : run.steps[k] === "running" ? "bezig…" : run.steps[k] === "error" ? "fout" : "wacht";
                  return (
                    <span key={k} className={"pcd-run-item " + (run.steps[k] || "pending")}>
                      <strong>{nm}</strong> {st}{run.links[k] && <> · <a href={run.links[k]} target="_blank" rel="noreferrer">document</a></>}
                    </span>
                  );
                })}
              </div>
              {run.status === "running" && <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>Loopt server-side door; wegklikken mag. Verschijnt ook als werkzaamheid.</div>}
              {run.status === "error" && run.error && <div className="login-error" style={{ marginTop: 6 }}>{run.error}</div>}
            </div>
          )}
          </div>))}
        </div>

      <div className={"page-chat-canni step-card step-card-5" + (canniDone ? " done" : "")}>
        <div className="step-head" onClick={() => setCanniOpen((o) => !o)}>
          <span className="step-caret">{canniOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{canniDone ? "✓" : "5"}</span>
          <span className="step-title">Cannibalisatie oplossen</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint wide text="Controleert of meerdere pagina's van de site op dezelfde zoekwoorden concurreren (kannibalisatie). Per zoekwoord zie je (met top-10 + volume) of het een eigen pagina verdient of naar deze pagina geclusterd moet worden, en welke pagina's deze pagina 'kapen', met de actie per pagina. Draait op de achtergrond met echte Ahrefs-data." /></span>
        </div>
        {canniOpen && (<div className="step-body">
        <div className="pch-canni-row">
          <span className="pch-canni-lead">Brengt per zoekwoord in kaart (top-10 + volume) of het een eigen pagina verdient of naar deze pagina geclusterd wordt, en welke pagina&rsquo;s deze pagina kapen, met de actie per pagina.</span>
          <button type="button" className={"pcd-btn" + (pcBusy || pc?.status === "running" ? " busy" : "")} disabled={pcBusy || pc?.status === "running"} onClick={runPc} title="Draait op de achtergrond met echte Ahrefs-data; je kunt wegklikken.">{pc?.status === "running" ? "Analyse draait…" : pc?.result ? "Opnieuw analyseren" : "Cannibalisatie oplossen"}</button>
        </div>
        {pc?.status === "error" && pc.error && <div className="login-error" style={{ marginTop: 8 }}>{pc.error}</div>}
        {pc?.status === "running" && !pc.result && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Analyse draait op de achtergrond (verzamelt per pagina de Ahrefs-zoekwoorden + top-10; dit kan een paar minuten duren).</div>}
        {pc?.result && (
          <div className="pch-canni-doc">
            <button type="button" className="pch-canni-toggle" onClick={() => setPcOpen((o) => !o)}>{pcOpen ? "▾" : "▸"} Cannibalisatie- &amp; content-mapping-analyse{pc.updatedAt ? ` · ${new Date(pc.updatedAt).toLocaleString("nl-NL")}` : ""}{pc.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
            {pcOpen && (<>
              <div className="md pch-canni-md" onClick={onCanniClick} dangerouslySetInnerHTML={{ __html: canniHtml }} />
              {wpRedirects.length > 0 && (!wpConf?.configured || wpFormOpen || wpMsg) && (
                <div className="pch-wp-foot">
                  {!wpConf?.configured && !wpFormOpen && <span className="muted" style={{ fontSize: 12.5 }}>Redirects uitvoeren vereist de WordPress-koppeling. <button type="button" className="ghost-btn small" onClick={() => setWpFormOpen(true)}>WordPress koppelen</button></span>}
                  {wpFormOpen && (
                    <div className="pch-wp-form">
                      <input type="text" placeholder="WordPress-gebruikersnaam" value={wpForm.user} onChange={(e) => setWpForm((f) => ({ ...f, user: e.target.value }))} autoComplete="off" />
                      <input type="password" placeholder="Application password" value={wpForm.pass} onChange={(e) => setWpForm((f) => ({ ...f, pass: e.target.value }))} autoComplete="new-password" />
                      <button type="button" className="pcd-btn" disabled={wpSaving} onClick={saveWpConn}>{wpSaving ? "Opslaan…" : "Koppeling opslaan"}</button>
                    </div>
                  )}
                  {wpMsg && <div className="login-error" style={{ marginTop: 6 }}>{wpMsg}</div>}
                </div>
              )}
            </>)}
            {/* Map + overnemen blijven ook zichtbaar als de analyse is ingeklapt. */}
            <div className="page-chat-drive" style={{ margin: "12px 0 8px" }}>
              <span className="pcd-label">Opslaan in:</span>
              {driveFolder
                ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
                : <span className="pcd-folder muted">nog geen Drive-map, kies er een zodat het taak-document in de juiste map komt</span>}
              <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Map wijzigen" : "Kies Drive-map"}</button>
            </div>
            <div className="pch-canni-apply">
              <button type="button" className={"pcd-btn pcd-btn-primary" + (applyBusy ? " busy" : "") + (canniDone && !applyBusy ? " pcd-done" : "")} disabled={applyBusy} onClick={applyRec} title="Zet de redirects + interne links door als Dev-taak met document, en de de-optimalisatie-info als basis naar de betreffende pagina's.">{applyBusy ? "Overnemen…" : canniDone ? "✓ Aanbevelingen overgenomen" : "Aanbevelingen overnemen"}</button>
              {applyInfo && (
                <div className="pch-apply-panel">
                  <div className="pch-apply-row">
                    <span className="pch-apply-ico">✓</span>
                    <div>{applyInfo.doc
                      ? <><strong>Dev-taak aangemaakt in Werkzaamheden met een gekoppeld document</strong> (de volledige lijst met redirects en interne links staat daarin).</>
                      : <><strong>Dev-taak aangemaakt in Werkzaamheden zonder document</strong>, er was geen Drive-map gekozen. Kies hierboven een map en neem opnieuw over voor een net taak-document.</>}</div>
                  </div>
                  {applyInfo.counts && (<>
                    <hr className="pch-apply-hr" />
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div>
                        <strong>Opgeleverd op basis van jouw beoordeling:</strong> {applyInfo.counts.executed} doorgevoerd, {applyInfo.counts.deferred} naar pagina&rsquo;s geschoven, {applyInfo.counts.rejected} afgewezen (met reden in het document){applyInfo.counts.unreviewed > 0 ? `, ${applyInfo.counts.unreviewed} niet beoordeeld (buiten het document gelaten)` : ""}.
                      </div>
                    </div>
                  </>)}
                  {applyInfo.urls.length > 0 && (<>
                    <hr className="pch-apply-hr" />
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div>
                        <strong>Basisinfo doorgezet naar {applyInfo.urls.length} gelieerde pagina{applyInfo.urls.length === 1 ? "" : "'s"}</strong>:
                        <ul>{applyInfo.urls.map((u) => { let p = u; try { p = new URL(u).pathname || u; } catch { /* pad niet te bepalen */ } return <li key={u}>{p}</li>; })}</ul>
                      </div>
                    </div>
                  </>)}
                </div>
              )}
            </div>
            {applyMsg && <div className="login-error" style={{ marginTop: 8 }}>{applyMsg}</div>}
          </div>
        )}
        </div>)}
      </div>

      {rejectPath && (
        <div className="compose-overlay">
          <div className="canni-check-pop" style={{ width: "min(520px, 94vw)" }}>
            <div className="ccp-head">
              <strong>Voorstel afwijzen</strong>
              <code className="ccp-path">{rejectPath}</code>
              <button type="button" className="ghost-btn small ccp-close" onClick={() => { setRejectPath(""); setRejectReason(""); }} title="Annuleren">✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>Leg kort vast waarom dit voorstel niet wordt doorgevoerd. Deze reden komt als onderbouwing in het klantdocument.</p>
            <input
              type="text" autoFocus value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmReject(); }}
              placeholder="Bijvoorbeeld: deze pagina moet blijven bestaan voor de Amstelveen-campagne"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit" }}
            />
            <div className="ccp-actions">
              <button type="button" className="pcd-btn small pcd-warn" onClick={confirmReject}>Afwijzen</button>
              <button type="button" className="pcd-btn small wp-ghost" onClick={() => { setRejectPath(""); setRejectReason(""); }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {checkPath && (
        <div className="compose-overlay">
          <div className="canni-check-pop">
            <div className="ccp-head">
              <strong>Pagina-check</strong>
              <code className="ccp-path">{checkPath}</code>
              {checkData && <a href={checkData.fullUrl} target="_blank" rel="noreferrer" className="ccp-live">bekijk live ↗</a>}
              <button type="button" className="ghost-btn small ccp-close" onClick={() => setCheckPath("")} title="Sluiten">✕</button>
            </div>
            {checkBusy && <div className="muted" style={{ padding: "14px 0" }}>Gegevens ophalen (GSC en Ahrefs)…</div>}
            {checkErr && <div className="login-error">{checkErr}</div>}
            {checkData && (
              <div className="ccp-body md">
                <p className="ccp-meta"><strong>Verwijzende domeinen:</strong> {checkData.refDomains ?? "onbekend"}</p>
                <p className="ccp-sub">Search Console, laatste 90 dagen (waar Google deze pagina echt op toont):</p>
                {checkData.gsc.length ? (
                  <table className="md-table"><thead><tr><th>Zoekwoord</th><th>Positie</th><th>Klikken</th><th>Vertoningen</th></tr></thead>
                    <tbody>{checkData.gsc.map((r) => <tr key={r.keyword}><td>{r.keyword}</td><td>{r.position ? r.position.toFixed(1) : "-"}</td><td>{r.clicks}</td><td>{r.impressions}</td></tr>)}</tbody></table>
                ) : <p className="muted">Geen GSC-gegevens voor deze pagina.</p>}
                <p className="ccp-sub">Ahrefs (rankings met zoekvolume):</p>
                {checkData.ahrefs.length ? (
                  <table className="md-table"><thead><tr><th>Zoekwoord</th><th>Positie</th><th>Volume</th><th>Verkeer</th></tr></thead>
                    <tbody>{checkData.ahrefs.map((r) => <tr key={r.keyword}><td>{r.keyword}</td><td>{r.position ?? "-"}</td><td>{r.volume ?? "-"}</td><td>{r.traffic ?? "-"}</td></tr>)}</tbody></table>
                ) : <p className="muted">Geen Ahrefs-rankings voor deze pagina.</p>}
                {duidingMd
                  ? (<><p className="ccp-sub">Diepere duiding (op basis van de GSC-data van beide pagina&rsquo;s):</p><div className="md ccp-duiding" dangerouslySetInnerHTML={{ __html: mdToHtml(duidingMd, siteBase) }} /></>)
                  : <button type="button" className="ghost-btn small" style={{ marginTop: 10 }} disabled={duidingBusy} onClick={loadDuiding} title="AI legt de zoektermen van deze pagina naast die van de winnaar: echte splitsing of niet, en klopt de voorgestelde actie. Duurt 15-30 seconden.">{duidingBusy ? "Duiding maken…" : "Diepere duiding"}</button>}
                <div className="ccp-actions">
                  {(() => {
                    const to = rowRedirectRef.current[checkPath] || wpRedirects.find((x) => x.from === checkPath)?.to || "";
                    const redirect = to ? { from: checkPath, to } : null;
                    const status = rowStatus[checkPath];
                    if (status === "afgewezen") return <button type="button" className="pcd-btn small pcd-warn" onClick={() => setRowStatus(checkPath, null)}>Afgewezen, herstel</button>;
                    if (status === "doorgezet") return <button type="button" className="pcd-btn small pcd-blue" onClick={() => setRowStatus(checkPath, null)}>→ Bij pagina&rsquo;s, herstel</button>;
                    if (status === "taak") return <button type="button" className="pcd-btn small pcd-purple" onClick={() => setRowStatus(checkPath, null)}>✓ Taak gemaakt, herstel</button>;
                    return (<>
                      {redirect
                        ? <button type="button" className={"pcd-btn small" + (wpDone[redirect.from]?.verified ? " pcd-done" : "")} disabled={!!wpBusy} onClick={() => runWpRedirect(redirect.from, redirect.to)}>{wpDone[redirect.from]?.verified ? "✓ Uitgevoerd" : "Uitvoeren (301)"}</button>
                        : <button type="button" className={"pcd-btn small" + (status === "uitgevoerd" ? " pcd-done" : "")} disabled={!!wpBusy} onClick={() => openInBackend(checkPath)}>{status === "uitgevoerd" ? "✓ Uitgevoerd" : "Uitvoeren (open backend)"}</button>}
                      {!redirect && <button type="button" className="pcd-btn small wp-ghost-blue" disabled={!!wpBusy} onClick={() => sendRowToPage(checkPath)}>Naar pagina&rsquo;s</button>}
                      <button type="button" className="pcd-btn small wp-ghost-purple" disabled={!!wpBusy} onClick={() => makeRowTask(checkPath)} title="Maakt een taak in Werkzaamheden met een werkdocument (met de diepere duiding als achtergrond).">{wpBusy === checkPath ? "Bezig…" : "Taak maken"}</button>
                      <button type="button" className="pcd-btn small wp-ghost" disabled={!!wpBusy} onClick={() => { setRejectPath(checkPath); setRejectReason(rowReason[checkPath] || ""); }}>Afwijzen</button>
                    </>);
                  })()}
                </div>
                {wpMsg && <div className="login-error" style={{ marginTop: 8 }}>{wpMsg}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={"page-chat-links-card step-card step-card-6" + (ilDone ? " done" : "")}>
        <div className="step-head" onClick={() => setLinksOpen((o) => !o)}>
          <span className="step-caret">{linksOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{ilDone ? "✓" : "6"}</span>
          <span className="step-title">Interne links</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint wide text="Zoekt de beste interne links NAAR deze pagina: welke andere pagina's zouden hierheen moeten linken, gerangschikt op interessantheid (raakt de bronpagina het onderwerp, hoeveel autoriteit heeft hij via externe links, hoeveel verkeer krijgt hij uit Search Console). Per kans een voorgestelde ankertekst en een directe bewerk-link naar de WordPress-backend. Draait op de achtergrond." /></span>
        </div>
        {linksOpen && (<div className="step-body">
          <div className="pch-canni-row">
            <span className="pch-canni-lead">Vindt per pagina de beste interne links hiernaartoe, gerangschikt op relevantie, autoriteit (verwijzende domeinen) en verkeer, met ankertekst en een bewerk-link naar de bronpagina.</span>
            <button type="button" className={"pcd-btn" + (ilBusy || il?.status === "running" ? " busy" : "")} disabled={ilBusy || il?.status === "running"} onClick={runIl} title="Draait op de achtergrond; je kunt wegklikken.">{il?.status === "running" ? "Analyse draait…" : il?.result ? "Opnieuw zoeken" : "Interne links zoeken"}</button>
          </div>
          {il?.status === "error" && il.error && <div className="login-error" style={{ marginTop: 8 }}>{il.error}</div>}
          {il?.status === "running" && !il.result && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Analyse draait op de achtergrond (crawlt de kandidaat-bronpagina&rsquo;s en weegt autoriteit + verkeer; dit kan een paar minuten duren).</div>}
          {il?.result && (
            <div className="pch-canni-doc">
              <button type="button" className="pch-canni-toggle" onClick={() => setIlDocOpen((o) => !o)}>{ilDocOpen ? "▾" : "▸"} Interne-links-voorstel{il.updatedAt ? ` · ${new Date(il.updatedAt).toLocaleString("nl-NL")}` : ""}{il.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
              {ilDocOpen && <div className="md pch-canni-md pch-il-md" dangerouslySetInnerHTML={{ __html: ilHtml }} />}
              {/* Map + overnemen blijven ook zichtbaar als het voorstel is ingeklapt. */}
              <div className="page-chat-drive" style={{ margin: "12px 0 8px" }}>
                <span className="pcd-label">Opslaan in:</span>
                {driveFolder
                  ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
                  : <span className="pcd-folder muted">nog geen Drive-map, kies er een zodat het taak-document in de juiste map komt</span>}
                <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Map wijzigen" : "Kies Drive-map"}</button>
              </div>
              <div className="pch-canni-apply">
                <button type="button" className={"pcd-btn pcd-btn-primary" + (ilApplyBusy ? " busy" : "") + (ilDone && !ilApplyBusy ? " pcd-done" : "")} disabled={ilApplyBusy} onClick={applyIl} title="Zet het interne-links-voorstel door als Dev-taak met een begrijpelijk document.">{ilApplyBusy ? "Overnemen…" : ilDone ? "✓ Aanbevelingen overgenomen" : "Aanbevelingen overnemen"}</button>
                {ilApplyInfo && (
                  <div className="pch-apply-panel">
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div>{ilApplyInfo.doc
                        ? <><strong>Dev-taak aangemaakt in Werkzaamheden met een gekoppeld document</strong> (de volledige lijst met interne links en ankerteksten staat daarin).</>
                        : <><strong>Dev-taak aangemaakt in Werkzaamheden zonder document</strong>, er was geen Drive-map gekozen. Kies hierboven een map en neem opnieuw over voor een net taak-document.</>}</div>
                    </div>
                  </div>
                )}
              </div>
              {ilApplyMsg && <div className="login-error" style={{ marginTop: 8 }}>{ilApplyMsg}</div>}
            </div>
          )}
        </div>)}
      </div>

      <div className={"page-chat-schema-card step-card step-card-7" + (schDone ? " done" : "")}>
        <div className="step-head" onClick={() => setSchemaOpen((o) => !o)}>
          <span className="step-caret">{schemaOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{schDone ? "✓" : "7"}</span>
          <span className="step-title">Structured data</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint wide title="Structured data (stap 7)" text={"Bepaalt welke schema.org-markup deze pagina nodig heeft, afgestemd op het bedrijfstype (kliniek, webshop, dienstverlener, lokaal, informatief).\n- Gebruikt de bevestigde Bedrijfsgegevens (Klant-tabblad) als bron en detecteert bestaande plugin-schema om dubbelingen te voorkomen.\n- Levert een leesbaar advies plus kant-en-klare JSON-LD als één samenhangende entity graph.\n- Overnemen maakt een kort uitleg-document, een los .json-bestand (letterlijk te plakken) en één Dev-taak."} /></span>
        </div>
        {schemaOpen && (<div className="step-body">
          <div className="pch-canni-row">
            <span className="pch-canni-lead">Adviseert de structured data (schema.org) voor deze pagina op basis van het bedrijfstype en de bevestigde bedrijfsgegevens, en levert de kant-en-klare JSON-LD voor de developer.</span>
            <button type="button" className={"pcd-btn" + (schBusy || sch?.status === "running" ? " busy" : "")} disabled={schBusy || sch?.status === "running"} onClick={runSch} title="Draait op de achtergrond; je kunt wegklikken.">{sch?.status === "running" ? "Analyse draait…" : sch?.result ? "Opnieuw analyseren" : "Analyseer structured data"}</button>
          </div>
          {sch?.status === "error" && sch.error && <div className="login-error" style={{ marginTop: 8 }}>{sch.error}</div>}
          {sch?.status === "running" && !sch.result && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Analyse draait op de achtergrond (meet de pagina, leest bestaande schema en de bedrijfsgegevens; dit duurt meestal onder een minuut).</div>}
          {sch?.result && (
            <div className="pch-canni-doc">
              <button type="button" className="pch-canni-toggle" onClick={() => setSchDocOpen((o) => !o)}>{schDocOpen ? "▾" : "▸"} Structured data-advies{sch.updatedAt ? ` · ${new Date(sch.updatedAt).toLocaleString("nl-NL")}` : ""}{sch.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
              {schDocOpen && (
                <>
                  {sch.warnings.length > 0 && (
                    <div className="sch-warnings">
                      {sch.warnings.map((w, i) => <div key={i} className="sch-warning">⚠ {w}</div>)}
                    </div>
                  )}
                  <div className="md pch-canni-md" dangerouslySetInnerHTML={{ __html: mdToHtml(sch.result, siteBase) }} />
                  {sch.jsonld && (
                    <div className="sch-json">
                      <div className="sch-json-head">
                        <button type="button" className="pch-canni-toggle" onClick={() => setSchJsonOpen((o) => !o)}>{schJsonOpen ? "▾" : "▸"} De JSON-LD (voor de developer)</button>
                        <button type="button" className="ghost-btn small" onClick={copySchJson}>{schCopied ? "✓ gekopieerd" : "Kopieer JSON"}</button>
                      </div>
                      {schJsonOpen && <pre className="sch-json-pre">{sch.jsonld}</pre>}
                    </div>
                  )}
                </>
              )}
              <div className="page-chat-drive" style={{ margin: "12px 0 8px" }}>
                <span className="pcd-label">Opslaan in:</span>
                {driveFolder
                  ? <span className="pcd-folder">{driveFolder.path || driveFolder.name}</span>
                  : <span className="pcd-folder muted">nog geen Drive-map, kies er een zodat het document en het .json-bestand in de juiste map komen</span>}
                <button type="button" className="ghost-btn small" onClick={openPicker}>{driveFolder ? "Map wijzigen" : "Kies Drive-map"}</button>
              </div>
              <div className="pch-canni-apply">
                <button type="button" className={"pcd-btn pcd-btn-primary" + (schApplyBusy ? " busy" : "") + (schDone && !schApplyBusy ? " pcd-done" : "")} disabled={schApplyBusy} onClick={applySch} title="Maakt een kort uitleg-document + los .json-bestand in de Drive-map en één Dev-taak.">{schApplyBusy ? "Overnemen…" : schDone ? "✓ Overgenomen" : "Overnemen (document + JSON + taak)"}</button>
                {schApplyInfo && (
                  <div className="pch-apply-panel">
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div><strong>Dev-taak aangemaakt in Werkzaamheden</strong> met het uitleg-document en het losse .json-bestand (de developer plakt die letterlijk in de site).</div>
                    </div>
                  </div>
                )}
              </div>
              {schApplyMsg && <div className="login-error" style={{ marginTop: 8 }}>{schApplyMsg}</div>}
            </div>
          )}
        </div>)}
      </div>


      {pickerOpen && (
        <div className="compose-overlay">
          <div className="compose-modal drive-modal">
            <div className="compose-head"><span>Kies de Google Drive-map voor deze pagina</span><button type="button" className="chat-float-close" onClick={() => { setPickerOpen(false); setPendingRun(null); }}>&times;</button></div>
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
              <button type="button" className="logout-btn" onClick={() => { setPickerOpen(false); setPendingRun(null); }}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={chooseCurrent} disabled={pickBusy}>Kies “{stack[stack.length - 1].name}”</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

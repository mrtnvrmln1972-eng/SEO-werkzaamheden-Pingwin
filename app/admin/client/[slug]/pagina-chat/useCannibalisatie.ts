"use client";

// De logica van stap 4 (cannibalisatie oplossen) plus de twee vensters die erbij
// horen (pagina-check en afwijzen): de achtergrond-analyse, de verrijkte tabel
// met actie-knoppen per rij, de 301-redirects via de WordPress-koppeling, en het
// overnemen als Dev-taak. De weergave staat in CannibalisatieKaart.tsx,
// CheckVenster.tsx en AfwijsVenster.tsx.
import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../../lib/markdown";

export type CheckData = { fullUrl: string; refDomains: number | null; gsc: { keyword: string; clicks: number; impressions: number; position: number }[]; ahrefs: { keyword: string; position: number | null; volume: number | null; traffic: number | null }[] };

export function useCannibalisatie({ slug, url, siteBase, onApplied, setErr }: {
  slug: string; url: string; siteBase: string;
  onApplied: (plan?: string) => void; setErr: (v: string) => void;
}) {
  // Per-pagina cannibalisatie- + content-mapping-analyse (achtergrond).
  const [pc, setPc] = useState<{ status: string; result: string; error: string; updatedAt: string | null } | null>(null);
  const [pcBusy, setPcBusy] = useState(false);
  const [pcOpen, setPcOpen] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState(""); // alleen foutmeldingen
  // Resultaat van "Aanbevelingen overnemen"; blijft staan (browseropslag) na herladen.
  const [applyInfo, setApplyInfo] = useState<{ doc: boolean; urls: string[]; counts?: { executed: number; deferred: number; rejected: number; tasked: number; unreviewed: number } } | null>(null);
  const [canniDone, setCanniDone] = useState(false); // stap 5 afgerond (aanbevelingen overgenomen)

  // Groene "klaar"-status onthouden (browseropslag), per pagina. Stond eerst in
  // de gezamenlijke stand-effect van PageChat.tsx; zelfde moment, zelfde werking.
  useEffect(() => {
    try { setCanniDone(localStorage.getItem(`pw_cannidone_${slug}_${url}`) === "1"); } catch { setCanniDone(false); }
    try { const c = localStorage.getItem(`pw_canniinfo_${slug}_${url}`); if (c) { const p = JSON.parse(c); if (p && typeof p.doc === "boolean" && Array.isArray(p.urls)) setApplyInfo(p); } } catch { /* geen opslag */ }
  }, [slug, url]);

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

  return {
    pc, pcBusy, pcOpen, setPcOpen, runPc, canniHtml, onCanniClick,
    applyBusy, applyMsg, applyInfo, canniDone, applyRec,
    wpConf, wpDone, wpBusy, wpMsg, wpFormOpen, setWpFormOpen, wpForm, setWpForm, wpSaving, saveWpConn, runWpRedirect, wpRedirects,
    rowStatus, rowReason, rowRedirectRef, setRowStatus,
    rejectPath, setRejectPath, rejectReason, setRejectReason, confirmReject,
    checkPath, setCheckPath, checkData, checkBusy, checkErr, duidingMd, duidingBusy, loadDuiding,
    makeRowTask, sendRowToPage, openInBackend,
  };
}

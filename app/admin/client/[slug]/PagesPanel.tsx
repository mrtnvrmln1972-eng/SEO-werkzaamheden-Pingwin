"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientUrl } from "../../../../lib/site-urls";
import { mdToHtml } from "../../../../lib/markdown";
import ImportAnalysis from "./ImportAnalysis";
import PageChat from "./PageChat";

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function statusBadge(status: number | null, redirectTarget: string) {
  if (status === null) return <span className="url-badge url-unknown" title="Niet bereikbaar / niet gescand">?</span>;
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

export default function PagesPanel({ slug, initialProfile, clientEmail, clientName, onGoToTask }: { slug: string; initialProfile?: string; clientEmail?: string; clientName?: string; onGoToTask?: (taskId: number) => void }) {
  type Opp = { impressions: number; clicks: number; ctr: number; position: number; bestKeyword: string; bestPosition: number | null; bestVolume: number | null; score: number; label: string; level: string };
  const [opps, setOpps] = useState<Record<string, Opp>>({});
  const [sortKey, setSortKey] = useState<"kans" | "vertoningen" | "positie" | "klikken">("kans");
  const [urls, setUrls] = useState<ClientUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [profile, setProfile] = useState(initialProfile || "");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [genBusy, setGenBusy] = useState<"" | "profile" | "tov">("");
  const [genErr, setGenErr] = useState("");

  // Genereert het klantprofiel of de tone-of-voice uit de live site en voegt de
  // samenvatting samen met wat er al staat.
  async function generateProfile(kind: "profile" | "tov") {
    if (genBusy) return;
    setGenBusy(kind); setGenErr(""); setProfileOpen(true);
    try {
      const r = await fetch("/api/admin/client-profile/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, kind }) });
      const d = await r.json();
      if (!d.ok) { setGenErr(d.error || "Genereren mislukt."); return; }
      changeProfile(mergeSection(profile, String(d.section || "")));
    } catch { setGenErr("Genereren mislukt."); } finally { setGenBusy(""); }
  }

  function changeProfile(v: string) {
    setProfile(v); setProfileSaved(false);
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(async () => {
      await fetch("/api/admin/client-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, profile: v }) }).catch(() => {});
      setProfileSaved(true);
    }, 700);
  }

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

  async function scan() {
    setScanning(true); setMsg("");
    try {
      const r = await fetch("/api/admin/urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) { setMsg(`Site ingelezen: ${d.scanned} pagina's.`); await load(); }
      else setMsg(d.error || "Inlezen mislukt.");
    } catch { setMsg("Inlezen mislukt."); } finally { setScanning(false); }
  }

  // Kans-data (vertoningen/positie/beste zoekwoord) op de achtergrond ophalen.
  useEffect(() => {
    fetch(`/api/admin/page-opportunities?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) setOpps(d.pages || {}); }).catch(() => {});
  }, [slug]);

  const normUrl = (u: string) => (u || "").trim().replace(/\/+$/, "");
  const oppOf = (u: ClientUrl): Opp | undefined => opps[normUrl(u.url)];

  const filtered = q.trim()
    ? urls.filter((u) => (u.url + " " + u.title).toLowerCase().includes(q.trim().toLowerCase()))
    : urls;
  const sorted = [...filtered].sort((a, b) => {
    const oa = oppOf(a), ob = oppOf(b);
    if (sortKey === "kans") return (ob?.score || 0) - (oa?.score || 0);
    if (sortKey === "vertoningen") return (ob?.impressions ?? a.gscImpressions ?? 0) - (oa?.impressions ?? b.gscImpressions ?? 0);
    if (sortKey === "positie") { const pa = oa?.position ?? 999, pb = ob?.position ?? 999; return pa - pb; }
    return (b.gscClicks || 0) - (a.gscClicks || 0);
  });

  return (
    <div className="pages-panel">
      <div className="cockpit-card">
        <div className="ck-section-head">
          <span>Pagina&rsquo;s ({urls.length})</span>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button type="button" className="ghost-btn small" onClick={() => setImporting(true)}>Analyse importeren</button>
            <button type="button" className="primary-btn small" onClick={scan} disabled={scanning}>{scanning ? "Inlezen..." : "Website inlezen"}</button>
          </span>
        </div>
        <p className="dev-intro" style={{ marginBottom: 10 }}>
          De live pagina&rsquo;s van de klant (spiegel van de werkelijkheid). Klik een pagina om het plan te bekijken of aan te passen.
          Het toekomstige adres (redirect, nieuwe pagina) leeft in het plan en in taken, niet in deze lijst.
        </p>
        {msg && <div className="saved-msg" style={{ marginBottom: 10 }}>{msg}</div>}

        <div className="client-profile">
          <button type="button" className="client-profile-toggle" onClick={() => setProfileOpen((v) => !v)}>
            {profileOpen ? "▾" : "▸"} Klantprofiel {(profile || "").trim() ? <span className="plan-chip has">ingevuld</span> : <span className="plan-chip">leeg</span>}
            {profileSaved && <span className="focus-save-status" style={{ marginLeft: 8 }}>✓ opgeslagen</span>}
          </button>
          {profileOpen && (
            <>
              <div className="profile-note">Vul hier ook je eigen know-how over de klant in.</div>
              <div className="profile-gen-buttons">
                <button type="button" className="ghost-btn small" onClick={() => generateProfile("profile")} disabled={!!genBusy}>{genBusy === "profile" ? "Klantprofiel opstellen…" : "Klantprofiel opstellen"}</button>
                <button type="button" className="ghost-btn small" onClick={() => generateProfile("tov")} disabled={!!genBusy}>{genBusy === "tov" ? "Tone-of-voice analyseren…" : "Tone-of-voice analyse"}</button>
                <span className="muted" style={{ fontSize: 11 }}>Leest de live site en zet een concept in het veld. Jij vult aan en corrigeert.</span>
              </div>
              {genErr && <div className="login-error" style={{ marginBottom: 8 }}>{genErr}</div>}
              <textarea
                className="client-profile-area"
                value={profile}
                onChange={(e) => changeProfile(e.target.value)}
                placeholder="Wie is deze klant? Bv. werkgebied (regionaal Uden/Oss/Den Bosch, of landelijk), positionering (prijs / exclusieve designtuinen / duurzaam), doelgroep, belangrijkste diensten. De chat gebruikt dit als context en vraagt ernaar als het ontbreekt. Of laat de knoppen hierboven een concept opstellen."
              />
            </>
          )}
        </div>

        <input className="pages-search" placeholder="Zoek een pagina (URL of titel)…" value={q} onChange={(e) => setQ(e.target.value)} />

        {loading && <div className="muted" style={{ marginTop: 10 }}>Pagina&rsquo;s laden…</div>}
        {!loading && urls.length === 0 && (
          <div className="muted" style={{ marginTop: 10 }}>Nog geen pagina&rsquo;s ingelezen. Klik &ldquo;Website inlezen&rdquo; (de klant moet een domein hebben).</div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="res-table-wrap" style={{ marginTop: 12 }}>
            <table className="res-table pages-table">
              <thead><tr>
                <th>Status</th><th>Pagina</th>
                <th className="pg-sort" onClick={() => setSortKey("klikken")}>Klikken{sortKey === "klikken" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("vertoningen")}>Vertoningen{sortKey === "vertoningen" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("positie")}>Positie{sortKey === "positie" ? " ▾" : ""}</th>
                <th className="pg-sort" onClick={() => setSortKey("kans")} title="Veel vertoningen + positie net buiten de top 10 = grote kans">Kans{sortKey === "kans" ? " ▾" : ""}</th>
                <th>Plan</th>
              </tr></thead>
              <tbody>
                {sorted.map((u) => (
                  <PageRow key={u.url} slug={slug} u={u} opp={oppOf(u)} open={open === u.url} onToggle={() => setOpen(open === u.url ? null : u.url)} clientEmail={clientEmail || ""} clientName={clientName || ""} onGoToTask={onGoToTask} />
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
    </div>
  );
}

type PageOpp = { impressions: number; clicks: number; ctr: number; position: number; bestKeyword: string; bestPosition: number | null; bestVolume: number | null; score: number; label: string; level: string };
function PageRow({ slug, u, opp, open, onToggle, clientEmail, clientName, onGoToTask }: { slug: string; u: ClientUrl; opp?: PageOpp; open: boolean; onToggle: () => void; clientEmail: string; clientName: string; onGoToTask?: (taskId: number) => void }) {
  const [plan, setPlan] = useState(u.plan);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState<{ id: number | null; taak: string; fase: string; wie: string; status: string; docLink?: string; stepKind?: string }[]>([]);
  const [cleaning, setCleaning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function change(v: string) {
    setPlan(v); setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch("/api/admin/page-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: u.url, plan: v }) }).catch(() => {});
      setSaved(true);
    }, 700);
  }

  return (
    <>
      <tr className={"pages-row" + (open ? " open" : "")} onClick={onToggle}>
        <td>{statusBadge(u.status, u.redirectTarget)}</td>
        <td>
          <a href={u.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{shortUrl(u.url)}</a>
          {opp?.bestKeyword && <div className="pg-kw" title="Beste zoekwoord (meeste vertoningen), met zoekvolume en huidige positie">{opp.bestKeyword}{opp.bestVolume != null ? ` · vol ${opp.bestVolume.toLocaleString("nl-NL")}` : ""}{opp.bestPosition != null ? ` / pos ${opp.bestPosition}` : ""}</div>}
        </td>
        <td>{u.gscClicks > 0 ? u.gscClicks.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>}</td>
        <td>{opp && opp.impressions > 0 ? opp.impressions.toLocaleString("nl-NL") : (u.gscImpressions > 0 ? u.gscImpressions.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>)}</td>
        <td>{opp && opp.position ? opp.position : <span className="muted">&mdash;</span>}</td>
        <td>{opp?.label ? <span className={"pg-kans " + opp.level}>{opp.label}</span> : <span className="muted">&mdash;</span>}</td>
        <td>{(plan || "").trim() ? <span className="plan-chip has">plan</span> : <span className="plan-chip">leeg</span>}</td>
      </tr>
      {open && (
        <tr className="pages-detail-row">
          <td colSpan={7}>
            <div className="pages-detail">
              <label className="pages-detail-label">
                Plan voor deze pagina {saved && <span className="focus-save-status">opgeslagen</span>}
                <button type="button" className="ghost-btn small" style={{ marginLeft: 8 }} onClick={() => setEditing((v) => !v)}>{editing ? "Klaar" : "Bewerken"}</button>
              </label>
              {editing ? (
                <textarea
                  className="pages-plan"
                  value={plan}
                  onChange={(e) => change(e.target.value)}
                  placeholder="Netjes opgemaakt met **Rol:**, een kopje Zoekwoorden met bullets (Primair/Secundair), een kopje Acties met bullets, en **Doel-URL:**."
                />
              ) : (
                (plan || "").trim()
                  ? <div className="pages-plan-view md" dangerouslySetInnerHTML={{ __html: mdToHtml(plan) }} />
                  : <div className="pages-plan-view muted">Nog geen plan. Klik op Bewerken, of laat de chat hieronder een voorstel maken.</div>
              )}
              {u.redirectTarget && <div className="muted" style={{ marginTop: 6 }}>Live redirect: → <a href={u.redirectTarget} target="_blank" rel="noreferrer">{u.redirectTarget}</a></div>}

              {(() => {
                const pipeline = tasks.filter((t) => (t.stepKind || "").trim());
                const loose = tasks.filter((t) => !(t.stepKind || "").trim());
                return (
                  <>
                    {pipeline.length > 0 && (
                      <div className="page-tasks">
                        <div className="page-tasks-head">Werkzaamheden voor deze pagina ({pipeline.length})</div>
                        <ul className="page-tasks-list">
                          {pipeline.map((t, i) => (
                            <li key={t.id ?? i} className={"page-task" + (t.status === "Klaar" ? " done" : "")}>
                              {t.wie && <span className={"pt-wie" + (t.wie === "Dev" ? " dev" : "")}>{t.wie}</span>}
                              <span className="pt-taak" dangerouslySetInnerHTML={{ __html: t.taak }} />
                              {t.status && <span className="pt-status">{t.status}</span>}
                            </li>
                          ))}
                        </ul>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Inplannen, uren of toewijzen doe je in de Werkzaamheden-tab.</div>
                      </div>
                    )}
                    {loose.length > 0 && (
                      <div className="page-tasks-cleanup">
                        Er staan nog {loose.length} losse taken van de oude werkwijze bij deze pagina. Die horen nu in het plan, niet als aparte werkzaamheden. Kijk hieronder wat erin staat, zet over wat je wilt bewaren in het plan, en ruim dan op.
                        <ul className="page-tasks-list" style={{ marginTop: 8 }}>
                          {loose.map((t, i) => (
                            <li key={t.id ?? i} className="page-task">
                              {t.wie && <span className={"pt-wie" + (t.wie === "Dev" ? " dev" : "")}>{t.wie}</span>}
                              <span className="pt-taak" dangerouslySetInnerHTML={{ __html: t.taak }} />
                              {t.status && <span className="pt-status">{t.status}</span>}
                            </li>
                          ))}
                        </ul>
                        <button type="button" className="ghost-btn small" style={{ marginTop: 8 }} onClick={cleanupLoose} disabled={cleaning}>{cleaning ? "Opruimen…" : `Opruimen (${loose.length})`}</button>
                      </div>
                    )}
                  </>
                );
              })()}

              <PageChat slug={slug} url={u.url} clientEmail={clientEmail} clientName={clientName} onApplied={(newPlan) => { if (newPlan) setPlan(newPlan); loadTasks(); }} onGoToTask={onGoToTask} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

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

export default function PagesPanel({ slug, initialProfile, clientEmail, clientName, onGoToTask }: { slug: string; initialProfile?: string; clientEmail?: string; clientName?: string; onGoToTask?: (taskId: number) => void }) {
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

  const filtered = q.trim()
    ? urls.filter((u) => (u.url + " " + u.title).toLowerCase().includes(q.trim().toLowerCase()))
    : urls;

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
            <textarea
              className="client-profile-area"
              value={profile}
              onChange={(e) => changeProfile(e.target.value)}
              placeholder="Wie is deze klant? Bv. werkgebied (regionaal Uden/Oss/Den Bosch, of landelijk), positionering (prijs / exclusieve designtuinen / duurzaam), doelgroep, belangrijkste diensten. De chat gebruikt dit als context en vraagt ernaar als het ontbreekt."
            />
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
              <thead><tr><th>Status</th><th>Pagina</th><th>Titel</th><th>Klikken</th><th>Plan</th></tr></thead>
              <tbody>
                {filtered.map((u) => (
                  <PageRow key={u.url} slug={slug} u={u} open={open === u.url} onToggle={() => setOpen(open === u.url ? null : u.url)} clientEmail={clientEmail || ""} clientName={clientName || ""} onGoToTask={onGoToTask} />
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

function PageRow({ slug, u, open, onToggle, clientEmail, clientName, onGoToTask }: { slug: string; u: ClientUrl; open: boolean; onToggle: () => void; clientEmail: string; clientName: string; onGoToTask?: (taskId: number) => void }) {
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
      if (d.ok) setTasks(d.tasks || []);
    } catch { /* stil */ }
  }
  // Haal de taken van deze pagina op zodra hij opengeklapt wordt.
  useEffect(() => { if (open) loadTasks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

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
        <td><a href={u.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{shortUrl(u.url)}</a></td>
        <td className="pages-title">{u.title || <span className="muted">&mdash;</span>}</td>
        <td>{u.gscClicks > 0 ? u.gscClicks.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>}</td>
        <td>{(plan || "").trim() ? <span className="plan-chip has">plan</span> : <span className="plan-chip">leeg</span>}</td>
      </tr>
      {open && (
        <tr className="pages-detail-row">
          <td colSpan={5}>
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
                              {t.fase && <span className="pt-fase">{t.fase}</span>}
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
                        Er staan nog {loose.length} losse taken van de oude werkwijze bij deze pagina. Die horen nu in het plan, niet als aparte werkzaamheden.
                        <button type="button" className="ghost-btn small" style={{ marginLeft: 8 }} onClick={cleanupLoose} disabled={cleaning}>{cleaning ? "Opruimen…" : `Opruimen (${loose.length})`}</button>
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

"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientUrl } from "../../../../lib/site-urls";

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function statusBadge(status: number | null, redirectTarget: string) {
  if (status === null) return <span className="url-badge url-unknown" title="Niet bereikbaar / niet gescand">?</span>;
  if (status >= 200 && status < 300) return <span className="url-badge url-ok">{status}</span>;
  if (status >= 300 && status < 400) return <span className="url-badge url-redir" title={redirectTarget ? `→ ${redirectTarget}` : "redirect"}>{status}</span>;
  return <span className="url-badge url-bad">{status}</span>;
}

export default function PagesPanel({ slug }: { slug: string }) {
  const [urls, setUrls] = useState<ClientUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`);
      const d = await r.json();
      if (d.ok) setUrls(d.urls);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

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
          <button type="button" className="primary-btn small" onClick={scan} disabled={scanning}>{scanning ? "Inlezen..." : "Website inlezen"}</button>
        </div>
        <p className="dev-intro" style={{ marginBottom: 10 }}>
          De live pagina&rsquo;s van de klant (spiegel van de werkelijkheid). Klik een pagina om het plan te bekijken of aan te passen.
          Het toekomstige adres (redirect, nieuwe pagina) leeft in het plan en in taken, niet in deze lijst.
        </p>
        {msg && <div className="saved-msg" style={{ marginBottom: 10 }}>{msg}</div>}
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
                  <PageRow key={u.url} slug={slug} u={u} open={open === u.url} onToggle={() => setOpen(open === u.url ? null : u.url)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PageRow({ slug, u, open, onToggle }: { slug: string; u: ClientUrl; open: boolean; onToggle: () => void }) {
  const [plan, setPlan] = useState(u.plan);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
              <label className="pages-detail-label">Plan voor deze pagina {saved && <span className="focus-save-status">✓ opgeslagen</span>}</label>
              <textarea
                className="pages-plan"
                value={plan}
                onChange={(e) => change(e.target.value)}
                placeholder="Bijv. Rol: hub. Primair: soa test amsterdam. Actie: behouden + optimaliseren. Doel-URL: /soa-test-amsterdam/."
              />
              {u.redirectTarget && <div className="muted" style={{ marginTop: 6 }}>Live redirect: → {u.redirectTarget}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

type ArrayDiff = { added: string[]; removed: string[] };
type FieldChange = { before: string; after: string };
type ContentDiff = {
  meta_title?: FieldChange;
  meta_description?: FieldChange;
  h1?: FieldChange;
  h2s?: ArrayDiff;
  h3s?: ArrayDiff;
  alt_tags?: { added: { src: string; alt: string }[]; removed: { src: string; alt: string }[]; changed: { src: string; before: string; after: string }[] };
  internal_links?: { added: { href: string; text: string }[]; removed: { href: string; text: string }[] };
  word_count?: { before: number; after: number; delta: number };
  schema_types?: ArrayDiff;
};
type ChangeEvent = { id: number; url: string; detectedAt: string; summary: string; diff: ContentDiff; isManual?: boolean };

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function dt(iso: string): string {
  try { return new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

function Field({ label, change }: { label: string; change: FieldChange }) {
  return (
    <div className="wz-block">
      <div className="wz-block-head">{label}</div>
      {change.before && <div className="wz-line removed"><span className="wz-sign">-</span> {change.before}</div>}
      {change.after && <div className="wz-line added"><span className="wz-sign">+</span> {change.after}</div>}
    </div>
  );
}
function Arr({ label, diff }: { label: string; diff: ArrayDiff }) {
  if (!diff.added.length && !diff.removed.length) return null;
  return (
    <div className="wz-block">
      <div className="wz-block-head">{label}</div>
      {diff.removed.map((x, i) => <div key={"r" + i} className="wz-line removed"><span className="wz-sign">-</span> {x}</div>)}
      {diff.added.map((x, i) => <div key={"a" + i} className="wz-line added"><span className="wz-sign">+</span> {x}</div>)}
    </div>
  );
}

type Day = { date: string; clicks: number; impressions: number; ctr: number; position: number };
type KwBA = { keyword: string; positionBefore: number | null; positionAfter: number | null; clicksBefore: number; clicksAfter: number };
type Ga4Stat = { views: number; timeOnPage: number; bounceRate: number; engagementRate: number; pagesPerSession: number; sessionDuration: number };
type Ga4 = { available: boolean; before: Ga4Stat; after: Ga4Stat };
type Kpi = { changeDate: string; daily: Day[]; keywords: KwBA[]; ga4: Ga4 | null };

function secs(s: number): string { if (!s) return "0s"; const m = Math.floor(s / 60), r = s % 60; return m ? `${m}m ${r}s` : `${r}s`; }
// Voor sommige signalen is hoger beter (engagement, tijd, views, pagina's/sessie),
// voor bounce rate is lager beter.
function ga4Rows(g: Ga4): { label: string; b: string; a: string; better: boolean | null }[] {
  const dir = (a: number, b: number, higherBetter: boolean): boolean | null => a === b ? null : (higherBetter ? a > b : a < b);
  return [
    { label: "Gem. tijd op pagina", b: secs(g.before.timeOnPage), a: secs(g.after.timeOnPage), better: dir(g.after.timeOnPage, g.before.timeOnPage, true) },
    { label: "Engagement rate", b: `${g.before.engagementRate}%`, a: `${g.after.engagementRate}%`, better: dir(g.after.engagementRate, g.before.engagementRate, true) },
    { label: "Bounce rate", b: `${g.before.bounceRate}%`, a: `${g.after.bounceRate}%`, better: dir(g.after.bounceRate, g.before.bounceRate, false) },
    { label: "Pagina's per sessie", b: String(g.before.pagesPerSession), a: String(g.after.pagesPerSession), better: dir(g.after.pagesPerSession, g.before.pagesPerSession, true) },
    { label: "Sessieduur", b: secs(g.before.sessionDuration), a: secs(g.after.sessionDuration), better: dir(g.after.sessionDuration, g.before.sessionDuration, true) },
    { label: "Weergaven", b: String(g.before.views), a: String(g.after.views), better: dir(g.after.views, g.before.views, true) },
  ];
}

// Mini-lijngrafiek met een stippellijn op het wijzigingsmoment. Bij positie is
// lager beter, dus die keren we om (verbetering = omhoog).
function Spark({ data, changeDate, metric, invert }: { data: Day[]; changeDate: string; metric: keyof Day; invert?: boolean }) {
  const w = 360, h = 84, pad = 8;
  const pts = data.filter((d) => d.date);
  if (pts.length < 2) return <div className="muted" style={{ fontSize: 12, padding: "18px 0" }}>Nog te weinig GSC-data voor deze periode.</div>;
  const vals = pts.map((d) => Number(d[metric]) || 0);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
  const y = (v: number) => { const t = (v - min) / range; return invert ? pad + t * (h - 2 * pad) : (h - pad) - t * (h - 2 * pad); };
  const line = pts.map((d, i) => `${x(i).toFixed(1)},${y(Number(d[metric]) || 0).toFixed(1)}`).join(" ");
  const ci = pts.findIndex((d) => d.date >= changeDate);
  const cx = ci > 0 ? x(ci) : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="wz-spark" preserveAspectRatio="none">
      {cx !== null && <line x1={cx} y1={0} x2={cx} y2={h} className="wz-marker" />}
      <polyline points={line} className={"wz-poly " + (metric === "position" ? "pos" : "")} />
    </svg>
  );
}

function KpiBlock({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="wz-kpi-block">
      <div className="wz-kpi-label">{label}{sub && <span className="wz-kpi-sub"> {sub}</span>}</div>
      {children}
    </div>
  );
}

function DiffView({ diff }: { diff: ContentDiff }) {
  return (
    <div className="wz-diff">
      {diff.meta_title && <Field label="Paginatitel" change={diff.meta_title} />}
      {diff.meta_description && <Field label="Meta-beschrijving" change={diff.meta_description} />}
      {diff.h1 && <Field label="H1" change={diff.h1} />}
      {diff.h2s && <Arr label="H2-koppen" diff={diff.h2s} />}
      {diff.h3s && <Arr label="H3-koppen" diff={diff.h3s} />}
      {diff.alt_tags && (diff.alt_tags.added.length + diff.alt_tags.removed.length + diff.alt_tags.changed.length > 0) && (
        <div className="wz-block">
          <div className="wz-block-head">Alt-teksten</div>
          {diff.alt_tags.removed.map((a, i) => <div key={"ar" + i} className="wz-line removed"><span className="wz-sign">-</span> <em>{a.alt || "geen alt-tekst"}</em> <span className="wz-file">{a.src}</span></div>)}
          {diff.alt_tags.added.map((a, i) => <div key={"aa" + i} className="wz-line added"><span className="wz-sign">+</span> <em>{a.alt || "geen alt-tekst"}</em> <span className="wz-file">{a.src}</span></div>)}
          {diff.alt_tags.changed.map((a, i) => <div key={"ac" + i} className="wz-line changed"><span className="wz-file">{a.src}</span>: <em>{a.before || "leeg"}</em> → <em>{a.after || "leeg"}</em></div>)}
        </div>
      )}
      {diff.internal_links && (diff.internal_links.added.length + diff.internal_links.removed.length > 0) && (
        <div className="wz-block">
          <div className="wz-block-head">Interne links</div>
          {diff.internal_links.removed.map((l, i) => <div key={"lr" + i} className="wz-line removed"><span className="wz-sign">-</span> {l.text || l.href} <span className="wz-file">{l.href}</span></div>)}
          {diff.internal_links.added.map((l, i) => <div key={"la" + i} className="wz-line added"><span className="wz-sign">+</span> {l.text || l.href} <span className="wz-file">{l.href}</span></div>)}
        </div>
      )}
      {diff.word_count && (
        <div className="wz-block">
          <div className="wz-block-head">Woordenaantal</div>
          <div className="wz-line"><span className={diff.word_count.delta >= 0 ? "wz-pos" : "wz-neg"}>{diff.word_count.delta > 0 ? "+" : ""}{diff.word_count.delta}</span> ({diff.word_count.before} → {diff.word_count.after})</div>
        </div>
      )}
      {diff.schema_types && <Arr label="Schema-types" diff={diff.schema_types} />}
    </div>
  );
}

export default function WijzigingenPanel({ slug }: { slug: string }) {
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<ChangeEvent | null>(null);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  // Handmatig een bekende wijziging toevoegen
  const [showAdd, setShowAdd] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [addUrl, setAddUrl] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  // WordPress-koppeling (applicatiewachtwoord voor de volledige historie)
  const [wpSet, setWpSet] = useState(false);
  const [wpSetupOpen, setWpSetupOpen] = useState(false);
  const [wpUser, setWpUser] = useState("");
  const [wpPass, setWpPass] = useState("");
  const [wpSaveBusy, setWpSaveBusy] = useState(false);
  const [wpSaveMsg, setWpSaveMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/wp-creds?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) { setWpSet(!!d.set); setWpUser(d.user || ""); } }).catch(() => {});
  }, [slug]);

  async function saveWpCreds() {
    if (!wpUser.trim() || !wpPass.trim() || wpSaveBusy) return;
    setWpSaveBusy(true); setWpSaveMsg("");
    try {
      const r = await fetch("/api/admin/wp-creds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, user: wpUser.trim(), appPassword: wpPass.trim() }) });
      const d = await r.json();
      if (d.ok) { setWpSet(true); setWpPass(""); setWpSaveMsg("Inloggegevens opgeslagen en getest."); }
      else setWpSaveMsg(d.error || "Opslaan mislukt.");
    } catch { setWpSaveMsg("Opslaan mislukt."); } finally { setWpSaveBusy(false); }
  }
  async function removeWpCreds() {
    setWpSaveBusy(true); setWpSaveMsg("");
    try {
      await fetch("/api/admin/wp-creds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "delete" }) });
      setWpSet(false); setWpPass(""); setWpSaveMsg("Koppeling verwijderd.");
    } catch { /* stil */ } finally { setWpSaveBusy(false); }
  }

  useEffect(() => {
    fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) setUrls((d.urls || []).map((u: { url: string }) => u.url)); }).catch(() => {});
  }, [slug]);

  async function addManual() {
    if (!addUrl || !addDate || addBusy) return;
    setAddBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: addUrl, date: addDate, note: addNote }) });
      const d = await r.json();
      if (d.ok) { setShowAdd(false); setAddUrl(""); setAddDate(""); setAddNote(""); setMsg("Wijziging toegevoegd. Open hem voor de KPI-ontwikkeling."); await load(); }
      else setMsg(d.error || "Toevoegen mislukt.");
    } catch { setMsg("Toevoegen mislukt."); } finally { setAddBusy(false); }
  }

  useEffect(() => {
    if (!open) { setKpi(null); return; }
    let alive = true;
    setKpiLoading(true); setKpi(null);
    fetch(`/api/admin/changes/kpi?slug=${encodeURIComponent(slug)}&id=${open.id}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) setKpi({ changeDate: d.changeDate, daily: d.daily || [], keywords: d.keywords || [], ga4: d.ga4 || null }); })
      .catch(() => { /* stil */ }).finally(() => { if (alive) setKpiLoading(false); });
    return () => { alive = false; };
  }, [open, slug]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/changes?slug=${encodeURIComponent(slug)}`);
      const d = await r.json();
      if (d.ok) setEvents(d.events || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  async function scan() {
    setScanning(true); setMsg("");
    try {
      const r = await fetch("/api/admin/content-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) { setMsg(`${d.scanned} pagina's gescand, ${d.changed} wijziging${d.changed === 1 ? "" : "en"} gevonden.`); await load(); }
      else setMsg(d.error || "Scan mislukt.");
    } catch { setMsg("Scan mislukt."); } finally { setScanning(false); }
  }

  const [wpBusy, setWpBusy] = useState(false);
  async function syncWordpress() {
    setWpBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/changes/wordpress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) { setMsg(`WordPress: ${d.scanned} pagina's bekeken, ${d.added} nieuwe wijziging${d.added === 1 ? "" : "en"} toegevoegd (met datum).`); await load(); }
      else setMsg(d.error || "Ophalen uit WordPress mislukt.");
    } catch { setMsg("Ophalen uit WordPress mislukt."); } finally { setWpBusy(false); }
  }

  if (open) {
    return (
      <div className="cockpit-card">
        <button type="button" className="ghost-btn small" onClick={() => setOpen(null)}>← Alle wijzigingen</button>
        <h2 className="wz-title">{open.diff.meta_title?.after || open.diff.h1?.after || shortUrl(open.url)}</h2>
        <div className="muted" style={{ marginBottom: 14 }}>{shortUrl(open.url)} · Gedetecteerd: {dt(open.detectedAt)}</div>
        <div className="wz-detail-grid">
          <div>
            <div className="wz-block-head" style={{ fontSize: 13 }}>Wat veranderde</div>
            {open.isManual
              ? <div className="wz-line" style={{ background: "#fff6e5" }}>Handmatig toegevoegd: {open.summary || "wijziging"}</div>
              : <DiffView diff={open.diff} />}
          </div>
          <div>
            <div className="wz-block-head" style={{ fontSize: 13 }}>KPI-impact</div>
            <p className="muted" style={{ fontSize: 12, margin: "2px 0 10px" }}>60 dagen voor en na de wijziging (uit Search Console). De stippellijn markeert het wijzigingsmoment.</p>
            {kpiLoading && <div className="muted" style={{ padding: 12 }}>KPI's laden…</div>}
            {!kpiLoading && kpi && (
              <div className="wz-kpi">
                <KpiBlock label="Kliks per dag"><Spark data={kpi.daily} changeDate={kpi.changeDate} metric="clicks" /></KpiBlock>
                <KpiBlock label="Vertoningen per dag"><Spark data={kpi.daily} changeDate={kpi.changeDate} metric="impressions" /></KpiBlock>
                <KpiBlock label="Gem. positie" sub="(lager = beter)"><Spark data={kpi.daily} changeDate={kpi.changeDate} metric="position" invert /></KpiBlock>
                <KpiBlock label="CTR"><Spark data={kpi.daily} changeDate={kpi.changeDate} metric="ctr" /></KpiBlock>
                {kpi.keywords.length > 0 && (
                  <div className="wz-kw">
                    <div className="wz-kpi-label">Keyword-rankings (voor → na)</div>
                    <table className="wz-kw-table">
                      <thead><tr><th>Zoekwoord</th><th>Positie voor</th><th>Positie na</th><th>Kliks</th></tr></thead>
                      <tbody>
                        {kpi.keywords.map((k) => {
                          const improved = k.positionBefore != null && k.positionAfter != null && k.positionAfter < k.positionBefore;
                          const worse = k.positionBefore != null && k.positionAfter != null && k.positionAfter > k.positionBefore;
                          return (
                            <tr key={k.keyword}>
                              <td>{k.keyword}</td>
                              <td>{k.positionBefore ?? "—"}</td>
                              <td className={improved ? "wz-pos" : worse ? "wz-neg" : ""}>{k.positionAfter ?? "—"}</td>
                              <td>{k.clicksBefore} → {k.clicksAfter}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {kpi.ga4 && kpi.ga4.available && (
                  <div className="wz-kw">
                    <div className="wz-kpi-label">Gedragssignalen (GA4, voor → na)</div>
                    <table className="wz-kw-table">
                      <thead><tr><th>Signaal</th><th>Voor</th><th>Na</th></tr></thead>
                      <tbody>
                        {ga4Rows(kpi.ga4).map((r) => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            <td>{r.b}</td>
                            <td className={r.better === true ? "wz-pos" : r.better === false ? "wz-neg" : ""}>{r.a}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {kpi.daily.length < 2 && kpi.keywords.length === 0 && !(kpi.ga4 && kpi.ga4.available) && (
                  <div className="muted" style={{ fontSize: 12 }}>Nog geen GSC-data voor deze periode (Search Console loopt 1-3 dagen achter, en na een verse wijziging is er nog weinig data ná het moment).</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cockpit-card">
      <div className="ck-section-head">
        <span>Wijzigingen ({events.length})</span>
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button type="button" className="ghost-btn small" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Sluiten" : "Wijziging toevoegen"}</button>
          <button type="button" className="ghost-btn small" onClick={() => setWpSetupOpen((v) => !v)} title="WordPress-applicatiewachtwoord instellen voor de volledige bewerkingshistorie">WordPress-koppeling {wpSet ? "✓" : ""}</button>
          <button type="button" className="ghost-btn small" onClick={syncWordpress} disabled={wpBusy} title={wpSet ? "Haalt de volledige bewerkingshistorie (revisies) uit WordPress" : "Haalt per pagina de laatste wijzigingsdatum op (stel een koppeling in voor de volledige historie)"}>{wpBusy ? "Uit WordPress…" : (wpSet ? "Uit WordPress ophalen (historie)" : "Uit WordPress ophalen")}</button>
          <button type="button" className="ghost-btn small" onClick={scan} disabled={scanning}>{scanning ? "Scannen…" : "Scan op wijzigingen"}</button>
        </span>
      </div>
      {wpSetupOpen && (
        <div className="wz-add">
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Voor de volledige bewerkingshistorie (wat is wanneer veranderd) heeft het dashboard een WordPress-applicatiewachtwoord nodig. Maak dat in WordPress-beheer aan: <strong>Gebruikers → Profiel → Wachtwoorden voor applicaties</strong>, geef het een naam (bijv. &ldquo;Pingwin dashboard&rdquo;), en plak de getoonde code hieronder. Zonder koppeling haalt de knop alleen de laatste wijzigingsdatum per pagina op.
          </div>
          <div className="wz-add-row">
            <input className="compose-input" value={wpUser} onChange={(e) => setWpUser(e.target.value)} placeholder="WordPress-gebruikersnaam" />
            <input className="compose-input" type="password" value={wpPass} onChange={(e) => setWpPass(e.target.value)} placeholder="Applicatiewachtwoord (xxxx xxxx xxxx …)" />
          </div>
          <div style={{ marginTop: 8, display: "inline-flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="primary-btn small" onClick={saveWpCreds} disabled={wpSaveBusy || !wpUser.trim() || !wpPass.trim()}>{wpSaveBusy ? "Testen…" : "Opslaan en testen"}</button>
            {wpSet && <button type="button" className="ghost-btn small" onClick={removeWpCreds} disabled={wpSaveBusy}>Koppeling verwijderen</button>}
            {wpSet && <span className="muted" style={{ fontSize: 12 }}>Ingesteld{wpUser ? ` (${wpUser})` : ""}.</span>}
          </div>
          {wpSaveMsg && <div className={wpSaveMsg.includes("mislukt") || wpSaveMsg.includes("werk") ? "login-error" : "saved-msg"} style={{ marginTop: 8 }}>{wpSaveMsg}</div>}
        </div>
      )}
      {showAdd && (
        <div className="wz-add">
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Een bekende aanpassing uit het verleden vastleggen (bijv. Hovenier Den Bosch, 2 weken terug), zodat je de KPI-ontwikkeling eromheen kunt volgen.</div>
          <div className="wz-add-row">
            <select className="compose-input" value={addUrl} onChange={(e) => setAddUrl(e.target.value)}>
              <option value="">Kies een pagina…</option>
              {urls.map((u) => <option key={u} value={u}>{shortUrl(u)}</option>)}
            </select>
            <input className="compose-input" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
          </div>
          <input className="compose-input" style={{ marginTop: 8 }} value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Wat is er aangepast? (bijv. nieuwe H1 + intro herschreven)" />
          <div style={{ marginTop: 8 }}>
            <button type="button" className="primary-btn small" onClick={addManual} disabled={!addUrl || !addDate || addBusy}>{addBusy ? "Toevoegen…" : "Toevoegen"}</button>
          </div>
        </div>
      )}
      <p className="muted" style={{ marginTop: 4 }}>Detecteert automatisch wat er op de live pagina's verandert (titel, koppen, alt-teksten, interne links, woordenaantal, schema). De eerste scan legt de basislijn vast; daarna zie je hier elke wijziging.</p>
      {msg && <div className="saved-msg" style={{ marginTop: 8 }}>{msg}</div>}
      {loading && <div className="muted" style={{ padding: 12 }}>Laden…</div>}
      {!loading && events.length === 0 && <div className="muted" style={{ padding: 12 }}>Nog geen wijzigingen. Draai een scan (basislijn), en na een volgende scan verschijnen hier de veranderingen.</div>}
      <div className="wz-list">
        {events.map((e) => (
          <button key={e.id} type="button" className="wz-item" onClick={() => setOpen(e)}>
            <div className="wz-item-main">
              <div className="wz-item-title">{e.diff.meta_title?.after || e.diff.h1?.after || shortUrl(e.url)}</div>
              <div className="wz-item-sub">{shortUrl(e.url)} · {e.summary}{e.isManual ? " · handmatig" : ""}</div>
            </div>
            <div className="wz-item-date">{dt(e.detectedAt)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

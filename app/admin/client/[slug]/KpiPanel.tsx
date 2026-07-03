"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GscComparison, Ga4Comparison } from "../../../../lib/google";
import type { AhrefsKeyword } from "../../../../lib/ahrefs-keywords";
import type { Opportunity } from "../../../../lib/keyword-opportunities";
import HelpHint from "./HelpHint";

type GscPage = GscComparison["pages"][number];

// Sorteert pagina's op de opgeslagen (gesleepte) volgorde; de rest blijft
// onderaan in de volgorde die de API teruggeeft (op klikken).
function sortByOrder(pages: GscPage[], order: string[]): GscPage[] {
  const idx = new Map(order.map((u, i) => [u, i] as const));
  return [...pages].sort((a, b) => {
    const ia = idx.has(a.url) ? (idx.get(a.url) as number) : Infinity;
    const ib = idx.has(b.url) ? (idx.get(b.url) as number) : Infinity;
    return ia - ib;
  });
}

const PERIODS = [
  { days: 7, label: "7 dagen" },
  { days: 28, label: "28 dagen" },
  { days: 90, label: "3 maanden" },
  { days: 180, label: "6 maanden" },
  { days: 365, label: "12 maanden" },
];

const GA4_LABELS: Record<string, string> = { totalUsers: "Gebruikers", sessions: "Sessies", conversions: "Conversies" };

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function nl(n: number): string { return n.toLocaleString("nl-NL"); }

// Interactief lijngrafiekje van het dagverloop: beweeg eroverheen en je ziet de
// waarde van dat punt. invert=true (positie): dalend = beter. fmt formatteert de
// hover-waarde (bijv. "12,3%" of "4,2").
function Sparkline({ data, invert, fmt }: { data: number[]; invert?: boolean; fmt?: (v: number) => string }) {
  const [hi, setHi] = useState<number | null>(null);
  if (!data || data.length < 2) return null;
  const w = 120, h = 34, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const xy = (v: number, i: number) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  });
  const pts = data.map((v, i) => { const p = xy(v, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
  const first = data[0], last = data[data.length - 1];
  const improved = invert ? last < first : last > first;
  const color = last === first ? "#9e9e9e" : improved ? "#2E7D32" : "#C62828";
  const format = fmt || ((v: number) => nl(Math.round(v)));
  const hp = hi !== null ? xy(data[hi], hi) : null;
  return (
    <div className="kpi-spark-wrap" onMouseLeave={() => setHi(null)}>
      <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {hp && <line x1={hp.x} y1={0} x2={hp.x} y2={h} className="kpi-spark-hline" />}
        {hp && <circle cx={hp.x} cy={hp.y} r={2.8} fill={color} stroke="#fff" strokeWidth={1} />}
        {data.map((v, i) => { const p = xy(v, i); return <rect key={i} x={p.x - (w / data.length) / 2} y={0} width={w / data.length} height={h} fill="transparent" onMouseEnter={() => setHi(i)} />; })}
      </svg>
      {hi !== null && <div className="kpi-spark-tip" style={{ left: `${(hi / (data.length - 1)) * 100}%` }}>{format(data[hi])}</div>}
    </div>
  );
}

// Toont de verandering t.o.v. de vorige periode. invert=true voor 'positie'
// (lager is beter). pct=true toont het procentuele verschil erbij.
function Delta({ cur, prev, invert, pct, isPos }: { cur: number; prev: number; invert?: boolean; pct?: boolean; isPos?: boolean }) {
  if ((prev === 0 && cur === 0)) return <span className="kpi-delta flat">–</span>;
  const diff = cur - prev;
  const flat = Math.abs(diff) < (isPos ? 0.05 : 0.5);
  const improved = invert ? diff < 0 : diff > 0;
  const cls = flat ? "flat" : improved ? "up" : "down";
  const arrow = flat ? "→" : improved ? "▲" : "▼";
  const abs = isPos ? Math.abs(diff).toFixed(1) : nl(Math.abs(Math.round(diff)));
  const pctTxt = pct && prev !== 0 ? ` (${diff >= 0 ? "+" : "−"}${Math.abs(Math.round((diff / prev) * 100))}%)` : "";
  return <span className={"kpi-delta " + cls}>{arrow} {abs}{pctTxt}</span>;
}

// ── Sorteerbare kolomkoppen ──────────────────────────────────
type SortDir = "asc" | "desc";
type Sort<K extends string> = { key: K; dir: SortDir } | null;

// Klik-cyclus per kop: aflopend → oplopend → uit (originele volgorde).
function SortTh<K extends string>({ label, k, sort, setSort, className }: { label: string; k: K; sort: Sort<K>; setSort: (s: Sort<K>) => void; className?: string }) {
  const active = sort?.key === k;
  const arrow = active ? (sort!.dir === "asc" ? " ▲" : " ▼") : "";
  function onClick() {
    if (!active) return setSort({ key: k, dir: "desc" });
    if (sort!.dir === "desc") return setSort({ key: k, dir: "asc" });
    return setSort(null);
  }
  return <th className={"pg-sort" + (className ? " " + className : "")} onClick={onClick} title="Klik om te sorteren (aflopend → oplopend → uit)">{label}{arrow}</th>;
}

function applySort<T, K extends string>(rows: T[], sort: Sort<K>, getters: Record<K, (r: T) => number | string>): T[] {
  if (!sort) return rows;
  const g = getters[sort.key];
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = g(a), bv = g(b);
    if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * dir;
    return (av - bv) * dir;
  });
}

type FocusTier = "prio" | "secundair";
type Kw = GscComparison["keywords"][number];
type KwKey = "focus" | "keyword" | "position" | "clicks" | "impressions" | "ctr";
type AhKey = "focus" | "keyword" | "volume" | "position" | "intent" | "kans";
type OppKey = "focus" | "keyword" | "volume" | "difficulty" | "source" | "reason";
type PageKey = "url" | "clicks" | "impressions";

// Compacte prio/secundair-keuze per zoekwoord.
function FocusSelect({ tier, onChange }: { tier: FocusTier | undefined; onChange: (t: FocusTier | null) => void }) {
  return (
    <select className={"kpi-focus-select" + (tier ? " set-" + tier : "")} value={tier || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange((e.target.value || null) as FocusTier | null)} title="Markeer als prio- of secundair-zoekwoord">
      <option value="">—</option>
      <option value="prio">Prio</option>
      <option value="secundair">Sec.</option>
    </select>
  );
}

// In- en uitklapbare (sub)sectie. sub=true = een subgroep binnen een hoofdsectie.
// De titel klapt in/uit; eventuele actieknoppen staan ernaast (klappen niet mee).
function Collapse({ sub, title, meta, open, onToggle, actions, children }: { sub?: boolean; title: ReactNode; meta?: string; open: boolean; onToggle: () => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className={sub ? "kpi-sub" : "cockpit-card kpi-section"}>
      <div className={sub ? "kpi-sub-head" : "kpi-section-head"}>
        <button type="button" className={sub ? "kpi-sub-toggle" : "kpi-section-toggle"} onClick={onToggle}>
          <span className="kpi-caret">{open ? "▾" : "▸"}</span>
          <span className={sub ? "kpi-sub-title" : "kpi-section-title"}>{title}</span>
          {meta && <span className="ck-updated">{meta}</span>}
        </button>
        {actions && <span className="kpi-head-actions">{actions}</span>}
      </div>
      {open && <div className={sub ? "kpi-sub-body" : "kpi-section-body"}>{children}</div>}
    </div>
  );
}

export default function KpiPanel({ slug, domain }: { slug: string; domain: string }) {
  // Open/dicht per (sub)sectie. Hoofdsecties staan standaard open, subsecties dicht.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ sc: true, ahrefs: true, ga: true });
  const isOpen = (id: string, def = false) => openMap[id] ?? def;
  const toggle = (id: string, def = false) => setOpenMap((m) => ({ ...m, [id]: !(m[id] ?? def) }));

  const [days, setDays] = useState(28);
  const [gsc, setGsc] = useState<GscComparison | null>(null);
  const [ga4, setGa4] = useState<Ga4Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean>(true);
  const [pagesView, setPagesView] = useState<GscPage[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focus, setFocus] = useState<Record<string, FocusTier>>({});
  const [kwSort, setKwSort] = useState<Sort<KwKey>>(null);
  const [focusSort, setFocusSort] = useState<Sort<KwKey>>(null);
  const [pageSort, setPageSort] = useState<Sort<PageKey>>(null);
  const [oppSort, setOppSort] = useState<Sort<OppKey>>(null);
  // Rangschikt de focus-markering voor sortering: prio eerst, dan secundair, dan de rest.
  const focusRank = (kw: string) => (focus[kw] === "prio" ? 0 : focus[kw] === "secundair" ? 1 : 2);
  const kwGetters: Record<KwKey, (k: Kw) => number | string> = {
    focus: (k) => focusRank(k.keyword), keyword: (k) => k.keyword, position: (k) => k.position, clicks: (k) => k.clicks, impressions: (k) => k.impressions, ctr: (k) => k.ctr,
  };

  useEffect(() => {
    let off = false;
    setLoading(true);
    fetch(`/api/admin/kpi?slug=${encodeURIComponent(slug)}&days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        setGsc(d.gsc ?? null);
        setGa4(d.ga4 ?? null);
        setConnected(!!(d.gsc || d.ga4));
        setFocus(d.keywordFocus || {});
        const pages: GscPage[] = d.gsc?.pages || [];
        setPagesView(sortByOrder(pages, Array.isArray(d.pageOrder) ? d.pageOrder : []));
      })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [slug, days]);

  // Markeert of wist prio/secundair voor één zoekwoord (optimistisch, dan opslaan).
  function markFocus(keyword: string, tier: FocusTier | null) {
    setFocus((f) => { const n = { ...f }; if (tier) n[keyword] = tier; else delete n[keyword]; return n; });
    fetch("/api/admin/kpi/keyword-focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, keyword, tier }) }).catch(() => {});
  }

  // Ahrefs-zoekwoorden (domein-brede pool + laaghangend fruit).
  const [ahrefsKw, setAhrefsKw] = useState<AhrefsKeyword[]>([]);
  const [ahrefsBusy, setAhrefsBusy] = useState(false);
  const [ahrefsMsg, setAhrefsMsg] = useState("");
  const [onlyFruit, setOnlyFruit] = useState(false);
  const [ahSort, setAhSort] = useState<Sort<AhKey>>(null);

  useEffect(() => {
    fetch(`/api/admin/ahrefs-keywords?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) setAhrefsKw(d.keywords || []); }).catch(() => {});
  }, [slug]);

  async function syncAhrefs() {
    if (ahrefsBusy) return;
    setAhrefsBusy(true); setAhrefsMsg("");
    try {
      const r = await fetch("/api/admin/ahrefs-keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) {
        setAhrefsMsg(`${d.total} zoekwoorden opgehaald uit Ahrefs.`);
        const g = await fetch(`/api/admin/ahrefs-keywords?slug=${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
        if (g?.ok) setAhrefsKw(g.keywords || []);
      } else setAhrefsMsg(d.error || "Ophalen mislukt.");
    } catch { setAhrefsMsg("Ophalen mislukt."); } finally { setAhrefsBusy(false); }
  }

  // Laaghangend fruit: commerciële/transactionele intent + volume, net buiten de top (positie 4-20).
  const isFruit = (k: AhrefsKeyword) =>
    (k.intent === "commercieel" || k.intent === "transactioneel") &&
    (k.volume || 0) >= 50 && k.position != null && k.position >= 4 && k.position <= 20;

  // Zoekwoord-kansen (relevant, waar de site nog niet op rankt).
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [oppBusy, setOppBusy] = useState(false);
  const [oppMsg, setOppMsg] = useState("");
  useEffect(() => {
    fetch(`/api/admin/keyword-opportunities?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) setOpps(d.opportunities || []); }).catch(() => {});
  }, [slug]);
  async function collectOpps() {
    if (oppBusy) return;
    setOppBusy(true); setOppMsg("");
    try {
      const r = await fetch("/api/admin/keyword-opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) {
        setOppMsg(`${d.total} relevante kansen gevonden.`);
        const g = await fetch(`/api/admin/keyword-opportunities?slug=${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
        if (g?.ok) setOpps(g.opportunities || []);
      } else setOppMsg(d.error || "Zoeken mislukt.");
    } catch { setOppMsg("Zoeken mislukt."); } finally { setOppBusy(false); }
  }

  // Concurrenten (voor de gap-bron van de kansen).
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [compInputs, setCompInputs] = useState<string[]>(["", "", "", ""]);
  const [compOpen, setCompOpen] = useState(false);
  const [compBusy, setCompBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/admin/competitors?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) { setCompetitors(d.competitors || []); setCompInputs([...(d.competitors || []), "", "", "", ""].slice(0, 4)); } }).catch(() => {});
  }, [slug]);
  async function saveCompetitors() {
    if (compBusy) return;
    setCompBusy(true);
    try {
      const r = await fetch("/api/admin/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, domains: compInputs }) });
      const d = await r.json();
      if (d.ok) { setCompetitors(d.competitors || []); setCompInputs([...(d.competitors || []), "", "", "", ""].slice(0, 4)); }
    } catch { /* stil */ } finally { setCompBusy(false); }
  }

  // Sla de gesleepte volgorde op (kort debounce).
  function persistOrder(urls: string[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/admin/kpi/page-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, urls }),
      }).catch(() => {});
    }, 500);
  }

  function movePage(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); return; }
    const c = [...pagesView];
    const [moved] = c.splice(dragIdx, 1);
    const ins = toIdx > dragIdx ? toIdx - 1 : toIdx;
    c.splice(ins, 0, moved);
    setDragIdx(null);
    setPagesView(c);
    persistOrder(c.map((p) => p.url));
  }

  const periodLabel = PERIODS.find((p) => p.days === days)?.label || `${days} dagen`;

  // Afgeleide lijsten: focus-zoekwoorden (prio eerst), gesorteerde zoekwoorden en pagina's.
  const allKws: Kw[] = gsc?.keywords || [];
  const focusedKws = applySort(
    [...allKws.filter((k) => focus[k.keyword])].sort((a, b) => (focus[a.keyword] === "prio" ? 0 : 1) - (focus[b.keyword] === "prio" ? 0 : 1)),
    focusSort, kwGetters,
  );
  const sortedKws = applySort(allKws, kwSort, kwGetters);
  const pageGetters: Record<"url" | "clicks" | "impressions", (p: GscPage) => number | string> = {
    url: (p) => shortUrl(p.url), clicks: (p) => p.clicks, impressions: (p) => p.impressions,
  };
  const sortedPages = applySort(pagesView, pageSort, pageGetters);

  const ahGetters: Record<AhKey, (k: AhrefsKeyword) => number | string> = {
    focus: (k) => focusRank(k.keyword), keyword: (k) => k.keyword, volume: (k) => k.volume || 0, position: (k) => k.position ?? 999, intent: (k) => k.intent, kans: (k) => (isFruit(k) ? 0 : 1),
  };
  const ahFiltered = ahrefsKw.filter((k) => !k.branded && (onlyFruit ? isFruit(k) : true));
  const ahSorted = applySort(ahFiltered, ahSort, ahGetters);
  const fruitCount = ahrefsKw.filter((k) => !k.branded && isFruit(k)).length;

  const oppGetters: Record<OppKey, (o: Opportunity) => number | string> = {
    focus: (o) => focusRank(o.keyword), keyword: (o) => o.keyword, volume: (o) => o.volume ?? 0, difficulty: (o) => o.difficulty ?? 0, source: (o) => o.source, reason: (o) => o.reason || "",
  };
  const oppSorted = applySort(opps, oppSort, oppGetters);

  return (
    <div className="kpi-panel">
      <div className="kpi-toolbar">
        <div className="kpi-toolbar-title">Search Console &amp; Analytics</div>
        <div className="kpi-toolbar-right">
          <span className="kpi-compare-note">vergeleken met vorige {periodLabel}</span>
          <select className="kpi-period-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="cockpit-card"><div className="muted">KPI&rsquo;s laden…</div></div>}

      {!loading && !connected && (
        <div className="cockpit-card">
          <div className="mail-connect">
            Koppel Google om Search Console en Analytics te tonen.{" "}
            <a className="primary-btn small" href="/api/google/auth/start">Koppel Google</a>
          </div>
        </div>
      )}

      {!loading && gsc && gsc.site === null && (
        <div className="cockpit-card"><div className="phase2-note">Google is gekoppeld, maar er is nog geen Search Console-property gevonden voor {domain || "deze klant"}.</div></div>
      )}

      {!loading && gsc && gsc.totals && (
        <Collapse title="Search Console" meta={`${gsc.range.curStart} t/m ${gsc.range.curEnd}`} open={isOpen("sc", true)} onToggle={() => toggle("sc", true)}>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-value">{nl(gsc.totals.clicks.cur)}</div><div className="kpi-label">Klikken</div><Delta cur={gsc.totals.clicks.cur} prev={gsc.totals.clicks.prev} pct /><Sparkline data={gsc.series.clicks} /></div>
            <div className="kpi-card"><div className="kpi-value">{nl(gsc.totals.impressions.cur)}</div><div className="kpi-label">Vertoningen</div><Delta cur={gsc.totals.impressions.cur} prev={gsc.totals.impressions.prev} pct /><Sparkline data={gsc.series.impressions} /></div>
            <div className="kpi-card"><div className="kpi-value">{gsc.totals.ctr.cur.toFixed(1)}%</div><div className="kpi-label">CTR</div><Delta cur={gsc.totals.ctr.cur} prev={gsc.totals.ctr.prev} isPos /><Sparkline data={gsc.series.ctr} fmt={(v) => `${v.toFixed(1)}%`} /></div>
            <div className="kpi-card"><div className="kpi-value">{gsc.totals.position.cur.toFixed(1)}</div><div className="kpi-label">Gem. positie</div><Delta cur={gsc.totals.position.cur} prev={gsc.totals.position.prev} invert isPos /><Sparkline data={gsc.series.position} invert fmt={(v) => v.toFixed(1)} /></div>
          </div>

          {focusedKws.length > 0 && (
            <Collapse sub title={`Belangrijke zoekwoorden (${focusedKws.length})`} meta="prio & secundair, vastgezet bovenaan" open={isOpen("sc_focus")} onToggle={() => toggle("sc_focus")}>
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="Focus" k="focus" sort={focusSort} setSort={setFocusSort} />
                    <SortTh label="Zoekwoord" k="keyword" sort={focusSort} setSort={setFocusSort} />
                    <SortTh label="Positie" k="position" sort={focusSort} setSort={setFocusSort} />
                    <SortTh label="Klikken" k="clicks" sort={focusSort} setSort={setFocusSort} />
                    <SortTh label="Vertoningen" k="impressions" sort={focusSort} setSort={setFocusSort} />
                    <SortTh label="CTR" k="ctr" sort={focusSort} setSort={setFocusSort} />
                  </tr></thead>
                  <tbody>
                    {focusedKws.map((k) => (
                      <tr key={k.keyword} className={"kpi-focus-row " + focus[k.keyword]}>
                        <td><FocusSelect tier={focus[k.keyword]} onChange={(t) => markFocus(k.keyword, t)} /></td>
                        <td>{k.keyword}</td>
                        <td>{k.position.toFixed(1)} <Delta cur={k.position} prev={k.prevPosition ?? k.position} invert isPos /></td>
                        <td>{nl(k.clicks)} <Delta cur={k.clicks} prev={k.prevClicks} /></td>
                        <td>{nl(k.impressions)} <Delta cur={k.impressions} prev={k.prevImpressions} /></td>
                        <td>{k.ctr.toFixed(1)}% <Delta cur={k.ctr} prev={k.prevCtr} isPos /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}

          {gsc.keywords.length > 0 && (
            <Collapse sub title={<>Zoekwoorden uit Search Console ({gsc.keywords.length}) <HelpHint wide text="De zoekwoorden waarop deze site in Google gevonden wordt (echte klikken en vertoningen uit Search Console). Markeer belangrijke woorden als prio of secundair; die verschijnen vastgezet bovenaan en zijn gedeeld met de Ahrefs-lijst." /></>} meta="markeer een zoekwoord als prio of secundair" open={isOpen("sc_kw")} onToggle={() => toggle("sc_kw")}>
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="Focus" k="focus" sort={kwSort} setSort={setKwSort} />
                    <SortTh label="Zoekwoord" k="keyword" sort={kwSort} setSort={setKwSort} />
                    <SortTh label="Positie" k="position" sort={kwSort} setSort={setKwSort} />
                    <SortTh label="Klikken" k="clicks" sort={kwSort} setSort={setKwSort} />
                    <SortTh label="Vertoningen" k="impressions" sort={kwSort} setSort={setKwSort} />
                    <SortTh label="CTR" k="ctr" sort={kwSort} setSort={setKwSort} />
                  </tr></thead>
                  <tbody>
                    {sortedKws.map((k) => (
                      <tr key={k.keyword}>
                        <td><FocusSelect tier={focus[k.keyword]} onChange={(t) => markFocus(k.keyword, t)} /></td>
                        <td>{k.keyword}</td>
                        <td>{k.position.toFixed(1)} <Delta cur={k.position} prev={k.prevPosition ?? k.position} invert isPos /></td>
                        <td>{nl(k.clicks)} <Delta cur={k.clicks} prev={k.prevClicks} /></td>
                        <td>{nl(k.impressions)} <Delta cur={k.impressions} prev={k.prevImpressions} /></td>
                        <td>{k.ctr.toFixed(1)}% <Delta cur={k.ctr} prev={k.prevCtr} isPos /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}

          {pagesView.length > 0 && (
            <Collapse sub title={<>Pagina&rsquo;s uit Search Console ({pagesView.length}) <HelpHint wide text="De pagina's van de site met hun klikken en vertoningen uit Search Console. Sleep een pagina om hem bovenaan vast te zetten (de pagina's die je in de gaten houdt)." /></>} meta={pageSort ? "sortering actief, zet uit om te slepen" : "sleep om vast te zetten bovenaan"} open={isOpen("sc_pages")} onToggle={() => toggle("sc_pages")}>
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <th></th>
                    <SortTh label="Pagina" k="url" sort={pageSort} setSort={setPageSort} />
                    <SortTh label="Klikken" k="clicks" sort={pageSort} setSort={setPageSort} />
                    <SortTh label="Vertoningen" k="impressions" sort={pageSort} setSort={setPageSort} />
                  </tr></thead>
                  <tbody>
                    {sortedPages.map((p, i) => (
                      <tr key={p.url} className={dragIdx === i ? "dragging" : ""} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { if (pageSort) return; e.stopPropagation(); movePage(i); }}>
                        <td className="drag-handle" draggable={!pageSort} onDragStart={() => { if (!pageSort) setDragIdx(i); }} onDragEnd={() => setDragIdx(null)} title={pageSort ? "Zet de sortering uit om te slepen" : "Sleep om deze pagina bovenaan vast te zetten"}>⠿</td>
                        <td><a href={p.url} target="_blank" rel="noreferrer">{shortUrl(p.url)}</a></td>
                        <td>{nl(p.clicks)} <Delta cur={p.clicks} prev={p.prevClicks} /></td>
                        <td>{nl(p.impressions)} <Delta cur={p.impressions} prev={p.prevImpressions} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}
        </Collapse>
      )}

      {!loading && (
        <Collapse title="Ahrefs" open={isOpen("ahrefs", true)} onToggle={() => toggle("ahrefs", true)}>
          <Collapse sub
            title={<>Ahrefs-zoekwoorden{ahrefsKw.length ? ` (${ahFiltered.length})` : ""} <HelpHint wide text="Alle organische zoekwoorden van het domein uit Ahrefs (volume, positie, intent), in één keer opgehaald. Laaghangend fruit = commerciële of transactionele zoekwoorden met volume die net buiten de top staan (positie 4-20): daar kun je met beperkte moeite snel meer waardevolle bezoekers scoren. Markeer belangrijke zoekwoorden als prio of secundair; die markering is gedeeld met de Search Console-lijst." /></>}
            open={isOpen("ah_kw")} onToggle={() => toggle("ah_kw")}
            actions={<>
              {fruitCount > 0 && <button type="button" className={"ghost-btn small" + (onlyFruit ? " active" : "")} onClick={() => setOnlyFruit((v) => !v)}>{onlyFruit ? "Toon alles" : `Laaghangend fruit (${fruitCount})`}</button>}
              <button type="button" className="primary-btn small" onClick={syncAhrefs} disabled={ahrefsBusy}>{ahrefsBusy ? "Ophalen…" : (ahrefsKw.length ? "Verversen" : "Ahrefs-zoekwoorden ophalen")}</button>
            </>}
          >
            {ahrefsMsg && <div className="saved-msg" style={{ marginBottom: 8 }}>{ahrefsMsg}</div>}
            {ahrefsKw.length === 0 ? (
              <div className="muted">Nog geen Ahrefs-zoekwoorden opgehaald. Klik &ldquo;Ahrefs-zoekwoorden ophalen&rdquo;: dat haalt in één keer het hele domein op (kost Ahrefs-credits) en slaat het op, zodat de scan er daarna zonder credits op draait.</div>
            ) : (
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="Focus" k="focus" sort={ahSort} setSort={setAhSort} />
                    <SortTh label="Zoekwoord" k="keyword" sort={ahSort} setSort={setAhSort} />
                    <SortTh label="Volume" k="volume" sort={ahSort} setSort={setAhSort} />
                    <SortTh label="Positie" k="position" sort={ahSort} setSort={setAhSort} />
                    <SortTh label="Intent" k="intent" sort={ahSort} setSort={setAhSort} />
                    <SortTh label="Kans" k="kans" sort={ahSort} setSort={setAhSort} />
                  </tr></thead>
                  <tbody>
                    {ahSorted.map((k) => (
                      <tr key={k.keyword} className={isFruit(k) ? "kpi-fruit-row" : ""}>
                        <td><FocusSelect tier={focus[k.keyword]} onChange={(t) => markFocus(k.keyword, t)} /></td>
                        <td>{k.keyword}</td>
                        <td>{k.volume != null ? nl(k.volume) : <span className="muted">&mdash;</span>}</td>
                        <td>{k.position != null ? k.position : <span className="muted">&mdash;</span>}</td>
                        <td>{k.intent ? <span className={"kw-intent " + k.intent}>{k.intent}</span> : <span className="muted">&mdash;</span>}</td>
                        <td>{isFruit(k) ? <span className="pg-kans quickwin">Quick win</span> : <span className="muted">&mdash;</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Collapse>

          <Collapse sub
            title={<>Kansen{opps.length ? ` (${opps.length})` : ""} <HelpHint wide text="Relevante zoekwoorden waar de site nog NIET op rankt, gevonden via keyword-ideas rond je kernthema's én concurrenten (waar zij wel scoren, jij niet), en door Claude gefilterd op echte relevantie. Kansen om met nieuwe of uitgebreide content te pakken." /></>}
            open={isOpen("ah_opps")} onToggle={() => toggle("ah_opps")}
            actions={<>
              <button type="button" className={"ghost-btn small" + (compOpen ? " active" : "")} onClick={() => setCompOpen((v) => !v)}>Concurrenten{competitors.length ? ` (${competitors.length})` : ""}</button>
              <button type="button" className="primary-btn small" onClick={collectOpps} disabled={oppBusy}>{oppBusy ? "Zoeken…" : (opps.length ? "Opnieuw zoeken" : "Kansen zoeken")}</button>
            </>}
          >
            {compOpen && (
              <div className="comp-edit">
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>2 tot 4 concurrent-domeinen. Hun zoekwoorden geven de gap (waar zij wel, jij nog niet rankt). Alleen het domein, bijvoorbeeld voorbeeld.nl.</div>
                <div className="comp-inputs">
                  {compInputs.map((v, i) => (
                    <input key={i} className="compose-input" value={v} placeholder={`concurrent ${i + 1} (domein)`} onChange={(e) => setCompInputs((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} />
                  ))}
                </div>
                <button type="button" className="ghost-btn small" style={{ marginTop: 8 }} onClick={saveCompetitors} disabled={compBusy}>{compBusy ? "Opslaan…" : "Concurrenten opslaan"}</button>
              </div>
            )}
            {oppMsg && <div className="saved-msg" style={{ marginBottom: 8 }}>{oppMsg}</div>}
            {opps.length === 0 ? (
              <div className="muted">Nog geen kansen gezocht. Klik &ldquo;Kansen zoeken&rdquo;: rond je sterkste zoekwoorden zoekt Ahrefs verwante termen (kost credits), en Claude houdt alleen de echt relevante over.</div>
            ) : (
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="Focus" k="focus" sort={oppSort} setSort={setOppSort} />
                    <SortTh label="Zoekwoord" k="keyword" sort={oppSort} setSort={setOppSort} />
                    <SortTh label="Volume" k="volume" sort={oppSort} setSort={setOppSort} />
                    <SortTh label="KD" k="difficulty" sort={oppSort} setSort={setOppSort} />
                    <SortTh label="Bron" k="source" sort={oppSort} setSort={setOppSort} />
                    <SortTh label="Waarom relevant" k="reason" sort={oppSort} setSort={setOppSort} />
                  </tr></thead>
                  <tbody>
                    {oppSorted.map((o) => (
                      <tr key={o.keyword}>
                        <td><FocusSelect tier={focus[o.keyword]} onChange={(t) => markFocus(o.keyword, t)} /></td>
                        <td>{o.keyword}</td>
                        <td>{o.volume != null ? nl(o.volume) : <span className="muted">&mdash;</span>}</td>
                        <td>{o.difficulty != null ? o.difficulty : <span className="muted">&mdash;</span>}</td>
                        <td>{o.source === "concurrent" ? <span className="kw-intent commercieel">concurrent</span> : <span className="kw-intent informatief">idee</span>}</td>
                        <td className="muted" style={{ fontSize: 12 }}>{o.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Collapse>
        </Collapse>
      )}

      {!loading && ga4 && ga4.propertyId === null && (
        <div className="cockpit-card"><div className="phase2-note">Google is gekoppeld, maar er is nog geen GA4-property gevonden voor {domain || "deze klant"}.</div></div>
      )}

      {!loading && ga4 && ga4.totals.length > 0 && (
        <Collapse title="Google Analytics" meta={`laatste ${periodLabel}`} open={isOpen("ga", true)} onToggle={() => toggle("ga", true)}>
          <div className="kpi-grid">
            {ga4.totals.map((m) => (
              <div className="kpi-card" key={m.metric}>
                <div className="kpi-value">{nl(m.cur)}</div>
                <div className="kpi-label">{GA4_LABELS[m.metric] || m.metric}</div>
                <Delta cur={m.cur} prev={m.prev} pct />
                <Sparkline data={m.series} />
              </div>
            ))}
          </div>
        </Collapse>
      )}
    </div>
  );
}

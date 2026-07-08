"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode, type ThHTMLAttributes } from "react";
import type { GscComparison, Ga4Comparison } from "../../../../lib/google";
import type { AhrefsKeyword } from "../../../../lib/ahrefs-keywords";
import type { Opportunity } from "../../../../lib/keyword-opportunities";
import HelpHint from "./HelpHint";
import { mdToHtml } from "../../../../lib/markdown";

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
function trendOf(cur: number, prev: number, invert?: boolean): "good" | "bad" | "flat" {
  if (cur === prev) return "flat";
  return (invert ? cur < prev : cur > prev) ? "good" : "bad";
}

// Duidelijke vergelijking van de VORIGE periode (links) met de HUIDIGE periode
// (rechts): twee punten, lijn ertussen, groen bij verbetering en rood bij daling.
// Voor 'positie' (invert) is een hogere waarde slechter, dus die tekenen we lager
// zodat de lijn daalt als het slechter wordt. Zo sluit de grafiek aan op het %-getal.
function PeriodCompare({ prev, cur, fmt, invert }: { prev: number; cur: number; fmt: (v: number) => string; invert?: boolean }) {
  const t = trendOf(cur, prev, invert);
  const color = t === "flat" ? "#9e9e9e" : t === "good" ? "#2E7D32" : "#C62828";
  const w = 96, h = 30, pad = 6;
  const min = Math.min(prev, cur), max = Math.max(prev, cur), range = max - min || 1;
  const y = (v: number) => { const norm = (v - min) / range; return pad + (invert ? norm : 1 - norm) * (h - 2 * pad); };
  // Alleen de begin- (links) en eindwaarde (rechts) bij de bolletjes; de stijging/
  // daling staat naast het grote getal bovenaan.
  return (
    <div className="kpi-compare">
      <span className="kc-prev" title="vorige periode">{fmt(prev)}</span>
      <svg viewBox={`0 0 ${w} ${h}`} className="kpi-compare-svg" preserveAspectRatio="none">
        <line x1={pad} y1={y(prev)} x2={w - pad} y2={y(cur)} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <circle cx={pad} cy={y(prev)} r={3} fill="#bbb" />
        <circle cx={w - pad} cy={y(cur)} r={3.6} fill={color} />
      </svg>
      <span className="kc-cur"><strong style={{ color }}>{fmt(cur)}</strong></span>
    </div>
  );
}

// Scorekaart met trend: bovenaan de beginstand (links), het verschil (midden) en de
// eindstand (rechts); daaronder de échte dagreeks als lijn met hover-waarde en een
// datum-as (begin/midden/eind). invert=true bij 'positie': richting positie 0 loopt de
// lijn omhoog (beter). Verticale schaal is min-max, zodat de beweging goed zichtbaar is.
function CardTrend({ label, values, dates, prev, cur, fmt, invert, isPos, periodLabel, prevValues, metricKey, onExplain }: { label: ReactNode; values: number[]; dates: string[]; prev: number; cur: number; fmt: (v: number) => string; invert?: boolean; isPos?: boolean; periodLabel: string; prevValues?: number[]; metricKey?: string; onExplain?: (m: string) => Promise<string> }) {
  const [hover, setHover] = useState<number | null>(null);
  const [expOpen, setExpOpen] = useState(false);
  const [expHtml, setExpHtml] = useState("");
  const [expLoading, setExpLoading] = useState(false);
  const [expErr, setExpErr] = useState("");
  async function toggleExplain() {
    if (expOpen) { setExpOpen(false); return; }
    setExpOpen(true);
    if (expHtml || expLoading || !onExplain || !metricKey) return;
    setExpLoading(true); setExpErr("");
    try { setExpHtml(await onExplain(metricKey)); }
    catch (e) { setExpErr(e instanceof Error ? e.message : "Kon de toelichting niet maken."); }
    finally { setExpLoading(false); }
  }
  const w = 220, h = 58, pad = 6;
  // Bij 'positie' (invert) zijn dagen zonder data (0) geen "beste positie": eruit filteren,
  // anders knikt de lijn kunstmatig naar boven en klopt de richting niet.
  const pts = values.map((v, i) => ({ v, date: dates[i] || "", oi: i })).filter((p) => p.date && (!invert || p.v > 0));
  const has = pts.length >= 2;
  // Vorige periode uitgelijnd op dezelfde dag-offset (stippellijn ter vergelijking).
  const prevPts = has && prevValues ? pts.map((p, i) => ({ i, v: prevValues[p.oi] })).filter((q) => q.v != null && Number.isFinite(q.v) && (!invert || q.v > 0)) : [];
  const vals = pts.map((p) => p.v);
  const scaleVals = [...vals, ...prevPts.map((q) => q.v)];
  const min = scaleVals.length ? Math.min(...scaleVals) : 0, max = scaleVals.length ? Math.max(...scaleVals) : 1, range = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
  const y = (v: number) => { const tt = (v - min) / range; return invert ? pad + tt * (h - 2 * pad) : (h - pad) - tt * (h - 2 * pad); };
  const line = has ? pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ") : "";
  const prevLine = prevPts.length >= 2 ? prevPts.map((q) => `${x(q.i).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ") : "";
  // Kleur volgt de periodevergelijking (deze periode vs. vorige), zodat de kleur klopt
  // met het %-getal: klikken 100 → 106 is groen, ook al eindigt de dagreeks lager.
  const pt = trendOf(cur, prev, invert);
  const color = pt === "flat" ? "#9e9e9e" : pt === "good" ? "#2E7D32" : "#C62828";
  const dShort = (d: string) => { try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return d; } };
  const hv = hover != null ? pts[hover] : null;
  const mid = Math.floor((pts.length - 1) / 2);
  return (
    <div className="kpi-card kpi-card-trend">
      <div className="kpi-label">{label}</div>
      <div className="ktr-compare">
        <div className="ktr-col"><span className="ktr-col-lbl">Vorige {periodLabel}</span><span className="ktr-col-val ktr-prev">{fmt(prev)}</span></div>
        <div className="ktr-col ktr-col-mid"><Delta cur={cur} prev={prev} pct invert={invert} isPos={isPos} /></div>
        <div className="ktr-col ktr-col-r"><span className="ktr-col-lbl">Deze {periodLabel}</span><span className="ktr-col-val" style={{ color }}>{fmt(cur)}</span></div>
      </div>
      {has ? (
        <div className="ktr-chart-wrap">
          <div className="ktr-chart-title">Verloop per dag ({periodLabel}){prevLine ? <span className="ktr-legend"> · <span className="ktr-legend-dash">- -</span> vorige periode</span> : null}</div>
          <div className="ktr-chart" onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${w} ${h}`} className="ktr-svg" preserveAspectRatio="none">
              {prevLine && <polyline points={prevLine} fill="none" stroke="#b0b0b0" strokeWidth={1.4} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
              <polyline points={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {hv && <line x1={x(hover!)} y1={0} x2={x(hover!)} y2={h} className="ktr-hoverline" />}
              {hv && <circle cx={x(hover!)} cy={y(hv.v)} r={3.4} fill={color} stroke="#fff" strokeWidth={1.4} />}
              {pts.map((p, i) => <rect key={i} x={x(i) - (w / pts.length) / 2} y={0} width={w / pts.length} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />)}
            </svg>
            {hv && <div className="ktr-tip" style={{ left: `${Math.max(8, Math.min(92, (x(hover!) / w) * 100))}%` }}>{dShort(hv.date)}: <strong>{fmt(hv.v)}</strong></div>}
            <div className="ktr-axis"><span>{dShort(pts[0].date)}</span><span>{dShort(pts[mid].date)}</span><span>{dShort(pts[pts.length - 1].date)}</span></div>
          </div>
        </div>
      ) : <div className="muted" style={{ fontSize: 11, padding: "10px 0" }}>Nog te weinig data voor een grafiek.</div>}
      {onExplain && metricKey && (
        <div className="ktr-explain">
          <button type="button" className="ktr-explain-btn" onClick={toggleExplain} disabled={expLoading}>{expLoading ? "Analyseren…" : expOpen ? "▾ Toelichting verbergen" : "▸ Toelichting"}</button>
          {expOpen && expErr && <div className="login-error" style={{ marginTop: 6, fontSize: 12 }}>{expErr}</div>}
          {expOpen && expLoading && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Even de cijfers scannen…</div>}
          {expOpen && expHtml && <div className="md ktr-explain-body" dangerouslySetInnerHTML={{ __html: expHtml }} />}
        </div>
      )}
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

// Datum (YYYY-MM-DD) van n maanden geleden, voor de Ahrefs-periodevergelijking.
function monthsAgoISO(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}
const AH_COMPARE_MONTHS: Record<string, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };

// ── Sorteerbare kolomkoppen ──────────────────────────────────
type SortDir = "asc" | "desc";
type Sort<K extends string> = { key: K; dir: SortDir } | null;

// Klik-cyclus per kop: aflopend → oplopend → uit (originele volgorde).
function SortTh<K extends string>({ label, k, sort, setSort, className, title, thProps }: { label: string; k: K; sort: Sort<K>; setSort: (s: Sort<K>) => void; className?: string; title?: string; thProps?: ThHTMLAttributes<HTMLTableCellElement> }) {
  const active = sort?.key === k;
  const arrow = active ? (sort!.dir === "asc" ? " ▲" : " ▼") : "";
  function onClick() {
    if (!active) return setSort({ key: k, dir: "desc" });
    if (sort!.dir === "desc") return setSort({ key: k, dir: "asc" });
    return setSort(null);
  }
  return <th className={"pg-sort" + (className ? " " + className : "") + (thProps?.draggable ? " kpi-col-drag" : "")} title={title ? title + " — klik om te sorteren (aflopend → oplopend → uit)" : "Klik om te sorteren (aflopend → oplopend → uit)"} {...thProps} onClick={onClick}>{label}{arrow}</th>;
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
type KwKey = "focus" | "keyword" | "volume" | "position" | "dposition" | "clicks" | "dclicks" | "impressions" | "dimpressions" | "ctr" | "dctr";
type AhKey = "focus" | "keyword" | "volume" | "position" | "dposition" | "intent" | "kans";
type OppKey = "focus" | "keyword" | "volume" | "difficulty" | "source" | "reason";
type PageKey = "prio" | "url" | "clicks" | "dclicks" | "impressions" | "dimpressions";

// Versleepbare kolom-groepen (waarde + Δ blijven één geheel). De identificatie-kolommen
// (Focus/Zoekwoord, ster/Pagina) staan vast links; deze groepen kun je herordenen.
const KW_COLS_DEFAULT = ["volume", "position", "clicks", "impressions", "ctr"];
const PAGE_COLS_DEFAULT = ["clicks", "impressions"];
const AH_COLS_DEFAULT = ["volume", "position", "intent", "kans"];
function sanitizeCols(saved: unknown, def: string[]): string[] {
  if (!Array.isArray(saved)) return def;
  const known = saved.filter((k): k is string => typeof k === "string" && def.includes(k));
  return [...known, ...def.filter((k) => !known.includes(k))];
}

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

export default function KpiPanel({ slug, domain, onOpenPage }: { slug: string; domain: string; onOpenPage?: (url: string) => void }) {
  // Open/dicht per (sub)sectie. Hoofdsecties staan standaard open, subsecties dicht.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ sc: true, ahrefs: true, ga: true });
  const isOpen = (id: string, def = false) => openMap[id] ?? def;
  const toggle = (id: string, def = false) => setOpenMap((m) => ({ ...m, [id]: !(m[id] ?? def) }));

  const [days, setDays] = useState(28);
  const [compare, setCompare] = useState<"prev" | "yoy">("prev");
  const [gsc, setGsc] = useState<GscComparison | null>(null);
  const [ga4, setGa4] = useState<Ga4Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean>(true);
  const [pagesView, setPagesView] = useState<GscPage[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focus, setFocus] = useState<Record<string, FocusTier>>({});
  const [kwSort, setKwSort] = useState<Sort<KwKey>>({ key: "focus", dir: "asc" });
  const [kwSearch, setKwSearch] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [ahSearch, setAhSearch] = useState("");
  const [pageSort, setPageSort] = useState<Sort<PageKey>>({ key: "prio", dir: "asc" });
  const [oppSort, setOppSort] = useState<Sort<OppKey>>(null);
  // Versleepbare kolomvolgorde (per browser onthouden).
  const [kwCols, setKwCols] = useState<string[]>(KW_COLS_DEFAULT);
  const [pageCols, setPageCols] = useState<string[]>(PAGE_COLS_DEFAULT);
  const [ahCols, setAhCols] = useState<string[]>(AH_COLS_DEFAULT);
  const [colDrag, setColDrag] = useState<string | null>(null);
  useEffect(() => {
    try { setKwCols(sanitizeCols(JSON.parse(localStorage.getItem("pw_kpicols_kw") || "null"), KW_COLS_DEFAULT)); } catch { /* standaard */ }
    try { setPageCols(sanitizeCols(JSON.parse(localStorage.getItem("pw_kpicols_pages") || "null"), PAGE_COLS_DEFAULT)); } catch { /* standaard */ }
    try { setAhCols(sanitizeCols(JSON.parse(localStorage.getItem("pw_kpicols_ah") || "null"), AH_COLS_DEFAULT)); } catch { /* standaard */ }
  }, []);
  function moveCol(order: string[], setOrder: (o: string[]) => void, storageKey: string, from: string, to: string) {
    if (from === to) return;
    const next = order.filter((k) => k !== from);
    const idx = next.indexOf(to);
    next.splice(idx < 0 ? next.length : idx, 0, from);
    setOrder(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* geen opslag */ }
  }
  function colDragProps(gk: string, order: string[], setOrder: (o: string[]) => void, storageKey: string): ThHTMLAttributes<HTMLTableCellElement> {
    return {
      draggable: true,
      onDragStart: () => setColDrag(gk),
      onDragOver: (e) => { e.preventDefault(); },
      onDrop: (e) => { e.preventDefault(); e.stopPropagation(); if (colDrag && colDrag !== gk) moveCol(order, setOrder, storageKey, colDrag, gk); setColDrag(null); },
      onDragEnd: () => setColDrag(null),
    };
  }
  // Rangschikt de focus-markering voor sortering: prio eerst, dan secundair, dan de rest.
  const focusRank = (kw: string) => (focus[kw] === "prio" ? 0 : focus[kw] === "secundair" ? 1 : 2);
  const kwGetters: Record<KwKey, (k: Kw) => number | string> = {
    focus: (k) => focusRank(k.keyword), keyword: (k) => k.keyword, volume: (k) => volMap.get(k.keyword.toLowerCase()) ?? -1, position: (k) => k.position, clicks: (k) => k.clicks, impressions: (k) => k.impressions, ctr: (k) => k.ctr,
    // Δ-kolommen: hogere waarde = meer verbeterd (aflopend sorteren = hardst gestegen bovenaan).
    dposition: (k) => (k.prevPosition ?? k.position) - k.position, dclicks: (k) => k.clicks - k.prevClicks, dimpressions: (k) => k.impressions - k.prevImpressions, dctr: (k) => k.ctr - k.prevCtr,
  };

  useEffect(() => {
    let off = false;
    setLoading(true);
    fetch(`/api/admin/kpi?slug=${encodeURIComponent(slug)}&days=${days}&compare=${compare}`)
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
  }, [slug, days, compare]);

  // Markeert of wist prio/secundair voor één zoekwoord (optimistisch, dan opslaan).
  function markFocus(keyword: string, tier: FocusTier | null) {
    setFocus((f) => { const n = { ...f }; if (tier) n[keyword] = tier; else delete n[keyword]; return n; });
    fetch("/api/admin/kpi/keyword-focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, keyword, tier }) }).catch(() => {});
  }

  // Prioriteit-pagina's (ster): aangevinkt = bovenaan. Gedeelde opslag met de Wijzigingen-tab.
  const [pagePrio, setPagePrio] = useState<Set<string>>(new Set());
  const pagePrioKey = (u: string) => (u || "").replace(/\/+$/, "");
  useEffect(() => {
    fetch(`/api/admin/changes/priority?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) setPagePrio(new Set(d.urls || [])); }).catch(() => {});
  }, [slug]);
  function togglePagePrio(url: string) {
    const key = pagePrioKey(url);
    const on = !pagePrio.has(key);
    setPagePrio((s) => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
    fetch("/api/admin/changes/priority", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, priority: on }) }).catch(() => {});
  }

  // Ahrefs-zoekwoorden (domein-brede pool + laaghangend fruit).
  const [ahrefsKw, setAhrefsKw] = useState<AhrefsKeyword[]>([]);
  const [ahrefsBusy, setAhrefsBusy] = useState(false);
  const [ahrefsMsg, setAhrefsMsg] = useState("");
  const [onlyFruit, setOnlyFruit] = useState(false);
  const [ahSort, setAhSort] = useState<Sort<AhKey>>(null);
  // Periode waarmee de Ahrefs-posities vergeleken worden (pijltjes). Wordt pas
  // toegepast bij de eerstvolgende keer Verversen (dat kost credits).
  const [ahCompare, setAhCompare] = useState<"1m" | "3m" | "6m" | "12m" | "custom">("3m");
  const [ahCustomDate, setAhCustomDate] = useState("");

  useEffect(() => {
    fetch(`/api/admin/ahrefs-keywords?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) setAhrefsKw(d.keywords || []); }).catch(() => {});
  }, [slug]);


  async function syncAhrefs() {
    if (ahrefsBusy) return;
    setAhrefsBusy(true); setAhrefsMsg("");
    const compareDate = ahCompare === "custom" ? ahCustomDate : monthsAgoISO(AH_COMPARE_MONTHS[ahCompare]);
    try {
      const r = await fetch("/api/admin/ahrefs-keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, gscKeywords: (gsc?.keywords || []).map((k) => k.keyword), compareDate: compareDate || undefined }) });
      const d = await r.json();
      if (d.ok) {
        setAhrefsMsg(`${d.total} Ahrefs-zoekwoorden opgehaald; zoekvolume voor je Search Console-zoekwoorden is bijgewerkt.`);
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

  // AI-toelichting per KPI: stuurt de data mee en krijgt een korte, gerenderde verklaring
  // (waarom gestegen/gedaald, welke pagina's/zoekwoorden, laaghangend fruit).
  async function explainMetric(metricKey: string): Promise<string> {
    const totals = (gsc?.totals as Record<string, { cur: number; prev: number }> | null | undefined)?.[metricKey] || { cur: 0, prev: 0 };
    const r = await fetch("/api/admin/kpi/explain", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, metric: metricKey, days, totals, pages: gsc?.pages || [], keywords: gsc?.keywords || [] }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "Kon de toelichting niet maken.");
    return mdToHtml(d.markdown || "");
  }
  // Herbruikbare periodekiezer (zelfde blokje als bovenaan), ook in de sectie-headers zodat
  // je daar ziet én kunt kiezen waarmee klikken/vertoningen vergeleken worden.
  const periodPicker = (
    <span className="kpi-period-inline" onClick={(e) => e.stopPropagation()}>
      <select className="kpi-period-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
        {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
      </select>
      <select className="kpi-period-select" value={compare} onChange={(e) => setCompare(e.target.value as "prev" | "yoy")} title="Waarmee vergelijken">
        <option value="prev">vs. vorige periode</option>
        <option value="yoy">vs. vorig jaar</option>
      </select>
    </span>
  );

  // Zoekvolume per zoekwoord uit de opgeslagen Ahrefs-pool (geen credits).
  const volMap = new Map<string, number | null>(ahrefsKw.map((k) => [k.keyword.toLowerCase(), k.volume]));

  // Gesorteerde zoekwoorden (standaard prio bovenaan via de Focus-kolom) + zoekfilter.
  const allKws: Kw[] = gsc?.keywords || [];
  const sortedKws = applySort(allKws, kwSort, kwGetters);
  const shownKws = kwSearch.trim() ? sortedKws.filter((k) => k.keyword.toLowerCase().includes(kwSearch.trim().toLowerCase())) : sortedKws;
  const pageGetters: Record<PageKey, (p: GscPage) => number | string> = {
    prio: (p) => (pagePrio.has(pagePrioKey(p.url)) ? 0 : 1), url: (p) => shortUrl(p.url), clicks: (p) => p.clicks, impressions: (p) => p.impressions,
    dclicks: (p) => p.clicks - p.prevClicks, dimpressions: (p) => p.impressions - p.prevImpressions,
  };
  // Standaard op de ster (prio) gesorteerd: aangevinkte pagina's automatisch bovenaan.
  const sortedPagesAll = applySort(pagesView, pageSort, pageGetters);
  const sortedPages = pageSearch.trim() ? sortedPagesAll.filter((p) => p.url.toLowerCase().includes(pageSearch.trim().toLowerCase())) : sortedPagesAll;

  // Kop + cel per versleepbare kolomgroep; waarde en Δ blijven één geheel.
  const kwHead: Record<string, (d: ThHTMLAttributes<HTMLTableCellElement>) => ReactNode> = {
    volume: (d) => <SortTh key="volume" thProps={d} label="Volume" k="volume" sort={kwSort} setSort={setKwSort} className="kpi-metric-sep" />,
    position: (d) => <Fragment key="position"><SortTh thProps={d} label="Ranking" k="position" sort={kwSort} setSort={setKwSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering ranking t.o.v. vorige periode (omhoog = beter)" k="dposition" sort={kwSort} setSort={setKwSort} className="kpi-delta-th" /></Fragment>,
    clicks: (d) => <Fragment key="clicks"><SortTh thProps={d} label="Klikken" k="clicks" sort={kwSort} setSort={setKwSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering klikken t.o.v. vorige periode" k="dclicks" sort={kwSort} setSort={setKwSort} className="kpi-delta-th" /></Fragment>,
    impressions: (d) => <Fragment key="impressions"><SortTh thProps={d} label="Vertoningen" k="impressions" sort={kwSort} setSort={setKwSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering vertoningen t.o.v. vorige periode" k="dimpressions" sort={kwSort} setSort={setKwSort} className="kpi-delta-th" /></Fragment>,
    ctr: (d) => <Fragment key="ctr"><SortTh thProps={d} label="CTR" k="ctr" sort={kwSort} setSort={setKwSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering CTR t.o.v. vorige periode" k="dctr" sort={kwSort} setSort={setKwSort} className="kpi-delta-th" /></Fragment>,
  };
  const kwCell: Record<string, (k: Kw) => ReactNode> = {
    volume: (k) => <td key="volume" className="kpi-metric-sep">{(() => { const v = volMap.get(k.keyword.toLowerCase()); return v != null ? v.toLocaleString("nl-NL") : <span className="muted">&mdash;</span>; })()}</td>,
    position: (k) => <Fragment key="position"><td className="kpi-metric-sep">{k.position.toFixed(1)}</td><td className="kpi-delta-td"><Delta cur={k.position} prev={k.prevPosition ?? k.position} invert isPos /></td></Fragment>,
    clicks: (k) => <Fragment key="clicks"><td className="kpi-metric-sep">{nl(k.clicks)}</td><td className="kpi-delta-td"><Delta cur={k.clicks} prev={k.prevClicks} /></td></Fragment>,
    impressions: (k) => <Fragment key="impressions"><td className="kpi-metric-sep">{nl(k.impressions)}</td><td className="kpi-delta-td"><Delta cur={k.impressions} prev={k.prevImpressions} /></td></Fragment>,
    ctr: (k) => <Fragment key="ctr"><td className="kpi-metric-sep">{k.ctr.toFixed(1)}%</td><td className="kpi-delta-td"><Delta cur={k.ctr} prev={k.prevCtr} isPos /></td></Fragment>,
  };
  const pageHead: Record<string, (d: ThHTMLAttributes<HTMLTableCellElement>) => ReactNode> = {
    clicks: (d) => <Fragment key="clicks"><SortTh thProps={d} label="Klikken" k="clicks" sort={pageSort} setSort={setPageSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering klikken t.o.v. vorige periode" k="dclicks" sort={pageSort} setSort={setPageSort} className="kpi-delta-th" /></Fragment>,
    impressions: (d) => <Fragment key="impressions"><SortTh thProps={d} label="Vertoningen" k="impressions" sort={pageSort} setSort={setPageSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering vertoningen t.o.v. vorige periode" k="dimpressions" sort={pageSort} setSort={setPageSort} className="kpi-delta-th" /></Fragment>,
  };
  const pageCell: Record<string, (p: GscPage) => ReactNode> = {
    clicks: (p) => <Fragment key="clicks"><td className="kpi-metric-sep">{nl(p.clicks)}</td><td className="kpi-delta-td"><Delta cur={p.clicks} prev={p.prevClicks} /></td></Fragment>,
    impressions: (p) => <Fragment key="impressions"><td className="kpi-metric-sep">{nl(p.impressions)}</td><td className="kpi-delta-td"><Delta cur={p.impressions} prev={p.prevImpressions} /></td></Fragment>,
  };

  const ahGetters: Record<AhKey, (k: AhrefsKeyword) => number | string> = {
    focus: (k) => focusRank(k.keyword), keyword: (k) => k.keyword, volume: (k) => k.volume || 0, position: (k) => k.position ?? 999, intent: (k) => k.intent, kans: (k) => (isFruit(k) ? 0 : 1),
    dposition: (k) => (k.position != null && k.positionPrev != null ? k.positionPrev - k.position : 0),
  };
  // Kop + cel per versleepbare Ahrefs-kolomgroep (Ranking + Δ als één geheel).
  const ahHead: Record<string, (d: ThHTMLAttributes<HTMLTableCellElement>) => ReactNode> = {
    volume: (d) => <SortTh key="volume" thProps={d} label="Volume" k="volume" sort={ahSort} setSort={setAhSort} className="kpi-metric-sep" />,
    position: (d) => <Fragment key="position"><SortTh thProps={d} label="Ranking" k="position" sort={ahSort} setSort={setAhSort} className="kpi-metric-sep" /><SortTh thProps={d} label="Δ" title="Verandering ranking t.o.v. de vergelijkdatum (omhoog = beter)" k="dposition" sort={ahSort} setSort={setAhSort} className="kpi-delta-th" /></Fragment>,
    intent: (d) => <SortTh key="intent" thProps={d} label="Intent" k="intent" sort={ahSort} setSort={setAhSort} className="kpi-metric-sep" />,
    kans: (d) => <SortTh key="kans" thProps={d} label="Kans" k="kans" sort={ahSort} setSort={setAhSort} className="kpi-metric-sep" />,
  };
  const ahCell: Record<string, (k: AhrefsKeyword) => ReactNode> = {
    volume: (k) => <td key="volume" className="kpi-metric-sep">{k.volume != null ? nl(k.volume) : <span className="muted">&mdash;</span>}</td>,
    position: (k) => <Fragment key="position"><td className="kpi-metric-sep">{k.position != null ? k.position : <span className="muted">&mdash;</span>}</td><td className="kpi-delta-td">{k.position != null && k.positionPrev != null ? <Delta cur={k.position} prev={k.positionPrev} invert /> : <span className="muted">&mdash;</span>}</td></Fragment>,
    intent: (k) => <td key="intent" className="kpi-metric-sep">{k.intent ? <span className={"kw-intent " + k.intent}>{k.intent}</span> : <span className="muted">&mdash;</span>}</td>,
    kans: (k) => <td key="kans" className="kpi-metric-sep">{isFruit(k) ? <span className="pg-kans quickwin">Quick win</span> : <span className="muted">&mdash;</span>}</td>,
  };
  const ahFiltered = ahrefsKw.filter((k) => k.organic !== false && !k.branded && (onlyFruit ? isFruit(k) : true) && (!ahSearch.trim() || k.keyword.toLowerCase().includes(ahSearch.trim().toLowerCase())));
  const ahSorted = applySort(ahFiltered, ahSort, ahGetters);
  const fruitCount = ahrefsKw.filter((k) => k.organic !== false && !k.branded && isFruit(k)).length;
  // De datum waarmee de opgeslagen posities daadwerkelijk vergeleken zijn (voor het
  // label). Leeg als de laatste ophaal zonder periode was (oude data, geen pijltjes).
  const ahDataCompareDate = ahrefsKw.find((k) => k.compareDate)?.compareDate || null;
  const nlDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

  const oppGetters: Record<OppKey, (o: Opportunity) => number | string> = {
    focus: (o) => focusRank(o.keyword), keyword: (o) => o.keyword, volume: (o) => o.volume ?? 0, difficulty: (o) => o.difficulty ?? 0, source: (o) => o.source, reason: (o) => o.reason || "",
  };
  const oppSorted = applySort(opps, oppSort, oppGetters);

  return (
    <div className="kpi-panel">
      <div className="kpi-toolbar">
        <div className="kpi-toolbar-title">Search Console &amp; Analytics</div>
        <div className="kpi-toolbar-right">
          <span className="kpi-compare-note">{compare === "yoy" ? "vergeleken met dezelfde periode vorig jaar" : `vergeleken met vorige ${periodLabel}`}</span>
          {periodPicker}
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
          <div className="kpi-grid kpi-grid-4">
            <CardTrend label="Klikken" values={gsc.series.clicks} dates={gsc.series.dates} prevValues={gsc.series.prevClicks} prev={gsc.totals.clicks.prev} cur={gsc.totals.clicks.cur} fmt={(v) => nl(Math.round(v))} periodLabel={`${days} dgn`} metricKey="clicks" onExplain={explainMetric} />
            <CardTrend label="Vertoningen" values={gsc.series.impressions} dates={gsc.series.dates} prevValues={gsc.series.prevImpressions} prev={gsc.totals.impressions.prev} cur={gsc.totals.impressions.cur} fmt={(v) => nl(Math.round(v))} periodLabel={`${days} dgn`} metricKey="impressions" onExplain={explainMetric} />
            <CardTrend label="CTR" values={gsc.series.ctr} dates={gsc.series.dates} prevValues={gsc.series.prevCtr} prev={gsc.totals.ctr.prev} cur={gsc.totals.ctr.cur} fmt={(v) => `${v.toFixed(1)}%`} isPos periodLabel={`${days} dgn`} metricKey="ctr" onExplain={explainMetric} />
            <CardTrend label={<>Gem. positie <span className="kpi-sub-note">(hoger = beter)</span></>} values={gsc.series.position} dates={gsc.series.dates} prevValues={gsc.series.prevPosition} prev={gsc.totals.position.prev} cur={gsc.totals.position.cur} fmt={(v) => v.toFixed(1)} invert isPos periodLabel={`${days} dgn`} metricKey="position" onExplain={explainMetric} />
          </div>

          {gsc.keywords.length > 0 && (
            <Collapse sub title={<>Zoekwoorden uit Search Console ({gsc.keywords.length}) <HelpHint wide text="De zoekwoorden waarop deze site in Google gevonden wordt (echte klikken en vertoningen uit Search Console). Markeer belangrijke woorden als prio of secundair; die verschijnen vastgezet bovenaan en zijn gedeeld met de Ahrefs-lijst." /></>} meta="markeer een zoekwoord als prio of secundair (prio staat bovenaan) · sleep de kolomkoppen om ze te herschikken" open={isOpen("sc_kw")} onToggle={() => toggle("sc_kw")} actions={<><input className="kpi-kw-search" placeholder="Zoek zoekwoord…" value={kwSearch} onClick={(e) => e.stopPropagation()} onChange={(e) => setKwSearch(e.target.value)} />{periodPicker}</>}>
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="Focus" k="focus" sort={kwSort} setSort={setKwSort} />
                    <SortTh label="Zoekwoord" k="keyword" sort={kwSort} setSort={setKwSort} />
                    {kwCols.map((gk) => kwHead[gk](colDragProps(gk, kwCols, setKwCols, "pw_kpicols_kw")))}
                  </tr></thead>
                  <tbody>
                    {shownKws.map((k) => (
                      <tr key={k.keyword}>
                        <td><FocusSelect tier={focus[k.keyword]} onChange={(t) => markFocus(k.keyword, t)} /></td>
                        <td>{k.keyword}</td>
                        {kwCols.map((gk) => kwCell[gk](k))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}

          {pagesView.length > 0 && (
            <Collapse sub title={<>Pagina&rsquo;s uit Search Console ({pagesView.length}) <HelpHint wide text="De pagina's van de site met hun klikken en vertoningen uit Search Console. Vink de ster aan om een pagina op prioriteit te zetten; die springt dan (via de ster-kolom) automatisch bovenaan. Gedeeld met de Wijzigingen-tab." /></>} meta="ster = prioriteit, staat bovenaan · sleep de kolomkoppen om ze te herschikken" open={isOpen("sc_pages")} onToggle={() => toggle("sc_pages")} actions={<><input className="kpi-kw-search" placeholder="Zoek pagina…" value={pageSearch} onClick={(e) => e.stopPropagation()} onChange={(e) => setPageSearch(e.target.value)} />{periodPicker}</>}>
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="★" k="prio" sort={pageSort} setSort={setPageSort} />
                    <SortTh label="Pagina" k="url" sort={pageSort} setSort={setPageSort} />
                    {pageCols.map((gk) => pageHead[gk](colDragProps(gk, pageCols, setPageCols, "pw_kpicols_pages")))}
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {sortedPages.map((p, i) => {
                      const isPrio = pagePrio.has(pagePrioKey(p.url));
                      const canDrag = !pageSort && !pageSearch.trim();
                      return (
                        <tr key={p.url} className={dragIdx === i ? "dragging" : ""} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { if (!canDrag) return; e.stopPropagation(); movePage(i); }}>
                          <td className="kpi-pageprio-cell">
                            <span className={"wz-star" + (isPrio ? " on" : "")} title={isPrio ? "Prioriteit aan, klik om uit te zetten" : "Markeer als prioriteit (komt bovenaan)"} onClick={() => togglePagePrio(p.url)}>{isPrio ? "★" : "☆"}</span>
                            <span className="kpi-drag" draggable={canDrag} onDragStart={() => { if (canDrag) setDragIdx(i); }} onDragEnd={() => setDragIdx(null)} title={canDrag ? "Sleep om bovenaan te zetten" : "Zet de sortering/prioriteit uit om te slepen"}>⠿</span>
                          </td>
                          <td><a href={p.url} target="_blank" rel="noreferrer">{shortUrl(p.url)}</a></td>
                          {pageCols.map((gk) => pageCell[gk](p))}
                          <td className="kpi-openpage-cell"><button type="button" className="ghost-btn small" onClick={(e) => { e.stopPropagation(); onOpenPage?.(p.url); }} title="Open deze pagina in het Pagina's-tabje">open in Pagina&rsquo;s</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}
        </Collapse>
      )}

      {!loading && (
        <Collapse title="Ahrefs" open={isOpen("ahrefs", true)} onToggle={() => toggle("ahrefs", true)}>
          <div className="kpi-block">
            <div className="kpi-block-head">
              <span className="kpi-block-title">Ahrefs-zoekwoorden{ahrefsKw.length ? ` (${ahFiltered.length})` : ""} <HelpHint wide text="Alle organische zoekwoorden van het domein uit Ahrefs (volume, positie, intent), in één keer opgehaald. Laaghangend fruit = commerciële of transactionele zoekwoorden met volume die net buiten de top staan (positie 4-20): daar kun je met beperkte moeite snel meer waardevolle bezoekers scoren. Markeer belangrijke zoekwoorden als prio of secundair; die markering is gedeeld met de Search Console-lijst." /></span>
              <span className="kpi-head-actions">
                <input className="kpi-kw-search" placeholder="Zoek zoekwoord…" value={ahSearch} onClick={(e) => e.stopPropagation()} onChange={(e) => setAhSearch(e.target.value)} />
                <select className="kpi-period-select" value={ahCompare} onChange={(e) => setAhCompare(e.target.value as typeof ahCompare)} title="Vergelijk de posities met deze periode (pijltjes). Wordt toegepast bij de eerstvolgende keer Verversen (kost credits).">
                  <option value="1m">vs 1 maand</option>
                  <option value="3m">vs 3 maanden</option>
                  <option value="6m">vs 6 maanden</option>
                  <option value="12m">vs 12 maanden</option>
                  <option value="custom">vs eigen datum…</option>
                </select>
                {ahCompare === "custom" && <input type="date" className="kpi-period-select" value={ahCustomDate} max={monthsAgoISO(0)} onChange={(e) => setAhCustomDate(e.target.value)} title="Vergelijk met deze datum" />}
                {fruitCount > 0 && <button type="button" className={"ghost-btn small" + (onlyFruit ? " active" : "")} onClick={() => setOnlyFruit((v) => !v)}>{onlyFruit ? "Toon alles" : `Laaghangend fruit (${fruitCount})`}</button>}
                <button type="button" className="primary-btn small" onClick={syncAhrefs} disabled={ahrefsBusy}>{ahrefsBusy ? "Ophalen…" : (ahrefsKw.length ? "Verversen" : "Ahrefs-zoekwoorden ophalen")}</button>
              </span>
            </div>
            {ahDataCompareDate && <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Posities vergeleken met {nlDate(ahDataCompareDate)}, de pijltjes tonen de verandering sindsdien.</div>}
            {ahrefsMsg && <div className="saved-msg" style={{ marginBottom: 8 }}>{ahrefsMsg}</div>}
            {ahrefsKw.length === 0 ? (
              <div className="muted">Nog geen Ahrefs-zoekwoorden opgehaald. Klik &ldquo;Ahrefs-zoekwoorden ophalen&rdquo;: dat haalt in één keer het hele domein op (kost Ahrefs-credits) en slaat het op, zodat de scan er daarna zonder credits op draait.</div>
            ) : (
              <div className="res-table-wrap">
                <table className="res-table kpi-table">
                  <thead><tr>
                    <SortTh label="Focus" k="focus" sort={ahSort} setSort={setAhSort} />
                    <SortTh label="Zoekwoord" k="keyword" sort={ahSort} setSort={setAhSort} />
                    {ahCols.map((gk) => ahHead[gk](colDragProps(gk, ahCols, setAhCols, "pw_kpicols_ah")))}
                  </tr></thead>
                  <tbody>
                    {ahSorted.map((k) => (
                      <tr key={k.keyword} className={isFruit(k) ? "kpi-fruit-row" : ""}>
                        <td><FocusSelect tier={focus[k.keyword]} onChange={(t) => markFocus(k.keyword, t)} /></td>
                        <td>{k.keyword}</td>
                        {ahCols.map((gk) => ahCell[gk](k))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="kpi-block">
            <div className="kpi-block-head">
              <span className="kpi-block-title">Kansen{opps.length ? ` (${opps.length})` : ""} <HelpHint wide text="Relevante zoekwoorden waar de site nog NIET op rankt, gevonden via keyword-ideas rond je kernthema's én concurrenten (waar zij wel scoren, jij niet), en door Claude gefilterd op echte relevantie. Kansen om met nieuwe of uitgebreide content te pakken." /></span>
              <span className="kpi-head-actions">
                <button type="button" className={"ghost-btn small" + (compOpen ? " active" : "")} onClick={() => setCompOpen((v) => !v)}>Concurrenten{competitors.length ? ` (${competitors.length})` : ""}</button>
                <button type="button" className="primary-btn small" onClick={collectOpps} disabled={oppBusy}>{oppBusy ? "Zoeken…" : (opps.length ? "Opnieuw zoeken" : "Kansen zoeken")}</button>
              </span>
            </div>
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
          </div>
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
                <div className="kpi-value-row">
                  <div className="kpi-value">{nl(m.cur)}</div>
                  <Delta cur={m.cur} prev={m.prev} pct />
                </div>
                <div className="kpi-label">{GA4_LABELS[m.metric] || m.metric}</div>
                <PeriodCompare prev={m.prev} cur={m.cur} fmt={(v) => nl(Math.round(v))} />
              </div>
            ))}
          </div>
        </Collapse>
      )}
    </div>
  );
}

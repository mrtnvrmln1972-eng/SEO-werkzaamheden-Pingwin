"use client";

import { useEffect, useState } from "react";
import HelpHint from "./HelpHint";
import MetaPixelMeter from "./MetaPixelMeter";
import type { MetaKind } from "@/lib/meta-rules";

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

// Groepeert wijzigingen van dezelfde pagina die binnen 2 dagen achter elkaar zijn
// gedaan tot één regel (het her-indexeer-moment vanaf waar de KPI's tellen).
function clusterChanges(list: ChangeEvent[]): { rep: ChangeEvent; count: number }[] {
  const byUrl = new Map<string, ChangeEvent[]>();
  for (const e of list) {
    const k = (e.url || "").replace(/\/+$/, "");
    const arr = byUrl.get(k); if (arr) arr.push(e); else byUrl.set(k, [e]);
  }
  const TWO = 2 * 86400000;
  const out: { rep: ChangeEvent; count: number }[] = [];
  for (const arr of byUrl.values()) {
    const sorted = [...arr].sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());
    let cur: ChangeEvent[] = [];
    const flush = () => { if (cur.length) { out.push({ rep: cur[cur.length - 1], count: cur.length }); cur = []; } };
    for (const e of sorted) {
      if (cur.length && new Date(e.detectedAt).getTime() - new Date(cur[cur.length - 1].detectedAt).getTime() > TWO) flush();
      cur.push(e);
    }
    flush();
  }
  out.sort((a, b) => new Date(b.rep.detectedAt).getTime() - new Date(a.rep.detectedAt).getTime());
  return out;
}

function Field({ label, change, meter }: { label: string; change: FieldChange; meter?: MetaKind }) {
  return (
    <div className="wz-block">
      <div className="wz-block-head">{label}</div>
      {change.before && (
        <div className="wz-line removed">
          <span className="wz-sign">-</span> {change.before}
          {meter && <MetaPixelMeter kind={meter} text={change.before} />}
        </div>
      )}
      {change.after && (
        <div className="wz-line added">
          <span className="wz-sign">+</span> {change.after}
          {meter && <MetaPixelMeter kind={meter} text={change.after} />}
        </div>
      )}
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
type KwBA = { keyword: string; positionBefore: number | null; positionAfter: number | null; clicksBefore: number; clicksAfter: number; impressionsBefore?: number; impressionsAfter?: number; ctrBefore?: number | null; ctrAfter?: number | null; volume?: number | null };
type Ga4Stat = { views: number; timeOnPage: number; bounceRate: number; engagementRate: number; pagesPerSession: number; sessionDuration: number };
type Ga4 = { available: boolean; before: Ga4Stat; after: Ga4Stat };
type Moment = { id: number; date: string };
type Compare = { beforeStart: string; beforeEnd: string; afterStart: string; afterEnd: string; days: number; weekAligned: boolean };
type Kpi = { changeDate: string; daily: Day[]; keywords: KwBA[]; ga4: Ga4 | null; moments: Moment[]; compare: Compare | null; gscConnected?: boolean };

// Sorteerbare kolomkop voor de keyword-rankings-tabel, met een op/neer-indicator.
type KwSort = { key: string; dir: "asc" | "desc" } | null;
function WzSortTh({ label, k, sort, setSort }: { label: string; k: string; sort: KwSort; setSort: (s: KwSort) => void }) {
  const active = sort?.key === k;
  function onClick() {
    if (!active) return setSort({ key: k, dir: "desc" });
    if (sort!.dir === "desc") return setSort({ key: k, dir: "asc" });
    return setSort(null);
  }
  return (
    <th className="wz-sort" onClick={onClick} title="Klik om te sorteren (aflopend → oplopend → uit)">
      {label} <span className={"wz-sort-ind" + (active ? " active" : "")}>{active ? (sort!.dir === "asc" ? "▲" : "▼") : "▲▼"}</span>
    </th>
  );
}
// Sorteersleutels: klikken/impressies/CTR op verandering (na − voor), positie-delta = verbetering.
const KW_GETTERS: Record<string, (k: KwBA) => number | string> = {
  keyword: (k) => k.keyword.toLowerCase(),
  volume: (k) => k.volume ?? -1,
  posBefore: (k) => k.positionBefore ?? 9999,
  posAfter: (k) => k.positionAfter ?? 9999,
  delta: (k) => (k.positionBefore != null && k.positionAfter != null ? k.positionBefore - k.positionAfter : -9999),
  clicks: (k) => k.clicksAfter - k.clicksBefore,
  impressions: (k) => (k.impressionsAfter ?? 0) - (k.impressionsBefore ?? 0),
  ctr: (k) => (k.ctrAfter ?? 0) - (k.ctrBefore ?? 0),
};

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

function dShort(d: string): string { try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return d; } }
function dLong(d: string): string { try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }); } catch { return d; } }

// Mini-lijngrafiek met een gedateerde stippellijn per verandermoment. Hover je een
// stippellijn (of de bijbehorende sectie links), dan lichten beide op. Bij positie
// is lager beter, dus die keren we om (verbetering = omhoog).
function Spark({ data, metric, invert, markers, hoverKey, onHover }: { data: Day[]; metric: keyof Day; invert?: boolean; markers: { key: string; date: string }[]; hoverKey: string | null; onHover: (k: string | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 360, h = 84, pad = 8;
  const pts = data.filter((d) => d.date);
  if (pts.length < 2) return <div className="muted" style={{ fontSize: 12, padding: "18px 0" }}>Nog te weinig GSC-data voor deze periode.</div>;
  const vals = pts.map((d) => Number(d[metric]) || 0);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
  const y = (v: number) => { const t = (v - min) / range; return invert ? pad + t * (h - 2 * pad) : (h - pad) - t * (h - 2 * pad); };
  const line = pts.map((d, i) => `${x(i).toFixed(1)},${y(Number(d[metric]) || 0).toFixed(1)}`).join(" ");
  const dotColor = metric === "position" ? "#1e824c" : "#1a6dd6";
  const fmtV = (v: number) => metric === "position" ? v.toFixed(1) : metric === "ctr" ? v.toFixed(1) + "%" : String(Math.round(v));
  const frac = (date: string) => { let mi = pts.findIndex((d) => d.date >= date); if (mi < 0) mi = pts.length - 1; return mi / (pts.length - 1); };
  // Per meetmoment: het gemiddelde niveau NÁ het moment (tot het volgende moment of
  // het einde) als de waarde, en de stijging/daling t.o.v. het niveau ervóór.
  const idxOf = (date: string) => { let i = pts.findIndex((d) => d.date >= date); return i < 0 ? pts.length - 1 : i; };
  const avgOf = (a: number, b: number) => { let s = 0, n = 0; for (let k = Math.max(0, a); k < Math.min(b, pts.length); k++) { s += Number(pts[k][metric]) || 0; n++; } return n ? s / n : null; };
  const sortedM = markers.map((m) => ({ key: m.key, i: idxOf(m.date) })).sort((a, b) => a.i - b.i);
  const stat = new Map<string, { before: string; after: string; good: boolean; changed: boolean }>();
  const valAt = (i: number) => (i >= 0 && i < pts.length ? Number(pts[i][metric]) || 0 : null);
  sortedM.forEach((m, idx) => {
    const nextI = idx < sortedM.length - 1 ? sortedM[idx + 1].i : pts.length;
    // Waarde ÓP het aanpasmoment → waarde aan het eind van dit segment (dag vóór het
    // volgende moment, of de laatste dag). Intuïtiever dan een periode-gemiddelde.
    const before = valAt(m.i), after = valAt(Math.min(nextI, pts.length) - 1);
    const d = after != null && before != null ? after - before : null;
    stat.set(m.key, {
      before: before != null ? fmtV(before) : "—",
      after: after != null ? fmtV(after) : "—",
      changed: d != null && Math.abs(d) >= 0.05,
      good: d == null ? false : (invert ? d < 0 : d > 0),
    });
  });
  const hv = hover !== null ? pts[hover] : null;
  const hx = hover !== null ? x(hover) : 0;
  const hy = hv ? y(Number(hv[metric]) || 0) : 0;
  const tipLeft = `${(hx / w) * 100}%`;
  const tipShiftRight = hx > w * 0.6;
  return (
    <div className="wz-spark-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="wz-spark" preserveAspectRatio="none">
        {markers.map((m) => { const mx = pad + frac(m.date) * (w - 2 * pad); return <line key={m.key} x1={mx} y1={0} x2={mx} y2={h} className={"wz-marker" + (hoverKey === m.key ? " active" : "")} />; })}
        <polyline points={line} className={"wz-poly " + (metric === "position" ? "pos" : "")} />
        {hover !== null && <line x1={hx} y1={0} x2={hx} y2={h} className="wz-hover-line" />}
        {hv && <circle cx={hx} cy={hy} r={4} fill={dotColor} stroke="#fff" strokeWidth={1.5} />}
        {pts.map((d, i) => (
          <rect key={i} x={x(i) - (w / pts.length) / 2} y={0} width={w / pts.length} height={h}
            fill="transparent" className="wz-dot" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="wz-endpoints">
        <span>begin {dShort(pts[0].date)}: <strong>{fmtV(vals[0])}</strong></span>
        <span className={vals[vals.length - 1] === vals[0] ? "" : (invert ? vals[vals.length - 1] < vals[0] : vals[vals.length - 1] > vals[0]) ? "prog-up" : "prog-down"}>eind {dShort(pts[pts.length - 1].date)}: <strong>{fmtV(vals[vals.length - 1])}</strong></span>
      </div>
      {markers.map((m) => { const s = stat.get(m.key); return (
        <div key={m.key} className={"wz-marker-label" + (hoverKey === m.key ? " active" : "")} style={{ left: `${frac(m.date) * 100}%` }}
          onMouseEnter={() => onHover(m.key)} onMouseLeave={() => onHover(null)}>
          <span className="wz-ml-date">{dShort(m.date)}</span>
          {s && (
            <span className={"wz-ml-val" + (s.changed ? (s.good ? " prog-up" : " prog-down") : "")}>
              <span className="wz-ml-before">{s.before}</span>
              <span className="wz-ml-arrow">→</span>
              <span className="wz-ml-after">{s.after}</span>
            </span>
          )}
        </div>
      ); })}
      {hv && (
        <div className="wz-tip" style={{ left: tipLeft, marginLeft: tipShiftRight ? -84 : 6 }}>
          <span className="wz-tip-date">{dShort(hv.date)}</span>
          <span className="wz-tip-val">{fmtV(Number(hv[metric]) || 0)}</span>
        </div>
      )}
      <div className="wz-spark-axis">
        <span>{dShort(pts[0].date)}</span>
        <span>{dShort(pts[Math.floor((pts.length - 1) / 2)].date)}</span>
        <span>{dShort(pts[pts.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ── Doorgevoerde optimalisaties ──
// Alles wat we zelf op de site hebben gezet (meta-teksten, alt-teksten, structured
// data, interne links, redirects, live gezette copy) staat in het logboek "Wat we
// doen". Hier komt het per pagina terug, standaard dichtgeklapt, met een link naar
// de pagina zelf en een knop om er een meetmoment van te maken. Vanaf dat moment
// volgt de KPI-weergave hierboven het effect op kliks, positie en CTR.
type ActRij = { id: number; gebeurdeOp: string; soort: string; url: string | null; intern: string };
const OPT_SOORTEN = new Set(["meta", "alt", "structured", "intern-link", "redirect", "copy-live"]);
const OPT_LABEL: Record<string, string> = {
  meta: "Meta-teksten", alt: "Alt-teksten", structured: "Structured data",
  "intern-link": "Interne links", redirect: "Redirect", "copy-live": "Copy live",
};

type OptPagina = { url: string; laatste: string; tellers: { soort: string; n: number }[]; totaal: number };

function bundelOptimalisaties(rijen: ActRij[]): OptPagina[] {
  const perUrl = new Map<string, ActRij[]>();
  for (const r of rijen) {
    if (!r.url || !OPT_SOORTEN.has(r.soort)) continue;
    const k = r.url.replace(/\/+$/, "");
    const arr = perUrl.get(k); if (arr) arr.push(r); else perUrl.set(k, [r]);
  }
  const out: OptPagina[] = [];
  for (const [, arr] of perUrl) {
    const tel = new Map<string, number>();
    for (const r of arr) tel.set(r.soort, (tel.get(r.soort) || 0) + 1);
    const laatste = arr.reduce((a, b) => (a.gebeurdeOp > b.gebeurdeOp ? a : b));
    out.push({
      url: laatste.url as string,
      laatste: laatste.gebeurdeOp,
      tellers: [...tel.entries()].map(([soort, n]) => ({ soort, n })).sort((a, b) => b.n - a.n),
      totaal: arr.length,
    });
  }
  out.sort((a, b) => (a.laatste < b.laatste ? 1 : -1));
  return out;
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
      {diff.meta_title && <Field label="Paginatitel" change={diff.meta_title} meter="meta_title" />}
      {diff.meta_description && <Field label="Meta-beschrijving" change={diff.meta_description} meter="meta_description" />}
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
  const [kpiDays, setKpiDays] = useState(28);
  const [kwSort, setKwSort] = useState<KwSort>(null);
  const [kwFilter, setKwFilter] = useState("");
  // Gedeelde hover tussen de stippellijnen (rechts) en de "wat veranderde"-secties (links).
  const [hoverMoment, setHoverMoment] = useState<string | null>(null);
  // Belangrijke zoekwoorden (gedeeld met de KPI-tab): aangevinkt = prio, komt bovenaan.
  const [kwFocus, setKwFocus] = useState<Record<string, "prio" | "secundair">>({});
  useEffect(() => {
    fetch(`/api/admin/kpi/keyword-focus?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) setKwFocus(d.focus || {}); }).catch(() => {});
  }, [slug]);
  function toggleKwFocus(keyword: string) {
    const tier = kwFocus[keyword] === "prio" ? null : "prio";
    setKwFocus((f) => { const n = { ...f }; if (tier) n[keyword] = "prio"; else delete n[keyword]; return n; });
    fetch("/api/admin/kpi/keyword-focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, keyword, tier }) }).catch(() => {});
  }
  // Prioriteit-pagina's: aangevinkt (ster) = bovenaan het overzicht.
  const [priority, setPriority] = useState<Set<string>>(new Set());
  const prioKey = (u: string) => (u || "").replace(/\/+$/, "");
  useEffect(() => {
    fetch(`/api/admin/changes/priority?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) setPriority(new Set(d.urls || [])); }).catch(() => {});
  }, [slug]);
  function togglePriority(url: string) {
    const key = prioKey(url);
    const on = !priority.has(key);
    setPriority((s) => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
    fetch("/api/admin/changes/priority", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, priority: on }) }).catch(() => {});
  }
  // Doorgevoerde optimalisaties (uit het logboek "Wat we doen"), standaard dicht.
  const [optOpen, setOptOpen] = useState(false);
  const [optRijen, setOptRijen] = useState<ActRij[]>([]);
  const [optBusy, setOptBusy] = useState("");
  useEffect(() => {
    fetch(`/api/admin/activiteit?slug=${encodeURIComponent(slug)}`).then((r) => r.json())
      .then((d) => { if (d.ok) setOptRijen(d.rijen || []); }).catch(() => {});
  }, [slug]);

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
  const [wpSaveOk, setWpSaveOk] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/wp-creds?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d.ok) { setWpSet(!!d.set); setWpUser(d.user || ""); } }).catch(() => {});
  }, [slug]);

  async function saveWpCreds() {
    if (!wpUser.trim() || !wpPass.trim() || wpSaveBusy) return;
    setWpSaveBusy(true); setWpSaveMsg("");
    try {
      const r = await fetch("/api/admin/wp-creds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, user: wpUser.trim(), appPassword: wpPass.trim() }) });
      const d = await r.json();
      if (d.ok) { setWpSet(true); setWpPass(""); setWpSaveOk(true); setWpSaveMsg("Inloggegevens opgeslagen en getest."); }
      else { setWpSaveOk(false); setWpSaveMsg(d.error || "Opslaan mislukt."); }
    } catch { setWpSaveOk(false); setWpSaveMsg("Opslaan mislukt."); } finally { setWpSaveBusy(false); }
  }
  async function removeWpCreds() {
    setWpSaveBusy(true); setWpSaveMsg("");
    try {
      await fetch("/api/admin/wp-creds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "delete" }) });
      setWpSet(false); setWpPass(""); setWpSaveOk(true); setWpSaveMsg("Koppeling verwijderd.");
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
    fetch(`/api/admin/changes/kpi?slug=${encodeURIComponent(slug)}&id=${open.id}&days=${kpiDays}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) setKpi({ changeDate: d.changeDate, daily: d.daily || [], keywords: d.keywords || [], ga4: d.ga4 || null, moments: d.moments || [], compare: d.compare || null, gscConnected: d.gscConnected }); })
      .catch(() => { /* stil */ }).finally(() => { if (alive) setKpiLoading(false); });
    return () => { alive = false; };
  }, [open, slug, kpiDays]);

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

  // Maakt (of opent) het meetmoment van een pagina waar we optimalisaties op
  // hebben doorgevoerd. Bestaat er al een moment voor die pagina, dan openen we
  // dat; anders leggen we er één vast op de datum van de laatste optimalisatie.
  async function volgEffect(o: OptPagina) {
    const bestaand = events.find((e) => prioKey(e.url) === prioKey(o.url));
    if (bestaand) { setOpen(bestaand); return; }
    if (optBusy) return;
    setOptBusy(o.url); setMsg("");
    try {
      const wat = o.tellers.map((t) => `${t.n}× ${OPT_LABEL[t.soort] || t.soort}`).join(", ");
      const r = await fetch("/api/admin/changes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url: o.url, date: o.laatste.slice(0, 10), note: `Doorgevoerd vanuit het dashboard: ${wat}` }),
      });
      const d = await r.json();
      if (!d.ok) { setMsg(d.error || "Meetmoment vastleggen mislukt."); return; }
      const lijst = await fetch(`/api/admin/changes?slug=${encodeURIComponent(slug)}`).then((x) => x.json());
      const nieuw: ChangeEvent[] = lijst?.ok ? (lijst.events || []) : [];
      setEvents(nieuw);
      const ev = nieuw.find((e) => prioKey(e.url) === prioKey(o.url));
      if (ev) setOpen(ev);
    } catch { setMsg("Meetmoment vastleggen mislukt."); } finally { setOptBusy(""); }
  }

  const [wpBusy, setWpBusy] = useState(false);
  async function syncWordpress() {
    setWpBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/changes/wordpress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) {
        const newest = d.newest ? new Date(d.newest).toLocaleDateString("nl-NL") : null;
        setMsg(`WordPress: ${d.scanned} pagina's bekeken, ${d.added} nieuwe wijziging${d.added === 1 ? "" : "en"} toegevoegd.${newest ? ` Nieuwste wijziging volgens WordPress: ${newest}.` : ""}`);
        await load();
      } else setMsg(d.error || "Ophalen uit WordPress mislukt.");
    } catch { setMsg("Ophalen uit WordPress mislukt."); } finally { setWpBusy(false); }
  }

  if (open) {
    // Verandermomenten (nieuwste eerst) uit de KPI-respons; markers voor de grafieken.
    const momentsAsc: Moment[] = kpi?.moments && kpi.moments.length > 0 ? kpi.moments : [{ id: open.id, date: open.detectedAt.slice(0, 10) }];
    const momentsDesc = [...momentsAsc].reverse();
    const markers = momentsAsc.map((m) => ({ key: String(m.id), date: m.date }));
    return (
      <div className="cockpit-card">
        <button type="button" className="ghost-btn small" onClick={() => setOpen(null)}>← Alle wijzigingen</button>
        <h2 className="wz-title">{open.diff.meta_title?.after || open.diff.h1?.after || shortUrl(open.url)}</h2>
        <div className="muted" style={{ marginBottom: 14 }}>{shortUrl(open.url)} · {momentsAsc.length} verandermoment{momentsAsc.length === 1 ? "" : "en"}</div>
        <div className="wz-detail-grid">
          <div className="wz-detail-card acc-taupe">
            <div className="wz-detail-card-title">Wat veranderde</div>
            {momentsDesc.map((m) => {
              const ev = events.find((e) => e.id === m.id) || open;
              const key = String(m.id);
              const hasDiff = ev.diff && Object.keys(ev.diff).length > 0;
              return (
                <div key={key} className={"wz-moment" + (hoverMoment === key ? " active" : "")}
                  onMouseEnter={() => setHoverMoment(key)} onMouseLeave={() => setHoverMoment(null)}>
                  <div className="wz-moment-head">Wat veranderde op {dLong(m.date)}</div>
                  {ev.isManual && ev.summary && <div className="wz-line" style={{ background: "#fff6e5", marginBottom: 6 }}>{ev.summary}</div>}
                  {hasDiff ? <DiffView diff={ev.diff} /> : <div className="muted" style={{ fontSize: 12 }}>Geen inhoudelijke verschillen gedetecteerd.</div>}
                </div>
              );
            })}
          </div>
          <div className="wz-detail-card acc-teal">
            <div className="wz-detail-card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span>KPI-impact</span>
              <select className="kpi-period-select" value={kpiDays} onChange={(e) => setKpiDays(Number(e.target.value))} title="Hoeveel dagen vóór én ná het moment je wilt zien en vergelijken">
                <option value={14}>14 dagen vóór/ná</option>
                <option value={28}>28 dagen vóór/ná</option>
                <option value={60}>60 dagen vóór/ná</option>
                <option value={90}>90 dagen vóór/ná</option>
              </select>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "2px 0 10px" }}>Elke gedateerde stippellijn is een verandermoment. Eronder staat de waarde óp dat moment → de waarde nu (of tot het volgende moment) (groen = beter, rood = slechter). Beweeg over een stippellijn (of een sectie links) om dat moment op te lichten. Met de keuze rechtsboven stel je in hoeveel dagen vóór en ná je toont en vergelijkt.</p>
            {kpiLoading && <div className="muted" style={{ padding: 12 }}>KPI's laden…</div>}
            {!kpiLoading && kpi && (
              <div className="wz-kpi">
                <KpiBlock label="Kliks per dag" sub={shortUrl(open.url)}><Spark data={kpi.daily} markers={markers} hoverKey={hoverMoment} onHover={setHoverMoment} metric="clicks" /></KpiBlock>
                <KpiBlock label="Vertoningen per dag" sub={shortUrl(open.url)}><Spark data={kpi.daily} markers={markers} hoverKey={hoverMoment} onHover={setHoverMoment} metric="impressions" /></KpiBlock>
                <KpiBlock label="Gem. positie" sub={`${shortUrl(open.url)} · lager = beter`}><Spark data={kpi.daily} markers={markers} hoverKey={hoverMoment} onHover={setHoverMoment} metric="position" invert /></KpiBlock>
                <KpiBlock label="CTR" sub={shortUrl(open.url)}><Spark data={kpi.daily} markers={markers} hoverKey={hoverMoment} onHover={setHoverMoment} metric="ctr" /></KpiBlock>
                {kpi.compare && (
                  <div className="wz-compare-note">
                    Eerlijk vergeleken op gelijke periodes{kpi.compare.weekAligned ? " (hele weken, ma t/m zo)" : ""}: <strong>{kpi.compare.days} dagen vóór</strong> ({dShort(kpi.compare.beforeStart)} t/m {dShort(kpi.compare.beforeEnd)}) vs <strong>{kpi.compare.days} dagen ná</strong> ({dShort(kpi.compare.afterStart)} t/m {dShort(kpi.compare.afterEnd)}). De laatste ~3 dagen zijn afgeknipt wegens de vertraging van Search Console.
                  </div>
                )}
                {kpi.keywords.length > 0 && (
                  <div className="wz-kw">
                    <div className="wz-kpi-label" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span>Keyword-rankings (voor → na) <span className="sov-sub">vink de belangrijkste aan, die komen bovenaan (gedeeld met de KPI-tab)</span></span>
                      <input className="pages-search" style={{ marginLeft: "auto", width: 200 }} placeholder="Filter op zoekwoord…" value={kwFilter} onChange={(e) => setKwFilter(e.target.value)} />
                    </div>
                    <table className="wz-kw-table">
                      <thead><tr>
                        <th></th>
                        <WzSortTh label="Zoekwoord" k="keyword" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="Volume" k="volume" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="Positie voor" k="posBefore" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="Positie na" k="posAfter" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="Stijging/daling" k="delta" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="Kliks (v→n)" k="clicks" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="Impressies (v→n)" k="impressions" sort={kwSort} setSort={setKwSort} />
                        <WzSortTh label="CTR (v→n)" k="ctr" sort={kwSort} setSort={setKwSort} />
                      </tr></thead>
                      <tbody>
                        {(() => {
                          const f = kwFilter.trim().toLowerCase();
                          const base = kpi.keywords.filter((k) => !f || k.keyword.toLowerCase().includes(f));
                          const g = kwSort && KW_GETTERS[kwSort.key] ? KW_GETTERS[kwSort.key] : null;
                          const dir = kwSort?.dir === "asc" ? 1 : -1;
                          return [...base].sort((a, b) => {
                            // Aangevinkte (prio) zoekwoorden altijd bovenaan.
                            const pa = kwFocus[a.keyword] === "prio" ? 1 : 0, pb = kwFocus[b.keyword] === "prio" ? 1 : 0;
                            if (pa !== pb) return pb - pa;
                            // Daarbinnen de actieve kolomsortering, of standaard op naam.
                            if (g) { const av = g(a), bv = g(b); return (typeof av === "string" || typeof bv === "string") ? String(av).localeCompare(String(bv)) * dir : (av - bv) * dir; }
                            return a.keyword.localeCompare(b.keyword);
                          });
                        })().map((k) => {
                          const improved = k.positionBefore != null && k.positionAfter != null && k.positionAfter < k.positionBefore;
                          const worse = k.positionBefore != null && k.positionAfter != null && k.positionAfter > k.positionBefore;
                          // Positie: lager = beter. Delta = voor - na (positief = gestegen).
                          const delta = k.positionBefore != null && k.positionAfter != null ? k.positionBefore - k.positionAfter : null;
                          const isPrio = kwFocus[k.keyword] === "prio";
                          // AI-Overviews-signaal: impressies stabiel/omhoog maar CTR duidelijk omlaag = de klik lekt naar een AI-antwoord bovenaan.
                          const imprStable = (k.impressionsBefore || 0) > 0 && (k.impressionsAfter || 0) >= (k.impressionsBefore || 0) * 0.85;
                          const ctrDropped = k.ctrBefore != null && k.ctrAfter != null && k.ctrAfter < k.ctrBefore * 0.7;
                          const aiSignal = imprStable && ctrDropped;
                          return (
                            <tr key={k.keyword} className={isPrio ? "wz-kw-prio" : ""}>
                              <td className="wz-kw-check"><input type="checkbox" checked={isPrio} onChange={() => toggleKwFocus(k.keyword)} title="Aanvinken als belangrijk zoekwoord (komt bovenaan)" /></td>
                              <td>{k.keyword}{aiSignal && <span className="wz-aio" title="Impressies stabiel maar CTR fors omlaag: waarschijnlijk een AI Overview / zero-click die de klik pakt">AIO?</span>}</td>
                              <td>{k.volume != null ? k.volume.toLocaleString("nl-NL") : "—"}</td>
                              <td>{k.positionBefore ?? "—"}</td>
                              <td className={improved ? "wz-pos" : worse ? "wz-neg" : ""}>{k.positionAfter ?? "—"}</td>
                              <td className={"wz-verschil " + (delta != null && delta > 0 ? "up" : delta != null && delta < 0 ? "down" : "")}>
                                {delta == null || delta === 0 ? "—" : `${delta > 0 ? "▲ +" : "▼ "}${Math.abs(Math.round(delta * 10) / 10)}`}
                              </td>
                              <td className="wz-kw-ba">{k.clicksBefore} <span className="wz-arrow">→</span> <span className={k.clicksAfter > k.clicksBefore ? "wz-pos" : k.clicksAfter < k.clicksBefore ? "wz-neg" : ""}>{k.clicksAfter}</span></td>
                              <td className="wz-kw-ba">{(k.impressionsBefore ?? 0)} <span className="wz-arrow">→</span> {(k.impressionsAfter ?? 0)}</td>
                              <td className="wz-kw-ba">{k.ctrBefore != null ? `${k.ctrBefore}%` : "—"} <span className="wz-arrow">→</span> <span className={k.ctrBefore != null && k.ctrAfter != null && k.ctrAfter > k.ctrBefore ? "wz-pos" : k.ctrBefore != null && k.ctrAfter != null && k.ctrAfter < k.ctrBefore ? "wz-neg" : ""}>{k.ctrAfter != null ? `${k.ctrAfter}%` : "—"}</span></td>
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
                {kpi.gscConnected === false ? (
                  <div className="phase2-note">De Google-koppeling is verlopen; daarom tonen de grafieken geen data. <a href="/api/google/auth/start">Koppel Google opnieuw</a>, dan laden ze direct weer.</div>
                ) : kpi.daily.length < 2 && kpi.keywords.length === 0 && !(kpi.ga4 && kpi.ga4.available) && (
                  <div className="muted" style={{ fontSize: 12 }}>Nog geen GSC-data voor deze periode (Search Console loopt 1-3 dagen achter, en na een verse wijziging is er nog weinig data ná het moment).</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Prioriteit-pagina's bovenaan; daarbinnen blijft de datumvolgorde (stabiele sort).
  const clusters = [...clusterChanges(events)].sort((a, b) => (priority.has(prioKey(b.rep.url)) ? 1 : 0) - (priority.has(prioKey(a.rep.url)) ? 1 : 0));
  return (
    <div className="cockpit-card acc-teal">
      <div className="ck-section-head">
        <span>Wijzigingen ({clusters.length}) <HelpHint xl title="Wijzigingen: wat is er veranderd, en werkte het?" text={"SEO-werk bewijst zich pas als je de aanpassing én het effect naast elkaar ziet. Dit tabblad legt beide vast: **wat er op elke pagina veranderd is, wanneer, door wie; en wat de rankings daarna deden.**\n## Waar de wijzigingen vandaan komen\n- **Uit WordPress** (met de koppeling): de complete bewerkingshistorie per pagina, tot zo'n 8 maanden terug, inclusief aanpassingen door de klant of hun eigen developer; wie het deed staat erbij. Zonder koppeling wordt per pagina de laatste wijzigingsdatum opgehaald.\n- **Uit de scan:** 'Scan op wijzigingen' legt een basislijn vast van elke pagina (titel, koppen, alt-teksten, interne links, woordenaantal, schema) en detecteert daarna elk verschil; ook op sites zonder WordPress.\n- **Handmatig:** een bekende aanpassing uit het verleden kun je zelf toevoegen om het effect alsnog te volgen.\n## Hoe je het effect leest\nAanpassingen aan dezelfde pagina binnen 2 dagen worden gebundeld tot één moment (Google indexeert de pagina dan toch opnieuw als één geheel). Klik het moment open en je ziet de KPI-ontwikkeling eromheen: posities, klikken en vertoningen vóór en ná de wijziging. Dat is het eerlijkste antwoord op de vraag 'heeft die aanpassing gewerkt?'.\n## Handig\nDe ster zet een pagina op prioriteit (gedeeld met de andere tabs); geprioriteerde pagina's staan hier altijd bovenaan."} /></span>
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button type="button" className="ghost-btn small" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Sluiten" : "Wijziging toevoegen"}</button>
          {!wpSet && <button type="button" className="ghost-btn small" onClick={() => setWpSetupOpen((v) => !v)} title="WordPress-applicatiewachtwoord instellen voor de volledige bewerkingshistorie">WordPress-koppeling</button>}
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
            <div style={{ flex: 1 }}>
              <label className="compose-label">WordPress-gebruikersnaam</label>
              <input className="compose-input" style={{ width: "100%" }} value={wpUser} onChange={(e) => setWpUser(e.target.value)} placeholder="bv. je inlognaam of e-mail van de WordPress-beheeromgeving"
                name="pw_site_login" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
              <div className="hint">De naam waarmee je inlogt in de WordPress-beheeromgeving van deze klant (iemand met bewerkrechten).</div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="compose-label">Applicatiewachtwoord</label>
              <input className="compose-input" style={{ width: "100%" }} type="password" value={wpPass} onChange={(e) => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                name="pw_site_apptoken" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
              <div className="hint">De code uit WordPress-beheer → Gebruikers → Profiel → Wachtwoorden voor applicaties. Niet je gewone wachtwoord.</div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: "inline-flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="primary-btn small" onClick={saveWpCreds} disabled={wpSaveBusy || !wpUser.trim() || !wpPass.trim()}>{wpSaveBusy ? "Testen…" : "Opslaan en testen"}</button>
            {wpSet && <button type="button" className="ghost-btn small" onClick={removeWpCreds} disabled={wpSaveBusy}>Koppeling verwijderen</button>}
            {wpSet && <span className="muted" style={{ fontSize: 12 }}>Ingesteld{wpUser ? ` (${wpUser})` : ""}.</span>}
          </div>
          {wpSaveMsg && <div className={wpSaveOk ? "saved-msg" : "login-error"} style={{ marginTop: 8 }}>{wpSaveMsg}</div>}
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
      <p className="muted" style={{ marginTop: 4 }}>Detecteert automatisch wat er op de live pagina's verandert (titel, koppen, alt-teksten, interne links, woordenaantal, schema). De eerste scan legt de basislijn vast; daarna zie je hier elke wijziging.
        {wpSet && <> WordPress is gekoppeld. <button type="button" className="link-inline" onClick={() => setWpSetupOpen((v) => !v)}>koppeling beheren</button>.</>}
      </p>
      {msg && <div className={/mislukt|fout|niet /i.test(msg) ? "login-error" : "saved-msg"} style={{ marginTop: 8 }}>{msg}</div>}
      {loading && <div className="muted" style={{ padding: 12 }}>Laden…</div>}
      {!loading && events.length === 0 && <div className="muted" style={{ padding: 12 }}>Nog geen wijzigingen. Draai een scan (basislijn), en na een volgende scan verschijnen hier de veranderingen.</div>}
      <div className="wz-list">
        {clusters.map(({ rep: e, count }) => {
          const isPrio = priority.has(prioKey(e.url));
          return (
            <div key={e.id} className={"wz-item-wrap" + (isPrio ? " prio" : "")}>
              <span className={"wz-star" + (isPrio ? " on" : "")} title={isPrio ? "Prioriteit aan, klik om uit te zetten" : "Markeer als prioriteit (komt bovenaan)"} onClick={() => togglePriority(e.url)}>{isPrio ? "★" : "☆"}</span>
              <button type="button" className="wz-item" onClick={() => setOpen(e)}>
                <div className="wz-item-main">
                  <div className="wz-item-title">{e.diff.meta_title?.after || e.diff.h1?.after || shortUrl(e.url)}{count > 1 ? <span style={{ color: "var(--orange-dark)", fontWeight: 600 }}> · {count} wijzigingen gebundeld</span> : ""}</div>
                  <div className="wz-item-sub">{shortUrl(e.url)} · {e.summary}{e.isManual ? " · handmatig" : ""}</div>
                </div>
                <div className="wz-item-date">{dt(e.detectedAt)}</div>
              </button>
            </div>
          );
        })}
      </div>

      {(() => {
        const opts = bundelOptimalisaties(optRijen);
        return (
          <div className="wz-opt">
            <button type="button" className="wz-opt-kop" onClick={() => setOptOpen((v) => !v)} aria-expanded={optOpen}>
              <span className="wz-opt-pijl">{optOpen ? "▾" : "▸"}</span>
              <span>Doorgevoerde optimalisaties</span>
              <span className="wz-opt-teller">{opts.length} pagina&rsquo;s</span>
            </button>
            {optOpen && (
              <div className="wz-opt-body">
                <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "0 0 var(--s-3)" }}>
                  Alles wat we zelf op de site hebben gezet (meta-teksten, alt-teksten, structured data, interne links,
                  redirects, live gezette copy), per pagina en met de nieuwste bovenaan. Klik op &ldquo;effect volgen&rdquo;
                  om er een meetmoment van te maken; daarna zie je de kliks, positie en CTR vóór en ná die aanpassing.
                </p>
                {opts.length === 0 && (
                  <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                    Nog niets doorgevoerd. Zodra je in de werklijst een meta- of alt-tekst live zet, verschijnt de pagina hier.
                  </div>
                )}
                {opts.map((o) => {
                  const gevolgd = events.some((e) => prioKey(e.url) === prioKey(o.url));
                  return (
                    <div key={o.url} className="wz-opt-rij">
                      <span className="wz-opt-datum">{dt(o.laatste)}</span>
                      <a className="wz-opt-pad" href={o.url} target="_blank" rel="noreferrer" title="Open deze pagina op de site">{shortUrl(o.url)}</a>
                      <span className="wz-opt-wat">
                        {o.tellers.map((t) => (
                          <span key={t.soort} className={"act-soort act-soort-" + t.soort}>{t.n}× {OPT_LABEL[t.soort] || t.soort}</span>
                        ))}
                      </span>
                      <button type="button" className="ghost-btn small" disabled={optBusy === o.url} onClick={() => void volgEffect(o)}
                        title={gevolgd ? "Open het meetmoment van deze pagina" : "Leg een meetmoment vast en volg het effect op kliks, positie en CTR"}>
                        {optBusy === o.url ? "Bezig…" : gevolgd ? "effect bekijken" : "effect volgen"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

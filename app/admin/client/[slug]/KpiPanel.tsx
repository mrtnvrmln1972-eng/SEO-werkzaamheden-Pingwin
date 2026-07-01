"use client";

import { useEffect, useState } from "react";
import type { GscComparison, Ga4Comparison } from "../../../../lib/google";

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

// Klein lijngrafiekje van het dagverloop. invert=true (positie): dalend = beter.
function Sparkline({ data, invert }: { data: number[]; invert?: boolean }) {
  if (!data || data.length < 2) return null;
  const w = 120, h = 30, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const first = data[0], last = data[data.length - 1];
  const improved = invert ? last < first : last > first;
  const color = last === first ? "#9e9e9e" : improved ? "#2E7D32" : "#C62828";
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
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

export default function KpiPanel({ slug, domain }: { slug: string; domain: string }) {
  const [days, setDays] = useState(28);
  const [gsc, setGsc] = useState<GscComparison | null>(null);
  const [ga4, setGa4] = useState<Ga4Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean>(true);

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
      })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [slug, days]);

  const periodLabel = PERIODS.find((p) => p.days === days)?.label || `${days} dagen`;

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
        <div className="cockpit-card">
          <div className="ck-section-head"><span>Search Console</span><span className="ck-updated">{gsc.range.curStart} t/m {gsc.range.curEnd}</span></div>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-value">{nl(gsc.totals.clicks.cur)}</div><div className="kpi-label">Klikken</div><Delta cur={gsc.totals.clicks.cur} prev={gsc.totals.clicks.prev} pct /><Sparkline data={gsc.series.clicks} /></div>
            <div className="kpi-card"><div className="kpi-value">{nl(gsc.totals.impressions.cur)}</div><div className="kpi-label">Vertoningen</div><Delta cur={gsc.totals.impressions.cur} prev={gsc.totals.impressions.prev} pct /><Sparkline data={gsc.series.impressions} /></div>
            <div className="kpi-card"><div className="kpi-value">{gsc.totals.ctr.cur.toFixed(1)}%</div><div className="kpi-label">CTR</div><Delta cur={gsc.totals.ctr.cur} prev={gsc.totals.ctr.prev} isPos /><Sparkline data={gsc.series.ctr} /></div>
            <div className="kpi-card"><div className="kpi-value">{gsc.totals.position.cur.toFixed(1)}</div><div className="kpi-label">Gem. positie</div><Delta cur={gsc.totals.position.cur} prev={gsc.totals.position.prev} invert isPos /><Sparkline data={gsc.series.position} invert /></div>
          </div>
        </div>
      )}

      {!loading && gsc && gsc.keywords.length > 0 && (
        <div className="cockpit-card">
          <div className="ck-section-head"><span>Zoekwoorden uit Search Console ({gsc.keywords.length})</span></div>
          <div className="res-table-wrap">
            <table className="res-table kpi-table">
              <thead><tr><th>Zoekwoord</th><th>Positie</th><th>Klikken</th><th>Vertoningen</th><th>CTR</th></tr></thead>
              <tbody>
                {gsc.keywords.map((k) => (
                  <tr key={k.keyword}>
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
        </div>
      )}

      {!loading && gsc && gsc.pages.length > 0 && (
        <div className="cockpit-card">
          <div className="ck-section-head"><span>Pagina&rsquo;s uit Search Console ({gsc.pages.length})</span></div>
          <div className="res-table-wrap">
            <table className="res-table kpi-table">
              <thead><tr><th>Pagina</th><th>Klikken</th><th>Vertoningen</th></tr></thead>
              <tbody>
                {gsc.pages.map((p) => (
                  <tr key={p.url}>
                    <td><a href={p.url} target="_blank" rel="noreferrer">{shortUrl(p.url)}</a></td>
                    <td>{nl(p.clicks)} <Delta cur={p.clicks} prev={p.prevClicks} /></td>
                    <td>{nl(p.impressions)} <Delta cur={p.impressions} prev={p.prevImpressions} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && ga4 && ga4.propertyId === null && (
        <div className="cockpit-card"><div className="phase2-note">Google is gekoppeld, maar er is nog geen GA4-property gevonden voor {domain || "deze klant"}.</div></div>
      )}

      {!loading && ga4 && ga4.totals.length > 0 && (
        <div className="cockpit-card">
          <div className="ck-section-head"><span>Google Analytics</span><span className="ck-updated">laatste {periodLabel}</span></div>
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
        </div>
      )}
    </div>
  );
}

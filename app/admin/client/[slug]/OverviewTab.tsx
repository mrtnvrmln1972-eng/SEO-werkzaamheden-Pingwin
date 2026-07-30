"use client";

import { useEffect, useState } from "react";
import OverviewChat from "./OverviewChat";
import WerkplanPanel from "./WerkplanPanel";

type Status = {
  totaal: number; leeg: number; halfPlan: number; heeftPlan: number;
  docsAnalyse: number; docsBlauwdruk: number; docsCopy: number;
  kapot: number; klikken: number; vertoningen: number;
};
type Fruit = { url: string; bestKeyword: string; position: number; impressions: number; clicks: number; volume: number | null; score: number; label: string; level: string };
type Ctr = { url: string; keyword: string; extraClicks: number; ctr: number; position: number };
type Gat = { keyword: string; volume: number | null; difficulty: number | null; reason: string };
type Overview = { ok: boolean; hasDomain: boolean; status: Status; fruit: Fruit[]; ctr: Ctr[]; gaten: Gat[]; updatedAt: string };

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function fmt(n: number): string { return (n || 0).toLocaleString("nl-NL"); }

// Site-breed overzicht per klant: waar staan we (werkstatus) en waar zit het
// laaghangend fruit. De bird's eye-chat komt in een volgende fase rechts hiernaast.
export default function OverviewTab({ slug, clientName, onGoToPage, onGoToTask, chatConfigured }: { slug: string; clientName?: string; onGoToPage?: (url: string) => void; onGoToTask?: (taskId: number) => void; chatConfigured?: boolean }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cacheKey = `pw_overview_${slug}`;

  async function load(fresh = false) {
    if (fresh) setRefreshing(true);
    try {
      const r = await fetch(`/api/admin/overview?slug=${encodeURIComponent(slug)}${fresh ? "&fresh=1" : ""}`);
      const d = await r.json();
      if (d.ok) { setData(d); try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* cache is extra */ } }
    } catch { /* stil */ } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    try { const c = localStorage.getItem(cacheKey); if (c) { const p = JSON.parse(c); if (p && p.ok) { setData(p); setLoading(false); } } } catch { /* geen cache */ }
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug]);

  const s = data?.status;

  return (
    <div className="overview-tab ov-layout">
      <div className="ov-chatcol">
        <OverviewChat slug={slug} configured={chatConfigured !== false} onGoToPage={onGoToPage} onGoToTask={onGoToTask} />
      </div>

      <div className="ov-side">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Overzicht{clientName ? ` — ${clientName}` : ""}</span>
          <button type="button" className={"pcd-btn" + (refreshing ? " busy" : "")} onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Vernieuwen…" : "Vernieuwen"}</button>
        </div>

        {loading && !data && <div className="muted" style={{ marginTop: 12 }}>Overzicht laden…</div>}

        {data && !data.hasDomain && (
          <div className="muted" style={{ marginTop: 12 }}>Deze klant heeft nog geen website-adres. Vul dat in bij de Pagina&rsquo;s-tab (&ldquo;Website inlezen&rdquo;), dan verschijnt hier het overzicht.</div>
        )}

        {s && (
          <>
            {/* ── Werkstatus: waar staan we ── */}
            <div className="ov-cards">
              <div className="ov-card"><span className="ov-num">{s.totaal}</span><span className="ov-lab">pagina&rsquo;s</span></div>
              <div className="ov-card ov-plan"><span className="ov-num">{s.heeftPlan}</span><span className="ov-lab">met strategie</span></div>
              <div className="ov-card ov-half"><span className="ov-num">{s.halfPlan}</span><span className="ov-lab">half plan</span></div>
              <div className="ov-card ov-leeg"><span className="ov-num">{s.leeg}</span><span className="ov-lab">nog leeg</span></div>
              {s.kapot > 0 && <div className="ov-card ov-bad"><span className="ov-num">{s.kapot}</span><span className="ov-lab">foutstatus</span></div>}
            </div>
            <div className="ov-docs muted">
              Documenten gemaakt: {s.docsAnalyse} analyses · {s.docsBlauwdruk} blauwdrukken · {s.docsCopy} copy &nbsp;|&nbsp; totaal {fmt(s.klikken)} klikken en {fmt(s.vertoningen)} vertoningen (90 dagen)
            </div>
          </>
        )}
      </div>

      <WerkplanPanel slug={slug} onGoToPage={onGoToPage} />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import OverviewChat from "./OverviewChat";
import WeekplanBoard from "./WeekplanBoard";

type Status = {
  totaal: number; leeg: number; halfPlan: number; heeftPlan: number;
  docsAnalyse: number; docsBlauwdruk: number; docsCopy: number;
  kapot: number; klikken: number; vertoningen: number;
};
type Fruit = { url: string; bestKeyword: string; position: number; impressions: number; clicks: number; volume: number | null; score: number; label: string; level: string };
type Ctr = { url: string; keyword: string; extraClicks: number; ctr: number; position: number };
type Gat = { keyword: string; volume: number | null; difficulty: number | null; reason: string };
type Overview = { ok: boolean; hasDomain: boolean; status: Status; fruit: Fruit[]; ctr: Ctr[]; gaten: Gat[]; extraKlaar?: boolean; updatedAt: string };

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function fmt(n: number): string { return (n || 0).toLocaleString("nl-NL"); }

// Site-breed overzicht per klant: waar staan we (werkstatus) en waar zit het
// laaghangend fruit. De bird's eye-chat komt in een volgende fase rechts hiernaast.
export default function OverviewTab({ slug, clientName, domain, onGoToPage, onGoToTask, onGoToMeta, chatConfigured }: { slug: string; clientName?: string; domain?: string; onGoToPage?: (url: string) => void; onGoToTask?: (taskId: number) => void; onGoToMeta?: () => void; chatConfigured?: boolean }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Draait de tweede ronde nog? Dan tonen de twee trage blokken dat ze onderweg zijn.
  const [aanvullen, setAanvullen] = useState(false);
  const cacheKey = `pw_overview_${slug}`;

  // In twee ronden. Eerst wat er direct is (tellingen en laaghangend fruit, onder
  // een seconde), daarna de twee blokken die rekenwerk kosten. Het overzicht stond
  // anders zeven seconden leeg te wachten op 3 kB aan uitkomst.
  async function haal(qs: string) {
    const r = await fetch(`/api/admin/overview?slug=${encodeURIComponent(slug)}${qs}`);
    const d = await r.json();
    if (!d.ok) return null;
    setData(d);
    try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* cache is extra */ }
    return d;
  }

  async function load(fresh = false) {
    if (fresh) setRefreshing(true);
    try {
      if (fresh) { await haal("&fresh=1"); return; }
      const snel = await haal("&snel=1");
      setLoading(false);
      // Stonden de trage blokken nog niet klaar, dan die nu ophalen; de rest van
      // het scherm is dan allang zichtbaar.
      if (!snel || snel.extraKlaar === false) { setAanvullen(true); await haal("").finally(() => setAanvullen(false)); }
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
        <OverviewChat slug={slug} domain={domain} configured={chatConfigured !== false} onGoToPage={onGoToPage} onGoToTask={onGoToTask} />
        <WeekplanBoard slug={slug} onGoToPage={onGoToPage} />
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

      {data && (data.fruit.length > 0 || data.ctr.length > 0 || data.gaten.length > 0) && (
        <div className="ov-columns">
          {/* ── Laaghangend fruit ── */}
          {data.fruit.length > 0 && (
            <div className="cockpit-card">
              <div className="ck-section-head"><span>Laaghangend fruit</span></div>
              <div className="muted ov-hint">Pagina&rsquo;s die al scoren maar net buiten de top staan. Van boven naar beneden aanpakken.</div>
              <ul className="ov-list">
                {data.fruit.map((f) => (
                  <li key={f.url} className="ov-item">
                    <div className="ov-item-main">
                      <span className={"pg-kans " + f.level}>{f.label}</span>
                      <a className="ov-link" href={f.url} target="_blank" rel="noreferrer">{shortUrl(f.url)}</a>
                    </div>
                    <div className="ov-item-sub muted">&ldquo;{f.bestKeyword}&rdquo; · positie {f.position} · {fmt(f.impressions)} vertoningen{f.volume != null ? ` · vol ${fmt(f.volume)}` : ""}</div>
                    <div className="ov-item-actions">
                      <button type="button" className="ov-item-btn" onClick={() => onGoToPage?.(f.url)}>Open in Pagina&rsquo;s →</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── CTR-onderkans + keyword-gaten ── */}
          {aanvullen && data.ctr.length === 0 && data.gaten.length === 0 && (
            <div className="ov-col">
              <div className="ck-section-head"><span>CTR-onderkans en keyword-gaten</span></div>
              <div className="muted" style={{ fontSize: 13 }}>Deze twee worden er nog bij gehaald&hellip;</div>
            </div>
          )}
          {(data.ctr.length > 0 || data.gaten.length > 0) && (
            <div className="cockpit-card">
              {data.ctr.length > 0 && (
                <>
                  <div className="ck-section-head"><span>Meta &amp; CTR-onderkans</span></div>
                  <div className="muted ov-hint">Veel vertoningen, te weinig klikken. Betere titel/omschrijving = direct meer bezoekers.</div>
                  <ul className="ov-list">
                    {data.ctr.map((c) => (
                      <li key={c.url} className="ov-item">
                        <div className="ov-item-main">
                          <a className="ov-link" href={c.url} target="_blank" rel="noreferrer">{shortUrl(c.url)}</a>
                          <span className="ov-gain">~{fmt(c.extraClicks)} klikken erbij</span>
                        </div>
                        <div className="ov-item-sub muted">&ldquo;{c.keyword}&rdquo; · positie {c.position} · CTR {c.ctr}%</div>
                        {onGoToMeta && <div className="ov-item-actions"><button type="button" className="ov-item-btn" onClick={onGoToMeta}>Open in Meta &amp; CTR-tab →</button></div>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.gaten.length > 0 && (
                <>
                  <div className="ck-section-head" style={{ marginTop: data.ctr.length > 0 ? 16 : 0 }}><span>Keyword-gaten</span></div>
                  <div className="muted ov-hint">Relevante zoekwoorden waar de site nog niet op scoort.</div>
                  <ul className="ov-list">
                    {data.gaten.map((g, i) => (
                      <li key={i} className="ov-item">
                        <div className="ov-item-main"><span className="ov-kw">{g.keyword}</span>{g.volume != null && <span className="ov-gain">vol {fmt(g.volume)}</span>}</div>
                        {g.reason && <div className="ov-item-sub muted">{g.reason}</div>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

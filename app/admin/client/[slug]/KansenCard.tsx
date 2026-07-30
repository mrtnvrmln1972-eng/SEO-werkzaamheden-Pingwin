"use client";

import { useState } from "react";

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

// Dichtgeklapte "Kansen"-kaart onder aan Taken: het site-brede overzicht (werkstatus,
// laaghangend fruit, CTR-onderkans, keyword-gaten). Bewust standaard dicht en pas
// bij openen geladen, zodat het geen muur wordt (dezelfde data zit ook in de bird's
// eye-context, en CTR/fruit overlappen Meta & CTR en de KPI's).
export default function KansenCard({ slug, clientName, onGoToPage, onGoToMeta }: {
  slug: string; clientName?: string; onGoToPage?: (url: string) => void; onGoToMeta?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const cacheKey = `pw_overview_${slug}`;

  async function load(fresh = false) {
    if (fresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch(`/api/admin/overview?slug=${encodeURIComponent(slug)}${fresh ? "&fresh=1" : ""}`);
      const d = await r.json();
      if (d.ok) { setData(d); try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* cache is extra */ } }
    } catch { /* stil */ } finally { setLoading(false); setRefreshing(false); }
  }

  function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && !loadedOnce) {
      try { const c = localStorage.getItem(cacheKey); if (c) { const p = JSON.parse(c); if (p && p.ok) setData(p); } } catch { /* geen cache */ }
      setLoadedOnce(true);
      load();
    }
  }

  const s = data?.status;

  return (
    <div className="cockpit-card strategy-card">
      <button type="button" className="strategy-head" onClick={toggle}>
        <span className="strategy-caret">{open ? "▾" : "▸"}</span>
        <span className="strategy-title">Kansen <span className="muted" style={{ fontWeight: 400 }}>&middot; laaghangend fruit, CTR, keyword-gaten</span></span>
        {open && (
          <span
            className={"pcd-btn" + (refreshing ? " busy" : "")}
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); load(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); load(true); } }}
            style={{ marginLeft: "auto" }}
          >{refreshing ? "Vernieuwen…" : "Vernieuwen"}</span>
        )}
      </button>

      <div className="ov-side strategy-body" style={{ display: open ? undefined : "none" }}>
        {loading && !data && <div className="muted" style={{ marginTop: 12 }}>Overzicht laden…</div>}

        {data && !data.hasDomain && (
          <div className="muted" style={{ marginTop: 12 }}>Deze klant heeft nog geen website-adres. Vul dat in bij de Pagina&rsquo;s-tab (&ldquo;Website inlezen&rdquo;), dan verschijnt hier het overzicht.</div>
        )}

        {s && (
          <>
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

        {data && (data.fruit.length > 0 || data.ctr.length > 0 || data.gaten.length > 0) && (
          <div className="ov-columns">
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

        {data && data.hasDomain && data.fruit.length === 0 && data.ctr.length === 0 && data.gaten.length === 0 && (
          <div className="muted" style={{ marginTop: 12 }}>Geen directe kansen gevonden in de laatste data.</div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type NextStep = { label: string; actie: "pijplijn_starten" | "meta_verbeteren" | "alt_teksten" | "open"; steps?: string[]; zin: string };
type Item = {
  url: string; slug: string; live: boolean; status: "bezig" | "gepland" | "gedaan";
  keyword: string; volume: number | null; position: number | null; impressions: number; clicks: number;
  kansLabel: string; kansLevel: string; docs: string[]; next: NextStep;
};
type Werkplan = { ok: boolean; bezig: Item[]; gepland: Item[]; gedaan: Item[] };

function fmt(n: number | null): string { return (n || 0).toLocaleString("nl-NL"); }
const ahrefsKwUrl = (kw: string) => `https://app.ahrefs.com/keywords-explorer/google/nl/overview?keyword=${encodeURIComponent(kw)}`;

// Eén pagina-kaart: de ene volgende zet als primaire knop, de rest secundair
// achter "meer". De klik ís de goedkeuring; de zware back-end draait erachter.
function PageCard({ it, slug, onGoToPage, onGoToMeta }: { it: Item; slug: string; onGoToPage?: (url: string) => void; onGoToMeta?: () => void }) {
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [msgOk, setMsgOk] = useState(true);
  const [more, setMore] = useState(false);

  async function run(type: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(type); setMsg("");
    try {
      const r = await fetch("/api/admin/werkplan/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, type, url: it.url, ...extra }) });
      const d = await r.json();
      setMsgOk(!!d.ok); setMsg(d.result?.message || d.error || (d.ok ? "Klaar." : "Mislukt."));
    } catch { setMsgOk(false); setMsg("Mislukt."); } finally { setBusy(""); }
  }

  function doNext() {
    const n = it.next;
    if (n.actie === "open") { onGoToPage?.(it.url); return; }
    run(n.actie, n.actie === "pijplijn_starten" ? { steps: n.steps } : n.actie === "meta_verbeteren" ? { keyword: it.keyword } : {});
  }

  return (
    <div className="wp-card">
      <div className="wp-card-top">
        <a className="wp-slug" href={it.url} target="_blank" rel="noreferrer" title="Open de live pagina">{it.slug}</a>
        {it.kansLabel && <span className={"pg-kans " + it.kansLevel}>{it.kansLabel}</span>}
        {!it.live && <span className="wp-chip wp-chip-plan">te bouwen</span>}
      </div>
      {(it.keyword || it.impressions > 0) && (
        <div className="wp-meta">
          {it.keyword && <span className="wp-kw">{it.keyword}</span>}
          {it.position != null && <span>pos {it.position}</span>}
          {it.impressions > 0 && <span>{fmt(it.impressions)} vert.</span>}
          {it.volume != null && <span>vol {fmt(it.volume)}</span>}
          {it.docs.length > 0 && <span className="wp-docs">docs: {it.docs.join(", ")}</span>}
        </div>
      )}

      {it.status !== "gedaan" && <div className="wp-next">{it.next.zin}</div>}

      <div className="wp-btns">
        {it.status !== "gedaan" && (
          <button type="button" className={"wp-btn wp-btn-primary" + (busy ? " busy" : "")} onClick={doNext} disabled={!!busy} title="Pak precies deze ene stap; de rest draait erachter.">{busy ? "Bezig…" : it.next.label}</button>
        )}
        <button type="button" className="wp-btn wp-btn-ghost" onClick={() => setMore((m) => !m)}>{more ? "Minder" : "Meer"}</button>
      </div>

      {more && (
        <div className="wp-btns wp-more">
          <button type="button" className={"wp-btn wp-btn-ghost" + (busy === "meta_verbeteren" ? " busy" : "")} onClick={() => run("meta_verbeteren", { keyword: it.keyword })} disabled={!!busy} title="Genereer een betere meta-title en description (pixelbreedte + criteria).">Meta</button>
          <button type="button" className={"wp-btn wp-btn-ghost" + (busy === "alt_teksten" ? " busy" : "")} onClick={() => run("alt_teksten")} disabled={!!busy} title="Genereer een alt-tekst-lijst voor de sitebouwer.">Alt-teksten</button>
          <button type="button" className={"wp-btn wp-btn-ghost" + (busy === "pijplijn_starten" ? " busy" : "")} onClick={() => run("pijplijn_starten")} disabled={!!busy} title="Draai de hele pijplijn (analyse, blauwdruk, copy).">Hele pijplijn</button>
          {onGoToPage && <button type="button" className="wp-btn wp-btn-ghost" onClick={() => onGoToPage(it.url)} title="Open deze pagina in de Pagina's-tab voor de diepgaande analyse.">Open in Pagina&rsquo;s</button>}
          {onGoToMeta && it.kansLevel !== "none" && <button type="button" className="wp-btn wp-btn-ghost" onClick={onGoToMeta} title="Bekijk deze pagina in de Meta & CTR-tab: nu, wat het moet worden, en doorzetten naar de site.">Open in Meta-tab</button>}
          {it.keyword && <a className="wp-btn wp-btn-ghost" href={ahrefsKwUrl(it.keyword)} target="_blank" rel="noreferrer" title="Bekijk dit zoekwoord in Ahrefs.">Ahrefs</a>}
        </div>
      )}

      {msg && <div className={"wp-msg" + (msgOk ? "" : " wp-msg-err")}>{msgOk ? "✓ " : ""}{msg}</div>}
    </div>
  );
}

// Het visuele werkplan: pagina's in drie gekleurde secties (bezig / gepland / gedaan).
export default function WerkplanPanel({ slug, onGoToPage, onGoToMeta }: { slug: string; onGoToPage?: (url: string) => void; onGoToMeta?: () => void }) {
  const [data, setData] = useState<Werkplan | null>(null);
  const [loading, setLoading] = useState(true);
  const [gedaanOpen, setGedaanOpen] = useState(false);
  const cacheKey = `pw_werkplan_${slug}`;

  useEffect(() => {
    let alive = true;
    try { const c = localStorage.getItem(cacheKey); if (c) { const p = JSON.parse(c); if (p?.ok) { setData(p); setLoading(false); } } } catch { /* geen cache */ }
    fetch(`/api/admin/werkplan?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) { setData(d); try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* extra */ } } })
      .catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug]);

  if (loading && !data) return <div className="cockpit-card"><div className="muted">Werkplan laden…</div></div>;
  if (!data) return null;
  const { bezig, gepland, gedaan } = data;
  const empty = bezig.length === 0 && gepland.length === 0 && gedaan.length === 0;

  return (
    <div className="cockpit-card wp-panel">
      <div className="ck-section-head"><span>Werkplan</span></div>
      {empty && <div className="muted" style={{ fontSize: 13 }}>Nog geen werkplan. Vraag de bird&rsquo;s eye hiernaast bijvoorbeeld: &ldquo;Vul het werkplan vanuit onze afgesproken navigatie.&rdquo;</div>}

      {bezig.length > 0 && (
        <div className="wp-group">
          <div className="wp-group-head wp-head-bezig">Bezig <span className="wp-count">{bezig.length}</span></div>
          {bezig.map((it) => <PageCard key={it.url} it={it} slug={slug} onGoToPage={onGoToPage} onGoToMeta={onGoToMeta} />)}
        </div>
      )}

      {gepland.length > 0 && (
        <div className="wp-group">
          <div className="wp-group-head wp-head-gepland">Gepland / kansen <span className="wp-count">{gepland.length}</span></div>
          {gepland.map((it) => <PageCard key={it.url} it={it} slug={slug} onGoToPage={onGoToPage} onGoToMeta={onGoToMeta} />)}
        </div>
      )}

      {gedaan.length > 0 && (
        <div className="wp-group">
          <button type="button" className="wp-group-head wp-head-gedaan wp-head-toggle" onClick={() => setGedaanOpen((o) => !o)}>
            <span>{gedaanOpen ? "▾" : "▸"} Gedaan</span> <span className="wp-count">{gedaan.length}</span>
          </button>
          {gedaanOpen && gedaan.map((it) => <PageCard key={it.url} it={it} slug={slug} onGoToPage={onGoToPage} onGoToMeta={onGoToMeta} />)}
        </div>
      )}
    </div>
  );
}

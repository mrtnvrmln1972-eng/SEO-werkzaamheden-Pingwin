"use client";

import { useEffect, useState } from "react";
import { Omlaag, Uitklap } from "../../../_ui/Pijl";

type NextStep = { label: string; actie: "pijplijn_starten" | "meta_verbeteren" | "alt_teksten" | "open"; steps?: string[]; zin: string };
type DocLinks = { analyse: string; blauwdruk: string; copy: string };
type Item = {
  url: string; slug: string; live: boolean; status: "bezig" | "gepland" | "geschreven" | "gedaan";
  keyword: string; volume: number | null; position: number | null; impressions: number; clicks: number;
  kansLabel: string; kansLevel: string; docs: string[]; next: NextStep;
  doorgevoerd: boolean; copyLivePct: number | null; copyLiveGemeten: string | null; copyLiveMeetbaar: boolean;
  links: DocLinks;
};
type Werkplan = { ok: boolean; bezig: Item[]; gepland: Item[]; geschreven: Item[]; gedaan: Item[] };

function fmt(n: number | null): string { return (n || 0).toLocaleString("nl-NL"); }
const ahrefsKwUrl = (kw: string) => `https://app.ahrefs.com/keywords-explorer/google/nl/overview?keyword=${encodeURIComponent(kw)}`;
const DOC_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy" };

// De documenten als linkjes in plaats van als kale tekst. Is er (nog) geen link
// bewaard, dan tonen we de naam wel maar zonder link; zo zie je nog steeds dat
// het document bestaat.
function DocChips({ docs, links }: { docs: string[]; links?: DocLinks }) {
  if (!docs.length) return null;
  const volgorde = ["analyse", "blauwdruk", "copy"].filter((k) => docs.includes(k));
  const rest = docs.filter((d) => !volgorde.includes(d));
  return (
    // Bewust NIET de klasse wp-docs: die bestaat al voor het documentenblok op de
    // weekplan-kaart en zou deze chips onder elkaar zetten.
    <span className="wp-doc-chips">
      {[...volgorde, ...rest].map((d) => {
        const href = links?.[d as keyof DocLinks] || "";
        const label = DOC_LABEL[d] || d;
        return href
          ? <a key={d} className="wp-doc-chip" href={href} target="_blank" rel="noreferrer" title={`Open het ${label.toLowerCase()}-document`}>{label}</a>
          : <span key={d} className="wp-doc-chip wp-doc-chip-leeg" title="Dit document bestaat, maar er is geen link bewaard">{label}</span>;
      })}
    </span>
  );
}

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
        {it.status === "geschreven" && (
          it.copyLiveMeetbaar
            ? <span className="wp-chip wp-chip-geschreven" title="De copy is geschreven maar staat nog niet op de pagina">nog niet doorgevoerd</span>
            : <span className="wp-chip wp-chip-onbekend" title="De pagina kon niet gelezen worden, dus we weten niet of de copy erop staat">niet gecontroleerd</span>
        )}
      </div>
      {(it.keyword || it.impressions > 0 || it.docs.length > 0) && (
        <div className="wp-meta">
          {it.keyword && <span className="wp-kw">{it.keyword}</span>}
          {it.position != null && <span>pos {it.position}</span>}
          {it.impressions > 0 && <span>{fmt(it.impressions)} vert.</span>}
          {it.volume != null && <span>vol {fmt(it.volume)}</span>}
          <DocChips docs={it.docs} links={it.links} />
        </div>
      )}

      {/* Wat de meting zag, zodat "nog niet doorgevoerd" navolgbaar is en niet
          zomaar een oordeel. */}
      {it.copyLivePct != null && it.status !== "gepland" && (
        <div className="wp-live-meting">
          {!it.copyLiveMeetbaar
            ? "De pagina kon niet gelezen worden, dus dit is niet gecontroleerd."
            : it.doorgevoerd
              ? `Copy staat live (${it.copyLivePct}% van de koppen gevonden op de pagina).`
              : `Copy nog niet op de pagina gevonden (${it.copyLivePct}% van de koppen).`}
        </div>
      )}

      {it.status !== "gedaan" && <div className="wp-next">{it.next.zin}</div>}

      <div className="wp-btns">
        {it.status !== "gedaan" && (
          <button type="button" className={"btn btn-primary btn-klein wp-btn-primary" + (busy ? " busy" : "")} onClick={doNext} disabled={!!busy} title="Pak precies deze ene stap; de rest draait erachter.">{busy ? "Bezig…" : it.next.label}</button>
        )}
        <button type="button" className="btn btn-klein" onClick={() => setMore((m) => !m)}>{more ? "Minder" : "Meer"}</button>
      </div>

      {more && (
        <div className="wp-btns wp-more">
          <button type="button" className={"btn btn-klein" + (busy === "meta_verbeteren" ? " busy" : "")} onClick={() => run("meta_verbeteren", { keyword: it.keyword })} disabled={!!busy} title="Genereer een betere meta-title en description (pixelbreedte + criteria).">Meta</button>
          <button type="button" className={"btn btn-klein" + (busy === "alt_teksten" ? " busy" : "")} onClick={() => run("alt_teksten")} disabled={!!busy} title="Genereer een alt-tekst-lijst voor de sitebouwer.">Alt-teksten</button>
          <button type="button" className={"btn btn-klein" + (busy === "pijplijn_starten" ? " busy" : "")} onClick={() => run("pijplijn_starten")} disabled={!!busy} title="Draai de hele pijplijn (analyse, blauwdruk, copy).">Hele pijplijn</button>
          {onGoToPage && <button type="button" className="btn btn-klein" onClick={() => onGoToPage(it.url)} title="Open deze pagina in de Pagina's-tab voor de diepgaande analyse.">Open in Pagina&rsquo;s</button>}
          {onGoToMeta && it.kansLevel !== "none" && <button type="button" className="btn btn-klein" onClick={onGoToMeta} title="Bekijk deze pagina in de Meta & CTR-tab: nu, wat het moet worden, en doorzetten naar de site.">Open in Meta-tab</button>}
          {it.keyword && <a className="btn btn-klein" href={ahrefsKwUrl(it.keyword)} target="_blank" rel="noreferrer" title="Bekijk dit zoekwoord in Ahrefs.">Ahrefs</a>}
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
  const [checkBezig, setCheckBezig] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");
  const cacheKey = `pw_werkplan_${slug}`;

  function laad(): Promise<void> {
    return fetch(`/api/admin/werkplan?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) { setData(d); try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* cache is extra */ } } })
      .catch(() => {});
  }

  // Meet of de geschreven copy echt op de site staat en ververs daarna het plan,
  // zodat je meteen ziet wat er verschuift van "geschreven" naar "gedaan".
  async function controleerSite() {
    if (checkBezig) return;
    setCheckBezig(true); setCheckMsg("");
    try {
      const d = await fetch("/api/admin/copy-live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      setCheckMsg(d?.ok ? d.samenvatting : (d?.error || "De controle mislukte."));
      if (d?.ok) await laad();
    } catch {
      setCheckMsg("De controle mislukte. Probeer het nog een keer.");
    } finally { setCheckBezig(false); }
  }

  useEffect(() => {
    let alive = true;
    try { const c = localStorage.getItem(cacheKey); if (c) { const p = JSON.parse(c); if (p?.ok) { setData(p); setLoading(false); } } } catch { /* geen cache */ }
    laad().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug]);

  if (loading && !data) return <div className="cockpit-card"><div className="muted">Werkplan laden…</div></div>;
  if (!data) return null;
  const { bezig, gepland, gedaan } = data;
  // Oudere gecachte antwoorden kennen de groep "geschreven" nog niet.
  const geschreven = data.geschreven || [];
  const empty = bezig.length === 0 && gepland.length === 0 && geschreven.length === 0 && gedaan.length === 0;

  return (
    <div className="cockpit-card wp-panel">
      <div className="ck-section-head">
        <span>Werkplan</span>
        <button type="button" className="btn btn-ghost wp-check-btn" onClick={() => void controleerSite()} disabled={checkBezig}
          title="Haalt elke pagina met copy op van de site en kijkt of de geschreven koppen er echt op staan">
          {checkBezig ? "Bezig met controleren…" : "Controleer de site"}
        </button>
      </div>
      {checkMsg && <div className="wp-check-msg">{checkMsg}</div>}
      {empty && <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Nog geen werkplan. Vraag de bird&rsquo;s eye hiernaast bijvoorbeeld: &ldquo;Vul het werkplan vanuit onze afgesproken navigatie.&rdquo;</div>}

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

      {geschreven.length > 0 && (
        <div className="wp-group">
          <div className="wp-group-head wp-head-geschreven">Geschreven, nog niet doorgevoerd <span className="wp-count">{geschreven.length}</span></div>
          {geschreven.map((it) => <PageCard key={it.url} it={it} slug={slug} onGoToPage={onGoToPage} onGoToMeta={onGoToMeta} />)}
        </div>
      )}

      {gedaan.length > 0 && (
        <div className="wp-group">
          <button type="button" className="wp-group-head wp-head-gedaan wp-head-toggle" onClick={() => setGedaanOpen((o) => !o)}>
            <span>{gedaanOpen ? <Omlaag /> : <Uitklap />} Gedaan</span> <span className="wp-count">{gedaan.length}</span>
          </button>
          {gedaanOpen && gedaan.map((it) => <PageCard key={it.url} it={it} slug={slug} onGoToPage={onGoToPage} onGoToMeta={onGoToMeta} />)}
        </div>
      )}
    </div>
  );
}

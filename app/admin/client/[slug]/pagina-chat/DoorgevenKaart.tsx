"use client";

// Stap 2: het advies uit de strategie-chat doorgeven aan gelieerde pagina's.
// De ontvangende pagina's krijgen het als vertrekpunt ("half plan").
import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../../lib/markdown";
import HelpHint from "../HelpHint";

export default function DoorgevenKaart({ slug, url, siteBase, lastAssistant, taskDone, setChatOpen, setErr, onClusterApplied, clusterDone, setClusterDone, clusterItems, setClusterItems, clusterMsg, setClusterMsg, gelieerdeUrls }: {
  slug: string; url: string; siteBase: string; lastAssistant: string;
  taskDone: boolean; setChatOpen: (v: boolean) => void;
  setErr: (v: string) => void; onClusterApplied?: () => void;
  clusterDone: number; setClusterDone: (v: number) => void;
  clusterItems: { url: string; advice: string }[] | null;
  setClusterItems: (v: { url: string; advice: string }[] | null) => void;
  clusterMsg: string; setClusterMsg: (v: string) => void;
  gelieerdeUrls: { url: string; wanneer: string | null }[];
}) {
  // Elke stap is een inklapbare, genummerde kaart (toggle).
  const [doorgevenOpen, setDoorgevenOpen] = useState(false);
  const [clusterBusy, setClusterBusy] = useState(false);
  const [clusterSel, setClusterSel] = useState<string[]>([]);
  // Het overzichtje met vinkjes: aan welke pagina's is er vanuit deze pagina
  // advies doorgegeven (geladen zodra de kaart openklapt).
  const [outgoing, setOutgoing] = useState<{ url: string; advice: string }[] | null>(null);

  // Bij een andere pagina hoort een vers overzicht (stond eerst in het
  // inladen van het meegegeven advies; zelfde moment, zelfde werking).
  useEffect(() => { setOutgoing(null); }, [slug, url]);

  // Overzichtje met vinkjes: laden zodra de Doorgeven-kaart openklapt en er
  // eerder advies is doorgegeven.
  useEffect(() => {
    if (!doorgevenOpen || clusterDone === 0 || outgoing !== null) return;
    let alive = true;
    fetch(`/api/admin/page-chat/cluster-advice?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}&direction=out`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) setOutgoing(d.outgoing || []); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [doorgevenOpen, clusterDone, outgoing, slug, url]);

  // ── Cluster-advies doorgeven aan andere betrokken pagina's ──
  const clusterAbortRef = useRef<AbortController | null>(null);
  async function findClusterAdvice() {
    if (!lastAssistant || clusterBusy) return;
    setClusterBusy(true); setClusterMsg(""); setErr("");
    const ctrl = new AbortController();
    clusterAbortRef.current = ctrl;
    try {
      const r = await fetch("/api/admin/page-chat/cluster-advice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, analysis: lastAssistant }), signal: ctrl.signal });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Betrokken pagina's zoeken mislukt."); return; }
      const items: { url: string; advice: string }[] = d.items || [];
      setClusterItems(items);
      setClusterSel(items.map((it) => it.url));
      // Nooit stil falen: paden die in de conclusie staan maar niet in de
      // ingelezen paginalijst, worden gemeld in plaats van genegeerd.
      const notFound: string[] = d.notFound || [];
      if (notFound.length) setClusterMsg(`Let op: ${notFound.join(", ")} ${notFound.length === 1 ? "wordt" : "worden"} in de tekst genoemd maar staat niet in de ingelezen paginalijst. Bestaat de pagina wel? Lees dan de website opnieuw in (Pagina's-tab) en probeer opnieuw.`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr("Betrokken pagina's zoeken mislukt.");
    } finally { setClusterBusy(false); clusterAbortRef.current = null; }
  }
  function toggleCluster(u: string) { setClusterSel((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u])); }
  async function applyClusterAdvice() {
    const items = (clusterItems || []).filter((it) => clusterSel.includes(it.url));
    if (!items.length || clusterBusy) return;
    setClusterBusy(true); setClusterMsg(""); setErr("");
    try {
      const r = await fetch("/api/admin/page-chat/cluster-advice/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, sourceUrl: url, sourceAnalysis: lastAssistant, items }) });
      const d = await r.json();
      if (d.ok) {
        { const n = d.saved || items.length; setClusterDone(n); setOutgoing(null); try { localStorage.setItem(`pw_clusterdone_${slug}_${url}`, String(n)); } catch { /* geen opslag */ } if (n > 0 && taskDone) setChatOpen(false); }
        setClusterMsg(`Advies doorgegeven aan ${d.saved} pagina('s). Hun eigen chat neemt dit voortaan als vertrekpunt mee; in het overzicht krijgen ze de markering "half plan".`);
        setClusterItems(null);
        onClusterApplied?.();
      } else setErr(d.error || "Doorgeven mislukt.");
    } catch { setErr("Doorgeven mislukt."); } finally { setClusterBusy(false); }
  }

  return (
      <div className={"page-chat-cluster-card step-card step-card-3" + (clusterDone > 0 ? " done" : "")}>
        <div className="step-head" onClick={() => setDoorgevenOpen((o) => !o)}>
          <span className="step-caret">{doorgevenOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{clusterDone > 0 ? "✓" : "2"}</span>
          <span className="step-title">Doorgeven aan gelieerde pagina&rsquo;s</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Stap 2 — Doorgeven aan gelieerde pagina's" text={"Een goede strategie voor één pagina raakt bijna altijd andere pagina's: een pagina die dezelfde term kaapt en moet herrichten, een locatiepagina die een eigen term krijgt, een pagina die een interne link moet gaan geven. Deze stap zorgt dat die beslissingen niet verdampen zodra je dit scherm sluit.\n## Hoe het werkt\n- Het systeem leest de volledige conclusie van de strategie-chat en haalt eruit welke **andere, bestaande** pagina's erin genoemd worden; alleen URL's die echt in de paginalijst staan tellen mee (er wordt niets verzonnen).\n- Per geraakte pagina wordt het advies samengevat dat specifiek over die pagina gaat: de bedoelde rol, het primaire zoekwoord, de actie en eventuele interne-link-afspraken.\n- Jij vinkt aan welke pagina's het advies krijgen en klikt doorgeven.\n## Wat de ontvangende pagina's ermee doen\n- Ze krijgen het advies als **vertrekpunt** ('half plan'): open je daar de strategie-stap, dan ligt deze beslissing er al, inclusief de volledige bronconclusie van dit gesprek als context.\n- De chat van die pagina toetst het meegegeven advies vervolgens aan de eigen live feiten (rankings, inhoud) in plaats van blind over te nemen.\n## Waarom dit belangrijk is\nCannibalisatie ontstaat meestal niet door slechte analyses maar door losse beslissingen die elkaar tegenspreken. Door de clusterbeslissing één keer te nemen en expliciet door te geven, blijft de eigenaar-keuze per zoekintentie overal consistent; precies wat Google nodig heeft om één duidelijke pagina per intentie te kunnen belonen."} /></span>
        </div>
        {/* Wat er is uitgegaan blijft zichtbaar. De melding na het starten verdween,
            waardoor het leek alsof er niets was gebeurd terwijl het advies er wel lag. */}
        {gelieerdeUrls.length > 0 && (
          <div className="pch-gelieerd">
            Advies doorgegeven aan{" "}
            {gelieerdeUrls.map((g, i) => (
              <span key={g.url}>
                {i > 0 && ", "}
                <a href={g.url} target="_blank" rel="noreferrer">{(() => { try { return new URL(g.url).pathname; } catch { return g.url; } })()}</a>
              </span>
            ))}
            {gelieerdeUrls[0]?.wanneer && <span className="pch-gelieerd-datum"> · {new Date(gelieerdeUrls[0].wanneer).toLocaleDateString("nl-NL")}</span>}
          </div>
        )}
        {doorgevenOpen && (
        <div className="page-chat-cluster step-body">
          {!lastAssistant ? (
            <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Werk eerst de strategie uit in de chat (stap 2); daarna kun je het advies doorgeven aan gelieerde pagina&rsquo;s.</div>
          ) : (<>
            <div className="pchf-lead">Raakt deze analyse ook andere pagina&rsquo;s in het cluster? Geef hun advies alvast door.</div>
            {clusterDone > 0 ? (
              <>
                <button type="button" className="pcd-btn pcd-btn-done" disabled>&#10003; Doorgegeven aan {clusterDone} pagina&rsquo;s</button>
                {outgoing === null ? (
                  <div className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-2)" }}>Overzicht laden…</div>
                ) : outgoing.length === 0 ? null : (
                  <ul className="pch-cluster-list" style={{ marginTop: "var(--s-3)" }}>
                    {outgoing.map((it) => (
                      <li key={it.url} className="pch-cluster-item">
                        <div className="pch-cluster-head">
                          <span style={{ color: "var(--good)", fontWeight: 700 }}>&#10003;</span>
                          <span className="pch-cluster-url">{it.url}</span>
                        </div>
                        <div className="pch-cluster-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice, siteBase) }} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : clusterItems === null ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
                <button type="button" className="pcd-btn" onClick={findClusterAdvice} disabled={clusterBusy}>{clusterBusy ? "Betrokken pagina's zoeken…" : "Advies doorgeven aan betrokken pagina's"}</button>
                {clusterBusy && (
                  <button type="button" className="btn btn-klein" onClick={() => clusterAbortRef.current?.abort()}
                    title="Onderbreek het zoeken; er wordt niets opgeslagen.">&times; Onderbreken</button>
                )}
              </span>
            ) : clusterItems.length === 0 ? (
              <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Geen andere pagina&rsquo;s gevonden waarover deze analyse concreet advies geeft.</div>
            ) : (
              <>
                <ul className="pch-cluster-list">
                  {clusterItems.map((it) => (
                    <li key={it.url} className="pch-cluster-item">
                      <label className="pch-cluster-head">
                        <input type="checkbox" checked={clusterSel.includes(it.url)} onChange={() => toggleCluster(it.url)} />
                        <span className="pch-cluster-url">{it.url}</span>
                      </label>
                      <div className="pch-cluster-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice, siteBase) }} />
                    </li>
                  ))}
                </ul>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
                  <button type="button" className="pcd-btn pcd-btn-primary" onClick={applyClusterAdvice} disabled={clusterBusy || clusterSel.length === 0}>{clusterBusy ? "Doorgeven…" : `Doorgeven aan ${clusterSel.length} pagina('s)`}</button>
                  <HelpHint wide title="Doorgeven aan de aangevinkte pagina's" text={"Stuurt het advies uit deze analyse naar de aangevinkte pagina's. Elke ontvangende pagina krijgt het als **vertrekpunt ('half plan')**: het staat daar klaar in de strategie-stap en in het pagina-overzicht, mét de volledige conclusie van dit gesprek als context.\nZo hoef je de clusterbeslissing maar één keer te nemen en spreekt geen enkele pagina hem later per ongeluk tegen."} />
                </span>
              </>
            )}
            {clusterMsg && <div className="saved-msg" style={{ marginTop: "var(--s-2)" }}>{clusterMsg}</div>}
          </>)}
          </div>
          )}
        </div>
  );
}

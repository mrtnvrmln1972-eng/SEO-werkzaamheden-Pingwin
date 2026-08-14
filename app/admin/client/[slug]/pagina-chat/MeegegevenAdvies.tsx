"use client";

// Cluster-advies dat AAN deze pagina is meegegeven (vertrekpunt van een andere
// analyse). Staat boven de strategie-kaart: de chat neemt dit automatisch mee.
import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../../lib/markdown";

export default function MeegegevenAdvies({ slug, url, siteBase }: { slug: string; url: string; siteBase: string }) {
  const [incoming, setIncoming] = useState<{ advice: string; sourceUrl: string; sourceAnalysis: string }[]>([]);
  const [incomingOpen, setIncomingOpen] = useState(false);
  const [negeerBusy, setNegeerBusy] = useState<string | null>(null);

  // Meegegeven cluster-advies voor deze pagina ophalen (toont de vertrekpunt-kaart).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/page-chat/cluster-advice?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) setIncoming(d.incoming || []); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [slug, url]);

  // Advies negeren: haalt het definitief weg, zodat het niet meer als vertrekpunt
  // meegaat in de chat of de samenvatting. Bedoeld voor advies dat achterhaald is
  // (bijvoorbeeld door een nieuwere, eigen strategie op deze pagina).
  async function negeer(sourceUrl: string) {
    if (negeerBusy) return;
    setNegeerBusy(sourceUrl);
    try {
      await fetch(`/api/admin/page-chat/cluster-advice?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}&sourceUrl=${encodeURIComponent(sourceUrl)}`, { method: "DELETE" });
      setIncoming((list) => list.filter((it) => it.sourceUrl !== sourceUrl));
    } catch { /* niet kritisch, de knop blijft dan gewoon staan */ }
    finally { setNegeerBusy(null); }
  }

  if (incoming.length === 0) return null;
  return (
        <div className="page-chat-incoming">
          <div className="pchf-lead"><strong>Meegegeven vanuit een clusteranalyse.</strong> Dit is als vertrekpunt voor deze pagina bewaard; de chat hieronder neemt het advies én de volledige conclusie automatisch mee, tenzij dit gesprek er expliciet iets anders over zegt. Klopt het niet meer (bijvoorbeeld achterhaald door een nieuwere strategie), negeer het dan hieronder.</div>
          {incoming.map((it, i) => (
            <div key={i} className="pchi-item">
              <div className="pchi-advice md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.advice, siteBase) }} />
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginTop: "var(--s-1)" }}>
                {it.sourceUrl && <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Uit de analyse van <a href={it.sourceUrl} target="_blank" rel="noreferrer">{it.sourceUrl}</a></div>}
                <button type="button" className="ghost-btn small" disabled={negeerBusy === it.sourceUrl} onClick={() => negeer(it.sourceUrl)} title="Dit advies telt niet meer mee in de chat of de samenvatting van deze pagina.">
                  {negeerBusy === it.sourceUrl ? "Bezig…" : "Negeer dit advies"}
                </button>
              </div>
            </div>
          ))}
          {incoming.some((it) => it.sourceAnalysis) && (
            <div style={{ marginTop: "var(--s-2)" }}>
              <button type="button" className="ghost-btn small" onClick={() => setIncomingOpen((o) => !o)}>{incomingOpen ? "Verberg de volledige clusteranalyse" : "Toon de volledige clusteranalyse"}</button>
              {incomingOpen && incoming.filter((it) => it.sourceAnalysis).map((it, i) => (
                <div key={i} className="pchi-full md" dangerouslySetInnerHTML={{ __html: mdToHtml(it.sourceAnalysis, siteBase) }} />
              ))}
            </div>
          )}
        </div>
  );
}

"use client";

// Alle documenten van deze klant op één plek, gegroepeerd per maand: wat is er
// gemaakt, wanneer, en staat het inmiddels op de site. Elk document is een link,
// nooit kale tekst.
//
// Waarom dit er is: analyses, blauwdrukken en copy zaten alleen verstopt per
// pagina. Er was geen enkele plek waar je zag wat er in juli is opgeleverd en wat
// er in augustus ligt, en dat overzicht is precies wat je nodig hebt om het werk
// over de maanden te verdelen.

import { useEffect, useState } from "react";

type DocRij = { kind: string; label: string; naam: string; link: string; datum: string | null };
type DocPagina = { url: string; pad: string; doorgevoerd: boolean | null; docs: DocRij[]; laatste: string | null };

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function maandVan(iso: string | null): string {
  if (!iso) return "Zonder datum";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Zonder datum";
  return `${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
}
function korteDatum(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)}`;
}

export default function DocumentenPanel({ slug, onGoToPage }: { slug: string; onGoToPage?: (url: string) => void }) {
  const [paginas, setPaginas] = useState<DocPagina[] | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  // Documenten die wel tekst hebben maar geen bestand in Drive: die kun je hier
  // alsnog laten aanmaken. De pijplijn sloeg de tekst altijd op, maar maakte alleen
  // een bestand als er op dat moment een Drive-map was ingesteld.
  const [herstelBezig, setHerstelBezig] = useState(false);
  const [herstelMsg, setHerstelMsg] = useState("");
  const [herstelFout, setHerstelFout] = useState(false);

  useEffect(() => {
    let alive = true;
    setLaden(true); setFout("");
    fetch(`/api/admin/documenten?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d?.ok) setPaginas(d.paginas || []); else setFout(d?.error || "Kon het overzicht niet laden."); })
      .catch(() => { if (alive) setFout("Kon het overzicht niet laden."); })
      .finally(() => { if (alive) setLaden(false); });
    return () => { alive = false; };
  }, [slug]);

  async function herstel() {
    if (herstelBezig) return;
    setHerstelBezig(true); setHerstelMsg(""); setHerstelFout(false);
    try {
      const d = await fetch("/api/admin/documenten", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, herstel: true }),
      }).then((r) => r.json());
      setHerstelFout(!d?.ok);
      setHerstelMsg(d?.ok
        ? d.samenvatting + (d.overgeslagen?.length ? ` (${d.overgeslagen.map((o: { reden: string }) => o.reden)[0]})` : "")
        : (d?.error || "Herstellen mislukte."));
      if (d?.ok && d.hersteld) {
        const n = await fetch(`/api/admin/documenten?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
        if (n?.ok) setPaginas(n.paginas || []);
      }
    } catch { setHerstelFout(true); setHerstelMsg("Herstellen mislukte."); }
    finally { setHerstelBezig(false); }
  }

  if (laden && !paginas) return <div className="cockpit-card"><div className="muted">Documenten laden…</div></div>;
  if (fout) return <div className="cockpit-card"><div className="muted">{fout}</div></div>;
  if (!paginas || !paginas.length) {
    return (
      <div className="cockpit-card">
        <div className="ck-section-head"><span>Documenten</span></div>
        <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Voor deze klant is nog geen analyse, blauwdruk of copy gemaakt.</div>
      </div>
    );
  }

  // Per maand van het jongste document op die pagina; volgorde blijft die van de
  // server (jongste eerst), dus de maanden komen vanzelf op volgorde binnen.
  const maanden: { naam: string; items: DocPagina[] }[] = [];
  for (const p of paginas) {
    const naam = maandVan(p.laatste);
    const laatste = maanden[maanden.length - 1];
    if (laatste && laatste.naam === naam) laatste.items.push(p);
    else maanden.push({ naam, items: [p] });
  }

  const totaal = paginas.reduce((n, p) => n + p.docs.length, 0);
  const live = paginas.filter((p) => p.doorgevoerd === true).length;
  const nietLive = paginas.filter((p) => p.doorgevoerd === false).length;

  return (
    <div className="cockpit-card">
      <div className="ck-section-head">
        <span>Documenten</span>
        <button type="button" className="btn btn-ghost wp-check-btn" disabled={herstelBezig} onClick={() => void herstel()}
          title="Documenten die wel tekst hebben maar geen bestand in Drive alsnog aanmaken in de huisstijl. De opgeslagen tekst is de bron; de inhoud verandert niet.">
          {herstelBezig ? "Bezig met aanmaken…" : "Maak ontbrekende documenten"}
        </button>
      </div>
      {herstelMsg && <div className={"wp-check-msg" + (herstelFout ? " err" : "")}>{herstelMsg}</div>}
      <div className="doc-samenvatting">
        {totaal} {totaal === 1 ? "document" : "documenten"} over {paginas.length} {paginas.length === 1 ? "pagina" : "pagina’s"}
        {live > 0 && <> &middot; {live} staat live</>}
        {nietLive > 0 && <> &middot; {nietLive} nog niet doorgevoerd</>}
      </div>

      {maanden.map((m) => (
        <div key={m.naam} className="doc-maand">
          <div className="doc-maand-kop">{m.naam} <span className="wp-count">{m.items.length}</span></div>
          {m.items.map((p) => (
            <div key={p.url} className="doc-rij">
              <div className="doc-rij-top">
                <a className="wp-slug" href={p.url} target="_blank" rel="noreferrer" title="Open de live pagina">{p.pad}</a>
                {p.doorgevoerd === true && <span className="wp-chip doc-chip-live">staat live</span>}
                {p.doorgevoerd === false && <span className="wp-chip wp-chip-geschreven">nog niet doorgevoerd</span>}
              </div>
              <div className="doc-rij-docs">
                {p.docs.map((d) => (
                  d.link
                    ? <a key={d.kind} className="wp-doc-chip" href={d.link} target="_blank" rel="noreferrer" title={d.naam}>{d.label}{korteDatum(d.datum) && <span className="doc-datum"> {korteDatum(d.datum)}</span>}</a>
                    : <span key={d.kind} className="wp-doc-chip wp-doc-chip-leeg" title="Dit document bestaat, maar er is geen link bewaard">{d.label}{korteDatum(d.datum) && <span className="doc-datum"> {korteDatum(d.datum)}</span>}</span>
                ))}
                {onGoToPage && <button type="button" className="wp-btn wp-btn-ghost doc-open" onClick={() => onGoToPage(p.url)} title="Open deze pagina in de Pagina&rsquo;s-tab">Open pagina</button>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

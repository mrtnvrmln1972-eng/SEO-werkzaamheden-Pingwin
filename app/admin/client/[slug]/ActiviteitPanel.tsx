"use client";

// "Wat we doen": alles wat we voor deze klant hebben uitgevoerd, per maand.
//
// Het werk gebeurt al in het dashboard, maar de sporen zaten verspreid over tien
// tabellen. Hier staat het als één tijdlijn: wanneer, welke pagina, wat voor werk,
// en wie het deed (wij of de sitebouwer).
//
// Bewust aantallen in plaats van uren. Uren automatisch toekennen per handeling
// wordt snel fictie, en dan staat er iets dat niet klopt. Aantallen zijn waar.
//
// De vlag "delen" is voorbereiding: nu nog intern, zodat je later niet met
// terugwerkende kracht door alles heen hoeft om te bepalen wat de klant mag zien.

import { useEffect, useState } from "react";

type Rij = {
  id: number; gebeurdeOp: string; soort: string; url: string | null;
  intern: string; klant: string; wie: string; bewijs: string | null; zichtbaar: boolean;
};

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const SOORT_LABEL: Record<string, string> = {
  analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", "copy-concept": "Copy als concept", "copy-live": "Copy live",
  meta: "Meta-teksten", alt: "Alt-teksten", "intern-link": "Interne links",
  structured: "Structured data", redirect: "Redirect", paginawijziging: "Paginawijziging",
  "gmb-profiel": "Google-profiel", "gmb-review": "Google-review",
  taak: "Taak", mail: "Mail",
};

// Boven dit aantal regels van dezelfde soort, op dezelfde dag, wordt de groep
// standaard samengevouwen (bijvoorbeeld tientallen redirects op één dag).
const GROEP_DREMPEL = 5;

function maandVan(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Zonder datum" : `${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
}
function dagVan(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)}`;
}
function padVan(u: string | null): string {
  if (!u) return "";
  try { const x = new URL(u); return x.pathname + x.search; } catch { return u; }
}

export default function ActiviteitPanel({ slug, onEffect }: { slug: string; onEffect?: (url: string | null, datum: string) => void }) {
  const [rijen, setRijen] = useState<Rij[] | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [msg, setMsg] = useState("");
  const [fout, setFout] = useState(false);

  async function laad() {
    const d = await fetch(`/api/admin/activiteit?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) setRijen(d.rijen || []);
    else setRijen([]);
  }
  useEffect(() => {
    setLaden(true);
    laad().finally(() => setLaden(false));
    // Stil, op de achtergrond, meteen ook het verleden erbij halen: zo hoeft
    // niemand zelf op "Haal het verleden op" te klikken om te zien wat er al
    // klaarstaat. Idempotent (dubbele regels kunnen niet ontstaan), dus dit mag
    // gewoon bij elk bezoek aan dit tabblad.
    fetch("/api/admin/activiteit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, vullen: true }),
    }).then((r) => r.json()).then((d) => { if (d?.ok) void laad(); }).catch(() => {});
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug]);

  async function vullen() {
    if (bezig) return;
    setBezig(true); setMsg(""); setFout(false);
    try {
      const d = await fetch("/api/admin/activiteit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, vullen: true }),
      }).then((r) => r.json());
      setFout(!d?.ok);
      setMsg(d?.ok ? d.samenvatting : (d?.error || "Vullen mislukte."));
      if (d?.ok) await laad();
    } catch { setFout(true); setMsg("Vullen mislukte."); }
    finally { setBezig(false); }
  }

  async function wisselDelen(r: Rij) {
    setRijen((rs) => (rs || []).map((x) => x.id === r.id ? { ...x, zichtbaar: !x.zichtbaar } : x));
    await fetch("/api/admin/activiteit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: r.id, zichtbaar: !r.zichtbaar }),
    }).catch(() => {});
  }

  if (laden && !rijen) return <div className="cockpit-card"><div className="muted">Logboek laden…</div></div>;

  function renderRij(r: Rij, metDatum = true) {
    return (
      <div key={r.id} className="act-rij">
        {metDatum && <span className="act-datum">{dagVan(r.gebeurdeOp)}</span>}
        <span className={"act-soort act-soort-" + r.soort}>{SOORT_LABEL[r.soort] || r.soort}</span>
        <span className="act-tekst">{r.intern}</span>
        {r.url && <a className="act-pad" href={r.url} target="_blank" rel="noreferrer">{padVan(r.url)}</a>}
        {r.bewijs && <a className="act-pad" href={r.bewijs} target="_blank" rel="noreferrer">{r.soort === "mail" ? "mailthread" : "document"}</a>}
        {r.wie !== "Pingwin" && <span className="wp-chip wp-chip-plan">{r.wie}</span>}
        <span className="act-spacer" />
        {onEffect && (
          <button type="button" className="btn btn-quiet btn-klein" title="Bekijk het effect op klikken en posities sinds dit gebeurde"
            onClick={() => onEffect(r.url, r.gebeurdeOp.slice(0, 10))}>
            effect?
          </button>
        )}
        <button type="button" className={"act-deel" + (r.zichtbaar ? " aan" : "")}
          title={r.zichtbaar ? "Staat klaar om met de klant te delen" : "Blijft intern"}
          onClick={() => void wisselDelen(r)}>
          {r.zichtbaar ? "delen" : "intern"}
        </button>
      </div>
    );
  }

  // Per dag + soort groeperen: veel regels van hetzelfde type op één dag (bijv.
  // tientallen redirects) worden anders onleesbaar. Volgorde blijft chronologisch,
  // want de items van een dag staan door de sortering op gebeurdeOp al aaneen.
  function groepeer(items: Rij[]): { dag: string; soort: string; items: Rij[] }[] {
    const groepen: { dag: string; soort: string; items: Rij[] }[] = [];
    const idx = new Map<string, number>();
    for (const r of items) {
      const dag = dagVan(r.gebeurdeOp);
      const key = `${dag}|${r.soort}`;
      if (idx.has(key)) groepen[idx.get(key)!].items.push(r);
      else { idx.set(key, groepen.length); groepen.push({ dag, soort: r.soort, items: [r] }); }
    }
    return groepen;
  }

  const maanden: { naam: string; items: Rij[] }[] = [];
  for (const r of rijen || []) {
    const naam = maandVan(r.gebeurdeOp);
    const laatste = maanden[maanden.length - 1];
    if (laatste && laatste.naam === naam) laatste.items.push(r);
    else maanden.push({ naam, items: [r] });
  }

  return (
    <div className="cockpit-card">
      <div className="ck-section-head">
        <span>Wat we doen</span>
        <button type="button" className="btn btn-ghost wp-check-btn" disabled={bezig} onClick={() => void vullen()}
          title="Vul het logboek met alles wat al vastligt: documenten, doorgezette meta's, afgevinkt dev-werk, structured data, redirects en paginawijzigingen. Nog een keer klikken levert geen dubbele regels op.">
          {bezig ? "Bezig met vullen…" : "Haal het verleden op"}
        </button>
      </div>
      {msg && <div className={"wp-check-msg" + (fout ? " err" : "")}>{msg}</div>}

      {!rijen?.length && (
        <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>
          Nog niets vastgelegd. Klik op &ldquo;Haal het verleden op&rdquo; om te beginnen met wat er al in het dashboard staat.
        </div>
      )}

      {maanden.map((m) => {
        const tel: Record<string, number> = {};
        for (const r of m.items) tel[r.soort] = (tel[r.soort] || 0) + 1;
        return (
          <div key={m.naam} className="doc-maand">
            <div className="doc-maand-kop">{m.naam} <span className="wp-count">{m.items.length}</span></div>
            <div className="act-tellers">
              {Object.entries(tel).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                <span key={s} className="act-teller">{n}× {SOORT_LABEL[s] || s}</span>
              ))}
            </div>
            {groepeer(m.items).map((g) => {
              if (g.items.length > GROEP_DREMPEL) {
                return (
                  <details key={`${g.dag}|${g.soort}`} className="act-groep">
                    <summary className="act-groep-kop">
                      <span className="act-datum">{g.dag}</span>
                      <span className={"act-soort act-soort-" + g.soort}>{SOORT_LABEL[g.soort] || g.soort}</span>
                      <span className="act-groep-aantal">{g.items.length}×</span>
                    </summary>
                    {g.items.map((r) => renderRij(r, false))}
                  </details>
                );
              }
              return g.items.map((r) => renderRij(r));
            })}
          </div>
        );
      })}
    </div>
  );
}

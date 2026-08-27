"use client";

// ═══════════════════════════════════════════════════════════
// HET WERKPLAN, DEELBAAR ZONDER INLOG
// ═══════════════════════════════════════════════════════════
// Dezelfde blokken als in de cockpit, want een klant hoort hetzelfde plan te zien
// als Maarten. Wat er niet in zit: de knoppen die iets vastleggen, de zoekbalk om
// het budget te wijzigen, en elke weg terug naar de rest van het dashboard. Lezen
// dus, en verder niets; het slot zit op de server, niet in dit scherm.

import { useEffect, useMemo, useState } from "react";
import { Chip, Chips } from "../../../_ui/Uitkomst";
import { Omlaag, Uitklap } from "../../../_ui/Pijl";
import {
  bouwWerkplan, urenTekst, FASE_TITEL, FASE_WAAROM, WEKEN_IN_KWARTAAL,
} from "../../../../lib/werkplan";
import type { Weggelaten } from "../../../../lib/opruim-weggelaten";
import type { RestOordeel, RestRegel } from "../../../../lib/rest-duiding";
import { padVan } from "../../../../lib/werk-clusters";
import WegBlok from "../../../admin/client/[slug]/werkplanning-proef/WegBlok";

type Data = {
  ok: boolean; error?: string;
  clientName: string; domain: string;
  regels: any[]; weggelaten: Weggelaten | null;
  rest: { oordeel: RestOordeel; regels: RestRegel[] }[];
  budget: number; lijstDatum: string | null;
};

const nl = new Intl.NumberFormat("nl-NL");
const getal = (n: number | null | undefined) => (n == null ? "—" : nl.format(n));

export default function WerkplanShare({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [fout, setFout] = useState("");
  const [open, setOpen] = useState<Record<string, boolean | undefined>>({});

  useEffect(() => {
    fetch(`/api/share/werkplan?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => (j?.ok ? setD(j) : setFout(j?.error || "Deze link werkt niet meer.")))
      .catch(() => setFout("Het plan kon niet geladen worden."));
  }, [token]);

  const plan = useMemo(
    () => (d ? bouwWerkplan(d.regels || [], [], [], [], d.budget || 3) : null),
    [d],
  );

  if (fout) return <div className="wp-stack wp-wrap"><Chips><Chip toon="let-op">{fout}</Chip></Chips></div>;
  if (!d || !plan) return <div className="wp-stack wp-wrap"><div className="muted">Werkplan wordt geladen…</div></div>;

  return (
    <div className="wp-stack wp-wrap">
      <header className="wp-mast">
        <div className="wp-eyebrow"><span className="wp-eyebrow-bar" />{d.clientName} × Pingwin · SEO</div>
        <h1>Werkplan</h1>
        <p className="wp-lead">
          Alles wat de analyses over deze site hebben uitgewezen, gebundeld per onderwerp en op
          volgorde gezet: eerst uitzoeken welke pagina wint, dan die pagina&#8217;s sterk maken, dan
          het snelle werk.
        </p>
        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-value">{plan.clusters.length}</div><div className="kpi-label">blokken werk</div></div>
          <div className="kpi-card"><div className="kpi-value">{Math.round(plan.minuten / 60)}</div><div className="kpi-label">uur in totaal</div></div>
          <div className="kpi-card"><div className="kpi-value">{plan.paginas}</div><div className="kpi-label">pagina&#8217;s betrokken</div></div>
          <div className="kpi-card"><div className="kpi-value">{getal(plan.volume)}</div><div className="kpi-label">zoekopdrachten per maand</div></div>
        </div>
      </header>

      {plan.perFase.map((f) => {
        const sleutel = `fase-${f.fase}`;
        const uit = !!open[sleutel];
        return (
          <div key={f.fase} className="strategy-card">
            <button type="button" className="strategy-head" onClick={() => setOpen((s) => ({ ...s, [sleutel]: !uit }))}>
              <span className="strategy-caret">{uit ? <Omlaag /> : <Uitklap />}</span>
              <span className="strategy-title">Fase {f.fase} · {FASE_TITEL[f.fase]}</span>
              <span className="strategy-meta-right">
                {f.clusters.length} {f.clusters.length === 1 ? "blok" : "blokken"} · {urenTekst(f.minuten)} · {f.paginas} pagina&#8217;s
              </span>
            </button>
            {uit && (
              <div className="strategy-body">
                <p className="muted">{FASE_WAAROM[f.fase]}</p>
                {f.clusters.map((c) => (
                  <div key={c.sleutel} className="wp-weg-groep">
                    <p className="wp-veldnaam">{c.nummer}. {c.naam}</p>
                    <p className="muted">{c.samenvatting}</p>
                    <div className="wp-weg-paden">
                      {c.paginas.map((p) => (
                        <a key={p.pad} className="uk-pad" target="_blank" rel="noreferrer"
                          href={/^https?:\/\//i.test(p.pad) ? p.pad : `https://${(d.domain || "").replace(/^www\./i, "")}${p.pad}`}>
                          {padVan(p.pad)}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {plan.weken > WEKEN_IN_KWARTAAL && (
        <div className="wp-horizon">
          <p>
            Bij {d.budget} uur per week is dit <strong>{plan.weken} weken</strong> werk in totaal.
            Wil je het hele plan binnen dertien weken af hebben, dan is er{" "}
            <strong>{String(plan.urenVoorKwartaal).replace(".", ",")} uur per week</strong> nodig.
          </p>
        </div>
      )}

      <div className="strategy-card">
        <button type="button" className="strategy-head" onClick={() => setOpen((s) => ({ ...s, weg: !s.weg }))}>
          <span className="strategy-caret">{open.weg ? <Omlaag /> : <Uitklap />}</span>
          <span className="strategy-title">Wat er buiten dit plan valt</span>
          <span className="strategy-meta-right">{d.weggelaten ? `${d.weggelaten.live - d.weggelaten.beoordeeld} pagina's` : ""}</span>
        </button>
        {open.weg && (
          <div className="strategy-body">
            {d.weggelaten && (
              <p className="muted">
                Van de {d.weggelaten.live} pagina&#8217;s die live staan, staan er {d.weggelaten.beoordeeld} in
                het plan. De rest valt er om een reden buiten, en die reden staat hieronder.
              </p>
            )}
            <WegBlok
              weggelaten={d.weggelaten?.paginas || []}
              afgerond={plan.afgerond}
              rest={d.rest || []}
              domein={d.domain}
              open={open}
              onToggle={(k, v) => setOpen((s) => ({ ...s, [k]: v }))}
            />
          </div>
        )}
      </div>

      {d.lijstDatum && (
        <p className="muted">
          Deze lijst is gemaakt op {new Date(d.lijstDatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      )}
    </div>
  );
}

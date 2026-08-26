"use client";

// ═══════════════════════════════════════════════════════════
// WERKPLANNING, PROEF: SIGNALEREN EN BEOORDELEN, PAS DAN PLANNEN
// ═══════════════════════════════════════════════════════════
// Zone 1 "Gesignaleerd" leest de opruim-werklijst (dezelfde motor als het
// Cannibalisatie-tabblad, via /api/admin/opruim-werklijst) en toont per
// onderwerp/cluster de pagina's die nog geen taak zijn. Klap open voor de
// volledige onderbouwing; "Maak taak" zet 'm met één klik op de echte
// weekplanning (dezelfde route als de bestaande "Naar planning"-knop), nu
// wél met het cluster als thread meegestuurd.
//
// Zone 2 "De planning" leest de bestaande weekplanning
// (/api/admin/weekplan), gegroepeerd per cluster (thread). Een geschatte duur
// per taak (nieuw veld) plus een instelbaar urenbudget per week bepalen de
// weekprojectie: taken binnen één cluster houden hun eigen volgorde, taken uit
// een ander, lager geprioriteerd cluster mogen een gaatje in de week vullen.
// Afvinken (bestaande status "klaar") en negeren (nieuw, blijft bestaan maar
// telt niet mee) verhuizen naar een archief met datum; is een heel cluster
// klaar of genegeerd, dan verhuist de hele kaart naar het archief onderaan.
//
// Nog geen onderdeel van het klantmenu of de echte Taken-tab: dit is bewust
// een losse proefpagina om op de echte data te beoordelen.

import { useEffect, useMemo, useState } from "react";
import { urlKey } from "../../../../../lib/url-key";
import { netteHtml } from "../../../../../lib/nette-html";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";

type WerkRegel = {
  pad: string; uitkomst: string; naar: string; herkomst: string[]; reden: string;
  onderbouwing: string[]; term: string; volume: number | null; klikken: number;
  vertoningen: number; positie: number | null; groep: string;
  doorgevoerd?: boolean; contentOver?: boolean;
};

type WeekplanTaak = {
  id: number; thread: string; taak: string; toelichting: string; url: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
  estimateMin: number | null; genegeerd: boolean; genegeerdOp: string;
};

const DEFAULT_MIN = 30;
const UITKOMST_LABEL: Record<string, string> = {
  uitbouwen: "uitbouwen", samenvoegen: "samenvoegen", opruimen: "opruimen", nieuw: "nieuw", blijft: "blijft",
};

function pad(u: string): string {
  if (!u) return "";
  try { return new URL(u).pathname; } catch { return u; }
}
function getal(n: number | null | undefined): string {
  return n == null ? "—" : new Intl.NumberFormat("nl-NL").format(n);
}

export default function WerkplanningProef({ slug }: { slug: string }) {
  const [regels, setRegels] = useState<WerkRegel[]>([]);
  const [taken, setTaken] = useState<WeekplanTaak[]>([]);
  const [budget, setBudget] = useState(3);
  const [budgetIngevuld, setBudgetIngevuld] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [openSig, setOpenSig] = useState<Record<string, boolean>>({});
  const [openCluster, setOpenCluster] = useState<Record<string, boolean>>({});
  const [openArchief, setOpenArchief] = useState<Record<string, boolean>>({});
  const [maakBezig, setMaakBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState("");

  async function laadAlles() {
    setLaden(true); setFout("");
    try {
      const [wr, wp, bud] = await Promise.all([
        fetch(`/api/admin/opruim-werklijst?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/werkplan-budget?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
      ]);
      if (wr?.ok) setRegels(wr.regels || []); else setFout(wr?.error || "De opruimlijst kon niet geladen worden.");
      if (wp?.ok) setTaken((wp.tasks || []).map((t: any) => ({
        id: t.id, thread: t.thread || "", taak: t.taak, toelichting: t.toelichting, url: t.url,
        weekYear: t.weekYear, weekNo: t.weekNo, status: t.status, sortOrder: t.sortOrder,
        estimateMin: t.estimateMin, genegeerd: !!t.genegeerd, genegeerdOp: t.genegeerdOp || "",
      })));
      if (bud?.ok) { setBudget(bud.budget.urenPerWeek); setBudgetIngevuld(bud.budget.ingevuld); }
    } catch {
      setFout("Laden mislukte. Probeer de pagina opnieuw te openen.");
    } finally { setLaden(false); }
  }
  useEffect(() => { laadAlles(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Al een taak: elke url in de weekplanning telt, ongeacht status. Zo komt
  // een regel die al eens gemaakt (en eventueel weer genegeerd) is niet nog
  // eens als "nog geen taak" naar boven.
  const alTaak = useMemo(() => new Set(taken.filter((t) => t.url).map((t) => urlKey(t.url))), [taken]);

  const gesignaleerd = useMemo(
    () => regels.filter((r) => r.pad && !alTaak.has(urlKey(r.pad)) && !r.doorgevoerd),
    [regels, alTaak],
  );
  const perGroep = useMemo(() => {
    const m = new Map<string, WerkRegel[]>();
    for (const r of gesignaleerd) {
      const k = r.groep || "Overig";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [gesignaleerd]);

  async function maakTaak(r: WerkRegel) {
    setMaakBezig(r.pad); setMelding(""); setFout("");
    try {
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, week: 1, wie: "SEO", url: r.pad, thread: r.groep,
          taak: r.reden || `${UITKOMST_LABEL[r.uitkomst] || r.uitkomst}: ${r.pad}`,
          toelichting: r.onderbouwing.join("\n"),
        }),
      }).then((res) => res.json());
      if (d?.ok) { setMelding(`Taak gemaakt: "${r.pad}" staat nu in De planning.`); await laadAlles(); }
      else setFout(d?.error || "Taak maken mislukte.");
    } catch { setFout("Taak maken mislukte."); }
    finally { setMaakBezig(null); }
  }

  // ── De planning: groeperen per cluster, week toewijzen ──
  const perCluster = useMemo(() => {
    const m = new Map<string, WeekplanTaak[]>();
    for (const t of taken) {
      const k = t.thread || "Overig (geen cluster)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const lijst of m.values()) lijst.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    return m;
  }, [taken]);

  const clusterVolgorde = useMemo(() => {
    const entries = [...perCluster.entries()].map(([naam, lijst]) => {
      const open = lijst.filter((t) => t.status !== "klaar" && !t.genegeerd);
      const rang = open.length ? Math.min(...open.map((t) => t.sortOrder)) : Math.min(...lijst.map((t) => t.sortOrder));
      return { naam, open, alles: lijst, rang };
    });
    entries.sort((a, b) => a.rang - b.rang);
    return entries;
  }, [perCluster]);

  // Bin-packing: per cluster een eigen wachtrij (volgorde blijft staan), elke
  // week wordt gevuld door de eerste taak van elke wachtrij die nog past.
  const weekVan = useMemo(() => {
    const budgetMin = Math.max(1, Math.round(budget * 60));
    const wachtrijen = clusterVolgorde.map((c) => ({ naam: c.naam, rij: c.open.slice() }));
    const uit = new Map<number, number>();
    let week = 1;
    while (wachtrijen.some((w) => w.rij.length)) {
      let over = budgetMin;
      let vooruitgang = true;
      while (vooruitgang) {
        vooruitgang = false;
        for (const w of wachtrijen) {
          if (!w.rij.length) continue;
          const voor = w.rij[0];
          const duur = voor.estimateMin ?? DEFAULT_MIN;
          if (duur <= over) { uit.set(voor.id, week); over -= duur; w.rij.shift(); vooruitgang = true; }
        }
      }
      const restOver = wachtrijen.some((w) => w.rij.length);
      if (restOver) {
        let kleinste: { w: typeof wachtrijen[number]; duur: number } | null = null;
        for (const w of wachtrijen) {
          if (!w.rij.length) continue;
          const duur = w.rij[0].estimateMin ?? DEFAULT_MIN;
          if (!kleinste || duur < kleinste.duur) kleinste = { w, duur };
        }
        if (kleinste) { uit.set(kleinste.w.rij[0].id, week); kleinste.w.rij.shift(); }
      }
      week++;
    }
    return uit;
  }, [clusterVolgorde, budget]);

  const totOpenMin = clusterVolgorde.reduce((s, c) => s + c.open.reduce((s2, t) => s2 + (t.estimateMin ?? DEFAULT_MIN), 0), 0);
  const maxWeek = Math.max(0, ...[...weekVan.values()]);

  async function zetStatus(t: WeekplanTaak, status: string) {
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: t.id, status }),
    });
    await laadAlles();
  }
  async function zetNegeer(t: WeekplanTaak, genegeerd: boolean) {
    await fetch("/api/admin/weekplan/negeer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: t.id, genegeerd }),
    });
    await laadAlles();
  }
  async function zetDuur(t: WeekplanTaak, min: number | null) {
    setTaken((ts) => ts.map((x) => (x.id === t.id ? { ...x, estimateMin: min } : x)));
    await fetch("/api/admin/weekplan/estimate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: t.id, min }),
    });
  }
  async function boost(thread: string) {
    await fetch("/api/admin/weekplan/boost", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, thread }),
    });
    await laadAlles();
  }
  async function bewaarBudget(uren: number) {
    setBudget(uren);
    const d = await fetch("/api/admin/werkplan-budget", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, urenPerWeek: uren }),
    }).then((r) => r.json());
    if (d?.ok) setBudgetIngevuld(true);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "var(--ruimte-scherm)" }}>
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 className="wpp-h1">
            Werkplanning, proef
          </h1>
          <span className="chip">{slug}</span>
        </div>
        <p style={{ color: "var(--kleur-tekst-zacht)", marginTop: "var(--ruimte-naast)", maxWidth: "68ch" }}>
          Twee zones. Gesignaleerd komt rechtstreeks uit Opruimen; niets wordt vanzelf een taak. De planning
          bevat alleen wat je hier hebt overgenomen, gegroepeerd per cluster.
        </p>
        {fout && <p className="section" style={{ color: "var(--kleur-fout)" }}>{fout}</p>}
        {melding && <p className="section" style={{ color: "var(--kleur-goed)" }}>{melding}</p>}
        {laden && <p style={{ color: "var(--kleur-tekst-stil)" }}>Bezig met laden&#8230;</p>}
      </div>

      {!laden && (
        <>
          <div className="section">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--ruimte-naast)" }}>
              <h2 className="wpp-h2">Gesignaleerd, nog geen taak</h2>
              <span className="chip">{gesignaleerd.length} regels</span>
            </div>
            {[...perGroep.entries()].map(([groep, lijst]) => (
              <div key={groep} className="card section" style={{ padding: "var(--ruimte-groep)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong style={{ color: "var(--kleur-kop)" }}>{groep}</strong>
                  <span className="chip">{lijst.length} pagina&#8217;s</span>
                </div>
                <ul className="wpp-lijst-mt">
                  {lijst.map((r) => {
                    const isOpen = !!openSig[r.pad];
                    return (
                      <li key={r.pad} style={{ borderTop: "1px solid var(--kleur-rand)", padding: "var(--ruimte-regel) 0" }}>
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <span className="row" style={{ gap: "var(--ruimte-krap)" }}>
                              <span style={{ fontFamily: "monospace", fontSize: "var(--type-bijschrift)" }}>{pad(r.pad)}</span>
                              <span className="chip">{UITKOMST_LABEL[r.uitkomst] || r.uitkomst}</span>
                            </span>
                            <div style={{ fontSize: "var(--type-bijschrift)", color: "var(--kleur-tekst-stil)", marginTop: "var(--ruimte-krap)" }}>
                              {r.naar && <>naar <span style={{ fontFamily: "monospace" }}>{pad(r.naar)}</span> &middot; </>}
                              {r.volume != null && <>{getal(r.volume)}/mnd &middot; </>}
                              {r.positie != null && <>positie {r.positie}</>}
                            </div>
                            {r.onderbouwing.length > 0 && (
                              <button type="button" className="btn btn-quiet btn-klein" style={{ marginTop: "var(--ruimte-krap)" }}
                                onClick={() => setOpenSig((s) => ({ ...s, [r.pad]: !s[r.pad] }))}>
                                {isOpen ? "▾ minder" : "▸ volledige onderbouwing"}
                              </button>
                            )}
                          </div>
                          <button
                            type="button" className="btn btn-primary btn-klein"
                            disabled={maakBezig === r.pad}
                            onClick={() => maakTaak(r)}
                          >
                            {maakBezig === r.pad ? "Bezig…" : "+ Maak taak"}
                          </button>
                        </div>
                        {isOpen && (
                          <div
                            className="md"
                            style={{ marginTop: "var(--ruimte-naast)", marginLeft: "var(--ruimte-groep)", fontSize: "var(--type-bijschrift)" }}
                            dangerouslySetInnerHTML={{ __html: netteHtml(r.onderbouwing.join("\n\n")) }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!perGroep.size && <p style={{ color: "var(--kleur-tekst-stil)" }}>Niets meer te beoordelen.</p>}
          </div>

          <div className="section">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--ruimte-naast)" }}>
              <h2 className="wpp-h2">De planning</h2>
              <span className="row" style={{ gap: "var(--ruimte-naast)" }}>
                <span className="chip">{clusterVolgorde.reduce((s, c) => s + c.open.length, 0)} open taken</span>
                <span className="chip">{Math.round((totOpenMin / 60) * 10) / 10}u werk</span>
                <span className="chip">{maxWeek} weken</span>
              </span>
            </div>
            <div className="row" style={{ marginBottom: "var(--ruimte-groep)", fontSize: "var(--type-bijschrift)", color: "var(--kleur-tekst-zacht)" }}>
              Beschikbaar per week:
              <input
                type="number" min={0.5} step={0.5} defaultValue={budget}
                onBlur={(e) => bewaarBudget(Number(e.target.value) || budget)}
                style={{ width: 56, textAlign: "center", border: "1px solid var(--kleur-rand)", borderRadius: "var(--ronding-knop)", padding: "var(--ruimte-krap)" }}
              /> uur {!budgetIngevuld && <span>(nog niet opgeslagen, staat op de standaard)</span>}
            </div>

            {clusterVolgorde.map(({ naam, open, alles }) => {
              const archief = alles.filter((t) => t.status === "klaar" || t.genegeerd);
              const isOpen = !!openCluster[naam];
              const archOpen = !!openArchief[naam];
              if (!open.length && !archief.length) return null;
              return (
                <div key={naam} className="card strategy-card section">
                  <button type="button" className="strategy-head" onClick={() => setOpenCluster((s) => ({ ...s, [naam]: !s[naam] }))}>
                    <span className="strategy-caret">{isOpen ? <Omlaag /> : <Uitklap />}</span>
                    <span className="strategy-title">{naam}</span>
                    <span className="strategy-meta-right">
                      {open.length} open{archief.length ? ` · ${archief.length} afgerond/genegeerd` : ""}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="strategy-body">
                      <div className="pnl-acties-groep" role="group">
                        <button type="button" className="btn btn-ghost btn-klein" onClick={() => boost(naam)}>Zet vooraan</button>
                      </div>
                      <ul className="wpp-lijst">
                        {open.map((t) => (
                          <li key={t.id} style={{ borderTop: "1px solid var(--kleur-rand)", padding: "var(--ruimte-regel) 0" }}>
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "var(--ruimte-naast)" }}>
                              <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetStatus(t, "klaar")} title="Markeer als klaar">Klaar</button>
                              <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetNegeer(t, true)} title="Negeren">Negeer</button>
                              <span style={{ flex: 1 }}>
                                <div>{t.taak}</div>
                                {t.url && <div style={{ fontSize: "var(--type-label)", color: "var(--kleur-tekst-stil)", fontFamily: "monospace" }}>{pad(t.url)}</div>}
                              </span>
                              <span className="chip">week {weekVan.get(t.id) ?? "—"}</span>
                              <input
                                type="number" min={5} step={5}
                                defaultValue={t.estimateMin ?? DEFAULT_MIN}
                                onBlur={(e) => zetDuur(t, Number(e.target.value) || null)}
                                style={{ width: 52, textAlign: "right", border: "1px solid var(--kleur-rand)", borderRadius: "var(--ronding-knop)", padding: "var(--ruimte-krap)" }}
                              />
                              <span style={{ fontSize: "var(--type-label)", color: "var(--kleur-tekst-stil)" }}>min{t.estimateMin == null ? " (schatting)" : ""}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {archief.length > 0 && (
                        <>
                          <button type="button" className="deelkop" aria-expanded={archOpen}
                            onClick={() => setOpenArchief((s) => ({ ...s, [naam]: !s[naam] }))}>
                            Afgerond of genegeerd binnen deze kaart
                            <span className="deelkop-meta">{archief.length}</span>
                          </button>
                          {archOpen && (
                            <ul className="wpp-lijst">
                              {archief.map((t) => (
                                <li key={t.id} className="row" style={{ justifyContent: "space-between", padding: "var(--ruimte-krap) 0" }}>
                                  <span style={{ textDecoration: "line-through", color: "var(--kleur-tekst-stil)" }}>{t.taak}</span>
                                  <span style={{ fontSize: "var(--type-label)", color: "var(--kleur-tekst-stil)" }}>
                                    {t.status === "klaar" ? "klaar" : "genegeerd"} &middot; {t.genegeerdOp || "—"}
                                  </span>
                                  <button type="button" className="btn btn-ghost btn-klein"
                                    onClick={() => (t.status === "klaar" ? zetStatus(t, "gepland") : zetNegeer(t, false))}>
                                    terugzetten
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!clusterVolgorde.some((c) => c.open.length || c.alles.some((t) => t.status === "klaar" || t.genegeerd)) && (
              <p style={{ color: "var(--kleur-tekst-stil)" }}>Nog geen taken. Maak er hierboven een paar aan vanuit Gesignaleerd.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

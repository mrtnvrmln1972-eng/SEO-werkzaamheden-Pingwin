"use client";

// ═══════════════════════════════════════════════════════════
// WERKPLANNING, PROEF: SIGNALEREN EN BEOORDELEN, PAS DAN PLANNEN
// ═══════════════════════════════════════════════════════════
// Zone 1 "Gesignaleerd" leest twee bronnen: de opruim-werklijst (cannibalisatie,
// via /api/admin/opruim-werklijst) en de meta/CTR-kansenlijst
// (/api/admin/meta-ctr), en toont per cluster/onderwerp de pagina's die nog
// geen taak zijn. Filterknoppen bovenaan schakelen per bron. Klap een regel
// open voor de volledige onderbouwing; "Maak taak" zet 'm met één klik op de
// echte weekplanning (dezelfde route als de bestaande "Naar planning"-knop in
// Opruimen), nu met het cluster als thread meegestuurd.
//
// Interne links is bewust nog NIET meegenomen: die databron heeft een andere
// vorm (doelpagina's met voorgestelde bronpagina's, geen losse "pagina heeft
// een probleem"-regel) en verdient een eigen vertaalslag in een volgende ronde.
//
// Zone 2 "De planning" leest de bestaande weekplanning
// (/api/admin/weekplan), gegroepeerd per cluster (thread). Een geschatte duur
// per taak plus een instelbaar urenbudget per week bepalen de weekprojectie.
//
// Zone 3 "Wat we de afgelopen tijd gedaan hebben" leest het bestaande
// activiteitenlogboek (/api/admin/activiteit) en toont het over een instelbare
// periode, zodat er altijd een rapportage klaarstaat.
//
// Nog geen onderdeel van het klantmenu of de echte Taken-tab: dit is bewust
// een losse proefpagina om op de echte data te beoordelen.

import { useEffect, useMemo, useState } from "react";
import { urlKey } from "../../../../../lib/url-key";
import { netteHtml } from "../../../../../lib/nette-html";
import { Paneel, Chip, Chips } from "../../../../_ui/Uitkomst";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";
import { SOORT_LABEL, type ActiviteitSoort } from "../../../../../lib/activiteit";

type Bron = "opruim" | "meta";

type WerkRegel = {
  pad: string; uitkomst: string; naar: string; reden: string;
  onderbouwing: string[]; volume: number | null; positie: number | null;
  groep: string; bron: Bron; doorgevoerd?: boolean;
};

type WeekplanTaak = {
  id: number; thread: string; taak: string; toelichting: string; url: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
  estimateMin: number | null; genegeerd: boolean; genegeerdOp: string;
};

type Activiteit = { id: number; gebeurdeOp: string; soort: ActiviteitSoort; url: string | null; intern: string; wie: string };

const DEFAULT_MIN = 30;
const UITKOMST_LABEL: Record<string, string> = {
  uitbouwen: "uitbouwen", samenvoegen: "samenvoegen", opruimen: "opruimen", nieuw: "nieuw", blijft: "blijft",
  meta: "titel/description",
};
const BRON_LABEL: Record<Bron, string> = { opruim: "Cannibalisatie", meta: "Meta en CTR" };
const BRON_TOON: Record<Bron, "accent" | "goed"> = { opruim: "accent", meta: "goed" };
const PERIODES = [
  { key: "2w", label: "2 weken", dagen: 14 },
  { key: "3w", label: "3 weken", dagen: 21 },
  { key: "mnd", label: "maand", dagen: 31 },
] as const;

function pad(u: string): string {
  if (!u) return "";
  try { return new URL(u).pathname; } catch { return u; }
}
function getal(n: number | null | undefined): string {
  return n == null ? "—" : new Intl.NumberFormat("nl-NL").format(n);
}
function metaRegelUit(row: any): WerkRegel {
  const missend = [...(row.issues?.title || []), ...(row.issues?.desc || [])];
  const onderbouwing: string[] = [];
  if (missend.length) onderbouwing.push(`Wat er nu niet klopt: ${missend.join(", ")}.`);
  if (row.volume != null) onderbouwing.push(`Zoekterm "${row.keyword}", ${getal(row.volume)} zoekopdrachten per maand, positie ${row.position}.`);
  if (row.extraClicks) onderbouwing.push(`Geschat ${getal(row.extraClicks)} extra klikken per 90 dagen bij de verwachte CTR voor deze positie.`);
  if (row.curTitle) onderbouwing.push(`Titel nu: "${row.curTitle}"`);
  if (row.curDesc) onderbouwing.push(`Description nu: "${row.curDesc}"`);
  return {
    pad: row.url, uitkomst: "meta", naar: "",
    reden: row.reden === "kapot" ? "Titel of description ontbreekt of is kapot" : "Titel en description kunnen meer klikken winnen",
    onderbouwing, volume: row.volume, positie: row.position,
    groep: "Meta en CTR, snelle winst", bron: "meta",
    doorgevoerd: row.proposal?.status === "doorgevoerd",
  };
}

export default function WerkplanningProef({ slug }: { slug: string }) {
  const [regels, setRegels] = useState<WerkRegel[]>([]);
  const [taken, setTaken] = useState<WeekplanTaak[]>([]);
  const [activiteit, setActiviteit] = useState<Activiteit[]>([]);
  const [budget, setBudget] = useState(3);
  const [budgetIngevuld, setBudgetIngevuld] = useState(false);
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]["key"]>("mnd");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [filterBron, setFilterBron] = useState<Bron | "alles">("alles");
  const [openSig, setOpenSig] = useState<Record<string, boolean>>({});
  const [openCluster, setOpenCluster] = useState<Record<string, boolean>>({});
  const [openArchief, setOpenArchief] = useState<Record<string, boolean>>({});
  const [maakBezig, setMaakBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState("");

  async function laadAlles() {
    setLaden(true); setFout("");
    try {
      const [wr, wp, bud, mc, act] = await Promise.all([
        fetch(`/api/admin/opruim-werklijst?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/werkplan-budget?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/meta-ctr?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/activiteit?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
      ]);
      const opruim: WerkRegel[] = wr?.ok
        ? (wr.regels || []).map((r: any) => ({ ...r, bron: "opruim" as Bron }))
        : [];
      if (!wr?.ok) setFout(wr?.error || "De opruimlijst kon niet geladen worden.");
      const meta: WerkRegel[] = mc?.ok
        ? (mc.rows || []).filter((r: any) => r.reden === "klikwinst" || r.reden === "kapot").map(metaRegelUit)
        : [];
      setRegels([...opruim, ...meta]);
      if (wp?.ok) setTaken((wp.tasks || []).map((t: any) => ({
        id: t.id, thread: t.thread || "", taak: t.taak, toelichting: t.toelichting, url: t.url,
        weekYear: t.weekYear, weekNo: t.weekNo, status: t.status, sortOrder: t.sortOrder,
        estimateMin: t.estimateMin, genegeerd: !!t.genegeerd, genegeerdOp: t.genegeerdOp || "",
      })));
      if (bud?.ok) { setBudget(bud.budget.urenPerWeek); setBudgetIngevuld(bud.budget.ingevuld); }
      if (act?.ok) setActiviteit(act.rijen || []);
    } catch {
      setFout("Laden mislukte. Probeer de pagina opnieuw te openen.");
    } finally { setLaden(false); }
  }
  useEffect(() => { laadAlles(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  const alTaak = useMemo(() => new Set(taken.filter((t) => t.url).map((t) => urlKey(t.url))), [taken]);
  const gesignaleerdAlles = useMemo(
    () => regels.filter((r) => r.pad && !alTaak.has(urlKey(r.pad)) && !r.doorgevoerd),
    [regels, alTaak],
  );
  const tellingPerBron = useMemo(() => {
    const t: Record<string, number> = { alles: gesignaleerdAlles.length };
    for (const r of gesignaleerdAlles) t[r.bron] = (t[r.bron] || 0) + 1;
    return t;
  }, [gesignaleerdAlles]);
  const gesignaleerd = useMemo(
    () => filterBron === "alles" ? gesignaleerdAlles : gesignaleerdAlles.filter((r) => r.bron === filterBron),
    [gesignaleerdAlles, filterBron],
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
      if (d?.ok) { setMelding(`Taak gemaakt: "${pad(r.pad)}" staat nu in De planning.`); await laadAlles(); }
      else setFout(d?.error || "Taak maken mislukte.");
    } catch { setFout("Taak maken mislukte."); }
    finally { setMaakBezig(null); }
  }

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
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id, status }) });
    await laadAlles();
  }
  async function zetNegeer(t: WeekplanTaak, genegeerd: boolean) {
    await fetch("/api/admin/weekplan/negeer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id, genegeerd }) });
    await laadAlles();
  }
  async function zetDuur(t: WeekplanTaak, min: number | null) {
    setTaken((ts) => ts.map((x) => (x.id === t.id ? { ...x, estimateMin: min } : x)));
    await fetch("/api/admin/weekplan/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id, min }) });
  }
  async function boost(thread: string) {
    await fetch("/api/admin/weekplan/boost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread }) });
    await laadAlles();
  }
  async function bewaarBudget(uren: number) {
    setBudget(uren);
    const d = await fetch("/api/admin/werkplan-budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, urenPerWeek: uren }) }).then((r) => r.json());
    if (d?.ok) setBudgetIngevuld(true);
  }

  const periodeInfo = PERIODES.find((p) => p.key === periode)!;
  const activiteitPeriode = useMemo(() => {
    const grens = Date.now() - periodeInfo.dagen * 24 * 60 * 60 * 1000;
    return activiteit
      .filter((a) => new Date(a.gebeurdeOp).getTime() >= grens)
      .sort((a, b) => new Date(b.gebeurdeOp).getTime() - new Date(a.gebeurdeOp).getTime());
  }, [activiteit, periodeInfo]);

  return (
    <div className="section" style={{ maxWidth: 980, marginLeft: "auto", marginRight: "auto", padding: "var(--ruimte-scherm)" }}>
      <Chips>
        <Chip toon="neutraal">{slug}</Chip>
        {fout && <Chip toon="let-op">{fout}</Chip>}
        {melding && <Chip toon="goed">{melding}</Chip>}
        {laden && <Chip toon="neutraal">Bezig met laden…</Chip>}
      </Chips>

      {!laden && (
        <>
          <Paneel
            titel="Gesignaleerd, nog geen taak"
            uitleg="Klik een filter om op bron te schakelen; klap een regel open voor de volledige onderbouwing. Niets wordt vanzelf een taak."
            knoppen={
              <Chips>
                {(["alles", "opruim", "meta"] as const).map((b) => (
                  <button key={b} type="button"
                    className={"btn btn-klein " + (filterBron === b ? "btn-primary" : "btn-ghost")}
                    onClick={() => setFilterBron(b)}>
                    {b === "alles" ? "Alles" : BRON_LABEL[b]} ({tellingPerBron[b] || 0})
                  </button>
                ))}
              </Chips>
            }
          >
            {[...perGroep.entries()].map(([groep, lijst]) => (
              <div key={groep} className="card section" style={{ padding: "var(--ruimte-groep)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong style={{ color: "var(--kleur-kop)" }}>{groep}</strong>
                  <Chip toon="neutraal">{lijst.length} pagina&#8217;s</Chip>
                </div>
                <div className="section">
                  {lijst.map((r) => {
                    const isOpen = !!openSig[r.pad];
                    return (
                      <div key={r.pad} style={{ borderTop: "1px solid var(--kleur-rand)" }} className="section">
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                          <span className="row" style={{ gap: "var(--ruimte-krap)", flexWrap: "wrap" }}>
                            <Chip toon={BRON_TOON[r.bron]}>{BRON_LABEL[r.bron]}</Chip>
                            <code>{pad(r.pad)}</code>
                            <Chip toon="neutraal">{UITKOMST_LABEL[r.uitkomst] || r.uitkomst}</Chip>
                            {r.naar && <span>&#8594; <code>{pad(r.naar)}</code></span>}
                            {r.volume != null && <span>{getal(r.volume)}/mnd</span>}
                            {r.positie != null && <span>positie {r.positie}</span>}
                            {r.onderbouwing.length > 0 && (
                              <button type="button" className="btn btn-quiet btn-klein"
                                onClick={() => setOpenSig((s) => ({ ...s, [r.pad]: !s[r.pad] }))}>
                                {isOpen ? "▾ minder" : "▸ onderbouwing"}
                              </button>
                            )}
                          </span>
                          <button type="button" className="btn btn-primary btn-klein" disabled={maakBezig === r.pad} onClick={() => maakTaak(r)}>
                            {maakBezig === r.pad ? "Bezig…" : "+ Maak taak"}
                          </button>
                        </div>
                        {isOpen && (
                          <div className="md" dangerouslySetInnerHTML={{ __html: netteHtml(r.onderbouwing.join("\n\n")) }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!perGroep.size && <p style={{ color: "var(--kleur-tekst-stil)" }}>Niets meer te beoordelen voor dit filter.</p>}
          </Paneel>

          <Paneel
            titel="De planning"
            knoppen={
              <Chips>
                <Chip toon="neutraal">{clusterVolgorde.reduce((s, c) => s + c.open.length, 0)} open taken</Chip>
                <Chip toon="neutraal">{Math.round((totOpenMin / 60) * 10) / 10}u werk</Chip>
                <Chip toon="neutraal">{maxWeek} weken</Chip>
              </Chips>
            }
          >
            <div className="row section">
              Beschikbaar per week:
              <input type="number" min={0.5} step={0.5} defaultValue={budget} size={3}
                onBlur={(e) => bewaarBudget(Number(e.target.value) || budget)} />
              uur {!budgetIngevuld && <span style={{ color: "var(--kleur-tekst-stil)" }}>(nog niet opgeslagen)</span>}
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
                      {open.map((t) => (
                        <div key={t.id} className="section" style={{ borderTop: "1px solid var(--kleur-rand)" }}>
                          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                            <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetStatus(t, "klaar")}>Klaar</button>
                            <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetNegeer(t, true)}>Negeer</button>
                            <span style={{ flex: 1 }}>{t.taak}{t.url && <> &middot; <code>{pad(t.url)}</code></>}</span>
                            <Chip toon="neutraal">week {weekVan.get(t.id) ?? "—"}</Chip>
                            <input type="number" min={5} step={5} size={3} defaultValue={t.estimateMin ?? DEFAULT_MIN}
                              onBlur={(e) => zetDuur(t, Number(e.target.value) || null)} />
                            <span style={{ color: "var(--kleur-tekst-stil)" }}>min{t.estimateMin == null ? " (schatting)" : ""}</span>
                          </div>
                        </div>
                      ))}
                      {archief.length > 0 && (
                        <>
                          <button type="button" className="deelkop" aria-expanded={archOpen} onClick={() => setOpenArchief((s) => ({ ...s, [naam]: !s[naam] }))}>
                            Afgerond of genegeerd binnen deze kaart<span className="deelkop-meta">{archief.length}</span>
                          </button>
                          {archOpen && archief.map((t) => (
                            <div key={t.id} className="row" style={{ justifyContent: "space-between" }}>
                              <span style={{ textDecoration: "line-through", color: "var(--kleur-tekst-stil)" }}>{t.taak}</span>
                              <span style={{ color: "var(--kleur-tekst-stil)" }}>{t.status === "klaar" ? "klaar" : "genegeerd"} &middot; {t.genegeerdOp || "—"}</span>
                              <button type="button" className="btn btn-ghost btn-klein" onClick={() => (t.status === "klaar" ? zetStatus(t, "gepland") : zetNegeer(t, false))}>terugzetten</button>
                            </div>
                          ))}
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
          </Paneel>

          <Paneel
            titel="Wat we de afgelopen tijd gedaan hebben"
            uitleg="Uit het bestaande activiteitenlogboek: alles wat er aan pagina's, taken en mail is afgehandeld, in één rapportage."
            knoppen={
              <Chips>
                {PERIODES.map((p) => (
                  <button key={p.key} type="button" className={"btn btn-klein " + (periode === p.key ? "btn-primary" : "btn-ghost")} onClick={() => setPeriode(p.key)}>
                    {p.label}
                  </button>
                ))}
              </Chips>
            }
          >
            {activiteitPeriode.map((a) => (
              <div key={a.id} className="row section" style={{ borderTop: "1px solid var(--kleur-rand)", flexWrap: "wrap" }}>
                <span style={{ color: "var(--kleur-tekst-stil)", fontFamily: "monospace" }}>
                  {new Date(a.gebeurdeOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                </span>
                <Chip toon="neutraal">{SOORT_LABEL[a.soort] || a.soort}</Chip>
                <span>{a.intern}</span>
                {a.url && <code>{pad(a.url)}</code>}
              </div>
            ))}
            {!activiteitPeriode.length && <p style={{ color: "var(--kleur-tekst-stil)" }}>Niets gelogd in deze periode.</p>}
          </Paneel>
        </>
      )}
    </div>
  );
}

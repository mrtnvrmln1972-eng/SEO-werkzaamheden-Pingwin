"use client";

// ═══════════════════════════════════════════════════════════
// WERKPLANNING, PROEF: SIGNALEREN, EEN PLAN, EEN TERUGBLIK
// ═══════════════════════════════════════════════════════════
// Zelfde opzet en volgorde als het opruimplan-artefact dat Maarten aanleverde
// (masthead met kengetallen, wat er recent is gebeurd, dan het plan met een
// zijbalk en weekkaarten per soort werk), maar volledig gevuld met wat het
// dashboard al weet. Twee dingen uit dat artefact staan met opzet niet hier:
// "Beslispunten" en de fase-namen ("De zes vestigingssteden") waren eenmalig
// geschreven verhaal voor dat ene plan, geen data die hier bestaat.
//
// Databronnen, ongewijzigd: de opruim-werklijst (cannibalisatie) en de
// meta/CTR-kansenlijst voor "Gesignaleerd"; de bestaande weekplanning voor
// "Het plan"; het activiteitenlogboek voor "Wat er is gebeurd". Interne links
// is met opzet nog niet meegenomen (andere datavorm, eigen vertaalslag nodig).
//
// Nog geen onderdeel van het klantmenu of de echte Taken-tab: dit is bewust
// een losse proefpagina om op de echte data te beoordelen.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { urlKey } from "../../../../../lib/url-key";
import { netteHtml } from "../../../../../lib/nette-html";
import { Paneel, Chip, Chips, Tekst } from "../../../../_ui/Uitkomst";
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
  taaktype: string; weekYear: number; weekNo: number; status: string; sortOrder: number;
  estimateMin: number | null; genegeerd: boolean; genegeerdOp: string;
};

type Activiteit = { id: number; gebeurdeOp: string; soort: ActiviteitSoort; url: string | null; intern: string; wie: string };

// ── Soort werk: één indeling, gedeeld door Gesignaleerd, Wat is gebeurd en Het plan ──
type Categorie = "can" | "link" | "meta" | "cont" | "tech" | "meet" | "overig";
const CATEGORIE_LABEL: Record<Categorie, string> = {
  can: "Cannibalisatie", link: "Interne links", meta: "Meta en CTR", cont: "Content",
  tech: "Techniek", meet: "Meten", overig: "Overig",
};
const CATEGORIE_VOLGORDE: Categorie[] = ["can", "link", "meta", "cont", "tech", "meet", "overig"];
function categorieVanBron(bron: Bron): Categorie { return bron === "opruim" ? "can" : "meta"; }
function categorieVanTaaktype(taaktype?: string | null): Categorie {
  switch (taaktype) {
    case "cannibalisatie": return "can";
    case "meta": return "meta";
    case "intern": return "link";
    case "copy": case "pijplijn": return "cont";
    case "structured": case "alt": return "tech";
    case "strategie": return "meet";
    default: return "overig";
  }
}
function categorieVanSoort(soort: ActiviteitSoort): Categorie {
  switch (soort) {
    case "analyse": return "meet";
    case "blauwdruk": case "copy": case "copy-concept": case "copy-live": return "cont";
    case "meta": return "meta";
    case "alt": case "structured": return "tech";
    case "intern-link": return "link";
    case "redirect": return "can";
    case "mail": return "meet";
    default: return "overig";
  }
}
function WerkChip({ categorie }: { categorie: Categorie }) {
  return <span className={`werk-chip ${categorie}`}>{CATEGORIE_LABEL[categorie]}</span>;
}

const DEFAULT_MIN = 30;
const UITKOMST_LABEL: Record<string, string> = {
  uitbouwen: "uitbouwen", samenvoegen: "samenvoegen", opruimen: "opruimen", nieuw: "nieuw", blijft: "blijft",
  meta: "titel/description",
};
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
function kortDatum(d: Date): string {
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
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

export default function WerkplanningProef({ slug, klantNaam, domein }: { slug: string; klantNaam?: string; domein?: string | null }) {
  const [regels, setRegels] = useState<WerkRegel[]>([]);
  const [taken, setTaken] = useState<WeekplanTaak[]>([]);
  const [activiteit, setActiviteit] = useState<Activiteit[]>([]);
  const [budget, setBudget] = useState(3);
  const [budgetIngevuld, setBudgetIngevuld] = useState(false);
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]["key"]>("mnd");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [filterBron, setFilterBron] = useState<Bron | "alles">("alles");
  const [filterCategorie, setFilterCategorie] = useState<Categorie | "alle">("alle");
  const [openSig, setOpenSig] = useState<Record<string, boolean>>({});
  const [openDaarvoor, setOpenDaarvoor] = useState(false);
  const [openWpArchief, setOpenWpArchief] = useState(false);
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
        taaktype: t.taaktype || "", weekYear: t.weekYear, weekNo: t.weekNo, status: t.status, sortOrder: t.sortOrder,
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
          taaktype: r.bron === "opruim" ? "cannibalisatie" : "meta",
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

  // Weekprojectie: dezelfde verdeling als voorheen, nu meteen ook gegroepeerd
  // per week (in de volgorde waarin elke taak uit zijn cluster-wachtrij komt),
  // zodat "Het plan" per week getoond kan worden zoals in het artefact.
  const { weekVan, weekGroups, maxWeek } = useMemo(() => {
    const budgetMin = Math.max(1, Math.round(budget * 60));
    const wachtrijen = clusterVolgorde.map((c) => ({ naam: c.naam, rij: c.open.slice() }));
    const uit = new Map<number, number>();
    const groups = new Map<number, WeekplanTaak[]>();
    const zet = (t: WeekplanTaak, week: number) => {
      uit.set(t.id, week);
      if (!groups.has(week)) groups.set(week, []);
      groups.get(week)!.push(t);
    };
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
          if (duur <= over) { zet(voor, week); over -= duur; w.rij.shift(); vooruitgang = true; }
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
        if (kleinste) { zet(kleinste.w.rij[0], week); kleinste.w.rij.shift(); }
      }
      week++;
    }
    return { weekVan: uit, weekGroups: groups, maxWeek: Math.max(0, ...[...uit.values()]) };
  }, [clusterVolgorde, budget]);

  const totOpenMin = clusterVolgorde.reduce((s, c) => s + c.open.reduce((s2, t) => s2 + (t.estimateMin ?? DEFAULT_MIN), 0), 0);
  const totOpenTaken = clusterVolgorde.reduce((s, c) => s + c.open.length, 0);
  const actieveOnderwerpen = clusterVolgorde.filter((c) => c.open.length > 0).length;
  const weekNummers = useMemo(() => [...weekGroups.keys()].sort((a, b) => a - b), [weekGroups]);
  const weekGetoond = useMemo<Map<number, WeekplanTaak[]>>(() => {
    if (filterCategorie === "alle") return weekGroups;
    const entries: [number, WeekplanTaak[]][] = [...weekGroups.entries()]
      .map(([w, lijst]) => [w, lijst.filter((t) => categorieVanTaaktype(t.taaktype) === filterCategorie)] as [number, WeekplanTaak[]])
      .filter(([, l]) => l.length > 0);
    return new Map(entries);
  }, [weekGroups, filterCategorie]);
  const archiefAlles = useMemo(() => taken.filter((t) => t.status === "klaar" || t.genegeerd)
    .sort((a, b) => new Date(b.genegeerdOp || 0).getTime() - new Date(a.genegeerdOp || 0).getTime()), [taken]);
  const klaarTellen = taken.filter((t) => !t.genegeerd);
  const voortgangPct = klaarTellen.length ? Math.round((klaarTellen.filter((t) => t.status === "klaar").length / klaarTellen.length) * 100) : 0;

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

  const nu = new Date();
  const { activiteitDezeMaand, activiteitDaarvoor, maandNaam } = useMemo(() => {
    const deze = activiteit
      .filter((a) => { const d = new Date(a.gebeurdeOp); return d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth(); })
      .sort((a, b) => new Date(a.gebeurdeOp).getTime() - new Date(b.gebeurdeOp).getTime());
    const eerder = activiteit
      .filter((a) => { const d = new Date(a.gebeurdeOp); return !(d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth()); })
      .sort((a, b) => new Date(b.gebeurdeOp).getTime() - new Date(a.gebeurdeOp).getTime());
    return { activiteitDezeMaand: deze, activiteitDaarvoor: eerder, maandNaam: nu.toLocaleDateString("nl-NL", { month: "long" }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activiteit]);
  const daarvoorGetoond = openDaarvoor ? activiteitDaarvoor : activiteitDaarvoor.slice(0, 6);

  return (
    <div className="wp-stack wp-wrap">
      <Link className="wp-terug" href={`/admin/client/${slug}`}>← terug naar de cockpit</Link>

      {laden && <Chips><Chip toon="neutraal">Bezig met laden…</Chip></Chips>}
      {fout && <Chips><Chip toon="let-op">{fout}</Chip></Chips>}
      {melding && <Chips><Chip toon="goed">{melding}</Chip></Chips>}

      {!laden && (
        <>
          <header className="wp-mast">
            <div className="wp-eyebrow"><span className="wp-eyebrow-bar" />{klantNaam || slug} × Pingwin · SEO</div>
            <h1>Werkplanning</h1>
            <p className="wp-lead">
              Wat er recent is gebeurd, wat er is gesignaleerd maar nog geen taak is, en de planning voor
              de komende weken op het huidige urenbudget. Alles hieronder komt rechtstreeks uit het dashboard.
            </p>
            <div className="wp-meta">
              <span>Bijgewerkt {kortDatum(nu)}</span>
              <span>{budget} uur per week</span>
              <span>{totOpenTaken} open taken</span>
              <span>{maxWeek} {maxWeek === 1 ? "week" : "weken"} vooruit bij dit budget</span>
            </div>
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-value">{totOpenTaken}</div><div className="kpi-label">open taken</div></div>
              <div className="kpi-card"><div className="kpi-value">{Math.round((totOpenMin / 60) * 10) / 10}</div><div className="kpi-label">uur werk gepland</div></div>
              <div className="kpi-card"><div className="kpi-value">{maxWeek}</div><div className="kpi-label">weken vooruit</div></div>
              <div className="kpi-card"><div className="kpi-value">{gesignaleerdAlles.length}</div><div className="kpi-label">gesignaleerd, nog geen taak</div></div>
              <div className="kpi-card"><div className="kpi-value">{activiteitDezeMaand.length}</div><div className="kpi-label">gedaan in {maandNaam}</div></div>
              <div className="kpi-card"><div className="kpi-value">{actieveOnderwerpen}</div><div className="kpi-label">onderwerpen met open werk</div></div>
            </div>
          </header>

          <Paneel
            titel={`Wat er in ${maandNaam} is gebeurd`}
            uitleg="Uit het bestaande activiteitenlogboek: alles wat er aan pagina's, taken en mail is afgehandeld."
          >
            {activiteitDezeMaand.length > 0 ? (
              <div className="wp-stack">
                {activiteitDezeMaand.map((a) => (
                  <div key={a.id} className="wp-item wp-row">
                    <span className="wp-datum">{kortDatum(new Date(a.gebeurdeOp))}</span>
                    <WerkChip categorie={categorieVanSoort(a.soort)} />
                    <span className="wp-grow">
                      <span className="wp-titel">{SOORT_LABEL[a.soort] || a.soort}</span>
                      {a.intern && <span className="muted"> — {a.intern}</span>}
                      {a.url && <> · <code>{pad(a.url)}</code></>}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="muted">Nog niets gelogd deze maand.</p>}

            {activiteitDaarvoor.length > 0 && (
              <div className="wp-eerder">
                <h4>Daarvoor al ({activiteitDaarvoor.length})</h4>
                <ul>
                  {daarvoorGetoond.map((a) => (
                    <li key={a.id}>
                      <span className="wp-datum">{kortDatum(new Date(a.gebeurdeOp))}</span>{" "}
                      {SOORT_LABEL[a.soort] || a.soort}{a.intern ? ` — ${a.intern}` : ""}{a.url ? ` · ${pad(a.url)}` : ""}
                    </li>
                  ))}
                </ul>
                {activiteitDaarvoor.length > 6 && (
                  <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpenDaarvoor((v) => !v)}>
                    {openDaarvoor ? "▾ minder tonen" : `▸ nog ${activiteitDaarvoor.length - 6} tonen`}
                  </button>
                )}
              </div>
            )}
          </Paneel>

          <Paneel
            titel="Gesignaleerd, nog geen taak"
            uitleg="Klik een filter om op bron te schakelen; klap een regel open voor de volledige onderbouwing. Niets wordt vanzelf een taak."
            knoppen={
              <Chips>
                {(["alles", "opruim", "meta"] as const).map((b) => (
                  <button key={b} type="button"
                    className={"btn btn-klein " + (filterBron === b ? "btn-primary" : "btn-ghost")}
                    onClick={() => setFilterBron(b)}>
                    {b === "alles" ? "Alles" : b === "opruim" ? CATEGORIE_LABEL.can : CATEGORIE_LABEL.meta} ({tellingPerBron[b] || 0})
                  </button>
                ))}
              </Chips>
            }
          >
            {[...perGroep.entries()].map(([groep, lijst]) => (
              <div key={groep} className="wp-rail-card wp-stack">
                <div className="wp-row wp-row-tussen">
                  <strong style={{ color: "var(--kleur-kop)" }}>{groep}</strong>
                  <Chip toon="neutraal">{lijst.length} pagina&#8217;s</Chip>
                </div>
                <div className="wp-stack">
                  {lijst.map((r) => {
                    const isOpen = !!openSig[r.pad];
                    return (
                      <div key={r.pad} className="wp-item wp-stack">
                        <div className="wp-row wp-row-tussen">
                          <span className="wp-row">
                            <WerkChip categorie={categorieVanBron(r.bron)} />
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
            {!perGroep.size && <p className="muted">Niets meer te beoordelen voor dit filter.</p>}
          </Paneel>

          <Paneel
            titel="Het plan"
            uitleg="Weekprojectie op het ingestelde urenbudget; de volgorde binnen een onderwerp draait nooit om."
          >
            <div className="wp-row">
              Beschikbaar per week:
              <input type="number" min={0.5} step={0.5} defaultValue={budget} size={3} className="uk-veld"
                onBlur={(e) => bewaarBudget(Number(e.target.value) || budget)} />
              uur {!budgetIngevuld && <span className="muted">(nog niet opgeslagen)</span>}
            </div>

            <div className="wp-plan-grid">
              <aside className="wp-rail">
                <div className="wp-rail-card">
                  <h4>Voortgang</h4>
                  <div className="wp-voortgang-n">{voortgangPct}%</div>
                  <div className="wp-voortgang-l">{klaarTellen.filter((t) => t.status === "klaar").length} van {klaarTellen.length} taken klaar</div>
                </div>
                {weekNummers.length > 0 && (
                  <div className="wp-rail-card">
                    <h4>Weken</h4>
                    <nav className="wp-week-nav">
                      {weekNummers.map((w) => (
                        <a key={w} href={`#wp-week-${w}`}>
                          <span>Week {w}</span>
                          <span className="wp-week-nav-n">{weekGroups.get(w)?.length || 0}</span>
                        </a>
                      ))}
                    </nav>
                  </div>
                )}
                <div className="wp-rail-card">
                  <h4>Soort werk</h4>
                  <div className="wp-filt">
                    <button type="button" className={"wp-filt-btn" + (filterCategorie === "alle" ? " aan" : "")} onClick={() => setFilterCategorie("alle")}>Alles</button>
                    {CATEGORIE_VOLGORDE.map((c) => (
                      <button key={c} type="button" className={"wp-filt-btn" + (filterCategorie === c ? " aan" : "")} onClick={() => setFilterCategorie(c)}>
                        <WerkChip categorie={c} />
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="wp-stack">
                {weekNummers.map((w) => {
                  const lijst = weekGetoond.get(w) || [];
                  if (!lijst.length) return null;
                  const vanaf = new Date(nu.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
                  const tot = new Date(vanaf.getTime() + 6 * 24 * 60 * 60 * 1000);
                  const minutenWeek = lijst.reduce((s, t) => s + (t.estimateMin ?? DEFAULT_MIN), 0);
                  return (
                    <div key={w} id={`wp-week-${w}`} className="strategy-card">
                      <div className="wp-week-kop">
                        <span className="wp-week-nr">{w}</span>
                        <span className="wp-grow">
                          <span className="wp-week-titel">Week {w}</span>
                          <span className="wp-week-sub">
                            circa {kortDatum(vanaf)} t/m {kortDatum(tot)} · {lijst.length} taken · {Math.round((minutenWeek / 60) * 10) / 10} uur
                          </span>
                        </span>
                      </div>
                      <div className="strategy-body">
                        {lijst.map((t) => (
                          <div key={t.id} className="wp-item wp-stack">
                            <div className="wp-row wp-row-tussen">
                              <span className="wp-row">
                                <WerkChip categorie={categorieVanTaaktype(t.taaktype)} />
                                {t.taak}{t.url && <> · <code>{pad(t.url)}</code></>}
                              </span>
                              <span className="wp-row">
                                <input type="number" min={5} step={5} size={3} className="uk-veld" defaultValue={t.estimateMin ?? DEFAULT_MIN}
                                  onBlur={(e) => zetDuur(t, Number(e.target.value) || null)} />
                                <span className="muted">min{t.estimateMin == null ? " (schatting)" : ""}</span>
                                <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetStatus(t, "klaar")}>Klaar</button>
                                <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetNegeer(t, true)}>Negeer</button>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!weekNummers.some((w) => (weekGetoond.get(w) || []).length) && (
                  <p className="muted">
                    {filterCategorie === "alle"
                      ? "Nog geen taken. Maak er hierboven een paar aan vanuit Gesignaleerd."
                      : `Geen open taken in "${CATEGORIE_LABEL[filterCategorie]}" bij dit filter.`}
                  </p>
                )}

                {(clusterVolgorde.some((c) => c.alles.length) || archiefAlles.length > 0) && (
                  <div className="wp-rail-card">
                    <div className="pnl-acties-groep" role="group">
                      {clusterVolgorde.filter((c) => c.open.length > 1).map((c) => (
                        <button key={c.naam} type="button" className="btn btn-ghost btn-klein" onClick={() => boost(c.naam)}>
                          Zet &#8220;{c.naam}&#8221; vooraan
                        </button>
                      ))}
                    </div>
                    {archiefAlles.length > 0 && (
                      <>
                        <button type="button" className="deelkop" aria-expanded={openWpArchief} onClick={() => setOpenWpArchief((v) => !v)}>
                          Afgerond of genegeerd<span className="deelkop-meta">{archiefAlles.length}</span>
                        </button>
                        {openWpArchief && (
                          <div className="wp-stack">
                            {archiefAlles.map((t) => (
                              <div key={t.id} className="wp-item wp-row wp-row-tussen">
                                <span className="wp-grow" style={{ textDecoration: "line-through" }}>{t.taak}</span>
                                <span className="muted">{t.status === "klaar" ? "klaar" : "genegeerd"} · {t.genegeerdOp ? kortDatum(new Date(t.genegeerdOp)) : "—"}</span>
                                <button type="button" className="btn btn-ghost btn-klein" onClick={() => (t.status === "klaar" ? zetStatus(t, "gepland") : zetNegeer(t, false))}>terugzetten</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Paneel>

          <Paneel
            titel="Activiteitenrapportage"
            uitleg="Dezelfde geschiedenis als hierboven, maar over een zelf te kiezen periode."
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
            <div className="wp-stack">
              {activiteitPeriode.map((a) => (
                <div key={a.id} className="wp-item wp-row">
                  <span className="wp-datum">{kortDatum(new Date(a.gebeurdeOp))}</span>
                  <WerkChip categorie={categorieVanSoort(a.soort)} />
                  <span className="wp-grow">{a.intern}{a.url && <> · <code>{pad(a.url)}</code></>}</span>
                </div>
              ))}
              {!activiteitPeriode.length && <p className="muted">Niets gelogd in deze periode.</p>}
            </div>
          </Paneel>
        </>
      )}
    </div>
  );
}

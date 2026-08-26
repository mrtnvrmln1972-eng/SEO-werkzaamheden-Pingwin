"use client";

// ═══════════════════════════════════════════════════════════
// WERKPLANNING: ÉÉN OVERZICHT, GEEN VIER LIJSTEN
// ═══════════════════════════════════════════════════════════
// Deze pagina begon als vier lange lijsten onder elkaar. Elk regeltje klopte,
// maar samen was het onleesbaar: 38 redirects onder elkaar, zes mails over
// dezelfde factuur, twaalf stadspagina's die stuk voor stuk hetzelfde verhaal
// vertelden. Maartens oordeel: "een tyfus lange lijst waar niet over nagedacht
// is", en over Gesignaleerd: "daar heb ik toch geen klap aan".
//
// Wat hij ervoor in de plaats wil, in zijn eigen woorden: in één klap zien "dit
// kan ik doen, ik filter nu daarop, dit is de onderbouwing, hiermee ga ik aan de
// slag", zonder erover na te hoeven denken. Dat vraagt twee dingen, en die zijn
// hier het hele ontwerp:
//
//   1. ÉÉN STUURBALK BOVENAAN, die de héle pagina filtert. Niet een filtertje
//      per blok. Kies "Cannibalisatie" en alles eronder gaat over cannibalisatie:
//      wat er gebeurd is, wat er gesignaleerd is, wat er gepland staat. Zoeken
//      werkt hetzelfde: één veld, alle blokken tegelijk.
//
//   2. GROEPEREN VÓÓR TONEN. Losse regels worden clusters met een titel die zegt
//      wát er gebeurd is ("38 oude adressen doorgestuurd") en een ondertitel die
//      zegt waar en wanneer. Die motor staat in `lib/werk-clusters.ts`, wordt door
//      élk blok gebruikt (zodat ze niet uit elkaar lopen) en is nagerekend door
//      `proeven/werk-clusters.proef.ts`.
//
// Belangrijk voor de volgorde van bewerkingen: er wordt EERST gefilterd op de
// losse regels en DAARNA geclusterd. Zoek je op één stad, dan zegt het cluster
// eerlijk "3 oude adressen doorgestuurd" in plaats van 38 met drie regels erin.
//
// Alles staat standaard dicht: vier regels op het scherm, je klapt open wat je
// nodig hebt. Binnen een blok is elk cluster óók dicht, en ruis (administratie,
// paginawijzigingen van de klant zelf) zakt naar onderen.
//
// Databronnen, ongewijzigd: de opruim-werklijst (cannibalisatie) en de
// meta/CTR-kansenlijst voor "Gesignaleerd"; de bestaande weekplanning voor
// "Het plan"; het activiteitenlogboek voor "Wat er is gebeurd". Interne links is
// met opzet nog niet meegenomen (andere datavorm, eigen vertaalslag nodig), en
// een samenvatting van wat de developer per taak deed leeft als `dev_punten` op
// de weekplanning-taak, niet in dit logboek.

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { urlKey } from "../../../../../lib/url-key";
import { netteHtml } from "../../../../../lib/nette-html";
import { Chip, Chips } from "../../../../_ui/Uitkomst";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";
import { SOORT_LABEL } from "../../../../../lib/activiteit";
import {
  clusterActiviteit, clusterSignalen, padVan, titelVanSlug, zoekTreffer,
  categorieVanBron, categorieVanSoort, categorieVanTaaktype,
  CATEGORIE_LABEL, CATEGORIE_VOLGORDE,
  type ActCluster, type ActRegel, type Categorie, type SigCluster, type SigRegel,
} from "../../../../../lib/werk-clusters";

type Bron = "opruim" | "meta";

type WeekplanTaak = {
  id: number; thread: string; taak: string; toelichting: string; url: string;
  taaktype: string; weekYear: number; weekNo: number; status: string; sortOrder: number;
  estimateMin: number | null; genegeerd: boolean; genegeerdOp: string;
};

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

function getal(n: number | null | undefined): string {
  return n == null ? "—" : new Intl.NumberFormat("nl-NL").format(n);
}
function kortDatum(d: Date): string {
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
function uren(minuten: number): string {
  return `${Math.round((minuten / 60) * 10) / 10} uur`;
}

function WerkChip({ categorie }: { categorie: Categorie }) {
  return <span className={`werk-chip ${categorie}`}>{CATEGORIE_LABEL[categorie]}</span>;
}

function metaRegelUit(row: any): SigRegel {
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

// Een echte, klikbare link naar de live pagina, in de huisstijl-linkkleur; de
// weergegeven tekst is het pad, niet het volledige adres.
function Slug({ url, domein }: { url: string; domein?: string | null }) {
  if (!url) return null;
  const href = /^https?:\/\//i.test(url)
    ? url
    : domein ? `https://${domein.replace(/^www\./i, "")}${url}` : url;
  return <a className="uk-pad" href={href} target="_blank" rel="noreferrer">{padVan(url)}</a>;
}

// Niveau 1: een hoofdblok van de pagina. Staat standaard dicht, zodat het scherm
// begint als vier regels in plaats van als een rol behang.
function Sectie({ titel, telling, open, onToggle, uitleg, knoppen, children }: {
  titel: string; telling?: string; open: boolean; onToggle: () => void;
  uitleg?: string; knoppen?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="strategy-card">
      <button type="button" className="strategy-head" onClick={onToggle}>
        <span className="strategy-caret">{open ? <Omlaag /> : <Uitklap />}</span>
        <span className="strategy-title">{titel}</span>
        {telling && <span className="strategy-meta-right">{telling}</span>}
      </button>
      {open && (
        <div className="strategy-body">
          {uitleg && <p className="muted">{uitleg}</p>}
          {knoppen}
          {children}
        </div>
      )}
    </div>
  );
}

// Niveau 2: één cluster binnen een blok, met de gedeelde inklapkop van de cockpit.
// Bewust GEEN tweede `strategy-card` in een `strategy-card`: die kleurverloop-balk
// hoort bij niveau 1, en zes van die balken onder elkaar was precies de fout van
// 19-08-2026 op het beheerscherm.
function ClusterKop({ titel, subtitel, categorie, telling, open, onToggle, knop }: {
  titel: string; subtitel?: string; categorie: Categorie; telling: string;
  open: boolean; onToggle: () => void; knop?: ReactNode;
}) {
  return (
    <div className="kpi-sub-head wp-clus-kop">
      <button type="button" className="deelkop" aria-expanded={open} onClick={onToggle}>
        <WerkChip categorie={categorie} />
        <span className="wp-clus-tekst">
          <span>{titel}</span>
          {subtitel && <span className="wp-clus-sub">{subtitel}</span>}
        </span>
        <span className="deelkop-meta">{telling}</span>
      </button>
      {knop}
    </div>
  );
}

// Eén logregel binnen een open cluster.
function ActRegelRij({ regel, domein, toonPad }: { regel: ActRegel; domein?: string | null; toonPad: boolean }) {
  return (
    <div className="wp-item wp-row">
      <span className="wp-datum">{kortDatum(new Date(regel.gebeurdeOp))}</span>
      <span className="wp-grow">
        <span className="wp-titel">{SOORT_LABEL[regel.soort] || regel.soort}</span>
        {regel.intern && <span className="muted"> — {regel.intern}</span>}
        {toonPad && regel.url && <> · <Slug url={regel.url} domein={domein} /></>}
      </span>
      {regel.bewijs && (
        <a className="btn btn-quiet btn-klein wp-linkstijl" href={regel.bewijs} target="_blank" rel="noreferrer">openen</a>
      )}
    </div>
  );
}

export default function WerkplanningProef({ slug, klantNaam, domein }: { slug: string; klantNaam?: string; domein?: string | null }) {
  const [regels, setRegels] = useState<SigRegel[]>([]);
  const [taken, setTaken] = useState<WeekplanTaak[]>([]);
  const [activiteit, setActiviteit] = useState<ActRegel[]>([]);
  const [budget, setBudget] = useState(3);
  const [budgetIngevuld, setBudgetIngevuld] = useState(false);
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]["key"]>("mnd");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [openSectie, setOpenSectie] = useState<Record<string, boolean>>({});
  const [openCluster, setOpenCluster] = useState<Record<string, boolean>>({});
  const [openSig, setOpenSig] = useState<Record<string, boolean>>({});
  const [openWpArchief, setOpenWpArchief] = useState(false);
  const [maakBezig, setMaakBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState("");

  // ── De twee knoppen die de héle pagina sturen ──
  const [filterCategorie, setFilterCategorie] = useState<Categorie | "alle">("alle");
  const [zoek, setZoek] = useState("");

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
      const opruim: SigRegel[] = wr?.ok
        ? (wr.regels || []).map((r: any) => ({ ...r, bron: "opruim" as Bron }))
        : [];
      if (!wr?.ok) setFout(wr?.error || "De opruimlijst kon niet geladen worden.");
      const meta: SigRegel[] = mc?.ok
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

  // ═══ De stuurbalk: eerst zoeken, dan tellen, dan filteren, dan pas clusteren ═══

  const alTaak = useMemo(() => new Set(taken.filter((t) => t.url).map((t) => urlKey(t.url))), [taken]);

  // Stap 1: wat overleeft de zoekregel. Dit is de basis waarop de tellers per
  // soort werk staan, zodat een teller nooit iets belooft dat er niet meer is.
  const actGezocht = useMemo(
    () => activiteit.filter((a) => zoekTreffer(zoek, a.intern, a.url, SOORT_LABEL[a.soort])),
    [activiteit, zoek],
  );
  const sigGezocht = useMemo(
    () => regels
      .filter((r) => r.pad && !alTaak.has(urlKey(r.pad)) && !r.doorgevoerd)
      .filter((r) => zoekTreffer(zoek, r.pad, r.reden, r.groep, r.naar, r.onderbouwing.join(" "))),
    [regels, alTaak, zoek],
  );
  const taakGezocht = useMemo(
    () => taken.filter((t) => zoekTreffer(zoek, t.taak, t.url, t.thread, t.toelichting)),
    [taken, zoek],
  );

  // Stap 2: hoeveel zit er achter elke knop van de stuurbalk. Eén teller over de
  // hele pagina, want de knop filtert ook de hele pagina.
  const tellingPerCategorie = useMemo(() => {
    const t = new Map<Categorie | "alle", number>();
    const tel = (c: Categorie) => t.set(c, (t.get(c) || 0) + 1);
    for (const a of actGezocht) tel(categorieVanSoort(a.soort));
    for (const r of sigGezocht) tel(categorieVanBron(r.bron));
    for (const k of taakGezocht) tel(categorieVanTaaktype(k.taaktype));
    t.set("alle", actGezocht.length + sigGezocht.length + taakGezocht.length);
    return t;
  }, [actGezocht, sigGezocht, taakGezocht]);

  // Stap 3: het filter erop, op de losse regels. Daarna clusteren, nooit andersom:
  // zoek je op één stad, dan hoort het cluster "3 oude adressen doorgestuurd" te
  // zeggen en niet 38 met drie regels erin.
  const actGefilterd = useMemo(
    () => filterCategorie === "alle" ? actGezocht : actGezocht.filter((a) => categorieVanSoort(a.soort) === filterCategorie),
    [actGezocht, filterCategorie],
  );
  const sigGefilterd = useMemo(
    () => filterCategorie === "alle" ? sigGezocht : sigGezocht.filter((r) => categorieVanBron(r.bron) === filterCategorie),
    [sigGezocht, filterCategorie],
  );
  const taakGefilterd = useMemo(
    () => filterCategorie === "alle" ? taakGezocht : taakGezocht.filter((t) => categorieVanTaaktype(t.taaktype) === filterCategorie),
    [taakGezocht, filterCategorie],
  );
  const filterAan = filterCategorie !== "alle" || zoek.trim().length > 0;

  // ═══ Wat er is gebeurd ═══
  const nu = new Date();
  const maandNaam = nu.toLocaleDateString("nl-NL", { month: "long" });
  const { dezeMaand, daarvoor } = useMemo(() => {
    const deze: ActRegel[] = []; const eerder: ActRegel[] = [];
    for (const a of actGefilterd) {
      const d = new Date(a.gebeurdeOp);
      (d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth() ? deze : eerder).push(a);
    }
    return { dezeMaand: deze, daarvoor: eerder };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actGefilterd]);
  const maandClusters = useMemo(() => clusterActiviteit(dezeMaand), [dezeMaand]);
  const eerderClusters = useMemo(() => clusterActiviteit(daarvoor), [daarvoor]);

  // ═══ Gesignaleerd ═══
  const sigClusters = useMemo(() => clusterSignalen(sigGefilterd), [sigGefilterd]);

  // ═══ Activiteitenrapportage ═══
  const periodeInfo = PERIODES.find((p) => p.key === periode)!;
  const rapportRegels = useMemo(() => {
    const grens = Date.now() - periodeInfo.dagen * 24 * 60 * 60 * 1000;
    return actGefilterd.filter((a) => new Date(a.gebeurdeOp).getTime() >= grens);
  }, [actGefilterd, periodeInfo]);
  const rapportClusters = useMemo(() => clusterActiviteit(rapportRegels), [rapportRegels]);

  async function maakTaak(r: SigRegel) {
    return fetch("/api/admin/weekplan/add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug, week: 1, wie: "SEO", url: r.pad, thread: r.groep,
        taak: r.reden || `${UITKOMST_LABEL[r.uitkomst] || r.uitkomst}: ${r.pad}`,
        toelichting: r.onderbouwing.join("\n"),
        taaktype: r.bron === "opruim" ? "cannibalisatie" : "meta",
      }),
    }).then((res) => res.json());
  }

  // Een cluster is één beslissing, dus ook één klik: alles erin wordt taak. Precies
  // dat is waar het groeperen voor is; anders klik je alsnog twaalf keer.
  async function maakTakenVan(c: SigCluster) {
    setMaakBezig(c.sleutel); setMelding(""); setFout("");
    let gelukt = 0;
    try {
      for (const r of c.items) {
        const d = await maakTaak(r);
        if (d?.ok) gelukt++;
      }
      setMelding(gelukt === c.items.length
        ? `${gelukt} ${gelukt === 1 ? "taak staat" : "taken staan"} nu in Het plan: ${c.titel}.`
        : `${gelukt} van de ${c.items.length} taken gemaakt; de rest lukte niet.`);
      await laadAlles();
    } catch { setFout("Taken maken mislukte."); }
    finally { setMaakBezig(null); }
  }

  async function maakEenTaak(r: SigRegel) {
    setMaakBezig(r.pad); setMelding(""); setFout("");
    try {
      const d = await maakTaak(r);
      if (d?.ok) { setMelding(`Taak gemaakt: "${padVan(r.pad)}" staat nu in Het plan.`); await laadAlles(); }
      else setFout(d?.error || "Taak maken mislukte.");
    } catch { setFout("Taak maken mislukte."); }
    finally { setMaakBezig(null); }
  }

  // ═══ Het plan ═══
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

  // Weekprojectie op het urenbudget; de volgorde binnen een onderwerp draait nooit om.
  const { weekGroups, maxWeek } = useMemo(() => {
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
      if (wachtrijen.some((w) => w.rij.length)) {
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
    return { weekGroups: groups, maxWeek: Math.max(0, ...[...uit.values()]) };
  }, [clusterVolgorde, budget]);

  const zichtbaarInPlan = useMemo(() => new Set(taakGefilterd.map((t) => t.id)), [taakGefilterd]);
  const weekGetoond = useMemo<Map<number, WeekplanTaak[]>>(() => {
    const entries: [number, WeekplanTaak[]][] = [...weekGroups.entries()]
      .map(([w, lijst]) => [w, lijst.filter((t) => zichtbaarInPlan.has(t.id))] as [number, WeekplanTaak[]])
      .filter(([, l]) => l.length > 0);
    return new Map(entries);
  }, [weekGroups, zichtbaarInPlan]);
  const weekNummers = useMemo(() => [...weekGetoond.keys()].sort((a, b) => a - b), [weekGetoond]);

  const totOpenMin = clusterVolgorde.reduce((s, c) => s + c.open.reduce((s2, t) => s2 + (t.estimateMin ?? DEFAULT_MIN), 0), 0);
  const totOpenTaken = clusterVolgorde.reduce((s, c) => s + c.open.length, 0);
  const actieveOnderwerpen = clusterVolgorde.filter((c) => c.open.length > 0).length;
  const archiefAlles = useMemo(() => taakGefilterd.filter((t) => t.status === "klaar" || t.genegeerd)
    .sort((a, b) => new Date(b.genegeerdOp || 0).getTime() - new Date(a.genegeerdOp || 0).getTime()), [taakGefilterd]);
  const klaarTellen = taken.filter((t) => !t.genegeerd);
  const voortgangPct = klaarTellen.length ? Math.round((klaarTellen.filter((t) => t.status === "klaar").length / klaarTellen.length) * 100) : 0;
  const planOpenGetoond = [...weekGetoond.values()].flat().length;

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
  async function bewaarBudget(u: number) {
    setBudget(u);
    const d = await fetch("/api/admin/werkplan-budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, urenPerWeek: u }) }).then((r) => r.json());
    if (d?.ok) setBudgetIngevuld(true);
  }

  // ── Eén cluster met zijn regels, gedeeld door "gebeurd" en "rapportage" ──
  function ActClusterBlok({ c }: { c: ActCluster }) {
    const eenling = c.items.length === 1;
    const open = !!openCluster[c.sleutel];
    if (eenling) {
      return (
        <div className="wp-clus">
          <div className="wp-row">
            <WerkChip categorie={c.categorie} />
            <span className="wp-grow">
              <span className="wp-titel">{c.titel}</span>
              {c.subtitel && <span className="wp-clus-sub"> · {c.subtitel}</span>}
            </span>
            {c.paginas[0] && <Slug url={c.paginas[0]} domein={domein} />}
          </div>
        </div>
      );
    }
    return (
      <div className="wp-clus">
        <ClusterKop
          titel={c.titel} subtitel={c.subtitel} categorie={c.categorie}
          telling={String(c.items.length)} open={open}
          onToggle={() => setOpenCluster((s) => ({ ...s, [c.sleutel]: !s[c.sleutel] }))}
        />
        {open && (
          <div className="wp-stack">
            {c.paginas.length > 1 && (
              <div className="wp-groep-achtergrond">
                <h4>De pagina&#8217;s in dit cluster ({c.paginas.length})</h4>
                <div className="wp-row">
                  {c.paginas.map((p) => <Slug key={p} url={p} domein={domein} />)}
                </div>
              </div>
            )}
            {c.items.map((a) => (
              <ActRegelRij key={a.id} regel={a} domein={domein} toonPad={c.paginas.length <= 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function ActClusterLijst({ clusters, leeg }: { clusters: ActCluster[]; leeg: string }) {
    if (!clusters.length) return <p className="muted">{leeg}</p>;
    const werk = clusters.filter((c) => !c.ruis);
    const ruis = clusters.filter((c) => c.ruis);
    return (
      <div className="wp-stack">
        {werk.map((c) => <ActClusterBlok key={c.sleutel} c={c} />)}
        {ruis.length > 0 && (
          <>
            <div className="deelkop deelkop-vast wp-ruis-kop">
              Ruis en achtergrond
              <span className="deelkop-meta">{ruis.reduce((s, c) => s + c.items.length, 0)} regels</span>
            </div>
            {ruis.map((c) => <ActClusterBlok key={c.sleutel} c={c} />)}
          </>
        )}
      </div>
    );
  }

  const clusterTelling = (n: number, clusters: number) =>
    `${n} in ${clusters} ${clusters === 1 ? "groep" : "groepen"}`;

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
              de komende weken op het huidige urenbudget. Alles staat gegroepeerd per onderwerp; de balk
              hieronder filtert alles tegelijk.
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
              <div className="kpi-card"><div className="kpi-value">{sigGezocht.length}</div><div className="kpi-label">gesignaleerd, nog geen taak</div></div>
              <div className="kpi-card"><div className="kpi-value">{dezeMaand.length}</div><div className="kpi-label">gedaan in {maandNaam}</div></div>
              <div className="kpi-card"><div className="kpi-value">{actieveOnderwerpen}</div><div className="kpi-label">onderwerpen met open werk</div></div>
            </div>
          </header>

          {/* ── De stuurbalk: één plek waar je kiest waar de hele pagina over gaat ── */}
          <div className="cockpit-card wp-stuur">
            <div className="wp-stuur-rij">
              <label className="wp-stuur-label" htmlFor="wp-zoek">Zoek in alles</label>
              <input id="wp-zoek" type="search" className="uk-veld wp-zoekveld" value={zoek}
                placeholder="pagina, stad, onderwerp of mailtitel"
                onChange={(e) => setZoek(e.target.value)} />
            </div>
            <div className="wp-stuur-rij">
              <span className="wp-stuur-label">Soort werk</span>
              <div className="pnl-acties-groep" role="group">
                <button type="button" className={"btn btn-klein " + (filterCategorie === "alle" ? "btn-primary" : "btn-ghost")}
                  onClick={() => setFilterCategorie("alle")}>
                  Alles ({tellingPerCategorie.get("alle") || 0})
                </button>
                {CATEGORIE_VOLGORDE.map((c) => (
                  <button key={c} type="button" className={"btn btn-klein " + (filterCategorie === c ? "btn-primary" : "btn-ghost")}
                    onClick={() => setFilterCategorie(c)} disabled={!tellingPerCategorie.get(c)}>
                    {CATEGORIE_LABEL[c]} ({tellingPerCategorie.get(c) || 0})
                  </button>
                ))}
              </div>
            </div>
            {filterAan && (
              <div className="wp-stuur-rij">
                <span className="muted">
                  Je kijkt nu naar {filterCategorie === "alle" ? "alle soorten werk" : CATEGORIE_LABEL[filterCategorie]}
                  {zoek.trim() && <> met &#8220;{zoek.trim()}&#8221; erin</>}: {dezeMaand.length + daarvoor.length} gebeurd,
                  {" "}{sigGefilterd.length} gesignaleerd, {planOpenGetoond} gepland.
                </span>
                <button type="button" className="btn btn-quiet btn-klein wp-linkstijl pnl-acties-info"
                  onClick={() => { setFilterCategorie("alle"); setZoek(""); }}>
                  alles weer tonen
                </button>
              </div>
            )}
          </div>

          <Sectie
            titel={`Wat er in ${maandNaam} is gebeurd`}
            telling={clusterTelling(dezeMaand.length, maandClusters.length)}
            open={!!openSectie.gebeurd}
            onToggle={() => setOpenSectie((s) => ({ ...s, gebeurd: !s.gebeurd }))}
            uitleg="Uit het activiteitenlogboek, gebundeld per onderwerp: één actie die zich herhaalt is één regel, en een mailwisseling is één gesprek. Klap een groep open voor de losse regels."
          >
            <ActClusterLijst clusters={maandClusters} leeg="Niets gelogd deze maand bij dit filter." />

            {eerderClusters.length > 0 && (
              <div className="wp-eerder">
                <h4>Daarvoor al ({daarvoor.length} regels in {eerderClusters.length} groepen)</h4>
                <ActClusterLijst clusters={eerderClusters} leeg="Niets ouder gevonden." />
              </div>
            )}
          </Sectie>

          <Sectie
            titel="Gesignaleerd, nog geen taak"
            telling={clusterTelling(sigGefilterd.length, sigClusters.length)}
            open={!!openSectie.gesignaleerd}
            onToggle={() => setOpenSectie((s) => ({ ...s, gesignaleerd: !s.gesignaleerd }))}
            uitleg="Per groep één opdracht: wat je gaat doen, waar het over gaat en wat het waard is. De onderbouwing die alle pagina's delen staat één keer bovenaan. Niets wordt vanzelf een taak."
          >
            {sigClusters.map((c) => {
              const open = !!openCluster[c.sleutel];
              const minuten = c.items.length * DEFAULT_MIN;
              const eigenSub = [c.subtitel, `circa ${uren(minuten)}`].filter(Boolean).join(" · ");
              return (
                <div key={c.sleutel} className="wp-clus">
                  <ClusterKop
                    titel={c.titel} subtitel={eigenSub} categorie={c.categorie}
                    telling={`${c.items.length} pagina${c.items.length === 1 ? "" : "'s"}`}
                    open={open}
                    onToggle={() => setOpenCluster((s) => ({ ...s, [c.sleutel]: !s[c.sleutel] }))}
                    knop={
                      <button type="button" className="btn btn-primary btn-klein"
                        disabled={maakBezig === c.sleutel}
                        onClick={() => maakTakenVan(c)}>
                        {maakBezig === c.sleutel ? "Bezig…" : `Maak ${c.items.length} ${c.items.length === 1 ? "taak" : "taken"}`}
                      </button>
                    }
                  />
                  {open && (
                    <div className="wp-stack">
                      {c.gedeeld.length > 0 && (
                        <div className="wp-groep-achtergrond">
                          <h4>Waarom dit cluster bij elkaar hoort</h4>
                          <div className="md" dangerouslySetInnerHTML={{ __html: netteHtml(c.gedeeld.join("\n\n"), { basis: domein || undefined }) }} />
                        </div>
                      )}
                      {c.items.map((r) => {
                        const eigen = r.onderbouwing.slice(c.gedeeld.length);
                        const isPagOpen = !!openSig[r.pad];
                        return (
                          <div key={r.pad} className="wp-item wp-stack">
                            <div className="wp-row wp-row-tussen">
                              <span className="wp-row">
                                <Slug url={r.pad} domein={domein} />
                                <Chip toon="neutraal">{UITKOMST_LABEL[r.uitkomst] || r.uitkomst}</Chip>
                                {r.naar && <span>&#8594; <Slug url={r.naar} domein={domein} /></span>}
                                {r.volume != null && <span>{getal(r.volume)}/mnd</span>}
                                {r.positie != null && <span>positie {r.positie}</span>}
                                {eigen.length > 0 && (
                                  <button type="button" className="btn btn-quiet btn-klein wp-linkstijl"
                                    onClick={() => setOpenSig((s) => ({ ...s, [r.pad]: !s[r.pad] }))}>
                                    {isPagOpen ? "minder" : "onderbouwing"}
                                  </button>
                                )}
                              </span>
                              <button type="button" className="btn btn-ghost btn-klein" disabled={maakBezig === r.pad} onClick={() => maakEenTaak(r)}>
                                {maakBezig === r.pad ? "Bezig…" : "Alleen deze"}
                              </button>
                            </div>
                            {isPagOpen && (
                              <div className="md" dangerouslySetInnerHTML={{ __html: netteHtml(eigen.join("\n\n"), { basis: domein || undefined }) }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {!sigClusters.length && <p className="muted">Niets meer te beoordelen bij dit filter.</p>}
          </Sectie>

          <Sectie
            titel="Het plan"
            telling={`${planOpenGetoond} van ${totOpenTaken} taken · ${uren(totOpenMin)}`}
            open={!!openSectie.plan}
            onToggle={() => setOpenSectie((s) => ({ ...s, plan: !s.plan }))}
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
                          <span className="wp-week-nav-n">{weekGetoond.get(w)?.length || 0}</span>
                        </a>
                      ))}
                    </nav>
                  </div>
                )}
              </aside>

              <div className="wp-stack">
                {weekNummers.map((w) => {
                  const lijst = weekGetoond.get(w) || [];
                  const vanaf = new Date(nu.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
                  const tot = new Date(vanaf.getTime() + 6 * 24 * 60 * 60 * 1000);
                  const minutenWeek = lijst.reduce((s, t) => s + (t.estimateMin ?? DEFAULT_MIN), 0);
                  return (
                    <div key={w} id={`wp-week-${w}`} className="wp-clus">
                      <div className="wp-week-kop">
                        <span className="wp-week-nr">{w}</span>
                        <span className="wp-grow">
                          <span className="wp-week-titel">Week {w}</span>
                          <span className="wp-week-sub">
                            circa {kortDatum(vanaf)} t/m {kortDatum(tot)} · {lijst.length} taken · {uren(minutenWeek)}
                          </span>
                        </span>
                      </div>
                      <div className="wp-stack">
                        {lijst.map((t) => (
                          <div key={t.id} className="wp-item wp-row wp-row-tussen">
                            <span className="wp-row wp-grow">
                              <WerkChip categorie={categorieVanTaaktype(t.taaktype)} />
                              {t.taak}{t.url && <> · <Slug url={t.url} domein={domein} /></>}
                            </span>
                            <span className="wp-row">
                              <input type="number" min={5} step={5} size={3} className="uk-veld" defaultValue={t.estimateMin ?? DEFAULT_MIN}
                                onBlur={(e) => zetDuur(t, Number(e.target.value) || null)} />
                              <span className="muted">min{t.estimateMin == null ? " (schatting)" : ""}</span>
                              <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetStatus(t, "klaar")}>Klaar</button>
                              <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetNegeer(t, true)}>Negeer</button>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!weekNummers.length && (
                  <p className="muted">
                    {filterAan
                      ? "Geen geplande taken bij dit filter."
                      : "Nog geen taken. Maak er hierboven een paar aan vanuit Gesignaleerd."}
                  </p>
                )}

                {(clusterVolgorde.some((c) => c.open.length > 1) || archiefAlles.length > 0) && (
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
                                <span className="wp-grow wp-doorgehaald">{t.taak}</span>
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
          </Sectie>

          <Sectie
            titel="Activiteitenrapportage"
            telling={clusterTelling(rapportRegels.length, rapportClusters.length)}
            open={!!openSectie.rapportage}
            onToggle={() => setOpenSectie((s) => ({ ...s, rapportage: !s.rapportage }))}
            uitleg="Dezelfde geschiedenis als hierboven, maar over een zelf te kiezen periode, op dezelfde manier gegroepeerd."
            knoppen={
              <div className="pnl-acties-groep" role="group">
                {PERIODES.map((p) => (
                  <button key={p.key} type="button" className={"btn btn-klein " + (periode === p.key ? "btn-primary" : "btn-ghost")} onClick={() => setPeriode(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
            }
          >
            <ActClusterLijst clusters={rapportClusters} leeg="Niets gelogd in deze periode bij dit filter." />
          </Sectie>
        </>
      )}
    </div>
  );
}

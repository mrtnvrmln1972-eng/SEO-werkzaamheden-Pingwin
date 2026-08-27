"use client";

// ═══════════════════════════════════════════════════════════
// HET WERKPLAN: DRIE MAANDEN, PER WEEK, GECLUSTERD EN ONDERBOUWD
// ═══════════════════════════════════════════════════════════
// Deze pagina toonde eerst vier lange lijsten, daarna dezelfde lijsten met 173
// tussenkopjes erin. Allebei onbruikbaar. Maartens eis, in zijn woorden: in één
// oogopslag zien wat de bedoeling is, wat er fout gaat en wat we moeten doen,
// zonder erover na te hoeven denken. En als je de diepte in wil, doe je dat met
// één of twee toggles.
//
// DE OPBOUW, EN WAAROM DIE ZO IS
// ══════════════════════════════
// Er zijn precies drie niveaus, niet meer:
//
//   FASE (kopje, altijd zichtbaar)        Structuur, dan inhoud, dan snel fruit.
//     └ CLUSTER (kaart, dicht)            Eén onderwerp = één blok werk van een
//       │                                 paar uur. Dicht laat hij al zien wat
//       │                                 hij is: nummer, naam, week, tijd, en
//       │                                 in één zin wat er met welke pagina's
//       │                                 gebeurt.
//       └ PAGINA (regel, dicht)           Open je de kaart, dan zie je wat er aan
//                                         de hand is, nu tegenover straks, en per
//                                         pagina één regel. Die regel klapt open
//                                         naar de onderbouwing.
//
// Eén klik brengt je bij het werk, twee bij het bewijs. Dieper is er niet.
//
// WAAROM EEN CLUSTER EN NIET EEN SIGNAAL
// ══════════════════════════════════════
// Ga je "Amsterdam" opruimen, dan raak je in één zitting zes pagina's aan en doe
// je zes verschillende dingen. Dat is één blok werk, geen zes taken verspreid
// over een lijst. Het rekenwerk daarvoor staat in `lib/werkplan.ts` en wordt
// nagerekend door `proeven/werkplan.proef.ts`; dit bestand tekent het alleen.
//
// ÉÉN KNOP PER KAART, NIET ÉÉN PER REGEL
// ══════════════════════════════════════
// De vorige versie zette een oranje knop bij elke groep en nog een knopje bij
// elke pagina. Bij honderd groepen zijn dat honderd oranje knoppen onder elkaar,
// en dan is geen enkele knop meer de belangrijkste (wet van Hick). Nu: precies
// één hoofdknop per cluster, onderaan de kaart waar je hem nodig hebt, en op een
// paginaregel staat geen knop maar alleen een tokkeltje.

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { netteHtml } from "../../../../../lib/nette-html";
import { Chip, Chips, Signalen } from "../../../../_ui/Uitkomst";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";
import { SOORT_LABEL } from "../../../../../lib/activiteit";
import {
  clusterActiviteit, padVan, zoekTreffer,
  CATEGORIE_LABEL, CATEGORIE_VOLGORDE,
  type ActCluster, type ActRegel, type Categorie,
} from "../../../../../lib/werk-clusters";
import {
  bouwWerkplan, urenTekst, paginaRegel, paginaNaam,
  FASE_TITEL, FASE_WAAROM, HANDELING_LABEL, WEKEN_IN_KWARTAAL,
  type ClusterPagina, type Werkcluster, type Handeling,
} from "../../../../../lib/werkplan";
import {
  WEGLAAT_LABEL, WEGLAAT_UITLEG,
  type Weggelaten, type WeglaatReden,
} from "../../../../../lib/opruim-weggelaten";
import type { StapStand } from "../../../../../lib/cluster-draaiboek";
import { sorteerClusters, SORTERING_LABEL, type Sortering } from "../../../../../lib/cluster-volgorde";
import { bouwOverzicht, splitsBevindingen } from "../../../../../lib/cluster-uitvoering";
import Draaiboek, { Fasestreep } from "./Draaiboek";

type WeekplanTaak = {
  id: number; thread: string; taak: string; url: string; taaktype: string;
  status: string; sortOrder: number; estimateMin: number | null;
  genegeerd: boolean; genegeerdOp: string;
};

const PERIODES = [
  { key: "mnd", label: "deze maand", dagen: 31 },
  { key: "kwartaal", label: "drie maanden", dagen: 92 },
  { key: "alles", label: "alles", dagen: 3650 },
] as const;

const nl = new Intl.NumberFormat("nl-NL");
const getal = (n: number | null | undefined) => (n == null ? "—" : nl.format(n));
const kortDatum = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
// Hoeveel weggelaten paden we uitschrijven voor je gaat zoeken. Bij One Day
// Clinic vallen er 594 pagina’s buiten het plan; die allemaal neerzetten maakt
// van een verantwoording weer een muur. Zoeken maakt de lijst vanzelf kort.
const TOON_WEGGELATEN = 24;
// De periode van een groep als één vaste kolom: één datum, of van-tot. Stond eerder
// in de ondertitel verwerkt, waardoor de ene regel wel en de andere geen datum op
// dezelfde plek had en niets uitlijnde.
function periodeTekst(c: ActCluster): string {
  const van = new Date(c.van);
  if (Number.isNaN(van.getTime())) return "";
  const a = kortDatum(van);
  const tot = new Date(c.tot);
  const b = Number.isNaN(tot.getTime()) ? a : kortDatum(tot);
  return a === b ? a : `${a} \u2013 ${b}`;
}

function WerkChip({ categorie }: { categorie: Categorie }) {
  return <span className={`werk-chip ${categorie}`}>{CATEGORIE_LABEL[categorie]}</span>;
}
// Wat er met één pagina gebeurt. Zelfde vorm en zelfde kleurtaal als de chip
// hierboven (samenvoegen oranje net als Cannibalisatie, titel en description
// groen net als Meta en CTR), maar OMLIJND in plaats van gevuld. Dat verschil is
// nodig: eerst waren "Content" en "uitbouwen" allebei een gevulde paarse pil, en
// dan lijkt het soort werk hetzelfde soort ding als de handeling.
function HandelingChip({ handeling }: { handeling: Handeling }) {
  return <span className={`werk-chip omlijnd h-${handeling}`}>{HANDELING_LABEL[handeling]}</span>;
}

function Slug({ url, domein }: { url: string; domein?: string | null }) {
  if (!url) return null;
  const href = /^https?:\/\//i.test(url)
    ? url
    : domein ? `https://${domein.replace(/^www\./i, "")}${url}` : url;
  return <a className="uk-pad" href={href} target="_blank" rel="noreferrer">{padVan(url)}</a>;
}

// Niveau 1 voor de blokken die geen werkplan zijn (wat er al gedaan is, wat er al
// in de planning staat). Staan standaard dicht; het werkplan zelf is het scherm.
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

export default function WerkplanningProef({ slug, klantNaam, domein }: { slug: string; klantNaam?: string; domein?: string | null }) {
  const [opruim, setOpruim] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [taken, setTaken] = useState<WeekplanTaak[]>([]);
  const [activiteit, setActiviteit] = useState<ActRegel[]>([]);
  const [weggelaten, setWeggelaten] = useState<Weggelaten | null>(null);
  const [budget, setBudget] = useState(3);
  const [budgetIngevuld, setBudgetIngevuld] = useState(false);
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]["key"]>("mnd");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [melding, setMelding] = useState("");

  const [openCluster, setOpenCluster] = useState<Record<string, boolean>>({});
  const [openPagina, setOpenPagina] = useState<Record<string, boolean>>({});
  const [openSectie, setOpenSectie] = useState<Record<string, boolean | undefined>>({});
  const [openActCluster, setOpenActCluster] = useState<Record<string, boolean>>({});
  // De standen van álle draaiboeken in één keer, voor de voortgangsstreep op elke
  // kaart. Eén verzoek voor de hele pagina, niet één per blok.
  const [draaiStanden, setDraaiStanden] = useState<Record<string, StapStand[]>>({});
  const [bezig, setBezig] = useState<string | null>(null);

  const [filterCategorie, setFilterCategorie] = useState<Categorie | "alle">("alle");
  const [zoek, setZoek] = useState("");
  const [sortering, setSortering] = useState<Sortering>("plan");
  // Blokken die jij zelf vooraan hebt gezet. Gaan altijd voor de berekende
  // volgorde: de motor weet niet dat de stadspagina's voor jou het zwaarst wegen.
  const [prioriteiten, setPrioriteiten] = useState<Record<string, number>>({});

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
      // De draaiboeken los, want die mogen het laden van het plan niet ophouden.
      fetch(`/api/admin/cluster-draaiboek?slug=${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((d) => { if (d?.ok) { setDraaiStanden(d.standen || {}); setPrioriteiten(d.prioriteiten || {}); } })
        .catch(() => { /* stil: zonder standen staan de streepjes gewoon leeg */ });
      if (!wr?.ok) setFout(wr?.error || "De opruimlijst kon niet geladen worden.");
      setOpruim(wr?.ok ? wr.regels || [] : []);
      setWeggelaten(wr?.ok ? wr.weggelaten || null : null);
      setMetas(mc?.ok ? (mc.rows || []).filter((r: any) => r.reden === "klikwinst" || r.reden === "kapot") : []);
      if (wp?.ok) setTaken((wp.tasks || []).map((t: any) => ({
        id: t.id, thread: t.thread || "", taak: t.taak, url: t.url, taaktype: t.taaktype || "",
        status: t.status, sortOrder: t.sortOrder, estimateMin: t.estimateMin,
        genegeerd: !!t.genegeerd, genegeerdOp: t.genegeerdOp || "",
      })));
      if (bud?.ok) { setBudget(bud.budget.urenPerWeek); setBudgetIngevuld(bud.budget.ingevuld); }
      if (act?.ok) setActiviteit(act.rijen || []);
    } catch {
      setFout("Laden mislukte. Probeer de pagina opnieuw te openen.");
    } finally { setLaden(false); }
  }
  useEffect(() => { laadAlles(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // ── Het plan ──
  const plan = useMemo(
    () => bouwWerkplan(opruim, metas, taken, activiteit.map((a) => ({ url: a.url, gebeurdeOp: a.gebeurdeOp })), budget),
    [opruim, metas, taken, activiteit, budget],
  );

  // Filteren gebeurt op CLUSTERS, niet binnen een cluster. Een cluster is één blok
  // werk: de helft ervan wegfilteren maakt het onuitvoerbaar, en juist het bij
  // elkaar houden was de hele bedoeling.
  const clustersGetoond = useMemo(() => plan.clusters.filter((c) => {
    if (filterCategorie !== "alle" && !c.categorieen.includes(filterCategorie)) return false;
    if (!zoek.trim()) return true;
    return zoekTreffer(zoek, c.naam, c.samenvatting, c.gedeeld.join(" "),
      c.paginas.map((p) => `${p.pad} ${p.reden} ${p.term} ${p.onderbouwing.join(" ")}`).join(" "));
  }), [plan.clusters, filterCategorie, zoek]);

  const tellingPerCategorie = useMemo(() => {
    const t = new Map<Categorie | "alle", number>();
    for (const c of plan.clusters) for (const cat of c.categorieen) t.set(cat, (t.get(cat) || 0) + 1);
    t.set("alle", plan.clusters.length);
    return t;
  }, [plan.clusters]);

  // ALLES staat onder elkaar; filteren maakt de lijst korter, niet een afkap.
  //
  // Hier zat een echte fout in. Het plan werd afgekapt op week 13, maar `c.week`
  // komt uit het ONGEFILTERDE plan. Zoeken op "rotterdam" liet dus twee blokken
  // over met weeknummers ver voorbij de dertien, en die vielen allemaal buiten het
  // kwartaal: het scherm zei "2 van de 131 blokken" en toonde er nul. De horizon
  // is nu geen afkap meer maar een mededeling onderaan.
  const clustersGesorteerd = useMemo(
    () => sorteerClusters(clustersGetoond, sortering, prioriteiten),
    [clustersGetoond, sortering, prioriteiten],
  );

  const perFaseGetoond = useMemo(() => ([1, 2, 3] as const).map((fase) => {
    const lijst = clustersGesorteerd.filter((c) => c.fase === fase);
    return {
      fase, clusters: lijst,
      minuten: lijst.reduce((s, c) => s + c.minuten, 0),
      paginas: lijst.reduce((s, c) => s + c.paginas.length, 0),
    };
  }).filter((f) => f.clusters.length > 0), [clustersGesorteerd]);

  const filterAan = filterCategorie !== "alle" || zoek.trim().length > 0;
  const getoondMinuten = clustersGetoond.reduce((s, c) => s + c.minuten, 0);

  // ── Wat er NIET in het plan staat ──
  // Zoeken op "Utrecht" gaf vier blokken titelwerk en verder niets, en daar was
  // geen touw aan vast te knopen: zijn de cannibalisatie-blokken vergeten, of
  // horen ze er niet te zijn? Het antwoord stond nergens op het scherm. Nu staat
  // het er, en het volgt dezelfde zoekregel als de blokken zelf, zodat het
  // antwoord verschijnt op het moment dat je de vraag stelt.
  const weggelatenGetoond = useMemo(() => {
    if (!weggelaten) return [];
    return weggelaten.paginas.filter((p) => zoekTreffer(zoek, p.pad, p.plaats, WEGLAAT_LABEL[p.reden]));
  }, [weggelaten, zoek]);

  const weggelatenPerReden = useMemo(() => {
    const per = new Map<WeglaatReden, string[]>();
    for (const p of weggelatenGetoond) {
      if (!per.has(p.reden)) per.set(p.reden, []);
      per.get(p.reden)!.push(p.pad);
    }
    return (["advertentie", "plaats-verweesd", "geen-aanleiding"] as WeglaatReden[])
      .filter((r) => per.get(r)?.length)
      .map((r) => ({ reden: r, paden: per.get(r)! }));
  }, [weggelatenGetoond]);

  // Zoek je, dan is dit blok het antwoord op je vraag, dus dan staat het open.
  // Dicht laten zou betekenen dat je op "Utrecht" zoekt, vier blokken titelwerk
  // ziet, en zélf moet bedenken dat de verklaring achter een dichtgeklapte kop
  // zit. Klap je hem daarna met de hand dicht, dan blijft dat jouw keuze; zonder
  // zoekopdracht staat hij gewoon dicht.
  const wegOpen = openSectie.weggelaten ?? !!zoek.trim();

  // Blokken waar niets meer te doen is. Zoek je op een plaats die vorige maand al
  // is opgeruimd, dan hoort het scherm "dit is af" te zeggen in plaats van niets.
  const afgerondGetoond = useMemo(() => plan.afgerond.filter((c) =>
    zoekTreffer(zoek, c.naam, c.samenvatting,
      c.paginas.map((p) => `${p.pad} ${p.term}`).join(" "))), [plan.afgerond, zoek]);

  // ── Wat er al gedaan is ──
  const periodeInfo = PERIODES.find((p) => p.key === periode)!;
  const gedaanRegels = useMemo(() => {
    const grens = Date.now() - periodeInfo.dagen * 24 * 60 * 60 * 1000;
    return activiteit
      .filter((a) => new Date(a.gebeurdeOp).getTime() >= grens)
      .filter((a) => zoekTreffer(zoek, a.intern, a.url, SOORT_LABEL[a.soort]));
  }, [activiteit, periodeInfo, zoek]);
  const gedaanClusters = useMemo(() => clusterActiviteit(gedaanRegels), [gedaanRegels]);

  // ── Taken die al lopen ──
  const openTaken = useMemo(() => taken.filter((t) => !t.genegeerd && t.status !== "klaar"), [taken]);

  async function bewaarBudget(u: number) {
    setBudget(u);
    const d = await fetch("/api/admin/werkplan-budget", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, urenPerWeek: u }),
    }).then((r) => r.json());
    if (d?.ok) setBudgetIngevuld(true);
  }

  // De weg terug. Zonder dit is "zet dit blok in de planning" een eenrichtingsknop:
  // klik je hem per ongeluk, dan staan er twaalf taken die je nergens meer weg
  // krijgt. Dat mag niet van dezelfde regel die zegt dat elke actie omkeerbaar is.
  async function haalUitPlanning(t: WeekplanTaak) {
    setBezig(`taak-${t.id}`);
    try {
      await fetch("/api/admin/weekplan/negeer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: t.id, genegeerd: true }),
      });
      await laadAlles();
    } catch { setFout("Uit de planning halen mislukte."); }
    finally { setBezig(null); }
  }

  // Zelf de volgorde bepalen. De motor rekent fase en waarde uit, maar weet niet
  // dat de stadspagina's voor jou het zwaarst wegen; dit gaat daar altijd voor.
  async function zetVolgorde(c: Werkcluster, actie: "vooraan" | "losmaken") {
    setMelding(""); setFout("");
    try {
      const d = await fetch("/api/admin/cluster-draaiboek", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, cluster: c.naam, actie }),
      }).then((r) => r.json());
      if (d?.ok) { setPrioriteiten(d.prioriteiten || {}); setMelding(d.melding || ""); }
      else setFout(d?.error || "De volgorde aanpassen mislukte.");
    } catch { setFout("De volgorde aanpassen mislukte."); }
  }

  // Eén cluster is één beslissing, dus ook één klik: alle pagina's erin worden
  // taken, in de volgorde waarin ze gedaan moeten worden.
  async function zetInPlanning(c: Werkcluster) {
    setBezig(c.sleutel); setMelding(""); setFout("");
    let gelukt = 0;
    try {
      for (const p of c.paginas) {
        if (p.doorgevoerd) continue;
        const d = await fetch("/api/admin/weekplan/add", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug, week: c.week, wie: "SEO", url: p.pad, thread: c.naam,
            taak: `${HANDELING_LABEL[p.handeling]}: ${paginaNaam(p.pad)}`,
            toelichting: [paginaRegel(p), ...c.gedeeld, ...p.onderbouwing].join("\n"),
            taaktype: p.handeling === "meta" ? "meta"
              : p.handeling === "samenvoegen" || p.handeling === "opruimen" ? "cannibalisatie" : "copy",
          }),
        }).then((r) => r.json());
        if (d?.ok) gelukt++;
      }
      setMelding(`${gelukt} ${gelukt === 1 ? "taak staat" : "taken staan"} nu in de planning voor "${c.naam}".`);
      await laadAlles();
    } catch { setFout("In de planning zetten mislukte."); }
    finally { setBezig(null); }
  }

  // ── Eén paginaregel binnen een cluster: één tokkeltje naar de onderbouwing ──
  function PaginaRij({ p, cluster }: { p: ClusterPagina; cluster: Werkcluster }) {
    const sleutel = `${cluster.sleutel}|${p.pad}`;
    const open = !!openPagina[sleutel];
    const heeftDiepte = p.onderbouwing.length > 0 || !!p.meta || !!p.term || p.positie != null;
    // Zonder onderbouwing valt er niets open te klappen. Dan is het geen knop maar
    // een regel: `deelkop-vast` is precies daarvoor, zelfde vorm zonder driehoekje
    // en zonder muisaanwijzer. Een uitgeschakelde knop die er wél klikbaar uitziet
    // is de fout die deze bouwsteen juist voorkomt.
    const inhoud = (
      <>
        <HandelingChip handeling={p.handeling} />
        {/* Een advertentiepagina staat gewoon in het blok mee (er staan vaak vier
            of vijf pagina's voor in de weg), maar het moet in één oogopslag
            duidelijk zijn waaróm er niets mee gebeurt. */}
        {p.advertentie && <span className="werk-chip omlijnd h-blijft">Ads-pagina</span>}
        <span className="wp-clus-tekst">
          <span className="wp-taak-pad">{padVan(p.pad)}</span>
          <span className="wp-clus-sub">{paginaRegel(p)}{p.meta && p.handeling !== "meta" ? ", plus een nieuwe titel en description" : ""}</span>
        </span>
        <span className="deelkop-meta">
          {p.doelRisico ? "kan niet door" : p.doorgevoerd ? "al gedaan" : urenTekst(p.minuten)}
        </span>
      </>
    );
    return (
      <div className="wp-taak">
        {heeftDiepte ? (
          <button type="button" className="deelkop" aria-expanded={open}
            onClick={() => setOpenPagina((s) => ({ ...s, [sleutel]: !s[sleutel] }))}>
            {inhoud}
          </button>
        ) : (
          <div className="deelkop deelkop-vast">{inhoud}</div>
        )}
        {open && (
          <div className="wp-taak-diep wp-proza">
            <dl className="wp-kentabel">
              {p.term && <div><dt>zoekterm</dt><dd>{p.term}</dd></div>}
              {p.volume != null && <div><dt>per maand</dt><dd>{getal(p.volume)}</dd></div>}
              {p.positie != null && <div><dt>positie nu</dt><dd>{String(p.positie).replace(".", ",")}</dd></div>}
              {p.klikken > 0 && <div><dt>klikken</dt><dd>{getal(p.klikken)}</dd></div>}
              {p.meta?.extraClicks ? <div><dt>te winnen klikken</dt><dd>+{getal(p.meta.extraClicks)} per 90 dagen</dd></div> : null}
            </dl>
            {/* Eén regel met de pagina en waar hij heen gaat. Dit stonden er drie:
                "Bekijken", het pad, en nog een regel "Gaat naar". Het pad stond
                daarmee twee keer in beeld, want de regel erboven toont hem al. */}
            <p className="wp-veldnaam">Pagina openen</p>
            <p>
              <Slug url={p.pad} domein={domein} />
              {p.naar && <> &#8594; <Slug url={p.naar} domein={domein} /></>}
            </p>
            {/* Het doel van een omleiding is niet altijd een echte pagina: hij wordt
                uit de gekozen URL-vorm gebouwd en werd nooit tegen de site gehouden.
                Bij Zoetermeer leverde dat een doel op dat via twee stappen terugkwam
                op de bronpagina, dus een oneindige lus op een pagina die op positie 2
                stond. Zoiets hoort niet stil in een plan te zitten. */}
            {p.doelRisico && (
              <Signalen soort="let-op" domein={domein || undefined}
                regels={[`Deze omleiding kan zo niet doorgevoerd worden. ${p.doelRisico}`]} />
            )}
            {/* Staat een pagina in twee analyses, dan plakt de opruimlijst allebei
                de onderbouwingen achter elkaar. Dat werd één blok met TWEE keer
                "Wat we doen", en dat leest als tegenspraak terwijl het twee losse
                bevindingen zijn. Nu apart, genummerd, elk met zijn eigen conclusie. */}
            {(() => {
              const bevindingen = splitsBevindingen(p.onderbouwing);
              if (!bevindingen.length) return null;
              return bevindingen.map((b, i) => (
                <div key={i} className="wp-proza">
                  <p className="wp-veldnaam">
                    {bevindingen.length > 1 ? `Bevinding ${i + 1} van ${bevindingen.length}` : "Waarom dit besluit"}
                  </p>
                  {b.regels.length > 0 && (
                    <div className="md" dangerouslySetInnerHTML={{ __html: netteHtml(b.regels.join("\n\n"), { basis: domein || undefined }) }} />
                  )}
                  {b.conclusie && (
                    <div className="wp-conclusie md" dangerouslySetInnerHTML={{ __html: netteHtml(b.conclusie, { basis: domein || undefined }) }} />
                  )}
                </div>
              ));
            })()}
            {p.meta && (
              <>
                <p className="wp-veldnaam">Wat er nu in het zoekresultaat staat</p>
                <dl className="wp-kentabel">
                  <div><dt>titel</dt><dd>{p.meta.curTitle || "ontbreekt"}</dd></div>
                  <div><dt>description</dt><dd>{p.meta.curDesc || "ontbreekt"}</dd></div>
                </dl>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Eén clusterkaart ──
  function ClusterKaart({ c }: { c: Werkcluster }) {
    const open = !!openCluster[c.sleutel];
    const teDoen = c.paginas.filter((p) => !p.doorgevoerd);
    const vervallenRegels = c.paginas.filter((p) => p.vervallen);
    return (
      <div className="strategy-card">
        <button type="button" className="strategy-head wp-kaart-head" onClick={() => setOpenCluster((s) => ({ ...s, [c.sleutel]: !s[c.sleutel] }))}>
          <span className="strategy-caret">{open ? <Omlaag /> : <Uitklap />}</span>
          <span className="wp-week-nr">{c.nummer}</span>
          <span className="wp-clus-tekst">
            <span className="wp-kaart-titel">{c.naam}</span>
            <span className="wp-clus-sub">{c.samenvatting}</span>
          </span>
          <span className="strategy-meta-right">
            <Fasestreep cluster={c} standen={draaiStanden[c.naam] || []} />
            week {c.week} · {urenTekst(c.minuten)}
          </span>
        </button>
        {open && (
          <div className="strategy-body">
            {/* Alleen soort werk als chip. "Er is hier al aan gewerkt" is geen
                label maar informatie; dat stond er als een derde soort chip
                naast en dan lijken drie verschillende dingen hetzelfde. */}
            <div className="wp-row">
              {c.categorieen.map((cat) => <WerkChip key={cat} categorie={cat} />)}
              {(c.inPlanning > 0 || c.alGedaan > 0) && (
                <span className="wp-clus-sub">
                  {[c.inPlanning > 0 ? `${c.inPlanning} taken lopen al` : "",
                    c.alGedaan > 0 ? `${c.alGedaan} eerder gedaan op deze pagina's` : ""]
                    .filter(Boolean).join(" · ")}
                </span>
              )}
            </div>

            {/* Wat je als eerste wilt weten. Stond nergens; je moest het uit vier
                open regels bij elkaar rapen. */}
            {(() => {
              const o = bouwOverzicht(c);
              return (
                <div className="wp-overzicht">
                  {o.winnaar && (
                    <>
                      <p className="wp-veldnaam">De winnende pagina</p>
                      <div className="wp-ozrij">
                        <span className="wp-ozpad"><Slug url={o.winnaar.pad} domein={domein} /></span>
                        <span className="wp-ozmeta">
                          {[o.winnaar.term, o.winnaar.positie != null ? `positie ${String(o.winnaar.positie).replace(".", ",")}` : "",
                            o.winnaar.klikken ? `${getal(o.winnaar.klikken)} klikken` : ""].filter(Boolean).join(" · ")}
                        </span>
                        <span className="wp-ozreden">alles in dit blok wijst hiernaartoe</span>
                      </div>
                    </>
                  )}
                  {o.inDeWeg.length > 0 && (
                    <>
                      <p className="wp-veldnaam">Wat er in de weg zit ({o.inDeWeg.length})</p>
                      {o.inDeWeg.map((w) => (
                        <div key={w.pad} className="wp-ozrij">
                          <span className="wp-ozpad"><Slug url={w.pad} domein={domein} /></span>
                          <span className="wp-ozmeta">
                            {[w.term, w.positie != null ? `positie ${String(w.positie).replace(".", ",")}` : ""].filter(Boolean).join(" · ")}
                          </span>
                          <span className="wp-ozreden">{w.waarom}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {o.eigenVraag.length > 0 && (
                    <>
                      <p className="wp-veldnaam">Blijft staan, eigen zoekvraag ({o.eigenVraag.length})</p>
                      {o.eigenVraag.map((e) => (
                        <div key={e.pad} className="wp-ozrij">
                          <span className="wp-ozpad"><Slug url={e.pad} domein={domein} /></span>
                          <span className="wp-ozmeta">
                            {[e.term, e.positie != null ? `positie ${String(e.positie).replace(".", ",")}` : ""].filter(Boolean).join(" · ")}
                          </span>
                          <span className="wp-ozreden">zit niet in de weg, wordt niet omgeleid</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}

            {c.gedeeld.length > 0 && (
              <div className="wp-groep-achtergrond wp-proza">
                <h4>Wat er aan de hand is</h4>
                <div className="md" dangerouslySetInnerHTML={{ __html: netteHtml(c.gedeeld.join("\n\n"), { basis: domein || undefined }) }} />
              </div>
            )}

            <div className="wp-nustraks">
              <div className="wp-rail-card">
                <h4>Hoe het nu staat</h4>
                <dl className="wp-kentabel">
                  {c.nu.map((k) => <div key={k.label}><dt>{k.label}</dt><dd>{k.waarde}</dd></div>)}
                </dl>
              </div>
              <div className="wp-rail-card wp-doelkaart">
                <h4>Wat het moet worden</h4>
                <dl className="wp-kentabel">
                  {c.straks.map((k) => <div key={k.label}><dt>{k.label}</dt><dd>{k.waarde}</dd></div>)}
                </dl>
              </div>
            </div>

            <Draaiboek cluster={c} slug={slug} domein={domein}
              opVerandering={() => {
                fetch(`/api/admin/cluster-draaiboek?slug=${encodeURIComponent(slug)}`)
                  .then((r) => r.json())
                  .then((d) => { if (d?.ok) setDraaiStanden(d.standen || {}); })
                  .catch(() => { /* stil */ });
              }} />

            <p className="wp-veldnaam">De werkzaamheden ({teDoen.length})</p>
            {c.paginas.map((p) => <PaginaRij key={p.pad} p={p} cluster={c} />)}

            {vervallenRegels.length > 0 && (
              <div className="wp-vervalt">
                <h4>{vervallenRegels.length} {vervallenRegels.length === 1 ? "kans vervalt" : "kansen vervallen"} hier</h4>
                <ul>
                  {vervallenRegels.map((p) => <li key={p.pad}>{padVan(p.pad)}: {p.vervallen}</li>)}
                </ul>
              </div>
            )}

            {/* Zit er een onmogelijke omleiding in, dan moet dat bij de knop staan
                en niet alleen diep in een uitklapper: de knop is het moment waarop
                het fout kan gaan. */}
            {c.geblokkeerd > 0 && (
              <Signalen soort="let-op" regels={[
                `${c.geblokkeerd} ${c.geblokkeerd === 1 ? "omleiding in dit blok kan" : "omleidingen in dit blok kunnen"} zo niet doorgevoerd worden: het doel bestaat niet of komt terug op de bronpagina. Klap de pagina open voor de reden. De rest van dit blok kan gewoon door.`,
              ]} />
            )}

            <div className="pnl-acties-groep" role="group">
              <button type="button" className="btn btn-primary" disabled={bezig === c.sleutel || !teDoen.length}
                onClick={() => zetInPlanning(c)}>
                {bezig === c.sleutel ? "Bezig…" : `Zet dit blok in de planning (${teDoen.length})`}
              </button>
              <button type="button" className="btn btn-ghost btn-klein"
                onClick={() => zetVolgorde(c, (prioriteiten[c.naam] || 0) > 0 ? "losmaken" : "vooraan")}>
                {(prioriteiten[c.naam] || 0) > 0 ? "Laat los uit vooraan" : "Zet vooraan"}
              </button>
              {c.inPlanning > 0 && (
                <span className="muted pnl-acties-info">Er lopen al {c.inPlanning} taken voor dit blok.</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Eén cluster uit het logboek ──
  // Eén regel in "Wat er al gedaan is". Een groep van één en een groep van tien
  // zagen er eerst totaal anders uit: de een een platte rij, de ander een kop met
  // een pijltje. Maartens woorden: "de ene heeft wel pijltjes en de andere niet,
  // ik wil dat alles op één grid netjes hetzelfde eruitziet."
  //
  // Nu één rij-vorm voor allebei, met dezelfde kolommen op dezelfde plek: datum,
  // soort werk, tekst, aantal. Alleen het pijltje verschilt, en dat is precies
  // wat het verschil ís: hier kun je wel of niet dieper.
  function ActClusterBlok({ c }: { c: ActCluster }) {
    const open = !!openActCluster[c.sleutel];
    const enkel = c.items.length === 1;
    const item = c.items[0];
    const inhoud = (
      <>
        <span className="wp-akol-datum">{periodeTekst(c)}</span>
        <WerkChip categorie={c.categorie} />
        <span className="wp-clus-tekst">
          <span className="wp-akol-titel">{c.titel}</span>
          {c.subtitel && <span className="wp-clus-sub">{c.subtitel}</span>}
        </span>
        {enkel && (item.bewijs || c.paginas[0]) && (
          <span className="wp-akol-link">
            {item.bewijs
              ? <a className="uk-pad" href={item.bewijs} target="_blank" rel="noreferrer">open de mail</a>
              : <Slug url={c.paginas[0]} domein={domein} />}
          </span>
        )}
        <span className="deelkop-meta">{c.items.length}</span>
      </>
    );
    return (
      <div className="wp-taak">
        {enkel ? (
          <div className="deelkop deelkop-vast">{inhoud}</div>
        ) : (
          <button type="button" className="deelkop" aria-expanded={open}
            onClick={() => setOpenActCluster((s) => ({ ...s, [c.sleutel]: !s[c.sleutel] }))}>
            {inhoud}
          </button>
        )}
        {/* Bij een enkele regel staat de link meteen op de regel zelf, want er valt
            niets open te klappen. Bij een groep staan ze binnen de uitklap. */}

        {!enkel && open && (
          <div className="wp-taak-diep wp-proza">
            {c.items.map((a) => (
              <div key={a.id} className="wp-arij">
                <span className="wp-akol-datum">{kortDatum(new Date(a.gebeurdeOp))}</span>
                <span className="wp-grow">{a.intern}</span>
                {a.bewijs
                  ? <a className="uk-pad" href={a.bewijs} target="_blank" rel="noreferrer">open de mail</a>
                  : a.url ? <Slug url={a.url} domein={domein} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const werkClusters = gedaanClusters.filter((c) => !c.ruis);
  const ruisClusters = gedaanClusters.filter((c) => c.ruis);

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
            <h1>Werkplan</h1>
            <p className="wp-lead">
              Alles wat de analyses over deze site hebben uitgewezen, gebundeld per onderwerp en op
              volgorde gezet: eerst uitzoeken welke pagina wint, dan die pagina&#8217;s sterk maken, dan
              het snelle werk. Elk blok is één zitting werk, met de onderbouwing eronder.
            </p>
            <div className="wp-meta">
              <span>Bijgewerkt {kortDatum(new Date())}</span>
              <span>{budget} uur per week</span>
              <span>{plan.clusters.length} blokken werk</span>
              <span>{plan.weken} {plan.weken === 1 ? "week" : "weken"} bij dit budget</span>
            </div>
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-value">{plan.clusters.length}</div><div className="kpi-label">blokken werk</div></div>
              <div className="kpi-card"><div className="kpi-value">{Math.round(plan.minuten / 60)}</div><div className="kpi-label">uur in totaal</div></div>
              <div className="kpi-card"><div className="kpi-value">{plan.weken}</div><div className="kpi-label">weken bij {budget} uur</div></div>
              <div className="kpi-card"><div className="kpi-value">{plan.paginas}</div><div className="kpi-label">pagina&#8217;s betrokken</div></div>
              <div className="kpi-card"><div className="kpi-value">{getal(plan.volume)}</div><div className="kpi-label">zoekopdrachten per maand</div></div>
              <div className="kpi-card"><div className="kpi-value">{openTaken.length}</div><div className="kpi-label">taken lopen al</div></div>
            </div>
          </header>

          <div className="cockpit-card wp-stuur">
            <div className="wp-stuur-rij">
              <label className="wp-stuur-label" htmlFor="wp-zoek">Zoek</label>
              <input id="wp-zoek" type="search" className="uk-veld wp-zoekveld" value={zoek}
                placeholder="pagina, stad, onderwerp of zoekterm"
                onChange={(e) => setZoek(e.target.value)} />
              <label className="wp-stuur-label" htmlFor="wp-budget">Uren per week</label>
              <input id="wp-budget" type="number" min={0.5} step={0.5} defaultValue={budget} size={3} className="uk-veld"
                onBlur={(e) => bewaarBudget(Number(e.target.value) || budget)} />
              {!budgetIngevuld && <span className="muted">(nog niet opgeslagen)</span>}
            </div>
            <div className="wp-stuur-rij">
              <span className="wp-stuur-label">Soort werk</span>
              <div className="pnl-acties-groep" role="group">
                <button type="button" className={"btn btn-klein " + (filterCategorie === "alle" ? "btn-primary" : "btn-ghost")}
                  onClick={() => setFilterCategorie("alle")}>
                  Alles
                </button>
                {CATEGORIE_VOLGORDE.filter((c) => tellingPerCategorie.get(c)).map((c) => (
                  <button key={c} type="button" className={"btn btn-klein " + (filterCategorie === c ? "btn-primary" : "btn-ghost")}
                    onClick={() => setFilterCategorie(c)}>
                    {CATEGORIE_LABEL[c]} ({tellingPerCategorie.get(c)})
                  </button>
                ))}
              </div>
            </div>
            <div className="wp-stuur-rij">
              <span className="wp-stuur-label">Volgorde</span>
              <div className="pnl-acties-groep" role="group">
                {(["plan", "waarde", "tijd", "naam"] as const).map((k) => (
                  <button key={k} type="button"
                    className={"btn btn-klein " + (sortering === k ? "btn-primary" : "btn-ghost")}
                    onClick={() => setSortering(k)}>
                    {SORTERING_LABEL[k]}
                  </button>
                ))}
              </div>
              {Object.values(prioriteiten).some((p) => p > 0) && (
                <span className="wp-stuur-uitleg">
                  Blokken die jij vooraan hebt gezet staan altijd bovenaan, wat je hier ook kiest.
                </span>
              )}
            </div>
            {filterAan && (
              <div className="wp-stuur-rij">
                <span className="wp-stuur-uitleg">
                  {clustersGetoond.length} van de {plan.clusters.length} blokken, samen {urenTekst(getoondMinuten)}.
                  Een blok blijft heel: een filter laat blokken weg, hij haalt geen pagina&#8217;s uit een blok.
                </span>
                <button type="button" className="btn btn-quiet btn-klein wp-linkstijl pnl-acties-info"
                  onClick={() => { setFilterCategorie("alle"); setZoek(""); }}>
                  alles weer tonen
                </button>
              </div>
            )}
          </div>

          {plan.vervallen > 0 && (
            <p className="muted">
              {plan.vervallen} titel-kansen staan niet in dit plan omdat die pagina&#8217;s worden samengevoegd
              of opgeruimd. Ze staan per blok vermeld, zodat je ziet dát ze er waren.
            </p>
          )}

          {/* Wat het plan weglaat. Dit hoort hier, direct onder de zoekregel: zoek
              je op een stad en krijg je alleen titelwerk terug, dan is de vraag
              "waar zijn de rest van de blokken" en niet "hoe ziet blok 4 eruit".
              Het antwoord moet dus op dezelfde hoogte staan als de vraag. */}
          {(weggelatenGetoond.length > 0 || afgerondGetoond.length > 0) && (
            <Sectie
              titel={zoek.trim() ? `Wat er buiten dit plan valt voor "${zoek.trim()}"` : "Wat er buiten dit plan valt"}
              telling={[
                weggelatenGetoond.length ? `${weggelatenGetoond.length} pagina's` : "",
                afgerondGetoond.length ? `${afgerondGetoond.length} al af` : "",
              ].filter(Boolean).join(" · ")}
              open={wegOpen}
              // Op de stand die je nú ziet, niet op de opgeslagen stand: bij een
              // zoekopdracht staat het blok vanzelf open terwijl er nog niets is
              // opgeslagen, en dan zou een klik op "dicht" hem juist opslaan als open.
              onToggle={() => setOpenSectie((s) => ({ ...s, weggelaten: !wegOpen }))}
              uitleg={
                weggelaten
                  ? `Van de ${weggelaten.live} pagina's die live staan, staan er ${weggelaten.beoordeeld} in de opruim-analyse. De rest valt er om een reden buiten, en die reden staat hieronder. Een pagina die hier staat is dus niet vergeten, hij is overgeslagen.`
                  : undefined
              }
            >
              {afgerondGetoond.length > 0 && (
                <div className="wp-weg-groep">
                  <p className="wp-veldnaam">Al afgerond ({afgerondGetoond.length})</p>
                  <p className="muted">
                    Hier is niets meer te doen: alles in deze blokken is al doorgevoerd. Ze staan niet
                    in het plan omdat een plan over openstaand werk gaat, maar ze zijn er wel geweest.
                  </p>
                  <ul className="wp-weg-lijst">
                    {afgerondGetoond.map((c) => (
                      <li key={c.sleutel}>
                        <span className="wp-kaart-titel">{c.naam}</span>
                        <span className="wp-clus-sub"> · {c.paginas.length} pagina&#8217;s, alles doorgevoerd</span>
                        <span className="wp-weg-paden">
                          {c.paginas.map((p) => <Slug key={p.pad} url={p.pad} domein={domein} />)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {weggelatenPerReden.map(({ reden, paden }) => (
                <div key={reden} className="wp-weg-groep">
                  <p className="wp-veldnaam">{WEGLAAT_LABEL[reden]} ({paden.length})</p>
                  <p className="muted">{WEGLAAT_UITLEG[reden]}</p>
                  <div className="wp-weg-paden">
                    {paden.slice(0, TOON_WEGGELATEN).map((p) => <Slug key={p} url={p} domein={domein} />)}
                  </div>
                  {paden.length > TOON_WEGGELATEN && (
                    <p className="muted">
                      en nog {paden.length - TOON_WEGGELATEN} andere. Zoek hierboven op een stad of een
                      stuk van een pad om te zien welke dat zijn.
                    </p>
                  )}
                </div>
              ))}
            </Sectie>
          )}

          {/* Een fase is nu hetzelfde soort inklapblok als "Wat er buiten dit plan
              valt": dezelfde kaart, dezelfde kop, dezelfde manier van openklappen.
              Er stonden hier twee vormen naast elkaar (een eigen fase-kop met een
              streep eronder, en de gedeelde inklapkaart), en dan lijken twee dingen
              die hetzelfde zijn verschillend. Dicht is de stand: honderdtweeëndertig
              blokken onder elkaar is geen overzicht. Zoek je, dan gaat de fase open,
              want dan is de inhoud het antwoord op je vraag. */}
          {perFaseGetoond.map((f) => {
            const sleutel = `fase-${f.fase}`;
            const open = openSectie[sleutel] ?? !!zoek.trim();
            return (
              <Sectie
                key={f.fase}
                titel={`Fase ${f.fase} · ${FASE_TITEL[f.fase]}`}
                telling={`${f.clusters.length} ${f.clusters.length === 1 ? "blok" : "blokken"} · ${urenTekst(f.minuten)} · ${f.paginas} pagina's`}
                open={open}
                onToggle={() => setOpenSectie((s) => ({ ...s, [sleutel]: !open }))}
                uitleg={FASE_WAAROM[f.fase]}
              >
                <div className="wp-stack">
                  {f.clusters.map((c) => <ClusterKaart key={c.sleutel} c={c} />)}
                </div>
              </Sectie>
            );
          })}

          {plan.weken > WEKEN_IN_KWARTAAL && !filterAan && (
            <div className="wp-horizon">
              <p>
                Alle {plan.clusters.length} blokken staan hieronder, op volgorde. Bij {budget} uur per week
                is dit <strong>{plan.weken} weken</strong> werk in totaal, dus niet alles past in een kwartaal.
                Wil je het hele plan wél binnen dertien weken af hebben, dan is er{" "}
                <strong>{String(plan.urenVoorKwartaal).replace(".", ",")} uur per week</strong> nodig.
              </p>
              <p>
                Gebruik de filters en de zoekregel hierboven om de lijst korter te maken, en zet met
                &#8220;vooraan&#8221; de blokken bovenaan die voor jou het zwaarst wegen.
              </p>
            </div>
          )}

          {!perFaseGetoond.length && (
            <p className="muted">
              {filterAan
                ? "Geen blokken bij dit filter."
                : "Er is nog niets te plannen. Draai eerst de opruim-motor en de meta/CTR-motor voor deze klant."}
            </p>
          )}

          <Sectie
            titel="Taken die al in de planning staan"
            telling={`${openTaken.length} open`}
            open={!!openSectie.taken}
            onToggle={() => setOpenSectie((s) => ({ ...s, taken: !s.taken }))}
            uitleg="Wat er al als losse taak klaarstaat. Een blok hierboven dat al taken heeft, zegt dat op de kaart zelf."
          >
            {openTaken.length ? openTaken.map((t) => (
              <div key={t.id} className="wp-item wp-row">
                <span className="wp-grow">{t.taak}{t.url && <> · <Slug url={t.url} domein={domein} /></>}</span>
                <span className="muted">{t.thread || "geen blok"}</span>
                <button type="button" className="btn btn-ghost btn-klein" disabled={bezig === `taak-${t.id}`}
                  onClick={() => haalUitPlanning(t)}>
                  {bezig === `taak-${t.id}` ? "Bezig…" : "haal weg"}
                </button>
              </div>
            )) : <p className="muted">Nog geen taken. Zet hierboven een blok in de planning.</p>}
          </Sectie>

          <Sectie
            titel="Wat er al gedaan is"
            telling={`${gedaanRegels.length} regels in ${gedaanClusters.length} groepen`}
            open={!!openSectie.gedaan}
            onToggle={() => setOpenSectie((s) => ({ ...s, gedaan: !s.gedaan }))}
            uitleg="Uit het activiteitenlogboek, gebundeld per onderwerp: één actie die zich herhaalt is één regel, en een mailwisseling is één gesprek."
            knoppen={
              <div className="pnl-acties-groep" role="group">
                {PERIODES.map((p) => (
                  <button key={p.key} type="button"
                    className={"btn btn-klein " + (periode === p.key ? "btn-primary" : "btn-ghost")}
                    onClick={() => setPeriode(p.key)}>{p.label}</button>
                ))}
              </div>
            }
          >
            {werkClusters.map((c) => <ActClusterBlok key={c.sleutel} c={c} />)}
            {ruisClusters.length > 0 && (
              <>
                <div className="deelkop deelkop-vast wp-ruis-kop">
                  Ruis en achtergrond
                  <span className="deelkop-meta">{ruisClusters.reduce((s, c) => s + c.items.length, 0)} regels</span>
                </div>
                {ruisClusters.map((c) => <ActClusterBlok key={c.sleutel} c={c} />)}
              </>
            )}
            {!gedaanClusters.length && <p className="muted">Niets gelogd in deze periode.</p>}
          </Sectie>
        </>
      )}
    </div>
  );
}

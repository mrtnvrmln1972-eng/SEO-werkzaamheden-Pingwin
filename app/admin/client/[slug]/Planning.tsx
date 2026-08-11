"use client";

// ═══════════════════════════════════════════════════════════
// DE PLANNING
// ═══════════════════════════════════════════════════════════
// Eén scherm, twee manieren om naar hetzelfde werk te kijken:
//
//  1. WANNEER: kaarten per moment. Te laat, Vandaag, Morgen, Verder deze week,
//     Volgende week, Later, en wat nog geen dag heeft. Daar begint een werkdag.
//  2. WELKE WEEK: kaarten per week, zoals de oude weekplanning, maar dan als
//     regels in plaats van als kolommen.
//
// Binnen elke kaart staat het werk gegroepeerd per klant, met een kopregel en
// een kleurstreep, zodat je ziet wat bij elkaar hoort. Bij één klant blijven die
// kopjes weg; dan zou de groep alleen maar ruis zijn.
//
// Slepen werkt overal en betekent altijd hetzelfde: je verzet de dag. Laat je
// een taak op "Morgen" los, dan staat hij morgen. Laat je hem op een week los,
// dan houdt hij zijn weekdag, of hij krijgt de maandag als hij nog geen dag had.
// Zo kan de datum nooit iets anders zeggen dan het vak waarin de taak staat.
//
// Dit scherm SIGNALEERT; het is geen bedieningspaneel. De zeven fase-letters
// vertellen waar het werk staat en zijn expres geen knoppen: afvinken hoort in
// de kaart, en dan kleuren ze hier vanzelf mee. Klap je een regel open, dan
// verschijnt de ECHTE projectkaart, dezelfde component als altijd, met de chat,
// de documenten, de fases en de mailknoppen. Geen tweede, magere versie die kan
// achterlopen.

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { urlKey } from "../../../../lib/url-key";
import { volgendeFase, FASE_VOLGORDE } from "../../../../lib/fase-volgorde";
import {
  mondayOfISOWeek, isoVan, weekVanIso, datumNaVerplaatsing, dagenTussen, isoVanDatum,
} from "../../../../lib/week-datum";
import { nieuweVolgorde, bewaarVolgorde, opVolgorde } from "../../../../lib/weekplan-slepen";
import { isKorteTitel } from "../../../../lib/kaart-titel";
import WeekplanCard, { type WpTask, type WpPageInfo } from "./WeekplanCard";
import MailUitKaart from "./MailUitKaart";
import { useMailDatumLinks } from "./useMailDatumLinks";
import DatumKiezer, { vandaagIso, langDatum } from "./DatumKiezer";
import HerinnerKnop from "./HerinnerKnop";

type Taak = {
  notitie?: string;
  id: number; slug: string; klant: string; klantMail: string;
  taak: string; toelichting: string; url: string | null; wie: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number; datum?: string | null;
  taaktype?: string | null; naarDev?: boolean; ruw?: boolean;
};
type Pages = Record<string, Record<string, WpPageInfo>>;   // slug → urlKey → pagina
type Current = { year: number; week: number };

const dm = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });
const dagNaam = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", timeZone: "UTC" });
const pad = (u?: string | null) => { if (!u) return ""; try { return new URL(u).pathname; } catch { return u; } };
const zonderHtml = (s: string) => (s || "").replace(/<[^>]*>/g, "").trim();
const plus = (iso: string, dagen: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return isoVanDatum(d);
};

// De momenten waarop werk kan staan. De volgorde hier is de volgorde op het scherm.
type Vak = "telaat" | "vandaag" | "morgen" | "week" | "volgende" | "later" | "geen";
const VAKKEN: { key: Vak; titel: string; uitleg: string }[] = [
  { key: "telaat", titel: "Te laat", uitleg: "de dag is voorbij en het staat nog open" },
  { key: "vandaag", titel: "Vandaag", uitleg: "" },
  { key: "morgen", titel: "Morgen", uitleg: "" },
  { key: "week", titel: "Verder deze week", uitleg: "" },
  { key: "volgende", titel: "Volgende week", uitleg: "" },
  { key: "later", titel: "Later", uitleg: "" },
  { key: "geen", titel: "Nog geen dag gekozen", uitleg: "staat wel in een week, maar niet op een dag" },
];
// Standaard open: waar je vandaag iets mee moet. De rest klap je zelf open, en
// die keuze onthouden we. Zonder dit scrolt een drukke week je van je eigen dag af.
const STANDAARD_OPEN: Vak[] = ["telaat", "vandaag"];

export default function Planning({
  slug, clientName, clientEmail, alleKlanten, kaal, onGoToPage, onGoToTab, onOpenMailDate, reloadSignal,
}: {
  /** De klant waar dit scherm bij hoort. Ook in de alle-klanten-modus bekend, want
      dat is de klant wiens cockpit je open hebt. */
  slug: string;
  clientName: string;
  clientEmail?: string;
  /** true = het werk van álle klanten (met een schakelaar), false = alleen deze klant. */
  alleKlanten?: boolean;
  /** Ingebed in een blok dat zijn eigen kop al heeft (het tabblad Taken). */
  kaal?: boolean;
  onGoToPage?: (url: string) => void;
  onGoToTab?: (tab: string) => void;
  onOpenMailDate?: (datum: string) => void;
  reloadSignal?: number;
}) {
  const [taken, setTaken] = useState<Taak[]>([]);
  const [pages, setPages] = useState<Pages>({});
  const [current, setCurrent] = useState<Current | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [open, setOpen] = useState<string | null>(null);            // "slug:id"
  // Vanuit de developerlijst kun je terugspringen naar de kaart waar een taak
  // vandaan komt: /admin/client/<slug>?tab=werkzaamheden&kaart=<slug>:<id>.
  // Zonder dit moest je hem zelf terugzoeken tussen alle weken.
  useEffect(() => {
    const uit = new URLSearchParams(window.location.search).get("kaart");
    if (!uit) return;
    setOpen(uit);
    // Even wachten tot de kaarten geladen en getekend zijn.
    const t = window.setTimeout(() => {
      document.getElementById(`kaart-${uit}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 700);
    return () => window.clearTimeout(t);
  }, []);
  const [mailFor, setMailFor] = useState<{ t: Taak; aud: "klant" | "dev" } | null>(null);
  // Titel aanpassen direct vanuit het rijtje, zonder eerst de kaart te hoeven
  // openklappen. "sleutel" van de regel die op dit moment bewerkt wordt.
  const [titelBewerk, setTitelBewerk] = useState<string | null>(null);
  const [titelDraft, setTitelDraft] = useState("");
  const [titelBezig, setTitelBezig] = useState(false);
  async function bewaarTitel(t: Taak) {
    const nieuw = titelDraft.trim();
    if (!nieuw || nieuw === t.taak.trim()) { setTitelBewerk(null); return; }
    setTitelBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: t.slug, id: t.id, taak: nieuw }),
      }).then((r) => r.json());
      if (d?.ok) {
        setTaken((ts) => ts.map((x) => (zelfde(x, t) ? { ...x, taak: nieuw } : x)));
        setTitelBewerk(null);
      } else setFout(d?.error || "Titel opslaan mislukte.");
    } catch { setFout("Titel opslaan mislukte."); }
    finally { setTitelBezig(false); }
  }
  const mailDatumLinks = useMailDatumLinks(slug);
  // In de alle-klanten-modus: kijk je naar alles of alleen naar deze klant.
  const [alleen, setAlleen] = useState(false);
  const breed = !!alleKlanten && !alleen;

  // Welke kaarten staan open. Per soort onthouden, zodat je indeling blijft staan.
  const [dicht, setDicht] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const s = localStorage.getItem("pingwin-planning-dicht");
      if (s) setDicht(JSON.parse(s) as Record<string, boolean>);
      else setDicht(Object.fromEntries(VAKKEN.filter((v) => !STANDAARD_OPEN.includes(v.key)).map((v) => [v.key, true])));
    } catch {
      setDicht(Object.fromEntries(VAKKEN.filter((v) => !STANDAARD_OPEN.includes(v.key)).map((v) => [v.key, true])));
    }
  }, []);
  function klap(sleutel: string) {
    setDicht((d) => {
      const n = { ...d, [sleutel]: !d[sleutel] };
      try { localStorage.setItem("pingwin-planning-dicht", JSON.stringify(n)); } catch { /* geen opslag */ }
      return n;
    });
  }

  // Slepen: welke taak heb je vast, en boven welk vak of welke regel hang je.
  const [sleep, setSleep] = useState<Taak | null>(null);
  const [bovenVak, setBovenVak] = useState<string | null>(null);
  const [bovenRij, setBovenRij] = useState<string | null>(null);
  const sleepKlaar = () => { setSleep(null); setBovenVak(null); setBovenRij(null); };

  // Zelf een taak toevoegen, per week.
  const [nieuwVoor, setNieuwVoor] = useState<string | null>(null);
  const [nieuwTaak, setNieuwTaak] = useState("");
  const [nieuwUrl, setNieuwUrl] = useState("");
  const [nieuwWie, setNieuwWie] = useState("SEO");
  const [nieuwBezig, setNieuwBezig] = useState(false);
  const [nieuwFout, setNieuwFout] = useState("");
  const [paginas, setPaginas] = useState<string[]>([]);

  // Klant-brede knoppen.
  const [wlBusy, setWlBusy] = useState(false);
  const [wlMsg, setWlMsg] = useState("");
  const [wlLink, setWlLink] = useState("");
  const [wlFout, setWlFout] = useState(false);
  const [opruimBusy, setOpruimBusy] = useState(false);
  const [opruimMsg, setOpruimMsg] = useState("");
  const [opruimFout, setOpruimFout] = useState(false);

  // ── Laden ──
  // Twee bronnen, één vorm. De klant-route doet onderweg ook het onderhoud
  // (kaarten per pagina splitsen, fase-standen vastleggen); die blijft dus in
  // gebruik zodra je naar één klant kijkt.
  function laad() {
    const bron = alleKlanten
      ? "/api/admin/weekplan/alles"
      : `/api/admin/weekplan?slug=${encodeURIComponent(slug)}`;
    return fetch(bron)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) { setFout(d?.error || "De planning kon niet geladen worden."); return; }
        setFout("");
        if (alleKlanten) {
          setTaken(d.tasks || []);
          setPages(d.pages || {});
        } else {
          setTaken(((d.tasks || []) as Omit<Taak, "slug" | "klant" | "klantMail">[])
            .map((t) => ({ ...t, slug, klant: clientName, klantMail: clientEmail || "" })));
          setPages({ [slug]: d.pages || {} });
        }
        setCurrent(d.current || null);
      })
      .catch(() => setFout("De planning kon niet geladen worden."))
      .finally(() => setLaden(false));
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, alleKlanten, reloadSignal]);

  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (leeft && d?.ok) setPaginas(((d.urls || []) as { url: string }[]).map((u) => u.url).filter(Boolean)); })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug]);

  // Laatste werklijst-stand tonen (link naar het document als die er is).
  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (!leeft || !d?.ok) return;
      if (d.status === "running") { setWlBusy(true); setWlMsg(""); void volgWerklijst(); }
      else if (d.status === "done" && d.docLink) { setWlLink(d.docLink); setWlMsg("Open de werklijst"); }
    }).catch(() => {});
    return () => { leeft = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function volgWerklijst() {
    for (let i = 0; i < 70; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const d = await fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
      if (!d?.ok || d.status === "running") continue;
      setWlBusy(false);
      if (d.status === "done") { setWlFout(false); setWlLink(d.docLink || ""); setWlMsg(d.docLink ? "Open de werklijst" : (d.result || "Werklijst klaar.")); void laad(); }
      else { setWlFout(true); setWlLink(""); setWlMsg(d.error || "Werklijst maken mislukt."); }
      return;
    }
    setWlBusy(false); setWlFout(true); setWlMsg("Duurde te lang; probeer het nog een keer.");
  }
  function startWerklijst() {
    if (wlBusy) return;
    setWlBusy(true); setWlMsg(""); setWlLink(""); setWlFout(false);
    fetch("/api/admin/dev-worklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
    void volgWerklijst();
  }
  async function ruimAllesOp() {
    if (opruimBusy) return;
    setOpruimBusy(true); setOpruimMsg(""); setOpruimFout(false);
    try {
      const d = await fetch("/api/admin/weekplan/tidy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, all: true }),
      }).then((r) => r.json());
      setOpruimFout(!d?.ok);
      setOpruimMsg(d?.ok ? d.samenvatting : (d?.error || "Opruimen mislukte."));
      if (d?.ok) await laad();
    } catch { setOpruimFout(true); setOpruimMsg("Opruimen mislukte."); }
    finally { setOpruimBusy(false); }
  }

  // ── Wijzigen ──
  async function stuur(t: Taak, body: Record<string, unknown>) {
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: t.slug, id: t.id, ...body }),
    }).catch(() => { void laad(); });
  }
  const zelfde = (a: Taak, b: Taak) => a.id === b.id && a.slug === b.slug;

  /** Een dag kiezen. De datum ís de planning: de week volgt eruit. */
  async function zetDatum(t: Taak, iso: string) {
    const week = weekVanIso(iso);
    setTaken((ts) => ts.map((x) => (zelfde(x, t)
      ? { ...x, datum: iso || null, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) }
      : x)));
    await stuur(t, { datum: iso, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) });
  }
  async function wijzigStatus(t: Taak) {
    const status = t.status === "klaar" ? "gepland" : t.status === "bezig" ? "klaar" : "bezig";
    setTaken((ts) => ts.map((x) => (zelfde(x, t) ? { ...x, status } : x)));
    await stuur(t, { status });
  }
  async function verwijder(t: Taak) {
    setTaken((ts) => ts.filter((x) => !zelfde(x, t)));
    await stuur(t, { delete: true });
  }

  /**
   * Zelf een taak toevoegen. Vanuit een weekkaart geef je de week mee; vanuit een
   * dagkaart (Vandaag, Morgen) geef je de dag mee en volgt de week daaruit, want
   * de datum ís de planning.
   */
  async function maakTaak(doel: { jaar: number; week: number } | { dag: string }) {
    const taak = nieuwTaak.trim();
    if (!taak || nieuwBezig) return;
    const dag = "dag" in doel ? doel.dag : "";
    const w = "dag" in doel ? (weekVanIso(doel.dag) || nu) : { year: doel.jaar, week: doel.week };
    setNieuwBezig(true); setNieuwFout("");
    try {
      // De server rekent in "over hoeveel weken", dus dat leiden we af uit de
      // maandag van deze week ten opzichte van die van de huidige week.
      const nuMaandag = mondayOfISOWeek(nu.year, nu.week);
      const seq = Math.max(1, Math.round((mondayOfISOWeek(w.year, w.week).getTime() - nuMaandag.getTime()) / (7 * 864e5)) + 1);
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak, url: nieuwUrl.trim() || undefined, wie: nieuwWie, week: seq }),
      }).then((r) => r.json());
      if (!d?.ok) { setNieuwFout(d?.error || "Toevoegen lukte niet."); return; }
      // Toegevoegd vanuit een dagkaart? Dan krijgt hij meteen die dag, anders
      // zou hij onderaan bij "Nog geen dag gekozen" belanden terwijl je hem net
      // bewust op vandaag zette.
      if (dag && Array.isArray(d.ids)) {
        await Promise.all(d.ids.map((id: number) => fetch("/api/admin/weekplan", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, id, datum: dag, weekYear: w.year, weekNo: w.week }),
        }).catch(() => {})));
      }
      setNieuwTaak(""); setNieuwUrl(""); setNieuwVoor(null);
      await laad();
    } catch { setNieuwFout("Toevoegen lukte niet."); }
    finally { setNieuwBezig(false); }
  }

  /** Het invulblokje voor een nieuwe taak. Zelfde formulier, twee plekken. */
  function nieuwFormulier(doel: { jaar: number; week: number } | { dag: string }) {
    const verstuur = () => { if (nieuwTaak.trim()) void maakTaak(doel); };
    return (
      <div className="pl-nieuw">
        <input className="pl-nieuw-taak" value={nieuwTaak} autoFocus
          placeholder="Wat moet er gebeuren?"
          onChange={(e) => setNieuwTaak(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") verstuur(); if (e.key === "Escape") setNieuwVoor(null); }} />
        <input className="pl-nieuw-url" value={nieuwUrl} list="pl-paginas"
          placeholder={`Over welke pagina van ${clientName}? (mag leeg)`}
          onChange={(e) => setNieuwUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") verstuur(); if (e.key === "Escape") setNieuwVoor(null); }} />
        <div className="pl-nieuw-rij">
          <select value={nieuwWie} onChange={(e) => setNieuwWie(e.target.value)} title="Wie pakt dit op?">
            <option value="SEO">SEO</option>
            <option value="Dev">Sitebouwer</option>
            <option value="Klant">Klant</option>
          </select>
          <span className="pl-nieuw-info muted">
            {"dag" in doel ? `komt op ${langDatum(doel.dag)}` : `komt in week ${doel.week}`}
            {breed ? ` · bij ${clientName}` : ""}
          </span>
          <span className="pl-nieuw-spacer" />
          <button type="button" className="ghost-btn small" onClick={() => setNieuwVoor(null)}>Annuleren</button>
          <button type="button" className="primary-btn small"
            disabled={!nieuwTaak.trim() || nieuwBezig} onClick={verstuur}>
            {nieuwBezig ? "Bezig…" : "Toevoegen"}
          </button>
        </div>
        {nieuwFout && <div className="login-error">{nieuwFout}</div>}
      </div>
    );
  }

  /**
   * Loslaten op een week. De volgorde binnen die week verschuift mee, en de dag
   * verhuist: dezelfde weekdag als hij er een had, anders de maandag. De som
   * staat in lib/week-datum.ts, zodat geen twee schermen iets anders uitrekenen.
   */
  async function laatLosOpWeek(t: Taak, doelId: number | null, jaar: number, week: number) {
    if (week <= 0) {
      setTaken((ts) => ts.map((x) => (zelfde(x, t) ? { ...x, weekYear: 0, weekNo: 0, datum: null } : x)));
      await stuur(t, { weekYear: 0, weekNo: 0, datum: "" });
      return;
    }
    // Herordenen kan alleen binnen de kaarten van dezelfde klant; sort_order is
    // een volgorde per klant, niet over klanten heen.
    const vanKlant = taken.filter((x) => x.slug === t.slug);
    const genummerd = nieuweVolgorde(vanKlant, t.id, doelId, jaar, week);
    if (genummerd.length === 0) return;
    const perId = new Map(genummerd.map((x) => [x.id, x]));
    setTaken((ts) => ts.map((x) => (x.slug === t.slug && perId.has(x.id) ? { ...x, ...perId.get(x.id)! } : x)));
    await bewaarVolgorde(t.slug, jaar, week, genummerd);
    const nieuweDatum = datumNaVerplaatsing(t.datum, jaar, week);
    setTaken((ts) => ts.map((x) => (zelfde(x, t) ? { ...x, datum: nieuweDatum } : x)));
    await stuur(t, { datum: nieuweDatum });
  }

  // ── Indelen ──
  const vandaag = vandaagIso();
  const nu = current || isoVan(new Date());
  const maandagNu = mondayOfISOWeek(nu.year, nu.week).getTime();
  const zondagNu = plus(isoVanDatum(mondayOfISOWeek(nu.year, nu.week)), 6);

  /** Op welke dag komt een taak te staan als je hem op dit vak loslaat. */
  function doeldatum(vak: Vak): string | null {
    if (vak === "vandaag") return vandaag;
    if (vak === "morgen") return plus(vandaag, 1);
    if (vak === "week") { const d = plus(vandaag, 2); return d <= zondagNu ? d : null; }
    if (vak === "volgende") return isoVanDatum(mondayOfISOWeek(nu.year, nu.week + 1));
    if (vak === "later") return isoVanDatum(mondayOfISOWeek(nu.year, nu.week + 2));
    if (vak === "geen") return "";
    return null;                                  // "Te laat" is geen plek om iets neer te leggen
  }

  const zichtbaar = useMemo(
    () => taken.filter((t) => t.status !== "klaar" && (breed || t.slug === slug)),
    [taken, breed, slug],
  );

  const vakken = useMemo(() => {
    const uit = new Map<Vak, Taak[]>(VAKKEN.map((v) => [v.key, []]));
    for (const t of zichtbaar) {
      let vak: Vak;
      if (t.datum) {
        const dagen = dagenTussen(vandaag, t.datum);
        const w = weekVanIso(t.datum)!;
        // Van maandag tot maandag rekenen; met weeknummers gaat dat mis rond de
        // jaarwisseling, want week 1 komt ná week 52 maar is een kleiner getal.
        const weken = Math.round((mondayOfISOWeek(w.year, w.week).getTime() - maandagNu) / (7 * 864e5));
        if (dagen < 0) vak = "telaat";
        else if (dagen === 0) vak = "vandaag";
        else if (dagen === 1) vak = "morgen";
        else if (weken <= 0) vak = "week";
        else if (weken === 1) vak = "volgende";
        else vak = "later";
      } else vak = "geen";
      uit.get(vak)!.push(t);
    }
    for (const lijst of uit.values()) {
      lijst.sort((a, b) => (a.datum || "").localeCompare(b.datum || "")
        || a.klant.localeCompare(b.klant) || (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);
    }
    return uit;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [zichtbaar, vandaag, maandagNu]);

  // Per week groeperen. De huidige week en de week daarna staan er altijd, ook
  // leeg, anders is er geen plek om werk naartoe te schuiven.
  const weken = useMemo(() => {
    const map = new Map<number, Taak[]>();
    for (const t of zichtbaar) {
      const k = t.weekNo > 0 ? t.weekYear * 100 + t.weekNo : 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    for (const stap of [0, 1]) {
      const m = mondayOfISOWeek(nu.year, nu.week);
      m.setUTCDate(m.getUTCDate() + stap * 7);
      const iso = isoVan(m);
      const k = iso.year * 100 + iso.week;
      if (!map.has(k)) map.set(k, []);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([k, lijst]) => {
      const jaar = Math.floor(k / 100), week = k % 100;
      const maandag = week ? mondayOfISOWeek(jaar, week) : null;
      return {
        k, jaar, week, maandag,
        zondag: maandag ? new Date(maandag.getTime() + 6 * 864e5) : null,
        nu: jaar === nu.year && week === nu.week,
        verleden: !!maandag && maandag.getTime() < maandagNu,
        lijst: opVolgorde(lijst),
      };
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [zichtbaar, nu.year, nu.week, maandagNu]);

  /** Rijen groeperen per klant, op naam. Bij één klant blijft het één groep. */
  function perKlant(lijst: Taak[]): { slug: string; klant: string; rijen: Taak[] }[] {
    const map = new Map<string, { slug: string; klant: string; rijen: Taak[] }>();
    for (const t of lijst) {
      if (!map.has(t.slug)) map.set(t.slug, { slug: t.slug, klant: t.klant, rijen: [] });
      map.get(t.slug)!.rijen.push(t);
    }
    return [...map.values()].sort((a, b) => a.klant.localeCompare(b.klant));
  }

  const infoVan = (t: Taak): WpPageInfo | undefined => (t.url ? pages[t.slug]?.[urlKey(t.url)] : undefined);

  /** Waar staat deze taak nu? De eerste fase die nog niet af is. */
  function volgende(t: Taak): string {
    const p = infoVan(t);
    if (!p) return t.status === "bezig" ? "bezig" : "gepland";
    const f = volgendeFase(p, p.live);
    if (!f) return "alle fases af";
    return (FASE_VOLGORDE.find((x) => x.key === f)?.kort || f).toLowerCase();
  }

  // ── De regel ──
  function regel(t: Taak, opties?: { inWeek?: { jaar: number; week: number } }) {
    const sleutel = `${t.slug}:${t.id}`;
    const p = infoVan(t);
    const stippen = p ? FASE_VOLGORDE.map((f) => !!p[f.key]) : null;
    const eerstOpen = stippen ? stippen.indexOf(false) : -1;
    // Binnen een week kun je op een regel loslaten om de volgorde te bepalen; in
    // de dagkaarten heeft dat geen zin, want daar bepaalt de dag de volgorde.
    const rijDoel = opties?.inWeek ? {
      onDragOver: (e: DragEvent) => {
        if (!sleep || (sleep.id === t.id && sleep.slug === t.slug) || sleep.slug !== t.slug) return;
        e.preventDefault(); e.stopPropagation();
        setBovenRij(sleutel); setBovenVak(`week:${opties.inWeek!.jaar}:${opties.inWeek!.week}`);
      },
      onDrop: (e: DragEvent) => {
        if (!sleep) return;
        e.preventDefault(); e.stopPropagation();
        // Boven een regel van een ándere klant loslaten kan geen volgorde
        // betekenen (de volgorde loopt per klant), dus dan gaat hij achteraan.
        void laatLosOpWeek(sleep, sleep.slug === t.slug ? t.id : null, opties.inWeek!.jaar, opties.inWeek!.week);
        sleepKlaar();
      },
    } : {};
    return (
      <div key={sleutel} id={`kaart-${sleutel}`}
        className={"wb-doel" + (bovenRij === sleutel && sleep && !zelfde(sleep, t) ? " wb-doel-aan" : "")}
        {...rijDoel}>
        <div className={"wb-rij" + (open === sleutel ? " wb-rij-open" : "") + (sleep && zelfde(sleep, t) ? " wb-sleept" : "")}
          onClick={() => setOpen(open === sleutel ? null : sleutel)}>
          {/* Het handvat. Alleen dit stukje is sleepbaar, zodat de rest van de
              regel gewoon aanklikbaar blijft. De setData is er voor Firefox: dat
              start een sleep pas als er ook echt iets meegegeven wordt. */}
          <span className="wb-greep" draggable title="Sleep naar een andere dag of week"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", sleutel);
              setSleep(t);
            }}
            onDragEnd={sleepKlaar}>⋮⋮</span>
          <span className={"wb-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
          {/* Staat de titel nog in de automatische vorm ("/pad/ · optimaliseren"),
              dan bouwen we het pad als losse link plus het werkwoord ernaast op,
              zodat het pad klikbaar is. Heeft Maarten de titel zelf aangepast
              (wp-titel-pen in de kaart), dan toont dit rijtje voortaan gewoon die
              eigen titel: een aanpassing die hier onzichtbaar bleef, leek niet
              opgeslagen te zijn. */}
          {titelBewerk === sleutel ? (
            <span className="wb-wat wb-wat-bewerk" onClick={(e) => e.stopPropagation()}>
              <input autoFocus value={titelDraft} disabled={titelBezig}
                onChange={(e) => setTitelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void bewaarTitel(t); }
                  if (e.key === "Escape") { e.preventDefault(); setTitelBewerk(null); }
                }} />
              <button type="button" className="wp-fase-btn" disabled={titelBezig} onClick={() => void bewaarTitel(t)}>{titelBezig ? "Bezig…" : "Bewaar"}</button>
              <button type="button" className="wp-fase-btn wp-fase-btn-licht" disabled={titelBezig} onClick={() => setTitelBewerk(null)}>Annuleer</button>
            </span>
          ) : (
            <span className="wb-wat">
              {t.url && isKorteTitel(t.taak)
                ? (p?.live
                  ? <a className="wb-pad" href={t.url} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()} title="Open de pagina">{pad(t.url)}</a>
                  : <span className="wb-pad">{pad(t.url)}</span>)
                : <span className="wb-taak-vol">{zonderHtml(t.taak)}</span>}
              {t.url && !isKorteTitel(t.taak) && (
                <a className="wb-pad-mini" href={t.url} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()} title="Open de pagina">&#8599;</a>
              )}
              <button type="button" className="wp-titel-pen wb-titel-pen" title="Titel aanpassen"
                onClick={(e) => {
                  e.stopPropagation();
                  setTitelDraft(zonderHtml(t.taak));
                  setTitelBewerk(sleutel);
                }}>✎</button>
            </span>
          )}
          {/* Signaal, geen knop: afvinken doe je in de kaart. */}
          <span className={"wb-rail" + (stippen ? "" : " wb-rail-leeg")}>
            {stippen && FASE_VOLGORDE.map((f, i) => (
              <span key={f.key}
                className={"wb-stip" + (stippen[i] ? " af" : i === eerstOpen ? " nu" : "")}
                title={`${f.label}: ${stippen[i] ? "af" : i === eerstOpen ? "hier staat hij nu" : "nog niet begonnen"}`}>{f.letter}</span>
            ))}
          </span>
          {/* De naam van de fase ("strategie", "implementatie", …) staat al in de
              bolletjes hierboven (kleur + letter + tooltip); die nog eens als
              woord herhalen is dubbelop. Alleen zonder pagina zijn er geen
              bolletjes, en blijft dit de enige plek die de stand zegt. */}
          {!stippen && <span className="wb-next">{volgende(t)}</span>}
          <HerinnerKnop slug={t.slug} id={t.id} />
          <DatumKiezer waarde={t.datum} onKies={(iso) => void zetDatum(t, iso)} />
          <button type="button" className="wp-icon wp-del" title="Verwijderen"
            onClick={(e) => { e.stopPropagation(); void verwijder(t); }}>×</button>
        </div>
        {open === sleutel && (
          <div className="wb-kaart">
            <WeekplanCard
              slug={t.slug} t={t as unknown as WpTask} page={p}
              open inRij
              onToggleOpen={() => setOpen(null)}
              onDragStart={() => setSleep(t)} onDragEnd={sleepKlaar}
              onStatus={() => void wijzigStatus(t)}
              onRemove={() => void verwijder(t)}
              onMail={(aud) => setMailFor({ t, aud })}
              mailLinks={t.slug === slug ? mailDatumLinks : undefined}
              onOpenMailDate={t.slug === slug ? onOpenMailDate : undefined}
              onGoToPage={onGoToPage && t.slug === slug ? onGoToPage : (u) => window.open(`/admin/client/${t.slug}?tab=paginas&page=${encodeURIComponent(u)}`, "_blank")}
              onGoToTab={onGoToTab && t.slug === slug ? onGoToTab : (tab) => window.open(`/admin/client/${t.slug}?tab=${tab}`, "_blank")}
              refreshBoard={() => void laad()}
            />
          </div>
        )}
      </div>
    );
  }

  /** De rijen van een kaart, gegroepeerd per klant met een kopregel erboven. */
  function groepen(lijst: Taak[], opties?: { inWeek?: { jaar: number; week: number } }) {
    const g = perKlant(lijst);
    if (!breed) return <>{lijst.map((t) => regel(t, opties))}</>;
    return (
      <>
        {g.map((k) => (
          <div key={k.slug} className="pl-groep">
            <div className="pl-groepkop">
              <a href={`/admin/client/${k.slug}?tab=werkzaamheden`} className="pl-groepnaam"
                title={`Naar de cockpit van ${k.klant}`}>{k.klant}</a>
              <span className="pl-groepaantal">{k.rijen.length}</span>
            </div>
            {k.rijen.map((t) => regel(t, opties))}
          </div>
        ))}
      </>
    );
  }

  const totaal = zichtbaar.length;
  const teLaat = vakken.get("telaat")!.length;
  const vandaagAantal = vakken.get("vandaag")!.length;
  // "Per week" staat standaard dicht: wat vandaag of te laat is, staat al in de
  // vakken hierboven; dit blok is er voor als je verder vooruit wilt kijken.
  const weekBlokDicht = dicht["blok:week"] ?? true;

  return (
    <div className="pl">
      <datalist id="pl-paginas">{paginas.slice(0, 600).map((u) => <option key={u} value={u} />)}</datalist>

      <div className="pl-kop">
        <div>
          {!kaal && <div className="pl-titel">Planning</div>}
          {/* Deze telregel staat al in de kop van de toggle op de Taken-pagina
              (de titel "Planning"); daar is hij dubbelop en gaat hij weg. Op het
              volle weekbord (niet kaal) blijft hij staan. */}
          {!kaal && (
            <div className="muted pl-sub">
              {laden ? "Bezig met laden…" : (
                <>
                  {totaal} {totaal === 1 ? "taak" : "taken"} open{breed ? " over alle klanten" : ` bij ${clientName}`},
                  {" "}{vandaagAantal} voor vandaag ({langDatum(vandaag)})
                  {teLaat > 0 && <span className="pl-telaat"> · {teLaat} te laat</span>}
                </>
              )}
            </div>
          )}
        </div>
        <div className="pl-kopacties">
          {alleKlanten && (
            <div className="pl-schakel">
              <button type="button" className={"pl-schakelknop" + (alleen ? "" : " pl-schakel-aan")} onClick={() => setAlleen(false)}>Alle klanten</button>
              <button type="button" className={"pl-schakelknop" + (alleen ? " pl-schakel-aan" : "")} onClick={() => setAlleen(true)}>Alleen {clientName}</button>
            </div>
          )}
          <button type="button" className="ghost-btn small" disabled={wlBusy}
            title="Crawlt de live pagina's en maakt één document voor de sitebouwer met kant-en-klare meta's en alt-teksten, plus één Dev-kaart in de planning."
            onClick={startWerklijst}>{wlBusy ? "Werklijst maken…" : "Werklijst sitebouwer"}</button>
          {wlMsg && (wlLink
            ? <a className="wp-link" href={wlLink} target="_blank" rel="noreferrer">{wlMsg}</a>
            : <span className={"ovc-mk-msg" + (wlFout ? " err" : " ok")}>{wlMsg}</span>)}
          <button type="button" className="ghost-btn small" disabled={opruimBusy}
            title="Laat de assistent elke kaart één keer netjes herschrijven: dubbelingen eruit, per fase één regel. Er wordt niets inhoudelijks weggegooid."
            onClick={() => void ruimAllesOp()}>{opruimBusy ? "Opruimen…" : "Ruim alle kaarten op"}</button>
          {opruimMsg && <span className={"ovc-mk-msg" + (opruimFout ? " err" : " ok")}>{opruimMsg}</span>}
        </div>
      </div>

      {fout && <div className="login-error">{fout}</div>}
      {laden && <div className="muted pl-leeg">Bezig met laden…</div>}

      {/* ── Wanneer: een kaart per moment ── */}
      {!laden && (
        <div className="pl-blok">
          {VAKKEN.map((v) => {
            const lijst = vakken.get(v.key)!;
            const doel = doeldatum(v.key);
            const sleutel = `vak:${v.key}`;
            // Lege kaarten blijven weg, behalve "Vandaag" (dat je niets hebt is
            // ook een antwoord) en behalve terwijl je sleept: dan moet elk vak
            // een plek zijn om iets neer te leggen.
            if (lijst.length === 0 && v.key !== "vandaag" && !(sleep && doel !== null)) return null;
            const dichtNu = !!dicht[v.key];
            return (
              <div key={v.key}
                className={"card pl-card pl-card-" + v.key + (bovenVak === sleutel ? " pl-drop" : "")}
                onDragOver={(e) => { if (!sleep || doel === null) return; e.preventDefault(); setBovenVak(sleutel); setBovenRij(null); }}
                onDrop={(e) => {
                  if (!sleep || doel === null) return;
                  e.preventDefault();
                  void zetDatum(sleep, doel);
                  sleepKlaar();
                }}>
                <button type="button" className="pl-cardkop" onClick={() => klap(v.key)}>
                  <span className="pl-caret">{dichtNu ? "▸" : "▾"}</span>
                  <span className="pl-cardtitel">{v.titel}</span>
                  <span className="pl-aantal">{lijst.length}</span>
                  {v.key === "vandaag" && <span className="pl-datumlabel">{langDatum(vandaag)}</span>}
                  {v.key === "morgen" && <span className="pl-datumlabel">{dagNaam(plus(vandaag, 1))} {dm(new Date(`${plus(vandaag, 1)}T00:00:00Z`))}</span>}
                  {v.uitleg && <span className="pl-uitleg muted">{v.uitleg}</span>}
                  {doel !== null && <span className="pl-sleepdoel muted">{doel === "" ? "hier loslaten haalt de dag eraf" : `hier loslaten zet hem op ${langDatum(doel)}`}</span>}
                  {/* Zelf een taak toevoegen, meteen op de goede dag. */}
                  {doel && (
                    <span className="pl-plus" role="button" title={`Zelf een taak toevoegen op ${langDatum(doel)}`}
                      onClick={(e) => { e.stopPropagation(); setNieuwVoor(nieuwVoor === sleutel ? null : sleutel); setNieuwFout(""); }}>+</span>
                  )}
                </button>
                {nieuwVoor === sleutel && doel && nieuwFormulier({ dag: doel })}
                {!dichtNu && (
                  <div className="pl-cardbody">
                    {lijst.length === 0
                      ? <div className="muted pl-vakleeg">{v.key === "vandaag" ? "Niets voor vandaag ingepland." : "Nog niets."}</div>
                      : groepen(lijst)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Welke week: een kaart per week ── */}
      {!laden && (
        <div className="pl-blok">
          <button type="button" className="pl-bloktitel-btn" onClick={() => klap("blok:week")}>
            <span className="pl-caret">{weekBlokDicht ? "▸" : "▾"}</span>
            <span className="pl-bloktitel">Per week</span>
            <span className="pl-aantal">{weken.reduce((n, w) => n + w.lijst.length, 0)}</span>
          </button>
          {!weekBlokDicht && weken.map((w) => {
            const sleutel = `week:${w.jaar}:${w.week}`;
            // Alle weken staan standaard dicht, ook de huidige; wat vandaag/deze
            // week speelt zie je al in de vakken hierboven ("Vandaag", "Te laat").
            const dichtNu = dicht[sleutel] ?? true;
            return (
              <div key={w.k}
                className={"card pl-card" + (w.nu ? " pl-card-nu" : "") + (bovenVak === sleutel && !bovenRij ? " pl-drop" : "")}
                onDragOver={(e) => { if (!sleep) return; e.preventDefault(); setBovenVak(sleutel); setBovenRij(null); }}
                onDrop={(e) => {
                  if (!sleep) return;
                  e.preventDefault();
                  void laatLosOpWeek(sleep, null, w.jaar, w.week);
                  sleepKlaar();
                }}>
                <button type="button" className="pl-cardkop" onClick={() => klap(sleutel)}>
                  <span className="pl-caret">{dichtNu ? "▸" : "▾"}</span>
                  <span className="pl-cardtitel">{w.week ? `Week ${w.week}` : "Ongepland"}</span>
                  <span className="pl-aantal">{w.lijst.length}</span>
                  {w.maandag && w.zondag && <span className="pl-datumlabel">{dm(w.maandag)} &ndash; {dm(w.zondag)}</span>}
                  {w.nu && <span className="pl-nulabel">nu</span>}
                  {w.week > 0 && (
                    <span className="pl-plus" role="button" title={`Zelf een taak toevoegen aan week ${w.week}`}
                      onClick={(e) => { e.stopPropagation(); setNieuwVoor(nieuwVoor === sleutel ? null : sleutel); setNieuwFout(""); }}>+</span>
                  )}
                </button>
                {nieuwVoor === sleutel && nieuwFormulier({ jaar: w.jaar, week: w.week })}
                {!dichtNu && (
                  <div className="pl-cardbody">
                    {w.lijst.length === 0
                      ? <div className="muted pl-vakleeg">Nog niets in deze week. Sleep hier iets naartoe of gebruik het plusje.</div>
                      : groepen(w.lijst, { inWeek: { jaar: w.jaar, week: w.week } })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mailFor && (
        <MailUitKaart
          slug={mailFor.t.slug} t={mailFor.t as unknown as WpTask} page={infoVan(mailFor.t)}
          startAud={mailFor.aud} clientName={mailFor.t.klant} clientEmail={mailFor.t.klantMail || clientEmail}
          onClose={() => setMailFor(null)} />
      )}
    </div>
  );
}

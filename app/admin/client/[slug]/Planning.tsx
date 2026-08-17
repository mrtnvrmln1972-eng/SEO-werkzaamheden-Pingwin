"use client";

// ═══════════════════════════════════════════════════════════
// DE PLANNING: ÉÉN LIJST, OP DATUM
// ═══════════════════════════════════════════════════════════
// Alles onder elkaar, op volgorde van datum: de eerstvolgende bovenaan, en wat
// nog geen datum heeft daaronder. Verder niets: geen kaart per moment, geen
// kaart per week, geen blok dat open of dicht kan.
//
// Dat wás er wel, en het waren er zelfs twee tegelijk: zeven vakken (Te laat,
// Vandaag, Morgen, Verder deze week, Volgende week, Later, Nog geen dag) én
// daaronder nog eens een kaart per week, met dezelfde taken erin. Eén taak stond
// dus op twee plekken op hetzelfde scherm, allebei met een eigen open-of-dicht
// stand, en je scrolde langs zes koppen voordat je bij het werk was. Wie wil
// weten wat er te doen staat, wil een lijst, geen indeling.
//
// Wat de plek van een taak bepaalt, is nu alleen zijn datum. Slepen betekent dus
// nog steeds precies één ding: je verzet de dag. Laat je een taak op een andere
// taak los, dan neemt hij diens datum over en gaat hij ernaast staan; laat je
// hem onderaan los, bij wat nog geen datum heeft, dan raakt hij zijn dag kwijt.
// De datum kiezen kan ook rechtstreeks, met de datumknop op de regel.
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
import { weekVanIso } from "../../../../lib/week-datum";
import { nieuweVolgorde, bewaarVolgorde } from "../../../../lib/weekplan-slepen";
import { isKorteTitel } from "../../../../lib/kaart-titel";
import WeekplanCard, { type WpTask, type WpPageInfo } from "./WeekplanCard";
import MailUitKaart from "./MailUitKaart";
import { useMailDatumLinks } from "./useMailDatumLinks";
import DatumKiezer, { vandaagIso, langDatum } from "./DatumKiezer";
import HerinnerKnop from "./HerinnerKnop";
import { haalVooraf } from "../../../../lib/vooraf";

type Taak = {
  notitie?: string;
  id: number; slug: string; klant: string; klantMail: string;
  taak: string; toelichting: string; url: string | null; wie: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number; datum?: string | null;
  taaktype?: string | null; naarDev?: boolean; ruw?: boolean;
};
type Pages = Record<string, Record<string, WpPageInfo>>;   // slug → urlKey → pagina
type Current = { year: number; week: number };

const pad = (u?: string | null) => { if (!u) return ""; try { return new URL(u).pathname; } catch { return u; } };
const zonderHtml = (s: string) => (s || "").replace(/<[^>]*>/g, "").trim();

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

  // Slepen: welke taak heb je vast, en boven welk vak of welke regel hang je.
  const [sleep, setSleep] = useState<Taak | null>(null);
  const [bovenStaart, setBovenStaart] = useState(false);   // boven de "nog geen datum"-zone
  const [bovenRij, setBovenRij] = useState<string | null>(null);
  const sleepKlaar = () => { setSleep(null); setBovenStaart(false); setBovenRij(null); };

  // Zelf een taak toevoegen.
  const [nieuwVoor, setNieuwVoor] = useState<string | null>(null);
  const [nieuwTaak, setNieuwTaak] = useState("");
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
    // Bij één klant heeft de pagina dit verzoek al gestart terwijl de browser
    // nog aan het laden was; dan pikken we die uitkomst op in plaats van
    // opnieuw te vragen. Is er niets voorgestart, dan haalt hij het gewoon zelf.
    type Antwoord = {
      ok?: boolean; error?: string; current?: Current | null;
      tasks?: Taak[] | Omit<Taak, "slug" | "klant" | "klantMail">[];
      pages?: Pages | Record<string, WpPageInfo>;
    };
    const bezorging: Promise<Antwoord> = alleKlanten
      ? fetch(bron).then((r) => r.json())
      : haalVooraf<Antwoord>(`weekplan:${slug}`, bron);
    return bezorging
      .then((d) => {
        if (!d?.ok) { setFout(d?.error || "De planning kon niet geladen worden."); return; }
        setFout("");
        if (alleKlanten) {
          setTaken((d.tasks || []) as Taak[]);
          setPages((d.pages || {}) as Pages);
        } else {
          setTaken(((d.tasks || []) as Omit<Taak, "slug" | "klant" | "klantMail">[])
            .map((t) => ({ ...t, slug, klant: clientName, klantMail: clientEmail || "" })));
          setPages({ [slug]: (d.pages || {}) as Record<string, WpPageInfo> });
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
  /**
   * Over welke pagina gaat deze taak? Dat leiden we af uit wat je typt, in
   * plaats van er een tweede invulveld voor te vragen: een volledige link, of
   * een pad dat overeenkomt met een bekende pagina van de klant. Typ je
   * "/hovenier/oosterhout/ ontwikkelen", dan hangt de taak dus gewoon aan die
   * pagina, met de zeven fases erbij.
   *
   * Langste pad eerst, anders wint /hovenier/ van /hovenier/oosterhout/.
   */
  function paginaUitTekst(tekst: string): string | undefined {
    const link = tekst.match(/https?:\/\/\S+/i);
    if (link) return link[0].replace(/[).,;:]+$/, "");
    const kandidaten = paginas
      .map((u) => ({ url: u, p: pad(u) }))
      .filter((x) => x.p.length > 1)
      .sort((a, b) => b.p.length - a.p.length);
    return kandidaten.find((x) => tekst.includes(x.p))?.url;
  }

  async function maakTaak() {
    const taak = nieuwTaak.trim();
    if (!taak || nieuwBezig) return;
    setNieuwBezig(true); setNieuwFout("");
    try {
      // Zonder datum erbij: hij komt onderaan bij "nog geen datum" te staan, en
      // daar kies je hem zelf een dag. Dat is één handeling minder dan eerst een
      // vak of een week moeten kiezen voordat je mag typen.
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak, url: paginaUitTekst(taak), week: 1 }),
      }).then((r) => r.json());
      if (!d?.ok) { setNieuwFout(d?.error || "Toevoegen lukte niet."); return; }
      setNieuwTaak(""); setNieuwVoor(null);
      await laad();
    } catch { setNieuwFout("Toevoegen lukte niet."); }
    finally { setNieuwBezig(false); }
  }

  /**
   * Het invulblokje voor een nieuwe taak. Zelfde formulier, twee plekken.
   *
   * Eén regel typen en klaar. Er stond hier eerder ook een apart pagina-veld,
   * een keuze SEO/sitebouwer/klant en een regel "komt op dinsdag 11 augustus".
   * Alle drie weg (11 augustus 2026): de dag zet je zelf op de regel met de
   * datumknop, het werk komt sowieso langs Maarten, en over welke pagina het
   * gaat leest `paginaUitTekst` gewoon uit wat je typt.
   */
  function nieuwFormulier() {
    const verstuur = () => { if (nieuwTaak.trim()) void maakTaak(); };
    return (
      <div className="pl-nieuw">
        <input className="pl-nieuw-taak" value={nieuwTaak} autoFocus
          placeholder="Wat moet er gebeuren? (een pad zoals /hovenier/oosterhout/ hangt hem meteen aan die pagina)"
          onChange={(e) => setNieuwTaak(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") verstuur(); if (e.key === "Escape") setNieuwVoor(null); }} />
        <div className="pl-nieuw-rij">
          <span className="pl-nieuw-spacer" />
          <button type="button" className="btn btn-ghost btn-klein" onClick={() => setNieuwVoor(null)}>Annuleren</button>
          <button type="button" className="btn btn-primary btn-klein"
            disabled={!nieuwTaak.trim() || nieuwBezig} onClick={verstuur}>
            {nieuwBezig ? "Bezig…" : "Toevoegen"}
          </button>
        </div>
        {nieuwFout && <div className="login-error">{nieuwFout}</div>}
      </div>
    );
  }

  /**
   * Loslaten op een andere taak. Die taak bepaalt de datum, en als het dezelfde
   * klant is ook de plek in de rij. Zo blijft slepen precies één ding betekenen:
   * je verzet de dag. Twee taken op dezelfde dag houden hun eigen volgorde, want
   * die staat als sortOrder per week in de database.
   */
  async function laatLosOpRij(t: Taak, doel: Taak) {
    if (zelfde(t, doel)) return;
    const iso = doel.datum || "";
    const week = weekVanIso(iso);
    setTaken((ts) => ts.map((x) => (zelfde(x, t)
      ? { ...x, datum: iso || null, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) }
      : x)));
    await stuur(t, { datum: iso, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) });
    // De volgorde loopt per klant én per week; over klanten heen herordenen kan
    // dus niet, en dan is achteraan aankomen het eerlijke antwoord.
    if (!week || doel.slug !== t.slug) return;
    const vanKlant = taken.filter((x) => x.slug === t.slug);
    const genummerd = nieuweVolgorde(vanKlant, t.id, doel.id, week.year, week.week);
    if (genummerd.length === 0) return;
    const perId = new Map(genummerd.map((x) => [x.id, x]));
    setTaken((ts) => ts.map((x) => (x.slug === t.slug && perId.has(x.id) ? { ...x, ...perId.get(x.id)! } : x)));
    await bewaarVolgorde(t.slug, week.year, week.week, genummerd);
  }

  /** Loslaten onderaan, bij wat nog geen datum heeft: de dag gaat eraf. */
  async function haalDatumEraf(t: Taak) {
    if (!t.datum) return;
    setTaken((ts) => ts.map((x) => (zelfde(x, t) ? { ...x, datum: null } : x)));
    await stuur(t, { datum: "" });
  }

  // ── Indelen ──
  const vandaag = vandaagIso();

  const zichtbaar = useMemo(
    () => taken.filter((t) => t.status !== "klaar" && (breed || t.slug === slug)),
    [taken, breed, slug],
  );

  /**
   * Eén lijst, op datum. De eerstvolgende datum bovaan, wat al voorbij is staat
   * daar vanzelf bóven (want een oudere datum is kleiner), en wat nog geen datum
   * heeft komt onderaan. Binnen dezelfde dag telt de volgorde die je zelf
   * gesleept hebt, en pas daarna de klantnaam.
   */
  const metDatum = useMemo(
    () => zichtbaar.filter((t) => !!t.datum).sort((a, b) =>
      (a.datum || "").localeCompare(b.datum || "")
      || (a.sortOrder || 0) - (b.sortOrder || 0)
      || a.klant.localeCompare(b.klant) || a.id - b.id),
    [zichtbaar],
  );
  const zonderDatum = useMemo(
    () => zichtbaar.filter((t) => !t.datum).sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) || a.klant.localeCompare(b.klant) || a.id - b.id),
    [zichtbaar],
  );

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
  function regel(t: Taak) {
    const sleutel = `${t.slug}:${t.id}`;
    const p = infoVan(t);
    const stippen = p ? FASE_VOLGORDE.map((f) => !!p[f.key]) : null;
    const eerstOpen = stippen ? stippen.indexOf(false) : -1;
    // Elke regel is nu een sleepdoel: de taak die je loslaat neemt de datum van
    // deze regel over. Vroeger kon dat alleen binnen een weekkaart, want daar
    // bepaalde de kaart de dag en de regel alleen de volgorde eronder.
    const rijDoel = {
      onDragOver: (e: DragEvent) => {
        if (!sleep || zelfde(sleep, t)) return;
        e.preventDefault(); e.stopPropagation();
        setBovenRij(sleutel); setBovenStaart(false);
      },
      onDrop: (e: DragEvent) => {
        if (!sleep) return;
        e.preventDefault(); e.stopPropagation();
        void laatLosOpRij(sleep, t);
        sleepKlaar();
      },
    };
    // Een dag die voorbij is terwijl het werk nog openstaat: dat was het vak
    // "Te laat". Dat signaal mag niet verdwijnen doordat de vakken verdwijnen,
    // dus staat het nu als merkje op de regel zelf. Door de sortering op datum
    // staan die regels sowieso bovenaan.
    const teLaatRij = !!t.datum && t.datum < vandaag;
    return (
      <div key={sleutel} id={`kaart-${sleutel}`}
        className={"wb-doel"
          + (open === sleutel ? " wb-doel-open" : "")
          + (teLaatRij ? " wb-doel-telaat" : "")
          + (bovenRij === sleutel && sleep && !zelfde(sleep, t) ? " wb-doel-aan" : "")}
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
          {/* Hier stond een badge SEO/DEV. Weg op 11 augustus 2026: al het werk
              komt langs Maarten, dus "voor wie" zei niets en kostte wel een
              kolom in elke regel. De kolommaat in .wb-rij is meeveranderd. */}
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
              bolletjes, en blijft dit de enige plek die de stand zegt.
              Het element zelf blijft altijd staan (ook leeg): de rij is een
              vast kolomraster, en een weggelaten grid-item schuift alle
              kolommen na hem één op, met een uitgerekte datumknop en kruisje
              tot gevolg. */}
          <span className="wb-next">{!stippen ? volgende(t) : ""}</span>
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

  /** Rijen groeperen per klant, op naam. Bij één klant blijft het één groep. */
  function perKlant(lijst: Taak[]): { slug: string; klant: string; rijen: Taak[] }[] {
    const map = new Map<string, { slug: string; klant: string; rijen: Taak[] }>();
    for (const t of lijst) {
      if (!map.has(t.slug)) map.set(t.slug, { slug: t.slug, klant: t.klant, rijen: [] });
      map.get(t.slug)!.rijen.push(t);
    }
    return [...map.values()].sort((a, b) => a.klant.localeCompare(b.klant));
  }

  /**
   * De rijen van een lijst. Kijk je naar één klant, dan is het gewoon de lijst;
   * over alle klanten heen zou je anders niet zien van wie iets is.
   *
   * Let op: bij "alle klanten" groepeert dit binnen de lijst, dus de datum-
   * volgorde geldt dan pér klant. Dat is met opzet: een naam boven een losse
   * regel, telkens opnieuw, leest slechter dan een blokje per klant.
   */
  function rijen(lijst: Taak[]) {
    if (!breed) return <>{lijst.map((t) => regel(t))}</>;
    return (
      <>
        {perKlant(lijst).map((k) => (
          <div key={k.slug} className="pl-groep">
            <div className="pl-groepkop">
              <a href={`/admin/client/${k.slug}?tab=werkzaamheden`} className="pl-groepnaam"
                title={`Naar de cockpit van ${k.klant}`}>{k.klant}</a>
              <span className="pl-groepaantal">{k.rijen.length}</span>
            </div>
            {k.rijen.map((t) => regel(t))}
          </div>
        ))}
      </>
    );
  }

  const totaal = zichtbaar.length;
  const teLaat = metDatum.filter((t) => t.datum! < vandaag).length;
  const vandaagAantal = metDatum.filter((t) => t.datum === vandaag).length;

  return (
    <div className="pl">
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

      {!laden && (
        <div className="pl-lijst card">
          {/* Toevoegen staat bovenaan de lijst en niet meer per vak of per week:
              met één lijst is er nog maar één plek waar iets bij kan komen. */}
          <div className="pl-lijstkop">
            <span className="pl-lijsttitel">
              {totaal} {totaal === 1 ? "taak" : "taken"} open
              {teLaat > 0 && <span className="pl-telaat"> &middot; {teLaat} over de datum heen</span>}
            </span>
            <button type="button" className="btn btn-ghost btn-klein"
              onClick={() => { setNieuwVoor(nieuwVoor ? null : "nieuw"); setNieuwFout(""); }}>
              {nieuwVoor ? "Annuleren" : "Taak toevoegen"}
            </button>
          </div>
          {nieuwVoor && nieuwFormulier()}

          {totaal === 0 && <div className="muted pl-vakleeg">Niets openstaand.</div>}

          {rijen(metDatum)}

          {/* De staart: alles zonder datum. Ook het sleepdoel om een dag eraf te
              halen, want dat kan nergens anders meer sinds de vakken weg zijn.
              Hij staat er ook als hij leeg is zodra je sleept, anders is er geen
              plek om iets naartoe te schuiven. */}
          {(zonderDatum.length > 0 || (sleep && sleep.datum)) && (
            <div className={"pl-staart" + (bovenStaart ? " pl-drop" : "")}
              onDragOver={(e) => { if (!sleep?.datum) return; e.preventDefault(); setBovenStaart(true); setBovenRij(null); }}
              onDragLeave={() => setBovenStaart(false)}
              onDrop={(e) => {
                if (!sleep) return;
                e.preventDefault();
                void haalDatumEraf(sleep);
                sleepKlaar();
              }}>
              <div className="pl-staartkop">
                <span className="pl-staarttitel">Nog geen datum</span>
                <span className="pl-aantal">{zonderDatum.length}</span>
                {sleep?.datum && <span className="pl-sleepdoel muted">hier loslaten haalt de dag eraf</span>}
              </div>
              {rijen(zonderDatum)}
            </div>
          )}
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

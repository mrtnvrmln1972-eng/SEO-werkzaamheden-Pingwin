"use client";

// ═══════════════════════════════════════════════════════════
// DE PLANNING
// ═══════════════════════════════════════════════════════════
// Twee schermen boven elkaar, en ze horen bij elkaar:
//
//  1. Bovenaan het OVERZICHT over alle klanten, op dag gesorteerd: wat moet er
//     vandaag, wat komt eraan, en wat is te laat. Daar begint een werkdag.
//  2. Daaronder de PLANNING van deze klant, per week: één regel per taak, met
//     wie, welke pagina, de zeven fases als gekleurde letters, de volgende stap
//     en de dag waarop het staat.
//
// Dit scherm SIGNALEERT; het is geen bedieningspaneel. De letters vertellen waar
// het werk staat en zijn expres geen knoppen: afvinken hoort in de kaart, en dan
// kleuren ze hier vanzelf mee. Wat je hier wél doet is plannen, dus een dag
// kiezen en slepen.
//
// Compact betekent niet "minder kunnen". Klap je een regel open, dan verschijnt
// de ECHTE projectkaart van het tabblad Taken, dezelfde component, alleen
// compacter opgemaakt. Alles wat je daar kunt, kun je hier ook, tot en met het
// mailvenster.

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { urlKey } from "../../../../../lib/url-key";
import { volgendeFase, FASE_VOLGORDE } from "../../../../../lib/fase-volgorde";
import { mondayOfISOWeek, isoVan, weekVanIso, datumNaVerplaatsing } from "../../../../../lib/week-datum";
import WeekplanCard, { type WpTask, type WpPageInfo } from "../WeekplanCard";
import MailUitKaart from "../MailUitKaart";
import { useMailDatumLinks } from "../useMailDatumLinks";
import { nieuweVolgorde, bewaarVolgorde, opVolgorde } from "../../../../../lib/weekplan-slepen";
import WeekOverzicht from "./WeekOverzicht";
import DatumKiezer from "./DatumKiezer";

type FaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";
// De namen en de letters komen uit lib/fase-volgorde.ts, de enige plek waar ze staan.
const FASEN = FASE_VOLGORDE;

type Taak = {
  id: number; taak: string; toelichting: string; url: string | null; wie: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number; datum?: string | null;
  taaktype?: string | null; naarDev?: boolean;
};
type PageInfo = {
  url: string; live: boolean; klikken?: number; vertoningen?: number; next?: string;
} & Record<FaseKey, boolean>;
type Current = { year: number; week: number };

const dm = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });
const pad = (u?: string | null) => { if (!u) return ""; try { return new URL(u).pathname; } catch { return u; } };
const kaal = (s: string) => (s || "").replace(/<[^>]*>/g, "").trim();

export default function Weekbord({ slug, clientName, clientEmail, domain }: { slug: string; clientName: string; clientEmail?: string; domain: string }) {
  const [taken, setTaken] = useState<Taak[]>([]);
  const [pages, setPages] = useState<Record<string, PageInfo>>({});
  const [current, setCurrent] = useState<Current | null>(null);
  const [laden, setLaden] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const mailDatumLinks = useMailDatumLinks(slug);
  // Het mailvenster van de kaart. Stond dit er niet omheen, dan deed de Mail-knop
  // op de kaart hier stil niets, terwijl hij op het tabblad Taken gewoon werkte.
  const [mailFor, setMailFor] = useState<{ t: Taak; aud: "klant" | "dev" } | null>(null);
  // Slepen: welke kaart heb je vast, boven welke week hang je, en boven welke
  // regel. Dezelfde opzet als het tabblad Taken, zodat beide schermen zich gelijk
  // gedragen.
  const [sleep, setSleep] = useState<number | null>(null);
  const [boven, setBoven] = useState<number | null>(null);
  const [bovenRij, setBovenRij] = useState<number | null>(null);
  const sleepKlaar = () => { setSleep(null); setBoven(null); setBovenRij(null); };

  // Zelf een taak toevoegen, per week. Zonder dit kon een kaart alleen ontstaan
  // uit een bird's eye-gesprek, en moest je een klus die je even wilt vastleggen
  // eerst ergens uitpraten.
  const [nieuwVoor, setNieuwVoor] = useState<number | null>(null);
  const [nieuwTaak, setNieuwTaak] = useState("");
  const [nieuwUrl, setNieuwUrl] = useState("");
  const [nieuwWie, setNieuwWie] = useState("SEO");
  const [nieuwBezig, setNieuwBezig] = useState(false);
  const [nieuwFout, setNieuwFout] = useState("");
  const [paginas, setPaginas] = useState<string[]>([]);
  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (leeft && d?.ok) setPaginas(((d.urls || []) as { url: string }[]).map((u) => u.url).filter(Boolean)); })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug]);

  // Klant-brede knoppen die hiervoor alleen op het tabblad Taken stonden.
  const [wlBusy, setWlBusy] = useState(false);
  const [wlMsg, setWlMsg] = useState("");
  const [wlLink, setWlLink] = useState("");
  const [wlFout, setWlFout] = useState(false);
  const [opruimBusy, setOpruimBusy] = useState(false);
  const [opruimMsg, setOpruimMsg] = useState("");
  const [opruimFout, setOpruimFout] = useState(false);

  function laad() {
    return fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setTaken(d.tasks || []);
        setPages(d.pages || {});
        setCurrent(d.current || null);
      })
      .catch(() => { /* leeg scherm met melding */ })
      .finally(() => setLaden(false));
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

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
    } catch {
      setOpruimFout(true); setOpruimMsg("Opruimen mislukte.");
    } finally { setOpruimBusy(false); }
  }

  // Werken vanaf de planning: status wijzigen en een kaart weghalen. Afvinken van
  // fases gebeurt bewust NIET hier maar in de kaart; de letters op de regel zijn
  // een signaal, geen knop.
  async function wijzig(id: number, body: Record<string, unknown>) {
    try {
      await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, ...body }) });
      await laad();
    } catch { /* volgende laad herstelt het beeld */ }
  }

  async function maakTaak(jaar: number, week: number) {
    const taak = nieuwTaak.trim();
    if (!taak || nieuwBezig) return;
    setNieuwBezig(true); setNieuwFout("");
    try {
      // De server rekent in "over hoeveel weken", dus dat leiden we af uit de
      // maandag van deze week ten opzichte van die van de huidige week.
      const nuMaandag = current ? mondayOfISOWeek(current.year, current.week) : mondayOfISOWeek(jaar, week);
      const seq = Math.max(1, Math.round((mondayOfISOWeek(jaar, week).getTime() - nuMaandag.getTime()) / (7 * 864e5)) + 1);
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak, url: nieuwUrl.trim() || undefined, wie: nieuwWie, week: seq }),
      }).then((r) => r.json());
      if (d?.ok) { setNieuwTaak(""); setNieuwUrl(""); setNieuwVoor(null); await laad(); }
      else setNieuwFout(d?.error || "Toevoegen lukte niet.");
    } catch { setNieuwFout("Toevoegen lukte niet."); }
    finally { setNieuwBezig(false); }
  }

  // Loslaten. De kaart schuift meteen mee in beeld en gaat pas daarna naar de
  // database; wachten op de server maakt het slepen schokkerig. Loopt de POST
  // mis, dan zet de eerstvolgende laad() het beeld weer recht.
  async function laatLos(id: number, doelId: number | null, jaar: number, week: number) {
    if (week <= 0) {
      // Naar "Ongepland": uit de planning halen, dus ook de dag laten vallen.
      setTaken((ts) => ts.map((t) => (t.id === id ? { ...t, weekYear: 0, weekNo: 0, datum: null } : t)));
      await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, weekYear: 0, weekNo: 0, datum: "" }),
      }).catch(() => {});
      return;
    }
    const genummerd = nieuweVolgorde(taken, id, doelId, jaar, week);
    if (genummerd.length === 0) return;
    const perId = new Map(genummerd.map((t) => [t.id, t]));
    setTaken((ts) => ts.map((t) => perId.get(t.id) || t));
    await bewaarVolgorde(slug, jaar, week, genummerd);
    // De dag verhuist mee. Had de kaart al een dag, dan houdt hij dezelfde
    // weekdag; had hij er nog geen, dan wordt het de maandag van die week. Anders
    // zou een kaart die je bewust in een week neerlegt nergens in de dagplanning
    // opduiken. De som staat in lib/week-datum.ts, zodat het overzicht en de
    // planning nooit iets anders kunnen uitrekenen.
    const nieuweDatum = datumNaVerplaatsing(taken.find((t) => t.id === id)?.datum, jaar, week);
    setTaken((ts) => ts.map((t) => (t.id === id ? { ...t, datum: nieuweDatum } : t)));
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id, datum: nieuweDatum }),
    }).catch(() => {});
  }

  // Een dag kiezen. De datum ís de planning: de week volgt eruit, zodat de datum
  // en de week nooit iets anders kunnen zeggen. Leeg maken laat de week staan.
  async function zetDatum(t: Taak, iso: string) {
    const week = weekVanIso(iso);
    setTaken((ts) => ts.map((x) => (x.id === t.id
      ? { ...x, datum: iso || null, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) }
      : x)));
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: t.id, datum: iso, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) }),
    }).catch(() => { void laad(); });
  }

  // De ECHTE projectkaart, niet een namaak-samenvatting: alle drie de infoblokken,
  // de fases met hun knoppen en vinkjes, de chat, de documenten en de mailknoppen.
  // Zo kan de planning nooit achterlopen op de kaart, want het IS dezelfde kaart.
  // Compacter maken doen we met opmaak (.wb-kaart), niet door er een tweede
  // versie naast te bouwen. Een taak zonder pagina krijgt hem ook; die mist
  // alleen het fase-blok, want dat hoort bij een pagina.
  function kaart(t: Taak, p?: PageInfo) {
    return (
      <div className="wb-kaart">
        <WeekplanCard
          slug={slug} t={t as unknown as WpTask} page={p as unknown as WpPageInfo | undefined}
          open
          onToggleOpen={() => setOpen(null)}
          onDragStart={() => setSleep(t.id)} onDragEnd={sleepKlaar}
          onStatus={() => void wijzig(t.id, { status: t.status === "klaar" ? "gepland" : t.status === "bezig" ? "klaar" : "bezig" })}
          onRemove={() => void wijzig(t.id, { delete: true })}
          onMail={(aud) => setMailFor({ t, aud })}
          mailLinks={mailDatumLinks}
          onGoToPage={(u) => window.open(`/admin/client/${slug}?tab=paginas&page=${encodeURIComponent(u)}`, "_blank")}
          onGoToTab={(tab) => window.open(`/admin/client/${slug}?tab=${tab}`, "_blank")}
          refreshBoard={() => void laad()}
        />
      </div>
    );
  }

  const infoVan = (t: Taak): PageInfo | undefined => (t.url ? pages[urlKey(t.url)] : undefined);
  const fasesVan = (t: Taak) => {
    const p = infoVan(t);
    if (!p) return null;
    return FASEN.map((f) => !!p[f.key]);
  };

  // Waar staat deze taak nu? De eerste fase die nog niet af is; alles af = klaar.
  function volgende(t: Taak): string {
    const p = infoVan(t);
    if (!p) return t.status === "klaar" ? "afgerond" : "loopt";
    const f = volgendeFase(p, p.live);
    if (!f) return "alle fases af";
    return (FASEN.find((x) => x.key === f)?.kort || f).toLowerCase();
  }

  // Per week groeperen, oplopend, en binnen de week paginawerk eerst.
  //
  // De huidige week en de week daarna staan er altijd, ook leeg. Anders is er
  // geen plek om iets naartoe te slepen zodra een week nog niets bevat, en kun
  // je werk dus niet vooruitschuiven. Verder dan één lege week gaan we niet.
  const weken = useMemo(() => {
    const map = new Map<number, Taak[]>();
    for (const t of taken) {
      const k = t.weekNo > 0 ? t.weekYear * 100 + t.weekNo : 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    if (current) {
      for (const stap of [0, 1]) {
        const m = mondayOfISOWeek(current.year, current.week);
        m.setUTCDate(m.getUTCDate() + stap * 7);
        const iso = isoVan(m);
        const k = iso.year * 100 + iso.week;
        if (!map.has(k)) map.set(k, []);
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, lijst]) => {
        const jaar = Math.floor(k / 100), week = k % 100;
        const maandag = week ? mondayOfISOWeek(jaar, week) : null;
        const zondag = maandag ? new Date(maandag.getTime() + 6 * 864e5) : null;
        const op = opVolgorde(lijst);
        return {
          k, jaar, week, maandag, zondag,
          nu: !!current && jaar === current.year && week === current.week,
          metPagina: op.filter((t) => !!infoVan(t)),
          zonderPagina: op.filter((t) => !infoVan(t)),
        };
      });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [taken, pages, current]);

  // Het handvat. Alleen dit stukje is sleepbaar, zodat de rest van de regel
  // gewoon aanklikbaar blijft om de kaart open te klappen. De setData is er voor
  // Firefox: dat start een sleep pas als er ook echt iets meegegeven wordt.
  const greep = (t: Taak) => (
    <span className="wb-greep" draggable title="Sleep naar een andere week of boven een andere regel"
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(t.id));
        setSleep(t.id);
      }}
      onDragEnd={sleepKlaar}>⋮⋮</span>
  );

  // Een regel is zelf ook een doel: laat je daar los, dan komt de kaart erbóven.
  // De stopPropagation is nodig, anders pakt de week eronder de drop ook op en
  // gaat hij achteraan in plaats van op de plek van de streep.
  const rijDoel = (t: Taak) => ({
    onDragOver: (e: DragEvent) => {
      if (sleep == null || sleep === t.id) return;
      e.preventDefault(); e.stopPropagation();
      setBovenRij(t.id); setBoven(t.weekNo > 0 ? t.weekYear * 100 + t.weekNo : 0);
    },
    onDrop: (e: DragEvent) => {
      if (sleep == null) return;
      e.preventDefault(); e.stopPropagation();
      void laatLos(sleep, t.id, t.weekYear, t.weekNo);
      sleepKlaar();
    },
  });

  // Loslaten in de week zelf: dan gaat de kaart achteraan in die week.
  const weekDoel = (k: number, jaar: number, week: number) => ({
    onDragOver: (e: DragEvent) => {
      if (sleep == null) return;
      e.preventDefault();
      setBoven(k); setBovenRij(null);
    },
    onDrop: (e: DragEvent) => {
      if (sleep == null) return;
      e.preventDefault();
      void laatLos(sleep, null, jaar, week);
      sleepKlaar();
    },
  });

  return (
    <div className="wb-wrap">
      {/* De pagina's om uit te kiezen bij een nieuwe taak. Typen mag ook; de
          lijst is een hulpmiddel, geen keurslijf. */}
      <datalist id="wb-paginas">{paginas.slice(0, 600).map((u) => <option key={u} value={u} />)}</datalist>

      {/* Eerst de vraag waar een werkdag mee begint: wat ligt er, bij wie dan ook. */}
      <WeekOverzicht huidigeSlug={slug} />

      <div className="wb-kop wb-kop-klant">
        <div>
          <div className="wb-titel">Planning per week</div>
          <div className="wb-sub muted">{clientName}</div>
        </div>
        <div className="wb-kop-acties">
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
          <a className="ghost-btn small" href={`/admin/client/${slug}?tab=werkzaamheden`}>Naar Taken &rarr;</a>
        </div>
      </div>

      {laden && <div className="muted wb-leeg">Bezig met laden…</div>}
      {!laden && taken.length === 0 && <div className="muted wb-leeg">Er staan nog geen kaarten in de planning. Klik op het plusje in een weekkop om er zelf een toe te voegen.</div>}

      {weken.map((w) => {
        return (
          <div key={w.k}
            className={"wb-week" + (w.nu ? " wb-nu" : "") + (boven === w.k && bovenRij == null ? " wb-drop" : "")}
            {...weekDoel(w.k, w.jaar, w.week)}>
            <div className="wb-weekkop">
              <span className="wb-weeknr">{w.week ? `Week ${w.week}` : "Ongepland"}</span>
              {w.maandag && w.zondag && <span className="wb-weekdatum">{dm(w.maandag)} &ndash; {dm(w.zondag)}</span>}
              {w.nu && <span className="wb-nulabel">nu</span>}
              {w.week > 0 && (
                <button type="button" className="wb-plus" title={`Zelf een taak toevoegen aan week ${w.week}`}
                  onClick={() => { setNieuwVoor(nieuwVoor === w.k ? null : w.k); setNieuwFout(""); }}>+</button>
              )}
            </div>

            {nieuwVoor === w.k && (
              <div className="wb-nieuw">
                <input className="wb-nieuw-taak" value={nieuwTaak} autoFocus
                  placeholder="Wat moet er gebeuren?"
                  onChange={(e) => setNieuwTaak(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nieuwTaak.trim()) void maakTaak(w.jaar, w.week); if (e.key === "Escape") setNieuwVoor(null); }} />
                <input className="wb-nieuw-url" value={nieuwUrl} list="wb-paginas"
                  placeholder="Over welke pagina? (mag leeg)"
                  onChange={(e) => setNieuwUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nieuwTaak.trim()) void maakTaak(w.jaar, w.week); if (e.key === "Escape") setNieuwVoor(null); }} />
                <div className="wb-nieuw-rij">
                  <select value={nieuwWie} onChange={(e) => setNieuwWie(e.target.value)} title="Wie pakt dit op?">
                    <option value="SEO">SEO</option>
                    <option value="Dev">Sitebouwer</option>
                    <option value="Klant">Klant</option>
                  </select>
                  <span className="wb-nieuw-spacer" />
                  <button type="button" className="ghost-btn small" onClick={() => setNieuwVoor(null)}>Annuleren</button>
                  <button type="button" className="primary-btn small"
                    disabled={!nieuwTaak.trim() || nieuwBezig} onClick={() => void maakTaak(w.jaar, w.week)}>
                    {nieuwBezig ? "Bezig…" : "Toevoegen"}
                  </button>
                </div>
                {nieuwFout && <div className="login-error">{nieuwFout}</div>}
              </div>
            )}

            {w.metPagina.map((t) => {
              const p = infoVan(t)!;
              const stippen = fasesVan(t)!;
              const eerstOpen = stippen.indexOf(false);
              return (
                <div key={t.id}
                  className={"wb-doel" + (bovenRij === t.id && sleep !== t.id ? " wb-doel-aan" : "")}
                  {...rijDoel(t)}>
                  <div className={"wb-rij" + (open === t.id ? " wb-rij-open" : "") + (sleep === t.id ? " wb-sleept" : "")} onClick={() => setOpen(open === t.id ? null : t.id)}>
                    {greep(t)}
                    <span className={"wb-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
                    <span className="wb-wat">
                      {/* De slug linkt naar de pagina zelf. Bestaat die nog niet,
                          dan valt er niets te openen en blijft het gewone tekst. */}
                      {p.live
                        ? <a className="wb-pad" href={t.url || "#"} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()} title="Open de pagina">{pad(t.url)}</a>
                        : <span className="wb-pad">{pad(t.url)}</span>}
                      <span className="wb-doen muted">{p.live ? "optimaliseren" : "maken"}</span>
                    </span>
                    {/* Signaal, geen knop: afvinken doe je in de kaart. */}
                    <span className="wb-rail">
                      {FASEN.map((f, i) => (
                        <span key={f.key}
                          className={"wb-stip" + (stippen[i] ? " af" : i === eerstOpen ? " nu" : "")}
                          title={`${f.label}: ${stippen[i] ? "af" : i === eerstOpen ? "hier staat hij nu" : "nog niet begonnen"}`}>{f.letter}</span>
                      ))}
                    </span>
                    <span className="wb-next">{volgende(t)}</span>
                    <DatumKiezer waarde={t.datum} onKies={(iso) => void zetDatum(t, iso)} />
                  </div>
                  {open === t.id && kaart(t, p)}
                </div>
              );
            })}

            {w.zonderPagina.length > 0 && (
              <div className="wb-los">
                <div className="wb-los-kop">Zonder pagina</div>
                {w.zonderPagina.map((t) => (
                  <div key={t.id}
                    className={"wb-doel" + (bovenRij === t.id && sleep !== t.id ? " wb-doel-aan" : "")}
                    {...rijDoel(t)}>
                    <div className={"wb-rij wb-rij-los" + (open === t.id ? " wb-rij-open" : "") + (sleep === t.id ? " wb-sleept" : "")}
                      onClick={() => setOpen(open === t.id ? null : t.id)}>
                      {greep(t)}
                      <span className={"wb-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
                      <span className="wb-wat"><span className="wb-taak-vol">{kaal(t.taak)}</span></span>
                      <span className="wb-rail wb-rail-leeg" />
                      <span className="wb-next">{t.status === "klaar" ? "afgerond" : t.status === "bezig" ? "bezig" : "gepland"}</span>
                      <DatumKiezer waarde={t.datum} onKies={(iso) => void zetDatum(t, iso)} />
                    </div>
                    {open === t.id && kaart(t)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {mailFor && (
        <MailUitKaart
          slug={slug} t={mailFor.t as unknown as WpTask} page={infoVan(mailFor.t) as unknown as WpPageInfo | undefined}
          startAud={mailFor.aud} clientName={clientName} clientEmail={clientEmail}
          onClose={() => setMailFor(null)} />
      )}
    </div>
  );
}

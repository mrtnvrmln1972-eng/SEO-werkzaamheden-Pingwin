"use client";

// ═══════════════════════════════════════════════════════════
// DE PLANNING
// ═══════════════════════════════════════════════════════════
// Eén regel per taak: wie, welke pagina en of die gemaakt of geoptimaliseerd
// wordt, de zeven fases als gekleurde letters, de volgende stap, en de dag
// waarop het staat. De weekindeling blijft, want Maarten denkt in weken.
//
// Dit scherm SIGNALEERT; het is geen bedieningspaneel. De bolletjes vertellen
// waar het werk staat en zijn expres geen knoppen: afvinken hoort in de kaart,
// en dan kleuren ze hier vanzelf mee. Wat je hier wél doet is plannen, dus een
// dag kiezen en slepen.
//
// Compact betekent niet "minder kunnen". Klap je een regel open, dan verschijnt
// de ECHTE projectkaart van het tabblad Taken, dezelfde component, alleen
// compacter opgemaakt. Alles wat je daar kunt, kun je hier ook.

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { urlKey } from "../../../../../lib/url-key";
import { volgendeFase, FASE_VOLGORDE } from "../../../../../lib/fase-volgorde";
import WeekplanCard, { type WpTask, type WpPageInfo } from "../WeekplanCard";
import { nieuweVolgorde, bewaarVolgorde, opVolgorde } from "../../../../../lib/weekplan-slepen";

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

function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4); week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const monday = new Date(week1Monday); monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}
function isoVan(d: Date): Current {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const eersteDo = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  eersteDo.setUTCDate(eersteDo.getUTCDate() - ((eersteDo.getUTCDay() + 6) % 7) + 3);
  return { year: date.getUTCFullYear(), week: 1 + Math.round((date.getTime() - eersteDo.getTime()) / (7 * 864e5)) };
}
const dm = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });
/** "2026-08-06" naar "6 aug". Leeg blijft leeg. */
const kortDatum = (iso?: string | null) => {
  if (!iso) return "";
  const [j, m, d] = iso.split("-").map(Number);
  if (!j || !m || !d) return "";
  return dm(new Date(Date.UTC(j, m - 1, d)));
};
/** Dezelfde weekdag, maar dan in de opgegeven week. Zonder datum: niets. */
function verschovenDatum(iso: string | null | undefined, jaar: number, week: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const dag = (d.getUTCDay() + 6) % 7;                    // maandag = 0
  const nieuw = mondayOfISOWeek(jaar, week);
  nieuw.setUTCDate(nieuw.getUTCDate() + dag);
  return nieuw.toISOString().slice(0, 10);
}
/** Vandaag als "2026-08-06", in lokale tijd; de planning denkt in kalenderdagen. */
function vandaagIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
const pad = (u?: string | null) => { if (!u) return ""; try { return new URL(u).pathname; } catch { return u; } };
const kaal = (s: string) => (s || "").replace(/<[^>]*>/g, "").trim();

export default function Weekbord({ slug, clientName, domain }: { slug: string; clientName: string; domain: string }) {
  const [taken, setTaken] = useState<Taak[]>([]);
  const [pages, setPages] = useState<Record<string, PageInfo>>({});
  const [current, setCurrent] = useState<Current | null>(null);
  const [laden, setLaden] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  // Slepen: welke kaart heb je vast, boven welke week hang je, en boven welke
  // regel. Dezelfde opzet als het tabblad Taken, zodat beide schermen zich gelijk
  // gedragen.
  const [sleep, setSleep] = useState<number | null>(null);
  const [boven, setBoven] = useState<number | null>(null);
  const [bovenRij, setBovenRij] = useState<number | null>(null);
  const sleepKlaar = () => { setSleep(null); setBoven(null); setBovenRij(null); };

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

  // Werken vanaf de planning: status wijzigen en een kaart weghalen. Afvinken van
  // fases gebeurt bewust NIET hier maar in de kaart; de bolletjes op de regel zijn
  // een signaal, geen knop.
  async function wijzig(id: number, body: Record<string, unknown>) {
    try {
      await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, ...body }) });
      await laad();
    } catch { /* volgende laad herstelt het beeld */ }
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
    // Had de kaart een dag, dan verhuist die mee naar dezelfde weekdag in de
    // nieuwe week. Anders zou de datum een andere week aanwijzen dan waar hij staat.
    const nieuweDatum = verschovenDatum(taken.find((t) => t.id === id)?.datum, jaar, week);
    if (nieuweDatum) {
      setTaken((ts) => ts.map((t) => (t.id === id ? { ...t, datum: nieuweDatum } : t)));
      await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, datum: nieuweDatum }),
      }).catch(() => {});
    }
  }

  // Een dag kiezen. De datum ís de planning: de week volgt eruit, zodat de datum
  // en de week nooit iets anders kunnen zeggen. Leeg maken laat de week staan.
  async function zetDatum(t: Taak, iso: string) {
    const week = iso ? isoVan(new Date(`${iso}T00:00:00Z`)) : null;
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
  // Zo kan het bord nooit achterlopen op de kaart, want het IS dezelfde kaart.
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
          onMail={() => { /* de kaart opent zijn eigen mailvenster via Delen */ }}
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

  // Het datumveldje. Je ziet alleen "6 aug" (of een streepje als er nog niets
  // staat); de echte datumkiezer ligt er onzichtbaar overheen, zodat de kolom
  // smal en rustig blijft en je toch gewoon een dag prikt.
  const datumVeld = (t: Taak) => {
    const iso = t.datum || "";
    const vandaag = iso && iso === vandaagIso();
    return (
      <label className={"wb-datum" + (vandaag ? " wb-vandaag" : "")}
        onClick={(e) => e.stopPropagation()}
        title={iso ? "Klik om de dag te wijzigen" : "Klik om een dag te kiezen"}>
        <span className="wb-datum-tekst">{iso ? kortDatum(iso) : "–"}</span>
        <input type="date" value={iso} onChange={(e) => void zetDatum(t, e.target.value)} />
      </label>
    );
  };

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
      <div className="wb-kop">
        <div>
          <div className="wb-titel">Planning</div>
          <div className="wb-sub muted">{clientName}</div>
        </div>
        <a className="ghost-btn small" href={`/admin/client/${slug}?tab=werkzaamheden`}>Naar Taken &rarr;</a>
      </div>

      {laden && <div className="muted wb-leeg">Bezig met laden…</div>}
      {!laden && taken.length === 0 && <div className="muted wb-leeg">Er staan nog geen kaarten in de planning.</div>}

      {weken.map((w) => {
        return (
          <div key={w.k}
            className={"wb-week" + (w.nu ? " wb-nu" : "") + (boven === w.k && bovenRij == null ? " wb-drop" : "")}
            {...weekDoel(w.k, w.jaar, w.week)}>
            <div className="wb-weekkop">
              <span className="wb-weeknr">{w.week ? `Week ${w.week}` : "Ongepland"}</span>
              {w.maandag && w.zondag && <span className="wb-weekdatum">{dm(w.maandag)} &ndash; {dm(w.zondag)}</span>}
              {w.nu && <span className="wb-nulabel">nu</span>}
            </div>

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
                    {datumVeld(t)}
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
                      {datumVeld(t)}
                    </div>
                    {open === t.id && kaart(t)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

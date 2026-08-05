"use client";

// ═══════════════════════════════════════════════════════════
// HET WEEKBORD (voorbeeld)
// ═══════════════════════════════════════════════════════════
// Het weekoverzicht moet in één oogopslag laten zien waar we staan. De huidige
// lijst doet het omgekeerde: lompe kaarten per week, en om te zien hoe ver iets
// is moet je elke kaart openklappen.
//
// Hier is elke taak één regel: wie, wat, de zeven fases als stipjes, en de
// volgende stap. Je scant de kolom stipjes en ziet meteen wat af is en wat
// stilstaat. De weekindeling blijft, want Maarten denkt in weken ("deze week
// twee landingpages qua copy af, dat is genoeg").
//
// Dit scherm LEEST alleen (GET /api/admin/weekplan). Slepen, afvinken en
// bewerken blijven op het tabblad Taken, dat onveranderd blijft werken.

import { useEffect, useMemo, useState } from "react";
import { urlKey } from "../../../../../lib/url-key";
import { cardInfoHtml } from "../../../../../lib/card-info";
import { dagenSinds, type FaseSinds } from "../../../../../lib/fase-historie";
import { volgendeFase, aanZet } from "../../../../../lib/fase-volgorde";
import WeekplanCard, { type WpTask, type WpPageInfo } from "../WeekplanCard";

type FaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";
const FASEN: { key: FaseKey; kort: string }[] = [
  { key: "strategie", kort: "Strategie" },
  { key: "gelieerde", kort: "Gelieerde pagina's" },
  { key: "analyse", kort: "Analyse" },
  { key: "blauwdruk", kort: "Blauwdruk" },
  { key: "copy", kort: "Copy" },
  { key: "bouw", kort: "Bouw en publicatie" },
  { key: "structured", kort: "Structured data" },
];

type Taak = {
  id: number; taak: string; toelichting: string; url: string | null; wie: string;
  weekYear: number; weekNo: number; status: string; taaktype?: string | null; naarDev?: boolean;
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
const pad = (u?: string | null) => { if (!u) return ""; try { return new URL(u).pathname; } catch { return u; } };
const kaal = (s: string) => (s || "").replace(/<[^>]*>/g, "").trim();

export default function Weekbord({ slug, clientName, domain }: { slug: string; clientName: string; domain: string }) {
  const [taken, setTaken] = useState<Taak[]>([]);
  const [pages, setPages] = useState<Record<string, PageInfo>>({});
  const [current, setCurrent] = useState<Current | null>(null);
  const [sinds, setSinds] = useState<FaseSinds>({});
  const [laden, setLaden] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [bezig, setBezig] = useState<number | null>(null);

  function laad() {
    return fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setTaken(d.tasks || []);
        setPages(d.pages || {});
        setCurrent(d.current || null);
        setSinds(d.sinds || {});
      })
      .catch(() => { /* leeg scherm met melding */ })
      .finally(() => setLaden(false));
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Werken vanaf het bord: status wijzigen, een week opschuiven, een fase
  // afvinken. Alles langs de bestaande endpoints, dus precies hetzelfde als wat
  // het tabblad Taken doet.
  async function wijzig(id: number, body: Record<string, unknown>) {
    setBezig(id);
    try {
      await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, ...body }) });
      await laad();
    } catch { /* volgende laad herstelt het beeld */ } finally { setBezig(null); }
  }
  async function vinkFase(t: Taak, fase: FaseKey, af: boolean) {
    if (!t.url) return;
    setBezig(t.id);
    try {
      await fetch("/api/admin/weekplan/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, fase, done: af }) });
      await laad();
    } catch { /* stil */ } finally { setBezig(null); }
  }
  function weekOp(t: Taak, stappen: number) {
    const m = mondayOfISOWeek(t.weekYear, t.weekNo);
    m.setUTCDate(m.getUTCDate() + stappen * 7);
    const iso = isoVan(m);
    void wijzig(t.id, { weekYear: iso.year, weekNo: iso.week });
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
  const huidigeFase = (t: Taak): FaseKey | null => {
    const p = infoVan(t);
    if (!p) return null;
    return volgendeFase(p, p.live);
  };
  // Hoeveel dagen staat deze kaart al bij dezelfde stap? Pas gevuld vanaf het
  // moment dat het dashboard dit is gaan bijhouden, dus in het begin leeg.
  function dagen(t: Taak): number | null {
    const f = huidigeFase(t);
    if (!f || !t.url) return null;
    return dagenSinds(sinds[urlKey(t.url)]?.[f]);
  }
  // Wie is er aan zet? Dat volgt uit de FASE, niet uit het chipje op de kaart.
  // Een kaart kan aan de dev toegewezen zijn terwijl de strategie nog bepaald
  // moet worden; dan wacht hij op Maarten. Gedeelde regel met de kaart.
  function wachtOp(t: Taak): string {
    const p = infoVan(t);
    return aanZet(p || null, p?.live ?? true, t.wie);
  }

  // Per week groeperen, oplopend, en binnen de week paginawerk eerst.
  const weken = useMemo(() => {
    const map = new Map<number, Taak[]>();
    for (const t of taken) {
      const k = t.weekNo > 0 ? t.weekYear * 100 + t.weekNo : 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, lijst]) => {
        const jaar = Math.floor(k / 100), week = k % 100;
        const maandag = week ? mondayOfISOWeek(jaar, week) : null;
        const zondag = maandag ? new Date(maandag.getTime() + 6 * 864e5) : null;
        return {
          k, jaar, week, maandag, zondag,
          nu: !!current && jaar === current.year && week === current.week,
          metPagina: lijst.filter((t) => !!infoVan(t)),
          zonderPagina: lijst.filter((t) => !infoVan(t)),
        };
      });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [taken, pages, current]);

  // Eén regel over alles: waar hangt het werk, en wat staat er nog helemaal stil.
  const totaal = useMemo(() => {
    const metPagina = taken.filter((t) => infoVan(t));
    const perFase = new Map<string, number>();
    let klaar = 0;
    for (const t of metPagina) {
      const v = volgende(t);
      if (v === "alle fases af") { klaar++; continue; }
      perFase.set(v, (perFase.get(v) || 0) + 1);
    }
    const dev = taken.filter((t) => t.wie === "Dev" && t.status !== "klaar").length;
    return { aantal: taken.length, metPagina: metPagina.length, klaar, perFase: [...perFase.entries()].sort((a, b) => b[1] - a[1]), dev };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [taken, pages]);

  return (
    <div className="wb-wrap">
      <div className="wb-kop">
        <div>
          <div className="wb-titel">Weekbord</div>
          <div className="wb-sub muted">{clientName} &middot; voorbeeld, hiernaast blijft het tabblad Taken gewoon werken</div>
        </div>
        <a className="ghost-btn small" href={`/admin/client/${slug}?tab=werkzaamheden`}>Naar Taken &rarr;</a>
      </div>

      {laden && <div className="muted wb-leeg">Bezig met laden…</div>}
      {!laden && taken.length === 0 && <div className="muted wb-leeg">Er staan nog geen kaarten in de weekplanning.</div>}

      {!laden && taken.length > 0 && (
        <div className="wb-stand">
          <strong>{totaal.aantal} kaarten</strong>
          {totaal.klaar > 0 && <span>, {totaal.klaar} helemaal af</span>}
          {totaal.perFase.length > 0 && (
            <span>. Hangt nu bij: {totaal.perFase.map(([f, n]) => `${n}× ${f}`).join(", ")}</span>
          )}
          {totaal.dev > 0 && <span>. {totaal.dev} {totaal.dev === 1 ? "kaart wacht" : "kaarten wachten"} op de dev.</span>}
        </div>
      )}

      {weken.map((w) => {
        const alle = [...w.metPagina, ...w.zonderPagina];
        const devs = alle.filter((t) => t.wie === "Dev").length;
        const af = w.metPagina.filter((t) => volgende(t) === "alle fases af").length;
        return (
          <div key={w.k} className={"wb-week" + (w.nu ? " wb-nu" : "")}>
            <div className="wb-weekkop">
              <span className="wb-weeknr">{w.week ? `Week ${w.week}` : "Ongepland"}</span>
              {w.maandag && w.zondag && <span className="wb-weekdatum">{dm(w.maandag)} &ndash; {dm(w.zondag)}</span>}
              {w.nu && <span className="wb-nulabel">deze week</span>}
              <span className="wb-weeksom muted">
                {alle.length} {alle.length === 1 ? "kaart" : "kaarten"}
                {af > 0 && `, ${af} af`}
                {devs > 0 && `, ${devs} bij de dev`}
              </span>
            </div>

            {w.metPagina.map((t) => {
              const p = infoVan(t)!;
              const stippen = fasesVan(t)!;
              const eerstOpen = stippen.indexOf(false);
              const wacht = dagen(t);
              return (
                <div key={t.id}>
                  <div className={"wb-rij" + (open === t.id ? " wb-rij-open" : "")} onClick={() => setOpen(open === t.id ? null : t.id)}>
                    <span className={"wb-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
                    <span className="wb-wat">
                      <span className="wb-pad">{pad(t.url)}</span>
                      {!p.live && <span className="wb-nieuw">nieuw</span>}
                      <span className="wb-taak muted">{kaal(t.taak)}</span>
                    </span>
                    <span className="wb-rail" onClick={(e) => e.stopPropagation()}>
                      {FASEN.map((f, i) => (
                        <button key={f.key} type="button" disabled={bezig === t.id}
                          className={"wb-stip" + (stippen[i] ? " af" : i === eerstOpen ? " nu" : "")}
                          title={`${f.kort}: ${stippen[i] ? "af, klik om terug te zetten" : "nog niet, klik om af te vinken"}`}
                          onClick={() => void vinkFase(t, f.key, !stippen[i])} />
                      ))}
                    </span>
                    <span className="wb-next">
                      {volgende(t)}
                      {wacht !== null && <span className={"wb-dagen" + (wacht >= 7 ? " lang" : "")}>{wacht === 0 ? "vandaag" : `${wacht} d`}</span>}
                    </span>
                  </div>
                  {open === t.id && (
                    <div className="wb-kaart">
                      {/* De ECHTE projectkaart, niet een namaak-samenvatting: alle
                          drie de infoblokken, de fases met hun knoppen en vinkjes,
                          de chat, de documenten en de mailknoppen. Zo kan het bord
                          nooit achterlopen op de kaart, want het is dezelfde kaart.
                          Compacter maken doen we met opmaak (.wb-kaart), niet door
                          er een tweede versie naast te bouwen. */}
                      <WeekplanCard
                        slug={slug} t={t as unknown as WpTask} page={p as unknown as WpPageInfo}
                        open
                        onToggleOpen={() => setOpen(null)}
                        onDragStart={() => {}} onDragEnd={() => {}}
                        onStatus={() => void wijzig(t.id, { status: t.status === "klaar" ? "gepland" : t.status === "bezig" ? "klaar" : "bezig" })}
                        onRemove={() => void wijzig(t.id, { delete: true })}
                        onMail={() => { /* de kaart opent zijn eigen mailvenster via Delen */ }}
                        onGoToPage={(u) => window.open(`/admin/client/${slug}?tab=paginas&page=${encodeURIComponent(u)}`, "_blank")}
                        onGoToTab={(tab) => window.open(`/admin/client/${slug}?tab=${tab}`, "_blank")}
                        refreshBoard={() => void laad()}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {w.zonderPagina.length > 0 && (
              <div className="wb-los">
                <div className="wb-los-kop">Zonder pagina</div>
                {w.zonderPagina.map((t) => (
                  <div key={t.id} className="wb-rij wb-rij-los">
                    <span className={"wb-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
                    <span className="wb-wat"><span className="wb-taak-vol">{kaal(t.taak)}</span></span>
                    <span className="wb-next">{t.status === "klaar" ? "afgerond" : t.status === "bezig" ? "bezig" : "gepland"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {!laden && taken.length > 0 && (
        <div className="wb-voet muted">
          Groen is af, oranje is de stap waar hij nu staat, grijs is nog niet begonnen. Wijs een rijtje
          stipjes aan om te zien welke fase welke is. Klik een regel aan voor de achtergrond.
        </div>
      )}
    </div>
  );
}

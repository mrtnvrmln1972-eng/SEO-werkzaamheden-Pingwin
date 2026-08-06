"use client";

// ═══════════════════════════════════════════════════════════
// HET OVERZICHT: alle klanten, op dag in plaats van op klant
// ═══════════════════════════════════════════════════════════
// De planning per klant beantwoordt "wat ligt er bij deze klant". Maar een
// werkweek begint niet bij een klant, hij begint bij een dag: wat moet er
// vandaag gebeuren, en wat komt eraan. Negentien klanten langslopen om dat te
// weten te komen is precies het werk dat een dashboard hoort weg te nemen.
//
// Daarom staat hier één lijst over alle klanten heen, ingedeeld op wanneer het
// werk staat: te laat, vandaag, morgen, verder deze week, volgende week, later,
// en wat nog helemaal geen dag heeft.
//
// Verder is dit hetzelfde als de planning eronder: dezelfde regel, dezelfde
// fase-letters, dezelfde datumkiezer, en opengeklapt dezelfde projectkaart. Een
// tweede, magere versie zou binnen een maand iets anders vertellen dan de kaart.

import { useEffect, useMemo, useState } from "react";
import { urlKey } from "../../../../../lib/url-key";
import { volgendeFase, FASE_VOLGORDE } from "../../../../../lib/fase-volgorde";
import { isoVan, weekVanIso, dagenTussen, mondayOfISOWeek } from "../../../../../lib/week-datum";
import WeekplanCard, { type WpTask, type WpPageInfo } from "../WeekplanCard";
import MailUitKaart from "../MailUitKaart";
import DatumKiezer, { vandaagIso, langDatum } from "./DatumKiezer";

type Taak = {
  id: number; slug: string; klant: string; klantMail: string;
  taak: string; toelichting: string; url: string | null; wie: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number; datum?: string | null;
};
type Pages = Record<string, Record<string, WpPageInfo>>;   // slug → urlKey → pagina

const pad = (u?: string | null) => { if (!u) return ""; try { return new URL(u).pathname; } catch { return u; } };
const kaal = (s: string) => (s || "").replace(/<[^>]*>/g, "").trim();

// De vakjes waarin het werk valt. De volgorde hier is de volgorde op het scherm.
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

export default function WeekOverzicht({ huidigeSlug }: { huidigeSlug?: string }) {
  const [taken, setTaken] = useState<Taak[]>([]);
  const [pages, setPages] = useState<Pages>({});
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [open, setOpen] = useState<string | null>(null);           // "slug:id"
  const [mailFor, setMailFor] = useState<{ t: Taak; aud: "klant" | "dev" } | null>(null);
  // Alleen het werk van deze klant, of alles. Standaard alles: dat is de reden
  // dat dit scherm bestaat.
  const [alleen, setAlleen] = useState(false);

  function laad() {
    return fetch("/api/admin/weekplan/alles")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) { setFout(d?.error || "Het overzicht kon niet geladen worden."); return; }
        setTaken(d.tasks || []);
        setPages(d.pages || {});
        setFout("");
      })
      .catch(() => setFout("Het overzicht kon niet geladen worden."))
      .finally(() => setLaden(false));
  }
  useEffect(() => { void laad(); }, []);

  const infoVan = (t: Taak): WpPageInfo | undefined => (t.url ? pages[t.slug]?.[urlKey(t.url)] : undefined);

  // Waar staat deze taak nu? De eerste fase die nog niet af is; alles af = klaar.
  function volgende(t: Taak): string {
    const p = infoVan(t);
    if (!p) return t.status === "bezig" ? "bezig" : "loopt";
    const f = volgendeFase(p, p.live);
    if (!f) return "alle fases af";
    return (FASE_VOLGORDE.find((x) => x.key === f)?.kort || f).toLowerCase();
  }

  async function zetDatum(t: Taak, iso: string) {
    // De datum ís de planning: de week volgt eruit, zodat het weeknummer en de
    // dag nooit iets anders kunnen zeggen.
    const week = weekVanIso(iso);
    setTaken((ts) => ts.map((x) => (x.id === t.id && x.slug === t.slug
      ? { ...x, datum: iso || null, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) }
      : x)));
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: t.slug, id: t.id, datum: iso, ...(week ? { weekYear: week.year, weekNo: week.week } : {}) }),
    }).catch(() => { void laad(); });
  }

  // Indelen op wanneer het werk staat. Afgeronde kaarten blijven weg: dit scherm
  // beantwoordt "wat moet er nog", niet "wat is er geweest".
  const vakken = useMemo(() => {
    const vandaag = vandaagIso();
    const nu = isoVan(new Date());
    const maandagNu = mondayOfISOWeek(nu.year, nu.week).getTime();
    const uit = new Map<Vak, Taak[]>(VAKKEN.map((v) => [v.key, []]));
    for (const t of taken) {
      if (t.status === "klaar") continue;
      if (alleen && huidigeSlug && t.slug !== huidigeSlug) continue;
      let vak: Vak;
      if (t.datum) {
        const dagen = dagenTussen(vandaag, t.datum);
        const w = weekVanIso(t.datum)!;
        // Hoeveel weken verderop, gerekend van maandag tot maandag. Rekenen met
        // weeknummers zelf gaat mis rond de jaarwisseling: week 1 komt dan ná
        // week 52 maar is een kleiner getal.
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
    // Binnen een vak: op dag, dan op klant, dan op de eigen volgorde. Zonder dag
    // (het laatste vak) op klant.
    for (const lijst of uit.values()) {
      lijst.sort((a, b) =>
        (a.datum || "").localeCompare(b.datum || "")
        || a.klant.localeCompare(b.klant)
        || (a.sortOrder || 0) - (b.sortOrder || 0)
        || a.id - b.id);
    }
    return uit;
  }, [taken, alleen, huidigeSlug]);

  const totaal = [...vakken.values()].reduce((n, l) => n + l.length, 0);
  const teLaat = vakken.get("telaat")!.length;
  const vandaagAantal = vakken.get("vandaag")!.length;

  function regel(t: Taak) {
    const sleutel = `${t.slug}:${t.id}`;
    const p = infoVan(t);
    const stippen = p ? FASE_VOLGORDE.map((f) => !!p[f.key]) : null;
    const eerstOpen = stippen ? stippen.indexOf(false) : -1;
    return (
      <div key={sleutel} className="wb-doel">
        <div className={"wb-rij wb-rij-ov" + (open === sleutel ? " wb-rij-open" : "")}
          onClick={() => setOpen(open === sleutel ? null : sleutel)}>
          <a className="wb-klant" href={`/admin/client/${t.slug}/weekbord`}
            title={`Naar de planning van ${t.klant}`}
            onClick={(e) => e.stopPropagation()}>{t.klant}</a>
          <span className={"wb-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
          <span className="wb-wat">
            {t.url
              ? (p?.live
                ? <a className="wb-pad" href={t.url} target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()} title="Open de pagina">{pad(t.url)}</a>
                : <span className="wb-pad">{pad(t.url)}</span>)
              : <span className="wb-taak-vol">{kaal(t.taak)}</span>}
            {p && <span className="wb-doen muted">{p.live ? "optimaliseren" : "maken"}</span>}
          </span>
          <span className={"wb-rail" + (stippen ? "" : " wb-rail-leeg")}>
            {stippen && FASE_VOLGORDE.map((f, i) => (
              <span key={f.key}
                className={"wb-stip" + (stippen[i] ? " af" : i === eerstOpen ? " nu" : "")}
                title={`${f.label}: ${stippen[i] ? "af" : i === eerstOpen ? "hier staat hij nu" : "nog niet begonnen"}`}>{f.letter}</span>
            ))}
          </span>
          <span className="wb-next">{volgende(t)}</span>
          <DatumKiezer waarde={t.datum} onKies={(iso) => void zetDatum(t, iso)} />
        </div>
        {open === sleutel && (
          <div className="wb-kaart">
            <WeekplanCard
              slug={t.slug} t={t as unknown as WpTask} page={p}
              open
              onToggleOpen={() => setOpen(null)}
              onDragStart={() => { /* in het overzicht plan je met de dag, niet met slepen */ }}
              onDragEnd={() => { /* idem */ }}
              onStatus={() => void wijzigStatus(t)}
              onRemove={() => void verwijder(t)}
              onMail={(aud) => setMailFor({ t, aud })}
              onGoToPage={(u) => window.open(`/admin/client/${t.slug}?tab=paginas&page=${encodeURIComponent(u)}`, "_blank")}
              onGoToTab={(tab) => window.open(`/admin/client/${t.slug}?tab=${tab}`, "_blank")}
              refreshBoard={() => void laad()}
            />
          </div>
        )}
      </div>
    );
  }

  async function wijzigStatus(t: Taak) {
    const status = t.status === "klaar" ? "gepland" : t.status === "bezig" ? "klaar" : "bezig";
    setTaken((ts) => ts.map((x) => (x.id === t.id && x.slug === t.slug ? { ...x, status } : x)));
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: t.slug, id: t.id, status }),
    }).catch(() => { void laad(); });
  }
  async function verwijder(t: Taak) {
    setTaken((ts) => ts.filter((x) => !(x.id === t.id && x.slug === t.slug)));
    await fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: t.slug, id: t.id, delete: true }),
    }).catch(() => { void laad(); });
  }

  return (
    <div className="wb-ov">
      <div className="wb-ov-kop">
        <div>
          <div className="wb-titel">Wat er ligt</div>
          <div className="wb-sub muted">
            {laden ? "Bezig met laden…" : (
              <>
                {totaal} {totaal === 1 ? "taak" : "taken"} open over alle klanten,
                {" "}{vandaagAantal} voor vandaag ({langDatum(vandaagIso())})
                {teLaat > 0 && <span className="wb-ov-telaat"> · {teLaat} te laat</span>}
              </>
            )}
          </div>
        </div>
        {huidigeSlug && (
          <div className="wb-ov-schakel">
            <button type="button" className={"wb-schakel" + (alleen ? "" : " wb-schakel-aan")} onClick={() => setAlleen(false)}>Alle klanten</button>
            <button type="button" className={"wb-schakel" + (alleen ? " wb-schakel-aan" : "")} onClick={() => setAlleen(true)}>Alleen deze klant</button>
          </div>
        )}
      </div>

      {fout && <div className="login-error">{fout}</div>}

      {!laden && VAKKEN.map((v) => {
        const lijst = vakken.get(v.key)!;
        // Lege vakken blijven weg, behalve "Vandaag": dat je vandaag niets hebt
        // staan is zelf ook een antwoord.
        if (lijst.length === 0 && v.key !== "vandaag") return null;
        return (
          <div key={v.key} className={"wb-vak wb-vak-" + v.key}>
            <div className="wb-vakkop">
              <span className="wb-vaktitel">{v.titel}</span>
              <span className="wb-vakaantal">{lijst.length}</span>
              {v.uitleg && <span className="wb-vakuitleg muted">{v.uitleg}</span>}
            </div>
            {lijst.length === 0
              ? <div className="wb-vakleeg muted">Niets voor vandaag ingepland.</div>
              : lijst.map(regel)}
          </div>
        );
      })}

      {mailFor && (
        <MailUitKaart
          slug={mailFor.t.slug} t={mailFor.t as unknown as WpTask} page={infoVan(mailFor.t)}
          startAud={mailFor.aud} clientName={mailFor.t.klant} clientEmail={mailFor.t.klantMail}
          onClose={() => setMailFor(null)} />
      )}
    </div>
  );
}

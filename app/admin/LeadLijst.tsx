"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ClientConfig } from "../../lib/clients";
import { LEAD_STANDAARD_KANS } from "../../lib/prognose-kans";
import Vouwblok from "./Vouwblok";
import { Kruis, Munt, Omhoog, Omlaag, PijlRechts, Uitklap, Vlag } from "../_ui/Pijl";
import { BedragVeld, DatumVeld, MaandVeld } from "./RijVeld";
import { useExtraRegels, RegelNaam, RegelSoortKeuze, RegelMaand, RegelKans, RegelOpvolg, RegelBedrag, RegelWeg } from "./ExtraRegels";

// ═══════════════════════════════════════════════════════════
// DE LEADLIJST OP HET KLANTENOVERZICHT
// ═══════════════════════════════════════════════════════════
// Eén rij per lead, en in die rij vul je alles in wat je erover weet: hoe
// kansrijk hij is, wat het per maand wordt, of er een eenmalig bedrag bij komt
// en in welke maand hij naar verwachting start. Dat staat hier en niet één klik
// verder, omdat je er precies op dit moment over nadenkt.
//
// Wat NIET van hier is: de opvolgdatum. Die komt uit HubSpot, want daar plan je
// je gesprekken. Elk veld heeft één baas; zie lib/hubspot-leads.ts.
//
// Eronder staat de maandstrook: klanten en leads bij elkaar, maand voor maand.
// Die rekent niet zelf, hij haalt de uitkomst op uit dezelfde prognose als
// /admin/financien. Twee keer optellen levert vroeg of laat twee antwoorden op.
// ═══════════════════════════════════════════════════════════

/** De stand van één lead in HubSpot, voor de kolommen in de leadlijst. */
export type HubspotStand = { slug: string; opvolgDatum: string | null; sluitDatum: string | null; faseNaam: string; hubspotUrl: string };

/** Een datum kort en leesbaar: "3 sep". Leeg blijft een streepje. */
function dagKort(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
}

/** Eén maand in de strook onder de leadlijst: wat wordt de omzet, en waaruit. */
type StripMaand = {
  maand: string; label: string;
  zekerOmzet: number; verwachtOmzet: number; postOmzet: number;
  omzet: number; omzetSeo: number; omzetAds: number; omzetEenmalig: number; omzetOverig: number;
};

/** Op welke kolom je kunt sorteren. Leeg = je eigen volgorde (slepen). */
type SortKolom = "" | "opvolgen" | "kans" | "budget" | "kosten" | "eenmalig" | "start";

/** Twee rijen die hetzelfde bedrijf lijken te zijn. */
type DubbelPaar = {
  behoud: { slug: string; naam: string; domein: string | null; bedrag: number; fase: string };
  weg: { slug: string; naam: string; domein: string | null; bedrag: number; fase: string };
  waarom: string;
  meeneemt: string[];
};

/** Eén klant, lead of losse post in de opbouw onder de strook. */
type StripOpbouw = { slug: string; naam: string; soort: string; kans: number; bedragen: number[] };

/** De drie dingen die je per lead in de lijst zelf invult, als tekst in beeld. */
type LeadVeld = { kans: string; maand: string; eenmalig: string; soort: "seo" | "ads" | "website" | "overig" };

/** De vier soorten, in dezelfde volgorde als bij een extra regel. */
/** De kolommen waarop je kunt sorteren, in de volgorde waarin ze staan. */
const SORTEERBAAR: { kolom: Exclude<SortKolom, "">; label: string }[] = [
  { kolom: "opvolgen", label: "Opvolgen" },
  { kolom: "kans", label: "Kans" },
  { kolom: "budget", label: "Budget p/m" },
  { kolom: "kosten", label: "Kosten p/m" },
  { kolom: "eenmalig", label: "Eenmalig" },
  { kolom: "start", label: "Verwacht klant" },
];

const SOORT_KEUZE: { waarde: LeadVeld["soort"]; label: string }[] = [
  { waarde: "seo", label: "SEO" },
  { waarde: "ads", label: "Advertenties" },
  { waarde: "website", label: "Website" },
  { waarde: "overig", label: "Overig" },
];
const LEEG_VELD: LeadVeld = { kans: "", maand: "", eenmalig: "", soort: "seo" };

/** Een maand als "2026-10" kort en leesbaar: "okt 2026". */
function maandKort(maand: string | null | undefined): string {
  if (!maand) return "";
  try {
    return new Date(`${maand}-01T00:00:00`).toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
  } catch { return maand; }
}

/** Is dit contactmoment geweest, vandaag, of nog niet? Bepaalt de kleur. */
function opvolgKlasse(datum: string | null | undefined): string {
  if (!datum) return "";
  const vandaag = new Date().toISOString().slice(0, 10);
  if (datum < vandaag) return " lead-datum-verstreken";
  if (datum === vandaag) return " lead-datum-vandaag";
  return "";
}

export default function LeadLijst({
  leads, isOwner, hubspot, sleep, setSleep, sleepVolgorde, openDashboard, setFase, refresh, melden, setHertel,
}: {
  leads: ClientConfig[];
  isOwner: boolean;
  hubspot: Record<string, HubspotStand>;
  sleep: number | null;
  setSleep: (id: number | null) => void;
  sleepVolgorde: (lijst: ClientConfig[], doelId: number) => Promise<void> | void;
  openDashboard: (c: ClientConfig) => void;
  setFase: (e: React.MouseEvent, c: ClientConfig, fase: string, vraag: string) => void;
  /** De lijst opnieuw laden nadat een bedrag is weggeschreven. */
  refresh: () => Promise<void> | void;
  melden: (m: { ok: boolean; text: string }) => void;
  /** Verhoogt een teller zodra er iets is bewaard, zodat de strook hertelt. */
  setHertel: React.Dispatch<React.SetStateAction<number>>;
}) {
  // Wat je per lead zelf invult en wat niet in de klantrij past: de kans dat het
  // doorgaat, de maand waarin hij naar verwachting start, en een eenmalig bedrag
  // (meestal een website). Alle drie staan ze in het dashboard en niet in
  // HubSpot, want daar werkt Maarten er niet mee. Ze staan hier in de lijst
  // omdat één rij per lead precies het moment is waarop je erover nadenkt.
  const [leadVeld, setLeadVeld] = useState<Record<string, LeadVeld>>({});
  // Wat er van elke lead al bewaard is. Een maandveld verandert al terwijl je
  // hem aan het kiezen bent, dus zonder dit zou elke klik in zo'n veld een keer
  // opslaan; nu gebeurt dat alleen als de waarde echt anders is.
  const bewaardVeld = useRef<Record<string, LeadVeld>>({});
  const zetLeadVeld = (slug: string, deel: Partial<LeadVeld>) =>
    setLeadVeld((v) => ({ ...v, [slug]: { ...LEEG_VELD, ...v[slug], ...deel } }));
  // Welke cel op dit moment wordt weggeschreven, zodat een rij niet twee keer
  // tegelijk opslaat en je ziet dat er iets gebeurt.
  const [celBezig, setCelBezig] = useState<string>("");

  // De extra regels onder een lead (een website, advertenties). Ze rekenen mee
  // in de prognose, dus na elke wijziging mag de maandstrook opnieuw tellen.
  const extra = useExtraRegels(isOwner, () => setHertel((n) => n + 1));

  // Sorteren op een kolom. Drie standen per kolom: oplopend, aflopend, en weer
  // je eigen volgorde (die je met slepen zet). Lege vakjes staan altijd
  // onderaan, in welke richting je ook sorteert; een lead zonder bedrag hoort
  // niet bovenaan te springen omdat nul het laagste getal is.
  const [sortKolom, setSortKolom] = useState<SortKolom>("");
  const [sortOp, setSortOp] = useState<"op" | "neer">("op");
  function klikSorteer(k: SortKolom) {
    if (sortKolom !== k) { setSortKolom(k); setSortOp("op"); }
    else if (sortOp === "op") setSortOp("neer");
    else setSortKolom("");
  }

  // Bedrijven die twee keer in de lijst staan: één keer met de hand, één keer
  // uit HubSpot. Zoeken gebeurt vanzelf; samenvoegen alleen op een knop.
  const [dubbel, setDubbel] = useState<DubbelPaar[]>([]);
  const [toonDubbel, setToonDubbel] = useState(false);
  const [voegBezig, setVoegBezig] = useState("");

  const laadDubbelen = useCallback(async () => {
    if (!isOwner) return;
    try {
      const d = await fetch("/api/admin/dubbelen").then((r) => r.json());
      if (d?.ok && Array.isArray(d.paren)) setDubbel(d.paren as DubbelPaar[]);
    } catch { /* stil: dan staat de balk er niet */ }
  }, [isOwner]);
  useEffect(() => { void laadDubbelen(); }, [laadDubbelen, leads.length]);

  async function voegSamen(p: DubbelPaar) {
    if (!window.confirm(
      `"${p.weg.naam}" opnemen in "${p.behoud.naam}"?\n\n`
      + `Alles van ${p.weg.naam} verhuist mee (dossier, documenten, mail, de HubSpot-koppeling). `
      + `Wat bij ${p.behoud.naam} al ingevuld staat blijft staan. Dit kun je niet terugdraaien.`,
    )) return;
    setVoegBezig(p.weg.slug);
    try {
      const d = await fetch("/api/admin/dubbelen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ behoud: p.behoud.slug, weg: p.weg.slug }),
      }).then((r) => r.json());
      if (d?.ok) { melden({ ok: true, text: d.melding }); await refresh(); await laadDubbelen(); setHertel((n) => n + 1); }
      else melden({ ok: false, text: d?.error || d?.melding || "Samenvoegen lukte niet." });
    } catch { melden({ ok: false, text: "Samenvoegen lukte niet." }); }
    finally { setVoegBezig(""); }
  }

  /**
   * Een veld dat in de klantrij zelf staat (het maandbedrag, de kosten, de
   * opvolgdatum). Gaat naar /api/admin/clients, want daar staan die velden; de
   * lijst wordt daarna opnieuw geladen zodat de optelling eronder klopt.
   */
  async function bewaarKlant(slug: string, veld: string, body: Record<string, unknown>) {
    setCelBezig(`${slug}:${veld}`);
    try {
      const d = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...body }),
      }).then((r) => r.json());
      if (!d?.ok) melden({ ok: false, text: d?.error || "Opslaan lukte niet." });
      else await refresh();
    } catch { melden({ ok: false, text: "Opslaan lukte niet." }); }
    finally { setCelBezig(""); }
  }

  /** Eén veld van één lead bewaren en de lijst daarna opnieuw laden. */
  async function bewaarLead(slug: string, veld: string, body: Record<string, unknown>) {
    setCelBezig(`${slug}:${veld}`);
    try {
      const d = await fetch(`/api/admin/lead-hubspot?slug=${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!d?.ok) melden({ ok: false, text: d?.error || "Opslaan lukte niet." });
      else if (veld === "budget") await refresh();
    } catch { melden({ ok: false, text: "Opslaan lukte niet." }); }
    finally { setCelBezig(""); }
  }

  // De kans, de startmaand en het eenmalige bedrag die je zelf hebt ingevuld.
  // Aparte, lichte route: alleen de regels, geen doorgerekende prognose.
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetch("/api/admin/prognose?regels=1").then((r) => r.json());
        if (!d?.ok || !alive || !d.regels) return;
        const rijen = d.regels as Record<string, { kans: number; startMaand: string | null; eenmaligOmzet: number; soort?: LeadVeld["soort"] }>;
        const map: Record<string, LeadVeld> = {};
        for (const [slug, r] of Object.entries(rijen)) {
          map[slug] = {
            kans: r?.kans === undefined || r?.kans === null ? "" : String(r.kans),
            maand: r?.startMaand || "",
            eenmalig: r?.eenmaligOmzet ? String(Math.round(r.eenmaligOmzet)) : "",
            soort: r?.soort || "seo",
          };
        }
        bewaardVeld.current = JSON.parse(JSON.stringify(map)) as Record<string, LeadVeld>;
        setLeadVeld(map);
      } catch { /* stil: dan blijven die kolommen leeg */ }
    })();
    return () => { alive = false; };
  }, [isOwner]);


  const kansVan = (slug: string) => {
    const t = (leadVeld[slug]?.kans ?? "").trim();
    const n = Number(t.replace(/[^\d]/g, ""));
    return t && Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : LEAD_STANDAARD_KANS;
  };
  const eenmaligVan = (slug: string) => {
    const n = Number(String(leadVeld[slug]?.eenmalig ?? "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const totalen = leads.reduce(
    (t, c) => {
      const w = kansVan(c.slug) / 100;
      // De rij zelf plus alles wat er onder hangt: anders klopt de optelling niet
      // meer zodra je een website of advertenties als eigen regel neerzet.
      const eigen = extra.perSlug(c.slug);
      const maand = Math.round(c.budget.maandbudget || 0) + eigen.reduce((n, r) => n + r.bedrag, 0);
      const kosten = Math.round(c.budget.linkbuilding || 0) + eigen.reduce((n, r) => n + r.kosten, 0);
      const eens = eenmaligVan(c.slug) + eigen.reduce((n, r) => n + r.eenmaligOmzet, 0);
      const gewogen = (basis: number, regelDeel: (r: typeof eigen[number]) => number) =>
        basis * w + eigen.reduce((n, r) => n + regelDeel(r) * ((r.kans === null ? kansVan(c.slug) : r.kans) / 100), 0);
      return {
        maand: t.maand + maand,
        maandGewogen: t.maandGewogen + gewogen(Math.round(c.budget.maandbudget || 0), (r) => r.bedrag),
        kosten: t.kosten + kosten,
        kostenGewogen: t.kostenGewogen + gewogen(Math.round(c.budget.linkbuilding || 0), (r) => r.kosten),
        eens: t.eens + eens,
        eensGewogen: t.eensGewogen + gewogen(eenmaligVan(c.slug), (r) => r.eenmaligOmzet),
      };
    },
    { maand: 0, maandGewogen: 0, kosten: 0, kostenGewogen: 0, eens: 0, eensGewogen: 0 },
  );
  const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

  // De lijst zoals hij op het scherm komt. Zonder sortering is dat je eigen
  // volgorde; met sortering staan lege vakjes onderaan.
  const sorteerWaarde = (c: ClientConfig, k: Exclude<SortKolom, "">): number | string | null => {
    if (k === "opvolgen") return hubspot[c.slug]?.opvolgDatum || c.opvolgDatum || null;
    if (k === "kans") return leadVeld[c.slug]?.kans ? Number(leadVeld[c.slug]?.kans) : null;
    if (k === "budget") return c.budget.maandbudget || null;
    if (k === "kosten") return c.budget.linkbuilding || null;
    if (k === "eenmalig") return eenmaligVan(c.slug) || null;
    return leadVeld[c.slug]?.maand || null;
  };
  const zichtbareLeads = !sortKolom ? leads : [...leads].sort((a, b) => {
    const va = sorteerWaarde(a, sortKolom);
    const vb = sorteerWaarde(b, sortKolom);
    // Leeg hoort altijd onderaan, in allebei de richtingen.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const richting = sortOp === "op" ? 1 : -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * richting;
    return String(va).localeCompare(String(vb), "nl") * richting;
  });

  const dubbelBalk = isOwner && dubbel.length > 0 && (
    <div className="lead-opruimbalk">
      <span>
        <strong>{dubbel.length} bedrijven</strong> staan er twee keer in: één keer zoals jij ze had staan en één keer
        zoals ze uit HubSpot kwamen. Samenvoegen houdt alles wat er staat.
      </span>
      <button type="button" className="btn btn-klein" onClick={() => setToonDubbel((v) => !v)}>
        {toonDubbel ? "Sluiten" : `Bekijk de ${dubbel.length}`}
      </button>
    </div>
  );

  const dubbelLijst = isOwner && toonDubbel && dubbel.length > 0 && (
    <div className="dubbel-lijst">
      {dubbel.map((p) => (
        <div key={p.weg.slug} className="dubbel-paar">
          <div className="dubbel-tekst">
            <strong>{p.behoud.naam}</strong> blijft staan
            {p.behoud.bedrag > 0 ? ` (${euro(p.behoud.bedrag)} p/m)` : ""},
            {" "}<strong>{p.weg.naam}</strong> gaat daarin op.
            <span className="muted"> Gevonden op: {p.waarom}.</span>
            {p.meeneemt.length > 0 && (
              <span className="muted"> Meeverhuist: {p.meeneemt.join(", ")}.</span>
            )}
          </div>
          <button type="button" className="btn btn-klein btn-primary" disabled={voegBezig === p.weg.slug}
            onClick={() => voegSamen(p)}>
            {voegBezig === p.weg.slug ? "Bezig…" : "Samenvoegen"}
          </button>
        </div>
      ))}
    </div>
  );

  const leadTable = (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr>
            {isOwner && <th></th>}<th>Bedrijf</th><th>Soort</th>
            {SORTEERBAAR.map((k) => (
              <th
                key={k.kolom}
                className={"kop-sorteer" + (sortKolom === k.kolom ? " kop-sorteer-aan" : "")}
                onClick={() => klikSorteer(k.kolom)}
                role="button"
                tabIndex={0}
                title={sortKolom === k.kolom
                  ? (sortOp === "op" ? "Nog een keer klikken: hoog naar laag" : "Nog een keer klikken: terug naar je eigen volgorde")
                  : `Sorteer op ${k.label.toLowerCase()}`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); klikSorteer(k.kolom); } }}
              >
                {k.label}
                {sortKolom === k.kolom && (
                  <span className="kop-pijl">{sortOp === "op" ? <Omhoog /> : <Omlaag />}</span>
                )}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={isOwner ? 10 : 9} style={{ textAlign: "center", padding: "var(--s-10)", color: "var(--gray)" }}>
              Nog geen leads. Maak er een aan met alleen een naam en een website.
            </td></tr>
          )}
          {zichtbareLeads.map((c) => (
            <Fragment key={c.slug}>
            <tr
              className={"clickable-row" + (sleep === c.id ? " tw-item-sleept" : "")}
              onClick={() => openDashboard(c)}
              title="Open de leadomgeving"
              onDragOver={isOwner && !sortKolom ? (e) => e.preventDefault() : undefined}
              onDrop={isOwner && !sortKolom ? (e) => { e.preventDefault(); void sleepVolgorde(leads, c.id); } : undefined}
            >
              {isOwner && (
                <td onClick={(e) => e.stopPropagation()}>
                  <span
                    className={"drag-handle tw-greep" + (sortKolom ? " tw-greep-uit" : "")}
                    draggable={!sortKolom}
                    onDragStart={() => setSleep(c.id)}
                    onDragEnd={() => setSleep(null)}
                    title={sortKolom ? "Zet de sortering uit om weer te kunnen slepen" : "Sleep om de volgorde te veranderen"}
                  >
                    ⠿
                  </span>
                </td>
              )}
              {/* De naam is de link naar hun eigen site; de rij eromheen opent de
                  leadomgeving. De losse kolom "Website" is daarmee weg
                  (20-08-2026): die stond twee keer hetzelfde te zeggen. */}
              <td>
                {c.domain ? (
                  <a href={`https://${c.domain}`} target="_blank" rel="noreferrer"
                    title={`Open ${c.domain}`} onClick={(e) => e.stopPropagation()}><strong>{c.name}</strong></a>
                ) : <strong>{c.name}</strong>}
                {/* Komt deze lead uit HubSpot, dan staat er (HS) achter met de
                    directe link naar dat contact. */}
                {hubspot[c.slug]?.hubspotUrl && (
                  <>
                    {" "}
                    <a className="hs-link" href={hubspot[c.slug]?.hubspotUrl} target="_blank" rel="noreferrer"
                      title="Open dit contact in HubSpot" onClick={(e) => e.stopPropagation()}>(HS)</a>
                  </>
                )}
                {" "}<span className="row-arrow"><PijlRechts /></span>
              </td>
              {/* De rij zelf is de SEO-fee; wil je er een website of Google Ads
                  bij, dan zet je daar met "+ regel" een eigen regel voor neer. */}
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <select
                    className="prog-veld regel-soort-veld"
                    aria-label={`Waar valt het maandbedrag van ${c.name} onder`}
                    value={leadVeld[c.slug]?.soort || "seo"}
                    onChange={(e) => {
                      const soort = e.target.value as LeadVeld["soort"];
                      zetLeadVeld(c.slug, { soort });
                      void bewaarLead(c.slug, "soort", { actie: "prognose", soort });
                    }}
                  >
                    {SOORT_KEUZE.map((s) => <option key={s.waarde} value={s.waarde}>{s.label}</option>)}
                  </select>
                ) : <span className="muted">{leadVeld[c.slug]?.soort || "seo"}</span>}
              </td>
              {/* Wanneer je hem weer moet spreken. Dat is het enige dat uit
                  HubSpot komt; de kolom die daar "zelf gemaakt" of de leadstatus
                  liet zien is eruit (20-08-2026), want die stond op elke rij
                  hetzelfde en zei dus niets. */}
              <td className={"lead-kolom-datum" + opvolgKlasse(hubspot[c.slug]?.opvolgDatum || c.opvolgDatum)}>
                {hubspot[c.slug]?.opvolgDatum ? (
                  <span title="Deze datum komt uit HubSpot">{dagKort(hubspot[c.slug]?.opvolgDatum)}</span>
                ) : isOwner ? (
                  <DatumVeld
                    waarde={c.opvolgDatum || ""}
                    label={`Wanneer spreek je ${c.name} weer`}
                    opslaan={(d) => bewaarKlant(c.slug, "opvolg", { action: "opvolgDatum", opvolgDatum: d })}
                  />
                ) : c.opvolgDatum ? dagKort(c.opvolgDatum) : <span className="muted">&mdash;</span>}
              </td>
              {/* Kans, maandbedrag, eenmalig bedrag en startmaand: alle vier van
                  jou, alle vier hier in te vullen. De rij zelf opent de
                  leadomgeving, dus elke klik in een veld moet daar stoppen. */}
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <span className="lead-kans-veld">
                    <input
                      className="prog-veld lead-veld-kans"
                      inputMode="numeric"
                      aria-label={`Hoe kansrijk is ${c.name}`}
                      value={leadVeld[c.slug]?.kans ?? ""}
                      placeholder={String(LEAD_STANDAARD_KANS)}
                      disabled={celBezig === `${c.slug}:kans`}
                      onChange={(e) => zetLeadVeld(c.slug, { kans: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                      onBlur={(e) => {
                        const n = Math.min(100, Math.max(0, Number(e.target.value.replace(/[^\d]/g, "")) || 0));
                        const tekst = e.target.value.trim() ? String(n) : "";
                        zetLeadVeld(c.slug, { kans: tekst });
                        if (tekst === "" || tekst === (bewaardVeld.current[c.slug]?.kans ?? "")) return;
                        bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], kans: tekst };
                        void bewaarLead(c.slug, "kans", { actie: "prognose", kans: n });
                      }}
                    />
                    <span className="lead-kans-teken">%</span>
                  </span>
                ) : <span className="muted">{leadVeld[c.slug]?.kans || LEAD_STANDAARD_KANS}%</span>}
              </td>
              <td>
                {isOwner ? (
                  <BedragVeld
                    waarde={c.budget.maandbudget}
                    label={`Beoogd maandbedrag van ${c.name}`}
                    opslaan={(n) => bewaarKlant(c.slug, "budget", { action: "setBedragen", maandbudget: n })}
                  />
                ) : c.budget.maandbudget
                  ? euro(c.budget.maandbudget)
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* De kosten die aan dit bedrijf vastzitten (linkbuilding, content,
                  een freelancer). Zelfde veld als in de prognose, dus wat je hier
                  typt telt daar meteen mee. */}
              <td>
                {isOwner ? (
                  <BedragVeld
                    waarde={c.budget.linkbuilding}
                    label={`Kosten per maand voor ${c.name}`}
                    opslaan={(n) => bewaarKlant(c.slug, "kosten", { action: "setBedragen", linkbuilding: n })}
                  />
                ) : c.budget.linkbuilding
                  ? euro(c.budget.linkbuilding)
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* Het eenmalige bedrag (meestal een website). Telt in de prognose
                  één keer mee, in de maand hiernaast. */}
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <input
                    className="prog-veld lead-veld-geld"
                    inputMode="numeric"
                    aria-label={`Eenmalig bedrag van ${c.name}`}
                    value={leadVeld[c.slug]?.eenmalig ?? ""}
                    placeholder="€"
                    disabled={celBezig === `${c.slug}:eenmalig`}
                    onChange={(e) => zetLeadVeld(c.slug, { eenmalig: e.target.value.replace(/[^\d]/g, "").slice(0, 7) })}
                    onBlur={(e) => {
                      const tekst = e.target.value.replace(/[^\d]/g, "");
                      if (tekst === (bewaardVeld.current[c.slug]?.eenmalig ?? "")) return;
                      bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], eenmalig: tekst };
                      void bewaarLead(c.slug, "eenmalig", { actie: "prognose", eenmalig: Number(tekst) || 0 });
                    }}
                  />
                ) : eenmaligVan(c.slug)
                  ? euro(eenmaligVan(c.slug))
                  : <span className="muted">&mdash;</span>}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <MaandVeld
                    waarde={leadVeld[c.slug]?.maand ?? ""}
                    label={`Vanaf welke maand telt ${c.name} mee`}
                    opslaan={(nieuw) => {
                      zetLeadVeld(c.slug, { maand: nieuw });
                      bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], maand: nieuw };
                      return bewaarLead(c.slug, "maand", { actie: "prognose", startMaand: nieuw });
                    }}
                  />
                ) : leadVeld[c.slug]?.maand
                  ? maandKort(leadVeld[c.slug]?.maand)
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* Één knop om hem weg te zetten, niet twee. "Niet doorgegaan" en
                  "Verwijder" deden voor Maarten hetzelfde; de eerste blijft, want
                  die is terug te draaien en houdt de mailwisseling en het dossier
                  staan. Echt weggooien staat nu in de leadomgeving zelf, onderaan
                  de leadkaart: zeldzaam en onomkeerbaar, dus een klik dieper. */}
              <td style={{ whiteSpace: "nowrap" }}>
                {isOwner ? (
                  <>
                    <button className="btn btn-klein" onClick={(e) => setFase(e, c, "klant", `${c.name} omzetten naar klant? Alles blijft staan; alleen het label verandert.`)}>Maak klant</button>{" "}
                    <button className="btn btn-klein" title="Nog een regel voor dit bedrijf: dezelfde rij, leeg, zodat je er de website of Google Ads van kunt maken"
                      onClick={(e) => { e.stopPropagation(); void extra.voegToe(c.slug); }}>+ regel</button>{" "}
                    <button className="lead-kruis" title="Niet doorgegaan" aria-label={`${c.name} op niet doorgegaan zetten`}
                      onClick={(e) => setFase(e, c, "verloren", `${c.name} op "niet doorgegaan" zetten? Je kunt dat later terugdraaien.`)}><Kruis /></button>
                  </>
                ) : <span className="muted">&mdash;</span>}
              </td>
            </tr>
            {/* De extra regels van deze lead: eigen naam, eigen bedrag, eigen
                kosten. Ze tellen mee met de kans van de lead erboven, tenzij je
                op de leadkaart een eigen kans zet. */}
            {extra.perSlug(c.slug).map((r) => (
              <tr key={`r-${r.id}`} className="regel-rij">
                {isOwner && <td></td>}
                <td><RegelNaam naam={c.name} domein={c.domain} hubspotUrl={hubspot[c.slug]?.hubspotUrl} /></td>
                <td><RegelSoortKeuze regel={r} bewaar={extra.bewaar} /></td>
                <td><RegelOpvolg regel={r} bewaar={extra.bewaar} /></td>
                <td><RegelKans regel={r} bewaar={extra.bewaar} /></td>
                <td><RegelBedrag regel={r} veld="bedrag" label={`Bedrag per maand van ${r.naam || "deze regel"}`} bewaar={extra.bewaar} /></td>
                <td><RegelBedrag regel={r} veld="kosten" label={`Kosten per maand van ${r.naam || "deze regel"}`} bewaar={extra.bewaar} /></td>
                <td><RegelBedrag regel={r} veld="eenmaligOmzet" label={`Eenmalig bedrag van ${r.naam || "deze regel"}`} bewaar={extra.bewaar} /></td>
                <td><RegelMaand regel={r} bewaar={extra.bewaar} /></td>
                <td><RegelWeg regel={r} verwijder={extra.verwijder} /></td>
              </tr>
            ))}
          </Fragment>
          ))}
        </tbody>
        {leads.length > 0 && (
          <tfoot>
            <tr className="lead-totaalrij">
              {isOwner && <td></td>}
              <td colSpan={3}>Alles bij elkaar</td>
              {/* Twee regels per bedrag: opgeteld boven, gewogen met de kans
                  eronder. Het woordje "gewogen" staat in de kanskolom en lijnt
                  rechts uit, precies zoals de bedragen ernaast. */}
              <td>
                <span className="lead-totaal-bedrag">&nbsp;</span>
                <span className="lead-totaal-bedrag lead-totaal-kans">gewogen</span>
              </td>
              <td>
                <span className="lead-totaal-bedrag">{euro(totalen.maand)}</span>
                <span className="lead-totaal-bedrag lead-totaal-gewogen">{euro(totalen.maandGewogen)}</span>
              </td>
              <td>
                <span className="lead-totaal-bedrag">{euro(totalen.kosten)}</span>
                <span className="lead-totaal-bedrag lead-totaal-gewogen">{euro(totalen.kostenGewogen)}</span>
              </td>
              <td>
                <span className="lead-totaal-bedrag">{euro(totalen.eens)}</span>
                <span className="lead-totaal-bedrag lead-totaal-gewogen">{euro(totalen.eensGewogen)}</span>
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  return (<>{dubbelBalk}{dubbelLijst}{leadTable}</>);
}

/**
 * De strook onder de leadlijst: wat wordt de omzet de komende maanden, van
 * klanten en leads bij elkaar. Eigen blok, want hij gaat niet alleen over leads.
 */
export function MaandStrook({ isOwner, hertel }: { isOwner: boolean; hertel: unknown }) {
  const [strip, setStrip] = useState<StripMaand[]>([]);
  const [opbouw, setOpbouw] = useState<StripOpbouw[]>([]);
  // Welke regel je hebt opengeklapt om te zien waar het bedrag uit bestaat.
  const [open, setOpen] = useState<"klant" | "lead" | "">("");
  const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

  // Ná de lijst opgehaald, zodat het scherm er nooit op wacht.
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetch("/api/admin/prognose?strip=6").then((r) => r.json());
        if (!d?.ok || !alive || !Array.isArray(d.maanden)) return;
        setStrip(d.maanden as StripMaand[]);
        setOpbouw(Array.isArray(d.opbouw) ? (d.opbouw as StripOpbouw[]) : []);
      } catch { /* stil: dan staat de strook er niet */ }
    })();
    return () => { alive = false; };
  }, [isOwner, hertel]);

  // ── De maandstrook: wat wordt de omzet de komende maanden ──
  // Klanten en leads bij elkaar, maand voor maand naast elkaar. De leads tellen
  // gewogen mee (bedrag maal kans), precies zoals in de prognose op
  // /admin/financien; dit is dezelfde berekening, alleen korter opgeschreven.
  const heeftPosten = strip.some((m) => m.postOmzet > 0);
  const heeftEenmalig = strip.some((m) => m.omzetEenmalig > 0);
  if (strip.length === 0) return null;
  return (
    <Vouwblok
      titel="Omzet per maand"
      icoon={<Munt />}
      standaardOpen
      sub={<a href="/admin/financien" onClick={(e) => e.stopPropagation()}>Hele prognose</a>}
    >
      <div className="task-table-wrap">
        <table className="maand-strook">
          <thead>
            <tr>
              <th>Waar het vandaan komt</th>
              {strip.map((m) => <th key={m.maand}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* Klik op een van deze twee regels en je ziet waar het bedrag uit
                bestaat: welke klant of lead, met welke kans, in welke maand.
                Dezelfde cijfers, alleen uitgeklapt. */}
            <tr className="strook-klapbaar" onClick={() => setOpen((v) => (v === "klant" ? "" : "klant"))}
              title="Klik om te zien welke klanten dit zijn">
              <td><span className="strook-caret">{open === "klant" ? <Omlaag /> : <Uitklap />}</span> Bestaande klanten</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.zekerOmzet)}</td>)}
            </tr>
            {open === "klant" && opbouw.filter((o) => o.soort === "klant").map((o) => (
              <tr key={o.slug} className="strook-opbouw">
                <td>{o.naam}</td>
                {o.bedragen.map((b, i) => <td key={i}>{euro(b)}</td>)}
              </tr>
            ))}
            <tr className="strook-klapbaar" onClick={() => setOpen((v) => (v === "lead" ? "" : "lead"))}
              title="Klik om te zien welke leads dit zijn en met welke kans ze meetellen">
              <td><span className="strook-caret">{open === "lead" ? <Omlaag /> : <Uitklap />}</span> Leads, gewogen met de kans</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.verwachtOmzet)}</td>)}
            </tr>
            {open === "lead" && opbouw.filter((o) => o.soort === "lead").map((o) => (
              <tr key={o.slug} className="strook-opbouw">
                <td>{o.naam} <span className="strook-kans">{o.kans}%</span></td>
                {o.bedragen.map((b, i) => <td key={i}>{euro(b)}</td>)}
              </tr>
            ))}
            {heeftPosten && (
              <tr>
                <td>Losse posten</td>
                {strip.map((m) => <td key={m.maand}>{euro(m.postOmzet)}</td>)}
              </tr>
            )}
            <tr className="maand-strook-totaal">
              <td>Totaal per maand</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.omzet)}</td>)}
            </tr>
            <tr className="maand-strook-uitsplitsing">
              <td>waarvan SEO</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.omzetSeo)}</td>)}
            </tr>
            <tr className="maand-strook-uitsplitsing">
              <td>waarvan advertenties</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.omzetAds)}</td>)}
            </tr>
            {strip.some((m) => m.omzetOverig + m.postOmzet > 0) && (
              <tr className="maand-strook-uitsplitsing">
                <td>waarvan overig</td>
                {strip.map((m) => <td key={m.maand}>{euro(m.omzetOverig + m.postOmzet)}</td>)}
              </tr>
            )}
            {heeftEenmalig && (
              <tr className="maand-strook-uitsplitsing">
                <td>waarvan eenmalig</td>
                {strip.map((m) => <td key={m.maand}>{euro(m.omzetEenmalig)}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Vouwblok>
  );
}

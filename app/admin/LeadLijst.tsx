"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ClientConfig } from "../../lib/clients";
import { LEAD_STANDAARD_KANS } from "../../lib/prognose-kans";
import Vouwblok from "./Vouwblok";
import { Kruis, Munt, PijlRechts, Vlag } from "../_ui/Pijl";
import { BedragVeld, DatumVeld } from "./RijVeld";

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
  omzet: number; omzetSeo: number; omzetAds: number; omzetEenmalig: number;
};

/** De drie dingen die je per lead in de lijst zelf invult, als tekst in beeld. */
type LeadVeld = { kans: string; maand: string; eenmalig: string };
const LEEG_VELD: LeadVeld = { kans: "", maand: "", eenmalig: "" };

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
  leads, isOwner, hubspot, sleep, setSleep, sleepVolgorde, openDashboard, setFase, refresh, melden,
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
        const rijen = d.regels as Record<string, { kans: number; startMaand: string | null; eenmaligOmzet: number }>;
        const map: Record<string, LeadVeld> = {};
        for (const [slug, r] of Object.entries(rijen)) {
          map[slug] = {
            kans: r?.kans === undefined || r?.kans === null ? "" : String(r.kans),
            maand: r?.startMaand || "",
            eenmalig: r?.eenmaligOmzet ? String(Math.round(r.eenmaligOmzet)) : "",
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
      const maand = Math.round(c.budget.maandbudget || 0);
      const kosten = Math.round(c.budget.linkbuilding || 0);
      const eens = eenmaligVan(c.slug);
      const w = kansVan(c.slug) / 100;
      return {
        maand: t.maand + maand, maandGewogen: t.maandGewogen + maand * w,
        kosten: t.kosten + kosten, kostenGewogen: t.kostenGewogen + kosten * w,
        eens: t.eens + eens, eensGewogen: t.eensGewogen + eens * w,
      };
    },
    { maand: 0, maandGewogen: 0, kosten: 0, kostenGewogen: 0, eens: 0, eensGewogen: 0 },
  );
  const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

  const leadTable = (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr>
            {isOwner && <th></th>}<th>Bedrijf</th>
            <th>Opvolgen</th><th>Kans</th><th>Budget p/m</th><th>Kosten p/m</th><th>Eenmalig</th><th>Verwacht klant</th><th></th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={isOwner ? 9 : 8} style={{ textAlign: "center", padding: "var(--s-10)", color: "var(--gray)" }}>
              Nog geen leads. Maak er een aan met alleen een naam en een website.
            </td></tr>
          )}
          {leads.map((c) => (
            <tr
              key={c.slug}
              className={"clickable-row" + (sleep === c.id ? " tw-item-sleept" : "")}
              onClick={() => openDashboard(c)}
              title="Open de leadomgeving"
              onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
              onDrop={isOwner ? (e) => { e.preventDefault(); void sleepVolgorde(leads, c.id); } : undefined}
            >
              {isOwner && (
                <td onClick={(e) => e.stopPropagation()}>
                  <span
                    className="drag-handle tw-greep"
                    draggable
                    onDragStart={() => setSleep(c.id)}
                    onDragEnd={() => setSleep(null)}
                    title="Sleep om de volgorde te veranderen"
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
                {" "}<span className="row-arrow"><PijlRechts /></span>
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
                  <input
                    className="prog-veld lead-veld-maand"
                    type="month"
                    aria-label={`Vanaf welke maand telt ${c.name} mee`}
                    value={leadVeld[c.slug]?.maand ?? ""}
                    disabled={celBezig === `${c.slug}:maand`}
                    onChange={(e) => zetLeadVeld(c.slug, { maand: e.target.value })}
                    onBlur={(e) => {
                      const nieuw = e.target.value || "";
                      if (nieuw === (bewaardVeld.current[c.slug]?.maand ?? "")) return;
                      bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], maand: nieuw };
                      void bewaarLead(c.slug, "maand", { actie: "prognose", startMaand: nieuw });
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
                    <button className="lead-kruis" title="Niet doorgegaan" aria-label={`${c.name} op niet doorgegaan zetten`}
                      onClick={(e) => setFase(e, c, "verloren", `${c.name} op "niet doorgegaan" zetten? Je kunt dat later terugdraaien.`)}><Kruis /></button>
                  </>
                ) : <span className="muted">&mdash;</span>}
              </td>
            </tr>
          ))}
        </tbody>
        {leads.length > 0 && (
          <tfoot>
            <tr className="lead-totaalrij">
              {isOwner && <td></td>}
              <td colSpan={2}>Alles bij elkaar</td>
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

  return leadTable;
}

/**
 * De strook onder de leadlijst: wat wordt de omzet de komende maanden, van
 * klanten en leads bij elkaar. Eigen blok, want hij gaat niet alleen over leads.
 */
export function MaandStrook({ isOwner, hertel }: { isOwner: boolean; hertel: unknown }) {
  const [strip, setStrip] = useState<StripMaand[]>([]);
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
            <tr>
              <td>Bestaande klanten</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.zekerOmzet)}</td>)}
            </tr>
            <tr>
              <td>Leads, gewogen met de kans</td>
              {strip.map((m) => <td key={m.maand}>{euro(m.verwachtOmzet)}</td>)}
            </tr>
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

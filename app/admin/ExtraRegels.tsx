"use client";

import { useCallback, useEffect, useState } from "react";
import { BedragVeld, DatumVeld, KansVeld, MaandVeld, opvolgKlasse } from "./RijVeld";
import { Kruis } from "../_ui/Pijl";

// ═══════════════════════════════════════════════════════════
// EXTRA REGELS ONDER EEN KLANT OF LEAD
// ═══════════════════════════════════════════════════════════
// Bij één bedrijf loopt vaak meer dan één ding: de SEO per maand, een website
// die eenmalig gebouwd wordt, advertenties met een eigen fee. Eén rij kon dat
// niet dragen, dus kan elk bedrijf er regels bij krijgen. Ze staan ingesprongen
// onder hun bedrijf, ze rekenen mee in de prognose (lib/klant-regels.ts), en ze
// gebruiken exact dezelfde invulvakjes als de rij erboven.
//
// Het ophalen en bewaren staat hier één keer, zodat de leadlijst en de
// klantenlijst niet allebei hun eigen versie krijgen die daarna uit elkaar
// loopt.
// ═══════════════════════════════════════════════════════════

export type ExtraRegel = {
  id: number;
  clientSlug: string;
  naam: string;
  soort: "seo" | "ads" | "website" | "overig";
  bedrag: number;
  kosten: number;
  eenmaligOmzet: number;
  eenmaligKosten: number;
  startMaand: string | null;
  kans: number | null;
  opvolgDatum: string | null;
};

const SOORTEN: { waarde: ExtraRegel["soort"]; label: string }[] = [
  { waarde: "seo", label: "SEO" },
  { waarde: "ads", label: "Ads" },
  { waarde: "website", label: "Website" },
  { waarde: "overig", label: "Overig" },
];

/** Alle extra regels, per bedrijf, met het bewaren erbij. */
export function useExtraRegels(actief: boolean, naWijziging?: () => void) {
  const [regels, setRegels] = useState<ExtraRegel[]>([]);

  const laad = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/klant-regels").then((r) => r.json());
      if (d?.ok && Array.isArray(d.regels)) setRegels(d.regels as ExtraRegel[]);
    } catch { /* stil: dan staan er geen extra regels */ }
  }, []);

  useEffect(() => { if (actief) void laad(); }, [actief, laad]);

  const perSlug = (slug: string) => regels.filter((r) => r.clientSlug === slug);

  /**
   * Een regel erbij: dezelfde rij als erboven (zelfde bedrijf, zelfde link,
   * dezelfde kolommen), maar leeg. Je vult zelf in waar hij over gaat en wat
   * hij oplevert; de ene regel wordt zo de SEO en de andere de website.
   * Bewust géén bedragen kopiëren: dan zou alles twee keer meetellen tot je het
   * zelf hebt rechtgezet, en dat is precies het soort fout dat klopt lijkt.
   */
  async function voegToe(slug: string) {
    await fetch("/api/admin/klant-regels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, naam: "", soort: "overig" }),
    }).catch(() => null);
    await laad();
    naWijziging?.();
  }

  async function bewaar(id: number, deel: Partial<ExtraRegel>) {
    setRegels((rs) => rs.map((r) => (r.id === id ? { ...r, ...deel } : r)));
    await fetch("/api/admin/klant-regels", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...deel }),
    }).catch(() => null);
    naWijziging?.();
  }

  async function verwijder(id: number, naam: string) {
    if (!window.confirm(`De regel "${naam || "zonder naam"}" verwijderen?`)) return;
    await fetch(`/api/admin/klant-regels?id=${id}`, { method: "DELETE" }).catch(() => null);
    await laad();
    naWijziging?.();
  }

  return { regels, perSlug, voegToe, bewaar, verwijder, herlaad: laad };
}

/**
 * De bedrijfsnaam van de regel erboven, met dezelfde link naar hun site. Een
 * extra regel is een kopie van die rij, dus hij hoort er ook zo uit te zien;
 * waar de regel over gaat lees je in de kolom Soort ernaast.
 */
export function RegelNaam({ naam, domein, hubspotUrl }: { naam: string; domein?: string | null; hubspotUrl?: string | null }) {
  return (
    <span className="regel-naam">
      <span className="regel-tak" aria-hidden="true" />
      {domein ? (
        <a href={`https://${domein}`} target="_blank" rel="noreferrer"
          title={`Open ${domein}`} onClick={(e) => e.stopPropagation()}><strong>{naam}</strong></a>
      ) : <strong>{naam}</strong>}
      {hubspotUrl && (
        <>
          {" "}
          <a className="hs-link" href={hubspotUrl} target="_blank" rel="noreferrer"
            title="Open dit contact in HubSpot" onClick={(e) => e.stopPropagation()}>(HS)</a>
        </>
      )}
    </span>
  );
}

/** SEO, advertenties, website of overig. Stuurt de uitsplitsing in de strook. */
export function RegelSoortKeuze({ regel, bewaar }: { regel: ExtraRegel; bewaar: (id: number, d: Partial<ExtraRegel>) => void }) {
  return (
    <select
      className="prog-veld regel-soort-veld"
      value={regel.soort}
      aria-label="Waar valt dit onder"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => bewaar(regel.id, { soort: e.target.value as ExtraRegel["soort"] })}
    >
      {SOORTEN.map((s) => <option key={s.waarde} value={s.waarde}>{s.label}</option>)}
    </select>
  );
}

/** Vanaf welke maand deze regel meetelt (en wanneer het eenmalige bedrag valt). */
export function RegelMaand({ regel, bewaar }: { regel: ExtraRegel; bewaar: (id: number, d: Partial<ExtraRegel>) => void }) {
  return (
    <MaandVeld
      waarde={regel.startMaand || ""}
      label="Vanaf welke maand telt deze regel mee"
      opslaan={(nieuw) => bewaar(regel.id, { startMaand: nieuw || null })}
    />
  );
}

/** De kans van deze regel. Leeg = dezelfde kans als het bedrijf erboven. */
export function RegelKans({ regel, bewaar }: { regel: ExtraRegel; bewaar: (id: number, d: Partial<ExtraRegel>) => void }) {
  return (
    <KansVeld
      waarde={regel.kans}
      label="Hoe kansrijk is deze regel"
      opslaan={(n) => bewaar(regel.id, { kans: n })}
    />
  );
}

/**
 * Wanneer je hierover weer contact hebt.
 *
 * Standaard staat hier de datum van de regel erboven, en die blijft meelopen:
 * verandert de afspraak in HubSpot, dan verandert deze mee. Dat is precies wat
 * je wilt bij een website of advertenties die bij hetzelfde gesprek horen; je
 * plant daar geen tweede belletje voor (21-08-2026). Zet je hier zelf een
 * datum, dan is die van jou en loopt hij niet meer mee; maak je hem weer leeg,
 * dan volgt hij de rij erboven opnieuw.
 */
export function RegelOpvolg({ regel, erf, bewaar }: {
  regel: ExtraRegel;
  /** De opvolgdatum van het bedrijf erboven, als die er is. */
  erf?: string | null;
  bewaar: (id: number, d: Partial<ExtraRegel>) => void;
}) {
  const eigen = regel.opvolgDatum || "";
  const getoond = eigen || erf || "";
  return (
    <DatumVeld
      waarde={getoond}
      label={eigen
        ? "Wanneer spreek je ze hierover weer"
        : "Loopt mee met de datum van de rij erboven. Zet hier een eigen datum als het anders is."}
      merk={(eigen ? "" : " regel-datum-erf") + opvolgKlasse(getoond)}
      opslaan={(nieuw) => bewaar(regel.id, { opvolgDatum: nieuw || null })}
    />
  );
}

/** Het bedrag- en kostenvakje van een extra regel: exact het vakje erboven. */
export function RegelBedrag({ regel, veld, label, bewaar }: {
  regel: ExtraRegel;
  veld: "bedrag" | "kosten" | "eenmaligOmzet" | "eenmaligKosten";
  label: string;
  bewaar: (id: number, d: Partial<ExtraRegel>) => void;
}) {
  return (
    <BedragVeld
      waarde={regel[veld]}
      label={label}
      opslaan={(n) => bewaar(regel.id, { [veld]: n } as Partial<ExtraRegel>)}
    />
  );
}

/** Het kruisje waarmee een extra regel weggaat. */
export function RegelWeg({ regel, verwijder }: { regel: ExtraRegel; verwijder: (id: number, naam: string) => void }) {
  return (
    <button className="lead-kruis" title="Deze regel verwijderen"
      aria-label={`Regel ${regel.naam || "zonder naam"} verwijderen`}
      onClick={(e) => { e.stopPropagation(); verwijder(regel.id, regel.naam); }}><Kruis /></button>
  );
}

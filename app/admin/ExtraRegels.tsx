"use client";

import { useCallback, useEffect, useState } from "react";
import { BedragVeld } from "./RijVeld";
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
};

const SOORTEN: { waarde: ExtraRegel["soort"]; label: string }[] = [
  { waarde: "seo", label: "SEO" },
  { waarde: "ads", label: "Advertenties" },
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
   * Een regel erbij. Wat je meegeeft is de rij waar je op stond, dus de nieuwe
   * regel is een kopie: zelfde bedrag, zelfde kosten, zelfde eenmalige bedrag,
   * zelfde startmaand. Daarna pas je er één van aan tot het klopt, bijvoorbeeld
   * de ene regel op de website en de andere op de SEO.
   */
  async function voegToe(slug: string, kopie: Partial<ExtraRegel> = {}) {
    await fetch("/api/admin/klant-regels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, naam: "", soort: "overig", ...kopie }),
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

/** Waar deze regel over gaat, in de kolom onder de bedrijfsnaam. */
export function RegelNaam({ regel, bewaar }: { regel: ExtraRegel; bewaar: (id: number, d: Partial<ExtraRegel>) => void }) {
  return (
    <span className="regel-naam">
      <span className="regel-tak" aria-hidden="true" />
      <input
        className="prog-veld regel-naam-veld"
        defaultValue={regel.naam}
        placeholder="Waarvoor is dit?"
        aria-label="Naam van deze regel"
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => { if (e.target.value !== regel.naam) bewaar(regel.id, { naam: e.target.value }); }}
      />
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
    <input
      className="prog-veld lead-veld-maand"
      type="month"
      aria-label="Vanaf welke maand telt deze regel mee"
      defaultValue={regel.startMaand || ""}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const nieuw = e.target.value || "";
        if (nieuw === (regel.startMaand || "")) return;
        bewaar(regel.id, { startMaand: nieuw || null });
      }}
    />
  );
}

/** Het bedrag- en kostenvakje van een extra regel: exact het vakje erboven. */
export function RegelBedrag({ regel, veld, label, bewaar }: {
  regel: ExtraRegel;
  veld: "bedrag" | "kosten" | "eenmaligOmzet";
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

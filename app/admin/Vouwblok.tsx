"use client";

import { useState, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════
// EEN BLOK OP HET BEHEERSCHERM: DICHT, MET DE KNOP IN DE KOPBALK
// ═══════════════════════════════════════════════════════════
// Het klantenoverzicht was één lange rol: twee volledige tabellen, daaronder
// drie kaarten die allemaal hun uitleg lieten zien. Je scrolde langs alles heen
// om bij het ene ding te komen dat je nodig had.
//
// Vandaar dit blok. Het gebruikt de inklapkaart die de cockpit al overal heeft
// (`strategy-card` plus `strategy-head`), zodat hier geen tweede soort kopbalk
// ontstaat, en het voegt er één ding aan toe: een plek rechts in diezelfde balk
// voor de knop die bij dit blok hoort ("+ Nieuwe lead", "+ Nieuwe klant"). Die
// knop stond eerst los onder de tabel, waar hij pas in beeld kwam na alle rijen.
//
// Standaard dicht. Wil je hem open hebben zodra het scherm laadt (een blok dat
// een waarschuwing kan bevatten bijvoorbeeld), geef dan `standaardOpen` mee.
// ═══════════════════════════════════════════════════════════

export default function Vouwblok({
  titel, aantal, sub, actie, standaardOpen = false, children,
}: {
  titel: string;
  aantal?: number;
  sub?: ReactNode;
  // De knop mag zelf het blok openzetten: "+ Nieuwe lead" hoort het formulier te
  // tonen, en dat kan niet in een blok dat dicht blijft. Geef daarom een functie
  // mee die het openzetten als argument krijgt.
  actie?: ReactNode | ((openen: () => void) => ReactNode);
  standaardOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(standaardOpen);
  const actieNode = typeof actie === "function" ? actie(() => setOpen(true)) : actie;
  return (
    <div className="cockpit-card strategy-card vouwblok">
      <button type="button" className="strategy-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="strategy-caret">{open ? "▾" : "▸"}</span>
        <span className="strategy-title">{titel}{aantal === undefined ? "" : ` (${aantal})`}</span>
        {sub && <span className="strategy-sub">{sub}</span>}
      </button>
      {actieNode && <div className="vouwblok-actie">{actieNode}</div>}
      {open && <div className="strategy-body">{children}</div>}
    </div>
  );
}

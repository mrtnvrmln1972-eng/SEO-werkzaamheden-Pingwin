"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════
// EEN VAKJE IN EEN LIJSTRIJ WAAR JE DIRECT IN TYPT
// ═══════════════════════════════════════════════════════════
// De leadlijst en de klantenlijst vullen allebei bedragen en datums in de rij
// zelf in. Dat is één soort veld, dus staat het hier één keer: hetzelfde
// uiterlijk (het invulveld uit de prognose, `.prog-veld`), dezelfde breedte,
// dezelfde manier van opslaan (pas bij verlaten, en alleen als de waarde echt
// veranderd is).
//
// Waarom de klik gestopt wordt: een rij in die lijsten is zelf aanklikbaar en
// opent de klant- of leadomgeving. Zonder dat stoppen zou typen in een vakje de
// pagina wegklikken.
// ═══════════════════════════════════════════════════════════

/** Een bedrag in hele euro's. Leeg blijft leeg; een euroteken staat als hint. */
export function BedragVeld({
  waarde, label, breed = "geld", opslaan,
}: {
  waarde: number;
  label: string;
  breed?: "geld" | "kans";
  opslaan: (nieuw: number) => Promise<unknown> | void;
}) {
  const [bezig, setBezig] = useState(false);
  return (
    <input
      className={`prog-veld lead-veld-${breed}`}
      inputMode="numeric"
      aria-label={label}
      title={label}
      defaultValue={waarde ? String(Math.round(waarde)) : ""}
      placeholder={breed === "kans" ? "" : "€"}
      disabled={bezig}
      onClick={(e) => e.stopPropagation()}
      onBlur={async (e) => {
        const nieuw = Math.max(0, Math.round(Number(e.target.value.replace(/[^\d]/g, "")) || 0));
        if (nieuw === Math.round(waarde || 0)) return;
        setBezig(true);
        try { await opslaan(nieuw); } finally { setBezig(false); }
      }}
    />
  );
}

/** Een datum (JJJJ-MM-DD). Alleen opslaan als hij echt anders is. */
export function DatumVeld({
  waarde, label, opslaan,
}: {
  waarde: string;
  label: string;
  opslaan: (nieuw: string) => Promise<unknown> | void;
}) {
  const [tekst, setTekst] = useState(waarde);
  const [bewaard, setBewaard] = useState(waarde);
  const [bezig, setBezig] = useState(false);
  return (
    <input
      className="prog-veld lead-veld-datum"
      type="date"
      aria-label={label}
      title={label}
      value={tekst}
      disabled={bezig}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTekst(e.target.value)}
      onBlur={async (e) => {
        const nieuw = e.target.value || "";
        if (nieuw === bewaard) return;
        setBezig(true);
        try { await opslaan(nieuw); setBewaard(nieuw); } finally { setBezig(false); }
      }}
    />
  );
}

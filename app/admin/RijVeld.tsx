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

/**
 * De maand waarin iets start, als keuzelijst. Bewust géén `input type="month"`:
 * daarin moet je het jaartal met de hand omhoog klikken en dat vond niemand
 * (20-08-2026: "ik wil hier ook maanden van volgend jaar kunnen selecteren").
 * Deze lijst loopt van een half jaar terug tot twee jaar vooruit, en een waarde
 * die daarbuiten valt wordt er gewoon bij gezet.
 */
export function MaandVeld({
  waarde, label, opslaan,
}: {
  waarde: string;
  label: string;
  opslaan: (nieuw: string) => Promise<unknown> | void;
}) {
  const [bezig, setBezig] = useState(false);
  const maanden = maandenLijst(waarde);
  return (
    <select
      className="prog-veld lead-veld-maand"
      aria-label={label}
      title={label}
      value={waarde}
      disabled={bezig}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const nieuw = e.target.value;
        if (nieuw === waarde) return;
        setBezig(true);
        try { await opslaan(nieuw); } finally { setBezig(false); }
      }}
    >
      <option value="">nog niet bekend</option>
      {maanden.map((m) => <option key={m} value={m}>{maandLabel(m)}</option>)}
    </select>
  );
}

const MAAND_NAAM = ["januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december"];

function maandLabel(m: string): string {
  const [j, mm] = m.split("-");
  return `${MAAND_NAAM[Number(mm) - 1] || mm} ${j}`;
}

/** Een half jaar terug tot twee jaar vooruit, plus de waarde die er al stond. */
function maandenLijst(huidig: string): string[] {
  const nu = new Date();
  const lijst: string[] = [];
  for (let i = -6; i <= 24; i++) {
    const d = new Date(nu.getFullYear(), nu.getMonth() + i, 1);
    lijst.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  if (huidig && !lijst.includes(huidig)) lijst.push(huidig);
  return lijst.sort();
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

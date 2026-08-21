"use client";

import { useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════
// EEN VAKJE IN EEN LIJSTRIJ WAAR JE DIRECT IN TYPT
// ═══════════════════════════════════════════════════════════
// De leadlijst en de klantenlijst vullen allebei bedragen en datums in de rij
// zelf in. Dat is één soort veld, dus staat het hier één keer: hetzelfde
// uiterlijk (het invulveld uit de prognose, `.prog-veld`), dezelfde breedte,
// dezelfde manier van opslaan.
//
// Sinds 21-08-2026 bewaart elk vakje zichzelf: kort nadat je stopt met typen,
// en meteen als je het vakje verlaat of een datum of maand kiest. Daarvoor
// gebeurde dat alleen bij verlaten, en dan is "even een bedrag bijwerken en
// doorklikken" precies de handeling die niets opslaat.
//
// Waarom de klik gestopt wordt: een rij in die lijsten opent de klant- of
// leadomgeving. Zonder dat stoppen zou typen in een vakje de pagina wegklikken.
// ═══════════════════════════════════════════════════════════

/** Hoe lang een vakje wacht tot je uitgetypt bent voor het zichzelf bewaart. */
const ZELF_BEWAREN_MS = 700;

/**
 * De motor onder elk vakje dat zichzelf bewaart. Hij houdt bij wat er in beeld
 * staat, bewaart kort nadat je stopt met typen (`straks`) of meteen (`nu`), en
 * volgt een waarde die buiten dit vakje om verandert, bijvoorbeeld doordat de
 * lijst opnieuw is geladen. Wat jij zojuist zelf hebt weggeschreven telt niet
 * als "van buiten": anders springt je eigen invoer terug op het moment dat het
 * antwoord van de server binnenkomt.
 */
function useZelfBewaren(vanBuiten: string, bewaarWaarde: (tekst: string) => void) {
  const [tekst, setTekst] = useState(vanBuiten);
  const bewaard = useRef(vanBuiten);
  const klok = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (vanBuiten === bewaard.current) return;
    bewaard.current = vanBuiten;
    setTekst(vanBuiten);
  }, [vanBuiten]);

  useEffect(() => () => { if (klok.current) clearTimeout(klok.current); }, []);

  /** Nu bewaren, en wat er in beeld staat gelijktrekken met wat er weggaat. */
  const nu = (waarde: string) => {
    if (klok.current) { clearTimeout(klok.current); klok.current = null; }
    setTekst(waarde);
    if (waarde === bewaard.current) return;
    bewaard.current = waarde;
    bewaarWaarde(waarde);
  };

  /** Straks bewaren: zodra je even niets meer typt. */
  const straks = (waarde: string) => {
    setTekst(waarde);
    if (klok.current) clearTimeout(klok.current);
    klok.current = setTimeout(() => nu(waarde), ZELF_BEWAREN_MS);
  };

  return { tekst, nu, straks };
}

/** Een bedrag in hele euro's. Leeg blijft leeg; een euroteken staat als hint. */
export function BedragVeld({
  waarde, label, breed = "geld", opslaan,
}: {
  waarde: number;
  label: string;
  breed?: "geld" | "kans";
  opslaan: (nieuw: number) => Promise<unknown> | void;
}) {
  const rond = Math.round(waarde || 0);
  const { tekst, nu, straks } = useZelfBewaren(
    rond ? String(rond) : "",
    (t) => { void opslaan(Math.max(0, Number(t) || 0)); },
  );
  return (
    <input
      className={`prog-veld lead-veld-${breed}`}
      inputMode="numeric"
      aria-label={label}
      title={label}
      value={tekst}
      placeholder={breed === "kans" ? "" : "€"}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => straks(schoonGetal(e.target.value, 9))}
      onBlur={(e) => nu(schoonGetal(e.target.value, 9))}
    />
  );
}

/**
 * Hoe kansrijk iets is, in procenten. Leeg mag: bij een lead betekent dat de
 * standaardkans, bij een extra regel de kans van het bedrijf erboven.
 */
export function KansVeld({
  waarde, label, plaatshouder = "", opslaan,
}: {
  waarde: number | null;
  label: string;
  plaatshouder?: string;
  opslaan: (nieuw: number | null) => Promise<unknown> | void;
}) {
  const { tekst, nu, straks } = useZelfBewaren(
    waarde === null ? "" : String(waarde),
    (t) => { void opslaan(t === "" ? null : Number(t)); },
  );
  /** Boven de honderd bestaat niet; wat je typt wordt teruggezet op 100. */
  const binnenBereik = (ruw: string) => {
    const t = schoonGetal(ruw, 3);
    return t === "" ? "" : String(Math.min(100, Number(t)));
  };
  return (
    <span className="lead-kans-veld">
      <input
        className="prog-veld lead-veld-kans"
        inputMode="numeric"
        aria-label={label}
        title={label}
        value={tekst}
        placeholder={plaatshouder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => straks(schoonGetal(e.target.value, 3))}
        onBlur={(e) => nu(binnenBereik(e.target.value))}
      />
      <span className="lead-kans-teken">%</span>
    </span>
  );
}

/** Alleen cijfers, en niet meer dan er in het vakje past. */
function schoonGetal(ruw: string, tekens: number): string {
  return ruw.replace(/[^\d]/g, "").slice(0, tekens);
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
  const maanden = maandenLijst(waarde);
  return (
    <select
      className="prog-veld lead-veld-maand"
      aria-label={label}
      title={label}
      value={waarde}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const nieuw = e.target.value;
        if (nieuw === waarde) return;
        void opslaan(nieuw);
      }}
    >
      <option value="">{MAAND_ONBEKEND}</option>
      {maanden.map((m) => <option key={m} value={m}>{maandLabel(m)}</option>)}
    </select>
  );
}

/** Nog geen maand gekozen. Kort, want het staat in een smalle kolom. */
export const MAAND_ONBEKEND = "N.B.";

const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sept", "okt", "nov", "dec"];

/**
 * Een maand kort in beeld: "sept '26". De volle naam plus het jaartal
 * ("september 2026") maakte deze kolom twee keer zo breed als de rest en dat
 * duwde de bedragen weg (21-08-2026).
 */
export function maandLabel(m: string | null | undefined): string {
  if (!m) return "";
  const [j, mm] = m.split("-");
  const naam = MAAND_KORT[Number(mm) - 1];
  if (!naam || !j) return m;
  return `${naam} '${j.slice(2)}`;
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

/**
 * Een datum (JJJJ-MM-DD) die je zelf zet. In beeld staat hij in dezelfde vorm
 * als een datum die je alleen leest ("28 jul"), met er direct naast het
 * kalendertje waarmee je hem verandert. Het volle invulvak toonde
 * "07/28/2026" plus een icoontje, was dertien tekens breed, en duwde daarmee
 * de bedrijfsnaam in de kolom ernaast op twee regels (21-08-2026).
 *
 * Het is nog steeds gewoon een datumvakje van de browser: de tekst ervan staat
 * uit in de opmaak en alleen het kalendertje blijft staan. Zo hoeft er geen
 * eigen kalender nagebouwd te worden, en werkt kiezen met de muis én met het
 * toetsenbord precies zoals overal.
 */
export function DatumVeld({
  waarde, label, merk = "", opslaan,
}: {
  waarde: string;
  label: string;
  /** Extra klassen, bijvoorbeeld de kleur van een verstreken afspraak. */
  merk?: string;
  opslaan: (nieuw: string) => Promise<unknown> | void;
}) {
  const { tekst, nu } = useZelfBewaren(waarde, (t) => { void opslaan(t); });
  return (
    <span className={`lead-datum lead-datum-kies${merk}`} title={label}>
      <span className="lead-datum-tekst">{tekst ? dagKort(tekst) : "—"}</span>
      <input
        className="lead-datum-prikker"
        type="date"
        aria-label={label}
        value={tekst}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => nu(e.target.value || "")}
      />
    </span>
  );
}

/** Een datum kort en leesbaar: "3 sep". Leeg blijft leeg. */
export function dagKort(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
}

/**
 * Is dit contactmoment geweest, vandaag, of nog niet? Bepaalt hoe de datum
 * eruitziet. Een verstreken afspraak krijgt een zacht oranje vlakje, niet een
 * harde rode regel: je moet hem zien, maar de lijst is geen alarmscherm
 * (21-08-2026, op verzoek van Maarten).
 */
export function opvolgKlasse(datum: string | null | undefined): string {
  if (!datum) return "";
  const vandaag = new Date().toISOString().slice(0, 10);
  if (datum < vandaag) return " lead-datum-verstreken";
  if (datum === vandaag) return " lead-datum-vandaag";
  return "";
}

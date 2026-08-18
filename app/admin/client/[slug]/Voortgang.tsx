"use client";

import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// HET VOORTGANGSRONDJE: ÉÉN VORM VOOR ALLES WAT DRAAIT
// ═══════════════════════════════════════════════════════════
// Overal waar iets op de achtergrond loopt staat dit onderdeel, zodat "er
// gebeurt iets" er altijd hetzelfde uitziet en altijd hetzelfde betekent.
//
// Drie dingen die het bewust wél doet:
//
//  - HET RONDJE LOOPT ECHT VOL als het aantal stappen bekend is. Weet de motor
//    niet hoeveel stappen er zijn, dan draait het rondje rond in plaats van een
//    verzonnen percentage te tonen. Een balk die op 90% blijft hangen is een
//    leugen; een draaiend rondje is eerlijk.
//  - ER STAAT ALTIJD BIJ WAT HIJ DOET. Een molentje zonder tekst is niet te
//    onderscheiden van vastgelopen; dat was precies de klacht bij de
//    opruimanalyse die veertig minuten "bezig" stond.
//  - DE LOOPTIJD TELT ZICHTBAAR OP, en na een kwartier zonder teken van leven
//    zegt hij dat hij waarschijnlijk vastligt, met de knop om te hervatten
//    ernaast (als het scherm er een meegeeft). Zwijgen is hier het ergste.
// ═══════════════════════════════════════════════════════════

export type VoortgangProps = {
  /** Wat er draait, kort: "De site inlezen". */
  titel: string;
  /** Wat er nú gebeurt: "Ronde 3 van 8: de opruimkandidaten nalopen". */
  label?: string;
  /** Bij welke stap, en hoeveel het er zijn. 0 stappen = onbekend, dan draait hij rond. */
  stap?: number;
  stappen?: number;
  /** Wanneer hij begon (ISO), voor de meelopende looptijd. */
  sinds?: string | null;
  /** Vastgelopen: geen teken van leven meer. */
  stil?: boolean;
  /** Knop rechts, bijvoorbeeld "Nu hervatten". */
  actie?: { label: string; onClick: () => void; bezig?: boolean };
  /** Compacte variant voor in een regel of een kaartkop. */
  klein?: boolean;
};

function looptijd(sinds: string | null | undefined, nu: number): string {
  if (!sinds) return "";
  const sec = Math.max(0, Math.round((nu - new Date(sinds).getTime()) / 1000));
  if (sec < 60) return `loopt ${sec} seconden`;
  const min = Math.round(sec / 60);
  if (min < 60) return `loopt ${min} ${min === 1 ? "minuut" : "minuten"}`;
  const uur = Math.floor(min / 60);
  return `loopt ${uur} uur en ${min % 60} minuten`;
}

export default function Voortgang({ titel, label, stap = 0, stappen = 0, sinds, stil, actie, klein }: VoortgangProps) {
  // Eén tik per seconde, alleen voor de looptijd; de stand zelf komt van de server.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    if (!sinds) return;
    const t = setInterval(() => setNu(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sinds]);

  const bekend = stappen > 0;
  // Nooit helemaal vol tonen zolang hij nog draait: dan lijkt hij klaar terwijl
  // de laatste stap nog moet gebeuren.
  const deel = bekend ? Math.min(0.97, Math.max(0.02, stap / stappen)) : 0;
  const straal = klein ? 9 : 13;
  const omtrek = 2 * Math.PI * straal;
  const maat = (straal + 3) * 2;

  return (
    <div className={"vg" + (klein ? " vg-klein" : "") + (stil ? " vg-stil" : "")} role="status" aria-live="polite">
      <span className={"vg-ring" + (bekend ? "" : " vg-rond")} aria-hidden="true">
        <svg viewBox={`0 0 ${maat} ${maat}`} width={maat} height={maat}>
          <circle className="vg-baan" cx={maat / 2} cy={maat / 2} r={straal} fill="none" strokeWidth="3" />
          <circle
            className="vg-vul" cx={maat / 2} cy={maat / 2} r={straal} fill="none" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={bekend ? `${omtrek * deel} ${omtrek}` : `${omtrek * 0.25} ${omtrek}`}
            transform={`rotate(-90 ${maat / 2} ${maat / 2})`}
          />
        </svg>
      </span>

      <div className="vg-tekst">
        <div className="vg-kop">
          <strong>{titel}</strong>
          {bekend && <span className="vg-teller">stap {Math.max(1, stap)} van {stappen}</span>}
        </div>
        {label && <p className="vg-label">{label}</p>}
        <p className="vg-meta">
          {stil
            ? "Er is al een kwartier geen teken van leven. Waarschijnlijk is hij vastgelopen; opnieuw starten pakt de draad op waar hij was."
            : [looptijd(sinds, nu), "je kunt dit scherm sluiten, het werk draait door"].filter(Boolean).join(", ")}
        </p>
      </div>

      {actie && (
        <button type="button" className="btn btn-klein vg-knop" onClick={actie.onClick} disabled={actie.bezig}>
          {actie.bezig ? "Bezig…" : actie.label}
        </button>
      )}
    </div>
  );
}

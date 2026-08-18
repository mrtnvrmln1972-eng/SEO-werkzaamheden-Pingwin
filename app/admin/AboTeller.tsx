"use client";

// ═══════════════════════════════════════════════════════════
// DE DERDE TELLER: JE EIGEN CLAUDE-ABONNEMENT
// ═══════════════════════════════════════════════════════════
// Naast Ahrefs en Claude-via-het-dashboard is er een derde meter: chatten en het
// werk in Claude Code, dus ook deze sessie. Die stond eerst als een blok ín de
// Claude-teller, maar dat vermengde twee dingen die niets met elkaar te maken
// hebben: wat het DASHBOARD verstookt (een cijfer, elke aanroep gemeten) en wat
// het ABONNEMENT verstookt (geen cijfer, want dat saldo is op een persoonlijk
// abonnement niet op te halen). Vandaar een eigen teller, met een eigen naam.
//
// Geen fetch hier: er is niets te meten, dus geen API-route en geen useEffect.
// Statische uitleg, twee knoppen naar claude.ai, en de tips.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { SEIN_KLEUR } from "../../lib/sein";
import { ABO_TIPS } from "../../lib/verbruik-tips";

export default function AboTeller() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="hm-wrap at-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"btn btn-klein at-knop" + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        title="Je Claude-abonnement: chatten en Claude Code. Saldo niet op te halen, wel te bekijken."
        onClick={() => setOpen((v) => !v)}
      >
        <span className="at-stip" style={{ background: SEIN_KLEUR.onbekend }} aria-hidden="true" />
        Abo
        <svg className="hm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="hm-paneel at-paneel" role="dialog" aria-label="Je Claude-abonnement">
          <div className="at-kop">
            <div className="at-label">Je Claude-abonnement</div>
            <div className="at-groot-leeg">niet op te halen</div>
            <div className="at-zinnen">
              <span className="at-kern">Chatten op claude.ai en het werk in Claude Code, dus ook deze sessie.</span>
              <span className="at-bij">Dat staat los van wat het dashboard hiernaast verstookt.</span>
            </div>
          </div>

          <div className="ct-abo">
            <p className="ct-abo-tekst">
              Is de limiet van je abonnement op, dan werkt Claude door op je <strong>usage credits</strong>,
              tegen de normale API-tarieven. Die koop je vooruit, dus er komt geen losse factuur achteraf:
              het gaat van het tegoed af dat er al staat. Staat automatisch bijvullen aan, dan wordt er wél
              opnieuw afgeschreven zodra dat tegoed laag wordt.
            </p>
            <p className="ct-abo-tekst">
              Het saldo zelf kan dit dashboard niet ophalen; op een persoonlijk abonnement is daar geen
              koppeling voor. Eén klik hieronder brengt je op de plek waar het wél staat.
            </p>
            <div className="ct-knoppen">
              <a className="btn ct-btn" href="https://claude.ai/settings/usage" target="_blank" rel="noreferrer">
                Bekijk je tegoed
              </a>
              <a className="btn ct-btn" href="https://claude.ai/settings/billing" target="_blank" rel="noreferrer">
                Bijvullen instellen
              </a>
            </div>
          </div>

          <div className="at-tips">
            <div className="at-tips-kop">Zo houd je dit strak</div>
            <ul className="at-tip-lijst">
              {ABO_TIPS.map((t) => (
                <li className="at-tip" key={t.kop}>
                  <span className="at-tip-kop">{t.kop}</span>
                  <span className="at-tip-tekst">{t.tekst}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

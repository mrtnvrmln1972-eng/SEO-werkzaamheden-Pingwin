"use client";

// ═══════════════════════════════════════════════════════════
// HET AHREFS-TELLERTJE IN DE KOPBALK
// ═══════════════════════════════════════════════════════════
// Ahrefs werkt met een tegoed aan units per abonnementsmaand. Elke analyse in dit
// dashboard eet daarvan. Raakt het op, dan stopt de data en staan de motoren stil,
// en dat merkte je pas als je het al nodig had: het cijfer stond alleen op het
// verbruikscherm, en daar kwam niemand uit zichzelf.
//
// Vandaar dit tellertje: het staat op élk beheerscherm, het is klein genoeg om te
// negeren zolang er niets aan de hand is, en het kleurt op zodra dat wel zo is.
//
// Twee keuzes die het verschil maken tussen een cijfer en een signaal:
//  - Het toont geen kaal percentage maar een oordeel, want 80% op is prima aan het
//    eind van de maand en alarmerend aan het begin. Het rekenwerk daarvoor staat
//    in lib/ahrefs-teller.ts.
//  - Opengeklapt zet het het hele Ahrefs-account naast wat dít dashboard verbruikte.
//    Loopt de teller vol terwijl het dashboard bijna niets deed, dan zit iemand in
//    Ahrefs zelf te werken en heeft afremmen hier geen zin.
//
// Het haalt zijn gegevens zelf op bij /api/admin/ahrefs-teller, net als het
// Intern-menu ernaast: de kopbalken zijn per scherm met de hand geschreven, dus zo
// hoeft geen enkele pagina er gegevens voor door te geven. Geen recht of geen
// Ahrefs-koppeling betekent dat er niets getekend wordt.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { SEIN_KLEUR, type TellerStand } from "../../lib/ahrefs-teller";

type Data = {
  stand: TellerStand | null;
  abonnement: string | null;
  usedKey: number | null;
  eigen: { units: number; calls: number; topKlant: { slug: string | null; units: number } | null } | null;
};

function num(n: number): string {
  return n.toLocaleString("nl-NL");
}

export default function AhrefsTeller() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let levend = true;
    fetch("/api/admin/ahrefs-teller")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (levend && j?.ok && j.stand) setData(j as Data); })
      .catch(() => {});
    return () => { levend = false; };
  }, []);

  // Zelfde sluitgedrag als de andere kopbalkmenu's: Escape of een klik ernaast.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const stand = data?.stand;
  if (!stand || stand.used === null) return null;

  const pct = stand.deel === null ? null : Math.round(stand.deel * 100);
  const kleur = SEIN_KLEUR[stand.sein];

  return (
    <div className="hm-wrap at-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"logout-btn at-knop" + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        title={`Ahrefs-tegoed. ${stand.oordeel}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="at-stip" style={{ background: kleur }} aria-hidden="true" />
        Ahrefs
        <span className="at-cijfer" style={{ color: kleur }}>{pct === null ? num(stand.used) : `${pct}%`}</span>
        <svg className="hm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="hm-paneel at-paneel" role="dialog" aria-label="Ahrefs-tegoed">
          <div className="at-kop">
            <div className="at-label">Ahrefs-tegoed deze maand</div>
            <div className="at-groot" style={{ color: kleur }}>
              {num(stand.used)}{stand.limit !== null && <span className="at-van"> van {num(stand.limit)} units</span>}
            </div>
            {stand.deel !== null && (
              <div className="at-balk" role="img" aria-label={`${pct} procent van het tegoed is op`}>
                <span className="at-balk-vul" style={{ width: `${Math.max(2, pct ?? 0)}%`, background: kleur }} />
              </div>
            )}
            <div className="at-oordeel">{stand.oordeel}</div>
          </div>

          {/* Wat is óns aandeel. Zonder deze regels is een oplopende teller een
              raadsel: het dashboard en Maarten in Ahrefs zelf tellen op dezelfde
              teller, en alleen afremmen helpt als wij de oorzaak zijn. */}
          <div className="at-regels">
            {data?.usedKey !== null && data?.usedKey !== undefined && (
              <div className="at-regel">
                <span className="at-regel-naam">Via dit dashboard</span>
                <span className="at-regel-waarde">{num(data.usedKey)} units deze maand</span>
              </div>
            )}
            {data?.eigen && (
              <div className="at-regel">
                <span className="at-regel-naam">Laatste 7 dagen</span>
                <span className="at-regel-waarde">{num(data.eigen.units)} units in {num(data.eigen.calls)} aanroepen</span>
              </div>
            )}
            {data?.eigen?.topKlant?.slug && (
              <div className="at-regel">
                <span className="at-regel-naam">Meeste verbruik</span>
                <span className="at-regel-waarde">{data.eigen.topKlant.slug} ({num(data.eigen.topKlant.units)} units)</span>
              </div>
            )}
            {stand.prognose !== null && (
              <div className="at-regel">
                <span className="at-regel-naam">Op dit tempo</span>
                <span className="at-regel-waarde">{num(stand.prognose)} units aan het eind van de maand</span>
              </div>
            )}
          </div>

          <div className="at-voet">
            Herhaalde vragen komen uit onze eigen cache en kosten niets. Het tegoed hierboven is dat
            van het hele Ahrefs-account, dus werk je zelf in Ahrefs, dan telt dat mee.
          </div>

          <a className="hm-item" href="/admin/usage">
            <span className="hm-item-label">Naar het verbruik</span>
            <span className="hm-item-hint">Uitgesplitst per klant en per functie, samen met de AI-kosten.</span>
          </a>
        </div>
      )}
    </div>
  );
}

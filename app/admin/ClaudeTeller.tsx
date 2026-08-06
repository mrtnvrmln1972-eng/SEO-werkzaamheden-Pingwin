"use client";

// ═══════════════════════════════════════════════════════════
// HET CLAUDE-TELLERTJE IN DE KOPBALK
// ═══════════════════════════════════════════════════════════
// Naast het Ahrefs-tegoed loopt er een tweede meter mee: de AI-kosten. Die stonden
// alleen op het verbruikscherm, en daar kwam niemand uit zichzelf. Het verschil met
// Ahrefs is dat er hier geen tegoed is dat opraakt; de rekening loopt gewoon door.
// De vraag is dus niet "hoeveel is er nog" maar "loopt het uit de pas", en dat is
// precies wat het tellertje zegt (het rekenwerk staat in lib/claude-teller.ts).
//
// De tweede helft van dit paneel is minstens zo belangrijk, want zonder die helft
// wijst het cijfer de verkeerde kant op. Er zijn namelijk twee losse meters:
//  - Het DASHBOARD werkt met een eigen API-sleutel. Dat is het bedrag hierboven en
//    dat kunnen we tot op de knop nauwkeurig meten, want elke aanroep schrijft zijn
//    tokens weg.
//  - CHATTEN en CLAUDE CODE lopen op het abonnement, met usage credits zodra de
//    limiet van dat abonnement op is. Daar is geen koppeling voor: Anthropic biedt
//    geen manier om dat saldo op te halen buiten Team- en Enterprise-accounts om.
//    Dus geen gefingeerd cijfer, maar de uitleg plus één knop naar de plek waar het
//    saldo écht staat.
//
// Achter dezelfde poort als het verbruikscherm: kosten zijn voor de eigenaar. Geen
// recht betekent een foutcode en dan tekent dit niets.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { SEIN_KLEUR } from "../../lib/sein";
import { usd, type ClaudeStand } from "../../lib/claude-teller";

type Data = {
  stand: ClaudeStand | null;
  maand: { calls: number; topActie: { label: string; usd: number } | null; topKlant: { slug: string | null; usd: number } | null } | null;
  week: { usd: number; calls: number } | null;
};

export default function ClaudeTeller() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let levend = true;
    fetch("/api/admin/claude-teller")
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
  if (!stand) return null;

  const kleur = SEIN_KLEUR[stand.sein];
  const pct = stand.deel === null ? null : Math.round(stand.deel * 100);

  return (
    <div className="hm-wrap at-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"logout-btn at-knop" + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        title={`AI-kosten van het dashboard. ${stand.oordeel}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="at-stip" style={{ background: kleur }} aria-hidden="true" />
        Claude
        <span className="at-cijfer" style={{ color: kleur }}>{pct === null ? usd(stand.maandUsd) : `${pct}%`}</span>
        <svg className="hm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="hm-paneel at-paneel" role="dialog" aria-label="AI-kosten">
          {/* Blok 1: wat het dashboard zelf verstookt. Eén groot bedrag, en de
              boodschap in korte regels onder elkaar in plaats van als één lange
              zin: achter elkaar wordt dat in een smal paneel een tekstmuur. */}
          <div className="at-kop">
            <div className="at-label">AI-kosten deze maand</div>
            <div className="at-groot" style={{ color: kleur }}>
              {usd(stand.maandUsd)}
              {stand.budgetUsd !== null && <span className="at-van">van {usd(stand.budgetUsd)}</span>}
            </div>
            {stand.deel !== null && (
              <div className="at-meter">
                <span className="at-balk" role="img" aria-label={`${pct} procent van het maandbudget is op`}>
                  <span className="at-balk-vul" style={{ width: `${Math.max(2, pct ?? 0)}%`, background: kleur }} />
                </span>
                <span className="at-pct" style={{ color: kleur }}>{pct}%</span>
              </div>
            )}
            <div className="at-zinnen">
              <span className="at-kern">{stand.kern}</span>
              {stand.bij.map((regel) => <span className="at-bij" key={regel}>{regel}.</span>)}
            </div>
          </div>

          {/* Blok 2: waar het bedrag vandaan komt. Een oplopend bedrag zonder
              deze regels is geen signaal maar een raadsel. */}
          {(data?.week || data?.maand?.topActie || data?.maand?.topKlant?.slug) && (
            <div className="at-blok">
              <div className="at-blok-kop">Waar het aan opgaat</div>
              {data?.week && (
                <div className="at-regel">
                  <span className="at-regel-naam">Laatste 7 dagen</span>
                  <span className="at-regel-waarde">{usd(data.week.usd)}</span>
                </div>
              )}
              {data?.maand?.topActie && (
                <div className="at-regel">
                  <span className="at-regel-naam">{data.maand.topActie.label}</span>
                  <span className="at-regel-waarde">{usd(data.maand.topActie.usd)}</span>
                </div>
              )}
              {data?.maand?.topKlant?.slug && (
                <div className="at-regel">
                  <span className="at-regel-naam">{data.maand.topKlant.slug}</span>
                  <span className="at-regel-waarde">{usd(data.maand.topKlant.usd)}</span>
                </div>
              )}
            </div>
          )}

          {/* Blok 3: de tweede meter. Zonder dit blok leest het bedrag hierboven
              als "wat Claude mij kost", en dat is het niet: chatten en bouwen
              lopen op het abonnement en staan op een andere rekening. */}
          <div className="ct-abo">
            <div className="ct-abo-kop">Je abonnement, een aparte meter</div>
            <p className="ct-abo-tekst">
              Chatten en het werk in Claude Code lopen op je Claude-abonnement, niet op de sleutel
              van dit dashboard. Die kosten staan hierboven dus niet in.
            </p>
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
                Extra verbruik instellen
              </a>
            </div>
          </div>

          {/* Twee ingangen in plaats van één: de cijfers, en de regels om ze omlaag
              te krijgen. Die tips stonden er wel, maar niemand vond ze omdat er
              alleen een link naar "het verbruik" hing. */}
          <a className="hm-item at-link" href="/admin/usage#tips">
            <span className="hm-item-label">Zo houd je het strak</span>
            <span className="hm-item-hint">De tips per meter: welke knop duur is en waar afremmen echt helpt.</span>
          </a>
          <a className="hm-item" href="/admin/usage">
            <span className="hm-item-label">Naar het verbruik</span>
            <span className="hm-item-hint">Per klant en per functie, samen met het Ahrefs-verbruik.</span>
          </a>
        </div>
      )}
    </div>
  );
}

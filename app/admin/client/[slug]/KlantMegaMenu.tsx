"use client";

// ═══════════════════════════════════════════════════════════
// HET MEGA MENU VAN EEN KLANT
// ═══════════════════════════════════════════════════════════
// Eén knop opent alles wat er over deze klant te vinden is, gegroepeerd naar de
// vraag die elk scherm beantwoordt, met de regel uitleg er zichtbaar bij. Dat
// laatste is het halve punt: die uitleg bestond al bij elk tabblad, maar stond
// als tooltip verstopt achter stilhangen met je muis.
//
// Wat dit vervangt: twee losse uitklapmenu's ("Site-breed" en "Klant") met een
// kaal lijstje erin. Het menu "Klant" bundelde bovendien twee verschillende
// vragen door elkaar, namelijk wie de klant is én wat wij voor hem geleverd
// hebben. Die twee staan nu als eigen kolom naast elkaar.
//
// De indeling zelf staat in KlantTabs.tsx (MEGA_GROEPEN), samen met de balk, dus
// een label of uitleg kan hier nooit iets anders zeggen dan daar.
//
// Bediening bewust gelijk aan het oude uitklapmenu, want dat gedrag was goed:
// elk item is een echte link (cmd- of middelklik opent een nieuw tabblad), het
// menu sluit met Escape, met een klik erbuiten of na een keuze, en het klapt
// nooit dicht doordat je de muis erlangs beweegt.

import { useEffect, useRef, useState } from "react";
import { MEGA_GROEPEN, type Tab } from "./KlantTabs";

export default function KlantMegaMenu({ label, active, hrefFor, onPick }: {
  label: string;
  /** Welk tabblad open staat. Op een los scherm (de planning) is dat er geen. */
  active?: Tab;
  hrefFor: (id: Tab) => string;
  /** Alleen in de cockpit: wisselen zonder de pagina te herladen. */
  onPick?: (id: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const knopRef = useRef<HTMLButtonElement>(null);

  // Staat er een scherm uit dit menu open, dan licht de knop op. Zo zie je aan de
  // balk nog steeds waar je bent, ook als het menu dicht is.
  const bevat = MEGA_GROEPEN.some((g) => g.items.some((it) => it.id === active));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // De focus terug naar de knop, anders staat hij nergens en werkt Tab raar.
      knopRef.current?.focus();
    };
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

  return (
    <div className="kmm-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={knopRef}
        className={"tab kmm-knop" + (bevat ? " active" : "") + (open ? " kmm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg className="kmm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="kmm-paneel" role="menu" aria-label={label}>
          {MEGA_GROEPEN.map((groep) => (
            <div className="kmm-kolom" key={groep.vraag}>
              {/* De kop is de vraag zelf, niet een categorienaam. Zo lees je in het
                  menu meteen waaróm een scherm daar staat. */}
              <div className="kmm-kolom-kop">{groep.vraag}</div>
              {groep.items.map((it) => (
                <a
                  key={it.id}
                  role="menuitem"
                  href={hrefFor(it.id)}
                  className={"kmm-item" + (it.id === active ? " kmm-item-actief" : "")}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                    setOpen(false);
                    // Zonder onPick is dit een gewone link: niets tegenhouden,
                    // anders klik je en gebeurt er helemaal niets.
                    if (!onPick) return;
                    e.preventDefault();
                    onPick(it.id);
                  }}
                >
                  <span className="kmm-item-label">{it.label}</span>
                  <span className="kmm-item-hint">{it.hint}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

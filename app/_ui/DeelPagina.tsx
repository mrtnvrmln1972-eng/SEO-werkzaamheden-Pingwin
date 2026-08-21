"use client";

// ═══════════════════════════════════════════════════════════
// HET KADER VAN ELKE GEDEELDE PAGINA
// ═══════════════════════════════════════════════════════════
// Wat iemand ziet die een deel-link opent: het merk, waar het over gaat, de
// inhoud, en een afsluitende regel. Eén kader voor alle deelbare schermen, zodat
// het opruimrapport en de sitemap-check er hetzelfde uitzien en een verbetering
// aan het ene meteen ook voor het andere geldt.
//
// Er staat met opzet GEEN navigatie in. Wie deze link krijgt, hoort dit ene stuk
// te zien en verder niets van het dashboard; een menu of een logo dat naar de
// voorpagina linkt zou precies dat weggeven.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from "react";

export function DeelLeeg({ children }: { children: ReactNode }) {
  return <div className="deel-leeg">{children}</div>;
}

export default function DeelPagina({ titel, onderschrift, children, voet, bodyClass }: {
  titel: string;
  /** Om wie en om welke stand het gaat: de klantnaam en de datum van de controle. */
  onderschrift?: string;
  children: ReactNode;
  voet?: string;
  /** Extra klasse op het inhoudsblok, voor een rapport dat zijn eigen kaarten meebrengt. */
  bodyClass?: string;
}) {
  return (
    <div className="deel-pagina">
      <header className="deel-kop">
        <div className="deel-merk">Pingwin</div>
        <h1>{titel}</h1>
        {onderschrift && <p>{onderschrift}</p>}
      </header>
      <div className={(bodyClass ? bodyClass + " " : "") + "deel-body"}>
        {children}
        <p className="deel-voet">{voet || "Opgesteld door Pingwin Online Marketing. Vragen hierover? Stel ze gerust."}</p>
      </div>
    </div>
  );
}

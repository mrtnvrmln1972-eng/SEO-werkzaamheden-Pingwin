"use client";

// ═══════════════════════════════════════════════════════════
// DE TELLERS RECHTSBOVEN, ALS ÉÉN BLOKJE
// ═══════════════════════════════════════════════════════════
// Er hangen drie meters in de kopbalk (Ahrefs, Claude via het dashboard, en het
// eigen abonnement) en er komen er misschien meer. De kopbalk staat op zeven plekken: vijf schermen
// tekenen hem nog zelf, plus AdminKop en het weekbord. Zou elke plek de tellers
// los opsommen, dan hangt een derde teller straks op vier van de zeven schermen
// en op de andere drie niet, en dat merkt niemand.
//
// Dus: één blokje. Wie er een teller bij bouwt, zet hem hier neer en hij staat
// meteen overal.
// ═══════════════════════════════════════════════════════════

import AhrefsTeller from "./AhrefsTeller";
import ClaudeTeller from "./ClaudeTeller";
import AboTeller from "./AboTeller";

export default function Tellers() {
  return (
    <>
      <AhrefsTeller />
      <ClaudeTeller />
      <AboTeller />
    </>
  );
}

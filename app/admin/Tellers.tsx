"use client";

// ═══════════════════════════════════════════════════════════
// DE TELLERS RECHTSBOVEN, ALS ÉÉN BLOKJE
// ═══════════════════════════════════════════════════════════
// Er hangen twee meters in de kopbalk (het Ahrefs-tegoed en de AI-kosten) en er
// komen er waarschijnlijk meer. De kopbalk staat op zeven plekken: vijf schermen
// tekenen hem nog zelf, plus AdminKop en het weekbord. Zou elke plek de tellers
// los opsommen, dan hangt een derde teller straks op vier van de zeven schermen
// en op de andere drie niet, en dat merkt niemand.
//
// Dus: één blokje. Wie er een teller bij bouwt, zet hem hier neer en hij staat
// meteen overal.
// ═══════════════════════════════════════════════════════════

import AhrefsTeller from "./AhrefsTeller";
import ClaudeTeller from "./ClaudeTeller";

export default function Tellers() {
  return (
    <>
      <AhrefsTeller />
      <ClaudeTeller />
    </>
  );
}

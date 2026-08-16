"use client";

// Oefenpagina voor het opmaakbare tekstveld. ALLEEN tijdens ontwikkelen.
//
// Waarom deze bestaat: `proeven/rijk-tekst.proef.ts` trekt de vórm na (wat mag
// waar staan, en herstelt het zonder inhoud te verliezen), maar hij kan geen
// toets indrukken en geen blok verslepen. Juist daar zat de ellende: Chrome doet
// bij "voeg een uitklapper in" iets heel anders dan je zou denken, en dat zie je
// alleen in een echte browser. Deze pagina plus `scripts/veld-browsertest.mjs`
// heeft op 16-08-2026 drie fouten gevonden die op papier niet te zien waren:
// vinkpunten die in omgekeerde volgorde uit een lijst kwamen, een alinea die bij
// het invoegen doormidden werd geknipt (met een stuk vetgedrukte rommel als
// restant), en een voorbeeldtekst waar je vóór typte in plaats van overheen.
//
// Draaien: `npm run dev` in het ene venster, `npm run veldproef` in het andere.
//
// In productie bestaat deze pagina niet; hij valt daar terug op "niet gevonden".

import { notFound } from "next/navigation";
import { useState } from "react";
import RijkTekstVeld from "../_velden/RijkTekstVeld";

const START = `<p>begin</p><ol><li>Lokale pagina's uitwerken</li><li>Belangrijke navigatie</li></ol>`;

export default function ProefVeld() {
  const [html, setHtml] = useState(START);
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="pg-wrap" style={{ maxWidth: "var(--breed-smal, 640px)", padding: "var(--s-8)" }}>
      <RijkTekstVeld waarde={html} onChange={setHtml} />
      {/* De opgeslagen HTML, zodat de browsertest kan nakijken wat er écht staat. */}
      <pre id="uit" style={{ fontSize: "var(--fs-xs)", whiteSpace: "pre-wrap" }}>{html}</pre>
    </div>
  );
}

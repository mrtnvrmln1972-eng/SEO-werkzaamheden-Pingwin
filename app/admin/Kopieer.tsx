"use client";

import { useState } from "react";

// Kopieerknop met een korte bevestiging. Zonder die bevestiging weet je niet of je
// geraakt hebt, en dan plak je een lege regel in je nieuwe chat.
//
// Stond eerst als lokale functie in RoutekaartClient. Hij wordt nu ook gebruikt in
// het ontwikkelmenu in de kopbalk, en twee kopieën van dezelfde knop lopen uit
// elkaar; vandaar één bestand.
export default function Kopieer({
  tekst, label, primair = false, klein = false,
}: {
  tekst: string;
  label: string;
  primair?: boolean;
  klein?: boolean;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={"btn" + (primair ? " btn-primary" : "") + (klein ? " btn-klein" : "")}
      onClick={() => {
        void navigator.clipboard.writeText(tekst).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        });
      }}
    >
      {ok ? "Gekopieerd ✓" : label}
    </button>
  );
}

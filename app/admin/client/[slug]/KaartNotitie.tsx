"use client";

// Je eigen aantekeningen bij een taak.
//
// De kaarttekst erboven is geschreven door de assistent en wordt bij elke
// samenvoeging opnieuw bijgewerkt. Dit veld niet: wat je hier typt blijft staan,
// geen enkele automatische stap raakt het aan. Daarom staat het er ook los onder
// en niet ergens tussen de gegenereerde tekst.
//
// Zelfde veld als bij Zoekwoorden & links, zodat vet, bullets en plakken overal
// hetzelfde werken (app/_velden/RijkTekstVeld.tsx).

import { useRef, useState, type ReactNode } from "react";
import RijkTekstVeld from "../../../_velden/RijkTekstVeld";

export default function KaartNotitie({ slug, id, start, toolbarExtra }: { slug: string; id: number; start: string; toolbarExtra?: ReactNode }) {
  const [waarde, setWaarde] = useState(start);
  const [stand, setStand] = useState<"" | "bezig" | "bewaard" | "fout">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatst = useRef(start);

  // Tijdens het typen niet bij elke toets opslaan, maar wel vanzelf: je hoeft
  // nergens op te klikken en je raakt niets kwijt als je de kaart dichtklapt.
  function bewaarStraks(html: string) {
    setWaarde(html);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void bewaar(html), 900);
  }

  async function bewaar(html: string) {
    if (html === laatst.current) return;
    setStand("bezig");
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, notitie: html }),
      }).then((r) => r.json());
      if (d?.ok) { laatst.current = html; setStand("bewaard"); setTimeout(() => setStand(""), 1500); }
      else setStand("fout");
    } catch { setStand("fout"); }
  }

  return (
    <div className="wp-notitie">
      <RijkTekstVeld
        waarde={waarde}
        onChange={bewaarStraks}
        onKlaar={() => void bewaar(waarde)}
        klasse="wp-notitie-veld"
        placeholder="Wat je zelf wilt onthouden bij deze taak: afspraken, aandachtspunten, wat de klant zei."
        compact
        toolbarExtra={toolbarExtra}
        toolbarLabel={
          <>
            Aantekeningen
            {stand === "bezig" && <span className="muted">bewaren…</span>}
            {stand === "bewaard" && <span className="wp-notitie-ok">bewaard</span>}
            {stand === "fout" && <span className="wp-notitie-fout">bewaren mislukte</span>}
          </>
        }
      />
    </div>
  );
}

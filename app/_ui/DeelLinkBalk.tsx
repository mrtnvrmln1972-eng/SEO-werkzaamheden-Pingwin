"use client";

// ═══════════════════════════════════════════════════════════
// DE DEELBALK: ÉÉN LINK MAKEN, KOPIËREN, INTREKKEN
// ═══════════════════════════════════════════════════════════
// Elk scherm dat deelbaar wordt, krijgt dit balkje. Bewust één bouwsteen en niet
// per scherm een eigen rijtje knoppen: de derde kopie liep in dit project altijd
// uit de pas met de eerste twee. Welk scherm gedeeld wordt zegt `soort`; de rest
// (de link, het pad, de sleutels) regelt lib/deel-link.ts.
//
// De link is er niet uit zichzelf: hij bestaat pas als je hem maakt, en met
// "Trek de link in" bestaat hij weer niet. Dat is de bedoeling. Een deel-link die
// vanzelf klaarstaat is een deur die je nooit bewust hebt opengezet.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import type { DeelSoort } from "../../lib/deel-link";
import { Paneel, Tekst } from "./Uitkomst";

export default function DeelLinkBalk({ slug, soort, titel, uitleg }: {
  slug: string;
  soort: DeelSoort;
  titel: string;
  uitleg: string;
}) {
  const [url, setUrl] = useState("");
  const [melding, setMelding] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let weg = false;
    fetch(`/api/admin/deel-link?soort=${encodeURIComponent(soort)}&slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!weg && d?.ok) setUrl(d.url || ""); })
      .catch(() => { /* stil: de balk hoort het scherm nooit in de weg te zitten */ });
    return () => { weg = true; };
  }, [soort, slug]);

  async function doe(actie: "maken" | "vernieuwen" | "intrekken") {
    if (bezig) return;
    if (actie !== "maken" && !window.confirm(actie === "intrekken"
      ? "De link intrekken? Iedereen die hem heeft, kan er daarna niet meer bij."
      : "Nieuwe link maken? De oude stopt dan meteen met werken.")) return;
    setBezig(true); setMelding("");
    try {
      const d = await fetch("/api/admin/deel-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soort, slug, actie }),
      }).then((r) => r.json());
      if (!d?.ok) { setMelding(d?.error || "Dat lukte niet."); return; }
      setUrl(d.url || "");
      setMelding(actie === "intrekken" ? "De link is ingetrokken en werkt niet meer."
        : actie === "vernieuwen" ? "Nieuwe link gemaakt; de vorige werkt niet meer."
        : "De link staat klaar om te delen.");
    } catch { setMelding("Dat lukte niet."); }
    finally { setBezig(false); }
  }

  async function kopieer() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setMelding("Gekopieerd."); }
    catch { setMelding("Kopiëren lukte niet; selecteer de link zelf."); }
  }

  return (
    <Paneel
      titel={titel}
      knoppen={url
        ? <>
            <button type="button" className="btn btn-primary btn-klein" onClick={() => void kopieer()}>Kopieer de link</button>
            <button type="button" className="btn btn-ghost btn-klein" disabled={bezig} onClick={() => void doe("vernieuwen")}>Nieuwe link</button>
            <button type="button" className="btn btn-danger btn-klein" disabled={bezig} onClick={() => void doe("intrekken")}>Trek de link in</button>
          </>
        : <button type="button" className="btn btn-primary btn-klein" disabled={bezig} onClick={() => void doe("maken")}>{bezig ? "Bezig…" : "Maak een deelbare link"}</button>}
    >
      <Tekst klein>{uitleg}</Tekst>
      {url && (
        <div className="deel-balk">
          <input className="uk-veld" aria-label="De deelbare link" value={url} readOnly onFocus={(e) => e.target.select()} />
          <a className="uk-link" href={url} target="_blank" rel="noreferrer">openen</a>
        </div>
      )}
      {melding && <Tekst klein>{melding}</Tekst>}
    </Paneel>
  );
}

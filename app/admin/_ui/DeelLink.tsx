"use client";

// ═══════════════════════════════════════════════════════════
// EEN SCHERM DEELBAAR MAKEN, OVERAL HETZELFDE
// ═══════════════════════════════════════════════════════════
// De deel-link zelf loopt al via één bron (`lib/deel-link.ts`), maar de bediening
// stond alleen als losse code in het cannibalisatie-paneel. Een tweede scherm
// deelbaar maken zou dus een tweede kopie van dezelfde vijftig regels opleveren,
// en dat is precies de fout die dit project telkens opnieuw maakt.
//
// Dus: één knopje, dat werkt voor elke soort uit `DeelSoort`. Bestaat er al een
// link, dan toont hij die; anders maakt hij hem aan. Intrekken kan ook, en dan is
// de oude link meteen dood.

import { useEffect, useState } from "react";

export default function DeelLink({ slug, soort, wat }: {
  slug: string;
  /** Een waarde uit DeelSoort in lib/deel-link.ts. */
  soort: string;
  /** Wat er gedeeld wordt, voor de uitleg naast de knop. */
  wat: string;
}) {
  const [url, setUrl] = useState("");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");

  useEffect(() => {
    fetch(`/api/admin/deel-link?soort=${encodeURIComponent(soort)}&slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setUrl(d.url || ""); })
      .catch(() => { /* stil: zonder link staat er gewoon de knop */ });
  }, [slug, soort]);

  async function doe(actie: "maak" | "intrekken") {
    if (bezig) return;
    setBezig(true); setMelding("");
    try {
      const d = await fetch("/api/admin/deel-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, soort, actie }),
      }).then((r) => r.json());
      if (!d?.ok) { setMelding(d?.error || "Dat lukte niet."); return; }
      setUrl(d.url || "");
      setMelding(actie === "intrekken" ? "De oude link werkt niet meer." : "Link staat klaar.");
    } catch {
      setMelding("Dat lukte niet.");
    } finally { setBezig(false); }
  }

  async function kopieer() {
    try { await navigator.clipboard.writeText(url); setMelding("Gekopieerd."); }
    catch { setMelding("Kopiëren lukte niet; selecteer de link hierboven."); }
  }

  return (
    <div className="wp-stuur-rij">
      <span className="wp-stuur-label">Deelbare link</span>
      {url ? (
        <>
          <a className="uk-pad" href={url} target="_blank" rel="noreferrer">{url}</a>
          <div className="pnl-acties-groep" role="group">
            <button type="button" className="btn btn-klein btn-ghost" onClick={() => void kopieer()}>Kopieer</button>
            <button type="button" className="btn btn-klein btn-danger" disabled={bezig} onClick={() => void doe("intrekken")}>
              Trek in
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-klein btn-primary" disabled={bezig} onClick={() => void doe("maak")}>
            {bezig ? "Bezig…" : "Maak een link"}
          </button>
          <span className="wp-stuur-uitleg">{wat} zonder inlog, alleen lezen.</span>
        </>
      )}
      {melding && <span className="muted">{melding}</span>}
    </div>
  );
}

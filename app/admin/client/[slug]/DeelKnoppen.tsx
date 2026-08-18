"use client";

import { useState } from "react";
import MailVenster, { type MailBijlage } from "./MailVenster";

// ═══════════════════════════════════════════════════════════
// EEN ANALYSE DELEN MET DE KLANT
// ═══════════════════════════════════════════════════════════
// Een goede analyse in de chat kon je nergens mee naartoe: hij stond alleen in
// het gesprek. Deze twee knoppen maken er een deelbaar stuk van.
//
// - "Maak er een document van": een Word-document in Pingwin-huisstijl, in de
//   klantmap in Drive, plus een werkzaamheid met de link erbij.
// - "Mail naar de klant": hetzelfde mailvenster dat je vanaf een kaart kent, in
//   gewone klanttaal. Is er net een document gemaakt, dan staat dat automatisch
//   aangevinkt om mee te sturen.
//
// Bewust één component, zodat de knoppen op elke plek hetzelfde doen: onder een
// bird's eye-antwoord en op een weekplan-kaart.
// ═══════════════════════════════════════════════════════════

export default function DeelKnoppen({
  slug, titel, tekst, mailBron, blokMd, siteUrl, url, clientName, clientEmail, compact, toon = "beide", knopClass = "btn btn-klein",
}: {
  slug: string;
  /** Waar het over gaat: de titel van het onderwerp of van de kaart. */
  titel: string;
  /** De inhoud die gedeeld wordt: het antwoord of het hele gesprek. */
  tekst: string;
  /**
   * Het volledige gesprek, voor het geval daar al een geschreven mail in staat.
   * `tekst` is voor het document en knijpt terug tot de conclusie; een mail die
   * eerder in het gesprek werd geschreven valt daar dan buiten.
   */
  mailBron?: string;
  /** Het blok dat opgemaakt in de mail komt (ruwe markdown van één antwoord). */
  blokMd?: string;
  /** Domein van de klant, zodat slugs in het blok naar de echte pagina linken. */
  siteUrl?: string;
  url?: string;
  clientName?: string;
  clientEmail?: string;
  compact?: boolean;
  /** "document" laat de mailknop weg, voor plekken die er al een hebben (de weekplan-kaart). */
  toon?: "beide" | "document";
  knopClass?: string;
}) {
  const [docBusy, setDocBusy] = useState(false);
  const [docLink, setDocLink] = useState("");
  const [docTitel, setDocTitel] = useState("");
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);

  async function maakDocument() {
    if (docBusy) return;
    setDocBusy(true); setMelding(""); setFout(false);
    try {
      const d = await fetch("/api/admin/chat-doc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tekst, titel }),
      }).then((r) => r.json());
      if (d?.ok) {
        setDocLink(d.link || "");
        setDocTitel(d.title || titel);
        setMelding(d.link ? "Document klaar, openen" : (d.driveFout || "Document gemaakt, maar niet opgeslagen in Drive."));
        setFout(!d.link);
        if (d.omslagMelding) setMelding((m) => `${m} (${d.omslagMelding})`);
      } else { setMelding(d?.error || "Document maken mislukte."); setFout(true); }
    } catch { setMelding("De assistent is niet bereikbaar."); setFout(true); }
    finally { setDocBusy(false); }
  }

  const bijlagen: MailBijlage[] = docLink ? [{ key: "advies", label: docTitel || "Adviesdocument", url: docLink }] : [];

  return (
    <div className={"deel-knoppen" + (compact ? " deel-compact" : "")}>
      <button type="button" className={knopClass} disabled={docBusy || !tekst.trim()} onClick={() => void maakDocument()}
        title="Maakt hier een Word-document van in Pingwin-huisstijl en zet het in de klantmap in Drive.">
        {docBusy ? "Document maken…" : compact ? "Document" : "Maak er een document van"}
      </button>
      {toon === "beide" && (
        <button type="button" className={knopClass} disabled={!tekst.trim()} onClick={() => setMailOpen(true)}
          title="Opent een mail met dit blok er opgemaakt in; jouw eigen intro typ of dicteer je erboven.">
          {compact ? "In mail" : "Zet dit blok in een mail"}
        </button>
      )}
      {melding && (
        docLink
          ? <a className="wp-link" href={docLink} target="_blank" rel="noreferrer">{melding}</a>
          : <span className={"ovc-mk-msg" + (fout ? " err" : " ok")}>{melding}</span>
      )}

      {mailOpen && (
        <MailVenster
          slug={slug}
          titel={blokMd ? "Dit blok in een mail" : "Mail vanuit dit gesprek"}
          onderwerpVan={titel}
          taak={titel}
          toelichting={tekst}
          mailBron={mailBron}
          blokMd={blokMd}
          siteUrl={siteUrl}
          url={url}
          bijlagen={bijlagen}
          standaardAangevinkt={docLink ? ["advies"] : []}
          clientName={clientName}
          clientEmail={clientEmail}
          onClose={() => setMailOpen(false)}
        />
      )}
    </div>
  );
}

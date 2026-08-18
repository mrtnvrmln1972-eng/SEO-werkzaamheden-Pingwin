"use client";

// De bijlagen van een mail, als sleepbare chips.
//
// Waarom: een klant stuurt zijn geredigeerde copy-document als bijlage terug. Dat
// moest je downloaden en daarna weer uploaden bij de taak. Nu sleep je de chip op
// de taak en haalt het dashboard het bestand zelf bij Microsoft op.
//
// De lijst wordt pas opgehaald als de mail openstaat: bij elke mail meteen de
// bijlagen ophalen zou vijftien extra vragen per scherm betekenen.

import { useEffect, useState } from "react";

type Bijlage = { id: string; naam: string; type: string; grootte: number };

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);

export default function MailBijlagen({ slug, messageId, mailDatum }: { slug: string; messageId: string;
  /** Wanneer de mail binnenkwam. Een bijlage zonder eigen datum is nooit jonger
      dan de mail waarin hij zat, dus dat is een eerlijke ondergrens om mee te
      vergelijken als het dashboard bepaalt welke versie de nieuwste is. */
  mailDatum?: string }) {
  const [bijlagen, setBijlagen] = useState<Bijlage[] | null>(null);

  useEffect(() => {
    let af = false;
    fetch(`/api/admin/mail?slug=${encodeURIComponent(slug)}&bijlagen=${encodeURIComponent(messageId)}`)
      .then((r) => r.json())
      .then((d) => { if (!af && d?.ok) setBijlagen(d.bijlagen || []); })
      .catch(() => { if (!af) setBijlagen([]); });
    return () => { af = true; };
  }, [slug, messageId]);

  if (!bijlagen || bijlagen.length === 0) return null;

  return (
    <div className="mail-bijlagen">
      <span className="muted">Bijlagen, sleep ze naar een taak:</span>
      {bijlagen.map((b) => (
        <span key={b.id} className="mail-bijlage-chip" draggable
          title={`${b.naam} (${kb(b.grootte)}) — sleep naar een taak om hem als versie toe te voegen`}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("application/pingwin-bijlage",
              JSON.stringify({ messageId, attachmentId: b.id, naam: b.naam, mailDatum: mailDatum || "" }));
            // Ook als platte tekst, zodat er iets zinnigs gebeurt als je hem
            // ergens anders neerlegt dan op een taak.
            e.dataTransfer.setData("text/plain", b.naam);
          }}>
          <span className="mail-bijlage-naam">{b.naam}</span>
          <span className="mail-bijlage-maat muted">{kb(b.grootte)}</span>
        </span>
      ))}
    </div>
  );
}

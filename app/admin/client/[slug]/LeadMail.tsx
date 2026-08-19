"use client";

import { useState } from "react";
import MailVenster from "./MailVenster";

// ═══════════════════════════════════════════════════════════
// DE MAILWISSELING MET EEN LEAD
// ═══════════════════════════════════════════════════════════
// Precies wat een klant al had, nu ook voor een lead: de laatste mails met dit
// bedrijf, en een knop om er zelf een te sturen.
//
// De mail komt uit Microsoft 365 en niet uit HubSpot, met opzet. De mailbox heeft
// de hele draad, ook wat er nooit in HubSpot gelogd is, en je kunt er vanuit
// antwoorden. Eén bron voor mail, en dat is de mailbox.
// ═══════════════════════════════════════════════════════════

export type Mail = {
  id: string; subject: string | null; fromName: string | null; fromAddress: string | null;
  receivedAt: string | null; preview: string | null; webLink: string | null; superhumanLink: string | null;
};

function datum(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
}

export default function LeadMail({ slug, naam, email, mails, verbonden, onVernieuw }: {
  slug: string; naam: string; email: string;
  // De mails komen van boven, uit één ophaalronde. Haalde dit blok ze zelf op,
  // dan stonden er twee identieke verzoeken tegelijk uit naar dezelfde mailbox
  // en kon het ene "vijftien mails" zeggen terwijl het andere leeg terugkwam.
  // Dat is precies wat er op 19-08 op het scherm stond.
  mails: Mail[];
  verbonden: boolean | null;
  onVernieuw: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [schrijven, setSchrijven] = useState(false);

  return (
    <div className="card lead-mail">
      <div className="lead-blok-kop">
        <div>
          <div className="lead-blok-titel">Mailwisseling</div>
          <div className="lead-blok-sub">
            {verbonden === false
              ? "De mailkoppeling staat uit in deze omgeving"
              : "De laatste mails met dit bedrijf, rechtstreeks uit je mailbox"}
          </div>
        </div>
        <div className="pnl-acties-groep">
          <button className="btn btn-primary btn-klein" onClick={() => setSchrijven(true)}>Mail sturen</button>
          {mails.length > 3 && (
            <button className="btn btn-klein btn-quiet" onClick={() => setOpen((v) => !v)}>
              {open ? "Toon minder" : `Alle ${mails.length} tonen`}
            </button>
          )}
        </div>
      </div>

      <div className="lead-lijst">
        {mails.length === 0 && (
          <div className="muted lead-leeg">
            {verbonden === false ? "Geen mailkoppeling, dus geen mails te tonen." : "Nog geen mail met dit bedrijf gevonden."}
          </div>
        )}
        {(open ? mails : mails.slice(0, 3)).map((m) => (
          <div key={m.id} className="lead-item">
            <div className="lead-item-kop">
              <span className="lead-item-titel">{m.subject || "(geen onderwerp)"}</span>
              <span className="lead-item-datum">{datum(m.receivedAt)}</span>
            </div>
            <div className="lead-item-sam">
              {m.fromName || m.fromAddress || "onbekende afzender"}
              {m.preview ? `: ${m.preview.slice(0, 160)}` : ""}
            </div>
            {(m.superhumanLink || m.webLink) && (
              <div className="lead-item-acties">
                <a className="btn btn-klein" href={(m.superhumanLink || m.webLink) as string} target="_blank" rel="noreferrer">
                  Open de mail
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {schrijven && (
        <MailVenster
          slug={slug}
          titel={`Mail aan ${naam}`}
          onderwerpVan={naam}
          taak={`Een mail aan ${naam}, een lead die we nog binnen willen halen.`}
          toelichting={`Dit bedrijf is nog geen klant. Schrijf kort en persoonlijk, in de ik-vorm, met één duidelijke vraag of vervolgstap.`}
          clientName={naam}
          clientEmail={email}
          onClose={() => { setSchrijven(false); onVernieuw(); }}
        />
      )}
    </div>
  );
}

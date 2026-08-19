"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════
// DE TIJDLIJN VAN EEN LEAD
// ═══════════════════════════════════════════════════════════
// Eén lijst waarin alles op datum onder elkaar staat: de mails, de notities en
// gespreksverslagen uit HubSpot, de documenten die we maakten en de metingen die
// we deden. Dat is wat je mist als je na drie weken een lead opent en je afvraagt
// waar je gebleven was.
//
// Bewust géén nieuwe opslag: dit leest wat er al ligt (dossier, plank, mailbox)
// en zet het op volgorde. Een tweede administratie van dezelfde dingen is precies
// hoe twee plekken uit elkaar gaan lopen.
// ═══════════════════════════════════════════════════════════

type DossierItem = { id: number; soort: string; titel: string; samenvatting: string; bron: string; driveLink: string; createdAt: string };
type LeadDoc = { id: number; titel: string; driveLink: string; createdAt: string };
type Mail = { id: string; subject: string | null; fromName: string | null; fromAddress: string | null; receivedAt: string | null; superhumanLink: string | null; webLink: string | null };

type Regel = { sleutel: string; datum: string; label: string; titel: string; onder: string; link: string };

function datumLang(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso.slice(0, 10); }
}

export default function LeadTijdlijn({ slug, items, docs }: { slug: string; items: DossierItem[]; docs: LeadDoc[] }) {
  const [mails, setMails] = useState<Mail[]>([]);
  const [alles, setAlles] = useState(false);

  const laadMail = useCallback(async () => {
    try {
      const d = await fetch(`/api/admin/mail?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok && Array.isArray(d.emails)) setMails(d.emails.slice(0, 25));
    } catch { /* stil: zonder mail is de tijdlijn nog steeds bruikbaar */ }
  }, [slug]);

  useEffect(() => { laadMail(); }, [laadMail]);

  const regels = useMemo<Regel[]>(() => {
    const uit: Regel[] = [];
    for (const i of items) {
      const uitHubspot = i.bron.startsWith("hubspot:");
      uit.push({
        sleutel: `d${i.id}`,
        datum: i.createdAt,
        label: uitHubspot ? "HubSpot" : i.soort === "meting" ? "Meting" : i.soort === "document" ? "Aangeleverd" : "Dossier",
        titel: i.titel,
        onder: i.samenvatting.slice(0, 200),
        link: i.driveLink,
      });
    }
    for (const d of docs) {
      uit.push({ sleutel: `p${d.id}`, datum: d.createdAt, label: "Document", titel: d.titel, onder: "Gemaakt vanuit het dossier", link: d.driveLink });
    }
    for (const m of mails) {
      if (!m.receivedAt) continue;
      uit.push({
        sleutel: `m${m.id}`,
        datum: m.receivedAt,
        label: "Mail",
        titel: m.subject || "(geen onderwerp)",
        onder: m.fromName || m.fromAddress || "",
        link: m.superhumanLink || m.webLink || "",
      });
    }
    return uit.sort((a, b) => b.datum.localeCompare(a.datum));
  }, [items, docs, mails]);

  const zichtbaar = alles ? regels : regels.slice(0, 8);

  return (
    <div className="card lead-tijdlijn">
      <div className="lead-blok-kop">
        <div>
          <div className="lead-blok-titel">Tijdlijn</div>
          <div className="lead-blok-sub">Alles wat er met dit bedrijf gebeurd is, op volgorde</div>
        </div>
        {regels.length > 8 && (
          <button className="btn btn-klein btn-quiet" onClick={() => setAlles((v) => !v)}>
            {alles ? "Toon minder" : `Alle ${regels.length} tonen`}
          </button>
        )}
      </div>

      <div className="lead-lijst">
        {regels.length === 0 && <div className="muted lead-leeg">Nog niets gebeurd met dit bedrijf.</div>}
        {zichtbaar.map((r) => (
          <div key={r.sleutel} className="lead-tijdregel">
            <span className="chip">{r.label}</span>
            <div className="lead-tijdregel-tekst">
              <div className="lead-item-titel">
                {r.link ? <a href={r.link} target="_blank" rel="noreferrer">{r.titel}</a> : r.titel}
              </div>
              {r.onder && <div className="lead-item-sam">{r.onder}</div>}
            </div>
            <span className="lead-item-datum">{datumLang(r.datum)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

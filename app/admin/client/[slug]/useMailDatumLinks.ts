"use client";

// Datum naar link-naar-de-mail, uit de mails van DEZE klant. Zo wordt "mail van
// 5-7" in een kaarttekst een echte link, en blijft een mail die we niet kennen
// gewone tekst in plaats van een oranje woordje dat nergens heen gaat.
//
// Staat apart omdat zowel het tabblad Taken als de planning dezelfde kaarten
// tonen. Deed alleen het ene scherm dit, dan waren dezelfde verwijzingen daar
// klikbaar en hier niet.

import { useEffect, useState } from "react";
import { type MailKandidaat, type MailLinks } from "../../../../lib/card-info";

export function useMailDatumLinks(slug: string): MailLinks {
  const [links, setLinks] = useState<MailLinks>({});
  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/mail?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!leeft || !d?.ok) return;
        // Alle mails van een dag bewaren, niet één. Op een dag met meerdere mails
        // kwam "mail van 3-8" anders bij de verkeerde afzender uit; de keuze
        // gebeurt op naam, in card-info.ts, met de zin erbij.
        const m: Record<string, MailKandidaat[]> = {};
        for (const e of (d.emails || []) as { receivedAt?: string; superhumanLink?: string; webLink?: string; fromAddress?: string; fromName?: string; subject?: string }[]) {
          const link = e.superhumanLink || e.webLink;
          if (!e.receivedAt || !link) continue;
          const dt = new Date(e.receivedAt);
          if (Number.isNaN(dt.getTime())) continue;
          const kandidaat: MailKandidaat = { link, van: `${e.fromName || ""} ${e.fromAddress || ""}`.trim(), onderwerp: e.subject || "" };
          const d1 = `${dt.getDate()}-${dt.getMonth() + 1}`;
          (m[d1] ||= []).push(kandidaat);
          (m[`${d1}-${dt.getFullYear()}`] ||= []).push(kandidaat);
        }
        setLinks(m);
      })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug]);
  return links;
}

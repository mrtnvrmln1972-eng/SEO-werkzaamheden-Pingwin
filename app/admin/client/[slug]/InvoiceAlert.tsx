"use client";

import { useEffect, useState } from "react";

// Waarschuwingsbalk in de klant-cockpit: verschijnt alleen als deze klant een
// factuur heeft die langer dan 30 dagen na verzending openstaat. De data komt
// uit de eigenaar-only Moneybird-route; gasten krijgen daar 403 en zien dus
// vanzelf niets (geen aparte isOwner-prop nodig).

type Inv = { id: string; invoiceId: string; totalUnpaid: number; daysOpen: number; over30: boolean; url: string };

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceAlert({ slug }: { slug: string }) {
  const [overdue, setOverdue] = useState<Inv[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/moneybird/openstaand");
        if (!res.ok) return; // 401/403 (gast) of 502: geen balk tonen
        const data = await res.json();
        if (!data.ok || !data.configured) return;
        const mine = (data.byClient as { slug: string; invoices: Inv[] }[]).find((c) => c.slug === slug);
        if (alive && mine) setOverdue(mine.invoices.filter((i) => i.over30));
      } catch { /* stil: geen signaal is geen ramp, volgende paginalading opnieuw */ }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (overdue.length === 0) return null;
  const total = overdue.reduce((s, i) => s + i.totalUnpaid, 0);

  return (
    <div className="invoice-alert" role="alert">
      <span className="invoice-alert-icon">!</span>
      <span>
        {overdue.length === 1
          ? <>Factuur <strong>{overdue[0].invoiceId}</strong> staat al <strong>{overdue[0].daysOpen} dagen</strong> open ({euro(total)}).</>
          : <><strong>{overdue.length} facturen</strong> staan langer dan 30 dagen open (samen {euro(total)}).</>}
      </span>
      <span className="invoice-alert-links">
        {overdue.map((i) => (
          <a key={i.id} href={i.url} target="_blank" rel="noreferrer" title={`${i.daysOpen} dagen open, ${euro(i.totalUnpaid)}`}>
            {i.invoiceId} in Moneybird
          </a>
        ))}
      </span>
    </div>
  );
}

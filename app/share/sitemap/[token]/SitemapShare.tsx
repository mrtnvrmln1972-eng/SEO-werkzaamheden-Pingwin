"use client";

// De sitemap-check als deel-link. Exact dezelfde blokken als in de cockpit, uit
// dezelfde component, in leesmodus: geen knoppen, geen navigatie, geen weg naar
// de rest van het dashboard. Wat hier te zien is, is de stand van de laatste
// controle die in het beheerscherm gedraaid is; de datum staat erbij.

import { useEffect, useState } from "react";
import DeelPagina, { DeelLeeg } from "../../../_ui/DeelPagina";
import SitemapWeergave from "../../../admin/client/[slug]/sitemap/SitemapWeergave";
import type { SitemapCheckUitkomst } from "../../../../lib/sitemap-check";

type Data = { clientName: string; domain: string; gecontroleerd: string; data: SitemapCheckUitkomst };

export default function SitemapShare({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [fout, setFout] = useState("");

  useEffect(() => {
    fetch(`/api/share/sitemap?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setD(j as Data); else setFout(j?.error || "Deze link werkt niet meer."); })
      .catch(() => setFout("Deze pagina kon niet worden geladen."));
  }, [token]);

  if (fout) return <DeelLeeg>{fout}</DeelLeeg>;
  if (!d) return <DeelLeeg>De controle wordt geladen…</DeelLeeg>;

  const moment = new Date(d.gecontroleerd).toLocaleDateString("nl-NL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <DeelPagina
      titel={`Sitemap-check${d.clientName ? `: ${d.clientName}` : ""}`}
      onderschrift={`Stand van ${moment}`}
      voet="Opgesteld door Pingwin Online Marketing. Vragen over deze controle? Stel ze gerust."
    >
      <SitemapWeergave
        data={d.data}
        domain={d.domain}
        uitleg="De sitemap is de inhoudsopgave die de site aan Google geeft. Hieronder staat of die inhoudsopgave klopt: opgehaald bij de site zelf en vergeleken met de pagina's die echt live staan."
      />
    </DeelPagina>
  );
}

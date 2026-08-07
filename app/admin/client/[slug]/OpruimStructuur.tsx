"use client";

// Het structuuroverzicht boven de werklijst: welke SOORTEN pagina's er zijn.
//
// Waarom dit er hoort te staan, en boven de regels: bij One Day Clinic bestaan
// er acht URL-vormen voor hetzelfde onderwerp. Zolang die naast elkaar leven
// blijf je redirecten. Eerst het patroon zien, dan pas zeventig regels afwerken.
// Zonder dit blok is de opruimlijst een rij losse beslissingen zonder verhaal.

import { useEffect, useState } from "react";

type Familie = { vorm: string; aantal: number; dood: number; voorbeelden: string[] };
type Data = { families: Familie[]; totaalLive: number; totaalVormen: number; dood: number; gemeten: boolean };

export default function OpruimStructuur({ slug, data }: {
  slug: string;
  /** Al opgehaalde structuur (de publieke deelpagina krijgt hem meegeleverd en
      mag de adminroute niet aanroepen). Leeg = zelf ophalen, zoals altijd. */
  data?: Data | null;
}) {
  const [d, setD] = useState<Data | null>(data || null);
  const [bezig, setBezig] = useState(!data);

  useEffect(() => {
    if (data) { setD(data); setBezig(false); return; }
    let leeft = true;
    fetch(`/api/admin/opruim-structuur?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (leeft && j?.ok) setD(j); })
      .catch(() => {})
      .finally(() => { if (leeft) setBezig(false); });
    return () => { leeft = false; };
  }, [slug, data]);

  if (bezig) return <div className="muted opr-str-laden">Structuur van de site wordt bepaald…</div>;
  if (!d || !d.families.length) return null;

  return (
    <div className="opr-kaart opr-str">
      <div className="opr-kop">Structuur: welke soorten pagina&rsquo;s deze site heeft</div>
      <div className="opr-str-kpi">
        <div><b>{d.totaalVormen}</b><span>pagina&rsquo;s in een locatievorm</span></div>
        <div><b>{d.families.length}</b><span>verschillende URL-vormen</span></div>
        {d.gemeten && <div><b>{d.dood}</b><span>zonder eigen zoekterm</span></div>}
        <div><b>{d.totaalLive}</b><span>live pagina&rsquo;s totaal</span></div>
      </div>
      <div className="opr-scroll">
        <table className="opr-tabel">
          <thead>
            <tr>
              <th>URL-vorm</th>
              <th className="opr-num">Pagina&rsquo;s</th>
              <th className="opr-num">Dood gewicht</th>
              <th>Voorbeelden</th>
            </tr>
          </thead>
          <tbody>
            {d.families.map((f) => (
              <tr key={f.vorm}>
                <td><span className="opr-pad">{f.vorm}</span></td>
                <td className="opr-num">{f.aantal}</td>
                <td className="opr-num">{d.gemeten ? (f.dood ? <strong className="opr-dood">{f.dood}</strong> : "0") : <span className="opr-leeg">&mdash;</span>}</td>
                <td className="opr-vb">{f.voorbeelden.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.families.length > 2 && (
        <p className="opr-kaart-tekst" style={{ marginTop: "var(--s-3)", marginBottom: "var(--s-0)" }}>
          Er zijn <strong>{d.families.length} verschillende vormen</strong> voor wat vaak hetzelfde onderwerp is. Zolang die naast elkaar bestaan blijf je redirecten. Kies er één die je aanhoudt en laat de rest daarheen wijzen; dat besluit maakt het grootste deel van de lijst hieronder eenmalig in plaats van terugkerend.
        </p>
      )}
    </div>
  );
}

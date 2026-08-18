"use client";

// ═══════════════════════════════════════════════════════════
// KLOPTE HET? WAT DE DOORGEVOERDE OMLEIDINGEN HEBBEN OPGELEVERD
// ═══════════════════════════════════════════════════════════
// Alles op deze pagina is een voorspelling. Dit blok is het enige dat terugkijkt.
// Op het moment dat een omleiding live gaat wordt vastgelegd hoe de winnaar er
// dan voor staat; na 30 en 90 dagen wordt hetzelfde opnieuw gemeten. Zonder dat
// blijft een werkwijze jaren bestaan zonder dat iemand weet of hij werkt.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";

type Meting = { klikken: number; vertoningen: number; positie: number | null; op: string };
export type Nameting = {
  van: string; naar: string; doorgevoerdOp: string;
  basis: Meting | null; na30: Meting | null; na90: Meting | null;
  dagen: number; oordeel: string; richting: "beter" | "slechter" | "gelijk" | "te vroeg";
};

const CHIP: Record<Nameting["richting"], string> = {
  beter: "keep", slechter: "nodig", gelijk: "merge", "te vroeg": "",
};
const LABEL: Record<Nameting["richting"], string> = {
  beter: "sterker geworden", slechter: "achteruit", gelijk: "gelijk gebleven", "te vroeg": "nog te vroeg",
};

export default function OpruimNameten({ rijen, tekst, domain }: {
  rijen: Nameting[]; tekst?: string; domain: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  if (!rijen.length) return null;

  return (
    <div className="opr-kaart">
      <div className="opr-kop">Klopte het? De doorgevoerde omleidingen nagemeten ({rijen.length})</div>
      <div className="opr-kaart-tekst">
        <p>
          Elke omleiding hierboven is een voorspelling: de winnaar wordt sterker als de concurrentie van eigen
          pagina&rsquo;s wegvalt. Bij het doorvoeren wordt vastgelegd hoe die winnaar er <strong>dán</strong> voor staat,
          en na 30 en 90 dagen meten we hetzelfde opnieuw. Zo blijkt of de redenering klopte.
        </p>
        {tekst && <p><strong>{tekst}</strong></p>}
        <p>
          Na 30 dagen is een daling nog normaal: Google heeft weken nodig om een omleiding te verwerken. Pas de meting
          na 90 dagen is een oordeel.
        </p>
      </div>

      <div className="opr-scroll">
        <table className="opr-tabel">
          <thead>
            <tr>
              <th>Omgeleide pagina</th>
              <th>Naar</th>
              <th>Sinds</th>
              <th>Klikken toen &rarr; nu</th>
              <th>Beste plek</th>
              <th>Uitkomst</th>
              <th>Wat het betekent</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => {
              const later = r.na90 || r.na30;
              return (
                <tr key={r.van}>
                  <td><Link p={r.van} /></td>
                  <td><Link p={r.naar} /></td>
                  <td>{r.dagen} {r.dagen === 1 ? "dag" : "dagen"}</td>
                  <td>{r.basis ? `${r.basis.klikken}` : "—"} &rarr; {later ? `${later.klikken}` : <span className="opr-leeg">nog niet gemeten</span>}</td>
                  <td>
                    {r.basis?.positie != null ? r.basis.positie : "—"} &rarr;{" "}
                    {later?.positie != null ? later.positie : <span className="opr-leeg">—</span>}
                  </td>
                  <td><span className={`opr-chip ${CHIP[r.richting]}`}>{LABEL[r.richting]}</span></td>
                  <td className="opr-reden">
                    <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpen((m) => ({ ...m, [r.van]: !m[r.van] }))}>
                      {open[r.van] ? "▾ minder" : "▸ uitleg"}
                    </button>
                    {open[r.van] && (
                      <div className="opr-uitleg">
                        <div className="opr-bewijs">
                          <p>{r.oordeel}</p>
                          <p>
                            Gemeten op <Link p={r.naar} />, de pagina waar het verkeer naartoe gaat, over telkens 28 dagen
                            Search Console. De nulmeting is van {new Date(r.doorgevoerdOp).toLocaleDateString("nl-NL")},
                            de dag dat de omleiding live ging.
                            {r.na90 ? " De meting van 90 dagen telt; die van 30 dagen is daarmee achterhaald." : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

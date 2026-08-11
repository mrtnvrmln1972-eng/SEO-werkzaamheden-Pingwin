"use client";

// "Is dit doorgevoerd?": meet de live pagina op de punten die bij het doorzetten
// zijn afgesproken. Het antwoord blijft staan tot je de kaart sluit; de vaste
// plek ervan is de kaarttekst en de tijdlijn.

import { useState } from "react";

type Kop = { bron: string; link: string; bedoeld: string[]; opDePagina: string[]; ontbreekt: string[] };
export type Meting = {
  samenvatting: string;
  punten: { label: string; uitslag: string; bewijs: string; koppen?: Kop }[];
  alles: boolean;
  meetbaar: boolean;
} | null;

export function useDoorgevoerd({ slug, id, refreshBoard }: { slug: string; id: number; refreshBoard: () => void }) {
  const [controle, setControle] = useState<Meting>(null);
  const [bezig, setBezig] = useState(false);

  async function meet() {
    if (bezig) return;
    setBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan/doorgevoerd", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id }),
      }).then((r) => r.json());
      if (d?.ok && d.meting) { setControle(d.meting); if (d.gewijzigd) refreshBoard(); }
      else setControle({ samenvatting: d?.error || "De controle lukte niet.", punten: [], alles: false, meetbaar: false });
    } catch {
      setControle({ samenvatting: "De controle lukte niet.", punten: [], alles: false, meetbaar: false });
    } finally { setBezig(false); }
  }

  return { controle, bezig, meet };
}

export default function ControleUitslag({ controle, onMail }: { controle: NonNullable<Meting>; onMail: (aud: "klant" | "dev") => void }) {
  return (
    <div className={"wp-controle" + (controle.alles ? " wp-controle-ok" : controle.meetbaar ? " wp-controle-niet" : "")}>
      <div className="wp-controle-kop">
        {controle.alles ? "Doorgevoerd: " : controle.meetbaar ? "Nog niet klaar: " : ""}{controle.samenvatting}
      </div>
      {controle.punten.length > 0 && (
        <ul className="wp-controle-lijst">
          {controle.punten.map((p, i) => (
            <li key={i} className={"wp-controle-punt wp-cp-" + p.uitslag}>
              <span className="wp-controle-label">{p.label}</span>
              <span className="wp-controle-bewijs muted">{p.bewijs}</span>
              {/* Het bewijs achter het getal. Zonder dit is "0 van de 5 koppen
                  gevonden" een raadsel: dan weet je niet of de sitebouwer
                  niets deed of dat wij het verkeerde document naast de pagina
                  legden, en dat bepaalt wie er aan zet is. */}
              {p.koppen && p.koppen.bedoeld.length > 0 && (
                <details className="wp-controle-details">
                  <summary>Welke koppen</summary>
                  <div className="wp-controle-bron muted">Vergeleken met {p.koppen.bron}</div>
                  <ul className="wp-controle-koppen">
                    {p.koppen.bedoeld.map((k, j) => (
                      <li key={j} className={p.koppen && p.koppen.ontbreekt.includes(k) ? "wp-kop-mist" : "wp-kop-ok"}>{k}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {controle.meetbaar && !controle.alles && (
        <button type="button" className="btn btn-ghost btn-klein" onClick={() => onMail("dev")}
          title="Schrijf een mail aan de sitebouwer met de gemeten waarde en de pagina erin">Mail de sitebouwer</button>
      )}
    </div>
  );
}

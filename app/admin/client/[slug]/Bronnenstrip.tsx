"use client";

import { linkifyHtml } from "../../../../lib/linkify";

export type Bron = { naam: string; detail: string };

// Wat de chat voor dit antwoord heeft opgezocht, ingeklapt onder het antwoord.
//
// Waarom: aan een antwoord kon je niet zien of er echt gemeten was of dat er iets
// werd aangenomen. Daar zijn tientallen "verzin geen cijfers"-regels en een hele
// feitencontrole voor gebouwd; dit is de simpele kant van diezelfde vraag. Staat een
// positie in het antwoord zonder Ahrefs-regel hieronder, dan weet je genoeg.
//
// Standaard dicht, dus het staat niets in de weg.
export default function Bronnenstrip({ bronnen, domain }: { bronnen?: Bron[]; domain?: string }) {
  if (!bronnen || bronnen.length === 0) return null;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    <details className="bronnen">
      <summary className="bronnen-kop">
        Zo ben ik hieraan gekomen ({bronnen.length} {bronnen.length === 1 ? "bron" : "bronnen"})
      </summary>
      <ul className="bronnen-lijst">
        {bronnen.map((b, i) => (
          <li key={i} className="bronnen-regel">
            <span className="bronnen-naam">{b.naam}</span>
            {b.detail && (
              <span
                className="bronnen-detail"
                dangerouslySetInnerHTML={{ __html: linkifyHtml(escape(b.detail), domain || "") }}
              />
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

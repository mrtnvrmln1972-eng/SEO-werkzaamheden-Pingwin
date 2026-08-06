"use client";

// ═══════════════════════════════════════════════════════════
// DE BOUWSTENEN VOOR ELKE UITKOMST DIE MAARTEN ZIET
// ═══════════════════════════════════════════════════════════
// Waarom dit bestand bestaat. De opmaakregel staat al twintig keer in CLAUDE.md,
// en toch kwam er op 6 augustus 2026 weer een scherm langs met tekstmuren, rode
// regels op een rij en een samenvatting in een smalle kolom. Dat is geen
// vergeetachtigheid maar een ontwerpfout: zolang elk paneel zijn eigen div's,
// kleuren en afstanden mag verzinnen, hángt de opmaak van geheugen af, en geheugen
// faalt.
//
// Daarom is dit de enige manier waarop een uitkomst op het scherm komt. Niet een
// hulpje dat je mág gebruiken; de plek waar het antwoord op "hoe ziet dit eruit"
// één keer staat. Een nieuw scherm importeert deze bouwstenen en is daarmee klaar:
// afstanden, lettergroottes, kleuren en klikbare slugs zitten er al in.
//
// De proef `proeven/opmaak.proef.ts` bewaakt dit. Die faalt als een scherm zijn
// eigen afstanden of lettergroottes gaat hardcoderen, dus de bouw stopt vóór het
// live gaat in plaats van dat Maarten het op zijn scherm ziet.
//
// Drie regels die hierin vastliggen, en die je dus nergens meer hoeft te herhalen:
//  1. Losse tekst gaat altijd door `Tekst`, en dus door mdToHtml: nooit ruwe
//     markdown-tekens in beeld, altijd een begrensde leesbreedte.
//  2. Elk pad en elke URL wordt vanzelf klikbaar naar de live pagina.
//  3. Een waarschuwing is een regel met een eigen vorm, geen rode zin in een muur.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from "react";
import { mdToHtml } from "../../lib/markdown";

// ── Klikbare paden en URL's ────────────────────────────────
// Elke slug die in beeld komt linkt naar de live pagina. Stond eerder als losse
// kopie in OverviewChat; hier is het één keer geregeld voor alles wat deze
// bouwstenen gebruikt.
function linkify(tekst: string, domein?: string): ReactNode[] {
  const delen: ReactNode[] = [];
  const patroon = /(https?:\/\/[^\s<>()"']+|(?<![\w/])\/[a-z0-9][a-z0-9\-/]*\/?)/gi;
  let laatste = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = patroon.exec(tekst)) !== null) {
    if (m.index > laatste) delen.push(tekst.slice(laatste, m.index));
    const gevonden = m[0];
    const href = /^https?:\/\//i.test(gevonden)
      ? gevonden
      : domein ? `https://${domein.replace(/^www\./i, "")}${gevonden}` : gevonden;
    delen.push(
      <a key={`l${n++}`} href={href} target="_blank" rel="noreferrer" className="uk-link">{gevonden}</a>,
    );
    laatste = m.index + gevonden.length;
  }
  if (laatste < tekst.length) delen.push(tekst.slice(laatste));
  return delen.length ? delen : [tekst];
}

/** Eén paneel met een titel, en rechts eventueel knoppen. */
export function Paneel({ titel, uitleg, knoppen, children }: {
  titel: string; uitleg?: string; knoppen?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="uk-paneel">
      <header className="uk-paneel-kop">
        <h2 className="uk-paneel-titel">{titel}</h2>
        {knoppen && <div className="uk-knoppen">{knoppen}</div>}
      </header>
      {uitleg && <p className="uk-paneel-uitleg">{uitleg}</p>}
      {children}
    </section>
  );
}

/** Een blok binnen een paneel, met een eigen kopje. */
export function Blok({ titel, meta, children }: { titel?: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="uk-blok">
      {(titel || meta) && (
        <div className="uk-blok-kop">
          {titel && <div className="uk-blok-titel">{titel}</div>}
          {meta && <div className="uk-blok-meta">{meta}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Losse tekst. De enige weg naar het scherm voor alles wat een mens of een model
 * geschreven heeft: gerenderd, met een begrensde leesbreedte, en met klikbare
 * paden. Nooit een string rechtstreeks in een div.
 */
export function Tekst({ children, klein }: { children?: string | null; klein?: boolean }) {
  const t = (children || "").trim();
  if (!t) return null;
  return <div className={"uk-tekst md" + (klein ? " klein" : "")} dangerouslySetInnerHTML={{ __html: mdToHtml(t) }} />;
}

/** Eén regel met een oordeel erbij: let op, goed, of gewoon een notitie. */
export function Signaal({ soort = "let-op", domein, children }: {
  soort?: "let-op" | "goed" | "notitie"; domein?: string; children: string;
}) {
  const teken = soort === "let-op" ? "!" : soort === "goed" ? "✓" : "·";
  return (
    <div className={"uk-signaal " + soort}>
      <span className="uk-signaal-teken" aria-hidden="true">{teken}</span>
      <span className="uk-signaal-tekst">{linkify(children, domein)}</span>
    </div>
  );
}

/** Meerdere signalen onder elkaar, met witruimte ertussen. */
export function Signalen({ regels, soort = "let-op", domein }: {
  regels?: string[]; soort?: "let-op" | "goed" | "notitie"; domein?: string;
}) {
  if (!regels?.length) return null;
  return <div className="uk-signalen">{regels.map((r, i) => <Signaal key={i} soort={soort} domein={domein}>{r}</Signaal>)}</div>;
}

/** Kleine labelpil. `toon` bepaalt de kleur, niet de plek waar hij staat. */
export function Chip({ toon = "neutraal", titel, children }: {
  toon?: "neutraal" | "goed" | "let-op" | "accent" | "uit"; titel?: string; children: ReactNode;
}) {
  return <span className={"uk-chip " + toon} title={titel}>{children}</span>;
}

/** Een rij chips, netjes uitgelijnd en met omslag bij weinig ruimte. */
export function Chips({ children }: { children: ReactNode }) {
  return <div className="uk-chips">{children}</div>;
}

/** Een klikbaar pad naar de live pagina van de klant. */
export function Pad({ pad, domein }: { pad: string; domein?: string }) {
  const href = /^https?:\/\//i.test(pad)
    ? pad
    : domein ? `https://${domein.replace(/^www\./i, "")}${pad}` : pad;
  return <a className="uk-pad" href={href} target="_blank" rel="noreferrer">{pad}</a>;
}

/** Tabel die op een smal scherm meebeweegt in plaats van uit te lopen. */
export function Tabel({ kolommen, children }: { kolommen: string[]; children: ReactNode }) {
  return (
    <div className="uk-tabel-wrap">
      <table className="uk-tabel">
        <thead><tr>{kolommen.map((k, i) => <th key={i}>{k}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Wat er te zien zou zijn als er iets was. Nooit een leeg scherm zonder uitleg. */
export function Leeg({ children }: { children: ReactNode }) {
  return <div className="uk-leeg">{children}</div>;
}

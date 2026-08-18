"use client";

import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// DE SPEELRUIMTE: DRAAIEN AAN HET ONTWERP, EN METEEN ZIEN
// ═══════════════════════════════════════════════════════════
// Dit is waar stap 4 om draaide. De eerste drie stappen veranderden niets aan
// hoe het dashboard eruitziet; ze zorgden ervoor dat álles uit dezelfde handvol
// namen leest. Daardoor kan dit scherm nu iets wat eerder onmogelijk was: één
// waarde veranderen en het hele dashboard verandert mee, live, zonder bouw.
//
// WAAROM DIT GEEN LOSSE VOORBEELDKAART IS
// ───────────────────────────────────────
// De verleiding is een blokje "voorbeeld" te tekenen waarin je de knoppen ziet.
// Dat is precies wat elke ontwerptool op internet doet, en het is precies wat
// niet werkt: je moet zien hoe een filterrij met acht velden ademt, en hoe een
// tabel met tien kolommen oogt bij minder ruimte. Daarom schrijft dit paneel de
// waarden op de pagina zélf. Alles wat je op dit scherm ziet (de kopbalk, de
// kaarten, de knoppen, de tabellen, de meters) verandert mee, want dat zijn
// dezelfde bouwstenen als overal.
//
// WAT DIT BEWUST NIET DOET
// ────────────────────────
// Het legt niets vast. Je draait, je kijkt, en als het bevalt gaat het via een
// wijziging in de code echt live. Dat is met opzet: een ontwerp dat alleen in
// jouw browser staat is geen ontwerp, en de rest van het dashboard (en straks
// een ander bureau met een eigen omgeving) moet hetzelfde krijgen.
// ═══════════════════════════════════════════════════════════

type Token = { naam: string; waarde: string };

type Thema = {
  accent: string;
  letter: string;
  /** Vermenigvuldiger op de ruimte-schaal: 0,8 is compact, 1,25 is ruim. */
  ruimte: number;
  /** Vermenigvuldiger op de tekst-schaal. */
  tekst: number;
  /** De drie rondingen, van klein naar kaart. */
  ronding: [number, number, number];
  /** Hoe diep de schaduwen zijn: 0 is plat. */
  diepte: number;
};

const PINGWIN_ORANJE = "#E7773F";

const BASIS: Thema = {
  accent: PINGWIN_ORANJE,
  letter: "'Montserrat', sans-serif",
  ruimte: 1,
  tekst: 1,
  ronding: [6, 10, 14],
  diepte: 1,
};

/**
 * Vier afgemaakte richtingen binnen de Pingwin-huisstijl.
 *
 * Bewust hele werelden en geen losse knopjes: kiezen tussen "zacht en luchtig"
 * en "strak en zakelijk" kan iedereen, kiezen tussen 10 en 12 pixels ronding
 * niemand. De losse knoppen eronder zijn om bij te sturen nadat je een richting
 * hebt gekozen.
 */
const RICHTINGEN: { naam: string; wat: string; thema: Thema }[] = [
  { naam: "Zoals het nu is", wat: "De huidige stand, om tegen af te zetten.", thema: BASIS },
  {
    naam: "Strak en zakelijk", wat: "Minder ronding, vlakkere schaduw, compacter. Meer op het scherm, zakelijker toon.",
    thema: { ...BASIS, ruimte: 0.85, tekst: 0.95, ronding: [4, 6, 8], diepte: 0.4 },
  },
  {
    naam: "Zacht en luchtig", wat: "Rondere hoeken, meer lucht, iets grotere tekst. Rustiger om lang naar te kijken.",
    thema: { ...BASIS, ruimte: 1.25, tekst: 1.05, ronding: [10, 16, 22], diepte: 1.4 },
  },
  {
    naam: "Rustig en datadicht", wat: "Vlak, compact en gedempt. Voor schermen die vooral tabellen en cijfers zijn.",
    thema: { ...BASIS, accent: "#C9622F", ruimte: 0.8, tekst: 0.95, ronding: [3, 5, 7], diepte: 0 },
  },
];

const LETTERTYPES: { naam: string; waarde: string }[] = [
  { naam: "Montserrat (huisstijl)", waarde: "'Montserrat', sans-serif" },
  { naam: "Systeem", waarde: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { naam: "Schreefloos klassiek", waarde: "Helvetica, Arial, sans-serif" },
  { naam: "Met schreef", waarde: "Georgia, 'Times New Roman', serif" },
];

/** #rrggbb naar drie getallen. */
function rgb(hex: string): [number, number, number] {
  const k = hex.replace("#", "");
  const zes = k.length === 3 ? k.split("").map((c) => c + c).join("") : k;
  return [parseInt(zes.slice(0, 2), 16), parseInt(zes.slice(2, 4), 16), parseInt(zes.slice(4, 6), 16)];
}
const naarHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");

/** Donkerder maken voor de tekst- en hover-variant van het accent. */
const donkerder = (hex: string, deel: number) => {
  const [r, g, b] = rgb(hex);
  return naarHex(r * (1 - deel), g * (1 - deel), b * (1 - deel));
};
/** Een heel lichte tint van het accent, voor vlakken. */
const lichter = (hex: string, deel: number) => {
  const [r, g, b] = rgb(hex);
  return naarHex(r + (255 - r) * deel, g + (255 - g) * deel, b + (255 - b) * deel);
};

export default function Speelruimte({ tokens }: { tokens: Token[] }) {
  const [thema, setThema] = useState<Thema>(BASIS);
  const [open, setOpen] = useState(false);

  // De uitgangswaarden komen uit de tokens zoals ze nu in de opmaak staan, niet
  // uit een kopie hier. Anders lopen dit paneel en het echte dashboard uit
  // elkaar zodra iemand een token wijzigt, en dan speel je met iets anders dan
  // wat je hebt.
  const basisPx = (voorvoegsel: string) =>
    tokens
      .filter((t) => t.naam.startsWith(voorvoegsel) && /^\d+(\.\d+)?px$/.test(t.waarde.trim()))
      .map((t) => ({ naam: t.naam, px: parseFloat(t.waarde) }));

  useEffect(() => {
    const r = document.documentElement;
    const gezet: string[] = [];
    const zet = (naam: string, waarde: string) => { r.style.setProperty(naam, waarde); gezet.push(naam); };

    zet("--letter", thema.letter);
    zet("--orange", thema.accent);
    zet("--accent", thema.accent);
    zet("--orange-dark", donkerder(thema.accent, 0.18));
    zet("--orange-light", lichter(thema.accent, 0.9));
    zet("--brand-orange-faint", lichter(thema.accent, 0.96));

    for (const { naam, px } of basisPx("--s-")) if (px > 0) zet(naam, `${Math.round(px * thema.ruimte)}px`);
    for (const { naam, px } of basisPx("--fs-")) zet(naam, `${Math.round(px * thema.tekst * 2) / 2}px`);
    for (const { naam, px } of basisPx("--lh-")) zet(naam, `${Math.round(px * thema.tekst)}px`);
    const [klein, knop, kaart] = thema.ronding;
    zet("--r-sm", `${klein}px`); zet("--r-md", `${knop}px`); zet("--r-lg", `${kaart}px`);

    const d = thema.diepte;
    zet("--shadow-sm", d === 0 ? "none" : `0 1px ${3 * d}px rgba(51, 48, 46, ${0.06 * d})`);
    zet("--shadow-md", d === 0 ? "none" : `0 ${4 * d}px ${16 * d}px rgba(51, 48, 46, ${0.07 * d}), 0 1px 3px rgba(51, 48, 46, ${0.05 * d})`);
    zet("--shadow-lg", d === 0 ? "none" : `0 ${8 * d}px ${24 * d}px rgba(51, 48, 46, ${0.1 * d}), 0 2px 6px rgba(51, 48, 46, ${0.06 * d})`);

    // Weghalen bij het verlaten, zodat het scherm nooit in een halve stand
    // achterblijft als dit paneel verdwijnt.
    return () => { for (const naam of gezet) r.style.removeProperty(naam); };
  }, [thema, tokens]);

  const isBasis = JSON.stringify(thema) === JSON.stringify(BASIS);

  return (
    <div className="card section">
      <h2 className="stijl-h2">Speelruimte</h2>
      <p className="stijl-p">
        Draai hieraan en kijk wat er met dit scherm gebeurt. Alles wat je ziet verandert mee, want
        de kopbalk, de kaarten, de knoppen en de tabellen hier zijn dezelfde bouwstenen als op elk
        ander scherm. Dit is wat de eerste drie stappen mogelijk maakten.
      </p>
      <p className="stijl-p stijl-p-klein">
        Het legt niets vast: je speelt in je eigen browser, en bij het verlaten van deze pagina
        staat alles weer zoals het was. Bevalt een richting, zeg welke, dan zet ik hem echt door
        voor het hele dashboard.
      </p>

      <h3 className="stijl-h3">Kies een richting</h3>
      <div className="stijl-richtingen">
        {RICHTINGEN.map((r) => {
          const gekozen = JSON.stringify(thema) === JSON.stringify(r.thema);
          return (
            <button
              key={r.naam}
              type="button"
              className={gekozen ? "btn btn-primary stijl-richting" : "btn btn-ghost stijl-richting"}
              onClick={() => setThema(r.thema)}
            >
              <span className="stijl-richting-naam">{r.naam}</span>
              <span className="stijl-richting-wat">{r.wat}</span>
            </button>
          );
        })}
      </div>

      <h3 className="stijl-h3">Zelf bijsturen</h3>
      <div className="stijl-knoppen">
        <label className="stijl-knop">
          <span className="stijl-knop-naam">Accentkleur</span>
          <input
            type="color"
            className="stijl-kleurkiezer"
            value={thema.accent}
            onChange={(e) => setThema({ ...thema, accent: e.target.value })}
          />
        </label>

        <label className="stijl-knop">
          <span className="stijl-knop-naam">Lettertype</span>
          <select
            className="stijl-keuze"
            value={thema.letter}
            onChange={(e) => setThema({ ...thema, letter: e.target.value })}
          >
            {LETTERTYPES.map((l) => <option key={l.naam} value={l.waarde}>{l.naam}</option>)}
          </select>
        </label>

        <Schuif naam="Ruimte" waarde={thema.ruimte} min={0.7} max={1.4} stap={0.05}
          toon={`${Math.round(thema.ruimte * 100)}%`}
          bij={(v) => setThema({ ...thema, ruimte: v })} />
        <Schuif naam="Tekstgrootte" waarde={thema.tekst} min={0.85} max={1.2} stap={0.05}
          toon={`${Math.round(thema.tekst * 100)}%`}
          bij={(v) => setThema({ ...thema, tekst: v })} />
        <Schuif naam="Ronding" waarde={thema.ronding[1]} min={0} max={24} stap={1}
          toon={`${thema.ronding[1]}px`}
          bij={(v) => setThema({ ...thema, ronding: [Math.round(v * 0.6), v, Math.round(v * 1.4)] })} />
        <Schuif naam="Diepte" waarde={thema.diepte} min={0} max={2} stap={0.1}
          toon={thema.diepte === 0 ? "vlak" : `${Math.round(thema.diepte * 100)}%`}
          bij={(v) => setThema({ ...thema, diepte: v })} />
      </div>

      <div className="stijl-speel-voet">
        <button type="button" className="btn btn-quiet btn-klein" onClick={() => setThema(BASIS)} disabled={isBasis}>
          Zet alles terug
        </button>
        <button type="button" className="btn btn-ghost btn-klein" onClick={() => setOpen(!open)}>
          {open ? "Verberg de waarden" : "Toon de waarden"}
        </button>
      </div>
      {open && (
        <pre className="stijl-waardenblok">{
`accentkleur   ${thema.accent}
lettertype    ${thema.letter}
ruimte        ${Math.round(thema.ruimte * 100)}%
tekstgrootte  ${Math.round(thema.tekst * 100)}%
ronding       ${thema.ronding.join("px / ")}px
diepte        ${thema.diepte === 0 ? "vlak" : `${Math.round(thema.diepte * 100)}%`}`
        }</pre>
      )}
    </div>
  );
}

/** Eén schuifje met zijn naam en de stand ernaast. */
function Schuif({ naam, waarde, min, max, stap, toon, bij }: {
  naam: string; waarde: number; min: number; max: number; stap: number; toon: string; bij: (v: number) => void;
}) {
  return (
    <label className="stijl-knop">
      <span className="stijl-knop-naam">{naam}<span className="stijl-knop-stand">{toon}</span></span>
      <input
        type="range" className="stijl-schuif"
        min={min} max={max} step={stap} value={waarde}
        onChange={(e) => bij(Number(e.target.value))}
      />
    </label>
  );
}

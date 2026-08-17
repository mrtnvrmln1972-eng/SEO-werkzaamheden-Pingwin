"use client";

// ═══════════════════════════════════════════════════════════
// DE KLANTENKIEZER IN DE KOPBALK VAN DE COCKPIT
// ═══════════════════════════════════════════════════════════
// Dit was een gewone uitklaplijst met twee kopjes erin: de eigen klanten en die
// van Multimedia Concepts, alles onder elkaar. Met dertig bedrijven erin werkt dat
// niet meer. Twee dingen gingen er mis:
//  - De leads stonden ertussen alsof het klanten waren. Een lead is een bedrijf
//    waar we nog niets voor doen; die hoort niet in dezelfde lijst te staan als
//    iemand die betaalt.
//  - De klanten van Multimedia Concepts (het grootste deel van de lijst) duwden
//    de eigen klanten uit beeld, terwijl je ze meestal niet nodig hebt.
//
// Vandaar deze eigen kiezer in plaats van een standaard uitklaplijst: die kan
// namelijk geen groep die je zelf openklapt. Nu staan de eigen klanten meteen in
// beeld, en zijn Multimedia Concepts en de leads elk één regel die je openklikt.
// Wie erin zit blijft altijd zichtbaar: open je de cockpit van een lead, dan staat
// die groep vanzelf open, anders zou je niet zien waar je bent.
//
// Het zoekveldje bovenaan is er om dezelfde reden: bij dertig bedrijven is typen
// sneller dan scrollen. Zodra je typt gaan alle groepen open, want een zoekterm
// die iets vindt in een dichtgeklapte groep zou anders niets lijken op te leveren.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";

export type KiezerKlant = {
  slug: string;
  name: string;
  /** Klantgroep: leeg is een eigen klant, "mmc" is Multimedia Concepts. */
  grp?: string | null;
  /** Levensfase: "lead" hoort niet bij de klanten thuis. */
  fase?: string | null;
  /** Vinkje: mooie ontwikkeling uit de nachtelijke trend-berekening. */
  goed?: boolean;
};

type Groep = { sleutel: string; label: string; klanten: KiezerKlant[]; standaardOpen: boolean };

export default function KlantKiezer({ klanten, huidig, onKies, onVooruit }: {
  klanten: KiezerKlant[];
  huidig: string;
  onKies: (slug: string, naam: string) => void;
  /** Alvast klaarzetten zodra iemand een naam aanwijst, nog vóór de klik. */
  onVooruit?: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoekRef = useRef<HTMLInputElement>(null);

  const hier = klanten.find((c) => c.slug === huidig);

  // De indeling. Volgorde is de volgorde waarin je ze nodig hebt: eigen klanten
  // eerst, dan de klanten van Multimedia Concepts, dan de leads.
  const groepen = useMemo<Groep[]>(() => {
    const isLead = (c: KiezerKlant) => (c.fase || "klant") === "lead";
    const lijst: Groep[] = [
      {
        sleutel: "eigen", label: "Mijn eigen klanten",
        klanten: klanten.filter((c) => !isLead(c) && c.grp !== "mmc"),
        standaardOpen: true,
      },
      {
        sleutel: "mmc", label: "Multimedia Concepts",
        klanten: klanten.filter((c) => !isLead(c) && c.grp === "mmc"),
        // Dicht, tenzij je er zelf in zit: dan zou je niet zien waar je bent.
        standaardOpen: hier?.grp === "mmc",
      },
      {
        sleutel: "leads", label: "Leads",
        klanten: klanten.filter(isLead),
        standaardOpen: !!hier && isLead(hier),
      },
    ];
    return lijst.filter((g) => g.klanten.length > 0);
  }, [klanten, hier]);

  const term = zoek.trim().toLowerCase();
  const gefilterd = useMemo(
    () => groepen
      .map((g) => ({ ...g, klanten: term ? g.klanten.filter((c) => c.name.toLowerCase().includes(term)) : g.klanten }))
      .filter((g) => g.klanten.length > 0),
    [groepen, term],
  );

  // Sluiten met Escape of een klik ernaast; hetzelfde gedrag als de menu's
  // rechtsboven, zodat alles in de kopbalk zich gelijk gedraagt.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Bij openen meteen in het zoekveld staan: dan is typen de snelste weg en hoeft
  // niemand eerst met de muis te mikken.
  useEffect(() => { if (open) zoekRef.current?.focus(); }, [open]);

  function isOpen(g: Groep): boolean {
    if (term) return true;                       // zoeken klapt alles open
    return uitgeklapt[g.sleutel] ?? g.standaardOpen;
  }

  return (
    <div className="hm-wrap kk-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"kk-knop" + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        title="Wissel van klant"
        onClick={() => { setOpen((v) => !v); setZoek(""); }}
      >
        <span className="kk-naam">{hier?.name || "Kies een klant"}</span>
        <svg className="hm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="hm-paneel kk-paneel" role="dialog" aria-label="Kies een klant">
          <input
            ref={zoekRef}
            className="kk-zoek"
            type="search"
            value={zoek}
            placeholder="Zoek een bedrijf"
            onChange={(e) => setZoek(e.target.value)}
          />

          <div className="kk-lijst">
            {gefilterd.length === 0 && <div className="kk-leeg">Niets gevonden.</div>}
            {gefilterd.map((g) => {
              const opengeklapt = isOpen(g);
              return (
                <div className="kk-groep" key={g.sleutel}>
                  <button
                    type="button"
                    className={"kk-groep-kop" + (opengeklapt ? " kk-groep-open" : "")}
                    aria-expanded={opengeklapt}
                    onClick={() => setUitgeklapt((v) => ({ ...v, [g.sleutel]: !opengeklapt }))}
                  >
                    <svg className="kk-caret" viewBox="0 0 10 6" aria-hidden="true">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="kk-groep-label">{g.label}</span>
                    <span className="kk-aantal">{g.klanten.length}</span>
                  </button>
                  {opengeklapt && g.klanten.map((c) => (
                    <button
                      type="button"
                      key={c.slug}
                      className={"kk-item" + (c.slug === huidig ? " kk-item-actief" : "")}
                      // Voorladen zodra je een naam aanwijst. De cockpit van een
                      // klant moet server-zijdig zijn gegevens ophalen, en dat
                      // begon pas op het moment dat je klikte; je keek dus altijd
                      // een seconde of twee tegen "laden…" aan. Tussen aanwijzen
                      // en klikken zit bijna altijd genoeg tijd om dat al te doen,
                      // dus de pagina staat er meestal al als je loslaat.
                      // onFocus zit erbij voor wie met het toetsenbord kiest.
                      onMouseEnter={() => { if (c.slug !== huidig) onVooruit?.(c.slug); }}
                      onFocus={() => { if (c.slug !== huidig) onVooruit?.(c.slug); }}
                      onClick={() => { setOpen(false); if (c.slug !== huidig) onKies(c.slug, c.name); }}
                    >
                      <span className="kk-item-naam">{c.name}</span>
                      {c.goed && <span className="kk-vink" title="Mooie ontwikkeling">✓</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

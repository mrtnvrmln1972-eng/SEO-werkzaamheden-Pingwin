"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Voortgang from "./Voortgang";

// ═══════════════════════════════════════════════════════════
// WAT DRAAIT ER NU: ZICHTBAAR OP ELK TABBLAD
// ═══════════════════════════════════════════════════════════
// Het probleem dat dit oplost: je start een scan, klikt door naar een andere
// pagina, en dan is het molentje weg. Niet omdat het werk stopte (dat draait
// server-side door), maar omdat alleen dát ene scherm ervan wist.
//
// Dit klusje staat in de kop van de cockpit en blijft dus staan waar je ook
// heen klikt. Klap je hem open, dan zie je per klus hetzelfde rondje met
// dezelfde tekst als op het tabblad zelf, plus de weg terug erheen.
// Draait er niets, dan staat er ook niets.
// ═══════════════════════════════════════════════════════════

type Klus = {
  soort: string; naam: string; status: "bezig" | "klaar" | "fout" | "vastgelopen";
  stap: number; stappen: number; label: string; error: string;
  gestart: string | null; bijgewerkt: string | null; tab?: string;
};

export default function KlussenChip({ slug, onGaNaar }: { slug: string; onGaNaar?: (tab: string) => void }) {
  const [klussen, setKlussen] = useState<Klus[]>([]);
  const [open, setOpen] = useState(false);
  const doosje = useRef<HTMLDivElement | null>(null);

  const haal = useCallback(async () => {
    try {
      const d = await fetch(`/api/admin/klussen?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d?.ok) setKlussen(d.klussen || []);
    } catch { /* stil: volgende tik opnieuw */ }
  }, [slug]);

  // Elke tien seconden kijken. Bewust ook als er niets draait: een scan die op
  // een ander tabblad (of in een ander venster) gestart is moet hier vanzelf
  // verschijnen, anders is het klusje alleen betrouwbaar op de plek waar je
  // toevallig geklikt hebt.
  useEffect(() => {
    void haal();
    const t = setInterval(() => { void haal(); }, 10000);
    return () => clearInterval(t);
  }, [haal]);

  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => { if (doosje.current && !doosje.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", buiten);
    return () => document.removeEventListener("mousedown", buiten);
  }, [open]);

  if (!klussen.length) return null;

  const vast = klussen.some((k) => k.status === "vastgelopen");

  return (
    <div className="klus-chip-wrap" ref={doosje}>
      <button
        type="button"
        className={"klus-chip" + (vast ? " klus-chip-stil" : "")}
        onClick={() => setOpen((v) => !v)}
        title="Wat er op dit moment op de achtergrond draait voor deze klant"
      >
        <span className="klus-chip-ring" aria-hidden="true" />
        {klussen.length === 1 ? klussen[0].naam : `${klussen.length} klussen bezig`}
      </button>

      {open && (
        <div className="klus-doos">
          <div className="klus-doos-kop">Op de achtergrond</div>
          {klussen.map((k) => (
            <div className="klus-doos-rij" key={k.soort}>
              <Voortgang
                titel={k.naam}
                label={k.label}
                stap={k.stap}
                stappen={k.stappen}
                sinds={k.gestart || k.bijgewerkt}
                stil={k.status === "vastgelopen"}
              />
              {k.tab && onGaNaar && (
                <button type="button" className="ghost-btn small" onClick={() => { setOpen(false); onGaNaar(k.tab!); }}>
                  Ga erheen →
                </button>
              )}
            </div>
          ))}
          <p className="klus-doos-voet">Alles hierboven draait op de server. Je kunt gerust doorklikken of het venster sluiten.</p>
        </div>
      )}
    </div>
  );
}

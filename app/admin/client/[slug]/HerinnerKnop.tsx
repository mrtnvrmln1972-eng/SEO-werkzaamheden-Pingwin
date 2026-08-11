"use client";

// ═══════════════════════════════════════════════════════════
// HERINNER ME: klein klokje in de planningsregel
// ═══════════════════════════════════════════════════════════
// Zelfde soort uitklap-veldje als de datumkiezer ernaast (zelfde plek, zelfde
// vorm), maar dan om jezelf over een paar dagen te laten checken of iets ook
// echt gebeurd is. Gebruikt hetzelfde belletje-mechanisme als bij het mailen
// of doorzetten naar de developer (lib/mail-opvolg.ts); dit veldje maakt het
// alleen los daarvan bereikbaar, bij elke taak, op elk moment.

import { useEffect, useRef, useState } from "react";

const PRESETS: [number, string][] = [[3, "3 dagen"], [7, "1 week"], [14, "2 weken"]];

export default function HerinnerKnop({ slug, id }: { slug: string; id: number }) {
  const [open, setOpen] = useState(false);
  const [eigen, setEigen] = useState("");
  const [bezig, setBezig] = useState(false);
  const [gedaan, setGedaan] = useState(false);
  const doosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => { if (doosRef.current && !doosRef.current.contains(e.target as Node)) setOpen(false); };
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", toets);
    return () => { document.removeEventListener("mousedown", buiten); document.removeEventListener("keydown", toets); };
  }, [open]);

  async function zet(dagen: number) {
    if (bezig || !dagen) return;
    setBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan/herinner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, dagen }),
      }).then((r) => r.json());
      if (d?.ok) { setGedaan(true); setTimeout(() => { setOpen(false); setGedaan(false); setEigen(""); }, 900); }
    } catch { /* geen melding zetten; de knop blijft gewoon staan om opnieuw te proberen */ }
    finally { setBezig(false); }
  }

  return (
    <div className="hr" ref={doosRef} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="wp-icon hr-veld" title="Herinner me later om te checken of dit is gebeurd"
        onClick={() => setOpen(!open)}>⏰</button>
      {open && (
        <div className="hr-doos" role="dialog" aria-label="Herinner me">
          {gedaan ? (
            <div className="hr-ok">✓ Herinnering gezet</div>
          ) : (
            <>
              <div className="hr-kop">Herinner me over</div>
              <div className="hr-rij">
                {PRESETS.map(([dagen, label]) => (
                  <button key={dagen} type="button" className="hr-actie" disabled={bezig} onClick={() => void zet(dagen)}>{label}</button>
                ))}
              </div>
              <div className="hr-eigen">
                <input type="number" min={1} max={90} placeholder="aantal" value={eigen}
                  onChange={(e) => setEigen(e.target.value)} />
                <span>dagen</span>
                <button type="button" className="hr-actie" disabled={bezig || !Number(eigen)} onClick={() => void zet(Number(eigen))}>Zet</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

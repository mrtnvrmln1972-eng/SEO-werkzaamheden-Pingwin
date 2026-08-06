"use client";

import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// KLANTWAARDE EN CONVERSIE VOOR ALLE KLANTEN IN ÉÉN SCHERM
// ═══════════════════════════════════════════════════════════
// Dit is het enige stuk van de onboarding dat niet automatisch kan: wat één
// klant opbrengt en welk deel van de bezoekers klant wordt. Het ontbrak bij alle
// negentien klanten, en dat blokkeert elk bedrag in de opruimlijst en de
// prioriteitenscan: zonder deze twee getallen kan het dashboard wel zeggen
// "dit levert 400 extra bezoekers op", maar niet wat dat waard is.
//
// Negentien keer doorklikken naar een tabje kost een middag; negentien regeltjes
// op één scherm kost een kwartier. Vandaar dit blok.
// ═══════════════════════════════════════════════════════════

type Rij = { slug: string; naam: string; klantwaarde: number; conversie: number; ingevuld: boolean };

export default function KlantwaardeBulk() {
  const [open, setOpen] = useState(false);
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [bewaard, setBewaard] = useState("");

  const haal = useCallback(async () => {
    setLaden(true); setFout("");
    try {
      const d = await fetch("/api/admin/klantwaarde").then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "Kon de gegevens niet ophalen."); return; }
      setRijen(d.rijen as Rij[]);
    } catch { setFout("Kon de gegevens niet ophalen."); }
    finally { setLaden(false); }
  }, []);

  useEffect(() => { if (open && !rijen.length) void haal(); }, [open, rijen.length, haal]);

  function zet(slug: string, veld: "klantwaarde" | "conversie", waarde: string) {
    setBewaard("");
    setRijen((rs) => rs.map((r) => (r.slug === slug ? { ...r, [veld]: Number(waarde.replace(",", ".")) || 0 } : r)));
  }

  async function bewaar() {
    if (bezig) return;
    setBezig(true); setFout(""); setBewaard("");
    try {
      // Alleen de regels die iets bevatten; een lege regel overschrijft niets.
      const teBewaren = rijen.filter((r) => r.klantwaarde > 0 || r.conversie > 0);
      const d = await fetch("/api/admin/klantwaarde", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rijen: teBewaren.map((r) => ({ slug: r.slug, klantwaarde: r.klantwaarde, conversie: r.conversie })) }),
      }).then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "Opslaan mislukte."); return; }
      const perSlug = new Map((d.rijen as Rij[]).map((r) => [r.slug, r]));
      setRijen((rs) => rs.map((r) => ({ ...r, ...(perSlug.get(r.slug) || {}) })));
      setBewaard(`${(d.rijen as Rij[]).filter((r) => r.ingevuld).length} klanten hebben nu een bedrag.`);
    } catch { setFout("Opslaan mislukte."); }
    finally { setBezig(false); }
  }

  const nogLeeg = rijen.filter((r) => !r.ingevuld).length;

  return (
    <div className="bulk-onb card">
      <div className="bulk-kop">
        <div>
          <strong>Klantwaarde en conversie invullen</strong>
          <p className="muted">
            Het enige dat het dashboard niet zelf kan opzoeken. Zonder deze twee getallen kan geen enkele
            opruim- of prioriteitenlijst een bedrag noemen, alleen een aantal bezoekers.
          </p>
        </div>
        <div className="bulk-knoppen">
          <button type="button" className="logout-btn" onClick={() => setOpen((v) => !v)}>
            {open ? "− Sluiten" : "+ Invullen"}
          </button>
        </div>
      </div>

      {open && (
        <div className="bulk-kies">
          {laden && <p className="muted">Bezig met ophalen…</p>}
          {fout && <p className="bulk-fout">{fout}</p>}
          {bewaard && <p className="kw-ok">{bewaard}</p>}

          {!laden && rijen.length > 0 && (
            <>
              <p className="bulk-uitleg">
                <strong>Klantwaarde</strong> is wat één klant gemiddeld opbrengt, in euro. <strong>Conversie</strong> is
                welk deel van de bezoekers klant wordt, in procenten. Schat gerust: voor de volgorde van de lijsten
                maakt het niets uit, want elke regel krijgt dezelfde vermenigvuldiging. Voor het bedrag zelf wel.
              </p>

              <ul className="kw-lijst">
                <li className="kw-kop">
                  <span>Klant</span><span>Klantwaarde</span><span>Conversie</span>
                </li>
                {rijen.map((r) => (
                  <li key={r.slug} className={r.ingevuld ? "kw-rij kw-vol" : "kw-rij"}>
                    <span className="kw-naam">{r.naam}</span>
                    <label className="kw-veld">
                      <span aria-hidden="true">&euro;</span>
                      <input
                        type="number" min={0} step={25} inputMode="numeric"
                        value={r.klantwaarde || ""}
                        onChange={(e) => zet(r.slug, "klantwaarde", e.target.value)}
                        placeholder="0"
                        aria-label={`Klantwaarde van ${r.naam} in euro`}
                      />
                    </label>
                    <label className="kw-veld">
                      <input
                        type="number" min={0} max={100} step={0.5} inputMode="decimal"
                        value={r.conversie || ""}
                        onChange={(e) => zet(r.slug, "conversie", e.target.value)}
                        placeholder="0"
                        aria-label={`Conversie van ${r.naam} in procenten`}
                      />
                      <span aria-hidden="true">%</span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="bulk-acties">
                <button type="button" className="primary-btn" onClick={bewaar} disabled={bezig}>
                  {bezig ? "Bezig…" : "Alles opslaan"}
                </button>
                <span className="muted">
                  {nogLeeg > 0 ? `${nogLeeg} van de ${rijen.length} klanten heeft nog geen bedrag.` : "Alle klanten hebben een bedrag."}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

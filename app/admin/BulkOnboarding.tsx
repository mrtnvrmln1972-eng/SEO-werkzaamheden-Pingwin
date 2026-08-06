"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GOLVEN, GOLF_LABEL, GOLF_UITLEG, GOLF_UNITS, type Golf, type BulkStand, type Raming } from "../../lib/onboarding-golven";

// ═══════════════════════════════════════════════════════════
// ALLE KLANTEN IN ÉÉN KEER, MET DE PRIJS ERBIJ
// ═══════════════════════════════════════════════════════════
// Dertien klanten met de hand langslopen is zonde van de tijd, maar ze allemaal
// tegelijk alles laten doen kost meer Ahrefs-tegoed dan er in een kwartaal in
// gaat. Dit scherm lost dat op door de prijs vóór de klik te tonen: je ziet per
// golf wie het nodig heeft, wat het kost, en hoeveel er daarna nog over is.
//
// Bewust géén stille afkapping: past het niet, dan zegt het scherm dat en start
// er niets. Een bulkrun die halverwege je maand leegtrekt is erger dan een
// bulkrun die niet begint.
// ═══════════════════════════════════════════════════════════

const nl = (n: number) => n.toLocaleString("nl-NL");

const STATUS_TEKST: Record<string, string> = {
  wacht: "in de rij",
  bezig: "draait",
  klaar: "klaar",
  mislukt: "mislukt",
  afgebroken: "gestopt",
};

export default function BulkOnboarding() {
  const [open, setOpen] = useState(false);
  const [golf, setGolf] = useState<Golf>("basis");
  const [raming, setRaming] = useState<Raming | null>(null);
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [stand, setStand] = useState<BulkStand | null>(null);
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const haalRaming = useCallback(async (g: Golf) => {
    setLaden(true); setFout("");
    try {
      const d = await fetch(`/api/admin/onboarding-bulk?golf=${g}`).then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "Kon de raming niet ophalen."); setRaming(null); return; }
      setRaming(d.raming as Raming);
      // Standaard staat alles aan wat het nodig heeft; je vinkt af wat je niet wilt.
      setGekozen(new Set((d.raming as Raming).klanten.filter((k) => k.nodig).map((k) => k.slug)));
    } catch { setFout("Kon de raming niet ophalen."); }
    finally { setLaden(false); }
  }, []);

  const haalStand = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/onboarding-bulk").then((r) => r.json());
      if (d?.ok) setStand(d.stand as BulkStand);
    } catch { /* stil: de stand is een extraatje, geen voorwaarde */ }
  }, []);

  useEffect(() => { void haalStand(); }, [haalStand]);
  useEffect(() => { if (open) void haalRaming(golf); }, [open, golf, haalRaming]);

  // Zolang de rij loopt elke tien seconden verversen, daarna vanzelf stoppen.
  useEffect(() => {
    if (!stand?.actief) { if (timer.current) clearTimeout(timer.current); return; }
    timer.current = setTimeout(() => { void haalStand(); }, 10000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [stand, haalStand]);

  const kosten = raming ? gekozen.size * GOLF_UNITS[golf] : 0;
  const over = raming?.over ?? null;
  const na = over == null ? null : over - kosten;
  const past = na == null || na >= (raming?.bodem ?? 50000);

  async function start() {
    if (bezig || !gekozen.size) return;
    setBezig(true); setFout("");
    try {
      const d = await fetch("/api/admin/onboarding-bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ golf, slugs: [...gekozen] }),
      }).then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "Starten mislukte."); return; }
      setStand(d.stand as BulkStand);
      setOpen(false);
    } catch { setFout("Starten mislukte."); }
    finally { setBezig(false); }
  }

  async function stop() {
    if (bezig) return;
    setBezig(true);
    try {
      await fetch("/api/admin/onboarding-bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stop: true }),
      });
      await haalStand();
    } catch { setFout("Stoppen mislukte."); }
    finally { setBezig(false); }
  }

  const draait = stand?.rijen.filter((r) => r.status === "bezig" || r.status === "wacht") || [];
  const gedaan = stand?.rijen.filter((r) => r.status === "klaar") || [];

  return (
    <div className="bulk-onb card">
      <div className="bulk-kop">
        <div>
          <strong>Onboarding voor alle klanten</strong>
          <p className="muted">
            Werkt de klanten één voor één bij en slaat over wat al staat. De prijs staat erbij vóór je start,
            en de rij stopt zichzelf als je Ahrefs-tegoed onder de ondergrens zakt.
          </p>
        </div>
        <div className="bulk-knoppen">
          {stand?.actief
            ? <button type="button" className="logout-btn" onClick={stop} disabled={bezig}>Rij stoppen</button>
            : <button type="button" className="logout-btn" onClick={() => setOpen((v) => !v)}>{open ? "− Sluiten" : "+ Rij samenstellen"}</button>}
        </div>
      </div>

      {/* ── De lopende rij ── */}
      {stand && stand.rijen.length > 0 && (
        <div className="bulk-rij">
          {stand.actief && (
            <p className="bulk-live">
              <span className="bulk-stip" aria-hidden="true" />
              {draait.filter((r) => r.status === "bezig").map((r) => r.naam).join(", ") || "Wachtend op de volgende tik"}
              {draait.length > 0 && <span className="muted"> &middot; nog {draait.length} te gaan</span>}
            </p>
          )}
          {stand.gestopt && <p className="bulk-fout">{stand.gestopt}</p>}
          <ul className="bulk-lijst">
            {stand.rijen.map((r) => (
              <li key={r.slug} className={`bulk-item bulk-${r.status}`}>
                <span className="bulk-chip">{STATUS_TEKST[r.status] || r.status}</span>
                <a href={`/admin/client/${r.slug}?tab=onboarding`}>{r.naam}</a>
                {r.error && <span className="muted"> {r.error}</span>}
              </li>
            ))}
          </ul>
          {gedaan.length > 0 && !stand.actief && (
            <p className="muted">{gedaan.length} van de {stand.rijen.length} klanten afgerond.</p>
          )}
        </div>
      )}

      {/* ── De rij samenstellen ── */}
      {open && (
        <div className="bulk-kies">
          <div className="bulk-golven">
            {GOLVEN.map((g) => (
              <button
                key={g}
                type="button"
                className={"bulk-golf" + (golf === g ? " bulk-golf-aan" : "")}
                onClick={() => setGolf(g)}
              >
                <strong>{GOLF_LABEL[g]}</strong>
                <span className="muted">± {nl(GOLF_UNITS[g])} units per klant</span>
              </button>
            ))}
          </div>
          <p className="bulk-uitleg">{GOLF_UITLEG[golf]}</p>

          {laden && <p className="muted">Bezig met kijken wat elke klant nog nodig heeft…</p>}
          {fout && <p className="bulk-fout">{fout}</p>}

          {raming && !laden && (
            <>
              <div className="bulk-som">
                <div><span className="muted">Aangevinkt</span><strong>{gekozen.size} klanten</strong></div>
                <div><span className="muted">Kost ongeveer</span><strong>{nl(kosten)} units</strong></div>
                <div><span className="muted">Nu nog over</span><strong>{over == null ? "onbekend" : nl(over)}</strong></div>
                <div className={past ? "" : "bulk-krap"}>
                  <span className="muted">Daarna over</span>
                  <strong>{na == null ? "onbekend" : nl(Math.max(0, na))}</strong>
                </div>
              </div>
              {!past && (
                <p className="bulk-fout">
                  Dit past niet: er zou minder dan {nl(raming.bodem)} units overblijven, en dan kun je de rest van de
                  maand niet meer normaal werken. Vink klanten af, of kies een goedkopere golf.
                </p>
              )}

              <ul className="bulk-klanten">
                {raming.klanten.map((k) => (
                  <li key={k.slug} className={k.nodig ? "" : "bulk-nvt"}>
                    <label>
                      <input
                        type="checkbox"
                        checked={gekozen.has(k.slug)}
                        disabled={!k.nodig}
                        onChange={(e) => setGekozen((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(k.slug); else n.delete(k.slug);
                          return n;
                        })}
                      />
                      <strong>{k.naam}</strong>
                      {k.nodig
                        ? <span className="muted">{k.mist.join(", ")}</span>
                        : <span className="muted">deze golf staat al compleet</span>}
                    </label>
                  </li>
                ))}
              </ul>

              <div className="bulk-acties">
                <button type="button" className="primary-btn" onClick={start} disabled={bezig || !gekozen.size || !past}>
                  {bezig ? "Bezig…" : `Start voor ${gekozen.size} ${gekozen.size === 1 ? "klant" : "klanten"}`}
                </button>
                <span className="muted">
                  Eén klant tegelijk, op de achtergrond. Je kunt dit scherm sluiten; de voortgang staat hierboven.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

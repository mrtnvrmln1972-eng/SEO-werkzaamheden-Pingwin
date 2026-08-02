"use client";

// Bespreeklijsten per persoon: kleine afvinklijstjes onder de Actuele stand van
// zaken. Per persoon (Klant, Dev, ...) een toggle met alles wat Maarten wil
// bespreken, laten uitvoeren of controleren. Afvinken streept door (blijft
// zichtbaar), mailen zet alle open punten in een simpele nette mail en stempelt
// "gedeeld", zodat je ziet wat de ander al heeft en wat er nieuw is.

import { useEffect, useState } from "react";
import { persoonLabel, devVoornaam } from "../../../../lib/personen";

type Item = { id: number; persoon: string; tekst: string; klaar: boolean; gedeeldAt: string | null; createdAt: string | null };

export default function BespreekLijsten({ slug, clientName, clientEmail }: { slug: string; clientName?: string; clientEmail?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [openLijst, setOpenLijst] = useState<string>("");
  const [invoer, setInvoer] = useState<Record<string, string>>({});
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [toonNieuw, setToonNieuw] = useState(false);
  const [busy, setBusy] = useState(false);
  // Developer van DEZE klant; leeg = gewoon "Dev", geen verzonnen naam.
  const [devNaam, setDevNaam] = useState<string | null>(null);

  async function laad() {
    const d = await fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setItems(d.items || []); setDevNaam(d.devName || null); }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  const DEFAULTS = ["Klant", "Dev"];
  const personen = [...new Set([...DEFAULTS, ...items.map((i) => i.persoon)])];
  const van = (p: string) => items.filter((i) => i.persoon === p);
  const labelVan = (p: string) => persoonLabel(p, { devName: devNaam, clientName });

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try { await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) }); await laad(); }
    catch { /* volgende laad herstelt het beeld */ }
    finally { setBusy(false); }
  }
  async function voegToe(p: string) {
    const tekst = (invoer[p] || "").trim();
    if (!tekst) return;
    setInvoer({ ...invoer, [p]: "" });
    await post({ action: "add", persoon: p, tekst });
  }

  function mailLijst(p: string) {
    const open = van(p).filter((i) => !i.klaar);
    if (!open.length) return;
    const naam = p === "Dev" ? devVoornaam(devNaam) : (clientName || "").split(" ")[0] || "";
    const body = encodeURIComponent(
      `Beste ${naam || ""},\n\nHierbij de openstaande punten op een rij:\n\n${open.map((i) => `- ${i.tekst}`).join("\n")}\n\nWil je ze oppakken en even laten weten als iets klaar is of vragen oproept?\n\nMet vriendelijke groet,\nMaarten Vermeulen\nPingwin Online Marketing`,
    );
    const to = p === "Klant" ? (clientEmail || "") : "";
    window.open(`mailto:${to}?subject=${encodeURIComponent(`Punten om op te pakken (${clientName || "Pingwin"})`)}&body=${body}`, "_blank");
    void post({ action: "gedeeld", persoon: p });
  }

  const dd = (d: string | null) => { try { return d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""; } catch { return ""; } };

  return (
    <div className="cockpit-card strategy-card">
      <div className="bl-kop">
        <div className="bl-kop-tekst">
          <span className="strategy-title">Bespreeklijsten</span>
          <span className="bl-sub muted">Per persoon: bijhouden, afvinken en in één klik mailen.</span>
        </div>
        <span className="wp-fase-spacer" />
        {toonNieuw ? (
          <span className="bl-nieuw-rij">
            <input className="wp-docdrop-input" value={nieuwNaam} placeholder="Naam, bijv. Tekstschrijver" autoFocus
              onChange={(e) => setNieuwNaam(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && nieuwNaam.trim()) { setOpenLijst(nieuwNaam.trim()); setToonNieuw(false); void post({ action: "add", persoon: nieuwNaam.trim(), tekst: "Eerste punt (pas aan of verwijder)" }); setNieuwNaam(""); } }} />
          </span>
        ) : (
          <button type="button" className="ghost-btn small" onClick={() => setToonNieuw(true)}>+ lijstje</button>
        )}
      </div>
      {personen.map((p) => {
        const lijst = van(p);
        const open = lijst.filter((i) => !i.klaar);
        const isOpen = openLijst === p;
        const gedeeld = lijst.map((i) => i.gedeeldAt).filter(Boolean).sort().pop() || null;
        return (
          <div key={p} className="bl-lijst">
            <button type="button" className="strategy-head bl-head" onClick={() => setOpenLijst(isOpen ? "" : p)}>
              <span className="strategy-caret">{isOpen ? "▾" : "▸"}</span>
              <span className="bl-titel">Bespreken met {labelVan(p)}</span>
              {open.length > 0 && <span className="wp-count">{open.length}</span>}
              {gedeeld && <span className="bl-gedeeld muted">gedeeld {dd(gedeeld)}</span>}
            </button>
            {isOpen && (
              <div className="bl-body">
                <div className="bl-add">
                  <input className="wp-docdrop-input" value={invoer[p] || ""} placeholder="Nieuw punt, Enter om toe te voegen…"
                    onChange={(e) => setInvoer({ ...invoer, [p]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") void voegToe(p); }} />
                  <button type="button" className="wp-fase-btn" disabled={busy || !(invoer[p] || "").trim()} onClick={() => void voegToe(p)}>Voeg toe</button>
                  <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={busy || !open.length} title="Alle open punten als nette mail; de lijst onthoudt dat je ze gedeeld hebt." onClick={() => mailLijst(p)}>Mail ({open.length})</button>
                </div>
                {lijst.length === 0 && <div className="muted">Nog geen punten; typ hierboven het eerste punt.</div>}
                <ul className="bl-punten">
                  {lijst.map((i) => (
                    <li key={i.id} className={i.klaar ? "bl-klaar" : ""}>
                      <label className="bl-check">
                        <input type="checkbox" checked={i.klaar} onChange={(e) => void post({ action: "vink", id: i.id, klaar: e.target.checked })} />
                      </label>
                      <span className="bl-tekst">{i.tekst}</span>
                      {!i.klaar && i.gedeeldAt == null && gedeeld && <span className="bl-nieuw">nieuw</span>}
                      <button type="button" className="wp-icon wp-del" title="Punt verwijderen" onClick={() => void post({ action: "del", id: i.id })}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

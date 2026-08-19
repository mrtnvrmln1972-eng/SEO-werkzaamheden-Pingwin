"use client";

import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// DE HUBSPOT-KOPPELING, IN GEWONE TAAL
// ═══════════════════════════════════════════════════════════
// Hier staat of de sleutel er is, welke pijplijnen als lead tellen, en de knop om
// nu op te halen. De klikroute om die sleutel te maken staat er helemaal bij, met
// opzet: dan hoeft niemand hem ergens op te zoeken en kan een volgende sessie
// hem hier teruglezen.
//
// Wat hier NIET staat: het budget van een lead. Dat hoort bij de lead zelf, in
// zijn eigen omgeving, want dat is een oordeel per bedrijf en geen instelling.
// ═══════════════════════════════════════════════════════════

type Fase = { id: string; naam: string; kans: number | null; gesloten: boolean; gewonnen: boolean };
type Pijplijn = { id: string; naam: string; fases: Fase[] };
type Instelling = { pijplijnen: string[]; notitiesTerug: boolean; autoLeads: boolean; laatsteRonde: string | null };
type Lead = { slug: string; dealNaam: string; faseNaam: string; opvolgDatum: string | null };

type Stand = {
  ok: boolean;
  gekoppeld: boolean;
  werkt?: boolean;
  melding?: string;
  instelling: Instelling;
  pijplijnen: Pijplijn[];
  leads: Lead[];
};

function wanneer(iso: string | null): string {
  if (!iso) return "nog nooit";
  try {
    return new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function HubSpotBlok() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [bezig, setBezig] = useState("");
  const [melding, setMelding] = useState<{ ok: boolean; text: string } | null>(null);

  const laad = useCallback(async () => {
    try {
      const d = (await fetch("/api/admin/hubspot").then((r) => r.json())) as Stand;
      if (d.ok) setStand(d);
    } catch { /* stil */ }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  async function stuur(body: Record<string, unknown>, naam: string, melden = "") {
    setBezig(naam); setMelding(null);
    try {
      const d = await fetch("/api/admin/hubspot", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      await laad();
      if (d.ok) {
        setMelding({
          ok: true,
          text: melden || (typeof d.gelezen === "number"
            ? `Klaar: ${d.gelezen} deal(s) bekeken, ${d.nieuweLeads} nieuwe lead(s), ${d.dossierStukken} stuk(ken) in een dossier gezet.`
            : "Bewaard."),
        });
      } else setMelding({ ok: false, text: d.error || d.melding || "Dat lukte niet." });
    } catch {
      setMelding({ ok: false, text: "Dat lukte niet." });
    } finally { setBezig(""); }
  }

  const instelling = stand?.instelling;

  return (
    <>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 700, margin: "var(--s-12) 0 var(--s-2)" }}>HubSpot (leads)</h2>
      <p className="muted" style={{ marginBottom: "var(--s-4)" }}>
        Je deals uit HubSpot komen hier binnen als lead: met de fase, de verwachte datum dat ze klant worden, het
        eerstvolgende contactmoment en de notities die je daar maakte. Het beoogde maandbudget zet je in het dashboard,
        bij de lead zelf; een bedrag in HubSpot is meestal een totaalbedrag en dat zou de prognose onbruikbaar maken.
      </p>

      {melding && <div className={melding.ok ? "saved-msg" : "login-error"} style={{ marginBottom: "var(--s-4)" }}>{melding.text}</div>}

      {!stand && <p className="muted">Bezig met ophalen…</p>}

      {stand && !stand.gekoppeld && (
        <div className="created-box">
          <div className="created-title">Nog niet gekoppeld</div>
          <p>
            In HubSpot: instellingen, Integraties, Private apps, Create a private app. Geef hem leesrechten op deals,
            bedrijven, contacten, taken, notities en e-mail. Kopieer de sleutel die je dan krijgt en zet hem in Vercel
            bij het project onder Settings, Environment Variables, met de naam <code>HUBSPOT_TOKEN</code>. Eén keer
            opnieuw deployen en deze pagina laat de stand zien.
          </p>
        </div>
      )}

      {stand?.gekoppeld && (
        <>
          <div className="task-table-wrap">
            <table>
              <thead>
                <tr><th>Onderdeel</th><th>Stand</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Verbinding</td>
                  <td>{stand.werkt ? stand.melding : <span style={{ color: "var(--danger)" }}>{stand.melding}</span>}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Laatst opgehaald</td>
                  <td>{wanneer(instelling?.laatsteRonde || null)} (daarna elk kwartier vanzelf)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Gekoppelde leads</td>
                  <td>{stand.leads.length === 0 ? "nog geen" : `${stand.leads.length}`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="field-wide" style={{ marginTop: "var(--s-5)" }}>
            <label style={{ fontWeight: 600 }}>Welke pijplijnen tellen als lead</label>
            <p className="muted" style={{ marginBottom: "var(--s-2)" }}>
              Niets aangevinkt betekent: alle pijplijnen. Vink aan wat echt een verkooptraject is, anders staat elk half
              koud contact straks in je lijst én in je prognose.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
              {stand.pijplijnen.map((p) => {
                const aan = instelling?.pijplijnen.includes(p.id) ?? false;
                return (
                  <button
                    key={p.id} type="button"
                    className={aan ? "btn btn-primary btn-klein" : "btn btn-klein"}
                    disabled={!!bezig}
                    onClick={() => {
                      const nu = new Set(instelling?.pijplijnen || []);
                      if (aan) nu.delete(p.id); else nu.add(p.id);
                      stuur({ actie: "instellingen", pijplijnen: [...nu] }, "pijplijnen", "Bewaard.");
                    }}
                  >
                    {p.naam}
                  </button>
                );
              })}
              {stand.pijplijnen.length === 0 && <span className="muted">Geen pijplijnen gevonden.</span>}
            </div>
          </div>

          <div className="field-wide" style={{ marginTop: "var(--s-5)" }}>
            <label style={{ fontWeight: 600 }}>Wat de koppeling mag</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginTop: "var(--s-2)" }}>
              <button
                type="button" disabled={!!bezig}
                className={instelling?.autoLeads ? "btn btn-primary btn-klein" : "btn btn-klein"}
                onClick={() => stuur({ actie: "instellingen", autoLeads: !instelling?.autoLeads }, "auto", "Bewaard.")}
              >
                {instelling?.autoLeads ? "Nieuwe deals worden vanzelf een lead" : "Alleen deals die ik zelf koppel"}
              </button>
              <button
                type="button" disabled={!!bezig}
                className={instelling?.notitiesTerug ? "btn btn-primary btn-klein" : "btn btn-klein"}
                onClick={() => stuur({ actie: "instellingen", notitiesTerug: !instelling?.notitiesTerug }, "terug", "Bewaard.")}
              >
                {instelling?.notitiesTerug ? "Notities gaan ook naar HubSpot" : "Niets terugschrijven naar HubSpot"}
              </button>
            </div>
            <p className="muted" style={{ marginTop: "var(--s-2)" }}>
              Terugschrijven betekent alleen: een notitie die je hier typt komt ook als notitie bij de deal te staan. Een
              fase, een bedrag of een datum in HubSpot wordt nooit door het dashboard aangepast.
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginTop: "var(--s-5)" }}>
            <button className="btn btn-primary" disabled={!!bezig} onClick={() => stuur({ actie: "sync" }, "sync")}>
              {bezig === "sync" ? "Bezig met ophalen…" : "Nu ophalen"}
            </button>
            <button className="btn btn-ghost" disabled={!!bezig} onClick={() => stuur({ actie: "sync", volledig: true }, "sync")}>
              {bezig === "sync" ? "Bezig…" : "Alles opnieuw ophalen"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

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
type Veld = { naam: string; label: string; soort: string; opties: { waarde: string; label: string }[] };
type Instelling = {
  bron: "contacten" | "deals";
  filterVeld: string; filterWaarde: string;
  velden: { opvolgDatum: string };
  kans: number;
  pijplijnen: string[]; notitiesTerug: boolean; autoLeads: boolean; laatsteRonde: string | null;
};
type Lead = { slug: string; dealNaam: string; faseNaam: string; opvolgDatum: string | null };

type Stand = {
  ok: boolean;
  gekoppeld: boolean;
  werkt?: boolean;
  melding?: string;
  instelling: Instelling;
  pijplijnen: Pijplijn[];
  velden: Veld[];
  leads: Lead[];
  /** Namen van leads die een ronde heeft aangemaakt en waar niets mee gedaan is. */
  opruimen?: string[];
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
  // Waarom er niets te zien is. Zonder dit blijft er "Bezig met ophalen…" staan
  // bij een gast of een meekijksessie, en dan lijkt het scherm vast te lopen.
  const [geenToegang, setGeenToegang] = useState("");

  const laad = useCallback(async () => {
    try {
      const d = (await fetch("/api/admin/hubspot").then((r) => r.json())) as Stand & { error?: string };
      if (d.ok) { setStand(d); setGeenToegang(""); }
      else setGeenToegang(d.error || "De koppeling is nu niet op te halen.");
    } catch { setGeenToegang("De koppeling is nu niet op te halen."); }
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
            ? `${d.melding && d.melding !== "Klaar." ? d.melding + " " : ""}${d.gelezen} bekeken in HubSpot, ${d.nieuweLeads} nieuwe lead(s), ${d.dossierStukken} stuk(ken) in een dossier gezet.`
            : "Bewaard."),
        });
      } else setMelding({ ok: false, text: d.error || d.melding || "Dat lukte niet." });
    } catch {
      setMelding({ ok: false, text: "Dat lukte niet." });
    } finally { setBezig(""); }
  }

  const instelling = stand?.instelling;
  // Alleen velden waar je zinnig op kunt filteren: een keuzelijst of een tekstveld.
  const keuzeVelden = (stand?.velden || []).filter((v) => v.soort === "enumeration" || v.soort === "string");
  const gekozenVeld = (stand?.velden || []).find((v) => v.naam === instelling?.filterVeld) || null;
  const datumVelden = (stand?.velden || []).filter((v) => v.soort === "date" || v.soort === "datetime");
  // De naam zoals hij in HubSpot op je scherm staat, niet de technische naam.
  const veldLabel = (naam: string) => (stand?.velden || []).find((v) => v.naam === naam)?.label || naam;
  const waardeLabel = (waarde: string) =>
    gekozenVeld?.opties.find((o) => o.waarde === waarde)?.label || waarde;

  return (
    <>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 700, margin: "var(--s-12) 0 var(--s-2)" }}>HubSpot (leads)</h2>
      <p className="muted" style={{ marginBottom: "var(--s-4)" }}>
        Je leads uit HubSpot komen hier automatisch binnen: iedereen met de leadstatus die jij hieronder aanwijst, met
        de contactgegevens, de opvolgdatum en de notities die je daar maakte. De bedragen en de maand waarin ze naar
        verwachting starten zet je in het dashboard bij de lead zelf, want daar rekent de prognose ermee.
      </p>

      {melding && <div className={melding.ok ? "saved-msg" : "login-error"} style={{ marginBottom: "var(--s-4)" }}>{melding.text}</div>}

      {!stand && <p className="muted">{geenToegang || "Bezig met ophalen…"}</p>}

      {stand && !stand.gekoppeld && (
        <div className="created-box">
          <div className="created-title">Nog niet gekoppeld</div>
          <p>
            In HubSpot: instellingen, Integraties, <strong>Service keys</strong>, Create a service key. Geef hem een
            naam en vink de leesrechten aan op deals, bedrijven, contacten, taken, notities en e-mail. Kopieer de
            sleutel die je dan krijgt en zet hem in Vercel bij het project onder Settings, Environment Variables, met
            de naam <code>HUBSPOT_TOKEN</code>. Eén keer opnieuw deployen en deze pagina laat de stand zien.
          </p>
          <p>
            Welke rechten (scopes) je aanvinkt, gevonden via het zoekveld in dat scherm. De eerste drie zijn genoeg om
            te beginnen; de rest maakt het compleet. Staat een naam er niet bij, sla hem dan over.
          </p>
          <ul>
            <li><code>crm.objects.deals.read</code> &mdash; de deals zelf, hun fase, bedrag en sluitingsdatum</li>
            <li><code>crm.objects.companies.read</code> &mdash; bedrijfsnaam en website, om de lead te herkennen</li>
            <li><code>crm.objects.contacts.read</code> &mdash; contactpersoon en mailadres, en in de meeste accounts ook je taken, notities en gespreksverslagen</li>
          </ul>
          <p>
            Deze drie zijn genoeg. Zoek daarnaast op <em>tasks</em>, <em>notes</em>, <em>calls</em>, <em>meetings</em> en
            <em>owners</em>: bestaat er een <code>.read</code>-recht met die naam, vink het dan aan. Bestaat het niet, dan
            is dat geen fout maar de normale situatie; die gegevens zitten dan bij het contacten-recht in.
          </p>
          <p>
            Er ontbreekt nooit stilzwijgend iets: kan de koppeling de taken niet lezen, dan pakt hij het eerstvolgende
            contactmoment uit de deal zelf. En mist er echt een recht, dan noemt de foutmelding hierboven hem bij naam.
            Zet je later &ldquo;notities gaan ook naar HubSpot&rdquo; aan, dan heb je een schrijfrecht op notities nodig.
          </p>
          <p>
            Kom je bij Private apps uit en krijg je daar een waarschuwing over &ldquo;legacy&rdquo;: neem de service key,
            dat is precies waarvoor die bedoeld is. Een legacy private app kan één ding extra (meteen een seintje krijgen
            bij elke wijziging) en dat gebruiken we hier niet; het dashboard kijkt zelf elk kwartier.
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
                  <td style={{ fontWeight: 600 }}>Wat er binnenkomt</td>
                  <td>
                    {instelling?.bron === "deals"
                      ? (instelling.pijplijnen.length
                        ? `Deals uit ${instelling.pijplijnen.length} gekozen pijplijn(en).`
                        : "Nog niets: kies hieronder welke pijplijnen als lead tellen.")
                      : (instelling?.filterVeld && instelling?.filterWaarde
                        ? `Contacten waarbij ${veldLabel(instelling.filterVeld)} gelijk is aan "${waardeLabel(instelling.filterWaarde)}". Verder niets.`
                        : <span style={{ color: "var(--danger)" }}>Nog niets: kies hieronder het veld en de waarde (bijvoorbeeld Lead status is HOTHOTHOT).</span>)}
                  </td>
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
            <label style={{ fontWeight: 600 }}>Waar staan je leads</label>
            <p className="muted" style={{ marginBottom: "var(--s-2)" }}>
              Werk je met losse contacten en een leadstatus (zoals hier), kies dan contacten. Werk je met een
              dealpijplijn, kies dan deals.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
              <button type="button" disabled={!!bezig}
                className={instelling?.bron !== "deals" ? "btn btn-primary btn-klein" : "btn btn-klein"}
                onClick={() => stuur({ actie: "instellingen", bron: "contacten" }, "bron", "Bewaard.")}>
                Contacten met een leadstatus
              </button>
              <button type="button" disabled={!!bezig}
                className={instelling?.bron === "deals" ? "btn btn-primary btn-klein" : "btn btn-klein"}
                onClick={() => stuur({ actie: "instellingen", bron: "deals" }, "bron", "Bewaard.")}>
                Deals uit een pijplijn
              </button>
            </div>
          </div>

          {instelling?.bron !== "deals" && (
            <>
              <div className="form-grid" style={{ marginTop: "var(--s-5)" }}>
                <div className="field">
                  <label htmlFor="hs-filterveld">Welk veld zegt of iemand een lead is</label>
                  <select id="hs-filterveld" value={instelling?.filterVeld || ""} disabled={!!bezig}
                    onChange={(e) => stuur({ actie: "instellingen", filterVeld: e.target.value, filterWaarde: "" }, "filter", "Bewaard.")}>
                    <option value="">Kies een veld…</option>
                    {keuzeVelden.map((v) => <option key={v.naam} value={v.naam}>{v.label}</option>)}
                  </select>
                  <span className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-1)" }}>
                    Meestal &ldquo;Lead status&rdquo;.
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="hs-filterwaarde">Welke waarde telt als lead</label>
                  {gekozenVeld && gekozenVeld.opties.length > 0 ? (
                    <select id="hs-filterwaarde" value={instelling?.filterWaarde || ""} disabled={!!bezig}
                      onChange={(e) => stuur({ actie: "instellingen", filterWaarde: e.target.value }, "filter", "Bewaard.")}>
                      <option value="">Kies een waarde…</option>
                      {gekozenVeld.opties.map((o) => <option key={o.waarde} value={o.waarde}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id="hs-filterwaarde" defaultValue={instelling?.filterWaarde || ""} placeholder="bijvoorbeeld hot"
                      onBlur={(e) => {
                        if (e.target.value !== (instelling?.filterWaarde || "")) {
                          stuur({ actie: "instellingen", filterWaarde: e.target.value }, "filter", "Bewaard.");
                        }
                      }} />
                  )}
                  <span className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-1)" }}>
                    Leeg laten betekent: er komt niets binnen.
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="hs-opvolgveld">Welk veld is de opvolgdatum</label>
                  <select id="hs-opvolgveld" value={instelling?.velden.opvolgDatum || ""} disabled={!!bezig}
                    onChange={(e) => stuur({ actie: "instellingen", velden: { opvolgDatum: e.target.value } }, "veld", "Bewaard.")}>
                    <option value="">Geen eigen veld, gebruik mijn taken in HubSpot</option>
                    {datumVelden.map((v) => <option key={v.naam} value={v.naam}>{v.label}</option>)}
                  </select>
                  <span className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-1)" }}>
                    Zonder eigen veld pakt hij je eerstvolgende openstaande taak bij dat contact.
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="hs-kans">Kans van een verse lead (%)</label>
                  <input id="hs-kans" inputMode="numeric" defaultValue={String(instelling?.kans ?? 50)}
                    onBlur={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, ""));
                      if (n !== instelling?.kans) stuur({ actie: "instellingen", kans: n }, "kans", "Bewaard.");
                    }} />
                  <span className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-1)" }}>
                    Waarmee de prognose rekent tot je hem bij die lead zelf bijstelt.
                  </span>
                </div>
              </div>
            </>
          )}

          {instelling?.bron === "deals" && (
            <div className="field-wide" style={{ marginTop: "var(--s-5)" }}>
              <label style={{ fontWeight: 600 }}>Welke pijplijnen tellen als lead</label>
              <p className="muted" style={{ marginBottom: "var(--s-2)" }}>
                Niets aangevinkt betekent: alle pijplijnen. Vink aan wat echt een verkooptraject is, anders staat elk
                half koud contact straks in je lijst én in je prognose.
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
          )}

          <div className="field-wide" style={{ marginTop: "var(--s-5)" }}>
            <label style={{ fontWeight: 600 }}>Wat de koppeling mag</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginTop: "var(--s-2)" }}>
              <button
                type="button" disabled={!!bezig}
                className={instelling?.autoLeads ? "btn btn-primary btn-klein" : "btn btn-klein"}
                onClick={() => stuur({ actie: "instellingen", autoLeads: !instelling?.autoLeads }, "auto", "Bewaard.")}
              >
                {instelling?.autoLeads ? "Nieuw in HubSpot wordt vanzelf een lead" : "Alleen wat ik zelf koppel"}
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
              Terugschrijven betekent alleen: een notitie die je hier typt komt ook in HubSpot te staan. Een status, een
              bedrag of een datum in HubSpot wordt nooit door het dashboard aangepast.
            </p>
          </div>

          {(stand.opruimen?.length || 0) > 0 && (
            <div className="created-box" style={{ marginTop: "var(--s-5)" }}>
              <div className="created-title">{stand.opruimen?.length} bedrijven die hier niet horen</div>
              <p>
                Deze zijn door een ophaalronde op je <strong>deals</strong> aangemaakt, staan als lead of als
                &ldquo;niet doorgegaan&rdquo; in je lijst, hebben geen inlog en geen bedrag, en er is verder niets mee
                gedaan: geen dossier, geen document, geen gesprek. Meestal zijn het oude klusjes uit je HubSpot-historie.
                Weggooien raakt alleen deze; je eigen klanten en alles waar je wél aan gewerkt hebt blijven staan.
              </p>
              <p className="muted">{stand.opruimen?.slice(0, 12).join(", ")}{(stand.opruimen?.length || 0) > 12 ? ` en nog ${(stand.opruimen?.length || 0) - 12}` : ""}</p>
              <button className="btn btn-danger" disabled={!!bezig}
                onClick={() => {
                  if (!window.confirm(`${stand.opruimen?.length} bedrijven verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
                  stuur({ actie: "opruimen" }, "opruimen");
                }}>
                {bezig === "opruimen" ? "Bezig met opruimen…" : `Verwijder deze ${stand.opruimen?.length}`}
              </button>
            </div>
          )}

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

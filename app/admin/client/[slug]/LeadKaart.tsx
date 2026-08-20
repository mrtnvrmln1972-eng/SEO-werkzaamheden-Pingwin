"use client";

import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// DE LEADKAART: de stand van de deal, bovenaan de leadomgeving
// ═══════════════════════════════════════════════════════════
// Alles wat je over een lead wilt weten voordat je hem belt, op één plek: wanneer
// je hem weer moet spreken, wat het gaat worden, wanneer hij begint, en hoe groot
// de kans is. Links komt uit HubSpot, rechts zet je zelf.
//
// De verdeling is niet toevallig maar de kern van de koppeling: HubSpot is de
// baas over de pijplijn en de data, het dashboard over het beoogde maandbudget.
// Een deal in HubSpot is meestal een totaalbedrag en de prognose rekent met
// maandbedragen; klakkeloos overnemen zou de prognose onbruikbaar maken. Zie
// HUBSPOT-LEADS.md.
// ═══════════════════════════════════════════════════════════

type Lead = {
  dealId: string; dealNaam: string; pijplijnNaam: string; faseNaam: string;
  bedrag: number | null; kans: number | null; sluitDatum: string | null;
  gesloten: boolean; gewonnen: boolean;
  opvolgDatum: string | null; opvolgTitel: string; laatsteContact: string | null;
  contactNaam: string; contactMail: string; bedrijfNaam: string; eigenaar: string;
  hubspotUrl: string; bijgewerktOp: string;
};

type Stand = {
  gekoppeld: boolean;
  lead: Lead | null;
  fase: string;
  budget: { maandbudget: number; linkbuilding: number };
  prognose: { kans: number | null; startMaand: string | null; bron: string };
  notitiesTerug: boolean;
};

const euro = (n: number | null): string =>
  n === null || !Number.isFinite(n) ? "—" : `€ ${Math.round(n).toLocaleString("nl-NL")}`;

function datumKort(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

/** Hoe dringend is het eerstvolgende contactmoment: geweest, vandaag, of later. */
function opvolgStand(datum: string | null): "geen" | "verstreken" | "vandaag" | "later" {
  if (!datum) return "geen";
  const vandaag = new Date().toISOString().slice(0, 10);
  if (datum < vandaag) return "verstreken";
  if (datum === vandaag) return "vandaag";
  return "later";
}

export default function LeadKaart({ slug, naam, onVeranderd }: {
  slug: string;
  naam: string;
  /** Wordt aangeroepen als er iets in het dossier bij kwam, zodat de lijst herlaadt. */
  onVeranderd?: () => void;
}) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [bezig, setBezig] = useState("");
  const [melding, setMelding] = useState<{ ok: boolean; text: string } | null>(null);
  const [budget, setBudget] = useState({ maandbudget: "", linkbuilding: "" });
  const [kans, setKans] = useState("");
  const [startMaand, setStartMaand] = useState("");
  const [dealId, setDealId] = useState("");
  const [notitie, setNotitie] = useState("");
  const [toonNotitie, setToonNotitie] = useState(false);

  const laad = useCallback(async () => {
    try {
      const d = (await fetch(`/api/admin/lead-hubspot?slug=${encodeURIComponent(slug)}`).then((r) => r.json())) as Stand & { ok: boolean };
      if (!d.ok) return;
      setStand(d);
      setBudget({
        maandbudget: d.budget.maandbudget ? String(d.budget.maandbudget) : "",
        linkbuilding: d.budget.linkbuilding ? String(d.budget.linkbuilding) : "",
      });
      setKans(d.prognose.kans === null ? "" : String(d.prognose.kans));
      setStartMaand(d.prognose.startMaand || "");
    } catch { /* stil; de kaart blijft staan zoals hij stond */ }
  }, [slug]);

  useEffect(() => { laad(); }, [laad]);

  async function doe(actie: string, extra: Record<string, unknown> = {}, melden = ""): Promise<boolean> {
    setBezig(actie); setMelding(null);
    try {
      const d = await fetch(`/api/admin/lead-hubspot?slug=${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie, ...extra }),
      }).then((r) => r.json());
      if (d.ok) {
        await laad();
        if (melden) setMelding({ ok: true, text: melden });
        return true;
      }
      setMelding({ ok: false, text: d.error || "Dat lukte niet." });
      return false;
    } catch {
      setMelding({ ok: false, text: "Dat lukte niet." });
      return false;
    } finally { setBezig(""); }
  }

  if (!stand) return null;
  const lead = stand.lead;
  const dringend = opvolgStand(lead?.opvolgDatum || null);
  const uitHubspot = stand.prognose.bron === "hubspot";

  return (
    <div className="card lead-kaart">
      <div className="lead-blok-kop">
        <div>
          <div className="lead-blok-titel">{lead?.bedrijfNaam || naam}</div>
          <div className="lead-blok-sub">
            {lead
              ? `${lead.pijplijnNaam || "HubSpot"}${lead.faseNaam ? ` · ${lead.faseNaam}` : ""}`
              : stand.gekoppeld ? "Nog niet aan een HubSpot-deal gekoppeld" : "HubSpot is nog niet gekoppeld"}
          </div>
        </div>
        <div className="pnl-acties-groep">
          {lead?.hubspotUrl && (
            <a className="btn btn-klein" href={lead.hubspotUrl} target="_blank" rel="noreferrer">Openen in HubSpot</a>
          )}
          {stand.gekoppeld && (
            <button className="btn btn-klein btn-quiet" onClick={() => doe("ophalen", {}, "Bijgewerkt vanuit HubSpot.")} disabled={!!bezig}>
              {bezig === "ophalen" ? "Bezig…" : "Nu bijwerken"}
            </button>
          )}
        </div>
      </div>

      {melding && <div className={melding.ok ? "saved-msg" : "login-error"}>{melding.text}</div>}

      {/* ── Wat er uit HubSpot komt ── */}
      {lead && (
        <div className="lead-kaart-rij">
          <div className={"lead-kaart-vak" + (dringend === "verstreken" ? " is-verstreken" : dringend === "vandaag" ? " is-vandaag" : "")}>
            <div className="lead-kaart-label">Eerstvolgend contact</div>
            <div className="lead-kaart-waarde">{datumKort(lead.opvolgDatum)}</div>
            <div className="lead-kaart-onder">
              {dringend === "verstreken" ? "Stond gepland, nog niet gedaan"
                : dringend === "vandaag" ? "Vandaag"
                : lead.opvolgTitel || "Geen taak in HubSpot"}
            </div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Verwacht klant</div>
            <div className="lead-kaart-waarde">{datumKort(lead.sluitDatum)}</div>
            <div className="lead-kaart-onder">Sluitingsdatum van de deal</div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Kans</div>
            <div className="lead-kaart-waarde">{stand.prognose.kans === null ? "—" : `${stand.prognose.kans}%`}</div>
            <div className="lead-kaart-onder">{uitHubspot ? "uit de dealfase" : "door jou gezet"}</div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Bedrag in HubSpot</div>
            <div className="lead-kaart-waarde">{euro(lead.bedrag)}</div>
            <div className="lead-kaart-onder">meestal het totaal, niet per maand</div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Laatste contact</div>
            <div className="lead-kaart-waarde">{datumKort(lead.laatsteContact)}</div>
            <div className="lead-kaart-onder">
              {lead.contactNaam || lead.contactMail
                ? lead.contactMail
                  ? <a href={`mailto:${lead.contactMail}`}>{lead.contactNaam || lead.contactMail}</a>
                  : lead.contactNaam
                : "geen contactpersoon"}
            </div>
          </div>
        </div>
      )}

      {/* ── Wat jij zet ── */}
      <div className="lead-kaart-invoer">
        <div className="field">
          <label htmlFor={`lk-budget-${slug}`}>Beoogd maandbudget</label>
          <input
            id={`lk-budget-${slug}`} inputMode="numeric" value={budget.maandbudget}
            onChange={(e) => setBudget({ ...budget, maandbudget: e.target.value })}
            placeholder="bijv. 1500"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-link-${slug}`}>Waarvan linkbuilding</label>
          <input
            id={`lk-link-${slug}`} inputMode="numeric" value={budget.linkbuilding}
            onChange={(e) => setBudget({ ...budget, linkbuilding: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-kans-${slug}`}>Kans in %</label>
          <input
            id={`lk-kans-${slug}`} inputMode="numeric" value={kans}
            onChange={(e) => setKans(e.target.value)}
            placeholder={lead?.kans === null || lead?.kans === undefined ? "30" : String(lead.kans)}
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-maand-${slug}`}>Vanaf maand</label>
          <input
            id={`lk-maand-${slug}`} type="month" value={startMaand}
            onChange={(e) => setStartMaand(e.target.value)}
          />
        </div>
      </div>

      <div className="pnl-acties-groep lead-kaart-knoppen">
        <button
          className="btn btn-primary btn-klein" disabled={!!bezig}
          onClick={async () => {
            const gelukt = await doe("budget", {
              maandbudget: Number(budget.maandbudget.replace(/[^\d]/g, "")) || 0,
              linkbuilding: Number(budget.linkbuilding.replace(/[^\d]/g, "")) || 0,
            });
            if (gelukt) {
              await doe("prognose", {
                kans: kans === "" ? undefined : Number(kans.replace(/[^\d]/g, "")),
                startMaand: startMaand || null,
              }, "Bewaard. De prognose rekent hier meteen mee.");
            }
          }}
        >
          {bezig === "budget" || bezig === "prognose" ? "Bezig…" : "Bewaren"}
        </button>
        {lead?.bedrag ? (
          <button className="btn btn-ghost btn-klein" onClick={() => setBudget({ ...budget, maandbudget: String(Math.round(lead.bedrag || 0)) })}>
            Neem {euro(lead.bedrag)} over
          </button>
        ) : null}
        <button className="btn btn-ghost btn-klein" onClick={() => setToonNotitie((v) => !v)}>
          {toonNotitie ? "Notitie sluiten" : "Notitie toevoegen"}
        </button>
        <button className="btn btn-ghost btn-klein" disabled={!!bezig}
          onClick={() => doe("opvolging", { dagen: 5, tekst: `Opvolgen: ${naam}` }, "Over vijf dagen krijg je hier een seintje over.")}>
          Herinner me over 5 dagen
        </button>
        <button className="btn btn-ghost btn-klein" disabled={!!bezig}
          onClick={() => doe("scan", {}, "De snelle blik staat in het dossier.").then((ok) => { if (ok) onVeranderd?.(); })}>
          {bezig === "scan" ? "Bezig met meten…" : "Snelle blik op hun site"}
        </button>
        {stand.fase === "lead" && (
          <button className="btn btn-ghost btn-klein" disabled={!!bezig}
            onClick={() => {
              if (!window.confirm(`${naam} omzetten naar klant? Alles blijft staan; de prognose gaat van kans naar zeker.`)) return;
              doe("maak-klant", {}, "Dit is nu een klant.");
            }}>
            Lead wordt klant
          </button>
        )}
      </div>

      {toonNotitie && (
        <div className="lead-toevoegen">
          <textarea
            value={notitie} rows={3}
            onChange={(e) => setNotitie(e.target.value)}
            placeholder="Wat je net besproken hebt. Komt in het dossier van deze lead, en als je dat hebt aangezet ook als notitie bij de deal in HubSpot."
          />
          <button
            className="btn btn-primary btn-klein" disabled={!!bezig || !notitie.trim()}
            onClick={async () => {
              const gelukt = await doe("notitie", { tekst: notitie },
                stand.notitiesTerug ? "In het dossier gezet en als notitie naar HubSpot gestuurd." : "In het dossier gezet.");
              if (gelukt) { setNotitie(""); setToonNotitie(false); onVeranderd?.(); }
            }}
          >
            {bezig === "notitie" ? "Bezig…" : "Bewaren"}
          </button>
        </div>
      )}

      {/* ── Nog niet gekoppeld ── */}
      {stand.gekoppeld && !lead && (
        <div className="lead-kaart-koppel">
          <div className="hint">
            Deze lead hangt nog niet aan een deal. Vul het dealnummer uit HubSpot in (dat staat in de adresbalk van de deal),
            of wacht op de volgende ronde: een deal met dezelfde website of bedrijfsnaam wordt vanzelf gekoppeld.
          </div>
          <div className="lead-kaart-koppel-rij">
            <input value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder="dealnummer, bijv. 31415926535" inputMode="numeric" />
            <button className="btn btn-klein" disabled={!dealId.trim() || !!bezig} onClick={() => doe("koppel", { dealId }, "Gekoppeld en opgehaald.")}>
              {bezig === "koppel" ? "Bezig…" : "Koppel aan deze deal"}
            </button>
          </div>
        </div>
      )}

      {!stand.gekoppeld && (
        <div className="hint">
          HubSpot is in deze omgeving nog niet gekoppeld. Maak in HubSpot een service key met leesrechten en zet hem in
          Vercel als HUBSPOT_TOKEN; op <a href="/admin/beheer">Beheer</a> staat de klikroute, de stand en de knop om op te halen.
        </div>
      )}
    </div>
  );
}

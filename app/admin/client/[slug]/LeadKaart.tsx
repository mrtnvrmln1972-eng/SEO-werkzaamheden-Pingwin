"use client";

import { useCallback, useEffect, useState } from "react";
import { MaandVeld } from "../../RijVeld";

// ═══════════════════════════════════════════════════════════
// DE LEADKAART: de stand van de deal, bovenaan de leadomgeving
// ═══════════════════════════════════════════════════════════
// Alles wat je over een lead wilt weten voordat je hem belt, op één plek: wanneer
// je hem weer moet spreken, wat het gaat worden, wanneer hij begint, en hoe groot
// de kans is. Links komt uit HubSpot, rechts zet je zelf.
//
// De verdeling is niet toevallig maar de kern van de koppeling. HubSpot levert
// wie er hot is, wie je spreekt en wanneer je ze weer moet spreken. Het geld en
// de startmaand staan hier, want daar rekent de prognose mee en zo staat elk
// bedrag op precies één plek. Zie HUBSPOT-LEADS.md.
// ═══════════════════════════════════════════════════════════

type Lead = {
  /** "contact" (leadstatus in HubSpot) of "deal" (een dealpijplijn). */
  soort: string;
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
  prognose: {
    kans: number | null; startMaand: string | null; bron: string;
    feeAds: number; maandkosten: number; eenmalig: number; eenmaligKosten: number;
  };
  notitiesTerug: boolean;
  /** Waar de leads vandaan komen: je contacten of een dealpijplijn. */
  bron: "contacten" | "deals";
  /** Staat op Beheer ingesteld welke leads binnenkomen? */
  ingesteld: boolean;
};

const euro = (n: number | null): string =>
  n === null || !Number.isFinite(n) ? "—" : `€ ${Math.round(n).toLocaleString("nl-NL")}`;

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** "2026-10" wordt "oktober 2026". */
function maandLabel(m: string): string {
  const [j, mm] = String(m).split("-");
  return MAANDEN[Number(mm) - 1] ? `${MAANDEN[Number(mm) - 1]} ${j}` : m;
}

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
  // Alles wat jij zelf zet. Bewust vijf losse bedragen en geen totaal: SEO,
  // advertenties, de kosten die eraan vastzitten en een eenmalige website zijn
  // verschillende dingen, en opgeteld zie je niet meer waar een getal vandaan komt.
  const [budget, setBudget] = useState({ maandbudget: "", linkbuilding: "" });
  const [geld, setGeld] = useState({ feeAds: "", maandkosten: "", eenmalig: "", eenmaligKosten: "" });
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
      const toon = (n: number) => (n ? String(Math.round(n)) : "");
      setGeld({
        feeAds: toon(d.prognose.feeAds),
        maandkosten: toon(d.prognose.maandkosten),
        eenmalig: toon(d.prognose.eenmalig),
        eenmaligKosten: toon(d.prognose.eenmaligKosten),
      });
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
  const getalUit = (v: string) => Number(String(v).replace(/[^\d]/g, "")) || 0;
  const perMaand = getalUit(budget.maandbudget) + getalUit(geld.feeAds);
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
              : stand.gekoppeld ? "Nog niet gekoppeld aan HubSpot" : "HubSpot is nog niet gekoppeld"}
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
                : lead.opvolgTitel || "Niets gepland in HubSpot"}
            </div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Contactpersoon</div>
            <div className="lead-kaart-waarde">{lead.contactNaam || "—"}</div>
            <div className="lead-kaart-onder">
              {lead.contactMail ? <a href={`mailto:${lead.contactMail}`}>{lead.contactMail}</a> : "geen mailadres"}
            </div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Laatste contact</div>
            <div className="lead-kaart-waarde">{datumKort(lead.laatsteContact)}</div>
            <div className="lead-kaart-onder">{lead.eigenaar ? `van ${lead.eigenaar}` : "volgens HubSpot"}</div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Per maand</div>
            <div className="lead-kaart-waarde">{euro(perMaand)}</div>
            <div className="lead-kaart-onder">
              {perMaand ? `SEO en advertenties samen${kans ? `, telt voor ${euro(Math.round(perMaand * (Number(kans) || 0) / 100))} mee` : ""}` : "nog geen bedrag ingevuld"}
            </div>
          </div>
          <div className="lead-kaart-vak">
            <div className="lead-kaart-label">Verwacht klant</div>
            <div className="lead-kaart-waarde">{startMaand ? maandLabel(startMaand) : lead.sluitDatum ? datumKort(lead.sluitDatum) : "—"}</div>
            <div className="lead-kaart-onder">{startMaand ? "vanaf deze maand in de prognose" : "vul hieronder in vanaf welke maand"}</div>
          </div>
        </div>
      )}

      {/* ── Wat jij zet ── */}
      {/* HubSpot levert wie er hot is, de contactgegevens en de opvolgdatum. De
          bedragen en de startmaand staan hier, want hier rekent de prognose ermee
          en zo staat elk bedrag op precies één plek. */}
      <div className="lead-kaart-invoer">
        <div className="field">
          <label htmlFor={`lk-budget-${slug}`}>SEO p/m</label>
          <input
            id={`lk-budget-${slug}`} inputMode="numeric" value={budget.maandbudget}
            onChange={(e) => setBudget({ ...budget, maandbudget: e.target.value })}
            placeholder="bijv. 1500"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-ads-${slug}`}>Ads p/m</label>
          <input
            id={`lk-ads-${slug}`} inputMode="numeric" value={geld.feeAds}
            onChange={(e) => setGeld({ ...geld, feeAds: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-link-${slug}`}>Linkbuilding p/m</label>
          <input
            id={`lk-link-${slug}`} inputMode="numeric" value={budget.linkbuilding}
            onChange={(e) => setBudget({ ...budget, linkbuilding: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-kosten-${slug}`}>Kosten p/m</label>
          <input
            id={`lk-kosten-${slug}`} inputMode="numeric" value={geld.maandkosten}
            onChange={(e) => setGeld({ ...geld, maandkosten: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-eenmalig-${slug}`}>Eenmalig (website)</label>
          <input
            id={`lk-eenmalig-${slug}`} inputMode="numeric" value={geld.eenmalig}
            onChange={(e) => setGeld({ ...geld, eenmalig: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-eenmalig-kosten-${slug}`}>Kosten daarvan</label>
          <input
            id={`lk-eenmalig-kosten-${slug}`} inputMode="numeric" value={geld.eenmaligKosten}
            onChange={(e) => setGeld({ ...geld, eenmaligKosten: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-kans-${slug}`}>Kans in %</label>
          <input
            id={`lk-kans-${slug}`} inputMode="numeric" value={kans}
            onChange={(e) => setKans(e.target.value)}
            placeholder="50"
          />
        </div>
        <div className="field">
          <label htmlFor={`lk-maand-${slug}`}>Verwacht klant</label>
          {/* Een keuzelijst, geen maandvakje: daarin moet je het jaartal met de
              hand omhoog klikken en dan is volgend jaar niet te vinden. Zelfde
              lijst als in de leadlijst; zie MaandVeld in app/admin/RijVeld.tsx. */}
          <MaandVeld
            waarde={startMaand}
            label={`Vanaf welke maand telt ${naam} mee`}
            opslaan={(m) => setStartMaand(m)}
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
              const getal = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;
              await doe("prognose", {
                kans: kans === "" ? undefined : getal(kans),
                startMaand: startMaand || null,
                feeAds: getal(geld.feeAds),
                maandkosten: getal(geld.maandkosten),
                eenmalig: getal(geld.eenmalig),
                eenmaligKosten: getal(geld.eenmaligKosten),
              }, "Bewaard. De prognose rekent hier meteen mee.");
            }
          }}
        >
          {bezig === "budget" || bezig === "prognose" ? "Bezig…" : "Bewaren"}
        </button>
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
        {/* Weggooien staat hier en niet meer in de leadlijst (20-08-2026): daar
            stonden "Niet doorgegaan" en "Verwijder" naast elkaar en die deden in
            de praktijk hetzelfde, terwijl de tweede onomkeerbaar is. In de lijst
            blijft de omkeerbare knop; echt weggooien is zeldzaam en hoort dus
            een klik dieper, bij de lead zelf. */}
        <button className="btn btn-danger btn-klein" disabled={!!bezig}
          onClick={async () => {
            if (!window.confirm(
              `${naam} helemaal verwijderen? Het dossier, de documenten en de mailwisseling gaan mee weg.\n\n`
              + "Wil je hem alleen uit je lijst hebben, gebruik dan \u201cNiet doorgegaan\u201d; dat kun je terugdraaien.",
            )) return;
            const r = await fetch(`/api/admin/clients?slug=${encodeURIComponent(slug)}`, { method: "DELETE" })
              .then((x) => x.json()).catch(() => null);
            if (r?.ok !== false) window.location.href = "/admin";
          }}>
          Lead verwijderen
        </button>
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
            {!stand.ingesteld
              ? <>Op <a href="/admin/beheer">Beheer</a> staat nog niet welke leads uit HubSpot moeten komen. Wijs daar het veld en de waarde aan (bijvoorbeeld leadstatus is hot); daarna koppelt de eerstvolgende ronde dit bedrijf vanzelf, op website of bedrijfsnaam.</>
              : stand.bron === "deals"
                ? "Deze lead hangt nog niet aan een deal. Vul het dealnummer uit HubSpot in (dat staat in de adresbalk van de deal), of wacht op de volgende ronde: een deal met dezelfde website of bedrijfsnaam wordt vanzelf gekoppeld."
                : "Dit bedrijf is nog niet aan een contact in HubSpot gekoppeld. Dat gebeurt vanzelf zodra daar iemand met jouw leadstatus staat met dezelfde website of bedrijfsnaam. Weet je het nummer van het contact (dat staat in de adresbalk in HubSpot), dan kun je hem hier meteen koppelen."}
          </div>
          <div className="lead-kaart-koppel-rij">
            <input value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder={stand.bron === "deals" ? "dealnummer" : "contactnummer"} inputMode="numeric" />
            <button className="btn btn-klein" disabled={!dealId.trim() || !!bezig} onClick={() => doe("koppel", { dealId }, "Gekoppeld en opgehaald.")}>
              {bezig === "koppel" ? "Bezig…" : "Koppelen"}
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

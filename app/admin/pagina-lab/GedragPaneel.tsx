"use client";

// ═══════════════════════════════════════════════════════════
// GEDRAG: WETEN WE WAT BEZOEKERS OP EEN PAGINA DOEN?
// ═══════════════════════════════════════════════════════════
// Het derde been onder het Pagina-lab. De brug haalt de pagina op, de
// kennisbank zegt waar je naar kijkt, en dit zegt wat bezoekers er werkelijk
// deden. Twee bronnen, met opzet: Analytics telt (hoeveel, hoe lang, hoeveel
// conversies, per apparaat) en Clarity toont wrijving (dode klikken,
// woedeklikken, terugspringen, hoe ver mensen scrollen).
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import { Chip, Chips, Keuze, Leeg, Paneel, Signaal, Tabel, Tekst, Veld, Veldrij } from "../../_ui/Uitkomst";

export type KlantStand = {
  slug: string;
  naam: string;
  domein: string;
  ga4: string | null;
  clarity: { gekoppeld: boolean; laatste: string | null; vandaag: number; ruimte: number; bewaard: number };
};

type Gedrag = { weergaven: number; instappen: number; betrokkenheid: number; wegklikken: number; seconden: number; conversies: number };
type Cijfers = {
  gekoppeld: boolean; property: string | null; dagen: number; pad: string;
  totaal: Gedrag | null; perApparaat: { apparaat: string; gedrag: Gedrag }[]; melding?: string;
};
type ClarityPagina = { opgehaaldOp: string; dagen: number; regels: { metriek: string; waarden: Record<string, number> }[] };

const APPARAAT: Record<string, string> = { mobile: "mobiel", desktop: "desktop", tablet: "tablet", smart_tv: "tv" };

function datum(iso: string | null): string {
  if (!iso) return "nog nooit";
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
}

function tijd(seconden: number): string {
  if (seconden < 60) return `${seconden} sec`;
  return `${Math.floor(seconden / 60)} min ${seconden % 60} sec`;
}

export default function GedragPaneel({ klanten, magSchrijven }: { klanten: KlantStand[]; magSchrijven: boolean }) {
  const [stand, setStand] = useState(klanten);
  const [gekozen, setGekozen] = useState(klanten[0]?.slug || "");
  const [sleutel, setSleutel] = useState("");
  const [property, setProperty] = useState("");
  const [bezig, setBezig] = useState("");
  const [melding, setMelding] = useState<{ soort: "goed" | "let-op"; tekst: string } | null>(null);

  const [proefUrl, setProefUrl] = useState("");
  const [proef, setProef] = useState<{ analytics: Cijfers; clarity: { pagina: ClarityPagina | null } } | null>(null);

  const klant = stand.find((k) => k.slug === gekozen) || null;

  function werkBij(slug: string, wijziging: Partial<KlantStand>) {
    setStand((oud) => oud.map((k) => (k.slug === slug ? { ...k, ...wijziging } : k)));
  }

  async function stuur(actie: string, extra: Record<string, unknown>) {
    if (!klant) return;
    setBezig(actie);
    setMelding(null);
    try {
      const res = await fetch("/api/admin/gedrag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: klant.slug, actie, ...extra }),
      });
      const data = await res.json();
      if (data.ga4) werkBij(klant.slug, { ga4: data.ga4.property || null });
      if (data.clarity) werkBij(klant.slug, { clarity: data.clarity });
      if (!data.ok) setMelding({ soort: "let-op", tekst: data.error || "Dat lukte niet." });
      else if (actie === "clarity-ophalen") {
        const aantal = Array.isArray(data.metingen) ? data.metingen.length : 0;
        setMelding({ soort: "goed", tekst: `Opgehaald bij Clarity: ${aantal} soorten meting bewaard. Ze zijn nu op te vragen per pagina.` });
      } else {
        setMelding({ soort: "goed", tekst: "Opgeslagen." });
        setSleutel(""); setProperty("");
      }
    } catch {
      setMelding({ soort: "let-op", tekst: "De verbinding met het dashboard viel weg." });
    } finally {
      setBezig("");
    }
  }

  async function probeer() {
    if (!klant || !proefUrl.trim()) return;
    setBezig("proef");
    setMelding(null);
    setProef(null);
    try {
      const p = new URLSearchParams({ slug: klant.slug, url: proefUrl.trim(), dagen: "28" });
      const res = await fetch(`/api/admin/pagina-lab/gedrag?${p.toString()}`);
      const data = await res.json();
      if (!data.ok) setMelding({ soort: "let-op", tekst: data.error || "Dat lukte niet." });
      else setProef({ analytics: data.analytics, clarity: data.clarity });
    } catch {
      setMelding({ soort: "let-op", tekst: "De verbinding met het dashboard viel weg." });
    } finally {
      setBezig("");
    }
  }

  return (
    <>
      <Paneel
        titel="Weten we per klant wat bezoekers doen?"
        uitleg={
          "Analytics vindt zichzelf meestal: het dashboard zoekt binnen jouw Google-account naar de property die " +
          "bij het domein hoort. Clarity heeft per website een eigen sleutel nodig, die je in Clarity zelf aanmaakt. " +
          "Zonder deze twee blijft elk oordeel van het lab een oordeel over hoe een pagina eruitziet, en niet over " +
          "hoe hij uitpakt."
        }
      >
        {stand.length === 0 ? (
          <Leeg>Er zijn nog geen klanten om gedragsdata bij op te halen.</Leeg>
        ) : (
          <Tabel kolommen={["Klant", "Analytics", "Clarity", "Laatst opgehaald"]}>
            {stand.map((k) => (
              <tr key={k.slug}>
                <td>{k.naam}</td>
                <td>{k.ga4 ? <Chip toon="goed">{`property ${k.ga4}`}</Chip> : <Chip toon="uit">nog niet gevonden</Chip>}</td>
                <td>{k.clarity.gekoppeld ? <Chip toon="goed">sleutel bekend</Chip> : <Chip toon="uit">geen sleutel</Chip>}</td>
                <td>{k.clarity.bewaard ? `${datum(k.clarity.laatste)} (${k.clarity.bewaard} metingen bewaard)` : "nog nooit"}</td>
              </tr>
            ))}
          </Tabel>
        )}
      </Paneel>

      <Paneel
        titel="Koppelen en uitproberen"
        uitleg="Kies een klant, leg vast wat er nog ontbreekt, en probeer daarna één pagina uit om te zien of er echt cijfers uitkomen."
        knoppen={
          <Keuze
            label="Welke klant"
            waarde={gekozen}
            zet={setGekozen}
            opties={stand.map((k) => ({ waarde: k.slug, naam: k.naam }))}
          />
        }
      >
        {melding && <Signaal soort={melding.soort === "goed" ? "goed" : "let-op"}>{melding.tekst}</Signaal>}

        {!klant ? <Leeg>Kies eerst een klant.</Leeg> : (
          <>
            <Tekst>
              {`**Analytics.** ${klant.ga4
                ? `Property ${klant.ga4} hangt aan deze klant. Klopt dat niet, vul dan het juiste nummer in.`
                : "Er is nog geen property gevonden bij dit domein. Dat kan twee dingen betekenen: het Google-account waarmee dit dashboard gekoppeld is heeft geen toegang tot die property, of het domein in de property staat anders geschreven. Vul het nummer dan met de hand in; je vindt het in Analytics onder Beheer, Property-instellingen."}`}
            </Tekst>
            {magSchrijven && (
              <Veldrij>
                <Veld label="Analytics property-nummer" plaatshouder="Property-nummer, bijvoorbeeld 312345678" waarde={property} zet={setProperty} />
                <button className="btn btn-klein btn-ghost" disabled={bezig === "ga4"} onClick={() => stuur("ga4", { property })}>
                  {bezig === "ga4" ? "Bezig…" : "Property vastleggen"}
                </button>
              </Veldrij>
            )}

            <Tekst>
              {`**Clarity.** ${klant.clarity.gekoppeld
                ? `De sleutel is bekend. Vandaag ${klant.clarity.vandaag} keer opgehaald, er is nog ruimte voor ${klant.clarity.ruimte}.`
                : "Nog geen sleutel. Zodra je een Clarity-account hebt: maak een project voor deze website aan, zet de code op de site, en maak dan in Instellingen een API-sleutel aan. Die plak je hier."}`}
            </Tekst>
            {magSchrijven && (
              <Veldrij>
                <Veld label="Clarity-sleutel" plaatshouder="Clarity-sleutel plakken" waarde={sleutel} zet={setSleutel} />
                <button className="btn btn-klein btn-ghost" disabled={bezig === "clarity-sleutel"} onClick={() => stuur("clarity-sleutel", { sleutel })}>
                  {bezig === "clarity-sleutel" ? "Bezig…" : klant.clarity.gekoppeld ? "Sleutel vervangen" : "Sleutel opslaan"}
                </button>
                {klant.clarity.gekoppeld && (
                  <button
                    className="btn btn-klein btn-primary"
                    disabled={bezig === "clarity-ophalen" || klant.clarity.ruimte <= 0}
                    onClick={() => stuur("clarity-ophalen", { dagen: 3, dimensie: "URL" })}
                  >
                    {bezig === "clarity-ophalen" ? "Bezig…" : "Nu ophalen (3 dagen, per pagina)"}
                  </button>
                )}
              </Veldrij>
            )}

            <Tekst klein>
              {"Clarity staat tien opvragingen per project per dag toe en gaat nooit verder terug dan drie dagen. " +
                "Elke opvraging wordt daarom bewaard: dat archief kan alleen groeien, en met terugwerkende kracht " +
                "verzamelen kan niet."}
            </Tekst>

            <Tekst>{"**Probeer één pagina.** Plak een adres van deze klant; je krijgt terug wat Analytics over de laatste 28 dagen weet, en wat er in de laatste Clarity-meting over die pagina staat."}</Tekst>
            <Veldrij>
              <Veld
                label="Adres van de pagina"
                soort="url"
                plaatshouder={klant.domein ? `https://${klant.domein.replace(/^www\./, "")}/een-pagina/` : "https://…"}
                waarde={proefUrl}
                zet={setProefUrl}
              />
              <button className="btn btn-klein btn-ghost" disabled={bezig === "proef" || !proefUrl.trim()} onClick={probeer}>
                {bezig === "proef" ? "Bezig…" : "Cijfers ophalen"}
              </button>
            </Veldrij>

            {proef && <Uitkomst analytics={proef.analytics} clarity={proef.clarity.pagina} />}
          </>
        )}
      </Paneel>
    </>
  );
}

function Uitkomst({ analytics, clarity }: { analytics: Cijfers; clarity: ClarityPagina | null }) {
  return (
    <>
      <Tekst>{`**Analytics, laatste ${analytics.dagen} dagen op ${analytics.pad}**`}</Tekst>
      {analytics.melding && <Signaal soort="notitie">{analytics.melding}</Signaal>}
      {analytics.totaal && analytics.totaal.weergaven > 0 && (
        <>
          <Chips>
            <Chip toon="accent">{`${analytics.totaal.weergaven} weergaven`}</Chip>
            <Chip>{`${analytics.totaal.instappen} sessies gestart`}</Chip>
            <Chip>{`${analytics.totaal.betrokkenheid}% betrokken`}</Chip>
            <Chip>{`${analytics.totaal.wegklikken}% meteen weg`}</Chip>
            <Chip>{tijd(analytics.totaal.seconden)}</Chip>
            <Chip toon={analytics.totaal.conversies > 0 ? "goed" : "neutraal"}>{`${analytics.totaal.conversies} conversies`}</Chip>
          </Chips>
          {analytics.perApparaat.length > 1 && (
            <Tabel kolommen={["Apparaat", "Weergaven", "Betrokken", "Meteen weg", "Tijd", "Conversies"]}>
              {analytics.perApparaat.map((a) => (
                <tr key={a.apparaat}>
                  <td>{APPARAAT[a.apparaat] || a.apparaat}</td>
                  <td>{a.gedrag.weergaven}</td>
                  <td>{`${a.gedrag.betrokkenheid}%`}</td>
                  <td>{`${a.gedrag.wegklikken}%`}</td>
                  <td>{tijd(a.gedrag.seconden)}</td>
                  <td>{a.gedrag.conversies}</td>
                </tr>
              ))}
            </Tabel>
          )}
        </>
      )}

      <Tekst>{"**Clarity**"}</Tekst>
      {!clarity ? (
        <Signaal soort="notitie">
          Er is nog geen Clarity-meting waarin deze pagina voorkomt. Haal eerst op, of deze pagina had de laatste dagen te weinig bezoek.
        </Signaal>
      ) : (
        <>
          <Tekst klein>{`Uit de meting van ${datum(clarity.opgehaaldOp)}, over ${clarity.dagen} dagen.`}</Tekst>
          <Tabel kolommen={["Wat Clarity meet", "Waarde"]}>
            {clarity.regels.map((r) => (
              <tr key={r.metriek}>
                <td>{r.metriek}</td>
                <td>{Object.entries(r.waarden).map(([k, v]) => `${k}: ${v}`).join(", ") || "geen cijfers"}</td>
              </tr>
            ))}
          </Tabel>
        </>
      )}
    </>
  );
}

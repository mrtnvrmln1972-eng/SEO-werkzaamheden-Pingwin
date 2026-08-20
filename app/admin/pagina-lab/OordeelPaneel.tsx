"use client";

// ═══════════════════════════════════════════════════════════
// HET OORDEEL OVER ÉÉN PAGINA, MET DE FOTO ERNAAST
// ═══════════════════════════════════════════════════════════
// De drie lagen van het lab staan hier naast elkaar, en dat is niet alleen
// vormgeving. Een bevinding zonder de meting erbij is een mening, en een
// bevinding zonder de foto erbij is niet te controleren: je moet zelf kunnen
// zien wat het lab zag. Daarom blijft de foto in beeld terwijl je door de
// bevindingen scrolt, staat onder elke bevinding waar hij op rust, en staat de
// hele meting eronder, ook de regels waar niets mis mee was.
//
// Wat hier bewust NIET gebeurt: iets opslaan. Het lab schrijft niets, dus elke
// beoordeling is een nieuwe en het scherm zegt dat ook.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { Blok, Chip, Chips, Keuze, Leeg, Paneel, Signaal, Signalen, Tabel, Tekst, Veld, Veldrij } from "../../_ui/Uitkomst";
import type { KlantStand } from "./GedragPaneel";
import { VAKOORDEEL_WAARSCHUWING } from "../../../lib/pagina-lab/kennisbank";
import type { MetingWaarde } from "../../../lib/pagina-lab/meting";
import type { Bevinding, Oordeel, Stand } from "../../../lib/pagina-lab/oordeel";

type Uitkomst = {
  oordeel: Oordeel;
  fotos: { desktop: string; desktopHeel: string | null; mobiel: string | null; afgekapt: boolean };
  metingen: { desktop: MetingWaarde[]; mobiel: MetingWaarde[] };
  pagina: { eindUrl: string; status: number | null; titel: string; woorden: number; hoogte: number; mobielGelukt: boolean };
};

const STAND_TOON: Record<Stand, "goed" | "let-op" | "neutraal" | "uit"> = {
  goed: "goed",
  "kan beter": "let-op",
  mis: "let-op",
  "niet vast te stellen": "uit",
};

const WEEGT_TOON: Record<string, "accent" | "neutraal" | "uit"> = { hoog: "accent", midden: "neutraal", laag: "uit" };

function tijdstip(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
}

/** Eén bevinding: het oordeel, waar het op rust, en waarom het uitmaakt. */
function BevindingBlok({ b }: { b: Bevinding }) {
  const bron = b.bronnen.length
    ? `**Bron:** ${b.bronnen.map((x) => `[${x.naam}](${x.url})`).join(" · ")}`
    : "**Geen bron:** dit is een vakoordeel van Pingwin, geen onderzoek.";
  return (
    <Blok
      titel={`${b.criterium} · ${b.titel}`}
      meta={
        <Chips>
          <Chip toon={STAND_TOON[b.stand]} titel="Het oordeel over deze pagina">{b.stand}</Chip>
          <Chip toon={WEEGT_TOON[b.weegt] || "neutraal"} titel="Hoeveel dit meeweegt">{`weegt ${b.weegt}`}</Chip>
          <Chip toon="neutraal" titel="Het vakgebied waar dit criterium bij hoort">{b.discipline}</Chip>
        </Chips>
      }
    >
      <Tekst>
        {[
          `**Wat we zien.** ${b.wat}`,
          b.advies ? `**Wat we zouden doen.** ${b.advies}` : "",
          `**Waarom het uitmaakt.** ${b.waarom}`,
          b.nuance ? `**Nuance.** ${b.nuance}` : "",
        ].filter(Boolean).join("\n\n")}
      </Tekst>
      <Tekst klein>{`**Vastgesteld uit:** ${b.vastgesteldUit.join(" · ")}\n\n${bron}`}</Tekst>
    </Blok>
  );
}

export default function OordeelPaneel({ klanten }: { klanten: KlantStand[] }) {
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [uit, setUit] = useState<Uitkomst | null>(null);

  const klant = klanten.find((k) => k.slug === slug) || null;

  const beoordeel = useCallback(async (ingevuld: string, klantSlug: string) => {
    // Een adres zonder https:// ervoor is geen fout van Maarten maar van het
    // veld: iedereen plakt "kamsteeg.nl/hovenier". Dus zetten we het er zelf voor.
    const adres = ingevuld.trim() && !/^https?:\/\//i.test(ingevuld.trim()) ? `https://${ingevuld.trim()}` : ingevuld.trim();
    if (!adres) { setFout("Vul eerst het webadres van de pagina in."); return; }
    setBezig(true);
    setFout("");
    setUit(null);
    try {
      const res = await fetch("/api/admin/pagina-lab/oordeel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: adres, slug: klantSlug }),
      });
      const data = await res.json();
      if (!data.ok) setFout(data.error || "Het beoordelen lukte niet.");
      else setUit({ oordeel: data.oordeel, fotos: data.fotos, metingen: data.metingen, pagina: data.pagina });
    } catch {
      setFout("De verbinding met het dashboard viel weg. Bij een zware pagina duurt een beoordeling twee tot drie minuten.");
    } finally {
      setBezig(false);
    }
  }, []);

  // Het adres mag in de link staan: ?pagina=… (en ?klant=…). Met &start=1 begint
  // de beoordeling meteen. Dat is er om twee redenen: je kunt een beoordeling
  // als bladwijzer bewaren of doorsturen, en de schermfoto-route kan niet
  // klikken, dus zonder deze ingang is een gevuld scherm niet te fotograferen.
  // Bewust niet vanzelf starten zonder start=1: elke ronde kost een paar minuten
  // en een beetje geld, en dan zou een keer verversen dat opnieuw uitgeven.
  const gestart = useRef(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const adres = p.get("pagina") || "";
    const klantSlug = p.get("klant") || "";
    if (adres) setUrl(adres);
    if (klantSlug) setSlug(klantSlug);
    if (adres && p.get("start") === "1" && !gestart.current) {
      gestart.current = true;
      void beoordeel(adres, klantSlug);
    }
  }, [beoordeel]);

  const onderbouwd = uit ? uit.oordeel.bevindingen.filter((b) => b.plank === "onderbouwd") : [];
  const eigen = uit ? uit.oordeel.bevindingen.filter((b) => b.plank === "vakoordeel") : [];
  const alleMetingen = uit ? [...uit.metingen.desktop, ...uit.metingen.mobiel.map((m) => ({ ...m, label: `${m.label} (mobiel)` }))] : [];

  return (
    <>
      <Paneel
        titel="Oordeel over één pagina"
        uitleg={
          "Het lab haalt de pagina op, meet hem, fotografeert hem op desktop en op een telefoon, en houdt " +
          "hem daarna tegen de tweeëndertig criteria uit de kennisbank. Per criterium komt er één bevinding " +
          "terug, met de meting en de foto ernaast. Kies je een klant, dan gaan de cijfers van bezoekers mee. " +
          "Er wordt niets bewaard: het lab leest mee en schrijft nog nergens iets weg."
        }
        knoppen={
          <button className="btn btn-primary btn-klein" onClick={() => beoordeel(url, slug)} disabled={bezig}>
            {bezig ? "Bezig met beoordelen" : "Beoordeel deze pagina"}
          </button>
        }
      >
        <Veldrij>
          <Keuze
            label="Klant"
            waarde={slug}
            zet={setSlug}
            opties={[{ waarde: "", naam: "Geen klant (dan zonder bezoekerscijfers)" }, ...klanten.map((k) => ({ waarde: k.slug, naam: k.naam }))]}
          />
          <Veld
            label="Het webadres van de pagina"
            soort="url"
            waarde={url}
            zet={setUrl}
            plaatshouder={klant?.domein ? `${klant.domein.replace(/^www\./i, "")}/pagina/` : "voorbeeld.nl/pagina/"}
          />
        </Veldrij>
        {bezig && (
          <Signaal soort="notitie">
            De pagina wordt nu twee keer bezocht (desktop en telefoon), gemeten en gefotografeerd, en daarna
            beoordeeld. Reken op twee tot drie minuten; laat dit scherm openstaan.
          </Signaal>
        )}
        {fout && <Signaal soort="let-op">{fout}</Signaal>}
      </Paneel>

      {uit && (
        <>
          <Paneel
            titel={`Wat er als eerste opvalt op ${uit.pagina.titel || uit.oordeel.url}`}
            uitleg={`Beoordeeld op ${tijdstip(uit.oordeel.beoordeeldOp)}. De volgorde is berekend, niet gevoeld: wat mis is en zwaar weegt staat bovenaan.`}
          >
            <Chips>
              {uit.oordeel.telling.map((t) => (
                <Chip key={t.stand} toon={STAND_TOON[t.stand]}>{`${t.aantal}× ${t.stand}`}</Chip>
              ))}
            </Chips>
            {uit.oordeel.eerstDit.length ? (
              <Signalen
                soort="let-op"
                regels={uit.oordeel.eerstDit.map((b) => `${b.criterium}, ${b.titel}: ${b.wat}`)}
              />
            ) : (
              <Signaal soort="goed">Er is niets gevonden dat mis is of beter kan. Kijk dan wel even naar de punten die niet vast te stellen waren.</Signaal>
            )}
            {uit.pagina.status !== 200 && (
              <Signaal soort="let-op">
                {`Let op: de server gaf status ${uit.pagina.status ?? "onbekend"} terug op ${uit.oordeel.url}. Dan beoordeel je een foutpagina en niet de pagina die je bedoelde.`}
              </Signaal>
            )}
            {!uit.pagina.mobielGelukt && (
              <Signaal soort="let-op">De mobiele opname is niet gelukt, dus dit oordeel gaat alleen over het desktopbeeld.</Signaal>
            )}
          </Paneel>

          <Paneel
            titel="Het oordeel, met de foto ernaast"
            uitleg="Links wat het lab zag, rechts wat het ervan vindt. Onder elke bevinding staat waar hij op rust."
          >
            <div className="pl-naast">
              <div className="pl-fotos">
                <div className="pl-foto-blok">
                  <div className="pl-foto-naam">Eerste scherm, desktop</div>
                  <img className="pl-foto" src={uit.fotos.desktop} alt="Het eerste scherm van de pagina op een desktopscherm" />
                </div>
                {uit.fotos.mobiel && (
                  <div className="pl-foto-blok">
                    <div className="pl-foto-naam">Eerste scherm, telefoon</div>
                    <img className="pl-foto" src={uit.fotos.mobiel} alt="Het eerste scherm van de pagina op een telefoon" />
                  </div>
                )}
                {uit.fotos.desktopHeel && (
                  <details className="pl-foto-blok">
                    <summary className="pl-foto-naam">De hele pagina{uit.fotos.afgekapt ? " (afgekapt, de pagina is langer)" : ""}</summary>
                    <div className="pl-foto-lang">
                      <img className="pl-foto" src={uit.fotos.desktopHeel} alt="De hele pagina van boven naar beneden" />
                    </div>
                  </details>
                )}
              </div>
              <div className="pl-lijst">
                {onderbouwd.length ? onderbouwd.map((b) => <BevindingBlok key={b.criterium} b={b} />) : (
                  <Leeg>Er kwam geen enkele bevinding terug die tegen een criterium uit de kennisbank te leggen was.</Leeg>
                )}
              </div>
            </div>
          </Paneel>

          {eigen.length > 0 && (
            <Paneel
              titel="Vakoordeel van Pingwin over deze pagina"
              uitleg="Hetzelfde oordeel, maar dan tegen wat wij uit ervaring vinden. Dit staat apart omdat er geen onderzoek onder ligt."
            >
              <Signaal soort="let-op">{VAKOORDEEL_WAARSCHUWING}</Signaal>
              {eigen.map((b) => <BevindingBlok key={b.criterium} b={b} />)}
            </Paneel>
          )}

          <Paneel
            titel="De meting waar dit op rust"
            uitleg="Alles wat er aan deze pagina te meten viel, ook waar niets mis mee was. Zo is te zien wat het oordeel wél en niet heeft kunnen zien."
          >
            <Tabel kolommen={["Wat", "Gemeten", "Hoort bij"]}>
              {alleMetingen.map((m, i) => (
                <tr key={`${m.sleutel}-${i}`}>
                  <td>{m.label}</td>
                  <td>{m.waarde}{m.detail ? <><br /><span className="pl-detail">{m.detail}</span></> : null}</td>
                  <td>{m.criteria.join(", ")}</td>
                </tr>
              ))}
            </Tabel>
          </Paneel>

          {uit.oordeel.opmerkingen.length > 0 && (
            <Paneel
              titel="Wat er niet is meegenomen"
              uitleg="Wat er van de beoordeling is afgevallen en waarom. Dit staat er met opzet in beeld: stilletjes weglaten maakt een oordeel completer dan het is."
            >
              <Signalen soort="notitie" regels={uit.oordeel.opmerkingen} />
            </Paneel>
          )}
        </>
      )}
    </>
  );
}

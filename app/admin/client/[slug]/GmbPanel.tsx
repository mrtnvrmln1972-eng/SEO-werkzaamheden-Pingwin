"use client";

import { useCallback, useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { BRIL_LABEL, BRIL_UITLEG, STAND_LABEL, DREMPEL, beheerUitnodiging, STANDAARD_UITNODIGING, type Bril, type Stand } from "../../../../lib/gmb-kennis";
import { STAP, type StapKey } from "../../../../lib/onboarding-stappen";
import MailVenster from "./MailVenster";
import { CHECKS } from "../../../../lib/gmb-kennis";
import HelpHint from "./HelpHint";
import { Omlaag, Uitklap } from "../../../_ui/Pijl";

// ═══════════════════════════════════════════════════════════
// HET GOOGLE-PROFIELSCHERM
// ═══════════════════════════════════════════════════════════
// Eén regel per vestiging, uitklapbaar, want een bedrijf met vijf locaties
// heeft vijf profielen en die staan er niet allemaal even goed voor.
// De criteria en teksten komen uit lib/gmb-kennis.ts, dus dit bestand bepaalt
// alleen de vorm, nooit het oordeel.

type Bevinding = {
  key: string; bril: Bril; label: string; waarom: string; actie: string;
  zwaarte: "hoog" | "middel" | "laag"; hardheid: "gemeten" | "richtinggevend";
  bron: "maps" | "beheer" | "eigen"; bewijs: string;
};
type Concurrent = { naam: string; mapsUrl: string; gemiddelde: number | null; aantalReviews: number; aantalFotos: number; hoofdcategorie: string; gevonden: boolean };
type Prestaties = { vanaf: string; tot: string; vertoningenZoek: number; vertoningenKaart: number; telefoontjes: number; routes: number; websiteklikken: number; berichten: number };
type Profiel = { placeId: string; naam: string; adres: string; telefoon: string; website: string; mapsUrl: string; gemiddelde: number | null; aantalReviews: number; aantalFotos: number; hoofdcategorie: string; openingstijden: string[]; status: string };
type Seintje = { sterren: number; tekst: string; auteur: string; wanneer: string; beantwoord: boolean };
type Locatie = {
  sleutel: string; vestiging: string; placeId: string; gekoppeld: boolean;
  profiel: Profiel | null; stand: Stand; bevindingen: Bevinding[];
  concurrenten: Concurrent[]; dubbelen: { naam: string; adres: string; mapsUrl: string }[];
  prestaties: Prestaties | null; prestaties90: Prestaties | null;
  seintjes: Seintje[]; reviewsBeantwoord: { beantwoord: number; totaal: number } | null;
};
type Suggestie = { key: string; titel: string; wat: string; waarom: string; ritme: string };
type Result = {
  samenvatting: string; locaties: Locatie[]; suggesties: Suggestie[]; nietGemeten: string[];
  beheerdeur: { connected: boolean; werkt: boolean; melding: string }; meetdeur: boolean; gedraaidOp: string;
};
type State = { status: string; result: Result | null; error: string; updatedAt: string | null; koppelingen: Record<string, string>; meetdeur: boolean };
type Treffer = { placeId: string; naam: string; adres: string; gemiddelde: number | null; aantalReviews: number; mapsUrl: string; categorie: string; website: string };

// Welke bevindingen het dashboard ter plekke kan doorvoeren. Spiegelt de lijst
// in app/api/admin/gmb/doorvoeren/route.ts; alles daarbuiten wordt een taak.
// Bewust kort: alleen wat in ónze eigen bedrijfsgegevens staat en waarvan we
// zeker weten wat er hoort te staan. Nooit iets op het profiel van de klant.
const DOORVOERBAAR = new Set(["geen-mapslink-vastgelegd", "reviewcijfer-wijkt-af"]);

const BRILLEN: Bril[] = ["compleet", "consistent", "reviews", "beeld", "activiteit", "concurrentie"];

function datum(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; }
}
function getal(n: number): string { return n.toLocaleString("nl-NL"); }
function sterrenTekst(n: number | null): string { return n == null ? "geen cijfer" : n.toFixed(1).replace(".", ","); }

/**
 * Google plakt zijn eigen herkomst-parameters achter de website-link op een
 * profiel (?y_source=...). Die horen bij de link, maar niet in beeld: ze maken
 * er drie regels onleesbare tekens van. We tonen het schone adres en linken naar
 * wat er echt staat.
 */
function nettAdres(url: string): string {
  try {
    const u = new URL(url);
    const pad = u.pathname.replace(/\/+$/, "");
    return u.hostname.replace(/^www\./, "") + pad;
  } catch { return url; }
}

export default function GmbPanel({ slug, clientName, clientEmail, pingwinEmail, onGaNaar }: {
  slug: string;
  clientName: string;
  /** Waar de uitnodiging naartoe gaat. Leeg = geen mailknop, wel de tekst. */
  clientEmail?: string;
  /** Het adres dat de klant als beheerder moet toevoegen. */
  pingwinEmail?: string;
  /** Naar een ander tabblad springen (bijvoorbeeld de bedrijfsgegevens). */
  onGaNaar?: (tab: string) => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [zoekVoor, setZoekVoor] = useState<string | null>(null);
  const [zoekTekst, setZoekTekst] = useState("");
  const [treffers, setTreffers] = useState<Treffer[]>([]);
  const [zoekBusy, setZoekBusy] = useState(false);
  const [concept, setConcept] = useState<Record<string, string>>({});
  const [conceptBusy, setConceptBusy] = useState<string | null>(null);
  const [suggestiesOpen, setSuggestiesOpen] = useState(false);
  const [uitnodigingOpen, setUitnodigingOpen] = useState(false);
  // Wat de poort tegenhield, plus wat er daarna van geregeld is. Staat hier
  // zodat je het vanaf dit scherm kunt oplossen in plaats van doorgestuurd te
  // worden naar een ander tabblad.
  const [blokkade, setBlokkade] = useState<{ key: StapKey; label: string; door: string; tab?: string }[]>([]);
  const [regelBusy, setRegelBusy] = useState<string | null>(null);
  const [regelMelding, setRegelMelding] = useState<Record<string, string>>({});
  // De twee instellingen achter de uitnodiging: met welk Google-adres we toegang
  // vragen, en met welke tekst. Eén keer instellen, geldt voor alle klanten.
  const [googleAdres, setGoogleAdres] = useState("");
  const [sjabloon, setSjabloon] = useState("");
  const [instelBusy, setInstelBusy] = useState(false);
  const [instelMelding, setInstelMelding] = useState("");
  const [mailOpen, setMailOpen] = useState(false);
  // Aangevinkte punten per soort, plus de terugkoppeling na het aanmaken.
  // Bewaard in het tabblad, niet alleen in het geheugen van dit scherm. Reden:
  // je vinkt iets aan, klikt door naar de planning om te kijken of het er staat,
  // komt terug, en alles is weg. Dat overkwam Maarten en het is terecht
  // onbegrijpelijk (6 augustus 2026).
  const bewaarSleutel = `gmb-gekozen:${slug}`;
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [taakBusy, setTaakBusy] = useState(false);
  const [taakMelding, setTaakMelding] = useState("");
  const [voerBusy, setVoerBusy] = useState<string | null>(null);
  const [voerMelding, setVoerMelding] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const d = await fetch(`/api/admin/gmb?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt, koppelingen: d.koppelingen || {}, meetdeur: !!d.meetdeur });
    } catch { /* stil: wat er stond blijft staan */ }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // De aangevinkte punten terughalen bij het openen, en bewaren bij elke wijziging.
  useEffect(() => {
    try {
      const ruw = sessionStorage.getItem(bewaarSleutel);
      if (ruw) setGekozen(new Set(JSON.parse(ruw) as string[]));
    } catch { /* geen opslag beschikbaar: dan gewoon leeg beginnen */ }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug]);

  useEffect(() => {
    try {
      if (gekozen.size) sessionStorage.setItem(bewaarSleutel, JSON.stringify([...gekozen]));
      else sessionStorage.removeItem(bewaarSleutel);
    } catch { /* geen opslag beschikbaar */ }
  }, [gekozen, bewaarSleutel]);

  useEffect(() => {
    fetch("/api/admin/gmb/instellingen")
      .then((x) => x.json())
      .then((d) => { if (d.ok) { setGoogleAdres(d.googleAdres || ""); setSjabloon(d.sjabloon || ""); } })
      .catch(() => { /* stil: dan staat de standaardtekst er gewoon */ });
  }, []);

  // Zolang de scan draait elke acht seconden kijken of hij klaar is. Wegklikken
  // mag: de scan draait server-side door.
  useEffect(() => {
    if (state?.status !== "running") return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [state?.status, load]);

  async function start() {
    setBusy(true); setErr("");
    try {
      const d = await fetch("/api/admin/gmb", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }),
      }).then((r) => r.json());
      if (!d.ok) {
        setErr(d.error || "Starten is niet gelukt.");
        setBlokkade(Array.isArray(d.onboarding) ? d.onboarding : []);
      } else { setBlokkade([]); setRegelMelding({}); await load(); }
    } catch { setErr("Starten is niet gelukt."); } finally { setBusy(false); }
  }

  async function zoek(sleutel: string, vraag: string) {
    setZoekBusy(true); setTreffers([]);
    try {
      const d = await fetch(`/api/admin/gmb/koppel?slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(vraag)}`).then((r) => r.json());
      if (d.ok) setTreffers(d.treffers || []);
      else setErr(d.error || "Zoeken is niet gelukt.");
    } catch { setErr("Zoeken is niet gelukt."); } finally { setZoekBusy(false); void sleutel; }
  }

  async function koppel(sleutel: string, placeId: string) {
    try {
      const d = await fetch("/api/admin/gmb/koppel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, sleutel, placeId }),
      }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Koppelen is niet gelukt."); return; }
      setZoekVoor(null); setTreffers([]); setZoekTekst("");
      await load();
    } catch { setErr("Koppelen is niet gelukt."); }
  }

  async function schrijfConcept(loc: Locatie, s: Seintje, id: string) {
    setConceptBusy(id);
    try {
      const d = await fetch("/api/admin/gmb/review-antwoord", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tekst: s.tekst, sterren: s.sterren, auteur: s.auteur, vestiging: loc.vestiging }),
      }).then((r) => r.json());
      if (d.ok) setConcept((c) => ({ ...c, [id]: d.antwoord || "" }));
      else setErr(d.error || "Het concept schrijven is niet gelukt.");
    } catch { setErr("Het concept schrijven is niet gelukt."); } finally { setConceptBusy(null); }
  }

  // Eén ontbrekende voorwaarde hier ter plekke laten regelen. Lukt het, dan
  // proberen we meteen opnieuw te meten: dat is waar hij voor kwam.
  async function regel(stap: StapKey) {
    setRegelBusy(stap); setErr("");
    try {
      const d = await fetch("/api/admin/gmb/regel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, stap }),
      }).then((x) => x.json());
      if (d.ok) {
        setRegelMelding((m) => ({ ...m, [stap]: d.melding || "Geregeld." }));
        await start();
      } else {
        setRegelMelding((m) => ({ ...m, [stap]: d.error || "Dit lukte niet." }));
      }
    } catch {
      setRegelMelding((m) => ({ ...m, [stap]: "Dit lukte niet." }));
    } finally { setRegelBusy(null); }
  }

  async function bewaarInstellingen() {
    setInstelBusy(true); setInstelMelding("");
    try {
      const d = await fetch("/api/admin/gmb/instellingen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleAdres, sjabloon }),
      }).then((x) => x.json());
      setInstelMelding(d.ok ? "Opgeslagen." : (d.error || "Opslaan is niet gelukt."));
    } catch { setInstelMelding("Opslaan is niet gelukt."); } finally { setInstelBusy(false); }
  }

  // Van signaal naar kaart op de planning. Een bevinding die alleen op een
  // scherm staat, gebeurt niet.
  async function maakTaken(soort: "bevinding" | "suggestie" | "beheer" | "nogniet", sleutel: string, keys: string[]) {
    if (!keys.length && soort !== "beheer") { setTaakMelding("Vink eerst aan wat er op de planning moet."); return; }
    setTaakBusy(true); setTaakMelding("");
    try {
      // De gedeelde ingang, dezelfde voor elk scherm dat iets signaleert.
      const d = await fetch("/api/admin/signaal-taak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, bron: `gmb-${soort}`, keys: keys.length ? keys : [soort], ctx: { sleutel } }),
      }).then((x) => x.json());
      setTaakMelding(d.ok ? d.melding : (d.error || "Taken maken is niet gelukt."));
      if (d.ok) setGekozen(new Set());
    } catch { setTaakMelding("Taken maken is niet gelukt."); } finally { setTaakBusy(false); }
  }

  /**
   * Alles wat aangevinkt staat op de planning, ongeacht in welk blok het stond.
   * Bewust één handeling: het vinkje en de knop stonden eerst ver uit elkaar, en
   * dan vink je aan en denk je dat het geregeld is. Dat is precies wat er
   * gebeurde.
   */
  async function zetAllesGekozen() {
    const ids = [...gekozen];
    if (!ids.length) return;
    setTaakBusy(true); setTaakMelding("");
    let totaal = 0;
    const fouten: string[] = [];
    // Per vestiging en per soort gebundeld, want de resolver kijkt per locatie.
    const groepen = new Map<string, { soort: "bevinding" | "suggestie" | "nogniet"; sleutel: string; keys: string[] }>();
    for (const id of ids) {
      if (id.startsWith("b:")) {
        const [, sleutel, key] = id.split(":");
        const g = `b:${sleutel}`;
        if (!groepen.has(g)) groepen.set(g, { soort: "bevinding", sleutel, keys: [] });
        groepen.get(g)!.keys.push(key);
      } else if (id.startsWith("n:")) {
        const [, sleutel, key] = id.split(":");
        const g = `n:${sleutel}`;
        if (!groepen.has(g)) groepen.set(g, { soort: "nogniet", sleutel, keys: [] });
        groepen.get(g)!.keys.push(key);
      } else if (id.startsWith("s:")) {
        const g = "s";
        if (!groepen.has(g)) groepen.set(g, { soort: "suggestie", sleutel: state?.result?.locaties[0]?.sleutel || "", keys: [] });
        groepen.get(g)!.keys.push(id.slice(2));
      }
    }
    for (const g of groepen.values()) {
      try {
        const d = await fetch("/api/admin/signaal-taak", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, bron: `gmb-${g.soort}`, keys: g.keys, ctx: { sleutel: g.sleutel } }),
        }).then((x) => x.json());
        if (d.ok) totaal += (d.added || 0) + (d.merged || 0);
        else fouten.push(d.error || "Er ging iets mis.");
      } catch { fouten.push("Er ging iets mis."); }
    }
    setTaakBusy(false);
    if (totaal) { setGekozen(new Set()); setTaakMelding(`${totaal} ${totaal === 1 ? "taak staat" : "taken staan"} op de planning.`); }
    else setTaakMelding(fouten[0] || "Er is niets aangemaakt.");
  }

  /** Een bevinding die alleen onze eigen administratie raakt, meteen regelen. */
  async function voerDoor(sleutel: string, key: string) {
    const id = `${sleutel}:${key}`;
    setVoerBusy(id);
    try {
      const d = await fetch("/api/admin/gmb/doorvoeren", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, sleutel, key }),
      }).then((x) => x.json());
      setVoerMelding((m) => ({ ...m, [id]: d.ok ? d.melding || "Doorgevoerd." : (d.error || "Doorvoeren is niet gelukt.") }));
      if (d.ok) await load();
    } catch {
      setVoerMelding((m) => ({ ...m, [id]: "Doorvoeren is niet gelukt." }));
    } finally { setVoerBusy(null); }
  }

  const vink = (id: string) => setGekozen((s2) => { const n = new Set(s2); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const r = state?.result || null;
  const draait = state?.status === "running";
  // Zolang dit null is weten we nog niet óf er al een meting ligt. Een knop die
  // dan "Meet het profiel" zegt liegt: je drukt erop omdat je denkt dat er niets
  // is, en je start een nieuwe scan over een meting die er gewoon al stond.
  const geladen = state !== null;

  return (
    <div className="section gmb-scherm">
      {/* Zodra er iets aangevinkt staat zweeft de knop onderaan het venster.
          Nooit meer een vinkje waarvan de bijbehorende knop buiten beeld hangt,
          en niet bovenin waar de vaste kopbalk eroverheen valt. */}
      {gekozen.size > 0 && (
        <div className="gmb-balk">
          <span className="gmb-balk-tel">{gekozen.size} {gekozen.size === 1 ? "punt" : "punten"} aangevinkt</span>
          <button className="btn btn-primary" onClick={zetAllesGekozen} disabled={taakBusy}>
            {taakBusy ? "Bezig…" : "Zet op de planning"}
          </button>
          <button className="btn" onClick={() => setGekozen(new Set())} disabled={taakBusy}>Vinkjes wissen</button>
          {taakMelding && <span className="gmb-balk-melding">{taakMelding}</span>}
        </div>
      )}
      {gekozen.size === 0 && taakMelding && (
        <div className="gmb-balk gmb-balk-klaar">
          <span className="gmb-balk-melding">{taakMelding}</span>
          <a className="btn" href={`/admin/client/${slug}?tab=werkzaamheden`}>Bekijk de planning</a>
          <button className="btn" onClick={() => setTaakMelding("")}>Sluiten</button>
        </div>
      )}

      <div className="card">
        <span className="strategy-title">
          Google-bedrijfsprofiel
          <HelpHint xl title="Het Google-bedrijfsprofiel: de etalage op de kaart" text={"Het profiel dat naast de zoekresultaten en op Google Maps staat. Voor een lokaal bedrijf is dit vaak het eerste én het enige wat iemand ziet voordat hij belt of de route opvraagt.\n## Waarom dit een eigen scherm heeft\nHet profiel bepaalt of je in het **lokale blok** bovenaan de zoekresultaten komt (de drie bedrijven met de kaart erbij). Dat blok krijgt bij lokale zoekopdrachten meer aandacht dan de gewone resultaten eronder, en het wordt niet door je website gewonnen maar door je profiel.\n## Twee deuren, en het verschil is zichtbaar\n- **De meetdeur** werkt altijd en meet ook de **concurrenten**. Daar zit de waarde: 42 reviews zegt niets, 42 tegenover 180 is een gesprek.\n- **De beheerdeur** gaat alleen open voor profielen waar Pingwin beheerder van is én nadat Google ons project heeft goedgekeurd. Die levert de **bezoekcijfers** (hoe vaak gezien, gebeld, route gevraagd), de volledige reviewlijst met antwoorden, de posts en de vragen.\nWat niet gemeten kon worden staat er altijd bij, met de reden. Een lege uitslag mag nooit lezen als \"er is niets aan de hand\".\n## Wat er niet gebeurt\nHet dashboard wijzigt **niets** automatisch op het profiel. Het schrijft voor, jij keurt per stuk goed. Google kan een profiel schorsen bij vreemde wijzigingen, en dat is de etalage van de klant."} />
        </span>
        <p className="prio-intro">
          Hoe staat {clientName} ervoor op de kaart, per vestiging, en hoe verhoudt dat zich tot de concurrenten in de buurt.
        </p>

        <div className="row" style={{ flexWrap: "wrap" }}>
          {geladen ? (
            <button className="btn btn-primary" onClick={start} disabled={busy || draait}>
              {draait ? "De scan draait…" : r ? "Opnieuw meten" : "Meet het profiel"}
            </button>
          ) : (
            <span className="gmb-laden">Even laden, de laatste meting wordt opgehaald…</span>
          )}
          {geladen && state?.updatedAt && !draait && (
            <span className="prio-meta" style={{ margin: "var(--s-0)" }}>Laatst gemeten op {datum(state.updatedAt)}</span>
          )}
        </div>

        {err && <p className="gmb-fout">{err}</p>}

        {blokkade.length > 0 && (
          <div className="gmb-poort">
            <span className="gmb-subkop">Dit moet er eerst staan</span>
            <p className="gmb-bril-uitleg">
              Je hoeft hier niet voor weg. Wat het dashboard zelf kan regelen, doet het met de knop ernaast;
              daarna wordt er meteen opnieuw gemeten.
            </p>
            {blokkade.map((b) => {
              const def = STAP.get(b.key);
              const zelf = def?.door === "dashboard";
              return (
                <div className="gmb-poort-regel" key={b.key}>
                  <div>
                    <strong>{b.label}</strong>
                    {def?.waarom && <span className="gmb-treffer-meta">{def.waarom}</span>}
                    {regelMelding[b.key] && <span className="gmb-poort-melding">{regelMelding[b.key]}</span>}
                  </div>
                  {zelf ? (
                    <button className="btn btn-primary" onClick={() => regel(b.key)} disabled={regelBusy === b.key || busy}>
                      {regelBusy === b.key ? "Bezig…" : "Regel dit nu"}
                    </button>
                  ) : onGaNaar && b.tab ? (
                    <button className="btn" onClick={() => onGaNaar(b.tab!)}>Dit doe jij, breng me erheen</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {state?.status === "error" && state.error && <p className="gmb-fout">{state.error}</p>}

        {state && !state.meetdeur && (
          <div className="gmb-blokkade">
            <strong>Er is nog geen Google Maps-sleutel in deze omgeving.</strong>
            <p>
              Zonder die sleutel kan het dashboard geen enkel profiel meten, ook niet dat van de concurrenten.
              Zet <code>GOOGLE_MAPS_API_KEY</code> in Vercel bij dit project (Settings, Environment Variables) en deploy één keer opnieuw.
              Daarna werkt deze knop.
            </p>
          </div>
        )}

        {draait && <p className="prio-meta">De scan draait. Je mag wegklikken; hij loopt door en het resultaat staat er straks.</p>}
      </div>

      {r && (
        <>
          <div className="card">
            <span className="section-title">Wat er staat</span>
            <p className="prio-intro">{r.samenvatting}</p>

            {/* De beheerdeur: eerlijk zeggen wat er wél en niet gemeten is. */}
            <div className={"gmb-deur " + (r.beheerdeur.werkt ? "gmb-deur-aan" : "gmb-deur-uit")}>
              <strong>{r.beheerdeur.werkt ? "Beheertoegang: aan" : "Beheertoegang: nog niet"}</strong>
              <span>{r.beheerdeur.melding}</span>
              {!r.beheerdeur.connected && (
                <a className="btn" href="/api/google/auth/start?purpose=profiel">Koppel het beheeraccount</a>
              )}
              <button className="btn" onClick={() => setUitnodigingOpen((v) => !v)}>
                {uitnodigingOpen ? "Uitnodiging verbergen" : "Vraag de klant om beheertoegang"}
              </button>
            </div>

            {uitnodigingOpen && (
              <div className="gmb-uitnodiging" id="gmb-beheer">
                <div className="gmb-instel">
                  <label>
                    <span>Met welk Google-adres vragen we toegang?</span>
                    <input
                      className="gmb-zoekveld" value={googleAdres} placeholder="jouw@gmail.com"
                      onChange={(e) => setGoogleAdres(e.target.value)}
                    />
                  </label>
                  <p className="gmb-bril-uitleg">
                    Bewust niet je Pingwin-mailadres: toegang tot Google-diensten hangt aan het Google-account waarmee je
                    in Chrome zit. Je stelt dit één keer in, voor alle klanten. Het adres komt in de mail terecht.
                  </p>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    <button className="btn" onClick={bewaarInstellingen} disabled={instelBusy}>
                      {instelBusy ? "Opslaan…" : "Bewaar het adres"}
                    </button>
                    <button className="btn btn-primary" onClick={() => setMailOpen(true)}>Schrijf de mail</button>
                    {instelMelding && <span className="gmb-poort-melding">{instelMelding}</span>}
                  </div>
                </div>
              </div>
            )}

            {r.nietGemeten.length > 0 && (
              <div className="gmb-niet-gemeten">
                <strong>Wat we niet konden meten</strong>
                <ul>{r.nietGemeten.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
          </div>

          {r.locaties.map((loc) => {
            const uit = open.has(loc.sleutel);
            const perBril = BRILLEN.map((b) => ({ bril: b, items: loc.bevindingen.filter((x) => x.bril === b) })).filter((x) => x.items.length);
            return (
              <div className="card" key={loc.sleutel}>
                <button
                  className="gmb-kop"
                  onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(loc.sleutel)) n.delete(loc.sleutel); else n.add(loc.sleutel); return n; })}
                >
                  <span className="gmb-kop-pijl">{uit ? <Omlaag /> : <Uitklap />}</span>
                  <span className="gmb-kop-naam">{loc.vestiging}</span>
                  <span className={"gmb-stand gmb-stand-" + loc.stand}>{STAND_LABEL[loc.stand]}</span>
                  {loc.profiel && (
                    <span className="gmb-kop-cijfers">
                      {sterrenTekst(loc.profiel.gemiddelde)} uit {getal(loc.profiel.aantalReviews)} reviews · {getal(loc.profiel.aantalFotos)} foto&apos;s
                    </span>
                  )}
                  {loc.bevindingen.length > 0 && <span className="gmb-kop-tel">{loc.bevindingen.length} {loc.bevindingen.length === 1 ? "punt" : "punten"}</span>}
                </button>

                {!loc.profiel && (
                  <div className="gmb-geen-profiel">
                    <p>Voor deze vestiging is geen Google-profiel gevonden. Zoek het handmatig op en koppel het, of laat het aanmaken als het er echt niet is.</p>
                    <button className="btn" onClick={() => { setZoekVoor(loc.sleutel); setZoekTekst(`${clientName} ${loc.vestiging}`); }}>Profiel opzoeken</button>
                  </div>
                )}

                {zoekVoor === loc.sleutel && (
                  <div className="gmb-zoek">
                    <div className="row">
                      <input
                        className="gmb-zoekveld" value={zoekTekst} placeholder="Bedrijfsnaam en plaats"
                        onChange={(e) => setZoekTekst(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") zoek(loc.sleutel, zoekTekst); }}
                      />
                      <button className="btn" onClick={() => zoek(loc.sleutel, zoekTekst)} disabled={zoekBusy}>
                        {zoekBusy ? "Zoeken…" : "Zoek"}
                      </button>
                      <button className="btn" onClick={() => { setZoekVoor(null); setTreffers([]); }}>Annuleren</button>
                    </div>
                    {treffers.map((t) => (
                      <div className="gmb-treffer" key={t.placeId}>
                        <div>
                          <strong>{t.naam}</strong>
                          <span className="gmb-treffer-meta">
                            {t.adres}{t.categorie ? ` · ${t.categorie}` : ""}
                            {t.aantalReviews ? ` · ${sterrenTekst(t.gemiddelde)} uit ${getal(t.aantalReviews)} reviews` : ""}
                          </span>
                          {t.website && <a className="gmb-link" href={t.website} target="_blank" rel="noreferrer">{t.website}</a>}
                        </div>
                        <button className="btn btn-primary" onClick={() => koppel(loc.sleutel, t.placeId)}>Dit is het</button>
                      </div>
                    ))}
                  </div>
                )}

                {uit && loc.profiel && (
                  <div className="gmb-body">
                    {/* Wat er nu op het profiel staat */}
                    <div className="gmb-feiten">
                      <div><span>Naam</span><strong>{loc.profiel.naam}</strong></div>
                      <div><span>Adres</span><strong>{loc.profiel.adres || "niet ingevuld"}</strong></div>
                      <div><span>Telefoon</span><strong>{loc.profiel.telefoon || "niet ingevuld"}</strong></div>
                      <div><span>Categorie</span><strong>{loc.profiel.hoofdcategorie || "niet ingevuld"}</strong></div>
                      <div>
                        <span>Website</span>
                        <strong>{loc.profiel.website
                          ? <a className="gmb-link" href={loc.profiel.website} target="_blank" rel="noreferrer" title={loc.profiel.website}>{nettAdres(loc.profiel.website)}</a>
                          : "niet ingevuld"}</strong>
                      </div>
                      <div>
                        <span>Op Google</span>
                        <strong>{loc.profiel.mapsUrl
                          ? <a className="gmb-link" href={loc.profiel.mapsUrl} target="_blank" rel="noreferrer">Profiel openen</a>
                          : "geen link"}</strong>
                      </div>
                    </div>

                    {/* Bezoekcijfers: alleen met beheertoegang */}
                    {loc.prestaties ? (
                      <div className="gmb-prestaties">
                        <span className="gmb-subkop">Wat het profiel opleverde, laatste 30 dagen</span>
                        <div className="gmb-cijfers">
                          <div><strong>{getal(loc.prestaties.vertoningenZoek + loc.prestaties.vertoningenKaart)}</strong><span>keer gezien</span></div>
                          <div><strong>{getal(loc.prestaties.telefoontjes)}</strong><span>keer gebeld</span></div>
                          <div><strong>{getal(loc.prestaties.routes)}</strong><span>routes gevraagd</span></div>
                          <div><strong>{getal(loc.prestaties.websiteklikken)}</strong><span>klikken naar de site</span></div>
                        </div>
                        {loc.prestaties90 && (
                          <p className="prio-meta">
                            Over 90 dagen: {getal(loc.prestaties90.vertoningenZoek + loc.prestaties90.vertoningenKaart)} keer gezien,{" "}
                            {getal(loc.prestaties90.telefoontjes)} keer gebeld. Dit is het startpunt waartegen we het effect van optimalisaties afmeten.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="prio-meta">
                        Bezoekcijfers zijn er nog niet voor deze vestiging. Die komen pas met beheertoegang tot dit profiel.
                      </p>
                    )}

                    {/* De bevindingen, per bril */}
                    {perBril.length === 0 && <p className="prio-meta">Op dit profiel is niets gevonden dat aandacht vraagt. Kijk bij de suggesties onderaan wat er nog bovenop kan.</p>}
                    {perBril.map(({ bril, items }) => (
                      <div className="gmb-bril" key={bril}>
                        <span className="gmb-subkop">{BRIL_LABEL[bril]}</span>
                        <p className="gmb-bril-uitleg">{BRIL_UITLEG[bril]}</p>
                        {items.map((b) => (
                          <div className={"gmb-bevinding gmb-zwaarte-" + b.zwaarte} key={b.key} id={`gmb-${loc.sleutel}-${b.key}`}>
                            <div className="gmb-bevinding-kop">
                              <label className="gmb-vink">
                                <input type="checkbox"
                                  checked={gekozen.has(`b:${loc.sleutel}:${b.key}`)}
                                  onChange={() => vink(`b:${loc.sleutel}:${b.key}`)} />
                                <span>op de planning</span>
                              </label>
                              <strong>{b.label}</strong>
                              <span className={"chip " + (b.hardheid === "gemeten" ? "gmb-hard" : "gmb-zacht")}>
                                {b.hardheid === "gemeten" ? "gemeten" : "richtinggevend"}
                              </span>
                            </div>
                            <p className="gmb-bewijs">{b.bewijs}</p>
                            <p className="gmb-waarom">{b.waarom}</p>
                            <p className="gmb-actie"><span>Wat je doet:</span> {b.actie}</p>
                            {DOORVOERBAAR.has(b.key) && (
                              <div className="row gmb-voer" style={{ flexWrap: "wrap" }}>
                                <button className="btn btn-primary" disabled={voerBusy === `${loc.sleutel}:${b.key}`}
                                  onClick={() => voerDoor(loc.sleutel, b.key)}>
                                  {voerBusy === `${loc.sleutel}:${b.key}` ? "Bezig…" : "Voer door"}
                                </button>
                                <span className="gmb-voer-uitleg">Dit raakt alleen de bedrijfsgegevens hier, niet het profiel van de klant.</span>
                                {voerMelding[`${loc.sleutel}:${b.key}`] && (
                                  <span className="gmb-poort-melding">{voerMelding[`${loc.sleutel}:${b.key}`]}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Zonder beheertoegang zijn dit geen bevindingen: we weten niet óf
                        ze misgaan. Maar ze horen wel in de inventarisatie, anders lijkt
                        het profiel af terwijl de halve etalage ongezien is. */}
                    {!r.beheerdeur.werkt && (
                      <div className="gmb-bril" id="gmb-nogniet">
                        <span className="gmb-subkop">Nog niet te meten, wel te doen</span>
                        <p className="gmb-bril-uitleg">
                          Deze onderdelen zitten achter de beheertoegang, dus we kunnen niet zien hoe ze ervoor staan.
                          Ze verdienen hoe dan ook aandacht, dus je kunt ze nu al op de planning zetten.
                        </p>
                        {CHECKS.filter((c) => c.bron === "beheer").map((c) => (
                          <div className="gmb-bevinding gmb-nogniet-rij" key={c.key} id={`gmb-nogniet-${c.key}`}>
                            <div className="gmb-bevinding-kop">
                              <label className="gmb-vink">
                                <input type="checkbox"
                                  checked={gekozen.has(`n:${loc.sleutel}:${c.key}`)}
                                  onChange={() => vink(`n:${loc.sleutel}:${c.key}`)} />
                                <span>op de planning</span>
                              </label>
                              <strong>{c.label}</strong>
                              <span className="chip gmb-zacht">niet gemeten</span>
                            </div>
                            <p className="gmb-waarom">{c.waarom}</p>
                            <p className="gmb-actie"><span>Wat je doet:</span> {c.actie}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {perBril.length > 0 && (
                      <div className="row gmb-taakbalk" style={{ flexWrap: "wrap" }}>
                        <button className="btn" disabled={taakBusy}
                          onClick={() => maakTaken("bevinding", loc.sleutel, loc.bevindingen.map((b) => b.key))}>
                          Zet alle punten van deze vestiging op de planning
                        </button>
                      </div>
                    )}

                    {/* Reviews die om een antwoord vragen */}
                    {loc.seintjes.length > 0 && (
                      <div className="gmb-bril">
                        <span className="gmb-subkop">Reviews die om een antwoord vragen</span>
                        <p className="gmb-bril-uitleg">
                          {DREMPEL.lageReviewSterren} sterren of lager. Het dashboard schrijft een concept; de klant plaatst het zelf op het profiel.
                        </p>
                        {loc.seintjes.map((s, i) => {
                          const id = `${loc.sleutel}-${i}`;
                          return (
                            <div className="gmb-review" key={id}>
                              <div className="gmb-review-kop">
                                <strong>{"★".repeat(s.sterren)}{"☆".repeat(5 - s.sterren)}</strong>
                                <span>{s.auteur || "onbekend"}{s.wanneer ? ` · ${datum(s.wanneer)}` : ""}</span>
                                {s.beantwoord && <span className="chip gmb-hard">beantwoord</span>}
                              </div>
                              {s.tekst && <p className="gmb-review-tekst">{s.tekst}</p>}
                              {!concept[id] ? (
                                <button className="btn" onClick={() => schrijfConcept(loc, s, id)} disabled={conceptBusy === id}>
                                  {conceptBusy === id ? "Schrijven…" : "Schrijf een concept-antwoord"}
                                </button>
                              ) : (
                                <div className="gmb-concept">
                                  <span className="gmb-subkop">Concept, bewerk gerust</span>
                                  <div
                                    className="mail-edit md" contentEditable suppressContentEditableWarning
                                    dangerouslySetInnerHTML={{ __html: mdToHtml(concept[id]) }}
                                  />
                                  <p className="prio-meta">
                                    Kopieer dit naar de klant of naar het profiel. Het dashboard plaatst niets zelf.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* De concurrenten ernaast */}
                    {loc.concurrenten.length > 0 && (
                      <div className="gmb-bril">
                        <span className="gmb-subkop">Tegenover de concurrent</span>
                        <table className="gmb-tabel">
                          <thead>
                            <tr><th>Wie</th><th>Cijfer</th><th>Reviews</th><th>Foto&apos;s</th><th>Categorie</th></tr>
                          </thead>
                          <tbody>
                            <tr className="gmb-wij">
                              <td>{loc.profiel.naam} (deze klant)</td>
                              <td>{sterrenTekst(loc.profiel.gemiddelde)}</td>
                              <td>{getal(loc.profiel.aantalReviews)}</td>
                              <td>{getal(loc.profiel.aantalFotos)}</td>
                              <td>{loc.profiel.hoofdcategorie || "—"}</td>
                            </tr>
                            {loc.concurrenten.map((c, i) => (
                              <tr key={i} className={c.gevonden ? "" : "gmb-niet-gevonden"}>
                                <td>{c.mapsUrl ? <a className="gmb-link" href={c.mapsUrl} target="_blank" rel="noreferrer">{c.naam}</a> : c.naam}</td>
                                <td>{c.gevonden ? sterrenTekst(c.gemiddelde) : "geen profiel gevonden"}</td>
                                <td>{c.gevonden ? getal(c.aantalReviews) : "—"}</td>
                                <td>{c.gevonden ? getal(c.aantalFotos) : "—"}</td>
                                <td>{c.hoofdcategorie || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Mogelijke dubbelen */}
                    {loc.dubbelen.length > 0 && (
                      <div className="gmb-bril">
                        <span className="gmb-subkop">Mogelijk dubbele profielen</span>
                        <p className="gmb-bril-uitleg">
                          Gevonden onder vrijwel dezelfde naam. Controleer of dit echt dubbelen zijn; is het een tweede vestiging, dan hoort hij gewoon bij de bedrijfsgegevens.
                        </p>
                        {loc.dubbelen.map((d, i) => (
                          <div className="gmb-treffer" key={i}>
                            <div>
                              <strong>{d.naam}</strong>
                              <span className="gmb-treffer-meta">{d.adres}</span>
                            </div>
                            {d.mapsUrl && <a className="btn" href={d.mapsUrl} target="_blank" rel="noreferrer">Bekijken</a>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <button className="btn" onClick={() => { setZoekVoor(loc.sleutel); setZoekTekst(`${clientName} ${loc.vestiging}`); }}>
                        Ander profiel koppelen
                      </button>
                      {onGaNaar && <button className="btn" onClick={() => onGaNaar("klant")}>Naar de bedrijfsgegevens</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* De suggesties: wat er bovenop kan, ook als er niets mis is. */}
          {r.suggesties.length > 0 && (
            <div className="card">
              <button className="gmb-kop" onClick={() => setSuggestiesOpen((v) => !v)}>
                <span className="gmb-kop-pijl">{suggestiesOpen ? <Omlaag /> : <Uitklap />}</span>
                <span className="gmb-kop-naam">Wat er nog meer te halen valt</span>
                <span className="gmb-kop-tel">{r.suggesties.length} suggesties</span>
              </button>
              {suggestiesOpen && (
                <div className="gmb-body">
                  <p className="gmb-bril-uitleg">
                    Deze staan los van de metingen: het zijn de dingen die je met een profiel kúnt doen, afgestemd op wat voor bedrijf dit is.
                    Ook een profiel waar niets mis mee is heeft hier nog werk liggen.
                  </p>
                  {r.suggesties.map((s) => (
                    <div className="gmb-suggestie" key={s.key} id={`gmb-suggestie-${s.key}`}>
                      <div className="gmb-bevinding-kop">
                        <label className="gmb-vink">
                          <input type="checkbox"
                            checked={gekozen.has(`s:${s.key}`)}
                            onChange={() => vink(`s:${s.key}`)} />
                          <span>op de planning</span>
                        </label>
                        <strong>{s.titel}</strong>
                        <span className="chip">{s.ritme}</span>
                      </div>
                      <p className="gmb-actie"><span>Wat je doet:</span> {s.wat}</p>
                      <p className="gmb-waarom">{s.waarom}</p>
                    </div>
                  ))}
                  <div className="row gmb-taakbalk" style={{ flexWrap: "wrap" }}>
                    <button className="btn" disabled={taakBusy}
                      onClick={() => maakTaken("suggestie", r.locaties[0]?.sleutel || "", r.suggesties.map((x) => x.key))}>
                      Zet alle suggesties op de planning
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Hetzelfde mailvenster als bij de weekplan-kaarten en de prioriteitenscan:
          één mailvenster in het dashboard, dus ook hier geen eigen bouwsel. De
          uitnodiging is de achtergrondtekst; jij schrijft je eigen intro erboven
          en past aan wat je wilt. */}
      {mailOpen && (
        <MailVenster
          slug={slug}
          titel="Vraag de klant om beheertoegang"
          onderwerpVan={`Toegang tot het Google-bedrijfsprofiel van ${clientName}`}
          onderwerpVoorstel={beheerUitnodiging(clientName, googleAdres).onderwerp}
          taak={`De klant vragen om Pingwin als beheerder toe te voegen aan het Google-bedrijfsprofiel van ${clientName}.`}
          toelichting={beheerUitnodiging(clientName, googleAdres).tekst}
          blokMd={beheerUitnodiging(clientName, googleAdres).tekst}
          clientName={clientName}
          clientEmail={clientEmail}
          onClose={() => setMailOpen(false)}
        />
      )}

      {!r && !draait && state && state.meetdeur && (
        <div className="card">
          <p className="prio-intro">
            Er is nog niet gemeten. Druk op &quot;Meet het profiel&quot; en het dashboard zoekt de profielen op, meet ze door,
            en zet de concurrenten ernaast.
          </p>
        </div>
      )}
    </div>
  );
}

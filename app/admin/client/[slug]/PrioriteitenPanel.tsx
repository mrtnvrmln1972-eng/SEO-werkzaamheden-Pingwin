"use client";

// Het scherm van de vindbaarheid-prioriteitenscan.
//
// Vorm bewust gelijk aan het opruimscherm: een knop, een voortgangsmelding, en
// daarna de uitkomst als platte, filterbare tabel. Geen model dat de lijst
// samenvat, want een lijst is een scherm en een oordeel is een gesprek.

import { Fragment, useEffect, useMemo, useState } from "react";
import { urlKey } from "../../../../lib/url-key";
import { categorieVan } from "../../../../lib/prioriteiten-categorie";
import { kaartTekst, faseVoorstel } from "../../../../lib/weekplan-kaarttekst";
import { onderbouwing } from "../../../../lib/prioriteiten-onderbouwing";
import { mdToHtml } from "../../../../lib/markdown";
import MailVenster from "./MailVenster";

// Het bedoelde adres van een pagina die nog niet bestaat (content gap). De kaart
// heeft een URL nodig om de fases en de pagina-context te kunnen tonen; zonder
// URL opent hij half leeg. Dit is een voorstel, geen bewering: het pad staat ook
// in de kaarttekst zodat je het kunt wijzigen voor je gaat bouwen.
function bedoeldPad(zoekwoord: string, domain: string): string {
  const slugje = (zoekwoord || "")
    .toLowerCase().trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slugje) return "";
  const host = (domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return host ? `https://${host}/${slugje}/` : `/${slugje}/`;
}

type Lens = { sleutel: string; naam: string; status: string; toelichting: string; gevonden: number };
type Regel = {
  id: string; type: string; titel: string; url: string; zoekwoord: string;
  maandvolume: number; huidigePositie: number; targetPositie: number;
  effort: number; timeToEffect: number; confidence: number; relevanceFit: number;
  roiScore?: number; extraKlikkenPerMaand?: number; tier?: string; skipReden?: string;
  rationale: string; vervolgSkill: string; bron: string; nieuw?: boolean;
};
type Result = {
  samenvatting: string; propositie: string; verwachteKlikkenPerMaand: number;
  lenzen: Lens[]; regels: Regel[];
  delta: { nieuw: number; opgelost: number; vorigeDatum: string | null } | null;
  generatedAt: string;
};
type State = {
  status: string; result: Result | null; error: string; updatedAt: string | null;
  stap: number; stappen: number; stapLabel: string; cronStil: boolean;
  laatsteAutoRonde: string | null;
  inPlanning: string[];
  propositie: { zin: string; voorstel: string };
};

// Waarop de lijst gesorteerd staat. Bewust géén "wanneer" meer: de scan deelde
// zelf in deze week / deze maand / dit kwartaal, en dat is een gok over een agenda
// die hij niet kent. Wat een kans oplevert is wél te meten, dus dat bepaalt de
// volgorde. De indeling bestaat achter de schermen nog wel, want de scan gebruikt
// hem om te bepalen wat er in "bewust niet doen" valt.
//
// De standaardvolgorde is "kansrijkheid" en niet "extra bezoekers" (6 augustus
// 2026). Extra bezoekers is zoekvolume maal klikkans, en verder niets: dat cijfer
// weet niet of iemand wil kopen of alleen rondkijkt, en niet of het zoekwoord bij
// deze klant past. Bij Paul Hoevenaars zette het daardoor "voortuin" bovenaan,
// een landelijk plaatjeswoord van 3.500 zoekopdrachten, boven "tuinontwerp laten
// maken". Kansrijkheid weegt dat wél mee, en het stond al berekend klaar; het
// werd alleen niet gebruikt voor de volgorde. Extra bezoekers blijft als kolom
// staan én blijft aanklikbaar om op te sorteren.
type SortVeld = "kans" | "extra" | "volume" | "positie";
const SORT_KOP: { veld: SortVeld; label: string; uitleg: string }[] = [
  { veld: "volume", label: "Zoekvolume", uitleg: "hoe vaak hier per maand op gezocht wordt" },
  { veld: "positie", label: "Positie", uitleg: "waar de pagina nu staat en waar hij heen kan" },
  { veld: "extra", label: "Extra bezoekers", uitleg: "zoekvolume maal de kans dat iemand klikt" },
  { veld: "kans", label: "Kansrijk", uitleg: "bezoekers, koopgerichtheid, hoe goed het bij deze klant past en hoeveel werk het is, in één cijfer" },
];

/**
 * De brillen die hun punten uit een andere analyse halen, met de knop om die
 * analyse hier meteen te starten. Zonder dit moet je zelf bedenken welk tabje je
 * nodig hebt, ernaartoe klikken, daar de analyse starten en weer terugkomen; en
 * de melding dát er iets ontbreekt zat tot nu toe weggeklapt, dus in de praktijk
 * zag je alleen een korte lijst en geen reden.
 */
const ONTBREKENDE_BRON: Record<string, { knop: string; url: string; achtergrond: boolean }> = {
  cannibalisatie: { knop: "Opruimanalyse draaien", url: "/api/admin/cannibal-redirect", achtergrond: true },
  interne_links: { knop: "Interne-link-analyse draaien", url: "/api/admin/internal-links", achtergrond: true },
  content_gap: { knop: "Kansenlijst ophalen", url: "/api/admin/keyword-opportunities", achtergrond: false },
};

function datum(s?: string | null): string {
  if (!s) return "";
  return new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
function getal(n?: number): string {
  return n != null && Number.isFinite(n) ? new Intl.NumberFormat("nl-NL").format(Math.round(n)) : "—";
}
function zekerheid(c: number): string {
  return c >= 0.9 ? "hard gemeten" : c >= 0.6 ? "afgeleid" : "schatting";
}

export default function PrioriteitenPanel({ slug, domain = "", onGaNaar, clientName, clientEmail }: {
  slug: string;
  domain?: string;
  /** Springt naar het juiste tabblad en opent daar meteen de betreffende regel. */
  onGaNaar?: (tab: string, url: string) => void;
  clientName?: string;
  clientEmail?: string;
}) {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [prop, setProp] = useState("");
  const [propMsg, setPropMsg] = useState("");
  const [bezigId, setBezigId] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [openSkip, setOpenSkip] = useState(false);
  const [openLenzen, setOpenLenzen] = useState(false);
  const [openGroep, setOpenGroep] = useState<Record<string, boolean>>({});
  const [sortVeld, setSortVeld] = useState<SortVeld>("kans");
  const [sortAf, setSortAf] = useState(true);
  // Welke regel staat opengeklapt op "waarom", en voor welke regel staat het
  // mailvenster open. Bewust per regel en niet globaal: je vergelijkt kansen met
  // elkaar, dus je wilt er meerdere tegelijk open kunnen hebben.
  const [openWaarom, setOpenWaarom] = useState<Record<string, boolean>>({});
  const [mailVoor, setMailVoor] = useState<Regel | null>(null);
  const [bronBezig, setBronBezig] = useState<string | null>(null);
  const [bronMsg, setBronMsg] = useState<Record<string, string>>({});
  // De opruimanalyse weigert te starten zolang niet vastligt welke pagina's
  // advertentiepagina's zijn (die staan op noindex en zien er in de data uit als
  // dood gewicht, terwijl ze juist moeten blijven). Dat invulveld stond alleen op
  // het Opruimen-tabje, dus je werd hier weggestuurd. Nu kan het hier meteen.
  const [adsTekst, setAdsTekst] = useState("");
  const [adsBezig, setAdsBezig] = useState(false);
  const [adsMsg, setAdsMsg] = useState("");
  const adsNodig = /advertentie|landingspagina/i.test(bronMsg.cannibalisatie || "");

  async function load() {
    try {
      const d = await fetch(`/api/admin/prioriteiten-scan?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (!d.ok) return;
      setSt(d as State);
      setProp((p) => (p ? p : d.propositie?.zin || ""));
    } catch { /* stil */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Terwijl hij draait elke tien seconden bijwerken, zodat je de stap ziet
  // opschieten in plaats van naar een bevroren scherm te kijken.
  useEffect(() => {
    if (st?.status !== "running") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [st?.status, slug]);

  async function start(hervat = false) {
    setBusy(true); setErr("");
    try {
      const d = await fetch("/api/admin/prioriteiten-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...(hervat ? { hervat: true } : {}) }),
      }).then((r) => r.json());
      if (!d.ok) setErr(d.error || "Het starten lukte niet.");
      else await load();
    } catch { setErr("Het starten lukte niet."); } finally { setBusy(false); }
  }

  async function bewaarPropositie() {
    setPropMsg("");
    try {
      const d = await fetch("/api/admin/prioriteiten-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, propositie: prop }),
      }).then((r) => r.json());
      setPropMsg(d.ok ? "Bewaard. Vanaf de volgende scan telt deze zin mee." : (d.error || "Bewaren lukte niet."));
    } catch { setPropMsg("Bewaren lukte niet."); }
  }

  /** Start de ontbrekende analyse hier, zonder eerst naar het andere tabje te gaan. */
  async function draaiBron(sleutel: string) {
    const b = ONTBREKENDE_BRON[sleutel];
    if (!b || bronBezig) return;
    setBronBezig(sleutel);
    setBronMsg((m) => ({ ...m, [sleutel]: "" }));
    try {
      const d = await fetch(b.url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      }).then((r) => r.json());
      setBronMsg((m) => ({
        ...m,
        [sleutel]: d?.ok
          ? (b.achtergrond
            ? "Draait nu, dat duurt een paar minuten. Klik daarna bovenaan op “Opnieuw scannen”."
            : `Klaar, ${d.total ?? 0} kansen opgehaald. Klik nu bovenaan op “Opnieuw scannen”.`)
          : (d?.error || "Starten lukte niet."),
      }));
    } catch {
      setBronMsg((m) => ({ ...m, [sleutel]: "Starten lukte niet." }));
    } finally { setBronBezig(null); }
  }

  /**
   * Advertentiepagina's vastleggen en de opruimanalyse meteen daarna starten, zodat
   * het bij één handeling blijft in plaats van opslaan, terugklikken en opnieuw
   * beginnen. `geen` legt vast dat deze klant er geen heeft; dat is net zo goed een
   * antwoord en de analyse heeft er genoeg aan.
   */
  async function bewaarAds(geen: boolean) {
    if (adsBezig) return;
    const paden = adsTekst.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
    if (!paden.length && !geen) { setAdsMsg("Vul de pagina's in, of kies “deze klant heeft er geen”."); return; }
    setAdsBezig(true); setAdsMsg("");
    try {
      const d = await fetch("/api/admin/opruim-structuur-regel", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ads: paden, geenAds: geen && !paden.length }),
      }).then((r) => r.json());
      if (!d.ok) { setAdsMsg(d.error || "Opslaan lukte niet."); return; }
      setAdsMsg(paden.length
        ? `Vastgelegd, ${paden.length === 1 ? "die pagina blijft" : "die pagina's blijven"} buiten de analyse. Ik start de opruimanalyse nu.`
        : "Vastgelegd: geen advertentiepagina's. Ik start de opruimanalyse nu.");
      await draaiBron("cannibalisatie");
    } catch { setAdsMsg("Opslaan lukte niet."); } finally { setAdsBezig(false); }
  }

  // Elk pad wordt een klikbare link naar de live pagina (vaste huisregel: nooit
  // een kale, niet-klikbare slug in beeld). Zelfde patroon als het opruimscherm.
  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Pad = ({ pad }: { pad: string }) =>
    domain ? <a className="opr-pad" href={site(pad)} target="_blank" rel="noreferrer">{pad}</a> : <>{pad}</>;

  // Staat er al een kaart voor deze pagina in de planning? Afgelezen uit de
  // planning zelf, niet apart bijgehouden, zodat afvinken hier vanzelf doorwerkt.
  const planSet = new Set(st?.inPlanning || []);
  const staatInPlanning = (r: Regel) => !!r.url && planSet.has(urlKey(r.url));

  /**
   * "Hier ga ik mee aan de slag": maak er waar dat past een kaart van in de
   * planning van deze week, en spring daarna naar de plek waar het werk gebeurt.
   *
   * De kaart gaat door de bestaande poort (/api/admin/weekplan/add). Die splitst
   * per pagina en voegt samen op URL, dus twee keer klikken op dezelfde pagina
   * geeft geen tweede kaart maar een regel op de bestaande.
   *
   * De reden uit deze lijst gaat mee als toelichting. Dat is precies het veld dat
   * op de kaart als "Waarom deze pagina" verschijnt en dat de mailknop gebruikt,
   * dus je kunt de klant meteen uitleggen waarom we dit oppakken.
   */
  async function pakOp(r: Regel) {
    const cat = categorieVan(r.type);
    if (bezigId) return;
    setBezigId(r.id);
    try {
      if (cat.kaart) {
        // Een content gap heeft nog geen pagina, dus ook geen URL. Zonder URL
        // blijft het fase-blok op de kaart leeg (de kaart zoekt de pagina op).
        // Daarom leiden we het bedoelde pad af uit het zoekwoord; dat is precies
        // wat de assistent ook doet als hij een nieuwe pagina inplant.
        const nieuw = !r.url;
        const pad = r.url || bedoeldPad(r.zoekwoord, domain);
        // Dezelfde onderbouwing als op het scherm en in de mail. Stond hier eerder
        // als eigen lijstje losse zinnen; dat is precies hoe drie versies van
        // hetzelfde verhaal ontstaan.
        const ond = onderbouwing(r, { klantnaam: clientName, pad });
        const toelichting = kaartTekst({
          achtergrond: [
            ond.kort,
            r.rationale || "",
            `Zoekwoord "${r.zoekwoord}", ${getal(r.maandvolume)} zoekopdrachten per maand.`,
            r.huidigePositie
              ? `Staat nu op positie ${r.huidigePositie}, doel is ${r.targetPositie}.`
              : `Rankt hier nog niet; doel is positie ${r.targetPositie}.`,
            `Naar schatting ${getal(r.extraKlikkenPerMaand)} extra bezoekers per maand (${zekerheid(r.confidence)}).`,
            nieuw ? `Deze pagina bestaat nog niet; ${pad} is het voorgestelde adres.` : "",
          ].filter(Boolean),
          afspraken: ["Bron: uit de vindbaarheidsscan van deze site."],
          fases: faseVoorstel({ nieuw, zoekwoord: r.zoekwoord, positie: r.huidigePositie || null, doel: r.targetPositie || null, pad }),
        });
        await fetch("/api/admin/weekplan/add", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            taak: `${cat.naam}${pad ? `: ${pad}` : `: ${r.zoekwoord}`}`,
            url: pad, week: 1, toelichting, wie: "SEO",
            taaktype: cat.taaktype, thread: "prioriteiten",
          }),
        }).then((x) => x.json()).catch(() => null);
        await load();   // het vinkje meteen bijwerken
        // Bewust NIET meteen wegspringen naar het andere tabblad. Dat deed deze
        // knop eerst, en daarmee was de regel uit beeld op het moment dat je de
        // klant wilde laten weten dat je hem oppakt. Nu blijf je staan, opent het
        // mailvenster met de onderbouwing erin, en gaat "Ga erheen" apart mee als
        // knop op de regel.
        setMailVoor(r);
        return;
      }
      onGaNaar?.(cat.tab, r.url || "");
    } finally { setBezigId(null); }
  }

  const res = st?.result || null;
  const regels = useMemo(() => res?.regels || [], [res]);
  const zoekt = zoek.trim().length > 0;
  const zichtbaar = useMemo(() => regels.filter((r) => {
    if (r.tier === "SKIP") return false;
    if (zoekt) {
      const q = zoek.trim().toLowerCase();
      if (!(`${r.titel} ${r.zoekwoord} ${r.url}`.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [regels, zoek, zoekt]);

  /**
   * Kansrijkheid als cijfer van 1 tot 100, waarbij 100 de beste kans van déze scan
   * is. De onderliggende opbrengstscore is een kommagetal van 0,003 tot 0,4; daar
   * kun je twee regels niet mee vergelijken zonder te turen. De schaal is bewust
   * relatief: "de beste kans die deze klant nu heeft" zegt meer dan een absoluut
   * getal dat per klant iets anders betekent.
   */
  const kansIndex = useMemo(() => {
    const max = Math.max(0, ...regels.filter((r) => r.tier !== "SKIP").map((r) => r.roiScore ?? 0));
    return (r: Regel) => (max > 0 ? Math.max(1, Math.round(((r.roiScore ?? 0) / max) * 100)) : 0);
  }, [regels]);

  // Zeven dichte balken in plaats van honderd losse regels, en de balk met de
  // meest kansrijke stapel werk bovenaan. Bij de ene klant is dat meta-werk, bij de
  // andere opruimen; dat wil je zien zonder eerst alles open te klikken.
  const groepen = useMemo(() => {
    const richting = sortAf ? -1 : 1;
    const waarde = (r: Regel): number => {
      if (sortVeld === "volume") return r.maandvolume || 0;
      // Rankt hier nog niet (0) hoort achteraan, niet vooraan.
      if (sortVeld === "positie") return r.huidigePositie || 999;
      if (sortVeld === "extra") return r.extraKlikkenPerMaand ?? 0;
      return r.roiScore ?? 0;
    };
    const per = new Map<string, Regel[]>();
    for (const r of zichtbaar) {
      const naam = categorieVan(r.type).naam;
      if (!per.has(naam)) per.set(naam, []);
      per.get(naam)!.push(r);
    }
    return [...per.entries()]
      .map(([naam, rijen]) => ({
        naam,
        rijen: [...rijen].sort((a, b) => (waarde(a) - waarde(b)) * richting),
        opbrengst: rijen.reduce((s, r) => s + (r.extraKlikkenPerMaand ?? 0), 0),
        // De balken staan op dezelfde maat als de regels erin: op kansrijkheid.
        // Anders opent de bovenste balk met de minst kansrijke bovenste regel.
        kans: rijen.reduce((s, r) => s + (r.roiScore ?? 0), 0),
      }))
      .sort((a, b) => b.kans - a.kans || b.rijen.length - a.rijen.length || a.naam.localeCompare(b.naam));
  }, [zichtbaar, sortVeld, sortAf]);

  // Zoek je iets, dan klapt alles met een treffer vanzelf open; anders zou je na
  // het typen alsnog zeven balken moeten opentikken om te zien wat er gevonden is.
  const groepOpen = (naam: string) => zoekt || !!openGroep[naam];
  function sorteerOp(veld: SortVeld) {
    if (veld === sortVeld) setSortAf((v) => !v);
    else { setSortVeld(veld); setSortAf(true); }
  }

  const ontbrekend = (res?.lenzen || []).filter((l) => l.status === "niet-gedraaid" && ONTBREKENDE_BRON[l.sleutel]);
  const skips = regels.filter((r) => r.tier === "SKIP");
  const propositieLeeg = !(st?.propositie?.zin || "").trim();

  /**
   * De samenvatting wordt hier gemaakt en niet bij het draaien van de scan, zodat
   * een scan van vorige maand meteen de nieuwe tekst laat zien. Vaste huisregel:
   * zulke wijzigingen horen in de weergave-laag, niet in de opgeslagen data.
   */
  const samenvatting = useMemo(() => {
    const punten = regels.filter((r) => r.tier !== "SKIP");
    if (!punten.length) return "Geen openstaande kansen gevonden bij deze scan.";
    const uplift = Math.round(punten.reduce((s, r) => s + (r.extraKlikkenPerMaand ?? 0) * r.confidence, 0));
    // Bewust geteld over álle punten, niet over wat het zoekveld overlaat: de
    // samenvatting hoort de scan samen te vatten, niet je zoekopdracht.
    const soorten = new Set(punten.map((r) => categorieVan(r.type).naam)).size;
    const stukken = [`${punten.length} ${punten.length === 1 ? "kans" : "kansen"} gevonden, verdeeld over ${soorten} ${soorten === 1 ? "soort werk" : "soorten werk"}.`];
    if (uplift > 0) stukken.push(`Alles bij elkaar naar schatting ${getal(uplift)} extra bezoekers per maand, gewogen naar hoe zeker we het weten. Dat is een verwachting, geen belofte.`);
    if (skips.length) stukken.push(`${skips.length} ${skips.length === 1 ? "kans is" : "kansen zijn"} bewust afgevallen, met de reden erbij.`);
    if (res?.delta?.vorigeDatum) {
      stukken.push(res.delta.nieuw || res.delta.opgelost
        ? `Sinds de vorige scan: ${res.delta.nieuw} nieuw, ${res.delta.opgelost} opgelost.`
        : "Sinds de vorige scan is er niets veranderd.");
    }
    return stukken.join(" ");
  }, [regels, skips.length, res]);

  return (
    <div className="cockpit-card acc-orange prio-panel">
      <div className="opr-kop-rij">
        <div>
          <div className="ck-section-head">Waar zit de snelste winst</div>
          <p className="muted prio-intro">
            Kijkt over de hele site heen en zet elke kans op volgorde: wat het oplevert,
            hoeveel werk het is, hoe lang het duurt en hoe zeker we het weten. Draait in
            de achtergrond en vanzelf eens per maand.
          </p>
        </div>
        <div className="prio-knoppen">
          <button type="button" className="btn" disabled={busy || st?.status === "running"} onClick={() => start(false)}>
            {st?.status === "running" ? "Bezig…" : res ? "Opnieuw scannen" : "Scan draaien"}
          </button>
          {st?.status === "running" && st.cronStil && (
            <button type="button" className="ghost-btn small" disabled={busy} onClick={() => start(true)}>Nu hervatten</button>
          )}
        </div>
      </div>

      {err && <div className="login-error">{err}</div>}
      {st?.status === "error" && st.error && <div className="login-error">De vorige scan liep vast: {st.error}</div>}

      {/* De propositie-zin. Zonder die zin drijft de scan af naar veel volume dat
          niet bij de klant past; daarom staat hij bovenaan en niet weggestopt. */}
      <div className="prio-propositie">
        <label className="prio-label" htmlFor={`prop-${slug}`}>Wat deze klant wél en niet is</label>
        <p className="muted prio-hint">
          Eén zin, en het tweede deel doet het werk: “luxe kozijnenmaker met dunne profielen,
          geen prijsvechter”. Zonder die zin kiest de scan op volume, en dan komt “goedkope
          kozijnen” bovenaan bij een klant die dat juist niet wil zijn.
        </p>
        <div className="prio-prop-rij">
          <input
            id={`prop-${slug}`}
            className="prio-prop-veld"
            value={prop}
            placeholder={st?.propositie?.voorstel || "Bijvoorbeeld: specialistische kliniek voor sporters, geen algemene fysio"}
            onChange={(e) => setProp(e.target.value)}
          />
          <button type="button" className="ghost-btn small" onClick={bewaarPropositie}>Bewaren</button>
        </div>
        {propMsg && <div className="prio-prop-msg">{propMsg}</div>}
        {propositieLeeg && !propMsg && (
          <div className="prio-waarschuwing">
            Nog niet ingevuld. De scan draait wel, maar kan dan niet zien welke kansen niet bij deze klant passen.
          </div>
        )}
      </div>

      {st?.status === "running" && (
        <div className="opr-voortgang">
          <div className="opr-voortgang-label">
            <span className="opr-voortgang-stap">Stap {st.stap} van {st.stappen}</span>
            <span>{st.stapLabel}</span>
          </div>
          {st.cronStil && <div className="opr-voortgang-tijd">Het vangnet is even stil. Blijft dit hangen, klik dan op “Nu hervatten”.</div>}
        </div>
      )}

      {!res && st?.status !== "running" && (
        <p className="muted">Nog geen scan gedraaid voor deze klant. Klik op “Scan draaien”; hij doet er een paar minuten over en je kunt ondertussen weg.</p>
      )}

      {res && (
        <>
          <div className="prio-samenvatting">{samenvatting}</div>
          <div className="prio-meta">
            Lijst van {datum(res.generatedAt)}
            {res.delta?.vorigeDatum && <> · vorige scan {datum(res.delta.vorigeDatum)}</>}
            {st?.laatsteAutoRonde && <> · draait vanzelf eens per maand</>}
          </div>

          {/* Wat er níet is gekeken hoort niet weggeklapt te staan: dat is precies
              de reden dat de lijst kort is. Dus in het zicht, met de startknop erbij. */}
          {ontbrekend.length > 0 && (
            <div className="prio-ontbreekt">
              <div className="prio-ontbreekt-kop">
                {ontbrekend.length === 1
                  ? "Eén onderdeel heeft niet meegekeken"
                  : `${ontbrekend.length} onderdelen hebben niet meegekeken`}
              </div>
              <p className="muted prio-hint">
                Deze halen hun punten uit een analyse die voor deze klant nog niet gedraaid is.
                Er is dus niets gevonden omdat er niet gekeken is, niet omdat er niets te halen valt.
                Start ze hier en scan daarna opnieuw.
              </p>
              {ontbrekend.map((l) => (
                <div key={l.sleutel} className="prio-ontbreekt-rij">
                  <span className="prio-ontbreekt-naam">{l.naam}</span>
                  <button type="button" className="ghost-btn small"
                    disabled={bronBezig === l.sleutel}
                    onClick={() => draaiBron(l.sleutel)}>
                    {bronBezig === l.sleutel ? "Starten…" : ONTBREKENDE_BRON[l.sleutel].knop}
                  </button>
                  {bronMsg[l.sleutel] && <span className="prio-ontbreekt-msg">{bronMsg[l.sleutel]}</span>}
                  {l.sleutel === "cannibalisatie" && adsNodig && (
                    <div className="prio-ads">
                      <p className="muted prio-hint">
                        Pagina&rsquo;s waar je advertenties naartoe sturen staan meestal op noindex. Ze halen dus niets
                        uit Google en zien er in de data uit als dode pagina&rsquo;s, terwijl ze juist moeten blijven.
                        Zet ze hier neer, dan blijven ze buiten de analyse. E&eacute;n pad per regel; een map zoals{" "}
                        <code>/ads/</code> dekt alles daaronder.
                      </p>
                      <textarea className="prio-ads-veld" rows={3} spellCheck={false} value={adsTekst}
                        placeholder={"/landing-page/\n/ads/\n/actie-voorjaar/"} aria-label="Advertentiepagina's"
                        onChange={(e) => setAdsTekst(e.target.value)} />
                      <div className="prio-ads-rij">
                        <button type="button" className="ghost-btn small" disabled={adsBezig}
                          onClick={() => void bewaarAds(false)}>
                          {adsBezig ? "Bezig…" : "Opslaan en analyse starten"}
                        </button>
                        <button type="button" className="ghost-btn small" disabled={adsBezig || !!adsTekst.trim()}
                          onClick={() => void bewaarAds(true)}>
                          Deze klant heeft er geen
                        </button>
                      </div>
                      {adsMsg && <div className="prio-ontbreekt-msg">{adsMsg}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Scorecard: welke brillen keken mee, en welke nog niet. */}
          <button type="button" className="prio-klap" onClick={() => setOpenLenzen((v) => !v)}>
            {/* Bewust "keken mee" en niet "aangesloten": een bril waarvan de
                analyse nooit gedraaid is, is wél aangesloten maar heeft niet
                gekeken. Dat als aangesloten tellen leest als "gecontroleerd". */}
            {openLenzen ? "▾" : "▸"} Waar is naar gekeken ({res.lenzen.filter((l) => l.status !== "niet-aangesloten" && l.status !== "niet-gedraaid").length} van de {res.lenzen.length} brillen keken mee)
          </button>
          {openLenzen && (
            <div className="prio-lenzen">
              {res.lenzen.map((l) => (
                <div key={l.sleutel} className={`prio-lens prio-lens-${l.status}`}>
                  <span className="prio-lens-naam">{l.naam}</span>
                  <span className="prio-lens-tekst">{l.toelichting}</span>
                </div>
              ))}
            </div>
          )}

          <div className="prio-filters">
            <input className="prio-zoek" placeholder="Zoek op zoekwoord of pagina" value={zoek} onChange={(e) => setZoek(e.target.value)} />
            {zoekt && <span className="prio-filter-label">{zichtbaar.length} van de {regels.filter((r) => r.tier !== "SKIP").length}</span>}
          </div>

          {/* Wat de kolommen betekenen. Stond nergens, en dan moet je het vragen:
              "→ 5" en het balkje bij Kansrijk leggen zichzelf niet uit. */}
          <details className="prio-legenda">
            <summary>Wat betekenen de kolommen?</summary>
            <ul>
              <li><strong>Zoekvolume</strong> is hoe vaak er per maand op dit zoekwoord gezocht wordt.</li>
              <li><strong>Positie</strong> laat zien waar de pagina nu staat en waar hij heen kan: <em>12 → 3</em> betekent van plek 12 naar plek 3. Staat er alleen <em>→ 5</em>, dan is er nog geen pagina die hierop mikt en is plek 5 het doel waar we op mikken. Dat is een streefgetal, geen voorspelling.</li>
              <li><strong>Extra bezoekers</strong> is wat die stap aan bezoek kan opleveren: het zoekvolume maal de kans dat iemand op die plek klikt.</li>
              <li><strong>Kansrijk</strong> is het balkje met een cijfer van 1 tot 100 en bepaalt de volgorde. Het weegt de bezoekers, hoe koopgericht het zoekwoord is, hoe goed het bij deze klant past en hoeveel werk het kost. 100 is de beste kans van deze scan; het is dus een onderlinge vergelijking, geen rapportcijfer.</li>
              <li><strong>Werk</strong> is de omvang: klein (een titel of alinea), middel (een pagina verversen of nieuw schrijven), groot (meerdere pagina&rsquo;s).</li>
            </ul>
          </details>

          <div className="prio-tabel-wrap">
            <table className="prio-tabel">
              <thead>
                <tr>
                  <th>Wat</th><th>Pagina</th><th>Zoekwoord</th>
                  {SORT_KOP.map((k) => (
                    <th key={k.veld} className="num">
                      <button type="button" className={"prio-sorteer" + (sortVeld === k.veld ? " aan" : "")}
                        title={`Sorteer op ${k.label.toLowerCase()}: ${k.uitleg}`} onClick={() => sorteerOp(k.veld)}>
                        {k.label}{sortVeld === k.veld ? (sortAf ? " ▾" : " ▴") : ""}
                      </button>
                    </th>
                  ))}
                  <th>Werk</th><th>Aan de slag</th>
                </tr>
              </thead>
              <tbody>
                {groepen.map((g) => {
                  const uit = groepOpen(g.naam);
                  return (
                    <Fragment key={g.naam}>
                      <tr className="prio-groepkop">
                        <td colSpan={9}>
                          <button type="button" className="prio-groepknop" aria-expanded={uit}
                            onClick={() => setOpenGroep((m) => ({ ...m, [g.naam]: !groepOpen(g.naam) }))}>
                            <span className="prio-groepkop-pijl">{uit ? "▾" : "▸"}</span>
                            <span className="prio-groepkop-naam">{g.naam}</span>
                            <span className="prio-groepkop-tel">{g.rijen.length} {g.rijen.length === 1 ? "punt" : "punten"}</span>
                            {g.opbrengst > 0 && (
                              <span className="prio-groepkop-winst">samen ongeveer {getal(g.opbrengst)} extra bezoekers per maand</span>
                            )}
                          </button>
                        </td>
                      </tr>
                      {uit && g.rijen.map((r) => {
                        const cat = categorieVan(r.type);
                        const gepland = staatInPlanning(r);
                        return (
                          <Fragment key={r.id}>
                          <tr className={"prio-rij" + (gepland ? " prio-gepland" : "")}>
                            <td>
                              <div className="prio-titel">{r.titel}{r.nieuw && <span className="prio-nieuw">nieuw</span>}</div>
                              <div className="prio-reden">{onderbouwing(r, { klantnaam: clientName }).kort}</div>
                              <button type="button" className="prio-waarom-knop"
                                aria-expanded={!!openWaarom[r.id]}
                                onClick={() => setOpenWaarom((m) => ({ ...m, [r.id]: !m[r.id] }))}>
                                {openWaarom[r.id] ? "▾ minder" : "▸ waarom dit de moeite waard is"}
                              </button>
                              <div className="prio-bron">Bron: {r.bron} · {zekerheid(r.confidence)}</div>
                            </td>
                            <td className="prio-url">{r.url ? <Pad pad={r.url} /> : <span className="muted">nieuwe pagina</span>}</td>
                            <td>{r.zoekwoord || "—"}</td>
                            <td className="num">{getal(r.maandvolume)}</td>
                            <td className="num">{r.huidigePositie ? `${r.huidigePositie} → ${r.targetPositie}` : `→ ${r.targetPositie}`}</td>
                            <td className="num prio-uplift">{getal(r.extraKlikkenPerMaand)}</td>
                            <td className="num prio-kans" title={`Kansrijkheid ${kansIndex(r)} van de 100. Weegt de te winnen bezoekers, hoe koopgericht dit zoekwoord is, hoe goed het bij deze klant past en hoeveel werk het kost. 100 is de beste kans van deze scan.`}>
                              <span className="prio-kans-balk" aria-hidden="true"><i style={{ width: `${kansIndex(r)}%` }} /></span>
                              <span className="prio-kans-getal">{kansIndex(r)}</span>
                            </td>
                            <td>{r.effort <= 3 ? "klein" : r.effort <= 6 ? "middel" : "groot"}</td>
                            <td className="prio-skill">
                              <button
                                type="button"
                                className="prio-cat"
                                disabled={bezigId === r.id}
                                title={cat.kaart
                                  ? "Maakt een kaart in de weekplanning van deze week (nog zonder dag), met deze onderbouwing erin, en opent daarna de mail aan de klant"
                                  : `Ga naar ${cat.naam.toLowerCase()} voor deze pagina`}
                                onClick={() => pakOp(r)}
                              >
                                {bezigId === r.id ? "Bezig…" : cat.kaart ? "In de planning" : "Ga erheen"}
                              </button>
                              {/* Mailen kan bij élke kans, ook bij meta-werk en opruimen waar geen
                                  kaart bij hoort. De klant hoort te zien dát we kansen zoeken. */}
                              <button type="button" className="prio-mail"
                                title="Laat de klant weten dat we deze kans zagen en oppakken, met de reden erbij"
                                onClick={() => setMailVoor(r)}>Mail de klant</button>
                              {gepland && (
                                <>
                                  <span className="prio-gepland-chip" title="Er staat een kaart voor deze pagina in de planning">✓ in de planning</span>
                                  <button type="button" className="prio-heen" onClick={() => onGaNaar?.(cat.tab, r.url || "")}>
                                    Ga erheen
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                          {/* De onderbouwing over de volle breedte, als kaartjes naast
                              elkaar. Stond eerst ín de eerste kolom, en die is smal:
                              dan groeit er links een hoge sliert uit de tabel terwijl
                              rechts alles leeg blijft. */}
                          {openWaarom[r.id] && (
                            <tr className="prio-waarom-rij">
                              <td colSpan={9}>
                                <div className="prio-waarom-grid">
                                  {onderbouwing(r, { klantnaam: clientName, pad: r.url || bedoeldPad(r.zoekwoord, domain) })
                                    .secties.map((s) => (
                                      <section className="prio-waarom-kaart" key={s.kop}>
                                        <h4>{s.kop}</h4>
                                        <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(s.tekst, domain) }} />
                                      </section>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {!groepen.length && (
                  <tr><td colSpan={9} className="muted prio-leeg">Niets gevonden met deze zoekterm.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {skips.length > 0 && (
            <>
              <button type="button" className="prio-klap" onClick={() => setOpenSkip((v) => !v)}>
                {openSkip ? "▾" : "▸"} Bewust niet doen ({skips.length})
              </button>
              {openSkip && (
                <div className="prio-skip">
                  <p className="muted prio-hint">Dit is de lijst die je aan de klant kunt laten zien: bekeken, gewogen, en met reden afgevallen.</p>
                  <table className="prio-tabel">
                    <thead><tr><th>Zoekwoord</th><th>Pagina</th><th className="num">Zoekvolume</th><th>Waarom niet</th></tr></thead>
                    <tbody>
                      {skips.map((r) => (
                        <tr key={r.id}>
                          <td>{r.zoekwoord || "—"}</td>
                          <td className="prio-url">{r.url ? <Pad pad={r.url} /> : <span className="muted">—</span>}</td>
                          <td className="num">{getal(r.maandvolume)}</td>
                          <td>{r.skipReden}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Hetzelfde mailvenster als bij een weekplan-kaart, maar BEWUST zonder blok.
          Mét blok gaat de mail langs de opgemaakte weg: oranje kopbalk, vier vaste
          kaders, en een voetregel die zegt dat het dashboard hem heeft opgesteld.
          Dat leest als een reclamemail, terwijl dit juist de mail is die moet laten
          zien dat er iemand naar hun site heeft zitten kijken. Zonder blok is het
          een gewone, persoonlijke mail: aanhef, korte alinea's, handtekening
          onderaan. De onderbouwing gaat mee als achtergrond voor de assistent, niet
          als kant-en-klaar blok in de mail zelf. */}
      {mailVoor && (() => {
        const ond = onderbouwing(mailVoor, { klantnaam: clientName, pad: mailVoor.url || bedoeldPad(mailVoor.zoekwoord, domain) });
        return (
          <MailVenster
            slug={slug}
            titel="Laat de klant weten dat we deze kans oppakken"
            onderwerpVan={ond.mailOnderwerp}
            onderwerpVoorstel={ond.mailOnderwerp}
            taak={ond.mailTaak}
            toelichting={ond.blokMd}
            stijl="kans"
            schrijfMeteen
            siteUrl={domain}
            url={mailVoor.url || ""}
            clientName={clientName}
            clientEmail={clientEmail}
            onClose={() => setMailVoor(null)}
          />
        );
      })()}
    </div>
  );
}

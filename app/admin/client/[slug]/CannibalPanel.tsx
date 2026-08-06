"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { linkifyHtml } from "../../../../lib/linkify";
import OpruimTabel from "./OpruimTabel";
import OpruimStructuur from "./OpruimStructuur";
import OpruimOppakken, { type Oppakker } from "./OpruimOppakken";
import OpruimSamenvatting from "./OpruimSamenvatting";
import OpruimOnderwerpen, { type Onderwerp } from "./OpruimOnderwerpen";
import OpruimGaten, { type Gat } from "./OpruimGaten";
import OpruimEindstructuur from "./OpruimEindstructuur";
import OpruimNameten, { type Nameting } from "./OpruimNameten";
import Voortgang from "./Voortgang";
import { useKlus } from "./useKlus";

type ClusterUrl = { url: string; rol?: string; positie?: number; klikken?: number; impressies?: number; verwijzendeDomeinen?: number; intentie?: string };
type Signalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
type Cluster = { keyword: string; volume?: number; score?: string; signalen?: Signalen; intentie?: string; urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string };
type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
type Result = { oppakken?: Oppakker[]; onderwerpen?: Onderwerp[]; gaten?: Gat[]; samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: Cluster[]; redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null };
type State = { status: string; result: Result | null; error: string; updatedAt: string | null; stap?: number; stappen?: number; stapLabel?: string; cronTik?: string | null; cronStil?: boolean; kandidaten?: number; beoordeeld?: number };

function actionClass(a: string): string {
  const s = (a || "").toLowerCase();
  if (s.includes("301") || s.includes("merge")) return "redir";
  if (s.includes("noindex") || s.includes("de-opt") || s.includes("differenti") || s.includes("canonical")) return "deopt";
  return "keep";
}
function scoreClass(s?: string): string {
  const v = (s || "").toLowerCase();
  if (v.includes("hoog")) return "hoog";
  if (v.includes("midden")) return "midden";
  return "laag";
}
function num(n?: number): string { return n != null && Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "—"; }

const padVanUrl = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

// Wat gebeurt er met deze pagina? Een cluster gaat over ÉÉN zoekwoord, dus een
// pagina kan hier "verliezer" zijn en tegelijk de winnaar van zijn eigen zoekwoord.
// /soa-klinieken/soa-test-rotterdam/ verliest van /spoed-soa-test/ maar blijft
// gewoon staan. Dat stond nergens, waardoor het leek alsof hij op de nominatie
// stond. De werklijst bepaalt wat er gebeurt; staat een pagina daar niet in, dan
// gebeurt er niets. Hier lezen we dat af in plaats van het opnieuw te bedenken.
// Een alinea van acht zinnen leest niet. Staat er nog geen opsomming in, dan maken
// we er zinnen-per-regel van, zodat het scanbaar wordt in plaats van een muur.
function alsBullets(tekst: string): string {
  const t = (tekst || "").trim();
  if (!t || /^\s*[-*]\s/m.test(t)) return t;              // heeft al bullets
  const zinnen = t.split(/(?<=[.!?])\s+(?=[A-Z/])/).map((z) => z.trim()).filter(Boolean);
  return zinnen.length < 2 ? t : zinnen.map((z) => `- ${z}`).join("\n");
}

type Uitkomst = { tekst: string; cls: string; doel?: string };
function uitkomstVoor(url: string, winnaar: string, rijen: RedirectMapItem[]): Uitkomst {
  const pad = padVanUrl(url);
  const rij = rijen.find((r) => padVanUrl(r.van) === pad);
  if (rij) return rij.verhuizen
    ? { tekst: "verhuist naar", cls: "verhuis", doel: rij.naar }
    : { tekst: "wordt omgeleid naar", cls: "redir", doel: rij.naar };
  if (padVanUrl(winnaar) === pad) return { tekst: "blijft, wint hier", cls: "keep" };
  if (rijen.some((r) => padVanUrl(r.naar) === pad)) return { tekst: "blijft, is zelf een doelpagina", cls: "keep" };
  return { tekst: "blijft staan, geen actie", cls: "keep" };
}

export default function CannibalPanel({ slug, domain = "", openTarget, clientName, clientEmail }: {
  slug: string; domain?: string; clientName?: string; clientEmail?: string;
  /** Doorgegeven aan de werklijst, zodat je vanuit een ander scherm meteen op de
      juiste pagina landt in plaats van zelf te moeten filteren. */
  openTarget?: { url: string; n: number } | null;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // De gekozen URL-vorm. Die gaat als harde regel mee in elke volgende analyse.
  const [vorm, setVorm] = useState("");
  const [vormOpgeslagen, setVormOpgeslagen] = useState("");
  const [vormMsg, setVormMsg] = useState("");
  // De advertentiepagina's. Die moeten bekend zijn vóór de analyse: een Ads-pagina
  // staat meestal op noindex, haalt dus niets uit Google, en ziet er in de data uit
  // als dood gewicht terwijl de advertenties erheen wijzen.
  const [adsTekst, setAdsTekst] = useState("");
  const [adsGeen, setAdsGeen] = useState(false);
  const [adsIngevuld, setAdsIngevuld] = useState(true);
  const [adsMsg, setAdsMsg] = useState("");
  // De waarde-rem over een lijst die er al ligt: pagina's met een waardevolle
  // eigen zoekterm gaan van de omleidlijst af naar "oppakken".
  const [weegMsg, setWeegMsg] = useState("");
  // Wat een klant waard is, zodat de lijsten in euro's kunnen praten in plaats van
  // in zoekvolume. Zonder deze twee getallen rekent het dashboard niets uit.
  const [klantwaarde, setKlantwaarde] = useState("");
  const [conversie, setConversie] = useState("");
  const [euroIngevuld, setEuroIngevuld] = useState(false);
  const [euroMsg, setEuroMsg] = useState("");
  // Wat de al doorgevoerde omleidingen hebben opgeleverd.
  const [metingen, setMetingen] = useState<Nameting[]>([]);
  const [metingenTekst, setMetingenTekst] = useState("");
  // De deellink: één adres dat je aan een klant kunt geven. Daar valt alleen te
  // lezen en uit te klappen; alles wat iets vastlegt zit achter de adminroutes.
  const [deelUrl, setDeelUrl] = useState("");
  const [deelMsg, setDeelMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/opruim-deellink?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d?.ok) setDeelUrl(d.url || ""); }).catch(() => { /* stil */ });
  }, [slug]);

  async function deellink(actie: "maken" | "vernieuwen" | "intrekken") {
    setDeelMsg("");
    try {
      const d = await fetch("/api/admin/opruim-deellink", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, actie }),
      }).then((r) => r.json());
      if (!d?.ok) { setDeelMsg(d?.error || "Mislukt."); return; }
      setDeelUrl(d.url || "");
      setDeelMsg(actie === "intrekken" ? "De link is ingetrokken en werkt niet meer."
        : actie === "vernieuwen" ? "Nieuwe link gemaakt; de vorige werkt niet meer." : "Link klaar om te delen.");
    } catch { setDeelMsg("Mislukt."); }
  }

  // Herwegen draait op de server; het scherm volgt de stand en laadt de lijst
  // opnieuw zodra hij klaar is.
  const weegKlus = useKlus(slug, "opruim-herwegen", () => {
    setWeegMsg(weegKlus.klus?.label || "De lijst is opnieuw gewogen.");
    void load();
  });

  async function weegOpnieuw() {
    if (weegKlus.bezig) return;
    setWeegMsg("");
    try {
      const d = await fetch("/api/admin/opruim-waarde", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }),
      }).then((r) => r.json());
      if (!d.ok) { setWeegMsg(d.error || "Controle mislukt."); return; }
      weegKlus.zetBezig();
      await weegKlus.ververs();
    } catch { setWeegMsg("Controle mislukt."); }
  }


  async function load() {
    try {
      const d = await fetch(`/api/admin/cannibal-redirect?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt, stap: d.stap, stappen: d.stappen, stapLabel: d.stapLabel, cronTik: d.cronTik, cronStil: d.cronStil, kandidaten: d.kandidaten, beoordeeld: d.beoordeeld });
    } catch { /* stil */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  useEffect(() => {
    fetch(`/api/admin/opruim-eindstructuur?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (j?.ok) { setMetingen(j.metingen || []); setMetingenTekst(j.metingenTekst || ""); } })
      .catch(() => { /* stil */ });
  }, [slug]);

  useEffect(() => {
    fetch(`/api/admin/opruim-structuur-regel?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setVorm(d.vorm || ""); setVormOpgeslagen(d.vorm || "");
        const a = d.ads as { paden?: string[]; geen?: boolean; ingevuld?: boolean } | undefined;
        setAdsTekst((a?.paden || []).join("\n"));
        setAdsGeen(!!a?.geen);
        setAdsIngevuld(!!a?.ingevuld);
        const e = d.euro as { klantwaarde?: number; conversie?: number; ingevuld?: boolean } | undefined;
        if (e?.ingevuld) { setKlantwaarde(String(e.klantwaarde)); setConversie(String(e.conversie)); }
        setEuroIngevuld(!!e?.ingevuld);
      })
      .catch(() => { /* stil */ });
  }, [slug]);

  async function bewaarAds(geen?: boolean) {
    setAdsMsg("");
    const wilGeen = geen === undefined ? adsGeen : geen;
    const paden = adsTekst.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
    if (!paden.length && !wilGeen) { setAdsMsg("Vul de pagina's in, of vink aan dat deze klant geen advertentiepagina's heeft."); return; }
    try {
      const d = await fetch("/api/admin/opruim-structuur-regel", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ads: paden, geenAds: wilGeen && !paden.length }),
      }).then((r) => r.json());
      if (!d.ok) { setAdsMsg(d.error || "Opslaan mislukt."); return; }
      const a = d.ads as { paden: string[]; geen: boolean; ingevuld: boolean };
      setAdsTekst(a.paden.join("\n")); setAdsGeen(a.geen); setAdsIngevuld(a.ingevuld);
      setAdsMsg(a.paden.length
        ? `Vastgelegd. Deze ${a.paden.length === 1 ? "pagina blijft" : "pagina's blijven"} buiten elke analyse en buiten de werklijst.`
        : "Vastgelegd: deze klant heeft geen advertentiepagina's.");
    } catch { setAdsMsg("Opslaan mislukt."); }
  }

  async function bewaarEuro() {
    setEuroMsg("");
    const k = Number(klantwaarde.replace(/[^0-9,.]/g, "").replace(",", "."));
    const c = Number(conversie.replace(/[^0-9,.]/g, "").replace(",", "."));
    if (!k || !c) { setEuroMsg("Vul allebei een getal in: wat één klant gemiddeld opbrengt, en welk deel van de bezoekers klant wordt."); return; }
    try {
      const d = await fetch("/api/admin/opruim-structuur-regel", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, klantwaarde: k, conversie: c }),
      }).then((r) => r.json());
      if (!d.ok) { setEuroMsg(d.error || "Opslaan mislukt."); return; }
      setEuroIngevuld(!!d.euro?.ingevuld);
      setEuroMsg("Opgeslagen. Alle lijsten hieronder rekenen nu in euro's; dat werkt meteen door, zonder nieuwe analyse.");
      await load();
    } catch { setEuroMsg("Opslaan mislukt."); }
  }

  async function bewaarVorm() {
    setVormMsg("");
    // Leeg veld terwijl er nog niets is vastgelegd: dat was de val. De knop stond
    // dan uitgeschakeld en er gebeurde niets, terwijl het grijze voorbeeld in het
    // veld eruitzag alsof er al iets stond. Nu krijg je gewoon antwoord.
    if (!vorm.trim() && !vormOpgeslagen) { setVormMsg("Er staat nog niets in het veld. Het grijze voorbeeld is alleen een suggestie; typ de vorm die je wilt vastleggen."); return; }
    try {
      const d = await fetch("/api/admin/opruim-structuur-regel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, vorm }) }).then((r) => r.json());
      if (!d.ok) { setVormMsg(d.error || "Opslaan mislukt."); return; }
      setVormOpgeslagen(d.vorm || "");
      setVormMsg(d.vorm ? "Opgeslagen. Vanaf de volgende analyse is dit de enige toegestane vorm." : "Structuurkeuze gewist.");
    } catch { setVormMsg("Opslaan mislukt."); }
  }

  useEffect(() => {
    if (state?.status !== "running") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [state?.status, slug]);

  async function run() {
    if (busy || state?.status === "running") return;
    setBusy(true); setErr("");
    // Verberg een eventuele vorige foutmelding meteen (geen rode flits tijdens het starten).
    setState((s) => (s ? { ...s, status: "running", error: "" } : s));
    try {
      const d = await fetch("/api/admin/cannibal-redirect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await load(); return; }
      await load();
    } catch { setErr("Starten mislukt."); await load(); } finally { setBusy(false); }
  }

  // Hervatten zonder opnieuw te beginnen: de ontsnapping als het vangnet wegblijft.
  async function hervat() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const d = await fetch("/api/admin/cannibal-redirect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, hervat: true }) }).then((r) => r.json());
      if (!d.ok) setErr(d.error || "Hervatten mislukt.");
      await load();
    } catch { setErr("Hervatten mislukt."); await load(); } finally { setBusy(false); }
  }

  // Per pagina het bewijs uit de clusters opzoeken, zodat het onder de juiste regel
  // van de werklijst komt in plaats van in een aparte sectie met eigen vormgeving.
  const bewijsPerPad: Record<string, import("./OpruimTabel").Bewijs> = {};
  for (const c of state?.result?.clusters || []) {
    for (const u of c.urls) {
      const p = padVanUrl(u.url);
      if (bewijsPerPad[p]) continue;
      bewijsPerPad[p] = {
        keyword: c.keyword, winnaar: c.winnaar, urls: c.urls,
        onderbouwing: c.onderbouwing, urlFlip: c.signalen?.urlFlip, flipsIn90d: c.signalen?.flipsIn90d,
      };
    }
  }

  const siteUrl = (p: string) => {
    const pad = padVanUrl(p);
    return pad.startsWith("http") ? pad : `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${pad}`;
  };

  // Wat blijft er bewust staan? Alle pagina's die in een cluster meedoen maar niet
  // in de werklijst voorkomen. Een klant wil niet alleen zien wat je weghaalt.
  const blijftStaan: { pad: string; reden: string }[] = (() => {
    const rijen = state?.result?.redirectMap || [];
    const weg = new Set(rijen.map((r) => padVanUrl(r.van)));
    const doelen = new Set(rijen.map((r) => padVanUrl(r.naar)));
    const uit = new Map<string, string>();
    for (const c of state?.result?.clusters || []) {
      for (const u of c.urls) {
        const p = padVanUrl(u.url);
        if (weg.has(p) || uit.has(p)) continue;
        uit.set(p, doelen.has(p)
          ? `Andere pagina's gaan hierin op; dit is de pagina die blijft winnen op "${c.keyword}".`
          : padVanUrl(c.winnaar) === p
            ? `Wint op "${c.keyword}" en blijft de pagina voor dat onderwerp.`
            : `Doet mee op "${c.keyword}" maar wint op zijn eigen onderwerp; er is geen reden om hem op te ruimen.`);
      }
    }
    return [...uit.entries()].map(([pad, reden]) => ({ pad, reden })).sort((a, b) => a.pad.localeCompare(b.pad));
  })();

  const running = state?.status === "running";
  const result = state?.result;
  const dk = result?.datakwaliteit;
  // De datum van de lijst die je NU ziet. Niet updatedAt: dat is tijdens een run de
  // hartslag van de werker, dus een oude lijst zou vers lijken.
  const lijstDatum = result?.generatedAt || (state?.status === "done" ? state?.updatedAt : null);
  const regels = result?.redirectMap?.length || 0;
  const stappen = state?.stappen || 5;

  return (
    <div className="cannibal-panel">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Keyword-cannibalisatie-analyse</span>
          <button type="button" className={"pcd-btn pcd-btn-primary" + (running ? " busy" : "")} onClick={run} disabled={busy || running || !adsIngevuld}
            title={adsIngevuld ? "" : "Vul eerst de advertentiepagina's in, anders kan de analyse er een voorstellen om op te ruimen."}>
            {running ? "Analyse draait…" : result ? "Opnieuw analyseren" : "Analyse draaien"}
          </button>
        </div>
        {/* Was een alinea vol vaktaal (URL-flip-detectie, positie-plafond,
            klik-verdeling, false positives). Zelfs een SEO-specialist haakte daarop
            af, laat staan een klant die straks de deellink krijgt. Nu in gewone taal,
            met de echte aantallen erbij. */}
        <div className="opr-kaart opr-kaart-intro">
          <div className="opr-kop">Wat deze analyse doet</div>
          <div className="opr-kaart-tekst">
          <p>
            Deze pagina beantwoordt één vraag per pagina van de site: <strong>wat moet hiermee gebeuren</strong>. En
            daarnaast één vraag over de site als geheel: <strong>wat ontbreekt er</strong>.
          </p>

          <p><strong>Waar de analyse naar kijkt</strong></p>
          <ul>
            <li>
              <strong>Search Console:</strong> op welk zoekwoord welke pagina wordt getoond, hoe vaak, op welke plek, en
              of Google door de tijd heen wisselt tussen twee pagina&rsquo;s van deze site. Dat wisselen is het hardste
              signaal dat er is: dan twijfelt Google en verliezen ze allebei.
            </li>
            <li>
              <strong>Ahrefs:</strong> per zoekterm het maandelijkse zoekvolume, de moeilijkheid, en de
              <strong> zoekintentie</strong> (wil iemand iets regelen, of eerst iets weten). Plus de autoriteit van het
              domein zelf.
            </li>
            <li>
              <strong>De live site:</strong> welke pagina&rsquo;s er zijn, welke URL-vormen naast elkaar bestaan, en welke
              advertentiepagina&rsquo;s buiten schot moeten blijven.
            </li>
          </ul>

          <p><strong>Twee remmen, zodat opruimen geen schade doet</strong></p>
          <ul>
            <li>
              <strong>Zoekintentie.</strong> &ldquo;soa test kopen&rdquo; en &ldquo;wat is een soa test&rdquo; delen bijna
              alle woorden, maar de één wil bestellen en de ander wil het snappen. Die worden nooit samengevoegd: dat
              zou één van de twee groepen bezoekers kosten. Wat om die reden apart blijft, staat zichtbaar in beeld met
              de reden erbij.
            </li>
            <li>
              <strong>Haalbaarheid.</strong> De moeilijkheid van een zoekterm gaat af tegen de autoriteit van dit domein.
              Een term met moeilijkheid 70 bij een domein van 30 is geen kans maar een illusie. Elke regel krijgt
              daarom <em>kansrijk</em>, <em>pittig</em> of <em>buiten bereik</em>, en de lijsten staan op volgorde van
              wat kán in plaats van wat groot is. Er verdwijnt niets; buiten bereik gaat onderaan.
            </li>
          </ul>

          <p><strong>Wat eruit komt: vier lijsten en een eindbeeld</strong></p>
          <ul>
            <li><strong>Onderwerpen bundelen.</strong> Drie of meer pagina&rsquo;s over hetzelfde, geen van alle in de top 10. Eén ervan wordt de thuisbasis, de rest gaat daarin op.</li>
            <li><strong>Oppakken, niet weghalen.</strong> De pagina scoort nergens op, maar zijn eigen zoekterm heeft wél volume en niemand anders bezit hem. Opruimen zou hier een kans weggooien.</li>
            <li><strong>Wat er ontbreekt.</strong> Zoektermen met volume waar geen enkele pagina op mikt. Dit is het enige blok dat over groei gaat in plaats van over opruimen.</li>
            <li><strong>De werklijst.</strong> Per pagina waar hij heen gaat en waarom; klap een regel open voor het bewijs.</li>
            <li><strong>Klopte het?</strong> Bij het doorvoeren wordt vastgelegd hoe de winnaar er dán voor staat; na 30 en 90 dagen wordt hetzelfde opnieuw gemeten.</li>
            <li><strong>En onderaan het resultaat:</strong> hoe de site eruitziet als alles is doorgevoerd, gegroepeerd per onderwerp.</li>
          </ul>
          <p>
            Vul je hierboven in wat een klant waard is, dan staan alle lijsten ook in euro&rsquo;s. De analyse draait op de
            achtergrond; je kunt wegklikken.
          </p>
          </div>
        </div>
        {/* Eerst dit, dan pas analyseren. Een Google Ads-landingspagina staat vaak op
            noindex: hij haalt niets uit Google en lijkt daarom dood gewicht, terwijl de
            advertenties erheen wijzen. Zo'n pagina opruimen kost meteen geld. */}
        <div className={"opr-vorm opr-ads" + (adsIngevuld ? "" : " nodig")}>
          <div className="opr-vorm-kop">
            Advertentiepagina&rsquo;s (Google Ads)
            {adsIngevuld
              ? <span className="opr-chip merge" style={{ marginLeft: 8 }}>{adsGeen ? "geen" : `${adsTekst.split("\n").filter(Boolean).length} vastgelegd`}</span>
              : <span className="opr-chip nodig" style={{ marginLeft: 8 }}>invullen vóór de analyse</span>}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Landingspagina&rsquo;s waar je advertenties naartoe sturen staan meestal op <strong>noindex</strong>. Ze halen dus
            niets uit Google en zien er in de data uit als dode pagina&rsquo;s, terwijl ze juist moeten blijven bestaan.
            Zet ze hier neer, dan blijven ze buiten de analyse en buiten de werklijst. E&eacute;n pad per regel; een map
            zoals <code>/ads/</code> dekt meteen alles daaronder.
          </p>
          <textarea className="opr-ads-veld" value={adsTekst} rows={3} spellCheck={false}
            onChange={(e) => { setAdsTekst(e.target.value); if (e.target.value.trim()) setAdsGeen(false); }}
            placeholder={"/landing-page/\n/ads/\n/actie-soa-test/"} aria-label="Advertentiepagina's" />
          <div className="opr-vorm-rij">
            <button type="button" className="ghost-btn small" onClick={() => void bewaarAds()}>Opslaan</button>
            <label className="opr-ads-geen">
              <input type="checkbox" checked={adsGeen} disabled={!!adsTekst.trim()}
                onChange={(e) => { setAdsGeen(e.target.checked); if (e.target.checked) void bewaarAds(true); }} />
              Deze klant heeft geen advertentiepagina&rsquo;s
            </label>
          </div>
          {adsMsg && <div className="muted" style={{ fontSize: 12 }}>{adsMsg}</div>}
        </div>

        {/* Wat een klant waard is. Zonder deze twee getallen praten alle lijsten in
            zoekvolume, en dat is geen taal waarin je een besluit uitlegt. */}
        <div className="opr-vorm">
          <div className="opr-vorm-kop">
            Wat een klant waard is
            {euroIngevuld
              ? <span className="opr-chip merge" style={{ marginLeft: 8 }}>actief</span>
              : <span className="opr-chip" style={{ marginLeft: 8 }}>nog niet ingevuld</span>}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Met deze twee getallen praten alle lijsten hieronder in euro&rsquo;s in plaats van in zoekvolume:
            zoekvolume, maal de kans dat iemand doorklikt op een hogere plek, maal jullie conversie, maal wat een klant
            oplevert. &ldquo;Deze pagina is 900 euro per maand waard&rdquo; is uit te leggen aan een klant,
            &ldquo;500 zoekopdrachten&rdquo; niet. Laat je ze leeg, dan blijft alles op zoekvolume staan.
          </p>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            <strong>Gok gerust bij die conversie.</strong> Niemand weet precies welk deel van de bezoekers klant wordt:
            wie na drie bezoeken belt staat nergens geregistreerd, en een deel van de aanvragen loopt buiten elke meting
            om. Dat hoeft ook niet nauwkeurig, want <strong>het is voor elke regel dezelfde vermenigvuldiging</strong>.
            De <em>volgorde</em> van de lijst verandert er dus niet door, alleen de hoogte van de bedragen. Voor
            &ldquo;waar beginnen we&rdquo; maakt 1% of 3% niets uit; het maakt alleen uit op het moment dat je het bedrag
            aan een klant laat zien. Vandaar dat overal ook het aantal <strong>extra bezoekers</strong> staat: dat is het
            harde deel van de som.
          </p>
          <div className="opr-vorm-rij">
            <input className="opr-zoek" style={{ maxWidth: 220 }} value={klantwaarde} onChange={(e) => setKlantwaarde(e.target.value)}
              placeholder="wat één klant opbrengt, bijv. 350" aria-label="Waarde van één klant in euro's" />
            <input className="opr-zoek" style={{ maxWidth: 220 }} value={conversie} onChange={(e) => setConversie(e.target.value)}
              placeholder="% dat klant wordt, bijv. 2" aria-label="Conversiepercentage" />
            <button type="button" className="ghost-btn small" onClick={() => void bewaarEuro()}>Opslaan</button>
          </div>
          {euroMsg && <div className="muted" style={{ fontSize: 12 }}>{euroMsg}</div>}
        </div>

        {err && <div className="login-error" style={{ marginBottom: 8 }}>{err}</div>}
        {state?.status === "error" && state.error && <div className="login-error" style={{ marginBottom: 8 }}>{state.error}</div>}
        {/* Voortgang, want een spinner zonder stand is niet te onderscheiden van
            vastgelopen. Precies dat gebeurde op 03-08-2026: de run was al dood en
            het scherm bleef "draait…" tonen. */}
        {running && (
          <Voortgang
            titel="Opruimanalyse"
            label={[
              state?.stapLabel || "De analyse wordt gestart",
              regels > 0 ? `${regels} regels tot nu toe` : "",
              (state?.kandidaten || 0) > 0 ? `${state?.beoordeeld || 0} van de ${state?.kandidaten} kandidaten nagelopen` : "",
              "De hele analyse duurt een kwartier tot twintig minuten.",
            ].filter(Boolean).join(" · ")}
            stap={state?.stap || 1}
            stappen={stappen}
            sinds={state?.updatedAt}
            stil={!!state?.cronStil}
            actie={{ label: "Nu hervatten", onClick: hervat, bezig: busy }}
          />
        )}
        {!result && !running && state?.status !== "error" && <div className="muted">Nog geen analyse. Klik &ldquo;Analyse draaien&rdquo;.</div>}

        {result && (
          <>
            {/* De deellink. Bewust een eigen kaart bovenaan: dit is wat je aan
                een klant geeft, en je wilt in één oogopslag zien of hij aanstaat. */}
            <div className="opr-kaart opr-deelkaart">
              <div className="opr-kop-rij">
                <div className="opr-kop">Deelbare link voor de klant</div>
                <div className="opr-kaart-acties">
                  {!deelUrl && <button type="button" className="ghost-btn small" onClick={() => void deellink("maken")}>Maak een deellink</button>}
                  {deelUrl && <button type="button" className="ghost-btn small" onClick={() => { void navigator.clipboard.writeText(deelUrl); setDeelMsg("Gekopieerd."); }}>Kopieer</button>}
                  {deelUrl && <a className="ghost-btn small" href={deelUrl} target="_blank" rel="noreferrer">Bekijk zoals de klant hem ziet</a>}
                  {deelUrl && <button type="button" className="ghost-btn small" onClick={() => void deellink("vernieuwen")} title="Maakt een nieuw adres; de oude link werkt daarna niet meer.">Nieuw adres</button>}
                  {deelUrl && <button type="button" className="ghost-btn small" onClick={() => void deellink("intrekken")}>Intrekken</button>}
                </div>
              </div>
              <div className="opr-kaart-tekst">
                <p>
                  Eén adres dat je aan iedereen kunt geven, zonder inloggen. Daar staat hetzelfde verhaal als hier:
                  alle kaarten, alle uitklappers, alle onderbouwing. <strong>Alleen kijken</strong>, verder niets:
                  geen vinkjes, geen houden of negeren, geen doorvoeren, geen weekplanning en geen mail.
                </p>
                {deelUrl
                  ? <p><a className="opr-pad" href={deelUrl} target="_blank" rel="noreferrer">{deelUrl}</a></p>
                  : <p>Er staat nog geen link open. Zolang je er geen maakt, is dit rapport nergens publiek te zien.</p>}
                {deelMsg && <p><strong>{deelMsg}</strong></p>}
              </div>
            </div>

            <div className="ck-updated" style={{ marginBottom: 10 }}>
              {lijstDatum ? `Deze lijst is van ${new Date(lijstDatum).toLocaleString("nl-NL")}` : "Deze lijst heeft geen datum"}
              {running ? " · de nieuwe analyse draait nog, dit is nog de vorige" : ""}
            </div>

            {dk && (
              <details className="opr-kaart opr-kaart-bron">
                <summary className="opr-kaart-sam">Waarop deze analyse is gebaseerd</summary>
                <div className="opr-kaart-tekst" style={{ marginTop: "var(--s-3)" }}>
                  <p>
                    De conclusies hieronder komen uit de eigen cijfers van de website, niet uit een aanname.
                    Gebruikt zijn:
                  </p>
                  <ul>
                    <li><strong>Search Console:</strong> op welk zoekwoord welke pagina wordt getoond, hoe vaak, en op welke plek. {dk.gsc ? "Beschikbaar." : "Niet beschikbaar."}</li>
                    <li><strong>Het verloop door de tijd:</strong> of Google tussen twee pagina&rsquo;s wisselt op hetzelfde zoekwoord. {dk.gscTijdreeks ? "Beschikbaar." : "Niet beschikbaar."}</li>
                    <li><strong>Ahrefs:</strong> het zoekvolume per zoekwoord en de posities per pagina. {dk.ahrefsZoekwoorden ? "Beschikbaar." : "Niet beschikbaar."}</li>
                    <li><strong>Verwijzende websites:</strong> hoeveel andere sites naar een pagina linken, als maat voor hoe sterk hij staat. {dk.ahrefsBacklinks ? "Beschikbaar." : "Niet beschikbaar."}</li>
                  </ul>
                  {!dk.crawl && (
                    <p>
                      <strong>Wat er niet in zit:</strong> een technische scan van de website zelf. Daarmee zou je ook kunnen
                      nakijken of pagina&rsquo;s onderling correct naar elkaar verwijzen. Voor de keuzes hieronder is dat niet
                      nodig; het betekent alleen dat we na het doorvoeren van de omleidingen nog één keer nameten of ze
                      allemaal in één stap aankomen.
                    </p>
                  )}
                </div>
              </details>
            )}

            <div className="opr-kaart opr-vorm">
              <div className="opr-vorm-kop">
                Gekozen URL-structuur
                {vormOpgeslagen
                  ? <span className="opr-chip merge" style={{ marginLeft: 8 }}>actief: {vormOpgeslagen}</span>
                  : <span className="opr-chip" style={{ marginLeft: 8 }}>nog niet vastgelegd</span>}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                E&eacute;n vaste vorm voor dit type pagina. De analyse leidt daarna nooit meer om naar een vorm die je uitfaseert,
                en markeert een sterke pagina op de verkeerde vorm als <em>verhuizen</em> in plaats van als omleiding.
              </p>
              <div className="opr-vorm-rij">
                <input className="opr-zoek" value={vorm} onChange={(e) => setVorm(e.target.value)}
                  placeholder="bijvoorbeeld: /soa-klinieken/soa-test-&lt;plaats&gt;/" spellCheck={false}
                  aria-label="Gekozen URL-structuur" />
                <button type="button" className="ghost-btn small" onClick={bewaarVorm}>Opslaan</button>
              </div>
              {vormMsg && <div className="muted" style={{ fontSize: 12 }}>{vormMsg}</div>}
            </div>

            <OpruimStructuur slug={slug} />

            {/* Eerst de gemiste kansen, dan pas het opruimwerk: hier zit de
                grootste opbrengst, en het is ook het besluit dat het meeste
                nadenken vraagt. */}
            <OpruimOnderwerpen slug={slug} domain={domain} rijen={result.onderwerpen || []} clientName={clientName} clientEmail={clientEmail} />

            <OpruimOppakken slug={slug} domain={domain} rijen={result.oppakken || []} clientName={clientName} clientEmail={clientEmail} />

            {/* De andere helft: wat er helemaal niet is. Opruimen maakt een site
                schoon, dit laat hem groeien. */}
            <OpruimGaten slug={slug} domain={domain} rijen={result.gaten || []} clientName={clientName} clientEmail={clientEmail} />

            {/* De werklijst eerst. Het verhaal eronder: een lijst is om af te werken,
                proza is om te begrijpen, en in die volgorde. */}
            {result.redirectMap && result.redirectMap.length > 0 && (
              <div className="opr-kaart">
                <div className="opr-kop-rij">
                <div className="opr-kop">Werklijst: wat waar naartoe</div>
                <div className="opr-kaart-acties">
                {/* Downloaden als CSV: opent met een dubbelklik in Excel en is te
                    importeren in Google Sheets. Platte rijen met duidelijke
                    van/naar-kolommen, zoals Maartens eigen Excel. */}
                <a className="ghost-btn small" href={`/api/admin/opruim-export?slug=${encodeURIComponent(slug)}`}
                   title="Downloadt de volledige lijst als CSV. Dubbelklikken opent hem in Excel; in Google Sheets via Bestand, Importeren.">
                  Download voor Excel of Sheets
                </a>
                {/* De rem ook over een lijst die er al ligt, zonder een nieuwe
                    analyse van twintig minuten. */}
                <button type="button" className="ghost-btn small" onClick={() => void weegOpnieuw()} disabled={weegKlus.bezig}
                  title="Twee controles in één: pagina's met een waardevolle eigen zoekterm gaan van deze lijst af, en onderwerpen die over meerdere pagina's verspreid liggen komen bovenaan te staan.">
                  {weegKlus.bezig ? "Bezig met controleren…" : "Controleer op gemiste kansen"}
                </button>
                </div>
              </div>
                {weegKlus.bezig && (
                  <div style={{ margin: "var(--s-3) 0" }}>
                    <Voortgang klein titel="De opruimlijst opnieuw wegen" label={weegKlus.klus?.label} sinds={weegKlus.klus?.gestart} />
                  </div>
                )}
                {weegMsg && <div className="opr-melding">{weegMsg}</div>}
                <OpruimTabel slug={slug} domain={domain} rijen={result.redirectMap} openTarget={openTarget} bewijs={bewijsPerPad} />
              </div>
            )}

            {/* ── Wat er daarna nog moet gebeuren: de interne links ──
                Deze komen uit de cannibalisatie-analyse: links vanaf inhoudelijk
                verwante pagina's naar de winnaar van een cluster, zodat Google zijn
                keuze niet meer hoeft te maken. Het is geen volledige linkaudit. */}
            {result.interneLinks && result.interneLinks.length > 0 && (
              <div className="opr-kaart">
                <div className="opr-kop">Daarna: interne links leggen ({result.interneLinks.length})</div>
                <p className="opr-kaart-tekst">
                  Omleiden lost op dat twee pagina&rsquo;s om hetzelfde zoekwoord vechten. Deze links maken de winnaar
                  daarna ook sterker: vanaf pagina&rsquo;s die over hetzelfde onderwerp gaan, met een ankertekst die het
                  zoekwoord bevat. Dat is een aanvulling op het opruimen, geen volledige interne-linkaudit; daarvoor is
                  het tabblad <em>Interne links</em>.
                </p>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Zet een link op deze pagina</th><th>Naar</th><th>Met deze tekst</th></tr></thead>
                    <tbody>
                      {result.interneLinks.map((l, i) => (
                        <tr key={i}>
                          <td><a href={siteUrl(l.vanaf)} target="_blank" rel="noreferrer">{padVanUrl(l.vanaf)}</a></td>
                          <td><a href={siteUrl(l.naar)} target="_blank" rel="noreferrer">{padVanUrl(l.naar)}</a></td>
                          <td>{l.ankertekst || "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Wat we bewust laten staan ──
                Een klant wil niet alleen zien wat je weghaalt, maar ook waar je
                vanaf blijft. Deze pagina's kwamen in de analyse voorbij en blijven. */}
            {blijftStaan.length > 0 && (
              <div className="opr-kaart">
                <div className="opr-kop">Wat we bewust laten staan ({blijftStaan.length})</div>
                <p className="opr-kaart-tekst">
                  Deze pagina&rsquo;s kwamen in de analyse langs omdat ze meedoen op een zoekwoord waar meerdere
                  pagina&rsquo;s op ranken. Ze blijven staan: ze winnen op hun eigen onderwerp, of andere pagina&rsquo;s
                  gaan er juist in op.
                </p>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Pagina</th><th>Waarom blijft hij</th></tr></thead>
                    <tbody>
                      {blijftStaan.map((b, i) => (
                        <tr key={i}>
                          <td><a href={siteUrl(b.pad)} target="_blank" rel="noreferrer">{b.pad}</a></td>
                          <td className="muted" style={{ fontSize: 13 }}>{b.reden}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Terugkijken: klopte de voorspelling van de al doorgevoerde omleidingen? */}
            <OpruimNameten rijen={metingen} tekst={metingenTekst} domain={domain} />

            {/* Het sluitstuk: niet het werk, maar het resultaat. Zo ziet de site
                eruit als alles hierboven is doorgevoerd. */}
            <OpruimEindstructuur slug={slug} domain={domain} />

            {/* Zelfde component als op de deellink, zodat de klantversie en de
                cockpit niet uit elkaar kunnen lopen. */}
            <OpruimSamenvatting
              domain={domain}
              samenvatting={result.samenvatting}
              clusters={result.clusters?.length || 0}
              regels={regels}
              oppakken={result.oppakken?.length || 0}
              onderwerpen={result.onderwerpen?.length || 0}
              gaten={result.gaten?.length || 0}
              euroPerMaand={
                [...(result.oppakken || []), ...(result.onderwerpen || []), ...(result.gaten || [])]
                  .reduce((n, r) => n + ((r as { euro?: { perMaand?: number } }).euro?.perMaand || 0), 0)
              }
              blijftStaan={blijftStaan.length}
              interneLinks={result.interneLinks?.length || 0}
            />
          </>
        )}
      </div>
    </div>
  );
}

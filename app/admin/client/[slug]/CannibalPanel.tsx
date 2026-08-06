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

  // Eén sectie: ingeklapt, met in de kop al wat erin zit. Zo zie je in één blik
  // waar je moet zijn in plaats van door zes open blokken te scrollen.
  const Sectie = ({ titel, aantal, wat, open: standaardOpen = false, children }: {
    titel: string; aantal?: number; wat: string; open?: boolean; children: React.ReactNode;
  }) => (
    <details className="opr-sectie" open={standaardOpen}>
      <summary>
        <span className="opr-sectie-kop">
          <span className="opr-sectie-titel">{titel}</span>
          {aantal != null && <span className="opr-chip merge">{aantal}</span>}
        </span>
        <span className="opr-sectie-wat">{wat}</span>
      </summary>
      <div className="opr-sectie-body">{children}</div>
    </details>
  );

  return (
    <div className="cannibal-panel">
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head">
          <span>Opruimen: pagina&rsquo;s die elkaar in de weg zitten</span>
          <span className="opr-kaart-acties">
            {/* Deze knop stond in de werklijst, en die klapt sinds 7 augustus dicht.
                Een actie die je nodig hebt hoort niet achter een dichte sectie te
                zitten; hij gaat bovendien over de hele pagina, niet over die ene
                lijst. */}
            {result && (
              <button type="button" className="ghost-btn small" onClick={() => void weegOpnieuw()} disabled={weegKlus.bezig || running}
                title="Rekent de lijsten opnieuw door met de actuele cijfers: pagina's met een waardevolle eigen zoekterm gaan van de opruimlijst af, de onderwerpen en de ontbrekende pagina's worden opnieuw bepaald. Duurt een paar minuten, geen twintig.">
                {weegKlus.bezig ? "Bezig met controleren…" : "Controleer op gemiste kansen"}
              </button>
            )}
            <button type="button" className={"pcd-btn pcd-btn-primary" + (running ? " busy" : "")} onClick={run} disabled={busy || running || !adsIngevuld}
              title={adsIngevuld ? "" : "Vul eerst de advertentiepagina's in, anders kan de analyse er een voorstellen om op te ruimen."}>
              {running ? "Analyse draait…" : result ? "Opnieuw analyseren" : "Analyse draaien"}
            </button>
          </span>
        </div>
        {/* De uitkomst van die knop hoort óók bovenaan te staan, niet verstopt in de
            sectie waar hij vandaan kwam. */}
        {weegKlus.bezig && (
          <div style={{ marginBottom: "var(--s-3)" }}>
            <Voortgang klein titel="De lijsten opnieuw doorrekenen" label={weegKlus.klus?.label} sinds={weegKlus.klus?.gestart} />
          </div>
        )}
        {weegMsg && <div className="opr-melding" style={{ marginBottom: "var(--s-3)" }}>{weegMsg}</div>}

        {/* Wat je één keer instelt, en de deellink. Allebei in een lade: je vult
            het één keer in en ziet het daarna nooit meer, dus het hoort niet het
            halve scherm te vullen. */}
        <div className="opr-laden">
          <details className="opr-lade" open={!adsIngevuld}>
            <summary>
              Instellingen voor deze klant
              {adsIngevuld
                ? <span className="opr-chip merge">advertentiepagina&rsquo;s: {adsGeen ? "geen" : adsTekst.split("\n").filter(Boolean).length}</span>
                : <span className="opr-chip nodig">advertentiepagina&rsquo;s invullen</span>}
              <span className={"opr-chip" + (euroIngevuld ? " merge" : "")}>{euroIngevuld ? "bedragen aan" : "geen bedragen"}</span>
              {vormOpgeslagen && <span className="opr-chip merge">URL-vorm vast</span>}
            </summary>
            <div className="opr-lade-body">
              {/* Eerst dit, dan pas analyseren. Een Google Ads-landingspagina staat vaak op
                  noindex: hij haalt niets uit Google en lijkt daarom dood gewicht, terwijl de
                  advertenties erheen wijzen. Zo'n pagina opruimen kost meteen geld. */}
              <div className={"opr-vorm opr-ads" + (adsIngevuld ? "" : " nodig")}>
                <div className="opr-vorm-kop">Advertentiepagina&rsquo;s (Google Ads)</div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Landingspagina&rsquo;s waar je advertenties naartoe stuurt staan meestal op <strong>noindex</strong>. Ze halen dus
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
                <div className="opr-vorm-kop">Wat een klant waard is</div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Met deze twee getallen praten alle lijsten hieronder in euro&rsquo;s in plaats van in zoekvolume.
                  Laat je ze leeg, dan blijft alles op zoekvolume staan; de volgorde van de lijsten is in beide
                  gevallen dezelfde.
                </p>
                <div className="opr-vorm-rij">
                  <input className="opr-zoek" style={{ maxWidth: 220 }} value={klantwaarde} onChange={(e) => setKlantwaarde(e.target.value)}
                    placeholder="wat één klant opbrengt, bijv. 350" aria-label="Waarde van één klant in euro's" />
                  <input className="opr-zoek" style={{ maxWidth: 220 }} value={conversie} onChange={(e) => setConversie(e.target.value)}
                    placeholder="% dat klant wordt, bijv. 2" aria-label="Conversiepercentage" />
                  <button type="button" className="ghost-btn small" onClick={() => void bewaarEuro()}>Opslaan</button>
                </div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  <strong>Gok gerust bij die conversie.</strong> Niemand weet precies welk deel van de bezoekers klant
                  wordt; wie na drie bezoeken belt staat nergens geregistreerd. Het hoeft ook niet nauwkeurig, want het is
                  voor elke regel dezelfde vermenigvuldiging: de volgorde verandert er niet door, alleen de hoogte van de
                  bedragen. Daarom staat overal ook het aantal extra bezoekers, en dat getal leunt niet op de aanname.
                </p>
                {euroMsg && <div className="muted" style={{ fontSize: 12 }}>{euroMsg}</div>}
              </div>

              <div className="opr-vorm">
                <div className="opr-vorm-kop">
                  Gekozen URL-structuur
                  {vormOpgeslagen
                    ? <span className="opr-chip merge" style={{ marginLeft: 8 }}>actief: {vormOpgeslagen}</span>
                    : <span className="opr-chip" style={{ marginLeft: 8 }}>nog niet vastgelegd</span>}
                </div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  E&eacute;n vaste vorm voor dit type pagina. De analyse leidt daarna nooit meer om naar een vorm die je
                  uitfaseert, en markeert een sterke pagina op de verkeerde vorm als <em>verhuizen</em> in plaats van als
                  omleiding.
                </p>
                <div className="opr-vorm-rij">
                  <input className="opr-zoek" value={vorm} onChange={(e) => setVorm(e.target.value)}
                    placeholder="bijvoorbeeld: /soa-klinieken/soa-test-&lt;plaats&gt;/" spellCheck={false}
                    aria-label="Gekozen URL-structuur" />
                  <button type="button" className="ghost-btn small" onClick={bewaarVorm}>Opslaan</button>
                </div>
                {vormMsg && <div className="muted" style={{ fontSize: 12 }}>{vormMsg}</div>}
              </div>
            </div>
          </details>

          <details className="opr-lade">
            <summary>
              Deelbare link voor de klant
              <span className={"opr-chip" + (deelUrl ? " merge" : "")}>{deelUrl ? "staat open" : "staat uit"}</span>
            </summary>
            <div className="opr-lade-body">
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                E&eacute;n adres dat je aan iedereen kunt geven, zonder inloggen: hetzelfde verhaal als hier, maar
                <strong> alleen kijken</strong>. Geen vinkjes, geen doorvoeren, geen weekplanning en geen mail.
                Zolang je er geen maakt, is dit rapport nergens publiek te zien.
              </p>
              {deelUrl && <p style={{ margin: 0 }}><a className="opr-pad" href={deelUrl} target="_blank" rel="noreferrer">{deelUrl}</a></p>}
              <div className="opr-vorm-rij">
                {!deelUrl && <button type="button" className="ghost-btn small" onClick={() => void deellink("maken")}>Maak een deellink</button>}
                {deelUrl && <button type="button" className="ghost-btn small" onClick={() => { void navigator.clipboard.writeText(deelUrl); setDeelMsg("Gekopieerd."); }}>Kopieer</button>}
                {deelUrl && <a className="ghost-btn small" href={deelUrl} target="_blank" rel="noreferrer">Bekijk zoals de klant hem ziet</a>}
                {deelUrl && <button type="button" className="ghost-btn small" onClick={() => void deellink("vernieuwen")} title="Maakt een nieuw adres; de oude link werkt daarna niet meer.">Nieuw adres</button>}
                {deelUrl && <button type="button" className="ghost-btn small" onClick={() => void deellink("intrekken")}>Intrekken</button>}
              </div>
              {deelMsg && <div className="muted" style={{ fontSize: 12 }}><strong>{deelMsg}</strong></div>}
            </div>
          </details>
        </div>

        {/* De uitleg over de volle breedte, in kaartjes. Stond als één lijst in een
            smalle kolom tegen de linkerrand; dat leest niet en het maakte niet
            duidelijk waar je moest beginnen. */}
        <div className="opr-kaart opr-kaart-intro">
          <div className="opr-kop">Wat deze analyse doet</div>
          <div className="opr-kaart-tekst">
            <p>
              Per pagina van de site één vraag: <strong>wat moet hiermee gebeuren</strong>. En over de site als geheel
              één vraag: <strong>wat ontbreekt er</strong>. De analyse draait op de achtergrond; je kunt wegklikken.
            </p>
          </div>
          <div className="opr-intro-grid">
            <div className="opr-intro-kaart">
              <h4>Waar we naar kijken</h4>
              <ul>
                <li><strong>Search Console:</strong> welke pagina op welk zoekwoord wordt getoond, hoe vaak en op welke plek. En of Google door de tijd heen wisselt tussen twee van jouw pagina&rsquo;s; dat is het hardste signaal dat er is.</li>
                <li><strong>Ahrefs:</strong> zoekvolume, moeilijkheid en wat iemand met een zoekopdracht bedoelt. Plus hoe sterk het domein zelf staat.</li>
                <li><strong>De live site:</strong> welke pagina&rsquo;s er zijn en welke URL-vormen naast elkaar bestaan.</li>
              </ul>
            </div>
            <div className="opr-intro-kaart">
              <h4>Twee controles tegen schade</h4>
              <ul>
                <li><strong>Gaat het wel om dezelfde vraag?</strong> &ldquo;soa test kopen&rdquo; en &ldquo;wat is een soa test&rdquo; lijken op elkaar, maar de één wil bestellen en de ander wil het snappen. Die worden nooit samengevoegd.</li>
                <li><strong>Is het te winnen?</strong> Een zoekterm die veel zwaarder is dan dit domein aankan, is geen kans. Zulke regels blijven staan maar gaan onderaan, met de reden erbij.</li>
              </ul>
            </div>
            <div className="opr-intro-kaart">
              <h4>Wat eruit komt</h4>
              <ul>
                <li><strong>Bundelen:</strong> meerdere pagina&rsquo;s over hetzelfde, geen enkele in de top 10.</li>
                <li><strong>Oppakken:</strong> scoort nergens op, maar de zoekterm is wél wat waard.</li>
                <li><strong>Ontbreekt:</strong> zoektermen zonder pagina. Dit deel gaat over groeien.</li>
                <li><strong>Werklijst:</strong> per pagina waar hij heen gaat en waarom.</li>
              </ul>
            </div>
            <div className="opr-intro-kaart">
              <h4>En daarna</h4>
              <p>
                Van elke doorgevoerde omleiding wordt na 30 en 90 dagen gemeten of de overgebleven pagina er echt
                sterker van is geworden.
              </p>
              <p>
                Onderaan staat hoe de site eruitziet als alles is doorgevoerd: netjes gegroepeerd per onderwerp. Dat is
                het blok dat je aan een klant laat zien.
              </p>
            </div>
          </div>
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
            <div className="ck-updated" style={{ marginBottom: 10 }}>
              {lijstDatum ? `Deze lijst is van ${new Date(lijstDatum).toLocaleString("nl-NL")}` : "Deze lijst heeft geen datum"}
              {running ? " · de nieuwe analyse draait nog, dit is nog de vorige" : ""}
            </div>

            {/* Eerst de gemiste kansen, dan pas het opruimwerk: daar zit de grootste
                opbrengst, en het is ook het besluit dat het meeste nadenken vraagt. */}
            {(result.onderwerpen?.length || 0) > 0 && (
              <Sectie titel="Onderwerpen bundelen" aantal={result.onderwerpen?.length}
                wat="Drie of meer pagina's over hetzelfde, en geen van alle in de top 10. Eén ervan wordt de vaste pagina, de rest gaat daarin op.">
                <OpruimOnderwerpen slug={slug} domain={domain} rijen={result.onderwerpen || []} clientName={clientName} clientEmail={clientEmail} />
              </Sectie>
            )}

            {(result.oppakken?.length || 0) > 0 && (
              <Sectie titel="Oppakken, niet weghalen" aantal={result.oppakken?.length}
                wat="Deze pagina's scoren nergens op, maar hun eigen zoekterm heeft wél volume en niemand anders bezit hem. Opruimen zou hier een kans weggooien.">
                <OpruimOppakken slug={slug} domain={domain} rijen={result.oppakken || []} clientName={clientName} clientEmail={clientEmail} />
              </Sectie>
            )}

            {(result.gaten?.length || 0) > 0 && (
              <Sectie titel="Wat er ontbreekt" aantal={result.gaten?.length}
                wat="Zoektermen met volume waar geen enkele pagina op mikt. Het enige deel dat over groeien gaat in plaats van over opruimen.">
                <OpruimGaten slug={slug} domain={domain} rijen={result.gaten || []} clientName={clientName} clientEmail={clientEmail} />
              </Sectie>
            )}

            {result.redirectMap && result.redirectMap.length > 0 && (
              <Sectie titel="Werklijst: wat waar naartoe" aantal={regels}
                wat="Per pagina waar hij heen gaat en waarom. Klap een regel open voor het bewijs uit de cijfers.">
                <div className="opr-kaart-acties" style={{ marginBottom: "var(--s-3)" }}>
                  {/* Downloaden als CSV: opent met een dubbelklik in Excel en is te
                      importeren in Google Sheets. */}
                  <a className="ghost-btn small" href={`/api/admin/opruim-export?slug=${encodeURIComponent(slug)}`}
                     title="Downloadt de volledige lijst als CSV. Dubbelklikken opent hem in Excel; in Google Sheets via Bestand, Importeren.">
                    Download voor Excel of Sheets
                  </a>
                </div>
                <OpruimTabel slug={slug} domain={domain} rijen={result.redirectMap} openTarget={openTarget} bewijs={bewijsPerPad} />
              </Sectie>
            )}

            {/* Het sluitstuk: niet het werk, maar het resultaat. Standaard open, want
                dit is het enige blok dat laat zien waar je het allemaal voor doet. */}
            <Sectie titel="Zo ziet de site eruit na het doorvoeren" open
              wat="Alle beslissingen hierboven bij elkaar, als boom: per tak de hoofdpagina met de pagina's die daaronder horen.">
              <OpruimEindstructuur slug={slug} domain={domain} />
            </Sectie>

            {metingen.length > 0 && (
              <Sectie titel="Klopte het?" aantal={metingen.length}
                wat="Van elke doorgevoerde omleiding: hoe stond de overgebleven pagina ervoor, en hoe staat hij er 30 en 90 dagen later voor.">
                <OpruimNameten rijen={metingen} tekst={metingenTekst} domain={domain} />
              </Sectie>
            )}

            {/* ── Wat er daarna nog moet gebeuren: de interne links ── */}
            {result.interneLinks && result.interneLinks.length > 0 && (
              <Sectie titel="Daarna: interne links leggen" aantal={result.interneLinks.length}
                wat="Omleiden lost de strijd op; deze links maken de overgebleven pagina daarna ook sterker. Een aanvulling, geen volledige linkaudit.">
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
              </Sectie>
            )}

            {/* ── Wat we bewust laten staan ── */}
            {blijftStaan.length > 0 && (
              <Sectie titel="Wat we bewust laten staan" aantal={blijftStaan.length}
                wat="Deze pagina's kwamen in de analyse langs en blijven: ze winnen op hun eigen onderwerp, of andere pagina's gaan er juist in op.">
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
              </Sectie>
            )}

            <Sectie titel="Structuur van de site nu"
              wat="Welke soorten pagina's er bestaan, en hoeveel URL-vormen er naast elkaar leven voor hetzelfde onderwerp.">
              <OpruimStructuur slug={slug} />
            </Sectie>

            {dk && (
              <Sectie titel="Waarop deze analyse is gebaseerd"
                wat="Welke bronnen zijn gebruikt, en wat er bewust niet in zit.">
                <div className="opr-kaart-tekst">
                  <p>De conclusies hierboven komen uit de eigen cijfers van de website, niet uit een aanname. Gebruikt zijn:</p>
                  <ul>
                    <li><strong>Search Console:</strong> op welk zoekwoord welke pagina wordt getoond, hoe vaak, en op welke plek. {dk.gsc ? "Beschikbaar." : "Niet beschikbaar."}</li>
                    <li><strong>Het verloop door de tijd:</strong> of Google tussen twee pagina&rsquo;s wisselt op hetzelfde zoekwoord. {dk.gscTijdreeks ? "Beschikbaar." : "Niet beschikbaar."}</li>
                    <li><strong>Ahrefs:</strong> het zoekvolume per zoekwoord en de posities per pagina. {dk.ahrefsZoekwoorden ? "Beschikbaar." : "Niet beschikbaar."}</li>
                    <li><strong>Verwijzende websites:</strong> hoeveel andere sites naar een pagina linken, als maat voor hoe sterk hij staat. {dk.ahrefsBacklinks ? "Beschikbaar." : "Niet beschikbaar."}</li>
                  </ul>
                  {!dk.crawl && (
                    <p>
                      <strong>Wat er niet in zit:</strong> een technische scan van de website zelf. Voor de keuzes hierboven is
                      dat niet nodig; het betekent alleen dat we na het doorvoeren van de omleidingen nog één keer nameten of
                      ze allemaal in één stap aankomen.
                    </p>
                  )}
                </div>
              </Sectie>
            )}

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

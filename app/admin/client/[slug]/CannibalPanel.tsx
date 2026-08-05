"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { linkifyHtml } from "../../../../lib/linkify";
import OpruimTabel from "./OpruimTabel";
import OpruimStructuur from "./OpruimStructuur";
import OpruimOppakken, { type Oppakker } from "./OpruimOppakken";

type ClusterUrl = { url: string; rol?: string; positie?: number; klikken?: number; impressies?: number; verwijzendeDomeinen?: number; intentie?: string };
type Signalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
type Cluster = { keyword: string; volume?: number; score?: string; signalen?: Signalen; intentie?: string; urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string };
type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
type Result = { oppakken?: Oppakker[]; samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: Cluster[]; redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null };
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
  const [weegBezig, setWeegBezig] = useState(false);
  const [weegMsg, setWeegMsg] = useState("");

  async function weegOpnieuw() {
    if (weegBezig) return;
    setWeegBezig(true); setWeegMsg("");
    try {
      const d = await fetch("/api/admin/opruim-waarde", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }),
      }).then((r) => r.json());
      if (!d.ok) { setWeegMsg(d.error || "Controle mislukt."); return; }
      setWeegMsg(d.gered
        ? `${d.gered} ${d.gered === 1 ? "pagina" : "pagina's"} van de opruimlijst gehaald: hun eigen zoekterm heeft volume. Ze staan nu onder "Oppakken".`
        : "Geen pagina's op de opruimlijst met een waardevolle eigen zoekterm; de lijst blijft zoals hij was.");
      await load();
    } catch { setWeegMsg("Controle mislukt."); }
    finally { setWeegBezig(false); }
  }

  async function load() {
    try {
      const d = await fetch(`/api/admin/cannibal-redirect?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt, stap: d.stap, stappen: d.stappen, stapLabel: d.stapLabel, cronTik: d.cronTik, cronStil: d.cronStil, kandidaten: d.kandidaten, beoordeeld: d.beoordeeld });
    } catch { /* stil */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

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
        <div className="opr-uitleg-blok">
          <p>
            Deze pagina zoekt uit welke pagina&rsquo;s van de site elkaar in de weg zitten of niets opleveren,
            en wat er per pagina moet gebeuren. Dat gebeurt langs twee wegen.
          </p>
          <ul>
            <li>
              <strong>Pagina&rsquo;s die om hetzelfde zoekwoord vechten.</strong> Search Console laat zien welke pagina in de
              loop van de tijd bovenkomt op een zoekwoord. Wisselt dat steeds tussen twee pagina&rsquo;s van deze site, dan
              twijfelt Google en verliezen ze allebei.
            </li>
            <li>
              <strong>Pagina&rsquo;s die op geen enkel eigen zoekwoord ranken.</strong> Alles wat ze binnenhalen lenen ze van
              de merknaam of van een grote stad. Ze concurreren met niemand, maar ze versnipperen wel de autoriteit van
              de site.
            </li>
          </ul>
          <p>
            Alles komt samen in <strong>&eacute;&eacute;n werklijst</strong> hieronder: per pagina waar hij heen gaat en
            waarom. Klap een regel open en je ziet het bewijs erbij. De analyse draait op de achtergrond; je kunt
            wegklikken.
          </p>
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

        {err && <div className="login-error" style={{ marginBottom: 8 }}>{err}</div>}
        {state?.status === "error" && state.error && <div className="login-error" style={{ marginBottom: 8 }}>{state.error}</div>}
        {/* Voortgang, want een spinner zonder stand is niet te onderscheiden van
            vastgelopen. Precies dat gebeurde op 03-08-2026: de run was al dood en
            het scherm bleef "draait…" tonen. */}
        {running && (
          <div className="opr-voortgang">
            <span className="opr-voortgang-stap">Stap {state?.stap || 1} van {stappen}</span>
            <span className="opr-voortgang-label">{state?.stapLabel || "De analyse wordt gestart"}</span>
            {regels > 0 && <span className="opr-voortgang-tel">{regels} regels tot nu toe</span>}
            {(state?.kandidaten || 0) > 0 && <span className="opr-voortgang-tel">{state?.beoordeeld || 0} van {state?.kandidaten} kandidaten nagelopen</span>}
            <button type="button" className="ghost-btn small" onClick={hervat} disabled={busy} title="Draait de eerstvolgende stap meteen, zonder de analyse opnieuw te beginnen.">Nu hervatten</button>
            <span className="opr-voortgang-tijd">
              De hele analyse duurt een kwartier tot twintig minuten. Je kunt wegklikken; hij loopt door.
              {" "}{state?.cronStil
                ? "Let op: het vangnet dat vastgelopen analyses oppakt, draait nu niet. Blijft de stap hangen, klik dan op Nu hervatten."
                : `Vangnet draaide voor het laatst om ${new Date(state?.cronTik as string).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}.`}
            </span>
          </div>
        )}
        {!result && !running && state?.status !== "error" && <div className="muted">Nog geen analyse. Klik &ldquo;Analyse draaien&rdquo;.</div>}

        {result && (
          <>
            <div className="ck-updated" style={{ marginBottom: 10 }}>
              {lijstDatum ? `Deze lijst is van ${new Date(lijstDatum).toLocaleString("nl-NL")}` : "Deze lijst heeft geen datum"}
              {running ? " · de nieuwe analyse draait nog, dit is nog de vorige" : ""}
            </div>

            {dk && (
              <div className="cannibal-dk">
                <span className={"cannibal-dk-pill " + (dk.gsc ? "on" : "off")}>Search Console {dk.gsc ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.gscTijdreeks ? "on" : "off")}>Flip-tijdreeks {dk.gscTijdreeks ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.ahrefsZoekwoorden ? "on" : "off")}>Ahrefs per pagina {dk.ahrefsZoekwoorden ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.ahrefsBacklinks ? "on" : "off")}>Verwijzende domeinen {dk.ahrefsBacklinks ? "✓" : "✗"}</span>
                <span className={"cannibal-dk-pill " + (dk.crawl ? "on" : "off")}>Crawl {dk.crawl ? "✓" : "✗"}</span>
                {dk.opmerking && <div className="muted" style={{ fontSize: 12, marginTop: 6, width: "100%" }}>{dk.opmerking}</div>}
              </div>
            )}

            <div className="opr-vorm">
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

            <OpruimOppakken slug={slug} domain={domain} rijen={result.oppakken || []} clientName={clientName} clientEmail={clientEmail} />

            {/* De werklijst eerst. Het verhaal eronder: een lijst is om af te werken,
                proza is om te begrijpen, en in die volgorde. */}
            {result.redirectMap && result.redirectMap.length > 0 && (
              <div className="opr-blok">
                <div className="opr-kop-rij">
                <div className="opr-kop">Werklijst: wat waar naartoe</div>
                {/* Downloaden als CSV: opent met een dubbelklik in Excel en is te
                    importeren in Google Sheets. Platte rijen met duidelijke
                    van/naar-kolommen, zoals Maartens eigen Excel. */}
                <a className="ghost-btn small" href={`/api/admin/opruim-export?slug=${encodeURIComponent(slug)}`}
                   title="Downloadt de volledige lijst als CSV. Dubbelklikken opent hem in Excel; in Google Sheets via Bestand, Importeren.">
                  Download voor Excel of Sheets
                </a>
                {/* De rem ook over een lijst die er al ligt, zonder een nieuwe
                    analyse van twintig minuten. */}
                <button type="button" className="ghost-btn small" onClick={() => void weegOpnieuw()} disabled={weegBezig}
                  title="Kijkt per pagina op deze lijst of zijn eigen zoekterm zoekvolume heeft. Zo ja, dan gaat hij eraf en komt hij bij Oppakken te staan.">
                  {weegBezig ? "Bezig met controleren…" : "Controleer op waardevolle pagina's"}
                </button>
              </div>
                {weegMsg && <div className="opr-melding">{weegMsg}</div>}
                <OpruimTabel slug={slug} domain={domain} rijen={result.redirectMap} openTarget={openTarget} bewijs={bewijsPerPad} />
              </div>
            )}

            {/* ── Wat er daarna nog moet gebeuren: de interne links ──
                Deze komen uit de cannibalisatie-analyse: links vanaf inhoudelijk
                verwante pagina's naar de winnaar van een cluster, zodat Google zijn
                keuze niet meer hoeft te maken. Het is geen volledige linkaudit. */}
            {result.interneLinks && result.interneLinks.length > 0 && (
              <div className="opr-blok">
                <div className="opr-kop">Daarna: interne links leggen ({result.interneLinks.length})</div>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 10px", maxWidth: "70ch" }}>
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
              <div className="opr-blok">
                <div className="opr-kop">Wat we bewust laten staan ({blijftStaan.length})</div>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 10px", maxWidth: "70ch" }}>
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

            {result.samenvatting && (
              <details className="opr-details">
                <summary>Samenvatting van de analyse</summary>
                <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: linkifyHtml(mdToHtml(alsBullets(result.samenvatting)), domain) }} />
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

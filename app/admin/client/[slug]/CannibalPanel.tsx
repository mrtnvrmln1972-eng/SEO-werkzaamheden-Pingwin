"use client";

import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { linkifyHtml } from "../../../../lib/linkify";
import OpruimTabel from "./OpruimTabel";
import OpruimStructuur from "./OpruimStructuur";

type ClusterUrl = { url: string; rol?: string; positie?: number; klikken?: number; impressies?: number; verwijzendeDomeinen?: number; intentie?: string };
type Signalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
type Cluster = { keyword: string; volume?: number; score?: string; signalen?: Signalen; intentie?: string; urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string };
type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
type Result = { samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: Cluster[]; redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null };
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

export default function CannibalPanel({ slug, domain = "", openTarget }: {
  slug: string; domain?: string;
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
      .then((d) => { if (d.ok) { setVorm(d.vorm || ""); setVormOpgeslagen(d.vorm || ""); } })
      .catch(() => { /* stil */ });
  }, [slug]);

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
          <button type="button" className={"pcd-btn pcd-btn-primary" + (running ? " busy" : "")} onClick={run} disabled={busy || running}>
            {running ? "Analyse draait…" : result ? "Opnieuw analyseren" : "Analyse draaien"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "2px 0 12px" }}>
          Draait de agentic skill <em>keyword-cannibalisatie-analyse</em> (dezelfde methodiek als in Cowork): onderscheidt echte cannibalisatie van false positives via URL-flip-detectie over tijd, positie-plafond, klik-verdeling en intentie-check, en geeft per cluster een winnaar met de lichtste effectieve actie. Je kunt wegklikken; het draait op de achtergrond.
        </p>
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
              </div>
                <OpruimTabel slug={slug} domain={domain} rijen={result.redirectMap} openTarget={openTarget} />
              </div>
            )}

            {result.samenvatting && (
              <details className="opr-details">
                <summary>Samenvatting en onderbouwing per cluster</summary>
                <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: mdToHtml(result.samenvatting) }} />
              </details>
            )}

            {/* Alle onderbouwing bij elkaar en dichtgeklapt. Stond eerst als zeven
                lappen proza vóór de tabel; dat is om te begrijpen, niet om af te
                werken. Openklappen kan altijd, het gaat nergens heen. */}
            <details className="opr-details">
              <summary>Onderbouwing per cluster ({result.clusters.length}) en interne-link-acties</summary>
              <div className="opr-details-body">
            {result.clusters.length === 0 && <div className="muted" style={{ marginTop: 8 }}>Geen echte cannibalisatie-clusters gevonden.</div>}

            {result.clusters.map((c, i) => {
              const sig = c.signalen || {};
              return (
                <div className="cannibal-cluster" key={i}>
                  <div className="cannibal-cluster-head">
                    <strong>{c.keyword}</strong>
                    {c.volume != null && <span className="muted">vol {c.volume}</span>}
                    {c.score && <span className={"cannibal-score " + scoreClass(c.score)}>{c.score}</span>}
                    {c.intentie && <span className="cannibal-ptype">intentie: {c.intentie}</span>}
                  </div>
                  <div className="cannibal-signals">
                    {sig.urlFlip && <span className="cannibal-sig flip">URL-flip{sig.flipsIn90d ? ` ×${sig.flipsIn90d}` : ""}</span>}
                    {sig.positiePlafond && <span className="cannibal-sig">positie-plafond 5-20</span>}
                    {sig.klikVerdeling && <span className="cannibal-sig">klikken verdeeld</span>}
                    <span className="muted" style={{ fontSize: 12 }}>winnaar: <strong>{c.winnaar}</strong></span>
                    <span className={"cannibal-act " + actionClass(c.actie)}>{c.actie}</span>
                  </div>
                  <div className="res-table-wrap">
                    <table className="res-table">
                      <thead><tr><th>Pagina</th><th>Wat gebeurt ermee</th><th>Positie</th><th>Clicks</th><th>Vert.</th></tr></thead>
                      <tbody>
                        {c.urls.map((u, j) => {
                          const uit = uitkomstVoor(u.url, c.winnaar, result.redirectMap || []);
                          return (
                            <tr key={j} className={"cannibal-row " + (u.url === c.winnaar ? "redir" : "")}>
                              <td><a href={u.url} target="_blank" rel="noreferrer">{padVanUrl(u.url)}</a></td>
                              <td>
                                <span className={"opr-chip " + uit.cls}>{uit.tekst}</span>
                                {uit.doel && <> <a href={uit.doel.startsWith("http") ? uit.doel : `https://${(domain || "").replace(/^https?:\/\//, "")}${uit.doel}`} target="_blank" rel="noreferrer">{padVanUrl(uit.doel)}</a></>}
                              </td>
                              <td>{num(u.positie)}</td>
                              <td>{u.klikken != null ? u.klikken : "—"}</td>
                              <td>{u.impressies != null ? u.impressies : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {c.onderbouwing && (
                    <div className="cannibal-reason">
                      <strong>Onderbouwing</strong>
                      {/* Was één lap platte tekst met kale paden erin. Nu gerenderd met
                          bullets en elke slug klikbaar, zoals overal in het dashboard. */}
                      <div className="md" dangerouslySetInnerHTML={{ __html: linkifyHtml(mdToHtml(alsBullets(c.onderbouwing)), domain) }} />
                    </div>
                  )}
                  {c.verwachteImpact && (
                    <div className="cannibal-reason muted">
                      <strong>Verwachte impact</strong>
                      <div className="md" dangerouslySetInnerHTML={{ __html: linkifyHtml(mdToHtml(c.verwachteImpact), domain) }} />
                    </div>
                  )}
                </div>
              );
            })}

            {result.interneLinks && result.interneLinks.length > 0 && (
              <div className="cannibal-tech">
                <div className="pcd-docs-head">Interne-link-acties</div>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Vanaf</th><th>Naar</th><th>Ankertekst</th><th>Reden</th></tr></thead>
                    <tbody>
                      {result.interneLinks.map((l, i) => (
                        <tr key={i}>
                          <td>{l.vanaf}</td>
                          <td>{l.naar}</td>
                          <td>{l.ankertekst || "—"}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{l.reden || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

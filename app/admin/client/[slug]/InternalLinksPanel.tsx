"use client";

// Het scherm Interne links. Alles wat je hier ziet komt uit de gedeelde
// bouwstenen in app/_ui/Uitkomst.tsx; dit bestand bepaalt wélke informatie er
// staat, niet hoe die eruitziet. Daarom staat er geen enkele afstand, kleur of
// lettergrootte in, en bewaakt proeven/opmaak.proef.ts dat het zo blijft.

import { useEffect, useRef, useState } from "react";
import { urlKey } from "../../../../lib/url-key";
import { Paneel, Blok, Tekst, Signalen, Chip, Chips, Pad, Tabel, Leeg } from "../../../_ui/Uitkomst";

type SuggestedLink = { bronUrl: string; relevantie?: number; autoriteit?: string; verkeer?: number; linkbudget?: string; score?: string; passage?: string; nieuweZin?: boolean; ankertekst?: string; ankertype?: string; positie?: string; verwachteImpact?: string; urlRating?: number | null; urGemeten?: boolean; urDatum?: string };
type AnchorItem = { anker: string; type?: string; aantal?: number; status?: string };
type TargetPage = { url: string; laag?: string; cluster?: string; primairZoekwoord?: string; huidigePositie?: number; doel?: string; baselineInterneLinks?: number; score?: string; voorgesteldeLinks: SuggestedLink[]; ankerprofiel?: AnchorItem[]; gaten?: string[]; waarschuwingen?: string[] };
type Structure = { wezen?: string[]; pillarGaten?: string[]; clusterNotities?: string };
type Datakwaliteit = { crawl?: boolean; gsc?: boolean; ahrefsUrlRating?: boolean; contentMapping?: boolean; opmerking?: string; urDatum?: string; urGemeten?: number };
type Result = { samenvatting: string; datakwaliteit?: Datakwaliteit; doelpaginas: TargetPage[]; structuur?: Structure; generatedAt: string | null };
type Suggestion = { url: string; positie: number; primairZoekwoord: string; impressies: number; extraBezoekers?: number; doelPositie?: number; reden?: string };
type State = { status: string; result: Result | null; targets: string[]; error: string; updatedAt: string | null };

function toon(s?: string): "goed" | "accent" | "neutraal" {
  const v = (s || "").toLowerCase();
  if (v.includes("hoog")) return "goed";
  if (v.includes("midden")) return "accent";
  return "neutraal";
}
function getal(n?: number): string { return n != null && Number.isFinite(n) ? String(Math.round(n * 10) / 10).replace(".", ",") : "—"; }
function dag(iso?: string): string { return iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : ""; }

// Vast herkenningspunt per doelpagina, zodat een ander scherm hierheen kan scrollen.
const ilBlokId = (url: string) => "ilrow-" + (url || "").replace(/[^a-zA-Z0-9]/g, "-");

export default function InternalLinksPanel({ slug, domein, openTarget }: {
  slug: string;
  domein?: string;
  /** Van buiten meteen op het blok van één doelpagina landen. */
  openTarget?: { url: string; n: number } | null;
}) {
  const [state, setState] = useState<State | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [loadingSug, setLoadingSug] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [kiezen, setKiezen] = useState(false);

  const openHandledRef = useRef(0);
  useEffect(() => {
    const doelen = state?.result?.doelpaginas;
    if (!openTarget || !doelen?.length) return;
    if (openHandledRef.current === openTarget.n) return;
    openHandledRef.current = openTarget.n;
    const doel = urlKey(openTarget.url);
    const match = doelen.find((t) => urlKey(t.url) === doel);
    if (!match) return;
    setTimeout(() => {
      document.getElementById(ilBlokId(match.url))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [openTarget, state]);

  async function load() {
    try {
      const d = await fetch(`/api/admin/internal-links?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, targets: d.targets || [], error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  async function loadSuggestions() {
    setLoadingSug(true);
    try {
      const d = await fetch(`/api/admin/internal-links?slug=${encodeURIComponent(slug)}&suggest=1`).then((r) => r.json());
      if (d.ok) setSuggestions(d.suggestions || []);
    } catch { /* stil */ } finally { setLoadingSug(false); }
  }
  useEffect(() => { load(); loadSuggestions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  useEffect(() => {
    const map = new Map<string, Suggestion>();
    for (const s of suggestions) map.set(s.url, s);
    for (const t of state?.targets || []) if (!map.has(t)) map.set(t, { url: t, positie: 0, primairZoekwoord: "", impressies: 0 });
    setRows([...map.values()]);
    if (selected.size === 0) {
      const init = new Set<string>(suggestions.slice(0, 5).map((s) => s.url));
      for (const t of state?.targets || []) init.add(t);
      setSelected(init);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [suggestions, state?.targets]);

  useEffect(() => {
    if (state?.status !== "running") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [state?.status, slug]);

  function toggle(url: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(url)) n.delete(url); else n.add(url); return n; });
  }
  function addCustom() {
    let u = custom.trim(); if (!u) return;
    try { if (/^https?:\/\//i.test(u)) u = new URL(u).pathname; } catch { /* laat staan */ }
    if (!u.startsWith("/")) u = "/" + u;
    if (u.length > 1) u = u.replace(/\/+$/, "");
    setRows((prev) => prev.some((r) => r.url === u) ? prev : [...prev, { url: u, positie: 0, primairZoekwoord: "", impressies: 0 }]);
    setSelected((prev) => new Set(prev).add(u));
    setCustom("");
  }

  async function run(doelen?: string[]) {
    const targets = doelen ?? [...selected];
    if (busy || state?.status === "running") return;
    if (!targets.length) { setErr("Kies minstens één pagina om te versterken."); return; }
    setBusy(true); setErr("");
    try {
      const d = await fetch("/api/admin/internal-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, targets }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); return; }
      setKiezen(false);
      await load();
    } catch { setErr("Starten mislukt."); } finally { setBusy(false); }
  }

  const draait = state?.status === "running";
  const result = state?.result;
  const dk = result?.datakwaliteit;
  const toonKiezer = !draait && (kiezen || !result);
  const totaalWinst = rows.filter((r) => selected.has(r.url)).reduce((n, r) => n + (r.extraBezoekers || 0), 0);

  return (
    <Paneel
      titel="Interne links"
      uitleg="Zoekt per pagina die je wilt versterken de beste plekken op je eigen site om vandaan te linken: sterke pagina's die er inhoudelijk bij passen, met een ankertekst die past en zonder je linkprofiel te over-optimaliseren."
      knoppen={
        result && !draait && !kiezen ? (
          <>
            <button type="button" className="btn btn-primary" onClick={() => run(state?.targets || [])} disabled={busy}>
              {busy ? "Starten…" : "Opnieuw draaien"}
            </button>
            <button type="button" className="btn" onClick={() => setKiezen(true)}>Andere pagina&rsquo;s kiezen</button>
          </>
        ) : null
      }
    >
      {err && <Signalen regels={[err]} />}
      {state?.status === "error" && state.error && <Signalen regels={[state.error]} />}

      {toonKiezer && (
        <Blok titel="Welke pagina's wil je versterken?" meta={
          selected.size > 0 && totaalWinst > 0
            ? <Chip toon="goed">samen ongeveer {totaalWinst} extra bezoekers per maand</Chip>
            : undefined
        }>
          <Tekst klein>
            {"Dit zijn de pagina's die het meest te winnen hebben: ze staan al in de buurt van de top, maar net niet hoog genoeg. Het aantal bezoekers is een schatting op basis van hoe vaak ze nu in Google verschijnen en hoe vaak er op die plek geklikt wordt."}
          </Tekst>

          {loadingSug && <Leeg>Kansen ophalen uit Search Console…</Leeg>}
          {!loadingSug && rows.length === 0 && (
            <Leeg>Geen kansen gevonden. Dat kan kloppen als deze klant nog weinig posities heeft, of als Search Console nog niet gekoppeld is. Voeg hieronder zelf een pagina toe.</Leeg>
          )}

          {rows.length > 0 && (
            <Tabel kolommen={["", "Pagina", "Staat nu", "Kan opleveren", "Waarom deze"]}>
              {rows.map((r) => (
                <tr key={r.url} className={selected.has(r.url) ? "uk-rij-aan" : ""}>
                  <td><input type="checkbox" checked={selected.has(r.url)} onChange={() => toggle(r.url)} aria-label={`${r.url} meenemen`} /></td>
                  <td><Pad pad={r.url} domein={domein} />{r.primairZoekwoord ? <div className="uk-tekst klein">{r.primairZoekwoord}</div> : null}</td>
                  <td>{r.positie ? <Chip toon="neutraal">plek {getal(r.positie)}</Chip> : <Chip toon="uit">zelf toegevoegd</Chip>}</td>
                  <td>{r.extraBezoekers ? <Chip toon="goed">+{r.extraBezoekers} per maand</Chip> : <Chip toon="uit">niet geschat</Chip>}</td>
                  <td>{r.reden || ""}</td>
                </tr>
              ))}
            </Tabel>
          )}

          <div className="uk-knoppen uk-knoppen-onder">
            <input
              className="uk-invoer" type="text" value={custom} placeholder="Of typ zelf een pagina, bijvoorbeeld /hovenier-oss"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            />
            <button type="button" className="btn" onClick={addCustom}>Toevoegen</button>
          </div>
          <div className="uk-knoppen uk-knoppen-onder">
            <button type="button" className="btn btn-primary" onClick={() => run()} disabled={busy}>
              {busy ? "Starten…" : `Analyse draaien voor ${selected.size} pagina${selected.size === 1 ? "" : "'s"}`}
            </button>
            {result && <button type="button" className="btn" onClick={() => setKiezen(false)}>Annuleren</button>}
          </div>
        </Blok>
      )}

      {draait && <Leeg>De analyse draait op de achtergrond. Hij crawlt de site en denkt daarna per pagina na, dus dit duurt een paar minuten. Je kunt gerust wegklikken.</Leeg>}

      {result && !toonKiezer && (
        <>
          <Blok
            titel="Wat de analyse ziet"
            meta={
              <Chips>
                <Chip toon={dk?.crawl ? "goed" : "uit"}>Site gecrawld</Chip>
                <Chip toon={dk?.gsc ? "goed" : "uit"}>Search Console</Chip>
                <Chip toon={dk?.ahrefsUrlRating ? "goed" : "uit"} titel="De gemeten kracht van het linkprofiel per pagina">
                  {dk?.ahrefsUrlRating ? `Autoriteit per pagina · ${dk.urGemeten ?? 0} gemeten${dk.urDatum ? ` op ${dag(dk.urDatum)}` : ""}` : "Autoriteit per pagina nog niet gemeten"}
                </Chip>
                {state?.updatedAt && <Chip toon="neutraal">bijgewerkt {dag(state.updatedAt)}</Chip>}
              </Chips>
            }
          >
            <Tekst>{result.samenvatting}</Tekst>
            {dk?.opmerking && <Signalen regels={[dk.opmerking]} soort="notitie" domein={domein} />}
          </Blok>

          {result.doelpaginas.length === 0 && <Leeg>Er zijn geen link-adviezen uitgekomen. Draai de analyse opnieuw, of kies andere pagina&rsquo;s.</Leeg>}

          {result.doelpaginas.map((tp, i) => (
            <div key={i} id={ilBlokId(tp.url)}>
              <Blok
                titel={<Pad pad={tp.url} domein={domein} />}
                meta={
                  <Chips>
                    {tp.laag && <Chip toon="neutraal">{tp.laag}</Chip>}
                    {tp.huidigePositie != null && <Chip toon="accent">plek {getal(tp.huidigePositie)}{tp.doel ? ` → ${tp.doel}` : ""}</Chip>}
                    {tp.primairZoekwoord && <Chip toon="neutraal">{tp.primairZoekwoord}</Chip>}
                    {tp.baselineInterneLinks != null && <Chip toon="neutraal">{tp.baselineInterneLinks} interne links nu</Chip>}
                    {tp.score && <Chip toon={toon(tp.score)}>{tp.score}</Chip>}
                  </Chips>
                }
              >
                {tp.voorgesteldeLinks?.length > 0 && (
                  <Tabel kolommen={["Link vanaf", "Autoriteit", "Kans", "Ankertekst", "Waarom"]}>
                    {tp.voorgesteldeLinks.map((l, j) => (
                      <tr key={j}>
                        <td>
                          <Pad pad={l.bronUrl} domein={domein} />
                          {l.relevantie != null && <div className="uk-tekst klein">relevantie {l.relevantie} van 100</div>}
                        </td>
                        <td>
                          {l.urlRating != null ? (
                            <>
                              <Chip toon={l.urGemeten ? "accent" : "uit"}>{getal(l.urlRating)}</Chip>
                              <div className="uk-tekst klein">{l.urGemeten ? `gemeten ${dag(l.urDatum)}` : "geschat"}</div>
                            </>
                          ) : l.autoriteit ? <Chip toon="uit">{l.autoriteit}</Chip> : "—"}
                        </td>
                        <td><Chip toon={toon(l.score)}>{l.score || "—"}</Chip></td>
                        <td>
                          <strong>{l.ankertekst || "—"}</strong>
                          <div className="uk-tekst klein">{[l.ankertype, l.positie, l.nieuweZin ? "nieuwe zin" : ""].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td>{l.passage || l.verwachteImpact || ""}</td>
                      </tr>
                    ))}
                  </Tabel>
                )}

                {tp.ankerprofiel && tp.ankerprofiel.length > 0 && (
                  <>
                    <div className="uk-tekst klein uk-boven">Ankerteksten die nu al naar deze pagina wijzen, plus wat we voorstellen:</div>
                    <Chips>
                      {tp.ankerprofiel.map((a, k) => (
                        <Chip key={k} toon={a.status === "voorgesteld" ? "goed" : "neutraal"}>
                          {a.anker}{a.type ? ` · ${a.type}` : ""}{a.aantal ? ` ×${a.aantal}` : ""}
                        </Chip>
                      ))}
                    </Chips>
                  </>
                )}

                <Signalen regels={tp.gaten} domein={domein} />
                <Signalen regels={tp.waarschuwingen} soort="notitie" domein={domein} />
              </Blok>
            </div>
          ))}

          {result.structuur && (result.structuur.wezen?.length || result.structuur.pillarGaten?.length || result.structuur.clusterNotities) && (
            <Blok titel="Structuur van de site">
              <Tekst>{result.structuur.clusterNotities}</Tekst>
              <Signalen regels={result.structuur.pillarGaten} domein={domein} />
              {result.structuur.wezen && result.structuur.wezen.length > 0 && (
                <>
                  <div className="uk-tekst klein uk-boven">Pagina&rsquo;s waar geen enkele andere pagina naartoe linkt:</div>
                  <Chips>{result.structuur.wezen.map((w, k) => <Chip key={k} toon="let-op"><Pad pad={w} domein={domein} /></Chip>)}</Chips>
                </>
              )}
            </Blok>
          )}
        </>
      )}
    </Paneel>
  );
}

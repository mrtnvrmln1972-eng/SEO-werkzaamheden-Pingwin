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
type SortVeld = "extra" | "volume" | "positie";
const SORT_KOP: { veld: SortVeld; label: string }[] = [
  { veld: "volume", label: "Zoekvolume" },
  { veld: "positie", label: "Positie" },
  { veld: "extra", label: "Extra bezoekers" },
];

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

export default function PrioriteitenPanel({ slug, domain = "", onGaNaar }: {
  slug: string;
  domain?: string;
  /** Springt naar het juiste tabblad en opent daar meteen de betreffende regel. */
  onGaNaar?: (tab: string, url: string) => void;
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
  const [sortVeld, setSortVeld] = useState<SortVeld>("extra");
  const [sortAf, setSortAf] = useState(true);

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
        const toelichting = kaartTekst({
          achtergrond: [
            r.rationale,
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

  // Zeven dichte balken in plaats van honderd losse regels, en de balk met de
  // meeste te winnen bezoekers bovenaan. Bij de ene klant is dat meta-werk, bij de
  // andere opruimen; dat wil je zien zonder eerst alles open te klikken.
  const groepen = useMemo(() => {
    const richting = sortAf ? -1 : 1;
    const waarde = (r: Regel): number => {
      if (sortVeld === "volume") return r.maandvolume || 0;
      // Rankt hier nog niet (0) hoort achteraan, niet vooraan.
      if (sortVeld === "positie") return r.huidigePositie || 999;
      return r.extraKlikkenPerMaand ?? 0;
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
      }))
      .sort((a, b) => b.opbrengst - a.opbrengst || b.rijen.length - a.rijen.length || a.naam.localeCompare(b.naam));
  }, [zichtbaar, sortVeld, sortAf]);

  // Zoek je iets, dan klapt alles met een treffer vanzelf open; anders zou je na
  // het typen alsnog zeven balken moeten opentikken om te zien wat er gevonden is.
  const groepOpen = (naam: string) => zoekt || !!openGroep[naam];
  function sorteerOp(veld: SortVeld) {
    if (veld === sortVeld) setSortAf((v) => !v);
    else { setSortVeld(veld); setSortAf(true); }
  }

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

          {/* Scorecard: welke brillen keken mee, en welke nog niet. */}
          <button type="button" className="prio-klap" onClick={() => setOpenLenzen((v) => !v)}>
            {openLenzen ? "▾" : "▸"} Waar is naar gekeken ({res.lenzen.filter((l) => l.status !== "niet-aangesloten").length} van de {res.lenzen.length} brillen aangesloten)
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

          <div className="prio-tabel-wrap">
            <table className="prio-tabel">
              <thead>
                <tr>
                  <th>Wat</th><th>Pagina</th><th>Zoekwoord</th>
                  {SORT_KOP.map((k) => (
                    <th key={k.veld} className="num">
                      <button type="button" className={"prio-sorteer" + (sortVeld === k.veld ? " aan" : "")}
                        title={`Sorteer op ${k.label.toLowerCase()}`} onClick={() => sorteerOp(k.veld)}>
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
                        <td colSpan={8}>
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
                          <tr key={r.id} className={"prio-rij" + (gepland ? " prio-gepland" : "")}>
                            <td>
                              <div className="prio-titel">{r.titel}{r.nieuw && <span className="prio-nieuw">nieuw</span>}</div>
                              <div className="prio-reden">{r.rationale}</div>
                              <div className="prio-bron">Bron: {r.bron} · {zekerheid(r.confidence)}</div>
                            </td>
                            <td className="prio-url">{r.url ? <Pad pad={r.url} /> : <span className="muted">nieuwe pagina</span>}</td>
                            <td>{r.zoekwoord || "—"}</td>
                            <td className="num">{getal(r.maandvolume)}</td>
                            <td className="num">{r.huidigePositie ? `${r.huidigePositie} → ${r.targetPositie}` : `→ ${r.targetPositie}`}</td>
                            <td className="num prio-uplift">{getal(r.extraKlikkenPerMaand)}</td>
                            <td>{r.effort <= 3 ? "klein" : r.effort <= 6 ? "middel" : "groot"}</td>
                            <td className="prio-skill">
                              <button
                                type="button"
                                className="prio-cat"
                                disabled={bezigId === r.id}
                                title={cat.kaart
                                  ? `Zet dit in de planning van deze week en ga naar ${cat.naam.toLowerCase()}`
                                  : `Ga naar ${cat.naam.toLowerCase()} voor deze pagina`}
                                onClick={() => pakOp(r)}
                              >
                                {bezigId === r.id ? "Bezig…" : cat.kaart ? "In de planning" : "Ga erheen"}
                              </button>
                              {gepland && <span className="prio-gepland-chip" title="Er staat een kaart voor deze pagina in de planning">✓ in de planning</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {!groepen.length && (
                  <tr><td colSpan={8} className="muted prio-leeg">Niets gevonden met deze zoekterm.</td></tr>
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
    </div>
  );
}

"use client";

// Het scherm van de vindbaarheid-prioriteitenscan.
//
// Vorm bewust gelijk aan het opruimscherm: een knop, een voortgangsmelding, en
// daarna de uitkomst als platte, filterbare tabel. Geen model dat de lijst
// samenvat, want een lijst is een scherm en een oordeel is een gesprek.

import { useEffect, useState } from "react";

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
  propositie: { zin: string; voorstel: string };
};

const TIERS: { id: string; naam: string; uitleg: string }[] = [
  { id: "1", naam: "Deze week", uitleg: "Weinig werk, snel effect, en we weten het vrij zeker." },
  { id: "2", naam: "Deze maand", uitleg: "Iets meer werk, effect binnen een paar weken tot maanden." },
  { id: "3", naam: "Dit kwartaal", uitleg: "Grotere klussen die wel de moeite waard zijn." },
  { id: "4", naam: "Strategisch", uitleg: "Lange adem, maar met blijvend effect." },
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

export default function PrioriteitenPanel({ slug, domain = "" }: { slug: string; domain?: string }) {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [prop, setProp] = useState("");
  const [propMsg, setPropMsg] = useState("");
  const [tonen, setTonen] = useState<string>("alles");
  const [zoek, setZoek] = useState("");
  const [openSkip, setOpenSkip] = useState(false);
  const [openLenzen, setOpenLenzen] = useState(false);

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

  const res = st?.result || null;
  const regels = res?.regels || [];
  const zichtbaar = regels.filter((r) => {
    if (r.tier === "SKIP") return false;
    if (tonen !== "alles" && r.tier !== tonen) return false;
    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      if (!(`${r.titel} ${r.zoekwoord} ${r.url}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const skips = regels.filter((r) => r.tier === "SKIP");
  const propositieLeeg = !(st?.propositie?.zin || "").trim();

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
          <div className="prio-samenvatting">{res.samenvatting}</div>
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
            <button type="button" className={"chip" + (tonen === "alles" ? " chip-aan" : "")} onClick={() => setTonen("alles")}>
              Alles ({regels.filter((r) => r.tier !== "SKIP").length})
            </button>
            {TIERS.map((t) => {
              const n = regels.filter((r) => r.tier === t.id).length;
              return (
                <button key={t.id} type="button" title={t.uitleg}
                  className={"chip" + (tonen === t.id ? " chip-aan" : "")} onClick={() => setTonen(t.id)}>
                  {t.naam} ({n})
                </button>
              );
            })}
            <input className="prio-zoek" placeholder="Zoek op zoekwoord of pagina" value={zoek} onChange={(e) => setZoek(e.target.value)} />
          </div>

          <div className="prio-tabel-wrap">
            <table className="prio-tabel">
              <thead>
                <tr>
                  <th>Wanneer</th><th>Wat</th><th>Pagina</th><th>Zoekwoord</th>
                  <th className="num">Zoekvolume</th><th className="num">Positie</th>
                  <th className="num">Extra bezoekers</th><th>Werk</th><th>Wie doet het</th>
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((r) => (
                  <tr key={r.id} className={`prio-rij prio-tier-${r.tier}`}>
                    <td><span className={`prio-badge prio-badge-${r.tier}`}>{TIERS.find((t) => t.id === r.tier)?.naam || r.tier}</span>
                      {r.nieuw && <span className="prio-nieuw">nieuw</span>}</td>
                    <td>
                      <div className="prio-titel">{r.titel}</div>
                      <div className="prio-reden">{r.rationale}</div>
                      <div className="prio-bron">Bron: {r.bron} · {zekerheid(r.confidence)}</div>
                    </td>
                    <td className="prio-url">{r.url ? <Pad pad={r.url} /> : <span className="muted">nieuwe pagina</span>}</td>
                    <td>{r.zoekwoord || "—"}</td>
                    <td className="num">{getal(r.maandvolume)}</td>
                    <td className="num">{r.huidigePositie ? `${r.huidigePositie} → ${r.targetPositie}` : `→ ${r.targetPositie}`}</td>
                    <td className="num prio-uplift">{getal(r.extraKlikkenPerMaand)}</td>
                    <td>{r.effort <= 3 ? "klein" : r.effort <= 6 ? "middel" : "groot"}</td>
                    <td className="prio-skill">{r.vervolgSkill}</td>
                  </tr>
                ))}
                {!zichtbaar.length && (
                  <tr><td colSpan={9} className="muted prio-leeg">Niets gevonden met deze filters.</td></tr>
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

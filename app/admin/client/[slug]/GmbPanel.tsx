"use client";

import { useCallback, useEffect, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";
import { BRIL_LABEL, BRIL_UITLEG, STAND_LABEL, DREMPEL, beheerUitnodiging, type Bril, type Stand } from "../../../../lib/gmb-kennis";
import HelpHint from "./HelpHint";

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

const BRILLEN: Bril[] = ["compleet", "consistent", "reviews", "beeld", "activiteit", "concurrentie"];

function datum(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; }
}
function getal(n: number): string { return n.toLocaleString("nl-NL"); }
function sterrenTekst(n: number | null): string { return n == null ? "geen cijfer" : n.toFixed(1).replace(".", ","); }

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

  const load = useCallback(async () => {
    try {
      const d = await fetch(`/api/admin/gmb?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) setState({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt, koppelingen: d.koppelingen || {}, meetdeur: !!d.meetdeur });
    } catch { /* stil: wat er stond blijft staan */ }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

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
      if (!d.ok) setErr(d.error || "Starten is niet gelukt.");
      else await load();
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

  const r = state?.result || null;
  const draait = state?.status === "running";

  return (
    <div className="section">
      <div className="card">
        <span className="strategy-title">
          Google-bedrijfsprofiel
          <HelpHint xl title="Het Google-bedrijfsprofiel: de etalage op de kaart" text={"Het profiel dat naast de zoekresultaten en op Google Maps staat. Voor een lokaal bedrijf is dit vaak het eerste én het enige wat iemand ziet voordat hij belt of de route opvraagt.\n## Waarom dit een eigen scherm heeft\nHet profiel bepaalt of je in het **lokale blok** bovenaan de zoekresultaten komt (de drie bedrijven met de kaart erbij). Dat blok krijgt bij lokale zoekopdrachten meer aandacht dan de gewone resultaten eronder, en het wordt niet door je website gewonnen maar door je profiel.\n## Twee deuren, en het verschil is zichtbaar\n- **De meetdeur** werkt altijd en meet ook de **concurrenten**. Daar zit de waarde: 42 reviews zegt niets, 42 tegenover 180 is een gesprek.\n- **De beheerdeur** gaat alleen open voor profielen waar Pingwin beheerder van is én nadat Google ons project heeft goedgekeurd. Die levert de **bezoekcijfers** (hoe vaak gezien, gebeld, route gevraagd), de volledige reviewlijst met antwoorden, de posts en de vragen.\nWat niet gemeten kon worden staat er altijd bij, met de reden. Een lege uitslag mag nooit lezen als \"er is niets aan de hand\".\n## Wat er niet gebeurt\nHet dashboard wijzigt **niets** automatisch op het profiel. Het schrijft voor, jij keurt per stuk goed. Google kan een profiel schorsen bij vreemde wijzigingen, en dat is de etalage van de klant."} />
        </span>
        <p className="prio-intro">
          Hoe staat {clientName} ervoor op de kaart, per vestiging, en hoe verhoudt dat zich tot de concurrenten in de buurt.
        </p>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={start} disabled={busy || draait}>
            {draait ? "De scan draait…" : r ? "Opnieuw meten" : "Meet het profiel"}
          </button>
          {state?.updatedAt && !draait && (
            <span className="prio-meta" style={{ margin: 0 }}>Laatst gemeten op {datum(state.updatedAt)}</span>
          )}
        </div>

        {err && <p className="gmb-fout">{err}</p>}
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

            {uitnodigingOpen && (() => {
              const u = beheerUitnodiging(clientName, pingwinEmail || "het Pingwin-adres dat je hiervoor gebruikt");
              return (
                <div className="gmb-uitnodiging">
                  <span className="gmb-subkop">Uitnodiging, klaar om te versturen</span>
                  <p className="gmb-bril-uitleg">
                    Vaste tekst met het stappenplan erin, zodat de klant niet hoeft te zoeken. Pas gerust aan voordat je verstuurt.
                  </p>
                  <div className="mail-edit md" contentEditable suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: mdToHtml(u.tekst) }} />
                  {clientEmail && (
                    <a className="btn btn-primary" style={{ marginTop: "var(--s-3)", display: "inline-block" }}
                      href={`mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(u.onderwerp)}&body=${encodeURIComponent(u.tekst)}`}>
                      Open in de mail
                    </a>
                  )}
                </div>
              );
            })()}

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
                  <span className="gmb-kop-pijl">{uit ? "▾" : "▸"}</span>
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
                          ? <a className="gmb-link" href={loc.profiel.website} target="_blank" rel="noreferrer">{loc.profiel.website}</a>
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
                          <div className={"gmb-bevinding gmb-zwaarte-" + b.zwaarte} key={b.key}>
                            <div className="gmb-bevinding-kop">
                              <strong>{b.label}</strong>
                              <span className={"chip " + (b.hardheid === "gemeten" ? "gmb-hard" : "gmb-zacht")}>
                                {b.hardheid === "gemeten" ? "gemeten" : "richtinggevend"}
                              </span>
                            </div>
                            <p className="gmb-bewijs">{b.bewijs}</p>
                            <p className="gmb-waarom">{b.waarom}</p>
                            <p className="gmb-actie"><span>Wat je doet:</span> {b.actie}</p>
                          </div>
                        ))}
                      </div>
                    ))}

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
                <span className="gmb-kop-pijl">{suggestiesOpen ? "▾" : "▸"}</span>
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
                    <div className="gmb-suggestie" key={s.key}>
                      <div className="gmb-bevinding-kop">
                        <strong>{s.titel}</strong>
                        <span className="chip">{s.ritme}</span>
                      </div>
                      <p className="gmb-actie"><span>Wat je doet:</span> {s.wat}</p>
                      <p className="gmb-waarom">{s.waarom}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
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

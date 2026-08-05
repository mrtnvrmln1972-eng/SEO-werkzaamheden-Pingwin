"use client";

// De opruimlijst als werkbare tabel, niet als lap proza.
//
// Waarom dit bestaat: het oude scherm toonde eerst zeven clusters met per stuk
// een onderbouwing en een verwachte impact, en pas daaronder de redirecttabel.
// Prachtig om één cluster te begrijpen, onbruikbaar als je zeventig regels moet
// afwerken. Maarten kreeg in Cowork een spreadsheet en dat werkte honderd keer
// beter. Dus: de tabel bovenaan, het verhaal als uitklapper per rij.
//
// Elke keuze die je hier maakt (houden, ander doel, negeren, doorgevoerd) wordt
// opgeslagen als vaste regel en gaat mee naar de volgende analyse, zodat je een
// besluit nooit twee keer hoeft te nemen.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

export type RedirectRij = { van: string; naar: string; type?: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
// Het bewijs achter een regel: welk zoekwoord, wie wint, en de cijfers. Stond
// eerder als losse sectie onderaan de pagina, in een andere vorm dan de lijst.
// Daardoor kreeg je dezelfde beslissing twee keer in twee talen. Nu hangt het
// onder de regel waar het bij hoort, uit te klappen.
export type Bewijs = {
  keyword: string; winnaar: string;
  urls: { url: string; positie?: number; klikken?: number; impressies?: number }[];
  onderbouwing?: string; urlFlip?: boolean; flipsIn90d?: number;
};
type Regel = { van: string; besluit: "houden" | "redirect" | "genegeerd"; naar: string; notitie: string; doorgevoerd: boolean };

const pad = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

export default function OpruimTabel({ slug, domain, rijen, openTarget, bewijs = {} }: {
  slug: string; domain: string; rijen: RedirectRij[];
  /** Van buiten binnenkomen op één pagina: vult het filterveld met dat pad, zodat
      je alleen de regels ziet die daarover gaan. Hergebruikt het filter dat er al
      is; een aparte "spring hierheen"-machinerie zou hetzelfde nog eens doen. */
  openTarget?: { url: string; n: number } | null;
  /** Het bewijs per pagina, om onder de opengeklapte regel te tonen. */
  bewijs?: Record<string, Bewijs>;
}) {
  const [regels, setRegels] = useState<Record<string, Regel>>({});
  const [filter, setFilter] = useState("");
  const [toon, setToon] = useState<"open" | "alles" | "klaar">("open");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [melding, setMelding] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [push, setPush] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  // Binnenkomen vanuit de prioriteitenscan: filter meteen op dat pad, en toon ook
  // de al doorgevoerde regels, anders lijkt de lijst leeg als het net af is.
  const openHandledRef = useRef(0);
  useEffect(() => {
    if (!openTarget || openHandledRef.current === openTarget.n) return;
    openHandledRef.current = openTarget.n;
    setFilter(pad(openTarget.url));
    setToon("alles");
  }, [openTarget]);

  useEffect(() => {
    fetch(`/api/admin/opruim-regels?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setRegels(Object.fromEntries((d.regels as Regel[]).map((r) => [r.van, r]))); })
      .catch(() => {});
  }, [slug]);

  function bewaar(van: string, patch: Partial<Regel>) {
    const v = pad(van);
    const basis: Regel = { van: v, besluit: "redirect", naar: "", notitie: "", doorgevoerd: false };
    setRegels((m) => ({ ...m, [v]: { ...basis, ...m[v], ...patch, van: v } }));
    void fetch("/api/admin/opruim-regels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, van: v, ...patch }),
    }).then(() => setMelding("Opgeslagen; dit besluit gaat mee naar de volgende analyse.")).catch(() => setMelding("Opslaan mislukte."));
  }

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;

  const zichtbaar = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rijen.filter((r) => {
      const v = pad(r.van), n = pad(r.naar);
      const reg = regels[v];
      if (toon === "klaar" && !reg?.doorgevoerd) return false;
      if (toon === "open" && (reg?.doorgevoerd || reg?.besluit === "houden" || reg?.besluit === "genegeerd")) return false;
      if (!f) return true;
      return (v + " " + n + " " + (r.reden || "")).toLowerCase().includes(f);
    });
  }, [rijen, regels, filter, toon]);

  // Voor de gegroepeerde weergave: de rijen op volgorde van bestemming, grootste
  // groep eerst, zodat de plek waar het meeste in opgaat bovenaan staat.
  const gegroepeerd = useMemo(() => {
    const per = new Map<string, typeof zichtbaar>();
    for (const r of zichtbaar) {
      const d = regels[pad(r.van)]?.naar || pad(r.naar);
      if (!per.has(d)) per.set(d, []);
      per.get(d)!.push(r);
    }
    return [...per.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [zichtbaar, regels]);

  // Alles wat naar dezelfde pagina gaat bij elkaar: alles van Rotterdam onder de
  // Rotterdam-pagina. Zestig regels op volgorde van binnenkomst zegt niets; per
  // bestemming zie je meteen welke pagina de winnaar is en wat daar in opgaat.
  const [groepeer, setGroepeer] = useState(true);
  const doelen = useMemo(() => [...new Set(rijen.map((r) => pad(r.naar)))].sort(), [rijen]);
  const aantalKlaar = rijen.filter((r) => regels[pad(r.van)]?.doorgevoerd).length;

  const gekozen = zichtbaar.filter((r) => sel[pad(r.van)]).map((r) => ({ van: pad(r.van), naar: regels[pad(r.van)]?.naar || pad(r.naar) }));

  async function doorvoeren() {
    if (!gekozen.length || push) return;
    setPush(true); setPushMsg("");
    try {
      const d = await fetch("/api/admin/opruim-doorvoeren", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, rijen: gekozen }),
      }).then((r) => r.json());
      if (d?.gelukt) {
        setRegels((m) => {
          const n = { ...m };
          for (const g of gekozen) n[g.van] = { ...(n[g.van] || { van: g.van, besluit: "redirect", naar: g.naar, notitie: "" }), doorgevoerd: true } as Regel;
          return n;
        });
        setSel({});
      }
      const fout = (d?.mislukt || []) as { van: string; reden: string }[];
      setPushMsg(`${d?.gelukt || 0} van de ${gekozen.length} doorgevoerd en live nagemeten.` + (fout.length ? ` Niet gelukt: ${fout.slice(0, 3).map((f) => `${f.van} (${f.reden})`).join("; ")}${fout.length > 3 ? ` en nog ${fout.length - 3}` : ""}.` : "") + (d?.error ? ` ${d.error}` : ""));
    } catch { setPushMsg("Doorvoeren mislukte; probeer het opnieuw."); }
    finally { setPush(false); }
  }

  if (!rijen.length) return <div className="muted">Nog geen redirect-voorstellen in deze analyse.</div>;

  return (
    <div className="opr">
      <div className="opr-balk">
        <input className="opr-zoek" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter op pad of reden…" />
        <div className="opr-tabs">
          {(["open", "alles", "klaar"] as const).map((t) => (
            <button key={t} type="button" className={"opr-tab" + (toon === t ? " aan" : "")} onClick={() => setToon(t)}>
              {t === "open" ? "Nog te doen" : t === "alles" ? "Alles" : "Doorgevoerd"}
            </button>
          ))}
        </div>
        <button type="button" className={"opr-tab" + (groepeer ? " aan" : "")} onClick={() => setGroepeer(!groepeer)}
          title="Zet alles wat naar dezelfde pagina gaat bij elkaar, met die doelpagina als kop.">
          {groepeer ? "Gegroepeerd per doelpagina" : "Alles onder elkaar"}
        </button>
        <span className="opr-telling">{zichtbaar.length} van {rijen.length} regels{aantalKlaar ? `, ${aantalKlaar} doorgevoerd` : ""}</span>
      </div>

      <div className="opr-scroll">
        <table className="opr-tabel">
          <thead>
            <tr>
              <th className="opr-vink">Kies</th>
              <th className="opr-vink">Klaar</th>
              <th>Deze pagina (van)</th>
              <th>Gaat naar (doel)</th>
              <th>Content</th>
              <th>Besluit</th>
              <th>Waarom</th>
            </tr>
          </thead>
          <tbody>
            {(groepeer ? gegroepeerd : [["", zichtbaar] as const]).map(([doelKop, rijenIn], gi) => (
              <Fragment key={doelKop || gi}>
                {groepeer && (
                  <tr className="opr-groepkop">
                    <td colSpan={7}>
                      <span className="opr-groepkop-label">Gaat op in</span>
                      <a className="opr-pad opr-doel" href={site(doelKop)} target="_blank" rel="noreferrer">{doelKop}</a>
                      <span className="opr-groepkop-tel">{rijenIn.length} {rijenIn.length === 1 ? "pagina" : "pagina’s"}</span>
                    </td>
                  </tr>
                )}
                {rijenIn.map((r, i) => {
              const v = pad(r.van), n = pad(r.naar);
              const reg = regels[v];
              const doel = reg?.naar || n;
              const uit = reg?.besluit === "houden" || reg?.besluit === "genegeerd";
              return (
                <tr key={v + i} className={(reg?.doorgevoerd ? "klaar " : "") + (uit ? "uit" : "")}>
                  <td className="opr-vink">
                    <input type="checkbox" checked={!!sel[v]} disabled={!!reg?.doorgevoerd || uit} onChange={(e) => setSel((m) => ({ ...m, [v]: e.target.checked }))} title="Kies deze regel om door te voeren" />
                  </td>
                  <td className="opr-vink">
                    <input type="checkbox" checked={!!reg?.doorgevoerd} onChange={(e) => bewaar(v, { doorgevoerd: e.target.checked })} title="Deze redirect is doorgevoerd op de site" />
                  </td>
                  <td><a className="opr-pad" href={site(v)} target="_blank" rel="noreferrer">{v}</a></td>
                  <td>
                    <a className="opr-pad opr-doel" href={site(doel)} target="_blank" rel="noreferrer">{doel}</a>
                    <select className="opr-select" value={doel} onChange={(e) => bewaar(v, { naar: e.target.value, besluit: "redirect" })} title="Ander doel kiezen; die keuze onthoudt het dashboard">
                      {[...new Set([doel, ...doelen])].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td>
                    {r.verhuizen && <span className="opr-chip verhuis" title="De content gaat naar de nieuwe URL en de oude URL wijst daarheen. Hier moet dus eerst iets gebouwd worden.">verhuizen</span>}
                    {r.mergeContent && <span className="opr-chip merge">samenvoegen</span>}
                    {!r.verhuizen && !r.mergeContent && <span className="opr-leeg">&mdash;</span>}
                  </td>
                  <td>
                    <div className="opr-knoppen">
                      <button type="button" className={"opr-btn" + (reg?.besluit === "houden" ? " aan" : "")} onClick={() => bewaar(v, { besluit: reg?.besluit === "houden" ? "redirect" : "houden" })} title="Deze pagina blijft staan; de volgende analyse stelt hem nooit meer voor">Houden</button>
                      <button type="button" className={"opr-btn" + (reg?.besluit === "genegeerd" ? " aan" : "")} onClick={() => bewaar(v, { besluit: reg?.besluit === "genegeerd" ? "redirect" : "genegeerd" })} title="Niet meer tonen">Negeren</button>
                    </div>
                  </td>
                  <td className="opr-reden">
                    <button type="button" className="opr-meer" onClick={() => setOpen((o) => ({ ...o, [v]: !o[v] }))}>
                      {open[v] ? "▾" : "▸"} {open[v] ? "minder" : "reden"}
                    </button>
                    {open[v] && (
                      <div className="opr-uitleg">
                        <div>{r.reden || "Geen onderbouwing meegegeven."}</div>
                        {/* Het bewijs uit de cannibalisatie-analyse, als het er is:
                            welk zoekwoord, wie wint, en de cijfers per pagina. */}
                        {bewijs[v] && (
                          <div className="opr-bewijs">
                            <div className="opr-bewijs-kop">
                              Bewijs: op <strong>&ldquo;{bewijs[v].keyword}&rdquo;</strong> concurreren deze pagina&rsquo;s met elkaar
                              {bewijs[v].urlFlip ? `, en Google wisselde er ${bewijs[v].flipsIn90d || "meerdere"} keer tussen` : ""}.
                            </div>
                            <ul className="opr-bewijs-lijst">
                              {bewijs[v].urls.map((u, k) => (
                                <li key={k} className={pad(u.url) === pad(bewijs[v].winnaar) ? "wint" : ""}>
                                  <a className="opr-pad" href={site(pad(u.url))} target="_blank" rel="noreferrer">{pad(u.url)}</a>
                                  {pad(u.url) === pad(bewijs[v].winnaar) && <span className="opr-chip keep">wint hier</span>}
                                  <span className="opr-bewijs-cijfers">
                                    {u.positie != null ? `positie ${Math.round(u.positie * 10) / 10}` : ""}
                                    {u.klikken != null ? ` · ${u.klikken} klikken` : ""}
                                    {u.impressies != null ? ` · ${u.impressies} vertoningen` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="opr-voet-balk">
        <button type="button" className="primary-btn small" disabled={push || !gekozen.length} onClick={() => void doorvoeren()}>
          {push ? "Bezig met doorvoeren…" : `Voer ${gekozen.length} ${gekozen.length === 1 ? "redirect" : "redirects"} door op de site`}
        </button>
        <span className="opr-telling">Zet 301-omleidingen klaar via de Redirection-plugin en meet daarna live na of ze echt werken.</span>
      </div>
      {pushMsg && <div className="opr-melding">{pushMsg}</div>}
      {melding && <div className="opr-melding">{melding}</div>}
      <p className="opr-voet">
        Vink af wat is doorgevoerd. Zet je een regel op <strong>Houden</strong> of kies je een ander doel, dan onthoudt het dashboard dat en maakt de volgende analyse dezelfde fout niet meer.
      </p>
    </div>
  );
}

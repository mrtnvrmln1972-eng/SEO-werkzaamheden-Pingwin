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

// Het bewijs als verhaaltje in plaats van als lijstje cijfers.
//
// Waarom: het uitklapje toonde een kop plus een rij URL's met "positie 1 · 124
// klikken · 1400 vertoningen". Dat is data, geen uitleg. Je moest zelf bedenken
// wat het betekende, en een klant helemaal. Dezelfde cijfers, nu in zinnen die
// zeggen wat er aan de hand is en wat het oplevert. Er komt geen getal in dat
// niet uit de analyse komt; ontbreekt een cijfer, dan blijft die zin weg.
function getal(n?: number): string { return n != null && Number.isFinite(n) ? String(Math.round(n)) : ""; }
function plek(n?: number): string { return n != null && Number.isFinite(n) ? String(Math.round(n * 10) / 10) : ""; }

// De reden uit de analyse is vaak een telegramstijl-regeltje ("0 klikken, 75
// vertoningen; interne testpagina zonder eigen term. Direct opruimen."). Dat is
// geen zin, dus maken we er een korte opsomming van die wél leest.
function redenDelen(reden: string): string[] {
  return (reden || "").split(/[;.]\s+|\n/).map((d) => d.trim().replace(/[.;]$/, "")).filter((d) => d.length > 2);
}

function BewijsUitleg({ b, v, doel, verhuizen, merge, reden, site }: {
  /** Het clusterbewijs, als de pagina in een cluster zat. Kandidaten uit de
      doorloop-rondes hebben dat niet; die krijgen hetzelfde verhaal, alleen met
      de reden uit de analyse in plaats van de cijfers uit het cluster. */
  b?: Bewijs; v: string; doel: string; verhuizen?: boolean; merge?: boolean; reden?: string;
  site: (p: string) => string;
}) {
  const Link = ({ p }: { p: string }) => (
    <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>
  );

  const Conclusie = () => (
    <p>
      {verhuizen
        ? <><strong>Wat we doen:</strong> de inhoud van deze pagina verhuist naar <Link p={doel} />, en dit oude adres gaat daarheen wijzen. Google krijgt dan nog maar één pagina te zien voor dit onderwerp, op het adres dat we willen aanhouden, en de opgebouwde waarde van allebei komt daar samen.</>
        : merge
          ? <><strong>Wat we doen:</strong> de bruikbare tekst van deze pagina gaat mee naar <Link p={doel} />, en dit adres wijst daarna daarheen. Eén sterke pagina in plaats van twee halve, zonder dat er inhoud verloren gaat.</>
          : <><strong>Wat we doen:</strong> deze pagina wijst voortaan door naar <Link p={doel} />. Google hoeft dan niet meer te kiezen, bezoekers komen op de beste pagina uit, en de kracht die deze pagina had telt daar voortaan mee.</>}
    </p>
  );

  // Geen cluster: dan is dit een pagina die op geen enkele eigen zoekterm scoort.
  if (!b) {
    const delen = redenDelen(reden || "");
    return (
      <div className="opr-bewijs">
        <p>
          Deze pagina scoort in Google <strong>op geen enkel zoekwoord dat over zijn eigen onderwerp gaat</strong>.
          Wat hij binnenhaalt, leent hij van de merknaam of van een andere plaats. Hij zit dus niemand in de weg,
          maar hij verdeelt wel de kracht van de site over meer pagina&rsquo;s dan nodig.
        </p>
        {delen.length > 1
          ? <ul className="opr-bewijs-punten">{delen.map((d, k) => <li key={k}>{d}</li>)}</ul>
          : reden ? <p><strong>Wat de analyse zag:</strong> {reden}</p> : null}
        <Conclusie />
      </div>
    );
  }

  const winnaar = pad(b.winnaar);
  const deze = b.urls.find((u) => pad(u.url) === v);
  const win = b.urls.find((u) => pad(u.url) === winnaar);
  const rest = b.urls.filter((u) => pad(u.url) !== v && pad(u.url) !== winnaar);

  const dezeKlik = getal(deze?.klikken), winKlik = getal(win?.klikken);
  const dezePlek = plek(deze?.positie), winPlek = plek(win?.positie);

  return (
    <div className="opr-bewijs">
      <p>
        Google laat deze pagina vooral zien bij mensen die zoeken op <strong>&ldquo;{b.keyword}&rdquo;</strong>.
        {b.urls.length > 1
          ? ` Dat doen op dezelfde zoekopdracht nog ${b.urls.length - 1} ${b.urls.length - 1 === 1 ? "andere pagina" : "andere pagina’s"} van deze site ook, dus concurreren ze met elkaar om dezelfde bezoeker.`
          : ""}
        {b.urlFlip ? ` Google weet daardoor zelf niet welke hij moet tonen: hij wisselde er de afgelopen maanden ${b.flipsIn90d && b.flipsIn90d > 1 ? `${b.flipsIn90d} keer` : "meermaals"} tussen.` : ""}
      </p>
      <p>
        <strong>De sterkste van het stel is <Link p={winnaar} />.</strong>
        {winPlek ? ` Die staat gemiddeld op plek ${winPlek}` : " Die wint deze zoekopdracht"}
        {winKlik ? ` en levert ${winKlik} ${winKlik === "1" ? "bezoeker" : "bezoekers"} op` : ""}.
        {deze && v !== winnaar
          ? ` Deze pagina zelf komt niet verder dan ${dezePlek ? `plek ${dezePlek}` : "de achterhoede"}${dezeKlik ? ` en haalt er ${dezeKlik} ${dezeKlik === "1" ? "bezoeker" : "bezoekers"} uit` : " en levert vrijwel niets op"}.`
          : ""}
      </p>
      <Conclusie />
      {rest.length > 0 && (
        <p className="opr-bewijs-rest">
          Op dezelfde zoekopdracht doen ook nog mee:{" "}
          {rest.map((u, k) => (
            <span key={k}>
              {k > 0 ? ", " : ""}<Link p={pad(u.url)} />{plek(u.positie) ? ` (plek ${plek(u.positie)})` : ""}
            </span>
          ))}. Wat daarmee gebeurt, staat bij die regels zelf; staan ze niet in deze lijst, dan blijven ze gewoon staan.
        </p>
      )}
    </div>
  );
}

export default function OpruimTabel({ slug, domain, rijen, openTarget, bewijs = {}, alleenLezen = false }: {
  slug: string; domain: string; rijen: RedirectRij[];
  /** Leesmodus voor de publieke deellink: geen vinkjes, geen besluitknoppen,
      geen doorvoerknop. Alleen kijken en uitklappen. Het echte slot zit op de
      adminroutes; dit voorkomt dat er knoppen staan die tóch niets doen. */
  alleenLezen?: boolean;
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
    if (alleenLezen) return;
    fetch(`/api/admin/opruim-regels?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setRegels(Object.fromEntries((d.regels as Regel[]).map((r) => [r.van, r]))); })
      .catch(() => {});
  }, [slug, alleenLezen]);

  function bewaar(van: string, patch: Partial<Regel>) {
    if (alleenLezen) return;
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
              {!alleenLezen && <th className="opr-vink">Kies</th>}
              {!alleenLezen && <th className="opr-vink">Klaar</th>}
              <th>Deze pagina (van)</th>
              <th>Gaat naar (doel)</th>
              <th>Content</th>
              {!alleenLezen && <th>Besluit</th>}
              <th>Waarom</th>
            </tr>
          </thead>
          <tbody>
            {(groepeer ? gegroepeerd : [["", zichtbaar] as const]).map(([doelKop, rijenIn], gi) => (
              <Fragment key={doelKop || gi}>
                {groepeer && (
                  <tr className="opr-groepkop">
                    <td colSpan={alleenLezen ? 4 : 7}>
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
                  {!alleenLezen && <td className="opr-vink">
                    <input type="checkbox" checked={!!sel[v]} disabled={!!reg?.doorgevoerd || uit} onChange={(e) => setSel((m) => ({ ...m, [v]: e.target.checked }))} title="Kies deze regel om door te voeren" />
                  </td>}
                  {!alleenLezen && <td className="opr-vink">
                    <input type="checkbox" checked={!!reg?.doorgevoerd} onChange={(e) => bewaar(v, { doorgevoerd: e.target.checked })} title="Deze redirect is doorgevoerd op de site" />
                  </td>}
                  <td><a className="opr-pad" href={site(v)} target="_blank" rel="noreferrer">{v}</a></td>
                  <td>
                    <a className="opr-pad opr-doel" href={site(doel)} target="_blank" rel="noreferrer">{doel}</a>
                    {!alleenLezen && <select className="opr-select" value={doel} onChange={(e) => bewaar(v, { naar: e.target.value, besluit: "redirect" })} title="Ander doel kiezen; die keuze onthoudt het dashboard">
                      {[...new Set([doel, ...doelen])].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>}
                  </td>
                  <td>
                    {r.verhuizen && <span className="opr-chip verhuis" title="De content gaat naar de nieuwe URL en de oude URL wijst daarheen. Hier moet dus eerst iets gebouwd worden.">verhuizen</span>}
                    {r.mergeContent && <span className="opr-chip merge">samenvoegen</span>}
                    {!r.verhuizen && !r.mergeContent && <span className="opr-leeg">&mdash;</span>}
                  </td>
                  {!alleenLezen && <td>
                    <div className="opr-knoppen">
                      <button type="button" className={"opr-btn" + (reg?.besluit === "houden" ? " aan" : "")} onClick={() => bewaar(v, { besluit: reg?.besluit === "houden" ? "redirect" : "houden" })} title="Deze pagina blijft staan; de volgende analyse stelt hem nooit meer voor">Houden</button>
                      <button type="button" className={"opr-btn" + (reg?.besluit === "genegeerd" ? " aan" : "")} onClick={() => bewaar(v, { besluit: reg?.besluit === "genegeerd" ? "redirect" : "genegeerd" })} title="Niet meer tonen">Negeren</button>
                    </div>
                  </td>}
                  <td className="opr-reden">
                    <button type="button" className="opr-meer" onClick={() => setOpen((o) => ({ ...o, [v]: !o[v] }))}>
                      {open[v] ? "▾" : "▸"} {open[v] ? "minder" : "reden"}
                    </button>
                    {/* Elke regel krijgt hetzelfde verhaal: wat er aan de hand is, en
                        wat we eraan doen. Zat de pagina in een cluster, dan met de
                        cijfers erbij; zo niet, dan met de reden uit de analyse. */}
                    {open[v] && (
                      <div className="opr-uitleg">
                        <BewijsUitleg b={bewijs[v]} v={v} doel={doel} verhuizen={r.verhuizen} merge={r.mergeContent} reden={r.reden} site={site} />
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
      {!alleenLezen && <div className="opr-voet-balk">
        <button type="button" className="btn btn-primary btn-klein" disabled={push || !gekozen.length} onClick={() => void doorvoeren()}>
          {push ? "Bezig met doorvoeren…" : `Voer ${gekozen.length} ${gekozen.length === 1 ? "redirect" : "redirects"} door op de site`}
        </button>
        <span className="opr-telling">Zet 301-omleidingen klaar via de Redirection-plugin en meet daarna live na of ze echt werken.</span>
      </div>}
      {pushMsg && <div className="opr-melding">{pushMsg}</div>}
      {melding && <div className="opr-melding">{melding}</div>}
      {!alleenLezen && <p className="opr-voet">
        Vink af wat is doorgevoerd. Zet je een regel op <strong>Houden</strong> of kies je een ander doel, dan onthoudt het dashboard dat en maakt de volgende analyse dezelfde fout niet meer.
      </p>}
    </div>
  );
}

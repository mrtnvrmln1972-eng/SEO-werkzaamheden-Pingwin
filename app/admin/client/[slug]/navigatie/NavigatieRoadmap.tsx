"use client";

// De interactieve roadmap: één boom (de beoogde structuur) waar de huidige site
// een weergave van is. Per pagina: hoofdzoekterm, klikbare slug en een
// voortgangsbalk (rood = bestaat nog niet, oranje = onderweg, groen = klaar).
// Totalen per hoofdcategorie en voor de hele site, filters, inklapbare takken,
// en het AI-voorstel voor de beoogde structuur dat Maarten eerst bevestigt.

import { useEffect, useMemo, useState } from "react";

type Node = { url: string; parent: string; hoofdzoekterm: string; volume: number | null; volgorde: number; live: boolean; pct: number; fasesKlaar: number; inPlan: boolean };
type Voorstel = { url: string; parent: string; hoofdzoekterm: string; volume: number | null };
type Filter = "alles" | "onvoltooid" | "ontbrekend" | "onder50";

export default function NavigatieRoadmap({ slug, clientName, domain }: { slug: string; clientName: string; domain: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [voorstel, setVoorstel] = useState<Voorstel[]>([]);
  const [blik, setBlik] = useState<"beoogd" | "huidig">("beoogd");
  const [filter, setFilter] = useState<Filter>("alles");
  const [dicht, setDicht] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [bewerk, setBewerk] = useState<string | null>(null);
  const [bewerkTerm, setBewerkTerm] = useState("");
  const [nieuwIn, setNieuwIn] = useState<string | null>(null);
  const [nieuwPad, setNieuwPad] = useState("");

  async function laad() {
    const d = await fetch(`/api/admin/nav-plan?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setNodes(d.nodes || []); setVoorstel(d.voorstel || []); }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function post(body: Record<string, unknown>, busyLabel: string) {
    setBusy(busyLabel); setMsg("");
    try {
      const d = await fetch("/api/admin/nav-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) }).then((r) => r.json());
      if (d?.ok) { await laad(); return true; }
      setMsg(d?.error || "Dat lukte niet; probeer het nog een keer.");
    } catch { setMsg("Dat lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
    return false;
  }

  // Filteren en boom opbouwen (hoofdniveau → kinderen).
  const zicht = useMemo(() => {
    let n = nodes;
    if (blik === "huidig") n = n.filter((x) => x.live);
    if (filter === "onvoltooid") n = n.filter((x) => x.pct < 100);
    if (filter === "ontbrekend") n = n.filter((x) => !x.live);
    if (filter === "onder50") n = n.filter((x) => x.pct < 50);
    return n;
  }, [nodes, blik, filter]);
  const kinderenVan = (parent: string) => zicht.filter((n) => n.parent === parent).sort((a, b) => a.volgorde - b.volgorde);
  // Hoofdniveau: parent "" of een parent die zelf niet (zichtbaar) bestaat.
  const paden = new Set(zicht.map((n) => n.url));
  const hoofd = zicht.filter((n) => !n.parent || !paden.has(n.parent)).sort((a, b) => a.volgorde - b.volgorde);

  const totaalPct = nodes.length ? Math.round(nodes.reduce((s, n) => s + n.pct, 0) / nodes.length) : 0;
  const klaarTotaal = nodes.filter((n) => n.pct === 100).length;

  const kleur = (n: Node) => (!n.live ? "nv-rood" : n.pct >= 100 ? "nv-groen" : "nv-oranje");
  const liveUrl = (pad: string) => (domain ? `https://${domain}${pad}` : pad);

  const Rij = ({ n, diepte }: { n: Node; diepte: number }) => {
    const kids = kinderenVan(n.url);
    const isDicht = dicht[n.url];
    const tak = [n, ...alleOnder(n.url)];
    const takKlaar = tak.filter((x) => x.pct === 100).length;
    return (
      <div className="nv-tak" style={{ marginLeft: diepte ? 22 : 0 }}>
        <div className={"nv-rij " + kleur(n)}>
          {kids.length > 0
            ? <button type="button" className="nv-caret" onClick={() => setDicht((v) => ({ ...v, [n.url]: !v[n.url] }))}>{isDicht ? "▸" : "▾"}</button>
            : <span className="nv-caret nv-caret-leeg" />}
          <a className="nv-slug" href={liveUrl(n.url)} target="_blank" rel="noreferrer">{n.url}</a>
          {bewerk === n.url ? (
            <input className="nv-term-input" autoFocus value={bewerkTerm} placeholder="hoofdzoekterm"
              onChange={(e) => setBewerkTerm(e.target.value)}
              onBlur={() => { setBewerk(null); void post({ action: "update", url: n.url, hoofdzoekterm: bewerkTerm }, "term"); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          ) : (
            <button type="button" className="nv-term" title="Klik om de hoofdzoekterm aan te passen" onClick={() => { setBewerk(n.url); setBewerkTerm(n.hoofdzoekterm); }}>
              {n.hoofdzoekterm || "(hoofdzoekterm)"}{n.volume ? ` · ${n.volume} vol.` : ""}
            </button>
          )}
          <span className="nv-spacer" />
          {kids.length > 0 && <span className="nv-taktotaal">{takKlaar}/{tak.length}</span>}
          {!n.live && <span className="nv-badge-mist">bestaat nog niet</span>}
          <span className="nv-balkje" title={`${n.fasesKlaar} van 7 fases klaar`}><span className={"nv-balkvul " + kleur(n)} style={{ width: `${Math.max(n.pct, 4)}%` }} /></span>
          <span className="nv-pct">{n.pct}%</span>
          {n.pct < 100 && n.live && <button type="button" className="nv-mini" title="Markeer voltooid: vinkt alle fases af (zelfde vinkjes als op de projectkaart)" onClick={() => void post({ action: "voltooi", url: n.url }, "voltooi")}>✓</button>}
          <button type="button" className="nv-mini nv-mini-del" title="Uit de beoogde structuur halen (de live pagina zelf blijft gewoon bestaan)" onClick={() => void post({ action: "del", url: n.url }, "del")}>×</button>
        </div>
        {!isDicht && kids.map((k) => <Rij key={k.url} n={k} diepte={diepte + 1} />)}
        {!isDicht && (nieuwIn === n.url ? (
          <div className="nv-nieuw" style={{ marginLeft: 22 }}>
            <input className="nv-term-input" autoFocus value={nieuwPad} placeholder="/pad/nieuwe-pagina/"
              onChange={(e) => setNieuwPad(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && nieuwPad.trim()) { void post({ action: "add", url: nieuwPad.trim(), parent: n.url }, "add"); setNieuwIn(null); setNieuwPad(""); } if (e.key === "Escape") setNieuwIn(null); }} />
          </div>
        ) : kids.length > 0 && (
          <button type="button" className="nv-addlink" style={{ marginLeft: 22 }} onClick={() => { setNieuwIn(n.url); setNieuwPad(""); }}>+ pagina in deze tak</button>
        ))}
      </div>
    );
  };
  function alleOnder(parent: string): Node[] {
    const direct = zicht.filter((n) => n.parent === parent);
    return [...direct, ...direct.flatMap((d) => alleOnder(d.url))];
  }

  return (
    <div className="nv-wrap">
      <div className="nv-kop">
        <a className="nv-terug" href={`/admin/client/${slug}?tab=paginas`}>&larr; terug naar de cockpit</a>
        <h1>Navigatie &amp; voortgang: {clientName}</h1>
        <div className="nv-totaal">
          <span className="nv-balkje nv-balkje-groot"><span className="nv-balkvul nv-groen" style={{ width: `${totaalPct}%` }} /></span>
          <strong>{totaalPct}%</strong>
          <span className="nv-muted">{klaarTotaal} van {nodes.length} pagina&rsquo;s voltooid</span>
        </div>
        <div className="nv-balk-acties">
          <span className="nv-schakel">
            <button type="button" className={blik === "beoogd" ? "aan" : ""} onClick={() => setBlik("beoogd")}>Beoogde structuur</button>
            <button type="button" className={blik === "huidig" ? "aan" : ""} onClick={() => setBlik("huidig")}>Huidige site</button>
          </span>
          <select className="nv-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="alles">Alle pagina&rsquo;s</option>
            <option value="onvoltooid">Alleen onvoltooid</option>
            <option value="ontbrekend">Alleen ontbrekend</option>
            <option value="onder50">Onder de 50%</option>
          </select>
          <span className="nv-spacer" />
          <button type="button" className="wp-fase-btn" disabled={!!busy} title="De AI bouwt een voorstel voor de beoogde eindstructuur uit de live pagina's, je Zoekwoorden & links-afspraken en de zoekwoorddata; jij bevestigt." onClick={() => void post({ action: "voorstel" }, "voorstel")}>{busy === "voorstel" ? "Voorstel maken… (halve minuut)" : "Stel de structuur voor"}</button>
          {nieuwIn === "" ? (
            <input className="nv-term-input" autoFocus value={nieuwPad} placeholder="/pad/nieuwe-pagina/"
              onChange={(e) => setNieuwPad(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && nieuwPad.trim()) { void post({ action: "add", url: nieuwPad.trim(), parent: "" }, "add"); setNieuwIn(null); setNieuwPad(""); } if (e.key === "Escape") setNieuwIn(null); }} />
          ) : (
            <button type="button" className="wp-fase-btn" onClick={() => { setNieuwIn(""); setNieuwPad(""); }}>+ pagina</button>
          )}
        </div>
        {msg && <div className="wp-doc-fout">{msg}</div>}
      </div>

      {voorstel.length > 0 && (
        <div className="nv-voorstel">
          <strong>Voorstel klaar: {voorstel.length} pagina&rsquo;s in de beoogde structuur.</strong>
          <span className="nv-muted">Bevestig om hem te gebruiken (daarna kun je alles aanpassen), of gooi hem weg.</span>
          <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void post({ action: "bevestig" }, "bevestig")}>Gebruik dit voorstel</button>
          <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void post({ action: "verwerp" }, "verwerp")}>Weggooien</button>
        </div>
      )}

      <div className="nv-boom">
        {hoofd.map((n) => <Rij key={n.url} n={n} diepte={0} />)}
        {hoofd.length === 0 && <div className="nv-muted">Nog geen pagina&rsquo;s in beeld. Draai eerst een sitescan (tab Pagina&rsquo;s) of klik &ldquo;Stel de structuur voor&rdquo;.</div>}
      </div>
      <p className="nv-uitleg">Rood = pagina bestaat nog niet · oranje = bestaat maar nog niet af · groen = alle fases klaar. Het percentage komt uit de zeven fases die ook op de projectkaarten staan; afvinken daar telt hier automatisch mee.</p>
    </div>
  );
}

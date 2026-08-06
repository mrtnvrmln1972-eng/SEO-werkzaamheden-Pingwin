"use client";

// De navigatie-roadmap: de site zoals hij in het menu staat, in kolommen naast
// elkaar (hoofdmenu bovenaan, submenu eronder), net als een navigatiebalk.
// Twee weergaven: "Huidige site" (het menu dat we van de site uitlezen) en
// "Beoogde structuur" (waar we naartoe werken). Per pagina de voortgang uit de
// zeven fases die ook op de projectkaarten staan.

import { useEffect, useMemo, useState } from "react";
import { kaartTekst, faseVoorstel } from "../../../../../lib/weekplan-kaarttekst";
import { wachtOpKlus } from "../useKlus";

type Punt = { naam: string; behaald: number; max: number; uitleg: string };
type Node = {
  url: string; parent: string; hoofdzoekterm: string; volume: number | null; volgorde: number;
  live: boolean; pct: number; fasesKlaar: number; inPlan: boolean; label?: string;
  woorden: number | null; woordenGeschat: boolean; score: number | null;
  scoreNiveau: "goed" | "matig" | "zwak" | null; scoreLabel: string; punten: Punt[]; gemetenOp: string | null;
  bucket?: boolean;
};
type Voorstel = { url: string; parent: string; hoofdzoekterm: string; volume: number | null };
type Filter = "alles" | "onvoltooid" | "ontbrekend" | "onder50";

export default function NavigatieRoadmap({ slug, clientName, domain }: { slug: string; clientName: string; domain: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [menu, setMenu] = useState<Node[]>([]);
  const [huidig, setHuidig] = useState<Node[]>([]);
  const [gescand, setGescand] = useState<{ op: string | null; aantal: number; teveel: number }>({ op: null, aantal: 0, teveel: 0 });
  const [voorstel, setVoorstel] = useState<Voorstel[]>([]);
  const [ontbrekend, setOntbrekend] = useState<string[]>([]);
  const [weergave, setWeergave] = useState<"kolommen" | "lijst">("kolommen");
  const [sorteer, setSorteer] = useState<{ key: "score" | "woorden" | "pct" | "naam"; dir: "op" | "af" }>({ key: "score", dir: "op" });
  const [blik, setBlik] = useState<"beoogd" | "huidig">("huidig");
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
    if (d?.ok) {
      setNodes(d.nodes || []); setMenu(d.menu || []); setHuidig(d.huidig || []);
      setVoorstel(d.voorstel || []); setOntbrekend(d.ontbrekend || []);
      setGescand({ op: d.laatstGescand || null, aantal: d.aantalGescand || 0, teveel: d.losTeveel || 0 });
    }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Is het menu van de site nog nooit uitgelezen, doe dat dan meteen zelf; dan
  // staat de huidige site er zonder dat je ergens op hoeft te klikken.
  const [zelfGeprobeerd, setZelfGeprobeerd] = useState(false);
  useEffect(() => {
    if (zelfGeprobeerd || menu.length > 0 || nodes.length === 0) return;
    setZelfGeprobeerd(true);
    void post({ action: "menu" }, "menu");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [menu.length, nodes.length, zelfGeprobeerd]);

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

  // Meet de pagina's die nog geen score hebben, via de bestaande content-scan.
  async function meet() {
    setBusy("meten"); setMsg("");
    try {
      const d = await fetch("/api/admin/content-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, urls: ontbrekend.slice(0, 50) }) }).then((r) => r.json());
      if (!d?.ok) { setMsg(d?.error || "Meten lukte niet; probeer het nog een keer."); return; }
      setMsg("De pagina's worden gemeten; dat loopt door op de server, ook als je dit venster sluit.");
      const klaar = await wachtOpKlus(slug, "wijzigingen-scan");
      setMsg(klaar?.status === "fout" ? (klaar.error || "Meten liep vast.") : "");
      await laad();
    } catch { setMsg("Meten lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  // Hele site opnieuw inlezen: eerst de sitemap (welke pagina's bestaan er),
  // daarna het menu (hoe hangen ze samen). Los van elkaar heeft het weinig zin.
  async function scanSite() {
    setBusy("scan"); setMsg("");
    try {
      const d = await fetch("/api/admin/urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      if (!d?.ok) { setMsg(d?.error || "De sitescan lukte niet; probeer het nog een keer."); return; }
      // Het inlezen draait op de server. Het menu heeft de pagina's nodig, dus
      // eerst wachten tot dat klaar is; anders bouwt hij het menu op een lege lijst.
      setMsg("De site wordt ingelezen; daarna wordt het menu opgebouwd. Je kunt dit venster sluiten, het werk loopt door.");
      const klaar = await wachtOpKlus(slug, "site-inlezen");
      if (klaar && klaar.status === "fout") { setMsg(klaar.error || "Het inlezen liep vast."); return; }
      setMsg("");
      await fetch("/api/admin/nav-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "menu" }) }).catch(() => null);
      await laad();
    } catch { setMsg("De sitescan lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  // Welke lijst tonen we, en wat blijft er na het filter over?
  const bron = blik === "huidig" ? huidig : nodes;
  const zicht = useMemo(() => {
    let n = bron;
    if (filter === "onvoltooid") n = n.filter((x) => x.bucket || x.pct < 100);
    if (filter === "ontbrekend") n = n.filter((x) => x.bucket || !x.live);
    if (filter === "onder50") n = n.filter((x) => x.bucket || x.pct < 50);
    return n;
  }, [bron, filter]);

  const kinderenVan = (parent: string) => zicht.filter((n) => n.parent === parent && n.url !== parent).sort((a, b) => a.volgorde - b.volgorde);
  const paden = new Set(zicht.map((n) => n.url));
  const kolommen = zicht.filter((n) => !n.parent || !paden.has(n.parent)).sort((a, b) => a.volgorde - b.volgorde);

  function alleOnder(parent: string, gezien: Set<string> = new Set()): Node[] {
    if (gezien.has(parent)) return [];
    gezien.add(parent);
    const direct = kinderenVan(parent);
    return [...direct, ...direct.flatMap((d) => alleOnder(d.url, gezien))];
  }

  const echt = bron.filter((n) => !n.bucket);
  const totaal = echt.length;
  const klaarTotaal = echt.filter((n) => n.pct === 100).length;
  const totaalPct = totaal ? Math.round(echt.reduce((s, n) => s + n.pct, 0) / totaal) : 0;
  const ontbreekt = echt.filter((n) => !n.live).length;
  const begonnen = echt.filter((n) => n.pct > 0 && n.pct < 100).length;

  const oudeScan = !!gescand.op && Date.now() - new Date(gescand.op).getTime() > 14 * 24 * 3600 * 1000;
  const kleur = (n: Node) => (!n.live ? "nv-rood" : n.pct >= 100 ? "nv-groen" : n.pct > 0 ? "nv-oranje" : "nv-grijs");
  const liveUrl = (pad: string) => (domain ? `https://${domain.replace(/^https?:\/\//, "")}${pad}` : pad);
  const naam = (n: Node) => n.label || n.hoofdzoekterm || (n.url === "/" ? "Homepage" : (n.url.split("/").filter(Boolean).pop() || n.url).replace(/-/g, " "));
  const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "");
  const scoreUitleg = (n: Node) => (n.score === null ? "Nog niet gemeten" : `${n.scoreLabel} (${n.score}/100)\n` + n.punten.map((p) => `${p.naam}: ${p.behaald}/${p.max} \u00b7 ${p.uitleg}`).join("\n") + `\n\nLaatst vastgelegd op ${datum(n.gemetenOp)} (de scan bewaart alleen een nieuwe meting als er iets veranderd is)`);

  // Waar hangt deze pagina in het menu? (voor de lijstweergave)
  const takNaam = (n: Node) => {
    const ouder = bron.find((x) => x.url === n.parent);
    return ouder ? naam(ouder) : "hoofdmenu";
  };

  // De lijst: dezelfde selectie als de kolommen, maar plat en gesorteerd.
  // Pagina's zonder meting staan altijd onderaan, anders vult de bovenkant
  // zich met streepjes in plaats van met werk.
  function sorteerOp(key: "score" | "woorden" | "pct" | "naam") {
    setSorteer((v) => (v.key === key ? { key, dir: v.dir === "op" ? "af" : "op" } : { key, dir: key === "naam" ? "op" : "op" }));
  }
  const pijl = (key: string) => (sorteer.key === key ? (sorteer.dir === "op" ? " ▲" : " ▼") : "");
  const lijst = useMemo(() => {
    const kopie = zicht.filter((n) => !n.bucket);
    const richting = sorteer.dir === "op" ? 1 : -1;
    kopie.sort((a, b) => {
      if (sorteer.key === "naam") return naam(a).localeCompare(naam(b)) * richting;
      const va = sorteer.key === "score" ? a.score : sorteer.key === "woorden" ? a.woorden : a.pct;
      const vb = sorteer.key === "score" ? b.score : sorteer.key === "woorden" ? b.woorden : b.pct;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;   // zonder meting altijd onderaan
      if (vb === null) return -1;
      return (va - vb) * richting;
    });
    return kopie;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [zicht, sorteer]);

  // De drie kolommetjes: woorden, score, fase-percentage. Overal hetzelfde,
  // zodat de kolomweergave en de lijst dezelfde taal spreken.
  const Cijfers = ({ n }: { n: Node }) => (
    <>
      <span className="nv-woorden" title={n.woorden === null ? "Nog niet gemeten" : `${n.woorden} woorden eigen tekst${n.woordenGeschat ? " (geschat: menu en footer eraf geschat, nog niet exact gemeten)" : ", zonder menu en footer"}`}>
        {n.woorden === null ? <span className="nv-leegwaarde">&ndash;</span> : `${n.woorden}${n.woordenGeschat ? "~" : ""}`}
      </span>
      {n.score === null
        ? <span className="nv-score nv-score-leeg" title="Nog niet gemeten">&ndash;</span>
        : <span className={"nv-score " + n.scoreNiveau} title={scoreUitleg(n)}>{n.score}</span>}
      <span className="nv-pct" title={`${n.fasesKlaar} van 7 fases klaar`}>{n.pct}%</span>
    </>
  );

  // Een pagina vanuit deze roadmap als projectkaart in de weekplanning zetten.
  // Dit is de plek waar je ziet welke pagina achterloopt (score, woorden, fases),
  // dus hier hoort de knop die er werk van maakt. De kaarttekst gaat door dezelfde
  // bouwer als elders, zodat de kaart met fases en pagina-context opengaat.
  const [planBezig, setPlanBezig] = useState("");
  async function naarPlanning(n: Node) {
    if (planBezig) return;
    setPlanBezig(n.url);
    try {
      const achtergrond: string[] = [];
      if (!n.live) achtergrond.push(`Deze pagina bestaat nog niet; ${n.url} is het beoogde adres uit de navigatie-roadmap.`);
      if (n.hoofdzoekterm) achtergrond.push(`Hoofdzoekterm "${n.hoofdzoekterm}"${n.volume != null ? `, ${n.volume.toLocaleString("nl-NL")} zoekopdrachten per maand` : ""}.`);
      if (n.score !== null) achtergrond.push(`Score ${n.score}/100 (${n.scoreLabel})${n.woorden !== null ? `, ${n.woorden}${n.woordenGeschat ? " geschatte" : ""} woorden eigen tekst` : ""}.`);
      const zwak = (n.punten || []).filter((p) => p.max > 0 && p.behaald < p.max).map((p) => p.naam);
      if (zwak.length) achtergrond.push(`Zwakste onderdelen nu: ${zwak.slice(0, 4).join(", ")}.`);
      achtergrond.push(`${n.fasesKlaar} van de 7 fases staan af.`);
      const toelichting = kaartTekst({
        achtergrond,
        afspraken: ["Bron: opgepakt vanuit de navigatie-roadmap."],
        fases: faseVoorstel({ nieuw: !n.live, zoekwoord: n.hoofdzoekterm, pad: n.url }),
      });
      await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak: `${n.live ? "Pagina oppakken" : "Nieuwe pagina"}: ${padVan(n.url)}`, url: liveUrl(n.url), week: 1, wie: "SEO", taaktype: "pijplijn", thread: "navigatie", toelichting }),
      });
      setMsg(`In de planning gezet: ${padVan(n.url)}.`);
      await laad();
    } catch { setMsg("In de planning zetten mislukte; probeer het nog een keer."); }
    finally { setPlanBezig(""); }
  }
  const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
  const PlanKnop = ({ n }: { n: Node }) => (
    n.inPlan
      ? <span className="nv-badge-plan" title="Deze pagina staat al als kaart in de weekplanning.">in planning</span>
      : <button type="button" className="nv-plan" disabled={planBezig === n.url} title="Zet deze pagina als projectkaart in de weekplanning van deze week, met de fases en de pagina-context erin." onClick={() => void naarPlanning(n)}>{planBezig === n.url ? "…" : "+ planning"}</button>
  );

  // Eén regel in een kolom: naam, voortgang en de acties die bij hover verschijnen.
  const Regel = ({ n, diepte, keten = [] }: { n: Node; diepte: number; keten?: string[] }) => {
    if (keten.includes(n.url)) return null;
    const kids = kinderenVan(n.url);
    const isDicht = dicht[n.url];
    return (
      <>
        <div className={"nv-item " + kleur(n)} style={{ paddingLeft: 10 + diepte * 14 }}>
          {kids.length > 0
            ? <button type="button" className="nv-caret" title={isDicht ? "Uitklappen" : "Inklappen"} onClick={() => setDicht((v) => ({ ...v, [n.url]: !v[n.url] }))}>{isDicht ? "▸" : "▾"}</button>
            : <span className="nv-caret nv-caret-leeg" />}
          <a className="nv-naam" href={liveUrl(n.url)} target="_blank" rel="noreferrer" title={n.url}>{naam(n)}</a>
          <span className="nv-spacer" />
          {!n.live && <span className="nv-badge-mist" title="Deze pagina bestaat nog niet">nieuw</span>}
          <Cijfers n={n} />
          <span className="nv-acties">
            <PlanKnop n={n} />
            {n.pct < 100 && n.live && <button type="button" className="nv-mini" title="Markeer voltooid: vinkt alle zeven fases af" onClick={() => void post({ action: "voltooi", url: n.url }, "voltooi")}>✓</button>}
            {blik === "beoogd" && <button type="button" className="nv-mini nv-mini-del" title="Uit de beoogde structuur halen (de live pagina blijft bestaan)" onClick={() => void post({ action: "del", url: n.url }, "del")}>×</button>}
          </span>
        </div>
        {blik === "beoogd" && (bewerk === n.url ? (
          <input className="nv-term-input" autoFocus value={bewerkTerm} placeholder="hoofdzoekterm"
            style={{ marginLeft: 10 + diepte * 14 }}
            onChange={(e) => setBewerkTerm(e.target.value)}
            onBlur={() => { setBewerk(null); void post({ action: "update", url: n.url, hoofdzoekterm: bewerkTerm }, "term"); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        ) : (
          <button type="button" className="nv-term" style={{ marginLeft: 26 + diepte * 14 }} title="Klik om de hoofdzoekterm aan te passen" onClick={() => { setBewerk(n.url); setBewerkTerm(n.hoofdzoekterm); }}>
            {n.hoofdzoekterm || "+ zoekterm"}{n.volume ? ` · ${n.volume} vol.` : ""}
          </button>
        ))}
        {!isDicht && kids.map((k) => <Regel key={k.url} n={k} diepte={diepte + 1} keten={[...keten, n.url]} />)}
      </>
    );
  };

  const Kolom = ({ n }: { n: Node }) => {
    const kids = kinderenVan(n.url);
    const tak = (n.bucket ? alleOnder(n.url) : [n, ...alleOnder(n.url)]).filter((x) => !x.bucket);
    const takKlaar = tak.filter((x) => x.pct === 100).length;
    const takPct = tak.length ? Math.round(tak.reduce((s, x) => s + x.pct, 0) / tak.length) : 0;
    const isDicht = dicht["kolom:" + n.url];
    return (
      <div className="nv-kolom">
        <div className={"nv-kolomkop " + (n.bucket ? "nv-grijs" : kleur(n))}>
          <button type="button" className="nv-caret" title={isDicht ? "Uitklappen" : "Inklappen"} onClick={() => setDicht((v) => ({ ...v, ["kolom:" + n.url]: !v["kolom:" + n.url] }))}>{isDicht ? "▸" : "▾"}</button>
          {n.bucket
            ? <span className="nv-kolomnaam nv-kolomnaam-los" title="Deze pagina's komen nergens in het hoofdmenu terug. Een bezoeker vindt ze alleen via een link in een tekst of via Google.">Niet in het menu</span>
            : <a className="nv-kolomnaam" href={liveUrl(n.url)} target="_blank" rel="noreferrer" title={n.url}>{naam(n)}</a>}
          {tak.length > (n.bucket ? 0 : 1) && <span className="nv-taktotaal" title="Voltooide pagina's in deze tak">{takKlaar}/{tak.length}</span>}
        </div>
        {!n.bucket && <span className="nv-balkje"><span className={"nv-balkvul " + kleur(n)} style={{ width: `${Math.max(takPct, 3)}%` }} /></span>}
        {!isDicht && (
          <div className="nv-kolomlijst">
            {tak.length === 1 && !n.bucket && <div className={"nv-item " + kleur(n)} style={{ paddingLeft: 10 }}><span className="nv-caret nv-caret-leeg" /><a className="nv-naam" href={liveUrl(n.url)} target="_blank" rel="noreferrer">{n.url}</a><span className="nv-spacer" /><Cijfers n={n} /></div>}
            {kids.map((k) => <Regel key={k.url} n={k} diepte={0} keten={[n.url]} />)}
            {gescand.teveel > 0 && n.bucket && <div className="nv-muted" style={{ padding: "4px 6px" }}>+ {gescand.teveel} pagina&rsquo;s niet getoond</div>}
            {blik === "beoogd" && !n.bucket && (nieuwIn === n.url ? (
              <input className="nv-term-input" autoFocus value={nieuwPad} placeholder="/pad/nieuwe-pagina/"
                onChange={(e) => setNieuwPad(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && nieuwPad.trim()) { void post({ action: "add", url: nieuwPad.trim(), parent: n.url }, "add"); setNieuwIn(null); setNieuwPad(""); } if (e.key === "Escape") setNieuwIn(null); }} />
            ) : (
              <button type="button" className="nv-addlink" onClick={() => { setNieuwIn(n.url); setNieuwPad(""); }}>+ pagina hier</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="nv-wrap">
      <div className="nv-kop">
        <a className="nv-terug" href={`/admin/client/${slug}?tab=paginas`}>&larr; terug naar de cockpit</a>
        <h1>Navigatie &amp; voortgang: {clientName}</h1>
        <div className="nv-cijfers">
          <span className="nv-cijfer"><strong>{totaalPct}%</strong> gemiddeld af</span>
          <span className="nv-cijfer"><strong>{klaarTotaal}</strong> van {totaal} pagina&rsquo;s helemaal klaar</span>
          <span className="nv-cijfer"><strong>{begonnen}</strong> onderweg</span>
          {ontbreekt > 0 && <span className="nv-cijfer"><strong>{ontbreekt}</strong> bestaat nog niet</span>}
        </div>
        <div className="nv-totaal">
          <span className="nv-balkje nv-balkje-groot"><span className="nv-balkvul nv-groen" style={{ width: `${totaalPct}%` }} /></span>
        </div>
        <div className="nv-balk-acties">
          <span className="nv-schakel">
            <button type="button" className={blik === "huidig" ? "aan" : ""} onClick={() => setBlik("huidig")}>Huidige site</button>
            <button type="button" className={blik === "beoogd" ? "aan" : ""} onClick={() => setBlik("beoogd")}>Beoogde structuur</button>
          </span>
          <select className="nv-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="alles">Alle pagina&rsquo;s</option>
            <option value="onvoltooid">Alleen onvoltooid</option>
            <option value="ontbrekend">Alleen ontbrekend</option>
            <option value="onder50">Onder de 50%</option>
          </select>
          <span className="nv-schakel">
            <button type="button" className={weergave === "kolommen" ? "aan" : ""} onClick={() => setWeergave("kolommen")}>Als menu</button>
            <button type="button" className={weergave === "lijst" ? "aan" : ""} onClick={() => setWeergave("lijst")}>Als lijst</button>
          </span>
          <span className="nv-spacer" />
          {ontbrekend.length > 0 && (
            <button type="button" className="wp-fase-btn" disabled={!!busy} title="Haalt deze pagina's op en meet tekst, koppen, meta en alt-teksten opnieuw. Zolang dit niet is gedraaid, is het woordaantal een schatting (te herkennen aan de tilde)." onClick={() => void meet()}>
              {busy === "meten" ? "Pagina\u2019s meten… (kan een minuut duren)" : `Meet ${ontbrekend.length} pagina\u2019s precies`}
            </button>
          )}
          {blik === "huidig" ? (
            <>
              <button type="button" className="wp-fase-btn" disabled={!!busy} title="Haalt de sitemap opnieuw op, controleert elke pagina en leest daarna het menu opnieuw uit. Duurt een paar minuten; laat dit scherm open staan." onClick={() => void scanSite()}>{busy === "scan" ? "Site scannen… (paar minuten)" : "Hele site opnieuw scannen"}</button>
              <button type="button" className="wp-fase-btn" disabled={!!busy} title="Alleen het menu opnieuw uitlezen; dat is in tien seconden klaar." onClick={() => void post({ action: "menu" }, "menu")}>{busy === "menu" ? "Menu uitlezen…" : "Alleen het menu"}</button>
            </>
          ) : (
            <>
              <button type="button" className="wp-fase-btn" disabled={!!busy} title="De AI bouwt een voorstel voor de beoogde eindstructuur uit de live pagina's, je Zoekwoorden & links-afspraken en de zoekwoorddata; jij bevestigt." onClick={() => void post({ action: "voorstel" }, "voorstel")}>{busy === "voorstel" ? "Voorstel maken… (halve minuut)" : "Stel de structuur voor"}</button>
              {nieuwIn === "" ? (
                <input className="nv-term-input" autoFocus value={nieuwPad} placeholder="/pad/nieuwe-pagina/"
                  onChange={(e) => setNieuwPad(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nieuwPad.trim()) { void post({ action: "add", url: nieuwPad.trim(), parent: "" }, "add"); setNieuwIn(null); setNieuwPad(""); } if (e.key === "Escape") setNieuwIn(null); }} />
              ) : (
                <button type="button" className="wp-fase-btn" onClick={() => { setNieuwIn(""); setNieuwPad(""); }}>+ hoofdmenu-item</button>
              )}
            </>
          )}
        </div>
        {blik === "huidig" && (
          <div className={"nv-scanregel" + (oudeScan ? " nv-scanoud" : "")}>
            {gescand.op
              ? <>Site voor het laatst gescand op {datum(gescand.op)} · {gescand.aantal} pagina&rsquo;s gevonden{oudeScan ? " · dat is alweer even geleden, scan hem opnieuw als er pagina\u2019s bij zijn gekomen" : ""}</>
              : <>De site is nog nooit gescand. Klik op &ldquo;Hele site opnieuw scannen&rdquo; om alle pagina&rsquo;s in beeld te krijgen.</>}
          </div>
        )}
        {msg && <div className="wp-doc-fout">{msg}</div>}
      </div>

      {voorstel.length > 0 && blik === "beoogd" && (
        <div className="nv-voorstel">
          <strong>Voorstel klaar: {voorstel.length} pagina&rsquo;s in de beoogde structuur.</strong>
          <span className="nv-muted">Bevestig om hem te gebruiken (daarna kun je alles aanpassen), of gooi hem weg.</span>
          <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void post({ action: "bevestig" }, "bevestig")}>Gebruik dit voorstel</button>
          <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void post({ action: "verwerp" }, "verwerp")}>Weggooien</button>
        </div>
      )}

      {weergave === "kolommen" ? (
        <div className="nv-kolommen">
          {kolommen.map((n) => <Kolom key={n.url} n={n} />)}
        </div>
      ) : (
        <div className="res-table-wrap nv-lijstkaart">
          <table className="res-table nv-lijst">
            <thead>
              <tr>
                <th className="pg-sort" onClick={() => sorteerOp("naam")}>Pagina{pijl("naam")}</th>
                <th>Waar in het menu</th>
                <th className="pg-sort nv-getal" onClick={() => sorteerOp("woorden")} title="Eigen tekst, zonder menu en footer">Woorden{pijl("woorden")}</th>
                <th className="pg-sort nv-getal" onClick={() => sorteerOp("score")} title="Hoe goed de pagina als landingpagina is ingericht">Score{pijl("score")}</th>
                <th className="pg-sort nv-getal" onClick={() => sorteerOp("pct")} title="Hoeveel van de zeven fases klaar zijn">Fases{pijl("pct")}</th>
                <th title="Zet deze pagina als projectkaart in de weekplanning">Planning</th>
              </tr>
            </thead>
            <tbody>
              {lijst.map((n) => (
                <tr key={n.url}>
                  <td>
                    <a href={liveUrl(n.url)} target="_blank" rel="noreferrer">{naam(n)}</a>
                    {!n.live && <span className="nv-badge-mist" style={{ marginLeft: 8 }}>nieuw</span>}
                    <div className="nv-muted">{n.url}</div>
                  </td>
                  <td className="nv-muted">{takNaam(n)}</td>
                  <td className="nv-getal">{n.woorden === null ? <span className="nv-leegwaarde">&ndash;</span> : `${n.woorden}${n.woordenGeschat ? "~" : ""}`}</td>
                  <td className="nv-getal">{n.score === null ? <span className="nv-leegwaarde">&ndash;</span> : <span className={"nv-score " + n.scoreNiveau} title={scoreUitleg(n)}>{n.score}</span>}</td>
                  <td className="nv-getal">{n.pct}%</td>
                  <td><PlanKnop n={n} /></td>
                </tr>
              ))}
              {lijst.length === 0 && <tr><td colSpan={6} className="nv-muted">Geen pagina&rsquo;s in deze selectie.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {kolommen.length === 0 && weergave === "kolommen" && (
        <div className="nv-leeg">
          {blik === "huidig"
            ? <>Er is nog niets van deze site ingelezen. Klik op <strong>&ldquo;Hele site opnieuw scannen&rdquo;</strong>, dan staat hier de navigatie met alle pagina&rsquo;s erin.</>
            : <>Nog geen beoogde structuur. Klik op <strong>&ldquo;Stel de structuur voor&rdquo;</strong>, of voeg zelf een hoofdmenu-item toe.</>}
        </div>
      )}
      <p className="nv-uitleg">
        Elke kolom is een hoofdmenu-item, eronder staan het submenu en alle pagina&rsquo;s die qua adres onder dat menu-item vallen.
        De laatste kolom bevat de pagina&rsquo;s die nergens in het menu terugkomen: die zijn voor een bezoeker alleen via een link in een tekst of via Google te vinden. Grijs = nog niets aan gedaan · oranje = onderweg · groen = alle zeven fases klaar · rood = pagina bestaat nog niet.
        Per pagina staan drie getallen: het aantal woorden eigen tekst (zonder menu en footer), de score 0-100 voor hoe goed de pagina is ingericht
        (tekst, koppen, meta, alt-teksten, interne links en structured data) en het percentage van de zeven fases dat klaar is. Zweef over een score voor de onderbouwing.
        De score komt uit de wekelijkse scan, dus niet uit dit moment; pas je vandaag iets aan, klik dan op de meetknop. Een tilde (~) bij het woordaantal betekent dat het nog een schatting is.
      </p>
    </div>
  );
}

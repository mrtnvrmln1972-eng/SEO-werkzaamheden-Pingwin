"use client";

// ═══════════════════════════════════════════════════════════
// DE ENE LIJST: ALLE PAGINA'S, ÉÉN UITKOMST PER PAGINA
// ═══════════════════════════════════════════════════════════
// Het scherm had twaalf blokken die allemaal dezelfde vraag beantwoordden: wat
// gebeurt er met deze pagina. Ze verschilden alleen in waarom een pagina erin
// terechtkwam, en dat leverde 22 dubbele regels op van de 184.
//
// Hier staat elke pagina één keer, met één uitkomst. Waarom hij erin staat is
// een label geworden waarop je kunt filteren, en groeperen kan op uitkomst of op
// plaats/onderwerp. De losse blokken blijven eronder bestaan met de volledige
// onderbouwing; die zijn nu de verdieping, niet de hoofdmoot.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";

type Uitkomst = "uitbouwen" | "samenvoegen" | "blijft" | "opruimen" | "nieuw";
type Herkomst = "plaats" | "onderwerp" | "kans" | "gat" | "cannibalisatie" | "chat";
type Regel = {
  pad: string; uitkomst: Uitkomst; naar: string; herkomst: Herkomst[]; reden: string; onderbouwing: string[];
  term: string; volume: number | null; klikken: number; vertoningen: number; positie: number | null; groep: string;
  /** Staat de omleiding al op de site? Komt uit de vaste regels, dus ook uit een
      eerdere sessie of uit de oude tabel. */
  doorgevoerd?: boolean;
  /** Bij een samenvoeging: is de content al overgezet naar het doel? */
  contentOver?: boolean;
};
type Data = { regels: Regel[]; tellingen: Record<Uitkomst, number> & { totaal: number }; lijstDatum: string | null; voorstellen?: Voorstel[] };

// ── Waar moet een pagina die weggaat heen? ──
// Een 301 draagt alleen iets over als de doelpagina een redelijke vervanging is,
// gezien vanuit de bezoeker. De ladder erachter staat in lib/opruim-doelvinder.ts;
// hier tonen we per pagina welke trede het geworden is, waarom, en wat er nodig
// is om het door te voeren.
type Trede = "opvolger" | "zuster" | "hub" | "410" | "homepage";
type Voorstel = {
  van: string; doel: string; trede: Trede; zeker: "hoog" | "middel" | "laag";
  kort: string; waarom: string[]; waarschuwingen: string[]; vast: boolean;
  gewicht: { refDomains: number | null; klikken: number; vertoningen: number };
};
type TestUitslag = {
  goed: boolean; oordeel: "goed" | "let-op" | "fout"; meldingen: string[];
  hops: { url: string; status: number }[]; eind: string; eindStatus: number | null;
};

// ── Het samenvoeg-briefje ──
// Samenvoegen is content overzetten en dán pas redirecten; een 301 naar een
// doel waar de inhoud niet op staat draagt niets over (soft 404). Het briefje
// (lib/opruim-samenvoegen.ts) zegt per samenvoeging wat het doel nog mist, en
// levert de kant-en-klare instructie voor de sitebouwer.
type Briefje = {
  van: string; naar: string;
  oordeel: "overzetten" | "meteen";
  redenen: string[];
  koppen: string[];
  termen: { keyword: string; klikken: number; vertoningen: number; positie: number | null }[];
  interneLinks: string[];
  instructie: string;
  voorbehoud: string;
  gemaaktOp: string;
};

const TREDE_LABEL: Record<Trede, string> = {
  opvolger: "trede 1 · inhoudelijke opvolger",
  zuster: "trede 2 · dichtstbijzijnde zuster",
  hub: "trede 3 · categorie erboven",
  "410": "trede 4 · 410, bewust weg",
  homepage: "trede 5 · homepage, laatste redmiddel",
};

const CHIP: Record<Uitkomst, string> = {
  uitbouwen: "keep", nieuw: "merge", samenvoegen: "merge", blijft: "", opruimen: "nodig",
};
const LABEL: Record<Uitkomst, string> = {
  uitbouwen: "uitbouwen", nieuw: "nieuw maken", samenvoegen: "samenvoegen", blijft: "laten staan", opruimen: "opruimen",
};
const WAT: Record<Uitkomst, string> = {
  uitbouwen: "Hier valt iets te halen: de pagina blijft en verdient een betere invulling.",
  nieuw: "Hier wordt op gezocht en de site heeft er niets voor.",
  samenvoegen: "Gaat op in een andere pagina, zodat Google niet meer hoeft te kiezen.",
  blijft: "Blijft ongewijzigd staan; geen aanleiding om er nu tijd in te steken.",
  opruimen: "Levert niets op, er is geen vraag, en er valt niets te vertellen.",
};
const HERKOMST_LABEL: Record<Herkomst, string> = {
  plaats: "plaatspagina", onderwerp: "onderwerp", kans: "gemiste kans", gat: "ontbreekt", cannibalisatie: "zit elkaar in de weg",
  chat: "besluit uit chat",
};

// De onderbouwing komt als losse zinnen binnen, met hooguit **vet** erin. Nooit
// ruwe sterretjes in beeld; dat is een harde regel.
function Zin({ tekst }: { tekst: string }) {
  const delen = tekst.split(/\*\*(.+?)\*\*/g);
  return <p>{delen.map((d, i) => (i % 2 ? <strong key={i}>{d}</strong> : <span key={i}>{d}</span>))}</p>;
}

/** Wat er op de kaart komt te staan. Per besluit een andere klus, want
    "uitbouwen" en "opruimen" zijn niet hetzelfde werk. */
function taakVoor(r: Regel): string {
  const wat = r.term ? ` voor "${r.term}"` : "";
  if (r.uitkomst === "uitbouwen") return `Bouw ${r.pad} uit${wat}`;
  if (r.uitkomst === "nieuw") return `Maak een nieuwe pagina${wat}: ${r.pad}`;
  if (r.uitkomst === "samenvoegen") return r.naar ? `Voeg ${r.pad} samen met ${r.naar}` : `Voeg ${r.pad} samen`;
  if (r.uitkomst === "opruimen") return `Ruim ${r.pad} op`;
  return `Beoordeel ${r.pad}`;
}

const padSleutel = (u: string) => (u || "").replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "").toLowerCase() || "/";

function perPad(lijst: Voorstel[]): Record<string, Voorstel> {
  const uit: Record<string, Voorstel> = {};
  for (const v of lijst) uit[padSleutel(v.van)] = v;
  return uit;
}

/**
 * Dezelfde lijst dient twee schermen: de cockpit en de deellink voor de klant.
 * Dat is bewust één component in plaats van twee, want een tweede versie loopt
 * altijd achter (precies wat er op 7 augustus gebeurde: de klantversie stond nog
 * op de opzet van vóór deze lijst). Met `token` haalt hij zijn data via de
 * publieke leesroute, en `alleenLezen` haalt alles weg wat iets vastlegt.
 */
export default function OpruimEenLijst({ slug, domain, token, alleenLezen, titel }: {
  slug: string; domain: string; token?: string; alleenLezen?: boolean; titel?: string;
}) {
  const [d, setD] = useState<Data | null>(null);
  const [bezig, setBezig] = useState(true);
  const [filter, setFilter] = useState<Uitkomst | "alles" | "chat">("alles");

  // Diepe link: ?besluit=chat opent de lijst meteen gefilterd op de besluiten
  // die vanuit een chat zijn geland. Zonder zo'n ingang zijn vijf regels tussen
  // honderdzeventig andere onvindbaar, en "zoek maar even" is geen oplevering.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("besluit") === "chat") setFilter("chat");
    } catch { /* geen query, geen filter */ }
  }, []);
  const [groep, setGroep] = useState<"uitkomst" | "groep">("uitkomst");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [uitleg, setUitleg] = useState<Record<string, boolean>>({});
  // Doorzetten naar de planning, per pagina. De kaart krijgt daar vanzelf zijn
  // fases; hier hoeven we die dus niet na te bouwen.
  const [planBezig, setPlanBezig] = useState("");
  const [klaar, setKlaar] = useState<Record<string, string>>({});
  // De voorgestelde bestemmingen, plus wat de knoppen ermee deden.
  const [doelen, setDoelen] = useState<Record<string, Voorstel>>({});
  const [doelBezig, setDoelBezig] = useState("");
  const [uitslag, setUitslag] = useState<Record<string, TestUitslag>>({});
  // Wat je in dit scherm net hebt doorgevoerd. De lijst zelf komt van de server en
  // wordt niet opnieuw opgehaald na elke redirect; zonder dit zou de teller pas na
  // een herlaadbeurt meelopen, en dan lijkt doorvoeren niets te doen.
  const [netGedaan, setNetGedaan] = useState<Record<string, boolean>>({});
  const [fout, setFout] = useState<Record<string, string>>({});
  // Melding "doelpagina compleet, optimalisatietaak staat op de planning".
  const [optMelding, setOptMelding] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");
  // Het samenvoeg-briefje per pagina, plus de stappen die je ermee zet.
  const [briefjes, setBriefjes] = useState<Record<string, Briefje>>({});
  const [briefjeBezig, setBriefjeBezig] = useState("");
  const [netOver, setNetOver] = useState<Record<string, boolean>>({});
  const [gekopieerd, setGekopieerd] = useState("");
  // Eén actie tegelijk. Via een ref en niet via state, want in de lus hieronder
  // is de state uit de render altijd een slag achter.
  const bezigRef = useRef(false);

  useEffect(() => {
    if (!slug && !token) return;
    let leeft = true;
    const bron = token
      ? `/api/share/opruim-werklijst?token=${encodeURIComponent(token)}`
      : `/api/admin/opruim-werklijst?slug=${encodeURIComponent(slug)}`;
    fetch(bron)
      .then((r) => r.json())
      .then((j) => {
        if (!leeft || !j?.ok) return;
        setD(j);
        // De klantversie krijgt de voorstellen mee in dezelfde opvraag (alleen
        // uit de bewaarde stand); de cockpit haalt ze apart op, want daar mogen
        // ze ook vers berekend worden.
        if (Array.isArray(j.voorstellen)) setDoelen(perPad(j.voorstellen));
      })
      .catch(() => { /* stil */ })
      .finally(() => { if (leeft) setBezig(false); });
    return () => { leeft = false; };
  }, [slug, token]);

  useEffect(() => {
    if (token || !slug) return;
    let leeft = true;
    fetch(`/api/admin/opruim-doelen?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (leeft && j?.ok && Array.isArray(j.voorstellen)) setDoelen(perPad(j.voorstellen)); })
      .catch(() => { /* een ontbrekend voorstel is geen kapot scherm */ });
    return () => { leeft = false; };
  }, [slug, token]);

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;

  /** Staat de omleiding van deze pagina al op de site? Uit de bewaarde stand, of
      uit wat je zojuist in dit scherm hebt doorgevoerd. */
  const gedaan = (pad: string, uitBestand?: boolean) => !!uitBestand || !!netGedaan[padSleutel(pad)];

  async function naarPlanning(r: Regel) {
    if (planBezig) return;
    setPlanBezig(r.pad);
    try {
      // Bij een samenvoeging met een briefje gaat de complete instructie voor de
      // sitebouwer mee: dan is de taak op de planning meteen ook de opdracht die
      // Maarten kan doorgeven, zonder terug te hoeven naar dit scherm.
      const b = briefjes[padSleutel(r.pad)];
      const instructie = b && b.oordeel === "overzetten" ? `\n\nInstructie voor de sitebouwer:\n${b.instructie}` : "";
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, week: 1, wie: "SEO", url: site(r.pad),
          taak: taakVoor(r),
          // De volledige onderbouwing gaat mee, zodat op de planning ook zonder
          // dit scherm te zien is waaróp het besluit rust.
          toelichting: [r.reden, ...r.onderbouwing].filter(Boolean).join(" ").replace(/\*\*/g, "") + instructie,
        }),
      }).then((x) => x.json());
      setKlaar((m) => ({ ...m, [r.pad]: d?.ok ? `Staat in week ${d.week}.` : (d?.error || "Toevoegen mislukte.") }));
    } catch { setKlaar((m) => ({ ...m, [r.pad]: "Toevoegen mislukte." })); }
    finally { setPlanBezig(""); }
  }
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  // ── De twee knoppen bij een voorgesteld doel ──
  // Testen leest alleen (en mag dus ook in een meekijk-sessie); plaatsen zet de
  // omleiding in de site en meet daarna zelf na of hij er echt staat. Wat er
  // uitkomt is wat je ziet: er wordt niets "gelukt" gemeld dat niet gemeten is.
  async function test(v: Voorstel) {
    if (bezigRef.current) return;
    bezigRef.current = true;
    setDoelBezig(v.van); setFout((m) => ({ ...m, [v.van]: "" }));
    try {
      const q = new URLSearchParams({ slug, actie: "test", van: v.van, naar: v.doel, gone: v.trede === "410" ? "1" : "0" });
      const j = await fetch(`/api/admin/opruim-doelen?${q}`).then((x) => x.json());
      if (j?.ok) setUitslag((m) => ({ ...m, [v.van]: j.test }));
      else setFout((m) => ({ ...m, [v.van]: j?.error || "De test lukte niet." }));
    } catch { setFout((m) => ({ ...m, [v.van]: "De test lukte niet." })); }
    finally { bezigRef.current = false; setDoelBezig(""); }
  }

  async function plaats(v: Voorstel) {
    if (bezigRef.current) return;
    bezigRef.current = true;
    setDoelBezig(v.van); setFout((m) => ({ ...m, [v.van]: "" }));
    try {
      const j = await fetch("/api/admin/opruim-doelen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, actie: "plaats", van: v.van, naar: v.doel, gone: v.trede === "410" }),
      }).then((x) => x.json());
      if (j?.test) setUitslag((m) => ({ ...m, [v.van]: j.test }));
      // Alleen als de server hem ook echt live heeft nagemeten telt hij mee; een
      // mislukte poging hoort de voortgang niet op te hogen.
      if (j?.ok) setNetGedaan((m) => ({ ...m, [padSleutel(v.van)]: true }));
      // Was dit de laatste samenvoeging naar dit doel, dan meldt de server dat er
      // een optimalisatietaak voor de doelpagina op de planning is gezet.
      if (j?.ok && j.optimalisatie) setOptMelding((m) => ({ ...m, [v.van]: String(j.optimalisatie) }));
      if (!j?.ok && j?.error) setFout((m) => ({ ...m, [v.van]: j.error }));
    } catch { setFout((m) => ({ ...m, [v.van]: "Doorvoeren lukte niet." })); }
    finally { bezigRef.current = false; setDoelBezig(""); }
  }

  /** Alles in één keer: rij voor rij, zodat je onderweg ziet hoe ver het is en
      een fout op één pagina de rest niet tegenhoudt. */
  async function allemaal(lijst: Voorstel[], wat: "test" | "plaats") {
    if (bezigRef.current || !lijst.length) return;
    for (let i = 0; i < lijst.length; i++) {
      setBulk(`${wat === "test" ? "Testen" : "Doorvoeren"}: ${i + 1} van ${lijst.length}…`);
      // eslint-disable-next-line no-await-in-loop
      await (wat === "test" ? test(lijst[i]) : plaats(lijst[i]));
    }
    setBulk("");
  }

  // ── Samenvoegen: eerst de content, dan pas de redirect ──

  /** Een samenvoeg-regel heeft zijn doel al (r.naar); voor de plaats/test-knoppen
      gieten we hem in dezelfde vorm als een keuzeladder-voorstel. */
  const alsVoorstel = (r: Regel): Voorstel => ({
    van: padSleutel(r.pad), doel: r.naar, trede: "opvolger", zeker: "hoog",
    kort: "", waarom: [], waarschuwingen: [], vast: false,
    gewicht: { refDomains: null, klikken: r.klikken, vertoningen: r.vertoningen },
  });

  async function haalBriefje(r: Regel, opnieuw = false) {
    if (briefjeBezig) return;
    const pad = padSleutel(r.pad);
    setBriefjeBezig(pad); setFout((m) => ({ ...m, [pad]: "" }));
    try {
      const q = new URLSearchParams({ slug, actie: "briefje", van: pad, naar: r.naar, ...(opnieuw ? { opnieuw: "1" } : {}) });
      const j = await fetch(`/api/admin/opruim-doelen?${q}`).then((x) => x.json());
      if (j?.ok && j.briefje) setBriefjes((m) => ({ ...m, [pad]: j.briefje }));
      else setFout((m) => ({ ...m, [pad]: j?.error || "Het briefje maken lukte niet." }));
    } catch { setFout((m) => ({ ...m, [pad]: "Het briefje maken lukte niet." })); }
    finally { setBriefjeBezig(""); }
  }

  async function zetContentOver(r: Regel) {
    if (briefjeBezig) return;
    const pad = padSleutel(r.pad);
    setBriefjeBezig(pad); setFout((m) => ({ ...m, [pad]: "" }));
    try {
      const j = await fetch("/api/admin/opruim-doelen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, actie: "contentover", van: pad, naar: r.naar, waarde: true }),
      }).then((x) => x.json());
      if (j?.ok) setNetOver((m) => ({ ...m, [pad]: true }));
      else setFout((m) => ({ ...m, [pad]: j?.error || "Vastleggen lukte niet." }));
    } catch { setFout((m) => ({ ...m, [pad]: "Vastleggen lukte niet." })); }
    finally { setBriefjeBezig(""); }
  }

  async function kopieerInstructie(pad: string, b: Briefje) {
    try {
      await navigator.clipboard.writeText(b.instructie);
      setGekopieerd(pad);
      window.setTimeout(() => setGekopieerd((h) => (h === pad ? "" : h)), 2500);
    } catch { /* dan maar selecteren met de hand */ }
  }

  /** De cel "Waarheen" voor een samenvoeging: het doel staat vast, maar de
      redirect gaat er pas op als de content over is. Het briefje zegt wát er
      over moet; is er niets over te zetten, dan mag de knop meteen. */
  function SamenvoegCel({ r }: { r: Regel }) {
    const pad = padSleutel(r.pad);
    const klaar = gedaan(r.pad, r.doorgevoerd);
    const b = briefjes[pad];
    const over = !!netOver[pad] || !!r.contentOver;
    const v = alsVoorstel(r);
    const u = uitslag[v.van];
    const magPlaatsen = over || b?.oordeel === "meteen";
    return (
      <div className="opr-doel">
        <Link p={r.naar} />
        {klaar && <div className="opr-doel-trede"><span className="opr-chip keep">staat op de site</span></div>}
        {!klaar && !b && (
          <div className="opr-doel-acties">
            <button type="button" className={over ? "btn btn-ghost btn-klein" : "btn btn-primary btn-klein"} disabled={!!briefjeBezig || !!doelBezig}
              onClick={() => void haalBriefje(r)}
              title="Vergelijk deze pagina met het doel: welke secties en zoektermen mist het doel nog? Daar komt een kant-en-klare instructie voor de sitebouwer uit.">
              {briefjeBezig === pad ? "Bezig…" : "Wat moet er over?"}
            </button>
            {/* Het vinkje kan uit een eerdere sessie komen; dan hoeft het briefje
                niet opnieuw open om de redirect te kunnen plaatsen. */}
            {over && (
              <>
                <span className="opr-chip keep">content overgezet</span>
                <button type="button" className="btn btn-primary btn-klein" disabled={!!doelBezig || !!bulk || !!briefjeBezig}
                  onClick={() => void plaats(v)}
                  title={`Zet de 301 van ${pad} naar ${r.naar} in de website en meet daarna na of hij er echt staat.`}>
                  {doelBezig === v.van ? "Bezig…" : "Plaats redirect"}
                </button>
                <button type="button" className="btn btn-ghost btn-klein" disabled={!!doelBezig || !!bulk || !!briefjeBezig}
                  onClick={() => void test(v)}
                  title="Open het oude adres en kijk wat er echt gebeurt: welke status, hoeveel tussenstappen, en of het eindpunt bestaat en indexeerbaar is.">
                  Test redirect
                </button>
              </>
            )}
          </div>
        )}
        {!klaar && b && (
          <div className={`opr-brief ${b.oordeel === "meteen" ? "goed" : ""}`}>
            {b.oordeel === "meteen"
              ? <strong>Niets over te zetten: de redirect kan meteen.</strong>
              : <strong>Eerst content overzetten, dan pas de redirect.</strong>}
            {b.redenen.map((z, i) => <span key={i}>{z}</span>)}
            {b.oordeel === "overzetten" && (
              <div className="opr-brief-lijsten">
                {b.koppen.length > 0 && (
                  <div>
                    <em>Secties die het doel mist:</em>
                    <ul>{b.koppen.slice(0, 6).map((k, i) => <li key={i}>{k}</li>)}
                      {b.koppen.length > 6 && <li>en nog {b.koppen.length - 6} meer (staan in de instructie)</li>}</ul>
                  </div>
                )}
                {b.termen.length > 0 && (
                  <div>
                    <em>Zoektermen die het doel nog niet dekt:</em>
                    <ul>{b.termen.slice(0, 6).map((t, i) => (
                      <li key={i}>&ldquo;{t.keyword}&rdquo; ({t.klikken > 0 ? `${t.klikken} bezoekers, ` : ""}{t.vertoningen} vertoningen)</li>
                    ))}
                      {b.termen.length > 6 && <li>en nog {b.termen.length - 6} meer (staan in de instructie)</li>}</ul>
                  </div>
                )}
                {b.interneLinks.length > 0 && (
                  <div>
                    <em>Interne links die om moeten:</em>
                    <ul>{b.interneLinks.slice(0, 4).map((p, i) => <li key={i}><Link p={p} /></li>)}
                      {b.interneLinks.length > 4 && <li>en nog {b.interneLinks.length - 4} meer (staan in de instructie)</li>}</ul>
                  </div>
                )}
              </div>
            )}
            <div className="opr-doel-acties">
              {b.oordeel === "overzetten" && (
                <button type="button" className="btn btn-ghost btn-klein" disabled={!!briefjeBezig}
                  onClick={() => void kopieerInstructie(pad, b)}
                  title="Kopieer de complete stap-voor-stap instructie voor de sitebouwer. Via “Naar planning” gaat dezelfde instructie mee op de taakkaart.">
                  {gekopieerd === pad ? "Gekopieerd" : "Kopieer instructie"}
                </button>
              )}
              {b.oordeel === "overzetten" && !over && (
                <button type="button" className="btn btn-ghost btn-klein" disabled={!!briefjeBezig}
                  onClick={() => { if (window.confirm(`Staat alles uit het briefje echt op ${r.naar}? Dit vinkje zet de redirect-knop open.`)) void zetContentOver(r); }}
                  title="Vink aan dat de content op het doel staat. Pas daarna gaat de redirect-knop open.">
                  Content staat over
                </button>
              )}
              {over && b.oordeel === "overzetten" && <span className="opr-chip keep">content overgezet</span>}
              {magPlaatsen && (
                <>
                  <button type="button" className="btn btn-primary btn-klein" disabled={!!doelBezig || !!bulk || !!briefjeBezig}
                    onClick={() => void plaats(v)}
                    title={`Zet de 301 van ${pad} naar ${r.naar} in de website en meet daarna na of hij er echt staat.`}>
                    {doelBezig === v.van ? "Bezig…" : "Plaats redirect"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-klein" disabled={!!doelBezig || !!bulk || !!briefjeBezig}
                    onClick={() => void test(v)}
                    title="Open het oude adres en kijk wat er echt gebeurt: welke status, hoeveel tussenstappen, en of het eindpunt bestaat en indexeerbaar is.">
                    Test redirect
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {u && (
          <div className={`opr-doel-uitslag ${u.oordeel}`}>
            <strong>{u.oordeel === "goed" ? "Werkt" : u.oordeel === "let-op" ? "Werkt, met een kanttekening" : "Werkt niet"}</strong>
            {u.meldingen.map((m, i) => <span key={i}>{m}</span>)}
            <a className="opr-doel-zelf" href={`${site(pad)}?pingwin-controle=1`} target="_blank" rel="noreferrer">
              Zelf controleren, zonder cache
            </a>
          </div>
        )}
        {optMelding[v.van] && (
          <div className="opr-doel-uitslag goed">
            <strong>Doelpagina compleet</strong>
            <span>{optMelding[v.van]}</span>
          </div>
        )}
        {fout[pad] && <div className="opr-doel-uitslag fout"><span>{fout[pad]}</span></div>}
      </div>
    );
  }

  /** De cel "Waarheen" voor een pagina die nog geen bestemming had: het voorstel
      uit de keuzeladder, met de knoppen om het door te voeren en na te meten. */
  function Doelcel({ r }: { r: Regel }) {
    const v = doelen[padSleutel(r.pad)];
    if (!v) return <span className="opr-leeg">&mdash;</span>;
    const u = uitslag[v.van];
    const gone = v.trede === "410";
    const klaar = gedaan(r.pad, r.doorgevoerd);
    return (
      <div className="opr-doel">
        {gone ? <span className="opr-chip nodig">410, bewust weg</span> : <Link p={v.doel} />}
        <div className="opr-doel-trede">
          {TREDE_LABEL[v.trede]}
          {v.vast ? " · door jou vastgelegd" : v.zeker === "hoog" ? "" : ` · ${v.zeker} zeker`}
        </div>
        {klaar && <div className="opr-doel-trede"><span className="opr-chip keep">staat op de site</span></div>}
        {!alleenLezen && (
          <div className="opr-doel-acties">
            {/* Al doorgevoerd? Dan is de hoofdactie niet meer "plaats", maar hooguit
                nog een keer plaatsen als de test laat zien dat er iets mis is. */}
            <button type="button" className={klaar ? "btn btn-ghost btn-klein" : "btn btn-primary btn-klein"} disabled={!!doelBezig || !!bulk}
              onClick={() => void plaats(v)}
              title={gone ? "Zet deze pagina op 410 in de website: bewust weg, geen omleiding." : `Zet de 301 van ${v.van} naar ${v.doel} in de website en meet daarna na of hij er echt staat.`}>
              {doelBezig === v.van ? "Bezig…" : klaar ? "Opnieuw plaatsen" : gone ? "Zet op 410" : "Plaats redirect"}
            </button>
            <button type="button" className="btn btn-ghost btn-klein" disabled={!!doelBezig || !!bulk}
              onClick={() => void test(v)}
              title="Open het oude adres en kijk wat er echt gebeurt: welke status, hoeveel tussenstappen, en of het eindpunt bestaat en indexeerbaar is.">
              Test redirect
            </button>
          </div>
        )}
        {u && (
          <div className={`opr-doel-uitslag ${u.oordeel}`}>
            <strong>{u.oordeel === "goed" ? "Werkt" : u.oordeel === "let-op" ? "Werkt, met een kanttekening" : "Werkt niet"}</strong>
            {u.meldingen.map((m, i) => <span key={i}>{m}</span>)}
            {/* Zelf controleren zonder dat je browser of de cache van de site je
                de oude pagina voorschotelt. Zonder deze link klik je op het pad
                in de eerste kolom en zie je iets anders dan de test zag. */}
            <a className="opr-doel-zelf" href={`${site(v.van)}?pingwin-controle=1`} target="_blank" rel="noreferrer">
              Zelf controleren, zonder cache
            </a>
          </div>
        )}
        {fout[v.van] && <div className="opr-doel-uitslag fout"><span>{fout[v.van]}</span></div>}
      </div>
    );
  }

  if (bezig) return <div className="muted opr-str-laden">De werklijst wordt samengesteld…</div>;
  if (!d || !d.regels.length) return null;

  const rijen = filter === "alles" ? d.regels
    : filter === "chat" ? d.regels.filter((r) => r.herkomst.includes("chat"))
    : d.regels.filter((r) => r.uitkomst === filter);
  const chatTeller = d.regels.filter((r) => r.herkomst.includes("chat")).length;

  // ── Hoever zijn we? ──
  // De kaarten telden alleen werk: "38 opruimen", ook als er al dertig van live
  // stonden. Dat leest als een lijst die nooit korter wordt. Hier tellen we per
  // besluit mee hoeveel er al op de site staan.
  const telGedaan = (lijst: Regel[]) => lijst.filter((r) => gedaan(r.pad, r.doorgevoerd)).length;
  const gedaanIn = (u: Uitkomst) => telGedaan(d.regels.filter((r) => r.uitkomst === u));
  const voortgang = (klaar: number, totaal: number) =>
    totaal === 0 ? "" : klaar === 0 ? "nog niets doorgevoerd"
      : klaar >= totaal ? "alles doorgevoerd"
        : `${klaar} doorgevoerd, nog ${totaal - klaar} te gaan`;

  // De voorstellen die bij de zichtbare rijen horen: waar je nu naar kijkt, is
  // ook waar "voer alles door" over gaat. Anders zet één klik iets recht dat je
  // niet op je scherm had staan. Wat al op de site staat valt eraf, zodat de knop
  // niet dertig omleidingen opnieuw plaatst die er allang zijn.
  const zichtbareVoorstellen = rijen
    .filter((r) => !r.naar && !gedaan(r.pad, r.doorgevoerd))
    .map((r) => doelen[padSleutel(r.pad)])
    .filter((v): v is Voorstel => !!v);
  const alGedaanZichtbaar = telGedaan(rijen.filter((r) => !r.naar));
  const telTrede = (t: Trede) => zichtbareVoorstellen.filter((v) => v.trede === t).length;

  // Groeperen op plaats of onderwerp: dezelfde regels, andere indeling.
  //
  // Met één correctie die uit het nameten kwam: op besluit groeperen geeft vijf
  // groepen, op plaats of onderwerp gaf er 123. Dat is geen view maar een
  // opsomming van 123 tabelletjes van één regel. Een groep van één is geen groep;
  // die regels gaan samen onderaan, zodat de echte clusters overblijven.
  const ruw = new Map<string, Regel[]>();
  for (const r of rijen) {
    const k = groep === "uitkomst" ? LABEL[r.uitkomst] : (r.groep || "overig");
    if (!ruw.has(k)) ruw.set(k, []);
    ruw.get(k)!.push(r);
  }
  const groepen = new Map<string, Regel[]>();
  const los: Regel[] = [];
  for (const [k, lijst] of ruw) {
    if (groep === "groep" && lijst.length < 2) los.push(...lijst);
    else groepen.set(k, lijst);
  }
  if (los.length) groepen.set(`Losse pagina's (${los.length})`, los.sort((a, b) => (b.volume || 0) - (a.volume || 0)));
  const volgorde = [...groepen.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="opr-kaart">
      {titel && <div className="opr-kop">{titel}</div>}
      <div className="opr-str-kpi">
        <div><b>{d.tellingen.totaal}</b><span>pagina&rsquo;s met een besluit</span></div>
        <div><b>{d.tellingen.uitbouwen}</b><span>uitbouwen</span></div>
        <div>
          <b>{d.tellingen.samenvoegen}</b><span>samenvoegen</span>
          <span className="opr-kpi-sub">{voortgang(gedaanIn("samenvoegen"), d.tellingen.samenvoegen)}</span>
        </div>
        <div>
          <b>{d.tellingen.opruimen}</b><span>opruimen</span>
          <span className="opr-kpi-sub">{voortgang(gedaanIn("opruimen"), d.tellingen.opruimen)}</span>
        </div>
        <div><b>{d.tellingen.nieuw}</b><span>nieuw maken</span></div>
      </div>

      <div className="opr-kaart-tekst">
        {alleenLezen ? (
          <p>
            Dit is <strong>alles bij elkaar</strong>: elke pagina van de website staat hier één keer, met één besluit.
            Achter &ldquo;waarom&rdquo; klapt de volledige onderbouwing open, met de cijfers waarop het besluit rust.
            Met de knoppen hieronder bekijkt u de lijst per soort besluit, of gegroepeerd per plaats of onderwerp.
          </p>
        ) : (
          <p>
            Dit is <strong>alles bij elkaar</strong>: elke pagina staat hier één keer, met één besluit. Waarom een pagina
            in de lijst staat is een label geworden waar je op kunt filteren; de volledige onderbouwing staat in de
            blokken hieronder. <strong>Samenvoegen gaat in twee stappen:</strong> eerst zegt het briefje wat er van de
            oude pagina naar het doel over moet (met de instructie voor de sitebouwer erbij), en pas als dat gebeurd is
            gaat de redirect-knop open. Is er niets over te zetten, dan zegt het briefje dat ook en kan de redirect meteen.
          </p>
        )}
      </div>

      <div className="opr-vorm-rij">
        {(["alles", "uitbouwen", "samenvoegen", "nieuw", "opruimen", "blijft"] as const).map((k) => (
          <button key={k} type="button" className={"btn btn-klein" + (filter === k ? " actief" : "")} onClick={() => setFilter(k)}>
            {k === "alles" ? `alles (${d.tellingen.totaal})` : `${LABEL[k]} (${d.tellingen[k]})`}
          </button>
        ))}
        {chatTeller > 0 && (
          <button type="button" className={"btn btn-klein" + (filter === "chat" ? " actief" : "")} onClick={() => setFilter("chat")}
            title="Alleen de besluiten die vanuit een chat-analyse op deze lijst zijn gezet.">
            besluit uit chat ({chatTeller})
          </button>
        )}
        <span style={{ marginLeft: "var(--s-4)" }}>
          <button type="button" className={"btn btn-klein" + (groep === "uitkomst" ? " actief" : "")} onClick={() => setGroep("uitkomst")}>
            per besluit
          </button>
          <button type="button" className={"btn btn-klein" + (groep === "groep" ? " actief" : "")} onClick={() => setGroep("groep")}>
            per plaats of onderwerp
          </button>
        </span>
      </div>

      {!alleenLezen && zichtbareVoorstellen.length > 0 && (
        <div className="opr-doel-balk">
          <div className="opr-doel-balk-tekst">
            <strong>
              {zichtbareVoorstellen.length} van deze pagina&rsquo;s {zichtbareVoorstellen.length === 1 ? "wacht" : "wachten"} nog op zijn bestemming.
              {alGedaanZichtbaar > 0 && ` ${alGedaanZichtbaar} ${alGedaanZichtbaar === 1 ? "staat" : "staan"} er al op.`}
            </strong>
            <span>
              {telTrede("410") > 0 && `${telTrede("410")} krijgt geen omleiding maar een 410 (bewust weg): er is geen doel dat de bezoeker echt helpt, en een omleiding naar iets dat er net niet over gaat draagt niets over. `}
              Test eerst, voer daarna door. Doorvoeren meet zichzelf na, en wat al doorgevoerd is blijft buiten deze knoppen.
            </span>
          </div>
          <div className="opr-doel-acties">
            <button type="button" className="btn btn-ghost btn-klein" disabled={!!bulk || !!doelBezig}
              onClick={() => void allemaal(zichtbareVoorstellen, "test")}>
              Test alle voorstellen
            </button>
            <button type="button" className="btn btn-primary btn-klein" disabled={!!bulk || !!doelBezig}
              onClick={() => { if (window.confirm(`${zichtbareVoorstellen.length} bestemmingen doorvoeren op de website. Elke regel wordt daarna nagemeten. Doorgaan?`)) void allemaal(zichtbareVoorstellen, "plaats"); }}>
              Voer alles door
            </button>
            {bulk && <span className="opr-doel-balk-stand">{bulk}</span>}
          </div>
        </div>
      )}

      {/* Elke groep is een uitklapper en staat standaard dicht. Eén groep telde bij
          One Day Clinic 38 pagina's; opengeklapt duwt dat de andere vier besluiten
          van het scherm af. Dicht zie je in vijf regels waar het werk zit, en klap
          je open wat je gaat doen. Is er maar één groep (je hebt gefilterd), dan
          staat hij open: dan is die groep juist waar je voor kwam. */}
      {volgorde.map(([naam, lijst]) => (
        <details key={naam} className="opr-onderwerp" open={volgorde.length === 1 || filter !== "alles"}>
          <summary className="opr-onderwerp-kop">
            <span className="opr-onderwerp-titel">{naam}</span>
            <span className="opr-chip">{lijst.length} pagina&rsquo;s</span>
            {telGedaan(lijst) > 0 && <span className="opr-chip keep">{telGedaan(lijst)} doorgevoerd</span>}
          </summary>
          <div className="opr-scroll">
            <table className="opr-tabel">
              <thead>
                <tr>
                  <th>Pagina</th><th>Besluit</th><th>Waarheen</th><th>Per maand</th><th>Nu</th><th>Waarom</th>
                  {!alleenLezen && <th>Actie</th>}
                </tr>
              </thead>
              <tbody>
                {lijst.slice(0, open[naam] ? 500 : 15).map((r) => (
                  <React.Fragment key={r.pad}>
                  <tr>
                    <td>
                      <Link p={r.pad} />
                      <div className="opr-eind-slokt">{r.herkomst.map((h) => HERKOMST_LABEL[h]).join(" · ")}</div>
                    </td>
                    <td><span className={`opr-chip ${CHIP[r.uitkomst]}`} title={WAT[r.uitkomst]}>{LABEL[r.uitkomst]}</span></td>
                    <td>
                      {/* Een samenvoeging heeft zijn doel al, maar de redirect mag er
                          pas op als de content over is; die twee stappen staan in de
                          SamenvoegCel. De klantversie ziet alleen het doel. */}
                      {r.uitkomst === "samenvoegen" && r.naar && !alleenLezen
                        ? <SamenvoegCel r={r} />
                        : r.naar ? <Link p={r.naar} /> : <Doelcel r={r} />}
                      {r.naar && (alleenLezen || r.uitkomst !== "samenvoegen") && gedaan(r.pad, r.doorgevoerd) && <div><span className="opr-chip keep">staat op de site</span></div>}
                    </td>
                    <td>{r.volume != null ? `${r.volume}x` : <span className="opr-leeg">&mdash;</span>}</td>
                    <td>
                      {r.klikken > 0 ? <strong>{r.klikken} bezoekers</strong> : r.vertoningen > 0 ? `${r.vertoningen} vert.` : <span className="opr-leeg">niets</span>}
                      {r.positie != null && <div className="opr-eind-slokt">plek {Math.round(r.positie)}</div>}
                    </td>
                    <td className="opr-reden">
                      {r.reden}
                      {r.onderbouwing.length > 0 && (
                        <div>
                          <button type="button" className="opr-meer" onClick={() => setUitleg((m) => ({ ...m, [r.pad]: !m[r.pad] }))}>
                            {uitleg[r.pad] ? "▾ minder" : "▸ volledige onderbouwing"}
                          </button>
                        </div>
                      )}
                    </td>
                    {!alleenLezen && (
                      <td>
                        <button type="button" className="btn btn-klein opr-btn" disabled={!!planBezig} onClick={() => void naarPlanning(r)}
                          title="Zet deze pagina als taak op de planning. De kaart krijgt daar vanzelf zijn fases, met de onderbouwing erbij.">
                          {planBezig === r.pad ? "Bezig…" : "Naar planning"}
                        </button>
                        {klaar[r.pad] && <div className="opr-melding" style={{ marginTop: "var(--s-1)" }}>{klaar[r.pad]}</div>}
                      </td>
                    )}
                  </tr>
                  {/* De volledige onderbouwing als eigen rij over alle kolommen, in
                      dezelfde kaart met drie kolommen als de losse blokken. Stond
                      alleen in die blokken, waardoor je vanuit de hoofdlijst niet
                      kon zien waarop een besluit rustte. */}
                  {uitleg[r.pad] && r.onderbouwing.length > 0 && (
                    <tr className="opr-redenrij">
                      <td colSpan={alleenLezen ? 6 : 7}>
                        <div className="opr-uitleg">
                          <div className="opr-bewijs">
                            {r.onderbouwing.map((z, i) => <Zin key={i} tekst={z} />)}
                            {(() => {
                              const v = doelen[padSleutel(r.pad)];
                              if (!v || r.naar) return null;
                              return (
                                <div className="opr-doel-waarom">
                                  <Zin tekst={`**Waar deze pagina heen gaat:** ${v.kort}`} />
                                  {v.waarom.map((z, i) => <Zin key={i} tekst={z} />)}
                                  {v.waarschuwingen.map((w, i) => (
                                    <div key={i} className="opr-doel-waarschuw"><Zin tekst={w} /></div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {lijst.length > 15 && (
            <button type="button" className="opr-meer" onClick={() => setOpen((m) => ({ ...m, [naam]: !m[naam] }))}>
              {open[naam] ? "▾ minder" : `▸ nog ${lijst.length - 15} pagina's`}
            </button>
          )}
        </details>
      ))}
    </div>
  );
}

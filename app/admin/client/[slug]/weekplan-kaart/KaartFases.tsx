"use client";

// De cyclus op de projectkaart: zeven fases onder elkaar, elk met de live stand,
// een startknop waar een motor bestaat en een vinkje om hem met de hand om te
// zetten. Hier zitten ook de motoren zelf achter (analyse, blauwdruk, copy,
// gelieerde pagina's, structured data) en de bewaking van een lopende run.

import { useEffect, useState } from "react";
import { splitCardInfo, faseSturing, verseCopySturing, isSjabloonSturing, type CardFaseKey } from "../../../../../lib/card-info";
import { netteHtml } from "../../../../../lib/nette-html";
import { docsBewerkLink } from "../../../../../lib/drive-id";
import { volgendeFase, faseLabel } from "../../../../../lib/fase-volgorde";
import { isPoortBlokkade } from "../../../../../lib/keten-poort-melding";
import type { DriveMap } from "../DriveMapKiezer";
import type { NaarDev } from "./KaartOnderRegel";
import type { Meting } from "./KaartControle";
import { FASEN } from "./fase-iconen";
import type { FaseKey, WpTask, WpPageInfo } from "./types";

type RunInfo = { status: string; steps: Record<string, string>; links: Record<string, string>; error?: string } | null;

/** Dichtgeklapt: compacte fase-chips. Klik = de kaart openen. */
export function FaseChips({ page, onToggleOpen }: { page: WpPageInfo; onToggleOpen: () => void }) {
  return (
    <div className="wp-steps" title="De stand van deze pagina. Klik om de kaart te openen; daar kun je fases starten en afvinken."
      role="button" onClick={onToggleOpen}>
      {FASEN.map((f) => <span key={f.key} className={"wp-step" + (page[f.key] ? " wp-step-done" : "")}>{page[f.key] ? "✓ " : ""}{f.kort}</span>)}
      {/* Dezelfde berekening als de knop in het fase-blok: bestaat de pagina
          nog niet, dan wordt analyse overgeslagen. Eerder rekende de chip het
          zelf uit en zei hij "Volgende: Strategie" terwijl de knop ernaast
          "Blauwdruk + copy" startte. */}
      {(() => { const f = volgendeFase(page, page.live); return f ? <span className="wp-step wp-step-next">Volgende: {faseLabel(f)}</span> : <span className="wp-step wp-step-done">Alles klaar</span>; })()}
    </div>
  );
}

export default function KaartFases({
  slug, t, page, naarDev, driveMap, onKiesMap, ensureDriveMap,
  busy, setBusy, foutje, setFoutje, melding, setMelding,
  onBespreek, haalConclusie, onMail, refreshBoard, dev, doorgevoerd,
}: {
  slug: string; t: WpTask; page?: WpPageInfo; naarDev: boolean;
  driveMap: DriveMap | null; onKiesMap: () => void;
  /** Voert een actie pas uit zodra er een Drive-map is: is die er al, dan
      meteen; anders klapt de mapkiezer open en volgt de actie zodra je kiest
      (of blijft uit als je annuleert). Alle documenten van deze pagina horen
      in één map te landen, dus geen enkel document maakt hier meer zonder. */
  ensureDriveMap: (actie: () => void) => void;
  busy: string; setBusy: (v: string) => void;
  /** Fout en melding zijn van de hele kaart: ook de titel, het doorzetten naar de
      developer en het afronden van de chat schrijven erin. Ze worden hieronder
      getekend, want dit is de plek waar je ze in beeld verwacht. */
  foutje: string; setFoutje: (v: string) => void;
  melding: string; setMelding: (v: string) => void;
  onBespreek: (prefill: string) => void;
  haalConclusie: () => Promise<string>;
  onMail: (aud: "klant" | "dev") => void;
  refreshBoard: () => void;
  /** Zelfde doorzet-venster als de bottomregel: "Developer" in de
      Implementatie-rij opent precies dat venster, met dezelfde Drive-documenten
      erbij, in plaats van een tweede, eigen versie ervan te bouwen. */
  dev: NaarDev;
  /** De meting die de live pagina naast de afspraak legt. Hij hing ook als
      "Is dit doorgevoerd?" in de kaartkop; dat was dezelfde meting met een
      andere naam, dus die knop is weg en dit is de enige plek. De knop
      "Gedaan?" in de Implementatie-rij gebruikt hem; mist deze prop (kaarten
      zonder pagina), dan verschijnt die knop simpelweg niet. */
  doorgevoerd?: { controle: Meting; bezig: boolean; meet: () => Promise<Meting> };
}) {
  const [run, setRun] = useState<RunInfo>(null);
  const [everLinks, setEverLinks] = useState<Record<string, string>>({});
  const [schemaStatus, setSchemaStatus] = useState<string>(page?.structuredStatus || "idle");
  // Welke fases hun sturing tonen. Dicht is de standaard: je wilt de instructie
  // van de stap waar je mee bezig bent, niet die van alle vijf tegelijk.
  const [faseOpen, setFaseOpen] = useState<Record<string, boolean>>({});
  // Een fase met de hand op klaar zetten (of terugzetten). Zelfde weg als het
  // vinkje op het weekbord, dus beide schermen blijven gelijk lopen.
  const [vinkBezig, setVinkBezig] = useState<string>("");
  const [verifyMsg, setVerifyMsg] = useState<{ tekst: string; ok: boolean } | null>(null);
  // De link naar het zojuist geplaatste concept, zodat je er meteen heen kunt.
  const [conceptLink, setConceptLink] = useState<string>("");
  // Geen Drive-map gekozen en toch een document starten: de knop laat even
  // opvallen dat de mapkiezer daarom opengaat (de echte poort zit in
  // ensureDriveMap hieronder, dit is alleen het visuele signaal erbij).
  const [mapKnipper, setMapKnipper] = useState(false);
  function knipperMap() {
    setMapKnipper(true);
    setTimeout(() => setMapKnipper(false), 4000);
  }

  const runActive = !!run && run.status === "running";
  // Welke stappen zijn door de blokkade niet gemaakt: de stap die op de poort
  // stukliep plus alles wat daarna nog stond te wachten. "Toch genereren" pakt
  // precies die weer op, dus je verliest geen stap en genereert niets dubbel.
  const geblokkeerdeStappen = (["analyse", "blauwdruk", "copy"] as const)
    .filter((k) => run?.steps?.[k] === "error" || run?.steps?.[k] === "pending");
  const schemaRunning = schemaStatus === "running";

  useEffect(() => { setSchemaStatus(page?.structuredStatus || "idle"); }, [page?.structuredStatus]);

  // Run-status laden bij openen; pollen zolang er iets loopt (alleen deze open kaart).
  useEffect(() => {
    if (!t.url) return;
    let stop = false;
    const loadRun = async () => {
      try {
        const d = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
        if (stop || !d?.ok) return;
        setRun(d.run || null);
        setEverLinks(d.everLinks || {});
      } catch { /* stil */ }
    };
    void loadRun();
    const iv = setInterval(async () => {
      if (stop) return;
      const wasRunning = runActive || schemaRunning;
      await loadRun();
      if (schemaRunning) {
        try {
          const s = await fetch(`/api/admin/page-schema?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
          if (!stop && s?.ok) setSchemaStatus(String(s.status || "idle"));
        } catch { /* stil */ }
      }
      if (wasRunning) refreshBoard();
    }, 5000);
    return () => { stop = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.url, runActive, schemaRunning]);

  async function zetFase(fase: string, af: boolean) {
    if (!t.url || vinkBezig) return;
    setVinkBezig(fase);
    try {
      await fetch("/api/admin/weekplan/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, fase, done: af }) });
      refreshBoard();
    } catch { /* stil; het bord herlaadt zo toch */ } finally { setVinkBezig(""); }
  }

  async function bouwExtra(steps: ("analyse" | "blauwdruk" | "copy")[]): Promise<string> {
    const parsed = splitCardInfo(t.toelichting, t.taak);
    const delen = steps.map((s) => faseSturing(parsed, s)).filter(Boolean);
    const basis = delen[0] || t.toelichting.slice(0, 900);
    const extraFases = delen.slice(1).map((d) => d.split("Sturing voor deze stap:")[1] || "").filter(Boolean).join("; ");
    const conclusie = await haalConclusie();
    return [basis, extraFases ? `Ook: ${extraFases}` : "", conclusie ? `Conclusie uit de kaart-chat: ${conclusie}` : ""].filter(Boolean).join("\n\n").slice(0, 1500);
  }

  function startDocStep(steps: ("analyse" | "blauwdruk" | "copy")[]) {
    if (busy || runActive) return;
    // Pas echt starten zodra er een Drive-map is: is die er nog niet, dan klapt
    // de mapkiezer open en draait deze stap zodra je kiest. Alle documenten van
    // deze pagina horen in dezelfde map te landen, dus geen enkele stap start
    // meer zonder, ook niet per ongeluk.
    if (!driveMap) knipperMap();
    ensureDriveMap(() => void werkelijkStartDocStep(steps));
  }

  async function werkelijkStartDocStep(steps: ("analyse" | "blauwdruk" | "copy")[], negeerPoort = false) {
    if (busy || runActive) return;
    setBusy(steps.join("+")); setFoutje(""); setMelding(""); setConceptLink("");
    try {
      // Gerichte sturing: achtergrond + de sturing van deze fase(s) + de laatste
      // chat-conclusie, niet de hele kaarttekst (scherpere documenten, minder ruis).
      const extra = await bouwExtra(steps);
      const d = await fetch("/api/admin/page-doc/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, steps, extra, folderId: "", audience: "klant", negeerPoort }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else setRun({ status: "running", steps: Object.fromEntries(steps.map((s, i) => [s, i === 0 ? "running" : "pending"])), links: {} });
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  // Start "Gelieerde pagina's": de vastgelegde strategie wordt server-side de bron
  // voor het advies aan de andere cluster-pagina's (half plan), in één klik.
  async function startGelieerde() {
    if (busy) return;
    setBusy("gelieerde"); setFoutje(""); setMelding(""); setConceptLink("");
    try {
      const d = await fetch("/api/admin/page-cluster-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else if (!d.saved) setFoutje(d.message || "Geen concreet advies voor gelieerde pagina's gevonden.");
      else {
        setMelding(`Advies op ${d.saved} gelieerde ${d.saved === 1 ? "pagina" : "pagina's"} klaargezet.`);
        // Direct op klaar zetten via hetzelfde pad als het vinkje: de afgeleide
        // telling (hoeveel page_cluster_advice-rijen deze pagina als bron hebben)
        // bleek soms achter te lopen op wat er al wel is opgeslagen, waardoor de
        // knop na een geslaagde run gewoon "Start" bleef tonen en je zonder
        // waarschuwing dezelfde run nog een keer kon starten. Handmatig wint
        // altijd van de afgeleide stand, dus dit is meteen zichtbaar en ververst
        // het bord ook (zetFase doet dat zelf).
        await zetFase("gelieerde", true);
      }
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  // "Concept in site": de geldende copy als concept-pagina in de site zetten.
  // Zelfde motor als de knop die hiervoor in het documentenblok stond, dus geen
  // tweede weg naar hetzelfde; de link naar het geplaatste concept komt in de
  // meldingsregel onderaan dit blok, waar ook de andere uitkomsten staan.
  async function zetConceptInSite() {
    if (busy) return;
    setBusy("concept"); setFoutje(""); setMelding(""); setConceptLink("");
    try {
      const d = await fetch("/api/admin/copy-doorvoeren", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Het concept plaatsen lukte niet.");
      else { setMelding(d.detail || "De copy staat als concept in de site."); setConceptLink(d.previewUrl || ""); }
    } catch { setFoutje("Het concept plaatsen lukte niet; probeer het nog een keer."); } finally { setBusy(""); }
  }

  async function startSchema() {
    if (busy || schemaRunning) return;
    setBusy("structured"); setFoutje("");
    try {
      const d = await fetch("/api/admin/page-schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (!d?.ok) setFoutje(d?.error || "Starten mislukt.");
      else setSchemaStatus("running");
    } catch { setFoutje("Starten mislukt, probeer het nog een keer."); } finally { setBusy(""); }
  }

  // "Controleer live": staat het geadviseerde schema nu echt op de pagina?
  async function controleerLive() {
    if (busy) return;
    setBusy("verify"); setVerifyMsg(null); setFoutje("");
    try {
      const d = await fetch("/api/admin/page-schema/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url }) }).then((r) => r.json());
      if (d?.ok) setVerifyMsg({ tekst: d.melding || "", ok: !!d.geplaatst && !(d.dubbel || []).length });
      else setFoutje(d?.error || "Controleren mislukte.");
    } catch { setFoutje("Controleren mislukte; probeer het nog een keer."); } finally { setBusy(""); }
  }

  function faseStand(key: FaseKey): { label: string; cls: string } {
    const isDocStap = key === "analyse" || key === "blauwdruk" || key === "copy";
    // Een lopende run wint van "Klaar": bij een herrun moet je zíen dat hij draait.
    if (isDocStap && runActive) {
      const st = run?.steps?.[key] || "";
      if (st === "running") return { label: "Bezig…", cls: "wp-fase-bezig" };
      if (st === "pending") return { label: "Wacht", cls: "wp-fase-bezig" };
      if (st === "error") return { label: "Fout", cls: "wp-fase-fout" };
    }
    // De run is intussen gestopt (fout of timeout): zonder dit viel de rij terug
    // op "✕", precies hetzelfde beeld als vóór het klikken op Start. Je zag dan
    // geen fout, alleen dat de knop weer "Start" zei; de reden stond wel in de
    // database maar nergens in beeld. Alleen de stap die echt vastliep krijgt de
    // rode chip, en een nieuwere geslaagde run (page[key] alsnog waar) wint.
    if (isDocStap && run && run.status === "error" && run.steps?.[key] === "error" && !(page && page[key])) {
      return { label: "Fout", cls: "wp-fase-fout" };
    }
    if (key === "structured" && schemaRunning) return { label: "Bezig…", cls: "wp-fase-bezig" };
    if (page && page[key]) return { label: "✓", cls: "wp-fase-klaar" };
    // Bouw en publicatie bleef rood zolang de tekst niet live stond, ook als Maarten
    // zijn deel allang gedaan had en het bij de sitebouwer lag. Rood las dan als
    // "er moet nog iets van jou komen", terwijl er juist gewacht werd. Er zit een
    // stand tussen: doorgezet naar de developer, nog niet live.
    if (key === "bouw" && naarDev) return { label: "Bij de developer", cls: "wp-fase-wacht" };
    // Was grijze tekst "Nog niet". Een kruisje in dezelfde pilvorm leest sneller:
    // rood is niet af, groen is af, en je hoeft niets te lezen om dat te zien.
    return { label: "✕", cls: "wp-fase-open" };
  }

  function docLink(key: FaseKey): string {
    if (key === "analyse" || key === "blauwdruk" || key === "copy") {
      const extern = everLinks[key] || page?.links?.[key] || (key === "copy" ? t.copyUrl : "") || "";
      // Een Pingwin-document is altijd een Word-bestand, dus rechtstreeks in Docs
      // openen in plaats van in het kijkscherm van Drive. Geldt ook voor de links
      // die al lang in de database staan.
      if (extern) return docsBewerkLink(extern);
      // Wel gegenereerd maar geen Drive-bestand (geen map gekozen destijds): de
      // tekst staat in de database; link dan naar de interne documentweergave,
      // zodat een afgeronde stap nooit zonder link staat.
      if (page?.[key] && t.url) return `/admin/client/${slug}/document?kind=${key}&url=${encodeURIComponent(t.url)}`;
    }
    return "";
  }

  function faseActie(key: FaseKey): JSX.Element | null {
    const p = page;
    if (!p) return null;
    if (key === "strategie") {
      return <button type="button" className="btn btn-ghost btn-klein" title={p.strategie ? "Bespreek of stel de strategie bij in de kaart-chat" : "Stel in de kaart-chat een strategie voor deze pagina op"} onClick={() => onBespreek("Stel een strategie voor deze pagina voor. Houd rekening met de achtergrond van deze kaart.")}>Bespreek</button>;
    }
    if (key === "gelieerde") {
      const kan = p.strategie;
      return <button type="button" className="btn btn-ghost btn-klein" disabled={!kan || busy === "gelieerde"} title={kan ? "Haal advies voor gelieerde pagina's uit de vastgelegde strategie en zet het bij die pagina's klaar" : "Leg eerst de strategie vast; die is de bron voor het advies"} onClick={() => void startGelieerde()}>{busy === "gelieerde" ? "Bezig…" : p.gelieerde ? "Opnieuw ↻" : "Start ▷"}</button>;
    }
    if (key === "analyse" || key === "blauwdruk" || key === "copy") {
      const geblokkeerd = key === "analyse" ? !p.live : (!p.live && !p.strategie);
      const titel = key === "analyse"
        ? (p.live ? "Analyseer de huidige live pagina (met de kaart-achtergrond als sturing)" : "De pagina is nog niet live; een analyse kan pas daarna")
        : (geblokkeerd ? "Eerst de strategie goedkeuren (nieuwe pagina)" : "Start dit document (met de kaart-achtergrond en chat-conclusie als sturing)");
      const tekst = key === "analyse" && !p.live ? "Na livegang" : p[key] ? "Opnieuw ↻" : "Start ▷";
      return <button type="button" className="btn btn-ghost btn-klein" disabled={geblokkeerd || runActive || !!busy} title={titel} onClick={() => void startDocStep([key])}>{tekst}</button>;
    }
    if (key === "bouw") {
      const gedaanBezig = doorgevoerd?.bezig;
      return (
        <>
          {/* Concept in site: zet de geldende copy als concept-pagina in de site
              van de klant (de live pagina blijft ongemoeid; publiceren doe je in
              WordPress zelf). Deze knop stond onderin het documentenblok bovenaan
              de kaart, dus ver van de fase waar hij bij hoort: hij ís de eerste
              stap van Implementatie. Daar stond hij ook alleen als er een
              aangewezen copy-versie lag, terwijl de motor erachter zelf de
              geldende copy opzoekt. */}
          {t.url && p.copy && (
            <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy}
              title="Zet de geldende copy als concept (nog niet live) in de site. De bestaande, live pagina blijft ongewijzigd; publiceren doe je zelf in WordPress."
              onClick={() => void zetConceptInSite()}>
              {busy === "concept" ? "Plaatsen…" : "Concept in site"}
            </button>
          )}
          {/* Developer: zelfde doorzet-venster als de knop onderaan de kaart (met
              de Drive-documenten van deze pagina erbij), nu ook direct bij de fase
              waar hij hoort. Staat de kaart al bij de developer, dan haalt dezelfde
              knop hem er weer af. */}
          {dev && (
            <button type="button" className={"btn btn-ghost btn-klein" + (naarDev ? " wp-act-aan" : "")} disabled={dev.bezig}
              title={naarDev ? "Staat op de developerlijst. Klik om hem er weer af te halen." : "Zet deze kaart klaar voor de developer: de opdracht, de pagina en de documenten."}
              onClick={() => void dev.zetNaarDev()}>
              {dev.bezig ? "Bezig…" : naarDev ? "✓ Bij de developer" : "Developer"}
            </button>
          )}
          {/* Gedaan?: her-fetcht de live pagina en meet of de afgesproken wijziging
              er echt staat. Klopt dat, dan vinkt hij Implementatie meteen af, zodat
              je door kunt naar Structured data zonder dat apart te hoeven doen.
              Het vraagteken hoort in het label: de knop vinkt niets zomaar af, hij
              stelt de vraag aan de live pagina en het antwoord verschijnt bovenin
              de kaart. Dit is dezelfde meting als "Is dit doorgevoerd?" die tot
              17-08-2026 in de kaartkop stond; die is weg, want twee knoppen voor
              één meting betekent dat je altijd de verkeerde zoekt. */}
          {doorgevoerd && (
            <button type="button" className="btn btn-ghost btn-klein" disabled={!!gedaanBezig || vinkBezig === "bouw"}
              title="Meet de live pagina op wat er is afgesproken. Staat alles er echt, dan wordt Implementatie meteen afgevinkt; het bewijs komt bovenin de kaart."
              onClick={() => void (async () => { const m = await doorgevoerd.meet(); if (m?.alles) await zetFase("bouw", true); })()}>
              {gedaanBezig ? "Checken…" : "Gedaan?"}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-klein" title="Mail over de bouw of publicatie (ontvanger kies je in het venster)" onClick={() => onMail("dev")}>Mail</button>
          {/* Ligt bij dev: alleen een stand, geen actie. Je zet hem aan als het
              werk bij de sitebouwer ligt en je verder niets hoeft te sturen. Het
              schrijft dezelfde vlag als de Developer-knop ernaast (die het pakket
              mét opdracht en documenten doorzet), dus de fase-chip rechts, de
              kaart en de developerlijst blijven één stand tonen. */}
          {dev && (
            <label className="wp-fase-dev" title={naarDev ? "Ligt bij de developer. Klik om die stand weg te halen." : "Zet aan als deze pagina bij de developer ligt."}>
              <input type="checkbox" checked={naarDev} disabled={dev.bezig}
                onChange={(e) => void dev.markeerNaarDev(e.target.checked)} />
              <span>(ligt bij dev)</span>
            </label>
          )}
        </>
      );
    }
    if (key === "structured") {
      return (
        <>
          <button type="button" className="btn btn-ghost btn-klein" disabled={schemaRunning || !!busy} title={!p.bouw && p.copy ? "Let op: staat de nieuwe copy al live? Anders is de analyse te vroeg." : "Start de structured-data-analyse"} onClick={() => void startSchema()}>{p.structured ? "Opnieuw ↻" : "Start ▷"}</button>
          <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy || schemaRunning} title="Her-fetcht de live pagina en checkt of het geadviseerde schema er nu echt staat (en niet dubbel)." onClick={() => void controleerLive()}>{busy === "verify" ? "Checken…" : "Controleer live"}</button>
        </>
      );
    }
    return null;
  }

  // Zonder pagina is er geen fase-blok, maar de bewaking hierboven draait wel:
  // een run die elders gestart is, hoort het bord ook hier bij te werken.
  if (!page) return null;
  // Eén keer parsen: de fase-sturing voor de rijen hieronder.
  const info = splitCardInfo(t.toelichting, t.taak);

  return (
    <>
      {/* De cyclus verticaal, per fase status + start + vinkje. "Alles in één keer"
          hoort bij de eerste drie fases samen, niet bij Copy alleen, dus hij staat
          hier boven het blok in plaats van in één van de rijen. */}
      <div className="wp-fases-kop">
        <span className="wp-sectie-label" style={{ margin: "var(--s-0)" }}>Fases</span>
        {/* De Drive-bestemmingsmap hoort hier. Elke fase in dit blok maakt een
            document (strategie, analyse, blauwdruk, copy) en die gaan alle vier
            naar deze ene map. De knop stond alleen onderin de chat, en dan ook
            nog pas nadat de assistent één keer geantwoord had, dus in de praktijk
            was hij onvindbaar op het moment dat je hem nodig had: vóór de eerste
            fase, niet erna. */}
        {t.url && (
          <button type="button" className={"btn btn-quiet btn-klein" + (mapKnipper ? " wp-drive-knipper" : "")} onClick={onKiesMap}
            title={driveMap
              ? `Alle documenten van deze pagina komen in "${driveMap.path || driveMap.name}". Klik om een andere map te kiezen of een nieuwe te maken.`
              : "Er is nog geen map: de documenten blijven in het dashboard staan. Klik om de Drive-map te kiezen of aan te maken."}>
            {driveMap ? `Drive: ${driveMap.path || driveMap.name}` : "Drive-map kiezen of maken"}
          </button>
        )}
        <span className="wp-fase-spacer" />
        <button type="button" className="btn btn-ghost btn-klein" disabled={(!page.live && !page.strategie) || runActive || !!busy}
          title={(!page.live && !page.strategie) ? "Eerst de strategie goedkeuren (nieuwe pagina)" : "Draait analyse, blauwdruk en copy achter elkaar"}
          onClick={() => void startDocStep(page.live ? ["analyse", "blauwdruk", "copy"] : ["blauwdruk", "copy"])}>
          {page.live ? "Alles in één keer ▷" : "Blauwdruk + copy ▷"}
        </button>
      </div>
      <div className="wp-fases">
        {FASEN.map((f) => {
          const stand = faseStand(f.key);
          const link = docLink(f.key);
          // Eén regel sturing per fase, en pas zichtbaar als je die fase opent.
          // Stonden ze alle vijf tegelijk open, dan las je de instructie voor Copy
          // terwijl je bij Analyse zat en paste de kaart nergens meer in één blik.
          const sturingRuw = (info.perFase[f.key as CardFaseKey] || []).join(" · ");
          // Is dit de Copy-rij en heeft de meting inmiddels bevestigd dat de
          // copy live staat, dan overschrijft dat een bevroren "nog niet"-regel
          // (zie verseCopySturing in card-info.ts): anders spreekt de kaart
          // zichzelf tegen met het chipje rechts, dat wél "✓" toont.
          const sturing = f.key === "copy" ? verseCopySturing(sturingRuw, page?.doorgevoerd) : sturingRuw;
          // Een regel die alleen een document benoemt ("Copy-document: ...docx")
          // voegt niets toe naast het linkje ernaast. En een standaardzin die bij
          // het aanmaken van de kaart is meegegeven ("tekst aanscherpen") herhaalt
          // alleen de fasenaam en klopt na verloop van tijd niet eens meer. Alleen
          // echte, voor deze pagina geschreven sturing krijgt een uitleg-knop; de
          // rest is ruis in een rij die rustig moet zijn.
          const sturingNuttig = !!sturing
            && !/^\s*[a-zà-ž -]{0,20}document\s*:/i.test(sturing)
            && !/\.(docx?|pdf|md)\b/i.test(sturing.slice(0, 90))
            && !isSjabloonSturing(sturing);
          const sturingOpen = !!faseOpen[f.key];
          return (
            <div key={f.key} className="wp-fase">
              <div className="wp-fase-rij">
                {/* Het vinkje is terug. Het dashboard meet de meeste fases zelf,
                    maar niet alles gebeurt in het dashboard: heb je de strategie
                    in een gesprek bepaald of de dev het live gezet, dan zet je het
                    hier zelf om. Handmatig wint van de gemeten stand, beide kanten
                    op, en het weekbord toont hetzelfde vinkje. */}
                <label className="wp-fase-vink" title={page[f.key] ? "Afgerond, klik om terug te zetten" : "Markeer deze fase als afgerond"}>
                  <input type="checkbox" checked={!!page[f.key]} disabled={vinkBezig === f.key}
                    onChange={(e) => void zetFase(f.key, e.target.checked)} />
                </label>
                <span className="wp-fase-label">{f.label}</span>
                {/* Was een volle "Document"-knop rechts, drie keer in dezelfde
                    kaart. Een klein linkje achter de naam doet hetzelfde en houdt
                    de rij rustig. */}
                {link && <a className="wp-fase-doclink" href={link} target="_blank" rel="noreferrer" title="Open het document">(link)</a>}
                {sturingNuttig && (
                  <button type="button" className="wp-fase-uitleg"
                    title={sturingOpen ? "Verberg de sturing voor deze stap" : "Toon de sturing voor deze stap"}
                    onClick={() => setFaseOpen((v) => ({ ...v, [f.key]: !v[f.key] }))}>
                    {sturingOpen ? "uitleg ▴" : "uitleg ▾"}
                  </button>
                )}
                <span className="wp-fase-spacer" />
                {/* Alle pillen rechts, in vaste volgorde: Document | actie | status.
                    "Alles in één keer" hing hier in de Copy-rij en maakte die rij
                    hoger dan de andere zes, waardoor de hele kolom uit de pas liep.
                    Die knop slaat ook niet op Copy alleen maar op drie fases, dus
                    hij staat nu boven het blok. */}
                {faseActie(f.key)}
                <span className={"wp-fase-chip " + stand.cls} title={stand.label === "✓" ? "Klaar" : undefined}>{stand.label}</span>
              </div>
              {/* Slugs/URL's in de sturing zijn altijd klikbaar (harde huisregel). */}
              {sturingNuttig && sturingOpen && <div className="wp-fase-sturing" dangerouslySetInnerHTML={{ __html: netteHtml(sturing, { basis: (() => { try { return new URL(t.url).host; } catch { return ""; } })() }) }} />}
            </div>
          );
        })}
        {verifyMsg && <div className={verifyMsg.ok ? "wp-doc-ok" : "wp-doc-fout"}>{verifyMsg.tekst}</div>}
        {/* De achtergrond-run (analyse/blauwdruk/copy) stopte met een fout: die
            fout stond alleen in de database, nergens in beeld, dus leek het of er
            gewoon niets gebeurd was. Verdwijnt vanzelf zodra je die stap opnieuw
            start (de run-state wordt dan lokaal meteen vervangen). */}
        {/* Liep de run vast op de keten-poort (de controle die een document
            tegenhoudt als het plan de verse meting tegenspreekt), dan hoort er
            een uitweg bij te staan. Die controle heeft vier keer een pagina
            onterecht dichtgezet, en zonder knop betekent dat: niets meer
            genereren tot iemand code aanpast. Nu is het één klik, en de
            volgende gewone run controleert weer gewoon. */}
        {run && run.status === "error" && run.error && (
          <div className="wp-fase-fouttekst">
            Vastgelopen: {run.error}
            {isPoortBlokkade(run.error) && geblokkeerdeStappen.length > 0 && (
              <div className="pnl-acties-groep" style={{ marginTop: "var(--s-2)" }}>
                <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy || runActive}
                  title="Sla deze controle één keer over en genereer de openstaande stappen alsnog"
                  onClick={() => void werkelijkStartDocStep(geblokkeerdeStappen, true)}>
                  Toch genereren
                </button>
              </div>
            )}
          </div>
        )}
        {foutje && <div className="wp-fase-fouttekst">{foutje}</div>}
        {melding && (
          <div className="wp-fase-melding">
            {melding}
            {conceptLink && <> <a href={conceptLink} target="_blank" rel="noreferrer">Bekijk het concept</a></>}
          </div>
        )}
      </div>
    </>
  );
}

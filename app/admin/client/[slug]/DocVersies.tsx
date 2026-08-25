"use client";

// De documenten bij een taak of pagina.
//
// Zelf beheren in plaats van automatisch samenvoegen. Elk document dat je hier
// neerlegt, plakt of vanuit een mail naartoe sleept wordt gewoon een versie in de
// lijst: nieuwste bovenaan, met de datum en van wie het komt. Jij bepaalt met één
// vinkje welke versie geldt; die gaat standaard mee in een mail en naar de
// sitebouwer, en is de tekst waar de rest van het dashboard mee rekent.
//
// Wat hier vroeger stond: elke klantversie werd een voorstel met een AI-vergelijking,
// en na "Verwerk" werd er een samengevoegd document gemaakt. Dat leverde per ronde
// twee versies en een extra Drive-bestand op, ook als er niets veranderd was.
//
// Spatiebalk opent de voorvertoning van de geselecteerde regel, zoals in Finder.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mdToHtml } from "../../../../lib/markdown";
import { netteHtml } from "../../../../lib/nette-html";
import { groepeer, groepAantallen, documentVolgorde } from "../../../../lib/doc-groepen";
import { bronUitNaam, docLabel, zelfdeBestand } from "../../../../lib/doc-naam";
import { driveIdFromUrl, docsBewerkLink } from "../../../../lib/drive-id";
import type { DriveMap } from "./DriveMapKiezer";

type Toets = { oordeel: "goed" | "let-op" | "niet-goed"; kop: string; behouden: string[]; verdwenen: string[]; advies: string };
type Versie = {
  id: number; kind: string; source: "pingwin" | "klant"; naam: string; driveLink: string;
  samenvatting: string; vergelijking: string; status: string; createdAt: string; goedgekeurd: boolean;
  /** Van wanneer de inhoud zelf is (uit het document), tegenover createdAt: het
      moment waarop het bestand hier binnenkwam. Twee documenten die je op één
      ochtend toevoegt hebben dezelfde createdAt en zeggen dan niets. */
  inhoudDatum: string; datumBron: string; datumUitleg: string;
  /** Uit welk document dit voortkomt (0 = uit niets), bijvoorbeeld een stuk dat
      hier ondersteunend van is gemaakt. Zie lib/doc-groepen.ts. */
  bronId: number;
};

const DATUM_BRON: Record<string, string> = {
  document: "staat in het document zelf", bestand: "datum van het bestand", drive: "laatst gewijzigd in Drive",
  geplakt: "door jou geplakt", opgehaald: "door ons opgehaald", mail: "datum van de mail", onbekend: "datum onbekend",
};

const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data", overig: "Overig" };

// ── Ondersteunend maken ──
// Een aangeleverde blog of projecttekst gaat vaak over hetzelfde onderwerp als
// een landingspagina die het van precies dat zoekwoord moet hebben. Publiceer je
// hem zoals hij is, dan pakt hij die pagina zijn plek af of ze wisselen elkaar
// af; in beide gevallen zakt het geheel. Dit venster zet er een doelpagina bij,
// en de motor maakt het stuk ondersteunend in plaats van concurrerend.
type SteunPlan = {
  kop: string;
  doelen: { url: string; hoofdterm: string; steuntermen: string[] }[];
  titel: string; metaTitle: string; metaDescription: string;
  wijzigingen: string[];
  links: { naar: string; anker: string; plek: string }[];
  linksNaarBlog: { van: string; anker: string }[];
  landingMetas: { url: string; metaTitle: string; metaDescription: string }[];
  /** Alleen voor Maarten; deze staan bewust NIET in het document (zie lib/ondersteunend.ts). */
  waarschuwingen: string[];
};
const OORDEEL_KLEUR: Record<Toets["oordeel"], string> = { "goed": "wp-toets-goed", "let-op": "wp-toets-letop", "niet-goed": "wp-toets-fout" };

export default function DocVersies({ slug, url, taakId, triggerSlot, open, onStand, driveMap, onKiesMap }: { slug: string; url: string; taakId?: number;
  /** DOM-knoop uit de knoppenbalk van de aantekeningen (via een portal), zodat
      het "document toevoegen"-chipje daar fysiek in staat i.p.v. als eigen,
      altijd-open blok. Geen knoop (nog niet gemount) = gewoon hier inline. */
  triggerSlot?: HTMLElement | null;
  /** Staat de lijst open? De knop ervoor staat niet hier maar in de rij met
      uitklappers bovenaan de kaart ("Achtergrond en afspraken", "Documenten",
      "Oude versies"), want daar hoort maar één van de drie tegelijk open te
      staan. Dit blok had zijn eigen open-of-dicht-klepje, en dan heb je twee
      dingen die hetzelfde regelen. */
  open?: boolean;
  /** Hoeveel documenten er liggen en of er nog een keuze openstaat. De knop
      hierboven toont dat, en die staat in het andere bestand. */
  onStand?: (s: { aantal: number; moetKiezen: boolean }) => void;
  /** De Drive-map die nu bij deze kaart hoort, plus de weg om een andere te
      kiezen. Nodig omdat een aangepast document ergens moet landen, en Maarten
      dat per keer wil kunnen bepalen in plaats van het achteraf te verslepen. */
  driveMap?: DriveMap | null;
  onKiesMap?: () => void }) {
  const [versies, setVersies] = useState<Versie[]>([]);
  const [drag, setDrag] = useState(false);
  // Het "voeg een document toe"-blok stond hier altijd volledig open, ook als er
  // niets te doen was: drie regels uitleg en een invoerveld voor iets dat je maar
  // af en toe gebruikt. Nu een klein, gekleurd chipje (net als in de kennisbank)
  // dat pas opengaat als je erop klikt; slepen werkt ook al op het dichte chipje.
  const [dropOpen, setDropOpen] = useState(false);
  const bestandRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [linkVeld, setLinkVeld] = useState("");
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [preview, setPreview] = useState<Versie | null>(null);
  const [hernoem, setHernoem] = useState<{ id: number; naam: string } | null>(null);
  const [toets, setToets] = useState<{ id: number; uitkomst: Toets } | null>(null);
  // Het open venster "ondersteunend maken" (welk document, welke doelpagina's),
  // de uitkomst ervan, en de paginalijst van deze klant om uit te kiezen. Die
  // lijst wordt pas opgehaald als je het venster opent: hij is voor elke andere
  // regel op de kaart niet nodig.
  const [steun, setSteun] = useState<{ id: number; doelen: string[]; zoekwoorden: string } | null>(null);
  const [steunUit, setSteunUit] = useState<{ id: number; plan: SteunPlan; link: string } | null>(null);
  const [paginas, setPaginas] = useState<string[]>([]);

  // Welke documenten zijn versies van elkáár? Hier stond "hetzelfde soort", en
  // dat klopt alleen als een taak over één ding gaat. Zitten er twee projecten
  // in één taak (twee blogs, twee pagina's), dan kreeg je een keuze voorgelegd
  // die niet bestaat, en leek het stuk dat je niet aanvinkte vervallen. Nu telt
  // ook het onderwerp mee, uit de naam; zie lib/doc-groepen.ts.
  //
  // Kent een document zijn bron niet (`bronId` 0), maar verklapt zijn naam hem
  // wel ("Geldende versie na verwerken van «X»"), dan telt dat net zo hard. Zo
  // gaan de twee regels die op de kaart van Bogard onder elkaar stonden weer bij
  // elkaar horen in plaats van als twee losse versies te lezen (21-08-2026).
  const bronVan = (v: Versie): number => {
    if (v.bronId) return v.bronId;
    const bron = bronUitNaam(v.naam);
    if (!bron) return 0;
    return versies.find((x) => x.id !== v.id && zelfdeBestand(x.naam, bron))?.id || 0;
  };
  // De bron één keer oplossen; daarna rekent de rest met `bronId` alsof hij er
  // altijd al stond.
  const metBron = versies.map((v) => ({ ...v, bronId: bronVan(v) }));
  const groepVan = groepeer(metBron);
  const aantalPerGroep = groepAantallen(metBron, groepVan);
  /** Hoeveel documenten gaan er over hetzelfde als dit document? */
  const inGroep = (v: Versie) => aantalPerGroep[groepVan[v.id]] || 1;

  // De volgorde staat in lib/doc-groepen.ts (proces-stap, dan onderwerp, dan
  // nieuwste eerst, met een afgeleid stuk direct onder zijn bron) en wordt
  // nagerekend door proeven/doc-groepen.proef.ts.
  const opVolgorde = documentVolgorde(metBron, groepVan);

  // Ligt er van één onderwerp meer dan één versie zonder dat er één is
  // aangewezen? Dan wachten de mail en de sitebouwer op jouw keuze, en gaat het
  // blok open. Structured data telt hier niet in mee: daarvoor is de kennisbank
  // de plek waar per gegeven vastligt wat geldt.
  const moetKiezen = versies.some((v) =>
    v.kind !== "structured" && inGroep(v) > 1
    && !versies.some((x) => groepVan[x.id] === groepVan[v.id] && x.goedgekeurd));

  // De kaart tekent de knop voor dit blok, dus die moet weten wat erin zit.
  useEffect(() => { onStand?.({ aantal: versies.length, moetKiezen }); }, [versies.length, moetKiezen, onStand]);

  // ── De deelbare pagina voor de developer ──
  // Alleen ophalen als er structured data ligt én de lijst openstaat: op elke
  // andere kaart is dit een rondje naar de server voor niets.
  const heeftStructured = versies.some((v) => v.kind === "structured");
  const [devDeelUrl, setDevDeelUrl] = useState("");
  const [deelGekopieerd, setDeelGekopieerd] = useState(false);
  useEffect(() => {
    if (!open || !heeftStructured || devDeelUrl) return;
    let af = false;
    fetch(`/api/admin/org-data?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (af || !d?.ok || !d.devShareToken || typeof window === "undefined") return;
        setDevDeelUrl(`${window.location.origin}/share/org-dev/${d.devShareToken}`);
      })
      .catch(() => { /* dan staat de regel er zonder link; de kaart werkt gewoon */ });
    return () => { af = true; };
  }, [open, heeftStructured, devDeelUrl, slug]);
  async function kopieerDeelLink() {
    if (!devDeelUrl) return;
    try { await navigator.clipboard.writeText(devDeelUrl); setDeelGekopieerd(true); setTimeout(() => setDeelGekopieerd(false), 2000); } catch { /* handmatig */ }
  }

  const laad = useCallback(async () => {
    const d = await fetch(`/api/admin/page-doc/upload?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).catch(() => null);
    if (d?.ok) setVersies(d.versions || []);
  }, [slug, url]);
  useEffect(() => { void laad(); }, [laad]);

  // ── Deze taak in tweeën knippen (25-08-2026) ──────────────────────────────
  // Een kaart met twéé projecten erop loopt vast op iets simpels: er kan maar
  // één versie "geldend" zijn. Vink je de ene aan, dan lijkt de andere vervallen,
  // terwijl het gewoon een ander project is. En de developer krijgt zo twee
  // opdrachten in één taak. Zie lib/taak-splitsen.ts.
  const [splitsOpen, setSplitsOpen] = useState(false);
  const [splitsTitel, setSplitsTitel] = useState("");
  const [splitsMee, setSplitsMee] = useState<Record<number, boolean>>({});
  const kanSplitsen = !!taakId && url === `taak:${taakId}` && versies.length > 1;

  async function splitsNu() {
    const versieIds = versies.filter((v) => splitsMee[v.id]).map((v) => v.id);
    setBusy("splitsen"); setFout("");
    try {
      const d = await fetch("/api/admin/weekplan/splits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taakId, titel: splitsTitel.trim(), versieIds }),
      }).then((r) => r.json());
      if (d?.ok) {
        // De nieuwe kaart staat in de weekplanning, niet in dit venster. Opnieuw
        // laden is de eerlijkste manier om te laten zien wat er nu waar staat.
        window.location.reload();
        return;
      }
      setFout(d?.error || "Splitsen lukte niet; probeer het nog een keer.");
    } catch { setFout("Splitsen lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }


  // Spatiebalk = voorvertoning, zoals in Finder. Alleen als er een regel gekozen
  // is en je niet in een invoerveld staat, anders kun je nergens meer spaties typen.
  useEffect(() => {
    function toets(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape" && preview) { setPreview(null); return; }
      if (e.key !== " " || gekozen === null) return;
      e.preventDefault();                       // anders scrollt de pagina mee
      if (preview) { setPreview(null); return; }
      const v = versies.find((x) => x.id === gekozen);
      if (v) setPreview(v);
    }
    window.addEventListener("keydown", toets);
    return () => window.removeEventListener("keydown", toets);
  }, [gekozen, preview, versies]);

  async function stuur(payload: Record<string, unknown>, wat: string) {
    setBusy(wat); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url, ...payload }),
      }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); return d; }
      setFout(d?.error || "Dat lukte niet; probeer het nog een keer.");
      return null;
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); return null; }
    finally { setBusy(""); }
  }

  /** Het venster openen en, één keer, de paginalijst van deze klant ophalen. */
  function openSteun(id: number) {
    setSteun((s) => (s?.id === id ? null : { id, doelen: [""], zoekwoorden: "" }));
    setFout("");
    if (paginas.length) return;
    fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setPaginas(((d.urls || []) as { url: string }[]).map((u) => u.url).filter(Boolean)); })
      .catch(() => { /* dan typ je de URL zelf */ });
  }

  /**
   * De opdracht wegzetten. Dit duurt langer dan de andere knoppen op deze kaart
   * (twee pagina's lezen, Search Console erbij, een heel stuk tekst terug), dus
   * de knop zegt onderweg wat er gebeurt in plaats van alleen "bezig".
   */
  async function maakSteun() {
    if (!steun) return;
    const doelen = steun.doelen.map((d) => d.trim()).filter(Boolean);
    if (!doelen.length) { setFout("Kies eerst de landingspagina die dit stuk moet ondersteunen."); return; }
    setBusy("steun"); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/ondersteunend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: steun.id, doelUrls: doelen, zoekwoorden: steun.zoekwoorden, folderId: driveMap?.id || "" }),
      }).then((r) => r.json());
      if (d?.ok && d.plan) {
        setSteunUit({ id: steun.id, plan: d.plan as SteunPlan, link: String(d.link || "") });
        setSteun(null);
        await laad();
        return;
      }
      setFout(d?.error || "Dat lukte niet; probeer het nog een keer.");
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  async function drop(file: File) {
    setBusy("lezen"); setFout("");
    try {
      const form = new FormData();
      form.append("file", file); form.append("slug", slug); form.append("url", url);
      // Wanneer dit bestand voor het laatst is gewijzigd. Gaat niet vanzelf mee
      // bij een upload, en zonder die datum kan het dashboard niet bepalen of dit
      // nieuwer is dan wat er al ligt (zie lib/bron-datum.ts).
      form.append("gewijzigd", String(file.lastModified || 0));
      const d = await fetch("/api/admin/page-doc/upload", { method: "POST", body: form }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); else void laad(); }
      else setFout(d?.error || "Kon het bestand niet verwerken.");
    } catch { setFout("Uploaden mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  // Een bijlage die uit het paneel Laatste mails hierheen gesleept wordt. Het
  // dashboard haalt hem zelf bij Microsoft op; downloaden en opnieuw uploaden
  // hoeft dus niet.
  async function uitMail(data: { messageId: string; attachmentId: string; naam: string; mailDatum?: string }) {
    setBusy("lezen"); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uit-mail", slug, url, ...data }),
      }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); else void laad(); }
      else setFout(d?.error || "Kon de bijlage niet ophalen.");
    } catch { setFout("Ophalen mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  /** Alleen het pad tonen; een hele URL maakt van een keuzelijst een muur. */
  const padVan = (u: string) => { try { return new URL(u).pathname || u; } catch { return u; } };
  const dd = (d: string) => {
    try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
  };
  // Het tijdstip erbij, maar alleen waar het iets oplost: liggen er meerdere
  // documenten van hetzelfde soort, dan stonden ze er alle drie als "Copy,
  // 11 aug, copy (gegenereerd)". Precies gelijk, dus je kon niet zien welke
  // welke was terwijl je er wel één moest aanwijzen als de geldende.
  const tt = (d: string) => {
    try { return new Date(d).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };
  // Het moment waar de regel op staat: de eigen datum van het document (in de
  // praktijk meestal "laatst opgeslagen in Drive"), en anders het moment waarop
  // het hier binnenkwam. Staat er een datum zonder tijd in (een datum die uit de
  // tékst van het document komt), dan is het tijdstip van binnenkomst het enige
  // dat twee documenten van dezelfde dag nog uit elkaar houdt.
  const moment = (v: Versie) => {
    if (!v.inhoudDatum) return v.createdAt;
    const d = new Date(v.inhoudDatum);
    const heeftTijd = !Number.isNaN(d.getTime()) && (d.getHours() || d.getMinutes());
    return heeftTijd ? v.inhoudDatum : v.createdAt;
  };
  // Twee documenten van hetzelfde soort op dezelfde dag zijn op de regel niet uit
  // elkaar te houden; dan hoort het tijdstip erbij. Dat gold eerst alleen als er
  // helemaal geen eigen datum was, en juist bij twee stukken die op dezelfde dag
  // zijn aangeleverd (19-08-2026: twee blogs voor twee verschillende projecten)
  // stond er twee keer dezelfde "18 aug".
  const zelfdeDag = (v: Versie) =>
    versies.some((x) => x.id !== v.id && x.kind === v.kind && dd(moment(x)) === dd(moment(v)));
  const previewUrl = (v: Versie) => {
    const id = driveIdFromUrl(v.driveLink);
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  };

  // Dit chipje mag ook een bestand rechtstreeks aannemen (slepen zonder eerst te
  // klikken); klikken opent daarnaast het volledige blok voor bladeren of een link.
  const chip = (
    <button type="button" className={"wp-docchip" + (drag ? " wp-docchip-actief" : "")}
      disabled={busy === "lezen"}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const bijlage = e.dataTransfer.getData("application/pingwin-bijlage");
        if (bijlage) { try { void uitMail(JSON.parse(bijlage)); } catch { /* geen geldige bijlage */ } return; }
        const f = e.dataTransfer.files?.[0]; if (f) void drop(f);
      }}
      onClick={() => setDropOpen((v) => !v)}
      title="Document toevoegen: klik, sleep een bestand hierheen, of sleep een bijlage uit een mail">
      {busy === "lezen" ? "Bezig…" : "+ document"}
    </button>
  );

  return (
    <div className="wp-docs">
      {triggerSlot ? createPortal(chip, triggerSlot) : chip}
      {dropOpen && (
        <div className={"wp-docdrop" + (drag ? " wp-docdrop-actief" : "")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const bijlage = e.dataTransfer.getData("application/pingwin-bijlage");
            if (bijlage) { try { void uitMail(JSON.parse(bijlage)); } catch { /* geen geldige bijlage */ } return; }
            const f = e.dataTransfer.files?.[0]; if (f) void drop(f);
          }}>
          {busy === "lezen" ? (
            <span className="muted">Document inlezen…</span>
          ) : (
            <>
              <span className="wp-docdrop-tekst">
                <button type="button" className="wp-docdrop-kies" disabled={!!busy}
                  onClick={() => bestandRef.current?.click()}>kies een bestand</button>{" "}
                sleep een bijlage uit een mail hierheen, of plak een Drive-link:
              </span>
              <input ref={bestandRef} type="file" className="wp-docdrop-verborgen"
                accept=".docx,.pdf,.txt,.md,.json,.csv,.xlsx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void drop(f); e.target.value = ""; }} />
              <span className="wp-docdrop-linkrij">
                <input className="wp-docdrop-input" value={linkVeld} placeholder="https://docs.google.com/…"
                  onChange={(e) => setLinkVeld(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && linkVeld.trim()) { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); } }} />
                <button type="button" className="btn btn-ghost btn-klein" disabled={!linkVeld.trim() || !!busy}
                  onClick={() => { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); }}>Lees</button>
              </span>
              <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={() => setDropOpen(false)}>×</button>
            </>
          )}
        </div>
      )}

      {fout && <div className="wp-doc-fout">{fout}</div>}

      {/* Dicht, tenzij je hem opendoet. De documenten zelf bereik je al via de
          fase-rijen eronder (die linken naar de analyse, de blauwdruk en de
          copy), dus als vaste, altijd-open lijst was dit vier regels die je op
          elke kaart voorbij scrolt. Hier binnen kun je ze wél hernoemen,
          voorvertonen, weggooien en aanwijzen welke versie geldt; daarom blijft
          de lijst compleet in plaats van dat er regels uit verdwijnen.

          De knop staat niet meer hier maar in de rij uitklappers bovenaan de
          kaart, samen met "Achtergrond en afspraken" en "Oude versies": daar is
          er precies één tegelijk open. Liggen er meerdere versies van hetzelfde
          soort zonder dat je hebt aangewezen welke geldt, dan zet die rij dit
          blok vanzelf open; dat is een keuze waar de mail en de sitebouwer op
          wachten en die hoort niet achter een dicht klepje te verdwijnen. */}
      {/* ── Structured data: wat geldt, en wat de developer krijgt ──
          Liggen hier structured-data-documenten, dan is de vraag die je bij deze
          lijst hebt niet "welke versie geldt" maar "wat gaat er naar de
          sitebouwer". Dat is nooit een van deze bestanden: hij krijgt de code en
          het leesbare overzicht. Stond dat er niet bij, dan opende je een
          aangeleverd Word-document en keek je naar een advies in de huisstijl,
          terwijl je een JSON-bestand zocht (21-08-2026). */}
      {/* Twee projecten op één kaart: knip hem doormidden. De documenten die je
          aanvinkt gaan mee naar de nieuwe taak, de rest blijft staan. Zo kun je
          per project aanwijzen welke versie geldt, en gaat er per taak één link
          naar de developer. */}
      {open && kanSplitsen && (
        <div className="wp-doc-uitleg">
          <span className="wp-doc-uitleg-kop">Twee projecten op deze taak?</span>
          {!splitsOpen ? (
            <p>
              Staan hier documenten van twee losse projecten, dan kun je er maar één als geldend aanwijzen
              en krijgt de developer twee opdrachten in één taak.{" "}
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => setSplitsOpen(true)}>
                Splits deze taak
              </button>
            </p>
          ) : (
            <>
              <p>Geef de tweede taak een naam en vink aan welke documenten meeverhuizen. De rest blijft op deze taak staan.</p>
              <input className="wp-docdrop-input" value={splitsTitel} maxLength={120}
                placeholder="Naam van de tweede taak" onChange={(e) => setSplitsTitel(e.target.value)} />
              <div className="dev-task-docs">
                {versies.map((v) => (
                  <label key={v.id} className="wp-mail-linkchip">
                    <input type="checkbox" checked={!!splitsMee[v.id]}
                      onChange={(e) => setSplitsMee({ ...splitsMee, [v.id]: e.target.checked })} />
                    {v.naam}
                  </label>
                ))}
              </div>
              <span className="pnl-acties-groep">
                <button type="button" className="btn btn-primary btn-klein"
                  disabled={!splitsTitel.trim() || !Object.values(splitsMee).some(Boolean) || !!busy}
                  onClick={() => void splitsNu()}>
                  {busy === "splitsen" ? "Bezig…" : "Splitsen"}
                </button>
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setSplitsOpen(false)}>Annuleren</button>
              </span>
            </>
          )}
        </div>
      )}

      {open && heeftStructured && (
        <div className="wp-doc-uitleg">
          <span className="wp-doc-uitleg-kop">Structured data</span>
          <p>
            Wat er geldt staat per gegeven in de <a href={`/admin/client/${slug}?tab=klant#fund-structured-data`}>kennisbank van deze klant</a>.
            De bestanden hieronder zijn het archief van wat er is aangeleverd; ze gaan niet als document naar de developer.
          </p>
          {devDeelUrl ? (
            <p>
              De developer krijgt de code: <a href={devDeelUrl} target="_blank" rel="noreferrer">alle bedrijfsgegevens plus de kant-en-klare JSON-LD</a>, alleen-lezen en zonder inloggen te openen.
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => void kopieerDeelLink()}>{deelGekopieerd ? "✓ gekopieerd" : "Kopieer link"}</button>
            </p>
          ) : (
            <p className="muted">De deelbare pagina voor de developer wordt opgehaald…</p>
          )}
        </div>
      )}

      {versies.length > 0 && open && (
        <ul className="wp-doclijst">
          {/* Leesvolgorde = proces-volgorde (analyse, blauwdruk, copy), daarbinnen
              per onderwerp bij elkaar en pas dán nieuwste eerst. Zie de uitleg bij
              `opVolgorde` hierboven. */}
          {opVolgorde.map((v) => (
            <li key={v.id}
              className={"wp-docrij" + (gekozen === v.id ? " wp-docrij-aan" : "") + (v.goedgekeurd ? " wp-docrij-geldt" : "")
                // Springt een stukje in onder het stuk waar hij uit voortkomt, zodat
                // je ziet dat die twee bij elkaar horen en niet twee losse projecten zijn.
                + (v.bronId && versies.some((x) => x.id === v.bronId) ? " wp-docrij-afgeleid" : "")}
              tabIndex={0}
              onClick={() => setGekozen(gekozen === v.id ? null : v.id)}
              onDoubleClick={() => setPreview(v)}
              title="Klik om te kiezen, spatiebalk voor een voorvertoning">
              {/* De datum van het document zelf als we die kennen, anders het
                  moment van binnenkomst. Dat verschil is precies waarom twee
                  documenten van dezelfde ochtend niet uit elkaar te houden waren. */}
              <span className="wp-docrij-datum"
                title={v.inhoudDatum
                  ? `${v.datumUitleg}. Hier binnengekomen op ${dd(v.createdAt)} ${tt(v.createdAt)}.`
                  : `Van dit document is geen eigen datum te vinden; dit is het moment waarop het hier binnenkwam (${dd(v.createdAt)} ${tt(v.createdAt)}).`}>
                {dd(moment(v))}
                {zelfdeDag(v) ? ` ${tt(moment(v))}` : ""}
              </span>
              <span className={"wp-docversie-bron " + (v.source === "klant" ? "wp-bron-klant" : "wp-bron-pingwin")}>
                {v.source === "klant" ? "Klant" : "Pingwin"}
              </span>
              <span className="wp-docrij-kind">{KIND_LABEL[v.kind] || v.kind}</span>

              {hernoem?.id === v.id ? (
                <input className="wp-docrij-naaminvoer" autoFocus value={hernoem.naam}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setHernoem({ id: v.id, naam: e.target.value })}
                  onBlur={() => { void stuur({ action: "hernoem", id: v.id, naam: hernoem.naam }, "hernoem"); setHernoem(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { void stuur({ action: "hernoem", id: v.id, naam: hernoem.naam }, "hernoem"); setHernoem(null); }
                    if (e.key === "Escape") setHernoem(null);
                  }} />
              ) : (
                // De naam zonder de zin eromheen, plus een merkje dat vertelt wat
                // het is. Zie lib/doc-naam.ts: de échte naam blijft de echte naam
                // (hij staat in de tooltip en verschijnt zodra je hem hernoemt).
                <button type="button" className="wp-docrij-naam"
                  onClick={(e) => { e.stopPropagation(); setHernoem({ id: v.id, naam: v.naam || "" }); }}
                  title={`${v.naam || "document"}\n\nKlik om de naam aan te passen`}>
                  {docLabel(v.naam).toon}
                  {docLabel(v.naam).merk && <span className="wp-docrij-merk">{docLabel(v.naam).merk}</span>}
                </button>
              )}

              <span className="wp-docrij-acties" onClick={(e) => e.stopPropagation()}>
                {/* Het vinkje beantwoordt één vraag: welke van deze copy-versies is
                    DE copy? Dat is pas een vraag als er meer dan één ligt (bijvoorbeeld
                    nadat de klant een versie terugstuurde). Ligt er maar één, dan geldt
                    hij vanzelf en zou het vinkje alleen een klusje zijn dat je kunt
                    vergeten, met een stilgevallen mail en werklijst als gevolg. */}
                {/* Structured data kent geen keuze op deze kaart. Het document is
                    daar een doorgeefluik: wat erin staat is per gegeven verwerkt in
                    de kennisbank van de klant, en dáár staat wat geldt, met per
                    gegeven een datum. Een vinkje "welke versie geldt" zou een
                    tweede waarheid maken naast die kennisbank. */}
                {v.kind === "structured" ? (
                  <a className="wp-docrij-kennisbank" href={`/admin/client/${slug}?tab=klant`}
                    title="Wat hierin stond is per gegeven verwerkt in de kennisbank van deze klant. Daar staat welke waarde geldt en van wanneer die is; dit bestand is het archief.">
                    in de kennisbank
                  </a>
                ) : inGroep(v) > 1 ? (
                  <label className="wp-docrij-geldt-vink" title={`Er liggen ${inGroep(v)} versies van dit stuk. Vink aan welke er geldt: die gaat mee in een mail en naar de sitebouwer, en is de tekst waar de rest mee rekent.`}>
                    <input type="checkbox" checked={v.goedgekeurd} disabled={!!busy}
                      onChange={(e) => void stuur({ action: "goedkeur", id: v.id, aan: e.target.checked }, "goedkeur")} />
                    <span>geldt</span>
                  </label>
                ) : v.goedgekeurd ? (
                  <span className="wp-docrij-geldt-vast" title="Het enige document van dit soort, dus dit is de versie waar de mail, de sitebouwer en de rest van het dashboard mee rekenen.">geldt</span>
                ) : null}
                {/* Een aangeleverd stuk (blog, projectverhaal) botst standaard
                    met de landingspagina die over hetzelfde onderwerp gaat.
                    Alleen bij documenten waar tekst van bewaard is, want zonder
                    tekst valt er niets aan te passen. */}
                {v.kind !== "structured" && (
                  <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy}
                    aria-expanded={steun?.id === v.id}
                    title="Maak dit stuk ondersteunend aan een landingspagina in plaats van concurrerend: de landingspagina houdt zijn zoekwoord, dit stuk pakt de vragen eromheen en geeft zijn kracht door met een interne link"
                    onClick={() => openSteun(v.id)}>Ondersteunend maken</button>
                )}
                {/* Niet bij structured data: die toets legt een tekst langs de
                    SEO-criteria voor een landingspagina (koppen, zoekwoorddekking,
                    meta's). Een inventarisatie van bedrijfsgegevens heeft daar
                    niets mee te maken, dus dat leverde alleen een oordeel op dat
                    nergens over ging. */}
                {v.source === "klant" && v.kind !== "structured" && (
                  <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy}
                    title="Kijk of deze teruggekregen versie nog aan de SEO-criteria voldoet"
                    onClick={async () => {
                      const d = await stuur({ action: "toets", id: v.id }, "toets");
                      if (d?.toets) setToets({ id: v.id, uitkomst: d.toets as Toets });
                    }}>{busy === "toets" ? "Toetsen…" : "Toets aan de criteria"}</button>
                )}
                {/* Een Word-document opent rechtstreeks in Docs; een pdf, plaatje
                    of ander bestand houdt de gewone Drive-link, want die kan Docs
                    niet openen. Vandaar de bestandsnaam als scheidsrechter. */}
                {v.driveLink && <a className="wp-link" href={/\.(docx?|)$/i.test(v.naam || "") ? docsBewerkLink(v.driveLink) : v.driveLink} target="_blank" rel="noreferrer">openen</a>}
                <button type="button" className="wp-icon wp-del" title="Van de lijst halen (het bestand blijft in Drive)"
                  onClick={() => void stuur({ action: "negeer", id: v.id }, "weg")}>×</button>
              </span>

              {/* Wat dit document is en wat er anders in staat. Stond al in de
                  database maar kwam nooit in beeld, waardoor je twee regels zag
                  waarvan je niet kon zien welke welke was. Alleen bij de regel
                  die je aanklikt, anders wordt de lijst een muur tekst. */}
              {gekozen === v.id && (v.samenvatting || v.datumUitleg) && (
                <div className="wp-docrij-uitleg">
                  {v.samenvatting && <span>{v.samenvatting}</span>}
                  <span className="muted">
                    {v.inhoudDatum ? `${DATUM_BRON[v.datumBron] || v.datumBron}: ${dd(v.inhoudDatum)}` : "Geen eigen datum in dit document gevonden."}
                    {" · "}hier binnengekomen {dd(v.createdAt)} {tt(v.createdAt)}
                    {" · "}dubbelklik voor een voorvertoning
                  </span>
                </div>
              )}
              {/* Het venster zelf: welke landingspagina moet hier sterker van
                  worden, en waar komt het aangepaste stuk te staan. Twee velden,
                  want meer is het niet: de rest haalt de motor zelf op. */}
              {steun?.id === v.id && (
                <div className="wp-steun" onClick={(e) => e.stopPropagation()}>
                  <div className="wp-steun-uitleg">
                    Dit stuk gaat straks over hetzelfde onderwerp als een landingspagina. Kies welke pagina de baas blijft op zijn zoekwoord; dit stuk pakt de vragen eromheen en linkt ernaartoe.
                  </div>
                  {steun.doelen.map((keuze, i) => (
                    <label key={i} className="wp-steun-rij">
                      <span className="wp-steun-lab">{i === 0 ? "Ondersteunt" : "En ook"}</span>
                      <select className="wp-steun-kies" value={keuze}
                        onChange={(e) => setSteun({ ...steun, doelen: steun.doelen.map((d, j) => (j === i ? e.target.value : d)) })}>
                        <option value="">{paginas.length ? "kies een pagina" : "paginalijst ophalen…"}</option>
                        {paginas.map((p) => <option key={p} value={p}>{padVan(p)}</option>)}
                      </select>
                    </label>
                  ))}
                  {steun.doelen.length < 2 && (
                    <button type="button" className="btn btn-quiet btn-klein"
                      onClick={() => setSteun({ ...steun, doelen: [...steun.doelen, ""] })}>Tweede pagina erbij</button>
                  )}
                  <label className="wp-steun-rij">
                    <span className="wp-steun-lab">Zoekwoorden</span>
                    <input className="wp-steun-veld" value={steun.zoekwoorden} placeholder="optioneel: waar die pagina op moet winnen"
                      onChange={(e) => setSteun({ ...steun, zoekwoorden: e.target.value })} />
                  </label>
                  <div className="wp-steun-rij">
                    <span className="wp-steun-lab">Opslaan in</span>
                    <span className="wp-steun-map">
                      {driveMap ? (driveMap.path || driveMap.name) : "nog geen map gekozen"}
                      {onKiesMap && (
                        <button type="button" className="btn btn-quiet btn-klein" onClick={onKiesMap}>
                          {driveMap ? "andere map" : "map kiezen"}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="wp-steun-acties">
                    <button type="button" className="btn btn-primary btn-klein" disabled={!!busy}
                      onClick={() => void maakSteun()}>
                      {busy === "steun" ? "Bezig, dit duurt een minuut…" : "Maak ondersteunend"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy}
                      onClick={() => setSteun(null)}>Annuleren</button>
                  </div>
                </div>
              )}

              {/* De uitkomst: wat er is aangepast, de rolverdeling, de links die
                  de sitebouwer moet leggen, en wat er niet klopt. Dat laatste
                  wordt in code nagerekend, niet door het taalmodel beloofd. */}
              {steunUit?.id === v.id && (
                <div className="wp-steun-uit md">
                  <strong>{steunUit.plan.kop}</strong>
                  {steunUit.plan.doelen.length > 0 && (
                    <table className="md-table">
                      <thead><tr><th>Landingspagina</th><th>Blijft de baas op</th><th>Dit stuk mikt op</th></tr></thead>
                      <tbody>
                        {steunUit.plan.doelen.map((d, i) => (
                          <tr key={i}>
                            <td>{padVan(d.url)}</td>
                            <td>{d.hoofdterm || "niet bepaald"}</td>
                            <td>{d.steuntermen.join(", ") || "niet bepaald"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {steunUit.plan.wijzigingen.length > 0 && (
                    <ul>{steunUit.plan.wijzigingen.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  )}
                  {steunUit.plan.links.length > 0 && (
                    <div dangerouslySetInnerHTML={{ __html: netteHtml(
                      "**Links vanuit dit stuk:** " + steunUit.plan.links.map((l) => `${padVan(l.naar)} met linktekst "${l.anker}"`).join("; "),
                    ) }} />
                  )}
                  {(steunUit.plan.landingMetas || []).length > 0 && (
                    <div dangerouslySetInnerHTML={{ __html: netteHtml(
                      "**Ook overnemen op de landingspagina:** " + steunUit.plan.landingMetas
                        .map((m) => `${padVan(m.url)} krijgt titel "${m.metaTitle}"${m.metaDescription ? ` en omschrijving "${m.metaDescription}"` : ""}`)
                        .join("; ") + ". Deze staan alleen hier, niet in het document: ze gaan over de landingspagina en niet over dit stuk.",
                    ) }} />
                  )}
                  {/* Alleen voor jou. Deze regels stonden eerder ook in het
                      document, onder "Let op", en dan las de klant aanbevelingen
                      die wij hadden moeten doen of een interne afweging over de
                      linkstrategie. Sinds 21-08-2026 staan ze alleen hier. */}
                  {steunUit.plan.waarschuwingen.length > 0 && (
                    <>
                      <p className="wp-steun-intern">Alleen voor jou, dit staat niet in het document:</p>
                      <ul className="wp-steun-letop">{steunUit.plan.waarschuwingen.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </>
                  )}
                  {steunUit.link && <p><a href={docsBewerkLink(steunUit.link)} target="_blank" rel="noreferrer">het aangepaste document openen</a></p>}
                </div>
              )}

              {toets?.id === v.id && (
                <div className={"wp-toets " + OORDEEL_KLEUR[toets.uitkomst.oordeel]}>
                  <strong>{toets.uitkomst.kop}</strong>
                  {toets.uitkomst.verdwenen.length > 0 && (
                    <ul>{toets.uitkomst.verdwenen.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  )}
                  <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(toets.uitkomst.advies) }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Hier stond de knop "Zet copy als concept in de site". Die staat sinds
          17-08-2026 in de Implementatie-rij van de fases, want dat is de stap
          waar hij bij hoort; hier stond hij onderaan een documentenlijst, ver
          van het moment waarop je hem nodig hebt. Eén knop, één plek. */}

      {preview && (
        <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="wp-mail-modal wp-preview">
            <div className="wp-mail-head">
              <span className="wp-mail-title">{preview.naam || "document"}</span>
              <button type="button" className="wp-icon wp-del" title="Sluiten (Escape)" onClick={() => setPreview(null)}>×</button>
            </div>
            {previewUrl(preview) ? (
              <iframe className="wp-preview-frame" src={previewUrl(preview)} title={preview.naam || "voorvertoning"} />
            ) : (
              <div className="wp-preview-leeg">
                <p>Van dit document is geen bestand in Drive bewaard, dus er valt niets te tonen.</p>
                {preview.samenvatting && <p className="muted">{preview.samenvatting}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

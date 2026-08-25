"use client";

// ═══════════════════════════════════════════════════════════
// MAIL VANUIT EEN PROJECTKAART
// ═══════════════════════════════════════════════════════════
// Dit venster hing vast in het weekplanning-blok van het tabblad Taken. Op de
// nieuwe planning deed de Mail-knop van dezelfde kaart daardoor niets: het was
// wél dezelfde kaart, maar het venster stond er niet omheen. Een knop die op het
// ene scherm werkt en op het andere stil niets doet is precies het soort stille
// fout waar we van af willen.
//
// Daarom staat het venster nu op zichzelf en gebruiken beide schermen hem. Wat
// het doet: de ontvanger kiezen (klant, developer of een ander adres), kiezen
// welke documenten meegaan, de assistent laten schrijven of zelf typen, en
// versturen via Microsoft 365. Je concept blijft bewaard als je tussendoor
// sluit.
//
// ───────────────────────────────────────────────────────────
// ADRESVELD-REGEL: NOOIT VOORINVULLEN, NOOIT ONTHOUDEN (17-08-2026)
// ───────────────────────────────────────────────────────────
// Het adresveld begint leeg en blijft leeg tot Maarten er zelf iets in typt.
// Geen enkele uitzondering, ook niet voor het adres van de klant zelf.
//
// Waarom zo hard: hier stond één gedeeld browsergeheugen (localStorage-sleutel
// "pingwin-dev-email") met "het laatst gebruikte developer-adres". Dat was
// niet per klant maar voor álle klanten tegelijk. Wie na een mail over klant A
// een mail over klant B opende, kreeg het adres van klant A's developer al
// ingevuld. Op 17 augustus 2026 stond zo bij Kamsteeg Tuinen het adres van
// Paul Hoevenaars voorgevuld. Dat zijn concurrenten van elkaar, allebei klant
// bij Pingwin; één klik op Versturen en ze wisten het van elkaar. Dat is niet
// een ongemak maar het soort fout dat een klant kost, en die kans hoort nul te
// zijn in plaats van klein.
//
// Wat ervoor in de plaats komt: AdresVeld stelt namen voor uit Maartens eigen
// Microsoft 365-contacten zodra hij twee letters typt. Dus geen gok van het
// systeem, wel hulp bij het typen. Het verschil is dat een voorstel pas een
// adres wordt als hij hem aanwijst.
//
// Zet hier dus nooit een adres neer, uit welke bron ook (laatst gebruikt,
// klantgegevens, een vast Pingwin-adres). proeven/mailadres-leeg.proef.ts
// rekent dat na bij elke bouw, in élk mailvenster, niet alleen in dit bestand.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { herzetAanhef } from "../../../../lib/aanhef";
import AdresVeld from "./AdresVeld";
import { mailUitTekst } from "../../../../lib/mail-uit-gesprek";
import { zichtbaar, type VersieDoc } from "../../../../lib/laatste-versie";
import { type WpTask, type WpPageInfo } from "./WeekplanCard";

function shortUrl(url: string): string { try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; } }

type Doelgroep = "klant" | "dev" | "anders";
type Concept = { aud: Doelgroep; to: string; onderwerp: string; tekst: string; instr: string; links: Record<string, boolean> };

export default function MailUitKaart({
  slug, t, page, startAud, clientName, clientEmail, onClose,
}: {
  slug: string;
  t: WpTask;
  page?: WpPageInfo;
  startAud: Doelgroep;
  clientName?: string;
  clientEmail?: string;
  onClose: () => void;
}) {
  const [aud, setAud] = useState<Doelgroep>(startAud);
  const [to, setTo] = useState("");
  const [instr, setInstr] = useState("");
  const [links, setLinks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [verzendt, setVerzendt] = useState(false);
  const [klaar, setKlaar] = useState("");
  // Herinnering om zelf achter een reactie aan te gaan. Uit tenzij je hem aanzet;
  // zeven dagen is de gebruikelijke termijn en blijft aanpasbaar.
  const [herinner, setHerinner] = useState(false);
  const [herinnerDagen, setHerinnerDagen] = useState(7);
  const ref = useRef<HTMLDivElement>(null);
  // Alle documenten die bij de pagina van deze kaart horen, inclusief de teksten
  // die de klant terugstuurde. De kaart zelf kent alleen analyse, blauwdruk en
  // copy, dus juist de herziene versie kon je anders niet meesturen.
  const [docs, setDocs] = useState<VersieDoc[]>([]);
  // Van elke soort staat alleen de laatste versie in beeld. Elke ronde levert een
  // nieuw document op, dus na een paar rondes stonden er negen vakjes waarvan er
  // twee "Copy" heetten en je niet kon zien welke de nieuwste was. Het archief is
  // er nog, één klik verderop.
  const [toonOud, setToonOud] = useState(false);
  // Een screenshot erbij: slepen of plakken (zelfde patroon als MailPopup), in de
  // browser verkleind naar max 1400px (JPEG) en pas bij versturen als <img>
  // onderaan de mail gezet. Los van de tekst houden voorkomt gerommel met de
  // cursorpositie in het bewerkbare vak.
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  function acceptImageFile(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.85);
        setPendingImages((prev) => (prev.length >= 6 ? prev : [...prev, data]));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }
  function onPasteImage(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); acceptImageFile(item.getAsFile()); }
  }
  function onDropImage(e: React.DragEvent) {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault(); setDragOver(false);
    for (const f of Array.from(e.dataTransfer.files)) acceptImageFile(f);
  }

  const conceptSleutel = `pingwin-mailconcept-${slug}-${t.id}`;
  function bewaarConcept() {
    try {
      const c: Concept = { aud, to, onderwerp, tekst: ref.current?.innerText || "", instr, links };
      if (!c.tekst.trim() && !c.onderwerp.trim()) return;
      localStorage.setItem(conceptSleutel, JSON.stringify(c));
    } catch { /* zonder opslag is het concept alleen deze sessie */ }
  }
  function wisConcept() {
    try { localStorage.removeItem(conceptSleutel); } catch { /* niets */ }
  }

  // Openen: de documentenlijst ophalen, en beginnen bij het concept dat er nog
  // lag. Was er niets, dan bij de mail die al in de kaarttekst stond, en anders
  // leeg. Geen automatische tekst: Maarten dicteert zijn mails en moest een
  // standaardtekst eerst weggooien.
  useEffect(() => {
    setPendingImages([]);
    // Ook bij een taak zónder pagina: documenten hangen dan aan de taak zelf.
    // Stond hier eerder achter "if (t.url)", waardoor je bij zo'n taak niets kon
    // meesturen terwijl er wél documenten aan hingen.
    fetch(`/api/admin/weekplan/dev?slug=${encodeURIComponent(slug)}&id=${t.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        if (Array.isArray(d.docs)) setDocs(d.docs);   // filteren gebeurt bij het tonen, want dat hangt af van naar wie de mail gaat
        // De versie die geldt staat standaard aangevinkt; die hoort in de mail.
        if (Array.isArray(d.gekozen) && d.gekozen.length) {
          setLinks((oud) => (Object.keys(oud).length ? oud
            : Object.fromEntries((d.gekozen as string[]).map((u) => [u, true]))));
        }
      })
      .catch(() => {});
    let c: Concept | null = null;
    try { const s = localStorage.getItem(conceptSleutel); c = s ? JSON.parse(s) as Concept : null; } catch { c = null; }
    if (c) {
      setAud(c.aud); setTo(c.to); setOnderwerp(c.onderwerp);
      setInstr(c.instr || ""); setLinks(c.links || {});
      if (ref.current) ref.current.innerText = c.tekst || "";
      return;
    }
    // Niets staat hier standaard aan; wat er aan hoort, komt uit de lijst
    // hierboven (`gekozen`). Hier stond `{ pagina: true }`, en dat had twee
    // gevolgen: bij een taak mét pagina kwam die keuze eerder binnen dan de
    // documenten, waardoor het geldende document juist NIET aanstond, en bij een
    // developer stond er standaard een paginalink in een mail die alleen over
    // het document hoort te gaan (25-08-2026).
    setLinks({});
    // Het adresveld begint leeg, altijd. Zie de uitleg bij ADRESVELD-REGEL
    // onderaan dit bestand: een onthouden adres uit een andere klant kwam hier
    // terecht en zette twee concurrenten bijna in dezelfde mail.
    setTo("");
    const concept = mailUitTekst((t.toelichting || "").replace(/<[^>]*>/g, ""));
    if (concept) {
      if (concept.onderwerp) setOnderwerp(concept.onderwerp);
      if (ref.current) ref.current.innerText = concept.body;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, t.id]);

  // Vink je iets aan of uit bij "Meesturen", of komt de documentenlijst binnen,
  // dan staan de linkregels onderaan de mail meteen goed. Dit reageert alleen op
  // die twee dingen, dus tijdens het typen gebeurt er niets met je tekst.
  useEffect(() => {
    zetLinksInTekst(links);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, docs]);

  // Alles wat je vanuit deze kaart kunt meesturen, inclusief de pagina zelf: de
  // developer moet weten wáár de tekst naartoe moet.
  function docLinks(): { key: string; label: string; url: string; ouder?: boolean }[] {
    const uit: { key: string; label: string; url: string; ouder?: boolean }[] = [];
    const gezien = new Set<string>();
    const voegToe = (key: string, label: string, url: string, ouder?: boolean) => {
      const u = (url || "").trim();
      if (!u || gezien.has(u)) return;
      gezien.add(u);
      uit.push({ key, label, url: u, ouder });
    };
    // Naar een developer gaat alleen de link naar het document; hij hoeft niet te
    // kiezen en niet na te denken. De pagina en de stukken uit de aantekeningen
    // zijn voor een klantmail wél zinnig, dus die blijven daar gewoon staan.
    // Zie lib/naar-developer.ts (25-08-2026).
    if (t.url && aud !== "dev") voegToe("pagina", "De pagina", t.url);
    // `docs` komt van dezelfde server-lijst als het doorzet-venster naar de
    // developer (docsVoorPagina): copy, blauwdruk en analyse staan er al in,
    // met de echte bestandsnaam in het label (of "(nog niet in Drive)" als er
    // nog geen map gekozen was toen het document gemaakt werd), en ook het
    // losse copy_url-veld van deze taak als dat een ANDER bestand is dan de
    // pijplijn-copy. Vroeger bouwde dit scherm daar zelf nog een tweede,
    // generiek gelabelde "Copy-doc"-regel bovenop, en dan kon je niet meer
    // zien of dat hetzelfde bestand was als "Copy" of iets anders.
    for (const d of docs) {
      if (aud === "dev" && d.uitAantekening) continue;
      voegToe(d.url, d.label, d.url, d.ouder);
    }
    return uit;
  }

  // ── De links staan zichtbaar in de mail, niet pas na het versturen ──────────
  // Wat je aanvinkt bij "Meesturen" werd stil aan de mail geplakt op het moment
  // dat je op Versturen drukte. Onderweg zag je hem dus niet en kon je hem ook
  // niet in een zin verwerken ("de nieuwe tekst staat in <naam>, hij moet op
  // <pagina>").
  //
  // Wat je nu ziet is precies wat de ontvanger krijgt: een klikbare link met de
  // NAAM van het document erop, niet een Google Docs-adres van honderd tekens.
  // Noemt de tekst die naam al (de assistent schrijft hem letterlijk), dan wordt
  // díe naam de link; wordt hij nergens genoemd, dan komt er onderaan een regel
  // bij. Sleep of knip zo'n link gerust je zin in, hij blijft werken.
  //
  // Bij het versturen gaat alleen de tekst mee (de namen dus), en hangt
  // lib/mail-body.ts de adressen weer aan diezelfde namen. Zo kan de link in de
  // mail nooit iets anders zijn dan wat je in beeld zag.
  const LINKBLOK = "wp-mail-linkblok";
  const ONS = "data-pingwin-link";

  function maakLink(l: { label: string; url: string }, tekst: string): HTMLAnchorElement {
    const a = document.createElement("a");
    a.setAttribute(ONS, "1");
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = tekst;
    return a;
  }

  // Hangt de link aan élke plek waar de naam van het document staat. Dezelfde
  // regel als in lib/mail-body.ts: alle vermeldingen, niet alleen de eerste, want
  // een naam die in de zin klikbaar is en onderaan niet leest als een foutje.
  function linkNaamInTekst(el: HTMLElement, l: { label: string; url: string }): boolean {
    const naam = l.label.toLowerCase();
    if (naam.length < 3) return false;
    const knippen: Text[] = [];
    const wandel = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = wandel.nextNode(); n; n = wandel.nextNode()) {
      if (!n.parentElement?.closest("a")) knippen.push(n as Text);
    }
    let gezet = false;
    for (const node of knippen) {
      let rest: Text | null = node;
      while (rest) {
        const i = rest.data.toLowerCase().indexOf(naam);
        if (i < 0) break;
        // Midden in een woord is het geen vermelding maar toeval.
        const voor = rest.data[i - 1] || " ";
        const na = rest.data[i + naam.length] || " ";
        if (/[\w-]/.test(voor) || /[\w-]/.test(na)) { rest = rest.splitText(i + naam.length); continue; }
        const stuk = rest.splitText(i);
        const staart = stuk.splitText(l.label.length);
        stuk.replaceWith(maakLink(l, stuk.data));
        gezet = true;
        rest = staart;
      }
    }
    return gezet;
  }

  function zetLinksInTekst(gekozen: Record<string, boolean>) {
    const el = ref.current;
    if (!el) return;
    const alle = docLinks();
    if (!alle.length) return;
    // Eerst alles wat wij eerder zetten weer plat maken; jouw eigen tekst en je
    // eigen links blijven ongemoeid.
    el.querySelectorAll(`.${LINKBLOK}`).forEach((n) => n.remove());
    el.querySelectorAll(`a[${ONS}]`).forEach((a) => a.replaceWith(document.createTextNode(a.textContent || "")));
    el.normalize();

    // Wat overblijft aan links: die je zelf al ergens in de tekst hebt gezet
    // (blijven staan waar ze staan), die als naam genoemd worden (daar hangt de
    // link nu aan), en die nergens voorkomen (die komen onderaan erbij).
    const zelfGezet = new Set(Array.from(el.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") || ""));
    const nog: { key: string; label: string; url: string }[] = [];
    for (const l of alle) {
      if (!gekozen[l.key]) continue;
      if (zelfGezet.has(l.url)) continue;
      if (linkNaamInTekst(el, l)) continue;
      nog.push(l);
    }
    if (!nog.length) return;

    const blok = document.createElement("div");
    blok.className = LINKBLOK;
    if ((el.innerText || "").trim()) blok.appendChild(document.createElement("br"));
    for (const l of nog) {
      const regel = document.createElement("div");
      regel.appendChild(maakLink(l, l.label));
      blok.appendChild(regel);
    }
    el.appendChild(blok);
  }

  // De aanhef bijwerken zonder de links te slopen. Vroeger ging dit via innerText
  // over het hele vak; dat maakte van elke link weer platte tekst.
  function zetAanhef(adres: string) {
    const el = ref.current;
    if (!el) return;
    const wandel = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const eerste = wandel.nextNode() as Text | null;
    if (!eerste) return;
    const nieuw = herzetAanhef(eerste.data, adres);
    if (nieuw !== eerste.data) eerste.data = nieuw;
  }

  function sluit() { bewaarConcept(); onClose(); }

  async function schrijf(gekozen: Record<string, boolean>, adres: string) {
    setBusy(true); setErr("");
    if (ref.current) ref.current.innerText = "";
    const mee = docLinks().filter((l) => gekozen[l.key]).map((l) => ({ label: l.label, url: l.url }));
    try {
      const d = await fetch("/api/admin/task/explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // De aantekeningen gaan mee als context: daar staan de concrete gegevens
        // (adressen, namen, verwijzingen) die de ontvanger nodig heeft.
        body: JSON.stringify({ slug, taak: t.taak, toelichting: t.toelichting, notitie: t.notitie || "", url: t.url, audience: aud, instructie: instr, links: mee, to: adres }),
      }).then((r) => r.json());
      if (d?.ok && d.text) {
        // De onderwerpregel hoort niet in de body maar in een eigen veld: zo zie
        // je hem meteen en wordt hij ook echt het onderwerp van de mail.
        const regels = String(d.text).split("\n");
        const m = /^\s*onderwerp\s*:\s*(.+)$/i.exec(regels[0] || "");
        if (m) { setOnderwerp(m[1].trim()); regels.shift(); while (regels[0] !== undefined && !regels[0].trim()) regels.shift(); }
        else setOnderwerp("");
        if (ref.current) ref.current.innerText = regels.join("\n").trim();
        // De assistent schrijft de namen van de documenten in de tekst; de links
        // zelf zet dit venster eronder, zodat je ze ziet staan.
        zetLinksInTekst(gekozen);
      } else setErr(d?.error || "Uitleg maken mislukt.");
    } catch { setErr("De assistent is niet bereikbaar."); } finally { setBusy(false); }
  }

  function kopieer() {
    const tekst = (ref.current?.innerText || "").trim();
    if (tekst) navigator.clipboard?.writeText(tekst).catch(() => {});
  }

  // Verstuurt de mail echt, via Microsoft 365. Een mailto-link met een lange
  // tekst plus een volledige Google Docs-URL wordt zo lang dat browsers hem stil
  // laten vallen; dan klik je en gebeurt er niets.
  async function verstuur() {
    const tekst = (ref.current?.innerText || "").trim();
    if (!tekst || verzendt) return;
    const adres = to.trim();
    if (!adres) { setErr("Vul eerst het e-mailadres van de ontvanger in."); return; }
    const ond = onderwerp.trim() || `SEO-taak${t.url ? ` — ${shortUrl(t.url)}` : ""}`;
    const mee = docLinks().filter((l) => links[l.key]).map((l) => ({ label: l.label, url: l.url }));
    setVerzendt(true); setErr("");
    try {
      const d = await fetch("/api/admin/task/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, to: adres, onderwerp: ond, tekst, links: mee, taak: t.taak, url: t.url,
          afbeeldingen: pendingImages, herinnerDagen: herinner ? herinnerDagen : 0 }),
      }).then((r) => r.json());
      if (d?.ok) { wisConcept(); setKlaar(d.samenvatting || "Verstuurd."); setTimeout(onClose, 1600); }
      else setErr(d?.error || "Versturen mislukte.");
    } catch { setErr("Versturen mislukte."); }
    finally { setVerzendt(false); }
  }

  const lijst = docLinks();
  // Alleen tellen wat er ook echt verstopt zit: een oudere versie die je zelf
  // hebt aangevinkt blijft staan, en hoort dan niet in het knopje mee te tellen.
  const aantalOud = lijst.filter((l) => l.ouder && !links[l.key]).length;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) sluit(); }}>
      <div className="wp-mail-modal">
        <div className="wp-mail-head">
          <span className="wp-mail-title">Mail vanuit deze kaart</span>
          <button type="button" className="wp-icon wp-del" title="Sluiten (je concept blijft bewaard)" onClick={sluit}>×</button>
        </div>
        <div className="wp-mail-sub muted">Over: {t.taak.replace(/<[^>]*>/g, "").trim()}</div>
        <div className="wp-mail-aud">
          {([["klant", `Klant${clientName ? ` (${clientName})` : ""}`], ["dev", "Developer"], ["anders", "Anders"]] as const).map(([k, label]) => (
            <button key={k} type="button" className={"wp-aud-pill" + (aud === k ? " wp-aud-actief" : "")}
              onClick={() => {
                setAud(k);
                // Van ontvanger wisselen vult geen adres in en wist ook niets
                // wat je zelf al hebt getypt. De keuze bepaalt alleen de toon en
                // welke documenten meegaan, niet naar wie de mail gaat.
                // Bewust geen herschrijving: dat zou ingesproken tekst wissen.
              }}>{label}</button>
          ))}
          {/* Typ je zelf een adres, dan stelt hij namen voor uit je eigen contacten
              ("ma" geeft Maarten), en verandert de aanhef mee zodra je klaar bent.
              Zo verstuur je nooit "Hoi," terwijl er een naam bij hoort. */}
          <AdresVeld waarde={to} onChange={setTo} onKlaar={zetAanhef}
            className="wp-mail-to" wrapClassName="wp-mail-toveld"
            placeholder="E-mailadres ontvanger" />
        </div>
        {lijst.length > 0 && (
          <div className="wp-mail-links">
            <span className="muted">Meesturen:</span>
            {zichtbaar(lijst, (l) => !!links[l.key], toonOud).map((l) => (
              <label key={l.key} className={"wp-mail-linkchip" + (l.ouder ? " wp-mail-chip-oud" : "")}>
                <input type="checkbox" checked={!!links[l.key]} onChange={(e) => setLinks({ ...links, [l.key]: e.target.checked })} />
                {l.label}
              </label>
            ))}
            {aantalOud > 0 && (
              <button type="button" className="btn btn-quiet btn-klein"
                title="Van elke soort staat de laatste versie in beeld; hieronder staan de eerdere rondes"
                onClick={() => setToonOud((v) => !v)}>
                {toonOud ? "Verberg oudere versies" : `Oudere versies (${aantalOud})`}
              </button>
            )}
          </div>
        )}
        <div className="wp-mail-instrrij">
          <input className="wp-mail-instr" value={instr} onChange={(e) => setInstr(e.target.value)}
            placeholder="Wat moet er in de mail? (optioneel, bijv. 'leg kort uit waar dit vandaan komt')"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void schrijf(links, to); } }} />
          <button type="button" className="btn btn-klein" disabled={busy}
            title="Laat de assistent de mail opnieuw schrijven (je huidige tekst gaat verloren)"
            onClick={() => { wisConcept(); void schrijf(links, to); }}>Laat Claude schrijven</button>
        </div>
        {err && <div className="login-error wp-mail-fout">{err}</div>}
        {klaar && <div className="wp-mail-klaar">{klaar}</div>}
        <label className="wp-mail-onderwerp">
          <span className="wp-mail-onderwerp-label">Onderwerp</span>
          <input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} placeholder="Onderwerp van de mail" />
        </label>
        <div className={"wp-mail-edit" + (dragOver ? " chat-dropping" : "")} contentEditable suppressContentEditableWarning ref={ref}
          data-placeholder="De mail verschijnt hier… (een screenshot erin plakken of slepen mag)" style={{ opacity: busy ? 0.5 : 1 }}
          onBlur={bewaarConcept} onPaste={onPasteImage}
          // Klikken op een meegestuurd document opent het, zodat je nog even kunt
          // controleren of het de goede tekst is voordat je op Versturen drukt.
          onClick={(e) => {
            const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
            if (!a) return;
            e.preventDefault();
            window.open(a.href, "_blank", "noopener,noreferrer");
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropImage} />
        {pendingImages.length > 0 && (
          <div className="chat-img-preview">
            <span className="chat-img-row">
              {pendingImages.map((im, j) => (
                <span key={j} className="chat-img-thumb">
                  <img src={im} alt={`Afbeelding ${j + 1} klaar om mee te sturen`} />
                  <button type="button" className="chat-img-thumb-del" title="Deze afbeelding weghalen" onClick={() => setPendingImages((prev) => prev.filter((_, k) => k !== j))}>&times;</button>
                </span>
              ))}
            </span>
            <span>{pendingImages.length === 1 ? "Gaat onderaan de mail mee." : `${pendingImages.length} afbeeldingen gaan onderaan de mail mee.`} (max 6)</span>
          </div>
        )}
        {busy && <div className="muted" style={{ marginTop: "var(--s-2)" }}>Mail aan het schrijven…</div>}
        <div className="wp-mail-foot">
          {/* Na het versturen is het stil: kwam er antwoord, en is het ook echt
              gedaan? Dat onthouden is handwerk, en handwerk wordt vergeten. */}
          <label className="wp-mail-herinner" title="Op die dag verschijnt er een melding bij het belletje in de kopbalk">
            <input type="checkbox" checked={herinner} onChange={(e) => setHerinner(e.target.checked)} />
            <span>Herinner me over</span>
            <input type="number" min={1} max={90} value={herinnerDagen} disabled={!herinner}
              onChange={(e) => setHerinnerDagen(Math.min(90, Math.max(1, Number(e.target.value) || 1)))} />
            <span>dagen om te checken</span>
          </label>
          <button type="button" className="btn btn-klein" onClick={kopieer} disabled={busy}>Kopieer</button>
          <button type="button" className="btn btn-primary btn-klein" onClick={() => void verstuur()} disabled={busy || verzendt}
            title={to ? `Verstuurt de mail nu naar ${to}` : "Vul eerst het e-mailadres van de ontvanger in"}>
            {verzendt ? "Versturen…" : "Versturen"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

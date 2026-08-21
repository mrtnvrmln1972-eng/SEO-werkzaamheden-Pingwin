"use client";

import React, { useEffect, useRef, useState } from "react";
import { cleanPastedHtml, lijktOpMarkdown, linkifyPlainText } from "../../lib/rich-paste";
import { benoemDriveLinks } from "../../lib/drive-naam";
import { mdToHtml } from "../../lib/markdown";
import { bevatHtmlOpmaak, netteHtml } from "../../lib/nette-html";
import { Ketting, Omlaag, Vink } from "../_ui/Pijl";
import {
  beeldHtml,
  blokVoorSlepen,
  blokOpHoogte,
  checklistItemHtml,
  herstelStructuur,
  magSlepenNaar,
  regelsUitFragment,
  springIn,
  springUit,
  uitklapperHtml,
  verplaatsBlok,
  KL_BEELD,
  KL_CHECK_ITEM,
  KL_CHECK_TEKST,
  KL_VOUW_BODY,
  PLACEHOLDER_ONDERWERP,
  PLACEHOLDER_VOUW_BODY,
} from "../../lib/rijke-tekst";

/**
 * Eén opmaakbaar tekstveld met knoppenbalk, voor overal in het dashboard.
 *
 * Getrokken uit het blok "Zoekwoorden & links", zodat elk veld waarin Maarten
 * zelf tekst opmaakt (dat blok, Top Prio's, de bespreekpunten en de
 * aantekeningen bij een taak) exact hetzelfde werkt: dezelfde knoppen, hetzelfde
 * plakgedrag, dezelfde opgeruimde opmaak. Er komt dus geen tweede half-werkende
 * editor naast te staan.
 *
 * De inhoud wordt bewust NIET door React bestuurd (dan springt de cursor bij
 * elke toetsaanslag): hij gaat één keer in de div en daarna geeft het veld de
 * HTML terug via onChange.
 *
 * ── Waar de vorm bewaakt wordt ──
 * Alles wat over de vórm gaat (wat is een uitklapper, wat is een vinkpunt, wat
 * mag waar staan, en hoe zet je het recht als het scheef staat) woont in
 * `lib/rijke-tekst.ts` en wordt nagerekend door `proeven/rijk-tekst.proef.ts`.
 * Dit bestand gaat alleen over wat de muis en het toetsenbord doen. Reden: dit
 * veld heeft twee keer inhoud gewist (Kamsteeg 11-08, Paul Hoevenaars 14-08) en
 * beide keren is er toen een controle bijgezet die precies dat ene pad dekte.
 * Nu is er één poortwachter, `herstelStructuur`, en die draait na élke
 * structuurwijziging: invoegen, slepen, plakken, Enter, Backspace, en als je
 * het veld verlaat.
 */
export default function RijkTekstVeld({
  waarde, onChange, klasse, autoFocus, placeholder, onKlaar, toolbarExtra, toolbarLabel, compact, slug,
}: {
  waarde: string;
  onChange: (html: string) => void;
  klasse?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Bij welke klant hoort dit veld? Alleen nodig voor een gesleepte
      schermafbeelding: die krijgt dan hetzelfde bereik als de rest van die
      klant. Zonder slug werkt het veld precies zoals het altijd deed. */
  slug?: string;
  /** Escape of klikken buiten het veld: bijvoorbeeld het bewerken sluiten. */
  onKlaar?: () => void;
  toolbarExtra?: React.ReactNode;
  /** Vooraan in de knoppenbalk, links, met de rest van de balk erna naar rechts
      geduwd (bijv. het woord "Aantekeningen" of een bewaar-status): zo hoeft een
      veld geen eigen kopregel meer boven de balk te tekenen. Optioneel. */
  toolbarLabel?: React.ReactNode;
  /** Rechts uitgelijnd en zonder eigen vlak: voor een kort veld waar een volle
      knoppenbalk te zwaar oogt (bijv. de kaartaantekeningen). Optioneel, dus
      andere velden die dit component gebruiken zien geen verschil. */
  compact?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const gevuldRef = useRef(false);
  const kiezerRef = useRef<HTMLInputElement | null>(null);
  // "" = niets aan de hand, anders de melding die over het veld komt te staan.
  // Bewust over het veld heen (een overlay) en niet in de knoppenbalk: die balk
  // is een omslaande rij, dus een woord dat erbij komt duwt hem naar twee regels
  // en dan springt het hele blok. Precies de fout die hierboven al bestond.
  const [beeldMelding, setBeeldMelding] = useState("");

  // ── Onderdelen slepen ──
  // handleRef: het grijpvlekje (zes puntjes) dat meebeweegt naar het onderdeel
  // waar de muis net boven zweeft. hoverBlokRef onthoudt welk onderdeel dat is,
  // sleepBlokRef welk onderdeel je op dit moment sleept, doelRef waar het zou
  // landen. Allemaal buiten React-state gehouden: dit veld bestuurt zijn eigen
  // DOM (zie de uitleg bovenaan), dus een sleepactie werkt direct op de knopen
  // zelf in plaats van via een re-render.
  const handleRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const hoverBlokRef = useRef<HTMLElement | null>(null);
  const sleepBlokRef = useRef<HTMLElement | null>(null);
  const doelRef = useRef<{ blok: HTMLElement; boven: boolean } | null>(null);

  // ── Cursor neerzetten ────────────────────────────────────────────────────
  function zetCaret(el: Node, naarEind = false) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!naarEind);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  }

  // Staat er nog precies de voorbeeldtekst in (van een verse uitklapper die
  // nooit is aangepast), dan selecteert een klik meteen alles: typen overschrijft
  // hem dan meteen, in plaats van dat je hem eerst zelf moet wegselecteren.
  function selecteerAlsPlaceholder(el: HTMLElement, verwacht: string): boolean {
    if ((el.textContent || "").trim() !== verwacht) return false;
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    return true;
  }

  /** Het element waar de cursor nu in staat, of null. */
  function bijCursor(): HTMLElement | null {
    const knoop = window.getSelection()?.anchorNode;
    if (!knoop) return null;
    const el = knoop.nodeType === 1 ? (knoop as HTMLElement) : knoop.parentElement;
    return el && editorRef.current?.contains(el) ? el : null;
  }

  function dichtstbij(selector: string): HTMLElement | null {
    return (bijCursor()?.closest(selector) as HTMLElement | null) || null;
  }

  /** De inhoudsbak van een uitklapper (direct kind, niet die van een uitklapper erin). */
  function vouwBodyVan(details: HTMLElement): HTMLElement | null {
    for (let n = details.firstElementChild; n; n = n.nextElementSibling) {
      if (n.classList.contains(KL_VOUW_BODY)) return n as HTMLElement;
    }
    return null;
  }

  // ── Het grijpvlekje ──────────────────────────────────────────────────────
  // Het staat in een eigen strook links van het tekstvak, niet erbovenop.
  // Daarvóór werd het per onderdeel 18 pixels naar links gezet, en bij een
  // genummerde lijst kwam het daarmee pal over het nummertje te staan: een grijs
  // rastertje dwars door de "1.". Een vaste strook kan dat per definitie niet,
  // want daar staat geen tekst.
  function toonHandleBij(blok: HTMLElement | null) {
    hoverBlokRef.current = blok;
    const handle = handleRef.current;
    const wrap = editorRef.current?.parentElement;
    if (!handle || !wrap) return;
    if (!blok) { handle.classList.remove("rtv-drag-handle-actief"); return; }
    const blokRect = blok.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    // Uitgelijnd op de eerste regel van het onderdeel: bij een hoog blok (een
    // open uitklapper) zou meestrekken met de volle hoogte het vlekje ver van de
    // titel af zetten, in het midden van de hele kaart.
    handle.style.top = `${blokRect.top - wrapRect.top + Math.max(0, (Math.min(blokRect.height, 24) - 20) / 2)}px`;
    handle.classList.add("rtv-drag-handle-actief");
  }

  // Deze twee zitten op de WRAPPER eromheen (niet op het bewerkbare vlak
  // zelf), want het grijpvlekje is een sibling die er links naast staat. Zaten
  // ze op het bewerkbare vlak, dan gaf het verlaten daarvan om het vlekje te
  // bereiken een mouseleave, en verdween het vlekje precies op het moment dat je
  // hem probeerde te pakken (knipperen).
  function onWrapMouseMove(e: React.MouseEvent) {
    if (sleepBlokRef.current) return;
    const veld = editorRef.current;
    if (!veld) return;
    // In de strook links van het tekstvak: laten staan waar hij staat, dat is
    // precies de weg die je muis aflegt om het vlekje te pakken.
    if (e.clientX < veld.getBoundingClientRect().left) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === handleRef.current || handleRef.current?.contains(el)) return;
    if (!veld.contains(el)) { toonHandleBij(null); return; }
    // Onder de muis kijken werkt alleen boven tekst. Beweeg je naar links om het
    // vlekje te pakken, dan kom je door de inspringing van een lijst, en daar
    // zit geen lijstregel: dan kwam er `null` uit en verdween het vlekje precies
    // op het moment dat je hem wilde pakken. Vandaar de terugval op de hoogte.
    toonHandleBij(blokVoorSlepen(veld, el) || blokOpHoogte(veld, e.clientY));
  }
  function onWrapMouseLeave() {
    if (!sleepBlokRef.current) toonHandleBij(null);
  }

  function onHandleDragStart(e: React.DragEvent) {
    const blok = hoverBlokRef.current;
    if (!blok || !editorRef.current?.contains(blok)) { e.preventDefault(); return; }
    sleepBlokRef.current = blok;
    blok.classList.add("rtv-blok-sleept");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
    e.dataTransfer.setDragImage(blok, 12, 12);
  }

  function verbergIndicator() {
    indicatorRef.current?.classList.remove("rtv-drop-indicator-actief");
    doelRef.current = null;
  }

  function opruimenNaSlepen() {
    const blok = sleepBlokRef.current;
    if (blok) {
      blok.classList.remove("rtv-blok-sleept");
      if (!blok.getAttribute("class")) blok.removeAttribute("class");
    }
    sleepBlokRef.current = null;
    verbergIndicator();
    toonHandleBij(null);
  }

  /** Sleept iemand een bestand van buiten de browser naar binnen? */
  function sleeptBestand(e: React.DragEvent): boolean {
    return Array.from(e.dataTransfer?.types || []).includes("Files");
  }

  function onWrapDragOver(e: React.DragEvent) {
    const veld = editorRef.current;
    const sleepBlok = sleepBlokRef.current;
    // Een bestand van het bureaublad: de browser opent dat standaard als pagina
    // en dan ben je weg uit het dashboard. Dit tegenhouden is dus niet netjes
    // maar noodzakelijk, en het moet bij élke beweging opnieuw.
    if (!sleepBlok && sleeptBestand(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      return;
    }
    if (!veld || !sleepBlok) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    // Zelfde terugval als bij het tonen van het vlekje: sleep je over de
    // inspringing van een lijst, dan zit daar geen lijstregel onder de muis en
    // zou de landingsstreep knipperen.
    const blok = (el ? blokVoorSlepen(veld, el) : null) || blokOpHoogte(veld, e.clientY);
    // Zelfde regel als bij het echte verplaatsen, uit dezelfde bron: wat de
    // streep laat zien moet exact zijn wat er straks gebeurt.
    if (!blok || !magSlepenNaar(sleepBlok, blok)) {
      verbergIndicator();
      return;
    }
    const rect = blok.getBoundingClientRect();
    const boven = e.clientY < rect.top + rect.height / 2;
    doelRef.current = { blok, boven };
    const indicator = indicatorRef.current;
    const wrap = veld.parentElement;
    if (!indicator || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    indicator.style.top = `${(boven ? rect.top : rect.bottom) - wrapRect.top}px`;
    indicator.style.left = `${rect.left - wrapRect.left}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.classList.add("rtv-drop-indicator-actief");
  }

  function onWrapDrop(e: React.DragEvent) {
    e.preventDefault();
    const veld = editorRef.current;
    const sleepBlok = sleepBlokRef.current;
    const doel = doelRef.current;
    // Een bestand van buiten: dat is geen verhuizing binnen het veld maar iets
    // nieuws. Hij landt op de hoogte waar je hem loslaat, niet onderaan.
    if (!sleepBlok) {
      const beelden = beeldenUit(e.dataTransfer?.files);
      if (beelden.length) {
        const na = veld ? blokOpHoogte(veld, e.clientY) : null;
        void zetBeeldenNeer(beelden, na);
      } else if (sleeptBestand(e)) {
        meldBeeld("Dit kan hier niet: alleen een afbeelding (png, jpg, gif of webp).", true);
      }
      opruimenNaSlepen();
      return;
    }
    // Alle sloten zitten in `verplaatsBlok`: beide onderdelen moeten in het
    // tekstvak zitten, een blok mag niet in zijn eigen inhoud verdwijnen, en de
    // vorm wordt daarna hersteld. Eén verdwaalde drop die inhoud buiten het veld
    // zet, kost bij het opslaan echte gegevens.
    if (veld && sleepBlok && doel && verplaatsBlok(veld, sleepBlok, doel.blok, doel.boven)) {
      opruimenNaSlepen();
      meld();
      return;
    }
    opruimenNaSlepen();
  }

  useEffect(() => {
    if (!gevuldRef.current && editorRef.current) {
      // Door dezelfde poort als al het andere op het scherm (lib/nette-html.ts).
      // Wat er binnenkomt is niet altijd HTML: de tekst van een doorgezette taak
      // is platte tekst met regeleindes, en in HTML bestaat een regeleinde niet.
      // Die tekst plakte hier dus aan elkaar tot één brei, met kale webadressen
      // ertussen (Bogard, 21-08-2026). Al opgemaakte inhoud gaat ongemoeid naar
      // binnen: dat is de eigen HTML van dit veld (uitklappers, vinklijstjes,
      // beelden), en die hoort niet opnieuw gerenderd te worden.
      editorRef.current.innerHTML = bevatHtmlOpmaak(waarde || "") ? (waarde || "") : netteHtml(waarde || "");
      // Oude inhoud die met eerdere versies scheef geraakt is, heelt hier vanzelf.
      // Alleen doorgeven als er echt iets rechtgezet is, anders schrijft élk
      // openen van een klantscherm een opslag weg.
      if (herstelStructuur(editorRef.current)) meld();
      gevuldRef.current = true;
      if (autoFocus) editorRef.current.focus();
    }
  }, [waarde, autoFocus]);

  function fixLinks() {
    editorRef.current?.querySelectorAll("a[href]").forEach((a) => {
      (a as HTMLAnchorElement).target = "_blank";
      (a as HTMLAnchorElement).rel = "noreferrer";
    });
  }

  function meld() {
    fixLinks();
    onChange(editorRef.current?.innerHTML || "");
  }

  /** Na alles wat de vorm raakt: eerst rechtzetten, dan pas doorgeven. */
  function herstelEnMeld() {
    if (editorRef.current) herstelStructuur(editorRef.current);
    meld();
  }

  /**
   * Na het plakken: geef elke Google-link de naam van zijn document.
   *
   * Apart van herstelEnMeld omdat het opzoeken een rondje naar Drive kost, en
   * dat mag het plakken zelf niet ophouden. De tekst staat er dus meteen; een
   * seconde later staat de naam er in plaats van het adres. Lukt het niet, dan
   * blijft de link staan zoals hij was.
   */
  function benoemEnMeld() {
    void benoemDriveLinks(editorRef.current).then((veranderd) => { if (veranderd) meld(); });
  }

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    herstelEnMeld();
  }

  // ── Een heel blok neerzetten ─────────────────────────────────────────────
  // Bewust NIET via `insertHTML` van de browser. Die knipt de alinea waar je
  // cursor in staat doormidden en maakt van het kopje van een uitklapper een
  // stuk vetgedrukte tekst dat in die alinea achterblijft, mét hardgecodeerde
  // lettergroottes erin. Precies het "hij reageert heel raar" dat je ziet als je
  // midden in een lijstje een uitklapper of een vinklijst wilt beginnen.
  //
  // In plaats daarvan zetten we het nieuwe blok zelf neer: netjes ná het
  // onderdeel waar de cursor in staat, of erbovenop als dat een lege regel is.
  // Staat de cursor in een uitklapper, dan is dat onderdeel de alinea binnen de
  // uitklapper, dus komt het nieuwe blok daar netjes in te staan.
  function zetBlokNeer(html: string, hierNa?: HTMLElement | null): HTMLElement[] {
    const veld = editorRef.current;
    if (!veld) return [];
    const bak = document.createElement("div");
    bak.innerHTML = html;
    const nieuw = Array.from(bak.children) as HTMLElement[];
    if (!nieuw.length) return [];
    const hier = hierNa && veld.contains(hierNa) ? hierNa : blokVoorSlepen(veld, bijCursor());
    const legeRegel = hier && !hier.textContent?.trim() && hier.tagName === "P";
    let na: Node = hier || veld.lastElementChild || veld;
    for (const blok of nieuw) {
      if (na === veld) veld.appendChild(blok);
      else { (na as HTMLElement).after(blok); na = blok; }
    }
    if (legeRegel && hier) hier.remove();
    return nieuw;
  }

  // ── Uitklapper (zoals in Notion) ──
  // Een onderwerp met een driehoekje ervoor, en daaronder alles wat je erbij wilt
  // plakken. Zonder dit werd dit veld één lange lap: alles stond onder elkaar en
  // je kon niets wegklappen. Bewust met de <details> van de browser zelf, dus
  // zonder eigen scriptwerk: dat blijft ook staan in de opgeslagen tekst.
  function voegUitklapperToe() {
    editorRef.current?.focus();
    const nieuw = zetBlokNeer(uitklapperHtml());
    herstelEnMeld();
    // Pas hierna de cursor neerzetten: het herstellen kan nog knopen verplaatsen,
    // en dan zou de selectie die we net zetten alweer weg zijn. Het woord
    // "Onderwerp" wordt meteen geselecteerd, zodat je je eigen titel kunt typen
    // zonder eerst iets weg te halen.
    setTimeout(() => {
      const kop = nieuw[0]?.querySelector("summary") as HTMLElement | null;
      if (kop && editorRef.current?.contains(kop)) {
        if (!selecteerAlsPlaceholder(kop, PLACEHOLDER_ONDERWERP)) zetCaret(kop, true);
      }
    }, 0);
  }

  // ── Afvinklijstje (checklist) ──
  // Elke regel een eigen vinkje, zoals in Notion: klik het vakje aan en de
  // regel gaat doorgestreept. Werkt overal in het veld, ook binnen een
  // uitklapper, want het is gewoon HTML die met de rest van de tekst wordt
  // opgeslagen. Staat er tekst geselecteerd (bijvoorbeeld een geplakt rijtje
  // pagina's), dan wordt elke regel een eigen vinkpunt; zonder selectie komt
  // er één leeg punt bij om zelf te vullen.
  //
  // De regels worden mét hun opmaak overgenomen. Dat ging eerder via `innerText`
  // en dan hield je van `/hovenier/breda/` alleen de tekst over: de link was weg,
  // en dat merk je pas als je er later op wilt klikken.
  function voegChecklistToe() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const heeftSelectie = !!(sel && !sel.isCollapsed && sel.rangeCount > 0);
    const regels = heeftSelectie ? regelsUitFragment(sel!.getRangeAt(0).cloneContents()) : [];
    if (!regels.length) {
      // Geen selectie: één leeg punt neerzetten en de cursor erin. Zelf plaatsen
      // in plaats van via de browser, anders belandt het punt binnen de regel
      // waar je cursor toevallig stond.
      const nieuw = zetBlokNeer(checklistItemHtml(""));
      herstelEnMeld();
      setTimeout(() => {
        const vak = nieuw[0]?.querySelector(`.${KL_CHECK_TEKST}`) as HTMLElement | null;
        if (vak && editorRef.current?.contains(vak)) zetCaret(vak);
      }, 0);
      return;
    }
    // Wél een selectie: die moet vervangen worden, dus dit gaat via de browser.
    // Wat hij daarbij aanricht (alle punten in één lijstregel proppen) wordt
    // door `herstelStructuur` weer rechtgezet, mét behoud van de volgorde.
    document.execCommand("insertHTML", false, regels.map((r) => checklistItemHtml(r)).join(""));
    herstelEnMeld();
  }

  function addLink() {
    editorRef.current?.focus();
    const url = window.prompt("Link naar (URL of document):", "https://");
    if (!url) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
    meld();
  }

  // ── Een screendump erin slepen ────────────────────────────────────────────
  // Je sleept of plakt een schermafbeelding en hij staat er, op ware grootte in
  // beeld, klikbaar om hem groot te bekijken. Zonder dit moest je hem eerst
  // ergens opslaan, dan naar Drive, dan de link terugplakken, en dan zag je nog
  // steeds alleen een link.
  //
  // Het beeld gaat éérst naar de server en komt pas daarna in de tekst. Dat
  // voelt een tel trager, maar het is de enige volgorde die veilig is: zou het
  // beeld er meteen staan met een tijdelijk browser-adres (`blob:`), dan schrijft
  // het veld dat adres mee weg zodra je een letter typt, en dat adres bestaat na
  // het verversen van de pagina niet meer. Dan staat er een kapot plaatje.

  const meldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function meldBeeld(tekst: string, verdwijnt = false) {
    if (meldTimerRef.current) clearTimeout(meldTimerRef.current);
    setBeeldMelding(tekst);
    if (verdwijnt && tekst) meldTimerRef.current = setTimeout(() => setBeeldMelding(""), 6000);
  }
  useEffect(() => () => { if (meldTimerRef.current) clearTimeout(meldTimerRef.current); }, []);

  /** De afbeeldingen uit een sleep- of plakactie. */
  function beeldenUit(lijst: FileList | null | undefined): File[] {
    return Array.from(lijst || []).filter((f) => f.type.startsWith("image/"));
  }

  /**
   * Een heel groot beeld kleiner maken vóór het de deur uit gaat.
   *
   * Een gewone schermafbeelding blijft ruim onder de grens en gaat dus
   * ongewijzigd mee: geen kwaliteitsverlies waar het niet nodig is. Alleen een
   * uitzonderlijk groot bestand (een foto uit een telefoon) wordt teruggeschaald,
   * want anders wordt hij simpelweg geweigerd en heb je niets.
   */
  async function kleinerAlsNodig(bestand: File): Promise<File> {
    const GRENS = 12 * 1024 * 1024;
    if (bestand.size <= GRENS) return bestand;
    try {
      const beeld = await createImageBitmap(bestand);
      const schaal = Math.min(1, 2000 / Math.max(beeld.width, beeld.height));
      const doek = document.createElement("canvas");
      doek.width = Math.round(beeld.width * schaal);
      doek.height = Math.round(beeld.height * schaal);
      doek.getContext("2d")?.drawImage(beeld, 0, 0, doek.width, doek.height);
      const blob = await new Promise<Blob | null>((klaar) => doek.toBlob(klaar, "image/jpeg", 0.9));
      if (!blob || blob.size >= bestand.size) return bestand;
      return new File([blob], (bestand.name || "schermafbeelding").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      return bestand;
    }
  }

  async function zetBeeldenNeer(bestanden: File[], naBlok?: HTMLElement | null) {
    const veld = editorRef.current;
    if (!veld || !bestanden.length) return;
    // De plek onthouden waar hij hoort te landen: na het wachten op de server is
    // de selectie vaak weg, en dan zou het beeld onderaan het veld belanden in
    // plaats van waar je hem liet vallen.
    let na = naBlok || blokVoorSlepen(veld, bijCursor());
    meldBeeld(bestanden.length > 1 ? `${bestanden.length} afbeeldingen toevoegen…` : "Afbeelding toevoegen…");
    for (const bestand of bestanden) {
      try {
        const klaar = await kleinerAlsNodig(bestand);
        const form = new FormData();
        form.append("beeld", klaar, klaar.name || "schermafbeelding.png");
        if (slug) form.append("slug", slug);
        const d = await fetch("/api/admin/beeld", { method: "POST", body: form }).then((r) => r.json());
        if (!d?.ok) { meldBeeld(d?.error || "De afbeelding kon niet bewaard worden.", true); return; }
        na = zetBlokNeer(beeldHtml(d.url, d.naam), na)[0] || na;
      } catch {
        meldBeeld("De afbeelding kon niet bewaard worden.", true);
        return;
      }
    }
    herstelEnMeld();
    meldBeeld("");
  }

  function kiesBeeld() {
    kiezerRef.current?.click();
  }

  // Klik op een link opent hem in een nieuw tabblad, ook tijdens het bewerken.
  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    // Een vinkje aanklikken: de browser zet het vakje zelf om, maar dat is
    // alleen de DOM-eigenschap. Zonder dit stukje staat de aangevinkte stand
    // niet in de opgeslagen HTML en is hij na herladen weer weg.
    if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "checkbox") {
      setTimeout(herstelEnMeld, 0);
      return;
    }
    // In het kopje van een uitklapper: klik je op het driehoekje links, dan klapt
    // hij open of dicht; klik je op de tekst, dan zet je gewoon je cursor neer.
    // Zonder dat onderscheid kun je de titel niet bewerken zonder hem dicht te
    // klappen, en dat maakt de uitklapper onbruikbaar.
    const kop = (t.tagName === "SUMMARY" ? t : t.closest("summary")) as HTMLElement | null;
    if (kop) {
      const opDriehoek = e.clientX - kop.getBoundingClientRect().left < 24;
      if (!opDriehoek) {
        e.preventDefault();
        selecteerAlsPlaceholder(kop, PLACEHOLDER_ONDERWERP);
        return;
      }
      // Wel open of dicht: de nieuwe stand moet mee opgeslagen worden, anders
      // staat hij na herladen weer open.
      setTimeout(meld, 0);
      return;
    }
    // Zelfde voor de inhoud van een verse uitklapper: klik je erin terwijl er
    // nog "Zet hier neer wat erbij hoort." staat, dan gaat die meteen weg.
    const vouwBody = (t.classList?.contains(KL_VOUW_BODY) ? t : t.closest(`.${KL_VOUW_BODY}`)) as HTMLElement | null;
    if (vouwBody && selecteerAlsPlaceholder(vouwBody, PLACEHOLDER_VOUW_BODY)) return;
    // Een beeld in de tekst: klikken opent hem op ware grootte in een nieuw
    // tabblad. In de kaart staat hij op leesbreedte, en dat is voor een
    // schermafbeelding met kleine letters vaak net te klein.
    if (t.tagName === "IMG" && t.classList.contains(KL_BEELD)) {
      e.preventDefault();
      const w = window.open((t as HTMLImageElement).src, "_blank");
      if (w) w.opener = null;
      return;
    }
    const a = (t.tagName === "A" ? t : t.closest("a")) as HTMLAnchorElement | null;
    if (a && a.href && !a.href.startsWith("javascript:")) {
      e.preventDefault();
      // Zonder features-argument: met een derde argument opent Chrome een LOS
      // popup-venster in plaats van een nieuw tabblad. Opener null voor veiligheid.
      const w = window.open(a.href, "_blank");
      if (w) w.opener = null;
    }
  }

  /** Staat de cursor helemaal vooraan in dit vakje? */
  function caretAanBegin(vak: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.rangeCount) return false;
    const r = sel.getRangeAt(0);
    if (!vak.contains(r.startContainer)) return false;
    const test = document.createRange();
    test.selectNodeContents(vak);
    test.setEnd(r.startContainer, r.startOffset);
    return test.toString().length === 0;
  }

  // ── Enter op een vinkregel ───────────────────────────────────────────────
  // Precies zoals bij een gewone lijst: een nieuw punt eronder, en op een lege
  // regel stap je uit de lijst. Twee dingen die er eerder niet in zaten en die
  // het "raar" maakten: staat de cursor midden in een regel, dan hoort de tekst
  // ná de cursor mee te verhuizen naar het nieuwe punt (hij bleef achter),
  // en staat er iets geselecteerd, dan hoort dat eerst weg te gaan (het bleef
  // gewoon staan, dus je hield dubbele tekst over).
  function enterOpVinkregel(tekstVak: HTMLElement): boolean {
    const item = tekstVak.closest(`.${KL_CHECK_ITEM}`) as HTMLElement | null;
    const sel = window.getSelection();
    if (!item || !sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();

    if (!tekstVak.textContent?.trim()) {
      // Lege regel: uit de lijst stappen, zodat je verder kunt met gewone tekst.
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      item.replaceWith(p);
      zetCaret(p);
      return true;
    }

    // Splitsen op de cursor: alles ná de cursor gaat mee naar het nieuwe punt.
    let staart: DocumentFragment | null = null;
    if (tekstVak.contains(range.endContainer)) {
      const rest = document.createRange();
      rest.selectNodeContents(tekstVak);
      rest.setStart(range.endContainer, range.endOffset);
      staart = rest.extractContents();
    }
    item.insertAdjacentHTML("afterend", checklistItemHtml(""));
    const nieuwItem = item.nextElementSibling as HTMLElement | null;
    const nieuwTekst = nieuwItem?.querySelector(`.${KL_CHECK_TEKST}`) as HTMLElement | null;
    if (!nieuwTekst) return true;
    if (staart && staart.textContent?.trim()) {
      nieuwTekst.innerHTML = "";
      nieuwTekst.appendChild(staart);
    }
    if (!tekstVak.firstChild) tekstVak.innerHTML = "<br>";
    zetCaret(nieuwTekst);
    return true;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); addLink(); return; }
    if (e.key === "Escape" && onKlaar) { e.preventDefault(); onKlaar(); return; }

    // ── Tab: een punt onder een punt ────────────────────────────────────────
    // Werkt op een opsomming, een genummerde lijst en een vinklijst. Alleen
    // daar: staat de cursor in gewone tekst, dan houdt Tab zijn normale werk
    // (naar het volgende veld springen), want dat is de enige manier om met het
    // toetsenbord uit dit vak te komen.
    if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const veld = editorRef.current;
      const blok = veld ? blokVoorSlepen(veld, bijCursor()) : null;
      const kanInspringen = !!blok && (blok.tagName === "LI" || blok.classList.contains(KL_CHECK_ITEM));
      if (blok && kanInspringen) {
        e.preventDefault();
        // Waar de cursor stond onthouden en terugzetten: het onderdeel verhuist
        // naar een andere plek in de boom, en dan raakt de browser de cursor
        // kwijt. Zonder dit sta je na één Tab ineens ergens anders te typen.
        const sel = window.getSelection();
        const plek = sel && sel.rangeCount ? { knoop: sel.anchorNode, offset: sel.anchorOffset } : null;
        const gelukt = e.shiftKey ? springUit(blok) : springIn(blok);
        if (gelukt) {
          if (plek?.knoop && veld?.contains(plek.knoop)) {
            const r = document.createRange();
            try {
              r.setStart(plek.knoop, plek.offset);
              r.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(r);
            } catch { /* de knoop is opgegaan in het verplaatsen; cursor blijft waar hij is */ }
          }
          herstelEnMeld();
        }
        return;
      }
    }

    // Backspace vooraan op een vinkregel haalde het vakje weg en liet een halve
    // regel achter die zich nergens meer naar gedroeg (het vakje staat op
    // "niet bewerkbaar", dus de browser wist het in één keer). Nu wordt het een
    // gewone regel, met de tekst die erin stond.
    if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey) {
      const tekstVak = dichtstbij(`.${KL_CHECK_TEKST}`);
      const item = tekstVak?.closest(`.${KL_CHECK_ITEM}`) as HTMLElement | null;
      if (tekstVak && item && caretAanBegin(tekstVak)) {
        e.preventDefault();
        const p = document.createElement("p");
        while (tekstVak.firstChild) p.appendChild(tekstVak.firstChild);
        if (!p.firstChild) p.innerHTML = "<br>";
        item.replaceWith(p);
        zetCaret(p);
        herstelEnMeld();
        return;
      }
    }

    // Shift+Enter is een zachte regelafbreking; die laten we aan de browser.
    if (e.key !== "Enter" || e.shiftKey) return;

    const tekstVak = dichtstbij(`.${KL_CHECK_TEKST}`);
    if (tekstVak) {
      e.preventDefault();
      if (enterOpVinkregel(tekstVak)) herstelEnMeld();
      return;
    }

    // Enter in het kopje van een uitklapper springt naar de inhoud eronder, in
    // plaats van een tweede regel in de titel te maken. Staat de uitklapper
    // dicht, dan gaat hij eerst open: anders zet je de cursor in tekst die je
    // niet kunt zien en typ je blind.
    const kop = dichtstbij("summary");
    const details = kop?.parentElement?.tagName === "DETAILS" ? (kop.parentElement as HTMLDetailsElement) : null;
    if (kop && details) {
      e.preventDefault();
      if (!details.open) details.open = true;
      herstelEnMeld();
      // Pas hierna de cursor zetten, anders veegt het herstellen de selectie weg
      // en typ je vóór de voorbeeldtekst in plaats van eroverheen.
      setTimeout(() => {
        const body = vouwBodyVan(details);
        if (!body || !editorRef.current?.contains(body)) return;
        if (!selecteerAlsPlaceholder(body, PLACEHOLDER_VOUW_BODY)) zetCaret(body);
      }, 0);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    // Een screendump uit het klembord (Cmd+Shift+4 op de Mac, of "kopieer
    // afbeelding" op een webpagina) komt hier binnen als bestand. Eerst kijken,
    // want zo'n plakactie heeft vaak óók een stukje HTML bij zich, en dan zou de
    // tekstroute hieronder het beeld stilletjes weglaten.
    const geplakteBeelden = beeldenUit(e.clipboardData?.files);
    if (geplakteBeelden.length) {
      e.preventDefault();
      void zetBeeldenNeer(geplakteBeelden);
      return;
    }
    const pasteHtml = e.clipboardData.getData("text/html");
    const pasteText = e.clipboardData.getData("text/plain");

    // Opmaak uit de chat ernaast, uit Sheets, Docs of een webpagina: lettertypes,
    // kleuren en classes van buiten gaan eruit, de STRUCTUUR blijft staan (koppen,
    // bullets, genummerde lijsten, lijnen, citaten, alinea's, tabel). Dat laatste
    // is het verschil tussen een muur tekst en dezelfde opmaak als in de chat
    // waar je hem vandaan kopieerde; zie de uitleg in lib/rich-paste.ts.
    if (pasteHtml && /<\w/.test(pasteHtml)) {
      const cleaned = cleanPastedHtml(pasteHtml, { keepTables: true, rich: true });
      if (cleaned) { e.preventDefault(); document.execCommand("insertHTML", false, cleaned); herstelEnMeld(); benoemEnMeld(); return; }
    }
    // Platte tekst die markdown ís (`## kop`, `- punt`, `1. punt`, een tabel met
    // pipes): meteen renderen. Zonder dit staan de hekjes en de sterretjes
    // letterlijk in beeld, en dat is precies de regel "nooit ruwe markdown in
    // beeld". Komt vaak voor: tekst uit een AI-chat kopiëren levert vaak alleen
    // platte tekst op, ook al zag hij er opgemaakt uit.
    if (pasteText && lijktOpMarkdown(pasteText)) {
      e.preventDefault();
      document.execCommand("insertHTML", false, mdToHtml(pasteText));
      herstelEnMeld();
      benoemEnMeld();
      return;
    }
    // Platte tekst met URL's: regels behouden en de URL's meteen klikbaar maken.
    if (pasteText && /https?:\/\//i.test(pasteText)) {
      e.preventDefault();
      document.execCommand("insertHTML", false, linkifyPlainText(pasteText));
      herstelEnMeld();
      benoemEnMeld();
      return;
    }
    setTimeout(() => { herstelEnMeld(); benoemEnMeld(); }, 0);
  }

  // Verlaat je het veld, dan is dat het rustigste moment om de vorm recht te
  // zetten: er springt geen cursor meer van, en wat er scheef stond gaat zo niet
  // mee de opslag in.
  function onVeldBlur() {
    if (editorRef.current && herstelStructuur(editorRef.current)) meld();
  }

  return (
    <div className="rtv" onMouseMove={onWrapMouseMove} onMouseLeave={onWrapMouseLeave} onDragOver={onWrapDragOver} onDrop={onWrapDrop}>
      <div className={"focus-toolbar" + (compact ? " focus-toolbar-compact" : "")}>
        {toolbarLabel && <span className="focus-toolbar-label">{toolbarLabel}</span>}
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} title="Vet (Cmd+B)"><strong>B</strong></button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} title="Cursief (Cmd+I)"><em>I</em></button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} title="Bullets">&bull; lijst</button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={voegChecklistToe} title="Afvinklijstje: staat er tekst geselecteerd, dan wordt elke regel een eigen vinkpunt"><Vink /> vinklijst</button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={voegUitklapperToe} title="Uitklapper: een onderwerp met een driehoekje, en daaronder alles wat erbij hoort"><Omlaag /> uitklapper</button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={addLink} title="Link toevoegen (Cmd+K)"><Ketting /> link</button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("unlink")} title="Link verwijderen">link weg</button>
        <button type="button" className="werkbalk-knop" onMouseDown={(e) => e.preventDefault()} onClick={kiesBeeld} title="Schermafbeelding toevoegen (slepen of plakken kan ook)">beeld</button>
        {toolbarExtra}
      </div>
      {/* Het beeld kiezen via de knop. Slepen en plakken lopen langs dezelfde
          weg; dit is er voor als je het bestand al ergens hebt staan. */}
      <input
        ref={kiezerRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const gekozen = beeldenUit(e.target.files);
          e.target.value = "";
          void zetBeeldenNeer(gekozen);
        }}
      />
      <div
        ref={editorRef}
        className={"focus-rich focus-editable " + (klasse || "")}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || ""}
        onInput={meld}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={onVeldBlur}
      />
      {/* Los van de tekst zelf (staat dus nooit mee in de opgeslagen HTML): het
          grijpvlekje bij het onderdeel waar de muis boven zweeft, en de streep
          die laat zien waar het zou landen. Het vlekje staat in een eigen strook
          links van het tekstvak, zodat het nooit over een nummer of bullet valt. */}
      <div
        ref={handleRef}
        className="rtv-drag-handle"
        draggable
        title="Sleep dit onderdeel naar een andere plek"
        onDragStart={onHandleDragStart}
        onDragEnd={opruimenNaSlepen}
      >
        <span /><span /><span /><span /><span /><span />
      </div>
      <div ref={indicatorRef} className="rtv-drop-indicator" />
      {/* Wat er met een gesleept beeld gebeurt. Bewust hierboven en niet in de
          knoppenbalk: die balk slaat om naar een tweede regel zodra er een woord
          bij komt, en dan springt het hele blok onder je handen weg. */}
      {beeldMelding && <div className="rtv-beeld-melding">{beeldMelding}</div>}
    </div>
  );
}

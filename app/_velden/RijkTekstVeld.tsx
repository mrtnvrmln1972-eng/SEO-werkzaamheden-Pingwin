"use client";

import React, { useEffect, useRef } from "react";
import { cleanPastedHtml, linkifyPlainText } from "../../lib/rich-paste";
import { escapeHtml } from "../../lib/veilige-html";

/**
 * Eén opmaakbaar tekstveld met knoppenbalk, voor overal in het dashboard.
 *
 * Getrokken uit het blok "Zoekwoorden & links", zodat elk veld waarin Maarten
 * zelf tekst opmaakt (dat blok, Top Prio's, en nu ook de bespreekpunten) exact
 * hetzelfde werkt: dezelfde knoppen, hetzelfde plakgedrag, dezelfde opgeruimde
 * opmaak. Er komt dus geen tweede half-werkende editor naast te staan.
 *
 * De inhoud wordt bewust NIET door React bestuurd (dan springt de cursor bij
 * elke toetsaanslag): hij gaat één keer in de div en daarna geeft het veld de
 * HTML terug via onChange.
 */
export default function RijkTekstVeld({
  waarde, onChange, klasse, autoFocus, placeholder, onKlaar, toolbarExtra, toolbarLabel, compact,
}: {
  waarde: string;
  onChange: (html: string) => void;
  klasse?: string;
  autoFocus?: boolean;
  placeholder?: string;
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

  const PLACEHOLDER_ONDERWERP = "Onderwerp";
  const PLACEHOLDER_VOUW_BODY = "Zet hier neer wat erbij hoort.";

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

  // Een "onderdeel" om te slepen is een regel op het niveau waar hij staat:
  // een rechtstreeks kind van het veld zelf, van de inhoud van een uitklapper,
  // of van een lijst (dan is het één bullet/nummer). Zo kun je een uitklapper
  // tussen andere tekst zetten, of één bullet binnen zijn eigen lijstje.
  function isSleepBak(el: Element | null): boolean {
    if (!el) return false;
    return el === editorRef.current || el.classList.contains("rtv-vouw-body")
      || el.tagName === "UL" || el.tagName === "OL";
  }
  function blokVoorSlepen(node: Node | null): HTMLElement | null {
    let n: Element | null = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement) : null;
    while (n && n.parentElement) {
      if (isSleepBak(n.parentElement)) return n as HTMLElement;
      n = n.parentElement;
    }
    return null;
  }

  function toonHandleBij(blok: HTMLElement | null) {
    hoverBlokRef.current = blok;
    const handle = handleRef.current;
    const wrap = editorRef.current?.parentElement;
    if (!handle || !wrap) return;
    if (!blok) { handle.classList.remove("rtv-drag-handle-actief"); return; }
    const blokRect = blok.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    // Vaste hoogte, uitgelijnd op de eerste regel van het onderdeel: bij een
    // hoog blok (een open uitklapper) zou meestrekken met de volle hoogte het
    // vlekje ver van de titel af zetten, in het midden van de hele kaart.
    handle.style.top = `${blokRect.top - wrapRect.top + Math.max(0, (Math.min(blokRect.height, 22) - 20) / 2)}px`;
    handle.style.left = `${Math.max(2, blokRect.left - wrapRect.left - 18)}px`;
    handle.classList.add("rtv-drag-handle-actief");
  }

  // Deze twee zitten op de WRAPPER eromheen (niet op het bewerkbare vlak
  // zelf), want het grijpvlekje is een sibling die er soms net buiten steekt.
  // Zaten ze op het bewerkbare vlak, dan gaf het verlaten daarvan om het
  // vlekje te bereiken een mouseleave, en verdween het vlekje precies op het
  // moment dat je hem probeerde te pakken (knipperen).
  function onWrapMouseMove(e: React.MouseEvent) {
    if (sleepBlokRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    // Op het vlekje zelf: gewoon laten staan waar het al staat.
    if (!el || el === handleRef.current || handleRef.current?.contains(el)) return;
    if (!editorRef.current?.contains(el)) { toonHandleBij(null); return; }
    toonHandleBij(blokVoorSlepen(el));
  }
  function onWrapMouseLeave() {
    if (!sleepBlokRef.current) toonHandleBij(null);
  }

  function onHandleDragStart(e: React.DragEvent) {
    const blok = hoverBlokRef.current;
    if (!blok) { e.preventDefault(); return; }
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
      if (!blok.className) blok.removeAttribute("class");
    }
    sleepBlokRef.current = null;
    verbergIndicator();
    toonHandleBij(null);
  }

  function onWrapDragOver(e: React.DragEvent) {
    const sleepBlok = sleepBlokRef.current;
    if (!sleepBlok) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const blok = el ? blokVoorSlepen(el) : null;
    // Alleen laten landen bij een ander onderdeel op hetzelfde niveau; anders
    // zou je een bullet zomaar tussen een heel andere lijst kunnen droppen.
    if (!blok || blok === sleepBlok || blok.parentElement !== sleepBlok.parentElement) {
      verbergIndicator();
      return;
    }
    const rect = blok.getBoundingClientRect();
    const boven = e.clientY < rect.top + rect.height / 2;
    doelRef.current = { blok, boven };
    const indicator = indicatorRef.current;
    const wrap = editorRef.current?.parentElement;
    if (!indicator || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    indicator.style.top = `${(boven ? rect.top : rect.bottom) - wrapRect.top}px`;
    indicator.style.left = `${rect.left - wrapRect.left}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.classList.add("rtv-drop-indicator-actief");
  }

  function onWrapDrop(e: React.DragEvent) {
    e.preventDefault();
    const sleepBlok = sleepBlokRef.current;
    const doel = doelRef.current;
    if (sleepBlok && doel && doel.blok !== sleepBlok) {
      if (doel.boven) doel.blok.before(sleepBlok);
      else doel.blok.after(sleepBlok);
      opruimenNaSlepen();
      meld();
      return;
    }
    opruimenNaSlepen();
  }

  useEffect(() => {
    if (!gevuldRef.current && editorRef.current) {
      editorRef.current.innerHTML = waarde || "";
      zorgVoorRegelBoven();
      gevuldRef.current = true;
      if (autoFocus) editorRef.current.focus();
    }
  }, [waarde, autoFocus]);

  // Begint de inhoud meteen met een uitklapper of een vinkpunt, dan is er geen
  // gewone regel om de cursor bovenaan neer te zetten: klikken in de ruimte
  // erboven springt dan in het kopje van dat blok, en je kunt er niets meer
  // vóór typen. Daarom staat er altijd een gewone (evt. lege) regel boven zo'n
  // blok als het toevallig het allereerste is.
  function zorgVoorRegelBoven() {
    const el = editorRef.current;
    if (!el) return;
    const eerste = el.firstElementChild;
    if (eerste && (eerste.tagName === "DETAILS" || eerste.classList.contains("rtv-check-item"))) {
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      el.insertBefore(p, eerste);
    }
  }

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

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    meld();
  }

  // ── Uitklapper (zoals in Notion) ──
  // Een onderwerp met een driehoekje ervoor, en daaronder alles wat je erbij wilt
  // plakken. Zonder dit werd dit veld één lange lap: alles stond onder elkaar en
  // je kon niets wegklappen. Bewust met de <details> van de browser zelf, dus
  // zonder eigen scriptwerk: dat blijft ook staan in de opgeslagen tekst.
  function voegUitklapperToe() {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false,
      `<details class="rtv-vouw" open><summary>${PLACEHOLDER_ONDERWERP}</summary>`
      + `<div class="rtv-vouw-body">${PLACEHOLDER_VOUW_BODY}</div></details><p><br></p>`);
    // De cursor in het kopje zetten en het woord "Onderwerp" selecteren, zodat je
    // meteen je eigen titel kunt typen zonder eerst iets weg te halen.
    setTimeout(() => {
      const laatste = editorRef.current?.querySelectorAll("summary");
      const kop = laatste?.[laatste.length - 1];
      if (!kop) return;
      const r = document.createRange();
      r.selectNodeContents(kop);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }, 0);
    zorgVoorRegelBoven();
    meld();
  }

  // ── Afvinklijstje (checklist) ──
  // Elke regel een eigen vinkje, zoals in Notion: klik het vakje aan en de
  // regel gaat doorgestreept. Werkt overal in het veld, ook binnen een
  // uitklapper, want het is gewoon HTML die met de rest van de tekst wordt
  // opgeslagen. Staat er tekst geselecteerd (bijvoorbeeld een geplakt rijtje
  // pagina's), dan wordt elke regel een eigen vinkpunt; zonder selectie komt
  // er één leeg punt bij om zelf te vullen.
  function checklistItemHtml(tekst: string): string {
    return `<div class="rtv-check-item"><label contenteditable="false" class="rtv-check-box"><input type="checkbox"></label><span class="rtv-check-tekst">${escapeHtml(tekst) || "<br>"}</span></div>`;
  }

  // Geselecteerde tekst kan van alles zijn: losse regels als aparte <div>'s
  // (zo typt de browser ze), of één blok met <br>'s ertussen (zo komt een
  // plakactie er meestal uit). Door de selectie in een onzichtbaar bakje te
  // kopiëren en `innerText` te lezen, levert de browser zelf de juiste
  // regelindeling op, ongeacht welke van de twee het is.
  function regelsUitSelectie(range: Range): string[] {
    const bakje = document.createElement("div");
    bakje.style.position = "fixed";
    bakje.style.left = "-9999px";
    bakje.style.whiteSpace = "pre-wrap";
    bakje.appendChild(range.cloneContents());
    document.body.appendChild(bakje);
    const tekst = bakje.innerText || bakje.textContent || "";
    document.body.removeChild(bakje);
    return tekst.split("\n").map((r) => r.trim()).filter(Boolean);
  }

  function voegChecklistToe() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const heeftSelectie = !!(sel && !sel.isCollapsed && sel.rangeCount > 0);
    const regels = heeftSelectie ? regelsUitSelectie(sel!.getRangeAt(0)) : [];
    const html = (regels.length ? regels : [""]).map(checklistItemHtml).join("");
    document.execCommand("insertHTML", false, html);
    // Zonder (bruikbare) selectie: cursor meteen in het nieuwe lege punt
    // zetten, zodat je meteen kunt typen zonder eerst iets weg te halen.
    if (!regels.length) {
      setTimeout(() => {
        const items = editorRef.current?.querySelectorAll(".rtv-check-tekst");
        const laatste = items?.[items.length - 1] as HTMLElement | undefined;
        if (!laatste) return;
        const r = document.createRange();
        r.selectNodeContents(laatste);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
      }, 0);
    }
    zorgVoorRegelBoven();
    meld();
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

  // Klik op een link opent hem in een nieuw tabblad, ook tijdens het bewerken.
  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    // Een vinkje aanklikken: de browser zet het vakje zelf om, maar dat is
    // alleen de DOM-eigenschap. Zonder dit stukje staat de aangevinkte stand
    // niet in de opgeslagen HTML en is hij na herladen weer weg.
    if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "checkbox") {
      const box = t as HTMLInputElement;
      setTimeout(() => {
        const item = box.closest(".rtv-check-item");
        if (box.checked) { box.setAttribute("checked", ""); item?.classList.add("rtv-check-af"); }
        else { box.removeAttribute("checked"); item?.classList.remove("rtv-check-af"); }
        meld();
      }, 0);
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
    const vouwBody = (t.classList?.contains("rtv-vouw-body") ? t : t.closest(".rtv-vouw-body")) as HTMLElement | null;
    if (vouwBody && selecteerAlsPlaceholder(vouwBody, PLACEHOLDER_VOUW_BODY)) return;
    const a = (t.tagName === "A" ? t : t.closest("a")) as HTMLAnchorElement | null;
    if (a && a.href && !a.href.startsWith("javascript:")) {
      e.preventDefault();
      window.open(a.href, "_blank", "noreferrer");
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); addLink(); return; }
    // Enter op een vinkregel: begint een nieuw punt eronder, precies zoals bij
    // een gewone bullet- of nummerlijst. Op een lege regel stopt de lijst juist
    // (anders kun je een vinklijstje niet meer verlaten met Enter).
    if (e.key === "Enter") {
      const knoopVink = window.getSelection()?.anchorNode as HTMLElement | null;
      const tekstVak = knoopVink && (knoopVink.nodeType === 1 ? knoopVink : knoopVink.parentElement)?.closest(".rtv-check-tekst") as HTMLElement | null;
      if (tekstVak) {
        e.preventDefault();
        const item = tekstVak.closest(".rtv-check-item");
        const sel = window.getSelection();
        if (!tekstVak.textContent?.trim()) {
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          item?.replaceWith(p);
          const r = document.createRange();
          r.selectNodeContents(p);
          r.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(r);
        } else {
          item?.insertAdjacentHTML("afterend", checklistItemHtml(""));
          const nieuweTekst = item?.nextElementSibling?.querySelector(".rtv-check-tekst") as HTMLElement | null;
          if (nieuweTekst) {
            const r = document.createRange();
            r.selectNodeContents(nieuweTekst);
            r.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(r);
          }
        }
        meld();
        return;
      }
    }
    // Enter in het kopje van een uitklapper springt naar de inhoud eronder, in
    // plaats van een tweede regel in de titel te maken.
    if (e.key === "Enter") {
      const knoop = window.getSelection()?.anchorNode as HTMLElement | null;
      const kop = knoop && (knoop.nodeType === 1 ? knoop : knoop.parentElement)?.closest("summary");
      const body = kop?.parentElement?.querySelector(".rtv-vouw-body");
      if (kop && body) {
        e.preventDefault();
        const r = document.createRange();
        r.selectNodeContents(body);
        r.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
        return;
      }
    }
    if (e.key === "Escape" && onKlaar) { e.preventDefault(); onKlaar(); }
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasteHtml = e.clipboardData.getData("text/html");
    const pasteText = e.clipboardData.getData("text/plain");

    // Opmaak uit Sheets, Docs of een webpagina: opschonen tot kale tekst plus
    // klikbare links, zodat het dashboard-lettertype niet overruled wordt.
    if (pasteHtml && /<\w/.test(pasteHtml)) {
      const cleaned = cleanPastedHtml(pasteHtml, { keepTables: true });
      if (cleaned) { e.preventDefault(); document.execCommand("insertHTML", false, cleaned); meld(); return; }
    }
    // Platte tekst met URL's: regels behouden en de URL's meteen klikbaar maken.
    if (pasteText && /https?:\/\//i.test(pasteText)) {
      e.preventDefault();
      document.execCommand("insertHTML", false, linkifyPlainText(pasteText));
      meld();
      return;
    }
    setTimeout(meld, 0);
  }

  return (
    <div className="rtv" onMouseMove={onWrapMouseMove} onMouseLeave={onWrapMouseLeave} onDragOver={onWrapDragOver} onDrop={onWrapDrop}>
      <div className={"focus-toolbar" + (compact ? " focus-toolbar-compact" : "")}>
        {toolbarLabel && <span className="focus-toolbar-label">{toolbarLabel}</span>}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} title="Vet (Cmd+B)"><strong>B</strong></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} title="Cursief (Cmd+I)"><em>I</em></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} title="Bullets">&bull; lijst</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={voegChecklistToe} title="Afvinklijstje: staat er tekst geselecteerd, dan wordt elke regel een eigen vinkpunt">&#9745; vinklijst</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={voegUitklapperToe} title="Uitklapper: een onderwerp met een driehoekje, en daaronder alles wat erbij hoort">&#9662; uitklapper</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink} title="Link toevoegen (Cmd+K)">&#128279; link</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("unlink")} title="Link verwijderen">link weg</button>
        {toolbarExtra}
      </div>
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
      />
      {/* Los van de tekst zelf (staat dus nooit mee in de opgeslagen HTML): het
          grijpvlekje bij het onderdeel waar de muis boven zweeft, en de streep
          die laat zien waar het zou landen. */}
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
    </div>
  );
}

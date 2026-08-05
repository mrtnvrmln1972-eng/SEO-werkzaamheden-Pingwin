"use client";

import React, { useEffect, useRef } from "react";
import { cleanPastedHtml, linkifyPlainText } from "../../../../lib/rich-paste";

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
  waarde, onChange, klasse, autoFocus, placeholder, onKlaar, toolbarExtra,
}: {
  waarde: string;
  onChange: (html: string) => void;
  klasse?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Escape of klikken buiten het veld: bijvoorbeeld het bewerken sluiten. */
  onKlaar?: () => void;
  toolbarExtra?: React.ReactNode;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const gevuldRef = useRef(false);

  useEffect(() => {
    if (!gevuldRef.current && editorRef.current) {
      editorRef.current.innerHTML = waarde || "";
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

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
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
    const a = (t.tagName === "A" ? t : t.closest("a")) as HTMLAnchorElement | null;
    if (a && a.href && !a.href.startsWith("javascript:")) {
      e.preventDefault();
      window.open(a.href, "_blank", "noreferrer");
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); addLink(); return; }
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
    <div className="rtv">
      <div className="focus-toolbar">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} title="Vet (Cmd+B)"><strong>B</strong></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} title="Cursief (Cmd+I)"><em>I</em></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} title="Bullets">&bull; lijst</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
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
    </div>
  );
}

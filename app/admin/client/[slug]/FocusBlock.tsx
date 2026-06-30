"use client";

import React, { useEffect, useRef, useState } from "react";
import { cleanPastedHtml, linkifyPlainText } from "../../../../lib/rich-paste";

export default function FocusBlock({ slug, standalone }: { slug: string; standalone?: boolean }) {
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Laad de opgeslagen inhoud.
  useEffect(() => {
    let off = false;
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!off) setInitialHtml(d.ok ? (d.focus.html || "") : ""); })
      .catch(() => { if (!off) setInitialHtml(""); });
    return () => { off = true; };
  }, [slug]);

  // Zet de inhoud eenmalig in de editor zodra die gerenderd is.
  useEffect(() => {
    if (initialHtml !== null && editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = initialHtml;
      initializedRef.current = true;
    }
  }, [initialHtml]);

  function fixLinks() {
    editorRef.current?.querySelectorAll("a[href]").forEach((a) => {
      (a as HTMLAnchorElement).target = "_blank";
      (a as HTMLAnchorElement).rel = "noreferrer";
    });
  }

  function triggerSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving("idle");
    saveTimerRef.current = setTimeout(async () => {
      const content = editorRef.current?.innerHTML || "";
      setSaving("saving");
      try {
        const res = await fetch("/api/admin/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, html: content }),
        });
        const d = await res.json();
        if (d.ok) { setSaving("saved"); setTimeout(() => setSaving("idle"), 2500); }
        else setSaving("idle");
      } catch { setSaving("idle"); }
    }, 1000);
  }

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function addLink() {
    editorRef.current?.focus();
    const url = window.prompt("Link naar (URL of document):", "https://");
    if (!url) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
    fixLinks();
    triggerSave();
  }

  function onInput() {
    fixLinks();
    triggerSave();
  }

  // Klik op een link opent hem in een nieuw tabblad (ook in de bewerkbare editor).
  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const a = (t.tagName === "A" ? t : t.closest("a")) as HTMLAnchorElement | null;
    if (a && a.href && !a.href.startsWith("javascript:")) {
      e.preventDefault();
      window.open(a.href, "_blank", "noreferrer");
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      addLink();
    }
    // Cmd+Shift+V: plak zonder opmaak
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
      e.preventDefault();
      navigator.clipboard.readText()
        .then((text) => { if (text) { document.execCommand("insertText", false, text); triggerSave(); } })
        .catch(() => {});
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasteHtml = e.clipboardData.getData("text/html");
    const pasteText = e.clipboardData.getData("text/plain");

    // HTML (cellen, links, opmaak uit Sheets/Docs/web): opschonen tot kale
    // tekst + klikbare links, tabellen platgeslagen naar regels.
    if (pasteHtml && /<\w/.test(pasteHtml)) {
      const cleaned = cleanPastedHtml(pasteHtml);
      if (cleaned) {
        e.preventDefault();
        document.execCommand("insertHTML", false, cleaned);
        fixLinks();
        triggerSave();
        return;
      }
    }

    // URL in platte tekst: auto-linken.
    if (pasteText && /https?:\/\//i.test(pasteText)) {
      e.preventDefault();
      document.execCommand("insertHTML", false, linkifyPlainText(pasteText));
      triggerSave();
      return;
    }

    // Standaard paste; links daarna alsnog fixen.
    setTimeout(() => { fixLinks(); triggerSave(); }, 0);
  }

  const saveLabel = saving === "saving" ? "Opslaan..." : saving === "saved" ? "✓ Opgeslagen" : "";

  const toolbar = (
    <div className="focus-toolbar">
      <button type="button" onClick={() => cmd("bold")} title="Vet (Cmd+B)"><strong>B</strong></button>
      <button type="button" onClick={() => cmd("italic")} title="Cursief (Cmd+I)"><em>I</em></button>
      <button type="button" onClick={() => cmd("insertUnorderedList")} title="Bullets">&bull; lijst</button>
      <button type="button" onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
      <button type="button" onClick={addLink} title="Link toevoegen (Cmd+K)">&#128279; link</button>
      <button type="button" onClick={() => cmd("unlink")} title="Link verwijderen">link weg</button>
      {saveLabel && <span className="focus-save-status">{saveLabel}</span>}
    </div>
  );

  const editor = (
    <div
      ref={editorRef}
      className={"focus-rich focus-editable" + (initialHtml === null ? " focus-loading" : "")}
      contentEditable={initialHtml !== null}
      suppressContentEditableWarning
      onInput={onInput}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );

  if (standalone) {
    return (
      <>
        <div className="ck-section-head">
          <span>Zoekwoorden &amp; links</span>
        </div>
        {toolbar}
        {editor}
      </>
    );
  }

  return (
    <div className="sov-tasks">
      <div className="sov-tasks-head focus-head">
        <span>Zoekwoorden &amp; links</span>
      </div>
      {toolbar}
      {editor}
    </div>
  );
}

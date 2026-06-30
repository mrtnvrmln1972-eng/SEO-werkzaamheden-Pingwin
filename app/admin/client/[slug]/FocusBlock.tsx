"use client";

import { useEffect, useRef, useState } from "react";

// Voeg target="_blank" toe aan alle links vóór weergave.
function withNewTab(html: string): string {
  return html.replace(/<a\s/gi, '<a target="_blank" rel="noreferrer" ');
}

export default function FocusBlock({ slug }: { slug: string }) {
  const [html, setHtml] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (off) return; if (d.ok) setHtml(d.focus.html || ""); setLoaded(true); })
      .catch(() => setLoaded(true));
    return () => { off = true; };
  }, [slug]);

  useEffect(() => {
    if (editing && editorRef.current) editorRef.current.innerHTML = html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  async function saveNow() {
    const content = editorRef.current?.innerHTML || "";
    setBusy(true);
    try {
      const res = await fetch("/api/admin/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, html: content }) });
      const d = await res.json();
      if (d.ok) { setHtml(d.focus.html || ""); setEditing(false); }
    } finally { setBusy(false); }
  }

  function addLink() {
    editorRef.current?.focus();
    const url = window.prompt("Link naar (URL of document):", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
    // auto-save direct na link aanmaken
    saveNow();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      addLink();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasteHtml = e.clipboardData.getData("text/html");
    const pasteText = e.clipboardData.getData("text/plain");

    // Sheets of Excel: bevat een <table>
    if (pasteHtml && /<table[\s>]/i.test(pasteHtml)) {
      e.preventDefault();
      const clean = pasteHtml
        .replace(/<colgroup[\s\S]*?<\/colgroup>/gi, "")
        .replace(/\s*style="[^"]*"/gi, "")
        .replace(/\s*class="[^"]*"/gi, "")
        .replace(/<span\b[^>]*>/gi, "").replace(/<\/span>/gi, "")
        .replace(/&nbsp;/gi, " ");
      document.execCommand("insertHTML", false, clean);
      return;
    }

    // TSV (tab-gescheiden) zonder HTML
    if (!pasteHtml && pasteText && pasteText.includes("\t")) {
      e.preventDefault();
      const rows = pasteText.trim().split(/\r?\n/).filter((r) => r.trim());
      const tableHtml = `<table style="border-collapse:collapse;font-size:13px"><tbody>${
        rows.map((row) =>
          `<tr>${row.split("\t").map((cell) =>
            `<td style="border:1px solid #ccc;padding:3px 8px">${cell.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`
          ).join("")}</tr>`
        ).join("")
      }</tbody></table>`;
      document.execCommand("insertHTML", false, tableHtml);
      return;
    }
    // Normaal plakken: browser-standaard
  }

  if (!loaded) return null;

  return (
    <div className="sov-tasks">
      <div className="sov-tasks-head focus-head">
        <span>Zoekwoorden &amp; links</span>
        <button type="button" className="focus-edit" onClick={() => setEditing((e) => !e)}>{editing ? "Sluiten" : "Bewerken"}</button>
      </div>

      {!editing && (
        html.trim()
          ? <div className="focus-rich" dangerouslySetInnerHTML={{ __html: withNewTab(html) }} />
          : <div className="muted" style={{ fontSize: 13 }}>Nog niets ingevuld. Klik op &ldquo;Bewerken&rdquo; en plak of typ je zoekwoorden en links.</div>
      )}

      {editing && (
        <div className="focus-editor">
          <div className="focus-toolbar">
            <button type="button" onClick={() => cmd("bold")} title="Vet"><strong>B</strong></button>
            <button type="button" onClick={() => cmd("italic")} title="Cursief"><em>I</em></button>
            <button type="button" onClick={() => cmd("insertUnorderedList")} title="Bullets">&bull; lijst</button>
            <button type="button" onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
            <button type="button" onClick={addLink} title="Link toevoegen (of Cmd+K)">🔗 link</button>
            <button type="button" onClick={() => cmd("unlink")} title="Link verwijderen">link weg</button>
          </div>
          <div
            ref={editorRef}
            className="focus-rich focus-editable"
            contentEditable
            suppressContentEditableWarning
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          <div style={{ marginTop: 10 }}>
            <button type="button" className="primary-btn small" onClick={saveNow} disabled={busy}>{busy ? "Opslaan..." : "Opslaan"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

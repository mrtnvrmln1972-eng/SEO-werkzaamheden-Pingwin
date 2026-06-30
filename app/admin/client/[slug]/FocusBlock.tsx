"use client";

import { useEffect, useRef, useState } from "react";

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

  // Bij openen van de bewerk-modus de huidige inhoud in het veld zetten (één keer).
  useEffect(() => {
    if (editing && editorRef.current) editorRef.current.innerHTML = html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }
  function addLink() {
    const url = window.prompt("Link naar (URL of document):", "https://");
    if (url) cmd("createLink", url);
  }

  async function save() {
    const content = editorRef.current?.innerHTML || "";
    setBusy(true);
    try {
      const res = await fetch("/api/admin/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, html: content }) });
      const d = await res.json();
      if (d.ok) { setHtml(d.focus.html || ""); setEditing(false); }
    } finally { setBusy(false); }
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
          ? <div className="focus-rich" dangerouslySetInnerHTML={{ __html: html }} />
          : <div className="muted" style={{ fontSize: 13 }}>Nog niets ingevuld. Klik op &ldquo;Bewerken&rdquo; en plak of typ je zoekwoorden en links.</div>
      )}

      {editing && (
        <div className="focus-editor">
          <div className="focus-toolbar">
            <button type="button" onClick={() => cmd("bold")} title="Vet"><strong>B</strong></button>
            <button type="button" onClick={() => cmd("italic")} title="Cursief"><em>I</em></button>
            <button type="button" onClick={() => cmd("insertUnorderedList")} title="Bullets">&bull; lijst</button>
            <button type="button" onClick={() => cmd("insertOrderedList")} title="Genummerd">1. lijst</button>
            <button type="button" onClick={addLink} title="Link toevoegen">🔗 link</button>
            <button type="button" onClick={() => cmd("unlink")} title="Link verwijderen">link weg</button>
          </div>
          <div ref={editorRef} className="focus-rich focus-editable" contentEditable suppressContentEditableWarning />
          <div style={{ marginTop: 10 }}>
            <button type="button" className="primary-btn small" onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Opslaan"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

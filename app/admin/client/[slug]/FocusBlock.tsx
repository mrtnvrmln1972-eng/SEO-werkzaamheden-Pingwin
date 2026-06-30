"use client";

import { useEffect, useState } from "react";

type Kw = { kw: string; url: string };
type Lnk = { label: string; url: string };

export default function FocusBlock({ slug }: { slug: string }) {
  const [keywords, setKeywords] = useState<Kw[]>([]);
  const [links, setLinks] = useState<Lnk[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (off) return; if (d.ok) { setKeywords(d.focus.keywords || []); setLinks(d.focus.links || []); } setLoaded(true); })
      .catch(() => setLoaded(true));
    return () => { off = true; };
  }, [slug]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, keywords, links }) });
      const d = await res.json();
      if (d.ok) { setKeywords(d.focus.keywords || []); setLinks(d.focus.links || []); setEditing(false); }
    } finally { setBusy(false); }
  }

  if (!loaded) return null;

  const empty = keywords.length === 0 && links.length === 0;

  return (
    <div className="sov-tasks">
      <div className="sov-tasks-head focus-head">
        <span>Zoekwoorden &amp; links</span>
        <button type="button" className="focus-edit" onClick={() => setEditing((e) => !e)}>{editing ? "Sluiten" : "Bewerken"}</button>
      </div>

      {!editing && (
        <>
          {empty && <div className="muted" style={{ fontSize: 13 }}>Nog niets ingevuld. Klik op &ldquo;Bewerken&rdquo;.</div>}
          {keywords.length > 0 && (
            <ul className="focus-kw-list">
              {keywords.map((k, i) => (
                <li key={i}>
                  <span className="focus-kw">{k.kw}</span>
                  {k.url ? <a className="focus-url" href={k.url} target="_blank" rel="noreferrer">{prettyUrl(k.url)} &rarr;</a> : null}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <div className="focus-links">
              {links.map((l, i) => (
                <a key={i} className="focus-link-chip" href={l.url} target="_blank" rel="noreferrer">{l.label || prettyUrl(l.url)} &rarr;</a>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="focus-editor">
          <div className="focus-sub">Afgesproken zoekwoorden &rarr; pagina</div>
          {keywords.map((k, i) => (
            <div className="focus-row" key={i}>
              <input value={k.kw} placeholder="zoekwoord" onChange={(e) => setKeywords((a) => a.map((x, j) => j === i ? { ...x, kw: e.target.value } : x))} />
              <input value={k.url} placeholder="https://..." onChange={(e) => setKeywords((a) => a.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
              <button type="button" className="row-del" onClick={() => setKeywords((a) => a.filter((_, j) => j !== i))}>&times;</button>
            </div>
          ))}
          <button type="button" className="add-task-btn" onClick={() => setKeywords((a) => [...a, { kw: "", url: "" }])}>+ zoekwoord</button>

          <div className="focus-sub" style={{ marginTop: 12 }}>Snelle links (linkbuilding, Search Console, Analytics)</div>
          {links.map((l, i) => (
            <div className="focus-row" key={i}>
              <input value={l.label} placeholder="label" onChange={(e) => setLinks((a) => a.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <input value={l.url} placeholder="https://..." onChange={(e) => setLinks((a) => a.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
              <button type="button" className="row-del" onClick={() => setLinks((a) => a.filter((_, j) => j !== i))}>&times;</button>
            </div>
          ))}
          <button type="button" className="add-task-btn" onClick={() => setLinks((a) => [...a, { label: "", url: "" }])}>+ link</button>

          <div style={{ marginTop: 12 }}>
            <button type="button" className="primary-btn small" onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Opslaan"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

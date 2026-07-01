"use client";

import { useEffect, useState } from "react";

type ArrayDiff = { added: string[]; removed: string[] };
type FieldChange = { before: string; after: string };
type ContentDiff = {
  meta_title?: FieldChange;
  meta_description?: FieldChange;
  h1?: FieldChange;
  h2s?: ArrayDiff;
  h3s?: ArrayDiff;
  alt_tags?: { added: { src: string; alt: string }[]; removed: { src: string; alt: string }[]; changed: { src: string; before: string; after: string }[] };
  internal_links?: { added: { href: string; text: string }[]; removed: { href: string; text: string }[] };
  word_count?: { before: number; after: number; delta: number };
  schema_types?: ArrayDiff;
};
type ChangeEvent = { id: number; url: string; detectedAt: string; summary: string; diff: ContentDiff };

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}
function dt(iso: string): string {
  try { return new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

function Field({ label, change }: { label: string; change: FieldChange }) {
  return (
    <div className="wz-block">
      <div className="wz-block-head">{label}</div>
      {change.before && <div className="wz-line removed"><span className="wz-sign">-</span> {change.before}</div>}
      {change.after && <div className="wz-line added"><span className="wz-sign">+</span> {change.after}</div>}
    </div>
  );
}
function Arr({ label, diff }: { label: string; diff: ArrayDiff }) {
  if (!diff.added.length && !diff.removed.length) return null;
  return (
    <div className="wz-block">
      <div className="wz-block-head">{label}</div>
      {diff.removed.map((x, i) => <div key={"r" + i} className="wz-line removed"><span className="wz-sign">-</span> {x}</div>)}
      {diff.added.map((x, i) => <div key={"a" + i} className="wz-line added"><span className="wz-sign">+</span> {x}</div>)}
    </div>
  );
}

function DiffView({ diff }: { diff: ContentDiff }) {
  return (
    <div className="wz-diff">
      {diff.meta_title && <Field label="Paginatitel" change={diff.meta_title} />}
      {diff.meta_description && <Field label="Meta-beschrijving" change={diff.meta_description} />}
      {diff.h1 && <Field label="H1" change={diff.h1} />}
      {diff.h2s && <Arr label="H2-koppen" diff={diff.h2s} />}
      {diff.h3s && <Arr label="H3-koppen" diff={diff.h3s} />}
      {diff.alt_tags && (diff.alt_tags.added.length + diff.alt_tags.removed.length + diff.alt_tags.changed.length > 0) && (
        <div className="wz-block">
          <div className="wz-block-head">Alt-teksten</div>
          {diff.alt_tags.removed.map((a, i) => <div key={"ar" + i} className="wz-line removed"><span className="wz-sign">-</span> <em>{a.alt || "geen alt-tekst"}</em> <span className="wz-file">{a.src}</span></div>)}
          {diff.alt_tags.added.map((a, i) => <div key={"aa" + i} className="wz-line added"><span className="wz-sign">+</span> <em>{a.alt || "geen alt-tekst"}</em> <span className="wz-file">{a.src}</span></div>)}
          {diff.alt_tags.changed.map((a, i) => <div key={"ac" + i} className="wz-line changed"><span className="wz-file">{a.src}</span>: <em>{a.before || "leeg"}</em> → <em>{a.after || "leeg"}</em></div>)}
        </div>
      )}
      {diff.internal_links && (diff.internal_links.added.length + diff.internal_links.removed.length > 0) && (
        <div className="wz-block">
          <div className="wz-block-head">Interne links</div>
          {diff.internal_links.removed.map((l, i) => <div key={"lr" + i} className="wz-line removed"><span className="wz-sign">-</span> {l.text || l.href} <span className="wz-file">{l.href}</span></div>)}
          {diff.internal_links.added.map((l, i) => <div key={"la" + i} className="wz-line added"><span className="wz-sign">+</span> {l.text || l.href} <span className="wz-file">{l.href}</span></div>)}
        </div>
      )}
      {diff.word_count && (
        <div className="wz-block">
          <div className="wz-block-head">Woordenaantal</div>
          <div className="wz-line"><span className={diff.word_count.delta >= 0 ? "wz-pos" : "wz-neg"}>{diff.word_count.delta > 0 ? "+" : ""}{diff.word_count.delta}</span> ({diff.word_count.before} → {diff.word_count.after})</div>
        </div>
      )}
      {diff.schema_types && <Arr label="Schema-types" diff={diff.schema_types} />}
    </div>
  );
}

export default function WijzigingenPanel({ slug }: { slug: string }) {
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<ChangeEvent | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/changes?slug=${encodeURIComponent(slug)}`);
      const d = await r.json();
      if (d.ok) setEvents(d.events || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  async function scan() {
    setScanning(true); setMsg("");
    try {
      const r = await fetch("/api/admin/content-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) { setMsg(`${d.scanned} pagina's gescand, ${d.changed} wijziging${d.changed === 1 ? "" : "en"} gevonden.`); await load(); }
      else setMsg(d.error || "Scan mislukt.");
    } catch { setMsg("Scan mislukt."); } finally { setScanning(false); }
  }

  if (open) {
    return (
      <div className="cockpit-card">
        <button type="button" className="ghost-btn small" onClick={() => setOpen(null)}>← Alle wijzigingen</button>
        <h2 className="wz-title">{open.diff.meta_title?.after || open.diff.h1?.after || shortUrl(open.url)}</h2>
        <div className="muted" style={{ marginBottom: 14 }}>{shortUrl(open.url)} · Gedetecteerd: {dt(open.detectedAt)}</div>
        <div className="wz-block-head" style={{ fontSize: 13 }}>Wat veranderde</div>
        <DiffView diff={open.diff} />
        <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>KPI-impact (kliks, positie, vertoningen, CTR en keyword-rankings 60 dagen voor/na) volgt in de volgende stap.</div>
      </div>
    );
  }

  return (
    <div className="cockpit-card">
      <div className="ck-section-head">
        <span>Wijzigingen ({events.length})</span>
        <button type="button" className="ghost-btn small" onClick={scan} disabled={scanning}>{scanning ? "Scannen…" : "Scan op wijzigingen"}</button>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>Detecteert automatisch wat er op de live pagina's verandert (titel, koppen, alt-teksten, interne links, woordenaantal, schema). De eerste scan legt de basislijn vast; daarna zie je hier elke wijziging.</p>
      {msg && <div className="saved-msg" style={{ marginTop: 8 }}>{msg}</div>}
      {loading && <div className="muted" style={{ padding: 12 }}>Laden…</div>}
      {!loading && events.length === 0 && <div className="muted" style={{ padding: 12 }}>Nog geen wijzigingen. Draai een scan (basislijn), en na een volgende scan verschijnen hier de veranderingen.</div>}
      <div className="wz-list">
        {events.map((e) => (
          <button key={e.id} type="button" className="wz-item" onClick={() => setOpen(e)}>
            <div className="wz-item-main">
              <div className="wz-item-title">{e.diff.meta_title?.after || e.diff.h1?.after || shortUrl(e.url)}</div>
              <div className="wz-item-sub">{shortUrl(e.url)} · {e.summary}</div>
            </div>
            <div className="wz-item-date">{dt(e.detectedAt)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

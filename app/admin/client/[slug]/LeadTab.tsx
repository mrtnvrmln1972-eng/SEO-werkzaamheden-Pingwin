"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import LeadChat from "./LeadChat";

type DossierItem = { id: number; soort: string; titel: string; samenvatting: string; bron: string; driveLink: string; createdAt: string };
type LeadDoc = { id: number; sjabloon: string; titel: string; opdracht: string; driveLink: string; createdAt: string };
type Sjabloon = { key: string; naam: string; omschrijving: string };

const SOORT_LABEL: Record<string, string> = {
  notitie: "Notitie", document: "Aangeleverd", analyse: "Analyse",
  meting: "Meting", voorstel: "Voorstel", overig: "Overig",
};

function datum(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
}

// De leadomgeving: chat links, dossier en plank rechts. Bewust een eigen scherm,
// los van de klant-tabbladen, zodat er niets aan de klantkant kan breken en we
// hier rustig kunnen uitproberen hoe dit moet werken.
export default function LeadTab({ slug, naam, domain }: { slug: string; naam: string; domain: string }) {
  const [items, setItems] = useState<DossierItem[]>([]);
  const [docs, setDocs] = useState<LeadDoc[]>([]);
  const [sjablonen, setSjablonen] = useState<Sjabloon[]>([]);
  const [melding, setMelding] = useState<{ ok: boolean; text: string } | null>(null);
  const [bezig, setBezig] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [volledig, setVolledig] = useState<Record<number, string>>({});

  // Toevoegen aan het dossier (tekst of Drive-link) en documenten maken.
  const [tekst, setTekst] = useState("");
  const [toonToevoegen, setToonToevoegen] = useState(false);
  const [opdracht, setOpdracht] = useState("");
  const [sleep, setSleep] = useState(false);
  const bestandRef = useRef<HTMLInputElement | null>(null);

  const laad = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        fetch(`/api/admin/lead-dossier?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
        fetch(`/api/admin/lead-doc?slug=${encodeURIComponent(slug)}`).then((r) => r.json()),
      ]);
      if (d.ok) setItems(d.items || []);
      if (p.ok) { setDocs(p.docs || []); setSjablonen(p.sjablonen || []); }
    } catch { /* stil; volgende ronde opnieuw */ }
  }, [slug]);

  useEffect(() => { laad(); }, [laad]);

  async function bewaarTekst() {
    const t = tekst.trim();
    if (!t) return;
    setBezig("dossier"); setMelding(null);
    const isLink = /^https?:\/\/(docs|drive)\.google\.com\//i.test(t);
    try {
      const res = await fetch("/api/admin/lead-dossier", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLink ? { slug, driveLink: t } : { slug, tekst: t, soort: t.length > 400 ? "document" : "notitie" }),
      });
      const data = await res.json();
      if (data.ok) { setTekst(""); setToonToevoegen(false); await laad(); setMelding({ ok: true, text: "Toegevoegd aan het dossier." }); }
      else setMelding({ ok: false, text: data.error || "Toevoegen mislukt." });
    } catch { setMelding({ ok: false, text: "Toevoegen mislukt." }); } finally { setBezig(""); }
  }

  async function stuurBestand(file: File) {
    setBezig("dossier"); setMelding(null);
    try {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("file", file);
      const res = await fetch("/api/admin/lead-dossier", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) { await laad(); setMelding({ ok: true, text: `"${data.item?.titel || file.name}" staat in het dossier.` }); }
      else setMelding({ ok: false, text: data.error || "Inlezen mislukt." });
    } catch { setMelding({ ok: false, text: "Inlezen mislukt." }); } finally { setBezig(""); }
  }

  async function toonVolledig(id: number) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (volledig[id]) return;
    try {
      const res = await fetch(`/api/admin/lead-dossier?slug=${encodeURIComponent(slug)}&id=${id}`);
      const data = await res.json();
      if (data.ok) setVolledig((v) => ({ ...v, [id]: data.item.inhoud || data.item.samenvatting || "" }));
    } catch { /* stil */ }
  }

  async function verwijderItem(id: number) {
    if (!window.confirm("Dit stuk uit het dossier verwijderen?")) return;
    await fetch(`/api/admin/lead-dossier?slug=${encodeURIComponent(slug)}&id=${id}`, { method: "DELETE" });
    await laad();
  }

  async function maakDocument(sjabloon: string) {
    setBezig("doc"); setMelding(null);
    try {
      const res = await fetch("/api/admin/lead-doc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sjabloon, opdracht }),
      });
      const data = await res.json();
      if (data.ok) {
        setOpdracht("");
        await laad();
        setMelding({
          ok: true,
          text: data.doc?.driveLink
            ? "Het document staat op de plank en is te openen en te bewerken."
            : `Document gemaakt, maar het kon niet in Drive gezet worden${data.driveError ? ` (${data.driveError})` : ""}.`,
        });
      } else setMelding({ ok: false, text: data.error || "Document maken mislukt." });
    } catch { setMelding({ ok: false, text: "Document maken mislukt." }); } finally { setBezig(""); }
  }

  async function verwijderDoc(id: number) {
    if (!window.confirm("Dit document van de plank halen? Het bestand in Drive blijft staan.")) return;
    await fetch(`/api/admin/lead-doc?slug=${encodeURIComponent(slug)}&id=${id}`, { method: "DELETE" });
    await laad();
  }

  return (
    <div className="lead-grid">
      <div className="lead-kolom-links">
        <LeadChat slug={slug} naam={naam} domain={domain} onVeranderd={laad} />
      </div>

      <div className="lead-kolom-rechts">
        {melding && (
          <div className={melding.ok ? "saved-msg" : "login-error"} style={{ marginBottom: "var(--s-4)" }}>{melding.text}</div>
        )}

        {/* ── Het dossier ── */}
        <div className="card">
          <div className="lead-blok-kop">
            <div>
              <div className="lead-blok-titel">Dossier</div>
              <div className="lead-blok-sub">Alles wat we van dit bedrijf weten</div>
            </div>
            <button className="mini-btn" onClick={() => setToonToevoegen((v) => !v)}>
              {toonToevoegen ? "Sluiten" : "+ Toevoegen"}
            </button>
          </div>

          <div
            className={"lead-dropzone" + (sleep ? " sleep" : "")}
            onDragOver={(e) => { e.preventDefault(); setSleep(true); }}
            onDragLeave={() => setSleep(false)}
            onDrop={(e) => {
              e.preventDefault(); setSleep(false);
              const f = e.dataTransfer.files?.[0];
              if (f) stuurBestand(f);
            }}
            onClick={() => bestandRef.current?.click()}
            title="Sleep een bestand hierheen of klik om er een te kiezen"
          >
            {bezig === "dossier"
              ? "Bezig met inlezen…"
              : "Sleep hier een document (pdf, Word, txt, md of csv), of klik om te kiezen"}
            <input
              ref={bestandRef} type="file" style={{ display: "none" }}
              accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) stuurBestand(f); e.target.value = ""; }}
            />
          </div>

          {toonToevoegen && (
            <div className="lead-toevoegen">
              <textarea
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                placeholder="Plak hier een tekst, een Google Drive-link, of typ gewoon wat je weet (bijvoorbeeld: budget mag rond de 1500 liggen, ze hechten sterk aan duurzaamheid)."
                rows={5}
              />
              <button className="primary-btn small" onClick={bewaarTekst} disabled={bezig === "dossier" || !tekst.trim()}>
                {bezig === "dossier" ? "Bezig…" : "Bewaar in dossier"}
              </button>
            </div>
          )}

          <div className="lead-lijst">
            {items.length === 0 && <div className="muted lead-leeg">Nog niets in het dossier.</div>}
            {items.map((i) => (
              <div key={i.id} className="lead-item">
                <div className="lead-item-kop" onClick={() => toonVolledig(i.id)}>
                  <span className="chip">{SOORT_LABEL[i.soort] || i.soort}</span>
                  <span className="lead-item-titel">{i.titel}</span>
                  <span className="lead-item-datum">{datum(i.createdAt)}</span>
                </div>
                {i.samenvatting && <div className="lead-item-sam">{i.samenvatting}</div>}
                {open === i.id && (
                  <div className="lead-item-volledig">
                    <pre>{volledig[i.id] ?? "Bezig met laden…"}</pre>
                  </div>
                )}
                <div className="lead-item-acties">
                  {i.driveLink && <a href={i.driveLink} target="_blank" rel="noreferrer" className="mini-btn">Openen</a>}{" "}
                  <button className="mini-btn" onClick={() => toonVolledig(i.id)}>{open === i.id ? "Inklappen" : "Volledig"}</button>{" "}
                  <button className="mini-btn" onClick={() => verwijderItem(i.id)}>Verwijder</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── De plank ── */}
        <div className="card" style={{ marginTop: "var(--s-6)" }}>
          <div className="lead-blok-kop">
            <div>
              <div className="lead-blok-titel">Documenten</div>
              <div className="lead-blok-sub">Wat we voor dit bedrijf gemaakt hebben</div>
            </div>
          </div>

          <div className="lead-maak">
            <textarea
              value={opdracht}
              onChange={(e) => setOpdracht(e.target.value)}
              placeholder="Extra instructies voor dit document: budget, looptijd, waar ze waarde aan hechten, welke pagina's erin moeten. Leeg laten mag ook."
              rows={3}
            />
            <div className="lead-maak-knoppen">
              {sjablonen.map((s) => (
                <button key={s.key} className="primary-btn small" title={s.omschrijving}
                  onClick={() => maakDocument(s.key)} disabled={bezig === "doc"}>
                  {bezig === "doc" ? "Bezig…" : `Maak ${s.naam.toLowerCase()}`}
                </button>
              ))}
            </div>
            <div className="hint">Dit kan een halve minuut duren. Je kunt hetzelfde ook gewoon in de chat vragen.</div>
          </div>

          <div className="lead-lijst">
            {docs.length === 0 && <div className="muted lead-leeg">Nog geen documenten.</div>}
            {docs.map((d) => (
              <div key={d.id} className="lead-item">
                <div className="lead-item-kop">
                  <span className="lead-item-titel">{d.titel}</span>
                  <span className="lead-item-datum">{datum(d.createdAt)}</span>
                </div>
                {d.opdracht && <div className="lead-item-sam">Opdracht: {d.opdracht}</div>}
                <div className="lead-item-acties">
                  {d.driveLink
                    ? <a href={d.driveLink} target="_blank" rel="noreferrer" className="mini-btn">Openen en bewerken</a>
                    : <span className="muted">niet in Drive gezet</span>}{" "}
                  <button className="mini-btn" onClick={() => verwijderDoc(d.id)}>Verwijder</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

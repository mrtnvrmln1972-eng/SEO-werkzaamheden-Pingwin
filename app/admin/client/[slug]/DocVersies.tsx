"use client";

// De documenten bij een taak of pagina.
//
// Zelf beheren in plaats van automatisch samenvoegen. Elk document dat je hier
// neerlegt, plakt of vanuit een mail naartoe sleept wordt gewoon een versie in de
// lijst: nieuwste bovenaan, met de datum en van wie het komt. De naam van een
// document is meteen een link ernaartoe.
//
// Wat hier vroeger stond: elke klantversie werd een voorstel met een AI-vergelijking,
// en na "Verwerk" werd er een samengevoegd document gemaakt. Dat leverde per ronde
// twee versies en een extra Drive-bestand op, ook als er niets veranderd was.
//
// Spatiebalk opent de voorvertoning van de geselecteerde regel, zoals in Finder.

import { useCallback, useEffect, useRef, useState } from "react";
import { driveIdFromUrl } from "../../../../lib/drive-id";

type Versie = {
  id: number; kind: string; source: "pingwin" | "klant"; naam: string; driveLink: string;
  samenvatting: string; vergelijking: string; status: string; createdAt: string; goedgekeurd: boolean;
};

const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data", overig: "Overig" };

export default function DocVersies({ slug, url, taakId }: { slug: string; url: string; taakId?: number }) {
  const [versies, setVersies] = useState<Versie[]>([]);
  const [drag, setDrag] = useState(false);
  const bestandRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [linkVeld, setLinkVeld] = useState("");
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [preview, setPreview] = useState<Versie | null>(null);
  const [hernoem, setHernoem] = useState<{ id: number; naam: string } | null>(null);

  const laad = useCallback(async () => {
    const d = await fetch(`/api/admin/page-doc/upload?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).catch(() => null);
    if (d?.ok) setVersies(d.versions || []);
  }, [slug, url]);
  useEffect(() => { void laad(); }, [laad]);

  // Spatiebalk = voorvertoning, zoals in Finder. Alleen als er een regel gekozen
  // is en je niet in een invoerveld staat, anders kun je nergens meer spaties typen.
  useEffect(() => {
    function toets(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape" && preview) { setPreview(null); return; }
      if (e.key !== " " || gekozen === null) return;
      e.preventDefault();                       // anders scrollt de pagina mee
      if (preview) { setPreview(null); return; }
      const v = versies.find((x) => x.id === gekozen);
      if (v) setPreview(v);
    }
    window.addEventListener("keydown", toets);
    return () => window.removeEventListener("keydown", toets);
  }, [gekozen, preview, versies]);

  async function stuur(payload: Record<string, unknown>, wat: string) {
    setBusy(wat); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url, ...payload }),
      }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); return d; }
      setFout(d?.error || "Dat lukte niet; probeer het nog een keer.");
      return null;
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); return null; }
    finally { setBusy(""); }
  }

  async function drop(file: File) {
    setBusy("lezen"); setFout("");
    try {
      const form = new FormData();
      form.append("file", file); form.append("slug", slug); form.append("url", url);
      const d = await fetch("/api/admin/page-doc/upload", { method: "POST", body: form }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); else void laad(); }
      else setFout(d?.error || "Kon het bestand niet verwerken.");
    } catch { setFout("Uploaden mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  // Een bijlage die uit het paneel Laatste mails hierheen gesleept wordt. Het
  // dashboard haalt hem zelf bij Microsoft op; downloaden en opnieuw uploaden
  // hoeft dus niet.
  async function uitMail(data: { messageId: string; attachmentId: string; naam: string }) {
    setBusy("lezen"); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uit-mail", slug, url, ...data }),
      }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); else void laad(); }
      else setFout(d?.error || "Kon de bijlage niet ophalen.");
    } catch { setFout("Ophalen mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  const dd = (d: string) => {
    try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
  };
  const previewUrl = (v: Versie) => {
    const id = driveIdFromUrl(v.driveLink);
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  };

  return (
    <div className="wp-docs">
      <div className={"wp-docdrop" + (drag ? " wp-docdrop-actief" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false);
          const bijlage = e.dataTransfer.getData("application/pingwin-bijlage");
          if (bijlage) { try { void uitMail(JSON.parse(bijlage)); } catch { /* geen geldige bijlage */ } return; }
          const f = e.dataTransfer.files?.[0]; if (f) void drop(f);
        }}>
        {busy === "lezen" ? (
          <span className="muted">Document inlezen…</span>
        ) : (
          <>
            <span className="wp-docdrop-tekst">
              <strong>Voeg een document toe.</strong>{" "}
              <button type="button" className="wp-docdrop-kies" disabled={!!busy}
                onClick={() => bestandRef.current?.click()}>kies een bestand</button>{" "}
              sleep een bijlage uit een mail hierheen, of plak een Drive-link:
            </span>
            <input ref={bestandRef} type="file" className="wp-docdrop-verborgen"
              accept=".docx,.pdf,.txt,.md,.json,.csv,.xlsx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void drop(f); e.target.value = ""; }} />
            <span className="wp-docdrop-linkrij">
              <input className="wp-docdrop-input" value={linkVeld} placeholder="https://docs.google.com/…"
                onChange={(e) => setLinkVeld(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && linkVeld.trim()) { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); } }} />
              <button type="button" className="wp-fase-btn" disabled={!linkVeld.trim() || !!busy}
                onClick={() => { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); }}>Lees</button>
            </span>
          </>
        )}
      </div>

      {fout && <div className="wp-doc-fout">{fout}</div>}

      {versies.length > 0 && (
        <ul className="wp-doclijst">
          {versies.map((v) => (
            <li key={v.id}
              className={"wp-docrij" + (gekozen === v.id ? " wp-docrij-aan" : "")}
              tabIndex={0}
              onClick={() => setGekozen(gekozen === v.id ? null : v.id)}
              onDoubleClick={() => setPreview(v)}
              title="Klik om te kiezen, spatiebalk voor een voorvertoning">
              <span className="wp-docrij-datum">{dd(v.createdAt)}</span>
              <span className={"wp-docversie-bron " + (v.source === "klant" ? "wp-bron-klant" : "wp-bron-pingwin")}>
                {v.source === "klant" ? "Klant" : "Pingwin"}
              </span>
              <span className="wp-docrij-kind">{KIND_LABEL[v.kind] || v.kind}</span>

              {hernoem?.id === v.id ? (
                <input className="wp-docrij-naaminvoer" autoFocus value={hernoem.naam}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setHernoem({ id: v.id, naam: e.target.value })}
                  onBlur={() => { void stuur({ action: "hernoem", id: v.id, naam: hernoem.naam }, "hernoem"); setHernoem(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { void stuur({ action: "hernoem", id: v.id, naam: hernoem.naam }, "hernoem"); setHernoem(null); }
                    if (e.key === "Escape") setHernoem(null);
                  }} />
              ) : v.driveLink ? (
                <a className="wp-docrij-naam" href={v.driveLink} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()} title="Open dit document">{v.naam || "document"}</a>
              ) : (
                <span className="wp-docrij-naam wp-docrij-naam-leeg" title="Voor dit document is geen link bewaard">{v.naam || "document"}</span>
              )}
              {hernoem?.id !== v.id && (
                <button type="button" className="wp-docrij-naam-pen" title="Naam aanpassen"
                  onClick={(e) => { e.stopPropagation(); setHernoem({ id: v.id, naam: v.naam || "" }); }}>&#9998;</button>
              )}

              <span className="wp-docrij-acties" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="wp-icon wp-del" title="Van de lijst halen (het bestand blijft in Drive)"
                  onClick={() => void stuur({ action: "negeer", id: v.id }, "weg")}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="wp-mail-modal wp-preview">
            <div className="wp-mail-head">
              <span className="wp-mail-title">{preview.naam || "document"}</span>
              <button type="button" className="wp-icon wp-del" title="Sluiten (Escape)" onClick={() => setPreview(null)}>×</button>
            </div>
            {previewUrl(preview) ? (
              <iframe className="wp-preview-frame" src={previewUrl(preview)} title={preview.naam || "voorvertoning"} />
            ) : (
              <div className="wp-preview-leeg">
                <p>Van dit document is geen bestand in Drive bewaard, dus er valt niets te tonen.</p>
                {preview.samenvatting && <p className="muted">{preview.samenvatting}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

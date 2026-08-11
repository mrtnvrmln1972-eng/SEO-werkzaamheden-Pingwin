"use client";

// De documenten bij een taak of pagina.
//
// Zelf beheren in plaats van automatisch samenvoegen. Elk document dat je hier
// neerlegt, plakt of vanuit een mail naartoe sleept wordt gewoon een versie in de
// lijst: nieuwste bovenaan, met de datum en van wie het komt. Jij bepaalt met één
// vinkje welke versie geldt; die gaat standaard mee in een mail en naar de
// sitebouwer, en is de tekst waar de rest van het dashboard mee rekent.
//
// Wat hier vroeger stond: elke klantversie werd een voorstel met een AI-vergelijking,
// en na "Verwerk" werd er een samengevoegd document gemaakt. Dat leverde per ronde
// twee versies en een extra Drive-bestand op, ook als er niets veranderd was.
//
// Spatiebalk opent de voorvertoning van de geselecteerde regel, zoals in Finder.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mdToHtml } from "../../../../lib/markdown";
import { driveIdFromUrl, docsBewerkLink } from "../../../../lib/drive-id";

type Toets = { oordeel: "goed" | "let-op" | "niet-goed"; kop: string; behouden: string[]; verdwenen: string[]; advies: string };
type Versie = {
  id: number; kind: string; source: "pingwin" | "klant"; naam: string; driveLink: string;
  samenvatting: string; vergelijking: string; status: string; createdAt: string; goedgekeurd: boolean;
};

const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data", overig: "Overig" };
const OORDEEL_KLEUR: Record<Toets["oordeel"], string> = { "goed": "wp-toets-goed", "let-op": "wp-toets-letop", "niet-goed": "wp-toets-fout" };

export default function DocVersies({ slug, url, taakId, triggerSlot }: { slug: string; url: string; taakId?: number;
  /** DOM-knoop uit de knoppenbalk van de aantekeningen (via een portal), zodat
      het "document toevoegen"-chipje daar fysiek in staat i.p.v. als eigen,
      altijd-open blok. Geen knoop (nog niet gemount) = gewoon hier inline. */
  triggerSlot?: HTMLElement | null }) {
  const [versies, setVersies] = useState<Versie[]>([]);
  const [drag, setDrag] = useState(false);
  // Het "voeg een document toe"-blok stond hier altijd volledig open, ook als er
  // niets te doen was: drie regels uitleg en een invoerveld voor iets dat je maar
  // af en toe gebruikt. Nu een klein, gekleurd chipje (net als in de kennisbank)
  // dat pas opengaat als je erop klikt; slepen werkt ook al op het dichte chipje.
  const [dropOpen, setDropOpen] = useState(false);
  const bestandRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [linkVeld, setLinkVeld] = useState("");
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [preview, setPreview] = useState<Versie | null>(null);
  const [hernoem, setHernoem] = useState<{ id: number; naam: string } | null>(null);
  const [toets, setToets] = useState<{ id: number; uitkomst: Toets } | null>(null);
  // Copy als concept naar de site (R6): zet de geldende copy als concept-pagina
  // in WordPress, nooit de bestaande live pagina. Eén knop voor de hele pagina,
  // niet per versie: de API leest toch altijd de geldende ("goedgekeurd") tekst.
  const [conceptBusy, setConceptBusy] = useState(false);
  const [conceptResult, setConceptResult] = useState<{ ok: boolean; detail: string; previewUrl?: string | null } | null>(null);

  // Aantal versies per soort. Eén copy betekent: die geldt, punt. Twee betekent:
  // jij moet kiezen, en dan pas verschijnt het vinkje.
  const aantalPerSoort: Record<string, number> = {};
  for (const v of versies) aantalPerSoort[v.kind] = (aantalPerSoort[v.kind] || 0) + 1;

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

  async function zetAlsConcept() {
    setConceptBusy(true); setConceptResult(null);
    try {
      const d = await fetch("/api/admin/copy-doorvoeren", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url }),
      }).then((r) => r.json());
      setConceptResult({ ok: !!d.ok, detail: d.ok ? d.detail : (d.error || "Dat lukte niet; probeer het nog een keer."), previewUrl: d.previewUrl || null });
    } catch { setConceptResult({ ok: false, detail: "Dat lukte niet; probeer het nog een keer." }); }
    finally { setConceptBusy(false); }
  }

  const dd = (d: string) => {
    try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
  };
  const previewUrl = (v: Versie) => {
    const id = driveIdFromUrl(v.driveLink);
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  };

  // Dit chipje mag ook een bestand rechtstreeks aannemen (slepen zonder eerst te
  // klikken); klikken opent daarnaast het volledige blok voor bladeren of een link.
  const chip = (
    <button type="button" className={"wp-docchip" + (drag ? " wp-docchip-actief" : "")}
      disabled={busy === "lezen"}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const bijlage = e.dataTransfer.getData("application/pingwin-bijlage");
        if (bijlage) { try { void uitMail(JSON.parse(bijlage)); } catch { /* geen geldige bijlage */ } return; }
        const f = e.dataTransfer.files?.[0]; if (f) void drop(f);
      }}
      onClick={() => setDropOpen((v) => !v)}
      title="Document toevoegen: klik, sleep een bestand hierheen, of sleep een bijlage uit een mail">
      {busy === "lezen" ? "Bezig…" : "+ document"}
    </button>
  );

  return (
    <div className="wp-docs">
      {triggerSlot ? createPortal(chip, triggerSlot) : chip}
      {dropOpen && (
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
                <button type="button" className="btn btn-ghost btn-klein" disabled={!linkVeld.trim() || !!busy}
                  onClick={() => { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); }}>Lees</button>
              </span>
              <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={() => setDropOpen(false)}>×</button>
            </>
          )}
        </div>
      )}

      {fout && <div className="wp-doc-fout">{fout}</div>}

      {versies.length > 0 && (
        <ul className="wp-doclijst">
          {/* Leesvolgorde = proces-volgorde (analyse, blauwdruk, copy), binnen een
              stap nieuwste eerst. Puur op datum stond copy bovenaan en las de
              lijst als een omgekeerd proces. */}
          {/* Hoeveel versies liggen er per soort? Bepaalt of het vinkje "geldt" een
              echte keuze is of alleen een klusje (zie de rij hieronder). */}
          {[...versies].sort((a, b) => {
            const rang: Record<string, number> = { analyse: 1, blauwdruk: 2, copy: 3, structured: 4 };
            const va = rang[a.kind] || 9, vb = rang[b.kind] || 9;
            return va !== vb ? va - vb : (a.createdAt < b.createdAt ? 1 : -1);
          }).map((v) => (
            <li key={v.id}
              className={"wp-docrij" + (gekozen === v.id ? " wp-docrij-aan" : "") + (v.goedgekeurd ? " wp-docrij-geldt" : "")}
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
              ) : (
                <button type="button" className="wp-docrij-naam"
                  onClick={(e) => { e.stopPropagation(); setHernoem({ id: v.id, naam: v.naam || "" }); }}
                  title="Klik om de naam aan te passen">{v.naam || "document"}</button>
              )}

              <span className="wp-docrij-acties" onClick={(e) => e.stopPropagation()}>
                {/* Het vinkje beantwoordt één vraag: welke van deze copy-versies is
                    DE copy? Dat is pas een vraag als er meer dan één ligt (bijvoorbeeld
                    nadat de klant een versie terugstuurde). Ligt er maar één, dan geldt
                    hij vanzelf en zou het vinkje alleen een klusje zijn dat je kunt
                    vergeten, met een stilgevallen mail en werklijst als gevolg. */}
                {aantalPerSoort[v.kind] > 1 ? (
                  <label className="wp-docrij-geldt-vink" title={`Er liggen ${aantalPerSoort[v.kind]} versies van dit soort. Vink aan welke er geldt: die gaat mee in een mail en naar de sitebouwer, en is de tekst waar de rest mee rekent.`}>
                    <input type="checkbox" checked={v.goedgekeurd} disabled={!!busy}
                      onChange={(e) => void stuur({ action: "goedkeur", id: v.id, aan: e.target.checked }, "goedkeur")} />
                    <span>geldt</span>
                  </label>
                ) : v.goedgekeurd ? (
                  <span className="wp-docrij-geldt-vast" title="Het enige document van dit soort, dus dit is de versie waar de mail, de sitebouwer en de rest van het dashboard mee rekenen.">geldt</span>
                ) : null}
                {v.source === "klant" && (
                  <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy}
                    title="Kijk of deze teruggekregen versie nog aan de SEO-criteria voldoet"
                    onClick={async () => {
                      const d = await stuur({ action: "toets", id: v.id }, "toets");
                      if (d?.toets) setToets({ id: v.id, uitkomst: d.toets as Toets });
                    }}>{busy === "toets" ? "Toetsen…" : "Toets aan de criteria"}</button>
                )}
                {/* Een Word-document opent rechtstreeks in Docs; een pdf, plaatje
                    of ander bestand houdt de gewone Drive-link, want die kan Docs
                    niet openen. Vandaar de bestandsnaam als scheidsrechter. */}
                {v.driveLink && <a className="wp-link" href={/\.(docx?|)$/i.test(v.naam || "") ? docsBewerkLink(v.driveLink) : v.driveLink} target="_blank" rel="noreferrer">openen</a>}
                <button type="button" className="wp-icon wp-del" title="Van de lijst halen (het bestand blijft in Drive)"
                  onClick={() => void stuur({ action: "negeer", id: v.id }, "weg")}>×</button>
              </span>

              {toets?.id === v.id && (
                <div className={"wp-toets " + OORDEEL_KLEUR[toets.uitkomst.oordeel]}>
                  <strong>{toets.uitkomst.kop}</strong>
                  {toets.uitkomst.verdwenen.length > 0 && (
                    <ul>{toets.uitkomst.verdwenen.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  )}
                  <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(toets.uitkomst.advies) }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {versies.some((v) => v.kind === "copy" && v.goedgekeurd) && (
        <div className="wp-doc-concept">
          <button type="button" className="btn btn-primary btn-klein" disabled={conceptBusy}
            onClick={() => void zetAlsConcept()}
            title="Zet de geldende copy als concept (nog niet live) in de site. De bestaande, live pagina blijft ongewijzigd; publiceren doe je zelf in WordPress.">
            {conceptBusy ? "Concept plaatsen…" : "Zet copy als concept in de site"}
          </button>
          {conceptResult && (
            <span className={conceptResult.ok ? "wp-doc-ok" : "wp-doc-fout"}>
              {conceptResult.detail}
              {conceptResult.previewUrl && (
                <> <a href={conceptResult.previewUrl} target="_blank" rel="noreferrer">Bekijk het concept</a></>
              )}
            </span>
          )}
        </div>
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

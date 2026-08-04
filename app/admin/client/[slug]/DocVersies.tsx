"use client";

// Documenten-blokje op de open projectkaart: sleep hier een teruggekregen
// (klant)versie naartoe of plak een Drive-link. Droppen is altijd veilig: er
// verandert niets aan de geldende versie tot Maarten op "Verwerk" klikt. Elke
// versie blijft bewaard in het archief eronder.

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Versie = { id: number; kind: string; source: "pingwin" | "klant"; naam: string; driveLink: string; samenvatting: string; vergelijking: string; status: string; createdAt: string };
type Voorstel = { id: number; kind: string; kindLabel: string; naam: string; vergelijking: string; samenvatting: string };

const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data", overig: "Overig" };
const KINDS = ["analyse", "blauwdruk", "copy", "structured", "overig"];

export default function DocVersies({ slug, url }: { slug: string; url: string }) {
  const [versies, setVersies] = useState<Versie[]>([]);
  const [lijstOpen, setLijstOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const bestandRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [voorstel, setVoorstel] = useState<Voorstel | null>(null);
  const [kindKeuze, setKindKeuze] = useState("");
  const [linkVeld, setLinkVeld] = useState("");

  async function laad() {
    const d = await fetch(`/api/admin/page-doc/upload?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) {
      setVersies(d.versions || []);
      const open = (d.versions || []).find((v: Versie) => v.status === "voorstel");
      if (open && !voorstel) setVoorstel({ id: open.id, kind: open.kind, kindLabel: KIND_LABEL[open.kind] || open.kind, naam: open.naam, vergelijking: open.vergelijking, samenvatting: open.samenvatting });
    }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, url]);

  async function drop(file: File) {
    setBusy("lezen"); setFout(""); setOkMsg(""); setVoorstel(null);
    try {
      const form = new FormData();
      form.append("file", file); form.append("slug", slug); form.append("url", url);
      const d = await fetch("/api/admin/page-doc/upload", { method: "POST", body: form }).then((r) => r.json());
      if (d?.ok && d.proposal) { setVoorstel(d.proposal); setKindKeuze(d.proposal.kind); void laad(); }
      else setFout(d?.error || "Kon het bestand niet verwerken.");
    } catch { setFout("Uploaden mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  async function plakLink() {
    const link = linkVeld.trim();
    if (!link) return;
    setBusy("lezen"); setFout(""); setOkMsg(""); setVoorstel(null);
    try {
      const d = await fetch("/api/admin/page-doc/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", slug, url, driveLink: link }) }).then((r) => r.json());
      if (d?.ok && d.proposal) { setVoorstel(d.proposal); setKindKeuze(d.proposal.kind); setLinkVeld(""); void laad(); }
      else setFout(d?.error || "Kon het document niet lezen.");
    } catch { setFout("Lezen mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  async function besluit(actie: "verwerk" | "negeer") {
    if (!voorstel) return;
    setBusy(actie); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actie, slug, id: voorstel.id, kind: kindKeuze || voorstel.kind }) }).then((r) => r.json());
      if (d?.ok) {
        setVoorstel(null);
        if (actie === "verwerk") setOkMsg(d.samenvatting ? `Verwerkt: ${d.samenvatting}` : "Verwerkt; dit is nu de geldende versie.");
        void laad();
      } else setFout(d?.error || "Dat lukte niet; probeer het nog een keer.");
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  const dd = (d: string) => { try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; } };
  const vergelijkTekst: Record<string, string> = { nieuwer: "nieuwer dan wat er staat", ouder: "let op: lijkt een óudere versie", nieuw: "eerste versie van dit soort" };

  return (
    <div className="wp-docs">
      <div className={"wp-docdrop" + (drag ? " wp-docdrop-actief" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void drop(f); }}>
        {busy === "lezen" ? (
          <span className="muted">Document lezen en vergelijken…</span>
        ) : (
          <>
            {/* Slepen werkt, maar niet iedereen sleept. Vandaar ook een gewone
                knop om te bladeren. Pdf staat er nu bij: klanten sturen hun
                geredigeerde teksten juist vaak als pdf terug. */}
            <span className="wp-docdrop-tekst">
              <strong>Voeg een bestand toe.</strong>{" "}
              <button type="button" className="wp-docdrop-kies" disabled={!!busy}
                onClick={() => bestandRef.current?.click()}>kies een bestand</button>{" "}
              of plak een Drive-link:
            </span>
            <input ref={bestandRef} type="file" className="wp-docdrop-verborgen"
              accept=".docx,.pdf,.txt,.md,.json,.csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void drop(f); e.target.value = ""; }} />
            <span className="wp-docdrop-linkrij">
              <input className="wp-docdrop-input" value={linkVeld} placeholder="https://docs.google.com/…"
                onChange={(e) => setLinkVeld(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void plakLink(); }} />
              <button type="button" className="wp-fase-btn" disabled={!linkVeld.trim() || !!busy} onClick={() => void plakLink()}>Lees</button>
            </span>
          </>
        )}
      </div>
      {voorstel && (
        <div className="wp-docvoorstel">
          {/* Stond er als "Herkend als [keuzelijst]": systeemtaal die niet zegt wat
              er van je gevraagd wordt. Nu een gewone vraag, zodat meteen duidelijk
              is dat hier iets op jouw akkoord ligt te wachten. */}
          <div className="wp-docvoorstel-kop">
            <strong>Er ligt een nieuw document klaar.</strong>
            <span>Volgens mij is dit de</span>
            <select className="wp-docvoorstel-kind" value={kindKeuze} onChange={(e) => setKindKeuze(e.target.value)}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <span className={"wp-doc-vergelijk" + (voorstel.vergelijking === "ouder" ? " wp-doc-ouder" : "")}>{vergelijkTekst[voorstel.vergelijking] || ""}</span>
          </div>
          {/* Gerenderd, niet als platte tekst: het model levert soms markdown en
              dan stonden er sterretjes in beeld. */}
          <div className="wp-docvoorstel-tekst md" dangerouslySetInnerHTML={{ __html: mdToHtml(voorstel.samenvatting || "") }} />
          <div className="wp-docvoorstel-acties">
            <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void besluit("verwerk")}>{busy === "verwerk" ? "Samenvoegen…" : "Verwerk tot geldende versie"}</button>
            <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void besluit("negeer")}>Negeer</button>
            <span className="muted">Er wordt nooit iets weggegooid; alles blijft in het archief.</span>
          </div>
        </div>
      )}
      {okMsg && <div className="wp-doc-ok">{okMsg}</div>}
      {fout && <div className="wp-doc-fout">{fout}</div>}
      {versies.length > 0 && (
        <div className="wp-docversies">
          <button type="button" className="wp-chat-toggle" onClick={() => setLijstOpen(!lijstOpen)}>Versies ({versies.length}) {lijstOpen ? "▾" : "▸"}</button>
          {lijstOpen && (
            <ul className="wp-docversie-lijst">
              {versies.map((v) => (
                <li key={v.id}>
                  <span className={"wp-docversie-bron " + (v.source === "klant" ? "wp-bron-klant" : "wp-bron-pingwin")}>{v.source === "klant" ? "Klant" : "Pingwin"}</span>
                  <span className="wp-docversie-kind">{KIND_LABEL[v.kind] || v.kind}</span>
                  <span className="muted">{dd(v.createdAt)}</span>
                  {v.driveLink ? <a className="wp-link" href={v.driveLink} target="_blank" rel="noreferrer">{v.naam || "document"}</a> : <span>{v.naam}</span>}
                  {v.samenvatting && <span className="wp-docversie-sam muted">{v.samenvatting}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

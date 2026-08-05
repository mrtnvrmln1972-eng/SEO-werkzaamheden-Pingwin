"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════
// DE DROPZONE VAN HET GESPREK
// ═══════════════════════════════════════════════════════════
// Sleep een document of een screenshot in een open gesprek en het landt op twee
// plekken tegelijk: in de klantmap in Drive (het dossier, waar het over een maand
// nog staat) en in dit gesprek, zodat de assistent het meteen meeleest.
//
// Drie manieren om iets binnen te brengen, want het moet nooit zoeken worden:
// slepen (waar dan ook over dit gesprek), plakken (een screenshot uit je
// klembord) en gewoon bladeren.
// ═══════════════════════════════════════════════════════════

export type ChatFile = {
  id: number;
  naam: string;
  soort: "document" | "afbeelding" | "overig";
  link: string;
  kern: string;
  toegevoegdOp: string;
};

export default function ChatBestanden({ slug, thread, onToegevoegd }: {
  slug: string;
  thread: string;
  /** Zodat het gesprek kan melden wat er binnenkwam (als bericht in de chat). */
  onToegevoegd?: (f: ChatFile) => void;
}) {
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [bezig, setBezig] = useState<string[]>([]);      // namen die nu uploaden
  const [fout, setFout] = useState("");
  const [sleep, setSleep] = useState(false);
  const kiesRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef(thread);
  threadRef.current = thread;

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/chat-bestand?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(thread)}`)
      .then((r) => r.json())
      .then((d) => { if (!off && d?.ok) setFiles(d.files || []); })
      .catch(() => {});
    return () => { off = true; };
  }, [slug, thread]);

  const stuur = useCallback(async (lijst: File[]) => {
    if (!lijst.length) return;
    setFout("");
    for (const f of lijst) {
      const naam = f.name || "bestand";
      setBezig((b) => [...b, naam]);
      try {
        const fd = new FormData();
        fd.append("slug", slug);
        fd.append("thread", threadRef.current);
        fd.append("file", f, naam);
        const d = await fetch("/api/admin/chat-bestand", { method: "POST", body: fd }).then((r) => r.json());
        if (d?.ok && d.file) {
          setFiles((v) => [d.file as ChatFile, ...v]);
          onToegevoegd?.(d.file as ChatFile);
        } else setFout(d?.error || `"${naam}" kon niet worden opgeslagen.`);
      } catch { setFout(`"${naam}" kon niet worden opgeslagen.`); }
      finally { setBezig((b) => b.filter((n) => n !== naam)); }
    }
  }, [slug, onToegevoegd]);

  // Slepen over het hele scherm en plakken uit het klembord. Alleen actief zolang
  // dit gesprek openstaat, zodat een screenshot nooit in het verkeerde dossier
  // belandt.
  useEffect(() => {
    let teller = 0;
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault(); teller++; setSleep(true);
    };
    const verlaat = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      teller = Math.max(0, teller - 1); if (!teller) setSleep(false);
    };
    const overBlijf = (e: DragEvent) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault(); teller = 0; setSleep(false);
      void stuur(Array.from(e.dataTransfer.files));
    };
    const plak = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.files || []);
      if (!items.length) return;
      e.preventDefault();
      void stuur(items);
    };
    window.addEventListener("dragenter", over);
    window.addEventListener("dragleave", verlaat);
    window.addEventListener("dragover", overBlijf);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", plak);
    return () => {
      window.removeEventListener("dragenter", over);
      window.removeEventListener("dragleave", verlaat);
      window.removeEventListener("dragover", overBlijf);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", plak);
    };
  }, [stuur]);

  async function verwijder(id: number) {
    setFiles((v) => v.filter((f) => f.id !== id));
    await fetch(`/api/admin/chat-bestand?slug=${encodeURIComponent(slug)}&id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  const icoon = (s: ChatFile["soort"]) => (s === "afbeelding" ? "🖼" : "📄");

  return (
    <div className={"cb-zone" + (sleep ? " cb-sleep" : "")}>
      <div className="cb-rij">
        <span className="cb-uitleg">
          Sleep een document of screenshot hierheen (of plak hem). Hij komt in de klantmap in Drive én in dit gesprek.
        </span>
        <button type="button" className="ghost-btn small" onClick={() => kiesRef.current?.click()}>Bladeren</button>
        <input ref={kiesRef} type="file" multiple style={{ display: "none" }}
          onChange={(e) => { void stuur(Array.from(e.target.files || [])); e.target.value = ""; }} />
      </div>

      {(files.length > 0 || bezig.length > 0) && (
        <div className="cb-lijst">
          {bezig.map((n) => <span key={"b" + n} className="cb-chip cb-bezig">{n} wordt ingelezen…</span>)}
          {files.map((f) => (
            <span key={f.id} className="cb-chip" title={f.kern || "Nog geen leesbare inhoud"}>
              <span className="cb-icoon" aria-hidden="true">{icoon(f.soort)}</span>
              {f.link
                ? <a className="cb-naam" href={f.link} target="_blank" rel="noreferrer">{f.naam}</a>
                : <span className="cb-naam">{f.naam}</span>}
              <button type="button" className="cb-weg" title="Uit dit gesprek halen (het bestand blijft in Drive staan)"
                onClick={() => void verwijder(f.id)}>×</button>
            </span>
          ))}
        </div>
      )}

      {fout && <div className="login-error cb-fout">{fout}</div>}
      {sleep && <div className="cb-overlay">Laat los om toe te voegen aan dit gesprek</div>}
    </div>
  );
}

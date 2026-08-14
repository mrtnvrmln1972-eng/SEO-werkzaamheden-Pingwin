"use client";

// Knop op de interne documentweergave (de "tussenfase"): zet de hier getoonde,
// al vastgelegde tekst alsnog om naar een Word-bestand in de Drive-map van de
// klant, zonder de stap opnieuw te laten genereren. Is er nog geen map gekozen
// voor deze pagina, dan klapt de mapkiezer eerst open; de upload volgt zodra je
// kiest. Zie app/api/admin/page-doc/naar-drive.

import { useEffect, useState } from "react";
import DriveMapKiezer, { type DriveMap } from "../DriveMapKiezer";

export default function UploadNaarDrive({ slug, url, kind }: {
  slug: string; url: string; kind: "analyse" | "blauwdruk" | "copy";
}) {
  const [driveMap, setDriveMap] = useState<DriveMap | null | undefined>(undefined);
  const [kiezerOpen, setKiezerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/drive/folders?chosenOnly=1&slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setDriveMap(d?.ok && d.chosen ? { id: d.chosen.folderId, name: d.chosen.folderName, path: d.chosen.folderPath } : null); })
      .catch(() => { if (alive) setDriveMap(null); });
    return () => { alive = false; };
  }, [slug, url]);

  async function upload() {
    if (busy) return;
    setBusy(true); setFout(""); setLink("");
    try {
      const d = await fetch("/api/admin/page-doc/naar-drive", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, kind }),
      }).then((r) => r.json());
      if (d?.ok) setLink(d.link);
      else setFout(d?.error || "Uploaden naar Drive mislukte.");
    } catch { setFout("Uploaden naar Drive mislukte."); } finally { setBusy(false); }
  }

  function klik() {
    if (driveMap) { void upload(); return; }
    setKiezerOpen(true);
  }

  return (
    <div className="row" style={{ marginTop: "var(--s-2)" }}>
      <button type="button" className="btn btn-ghost" disabled={busy || driveMap === undefined} onClick={klik}
        title="Zet deze al geschreven tekst om naar een Word-bestand in de Drive-map van de pagina, zonder opnieuw te genereren.">
        {busy ? "Bezig…" : driveMap ? `Upload naar Drive (${driveMap.path || driveMap.name})` : "Kies Drive-map en upload"}
      </button>
      {link && (
        <span className="saved-msg" style={{ marginLeft: "var(--s-3)" }}>
          Geüpload. <a href={link} target="_blank" rel="noreferrer">Open het document</a> — deze link wordt vanaf nu ook gebruikt bij Developer en Mail.
        </span>
      )}
      {fout && <span className="login-error" style={{ marginLeft: "var(--s-3)" }}>{fout}</span>}
      <DriveMapKiezer slug={slug} url={url} open={kiezerOpen}
        onClose={() => setKiezerOpen(false)}
        onChosen={(m) => { setDriveMap(m); setKiezerOpen(false); void upload(); }} />
    </div>
  );
}

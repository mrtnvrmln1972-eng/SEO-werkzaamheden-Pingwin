"use client";

// De Google Drive-mapkiezer als los venster: bladeren, een submap maken en de
// bestemmingsmap voor een pagina vastleggen (server-side, per klant + URL).
// Eén component voor elke plek die een map nodig heeft (de pagina-chat in
// Pagina's en de projectkaart in de planning), zodat de keuze overal dezelfde
// is en op één plek onthouden wordt.

import { useEffect, useState } from "react";

export type DriveMap = { id: string; name: string; path: string };

// ── Een leesbare mapnaam uit het pad van de pagina ──
// Het naamveld stond leeg, dus werd de map met de hand genoemd, en dan ontstaat
// er een map die letterlijk "/hovenier/oosterhout" heet terwijl zijn buren
// "Hovenier Etten-Leur" en "Tuinontwerp Landingpage" heten. Een voorstel in de
// stijl van die buren houdt de Drive leesbaar; je kunt hem gewoon overtypen.
export function mapVoorstel(url: string): string {
  let pad = "";
  try { pad = new URL(url).pathname; } catch { pad = url || ""; }
  const delen = pad.split("/").map((d) => d.trim()).filter(Boolean);
  if (!delen.length) return "";
  return delen
    .slice(-2)
    .join(" ")
    .replace(/[-_]+/g, " ")
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export default function DriveMapKiezer({ slug, url, open, onClose, onChosen }: {
  slug: string; url: string; open: boolean;
  /** Kruisje of Annuleren: sluiten zonder keuze. */
  onClose: () => void;
  /** De map is gekozen én server-side opgeslagen; de ouder sluit het venster. */
  onChosen: (map: DriveMap) => void;
}) {
  type Folder = { id: string; name: string };
  const [stack, setStack] = useState<Folder[]>([{ id: "root", name: "Mijn Drive" }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newFolder, setNewFolder] = useState("");
  // De map die nu vastligt voor deze pagina, zodat je ziet wat je aan het
  // wijzigen bent in plaats van blind een nieuwe keuze te maken.
  const [huidig, setHuidig] = useState<DriveMap | null>(null);

  async function loadFolders(parentId: string) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/admin/drive/folders?parent=${encodeURIComponent(parentId)}`);
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Kon Drive-mappen niet laden."); setFolders([]); return; }
      setFolders(d.folders || []);
    } catch { setErr("Kon Drive-mappen niet laden."); } finally { setBusy(false); }
  }

  // Bij openen: start waar je vorige keer was (per klant onthouden), zodat je
  // niet elke keer vanaf Mijn Drive naar de klantmap hoeft te klikken. En het
  // naamveld staat meteen ingevuld met een voorstel uit het pad van de pagina,
  // want in de praktijk is "de map bestaat nog niet" de normale situatie: een
  // nieuwe pagina heeft er per definitie nog geen.
  useEffect(() => {
    if (!open) return;
    let s: Folder[] = [{ id: "root", name: "Mijn Drive" }];
    try {
      const c = localStorage.getItem(`pw_drivestack_${slug}`);
      if (c) { const p = JSON.parse(c); if (Array.isArray(p) && p.length && p[0]?.id === "root") s = p; }
    } catch { /* geen geheugen */ }
    setStack(s); setNewFolder(mapVoorstel(url)); setErr("");
    void loadFolders(s[s.length - 1].id);
    fetch(`/api/admin/drive/folders?chosenOnly=1&slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { setHuidig(d?.ok && d.chosen ? { id: d.chosen.folderId, name: d.chosen.folderName, path: d.chosen.folderPath } : null); })
      .catch(() => setHuidig(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug, url]);

  function enterFolder(f: Folder) { const s = [...stack, f]; setStack(s); void loadFolders(f.id); }
  function jumpTo(i: number) { const s = stack.slice(0, i + 1); setStack(s); void loadFolders(s[s.length - 1].id); }

  async function makeSubfolder() {
    const name = newFolder.trim(); if (!name) return;
    setBusy(true); setErr("");
    try {
      const parent = stack[stack.length - 1].id;
      const r = await fetch("/api/admin/drive/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", parent, name }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Map maken mislukt."); return; }
      setNewFolder("");
      // Meteen de nieuwe map in. Anders maakte je hem aan, kwam je terug in de
      // lijst van de bovenliggende map en moest je hem daar zelf terugvinden om
      // hem te kunnen kiezen; precies de stap die vergeten werd, waardoor de
      // documenten in de bovenliggende map bleven landen.
      if (d.folder?.id) { const f = { id: String(d.folder.id), name: String(d.folder.name || name) }; setStack([...stack, f]); await loadFolders(f.id); }
      else await loadFolders(parent);
    } catch { setErr("Map maken mislukt."); } finally { setBusy(false); }
  }

  async function chooseCurrent() {
    const cur = stack[stack.length - 1];
    if (cur.id === "root") { setErr("Kies eerst een map (niet de hoofdmap zelf)."); return; }
    const path = stack.slice(1).map((f) => f.name).join(" / ");
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/drive/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", slug, url, folderId: cur.id, folderName: cur.name, folderPath: path }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Opslaan mislukt."); return; }
      try { localStorage.setItem(`pw_drivestack_${slug}`, JSON.stringify(stack)); } catch { /* geheugen is extra */ }
      onChosen({ id: cur.id, name: cur.name, path });
    } catch { setErr("Opslaan mislukt."); } finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="compose-overlay">
      <div className="compose-modal drive-modal">
        <div className="compose-head"><span>Waar komen de documenten van deze pagina?</span><button type="button" className="chat-float-close" onClick={onClose}>&times;</button></div>
        <div className="compose-body">
          <p className="drive-uitleg">
            {huidig
              ? <>Nu ingesteld: <strong>{huidig.path || huidig.name}</strong>. Blader naar een andere map, of maak er hieronder een.</>
              : <>Er is nog geen map gekozen; de documenten blijven dan in het dashboard staan. Blader naar de map waar ze in moeten, of maak hem hieronder aan.</>}
          </p>
          <div className="drive-crumbs">
            {stack.map((f, i) => (
              <span key={f.id}>
                <button type="button" className="drive-crumb" onClick={() => jumpTo(i)}>{f.name}</button>
                {i < stack.length - 1 && <span className="drive-sep"> / </span>}
              </span>
            ))}
          </div>
          {err && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{err}</div>}
          <div className="drive-list">
            {busy && <div className="muted" style={{ padding: "var(--s-2)" }}>Laden…</div>}
            {!busy && folders.length === 0 && <div className="muted" style={{ padding: "var(--s-2)" }}>Geen submappen hier. Kies deze map, of maak een nieuwe submap.</div>}
            {!busy && folders.map((f) => (
              <button key={f.id} type="button" className="drive-row" onClick={() => enterFolder(f)}>{f.name} <span className="muted">openen ›</span></button>
            ))}
          </div>
          <div className="drive-newfolder">
            <input className="compose-input" value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Naam van de nieuwe map…"
              onKeyDown={(e) => { if (e.key === "Enter" && newFolder.trim() && !busy) { e.preventDefault(); void makeSubfolder(); } }} />
            <button type="button" className="btn btn-ghost btn-klein" onClick={makeSubfolder} disabled={busy || !newFolder.trim()}>
              Maak map in “{stack[stack.length - 1].name}”
            </button>
          </div>
        </div>
        <div className="compose-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuleren</button>
          <button type="button" className="btn btn-primary btn-klein" onClick={chooseCurrent} disabled={busy}>Hierin: “{stack[stack.length - 1].name}”</button>
        </div>
      </div>
    </div>
  );
}

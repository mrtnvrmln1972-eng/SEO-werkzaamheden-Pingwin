"use client";

// De vaste "Opslaan in:"-regel die bij meerdere stappen staat (chat, documenten,
// cannibalisatie, interne links, structured data). Eén component in plaats van
// vijf keer dezelfde regel uitschrijven; alleen de lege-tekst en de marges
// verschillen per plek.
import type { DriveFolder } from "./types";

export default function DriveRij({ folder, legeTekst, onKies, onNaarDownload, style }: {
  folder: DriveFolder | null;
  legeTekst: string;
  onKies: () => void;
  /** Alleen de chat heeft de knop "Naar download" (Drive-keuze weer loslaten). */
  onNaarDownload?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className="page-chat-drive" style={style}>
      <span className="pcd-label">Opslaan in:</span>
      {folder
        ? <span className="pcd-folder">{folder.path || folder.name}</span>
        : <span className="pcd-folder muted">{legeTekst}</span>}
      <button type="button" className="btn btn-klein" onClick={onKies}>{folder ? "Map wijzigen" : "Kies Drive-map"}</button>
      {onNaarDownload && folder && <button type="button" className="btn btn-klein" onClick={onNaarDownload}>Naar download</button>}
    </div>
  );
}

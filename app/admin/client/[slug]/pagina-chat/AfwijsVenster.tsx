"use client";

// Het afwijs-venstertje bij een rij uit de cannibalisatie-tabel: vraagt om de
// reden; die komt als onderbouwing in het klantdocument.
import type { useCannibalisatie } from "./useCannibalisatie";

export default function AfwijsVenster({ canni }: { canni: ReturnType<typeof useCannibalisatie> }) {
  const { rejectPath, setRejectPath, rejectReason, setRejectReason, confirmReject } = canni;
  if (!rejectPath) return null;
  return (
        <div className="compose-overlay">
          <div className="canni-check-pop" style={{ width: "min(520px, 94vw)" }}>
            <div className="ccp-head">
              <strong>Voorstel afwijzen</strong>
              <code className="ccp-path">{rejectPath}</code>
              <button type="button" className="btn btn-klein ccp-close" onClick={() => { setRejectPath(""); setRejectReason(""); }} title="Annuleren">✕</button>
            </div>
            <p className="muted" style={{ fontSize: "var(--fs-sm)", margin: "var(--s-1) 0 var(--s-3)" }}>Leg kort vast waarom dit voorstel niet wordt doorgevoerd. Deze reden komt als onderbouwing in het klantdocument.</p>
            <input
              type="text" autoFocus value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmReject(); }}
              placeholder="Bijvoorbeeld: deze pagina moet blijven bestaan voor de Amstelveen-campagne"
              style={{ width: "100%", padding: "var(--s-2) var(--s-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "var(--fs-base)", fontFamily: "inherit" }}
            />
            <div className="ccp-actions">
              <button type="button" className="pcd-btn small pcd-warn" onClick={confirmReject}>Afwijzen</button>
              <button type="button" className="pcd-btn small wp-ghost" onClick={() => { setRejectPath(""); setRejectReason(""); }}>Annuleren</button>
            </div>
          </div>
        </div>
  );
}

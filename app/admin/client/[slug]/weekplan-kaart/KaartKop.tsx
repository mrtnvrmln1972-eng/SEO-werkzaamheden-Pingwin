"use client";

// De kop van de projectkaart: de titel (aanpasbaar), de knoppen die op de hele
// kaart slaan, en het kruisje. Hangt de kaart onder een regel in de planning,
// dan toont die regel de titel al en wordt deze kop één actiebalk.

import { useState } from "react";
import type { WpTask } from "./types";

export default function KaartKop({
  slug, t, open, inRij, onToggleOpen, onRemove,
  busy, setBusy, setFoutje, refreshBoard, controleBezig, onControle,
}: {
  slug: string; t: WpTask; open: boolean; inRij?: boolean;
  onToggleOpen: () => void; onRemove: () => void;
  busy: string; setBusy: (v: string) => void; setFoutje: (v: string) => void;
  refreshBoard: () => void;
  controleBezig: boolean; onControle: () => void;
}) {
  // De kaarttitel bijstellen. Dit is wat je in het bord leest en wat als opdracht
  // doorgaat naar de developer, dus je moet hem kunnen herschrijven.
  const [titelBewerk, setTitelBewerk] = useState(false);
  const [titelDraft, setTitelDraft] = useState("");
  const [titelBezig, setTitelBezig] = useState(false);
  const [opruimMsg, setOpruimMsg] = useState<string>("");
  const hasInfo = !!t.toelichting.trim();

  async function bewaarTitel() {
    const nieuw = titelDraft.trim();
    if (!nieuw || nieuw === t.taak.trim()) { setTitelBewerk(false); return; }
    setTitelBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: t.id, taak: nieuw }),
      }).then((r) => r.json());
      if (d?.ok) { setTitelBewerk(false); refreshBoard(); }
      else setFoutje(d?.error || "Titel opslaan mislukte.");
    } catch { setFoutje("Titel opslaan mislukte."); }
    finally { setTitelBezig(false); }
  }

  // "Ruim op": herschrijft de kaarttekst server-side naar het strakke formaat.
  async function ruimOp() {
    if (busy) return;
    setBusy("opruimen"); setOpruimMsg("");
    try {
      const d = await fetch("/api/admin/weekplan/tidy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id }) }).then((r) => r.json());
      if (d?.ok) { setOpruimMsg("Kaarttekst herschreven naar het vaste formaat (zelfde inhoud, geen dubbelingen)."); refreshBoard(); }
      else setOpruimMsg(d?.error || "Opruimen mislukt; er is niets gewijzigd.");
    } catch { setOpruimMsg("Opruimen mislukt; er is niets gewijzigd."); } finally { setBusy(""); }
  }

  // Dichtklappen mag nooit een lopende tekstselectie opeten (kopiëren gaat voor).
  const toggleAlsGeenSelectie = () => {
    const s = typeof window !== "undefined" ? window.getSelection() : null;
    if (s && !s.isCollapsed) return;
    onToggleOpen();
  };

  // Titel en subtitel splitsen: "Ontwikkel /pad/ (copy, bouw, ...)" leest rustiger
  // met het haakjes-deel als eigen regel eronder (stijl weekplanner-voorbeeld).
  const titelMatch = /^(.*?)\s*(\([^()]{3,}\))\s*$/.exec(t.taak);
  const titel = titelMatch ? titelMatch[1] : t.taak;
  const subtitel = titelMatch ? titelMatch[2] : "";

  return (
    <>
      <div className={"wp-kop-rij" + (inRij ? " wp-kop-balk" : "")}>
        <div className="wp-kop-tekst">
          {titelBewerk ? (
            <div className="wp-titel-bewerk">
              <input autoFocus value={titelDraft} disabled={titelBezig}
                onChange={(e) => setTitelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void bewaarTitel(); }
                  if (e.key === "Escape") { e.preventDefault(); setTitelBewerk(false); }
                }} />
              <button type="button" className="btn btn-ghost btn-klein" disabled={titelBezig} onClick={() => void bewaarTitel()}>{titelBezig ? "Bezig…" : "Bewaar"}</button>
              <button type="button" className="btn btn-ghost btn-klein" disabled={titelBezig} onClick={() => setTitelBewerk(false)}>Annuleer</button>
            </div>
          ) : inRij ? null : (
            <div className="wp-card-taak wp-clickable" onClick={toggleAlsGeenSelectie} title={open ? "Klik om dicht te klappen" : "Klik voor de fases, info en chat"}>
              <span className="wp-caret">{open ? "▾" : "▸"}</span>
              {titel}
              <button type="button" className="wp-titel-pen" title="Titel aanpassen"
                onClick={(e) => { e.stopPropagation(); setTitelDraft(t.taak.replace(/<[^>]*>/g, "").trim()); setTitelBewerk(true); }}>✎</button>
            </div>
          )}
          {subtitel && !inRij && <div className="wp-card-sub wp-clickable" onClick={toggleAlsGeenSelectie}>{subtitel}</div>}
        </div>
        <span className="wp-kop-acties">
          {/* Nameten hoort naast doorzetten: dat is dezelfde afspraak, een
              paar weken later. Alleen zinvol bij een pagina. */}
          {open && t.url && (
            <button type="button" className="btn btn-ghost btn-klein" disabled={controleBezig}
              title="Meet de live pagina op wat er bij het doorzetten is afgesproken, zet het bewijs in de kaart en vinkt Implementatie af als het klopt."
              onClick={onControle}>
              {controleBezig ? "Meten…" : "Is dit doorgevoerd?"}
            </button>
          )}
          {open && hasInfo && (
            <button type="button" className="btn btn-ghost btn-klein" disabled={busy === "opruimen"}
              title="Laat de assistent de kaarttekst één keer herschrijven naar het strakke formaat. Niets verzinnen, niets weggooien; de oude tekst blijft in het archief staan."
              onClick={() => void ruimOp()}>{busy === "opruimen" ? "Bezig…" : "Opschonen"}</button>
          )}
          {inRij && !titelBewerk && (
            <button type="button" className="wp-titel-pen" title="Titel aanpassen"
              onClick={() => { setTitelDraft(t.taak.replace(/<[^>]*>/g, "").trim()); setTitelBewerk(true); }}>✎</button>
          )}
          <button type="button" className="wp-icon wp-del" title="Verwijderen" onClick={onRemove}>×</button>
        </span>
      </div>
      {open && opruimMsg && <div className={opruimMsg.startsWith("Kaart") ? "wp-opruim-ok" : "wp-opruim-fout"}>{opruimMsg}</div>}
    </>
  );
}

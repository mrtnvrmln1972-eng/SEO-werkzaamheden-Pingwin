"use client";

// De kop van de projectkaart: de titel (aanpasbaar), de knoppen die op de hele
// kaart slaan, en het kruisje. Hangt de kaart onder een regel in de planning,
// dan toont die regel de titel al en wordt deze kop één actiebalk.

import { useState } from "react";
import type { WpTask } from "./types";

export default function KaartKop({
  slug, t, open, inRij, onToggleOpen, onRemove, setFoutje, refreshBoard,
}: {
  slug: string; t: WpTask; open: boolean; inRij?: boolean;
  onToggleOpen: () => void; onRemove: () => void;
  setFoutje: (v: string) => void;
  refreshBoard: () => void;
}) {
  // De kaarttitel bijstellen. Dit is wat je in het bord leest en wat als opdracht
  // doorgaat naar de developer, dus je moet hem kunnen herschrijven.
  const [titelBewerk, setTitelBewerk] = useState(false);
  const [titelDraft, setTitelDraft] = useState("");
  const [titelBezig, setTitelBezig] = useState(false);

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
          {/* Hier stonden twee knoppen; allebei weg op 17-08-2026.

              "Is dit doorgevoerd?" deed exact dezelfde meting als "Gedaan?" in de
              Implementatie-rij (allebei useDoorgevoerd.meet), alleen vinkt die
              tweede de fase ook meteen af als alles klopt. Twee namen voor één
              meting betekent dat je elke keer moet bedenken welke je nodig hebt.
              De meting zit nu waar hij hoort: in de fase die hij meet. De uitslag
              verschijnt nog steeds hier bovenin de kaart.

              "Opschonen" herschreef de kaarttekst naar het vaste formaat. Dat was
              nodig voor de kaarten uit de begintijd, en die zijn opgeruimd; nieuwe
              kaarten komen al in dat formaat binnen. Op 18-08-2026 is om dezelfde
              reden ook de laatste knop weg die dit met de hand deed ("Ruim alle
              kaarten op", in de kop van de planning), en daarmee de route
              /api/admin/weekplan/tidy. Het opschonen zelf bestaat nog en gebeurt
              vanzelf op het enige moment dat het nodig is: als twee kaarten
              samengevoegd worden (`tidyCards` in lib/weekplan-tidy.ts). */}
          {inRij && !titelBewerk && (
            <button type="button" className="wp-titel-pen" title="Titel aanpassen"
              onClick={() => { setTitelDraft(t.taak.replace(/<[^>]*>/g, "").trim()); setTitelBewerk(true); }}>✎</button>
          )}
          <button type="button" className="wp-icon wp-del" title="Verwijderen" onClick={onRemove}>×</button>
        </span>
      </div>
    </>
  );
}

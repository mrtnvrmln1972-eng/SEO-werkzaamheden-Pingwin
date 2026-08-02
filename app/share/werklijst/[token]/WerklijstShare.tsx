"use client";

// De afwerkpagina voor de sitebouwer: twee banen die tegelijk lopen.
// Baan 1 (mensenwerk): contentfoto's uniek maken, met de knop "Alles uniek,
// controleer maar" die het dashboard zelf laat nameten. Baan 2: per pagina de
// kant-en-klare meta's en alt-teksten, met kopieerknop en afvinkvakje per punt.
// Het groene "gecontroleerd door Pingwin"-vinkje zet het dashboard zelf na een
// live-meting; zo hoeft niemand elkaar te mailen of na te lopen.
//
// De lijst zelf komt uit app/_werklijst/WerklijstLijst.tsx, hetzelfde component
// dat de cockpit gebruikt. Hier zonder doorvoerknoppen: doorvoeren in de site
// doet Pingwin, niet de sitebouwer.

import { useEffect, useState } from "react";
import WerklijstLijst, { type Pagina, type Mark, type DubbelItem } from "../../../_werklijst/WerklijstLijst";

export default function WerklijstShare({ token }: { token: string }) {
  const [pages, setPages] = useState<Pagina[]>([]);
  const [dubbel, setDubbel] = useState<DubbelItem[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [clientName, setClientName] = useState("");
  const [fout, setFout] = useState("");
  const [laden, setLaden] = useState(true);
  const [naam, setNaam] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  async function laad() {
    try {
      const d = await fetch(`/api/share/werklijst?token=${encodeURIComponent(token)}`).then((r) => r.json());
      if (d?.ok) { setPages(d.pages || []); setDubbel(d.dubbel || []); setMarks(d.marks || {}); setClientName(d.clientName || ""); }
      else setFout(d?.error || "Kon de werklijst niet laden.");
    } catch { setFout("Kon de werklijst niet laden; ververs de pagina."); }
    finally { setLaden(false); }
  }
  useEffect(() => {
    try { setNaam(window.localStorage.getItem("pingwin-werklijst-naam") || ""); } catch { /* leeg */ }
    void laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function vink(key: string, done: boolean) {
    setMarks((m) => ({ ...m, [key]: { done, doneBy: naam, verified: m[key]?.verified || false } }));
    try { window.localStorage.setItem("pingwin-werklijst-naam", naam); } catch { /* leeg */ }
    await fetch("/api/share/werklijst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "vink", key, done, door: naam }) }).catch(() => {});
  }

  async function controle() {
    setCheckBusy(true); setCheckMsg("");
    try {
      const d = await fetch("/api/share/werklijst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "controle" }) }).then((r) => r.json());
      if (d?.ok) { setCheckMsg(d.samenvatting || "Gecontroleerd."); await laad(); }
      else setCheckMsg(d?.error || "Controleren mislukte; probeer het nog een keer.");
    } catch { setCheckMsg("Controleren mislukte; probeer het nog een keer."); }
    finally { setCheckBusy(false); }
  }

  if (laden) return <div className="wl-wrap"><div className="wl-kaart">Werklijst laden…</div></div>;
  if (fout) return <div className="wl-wrap"><div className="wl-kaart">{fout}</div></div>;

  const siteUrl = pages[0]?.url || "";

  return (
    <div className="wl-wrap">
      <div className="wl-kop">
        <div className="wl-logo">Pingwin <span>Online Marketing</span></div>
        <h1>Werklijst website{clientName ? ` ${clientName}` : ""}</h1>
        <p className="wl-intro">Alles staat hier kant-en-klaar: kopieer de tekst, zet hem in WordPress en vink af. Het dashboard controleert automatisch of het live staat (het groene &ldquo;gecontroleerd&rdquo;); je hoeft dus niets terug te melden behalve de knop hieronder bij stap 1.</p>
        <label className="wl-naam">Je naam (voor de vinkjes): <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bijv. Sander" /></label>
      </div>

      <WerklijstLijst
        pages={pages}
        dubbel={dubbel}
        marks={marks}
        siteUrl={siteUrl}
        onVink={(k, d) => void vink(k, d)}
        onControle={() => void controle()}
        checkBusy={checkBusy}
        checkMsg={checkMsg}
      />

      <p className="wl-voet">Vragen? Mail Maarten (Pingwin Online Marketing). Deze pagina wordt automatisch bijgewerkt.</p>
    </div>
  );
}

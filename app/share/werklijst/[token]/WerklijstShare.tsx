"use client";

// De pagina voor de bouwer: het ene adres voor alles wat de site in moet.
//
// Hij is twee keer van vorm veranderd, en dat is leerzaam. Eerst stond hier
// alles, met de helft in het rood geblokkeerd: onwerkbaar. Daarna bleef alleen
// een suggestielijst over foto's staan, omdat wij meta's en alt-teksten zelf
// doorzetten. Maar dat kan alleen bij klanten met een WordPress-koppeling; bij
// de rest kreeg de bouwer zijn eigenlijke werk per mail, los van deze pagina.
//
// Nu staat hier per blok wat er te doen is: de goedgekeurde meta-teksten, de
// alt-teksten, en de foto's die beter uniek konden zijn. Wat wij zelf doorvoeren
// verschijnt hier niet, dus wat hij ziet is altijd echt zijn werk.
//
// De lijst zelf komt uit app/_werklijst/WerklijstLijst.tsx, hetzelfde component
// dat de cockpit gebruikt, maar zonder de admin-vlag (dus zonder de knoppen om
// iets rechtstreeks in de site te zetten).

import { useEffect, useState } from "react";
import WerklijstLijst, { type Pagina, type Alt, type Mark, type DubbelItem, type PaginaKlus } from "../../../_werklijst/WerklijstLijst";

export default function WerklijstShare({ token }: { token: string }) {
  const [pages, setPages] = useState<Pagina[]>([]);
  const [images, setImages] = useState<Alt[]>([]);
  const [dubbel, setDubbel] = useState<DubbelItem[]>([]);
  const [paginaklussen, setPaginaklussen] = useState<PaginaKlus[]>([]);
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
      if (d?.ok) { setPages(d.pages || []); setImages(d.images || []); setDubbel(d.dubbel || []); setPaginaklussen(d.paginaklussen || []); setMarks(d.marks || {}); setClientName(d.clientName || ""); }
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
        <p className="wl-intro">Alles wat er op de site moet gebeuren staat hieronder, per soort werk in een eigen blok. Klap een blok open, kopieer de tekst en vink af wat je gedaan hebt. Het is geen spoed en het hoeft niet in één keer. Ben je klaar met de foto&rsquo;s, druk dan op de knop onderaan; dan controleert het dashboard het zelf.</p>
        <label className="wl-naam">Je naam (voor de vinkjes): <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="je voornaam" /></label>
      </div>

      <WerklijstLijst
        pages={pages}
        paginaklussen={paginaklussen}
        images={images}
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

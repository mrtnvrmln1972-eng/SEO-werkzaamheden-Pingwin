"use client";

// Stap 5: interne links naar deze pagina zoeken (achtergrond-analyse, spiegelt
// de cannibalisatiestap) en het voorstel overnemen als Dev-taak met document.
import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../../lib/markdown";
import HelpHint from "../HelpHint";
import Voortgang from "../Voortgang";
import DriveRij from "./DriveRij";
import type { DriveFolder } from "./types";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";

export default function InterneLinksKaart({ slug, url, siteBase, setErr, onApplied, driveFolder, openPicker, ensureDriveMap }: {
  slug: string; url: string; siteBase: string;
  setErr: (v: string) => void; onApplied: (plan?: string) => void;
  driveFolder: DriveFolder | null; openPicker: () => void;
  /** Pas overnemen zodra er een Drive-map is; ontbreekt die, dan klapt de
      mapkiezer open en volgt de actie zodra je kiest. */
  ensureDriveMap: (actie: () => void) => void;
}) {
  // Elke stap is een inklapbare, genummerde kaart (toggle).
  const [linksOpen, setLinksOpen] = useState(false);
  // Per-pagina interne-links-analyse (stap 6, achtergrond) — spiegelt de cannibalisatiestap.
  const [il, setIl] = useState<{ status: string; result: string; error: string; updatedAt: string | null } | null>(null);
  const [ilBusy, setIlBusy] = useState(false);
  const [ilDocOpen, setIlDocOpen] = useState(true);
  async function loadIl() {
    try {
      const d = await fetch(`/api/admin/page-internal-links?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d.ok) setIl({ status: d.status, result: d.result, error: d.error, updatedAt: d.updatedAt });
    } catch { /* stil */ }
  }
  useEffect(() => { loadIl(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, url]);
  useEffect(() => {
    if (il?.status !== "running") return;
    const t = setInterval(loadIl, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [il?.status, slug, url]);
  async function runIl() {
    if (ilBusy || il?.status === "running") return;
    setIlBusy(true);
    setIl((s) => (s ? { ...s, status: "running", error: "" } : { status: "running", result: "", error: "", updatedAt: null }));
    try {
      const d = await fetch("/api/admin/page-internal-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await loadIl(); return; }
      setLinksOpen(true);
      await loadIl();
    } catch { setErr("Starten mislukt."); await loadIl(); } finally { setIlBusy(false); }
  }
  // "Overnemen" bij stap 6: document in de Drive-map + Dev-taak (spiegelt stap 5).
  const [ilApplyBusy, setIlApplyBusy] = useState(false);
  const [ilApplyMsg, setIlApplyMsg] = useState(""); // alleen foutmeldingen
  const [ilApplyInfo, setIlApplyInfo] = useState<{ doc: boolean } | null>(null);
  const [ilDone, setIlDone] = useState(false); // stap 6 afgerond (aanbevelingen overgenomen)
  useEffect(() => {
    try {
      setIlDone(localStorage.getItem(`pw_ildone_${slug}_${url}`) === "1");
      const raw = localStorage.getItem(`pw_ilinfo_${slug}_${url}`);
      setIlApplyInfo(raw ? JSON.parse(raw) : null);
    } catch { /* geen opslag */ }
  }, [slug, url]);
  async function applyIl() {
    if (ilApplyBusy) return;
    setIlApplyBusy(true); setIlApplyMsg("");
    try {
      const d = await fetch("/api/admin/page-internal-links/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setIlApplyMsg(d.error || "Overnemen mislukt."); return; }
      const info = { doc: !!d.docLink };
      setIlApplyInfo(info);
      try { localStorage.setItem(`pw_ilinfo_${slug}_${url}`, JSON.stringify(info)); } catch { /* geen opslag */ }
      setIlDone(true); try { localStorage.setItem(`pw_ildone_${slug}_${url}`, "1"); } catch { /* geen opslag */ }
      onApplied();
    } catch { setIlApplyMsg("Overnemen mislukt."); } finally { setIlApplyBusy(false); }
  }
  const ilHtml = il?.result ? mdToHtml(il.result, siteBase) : "";

  return (
      <div className={"page-chat-links-card step-card step-card-6" + (ilDone ? " done" : "")}>
        <div className="step-head" onClick={() => setLinksOpen((o) => !o)}>
          <span className="step-caret">{linksOpen ? <Omlaag /> : <Uitklap />}</span>
          <span className="step-badge">{ilDone ? "✓" : "5"}</span>
          <span className="step-title">Interne links</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Stap 5 — Interne links (in ontwikkeling)" text={"Interne links sturen bezoekers en autoriteit (linkwaarde) naar de pagina's die het belangrijkst zijn. Deze stap zoekt de beste kansen om vanaf andere pagina's van de site NAAR deze pagina te linken, gerangschikt op wat een link echt waard is. Dit onderdeel wordt nog doorontwikkeld; de kern staat en is bruikbaar.\n## Hoe de kansen worden gewogen\n- **Relevantie is de toegangspoort:** de bronpagina moet het onderwerp raken. Dat wordt gemeten via de overlap tussen de onderwerptermen van deze pagina (titel, plan, top-zoekwoorden, Search Console-queries) en de titel en koppen van elke kandidaat-bron; elke kans krijgt een relevantiescore van 0 tot 100 en onder de 20 valt hij af.\n- **Autoriteit bepaalt de volgorde:** bronpagina's met veel externe verwijzende domeinen (uit Ahrefs) geven de meeste linkwaarde door; dat weegt zwaar in de rangschikking.\n- **Verkeer telt mee:** een bron met veel Search Console-klikken levert naast linkwaarde ook echte doorklikkers.\n## De nuances die vaak fout gaan, hier goed\n- **Menu- en footerlinks tellen niet als bestaande link.** Een link die met dezelfde ankertekst op 60% of meer van de pagina's voorkomt wordt herkend als sitewide navigatie en genegeerd; het gaat om de contextuele link in de lopende tekst. Pagina's die al zo'n contextuele link naar het doel hebben, worden uitgesloten.\n- **Ankertekst-variatie:** per kans wordt een natuurlijke ankertekst voorgesteld (exact, gedeeltelijk of beschrijvend), bewaakt tegen over-optimalisatie doordat het bestaande ankerprofiel van de doelpagina wordt meegewogen.\n## Wat je terugkrijgt\nEen gerangschikte lijst kansen met per bron de onderbouwing (relevantie, verwijzende domeinen, verkeer), de voorgestelde ankertekst en, als WordPress gekoppeld is, een directe bewerk-link naar die pagina in de backend; plaatsen is dan een minuut werk. Overnemen maakt er een net werkdocument en een developer-taak van."} /></span>
        </div>
        {linksOpen && (<div className="step-body">
          <div className="pch-canni-row">
            <span className="pch-canni-lead">Vindt per pagina de beste interne links hiernaartoe, gerangschikt op relevantie, autoriteit (verwijzende domeinen) en verkeer, met ankertekst en een bewerk-link naar de bronpagina.</span>
            <button type="button" className={"btn btn-klein pcd-btn" + (ilBusy || il?.status === "running" ? " busy" : "")} disabled={ilBusy || il?.status === "running"} onClick={runIl} title="Draait op de achtergrond; je kunt wegklikken.">{il?.status === "running" ? "Analyse draait…" : il?.result ? "Opnieuw zoeken" : "Interne links zoeken"}</button>
          </div>
          {il?.status === "error" && il.error && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{il.error}</div>}
          {il?.status === "running" && !il.result && (
            <div style={{ marginTop: "var(--s-3)" }}>
              <Voortgang klein titel="Interne links voor deze pagina" label="De kandidaat-bronpagina's worden gecrawld en gewogen op autoriteit en verkeer." sinds={il.updatedAt} />
            </div>
          )}
          {il?.result && (
            <div className="pch-canni-doc">
              <button type="button" className="pch-canni-toggle" onClick={() => setIlDocOpen((o) => !o)}>{ilDocOpen ? <Omlaag /> : <Uitklap />} Interne-links-voorstel{il.updatedAt ? ` · ${new Date(il.updatedAt).toLocaleString("nl-NL")}` : ""}{il.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
              {ilDocOpen && <div className="md pch-canni-md pch-il-md" dangerouslySetInnerHTML={{ __html: ilHtml }} />}
              {/* Map + overnemen blijven ook zichtbaar als het voorstel is ingeklapt. */}
              <DriveRij folder={driveFolder} legeTekst="nog geen Drive-map, kies er een zodat het taak-document in de juiste map komt" onKies={openPicker} style={{ margin: "var(--s-3) 0 var(--s-2)" }} />
              <div className="pch-canni-apply">
                <button type="button" className={"btn btn-klein pcd-btn pcd-btn-primary" + (ilApplyBusy ? " busy" : "") + (ilDone && !ilApplyBusy ? " pcd-done" : "")} disabled={ilApplyBusy} onClick={() => ensureDriveMap(applyIl)} title="Zet het interne-links-voorstel door als Dev-taak met een begrijpelijk document. Is er nog geen Drive-map gekozen, dan vraagt deze knop er eerst een.">{ilApplyBusy ? "Overnemen…" : ilDone ? "✓ Aanbevelingen overgenomen" : "Aanbevelingen overnemen"}</button>
                {ilApplyInfo && (
                  <div className="pch-apply-panel">
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div>{ilApplyInfo.doc
                        ? <><strong>Dev-taak aangemaakt in Werkzaamheden met een gekoppeld document</strong> (de volledige lijst met interne links en ankerteksten staat daarin).</>
                        : <><strong>Dev-taak aangemaakt in Werkzaamheden zonder document</strong>, er was geen Drive-map gekozen. Kies hierboven een map en neem opnieuw over voor een net taak-document.</>}</div>
                    </div>
                  </div>
                )}
              </div>
              {ilApplyMsg && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{ilApplyMsg}</div>}
            </div>
          )}
        </div>)}
      </div>
  );
}

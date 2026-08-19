"use client";

// Stap 6: structured data (achtergrond-analyse + overnemen), spiegelt stap 5.
// Het sluitstuk: de markup moet kloppen met de zichtbare (nieuwe) tekst.
import { useEffect, useState } from "react";
import { mdToHtml } from "../../../../../lib/markdown";
import HelpHint from "../HelpHint";
import Voortgang from "../Voortgang";
import DriveRij from "./DriveRij";
import type { DriveFolder } from "./types";
import { Omlaag, Uitklap } from "../../../../_ui/Pijl";

export default function StructuredDataKaart({ slug, url, siteBase, setErr, onApplied, driveFolder, openPicker, ensureDriveMap }: {
  slug: string; url: string; siteBase: string;
  setErr: (v: string) => void; onApplied: (plan?: string) => void;
  driveFolder: DriveFolder | null; openPicker: () => void;
  /** Pas overnemen zodra er een Drive-map is; ontbreekt die, dan klapt de
      mapkiezer open en volgt de actie zodra je kiest. */
  ensureDriveMap: (actie: () => void) => void;
}) {
  // Elke stap is een inklapbare, genummerde kaart (toggle).
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [sch, setSch] = useState<{ status: string; result: string; jsonld: string; warnings: string[]; error: string; updatedAt: string | null; stale?: boolean; openCopy?: boolean } | null>(null);
  const [schBusy, setSchBusy] = useState(false);
  const [schDocOpen, setSchDocOpen] = useState(true);
  const [schJsonOpen, setSchJsonOpen] = useState(false);
  const [schCopied, setSchCopied] = useState(false);
  async function loadSch() {
    try {
      const d = await fetch(`/api/admin/page-schema?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (d.ok) setSch({ status: d.status, result: d.result, jsonld: d.jsonld, warnings: d.warnings || [], error: d.error, updatedAt: d.updatedAt, stale: !!d.stale, openCopy: !!d.openCopy });
    } catch { /* stil */ }
  }
  useEffect(() => { loadSch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, url]);
  useEffect(() => {
    if (sch?.status !== "running") return;
    const t = setInterval(loadSch, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sch?.status, slug, url]);
  async function runSch() {
    if (schBusy || sch?.status === "running") return;
    // Structured data is het sluitstuk: de markup moet kloppen met de zichtbare
    // (nieuwe) tekst. Staat er nog een open copy-taak, eerst expliciet bevestigen.
    if (sch?.openCopy && !window.confirm("Let op: er staat nog een niet-afgeronde copy-taak voor deze pagina. De structured data hoort pas gemaakt te worden als de nieuwe teksten (met FAQ's) volledig live op de site staan, anders past de markup straks niet bij de pagina.\n\nWeet je zeker dat de pagina al volledig live staat en je nu wilt analyseren?")) return;
    setSchBusy(true);
    setSch((s2) => (s2 ? { ...s2, status: "running", error: "" } : { status: "running", result: "", jsonld: "", warnings: [], error: "", updatedAt: null }));
    try {
      const d = await fetch("/api/admin/page-schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setErr(d.error || "Starten mislukt."); await loadSch(); return; }
      setSchemaOpen(true);
      await loadSch();
    } catch { setErr("Starten mislukt."); await loadSch(); } finally { setSchBusy(false); }
  }
  async function copySchJson() {
    if (!sch?.jsonld) return;
    try { await navigator.clipboard.writeText(sch.jsonld); setSchCopied(true); setTimeout(() => setSchCopied(false), 2000); } catch { /* selecteer handmatig */ }
  }
  const [schApplyBusy, setSchApplyBusy] = useState(false);
  const [schApplyMsg, setSchApplyMsg] = useState("");
  const [schApplyInfo, setSchApplyInfo] = useState<{ doc: boolean } | null>(null);
  const [schDone, setSchDone] = useState(false);
  useEffect(() => {
    try {
      setSchDone(localStorage.getItem(`pw_schdone_${slug}_${url}`) === "1");
      const raw = localStorage.getItem(`pw_schinfo_${slug}_${url}`);
      setSchApplyInfo(raw ? JSON.parse(raw) : null);
    } catch { /* geen opslag */ }
  }, [slug, url]);
  async function applySch() {
    if (schApplyBusy) return;
    setSchApplyBusy(true); setSchApplyMsg("");
    try {
      const d = await fetch("/api/admin/page-schema/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url }) }).then((r) => r.json());
      if (!d.ok) { setSchApplyMsg(d.error || "Overnemen mislukt."); return; }
      const info = { doc: !!d.docLink };
      setSchApplyInfo(info);
      try { localStorage.setItem(`pw_schinfo_${slug}_${url}`, JSON.stringify(info)); } catch { /* geen opslag */ }
      setSchDone(true); try { localStorage.setItem(`pw_schdone_${slug}_${url}`, "1"); } catch { /* geen opslag */ }
      onApplied();
    } catch { setSchApplyMsg("Overnemen mislukt."); } finally { setSchApplyBusy(false); }
  }

  return (
      <div className={"page-chat-schema-card step-card step-card-7" + (schDone ? " done" : "")}>
        <div className="step-head" onClick={() => setSchemaOpen((o) => !o)}>
          <span className="step-caret">{schemaOpen ? <Omlaag /> : <Uitklap />}</span>
          <span className="step-badge">{schDone ? "✓" : "6"}</span>
          <span className="step-title">Structured data</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Stap 6 — Structured data (in ontwikkeling)" text={"Structured data (schema.org, JSON-LD) vertelt zoekmachines en AI-assistenten in machinetaal wie dit bedrijf is en wat deze pagina is. Deze stap bepaalt per pagina de juiste markup en levert hem kant-en-klaar aan. Ook dit onderdeel wordt nog doorontwikkeld; de basis staat en is al goed bruikbaar.\n## De aanpak: een samenhangende entity graph\n- Geen losse snippets, maar een **@graph** waarin elke pagina met vaste @id's verwijst naar het site-brede identiteitsblok (organisatie en website op de homepage). Elke pagina krijgt sowieso een WebPage- en BreadcrumbList-node; de hoofdentiteit hangt daar via @id aan vast. Zo bouw je een consistente entiteit op in plaats van honderd losse claims.\n- Het **bedrijfstype** uit de bevestigde Bedrijfsgegevens (Klant-tab) bepaalt de keuze: een kliniek krijgt medische markup waarbij de behandelpagina gekoppeld wordt aan de juiste **arts met specialisatie en BIG-nummer** (bij medische onderwerpen hét vertrouwenssignaal voor Google); een webshop productmarkup met prijs, voorraad en retour/verzendinformatie (en nooit Product-markup op een niet-productpagina); een dienstverlener een dienst gekoppeld aan bedrijf en werkgebied; een blog een Article met auteur en datums.\n## De kwaliteitsregels\n- **Niets verzinnen, ooit:** er komt uitsluitend informatie in die zichtbaar op de pagina staat of uit de door jullie bevestigde bedrijfsgegevens komt. Geen verzonnen reviews, prijzen of openingstijden; twijfel betekent weglaten. Dat is precies het verschil tussen markup die vertrouwen opbouwt en markup die een handmatige actie riskeert.\n- **Bestaand plugin-schema wordt gedetecteerd** (Yoast, RankMath en dergelijke) en het advies vult aan zonder te dupliceren: een instantie per type per pagina.\n- **Eerlijk over de opbrengst:** FAQ-rich-results zijn door Google gestopt, dus die worden nergens beloofd; wel worden pagina's met een rijke, kloppende entity graph aantoonbaar vaker geciteerd door AI-assistenten, en de zichtbare content blijft altijd het belangrijkst.\n## De juiste volgorde: sluitstuk na de live copy\nDe gouden regel is dat markup moet kloppen met de zichtbare tekst. Draai deze stap daarom als **sluitstuk**, nadat de nieuwe copy (met FAQ's) live op de site staat. Staat er nog een niet-afgeronde copy-taak voor deze pagina, dan waarschuwt de analyse daar zelf voor.\n## De bewaking daarna\nWordt de pagina later aangepast (een veelgestelde vraag erbij, tekst herschreven, andere openingstijden), dan detecteert het Wijzigingen-tabblad dat en verschijnt hier automatisch een melding dat de structured data opnieuw bekeken moet worden; de markup mag immers nooit achterlopen op de zichtbare content. Ook wanneer een SEO-plugin (Yoast, RankMath) ineens andere schema levert, is dat een moment om deze stap opnieuw te draaien.\n## Wat 'overnemen' oplevert\nDrie dingen tegelijk: een kort uitleg-document voor klant en developer, een **los .json-bestand** dat letterlijk te plakken is (met verwijzing naar Google's Rich Results Test en validator.schema.org voor de controle), en een developer-taak met alle links en eventuele waarschuwingen erbij."} /></span>
        </div>
        {schemaOpen && (<div className="step-body">
          <div className="pch-canni-row">
            <span className="pch-canni-lead">Adviseert de structured data (schema.org) voor deze pagina op basis van het bedrijfstype en de bevestigde bedrijfsgegevens, en levert de kant-en-klare JSON-LD voor de developer.</span>
            <button type="button" className={"btn btn-klein pcd-btn" + (schBusy || sch?.status === "running" ? " busy" : "")} disabled={schBusy || sch?.status === "running"} onClick={runSch} title="Draait op de achtergrond; je kunt wegklikken.">{sch?.status === "running" ? "Analyse draait…" : sch?.result ? "Opnieuw analyseren" : "Analyseer structured data"}</button>
          </div>
          {sch?.stale && (
            <div className="sch-warning" style={{ marginTop: "var(--s-2)" }}>⚠ De pagina is gewijzigd ná de laatste structured data-analyse; de markup past mogelijk niet meer bij de zichtbare content. Draai de analyse opnieuw en geef de developer de nieuwe JSON.</div>
          )}
          {sch?.status === "error" && sch.error && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{sch.error}</div>}
          {sch?.status === "running" && !sch.result && (
            <div style={{ marginTop: "var(--s-3)" }}>
              <Voortgang klein titel="Structured data bekijken" label="De pagina wordt gemeten en het bestaande schema en de bedrijfsgegevens worden gelezen; meestal onder een minuut." sinds={sch.updatedAt} />
            </div>
          )}
          {sch?.result && (
            <div className="pch-canni-doc">
              <button type="button" className="pch-canni-toggle" onClick={() => setSchDocOpen((o) => !o)}>{schDocOpen ? <Omlaag /> : <Uitklap />} Structured data-advies{sch.updatedAt ? ` · ${new Date(sch.updatedAt).toLocaleString("nl-NL")}` : ""}{sch.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
              {schDocOpen && (
                <>
                  {sch.warnings.length > 0 && (
                    <div className="sch-warnings">
                      {sch.warnings.map((w, i) => <div key={i} className="sch-warning">⚠ {w}</div>)}
                    </div>
                  )}
                  <div className="md pch-canni-md" dangerouslySetInnerHTML={{ __html: mdToHtml(sch.result, siteBase) }} />
                  {sch.jsonld && (
                    <div className="sch-json">
                      <div className="sch-json-head">
                        <button type="button" className="pch-canni-toggle" onClick={() => setSchJsonOpen((o) => !o)}>{schJsonOpen ? <Omlaag /> : <Uitklap />} De JSON-LD (voor de developer)</button>
                        <button type="button" className="btn btn-klein" onClick={copySchJson}>{schCopied ? "✓ gekopieerd" : "Kopieer JSON"}</button>
                      </div>
                      {schJsonOpen && <pre className="sch-json-pre">{sch.jsonld}</pre>}
                    </div>
                  )}
                </>
              )}
              <DriveRij folder={driveFolder} legeTekst="nog geen Drive-map, kies er een zodat het document en het .json-bestand in de juiste map komen" onKies={openPicker} style={{ margin: "var(--s-3) 0 var(--s-2)" }} />
              <div className="pch-canni-apply">
                <button type="button" className={"btn btn-klein pcd-btn pcd-btn-primary" + (schApplyBusy ? " busy" : "") + (schDone && !schApplyBusy ? " pcd-done" : "")} disabled={schApplyBusy} onClick={() => ensureDriveMap(applySch)} title="Maakt een kort uitleg-document + los .json-bestand in de Drive-map en één Dev-taak. Is er nog geen map gekozen, dan vraagt deze knop er eerst een.">{schApplyBusy ? "Overnemen…" : schDone ? "✓ Overgenomen" : "Overnemen (document + JSON + taak)"}</button>
                {schApplyInfo && (
                  <div className="pch-apply-panel">
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div><strong>Dev-taak aangemaakt in Werkzaamheden</strong> met het uitleg-document en het losse .json-bestand (de developer plakt die letterlijk in de site).</div>
                    </div>
                  </div>
                )}
              </div>
              {schApplyMsg && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{schApplyMsg}</div>}
            </div>
          )}
        </div>)}
      </div>
  );
}

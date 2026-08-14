"use client";

// Stap 4: cannibalisatie oplossen. De verrijkte analyse-tabel met knoppen per
// rij, de WordPress-koppeling voor de 301's en het overnemen als Dev-taak.
// De logica zit in useCannibalisatie.ts.
import { useState } from "react";
import HelpHint from "../HelpHint";
import Voortgang from "../Voortgang";
import DriveRij from "./DriveRij";
import type { useCannibalisatie } from "./useCannibalisatie";
import type { DriveFolder } from "./types";

export default function CannibalisatieKaart({ canni, driveFolder, openPicker, ensureDriveMap }: {
  canni: ReturnType<typeof useCannibalisatie>;
  driveFolder: DriveFolder | null; openPicker: () => void;
  /** Pas overnemen zodra er een Drive-map is; ontbreekt die, dan klapt de
      mapkiezer open en volgt de actie zodra je kiest. */
  ensureDriveMap: (actie: () => void) => void;
}) {
  const { pc, pcBusy, pcOpen, setPcOpen, runPc, canniHtml, onCanniClick, applyBusy, applyMsg, applyInfo, canniDone, applyRec, wpConf, wpMsg, wpFormOpen, setWpFormOpen, wpForm, setWpForm, wpSaving, saveWpConn, wpRedirects } = canni;
  // Elke stap is een inklapbare, genummerde kaart (toggle).
  const [canniOpen, setCanniOpen] = useState(false);

  return (
      <div className={"page-chat-canni step-card step-card-5" + (canniDone ? " done" : "")}>
        <div className="step-head" onClick={() => setCanniOpen((o) => !o)}>
          <span className="step-caret">{canniOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{canniDone ? "✓" : "4"}</span>
          <span className="step-title">Cannibalisatie oplossen</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Stap 4 — Kannibalisatie oplossen" text={"Kannibalisatie betekent dat meerdere eigen pagina's om dezelfde zoekintentie vechten; Google kan dan niet kiezen en geen van de pagina's haalt zijn potentie. Deze stap brengt dat voor deze pagina volledig in kaart en levert per betrokken pagina een onderbouwde actie.\n## Het principe: GSC is de waarheid, Ahrefs de verrekijker\n- **Search Console bewijst:** splitsen meerdere eigen pagina's de klikken en vertoningen op letterlijk dezelfde zoekopdracht, dan is dat harde kannibalisatie; dit signaal weegt het zwaarst. Per zoekwoord staat er expliciet bij welke andere eigen pagina's Google ook toont.\n- **Ahrefs ontdekt:** waarop rankt deze pagina, welke eigen pagina's ranken op de kernterm, en per beslis-zoekwoord het echte volume plus de complete top-10; ook 'verstopte kapers' worden gevonden, pagina's die je niet verdenkt maar wel op de term ranken.\n- **Nuance ingebouwd:** een blog naast een transactionele pagina met een andere intentie is geen kannibalisatie en wordt niet geflagd; taalvarianten krijgen nooit een redirect-advies maar hreflang.\n## De scheidsrechter per zoekwoord\nVoor elke betwiste term wordt beslist: verdient hij een eigen pagina of hoort hij bij deze pagina geclusterd? Volume rond nul en geen eigen pagina's in de top-10 betekent clusteren; echt volume met eigen pagina's in de top-10 rechtvaardigt een eigen pagina; en tonen twee termen voor meer dan 50% dezelfde top-10-URL's, dan is het een intentie en dus een pagina.\n## Wie wint, en hoe zeker is het\n- Elke betrokken pagina krijgt een **kannibalisatiescore van 1 tot 100**: bewezen kliksplitsing in GSC scoort 70-100, ranken op de kernterm zonder splitsing 40-69, alleen thematische overlap 10-39, eigen intentie 1-9.\n- De **winnaar-weging** is expliciet, in volgorde: verwijzende domeinen (zwaarst, dat is opgebouwde autoriteit die je nooit weggooit), dan organische tractie, businesswaarde, content-diepte en URL-kwaliteit. En bij twijfel wint de bedoelde eigenaar volgens het plan; nooit blind de toevallige beste ranker.\n## Van advies naar uitgevoerd werk\nPer pagina komt er een actie uit een vaste beslisboom: niets doen, interne links herverdelen, content differentiëren, canonical, samenvoegen met 301, of de-indexeren. Jij beoordeelt elke rij (uitvoeren, afwijzen, als taak doorzetten); pas dan worden het developer-taken met werkdocument. De 301's worden daarna **live geverifieerd**: de taak gaat pas op Klaar als elke redirect echt werkt."} /></span>
        </div>
        {canniOpen && (<div className="step-body">
        <div className="pch-canni-row">
          <span className="pch-canni-lead">Brengt per zoekwoord in kaart (top-10 + volume) of het een eigen pagina verdient of naar deze pagina geclusterd wordt, en welke pagina&rsquo;s deze pagina kapen, met de actie per pagina.</span>
          <button type="button" className={"pcd-btn" + (pcBusy || pc?.status === "running" ? " busy" : "")} disabled={pcBusy || pc?.status === "running"} onClick={runPc} title="Draait op de achtergrond met echte Ahrefs-data; je kunt wegklikken.">{pc?.status === "running" ? "Analyse draait…" : pc?.result ? "Opnieuw analyseren" : "Cannibalisatie oplossen"}</button>
        </div>
        {pc?.status === "error" && pc.error && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{pc.error}</div>}
        {pc?.status === "running" && !pc.result && (
          <div style={{ marginTop: "var(--s-3)" }}>
            <Voortgang klein titel="Cannibalisatie-analyse" label="Per pagina de Ahrefs-zoekwoorden en de top 10 verzamelen; dit duurt een paar minuten." sinds={pc.updatedAt} />
          </div>
        )}
        {pc?.result && (
          <div className="pch-canni-doc">
            <button type="button" className="pch-canni-toggle" onClick={() => setPcOpen((o) => !o)}>{pcOpen ? "▾" : "▸"} Cannibalisatie- &amp; content-mapping-analyse{pc.updatedAt ? ` · ${new Date(pc.updatedAt).toLocaleString("nl-NL")}` : ""}{pc.status === "running" ? " · nieuwe analyse draait…" : ""}</button>
            {pcOpen && (<>
              <div className="md pch-canni-md" onClick={onCanniClick} dangerouslySetInnerHTML={{ __html: canniHtml }} />
              {wpRedirects.length > 0 && (!wpConf?.configured || wpFormOpen || wpMsg) && (
                <div className="pch-wp-foot">
                  {!wpConf?.configured && !wpFormOpen && <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>Redirects uitvoeren vereist de WordPress-koppeling. <button type="button" className="ghost-btn small" onClick={() => setWpFormOpen(true)}>WordPress koppelen</button></span>}
                  {wpFormOpen && (
                    <div className="pch-wp-form">
                      <input type="text" placeholder="WordPress-gebruikersnaam" value={wpForm.user} onChange={(e) => setWpForm((f) => ({ ...f, user: e.target.value }))} autoComplete="off" />
                      <input type="password" placeholder="Application password" value={wpForm.pass} onChange={(e) => setWpForm((f) => ({ ...f, pass: e.target.value }))} autoComplete="new-password" />
                      <button type="button" className="pcd-btn" disabled={wpSaving} onClick={saveWpConn}>{wpSaving ? "Opslaan…" : "Koppeling opslaan"}</button>
                    </div>
                  )}
                  {wpMsg && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{wpMsg}</div>}
                </div>
              )}
            </>)}
            {/* Map + overnemen blijven ook zichtbaar als de analyse is ingeklapt. */}
            <DriveRij folder={driveFolder} legeTekst="nog geen Drive-map, kies er een zodat het taak-document in de juiste map komt" onKies={openPicker} style={{ margin: "var(--s-3) 0 var(--s-2)" }} />
            <div className="pch-canni-apply">
              <button type="button" className={"pcd-btn pcd-btn-primary" + (applyBusy ? " busy" : "") + (canniDone && !applyBusy ? " pcd-done" : "")} disabled={applyBusy} onClick={() => ensureDriveMap(applyRec)} title="Zet de redirects + interne links door als Dev-taak met document, en de de-optimalisatie-info als basis naar de betreffende pagina's. Is er nog geen map gekozen, dan vraagt deze knop er eerst een.">{applyBusy ? "Overnemen…" : canniDone ? "✓ Aanbevelingen overgenomen" : "Aanbevelingen overnemen"}</button>
              {applyInfo && (
                <div className="pch-apply-panel">
                  <div className="pch-apply-row">
                    <span className="pch-apply-ico">✓</span>
                    <div>{applyInfo.doc
                      ? <><strong>Dev-taak aangemaakt in Werkzaamheden met een gekoppeld document</strong> (de volledige lijst met redirects en interne links staat daarin).</>
                      : <><strong>Dev-taak aangemaakt in Werkzaamheden zonder document</strong>, er was geen Drive-map gekozen. Kies hierboven een map en neem opnieuw over voor een net taak-document.</>}</div>
                  </div>
                  {applyInfo.counts && (<>
                    <hr className="pch-apply-hr" />
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div>
                        <strong>Opgeleverd op basis van jouw beoordeling:</strong> {applyInfo.counts.executed} doorgevoerd, {applyInfo.counts.deferred} naar pagina&rsquo;s geschoven, {applyInfo.counts.rejected} afgewezen (met reden in het document){applyInfo.counts.unreviewed > 0 ? `, ${applyInfo.counts.unreviewed} niet beoordeeld (buiten het document gelaten)` : ""}.
                      </div>
                    </div>
                  </>)}
                  {applyInfo.urls.length > 0 && (<>
                    <hr className="pch-apply-hr" />
                    <div className="pch-apply-row">
                      <span className="pch-apply-ico">✓</span>
                      <div>
                        <strong>Basisinfo doorgezet naar {applyInfo.urls.length} gelieerde pagina{applyInfo.urls.length === 1 ? "" : "'s"}</strong>:
                        <ul>{applyInfo.urls.map((u) => { let p = u; try { p = new URL(u).pathname || u; } catch { /* pad niet te bepalen */ } return <li key={u}>{p}</li>; })}</ul>
                      </div>
                    </div>
                  </>)}
                </div>
              )}
            </div>
            {applyMsg && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{applyMsg}</div>}
          </div>
        )}
        </div>)}
      </div>
  );
}

"use client";

// Stap 3: de vervolgstappen op de strategie (analyse-, blauwdruk- en
// copy-document, los of achter elkaar, met de achtergrond-run-status).
// De run zelf leeft in useDocumentenRun.ts.
import { useState } from "react";
import HelpHint from "../HelpHint";
import Voortgang from "../Voortgang";
import DriveRij from "./DriveRij";
import { isPoortBlokkade } from "../../../../../lib/keten-poort-melding";
import type { useDocumentenRun } from "./useDocumentenRun";
import type { DriveFolder } from "./types";

export default function VervolgstappenKaart({ slug, url, docRun, lastAssistant, stepsDone, allStepsDone, pageLive, driveFolder, openPicker, nuance, setNuance, ensureFolderThenRun }: {
  slug: string; url: string;
  docRun: ReturnType<typeof useDocumentenRun>;
  lastAssistant: string;
  stepsDone: Record<string, boolean>; allStepsDone: boolean;
  pageLive?: boolean;
  driveFolder: DriveFolder | null; openPicker: () => void;
  nuance: string; setNuance: (v: string) => void;
  ensureFolderThenRun: (steps: string[], audience?: "intern" | "klant") => void;
}) {
  const { run, setRun, runBusy, everLinks } = docRun;
  const [vervolgOpen, setVervolgOpen] = useState(false);

  return (
      <div className={"page-chat-docs step-card step-card-4" + (allStepsDone ? " done" : "")}>
          <div className="step-head" onClick={() => setVervolgOpen((o) => !o)}>
            <span className="step-caret">{vervolgOpen ? "▾" : "▸"}</span>
            <span className="step-badge">{allStepsDone ? "✓" : "3"}</span>
            <span className="step-title">Vervolgstappen op de strategie</span>
            <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Stap 3 — Documenten (analyse, blauwdruk, copy)" text={"De vastgelegde strategie wordt hier uitgewerkt tot drie documenten die bewust op elkaar voortbouwen: eerst vaststellen waar de pagina staat (**analyse**), dan bepalen hoe hij eruit moet komen te zien (**blauwdruk**), en pas daarna de tekst schrijven (**copy**). Elke stap leest het resultaat van de vorige, dus de copy staat nooit los van de analyse die eraan voorafging. Alles draait op de achtergrond, landt als net Pingwin-document in de Drive-klantmap en wordt automatisch een afgeronde werkzaamheid.\n## De SEO-analyse: eerst eerlijk meten waar de pagina staat\nDe analyse verzamelt eerst alle feiten, uit vier bronnen:\n- **De pagina zelf**, echt uitgelezen en doorgemeten: koppen, meta-title en -description, woordenaantal, zoekwoorddichtheid, FAQ en aanwezige structured data.\n- **Search Console** (90 dagen): op welke zoekwoorden de pagina rankt, met klikken en vertoningen.\n- **PageSpeed**: de laadsnelheid en Core Web Vitals.\n- **Ahrefs**: de top-10 van het primaire zoekwoord, met de autoriteit van elke concurrent; de drie best scorende concurrenten worden individueel uitgemeten.\nDaarmee wordt de pagina beoordeeld tegen een vaste set meetbare criteria, van zoekintentie tot koppenstructuur en E-E-A-T. De pagina krijgt een **hard eindoordeel**: geslaagd bij nul kritieke gebreken, hooguit twee grote, en een score van minimaal 85.\n__Behoud is het uitgangspunt:__ de analyse benoemt expliciet wat er goed is en moet blijven staan. Bestaande rankings zijn opgebouwde waarde; die bescherm je door alleen te veranderen wat aantoonbaar tekortschiet.\n## De blauwdruk: de bouwtekening, gebaseerd op wie er nu wint\nDe blauwdruk vertaalt de analyse naar een concrete paginastructuur, gebaseerd op de **top-10 van het gekozen zoekwoord**. Omdat de winnaars echt zijn uitgemeten, is bekend welke invalshoeken zij behandelen, hoe lang hun pagina's zijn en welke vragen zij beantwoorden. De blauwdruk schrijft voor:\n- **Welke koppen en secties** de pagina nodig heeft om de dekking van de winnaars te evenaren.\n- __Wat de pagina uniek maakt:__ de invalshoek die de concurrenten laten liggen; de reden waarom Google jóu in die top-10 zet in plaats van een kopie van nummer drie.\n- **Meetbare normen:** het zoekwoord in 60-80% van de koppen (doel 70%; daarboven telt het als stuffing), een plaatsnaam in hooguit 2 à 3 koppen, meta-title 50-60 tekens met het zoekwoord vooraan, en een FAQ van 4-6 vragen op de echte zoekintentie.\n- **Een variantenlijst** van 10-15 semantische termen die de copy moet verwerken.\n## De copy: de volledige tekst, met behoud van wat al goed is\nDe copy-stap schrijft de daadwerkelijke, complete paginatekst uit; geen samenvatting of advies, maar tekst die zo de site op kan.\n__Het principe dat het verschil maakt met een tekstrobot:__ de bestaande tekst van de pagina gaat als bron mee, en alles wat voldoet aan de criteria wordt **zoveel mogelijk behouden of hergebruikt**. Goede zinnen, kloppende alinea's en werkende koppen blijven staan; er wordt alleen geschreven wat ontbreekt of aantoonbaar beter moet. Zo wordt een pagina die al deels rankt nooit platgewalst door een volledig nieuwe tekst.\nDe nieuwe tekst volgt de blauwdruk sectie voor sectie:\n- **6 tot 9 inhoudelijke secties** met volle alinea's van 80-150 woorden.\n- Het **primaire zoekwoord in de eerste 100 woorden**, een natuurlijke dichtheid van 0,5-2%, en minstens 60% van de varianten verwerkt.\n- Een **uitgebreide FAQ** van 6-8 vragen met echte antwoorden van 40-80 woorden, gericht op long-tail-zoekers.\n- De **tone of voice uit het klantprofiel**, zodat de tekst klinkt als dit bedrijf.\n- Een **automatische nacontrole** op de koppen, die te veel herhaling van een naam of plaatsnaam detecteert en herschrijft.\n## Waarom deze volgorde werkt\nElke stap dwingt de kwaliteit van de volgende af: zonder analyse zou de blauwdruk gokken wat er mis is, en zonder blauwdruk zou de copy structuurloos worden geschreven. Doordat alles teruggrijpt op de vastgelegde strategie uit stap 1, bewaakt de keten dat de pagina precies de rol vervult die is afgesproken. Standaard krijg je de korte **klantversie**; onder elke stap kun je ook de uitgebreide **interne versie** laten maken, met de volledige scorecard en onderbouwing."} /></span>
          </div>
          {vervolgOpen && (
          !lastAssistant ? <div className="step-body muted" style={{ fontSize: "var(--fs-sm)" }}>Werk eerst de strategie uit in de chat (stap 2) en leg hem vast; daarna maak je hier de analyse, blauwdruk en copy.</div> : (<div className="step-body">
          <DriveRij folder={driveFolder} legeTekst="nog geen Drive-map, je kiest hem zodra je op een knop hieronder klikt" onKies={openPicker} style={{ margin: "var(--s-1) 0 var(--s-4)" }} />
          <input className="pcd-nuance" value={nuance} onChange={(e) => setNuance(e.target.value)} placeholder="Extra sturing (optioneel), bijv. leg de nadruk op de regio, of behoud de tarieventabel." />
          <div className="pcd-docs-buttons">
            <div className="pcd-step">
              <button type="button" className={"pcd-btn" + (stepsDone.analyse ? " pcd-btn-done" : "")} onClick={() => ensureFolderThenRun(["analyse"])} disabled={runBusy || pageLive === false} title={pageLive === false ? "Deze pagina bestaat nog niet live, dus er valt nog niets te analyseren. Blauwdruk en copy kunnen wel." : "Draait op de achtergrond door; wegklikken mag."}>{stepsDone.analyse ? "✓ 1. Analyse-document" : "1. Analyse-document"}</button>
              <button type="button" className="pcd-step-intern" onClick={() => ensureFolderThenRun(["analyse"], "intern")} disabled={runBusy || pageLive === false} title="Maakt de uitgebreide interne/technische versie van deze stap (op verzoek; ~3x zo lang). Voor eigen inzicht. Niet klant-zichtbaar.">Interne / uitgebreide versie</button>
            </div>
            <div className="pcd-step">
              <button type="button" className={"pcd-btn" + (stepsDone.blauwdruk ? " pcd-btn-done" : "")} onClick={() => ensureFolderThenRun(["blauwdruk"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">{stepsDone.blauwdruk ? "✓ 2. Blauwdruk-document" : "2. Blauwdruk-document"}</button>
              <button type="button" className="pcd-step-intern" onClick={() => ensureFolderThenRun(["blauwdruk"], "intern")} disabled={runBusy} title="Maakt de uitgebreide interne/technische versie van deze stap (op verzoek; ~3x zo lang). Voor eigen inzicht. Niet klant-zichtbaar.">Interne / uitgebreide versie</button>
            </div>
            <div className="pcd-step">
              <button type="button" className={"pcd-btn" + (stepsDone.copy ? " pcd-btn-done" : "")} onClick={() => ensureFolderThenRun(["copy"])} disabled={runBusy} title="Draait op de achtergrond door; wegklikken mag.">{stepsDone.copy ? "✓ 3. Copy-document" : "3. Copy-document"}</button>
              <button type="button" className="pcd-step-intern" onClick={() => ensureFolderThenRun(["copy"], "intern")} disabled={runBusy} title="Maakt de uitgebreide interne/technische versie van deze stap (op verzoek; ~3x zo lang). Voor eigen inzicht. Niet klant-zichtbaar.">Interne / uitgebreide versie</button>
            </div>
            <div className="pcd-step">
              <button type="button" className={"pcd-btn " + (allStepsDone ? "pcd-btn-done" : "pcd-btn-primary") + (runBusy ? " busy" : "")} onClick={() => ensureFolderThenRun(pageLive === false ? ["blauwdruk", "copy"] : ["analyse", "blauwdruk", "copy"])} disabled={runBusy} title={pageLive === false ? "Deze pagina bestaat nog niet live: de analyse wordt overgeslagen, alleen blauwdruk en copy draaien." : "Draait de drie stappen op de achtergrond door; wegklikken mag."}>{runBusy ? "Starten…" : allStepsDone ? "✓ Alles klaar" : pageLive === false ? "Blauwdruk + copy (2 → 3)" : "Alles achter elkaar (1 → 2 → 3)"}</button>
            </div>
          </div>
          <div className="muted pcd-docs-note">Draait op de achtergrond, wegklikken mag. Eén korte klantversie die jij, de developer én de klant lezen. Tip: kies eerst een Drive-map.</div>

          {run && (
            <div className="pcd-run-inline">
              <div className="pcd-run-line">
                {(["analyse", "blauwdruk", "copy"] as const).filter((k) => run.steps[k] !== "skipped" || everLinks[k]).map((k) => {
                  const nm = k === "analyse" ? "Analyse" : k === "blauwdruk" ? "Blauwdruk" : "Copy";
                  // Een overgeslagen stap met een document uit een eerdere run telt
                  // gewoon als 'klaar'; en een stap die op 'bezig' stond toen de run
                  // stopte, toont 'gestopt' in plaats van een liegend 'bezig…'.
                  const st = run.steps[k] === "skipped" ? "klaar"
                    : run.steps[k] === "done" ? "klaar"
                      : run.steps[k] === "running" ? (run.status === "running" ? "bezig…" : "gestopt")
                        : run.steps[k] === "error" ? "fout"
                          : run.status === "running" ? "wacht" : "niet gedaan";
                  const link = run.links[k] || everLinks[k];
                  return (
                    <span key={k} className={"pcd-run-item " + (run.steps[k] === "skipped" ? "done" : run.steps[k] || "pending")}>
                      <strong>{nm}</strong> {st}{link && <> · <a href={link} target="_blank" rel="noreferrer">document</a></>}
                    </span>
                  );
                })}
              </div>
              {run.status === "running" && (() => {
                // Het rondje loopt mee met de stappen die deze run echt doet;
                // overgeslagen stappen tellen niet mee, anders blijft hij hangen.
                const stappen = (["analyse", "blauwdruk", "copy"] as const).filter((k) => run.steps[k] !== "skipped");
                const klaar = stappen.filter((k) => run.steps[k] === "done").length;
                const bezig = stappen.find((k) => run.steps[k] === "running");
                return (
                  <div style={{ marginTop: "var(--s-3)" }}>
                    <Voortgang
                      klein
                      titel="Documenten schrijven"
                      label={bezig ? `Bezig met de ${bezig}` : "De volgende stap wordt opgestart"}
                      stap={klaar + (bezig ? 1 : 0)}
                      stappen={stappen.length}
                      sinds={run.updatedAt || null}
                    />
                  </div>
                );
              })()}
              {run.status === "running" && (
                <div className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-1)", display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
                  <span>Loopt server-side door; wegklikken mag. Verschijnt ook als werkzaamheid.</span>
                  <button type="button" className="ghost-btn small"
                    title="Stop deze run direct. Alles wat nog niet af is wordt weggegooid: er wordt niets opgeslagen en er belandt geen half document in Drive."
                    onClick={async () => {
                      await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
                      const s = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((x) => x.json()).catch(() => null);
                      if (s?.ok) setRun(s.run);
                    }}>&times; Stoppen (niets opslaan)</button>
                </div>
              )}
              {/* Zelfde uitweg als op de projectkaart: liep de run vast op de
                  keten-poort, dan staat de knop om die controle één keer over
                  te slaan er direct bij. Een poort zonder deur betekent stilstand
                  tot iemand code aanpast, en dat is hier vier keer gebeurd. */}
              {run.status === "error" && run.error && (
                <div className="login-error" style={{ marginTop: "var(--s-2)" }}>
                  {run.error}
                  {isPoortBlokkade(run.error) && (() => {
                    const open = (["analyse", "blauwdruk", "copy"] as const).filter((k) => run.steps[k] === "error" || run.steps[k] === "pending");
                    if (!open.length) return null;
                    return (
                      <div className="pnl-acties-groep" style={{ marginTop: "var(--s-2)" }}>
                        <button type="button" className="btn btn-ghost btn-klein" disabled={docRun.runBusy}
                          title="Sla deze controle één keer over en genereer de openstaande stappen alsnog"
                          onClick={() => void docRun.startBackgroundRun([...open], undefined, "klant", true)}>
                          Toch genereren
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          </div>))}
        </div>
  );
}

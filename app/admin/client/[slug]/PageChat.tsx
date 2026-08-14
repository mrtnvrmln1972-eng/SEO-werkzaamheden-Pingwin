"use client";

// Het chatscherm van de paginakaart: de zes stappen van één pagina (strategie,
// doorgeven, documenten, cannibalisatie, interne links, structured data).
//
// Dit bestand is alleen nog het karkas: het zet de stap-kaarten in de goede
// volgorde en houdt vast wat twee of meer stappen samen gebruiken (de Drive-map,
// de fout- en meldingsregel, de klaar-standen uit de database en de
// browseropslag). Elke stap woont in pagina-chat/, zodat twee chats die aan
// verschillende stappen werken elkaar niet meer in de weg zitten; dat was met
// 1.660 regels in één bestand onvermijdelijk (zelfde ingreep als bij de
// projectkaart, zie weekplan-kaart/).

import { useEffect, useState } from "react";
import PageSummaryCard from "./PageSummaryCard";
import DriveMapKiezer from "./DriveMapKiezer";
import MeegegevenAdvies from "./pagina-chat/MeegegevenAdvies";
import StrategieKaart from "./pagina-chat/StrategieKaart";
import DoorgevenKaart from "./pagina-chat/DoorgevenKaart";
import VervolgstappenKaart from "./pagina-chat/VervolgstappenKaart";
import CannibalisatieKaart from "./pagina-chat/CannibalisatieKaart";
import AfwijsVenster from "./pagina-chat/AfwijsVenster";
import CheckVenster from "./pagina-chat/CheckVenster";
import InterneLinksKaart from "./pagina-chat/InterneLinksKaart";
import StructuredDataKaart from "./pagina-chat/StructuredDataKaart";
import { useStrategieChat } from "./pagina-chat/useStrategieChat";
import { useDocumentenRun } from "./pagina-chat/useDocumentenRun";
import { useCannibalisatie } from "./pagina-chat/useCannibalisatie";
import type { DriveFolder } from "./pagina-chat/types";

// Markeert een HTML-string als vertrouwd: zelf opgebouwd uit onze eigen tekst en
// server-velden (Drive-map, documentlink), nooit AI- of gebruikerstekst. Geen
// markdown om te renderen en niets om te ontsmetten; deze functie doet dus
// bewust niets, ze zegt alleen "dit is geen invoer van buiten".
function eigenHtml(html: string): string { return html; }

export default function PageChat({ slug, url, clientEmail, clientName, onApplied, onGoToTask, onClusterApplied, pageLive, planSlot, planDone }: { slug: string; url: string; clientEmail?: string; clientName?: string; onApplied: (plan?: string) => void; onGoToTask?: (taskId: number) => void; onClusterApplied?: () => void; pageLive?: boolean; planSlot?: React.ReactNode; planDone?: boolean }) {
  // Site-URL van de klant (uit de pagina-URL), zodat slugs als /lensimplantatie/
  // in alle gerenderde teksten klikbaar naar de live pagina linken.
  const siteBase = (url.match(/^https?:\/\/[^/]+/i) || [""])[0];
  // De strategie-kaart (stap 1) staat open zolang er nog geen strategie is
  // vastgelegd (daar begint het werk); daarna standaard dicht (scheelt scrollen).
  const [chatOpen, setChatOpen] = useState(!planDone);
  // Teller die de korte samenvatting-kaart laat verversen zodra er een nieuwe
  // strategie is vastgelegd (via 'Vat samen & leg strategie vast').
  const [summaryAutoGen, setSummaryAutoGen] = useState(0);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState("");
  // Cluster-advies doorgeven aan betrokken pagina's (null = nog niet gezocht).
  // Leeft hier omdat de chat (nieuwe chat, nieuwe vraag) hem ook leegmaakt.
  const [clusterItems, setClusterItems] = useState<{ url: string; advice: string }[] | null>(null);
  const [clusterMsg, setClusterMsg] = useState("");
  // Aantal pagina's waaraan het advies is doorgegeven (>0 = knop wordt groen "doorgegeven").
  const [clusterDone, setClusterDone] = useState(0);
  // Welke pagina's advies kregen vanuit deze pagina. De melding na het starten
  // verdween, waardoor het leek alsof er niets was gebeurd.
  const [gelieerdeUrls, setGelieerdeUrls] = useState<{ url: string; wanneer: string | null }[]>([]);
  // Per-stap "klaar"-status (groene knop), per pagina onthouden en gevoed door de run.
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>({});
  const allStepsDone = !!(stepsDone.analyse && stepsDone.blauwdruk && stepsDone.copy);
  // Analyse vastgelegd (taak + document) → knop wordt groen "Analyse vastgelegd".
  const [taskDone, setTaskDone] = useState(false);

  // Groene "klaar"-status onthouden (browseropslag), beide per pagina zodat ze groen
  // blijven na heropenen. Doorgeven wordt gewist bij een nieuwe chat (weer oranje).
  // De chat-kaart staat ALTIJD standaard dicht (bewuste keuze); alleen de klaar-statussen
  // worden hier hersteld.
  useEffect(() => {
    let stratD = false, clusterN = 0;
    try { stratD = localStorage.getItem(`pw_stratdone_${slug}_${url}`) === "1"; } catch { /* geen opslag */ }
    try { const n = Number(localStorage.getItem(`pw_clusterdone_${slug}_${url}`) || "0"); clusterN = Number.isFinite(n) ? n : 0; } catch { clusterN = 0; }
    setTaskDone(stratD); setClusterDone(clusterN);
    try { const sd: Record<string, boolean> = {}; (["analyse", "blauwdruk", "copy"] as const).forEach((k) => { if (localStorage.getItem(`pw_stepdone_${slug}_${url}_${k}`) === "1") sd[k] = true; }); setStepsDone(sd); } catch { setStepsDone({}); }
    // De browser is niet de waarheid. Hierboven staat alleen wat dit apparaat nog
    // wist; de echte stand komt uit de database, dezelfde bron als de weekplan-kaart.
    // Zonder dit stond alles op een andere computer weer op nul, ook al was het werk
    // gedaan, en zei de kaart iets anders dan dit scherm over dezelfde pagina.
    let leeft = true;
    fetch(`/api/admin/page-stand?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!leeft || !d?.ok) return;
        const st = d.stand as { strategie?: boolean; gelieerde?: boolean; analyse?: boolean; blauwdruk?: boolean; copy?: boolean } | null;
        if (st) {
          if (st.strategie) setTaskDone(true);
          const sd: Record<string, boolean> = {};
          (["analyse", "blauwdruk", "copy"] as const).forEach((k) => { if (st[k]) sd[k] = true; });
          if (Object.keys(sd).length) setStepsDone((v) => ({ ...v, ...sd }));
        }
        const lijst = (d.gelieerdeUrls || []) as { url: string; wanneer: string | null }[];
        setGelieerdeUrls(lijst);
        if (lijst.length) setClusterDone((n) => Math.max(n, lijst.length));
      })
      .catch(() => { /* de browser-stand blijft dan staan */ });
    return () => { leeft = false; };
  }, [slug, url]);

  const [driveFolder, setDriveFolder] = useState<DriveFolder | null>(null);
  // Stappen die na het kiezen van een Drive-map (pop-up) alsnog moeten draaien.
  const [pendingRun, setPendingRun] = useState<{ steps: string[]; audience: "intern" | "klant" } | null>(null);
  // Generieke variant voor elke andere actie die een document maakt (strategie
  // vastleggen, interne links overnemen, structured data overnemen, cannibalisatie
  // overnemen): ontbreekt de map, dan klapt de kiezer open en volgt de actie zodra
  // je kiest. Alle documenten van deze pagina horen in dezelfde map te landen; geen
  // van deze knoppen maakt nog een document zonder gekozen bestemming.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  function ensureDriveMap(actie: () => void) {
    if (driveFolder) { actie(); return; }
    setPendingAction(() => actie);
    openPicker();
  }
  const [nuance, setNuance] = useState("");

  // ── Google Drive bestemmingsmap (het venster zelf is DriveMapKiezer) ──
  const [pickerOpen, setPickerOpen] = useState(false);

  // Bij laden: toon de eventueel al gekozen map (lichte call, geen Drive-lijst).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/drive/folders?chosenOnly=1&slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok && d.chosen) setDriveFolder({ id: d.chosen.folderId, name: d.chosen.folderName, path: d.chosen.folderPath }); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [slug, url]);

  // Het kiezen zelf (bladeren, submap maken, opslaan) zit in DriveMapKiezer;
  // hier alleen openen en de keuze overnemen.
  function openPicker() { setPickerOpen(true); }

  const docRun = useDocumentenRun({ slug, url, driveFolder, nuance, setErr, setStepsDone });

  // Vraagt eerst een Drive-map (pop-up) als er nog geen gekozen is, en start dan de run,
  // zodat je altijd weet waar het document terechtkomt. Is er al een map, dan draait hij direct.
  function ensureFolderThenRun(steps: string[], audience: "intern" | "klant" = "klant") {
    if (docRun.runBusy) return;
    if (driveFolder) { docRun.startBackgroundRun(steps, undefined, audience); return; }
    setPendingRun({ steps, audience });
    openPicker();
  }

  const chat = useStrategieChat({ slug, url, siteBase, planDone, onApplied, onGoToTask, driveFolder, nuance, taskDone, setTaskDone, clusterDone, setClusterDone, setChatOpen, setErr, setApplied, setSummaryAutoGen, setClusterItems, setClusterMsg });
  const canni = useCannibalisatie({ slug, url, siteBase, onApplied, setErr });

  return (
    <div className="page-chat-wrap">
      <PageSummaryCard slug={slug} url={url} planDone={!!(planDone || taskDone)} autoGenSignal={summaryAutoGen} />
      <MeegegevenAdvies slug={slug} url={url} siteBase={siteBase} />
      <StrategieKaart chat={chat} url={url} siteBase={siteBase}
        chatOpen={chatOpen} setChatOpen={setChatOpen}
        planDone={planDone} planSlot={planSlot} taskDone={taskDone}
        driveFolder={driveFolder} setDriveFolder={setDriveFolder} openPicker={openPicker} ensureDriveMap={ensureDriveMap} />

      {applied && <div className="saved-msg" style={{ marginTop: "var(--s-2)" }} dangerouslySetInnerHTML={{ __html: eigenHtml(applied) }} />}
      {err && <div className="login-error" style={{ marginTop: "var(--s-2)" }}>{err}</div>}

      <DoorgevenKaart slug={slug} url={url} siteBase={siteBase}
        lastAssistant={chat.lastAssistant} taskDone={taskDone} setChatOpen={setChatOpen}
        setErr={setErr} onClusterApplied={onClusterApplied}
        clusterDone={clusterDone} setClusterDone={setClusterDone}
        clusterItems={clusterItems} setClusterItems={setClusterItems}
        clusterMsg={clusterMsg} setClusterMsg={setClusterMsg}
        gelieerdeUrls={gelieerdeUrls} />

      <VervolgstappenKaart slug={slug} url={url} docRun={docRun}
        lastAssistant={chat.lastAssistant} stepsDone={stepsDone} allStepsDone={allStepsDone}
        pageLive={pageLive} driveFolder={driveFolder} openPicker={openPicker}
        nuance={nuance} setNuance={setNuance} ensureFolderThenRun={ensureFolderThenRun} />

      <CannibalisatieKaart canni={canni} driveFolder={driveFolder} openPicker={openPicker} ensureDriveMap={ensureDriveMap} />

      <AfwijsVenster canni={canni} />
      <CheckVenster canni={canni} siteBase={siteBase} />

      <InterneLinksKaart slug={slug} url={url} siteBase={siteBase}
        setErr={setErr} onApplied={onApplied} driveFolder={driveFolder} openPicker={openPicker} ensureDriveMap={ensureDriveMap} />

      <StructuredDataKaart slug={slug} url={url} siteBase={siteBase}
        setErr={setErr} onApplied={onApplied} driveFolder={driveFolder} openPicker={openPicker} ensureDriveMap={ensureDriveMap} />

      <DriveMapKiezer slug={slug} url={url} open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPendingRun(null); setPendingAction(null); }}
        onChosen={(f) => {
          setDriveFolder(f); setPickerOpen(false);
          if (pendingRun) { const pr = pendingRun; setPendingRun(null); docRun.startBackgroundRun(pr.steps, f.id, pr.audience); }
          if (pendingAction) { const actie = pendingAction; setPendingAction(null); actie(); }
        }} />
    </div>
  );
}

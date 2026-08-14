"use client";

// Stap 1: de strategie-kaart. De vastgelegde strategie (planSlot) bovenin, de
// lijst met eerdere chats eronder, en per chat het gesprek zelf met de
// vastleg-knoppen. De staat en de serverkant zitten in useStrategieChat.ts.
import { eersteKop } from "../../../../../lib/chat-vouw";
import HelpHint from "../HelpHint";
import Bronnenstrip from "../Bronnenstrip";
import DriveRij from "./DriveRij";
import type { useStrategieChat } from "./useStrategieChat";
import type { DriveFolder } from "./types";

export default function StrategieKaart({ chat, url, siteBase, chatOpen, setChatOpen, planDone, planSlot, taskDone, driveFolder, setDriveFolder, openPicker, ensureDriveMap }: {
  chat: ReturnType<typeof useStrategieChat>;
  url: string; siteBase: string;
  chatOpen: boolean; setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  planDone?: boolean; planSlot?: React.ReactNode; taskDone: boolean;
  driveFolder: DriveFolder | null; setDriveFolder: (f: DriveFolder | null) => void; openPicker: () => void;
  /** Pas de strategie vastleggen (en het document maken) zodra er een
      Drive-map is; ontbreekt die, dan klapt de mapkiezer open en volgt de
      actie zodra je kiest. Alle documenten van deze pagina horen in dezelfde
      map te landen. */
  ensureDriveMap: (actie: () => void) => void;
}) {
  const { msgs, chats, chatId, convoOpen, setConvoOpen, openBericht, setOpenBericht, input, setInput, busy, editIdx, setEditIdx, editRef, wegChat, setWegChat, wegIdx, setWegIdx, taskGen, stratLink, finalizePhase, lastAssistant, send, newChat, openChat, removeChat, deleteMsg, saveEdit, cancelSend, renderMsgHtml, makeWorkItem, acceptPlan, summarizeAndFinalize } = chat;

  // Wordt het gesprek nu uitgeklapt getoond? Zo ja, staat de vervolgvraag al in het
  // gesprek zelf (boven de knoppen) en verbergen we het losse invoerveld onderaan.
  // De vraag-input onderaan verbergen we alleen als het gesprek echt zichtbaar is (kaart
   // open én gesprek open). Bij een automatisch ingeladen, ingeklapte chat blijft de input dus staan.
  const convoShown = msgs.length > 0 && convoOpen && chatOpen;
  // Titel voor de strategie-toggle: "STRATEGIE: /pad/" van deze pagina. (De chat-analyse
  // heet "strategie" om hem te onderscheiden van de SEO-analyse bij de vervolgstappen.)
  const analyseTitle = "STRATEGIE: " + ((url || "").replace(/^https?:\/\/[^/]+/i, "").trim() || url).toUpperCase();

  // Het gesprek van de actieve chat plus het voorstel en de vastleg/mail-knoppen.
  // Je vragen staan allemaal in beeld; alleen het LAATSTE antwoord staat open.
  // Eerdere antwoorden vouwen samen tot hun eigen kopje, want elk antwoord
  // herhaalde het vorige rapport; zo werd het gesprek onleesbaar lang. Er
  // verdwijnt niets, één klik zet een antwoord weer open.
  const renderConvo = () => {
    const lastAIdx = msgs.map((m) => m.role).lastIndexOf("assistant");
    return (
    <>
      <div className="page-chat-log">
        {msgs.map((m, i) => {
          const inklapbaar = m.role === "assistant" && i < lastAIdx;
          const dicht = inklapbaar && !openBericht[i];
          if (editIdx === i) {
            return (
              <div key={i} className="pch-msg-edit">
                <div className="pch-msg-editable md" contentEditable suppressContentEditableWarning ref={editRef} />
                <div className="pch-msg-edit-actions">
                  <button type="button" className="ghost-btn small" onClick={() => saveEdit(i)}>Opslaan</button>
                  <button type="button" className="ghost-btn small" onClick={() => setEditIdx(null)}>Annuleren</button>
                </div>
              </div>
            );
          }
          return (
            <div key={i}>
              {i === 0 && m.role === "user" && (
                <div className="muted" style={{ fontSize: "var(--fs-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "var(--s-1)" }}>Oorspronkelijke vraag</div>
              )}
              {lastAIdx > 1 && i === lastAIdx && (
                <div className="muted" style={{ fontSize: "var(--fs-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "var(--s-3) 0 var(--s-1)" }}>Eindconclusie</div>
              )}
              <div className={"pch-msg-wrap " + m.role}>
                {inklapbaar && (
                  <button type="button" className="ovc-msg-vouw" onClick={() => setOpenBericht((v) => ({ ...v, [i]: !v[i] }))}>
                    <span className="ovc-msg-vouw-pijl">{dicht ? "▸" : "▾"}</span>
                    <span className="ovc-msg-vouw-titel">{eersteKop(m.content || "")}</span>
                    {dicht && <span className="ovc-msg-vouw-meta">eerder antwoord</span>}
                  </button>
                )}
                {!dicht && (m.role === "user"
                  ? <div className="page-chat-msg user">{m.content}</div>
                  : <div className="page-chat-msg assistant md" dangerouslySetInnerHTML={{ __html: renderMsgHtml(m.content) }}
                      /* renderMsgHtml gebruikt mdToHtml, zie useStrategieChat.ts */ />)}
                {!dicht && m.role === "assistant" && <Bronnenstrip bronnen={m.bronnen} domain={siteBase} />}
                <div className="pch-msg-ctrl">
                  {wegIdx === i ? (
                    <span className="pch-weg-vraag">
                      Weghalen?
                      <button type="button" className="pch-weg-ja" onClick={() => deleteMsg(i)}>ja</button>
                      <button type="button" className="pch-weg-nee" onClick={() => setWegIdx(null)}>nee</button>
                    </span>
                  ) : (
                    <>
                      {m.role === "assistant" && !dicht && <button type="button" className="pch-msg-btn" title="Bewerken" onClick={() => setEditIdx(i)}>✎</button>}
                      <button type="button" className="pch-msg-btn" title="Dit bericht weghalen" onClick={() => setWegIdx(i)}>×</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="page-chat-msg assistant muted" style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
            <span>Aan het denken…</span>
            <button type="button" className="ghost-btn small" onClick={cancelSend}
              title="Onderbreek dit antwoord. Het wordt weggegooid (niets bewaard); je vraag komt terug in het invoerveld zodat je hem kunt aanvullen.">&times; Onderbreken</button>
          </div>
        )}
      </div>
      {lastAssistant && (
        <>
          <DriveRij folder={driveFolder} legeTekst="nog geen Drive-map (documenten worden gedownload)" onKies={openPicker} onNaarDownload={() => setDriveFolder(null)} />
          {/* De losse primaire knop "Strategie vastleggen" is hier bewust weg: hij
              pakte alleen het laatste antwoord en vulde de vastgelegde strategie
              níet, dus hij leek dubbel met de echte knop en deed minder dan zijn
              naam beloofde. Wat overblijft is de herkansing voor alleen de
              documentstap, klein en eerlijk benoemd. */}
          {(taskDone || stratLink) && (
          <div className="page-chat-tools">
            {taskDone && <span className="pcd-btn pcd-btn-done">✓ Strategie vastgelegd.</span>}
            {stratLink
              ? <a href={stratLink} target="_blank" rel="noreferrer" className="pcd-doclink">Document openen ↗</a>
              : taskDone && <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>het document wordt gemaakt; de link verschijnt hier vanzelf</span>}
            {taskDone && !planDone && lastAssistant && (
              <button type="button" className="ghost-btn small" onClick={() => void acceptPlan(lastAssistant)}
                title="De conclusie van dit gesprek staat nog niet als vastgelegde strategie bovenaan (dat kon in de oude werkwijze gebeuren). Deze knop zet hem er alsnog neer, zonder opnieuw samen te vatten.">
                Conclusie alsnog als strategie bovenaan zetten
              </button>
            )}
            {lastAssistant && (
              <button type="button" className={"ghost-btn small" + (taskGen ? " busy" : "")} onClick={() => ensureDriveMap(() => void makeWorkItem())} disabled={taskGen}>{taskGen ? "Document maken…" : "Document opnieuw maken"}</button>
            )}
            <HelpHint wide title="Document opnieuw maken (herkansing)" text={"Herkansing voor alleen de documentstap: maakt van de laatste conclusie het nette **Pingwin-document** in de Drive-map van de pagina, en legt hem vast als afgeronde werkzaamheid met de documentlink ernaast. Is er nog geen map gekozen, dan vraagt deze knop er eerst een.\nNormaal hoef je deze knop niet te gebruiken: 'Vat samen & leg strategie vast' doet dit al automatisch. Gebruik hem als de documentstap toen mislukte of als je alleen een vers document wilt zonder de strategie opnieuw samen te vatten."} />
          </div>
          )}
          <div className="page-chat-followup">
            <div style={{ fontWeight: 700, fontSize: "var(--fs-base)", marginBottom: "var(--s-1)" }}>Verder sparren?</div>
            <div className="pchf-lead">Stel je vragen hier, bijvoorbeeld over de invulling of de zoekwoorden. Ben je klaar met bespreken, klik dan op &ldquo;Vat samen &amp; leg strategie vast&rdquo;: de conclusie wordt de vastgelegde strategie bovenaan én het nette document in de Drive-map.</div>
            <div className="pchf-row">
              <input className="pchf-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Vervolgvraag over deze pagina…" disabled={busy} />
              <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
              <button type="button" className="pcd-btn pcd-btn-primary" onClick={() => ensureDriveMap(() => void summarizeAndFinalize())} disabled={busy || taskGen || !!finalizePhase}
                title="Vat het hele gesprek samen tot de definitieve conclusie, zet die als vastgelegde strategie bovenaan en maakt er het Pingwin-document van in de Drive-map. Is er nog geen map gekozen, dan vraagt deze knop er eerst een.">
                {finalizePhase === "samenvatten" ? "Samenvatten…" : finalizePhase === "vastleggen" ? "Strategie vastleggen…" : finalizePhase === "document" ? "Document maken…" : (planDone || taskDone) ? "Vat opnieuw samen & leg strategie vast" : "Vat samen & leg strategie vast"}
              </button>
              <HelpHint wide title="Vat samen & leg strategie vast" text={"Sluit het gesprek af met deze ene knop. Er gebeuren dan drie dingen na elkaar:\n- De AI redeneert nog één keer over alles wat besproken en gemeten is en schrijft de **definitieve conclusie** (hij mag daarbij pagina's en concurrenten nameten in plaats van gokken).\n- Die conclusie wordt meteen de **vastgelegde strategie** bovenin dit blok, die alle volgende stappen aanstuurt (en die je daar altijd nog kunt bewerken).\n- Er wordt het nette **Pingwin-document** van gemaakt in de Drive-map van de pagina (of als download zonder Drive), vastgelegd als afgeronde werkzaamheid.\nChat je daarna verder, dan heet de knop 'Vat opnieuw samen': een nieuwe conclusie vervangt de vastgelegde strategie en er komt een vers document; het oude document blijft in Drive staan.\nOnderbreken kan tijdens het samenvatten met het kruisje; dan wordt er niets vastgelegd."} />
            </span>
          </div>
        </>
      )}
    </>
    );
  };

  return (
      <div className={"page-chat step-card step-card-2" + (planDone || taskDone ? " done" : "")}>
        <div className="step-head" onClick={() => setChatOpen((o) => !o)} title={chatOpen ? "Chat inklappen" : "Chat uitklappen"}>
          <span className="step-caret">{chatOpen ? "▾" : "▸"}</span>
          <span className="step-badge">{planDone || taskDone ? "✓" : "1"}</span>
          <span className="step-title">Strategie voor deze pagina</span>
          <span onClick={(e) => e.stopPropagation()}><HelpHint xl title="Stap 1 — Strategie voor deze pagina" text={"Alles begint met de strategiebepaling: wat moet deze pagina zijn, op welk zoekwoord, en waarom gaan we die slag winnen? Deze stap bestaat uit de **vastgelegde strategie** (de conclusie bovenin: rol, primair en secundair zoekwoord, acties, doel-URL) en de **strategie-chat** die ernaartoe werkt.\n## Op welke data de chat werkt\n- **Search Console (de waarheid over Google):** de echte rankings, klikken en vertoningen van deze pagina over 90 dagen, plus de sitebrede zoekwoord-naar-pagina-matrix; zo ziet de chat direct of meerdere eigen pagina's op dezelfde term ranken.\n- **De volledige paginalijst** van de site (de spiegel): de chat mag nooit beweren dat een pagina niet bestaat zonder die lijst te checken.\n- **Ahrefs, live op te vragen tijdens het gesprek:** echt maandelijks zoekvolume, keyword difficulty en zoekintentie per term; de top-10 van elk zoekwoord met de Domain Rating van elke concurrent; de backlinks en verwijzende domeinen van de eigen site of een concurrent-URL; en waar elke concurrent-URL zelf op rankt (content-gap).\n- **De echte paginainhoud:** de chat kan elke publieke URL inlezen (titel, koppen, tekst) om intentie en volledigheid te toetsen, ook bij concurrenten.\n- **Het klantprofiel:** positionering, werkgebied en doelgroep sturen elk advies; is het profiel leeg, dan vraagt de chat eerst door in plaats van te gokken.\n## De afwegingen die worden afgedwongen\n- **Zoekintentie eerst:** past het paginatype bij wat de top-10 laat zien? Een transactionele SERP win je niet met een blogartikel.\n- **Samenvoegen of splitsen:** tonen twee termen voor meer dan 50% dezelfde URL's in de top-10, dan is het één intentie en dus één pagina.\n- **Eigen pagina alleen bij echte vraag:** richtlijn vanaf zo'n 100 zoekvolume per maand; daaronder aanhaken als sectie. Varianten tellen mee vanaf zo'n 50.\n- **Eigenaar volgens plan, niet volgens toeval:** de pagina waarvan het plan een zoekintentie claimt is de bestemming; huidige rankings van andere pagina's zijn waarde die daarnaartoe geconsolideerd moet worden, nooit een reden om de strategie om te draaien.\n- **Verzin-verbod:** volumes, posities, Domain Ratings en backlink-aantallen komen aantoonbaar uit de bronnen of worden niet genoemd.\n## Van gesprek naar vastgelegde strategie\nSluit af met 'Vat samen & leg strategie vast': het systeem redeneert dan nog één keer agentisch over alle verzamelde data (het mag daarbij zelf extra pagina's en concurrenten meten) en dwingt een complete slotconclusie af: huidige situatie, kansrijke termen met volume, concurrentiepositie, zoekintentie, wat er mist ten opzichte van de top-10, en een helder advies. Die conclusie wordt in dezelfde beweging de vastgelegde strategie bovenin (die alle volgende stappen aanstuurt) én het nette Pingwin-document in de Drive-map. Verder chatten kan altijd; met 'Vat opnieuw samen' vervang je de strategie door een nieuwe conclusie."} /></span>
          {chatOpen && (chats.length > 0 || msgs.length > 0) && <span className="step-head-right"><button type="button" className="ghost-btn small" onClick={(e) => { e.stopPropagation(); newChat(); }}>+ Nieuwe chat</button></span>}
        </div>

        {chatOpen && (
        <div className="page-chat-history step-body">
          {/* De vastgelegde strategie (het plan) hoort bij deze stap en staat bovenin. */}
          {planSlot}
          <div className="page-chat-history-head">Eerdere chats</div>

          {chatId === null && msgs.length > 0 && (
            <div className={"pch-item active" + (convoOpen ? " open" : "")}>
              <div className="pch-item-head" onClick={() => setConvoOpen((o) => !o)}>
                <span className="pch-caret">{convoOpen ? "▾" : "▸"}</span>
                <span className="pch-title">{analyseTitle}</span>
                {wegChat === "nieuw" ? (
                  <span className="pch-weg-vraag" onClick={(e) => e.stopPropagation()}>
                    Weggooien?
                    <button type="button" className="pch-weg-ja" onClick={() => { setWegChat(null); newChat(); }}>ja</button>
                    <button type="button" className="pch-weg-nee" onClick={() => setWegChat(null)}>nee</button>
                  </span>
                ) : (
                  <button type="button" className="pch-del" title="Deze chat weggooien" onClick={(e) => { e.stopPropagation(); setWegChat("nieuw"); }}>&times;</button>
                )}
              </div>
              {convoOpen && <div className="pch-item-body">{renderConvo()}</div>}
            </div>
          )}

          {chats.map((c) => {
            const active = chatId === c.id;
            const open = active && convoOpen;
            return (
              <div key={c.id} className={"pch-item" + (open ? " open" : "") + (active ? " active" : "")}>
                <div className="pch-item-head" onClick={() => { if (active) setConvoOpen((o) => !o); else { openChat(c.id); setConvoOpen(true); } }}>
                  <span className="pch-caret">{open ? "▾" : "▸"}</span>
                  <span className="pch-title">{active ? analyseTitle : c.title}</span>
                  {wegChat === c.id ? (
                    <span className="pch-weg-vraag" onClick={(e) => e.stopPropagation()}>
                      Weggooien?
                      <button type="button" className="pch-weg-ja" onClick={() => void removeChat(c.id)}>ja</button>
                      <button type="button" className="pch-weg-nee" onClick={() => setWegChat(null)}>nee</button>
                    </span>
                  ) : (
                    <button type="button" className="pch-del" title="Deze chat weggooien" onClick={(e) => { e.stopPropagation(); setWegChat(c.id); }}>&times;</button>
                  )}
                </div>
                {open && <div className="pch-item-body">{renderConvo()}</div>}
              </div>
            );
          })}

          {chats.length === 0 && msgs.length === 0 && (
            <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>Nog geen chats. Stel hieronder een vraag over deze pagina.</div>
          )}
          {!convoShown && (
            <div className="page-chat-input" style={{ marginTop: "var(--s-3)" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Stel een vraag over deze pagina…" disabled={busy} />
              <button type="button" className="primary-btn small" onClick={() => send(input)} disabled={busy || !input.trim()}>Vraag</button>
            </div>
          )}
        </div>
        )}
      </div>
  );
}

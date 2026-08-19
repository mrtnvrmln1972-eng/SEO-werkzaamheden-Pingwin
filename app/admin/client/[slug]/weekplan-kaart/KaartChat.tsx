"use client";

// Het chatvenster op de projectkaart. Alleen scherm; de logica staat in
// useKaartChat.ts.

import { mdToHtml } from "../../../../../lib/markdown";
import { linkifyHtml } from "../../../../../lib/linkify";
import { eersteKop } from "../../../../../lib/chat-vouw";
import AntwoordBlokken from "../AntwoordBlokken";
import type { DriveMap } from "../DriveMapKiezer";
import { Icoon, ICOON } from "./fase-iconen";
import type { KaartChatState } from "./useKaartChat";
import type { WpTask, WpPageInfo } from "./types";
import MeegegevenAdvies from "../pagina-chat/MeegegevenAdvies";
import { Omlaag, PijlSchuin, Uitklap } from "../../../../_ui/Pijl";

export default function KaartChat({ slug, t, page, chat, driveMap, onKiesMap, ensureDriveMap, refreshBoard, onPaginas }: {
  slug: string; t: WpTask; page?: WpPageInfo; chat: KaartChatState;
  driveMap: DriveMap | null; onKiesMap: () => void;
  /** Opent deze pagina in het tabblad Pagina's (nieuw browsertabblad). Die knop
      stond onderaan de kaart tussen de linkjes; hij hoort naast de chat, in
      dezelfde vorm, want het is dezelfde soort stap: hier verder kijken. */
  onPaginas?: () => void;
  /** Zelfde poort als bij de fases: pas de strategie vastleggen (en het
      document ervan maken) zodra er een Drive-map is. */
  ensureDriveMap: (actie: () => void) => void;
  refreshBoard: () => void;
}) {
  const { chatOpen, setChatOpen, msgs, chatFout, openBericht, setOpenBericht, wegVraag, setWegVraag,
    input, setInput, chatBusy, msgsRef, vatFase, laatsteAntwoord } = chat;
  const host = (() => { try { return new URL(t.url).host; } catch { return ""; } })();
  const origin = (() => { try { return new URL(t.url).origin; } catch { return ""; } })();

  return (
    <div className="wp-chat">
      <div className="wp-chat-kop">
        <button type="button" className={"wp-chat-toggle wp-chat-toggle-groot" + (chatOpen ? " wp-chat-open" : "")} onClick={() => (chatOpen ? setChatOpen(false) : void chat.openChat())}>
          <Icoon d={ICOON.chat} className="wp-sectie-icoon" /> {t.url ? "Chat over deze pagina" : "Chat over deze taak"} {chatOpen ? <Omlaag /> : <Uitklap />}
        </button>
        {/* Zelfde pilvorm, direct ernaast: naar deze pagina in Pagina's. */}
        {onPaginas && (
          <button type="button" className="wp-chat-toggle wp-chat-toggle-groot" title="Open de pagina in Pagina's (nieuw tabblad)" onClick={onPaginas}>
            Pagina&rsquo;s <PijlSchuin />
          </button>
        )}
        {chatOpen && msgs.length > 0 && (wegVraag === "chat" ? (
          <span className="wp-weg-vraag wp-weg-naast">
            Hele chat weggooien?
            <button type="button" className="btn btn-danger btn-klein" onClick={() => void chat.wisChat()}>ja</button>
            <button type="button" className="btn btn-klein" onClick={() => setWegVraag(null)}>nee</button>
          </span>
        ) : (
          <button type="button" className="wp-chat-wis" title="Dit hele gesprek weggooien" onClick={() => setWegVraag("chat")}>&times;</button>
        ))}
      </div>
      {chatOpen && (
        <div className="wp-chat-body">
          {t.url && <MeegegevenAdvies slug={slug} url={t.url} siteBase={origin} />}
          <div className="wp-chat-msgs" ref={msgsRef}>
            {msgs.length === 0 && !chatBusy && (
              <div className="muted wp-chat-leeg">
                {t.url
                  ? "Stel een vraag of spar over deze pagina. De kaart-achtergrond gaat automatisch mee als context."
                  : "Stel een vraag of zoek dit verder uit; de assistent kent de hele site. Van elk punt in het antwoord kun je direct een kaart maken."}
              </div>
            )}
            {msgs.map((m, i) => {
              // Alleen het laatste antwoord staat open; de antwoorden daarvoor
              // vouwen samen tot hun eigen kopje. Je vragen blijven altijd staan.
              const inklapbaar = m.role === "assistant" && i < laatsteAntwoord;
              const dicht = inklapbaar && !openBericht[i];
              return (
              <div key={i} className={"wp-chat-blok " + (m.role === "user" ? "wp-chat-blok-vraag" : "")}>
                {wegVraag === i ? (
                  <span className="wp-weg-vraag">
                    Weghalen?
                    <button type="button" className="btn btn-danger btn-klein" onClick={() => void chat.verwijderChatBericht(i)}>ja</button>
                    <button type="button" className="btn btn-klein" onClick={() => setWegVraag(null)}>nee</button>
                  </span>
                ) : (
                  <button type="button" className="wp-chat-del" title="Dit bericht weghalen" onClick={() => setWegVraag(i)}>×</button>
                )}
                {inklapbaar && (
                  <button type="button" className="ovc-msg-vouw" onClick={() => setOpenBericht((v) => ({ ...v, [i]: !v[i] }))}>
                    <span className="ovc-msg-vouw-pijl">{dicht ? <Uitklap /> : <Omlaag />}</span>
                    <span className="ovc-msg-vouw-titel">{eersteKop(m.content || "")}</span>
                    {dicht && <span className="ovc-msg-vouw-meta">eerder antwoord</span>}
                  </button>
                )}
                {dicht ? null : m.role === "user"
                  ? <div className="wp-chat-vraag">{m.content}</div>
                  : <div className="wp-chat-antwoord md">
                      <AntwoordBlokken
                        slug={slug}
                        thread={t.thread}
                        content={m.content}
                        mdToHtml={(md) => linkifyHtml(mdToHtml(md), host)}
                        siteUrl={origin}
                        onWeekplanChanged={refreshBoard}
                      />
                    </div>}
              </div>
              );
            })}
            {chatBusy && <div className="muted wp-chat-leeg">Aan het nadenken…</div>}
          </div>
          {/* De melding hoort hier, onder de vraag die niet lukte, en niet in
              de fase-lijst hierboven (die er op een kaart zonder pagina niet
              eens is). Met de vraag terug in het invulveld is opnieuw proberen
              één klik, zonder overtypen of plakken. */}
          {chatFout && (
            <div className="wp-chat-fout" role="alert">
              <span className="wp-chat-fout-tekst">{chatFout}</span>
              <button type="button" className="btn btn-ghost btn-klein" disabled={chatBusy || !input.trim()}
                title="Stuur dezelfde vraag opnieuw" onClick={() => void chat.sendChat()}>Probeer opnieuw</button>
            </div>
          )}
          {t.url && msgs.some((m) => m.role === "assistant") && (
            <div className="wp-chat-acties">
              <button type="button" className="btn btn-primary btn-klein" disabled={chatBusy || !!vatFase}
                title="Vat het hele gesprek samen tot de definitieve conclusie, zet die als vastgelegde strategie (de basis voor gelieerde pagina's, analyse, blauwdruk en copy) en maak er het Pingwin-document van in de Drive-map."
                onClick={() => ensureDriveMap(() => void chat.vatSamenEnLegVast())}>
                {vatFase === "samenvatten" ? "Samenvatten…" : vatFase === "vastleggen" ? "Strategie vastleggen…" : vatFase === "document" ? "Document maken…" : page?.strategie ? "Vat opnieuw samen & leg strategie vast" : "Vat samen & leg strategie vast"}
              </button>
              {/* Eén plek voor de mapkeuze: die staat nu in de kop van het
                  fase-blok, waar ook de documenten gemaakt worden. Alleen op een
                  kaart zonder fase-blok (een pagina die de sitescan nog niet
                  kent) staat hij hier, anders is hij nergens te vinden. */}
              {!page && (
                <button type="button" className="btn btn-quiet btn-klein" onClick={onKiesMap}
                  title="Kies de Google Drive-map waar de documenten van deze pagina in worden gezet.">
                  {driveMap ? `Drive: ${driveMap.path || driveMap.name}` : "Kies Drive-map"}
                </button>
              )}
            </div>
          )}
          <div className="wp-chat-input">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vraag of instructie…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void chat.sendChat(); } }} />
            <button type="button" className="btn btn-primary btn-klein" disabled={chatBusy || !input.trim()} onClick={() => void chat.sendChat()}>Vraag</button>
          </div>
        </div>
      )}
    </div>
  );
}

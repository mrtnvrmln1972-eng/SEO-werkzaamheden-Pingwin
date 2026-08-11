"use client";

// De projectkaart in het weekplanning-bord: één pagina = één kaart, met de hele
// cyclus (7 fases) verticaal erin. Elke fase toont live de stand, is te starten
// waar een motor bestaat, en handmatig af te vinken. De chat is dezelfde chat
// als bij de pagina in Pagina's (één geheugen per pagina); de kaart-achtergrond
// reist als context mee in de chat en als extra sturing in de document-runs.
//
// Dit bestand is alleen nog het karkas: het zet de blokken in de goede volgorde
// en houdt de paar dingen vast die twee blokken samen gebruiken (de Drive-map,
// de bezet-vlag, de fout- en meldingsregel). Elk blok woont in weekplan-kaart/,
// zodat twee chats die aan verschillende delen van de kaart werken elkaar niet
// meer in de weg zitten; dat was met 1.200 regels in één bestand onvermijdelijk.

import { useEffect, useState } from "react";
import { type MailLinks } from "../../../../lib/card-info";
import DriveMapKiezer, { type DriveMap } from "./DriveMapKiezer";
import DevDoorzetten from "./DevDoorzetten";
import KaartKop from "./weekplan-kaart/KaartKop";
import KaartOverDeze from "./weekplan-kaart/KaartOverDeze";
import KaartFases, { FaseChips } from "./weekplan-kaart/KaartFases";
import KaartChat from "./weekplan-kaart/KaartChat";
import KaartOnderRegel, { useNaarDev } from "./weekplan-kaart/KaartOnderRegel";
import ControleUitslag, { useDoorgevoerd } from "./weekplan-kaart/KaartControle";
import BespreeklijstKeuze, { useBespreeklijst } from "./weekplan-kaart/KaartBespreeklijst";
import WerklijstBlok from "./weekplan-kaart/WerklijstBlok";
import { useKaartChat } from "./weekplan-kaart/useKaartChat";
import type { WpTask, WpPageInfo } from "./weekplan-kaart/types";

// Doorgeven, niet opnieuw opschrijven: Planning.tsx en MailUitKaart.tsx
// importeren deze types al jaren vanaf hier.
export type { WpTask, WpPageInfo };

export default function WeekplanCard({ slug, t, page, open, inRij, onToggleOpen, onDragStart, onDragEnd, onRemove, onMail, onOpenMailDate, mailLinks, refreshBoard }: {
  slug: string; t: WpTask; page?: WpPageInfo; open: boolean;
  /** Hangt deze kaart onder een regel in de planning? Dan toont die regel de
      titel, het pad en de fase-letters al, en wordt de kaartkop één actiebalk.
      Zonder dit stond alles twee keer in beeld, inclusief het sleephandvat. */
  inRij?: boolean;
  onToggleOpen: () => void; onDragStart: () => void; onDragEnd: () => void;
  onStatus: () => void; onRemove: () => void; onMail: (aud: "klant" | "dev") => void;
  onGoToPage?: (url: string) => void; onGoToTab?: (tab: string) => void;
  onOpenMailDate?: (datum: string) => void; mailLinks?: MailLinks; refreshBoard: () => void;
}) {
  const hasInfo = !!t.toelichting.trim();
  // Eén bezet-vlag voor de hele kaart: opschonen en een fase starten mogen niet
  // door elkaar heen lopen. Fout en melding zijn ook van de hele kaart; ze worden
  // in het fase-blok getekend, want daar verwacht je ze.
  const [busy, setBusy] = useState<string>("");
  const [foutje, setFoutje] = useState<string>("");
  const [melding, setMelding] = useState<string>("");
  // De gekozen Drive-bestemmingsmap van deze pagina (zelfde keuze als in Pagina's;
  // hij wordt server-side per klant + URL onthouden). Zowel het fase-blok als de
  // chat maken documenten, dus die keuze hoort hier en niet in één van de twee.
  const [driveMap, setDriveMap] = useState<DriveMap | null>(null);
  const [kiezerOpen, setKiezerOpen] = useState(false);
  useEffect(() => {
    if (!open || !t.url) return;
    let alive = true;
    fetch(`/api/admin/drive/folders?chosenOnly=1&slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`)
      .then((r) => r.json()).then((d) => { if (alive && d?.ok && d.chosen) setDriveMap({ id: d.chosen.folderId, name: d.chosen.folderName, path: d.chosen.folderPath }); })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
  }, [open, slug, t.url]);

  const chat = useKaartChat({ slug, t, hasInfo, driveMap, refreshBoard, setFoutje, setMelding });
  const dev = useNaarDev({ slug, t, setFoutje });
  const doorgevoerd = useDoorgevoerd({ slug, id: t.id, refreshBoard });
  const lijst = useBespreeklijst({ slug, t, open });

  return (
    <div className={"wp-card wp-" + t.status + (open ? " wp-open" : "")}>
      <div className="wp-card-grid">
        {/* Alleen dit handvat is sleepbaar; de rest van de kaart blijft selecteerbare tekst.
            Hangt de kaart onder een regel, dan heeft die regel er al een. */}
        {!inRij && <span className="wp-card-grip" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="Sleep de kaart naar een andere week">⋮⋮</span>}
        <div className="wp-card-main">
          <KaartKop slug={slug} t={t} open={open} inRij={inRij}
            onToggleOpen={onToggleOpen} onRemove={onRemove}
            busy={busy} setBusy={setBusy} setFoutje={setFoutje} refreshBoard={refreshBoard}
            controleBezig={doorgevoerd.bezig} onControle={() => void doorgevoerd.meet()} />

          {open && doorgevoerd.controle && <ControleUitslag controle={doorgevoerd.controle} onMail={onMail} />}

          {/* Het blok staat er altijd zodra de kaart open is, ook bij een taak die je
              zelf hebt aangemaakt en die nog geen achtergrond of pagina heeft. Anders
              krijgt zo'n kaart een kale, andere vorm dan de rest en kun je er geen
              document bij leggen, terwijl dat juist het eerste is wat je wilt doen. */}
          {open && (
            <KaartOverDeze slug={slug} t={t} page={page} mailLinks={mailLinks}
              onOpenMailDate={onOpenMailDate} onLijstPunt={lijst.kies} />
          )}

          {open && <BespreeklijstKeuze lijst={lijst} />}

          {/* Dichtgeklapt: compacte fase-chips. Klik = de kaart openen. */}
          {!open && page && <FaseChips page={page} onToggleOpen={onToggleOpen} />}

          {/* Werklijst-sitebouwer-kaart: hier hoort het echte werk te staan, niet
              alleen een omschrijving. Knop, status en het kant-en-klare document. */}
          {open && !t.url && /werklijst sitebouwer|site-?breed/i.test(t.taak) && <WerklijstBlok slug={slug} refreshBoard={refreshBoard} />}

          {/* De fases staan hier, direct onder "Over deze pagina" en boven de chat.
              Ze stonden onderaan, ónder het hele gesprek, dus je scrolde er straal
              langs: eerst zien waarom deze pagina, dan de stand en wat je kunt
              starten, en pas daarna praten. */}
          {open && (
            <KaartFases slug={slug} t={t} page={page} naarDev={dev.naarDev}
              driveMap={driveMap} onKiesMap={() => setKiezerOpen(true)}
              busy={busy} setBusy={setBusy}
              foutje={foutje} setFoutje={setFoutje} melding={melding} setMelding={setMelding}
              onBespreek={(prefill) => void chat.openChat(prefill)}
              haalConclusie={chat.chatConclusie}
              onMail={onMail} refreshBoard={refreshBoard} />
          )}

          {/* Chat direct onder het Doel-blok: de uitkomst hiervan voedt de fases eronder.
              Ook op kaarten zonder pagina, dan met een eigen bird's eye-gesprek. */}
          {open && (
            <KaartChat slug={slug} t={t} page={page} chat={chat}
              driveMap={driveMap} onKiesMap={() => setKiezerOpen(true)} refreshBoard={refreshBoard} />
          )}

          {open && <KaartOnderRegel slug={slug} t={t} dev={dev} onMail={onMail} />}
        </div>
      </div>

      {dev.venster && (
        <DevDoorzetten
          slug={slug} id={t.id}
          kaartTitel={t.taak.replace(/<[^>]*>/g, "").trim()}
          onSluit={() => dev.setVenster(false)}
          // Doorzetten alleen zet hem op een lijst; de sitebouwer weet dat pas als
          // je het hem laat weten. Daarom meteen de mail erachteraan, met dezelfde
          // kaart als onderwerp, in plaats van dat je hem later moet opzoeken.
          onKlaar={(mailen) => {
            dev.setVenster(false); dev.setNaarDev(true); refreshBoard();
            if (mailen) onMail?.("dev");
          }}
        />
      )}

      {t.url && (
        <DriveMapKiezer slug={slug} url={t.url} open={kiezerOpen}
          onClose={() => setKiezerOpen(false)}
          onChosen={(m) => { setDriveMap(m); setKiezerOpen(false); }} />
      )}
    </div>
  );
}

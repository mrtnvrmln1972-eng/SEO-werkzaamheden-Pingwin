"use client";

import { useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════
// ALLEEN-LEZEN ONDERSCHEPPER (voor gasten zonder wijzig-recht)
// ═══════════════════════════════════════════════════════════
// Alle knoppen en stappen blijven gewoon zichtbaar, maar zodra een actie een
// wijziging naar de server zou sturen (POST/PATCH/DELETE naar /api/admin/...),
// wordt die hier client-side tegengehouden. De server blokkeert dezelfde acties
// óók (guardSlug); dit is de nette voorkant daarvan.
//
// Drie smaken per pad:
//  - toegestaan:  uitloggen en de kijk-als-modus verlaten werken gewoon door.
//  - stil:        achtergrond-saves (autosave taken, chat bewaren) en chats die
//                 hun eigen nette foutmelding tonen — wel blokkeren, geen popup
//                 (anders krijg je twee meldingen voor één poging).
//  - popup:       alle overige acties tonen één klein venstertje, maximaal één
//                 per poging (korte samenvoeg-periode tegen dubbele popups).
//
// Daarnaast gaat bewerken echt op slot: contentEditable-velden en invoervelden
// worden alleen-lezen gezet, zodat een bewerking niet "lijkt te lukken" terwijl
// de server hem weigert. Kijk-functies (KPI-periode wisselen, een chat-vraag
// typen) blijven bewust bruikbaar.
// ═══════════════════════════════════════════════════════════

const ALLOWED_PATHS = ["/api/admin/logout", "/api/admin/view-as"];
// Paden zonder popup: autosaves op de achtergrond en chats met eigen inline melding.
const SILENT_PATHS = ["/api/admin/tasks", "/api/admin/page-chats", "/api/admin/page-chat", "/api/admin/chat"];
// Invoervelden die een alleen-lezen gast WEL mag gebruiken (kijk-functies).
const EDITABLE_OK = ".kpi-period-inline, .page-chat-input, .pchf-row, .chat-input";

// Cockpit-pagina's dragen de klant in het pad: /admin/client/[slug] en
// /admin/preview/[slug]. Daaruit leiden we af bij welke klant de gast nu kijkt.
function slugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/admin\/(?:client|preview)\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : null;
}

// editSlugs: klanten waarop deze gast WEL mag schrijven (per-klant recht).
// Op die klanten doet de onderschepper niets; overal anders blokkeert hij zoals
// voorheen. De server (guardSlug) blijft altijd de echte poort.
//
// devOk: deze gast is de developer. Dan is het developer-overzicht zijn eigen
// werkscherm: daar moet afvinken, een terugkoppeling typen en een datum zetten
// gewoon werken, ook al mag hij verder nergens iets wijzigen. Zonder deze
// uitzondering stond zijn eigen takenlijst voor hem op slot.
export default function ReadOnlyGuard({ editSlugs = [], devOk = false }: { editSlugs?: string[]; devOk?: boolean }) {
  const [show, setShow] = useState(false);
  const lastPopupRef = useRef(0);

  // Mag er geschreven worden voor deze aanroep? Eerst de slug uit de API-URL
  // (?slug=...), anders de klant van de pagina waar de gast nu op staat.
  // Niets herleidbaar = blokkeren (veilig fout; de server zou hem ook weigeren).
  const canEditFetch = (url: string): boolean => {
    if (editSlugs.length === 0) return false;
    try {
      const u = new URL(url, window.location.origin);
      const qs = (u.searchParams.get("slug") || "").trim().toLowerCase();
      if (qs) return editSlugs.includes(qs);
    } catch {}
    const pageSlug = slugFromPath(window.location.pathname);
    return pageSlug !== null && editSlugs.includes(pageSlug);
  };

  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const isWrite = method !== "GET" && method !== "HEAD";
      const isAdminApi = url.startsWith("/api/admin");
      const isAllowed = ALLOWED_PATHS.some((p) => url.startsWith(p))
        || (devOk && url.startsWith("/api/admin/developer"));
      if (isWrite && isAdminApi && !isAllowed && !canEditFetch(url)) {
        const silent = SILENT_PATHS.some((p) => url.startsWith(p));
        // Maximaal één popup per poging: meerdere geblokkeerde aanroepen vlak na
        // elkaar (autosave-burst, dubbele call) voegen samen tot één venstertje.
        if (!silent && Date.now() - lastPopupRef.current > 1500) {
          lastPopupRef.current = Date.now();
          setShow(true);
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: false, error: "Je hebt nog geen rechten om deze actie uit te voeren." }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return original(input as RequestInfo, init);
    };
    return () => {
      window.fetch = original;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSlugs.join(","), devOk]);

  // Bewerken op slot: contentEditable uit en invoervelden alleen-lezen, behalve
  // de kijk-functies (periodekiezer, chat-vragen). Draait ook op nieuw
  // bijgeladen stukken scherm (MutationObserver).
  useEffect(() => {
    const lock = () => {
      // Op een klant waar deze gast mag bewerken gaat er niets op slot. De check
      // zit bewust ín lock(): bij navigeren naar een andere klant beoordeelt de
      // MutationObserver de verse pagina meteen opnieuw.
      if (devOk && window.location.pathname.startsWith("/admin/developer")) return;
      const pageSlug = slugFromPath(window.location.pathname);
      if (pageSlug !== null && editSlugs.includes(pageSlug)) return;
      document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]').forEach((el) => {
        el.setAttribute("contenteditable", "false");
      });
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select").forEach((el) => {
        if (el.closest(EDITABLE_OK)) return;
        if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"))) {
          el.disabled = true;
        } else {
          (el as HTMLInputElement | HTMLTextAreaElement).readOnly = true;
        }
      });
    };
    lock();
    const mo = new MutationObserver(lock);
    mo.observe(document.body, { subtree: true, childList: true });
    return () => mo.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSlugs.join(","), devOk]);

  if (!show) return null;
  return (
    <div className="rog-overlay">
      <div className="rog-modal">
        <div className="rog-kop">
          <div className="rog-titel">Geen rechten</div>
          <button type="button" className="rog-sluit" onClick={() => setShow(false)} aria-label="Sluiten">×</button>
        </div>
        <p className="rog-tekst">
          Je hebt nog geen rechten om deze actie uit te voeren. Je kunt wel overal
          rondkijken. Vraag de beheerder om wijzig-rechten als je dit nodig hebt.
        </p>
        <button type="button" className="primary-btn" onClick={() => setShow(false)}>
          Sluiten
        </button>
      </div>
    </div>
  );
}

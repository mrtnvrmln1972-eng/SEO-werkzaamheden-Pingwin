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

export default function ReadOnlyGuard() {
  const [show, setShow] = useState(false);
  const lastPopupRef = useRef(0);

  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const isWrite = method !== "GET" && method !== "HEAD";
      const isAdminApi = url.startsWith("/api/admin");
      const isAllowed = ALLOWED_PATHS.some((p) => url.startsWith(p));
      if (isWrite && isAdminApi && !isAllowed) {
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
  }, []);

  // Bewerken op slot: contentEditable uit en invoervelden alleen-lezen, behalve
  // de kijk-functies (periodekiezer, chat-vragen). Draait ook op nieuw
  // bijgeladen stukken scherm (MutationObserver).
  useEffect(() => {
    const lock = () => {
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
  }, []);

  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
          padding: "22px 26px",
          maxWidth: 380,
          width: "100%",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Geen rechten</div>
          <button
            type="button"
            onClick={() => setShow(false)}
            aria-label="Sluiten"
            style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#64748b", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
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

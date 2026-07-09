"use client";

import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// ALLEEN-LEZEN ONDERSCHEPPER (voor gasten zonder wijzig-recht)
// ═══════════════════════════════════════════════════════════
// Alle knoppen en stappen blijven gewoon zichtbaar, maar zodra een actie een
// wijziging naar de server zou sturen (POST/PATCH/DELETE naar /api/admin/...),
// wordt die hier client-side tegengehouden en verschijnt een klein venstertje.
// De server blokkeert dezelfde acties óók (guardSlug), dit is alleen de nette
// voorkant daarvan. Uitloggen en de kijk-als-modus verlaten blijven werken.
// ═══════════════════════════════════════════════════════════

const ALLOWED_PATHS = ["/api/admin/logout", "/api/admin/view-as"];

export default function ReadOnlyGuard() {
  const [show, setShow] = useState(false);

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
        setShow(true);
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

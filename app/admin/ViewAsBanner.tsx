"use client";

import { useState } from "react";

// Balkje bovenin voor de eigenaar in de kijk-als-modus: je ziet nu exact wat
// deze gast ziet. De knop zet de modus uit en laadt de pagina opnieuw.
export default function ViewAsBanner({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    try {
      await fetch("/api/admin/view-as", { method: "DELETE" });
    } finally {
      window.location.href = "/admin/beheer";
    }
  }

  return (
    <div
      style={{
        background: "#1e293b",
        color: "#fff",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontSize: 14,
        position: "sticky",
        top: 0,
        zIndex: 10000,
      }}
    >
      <span>
        Je kijkt nu als <strong>{label}</strong>. Dit is exact wat deze gast ziet en kan.
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        style={{
          background: "#fff",
          color: "#1e293b",
          border: "none",
          borderRadius: 8,
          padding: "6px 14px",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {busy ? "Bezig…" : "Terug naar eigenaar"}
      </button>
    </div>
  );
}

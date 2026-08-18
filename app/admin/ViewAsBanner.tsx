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
        background: "var(--kleur-balk)",
        color: "var(--kleur-balk-tekst)",
        padding: "var(--s-2) var(--s-5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--s-3)",
        fontSize: "var(--fs-base)",
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
          background: "var(--kleur-balk-tekst)",
          color: "var(--kleur-balk)",
          border: "none",
          borderRadius: "var(--r-sm)",
          padding: "var(--s-1) var(--s-3)",
          fontWeight: 600,
          fontSize: "var(--fs-sm)",
          cursor: "pointer",
        }}
      >
        {busy ? "Bezig…" : "Terug naar eigenaar"}
      </button>
    </div>
  );
}

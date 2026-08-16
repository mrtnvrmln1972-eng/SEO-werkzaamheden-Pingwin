"use client";

// Oefenpagina voor het mega menu. ALLEEN tijdens ontwikkelen; in productie
// bestaat deze pagina niet. Zelfde reden als /proefveld: waar het paneel valt,
// of het binnen beeld blijft en of de kolommen netjes omslaan, zie je alleen in
// een echte browser en niet in de code.

import { notFound } from "next/navigation";
import KlantTabs from "../../admin/client/[slug]/KlantTabs";

export default function ProefMenu() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="admin-header" style={{ padding: "var(--s-4) var(--s-6)" }}>
      <KlantTabs basisPad="/admin/client/kamsteeg" actief="werkzaamheden" />
    </div>
  );
}

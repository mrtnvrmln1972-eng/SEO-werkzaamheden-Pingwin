// Leesbare namen voor de acties in de verbruikmeting: welke knop of functie was
// dit. Stond in het verbruikscherm zelf, maar de Claude-teller in de kopbalk noemt
// de duurste actie ook, en twee lijstjes met dezelfde namen lopen gegarandeerd uit
// elkaar. Dus één lijst, hier.
export const ACTION_LABEL: Record<string, string> = {
  doc_analyse: "Analyse-document", doc_analyse_diep: "Analyse-document (diep)",
  doc_blauwdruk: "Blauwdruk-document", doc_blauwdruk_diep: "Blauwdruk-document (diep)",
  doc_copy: "Copy-document", copy_koplabels: "Copy-koplabels",
  klantversie: "Klantversie (los)", strategie: "Strategie vastleggen", strategie_grounding: "Strategie (grounding)",
  strategie_uitleg: "Strategie-uitleg", projectchat: "Projectchat", page_chat: "Pagina-chat",
  voorstel: "Plan-voorstel", cluster_advies: "Cluster-advies", kansen: "Zoekwoord-kansen",
  klantprofiel: "Klantprofiel", page_cannibal: "Cannibalisatie", page_cannibal_apply: "Cannibalisatie overnemen",
  cannibal_redirect: "Cannibalisatie (site)", internal_links: "Interne links",
  org_autofill: "Organisatiegegevens invullen", kpi_toelichting: "KPI-toelichting",
};

/** De leesbare naam, of de ruwe code als we die nog niet vertaald hebben. */
export function actieLabel(action: string | null | undefined): string {
  if (!action) return "Overig";
  return ACTION_LABEL[action] || action;
}

/**
 * Naam van een actie ongeacht de dienst: Claude-acties via ACTION_LABEL, Ahrefs-
 * acties zijn een API-pad (bijv. "/site-explorer/organic-keywords") en worden
 * hier leesbaar gemaakt. Voor de "duurste actie" van een klant, die uit beide
 * diensten kan komen.
 */
export function actieLabelMetDienst(service: string, action: string | null | undefined): string {
  if (service === "anthropic") return actieLabel(action);
  if (!action) return "Ahrefs (onbekend)";
  const naam = action.replace(/^\//, "").split("/").join(" › ").replace(/-/g, " ");
  return `Ahrefs: ${naam}`;
}

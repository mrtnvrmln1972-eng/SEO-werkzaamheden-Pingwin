"use client";

// ═══════════════════════════════════════════════════════════
// DE TABBALK VAN EEN KLANT: ÉÉN LIJST, TWEE SCHERMEN
// ═══════════════════════════════════════════════════════════
// De cockpit tekende deze balk zelf, met de namen en de uitleg-zinnetjes als
// losse tekst in het scherm. Zodra een tweede scherm ook navigatie nodig had
// (de planning op volle breedte), zou die lijst een tweede keer bestaan en na
// een maand iets anders zeggen. Dat is precies de fout die we hier vaker gemaakt
// hebben, dus staat de lijst nu één keer, hier.
//
// De cockpit wisselt van tabblad zonder de pagina te herladen; een los scherm
// heeft dat niet en linkt gewoon. Vandaar de optionele `onKies`: geef je hem
// mee, dan wisselt hij client-side, anders is het een gewone link.

import HeaderMenu from "./HeaderMenu";

export type Tab =
  | "lead" | "onboarding" | "werkzaamheden" | "paginas" | "documenten" | "activiteit"
  | "resultaten" | "klant" | "developer" | "wijzigingen" | "cannibalisatie"
  | "interne-links" | "meta" | "prioriteiten" | "google-profiel";

export type TabItem = { id: Tab; label: string; hint: string };

export const TAB_LEAD: TabItem = {
  id: "lead", label: "Lead",
  hint: "De werkplek voor deze lead: gesprek, dossier en documenten",
};

export const TABS_VOOR: TabItem[] = [
  { id: "werkzaamheden", label: "Taken", hint: "Overview: je prioriteiten, de chats en de planning" },
  { id: "paginas", label: "Pagina’s", hint: "Elke pagina van deze site: hoe hij scoort, wat eraan gedaan is en wat er nog moet" },
];

export const TABS_SITEBREED: TabItem[] = [
  { id: "prioriteiten", label: "Prioriteitenscan", hint: "Waar zit de snelste winst op deze site: alle kansen op volgorde, van deze week tot strategisch" },
  { id: "meta", label: "Meta & CTR", hint: "Veel vertoningen, te weinig klikken: betere meta-teksten leveren direct bezoekers op" },
  { id: "cannibalisatie", label: "Opruimen", hint: "Welke pagina's elkaar in de weg zitten, met de volledige redirectlijst: van, naar en waarom" },
  { id: "interne-links", label: "Interne links", hint: "Vanaf welke pagina's je het beste naar een doelpagina linkt, gewogen op autoriteit en relevantie" },
  { id: "google-profiel", label: "Google-profiel", hint: "Hoe het Google-bedrijfsprofiel ervoor staat per vestiging, met de concurrenten in de buurt ernaast" },
];

export const TABS_KLANT: TabItem[] = [
  { id: "documenten", label: "Documenten", hint: "Alle analyses, blauwdrukken en copy per pagina en per maand, met of het al op de site staat" },
  { id: "activiteit", label: "Wat we doen", hint: "Alles wat we voor deze klant uitvoerden, per maand: copy, meta, alt-teksten, structured data en redirects" },
  { id: "wijzigingen", label: "Wijzigingen", hint: "Wat er op de site van de klant veranderd is sinds de vorige controle" },
  { id: "onboarding", label: "Onboarding", hint: "De vaste volgorde bij de start: wat er al staat, wat er nog moet en wat er achterloopt" },
  { id: "klant", label: "Klantgegevens", hint: "Profiel, bedrijfsgegevens, kennisbank en de instellingen van deze klant" },
];

export const TABS_NA: TabItem[] = [
  { id: "resultaten", label: "KPI’s", hint: "Hoe deze klant ervoor staat: posities, vertoningen, klikken en de ontwikkeling daarvan" },
  { id: "developer", label: "Developer", hint: "Alle developer-taken over alle klanten" },
];

export default function KlantTabs({ basisPad, actief, isLead, onKies }: {
  /** Het pad van de cockpit van deze klant, bijvoorbeeld /admin/client/kamsteeg. */
  basisPad: string;
  /** Welk tabblad open staat. Op een los scherm (de planning) is dat er geen. */
  actief?: Tab;
  isLead?: boolean;
  /** Alleen in de cockpit: wisselen zonder de pagina te herladen. */
  onKies?: (tab: Tab) => void;
}) {
  const href = (id: Tab) => `${basisPad}?tab=${id}`;
  // Echte link (href) zodat cmd- of middelklik in een nieuw tabblad opent; een
  // gewone klik wisselt client-side, als het scherm dat kan.
  const link = (t: TabItem) => (
    <a key={t.id} href={href(t.id)} title={t.hint}
      className={"tab" + (actief === t.id ? " active" : "")}
      onClick={(e) => {
        if (!onKies || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault(); onKies(t.id);
      }}>{t.label}</a>
  );

  return (
    <nav className="header-tabs">
      {isLead && link(TAB_LEAD)}
      {TABS_VOOR.map(link)}
      <HeaderMenu<Tab> label="Site-breed" active={actief} hrefFor={href} onPick={onKies} items={TABS_SITEBREED} />
      <HeaderMenu<Tab> label="Klant" active={actief} hrefFor={href} onPick={onKies} items={TABS_KLANT} />
      {TABS_NA.map(link)}
    </nav>
  );
}

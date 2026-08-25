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

import KlantMegaMenu from "./KlantMegaMenu";

export type Tab =
  | "lead" | "werkzaamheden" | "paginas" | "documenten" | "activiteit"
  | "resultaten" | "klant" | "klantweergave" | "developer" | "wijzigingen" | "cannibalisatie"
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
  { id: "klant", label: "Dossier", hint: "Alles wat je over deze klant weet: profiel en tone of voice, de afgesproken strategie, bedrijfsgegevens, kennisbank en concurrenten" },
  { id: "klantweergave", label: "Klantweergave", hint: "Precies wat de klant ziet na inloggen, met de deelbare link erbij" },
];

export const TABS_NA: TabItem[] = [
  { id: "resultaten", label: "KPI’s", hint: "Hoe deze klant ervoor staat: posities, vertoningen, klikken en de ontwikkeling daarvan" },
  { id: "developer", label: "Developer", hint: "Alle developer-taken over alle klanten" },
];

// ═══════════════════════════════════════════════════════════
// DE INDELING VAN HET MEGA MENU
// ═══════════════════════════════════════════════════════════
// Twaalf schermen zaten achter zes knopjes, waarvan twee uitklapmenu's met een
// kaal lijstje. Elk scherm hééft een regel uitleg (de `hint` hierboven), maar je
// zag hem alleen als je precies lang genoeg stil bleef hangen met je muis.
//
// De groepen hieronder zijn geen smaak maar een regel: elk scherm staat bij de
// VRAAG die het beantwoordt. Zonder zo'n regel wordt elke plek een kwestie van
// wie er die dag iets bouwde, en dat is precies hoe het klantprofiel boven een
// lijst van 65 URL's terechtkwam. Komt er een scherm bij, dan is de vraag "welke
// hiervan beantwoordt het?" en niet "waar is nog ruimte?".
//
// Bewust ÉÉN bron: de items hieronder verwijzen naar dezelfde TabItem-objecten
// als de balk, dus een label of uitleg kan hier nooit iets anders zeggen dan
// daar. `proeven/menu-indeling.proef.ts` bewaakt dat elk tabblad in precies één
// groep staat, zodat er nooit een scherm buiten het menu valt.
export type MegaGroep = { vraag: string; items: TabItem[] };

const tab = (id: Tab): TabItem => {
  const alles = [TAB_LEAD, ...TABS_VOOR, ...TABS_SITEBREED, ...TABS_KLANT, ...TABS_NA];
  const t = alles.find((x) => x.id === id);
  if (!t) throw new Error(`Onbekend tabblad in het menu: ${id}`);
  return t;
};

export const MEGA_GROEPEN: MegaGroep[] = [
  {
    vraag: "Wat moet ik nu doen",
    items: [tab("werkzaamheden")],
  },
  {
    vraag: "Hoe staat de site ervoor",
    items: [tab("paginas"), tab("resultaten"), tab("wijzigingen")],
  },
  {
    vraag: "Waar zit winst te halen",
    items: [tab("prioriteiten"), tab("meta"), tab("cannibalisatie"), tab("interne-links"), tab("google-profiel")],
  },
  {
    vraag: "Wie is deze klant",
    items: [tab("klant")],
  },
  {
    vraag: "Wat hebben we geleverd",
    items: [tab("documenten"), tab("activiteit"), tab("klantweergave")],
  },
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

  // Developer opent altijd in een nieuw tabblad, ook bij een gewone klik: dat
  // scherm gaat over álle klanten, dus wisselen binnen déze klant-cockpit is
  // niet wat je wilt. Geen onClick-onderschepping, wél target="_blank".
  const developerLink = (t: TabItem) => (
    <a key={t.id} href={href(t.id)} title={t.hint} target="_blank" rel="noopener noreferrer"
      className={"tab" + (actief === t.id ? " active" : "")}>{t.label}</a>
  );

  // Taken en Pagina's blijven los in de balk staan: daar ga je tien keer per dag
  // heen, die verdien je niet achter een menu te verstoppen. De rest zit in het
  // mega menu, gegroepeerd naar de vraag die het scherm beantwoordt. Developer
  // staat er los achter, want dat scherm gaat over álle klanten en hoort dus niet
  // in een groep die met "deze klant" begint.
  return (
    <nav className="header-tabs">
      {isLead && link(TAB_LEAD)}
      {TABS_VOOR.map(link)}
      <KlantMegaMenu label="Alles over deze klant" active={actief} hrefFor={href} onPick={onKies} />
      {TABS_NA.filter((t) => t.id === "developer").map(developerLink)}
    </nav>
  );
}

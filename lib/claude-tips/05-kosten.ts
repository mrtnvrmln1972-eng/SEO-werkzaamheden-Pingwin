import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  titel: "Kosten laag houden",
  waarvoor: "Waar het geld heen gaat, en welke meter je waarvoor moet aflezen.",
  tips: [
    {
      titel: "Een chat en het dashboard betalen niet uit hetzelfde potje",
      tekst:
        "Een gewone chat loopt op je Claude-abonnement: vaste prijs, gebruik zit erin. De rondes in het dashboard "
        + "liepen op een API-sleutel, en dat is een aparte rekening per verwerkt woord. Dezelfde vraag kost dus in "
        + "een chat niets extra en in het dashboard echt geld. Dat is geen fout in het dashboard, dat zijn twee "
        + "meters naast elkaar.",
      geleerd: "15 augustus 2026",
    },
    {
      titel: "Zet de rondes op je abonnement",
      tekst:
        "Draai eenmalig claude setup-token in Terminal, kopieer het token dat begint met sk-ant-oat01, en zet het in "
        + "GitHub bij Settings, Secrets and variables, Actions onder de naam CLAUDE_CODE_OAUTH_TOKEN. Vanaf dat "
        + "moment draaien de nacht- en plan-rondes op je abonnement en wordt de betaalde sleutel niet meer "
        + "meegegeven. Het geldt een jaar.",
      geleerd: "15 augustus 2026",
    },
    {
      titel: "Drie meters, en ze tellen niet bij elkaar op",
      tekst:
        "Ahrefs-units, wat het dashboard zelf aan AI-denkwerk verbruikt, en je Claude-abonnement zijn drie losse "
        + "potjes. Het abonnement is het enige dat je niet in dit dashboard afleest; dat staat op claude.ai onder je "
        + "gebruiksinstellingen.",
      waar: "/admin/usage",
    },
    {
      titel: "Eén ronde met tien tweaks is veel goedkoper dan tien losse rondes",
      tekst:
        "Ongeveer vijf minuten per ronde gaat op aan opstarten, proeven draaien en live zetten, en dat is even lang "
        + "voor één aanpassing als voor tien. Spaar kleine dingen dus op tot één ronde.",
      waar: "/admin/tweaks",
    },
    {
      titel: "Connectors en skills die je niet gebruikt: uit",
      tekst:
        "Elke gekoppelde dienst en elke skill brengt zijn hele gereedschapslijst mee bij élke vraag, ook als je hem "
        + "nooit aanraakt. Vraagt er eentje ongevraagd om toestemming, keur dat niet zomaar goed.",
    },
    {
      titel: "Geen agents of workflows tenzij je erom vraagt",
      tekst:
        "Meerdere agents tegelijk of een workflow kost een veelvoud van een gewone vraag. Prima als de klus dat "
        + "waard is, maar dat is een bewuste keuze, geen automatisme.",
    },
  ],
};

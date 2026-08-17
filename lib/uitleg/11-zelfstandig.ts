import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "zelfstandig",
  titel: "Wat er gebeurt terwijl niemand kijkt",
  intro:
    "Het dashboard is geen scherm dat wacht op een klik. Er draaien vaste taken op de achtergrond, en zware " +
    "analyses zijn zo gebouwd dat ze een onderbreking overleven.",
  uitklappers: [
    {
      titel: "De vaste achtergrondtaken",
      kern: "Van elke vijf minuten tot één keer per week.",
      tekst:
        "| Wanneer | Wat er gebeurt |\n" +
        "|---|---|\n" +
        "| Elke 5 minuten | Openstaande opruim-analyses oppakken en afmaken |\n" +
        "| Elke 5 minuten | Mailcontroles afwerken |\n" +
        "| Elke 30 minuten | Openstaande documentgeneraties oppakken en afmaken |\n" +
        "| Elke nacht | De ontwikkeling per klant bijwerken (posities, klikken, trends) |\n" +
        "| Elke nacht | De prioriteitenscans doorrekenen |\n" +
        "| Elke week | De volledige inhoudsscan van alle sites, met verschildetectie |\n" +
        "| Elke week | Het factuursignaal per klant |\n\n" +
        "Het gevolg is dat je op maandagochtend een dashboard opent dat al weet wat er in het weekend op de " +
        "sites is veranderd, in plaats van een dashboard dat begint met wachten.",
    },
    {
      titel: "Hervatbare analyses",
      kern: "Een afgekapt venster is geen mislukte analyse.",
      tekst:
        "Zware analyses draaien in stappen, met na elke stap een opgeslagen tussenstand. Wordt de run " +
        "onderbroken (een serverless venster is begrensd, een deploy komt ertussen), dan pakt een " +
        "achtergrondwerker hem weer op waar hij was.\n\n" +
        "Dit is er niet uit voorzorg maar uit ervaring: er stond eens een analyse veertig minuten op 'bezig' " +
        "zonder ooit iets op te leveren. Dat mag één keer gebeuren, niet twee keer.",
    },
    {
      titel: "Caches met een reden",
      kern: "Betaalde data wordt bewaard zolang hij geldig is, niet langer.",
      tekst:
        "Zoekvolumes ongeveer een maand, top-10-resultaten ongeveer een kwartaal, boekhoudcijfers enkele uren, " +
        "de site-brede overzichten ongeveer een halve dag. Elke bewaartermijn volgt uit hoe snel dat cijfer " +
        "echt verandert, niet uit een standaardinstelling.",
    },
    {
      titel: "Waarom het snel is (en waar het dat niet was)",
      kern: "Niets twee keer doen, en nooit laten wachten op iets dat er niet toe doet.",
      tekst:
        "Een dashboard wordt niet langzaam door één zware berekening, maar door klein werk dat vaker gebeurt " +
        "dan nodig. Vier voorbeelden die op 17 augustus 2026 gemeten en opgelost zijn.\n\n" +
        "**Niet blijven zoeken naar iets dat er niet is.** Heeft een klant geen Google Analytics gekoppeld, dan " +
        "ging het dashboard bij élke keer dat je Resultaten opende het hele Analytics-account aflopen om te " +
        "kijken of er tóch een koppeling was. Het vond niets, onthield dat niet, en deed het de volgende keer " +
        "weer. Dat kostte tien tot eenendertig seconden per keer. Nu wordt zo'n zoektocht hooguit één keer per " +
        "week herhaald; koppel je Analytics alsnog, dan wordt het vanzelf gevonden.\n\n" +
        "**Van tabblad wisselen vraagt niets aan de server.** Het scherm wisselde direct, maar daarna werd de " +
        "hele pagina alsnog opnieuw bij de server opgevraagd om het adres in de adresbalk bij te werken. Dat " +
        "kostte ruim een seconde per klik. Het adres wordt nu bijgewerkt zonder dat rondje.\n\n" +
        "**Een tabblad dat je bezocht hebt blijft staan.** Wegklikken gooide alles weg, dus terugkomen betekende " +
        "opnieuw wachten. Nu blijft het staan, inclusief je filters en uitgeklapte rijen, en loopt een scan die " +
        "je gestart hebt gewoon door terwijl je ergens anders kijkt.\n\n" +
        "**Controleren gebeurt ná het tonen.** Of een goedgekeurde meta al live staat wordt gecontroleerd door " +
        "de pagina's van de klant op te halen. Dat zat vóór het eerste beeld, dus je keek acht tot achtentwintig " +
        "seconden naar niets. De lijst komt nu meteen, en werkt zichzelf een paar tellen later bij.",
    },
  ],
};

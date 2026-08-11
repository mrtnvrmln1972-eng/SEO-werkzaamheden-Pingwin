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
  ],
};

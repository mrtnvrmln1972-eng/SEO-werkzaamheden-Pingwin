import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  titel: "Onderhoud: wekelijks en maandelijks",
  waarvoor: "Vijf minuten per week, zodat je nooit meer een dag kwijtraakt aan iets dat sluimerde.",
  tips: [
    {
      titel: "Wekelijks: het weekverbruik checken",
      tekst:
        "Met /usage in Claude Code zie je of de weeklimiet van je abonnement vol raakt. Staat hij op 100%, dan is al "
        + "het werk tot de reset betaald werk; kan iets wachten, wacht dan.",
    },
    {
      titel: "Wekelijks: sessies opruimen",
      tekst:
        "Een sessie die vastzit op een goedkeuringsvraag of met een fout stopte, blijft anders onopgemerkt liggen. "
        + "Loop de sessielijst kort langs en sluit af wat klaar is.",
    },
    {
      titel: "Maandelijks: connectors en skills nakijken",
      tekst:
        "Dook er een nieuwe connector op die je niet hebt aangezet? Staat er nog een oude skill dubbel op claude.ai "
        + "naast de repo-versie, die dan ten onrechte wint?",
    },
    {
      titel: "Maandelijks: dit lijstje zelf",
      tekst:
        "Loop je tegen iets aan dat hier nog niet in staat, zeg dan tegen Claude: \"zet dit er ook bij\". Dat is "
        + "precies hoe dit scherm groeit, en het kost je één zin.",
    },
  ],
};

import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  titel: "Voelt een sessie traag? Check dit eerst",
  waarvoor: "Meestal staat hij stil in plaats van dat hij nadenkt, en dat zie je aan iets anders.",
  tips: [
    {
      titel: "Staat er een goedkeuringsvraag open?",
      tekst:
        "Een sessie die \"al tien minuten bezig is\" kan gewoon wachten op een klik op een toestemmingsvraag. Dat is "
        + "geen denktijd. Kijk of er iets op goedkeuring wacht voordat je concludeert dat Claude traag is.",
    },
    {
      titel: "Verse container, verse kloon",
      tekst:
        "De eerste minuut van een nieuwe sessie gaat op aan het klaarzetten van de omgeving. De starthook zorgt "
        + "ervoor dat elke sessie automatisch op de laatste code begint.",
    },
    {
      titel: "Is dit al de tweede poging?",
      tekst:
        "Een eerdere sessie met dezelfde naam die met een fout stopte, is geen goed teken voor de herstart. Check de "
        + "sessielijst voordat je aanneemt dat het aan het model ligt.",
    },
    {
      titel: "Een ronde die groen kleurt heeft niet per se iets gedaan",
      tekst:
        "Een nachtronde kan starten, alles overslaan en toch \"geslaagd\" melden. Staat een punt na een ronde nog op "
        + "\"nog niet begonnen\", dan is er iets mis, ook al zag je een balk lopen. Sinds 15 augustus laat een "
        + "vastgelopen ronde een regel achter in het draadje bij het punt, dus kijk daar eerst.",
      waar: "/admin/grote-punten",
      geleerd: "15 augustus 2026",
    },
  ],
};

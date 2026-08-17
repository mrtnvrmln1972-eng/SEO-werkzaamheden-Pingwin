import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De werklijst voor de sitebouwer",
    kern: "Eén link, alleen zijn eigen werk, geen inlog nodig.",
    tekst:
      "Wie de site bouwt heeft geen dashboard nodig, alleen zijn lijstje. Daarom is er een deelbare link " +
      "zonder inlog met precies de punten die hij moet afwerken, bijvoorbeeld de suggesties over beeld.\n\n" +
      "Dezelfde lijst heeft in de cockpit een tweede gezicht, met de huidige tekst boven het voorstel, de " +
      "knop om het rechtstreeks in de site te zetten, en de keuze of een afbeelding uniek moet zijn.\n\n" +
      "Waarom die splitsing er is: eerst stond alles per pagina uitgeklapt onder elkaar en was vrijwel elke " +
      "regel geblokkeerd tot iemand een foto verving. Dat werd een muur van tientallen schermen hoog waar " +
      "niemand aan begon.\n\n" +
      "**Sinds 6 augustus 2026 staat het paginawerk er ook op.** Zet je een projectkaart door met de knop " +
      "\"Zet klaar voor de sitebouwer\", dan kiest een venster wat hij krijgt: de opdracht in jouw woorden, welke " +
      "teksten meegaan (de herziene versie van de klant of onze eigen copy, dat is een keuze) en wat er straks " +
      "meetbaar af moet zijn. Dat verschijnt als eigen blok op ditzelfde adres, boven de meta- en alt-teksten.\n\n" +
      "Dat keuzevenster zweeft sinds 15-08-2026 midden op het scherm met ruimte eromheen, in plaats van dat het " +
      "met de bovenkant onder de kopbalk bleef hangen. Past de inhoud niet, dan scrolt hij vanbinnen en blijft " +
      "de kop met het kruisje staan.\n\n" +
      "Dat was een gat: een doorgezette kaart belandde op een scherm achter de inlog, terwijl de deelbare lijst " +
      "alleen losse velden bevatte. Zijn grootste werk stond dus op een plek waar hij niet komt. Ook met een " +
      "WordPress-koppeling blijft dit blok staan, want een hele pagina live zetten kan geen knop van ons.",
  },
  {
    titel: "Het taakvenster van de developer",
    kern: "Jouw opmerking is jouw veld, de kruisjes halen echt iets weg, en weghalen kan uit de rij.",
    tekst:
      "Open je een taak in de developerlijst, dan zie je wat er moet gebeuren, jouw opmerking erbij, de pagina " +
      "en de documenten die meegaan. Sinds 17 augustus 2026 zijn daar drie dingen recht gezet die alle drie " +
      "onzichtbaar waren tot je het venster echt opende.\n\n" +
      "**\"Opmerking voor de developer\" is jouw veld en begint leeg.** Er stond automatisch de bouw-regel in " +
      "die de chat bij de projectkaart had bedacht, dus je opende het venster met een lap tekst die je eerst " +
      "moest weggooien voordat je zelf iets kwijt kon. Die kaarttekst staat nu als eigen, rustig blok erboven " +
      "(\"Uit de kaart in de weekplanning\"), netjes opgemaakt en dus ook leesbaar voor de sitebouwer, met een " +
      "knop \"Overnemen\" als je hem juist wél als basis wilt gebruiken.\n\n" +
      "**Het kruisje bij een document haalt hem er nu echt af.** Het deed niets, en om twee redenen tegelijk: " +
      "de meeste documenten zijn niet zelf toegevoegd maar door het dashboard bij de pagina gevonden (de " +
      "pagina, de copy, de blauwdruk, de analyse), en die worden elke keer opnieuw gevonden; en het weghalen " +
      "werd bewaard op een manier die alleen werkte als de taak al eerder was gesleept of ingepland. Elke " +
      "taak houdt nu bij welke documenten er níet meer bij horen. Het document zelf blijft gewoon bestaan en " +
      "blijft bij de pagina staan; alleen deze ene taak draagt hem niet meer mee.\n\n" +
      "**Een taak van de lijst halen kan uit de rij zelf.** Naast \"Bekijk\", \"Mail\" en \"Controleer\" staat " +
      "nu \"Van de lijst\" (bij een taak die je hier zelf aanmaakte: \"Weggooien\"), met dezelfde vraag om " +
      "bevestiging als in het venster. Een zelf aangemaakte taak bestaat alleen daar en gaat echt weg; een " +
      "doorgezette kaart gaat alleen van de developerlijst af en blijft in de weekplanning staan. Daarvoor " +
      "moest je voor de meest gebruikte handeling eerst een venster openen.",
  },
];

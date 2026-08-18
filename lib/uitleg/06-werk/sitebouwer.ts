import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De werklijst voor de sitebouwer",
    kern: "Eén link, alleen zijn eigen werk, geen inlog nodig. Sinds 18 augustus 2026 gaat hij alleen nog over beeld.",
    tekst:
      "Wie de site bouwt heeft geen dashboard nodig, alleen zijn lijstje. Daarom is er een deelbare link " +
      "zonder inlog met precies de punten die hij moet afwerken.\n\n" +
      "**De lijst gaat over alt-teksten, niet over meta's (18 augustus 2026).** Een alt-tekst beschrijft wat er " +
      "op een foto te zien is, en die ontbreken op tientallen pagina's tegelijk; dat wordt nooit een stapel " +
      "losse kaartjes, dus daar is deze lijst voor. Meta-titles en -descriptions stonden er ook op, en dat is " +
      "eruit: die maak en keur je op het tabje Meta & CTR, en dáár staat ook de knop om ze op de site te " +
      "zetten. Dezelfde goedkeuring op twee schermen, met op allebei een doorvoerknop, betekent dat je nooit " +
      "weet welke telt.\n\n" +
      "**Het Word-document is er ook uit.** De lijst werd tot die dag óók als document in Drive gezet. Een " +
      "lijst van tientallen regels in een document leest niemand, en afvinken kan er niet in. De afvinkpagina " +
      "kan alles wat het document kon, plus bijhouden wat af is en of het echt op de site staat.\n\n" +
      "Dezelfde lijst heeft in de cockpit een tweede gezicht, met de knop om een alt-tekst rechtstreeks in de " +
      "mediabibliotheek te zetten, en de keuze of een afbeelding uniek moet zijn. Daar staat ook een ruw " +
      "signaal per pagina: hoeveel foto's laten het onderwerp van die pagina zien.\n\n" +
      "Waarom die splitsing er is: eerst stond alles per pagina uitgeklapt onder elkaar en was vrijwel elke " +
      "regel geblokkeerd tot iemand een foto verving. Dat werd een muur van tientallen schermen hoog waar " +
      "niemand aan begon.\n\n" +
      "**Sinds 6 augustus 2026 staat het paginawerk er ook op.** Zet je een projectkaart door met de knop " +
      "\"Zet klaar voor de sitebouwer\", dan kiest een venster wat hij krijgt: de opdracht in jouw woorden, welke " +
      "teksten meegaan (de herziene versie van de klant of onze eigen copy, dat is een keuze) en wat er straks " +
      "meetbaar af moet zijn. Dat verschijnt als eigen blok op ditzelfde adres, boven de alt-teksten.\n\n" +
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
      "**De opmerking staat niet in de lijst, maar achter een linkje (18 augustus 2026).** Bij een taak met " +
      "een opmerking staat nu \"Bekijk de opmerkingen\"; dat opent de taak. Er stond een klein stipje dat " +
      "hetzelfde bedoelde, en dat zag niemand. De tekst zelf blijft uit de lijst, want zo'n opmerking is vaak " +
      "een half scherm instructie en dan is de lijst geen lijst meer. **In het opmerkingenveld kun je een " +
      "afbeelding of document slepen**: dat gaat naar de Drive-map van deze klant en hangt daarna bij " +
      "\"Documenten en bestanden\" van die taak, dezelfde plek als de knop eronder. Bewaar de taak wel eerst, " +
      "anders is er nog niets om het aan te hangen.\n\n" +
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
      "**Een taak van de lijst halen kan uit de rij zelf, met een kruisje.** Achter \"Bekijk\", \"Mail\" en " +
      "\"Controleer\" staat een kruisje, precies zoals overal in het dashboard waar je een regel weghaalt, met " +
      "dezelfde vraag om " +
      "bevestiging als in het venster. Een zelf aangemaakte taak bestaat alleen daar en gaat echt weg; een " +
      "doorgezette kaart gaat alleen van de developerlijst af en blijft in de weekplanning staan. Daarvoor " +
      "moest je voor de meest gebruikte handeling eerst een venster openen.",
  },
];

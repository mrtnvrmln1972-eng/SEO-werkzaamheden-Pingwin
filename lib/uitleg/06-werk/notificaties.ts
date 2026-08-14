import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Als de sitebouwer iets afvinkt, weet je het meteen",
    kern: "Een melding in de kopbalk in plaats van een mailtje.",
    tekst:
      "De sitebouwer werkt in haar eigen deel van het dashboard en vinkt daar af wat af is. Tot 6 augustus " +
      "2026 gebeurde er dan niets zichtbaars: de status ging stil de database in, en zij moest er een mail bij " +
      "sturen om het te laten weten. Dat mailtje was dus werk dat het dashboard zelf had kunnen doen.\n\n" +
      "Nu verschijnt het als **melding in de kopbalk**, op elk beheerscherm, met een oranje telletje zolang je " +
      "het nog niet gezien hebt. In de melding staat welke klant, welke taak, en de terugkoppeling die zij erbij " +
      "typte. Klik erop en je staat bij de taak.\n\n" +
      "Drie keuzes die het rustig houden:\n\n" +
      "- **Openklappen is lezen.** Geen aparte knop \"markeer als gelezen\"; dat is een handeling erbij die " +
      "niets oplevert. Er wordt één moment onthouden: tot wanneer je gekeken hebt.\n" +
      "- **Ontvinken haalt de melding weg.** Anders blijft er staan dat iets af is terwijl dat niet meer zo is.\n" +
      "- **Je eigen vinkje geeft geen melding**, en de sitebouwer ziet deze meldingen niet: het zijn er niet " +
      "twee van, het is er één, voor de eigenaar.\n\n" +
      "Wat er nog niet is: een mail of telefoonmelding als je het dashboard een dag niet opent. Dat kan erbij, " +
      "maar bewust nog niet gedaan; eerst kijken of het belletje volstaat.\n\n" +
      "**De mailknop bij een taak verstuurt sinds 11 augustus 2026 vanuit het dashboard zelf.** Daarvoor " +
      "sprong hij naar je eigen mailprogramma, en dat werkt alleen zolang er in díe browser een mailprogramma " +
      "aan mailadressen gekoppeld is. Viel dat weg, dan gebeurde er letterlijk niets: geen venster, geen " +
      "melding, geen foutje. De knop leek stuk terwijl er niets aan veranderd was. Nu opent hetzelfde " +
      "mailvenster als overal elders in het dashboard, met de klant, de taak, de pagina en de documenten er al " +
      "in, en verstuurt hij via de mailkoppeling. Het adres staat erboven en is aan te passen (je onthoudt " +
      "wie je er de vorige keer voor pakte), want de één mailt zijn sitebouwer en de ander mailt juist terug. " +
      "Is er geen mailkoppeling, dan biedt hetzelfde venster \"open in mailprogramma\" en \"kopieer mailtekst\" " +
      "aan, dus je staat nooit voor een dood knopje.\n\n" +
      "Diezelfde constructie stond op drie plekken los in de code, dus dezelfde storing lag drie keer klaar. " +
      "Ze lopen nu allemaal over één stukje code, en een proef bij elke bouw houdt tegen dat er een nieuwe " +
      "mailknop bijkomt die stilzwijgend niets kan doen.",
  },
];

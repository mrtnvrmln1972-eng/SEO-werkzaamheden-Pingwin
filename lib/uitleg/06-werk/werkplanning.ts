import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Het werkplan: drie maanden werk, per week, geclusterd",
    kern: "Fases, genummerde blokken werk, en per blok wat er aan de hand is, wat je doet en wat het moet opleveren.",
    tekst:
      "Op een site met duizenden pagina's levert de analyse honderden losse signalen op. Als je die " +
      "als lijst toont, hoe netjes ook gesorteerd, kun je er geen plan uit trekken. Dat is twee keer " +
      "geprobeerd en twee keer mislukt: eerst als vier lange lijsten, daarna als 372 signalen in 173 " +
      "groepen, wat dezelfde lijst is met tussenkopjes erin.\n\n" +
      "**Wat er nu staat is een plan.** Bovenaan drie fases, daaronder genummerde blokken werk, en " +
      "elk blok is één zitting van een paar uur met een weeknummer en een tijd erop. Een blok dat " +
      "dicht staat vertelt al wat het is: nummer, naam, week, tijd, en in één zin wat er met welke " +
      "pagina's gebeurt.\n\n" +
      "**Er zijn precies drie niveaus, en je bereikt alles met hooguit twee klikken.** De fase is een " +
      "kopje dat altijd zichtbaar is. Eén klik opent een blok: wat er aan de hand is, hoe het nu staat " +
      "tegenover wat het moet worden, en per pagina één regel. Nog een klik opent die regel: de " +
      "onderbouwing, de zoekterm, de positie, en wat er nu in het zoekresultaat staat. Dieper is er niet.",
  },
  {
    titel: "Waarom een blok werk en niet een los signaal",
    kern: "Ga je Amsterdam opruimen, dan raak je zes pagina's aan en doe je zes verschillende dingen. Dat is één blok.",
    tekst:
      "Werk hoort op een site bij elkaar per **onderwerp**, niet per handeling. Ga je \"Amsterdam\" " +
      "opruimen, dan raak je in één zitting zes pagina's aan: één blijft en wordt de hoofdpagina, drie " +
      "gaan daarin op, één wordt weggegooid, één krijgt een nieuwe titel. Dat is één blok werk, geen " +
      "zes taken verspreid over een lijst.\n\n" +
      "Dat blok hoefde niet verzonnen te worden, het stond al in de data: de opruim-motor geeft per " +
      "regel een groep mee, en dat is precies een plaats of een onderwerp. Daar komen drie dingen " +
      "bovenop.\n\n" +
      "**Alles hangt aan elkaar.** Een titel-kans op `/soa-test-amsterdam/` hoort bij het blok " +
      "Amsterdam, niet in een aparte lijst van 236 losse meta-regels. Kansen op pagina's die nergens " +
      "in een blok zitten worden alsnog gebundeld op pagina-familie, zodat het er nooit weer honderden " +
      "losse regels worden.\n\n" +
      "**Werk dat geen werk is, verdwijnt zichtbaar.** Een titel verbeteren op een pagina die volgende " +
      "week wordt samengevoegd of weggegooid is weggegooid werk. Zulke kansen vervallen, met de reden " +
      "erbij onderaan het blok, in plaats van dat ze als taak in je planning belanden.\n\n" +
      "**En er zit een volgorde in.** Fase 1 is de structuur: uitzoeken welke pagina van een onderwerp " +
      "wint en de rest daarheen omleiden. Fase 2 is de inhoud: die winnaars sterk maken en de gaten " +
      "vullen. Fase 3 is het laaghangend fruit: titels en descriptions. Die volgorde is geen smaak. " +
      "Andersom optimaliseer je pagina's die je een week later doorstuurt.",
  },
  {
    titel: "Filteren, zoeken en er taken van maken",
    kern: "Eén stuurbalk voor de hele pagina, en één knop per blok in plaats van een knop per regel.",
    tekst:
      "**Bovenaan staat één stuurbalk die de hele pagina filtert.** Een zoekveld, een knop per soort " +
      "werk met het aantal erop, en het urenbudget. Zet je het budget van 3 op 6 uur, dan herverdeelt " +
      "het hele plan zich meteen over minder weken.\n\n" +
      "**Een filter laat blokken weg, hij haalt geen pagina's uit een blok.** Dat is met opzet: een " +
      "blok is één zitting werk, en de helft ervan wegfilteren maakt het onuitvoerbaar. De stuurbalk " +
      "zegt dat er ook bij, zodat je nooit denkt dat je alles ziet terwijl er wat weg is.\n\n" +
      "**Eén knop per blok, geen knop per regel.** De vorige versie zette een oranje knop bij elke " +
      "groep en nog een knopje bij elke pagina. Bij honderd groepen zijn dat honderd oranje knoppen " +
      "onder elkaar, en dan is geen enkele knop meer de belangrijkste. Nu staat er precies één " +
      "hoofdknop onderaan een blok: \"Zet dit blok in de planning\". Die maakt van alle pagina's in " +
      "het blok in één keer taken, in de volgorde waarin ze gedaan moeten worden.\n\n" +
      "**En je kunt terug.** Onder \"Taken die al in de planning staan\" haal je een taak met één klik " +
      "weer weg. Een blok dat al taken heeft lopen, zegt dat op de kaart zelf, zodat je er niet per " +
      "ongeluk een tweede set van maakt.\n\n" +
      "De tijd per handeling verschilt: een omleiding zetten kost een kwartier, een pagina uitbouwen " +
      "twee uur, een nieuwe pagina drie. Eerst stond alles op een vaste dertig minuten, en daarmee " +
      "klopte geen enkele weekplanning.",
  },
];

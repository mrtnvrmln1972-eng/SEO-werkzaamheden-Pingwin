import type { Uitklapper } from "../types";

// Golf 1: de bestaande motoren volwaardig maken (R1 tot R4).

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Golf 1: de bestaande motoren volwaardig maken",
    kern: "Vier punten waar het fundament er al ligt en er één ontbrekend stuk data tussen zit.",
    tekst:
      "Dit is de goedkoopste winst die er is: vier motoren die al draaien en op één punt op een benadering " +
      "leunen. Er hoeft niets nieuws bedacht te worden, alleen aangesloten.\n\n" +
      "| Punt | Wat het is | Verhouding |\n" +
      "|---|---|---|\n" +
      "| **R1** | Autoriteit per pagina aansluiten | ✅ af op 6 augustus 2026 |\n" +
      "| **R2** | Prioriteren op conversies in plaats van klikken | ✅ af op 7 augustus 2026 |\n" +
      "| **R3** | AI-vindbaarheid op onderwerpniveau | Middel werk, groot verkoopeffect |\n" +
      "| **R4** | Verbruik compleet: de Ahrefs-credits erbij | ✅ af op 8 augustus 2026 |",
    sub: [
      {
        titel: "R1. Autoriteit per pagina aansluiten — af op 6 augustus 2026",
        tekst:
          "**Klaar.** De interne-links-motor weegt bronpagina's niet langer op een benadering uit de eigen " +
          "linkgraaf, maar op de gemeten autoriteit van elke losse pagina uit Ahrefs. Bij elke voorgestelde " +
          "bronpagina staat het cijfer met de datum, en of het gemeten is of benaderd.\n\n" +
          "De volledige beschrijving staat nu in het hoofdstuk **Interne links: autoriteit gericht " +
          "doorsturen**, want het is werkelijkheid en geen plan meer. Wat hier blijft staan is waarom het " +
          "erop stond: dit was het enige gat in een motor die verder al af was, en juist het advies \"link " +
          "vanaf deze vijf pagina's\" geeft het snelst resultaat bij pagina's die net buiten de top staan.",
      },
      {
        titel: "R2. Prioriteren op conversies in plaats van op klikken",
        tekst:
          "**Wat er nu mis is.** Als het dashboard uitrekent wat een verbetering oplevert, rekent het in extra " +
          "bezoekers. Maar bezoekers zijn niet waar de klant voor betaalt; hij betaalt voor aanvragen. Twee " +
          "pagina's kunnen even vaak in Google verschijnen terwijl de ene tien keer zo veel klanten oplevert " +
          "als de andere, en dat verschil zie je nu nergens in de volgorde van het werk. De koppeling met " +
          "Google Analytics ligt er al en weet ook al hoeveel aanvragen de site in totaal binnenhaalt, maar " +
          "nog niet welke pagina daarvoor zorgde. En bij het bepalen van de volgorde wordt er helemaal niet " +
          "naar gekeken.\n\n" +
          "**Wat het oplevert.** Dit is het punt met het grootste effect van de hele lijst, om drie redenen.\n\n" +
          "- **Je werkt aan de pagina's die geld opleveren.** Nu bepaalt bezoek de volgorde van je werk, " +
          "straks bepaalt opbrengst hem. Een pagina waar mensen echt contact opnemen schuift naar boven; een " +
          "pagina die alleen gelezen wordt en niets oplevert zakt naar beneden.\n" +
          "- **Je hebt een ander gesprek met de klant.** In plaats van \"dit levert extra bezoekers op\" kun " +
          "je zeggen: \"deze aanpassing levert naar verwachting acht aanvragen per maand op\". Dat is het " +
          "gesprek waarin een klant makkelijker ja zegt tegen een hoger budget, omdat hij ziet wat hij ervoor " +
          "terugkrijgt.\n" +
          "- **Je kunt eerlijk nameten wat het opleverde.** Het dashboard meet nu al per aanpassing hoe een " +
          "pagina het deed vóór en ná de wijziging. Daar komt dan de enige uitkomst bij die echt telt: kwamen " +
          "er ook meer aanvragen binnen?\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. Per pagina bij Google Analytics ophalen hoeveel aanvragen er binnenkwamen. Niet elke klant heeft " +
          "dat ingericht, dus zonder die gegevens moet alles gewoon blijven werken zoals het nu werkt.\n" +
          "2. Per klant twee dingen vastleggen: wat is bij deze klant een aanvraag (een ingevuld formulier, een " +
          "telefoontje, een bestelling), en wat is zo'n aanvraag gemiddeld waard? Twee velden bij de " +
          "klantgegevens, en leeg laten mag: dan blijft het onbekend.\n" +
          "3. De verwachte opbrengst omrekenen naar aanvragen: hoeveel extra bezoekers verwachten we, welk " +
          "deel daarvan neemt op déze pagina contact op, en wat is dat waard? Weten we de waarde niet, dan " +
          "blijft de oude rekenwijze staan en zegt het dashboard er zichtbaar bij dat het over bezoekers gaat.\n" +
          "4. Overal dezelfde eenheid op het scherm: verwachte aanvragen per maand, en als de waarde bekend is " +
          "ook het bedrag.\n\n" +
          "**Waaraan je ziet dat het af is.** Bij een klant waar aanvragen gemeten worden, staat de lijst met " +
          "prioriteiten in een andere volgorde dan wanneer je alleen naar bezoek kijkt, en staat bij elk punt " +
          "hoeveel aanvragen het naar verwachting oplevert. Bij een klant zonder die gegevens is er niets " +
          "veranderd, met een regel erbij waarom.\n\n" +
          "**Wat het raakt.** Dit verandert de lijst met prioriteiten, het formulier met klantgegevens, het " +
          "scherm met resultaten en de meting van wat een aanpassing opleverde. Belangrijk daarbij: het aantal " +
          "aanvragen per pagina wordt op één plek berekend, en alle andere schermen halen het daar op. Wordt " +
          "het op twee plekken gerekend, dan gaan die twee vroeg of laat verschillende getallen tonen.",
      },
      {
        titel: "R3. AI-vindbaarheid op onderwerpniveau",
        tekst:
          "**Wat er nu mis is.** De AI-lens weet één ding: in hoeveel AI-antwoorden een domein voorkomt. Dat " +
          "is een thermometer, geen advies. Je kunt er niet uit halen op welke vragen de klant ontbreekt, wie " +
          "er dan wél genoemd wordt, en welke pagina daarvoor gemaakt of aangepast moet worden.\n\n" +
          "**Wat het oplevert.** Dit is de vraag die bij klanten het snelst groeit en waar bijna geen bureau " +
          "een antwoord op heeft. Het is dus zowel de zwakste lens als de sterkste verkoopkans op deze lijst. " +
          "Met onderwerpniveau erbij wordt het een volwaardige vijfde motor naast meta, opruimen, interne " +
          "links en zoekwoordkansen.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. Per klant een set vragen vastleggen zoals een klant ze aan een AI zou stellen. Die vragen " +
          "volgen uit de zoekwoordenlijst die er al is, dus dit kan voorgesteld worden in plaats van " +
          "uitgevraagd.\n" +
          "2. Per vraag ophalen: wordt de klant genoemd, welke bronnen worden aangehaald, en welk aandeel " +
          "heeft de klant in het geheel. Bij Ahrefs zit dit in de AI-rapportage; de koppeling die we al " +
          "gebruiken voor het aantal antwoorden kan dit ook leveren.\n" +
          "3. Historie bewaren, want de waarde zit in de beweging: op welke vragen komen we op, waar zakken " +
          "we weg.\n" +
          "4. De uitkomst doorzetten naar werk: een vraag waarop de klant ontbreekt terwijl er wel bronnen " +
          "worden aangehaald is een vragen-en-antwoorden-blok of een nieuwe pagina, en dat is een bevinding in " +
          "de prioriteitenscan met een knop naar de bestaande documentenketen.\n\n" +
          "**Waaraan je ziet dat het af is.** Er is een lijst vragen per klant met per vraag: genoemd of niet, " +
          "wie er wel genoemd wordt, en de beweging over tijd. En minstens één bevinding uit die lijst is via " +
          "de gewone weg (kaart met knop) een taak of een document geworden.\n\n" +
          "**Wat het raakt.** Dit verandert de lijst met prioriteiten, waar AI-vindbaarheid dan een volwassen " +
          "onderdeel wordt naast de andere vier. Verder raakt het de afgesproken zoekwoorden, het scherm met " +
          "het verbruik, en het verhaal dat je de klant elke maand vertelt.",
      },
      {
        titel: "R4. Verbruik compleet: de Ahrefs-credits erbij — af op 8 augustus 2026",
        tekst:
          "**Klaar.** Ahrefs-verbruik krijgt nu een echt bedrag zodra er een prijs per unit is ingesteld, en " +
          "het verbruiksscherm laat per klant per maand één totaal zien dat AI en Ahrefs samen dekt, met de " +
          "duurste actie van die maand erbij en de verhouding tot het maandbudget van de klant.\n\n" +
          "De volledige beschrijving staat nu in het hoofdstuk **Bedrijfsvoering: geld, verbruik en team**, " +
          "bij **Verbruik en kosten per actie**, want het is werkelijkheid en geen plan meer. Wat hier blijft " +
          "staan is waarom het erop stond: zonder dit cijfer kon je niet zeggen wat een klant in dit systeem " +
          "kost, en dus ook niet wat een bureau ervoor zou moeten betalen.",
      },
    ],
  },

  // ── Golf 2 ──
];

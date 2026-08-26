import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De werkplanning groepeert, hij somt niet op",
    kern: "Eén stuurbalk filtert de hele pagina, en losse regels worden groepen met een titel die zegt wat er gebeurd is.",
    tekst:
      "De werkplanning van een klant laat drie dingen naast elkaar zien: wat er recent gebeurd is, wat er " +
      "gesignaleerd is maar nog geen taak is, en wat er de komende weken gepland staat op het urenbudget. " +
      "Alle drie kwamen uit het dashboard zelf, en alle drie waren het lange lijsten. Elk regeltje klopte, " +
      "maar samen was het onleesbaar: 38 doorstuuradressen onder elkaar, zes mails over dezelfde factuur, " +
      "twaalf stadspagina's die stuk voor stuk hetzelfde verhaal vertelden.\n\n" +
      "**Er is nu één stuurbalk bovenaan, en die filtert de héle pagina.** Niet een filtertje per blok. Kies " +
      "**Cannibalisatie** en alles eronder gaat over cannibalisatie: wat er gebeurd is, wat er gesignaleerd " +
      "is, wat er gepland staat. Op elke knop staat hoeveel erachter zit, en een knop zonder werk erachter " +
      "is uitgeschakeld. Het zoekveld ernaast werkt hetzelfde: één veld, alle blokken tegelijk, alle woorden " +
      "moeten voorkomen. Zoek op een stad en je ziet in één keer alles wat er met die stad te maken heeft.\n\n" +
      "**Er wordt eerst gefilterd en daarna pas gegroepeerd.** Dat klinkt als een detail maar is het niet: " +
      "zoek je op één stad, dan zegt de groep eerlijk \"3 oude adressen doorgestuurd\" in plaats van 38 met " +
      "drie regels erin.\n\n" +
      "**Elke groep krijgt een titel die zegt wat er gebeurd is**, met daaronder waar het over ging en " +
      "wanneer. Dus \"38 oude adressen doorgestuurd\" met daaronder \"SOA-test-pagina's, 12 pagina's, " +
      "3 t/m 5 augustus\", in plaats van 38 keer het woord redirect. Alles staat standaard dicht, ook de " +
      "groepen zelf, zodat het scherm begint als vier regels en je openklapt wat je nodig hebt.",
  },
  {
    titel: "Hoe het dashboard bepaalt wat bij elkaar hoort",
    kern: "Op gesprek, op pagina-familie of op de pagina zelf; administratie zakt naar onderen als ruis.",
    tekst:
      "Het samenvoegen gebeurt op drie manieren, in deze volgorde. Er komt geen AI aan te pas, dus het is " +
      "elke keer hetzelfde en het kost niets.\n\n" +
      "**1. Mail, op gesprek.** Een mailwisseling is één gesprek, ook als er zes keer \"Re:\" of \"Fwd:\" " +
      "voor staat. Die aanhef wordt eraf gehaald, net als een tag als [EXTERN] die een mailserver ervoor " +
      "plakt, en wat overblijft is het onderwerp. De groep heet dan \"Mailwisseling: (onderwerp)\" en zegt " +
      "eronder hoeveel er verstuurd en hoeveel er ontvangen is.\n\n" +
      "**2. Pagina-familie, op de gedeelde start van het adres.** `/soa-test-amsterdam/` en " +
      "`/soa-test-utrecht/` zijn dezelfde soort pagina, dus één handeling die daar twaalf keer overheen ging " +
      "is één regel. `/soa-test/amsterdam/` met een schuine streep telt als dezelfde familie, want voor een " +
      "lezer is dat hetzelfde. Een gedeeld begin moet wel wat voorstellen: minstens vijf letters. Daardoor " +
      "worden `/over-ons/` en `/over-onze-werkwijze/` niet samengevoegd op het woord \"over\", want dat zegt " +
      "niets over waar een pagina over gaat.\n\n" +
      "**3. Losse pagina, op de pagina zelf.** Een pagina die geanalyseerd, herschreven en live gezet is, is " +
      "één verhaal over die pagina, en staat er dus als één regel met de paginanaam. Blijven er daarna nog " +
      "veel losse pagina's over met precies één handeling van dezelfde soort, dan worden die vanaf drie " +
      "stuks alsnog één regel, anders staat het overzicht er weer vol mee.\n\n" +
      "**Ruis zakt naar onderen.** Twee dingen horen wel in het logboek maar niet tussen het werk waarop je " +
      "je planning baseert: mail over facturatie, afspraken en inloggegevens, en paginawijzigingen die het " +
      "dashboard zelf op de site zag gebeuren (die komen vaak van de klant). Die staan onder een kopje " +
      "**Ruis en achtergrond** onderaan, dicht. Factuurmails worden bovendien op thema samengevoegd en niet " +
      "op onderwerpregel, want \"Factuur augustus\" en \"Betalingsherinnering\" is hetzelfde gedoe.",
  },
  {
    titel: "Van een groep signalen naar taken, in één klik",
    kern: "Elke groep is een opdracht met een aantal, een geschatte tijd en één knop die er taken van maakt.",
    tekst:
      "Bij **Gesignaleerd, nog geen taak** stond eerst een lijst pagina's met een label ernaast. Daar kun je " +
      "niets mee: een label is geen opdracht, en pagina voor pagina op \"maak taak\" klikken is geen werken.\n\n" +
      "Elke groep is nu een opdracht met een aantal erin: **\"12 pagina's samenvoegen\"**, met daaronder waar " +
      "het over gaat, waar ze naartoe gaan en hoeveel zoekopdrachten per maand er samen achter zitten. Daar " +
      "staat ook de **geschatte tijd** bij, zodat je meteen ziet of het in het budget van deze week past.\n\n" +
      "**De onderbouwing die alle pagina's in een groep delen staat één keer bovenaan**, onder het kopje " +
      "\"Waarom dit cluster bij elkaar hoort\", in plaats van twaalf keer herhaald. Wat alleen voor één " +
      "pagina geldt, blijft achter het linkje **onderbouwing** bij die pagina staan.\n\n" +
      "**En er is één knop die van de hele groep taken maakt.** Dat is waar het groeperen voor is: één " +
      "beslissing, één klik. Wil je er toch maar één, dan staat naast elke pagina nog **Alleen deze**. " +
      "Taken die je zo maakt komen in Het plan terecht en verdwijnen vanzelf uit Gesignaleerd, want dat " +
      "toont alleen wat nog geen taak is.\n\n" +
      "De groepen staan op volgorde van wat ze waard zijn: het meeste zoekvolume bovenaan.",
  },
];

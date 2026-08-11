import type { Uitklapper } from "../types";

// De prioriteitenscan: welke kans eerst.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De prioriteitenscan: dit eerst, dat later, dit niet",
    kern: "Site-breed, in vier tiers, met verwachte opbrengst per bevinding.",
    tekst:
      "Dit is de motor die van een berg signalen een werkplan maakt. Hij kijkt site-breed en levert vier " +
      "bakjes op: deze week, deze maand, dit kwartaal, strategisch. Plus een vijfde bakje: niet doen, met de " +
      "reden erbij.\n\n" +
      "Twee dingen zijn hier expliciet zo gebouwd:\n\n" +
      "1. **De vier lenzen die al als motor in het dashboard draaien (meta en CTR, opruimen, interne links, " +
      "AI-vindbaarheid) worden uitgevraagd, niet opnieuw opgehaald.** Anders staat hetzelfde cijfer op twee " +
      "tabjes verschillend, en dat is precies de fout die dit dashboard wil uitsluiten.\n" +
      "2. **De scan draait in hervatbare stappen met een tussenstand na elke stap.** Serverless kapt een lang " +
      "venster af, en dan stond een analyse veertig minuten op 'bezig' zonder ooit iets op te leveren. Nu " +
      "pakt een achtergrondwerker een run zonder hartslag gewoon weer op.\n\n" +
      "**De volgorde op het scherm komt uit de kansrijkheid, niet uit het zoekvolume** (6 augustus 2026). " +
      "Zoekvolume maal klikkans weet niet of iemand wil kopen en niet of een zoekwoord bij deze klant past; " +
      "daarmee stond bij een hovenier het landelijke woord 'voortuin' bovenaan. De kolom Kansrijk (1 tot 100) " +
      "weegt de te winnen bezoekers, de koopgerichtheid, de merk-fit en de hoeveelheid werk samen, en bepaalt " +
      "nu de volgorde. Honderd is de beste kans van díe scan, dus het is een onderlinge vergelijking en geen " +
      "rapportcijfer.\n\n" +
      "**De mail aan de klant is een gewone mail, geen rapport** (6 augustus 2026). Hij ging eerst langs de " +
      "opgemaakte weg, met een oranje kopbalk en vier vaste kaders, en las daardoor als een reclamemail uit een " +
      "tool. Nu is het een persoonlijke mail: aanhef, korte alinea's, ondertekening onderaan. Drie dingen zorgen " +
      "dat hij niet alsnog een sjabloon wordt. **Eén:** het dashboard leidt uit Maartens eigen verzonden mails " +
      "aan klanten een schrijfprofiel af, dat in élke klantmail meegaat (te lezen en bij te stellen op " +
      "`/admin/schrijfstijl`; mails aan collega's en mails die het dashboard zelf schreef tellen niet mee). " +
      "**Twee:** de mail krijgt de klantkennis mee die er al is, dus de propositie, het werkgebied, de diensten " +
      "en de concurrenten, met de opdracht er één concreet ding uit te noemen en niets bij te verzinnen. " +
      "**Drie:** per mail wordt een andere invalshoek gekozen (de zoekvraag, hun eigen site, wie de zoeker is, " +
      "de concurrentie) en een ander stuk werkwijze genoemd; wat een klant al gehad heeft wordt onthouden. " +
      "Zonder dat laatste openen tien nieuwe-pagina-mails alle tien hetzelfde, en dat is precies het risico " +
      "wanneer 36 van de 50 kansen van dezelfde soort zijn.\n\n" +
      "**Elke kans heeft een onderbouwing in klanttaal:** wat we zagen, waarom het de moeite waard is, wat we " +
      "gaan doen en wat het kan opleveren. Die ene tekst voedt drie plekken (het scherm, de kaart in de " +
      "weekplanning en de mail aan de klant), zodat er geen drie versies van hetzelfde verhaal ontstaan.",
    sub: [
      {
        titel: "Hoe een bevinding gescoord wordt",
        tekst:
          "Elke bevinding krijgt een score uit vier onderdelen:\n\n" +
          "- **Verwachte opbrengst.** Hoeveel extra klikken kan dit realistisch opleveren? Dat wordt gerekend " +
          "met een conservatieve tabel van verwachte klikpercentages per Google-positie, tegen de vertoningen " +
          "die de pagina nu al haalt. Geen bedachte cijfers.\n" +
          "- **Zekerheid.** Hoe hard is het signaal? Een gemeten CTR-gat is harder dan een vermoeden over " +
          "zoekintentie, en dat verschil zit in de score.\n" +
          "- **Inspanning.** Een meta-title herschrijven is geen nieuwe landingspagina bouwen.\n" +
          "- **Past het bij deze klant?** Een koopgericht zoekwoord binnen het werkgebied van de klant weegt " +
          "zwaarder dan een informatieve term daarbuiten. Het werkgebied wordt uit de eigen data van de klant " +
          "gehaald, niet gevraagd.",
      },
      {
        titel: "Die zin hoeft niet zelf bedacht te worden (7 augustus 2026)",
        tekst:
          "Naast het invulveld staat een knop **'Stel een zin voor'**. Die vult het veld met een voorstel op " +
          "basis van wat er al over de klant bekend is: het klantprofiel en de bedrijfsgegevens. Geen nieuwe " +
          "analyse van de site, want die twee leveren dat al op; dit hergebruikt dat werk. Is er nog geen " +
          "klantprofiel en geen dienst ingevuld, dan zegt de knop dat en blijft het veld leeg. Het voorstel " +
          "wordt nooit vanzelf opgeslagen; dat gebeurt pas na een klik op 'Bewaren'.",
      },
      {
        titel: "Waarom er ook een bakje 'niet doen' is",
        tekst:
          "Elke tool die alleen kansen opsomt maakt de gebruiker onzekerder, niet zekerder. Een advies is " +
          "pas een advies als er ook iets afvalt. Wat afvalt komt met reden in beeld, zodat het een besluit " +
          "is en geen vergissing.",
      },
      {
        titel: "Aanvragen in plaats van bezoek, waar dat gemeten kan worden (7 augustus 2026)",
        tekst:
          "Bezoekers zijn niet waar een klant voor betaalt; hij betaalt voor aanvragen. Twee pagina's kunnen " +
          "even vaak in Google verschijnen terwijl de ene tien keer zo veel klanten oplevert als de andere, " +
          "en dat verschil zag de volgorde tot nu toe nergens.\n\n" +
          "Meet Google Analytics voor een klant al hoeveel bezoekers op een pagina daadwerkelijk een aanvraag " +
          "doen (een ingevuld formulier, een telefoontje, een bestelling, ingericht als GA4-conversie), dan " +
          "gebruikt de scan dat gemeten cijfer per pagina in plaats van een schatting. Een pagina die beter " +
          "converteert dan het gemiddelde van de site schuift dan omhoog in de kansrijkheid, een pagina die " +
          "slechter converteert zakt; bij de meeste kansen staat het aantal verwachte aanvragen per maand " +
          "erbij in plaats van het aantal bezoekers. Is er een geldbedrag per aanvraag bekend (hetzelfde " +
          "getal dat ook de opruimlijst in euro's zet), dan telt dat bedrag automatisch mee.\n\n" +
          "Heeft een klant geen GA4-conversies ingericht, of is er voor een pagina te weinig verkeer gemeten " +
          "om op te vertrouwen, dan verandert er niets: de scan blijft gewoon in bezoekers rekenen, met een " +
          "zin in de samenvatting die dat zegt.",
      },
    ],
  },
];

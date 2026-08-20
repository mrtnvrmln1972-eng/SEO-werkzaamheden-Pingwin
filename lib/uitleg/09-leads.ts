import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "leads",
  titel: "Nieuwe klanten en leads",
  intro:
    "Een lead is een klant die nog niet ja heeft gezegd. Daarom krijgt hij dezelfde omgeving, met een eigen " +
    "startscherm en een dossier dat nooit iets weggooit.",
  uitklappers: [
    {
      titel: "De leadomgeving",
      kern: "Gesprek, dossier en documenten op één plek, vanaf het eerste contact.",
      tekst:
        "Zodra er een lead in het systeem staat is er een werkplek: het gesprek, alles wat we over dat bedrijf " +
        "weten, en de documenten die we voor hem maken (een voorstel, een quickscan, een positioneringsadvies). " +
        "Wordt het een klant, dan verandert alleen het startscherm; het dossier gaat gewoon mee.",
    },
    {
      titel: "Het dossier: append-only",
      kern: "Er wordt nooit iets overschreven.",
      tekst:
        "Alles wat we over een bedrijf weten landt op één plek: aangeleverde documenten (een advertentie-analyse " +
        "van een collega, een uitdraai, hun propositie of huisstijl), eigen metingen, en losse notities die in " +
        "het gesprek vallen ('budget mag 1500', 'vindt duurzaamheid belangrijk').\n\n" +
        "De regel die dit bruikbaar houdt naarmate het groeit: er wordt nooit iets overschreven. Een herziening " +
        "komt erbij als nieuwe regel, met datum. Zo kun je later zien wat we wanneer dachten, en dat is precies " +
        "wat je nodig hebt als een traject een jaar duurt.",
    },
    {
      titel: "Aanleveren: een link blijft een link, een bestand houdt zijn opmaak",
      kern: "Wat je erin sleept of plakt, ziet er later nog uit zoals het binnenkwam.",
      tekst:
        "Sleep je een pdf in het dossier, dan wordt het bestand zelf bewaard, precies zoals het was: kolommen, " +
        "tabellen, beeld, huisstijl. Daarnaast wordt de tekst eruit gehaald, want daar zoekt het gesprek in. " +
        "Op het scherm zie je standaard het origineel; met één knop schakel je naar de uitgelezen tekst.\n\n" +
        "Plak je een link, dan blijft het gewoon een link: het stuk komt in het dossier te staan met de naam van " +
        "het document en een knop die het opent op de plek waar het echt staat. Kan de inhoud gelezen worden " +
        "(een Google-document), dan reist die mee zodat het gesprek erop kan zoeken. Kan dat niet (een pdf in " +
        "Drive, een map, een link naar een ander portaal), dan is dat geen fout meer: het blijft die link.",
    },
    {
      titel: "HubSpot: wie hot is komt hierheen, het geld zet je hier",
      kern: "Elk kwartier komen je warme leads binnen, met contactgegevens en opvolgdatum.",
      tekst:
        "Staat je verkoop in HubSpot, dan hoeft niemand meer twee keer te typen. Elk kwartier komt iedereen " +
        "binnen die daar de leadstatus heeft die jij hebt aangewezen (bijvoorbeeld hot) en, als je dat instelt, " +
        "ook nog van jou is als eigenaar: precies dezelfde selectie als je opgeslagen weergave in HubSpot. Met naam en bedrijf, " +
        "mailadres en telefoon, de website, wanneer je ze weer moet spreken, en de notities en gespreksverslagen " +
        "die erbij horen. Die notities landen in het dossier, dus het gesprek over deze lead weet vanaf dat " +
        "moment wat er besproken is. Werk je wél met een dealpijplijn, dan kan de koppeling ook die kant op " +
        "kijken; dat is een knop op het beheerscherm.\n\n" +
        "Eén regel houdt dit simpel: elk veld heeft één baas. HubSpot is de baas over wie er warm is, wie je " +
        "spreekt en wanneer. Het dashboard is de baas over het geld en over de maand waarin een lead naar " +
        "verwachting start, want daar rekent de prognose ermee en zo staat elk bedrag op precies één plek.\n\n" +
        "Andersom gebeurt er bijna niets: het dashboard wijzigt in HubSpot geen status, geen bedrag en geen " +
        "datum. Alleen als je het aanzet komt een notitie die je hier typt ook in HubSpot te staan.",
    },
    {
      titel: "De leadkaart, de mailwisseling en de tijdlijn",
      kern: "Alles wat je voor een gesprek nodig hebt, zonder te zoeken.",
      tekst:
        "Bovenaan een lead staat de stand: wanneer je hem weer moet spreken (rood als die dag geweest is), wie " +
        "je contactpersoon is, wanneer je voor het laatst contact had, en wat het per maand gaat worden. " +
        "Daaronder vul je in wat de prognose moet weten: het SEO-bedrag per maand, advertenties per maand, de " +
        "kosten die eraan vastzitten, een eenmalig bedrag voor een website met de kosten daarvan, de kans, en " +
        "vanaf welke maand het gaat lopen. Het eenmalige bedrag telt precies één keer mee, in die startmaand; " +
        "de maandbedragen tellen vanaf dan elke maand. In de leadlijst op je startscherm zie je per rij wanneer " +
        "je moet opvolgen, en daar vul je de kans, het maandbedrag, de kosten, het eenmalige bedrag en de " +
        "startmaand ook meteen in, zonder de lead te openen; wat je daar typt is hetzelfde als op de " +
        "leadkaart en telt direct mee in de prognose. Heeft HubSpot een opvolgdatum, dan staat die er; " +
        "zo niet, dan zet je die datum daar zelf. Een lead die je nog niet beoordeeld hebt telt voor dertig procent mee, " +
        "niet voor honderd. Onder de lijst staat wat het bij elkaar is: het opgetelde bedrag en daaronder " +
        "het gewogen bedrag, dus elk bedrag maal de kans van die lead. Dat tweede getal is wat je nuchter " +
        "mag verwachten.\n\n" +
        "Daaronder staat een strook met de komende zes maanden naast elkaar: wat komt er binnen van je " +
        "bestaande klanten, wat komt er gewogen bij van je leads, en wat is dat bij elkaar per maand. " +
        "Daaronder waar dat bedrag uit bestaat: SEO, advertenties, overig en een eenmalig bedrag. Klik op " +
        "\u201cbestaande klanten\u201d of \u201cleads\u201d en de regel klapt open: dan zie je per bedrijf wat het per " +
        "maand bijdraagt, en bij een lead met welke kans dat gerekend is. Het zijn dezelfde cijfers als in " +
        "de volledige prognose, alleen korter.\n\n" +
        "Bij \u00e9\u00e9n bedrijf lopen vaak meer dingen tegelijk. Met de knop \u201c+ regel\u201d komt er een tweede rij " +
        "voor hetzelfde bedrijf: dezelfde naam, dezelfde link naar hun site, precies dezelfde kolommen, " +
        "maar leeg. Je vult zelf in waar die regel over gaat (SEO, advertenties, website of overig), wanneer " +
        "je erover moet opvolgen, hoe groot de kans is, wat hij per maand oplevert, wat hij kost en in welke " +
        "maand hij start. Zo staat de SEO op de ene regel en de website op de andere, met elk hun eigen " +
        "cijfers. Alles telt mee in de prognose; laat je de kans leeg, dan geldt de kans van het bedrijf.\n\n" +
        "Daaronder staat de mailwisseling met dat bedrijf, met dezelfde knop om te antwoorden of een nieuwe mail " +
        "te sturen als bij een klant. Die mail komt uit de mailbox en niet uit het CRM: daar staat de hele draad, " +
        "ook wat er nooit gelogd is. En er is een tijdlijn waarin alles op datum onder elkaar staat: mails, " +
        "notities, documenten en metingen. Dat is wat je mist als je na drie weken een lead opent.",
    },
    {
      titel: "Klantprofiel automatisch opbouwen",
      kern: "Van een domein naar een volledig profiel, zonder vragenlijst.",
      tekst:
        "Op basis van de website en wat er publiek te vinden is wordt een klantprofiel opgebouwd: wat het " +
        "bedrijf doet, voor wie, in welk gebied, met welke concurrenten. Dat profiel is daarna de context voor " +
        "elke analyse, elk document en elk gesprek over die klant.\n\n" +
        "Het uitgangspunt is dat het systeem zelf opzoekt wat het zelf kan vinden. Een gebruiker hoeft geen " +
        "domein, URL of cijfer aan te leveren dat op de site of in de gekoppelde bronnen staat.",
    },
    {
      titel: "Concurrenten",
      kern: "Per klant vastgelegd, en gebruikt in elke vergelijking.",
      tekst:
        "Concurrenten worden per klant bijgehouden en gebruikt in de zoekwoordgaten, de top-10-analyses en de " +
        "positioneringsvraag. Een analyse zonder benoemde concurrent is een analyse in het luchtledige.",
    },
  ],
};

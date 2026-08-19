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
      titel: "HubSpot: de deal komt hierheen, het budget zet je hier",
      kern: "Fase, verwachte startdatum, eerstvolgend contactmoment en de notities komen vanzelf binnen.",
      tekst:
        "Staat de verkoop in HubSpot, dan hoeft niemand meer twee keer te typen. Elk kwartier komen de deals " +
        "binnen als lead: de fase waarin hij zit, het bedrag, de datum waarop hij naar verwachting klant wordt, " +
        "het eerstvolgende contactmoment (de eerstvolgende openstaande taak daar), en de notities en " +
        "gespreksverslagen die erbij horen. Die notities landen in het dossier, dus het gesprek over deze lead " +
        "weet vanaf dat moment wat er besproken is.\n\n" +
        "Eén regel houdt dit simpel: elk veld heeft één baas. HubSpot is de baas over de pijplijn en de data. " +
        "Het dashboard is de baas over het beoogde maandbudget, want een bedrag in HubSpot is meestal het " +
        "totaal van een traject en de prognose rekent met maandbedragen. Zet je de kans of de startmaand zelf, " +
        "dan blijft die staan; de koppeling schrijft nooit over een eigen keuze heen.\n\n" +
        "Andersom gebeurt er bijna niets: het dashboard wijzigt in HubSpot geen fase, geen bedrag en geen datum. " +
        "Alleen als je het aanzet komt een notitie die je hier typt ook als notitie bij de deal te staan.",
    },
    {
      titel: "De leadkaart, de mailwisseling en de tijdlijn",
      kern: "Alles wat je voor een gesprek nodig hebt, zonder te zoeken.",
      tekst:
        "Bovenaan een lead staat de stand: wanneer je hem weer moet spreken (rood als die dag geweest is), " +
        "wanneer hij naar verwachting begint, hoe groot de kans is, wat het beoogde maandbudget is, en wanneer " +
        "je voor het laatst contact had. In de leadlijst zie je diezelfde drie dingen per rij, dus die lijst is " +
        "een belactielijst in plaats van een lijstje namen.\n\n" +
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

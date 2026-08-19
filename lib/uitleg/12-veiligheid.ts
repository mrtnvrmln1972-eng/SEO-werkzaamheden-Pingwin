import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "veiligheid",
  titel: "Veiligheid en privacy",
  intro:
    "Er staat klantdata in dit systeem: correspondentie, cijfers, wachtwoorden van sites en boekhouding. De " +
    "regels daarvoor staan vast en zijn niet per omgeving anders.",
  uitklappers: [
    {
      titel: "Wachtwoorden en sleutels",
      kern: "Nooit plat, nooit in de code, nooit in een bestand.",
      tekst:
        "- Klantwachtwoorden worden gegenereerd en alleen als versleutelde afdruk opgeslagen. Ook de beheerder " +
        "kan ze niet lezen; het platte wachtwoord is één keer zichtbaar bij het aanmaken.\n" +
        "- Sessies zijn ondertekende cookies. Een gemanipuleerde cookie wordt geweigerd.\n" +
        "- Wachtwoorden voor de site van de klant worden versleuteld bewaard en zijn niet terug te lezen.\n" +
        "- API-sleutels staan uitsluitend in de omgevingsvariabelen van de hosting, nooit in een bestand in de " +
        "code. Een bestand mag hoogstens de naam van de variabele noemen.",
    },
    {
      titel: "Beveiliging staat standaard aan, niet standaard uit",
      kern: "Een ingang zonder sleutel bestaat niet.",
      tekst:
        "Er was een snelle beheerder-ingang waarvan het slot standaard uit stond. Dat betekende dat wie het " +
        "adres kende binnen was, en het adres stond in een openbare code-omgeving. Dat is aangetroffen en " +
        "dichtgezet.\n\n" +
        "De regel die daaruit volgt en die voor elke omgeving geldt: is de sleutel niet ingesteld, dan bestaat " +
        "de ingang niet. Beveiliging hoort niet iets te zijn dat je aan moet zetten.",
    },
    {
      titel: "Scheiding tussen klanten",
      kern: "Elke tabel is per klant gescheiden, op elk niveau.",
      tekst:
        "Alle klantgegevens hangen aan de klant, in elke tabel. Een klant kan alleen bij zijn eigen dashboard. " +
        "Een teamgebruiker alleen bij de klanten die hem zijn toegewezen. Een deellink alleen bij dat ene " +
        "onderdeel.",
    },
    {
      titel: "Een omgeving die maar één klant kan tonen",
      kern: "Eén adres, één klant, alles daarbuiten bestaat er niet.",
      tekst:
        "Naast het gewone dashboard kan hetzelfde systeem op een tweede adres draaien dat maar één klant " +
        "toont, met dezelfde gegevens erachter. Bedoeld om je scherm mee te delen en om er iemand van buiten " +
        "in te laten zonder dat er ooit een andere klant in beeld komt.\n\n" +
        "Dat slot werkt omgekeerd aan een lijst met verboden schermen, want zo'n lijst veroudert zodra er een " +
        "scherm bijkomt. Hier is alles dicht behalve wat expliciet openstaat: de cockpit van die ene klant en " +
        "de inlogschermen. De klantenlijst, financiën, prognose, agenda, verbruik en teambeheer bestaan er " +
        "niet, en ook een schermfoto kan niet buiten die klant kijken. Het slot zit vóór de rechten, dus het " +
        "houdt ook de eigenaar tegen. De automatische ronden draaien er niet, zodat nachtwerk niet dubbel " +
        "gebeurt op dezelfde gegevens.\n\n" +
        "Een proef rekent bij elke bouw na dat elke route aan de beheerkant een poort heeft; een nieuw scherm " +
        "is daarmee vanzelf dicht op zo'n voordeur. Ook de kopbalk weet ervan: het menu toont daar alleen de " +
        "schermen die er bestaan, en de meters over het hele bureau (het Ahrefs-tegoed, de kosten, de " +
        "meldingen) zijn er weg.\n\n" +
        "Zo'n voordeur hoort naar dezelfde gegevens te kijken als het dashboard, want anders zijn het twee " +
        "administraties die uit elkaar lopen. Dat is aan het scherm niet te zien: een voordeur op een oude " +
        "database toont dezelfde klant met de gegevens van gisteren. Daarom kan het dashboard het aan de " +
        "voordeur zelf vragen. Elke omgeving vertelt op een vast adres welke klant hij toont en een kort, " +
        "onomkeerbaar kenmerk van zijn database; gelijk kenmerk betekent dezelfde gegevens. Op het " +
        "verhuisscherm zit daar één knop op, met in gewone taal wat er nog moet als het niet klopt. " +
        "Diezelfde vergelijking weigert ook een verhuizing naar een omgeving die dezelfde gegevens al heeft.\n\n" +
        "Zo'n voordeur is ook de plek waar iemand van buiten binnenkomt. Mag een gast precies één klant zien " +
        "en heeft die klant een eigen adres, dan wijst de uitnodiging daarheen in plaats van naar het " +
        "dashboard met alle klanten, en staat in het overzicht per gast waar hij inlogt. Dat is niet alleen " +
        "netter maar ook veiliger: op dat adres bestaat er geen andere klant, ook niet als zijn rechten later " +
        "verruimd worden. En de automatische nachtronden slaan zo'n omgeving over, zodat hetzelfde werk niet " +
        "twee keer gedaan (en betaald) wordt.",
    },
    {
      titel: "Twee poorten in plaats van één",
      kern: "Snelle afwijzing aan de rand, echte controle in de kern.",
      tekst:
        "Bij de eerste poort wordt alleen gekeken of er een sessie aanwezig is. De echte controle van de " +
        "ondertekening gebeurt daarna op de server bij de pagina zelf, die een vervalste sessie alsnog " +
        "wegstuurt. Dat is bewust die verdeling, omdat de buitenste laag geen zware crypto kan doen.",
    },
    {
      titel: "Wat de koppelingen wel en niet mogen",
      kern: "Zo min mogelijk rechten, per koppeling vastgelegd.",
      tekst:
        "- Search Console en Analytics: alleen lezen.\n" +
        "- Boekhouding: alleen lezen, geen enkele schrijfmogelijkheid in de code.\n" +
        "- Drive: een aparte koppeling, los van de datakoppeling, zodat wie de cijfers levert nooit zijn Drive " +
        "openzet.\n" +
        "- Mail: lezen en versturen, maar versturen gebeurt alleen na goedkeuring.\n" +
        "- De site van de klant: schrijven is mogelijk, maar alleen op de velden die er expliciet voor " +
        "opengezet zijn, en altijd met terugcontrole.",
    },
  ],
};

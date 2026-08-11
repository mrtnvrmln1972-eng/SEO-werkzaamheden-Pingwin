import type { Uitklapper } from "../types";

// Golf 2: de remmen weghalen die groei tegenhouden (R5 tot R8).

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Golf 2: de remmen weghalen die groei tegenhouden",
    kern: "Vier punten die nu nog werken omdat het bureau uit één persoon bestaat.",
    tekst:
      "Deze vier zijn vandaag geen probleem en morgen wel. Ze gaan allemaal over hetzelfde: het dashboard is " +
      "gebouwd voor één mens met één mailbox en klanten op WordPress. Elk punt hier is de eerste blokkade bij " +
      "een tweede accountmanager, een klant op een ander systeem of een tweede bureau.\n\n" +
      "| Punt | Wat het is | Wordt urgent zodra |\n" +
      "|---|---|---|\n" +
      "| **R5** | Meerdere mailboxen | er iemand naast je meewerkt |\n" +
      "| **R6** | Tweede sitekoppeling, en copy doorvoeren | WordPress-deel ✅ af op 9 augustus 2026; tweede systeem: zodra er een klant niet op WordPress zit |\n" +
      "| **R7** | Bronnen-gezondheid: welke bron is stil? | ✅ af op 8 augustus 2026 |\n" +
      "| **R8** | Correcties worden regels, in élke motor | je dezelfde correctie twee keer maakt |",
    sub: [
      {
        titel: "R5. Meerdere mailboxen",
        tekst:
          "**Wat er nu mis is.** De correspondentie hangt aan één gekoppelde mailbox. Alles wat de assistent " +
          "weet over afspraken komt daaruit. Werkt er iemand anders aan een klant, dan is diens mail " +
          "onzichtbaar, en dan is de context van de assistent stil incompleet. Dat is erger dan geen context, " +
          "want het ziet er compleet uit.\n\n" +
          "**Wat het oplevert.** Dit is de eerste harde blokkade bij groei, en ook bij een tweede bureau. Met " +
          "meerdere mailboxen wordt de teamgebruiker-laag die er al is (eigen inlog, eigen klanten, wel of " +
          "geen mail) pas echt bruikbaar.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. De koppeling per gebruiker in plaats van per omgeving: dezelfde eenmalige login, maar de " +
          "bewaarde toegang hangt aan de teamgebruiker.\n" +
          "2. Per klant vastleggen welke mailboxen erbij horen, zodat de correspondentie van twee mensen in " +
          "één tijdlijn komt met de afzender erbij.\n" +
          "3. Versturen blijft persoonlijk: je stuurt vanuit je eigen mailbox, nooit vanuit die van een " +
          "collega.\n" +
          "4. De scheiding respecteren die er al is: een gast die geen mail mag zien, ziet ook hier niets.\n\n" +
          "**Waaraan je ziet dat het af is.** Twee mailboxen gekoppeld, en bij een klant staat de " +
          "correspondentie van beide door elkaar in de tijdlijn, met per bericht wie het stuurde. Een gast " +
          "zonder mailrecht ziet nul berichten.\n\n" +
          "**Wat het raakt.** Dit verandert de manier waarop mail binnenkomt, de tijdlijn per klant, de controle op " +
          "uitgaande mail en wat de assistent weet als je met hem praat. Ook de rechten gaan mee: een gast die " +
          "geen mail mag zien, blijft niets zien.",
      },
      {
        titel: "R6. Tweede sitekoppeling, en copy doorvoeren — WordPress-deel klaar op 9 augustus 2026",
        tekst:
          "**Wat er klaar is.** De copy, het grootste werkstuk van de hele keten, ging tot nu toe altijd met de " +
          "hand van het copydocument naar de site. Vanaf nu kun je bij een pagina met een goedgekeurde copy op " +
          "“Zet copy als concept in de site” drukken: het dashboard zet de volledige, goedgekeurde tekst " +
          "als NIEUW concept (nog niet zichtbaar voor bezoekers) in WordPress, met een link naar het bewerkscherm " +
          "waar je het meteen kunt zien. De bestaande, live pagina van de klant wordt hierbij niet aangeraakt; " +
          "publiceren, of de tekst overzetten naar de bestaande pagina, doe je zelf met die link, in je eigen " +
          "WordPress-inlog. Er wordt altijd teruggecontroleerd of het concept er ook echt (en nog als concept, " +
          "niet per ongeluk meteen live) staat, en een mislukte poging meldt eerlijk waarom, net als bij de meta- " +
          "en alt-teksten hiernaast.\n\n" +
          "Onder deze knop zit nu ook de vorm die volgende systemen straks kunnen hergebruiken: één klein " +
          "koppelvlak per sitesysteem (versleuteld wachtwoord, altijd terugcontrole, eerlijk melden als het niet " +
          "lukte), waar WordPress het eerste koppelstuk van is.\n\n" +
          "**Wat nog open staat.** Er is nog geen klant bekend die niet op WordPress zit, dus het tweede " +
          "koppelstuk (voor dat andere systeem) is er nog niet; zodra dat zich aandient, komt het naast het " +
          "WordPress-koppelstuk. Tot die tijd blijft de werklijst voor de sitebouwer de terugval voor elke site " +
          "zonder koppeling.\n\n" +
          "**Waaraan je ziet dat het af is.** Een goedgekeurd copydocument staat als concept in de site, met " +
          "een voorbeeldlink, zonder dat er iets gekopieerd is. En hetzelfde werkt op een tweede systeem.\n\n" +
          "**Wat het raakt.** Dit verandert de laatste stap van de documentenketen, het lijstje dat de sitebouwer " +
          "krijgt, de voortgang per pagina en het overzicht van wat we voor de klant gedaan hebben.",
      },
      {
        titel: "R7. Bronnen-gezondheid: welke bron is vandaag stil? — af op 8 augustus 2026",
        tekst:
          "**Klaar.** Elke koppeling (Ahrefs, Google, Microsoft 365, Moneybird, WordPress per klant) schrijft " +
          "nu bij elk gebruik weg of het lukte, en bij een fout waarom. Er is één scherm, " +
          "`/admin/bronnen-gezondheid`, dat elke koppeling bij het openen meteen vers test en per bron laat " +
          "zien: werkt hij, wanneer ging het voor het laatst goed, en wat er precies mis is, met een knop om " +
          "hem opnieuw te koppelen waar dat kan.\n\n" +
          "De volledige beschrijving staat nu in het hoofdstuk **Waar het mee gekoppeld is**, bij " +
          "\"Bronnen-gezondheid: houdt zichzelf in de gaten\", want het is werkelijkheid en geen plan meer. " +
          "Wat hier blijft staan is waarom het erop stond: het hele dashboard rust op de belofte dat een " +
          "cijfer uit een bron komt en dat ontbrekende data ontbrekend heet, en een stille bron ondermijnde " +
          "die belofte zonder dat iemand het zag.",
      },
      {
        titel: "R8. Correcties worden regels, in élke motor",
        tekst:
          "**Wat er nu mis is.** Bij opruimen worden jouw correcties vastgelegd als harde regels, zodat de " +
          "volgende analyse dezelfde fout niet meer maakt. Dat is een van de beste dingen in het hele " +
          "dashboard, en het bestaat op precies één plek. Corrigeer je een meta-voorstel, een linksuggestie of " +
          "een prioriteit, dan is die correctie een eenmalige aanpassing en begint de volgende ronde weer bij " +
          "nul.\n\n" +
          "**Wat het oplevert.** Dit is wat het systeem beter maakt door gebruik, en dus ook wat het verhaal " +
          "naar buiten waarmaakt (\"het wordt beter doordat je het gebruikt\"). Het is opgebouwde waarde die " +
          "niet naar een andere tool mee te nemen is. Praktisch: minder dezelfde correctie twee keer, en " +
          "voorstellen die na een paar maanden klinken zoals jij ze zou schrijven.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. De vorm die bij opruimen al werkt uit dat onderdeel halen en algemeen maken: per klant, per " +
          "motor, een regel met wat er gold en waarom, met datum.\n" +
          "2. Een correctie wordt niet stil weggeschreven; je ziet dat er een regel bij komt en kunt hem " +
          "terugdraaien. Een regel die je niet kunt zien is een systeem dat iets van je overneemt.\n" +
          "3. De motoren die met AI werken krijgen die regels als harde randvoorwaarden mee, niet als " +
          "suggestie.\n" +
          "4. Eén plek per klant waar alle geleerde regels op een rij staan, doorzoekbaar. Dat is ook het " +
          "eerste wat je wil zien als een collega een account overneemt.\n\n" +
          "**Waaraan je ziet dat het af is.** Een gecorrigeerd meta-voorstel: na de volgende ronde staat de " +
          "correctie erin, en de regel staat met datum en reden in de lijst geleerde regels van die klant.\n\n" +
          "**Wat het raakt.** Dit verandert de voorstellen voor meta-teksten, het advies over interne links, de " +
          "lijst met prioriteiten en de documenten. De regels die het opruimen nu al leert gaan hierin op, " +
          "zodat er niet twee systemen naast elkaar komen te staan die hetzelfde doen.",
      },
    ],
  },

  // ── Golf 3 ──
];

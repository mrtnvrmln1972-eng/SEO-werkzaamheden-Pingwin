import type { Uitklapper } from "../types";

// Golf 3: van eigen werkplek naar product (R9 tot R15).

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Golf 3: van eigen werkplek naar product",
    kern: "Vijf punten die nodig zijn voordat iemand anders dit kan gebruiken of kopen.",
    tekst:
      "Golf 1 en 2 maken het dashboard beter voor Pingwin. Deze golf maakt er iets van dat een ander bureau " +
      "kan gebruiken, en dat een investeerder kan beoordelen.\n\n" +
      "| Punt | Wat het is | Waarom het in deze golf zit |\n" +
      "|---|---|---|\n" +
      "| **R9** | Klantdashboard op echte data | Grootste verkoopwaarde, raakt de klant direct |\n" +
      "| **R10** | Signaleren in plaats van kijken | Maakt het systeem proactief zonder waslijst |\n" +
      "| **R11** | Licentie-klaar: sleutels, opzet, quota | Voorwaarde voor een tweede bureau |\n" +
      "| **R12** | Vangnet onder de rekenmotoren | Voorwaarde om snel te blijven bouwen |\n" +
      "| **R13** | Wie deed wat: een spoor van wijzigingen | Nodig zodra er gasten meewerken |\n" +
      "| **R14** | Schermafbeeldingen, door het dashboard zelf gemaakt | Maakt het verhaal zichtbaar |\n" +
      "| **R15** | De verkooppitch als eigen pagina | Overtuigt in twee minuten |",
    sub: [
      {
        titel: "R9. Het klantdashboard op echte data — gebouwd, wacht op jouw eerste klikje",
        tekst:
          "**Waar het nu staat.** De cockpit wist al alles: klikken, vertoningen, wat er is uitgevoerd. Het " +
          "dashboard dat de klant ziet, las tot nu toe alleen een spreadsheet met werkzaamheden, uren en " +
          "budget. Dat is nu aangevuld: elke klant heeft een blok **\"Ontwikkeling deze maand\"** " +
          "klaarstaan, dat in gewone taal vertelt hoe de klikken en vertoningen vanuit Google zich " +
          "ontwikkelden ten opzichte van de periode ervoor, en welke aanpassingen er de afgelopen maand op " +
          "de site zijn doorgevoerd, met wanneer. Geen nieuwe meting: het leunt op de nachtelijke " +
          "klik-vergelijking (dezelfde die de klanten-kiezer al gebruikt) en op het wijzigingenlogboek dat er " +
          "al was.\n\n" +
          "**Wat het oplevert.** Dit is het punt met de meeste verkoopwaarde van de hele lijst. Een klant die " +
          "elke maand ziet wat er gedaan is én wat het deed, vertrekt niet. Het is ook het onderdeel dat je " +
          "aan een lead kunt laten zien: dit krijg jij erbij.\n\n" +
          "**Wat je nog moet doen.** Het blok staat per klant standaard uit; er gaat dus nog niets " +
          "automatisch naar iemand toe. Open bij een klant de voorbeeldweergave (Klant-tab, knop " +
          "\"Voorbeeld\") en je ziet het blok bovenaan het dashboard staan, met een knop erboven: " +
          "\"Verborgen voor de klant – zet aan\". Klopt de tekst, klik hem aan; vanaf dat moment ziet de " +
          "klant het zelf, zonder dat jij er iets voor stuurt.\n\n" +
          "**Waaraan je ziet dat het af is.** Bij minstens één klant staat het blok aangezet, en die klant " +
          "ziet zonder jouw tussenkomst de ontwikkeling van deze maand in gewone taal. Tot dat moment blijft " +
          "dit punt op \"loopt\" staan, ook al is de code klaar: gebouwd is nog geen gebruikt.\n\n" +
          "**Wat het raakt.** Dit verandert het dashboard dat de klant zelf ziet en de voorbeeldweergave " +
          "waarin jij dat vooraf naloopt. Het leunt op de klik-trend en het wijzigingenlogboek, en het " +
          "verandert de maandelijkse ronde langs je klanten.",
      },
      {
        titel: "R10. Signaleren in plaats van kijken",
        tekst:
          "**Wat er nu mis is.** Er draait elke nacht en elke week veel op de achtergrond: sites worden " +
          "gescand, verschillen vastgelegd, trends bijgewerkt. Maar het resultaat wacht tot iemand een klant " +
          "opent. Zakt een pagina weg, verdwijnt er een schema-blok, of gooit een plugin alle alt-teksten " +
          "leeg, dan staat dat netjes vastgelegd en ziet niemand het tot het toeval jouw kant op valt.\n\n" +
          "**Wat het oplevert.** Het verschil tussen een systeem dat je moet bezoeken en een systeem dat je " +
          "waarschuwt. Bij twintig klanten kun je niet meer rondkijken; dan moet wat stuk is naar jou toe " +
          "komen. Dit is ook het soort ding waar een klant respect voor heeft: jij belt hem over een probleem " +
          "dat hij zelf nog niet zag.\n\n" +
          "**Hoe we het zouden bouwen.** Eén ding is hier belangrijker dan de techniek: dit mag geen waslijst " +
          "worden. De regel uit de assistent geldt hier net zo hard, dus terughoudend tegen de gebruiker.\n\n" +
          "1. Een korte, harde lijst van wat een signaal verdient: een pagina die echt wegzakt, een pagina " +
          "die verdwijnt, een meta of schema die stuk is, een doorgevoerde wijziging die na acht weken niets " +
          "deed.\n" +
          "2. Eén bericht per dag per klant, of niets. Nooit een bericht per bevinding.\n" +
          "3. Het bericht is een knop, geen tekst: je landt op de plek waar het werk gebeurt.\n" +
          "4. Elk signaal is stil te zetten met een reden, en die reden wordt een regel (zie R8).\n\n" +
          "**Waaraan je ziet dat het af is.** Een pagina zakt echt weg en er komt binnen een dag één bericht " +
          "met een knop naar die pagina. Een pagina die normaal schommelt levert géén bericht op.\n\n" +
          "**Wat het raakt.** Dit verandert wat er 's nachts en 's weekends op de achtergrond draait, het overzicht " +
          "van veranderingen op de site van de klant, de ontwikkeling over tijd en de lijst met prioriteiten.",
      },
      {
        titel: "R11. Licentie-klaar: sleutels, opzet en quota",
        tekst:
          "**Wat er nu mis is.** De code kan al onder meerdere merken draaien, en dat werkt in productie. " +
          "Maar de sleutels van de koppelingen staan als omgevingsvariabelen bij de hosting, en een eigen " +
          "Ahrefs-sleutel per klant loopt via een label dat naar zo'n variabele wijst. Dat is netjes en veilig " +
          "voor één of twee omgevingen, en het schaalt niet naar tien bureaus die zelf willen kunnen " +
          "koppelen.\n\n" +
          "**Wat het oplevert.** Dit is het verschil tussen \"ik kan een omgeving voor je opzetten\" en \"je " +
          "kunt hem zelf in gebruik nemen\". Zonder dit is elke nieuwe licentie handwerk van jou, en dan is " +
          "groei jouw agenda in plaats van een product.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. Sleutels versleuteld in de database in plaats van bij de hosting, met dezelfde aanpak die al " +
          "gebruikt wordt voor het sitewachtwoord: versleuteld opgeslagen, nooit terug te lezen. De regel " +
          "\"nooit een sleutel in een bestand\" blijft dus overeind.\n" +
          "2. Een opzetscherm dat per koppeling zegt of hij staat en wat er nog mist, in plaats van een " +
          "handleiding met omgevingsvariabelen.\n" +
          "3. Een grens per omgeving: hoeveel klanten, hoeveel verbruik per maand, en wat er gebeurt als die " +
          "grens in zicht komt. Dat is met R4 erbij gewoon af te lezen.\n" +
          "4. Beveiliging blijft staan zoals hij staat: geen sleutel betekent dat de ingang niet bestaat, ook " +
          "in een omgeving van iemand anders.\n\n" +
          "**Waaraan je ziet dat het af is.** Een nieuwe omgeving is vanaf leeg in gebruik te nemen zonder " +
          "dat jij een omgevingsvariabele aanraakt, en het opzetscherm laat zien welke koppelingen nog " +
          "ontbreken.\n\n" +
          "**Wat het raakt.** Dit verandert de manier waarop alle koppelingen hun sleutels bewaren, het beheerscherm " +
          "en de beveiliging. Het is het zwaarste punt van de lijst, en het is pas echt af als R4 en R7 " +
          "gedaan zijn: zonder de kosten per klant en zonder zicht op stille koppelingen kun je geen omgeving " +
          "aan iemand anders overdragen.",
      },
      {
        titel: "R12. Een vangnet onder de rekenmotoren",
        tekst:
          "**Wat er nu mis is.** Er staan drie proeven in het project: op de meetlaag, op de mailteksten en " +
          "op de weging van de prioriteitenscan. Dat zijn precies de goede drie plekken om te beginnen, en " +
          "het is te weinig voor een systeem van deze grootte. De scores, de verwachte opbrengsten, de " +
          "klikpercentage-tabellen en de fase-logica zijn puur rekenwerk, en juist daar verandert een fout " +
          "stil de rangorde van het werk zonder dat er iets kapot lijkt.\n\n" +
          "**Wat het oplevert.** Snelheid. Niet netheid. Elke keer dat aan de scoring gesleuteld wordt, moet " +
          "iemand nu met de hand controleren of de rangorde nog klopt, en dat kost meer tijd dan het schrijven " +
          "van de proef. Het is ook de enige manier om te blijven bouwen in dit tempo zonder dat er " +
          "onopgemerkt iets scheef gaat.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. Proeven op de rekenlagen zonder koppelingen: de paginascore, de verwachte opbrengst, de " +
          "fase-logica en de klikpercentage-tabel. Vaste invoer, vaste verwachte uitkomst.\n" +
          "2. Een vastgelegde momentopname van een uitkomst: verandert de score van een voorbeeldpagina, dan " +
          "moet dat een bewust besluit zijn en geen verrassing.\n" +
          "3. Nieuwe motoren krijgen vanaf de start een proef op hun rekenkern. Dat is de vaste stap; " +
          "achteraf toevoegen gebeurt nooit.\n\n" +
          "**Waaraan je ziet dat het af is.** Eén commando dat alle proeven draait, dat groen is, en dat rood " +
          "wordt als je met opzet een gewicht in de scoring verandert.\n\n" +
          "**Wat het raakt.** Alleen het rekenwerk onder de motoren. Aan de buitenkant verandert er niets, dus dit " +
          "is het veiligste punt van de lijst om tussendoor te doen terwijl er iets anders loopt.",
      },
      {
        titel: "R13. Wie deed wat: een spoor van wijzigingen",
        tekst:
          "**Wat er nu mis is.** Er is een rechtenlaag met teamgebruikers die eigen klanten hebben, en er is " +
          "een overzicht van wat er voor een klant is uitgevoerd. Wat er niet is: wie welke wijziging in het " +
          "dashboard deed. Wie keurde die meta goed, wie draaide dat opruimvoorstel terug, wie zette die " +
          "redirect erin.\n\n" +
          "**Wat het oplevert.** Zodra er iemand naast je meewerkt is dit het verschil tussen samenwerken en " +
          "elkaar in de weg zitten. Het is ook wat je nodig hebt als een klant vraagt waarom iets veranderd " +
          "is, en het is de basis onder een gerust gevoel bij het uitdelen van rechten: je kunt iemand meer " +
          "toevertrouwen als je kunt terugkijken.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. Bij elke handeling die iets verandert vastleggen: wie, wat, wanneer, en bij welke klant. Niet " +
          "bij het lezen, want dan wordt het een berg zonder betekenis.\n" +
          "2. Zichtbaar op de plek waar het over gaat: bij de kaart, bij de pagina, bij de klant. Niet als " +
          "apart logboek dat niemand opent.\n" +
          "3. De alleen-lezen meekijk-sessie blijft doen wat hij doet, en die kan per definitie niets " +
          "veranderen.\n\n" +
          "**Waaraan je ziet dat het af is.** Bij een goedgekeurd meta-voorstel staat wie het goedkeurde en " +
          "wanneer, en dat is terug te zien bij de pagina.\n\n" +
          "**Wat het raakt.** Elke handeling die iets wijzigt krijgt hier een regel bij, en die regel verschijnt op " +
          "de kaart waar het over gaat. Verder raakt het de rechten, want dit is wat je nodig hebt om iemand " +
          "meer te durven toevertrouwen.",
      },
      {
        titel: "R14. Schermafbeeldingen, door het dashboard zelf gemaakt",
        tekst:
          "**Wat er nu gebeurt.** Het dashboard fotografeert zichzelf. Er is een vaste lijst van eigen " +
          "schermen; bij elk scherm logt de app met een echte adminsessie in, opent het scherm op een vaste " +
          "breedte, en maakt er een opname van. Vóór die opname wordt elke echte klantnaam, elk domein en elk " +
          "mailadres op de pagina vervangen door een neutrale naam (\"Voorbeeldklant\"). Zo mag elk beeld " +
          "veilig openbaar op deze pagina staan, ook al is de onderliggende data echt (van de meest gevulde " +
          "klant, One Day Clinic), zodat een beeld ook echt iets laat zien in plaats van een lege demo-omgeving.\n\n" +
          "Het bedieningspaneel staat op `/admin/schermafbeeldingen`: één knop (\"Alles vernieuwen\") maakt de " +
          "hele lijst opnieuw, en toont per scherm wanneer het voor het laatst is opgenomen. Elk hoofdstuk " +
          "hieronder met een beeld toont dat beeld automatisch boven zijn tekst.\n\n" +
          "**Wat er nog open staat.** Nu heeft een eerste set hoofdstukken een beeld (waarom, koppelingen, " +
          "motoren, documenten, werk, bedrijfsvoering, gebruik en deze agenda). De rest krijgt er een zodra er " +
          "een regel voor bijkomt in de vaste lijst (`lib/schermbeeld.ts`, geen nieuwe code nodig) en \"Alles " +
          "vernieuwen\" opnieuw draait.\n\n" +
          "**Wat het raakt.** Deze pagina en de verkooppitch (R15), en het gebruikt dezelfde browser die al in " +
          "het dashboard zit om pagina's van klanten te meten.",
      },
      {
        titel: "R15. De verkooppitch als eigen pagina",
        tekst:
          "**Wat er nu mis is.** De uitlegpagina legt alles uit, en dat is precies wat hij moet doen. Maar een " +
          "lead die overtuigd moet worden leest geen zestien hoofdstukken. Er is geen versie die in twee " +
          "minuten binnenkomt.\n\n" +
          "**Wat het oplevert.** Iets om te sturen of te laten zien in een gesprek, met één duidelijke " +
          "vervolgstap. Dit is het onderdeel dat direct omzet raakt.\n\n" +
          "**Hoe we het zouden bouwen.**\n\n" +
          "1. Een eigen, korte pagina met de beelden uit R14 als hoofdrol en de tekst als bijrol.\n" +
          "2. Opgebouwd uit dezelfde bron als de uitleg, niet ernaast geschreven. Anders lopen het verhaal en " +
          "de pitch binnen een maand uiteen.\n" +
          "3. Eén boodschap per blok, in wat de klant eraan heeft, niet in wat wij gebouwd hebben.\n" +
          "4. Eén vervolgstap onderaan, geen keuzemenu.\n\n" +
          "**Waaraan je ziet dat het af is.** Iemand die het dashboard niet kent snapt binnen twee minuten wat " +
          "het is en wat hij ermee opschiet, zonder door te klikken.\n\n" +
          "**Wat het raakt.** Er komt één nieuwe pagina bij, die zijn tekst uit de uitlegpagina haalt in plaats van " +
          "een eigen versie te krijgen.",
      },
    ],
  },

  // ── Niet doen ──
];

import type { Uitklapper } from "../types";

// Hoe we ontwikkelen: één punt per sessie, en de poorten eromheen.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Hoe we dit organiseren",
    kern: "Eén punt, één sessie, één meetbaar resultaat. En de lus die zichzelf versterkt.",
    tekst:
      "**Het bedieningspaneel staat in het dashboard zelf.** Op de routekaart-pagina (bereikbaar via de knop " +
      "\"Routekaart\" in het adminscherm) staat per punt de stand, waar het van afhangt, en de startregel om " +
      "te kopiëren voor een verse werksessie. Dit hoofdstuk is het verhaal en de onderbouwing; dat scherm is " +
      "de knop.\n\n" +
      "**Eén punt per chat, maximaal twee chats tegelijk.** Elke werksessie pakt precies één punt, meldt in " +
      "de routekaart dat het loopt, en koppelt terug in vier regels: wat er nu werkt, een link om te kijken, " +
      "wat er nog open is, en of er iets nodig is. Geen bestandsnamen, geen techniek, tenzij erom gevraagd " +
      "wordt. Die vorm is vastgelegd als opdracht in de repo, dus elke sessie werkt hetzelfde.\n\n" +
      "**De werkwijze per punt.** Elk punt hieronder is zo geschreven dat het in een eigen werksessie kan " +
      "worden opgepakt: \"Pak R2\" is genoeg om te beginnen. Vaste vorm per punt:\n\n" +
      "1. **Wat er nu mis is.** Het probleem, niet de oplossing.\n" +
      "2. **Wat het oplevert.** Voor het werk, voor de klant, of voor de verkoop. Levert het niets van die " +
      "drie op, dan hoort het in de lijst \"niet doen\".\n" +
      "3. **Hoe we het zouden bouwen.** De route in grote stappen, plus wat er al ligt om op voort te bouwen.\n" +
      "4. **Waaraan je ziet dat het af is.** Eén controleerbare uitkomst. Geen \"het werkt nu beter\".\n" +
      "5. **Wat het raakt.** Welke bestaande motoren of schermen meebewegen, zodat er niets stilletjes " +
      "uiteen gaat lopen.\n\n" +
      "**De drie golven.** Golf 1 maakt bestaande motoren volwaardig (het meeste effect per uur, want het " +
      "fundament ligt er al). Golf 2 haalt de remmen weg die het bureau tegenhouden bij groei. Golf 3 maakt " +
      "er een product van dat een ander bureau kan gebruiken.\n\n" +
      "**De lus die zichzelf versterkt.** Dit is het punt waar dit document meer wordt dan documentatie:\n\n" +
      "- Bouwen begint hier: een sessie leest deze routekaart en pakt één punt.\n" +
      "- Bouwen eindigt hier: hetzelfde punt wordt bijgewerkt in de uitleg-map, het bijbehorende hoofdstuk " +
      "verderop wordt aangevuld, en de datum bovenaan gaat vooruit.\n" +
      "- Dus: het verhaal naar buiten en de agenda naar binnen zijn hetzelfde document. Er kan geen " +
      "verkoopversie ontstaan die te mooi is, en geen agenda die niemand meer leest.\n\n" +
      "**Volgorde is een advies, geen wet.** De nummers zijn de aanbevolen volgorde op verhouding tussen " +
      "opbrengst en inspanning. Wat er echt eerst gebeurt bepaalt de vraag van klanten.\n\n" +
      "**Waar je dit bedient.** Op `/admin/routekaart` staan dezelfde punten als knoppen: per punt de " +
      "startregel om te kopiëren, wat er loopt, en wat er op elkaar wacht. De volledige beschrijving van een " +
      "punt (deze teksten) klapt daar sinds 6 augustus 2026 open bij het punt zelf, in plaats van door te " +
      "linken naar dit document; je hoeft dus niet meer in een lang verhaal te zoeken naar het punt waar je " +
      "net op klikte. Eén bron, twee vensters. En in de kopbalk van élk beheerscherm zit een menu " +
      "**Intern** met de eerstvolgende taak en zijn startregel, plus de ingangen naar deze uitlegpagina, " +
      "zodat je daar niet eerst voor terug hoeft naar het klantenoverzicht.\n\n" +
      "**Het advies rekent mee met wat er loopt.** Een punt dat hetzelfde scherm raakt als een punt dat op dat " +
      "moment gebouwd wordt, wordt niet aangeraden; bij zo'n punt staat in plaats van de startregel dat je even " +
      "moet wachten. Kan er niets zonder botsing beginnen, dan zegt het scherm dat ook, in plaats van een leeg " +
      "vak te tonen. Dat was eerst niet zo: op 6 augustus 2026 liep R1 en werd R4 aangeraden, terwijl die elkaar " +
      "in de weg zitten. Een advies dat zijn eigen waarschuwing negeert is erger dan geen advies.",
  },

  {
    titel: "Waarom de opmaak nu wél overal klopt",
    kern: "De regel bestond drie keer en werd nul keer gecontroleerd. Nu is er een poort.",
    tekst:
      "**Wat er mis was.** Er staat een harde regel dat alles wat je ziet netjes gerenderd moet zijn: geen " +
      "sterretjes, geen pijpjes, geen ruwe kopjes in beeld. Die regel stond op drie plekken, in drie " +
      "bewoordingen, en werd door geen enkel systeem gecontroleerd. Voeg een kaal tekstvak toe met " +
      "AI-tekst erin, en de bouw slaagde, de proeven slaagden, en het ging gewoon naar productie. Vandaar " +
      "dat er steeds opnieuw stukjes ongeopmaakte tekst opdoken.\n\n" +
      "**Wat er nu gebeurt.** Er is één poort die meedraait met elke controle, en die drie dingen doet:\n\n" +
      "1. **De renderer wordt getest op wat er echt misging.** Een citaat, een codeblok, een tabel zonder " +
      "scheidingsregel, een lijst in een lijst: dat kende de renderer geen van alle, dus kwamen die tekens " +
      "letterlijk in beeld. Ze zijn nu alle vier opgelost, en de poort faalt zodra er weer een ruw " +
      "opmaakteken doorheen glipt.\n" +
      "2. **Nieuwe kale tekstvakken laten de controle falen.** Er is een lijst met plekken waar een kaal " +
      "veld terecht is (daar typ je zelf), elk met de reden erbij. Komt er een nieuwe bij, dan is dat " +
      "voortaan een bewuste keuze in plaats van een slordigheid.\n" +
      "3. **Hardgecodeerde maten en kleuren kunnen alleen nog dalen.** Er staan er nog honderden in de " +
      "opmaaklaag; die zijn niet in één keer op te ruimen. De poort legt het huidige aantal vast, zodat het " +
      "nooit meer oploopt en elke opruimronde het getal verlaagt.\n\n" +
      "**Wat er meteen is rechtgezet.** De uitwerking voor de sitebouwer stond in een monospace blok met de " +
      "sterretjes erin, en werd zo gekopieerd en gemaild. Het schrijfstijlprofiel stond als kale tekst in " +
      "een veld. De sturing per fase op een taakkaart werd niet gerenderd. De chatbubbels kregen wel " +
      "gerenderde tekst maar niet de bijbehorende typografie. Alle vier opgelost.\n\n" +
      "**Wat een machine niet kan.** Uitlijning, hiërarchie, contrast en of een scherm rustig oogt blijft " +
      "mensenwerk; daar is de design-checklist voor. De poort dekt af wat te tellen is.",
  },
  {
    titel: "Meldingen: wat iemand anders deed",
    kern: "De sitebouwer vinkt af, jij ziet het in je dashboard. Geen mail meer nodig.",
    tekst:
      "**Wat er nu mis was.** De sitebouwer vinkt taken af in haar eigen deel van het dashboard. Die status " +
      "ging stil de database in: het dashboard deed er niets mee, dus moest zij er een mail bij sturen om te " +
      "laten weten dat ze klaar was. Dat mailtje landde in de inbox in plaats van op de plek waar het werk " +
      "toch al staat.\n\n" +
      "**Wat er nu gebeurt.** Vinkt zij een taak af, dan verschijnt dat als melding in de kopbalk van elk " +
      "beheerscherm: wie het afrondde, bij welke klant, welke taak, met haar terugkoppeling erbij en een link " +
      "naar de taak zelf. Een oranje telletje laat zien hoeveel er nieuw is sinds de vorige keer. Openklappen " +
      "telt als lezen; er is geen aparte knop om iets als gelezen te markeren, want dat is een handeling die " +
      "niets oplevert. Vinkt zij iets weer uit, dan verdwijnt de melding: een melding die niet meer waar is " +
      "hoort niet te blijven staan.\n\n" +
      "**Wie het ziet.** Alleen de eigenaar. De sitebouwer werkt in hetzelfde dashboard, dus de meldingen " +
      "zitten achter dezelfde poort als de rest van het eigenaarswerk; zij krijgt geen belletje over haar " +
      "eigen taak. Van je eigen vinkje komt trouwens ook geen melding.\n\n" +
      "**Wat er bewust níet in zit.** Geen mail ernaast, want juist die mail was het probleem. En niet de " +
      "tweede afvinklijst (meta's en alt-teksten per klant): daar gaan er tientallen per keer doorheen, en " +
      "dan wordt een melding ruis in plaats van signaal. Komt dat er ooit bij, dan als één samenvatting per " +
      "dag per klant.",
  },
  {
    titel: "Hoe een werksessie begint en eindigt",
    kern: "Vaste vorm bij start en oplevering, en een link die pas komt als het écht live staat.",
    tekst:
      "Er lopen zes tot acht werksessies naast elkaar, elk over een ander onderdeel. Dat werkt, maar het " +
      "kostte per sessie opstarttijd (waar ging dit ook alweer over?) en per oplevering zoektijd (staat het " +
      "live, en wat moet ik nu doen?). Sinds 6 augustus 2026 hebben die twee momenten een vaste vorm.\n\n" +
      "- **Bij de start: drie regels.** Onderwerp, wat er laatst live ging, wat er nu open staat. Gevuld uit " +
      "een tabel *Lopende sporen* in het overdrachtsbriefje van het brein: één regel per onderwerp, en een " +
      "sessie werkt bij het afsluiten alleen zijn eigen regel bij.\n" +
      "- **Onderweg: stil.** Geen lopend commentaar met bestandsnamen en commando's. Alleen een beslissing " +
      "die genomen moet worden, of een probleem.\n" +
      "- **Aan het eind: één blok van maximaal tien regels.** Wat er gevraagd was, wat er nu live staat, welke " +
      "ene handeling er nog is, en de link naar het juiste scherm. Dezelfde vorm die de opdracht voor de " +
      "routekaartpunten al gebruikte, nu op één plek in plaats van twee.\n\n" +
      "**De link komt pas als het live staat.** Pushen is niet hetzelfde als live, en tot nu toe was er geen " +
      "manier om dat verschil te zien: je kon de site wel bekijken, maar niet aantonen dat het de nieuwe " +
      "versie was. Daarom geeft `/api/versie` de commit terug die op dat moment draait, en wacht " +
      "`scripts/wacht-op-deploy.sh` na een push tot precies die commit live staat (of tot een latere deploy " +
      "die hem bevat, want er wordt vanuit meerdere sessies en crons naar `main` gepusht). Pas daarna wordt " +
      "het scherm bekeken en de link gegeven. Loopt de tijdslimiet af, dan wordt de bouwstatus van die commit " +
      "opgevraagd via GitHub in plaats van te gokken: van buitenaf ziet een mislukte build er hetzelfde uit " +
      "als een trage.",
  },
  {
    titel: "Kleine aanpassingen: de tweak-stapel",
    kern: "Wat je onderweg ziet, meld je meteen; het gaat op een stapel en die wordt in één ronde doorgevoerd.",
    tekst:
      "Naast de routekaart met de grote punten loopt er een tweede, veel kortere lijn: de kleine dingen die " +
      "je pas ziet doordat je met het dashboard wérkt. Een venster dat half onder de kopbalk hangt, een link " +
      "die als kaal webadres in beeld staat in plaats van als documentnaam, een knop die op de verkeerde " +
      "plek zit.\n\n" +
      "**Wat er misging.** Zulke aanpassingen zijn twee minuten werk, maar kostten in de praktijk een " +
      "kwartier. Die tijd zat niet in het bouwen. Hij zat eromheen: een werksessie die eerst uitzoekt waar " +
      "het scherm staat, een wijziging die onderweg wordt uitgebreid met gedeelde code en een nieuwe proef, " +
      "en een volledige bouw plus deploy voor die ene regel. Die kosten betaal je per ronde, niet per " +
      "aanpassing. Tien losse aanpassingen kostten dus tien keer de volle prijs.\n\n" +
      "**Hoe het nu werkt.** Op elk beheerscherm staat rechtsonder een knopje **Tweak**. Je typt of " +
      "dicteert wat er niet klopt, op het moment dat je het ziet, vanaf het scherm waar je toch al staat. " +
      "Het scherm, het pad en de klant gaan automatisch mee, dus die hoef je niet te beschrijven, en een " +
      "schermafbeelding plak je er zo in. Alles komt op `/admin/tweaks` te staan. Als jij vindt dat het er " +
      "genoeg zijn, zet één knop de startregel op je klembord en werkt één werksessie de hele stapel af: " +
      "één keer inlezen, één bouw, één keer live.\n\n" +
      "**De regel die de tijdwinst maakt: een tweak is klaar als de tweak klaar is.** Binnen zo'n ronde " +
      "geen refactor, geen nieuwe proef, geen tweede bestand dat niet stuk was, en geen bijgewerkt " +
      "uitleghoofdstuk; een tweak is een correctie, geen uitbreiding. Blijkt er onderweg een melding groter " +
      "dan hij leek (een nieuw veld in de database, een nieuwe koppeling, gedrag dat meerdere schermen " +
      "tegelijk raakt), dan gaat die op **apart** met één regel uitleg en loopt de rest gewoon door. Zonder " +
      "die grens dijt de ronde uit en is precies de winst weg waar hij voor bedoeld is.\n\n" +
      "**Er is bewust geen drempel.** Geen \"vanaf tien meldingen\". Wanneer een stapel groot genoeg is " +
      "hangt af van waar je mee bezig bent, niet van een getal; het scherm toont de stand en jij drukt " +
      "wanneer het uitkomt. Daarnaast draait er elk uur vanzelf een ronde als er iets klaarstaat, dus in " +
      "de praktijk hoef je meestal niets te doen.\n\n" +
      "**De lus is rond, en dat is het punt.** Elke melding heeft een stand: in de wachtrij, wordt " +
      "gebouwd, staat live (controleer het), klaar. Zodra er iets live staat verschijnt er een melding in " +
      "de kopbalk, op de plek waar toch al gekeken wordt. Klopt het niet, dan druk je op \"Nog niet " +
      "goed\" en typ je erbij wat er mis is; diezelfde melding gaat dan met jouw correctie eronder terug " +
      "de wachtrij in. Dus geen tweede briefje dat niemand meer aan het eerste knoopt, maar één draadje " +
      "per onderwerp, met een teller die laat zien hoeveel rondes het gekost heeft. Die teller is geen " +
      "sier: als iets drie rondes kost, dan is de beschrijving of de controle het probleem, niet het " +
      "bouwen.\n\n" +
      "**Kleine aanpassing of groter idee, hetzelfde knopje.** Kies je \"groter idee\", dan gaat het " +
      "niet mee in een ronde maar komt er eerst een voorstel: wat het oplevert, hoe het gebouwd zou " +
      "worden, wat het raakt. Zeg je ja, dan druk je op **Wordt een routekaartpunt** en verhuist de " +
      "melding naar `/admin/routekaart`, naar het blok \"Uit de ideeënstapel\". Daar staat hij zichtbaar " +
      "te wachten op een nummer, met een startregel om er een echt punt van te maken. De routekaart zelf " +
      "blijft dus één bron, met een wachtkamer ervoor in plaats van een idee dat blijft hangen tussen de " +
      "aanpassingen van twee minuten.\n\n" +
      "**De stapel is een wachtrij, geen bak.** De volgorde op het scherm is de volgorde waarin de " +
      "eerstvolgende ronde ze doet, en die volgorde sleep je zelf. Per melding kun je twee dingen: " +
      "**direct doorvoeren** (hij springt vooraan) of **parkeren** (hij blijft staan maar gaat nergens " +
      "in mee, tot je hem terugzet). Parkeren is bewust iets anders dan weggooien: iets dat nu niet " +
      "uitkomt is niet hetzelfde als iets dat niet hoeft.\n\n" +
      "**De wachtrij bewaakt zichzelf, en dat moest wel.** Een ronde start nu op drie manieren: uit een " +
      "chat, elk uur vanzelf, en met de knop **Nu draaien** op het scherm zelf. Die kunnen op dezelfde " +
      "minuut afgaan, en twee rondes die tegelijk in dezelfde bestanden schrijven is de bekendste manier " +
      "om werk kwijt te raken. Daarom is er één slot: een ronde begint door dat slot te pakken, en wie " +
      "het niet krijgt bouwt niets. Valt een ronde halverwege dood, dan valt het slot na drie kwartier " +
      "vanzelf vrij en staan de meldingen gewoon weer in de rij. Geen afspraak dus, maar een sluiting; " +
      "een afspraak wordt gebroken zodra iemand haast heeft, en een cron heeft altijd haast.\n\n" +
      "**En de nulmeting, tegen het gat in dit alles.** De stapel vult zich met wat je toevallig " +
      "tegenkomt, dus een scherm waar je zelden komt levert nooit een melding op, ook niet als er van " +
      "alles aan mankeert. Onderaan `/admin/tweaks` staat daarom een afvinklijst van álle schermen: het " +
      "Intern-menu plus de tabbladen van een klant, zodat de lijst nooit achterloopt. Je loopt ze één " +
      "keer langs, meldt wat je ziet, en vinkt het scherm af met een datum. Daarna weet je van elk " +
      "scherm of het goed is of alleen ongezien, en dat verschil telt zodra er iemand anders meekijkt.",
  },

  // ── Golf 1 ──
];

import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Elke fase zegt wanneer hij voor het laatst iets opleverde",
    kern: "Vijf groene vinkjes zeggen niets als drie ervan van vóór de herziene strategie zijn.",
    tekst:
      "Achter elke fase staat een datum: het moment waarop die stap voor het laatst iets " +
      "opleverde. Voor de strategie is dat wanneer hij is vastgelegd, voor gelieerde pagina's " +
      "wanneer het advies is doorgegeven, en voor analyse, blauwdruk en copy wanneer het " +
      "document gemaakt is. Staat een fase nog open, dan zie je hoe lang hij al wacht.\n\n" +
      "Waarom dat er is: bij een locatiepagina stonden strategie, gelieerde pagina's, analyse, " +
      "blauwdruk en copy alle vijf op groen. Vijf vinkjes, en niets dat verraadde dat de " +
      "strategie van diezelfde ochtend was en de drie documenten van drie weken eerder, dus van " +
      "vóór de herziening. De pagina zag er af uit terwijl de inhoud van een achterhaald " +
      "uitgangspunt kwam.\n\n" +
      "De datum komt uit de database zelf, niet uit een teller die pas begint te lopen zodra " +
      "iemand kijkt. Een fase die in juli af was, heet dus ook juli.",
  },
  {
    titel: "De zeven fases per pagina",
    kern: "Eén vaste route, dus altijd duidelijk wat de volgende stap is.",
    tekst:
      "Elke pagina loopt langs zeven fases, in deze volgorde:\n\n" +
      "| Fase | Wat er gebeurt |\n" +
      "|---|---|\n" +
      "| Strategie | Doel, doelgroep, primair zoekwoord |\n" +
      "| Gelieerde pagina's | Welke pagina's hier omheen horen |\n" +
      "| Analyse | Wat de pagina nu doet, met bewijs |\n" +
      "| Blauwdruk | Hoe de pagina eruit moet gaan zien |\n" +
      "| Copy | De volledige tekst, getoetst aan de criteria |\n" +
      "| Implementatie | Het bouwen en live zetten |\n" +
      "| Structured data | Het schema-blok voor deze pagina |\n\n" +
      "**Achter elke fase staat wanneer hij is vastgelegd**, met datum en tijd. Dat is de bevestiging dat de " +
      "volgende stap met de verse versie werkt en niet met een oude, en het laat in één blik zien waar je " +
      "gebleven was. Staat een fase langer dan een dag stil zonder af te zijn, dan zie je in plaats daarvan " +
      "hoe lang hij al wacht.\n\n" +
      "Uit die stand volgt automatisch twee dingen: wat de volgende stap is, en wie er aan zet is (het " +
      "bureau of de developer). Dat wordt op één plek berekend, want eerder deden de kaart en de server dat " +
      "elk apart en dan zei de ene 'volgende: strategie' terwijl de knop ernaast een blauwdruk startte.\n\n" +
      "**Een chat is nog geen strategie.** Over elke pagina kun je vrij sparren; er wordt nooit stilzwijgend " +
      "iets tot strategie gebombardeerd. Pas de knop **\"Vat samen & leg strategie vast\"** maakt de conclusie " +
      "officieel: het hele gesprek wordt samengevat, die conclusie wordt de vastgelegde strategie die de " +
      "volgende fases (gelieerde pagina's, analyse, blauwdruk, copy) als basis meekrijgen, en er komt een net " +
      "Pingwin-document van in de Drive-map van de pagina, vastgelegd als werkzaamheid. Die ene knop staat op " +
      "beide plekken waar de chat staat: bij de pagina in Pagina's én op de projectkaart in de planning. " +
      "Zonder die klik draaien de volgende fases op de live data alleen, zonder de conclusies uit het " +
      "gesprek.\n\n" +
      "**Een aangeleverd document loopt vanzelf mee in élke fase (sinds 24 augustus 2026).** Noem je ergens " +
      "bij een pagina een Google-document (een strategiestuk, een schrijfopdracht, een linkregister met de " +
      "interne links per pagina), dan hoort dat document vanaf dat moment bij die pagina. Je hoeft er verder " +
      "niets voor te doen: niet op een knop drukken, niet zorgen dat het in het juiste veld staat, niet " +
      "nakijken of de samenvatting het heeft overgenomen. Het dashboard zoekt de links zelf op in de " +
      "vastgelegde strategie, in élk gesprek over die pagina, in meegegeven cluster-advies en in de extra " +
      "sturing die je bij het starten van een fase meegeeft.\n\n" +
      "Wat er daarna gebeurt: het document wordt volledig uitgelezen (een werkblad met álle tabbladen, niet " +
      "alleen het eerste) en één keer uitgewerkt tot een werkbriefing voor precies díe pagina, met de " +
      "interne links uitgeschreven per stuk (bestemming, exacte ankertekst, plek op de pagina), de " +
      "zoekwoorden, de opbouw en de verboden. Staat er een voorwaarde in waaraan nog niet is voldaan " +
      "(\"niet schrijven zolang er geen twee eigen projecten zijn\"), dan komt die bovenaan te staan in " +
      "plaats van te verdwijnen. Die briefing gaat compleet mee in de strategie-chat, de analyse, de " +
      "blauwdruk en de copy, met de documenten zelf eronder. Hij wordt bewaard en opnieuw gemaakt zodra er " +
      "een letter in een document verandert, dus je betaalt de wachttijd één keer en nooit met een " +
      "verouderde versie.\n\n" +
      "Waarom dit er kwam: het strategieveld ging altijd al letterlijk mee de fases in, maar een link daarin " +
      "was dode tekst. De motor kan een pagina en concurrenten uitmeten, en een gewoon opgehaald " +
      "Google-adres geeft geen tekst terug (ook niet bij een openbaar document; je krijgt de schil van de " +
      "bewerkomgeving). Het document kwam er dus gewoon uit, en niemand zag dat de afspraken nooit waren " +
      "meegewogen. Dat is de gevaarlijkste soort fout: hij ziet er goed uit.\n\n" +
      "**Vastleggen is één handeling, en dat is sinds 21 augustus 2026 ook echt zo.** Het gesprek op de " +
      "projectkaart en het gesprek bij de pagina in Pagina's zijn hetzelfde gesprek (één geheugen per " +
      "pagina), maar de knop eronder deed niet overal hetzelfde: legde je de strategie vast vanaf de " +
      "projectkaart, dan bleef de korte samenvatting \"In het kort\" boven de pagina leeg en moest je die " +
      "daar met een tweede knop alsnog laten maken. Twee kopieën van dezelfde keten, uit elkaar gelopen. Nu " +
      "maakt de server die samenvatting op het moment dat de strategie wordt vastgelegd, dus voor beide " +
      "knoppen gelijk; bij een pagina waarvan de strategie van vóór die datum is, verschijnt hij alsnog " +
      "vanzelf zodra je de pagina opent. En de knop staat nu ook in de fase-rij **Strategie** zelf, zodra " +
      "er een gesprek over die pagina ligt: daar begint de fase, dus daar hoort de knop die hem afmaakt. " +
      "Je hoeft de chat niet meer open te klappen en langs het hele gesprek te scrollen; wil je eerst " +
      "verder praten, dan staat \"Praat verder\" ernaast en dat opent hetzelfde gesprek.\n\n" +
      "**Nieuwe strategie trekt oud, doorgegeven advies in.** Leg je de strategie opnieuw vast, dan verdwijnt " +
      "advies dat die pagina eerder via \"Gelieerde pagina's\" doorgaf automatisch overal. Meegegeven advies " +
      "staat bij de ontvanger zichtbaar boven de chat met een knop \"Negeer dit advies\"; het lopende gesprek " +
      "wint altijd van ouder advies.\n\n" +
      "**Alle documenten van een pagina komen in één Google Drive-map, en dat is verplicht.** Je kiest hem " +
      "bovenaan het fase-blok: de knop staat naast \"Alles in één keer\", want daar worden ze ook gemaakt. " +
      "Start je een fase die een document maakt (strategie vastleggen, analyse, blauwdruk, copy, en op de " +
      "Pagina's-pagina ook interne links, structured data en cannibalisatie overnemen) zonder dat er al een " +
      "map is, dan klapt de mapkiezer vanzelf open; de actie draait pas zodra je kiest of een nieuwe map " +
      "maakt, of helemaal niet als je het venster sluit. Dat is bewust: één map per pagina, met alle " +
      "documenten van elke fase erin, in plaats van dat sommige stukken in Drive belanden en andere alleen in " +
      "het dashboard blijven hangen.\n\n" +
      "Bij een nieuwe pagina bestaat die map nog niet, en dat is de normale situatie. Daarom maak je hem in " +
      "hetzelfde venster: het naamveld staat al ingevuld met een voorstel uit het pad van de pagina " +
      "(`/hovenier/oosterhout/` wordt \"Hovenier Oosterhout\"), en zodra de map er is sta je er meteen in, " +
      "zodat de knop onderin hem ook echt vastlegt. Dat laatste ging eerder mis: de map werd gemaakt, maar " +
      "niet gekozen, en de documenten landden een niveau hoger.\n\n" +
      "**De fases zeggen alleen wat af is, niet wat je moet doen.** Vroeger kreeg elke fase bij het " +
      "aanmaken van een kaart een standaardzin mee (\"tekst aanscherpen\", \"toets deze pagina op " +
      "overlap\"). Die herhaalde de naam van de fase, en werd nooit herschreven: op een kaart waar de copy " +
      "al goedgekeurd was stond nog steeds \"tekst aanscherpen\", pal naast een groen vinkje. Die zinnen " +
      "zijn uit beeld. Een uitleg-knopje verschijnt nu alleen nog bij sturing die echt over deze pagina " +
      "gaat en uit een gesprek of een mail komt.\n\n" +
      "Eén uitzondering zit erin: bestaat de pagina nog niet, dan wordt de analyse overgeslagen. Je kunt een " +
      "pagina die er niet is niet analyseren.\n\n" +
      "**Elk document landt automatisch als Word-bestand in de Drive-map van de klant**: de analyse, de " +
      "blauwdruk en de copy worden na het genereren meteen geüpload en gedeeld, met de deel-link erbij " +
      "vastgelegd als werkzaamheid.\n\n" +
      "**De Implementatie-rij is de hele bouwstap in één regel: \"Maak concept\", \"Gedaan?\", " +
      "\"Mail\" en \"Naar developer?\".** \"Maak concept\" zet de geldende copy als concept-pagina " +
      "in de site van de klant; de live pagina blijft ongemoeid, publiceren doe je zelf in WordPress. " +
      "\"Naar developer?\" is één knop die de actie doet én de stand laat zien: klikken opent het " +
      "doorzet-venster (welke Drive-documenten gaan mee, wat moet de sitebouwer doen), en zodra de kaart " +
      "op de developerlijst staat is diezelfde knop rood en zegt hij \"Bij developer\". Nog een klik haalt " +
      "hem er weer af. Tot 18 augustus 2026 stond die ene stand op vier plekken tegelijk: een knop " +
      "\"Developer\", een vinkje \"(ligt bij dev)\", de statuspil rechts die óók \"Bij de developer\" zei, " +
      "en nog een knop onderaan de kaart. Die pil gaat nu weer alleen over de fase (af of niet af), net als " +
      "bij de andere zes. Een taak zónder pagina heeft geen fase-rij; daar staan \"Naar developer?\" en " +
      "\"Mail\" onderaan de kaart, en nergens anders. \"Gedaan?\" her-fetcht de live pagina en meet of de afgesproken " +
      "wijziging er echt staat; staat hij " +
      "er, dan vinkt Implementatie zichzelf af en kun je meteen door naar Structured data. Diezelfde meting " +
      "stond tot 17 augustus 2026 óók bovenaan de kaart als \"Is dit doorgevoerd?\"; twee namen voor één " +
      "meting, dus die knop is weg. Weg is ook \"Opschonen\" in de kaartkop, dat de kaarttekst herschreef " +
      "naar het vaste formaat: de kaarten waarvoor dat nodig was zijn opgeruimd en nieuwe komen al goed binnen. Bij die meting " +
      "staat nu ook een klikbare link naar het document waarmee vergeleken is (meestal het copy-document), " +
      "zodat je nooit hoeft te gokken welke tekst als bron gold.\n\n" +
      "**Het copy-document gaat standaard mee, naar de developer én in de mail.** Zowel het doorzet-venster " +
      "als het mailvenster laten zien wat je kunt meesturen, en beide vinken het copy-document nu standaard " +
      "aan als het er is (naast de pagina zelf en een eventuele goedgekeurde klantversie); voorheen moest je " +
      "dat zelf aanvinken en werd dat vaak vergeten. Ook stond de copy soms helemaal niet in de lijst: had " +
      "een pagina meerdere losse klantversies (bijlagen uit oudere mails), dan waren de zes plekken al vol " +
      "vóórdat de copy aan de beurt kwam. De pijplijn-documenten (copy, blauwdruk, analyse) staan nu vooraan " +
      "in die lijst en zijn dus nooit meer het slachtoffer van de grens.\n\n" +
      "**Elke regel in die lijst heet nu naar het bestand dat hij is, niet naar zijn categorie.** \"Copy\" en " +
      "\"Copy-doc\" naast elkaar leek twee keer hetzelfde, terwijl het vaak twee verschillende documenten " +
      "waren: het document uit de pijplijn en een los aangeleverde tekst (bijvoorbeeld het copy_url-veld van " +
      "een taak, gevuld vanuit een mail). Beide regels tonen nu de echte bestandsnaam (\"Copy: " +
      "Copy-briefing-hovenier-uden\"), en is het toevallig hetzelfde bestand, dan komt het er nog maar één " +
      "keer in te staan in plaats van als twee identiek ogende regels.\n\n" +
      "**Oudere tekst zonder Drive-link alsnog uploaden, zonder opnieuw te genereren.** Is een analyse, " +
      "blauwdruk of copy ooit gemaakt zonder gekozen map (van vóór de verplichte mapkeuze), dan wijst de link " +
      "naar de interne documentweergave. Daar staat nu de knop \"Kies Drive-map en upload\": hij zet precies " +
      "de al vastgelegde tekst om naar het Pingwin-document, zonder de AI opnieuw aan het werk te zetten, en " +
      "vanaf dat moment gebruiken Developer en Mail die nieuwe Drive-link.",
  },
];

# Interactie- en werkstroomprincipes

`DESIGN-PRINCIPES.md` gaat over hoe iets eruitziet. Dit bestand gaat over hoe iets zich gedraagt
en georganiseerd is: welke knoppen er zijn, waar ze staan, wat de volgende logische stap is, en
of de gebruiker in één oogopslag snapt wat er gebeurt. Een scherm kan perfect uitgelijnd zijn met
de juiste type-schaal en tóch onduidelijk aanvoelen: dat is het gat dat dit bestand dicht.

Dit is geen losse verzameling meningen. Deel A is de gevestigde basis uit het vakgebied
(interaction design bestaat als discipline sinds de jaren '80, deze principes zijn breed
gevalideerd, niet door Claude verzonnen). Deel B zijn twee concrete ontwerpwetten die daar direct
uit volgen. Deel C laat zien hoe die basis vandaag al concreet toegepast is op dit dashboard: geen
losse observaties, maar herkenbare gevallen van dezelfde tien heuristieken. Zo blijft dit bestand
groeien vanuit dezelfde, beoordeelbare bron, in plaats van een lijst losse ad-hoc regels.

## A. De basis: Nielsens tien heuristieken (Nielsen & Norman, sinds 1994, nog altijd de
   industriestandaard)

1. **Zichtbaarheid van systeemstatus.** De gebruiker weet altijd, binnen redelijke tijd, wat er
   gebeurt: bezig, gelukt, mislukt. Geen stille acties, geen knop die je twee keer laat klikken
   omdat je niet zeker weet of de eerste klik iets deed.
2. **Aansluiting bij de werkelijkheid van de gebruiker.** Taal, volgorde en concepten die de
   gebruiker al kent, geen technisch jargon of systeemtaal ("dropzone" is zo'n voorbeeld dat we
   al eerder vervingen).
3. **Gebruikerscontrole en vrijheid.** Een makkelijke weg terug of ongedaan maken; niemand voelt
   zich gevangen in een stap die hij per ongeluk startte.
4. **Consistentie en standaarden.** Dezelfde actie werkt overal hetzelfde, ziet er overal
   hetzelfde uit. Dit is ook de kern van `DESIGN-PRINCIPES.md` §6, maar geldt net zo hard voor
   gedrag als voor uiterlijk.
5. **Foutpreventie.** Een actie die niet kan of niet zou moeten, wordt liever onmogelijk gemaakt
   (uitgegrijsd, verborgen) dan dat de gebruiker een foutmelding achteraf krijgt. Dit dashboard
   doet dit al goed op één plek: "Ontbrekende gegevens ophalen" is vanzelf uitgeschakeld als er
   niets te halen valt, met uitleg waarom.
6. **Herkenning boven onthouden.** Toon opties en acties zichtbaar in plaats van dat de gebruiker
   moet weten of onthouden dat iets kan.
7. **Flexibiliteit en efficiëntie.** Een beginner kan de trage, voor de hand liggende weg volgen;
   een gevorderde gebruiker mag een snellere weg hebben (sneltoetsen, een commandobalk), zonder
   dat de beginner daardoor iets extra's moet leren.
8. **Esthetisch en minimalistisch ontwerp.** Elk extra element op het scherm concurreert om
   aandacht met wat er al staat. Iets weglaten is een ontwerpkeuze, geen bezuiniging.
9. **Help gebruikers fouten herkennen, verklaren en herstellen.** Een foutmelding in gewone taal,
   met wat er misging en wat je eraan doet, nooit een kale foutcode.
10. **Hulp en documentatie, alleen waar echt nodig.** Hulptekst is een noodgreep, geen
    ontwerpdoel. Valt op: dit dashboard zet nu bij bijna elke knop een los "?"-hulpicoon. Dat is
    op zichzelf een signaal: als een interface zoveel uitleg nodig heeft, is de eerste vraag of de
    interface zelf al duidelijk genoeg is, vóór je nog een hulpicoon toevoegt.

Bron: [NN/G — 10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/),
sinds 1994 ongewijzigd en nog altijd de gangbare basis in het vak.

## B. Twee ontwerpwetten die hieruit volgen

- **Wet van Fitts:** hoe groter en dichterbij een doel, hoe sneller en betrouwbaarder je het
  raakt. Een belangrijke, veelgebruikte actie mag dus groter en prominenter zijn; een risicovolle
  actie (verwijderen, iets onomkeerbaars) juist kleiner of verder van de andere knoppen af, zodat
  je er niet per ongeluk op klikt. ([NN/G — Fitts's Law and Its Applications in UX](https://www.nngroup.com/articles/fitts-law/))
- **Wet van Hick:** hoe meer gelijkwaardige keuzes tegelijk, hoe langer iemand nodig heeft om te
  beslissen, en hoe groter de kans op de verkeerde keuze. Een rij van negen knoppen kost dus
  meetbaar meer beslistijd dan drie duidelijk gegroepeerde knoppen, los van hoe netjes ze
  opgemaakt zijn. ([Laws of UX — Hick's Law](https://lawsofux.com/hicks-law/))

## C. Vandaag al concreet toegepast (Bedrijfsgegevens-paneel), gekoppeld aan de heuristiek

Dit zijn geen nieuwe, losse regels: het zijn herkenbare toepassingen van A en B op dit specifieke
dashboard. Nieuwe gevallen die je tegenkomt, koppel je op dezelfde manier aan een heuristiek
hierboven in plaats van er een losse ad-hoc regel bij te verzinnen.

1. **Eén bron van waarheid per status of telling** → toepassing van #1 (zichtbaarheid) en #4
   (consistentie). Nu meldden vier plekken onafhankelijk van elkaar "iets ontbreekt" (een badge
   op de kop, een aparte "N ontbreken"-vlag, een apart "Nog aan te leveren"-blok, rode
   veldranden). Kies de plek die het dichtst bij de oplossing staat als dé bron; de rest linkt
   ernaartoe of vervalt. Test: verberg je twee elementen en verdwijnt dezelfde informatie twee
   keer, dan is er een overbodig.
2. **Volgtijdelijke acties zijn een fase, geen knoppenrij** → toepassing van #6 (herkenning) en
   de wet van Hick. Ophalen → delen met de klant → vergrendelen → delen met de developer is een
   vaste volgorde, geen vier losse, gelijkwaardige keuzes. Toon de eerstvolgende logische stap
   nadrukkelijk (bijvoorbeeld als stappen-balk die meebeweegt met de fase van het record), de
   rest gedempt of als voltooide staat, niet als knop die opnieuw uitnodigt tot klikken.
3. **Een knop die alleen bestaat "voor het geval automatisch niet snel genoeg is" is een gat in
   de automatisering, geen feature** → toepassing van #8 (minimalisme): elke knop die enkel een
   trage achtergrondstap compenseert, is structurele schuld. Los eerst de vertraging zelf op
   (bijvoorbeeld opslaan bij het verlaten van een veld in plaats van na een paar seconden
   stilte); blijft de knop dan nog nodig, dan is dat een bewuste keuze, geen gewoontegebaar.
4. **Ruimtelijke groepering volgt de taak, niet het objecttype** → toepassing van de wet van
   Fitts/nabijheid en #6. Een upload/verwerk-werkstroom (aanleveren → verwerken) is een andere
   taak dan de hoofdwerkstroom van een record, ook al gaan beide over dezelfde gegevens. Vraag
   per knop "welke taak dient dit, wanneer in het proces", niet "over welk object gaat dit".

## Hoe je dit gebruikt

Zelfde plek in de workflow als `DESIGN-PRINCIPES.md`: lezen vóór je een scherm met meerdere
acties of statussen bouwt of herindeelt, niet pas als iemand letterlijk "usability" zegt. Een
signaal dat je hier moet kijken: meer dan drie tot vier knoppen in één rij, of meer dan één plek
die "iets ontbreekt/moet nog" meldt. De twaalf heuristieken en wetten uit deel A en B staan,
elk als los toetsbaar punt, in `DESIGN-CHECKLIST.md`, sectie "Interactie en werkstroom", zodat
dit net zo hard afgedwongen wordt als de visuele punten. Deel C hierboven zijn uitgewerkte
voorbeelden van die twaalf punten, geen extra, losse criteria.

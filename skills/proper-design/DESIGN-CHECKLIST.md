# Pre-oplever design-checklist

Loop deze lijst af vóórdat je vormgegeven werk oplevert. Lever pas op als elk punt klopt;
faalt er een, herstel het eerst. Toon de gebruiker kort dat je de checklist hebt gedraaid
(bijv. een paar regels "gecontroleerd: uitlijning, spacing, type-schaal, contrast, responsive").
Dit is bewust een gate: het voorkomt dat de gebruiker achteraf weer moet uitleggen wat er
rommelig is.

## Uitlijning
- [ ] Alles wat onder elkaar staat, deelt dezelfde linkerlijn (of een bewust raster).
- [ ] Geen zwevende elementen die net een paar pixels afwijken.
- [ ] Niet onnodig gecentreerd; lopende tekst en lijsten links uitgelijnd.

## Ruimte en ritme
- [ ] Alle afstanden komen van één spacing-schaal (veelvouden van 4 of 8).
- [ ] Gelijke onderdelen hebben gelijke tussenruimte (alle kaarten, alle secties).
- [ ] Genoeg padding binnen elementen; niets plakt tegen de rand.

## Typografie
- [ ] Maximaal een tot twee lettertypes.
- [ ] Alle tekstgroottes komen van één vaste type-schaal.
- [ ] Koppen-hiërarchie is consistent en duidelijk (H1 > H2 > H3 overal hetzelfde).
- [ ] Lopende tekst is 60 tot 80 tekens breed, met ruime regelafstand.
- [ ] Cijfers in kolommen zijn tabulair en lijnen uit.
- [ ] Niet alles vet; nadruk alleen waar het telt.

## Kleur en contrast
- [ ] Eén accentkleur, spaarzaam en gericht ingezet.
- [ ] Tekstcontrast haalt WCAG AA (circa 4.5:1 gewoon, 3:1 groot).
- [ ] Status (goed/let-op/fout) is los van het accent, en ook aan vorm/label herkenbaar.

## Hiërarchie
- [ ] Het belangrijkste valt als eerste op (grootte en ruimte, niet alleen kleur).
- [ ] Maximaal drie niveaus van nadruk.
- [ ] Bij data: samenvatting boven detail.

## Consistentie
- [ ] Knoppen, kaarten en andere bouwstenen zien er overal hetzelfde uit.
- [ ] Geen ad-hoc variant van iets dat al bestaat.
- [ ] Wat klikbaar is, ziet er klikbaar uit en heeft hover- én focus-toestand.

## Interactie en werkstroom
Eén punt per heuristiek/wet uit `INTERACTIE-PRINCIPES.md` (deel A en B), zodat elk van de twaalf
principes daar ook echt getoetst wordt, niet alleen gelezen. Overlapt een punt met een sectie
hierboven, dan wordt er verwezen in plaats van verdubbeld (zie regel 1, "één bron van waarheid").

1. **Zichtbaarheid van status.** Elke actie geeft binnen redelijke tijd merkbare feedback
   (bezig/gelukt/mislukt); geen stille acties. Toon dit op precies één plek per status of
   telling, niet op meerdere plekken tegelijk (zelfde principe als "Consistentie" hierboven).
2. **Aansluiting bij de werkelijkheid van de gebruiker.** Labels, volgorde en concepten
   gebruiken de taal van de gebruiker, geen technische systeemterm.
3. **Gebruikerscontrole en vrijheid.** Een actie is terug te draaien of af te breken; niemand
   zit vast in een stap die per ongeluk gestart is.
4. **Consistentie en standaarden.** Dezelfde actie werkt en oogt overal hetzelfde (zie ook de
   sectie "Consistentie" hierboven, geldt hier net zo hard voor gedrag als voor uiterlijk).
5. **Foutpreventie.** Een actie die niet kan of niet zou moeten, is uitgeschakeld mét uitleg
   waarom, niet pas een foutmelding achteraf.
6. **Herkenning boven onthouden.** Beschikbare acties en opties zijn zichtbaar; niets hoeft de
   gebruiker te onthouden of te raden. Acties met een vaste volgorde tonen de eerstvolgende stap
   nadrukkelijk, niet als rij gelijkwaardige knoppen waaruit de gebruiker zelf de volgorde moet
   afleiden.
7. **Flexibiliteit en efficiëntie.** Een gevorderde gebruiker mag een snellere weg hebben
   (sneltoets, commandobalk), zonder dat een beginner daar last van heeft.
8. **Esthetisch en minimalistisch ontwerp.** Geen knop die alleen bestaat om een trage
   automatische stap te compenseren (bijv. "Opslaan" naast autosave); los de vertraging zelf op
   vóór je de knop laat staan. Knoppen zijn gegroepeerd naar de taak die ze dienen, niet naar het
   object waar ze toevallig bij staan.
9. **Help bij het herkennen, verklaren en herstellen van fouten.** Een foutmelding staat in
   gewone taal, zegt wat er misging én wat je eraan doet, nooit een kale foutcode.
10. **Hulp en documentatie, alleen waar echt nodig.** Zoveel losse hulpicoontjes nodig dat bijna
    elke knop er een heeft? Vereenvoudig eerst de interface zelf, voeg niet nog een hulpicoon toe.
11. **Wet van Fitts.** Een risicovolle, onomkeerbare actie staat kleiner of verder van de andere
    knoppen af dan een veelgebruikte actie, niet even prominent.
12. **Wet van Hick.** Nooit meer dan circa vier tot vijf gelijkwaardige acties in één rij zonder
    duidelijke groepering; meer keuzes tegelijk kost meetbaar meer beslistijd.

De vier toegepaste gevallen in `INTERACTIE-PRINCIPES.md` deel C (één bron van waarheid,
fase-acties, geen pleister-knop, taakgroepering) zijn uitgewerkte voorbeelden van de punten
hierboven, geen aparte, extra criteria: dat zou zelf punt 1 en punt 4 breken.

## Toegankelijkheid
- [ ] Zichtbare focus-toestand voor toetsenbord.
- [ ] Klik-/tikdoelen groot genoeg (circa 44px).
- [ ] `prefers-reduced-motion` gerespecteerd.

## Responsive en thema
- [ ] Werkt op mobiel; geen horizontale schuifbalk op de pagina zelf (brede tabellen/grafieken
      scrollen in hun eigen kader).
- [ ] Als de omgeving licht én donker kent: beide zien er verzorgd uit, niet zomaar omgekeerd.

## Schone weergave
- [ ] Geen ruwe opmaaktekens (`#`, `**`, `|`, `---`) in beeld; alles gerenderd.
- [ ] Geen AI-tekst in een kaal tekstvak; koppen, bullets, tabellen netjes gerenderd.
- [ ] Scanbaar: korte alinea's, bullets, duidelijke kopjes.

## Wat een machine al voor je controleert (Pingwin SEO-dashboard)

In dat project draait `npm run proef` de poort `proeven/opmaak.proef.ts`. Die dekt de punten
af die mechanisch te controleren zijn: alles komt van één type-schaal, kleuren komen uit de
tokens, er staat geen ad-hoc variant naast iets dat al bestaat, en er blijft geen ruw
opmaakteken in beeld. Faalt hij, dan is het geen smaakkwestie maar een fout.

De rest van deze lijst blijft mensenwerk: uitlijning, hiërarchie, contrast en of het geheel
rustig oogt kan geen script beoordelen.

## De snelle eindcheck
Zou een goede designer hiernaar kijken en knikken? Zo niet, wat springt er als eerste
verkeerd uit? Fix dat, want dat is precies wat de gebruiker anders zou moeten aanwijzen.

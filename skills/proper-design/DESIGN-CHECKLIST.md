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

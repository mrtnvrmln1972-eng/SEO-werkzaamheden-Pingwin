# Designprincipes

De vakkennis van een goede designer, gedistilleerd tot toepasbare regels. Geen theorie om het
theoretiseren: bij elk principe staat waaróm het werkt, zodat je het met oordeel toepast en
niet als afvinklijstje. Merk-neutraal: dit gaat over hoe je iets opbouwt, niet over welke
kleuren of fonts een merk heeft.

## 1. Uitlijning en layout

Uitlijning is het verschil tussen "verzorgd" en "rommelig", nog vóór kleur of font.

- **Alles ligt op een lijn.** Kies een onzichtbaar raster en houd je eraan. Elementen die
  onder elkaar staan, delen dezelfde linkerkant. Waarom: het oog volgt onzichtbare lijnen;
  zodra iets een paar pixels afwijkt, leest het als slordig, ook als de kijker niet weet
  waarom.
- **Beperk het aantal uitlijn-lijnen.** Liever alles links uitgelijnd op één lijn dan sommige
  dingen links, sommige gecentreerd, sommige rechts. Elke extra lijn is visuele ruis.
- **Gebruik een raster of fl's/grid met gelijke gaps**, geen losse marges per element.
  Waarom: losse marges lopen uiteen en tellen ongemerkt dubbel; een gap-systeem houdt de
  afstanden vanzelf gelijk.
- **Groepeer wat bij elkaar hoort** (nabijheid). Dingen die samenhoren staan dicht bij
  elkaar, met meer ruimte naar de volgende groep. Zo ontstaat structuur zonder lijnen of
  kaders.
- **Centreren spaarzaam.** Korte koppen mogen gecentreerd, lopende tekst en lijsten vrijwel
  nooit; die lezen het prettigst links uitgelijnd met een rechte linkerkant.

## 2. Ruimte en ritme

Witruimte is geen leegte die je moet opvullen, het is het gereedschap dat rust en hiërarchie
maakt.

- **Werk met één spacing-schaal.** Kies een basis (bijv. 4 of 8 px) en gebruik alleen
  veelvouden: 4, 8, 12, 16, 24, 32, 48. Waarom: willekeurige afstanden (7px hier, 13px daar)
  zijn precies wat een layout onrustig maakt; een schaal geeft ritme.
- **Consistente afstand tussen gelijke onderdelen.** Alle kaarten dezelfde tussenruimte, alle
  secties dezelfde verticale ademruimte. Ongelijke afstanden tussen soortgelijke dingen is de
  meest voorkomende oorzaak van "het staat rommelig".
- **Meer ruimte betekent meer belang en meer rust.** Geef de belangrijkste dingen lucht.
  Volgestouwde schermen voelen goedkoop; ruimte voelt duur.
- **Ruimte binnen een element (padding) is even belangrijk als ruimte eromheen.** Tekst tegen
  de rand van een kaart of knop leest benauwd.

## 3. Typografie

Typografie draagt de pagina, ook als de pagina niet over tekst gaat.

- **Maximaal een tot twee lettertypes.** Bijvoorbeeld één voor koppen, één voor lopende tekst.
  Drie of meer fonts door elkaar is het snelste recept voor amateuristisch. Vaak is één goed
  font in verschillende gewichten al genoeg.
- **Eén type-schaal.** Leg een handvol vaste tekstgroottes vast (bijv. 12, 14, 16, 20, 24, 32)
  en gebruik alleen die. Waarom: koppen die "ongeveer even groot" zijn maar net niet, ogen als
  een fout. Vaste stappen maken hiërarchie helder.
- **Duidelijke koppen-hiërarchie.** H1 duidelijk groter dan H2, H2 groter dan H3, en dat
  consequent overal. De lezer moet aan de grootte kunnen zien welk niveau iets is, zonder na
  te denken.
- **Regellengte 60 tot 80 tekens** voor lopende tekst. Te breed en het oog verdwaalt bij de
  volgende regel; begrens de leesbreedte.
- **Regelafstand ruim genoeg** (circa 1.5 voor lopende tekst), koppen juist strakker.
- **Cijfers die in kolommen staan: tabulaire cijfers** (`font-variant-numeric: tabular-nums`).
  Waarom: dan lijnen bedragen netjes onder elkaar uit.
- **Zet niet alles vet.** Als alles nadruk heeft, heeft niets nadruk. Vet is voor het ene
  woord dat er echt toe doet.

## 4. Kleur en contrast

- **Kies neutralen bewust.** Een grijs met een vleugje van de accentkleur erin oogt gekozen;
  een steriel middengrijs oogt toevallig. Puur wit en bijna-zwart zijn prima als ze passen.
- **Eén accentkleur, spaarzaam ingezet.** De accentkleur wijst de weg naar de belangrijkste
  actie. Gebruik je 'm overal, dan wijst 'ie nergens meer naartoe.
- **Contrast moet leesbaar zijn.** Streef naar WCAG AA: circa 4.5:1 voor gewone tekst, 3:1
  voor grote tekst. Lichtgrijze tekst op wit oogt misschien elegant maar is vaak onleesbaar.
- **Status-kleuren staan los van de accentkleur.** Groen/oranje/rood voor goed/let-op/fout
  zijn functioneel, niet je huisstijl-accent. Houd ze gescheiden.
- **Kleur nooit als enige signaal.** Wie kleurenblind is, moet status ook aan een vorm, icoon
  of label kunnen zien.

## 5. Visuele hiërarchie

Het oog moet in een halve seconde weten waar het moet kijken.

- **Belangrijkste eerst.** De kern bovenaan of het grootst. Bij een dashboard: de samenvatting
  vóór het detail.
- **Maak onderscheid met grootte, gewicht, kleur en ruimte, in die volgorde.** Grootte en
  ruimte doen het meeste werk; leun niet meteen op kleur.
- **Drie niveaus is meestal genoeg**: primair, secundair, ondersteunend. Meer niveaus en de
  hiërarchie vervaagt.

## 6. Consistentie en componenten

- **Herhaal patronen.** Een knop ziet er overal hetzelfde uit, een kaart ook. Waarom:
  herkenning maakt een interface rustig en betrouwbaar; variatie zonder reden maakt 'm
  vermoeiend.
- **Bouw met herbruikbare bouwstenen**, geen ad-hoc kopieën met kleine verschillen. Als je
  een tweede knop nét anders maakt, ontstaat wildgroei.
- **Wat klikbaar is, ziet er klikbaar uit**, en heeft een zichtbare hover- en focus-toestand.

## 7. Toegankelijkheid (hoort er standaard bij, niet als extra)

- **Zichtbare focus-toestand** voor toetsenbordgebruik.
- **Klik- en tikdoelen groot genoeg** (richtlijn circa 44px).
- **Respecteer `prefers-reduced-motion`**: zet animaties uit voor wie daar last van heeft.
- **Semantische structuur**: echte koppen, knoppen en labels, geen div die net doet alsof.

## 8. Beweging (motion)

- **Beweging dient de gebruiker, niet de show.** Een subtiele overgang die uitlegt wat er
  gebeurt is goed; beweging om het bewegen oogt juist goedkoop en "AI-gemaakt".
- **Kort en zacht.** 150 tot 250 ms, met een natuurlijke easing. Snel genoeg om niet in de weg
  te zitten.

## 9. Dashboards en data (waar Maarten het meest bouwt)

- **Samenvatting boven detail.** Bovenaan de KPI's in één oogopslag, daaronder de tabellen.
- **KPI-tegels consistent**: zelfde formaat, zelfde plek voor label, waarde en verandering.
- **Status als vorm én kleur**: een pil, een chip, een gekleurd streepje, zodat wat aandacht
  vraagt er meteen uitspringt.
- **Grafiek-hygiëne**: geen 3D, geen overbodige rasterlijnen, duidelijke assen en labels, en
  het belangrijkste punt geaccentueerd. Een grafiek is om iets te zien, niet om te versieren.
- **Getallen uitlijnen** (rechts, tabulaire cijfers) zodat je ze kunt vergelijken.
- **Tabellen ademen**: genoeg padding in cellen, subtiele rijscheiding, koppen die opvallen.

## 10. Schone weergave van output (harde regel)

Alles wat de gebruiker ziet, moet 100% netjes gerenderd zijn. Dit is bij Pingwin al twintig
keer gevraagd en niet onderhandelbaar.

- **Nooit ruwe opmaaktekens in beeld**: geen losse `#`, `**`, `*`, `|` of `---` als letterlijke
  tekens. Render altijd naar nette HTML.
- **Nooit AI-tekst in een kaal tekstvak** of als platte string. Render koppen, bullets,
  tabellen en links netjes. Wil je het bewerkbaar houden, gebruik een gerenderde preview, geen
  ruwe textarea.
- **Vensters en previews groeien mee** zodat de hele inhoud zichtbaar is, en klappen niet dicht
  bij slepen of selecteren.
- **Maximaal scanbaar**: veel bullets, korte alinea's, duidelijke kopjes, kernwoorden vet.
  Liever veel korte blokjes dan lange lappen tekst.
- **Voor e-mail juist simpel**: aanhef, korte alinea's, simpele bullets, vriendelijke
  afsluiting. Geen tabellen, zware koppen of horizontale lijnen.

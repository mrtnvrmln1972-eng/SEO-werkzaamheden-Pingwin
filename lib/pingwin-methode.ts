// ═══════════════════════════════════════════════════════════
// DE PINGWIN-METHODIEK (de tweede helft van elk klantdocument)
// ═══════════════════════════════════════════════════════════
// Een goed voorstel bestaat uit twee helften: de klantspecifieke inhoud (die
// komt uit het dossier en uit onze metingen) én onze eigen werkwijze, visie en
// kwaliteitsnormen. Zonder die tweede helft leest een document als generieke
// AI-tekst; mét die helft leest het als een ervaren Pingwin-consultant.
//
// De bron van waarheid is het centrale brein (repo pingwin-brein):
//   brein/01-propositie-positionering.md
//   brein/02-offers-en-prijsfilosofie.md
//   brein/03-werkwijze-en-diensten.md
//   brein/04-tone-of-voice-en-schrijfregels.md
// Deze tekst is daar een bewuste kopie van, in de app gezet zodat de server hem
// zonder netwerk kan lezen. Wijzigt het brein, werk deze tekst dan mee bij.
// ═══════════════════════════════════════════════════════════

export const PINGWIN_KERNBELOFTE =
  "Pingwin zorgt dat jouw bedrijf gevonden én gekozen wordt, ook nu klanten via Google én AI zoeken.";

export const PINGWIN_WERKWIJZE = `## De kernbelofte
${PINGWIN_KERNBELOFTE}
Het woord "gekozen" is bewust: ranken is niet genoeg, je moet ook uit het antwoord gekozen worden.

## De SEO-werkwijze per pagina (vier stappen)
Elke nieuwe of te optimaliseren pagina doorloopt vier stappen, gefundeerd en op data:
1. Strategische analyse: wat is het doel van de pagina en welke zoekwoorden horen erbij?
2. SEO-analyse van de bestaande pagina, zodat bestaande content zoveel mogelijk behouden blijft, mits die aan de SEO-criteria voldoet.
3. Blauwdruk: de ideale opzet van de pagina, op basis van een analyse van de top 10 op dat zoekwoord (structuur, onderwerpen, zoekwoorden).
4. Copywriting: de blauwdruk uitgeschreven, met behoud van zoveel mogelijk bestaande tekst, zodat Google niet telkens een "nieuwe" pagina ziet.
De klant hoeft alleen de copywriting te bekijken en akkoord te geven; Pingwin verwerkt de pagina daarna zelf in de site.

## Wat we naast klassieke SEO doen
- AEO/GEO: vindbaarheid in ChatGPT, Perplexity, Google AI Overviews en Gemini.
- Structured data als fundament onder zowel rich results als AI-citaties.
- Interne linkstructuur en URL-structuur, zodat autoriteit naar de juiste pagina's stroomt.
- Een klant-dashboard waarin de klant live volgt wat we doen en wat het oplevert.

## Verwachtingsmanagement (eerlijk, en zo doen we het echt)
- Binnen 1 maand overtuigen we de klant van de aanpak, de inzet en de expertise.
- Vanaf maand 3 tot 4 de eerste duidelijke ranking-ontwikkeling.
- Eerlijk over schommelingen: groei is niet lineair, en Google bepaalt uiteindelijk de posities.

## Hoe we prijzen
- We verkopen een systeem plus een uitkomst, niet uren of "zoveel blogs per maand".
- Vaste prijs, geen verrassingen.
- Geen ranking-garantie (die kan niemand geven), wel harde afspraken over wat we doen en opleveren.
- Lopende SEO-trajecten liggen in de praktijk tussen 1.000 en 5.000 euro per maand, afhankelijk van scope en concurrentie.`;

export const PINGWIN_SCHRIJFREGELS = `SCHRIJFREGELS (hard, geldt voor alles wat je schrijft):
- Nederlands, nuchter, warm en zelfverzekerd. Geen superlatieven, geen verkoop-bombarie, geen holle beloftes.
- Gebruik NOOIT een los liggend streepje als zinsscheiding (geen em-dash, en-dash of streepje met spaties eromheen). Gebruik een komma, dubbele punt, puntkomma, haakjes of een nieuwe zin. Een koppelteken zonder spaties in een samenstelling (AI-tools, e-mail) mag wel.
- Het heet altijd "Pingwin", nooit "Penguin".
- Geen emoji.
- Concreet boven vaag: noem cijfers, pagina's en zoekwoorden als je ze hebt, en zeg het eerlijk als je iets niet weet.
- Schrijf "wij" en "we" als Pingwin, en spreek de klant aan met "je" of "jullie", passend bij de toon van hun eigen site.`;

// Waarschuwing die in ELK lead-document hoort zolang we geen toegang hebben tot
// de systemen van de klant. Voorkomt dat we voor gek staan als de klant zijn
// eigen Search Console erbij pakt, en is tegelijk een verkoopargument.
export const PINGWIN_DATA_VOORBEHOUD =
  "De cijfers in dit document komen uit externe bronnen (Ahrefs en onze eigen meting van de live website). Het zijn dus schattingen van buitenaf, gemaakt zonder toegang tot Search Console of Analytics van de klant. Met die toegang wordt het beeld nog scherper.";

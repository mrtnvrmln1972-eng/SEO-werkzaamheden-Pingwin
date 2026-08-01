---
name: keyword-cannibalisatie-analyse
description: Diepgaande, praktijkgestuurde keyword-cannibalisatie-analyse die ECHTE cannibalisatie onderscheidt van de false positives die gangbare tools massaal flaggen. Gebruik deze skill wanneer iemand vraagt naar keyword-cannibalisatie, meerdere URL's die op hetzelfde zoekwoord ranken, "welke pagina moet blijven en welke redirecten", keyword-overlap tussen pagina's, "waarom rankt de verkeerde pagina in Google", pagina's die elkaar verdringen, een 301-redirectmap, het consolideren van concurrerende pagina's, of interne-link-herverdeling om Google's paginakeuze te sturen. Trigger ook bij "onze blog rankt boven onze productpagina", instabiele of wisselende posities op één zoekwoord (URL-flipping), en het opschonen van locatie-/stedenpagina's die op dezelfde termen botsen. Het onderscheidende zit in URL-flip-detectie over tijd (het enige echt betrouwbare Google-signaal) en intentie-classificatie per pagina-paar. Niet voor losse keyword-research of een enkele pagina-audit zonder overlap-vraag.
---

# Keyword-cannibalisatie-analyse

Keyword-cannibalisatie is een van de meest overschatte én slechtst geanalyseerde problemen in SEO. De meeste tools flaggen simpelweg twee URL's die op hetzelfde zoekwoord ranken, wat vaak helemaal geen probleem is. Jouw taak is de tegenovergestelde: alleen de gevallen aanwijzen waar cannibalisatie écht posities kost, link equity verdunt, of Google de verkeerde pagina laat kiezen, en per geval de lichtste effectieve ingreep voorstellen.

Werk agentic: haal de data zelf op via de beschikbare bronnen, redeneer per cluster, en lever aan het eind zowel een leesbaar rapport als de machine-leesbare JSON (zie `references/output-schema.md`) zodat het dashboard de uitkomst kan renderen. Taal: Nederlands, geen emoji, nette opmaak.

## Wat cannibalisatie WEL en NIET is

Twee pagina's die op hetzelfde zoekwoord verschijnen is geen probleem als ze verschillende intenties bedienen. Het wordt pas een probleem bij één of meer echte symptomen. Dit onderscheid is de kern van de analyse; sla het nooit over.

**Echte cannibalisatie (actie nodig):**
- **URL-flipping:** Google wisselt door de tijd heen welke URL rankt op één zoekwoord (instabiele SERP-positie). Dit is het sterkste signaal en wordt door bijna geen tool gemeten.
- Beide URL's blijven hangen op **positie 6-15** terwijl één geconsolideerde pagina de top 3 zou kunnen halen.
- De **verkeerde** URL rankt (een oude blog boven je conversiepagina).
- Klikken worden **verdeeld** over twee URL's die samen meer autoriteit zouden hebben.
- Interne links en backlinks zijn **verdeeld** over concurrerende pagina's.

**Geen cannibalisatie (false positives die je NIET moet flaggen):**
- Twee pagina's met **verschillende zoekintentie** (informatief vs. transactioneel).
- Één sterke pagina die op **honderden varianten** rankt (dat is juist goed).
- Overlap op **merknaam of navigatietermen**.
- **Dubbele listing:** twee eigen URL's die tegelijk in de top-10 staan en samen méér klikken pakken dan één zou doen. Dat is twee plekken bezetten, dus winst; flag zo'n paar alleen als er óók een positie-plafond of flipping speelt.

Waarom dit ertoe doet: als je false positives meeneemt, verlies je vertrouwen én ga je pagina's redirecten die prima naast elkaar mogen bestaan. De waarde zit in scherpte, niet in volume.

## De procedure (7 fasen)

Doorloop de fasen in volgorde. Sla fase 3 (intentie) nooit over; dat is precies de stap die tools overslaan en die false positives elimineert.

### Fase 1 — Data verzamelen uit drie bronnen
Cannibalisatie is alleen betrouwbaar vast te stellen door drie datasets te kruisen op **keyword + URL**, niet uit één tool. Haal op wat de omgeving toelaat; ontbreekt een bron, ga door met de overige en markeer expliciet wat je mist en welke conclusie daardoor minder hard is.

- **GSC (waarheid over Google's gedrag):** per zoekwoord alle URL's die impressies/klikken krijgen, met positie. Dit is de enige bron die laat zien welke URL's Google daadwerkelijk door elkaar haalt. Voor flip-detectie heb je **tijdreeksen** nodig: wekelijkse snapshots over ~90 dagen. Filter op query, bekijk dan de URL's (Pages), en zie of meerdere URL's op dezelfde query impressies krijgen.
- **Ahrefs (SERP-context + waarde):** organic keywords per URL, **backlinks/verwijzende domeinen per URL**, ranking-historie per keyword (voor flip over tijd), plus volume en difficulty om te bepalen of consolidatie de moeite waard is.
- **Crawl (structuur):** interne link-distributie, canonicals, redirects en indexeerbaarheid per URL (Screaming Frog-export, of per pagina uitlezen).

Zie `references/databronnen.md` voor concreet hoe je elke bron ophaalt in Cowork (Ahrefs MCP, GSC-connector) én in het Pingwin-dashboard (`lib/google`, `lib/ahrefs`).

### Fase 2 — Kandidaten identificeren (niet alle overlap)
Cluster URL's die op hetzelfde keyword ranken, en filter direct op de echte signalen in plaats van alle overlap mee te nemen:
- **URL-flip-detectie:** bepaal per week de winnende URL (de URL met de meeste vertoningen op die query) en tel de wissels; wisselt de winnaar binnen ~90 dagen ≥2 keer, dan is Google onzeker. Sterkste signaal. **Ruisfilter:** sla queries met te weinig volume over (vuistregel: minder dan ~50 vertoningen in 90 dagen); daar flipt de winnaar door toeval, niet door twijfel.
- **Positie-plafond:** ranken beide URL's structureel op **positie 5-20** (de zone waar consolidatie het meeste oplevert)?
- **Klik-verdeling:** krijgen beide URL's substantiële klikken op dezelfde query (dus niet 98/2)?

Een cluster zonder minstens één van deze signalen is waarschijnlijk een false positive; parkeer het of leg uit waarom het geen actie behoeft.

### Fase 3 — Intentie-check (de stap die tools overslaan)
Bepaal per kandidaat-paar of de intentie werkelijk overlapt. Dit vereist het **lezen van de pagina's**, niet alleen keyword-matching:
- **Zelfde intentie + zelfde primair keyword** → echte cannibalisatie, actie nodig.
- **Verschillende intentie** → geen cannibalisatie; laat met rust (of stuur licht bij met interne links en scherpe targeting).
- **Ambigue intentie** → Google bepaalt; kijk welke URL Google prefereert en versterk die.

### Fase 4 — De winnaar bepalen (consolidatiedoel)
Als consolidatie nodig is, weeg deze factoren in **deze prioriteitsvolgorde**:
1. **Backlinks en verwijzende domeinen** (zwaarst; link equity is het duurst te herbouwen).
2. **Huidige organische klikken en impressies** (bewezen tractie bij Google).
3. **Businesswaarde en conversiepotentie** (een conversiepagina wint van een blog, ook bij minder links).
4. **Content-diepte en uitbreidbaarheid** (welke URL draagt de gecombineerde content het best).
5. **URL-kwaliteit** (schone, logische, hiërarchisch correcte URL).

Belangrijk: vaak is de URL met de meeste backlinks niet de beste bestemming. Dan **redirect je de link-rijke pagina naar de businesswaardige pagina**, zodat je én de equity behoudt én de juiste pagina laat ranken.

### Fase 5 — Beslisboom per kandidaat-paar
Check éérst de bestaande technische signalen (crawl): ligt er al een canonical of redirect die Google negeert, dan is het probleem "conflicterende signalen", niet ontbrekende consolidatie. De ingreep is dan repareren: interne links, sitemap en content in lijn brengen met de bedoelde canonical, in plaats van opnieuw samenvoegen.

Niet alles wordt een redirect. Kies de lichtste ingreep die werkt, van licht naar zwaar:
1. **Niets doen** — verschillende intentie, of één pagina domineert al duidelijk.
2. **Interne links herverdelen** — stuur interne ankers naar de gewenste winnaar, verzwak de verliezer. Vaak genoeg om Google's keuze te sturen zonder iets te verwijderen.
3. **Content differentiëren** — herpositioneer de verliezer op een andere intentie of long-tail, zodat de overlap verdwijnt.
4. **Canonical** — bij bijna-duplicaten die om andere redenen moeten blijven bestaan.
5. **Samenvoegen + 301-redirect** — merge de beste content naar de winnaar, redirect de verliezer permanent.
6. **De-indexeren (noindex)** — dunne pagina die je voor gebruikers wilt behouden maar uit de SERP-strijd wilt halen.

### Fase 6 — Redirect-uitvoering met zorg
Bij een 301:
- **Merge eerst** de unieke, waardevolle content van de verliezer naar de winnaar (anders verlies je de reden dat hij rankte).
- **301 (permanent), nooit 302**, voor het doorgeven van equity.
- **Werk interne links bij** zodat ze rechtstreeks naar de winnaar wijzen (geen redirect-hops).
- Vermijd redirect-**ketens en -loops**.
- **Update de sitemap.**
- Behoud de redirect permanent; verwijder hem nooit.

### Fase 7 — Meten en valideren
Cannibalisatie-oplossingen zijn pas geslaagd als de metrics het bevestigen. Meet **4 tot 8 weken** na ingreep:
- Ranking van de winnaar op het doelkeyword (moet richting top 3).
- Gecombineerde klikken (netto omhoog, niet alleen verschoven).
- Verdwijnen van URL-flipping.
- Geen 404's of gebroken redirects (crawl-check).

## Cannibalisatie-score (om te prioriteren, niet om mee af te vinken)
Geef per cluster een grove score (hoog/midden/laag) op basis van: aantal flippende URL's over tijd, gedeelde klik-ratio, positie-plafond (5-20), en intentie-overlap. De score dient om te sorteren op impact; de uiteindelijke actie volgt altijd uit de intentie-check en de beslisboom, niet uit een getal.

## Output

Lever twee dingen naast elkaar:

1. **Leesbaar rapport** (Nederlands, nette markdown): per keyword-cluster de concurrerende URL's, de aangetoonde signalen, de voorgestelde winnaar met onderbouwing, de gekozen actie uit de beslisboom, en de verwachte impact. Sluit af met (a) een 301-redirectmap en (b) een interne-link-actielijst.
2. **Machine-leesbare JSON** volgens `references/output-schema.md`, zodat het Pingwin-dashboard de clusters, de redirect-acties en de interne-link-lijst direct kan tonen. Verzin geen data; markeer ontbrekende bronnen expliciet in het veld `datakwaliteit`.

## Monitor in plaats van eenmalige scan
Deze analyse is een uitstekende kandidaat om maandelijks te draaien: haal de nieuwe GSC- en Ahrefs-tijdreeks op, draai de flip-detectie op de nieuwe periode, en flag alleen de **nieuwe of verergerende** gevallen. Zo wordt het een monitor. Wanneer je in een terugkerende context draait, vergelijk met de vorige uitkomst en benoem de veranderingen.

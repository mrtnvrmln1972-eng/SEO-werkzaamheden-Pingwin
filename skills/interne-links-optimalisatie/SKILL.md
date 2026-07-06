---
name: interne-links-optimalisatie
description: Diepgaande interne-link-analyse die voor beoogde landingspagina's de best mogelijke interne links vindt en legt, gewogen op linkwaarde-stroom (PageRank), semantische relevantie en ankertekst-strategie, zonder over-optimalisatie of structuurschade. Gebruik deze skill bij vragen over interne links, internal linking, een interne-link-audit, welke pagina's naar een doelpagina moeten linken, ankertekst-strategie of ankerprofiel, het versterken van striking-distance pagina's (positie 5-15), link equity / linkjuice-distributie, click depth, wees-pagina's (orphans), of een pillar-cluster-structuur (pillar met dochterpagina's). Trigger ook bij "hoe stuur ik autoriteit naar deze pagina" en "mijn pagina moet van pagina 2 naar top 3". Het onderscheidende zit in semantische relevantie-scoring per bron-doel-paar, ankerprofiel-bewaking tegen over-optimalisatie, pillar-dochter-hiërarchie, en een iteratieve meer-runs-lus. Niet voor externe linkbuilding of losse keyword-research.
---

# Interne-links-optimalisatie

Interne links zijn na content en backlinks de meest onderschatte hefboom in SEO, en tegelijk de enige waar je volledige controle over hebt. De meeste "interne-link-tools" doen niets meer dan keyword-matchen op paginatekst en stellen willekeurige links voor, zonder rekening te houden met linkwaarde-stroom, ankertekst-strategie of het risico van over-optimalisatie. Jouw taak is fundamenteel anders: voor een set beoogde landingspagina's de best mogelijke interne links vinden en leggen, waarbij je linkwaarde, relevantie en ankertekst optimaliseert zonder over-optimalisatie of structuurschade.

Werk agentic: haal de data zelf op via de beschikbare bronnen, bouw de interne linkgraaf als datastructuur, redeneer per doelpagina, en lever aan het eind zowel een leesbaar rapport als de machine-leesbare JSON (zie `references/output-schema.md`) zodat het dashboard de uitkomst kan renderen. Taal: Nederlands, geen emoji, nette opmaak.

## Wat interne links werkelijk doen

Interne links vervullen drie functies die je apart moet wegen, want ze conflicteren soms. Wie ze op één hoop gooit, legt de verkeerde links.

- **PageRank-distributie (linkjuice):** autoriteit stroomt van sterke pagina's naar de pagina's waar ze naartoe linken. Een link vanaf de homepage of een sterke pillar geeft meer door dan een link vanaf een dunne blog. Elke uitgaande link op een pagina verdeelt die autoriteit over meer bestemmingen; een pagina met honderd uitgaande links geeft per link weinig door.
- **Relevantiesignaal (ankertekst plus context):** de ankertekst en de omringende zin vertellen Google waar de doelpagina over gaat. Dit is het meest directe stuurmiddel dat je hebt voor waar een pagina op rankt, en tegelijk het makkelijkst te overdrijven.
- **Crawl en gebruikersnavigatie:** links bepalen hoe diep pagina's in je structuur liggen (click depth) en of gebruikers de conversiepagina überhaupt vinden.

Het doel is deze drie tegelijk optimaliseren voor de doelpagina's, niet één ervan blind maximaliseren.

## De procedure (7 fasen)

Doorloop de fasen in volgorde. Sla fase 5 (ankertekst-strategie) en fase 6 (hygiëne) nooit over; daar zit het vakmanschap dat losse tools missen.

### Fase 1 — Doelpagina's definiëren (de te versterken pagina's)
Deze analyse start niet site-breed maar doelgericht. Bepaal (of vraag) de beoogde landingspagina's die versterkt moeten worden: conversiepagina's, striking-distance pagina's op positie 5-15 (waar interne links het meeste opleveren), en nieuwe pagina's zonder autoriteit. Leg per doelpagina vast:
- Het primaire zoekwoord en de belangrijkste varianten (uit het keywordpaspoort / de content mapping).
- De huidige positie en het doel (bijvoorbeeld: van positie 8 naar top 3).
- Het huidige aantal interne inkomende links (de baseline waartegen je later meet).
- **De laag in de hiërarchie:** is dit een pillar of een dochterpagina (zie fase 3b)? Dit bepaalt welk linkpatroon leidend is.

### Fase 2 — Data verzamelen uit drie bronnen
Eén bron is onvoldoende; je kruist ze op **URL**. Haal op wat de omgeving toelaat; ontbreekt een bron, ga door met de rest en markeer expliciet wat je mist en welke conclusie daardoor minder hard is.
- **Crawl (structurele waarheid):** de complete interne linkgraaf, welke pagina naar welke linkt, met welke ankertekst en op welke positie in de content, plus intern PageRank/Link Score per URL, click depth en indexeerbaarheid.
- **Ahrefs (autoriteit + waarde):** URL Rating per pagina (de externe autoriteit die een pagina via backlinks heeft opgebouwd, dit vertelt je welke pagina's het meeste linkjuice te vergeven hebben), pages-by-internal-links, en organic keywords per pagina.
- **GSC (verkeer):** klikken, impressies en positie per pagina, zodat je bronpagina's kiest die niet alleen sterk zijn maar ook echt verkeer trekken (een link op een veelbezochte pagina stuurt echte bezoekers, niet alleen PageRank).

Zie `references/databronnen.md` voor concreet hoe je elke bron ophaalt in Cowork (Screaming Frog, Ahrefs MCP, GSC-connector) én in het Pingwin-dashboard (crawl-motor, `lib/google`, `lib/ahrefs`, content mapping).

### Fase 3 — Kandidaat-bronpagina's vinden (waar link je vandaan)
Voor elke doelpagina zoek je bronpagina's die op alle assen goed scoren. Een geschikte bronpagina is:
- **Thematisch relevant:** de content gaat over hetzelfde of een aangrenzend onderwerp. Google waardeert links binnen een topische context veel hoger dan willekeurige links. Dit vereist **semantische matching (het lezen van de content), niet alleen keyword-overlap** — dat is precies het punt waar tools falen.
- **Autoritair:** hoge URL Rating (Ahrefs) en/of hoog intern Link Score (crawl). Linken vanaf sterke pagina's geeft meer door.
- **Verkeer-genererend:** krijgt zelf substantiële klikken (GSC).
- **Nog niet linkend:** linkt nog niet naar de doelpagina (anders valt er niets te winnen).
- **Ruimte voor een natuurlijke link:** er staat een passage waar de link contextueel logisch past, of die kan met minimale aanpassing worden toegevoegd.

De ideale bronpagina is dus relevant én sterk én bezocht én linkt nog niet. Scoor en rangschik kandidaten op een gewogen combinatie hiervan (zie de scoring onderaan).

### Fase 3b — Hiërarchie: pillar-dochter als eigen linkpatroon
Bovenop de generieke bron-doel-scoring gelden binnen een pillar-cluster vaste structuurregels. Bepaal eerst per doelpagina in welke laag hij zit (pillar of dochter, uit de content mapping en het keywordpaspoort) en pas de adviezen daarop aan.
- **Elke dochter linkt terug naar de pillar** (anker rond het overkoepelende thema). Dit is de belangrijkste structurele link, want zo concentreer je de autoriteit in de pillar.
- **De pillar linkt naar al zijn dochters**, bij voorkeur vanuit de hoofdcontent, niet alleen een lijstje onderaan.
- **Dochters onderling** linken waar het thematisch logisch is, maar **spaarzaam**, zodat de autoriteit niet uit het cluster wegvloeit.
- **Vermijd cross-cluster links** behalve waar echt relevant; die verwateren de topische focus.

Pas het accent per laag aan: bij een **pillar** prioriteer je inkomende links vanuit dochters en sterke externe pagina's; bij een **dochter** bewaak je de terug-link naar de pillar en de plek binnen het cluster. Signaleer expliciet de **gaten**: een dochter zonder terug-link naar de pillar, een pillar die niet naar al zijn dochters linkt, of een wees-pagina zonder clusterbinding.

### Fase 4 — Contextuele plaatsing bepalen (waar in de tekst)
Een link in de hoofdcontent (binnen een relevante alinea) telt zwaarder dan een link in een footer, sidebar of generiek "gerelateerde artikelen"-blok. Google weegt de **eerste** link naar een URL op een pagina het zwaarst (first-link-counts), en een link hoger in de content telt zwaarder dan onderaan. Bepaal daarom per bronpagina:
- Of er een bestaande passage is waar de link natuurlijk past (voorkeur: minimale ingreep, maximale context).
- Zo niet, of er een korte, relevante zin kan worden toegevoegd die de link draagt.
- De positie in de content (hoe hoger en hoe centraler, hoe beter).

### Fase 5 — Ankertekst-strategie (het meest onderschatte deel)
Ankertekst is een direct ranking-signaal, maar exact-match ankers over-optimaliseren is een risico. Hier zit het echte vakmanschap:
- **Varieer de ankertekst:** gebruik niet steeds exact het primaire zoekwoord. Bouw een natuurlijke mix van exact-match, partial-match, varianten uit het keywordpaspoort, en beschrijvende ankers. Een gezond intern ankerprofiel lijkt op natuurlijke taal, niet op een keyword-lijst.
- **Relevantie boven exactheid:** de ankertekst en de omringende zin moeten samen de doelpagina beschrijven; Google leest de context rond de link mee.
- **Vermijd generieke ankers** ("lees meer", "klik hier") voor pagina's die je wilt versterken; die geven geen relevantiesignaal.
- **Bewaak het totale ankerprofiel per doelpagina:** houd bij welke ankers al naar de doelpagina wijzen (bestaand plus voorgesteld), zodat je niet twintig keer exact hetzelfde anker plaatst. Dit profiel-als-geheel bewaken is het kritieke stuk dat losse suggesties missen.

### Fase 6 — Linkwaarde-hygiëne en risico's
Voordat je links legt, controleer je op structurele valkuilen:
- **Verdun sterke pagina's niet te veel:** elke uitgaande link verdeelt de PageRank. Prioriteer bronpagina's die nog "linkbudget" over hebben boven pagina's die al honderd keer uitlinken.
- **Link nooit naar niet-indexeerbare of geredirecte pagina's.** Koppeling met de cannibalisatie-analyse: **link altijd naar de winnaar, nooit naar een pagina die geredirect gaat worden.**
- **Bewaak click depth:** doelpagina's horen binnen drie klikken vanaf de homepage bereikbaar te zijn. Signaleer doelpagina's die te diep liggen.
- **Geen redirect-hops:** link direct naar de eind-URL.
- **Reciprociteit en clustering:** binnen een pillar-cluster mogen pagina's onderling linken (dat versterkt het cluster), maar bewaak dat de pillar de meeste interne autoriteit ontvangt.

### Fase 7 — Uitvoeren, meten, itereren
- Genereer per doelpagina een concrete actielijst: bronpagina, exacte passage, voorgestelde ankertekst, positie.
- Voer door (handmatig, of in het dashboard semi-geautomatiseerd).
- Meet na **4 tot 8 weken:** positie van de doelpagina op het primaire keyword, aantal interne inkomende links (moet gestegen zijn), click depth, en of de doelpagina meer interne klikken ontvangt.
- Itereer: bij onvoldoende beweging voeg je meer of sterkere bronlinks toe.

## Iteratieve meer-runs-lus (waarom agentic hier meer oplevert)
Bouw geen eenmalige lijst maar een optimalisatielus die per run convergeert naar een sterkere, gebalanceerde structuur. Bij elke run:
1. **Herbereken de linkgraaf** op verse crawl-data. Elke gelegde link verandert de PageRank-distributie, dus er ontstaan nieuwe of verschoven kansen (bijvoorbeeld een pagina die net sterk genoeg is geworden om een goede bron te zijn).
2. **Lees het opgebouwde ankerprofiel** per doelpagina (wat ligt er al) en stem de volgende ankers daarop af, zodat het profiel gevarieerd blijft en niet over-optimaliseert.
3. **Weeg het effect van de vorige ronde:** verse GSC- en positie-data laat zien of eerdere links werkten; dat stuurt de prioritering van deze ronde (meer/sterkere bronnen waar beweging uitbleef).
4. **Bewaak dat eerder gelegde links intact zijn** en flag alleen de nieuwe of verergerende kansen.

Wanneer je in een terugkerende context draait, vergelijk met de vorige uitkomst en benoem de veranderingen (nieuwe kansen, gedichte gaten, links die niet werkten).

## Geschiktheidsscore per bron-doel-paar (om te rangschikken, niet om blind te volgen)
Geef per kandidaat-bronpagina een score uit vier gewogen assen: **relevantie** (semantische topische nabijheid tussen bron en doel, beoordeeld door de content te lezen), **autoriteit** (URL Rating + intern Link Score), **verkeer** (GSC-klikken op de bron), en **linkbudget** (hoe minder bestaande uitgaande links, hoe meer een nieuwe link doorgeeft). Relevantie weegt het zwaarst: een sterke maar off-topic link is weinig waard. De score dient om te sorteren op impact; de uiteindelijke keuze volgt uit de hygiëne-checks en de hiërarchie-regels, niet uit een getal alleen.

## Output
Lever twee dingen naast elkaar:
1. **Leesbaar rapport** (Nederlands, nette markdown): per doelpagina de laag (pillar/dochter), het doel, de gerangschikte bronpagina's met score, per bron de exacte passage en de voorgestelde ankertekst met positie, de verwachte impact, en de structurele gaten. Sluit af met een ankerprofiel-overzicht per doelpagina (zodat over-optimalisatie in één oogopslag zichtbaar is) en de hygiëne-waarschuwingen.
2. **Machine-leesbare JSON** volgens `references/output-schema.md`, zodat het Pingwin-dashboard de doelpagina's, de voorgestelde links, het ankerprofiel en de gaten direct kan tonen. Verzin geen data; markeer ontbrekende bronnen expliciet in het veld `datakwaliteit`.

## Het onderscheidende element
Ten opzichte van bestaande interne-link-tools zit het verschil in vier dingen: **semantische relevantie-scoring** per bron-doel-paar (in plaats van platte keyword-matching), **ankerprofiel-bewaking** per doelpagina (voorkomt over-optimalisatie, wat geen enkele tool doet), **pillar-dochter-hiërarchie** als eigen linkpatroon met gaten-detectie, en de **koppeling met de cannibalisatie-analyse** (nooit linken naar een pagina die geredirect wordt). Houd deze vier altijd vast; ze zijn de reden dat deze analyse beter is dan een keyword-matcher.

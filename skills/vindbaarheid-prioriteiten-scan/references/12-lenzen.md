# De 12 Analyse-lenzen, uitvoeringsdetails

Per lens: wat we zoeken, welke Ahrefs MCP endpoints we aanspreken, welke drempels gelden, en wat de typische action card eruit ziet.

---

## Inhoudelijke lenzen (zes)

### Lens 1, Striking distance keywords

**Wat.** Zoekwoorden waar de site al voor rankt op positie 5 tot 20, met serieuze impressies. Een kleine zet brengt ze richting top 3. Hoogste verhouding tussen impact en effort.

**Endpoints.**
- `gsc-keywords` op rootdomein, filter op `position` tussen 5 en 20 en `impressions` boven drempel
- `site-explorer-organic-keywords` op rootdomein, filter op `position` tussen 5 en 20 en `volume` boven drempel
- Combineer beide bronnen, dedupliceer op keyword+pagina

**Drempels.**
- Minimaal 100 impressies per maand (GSC) of zoekvolume ≥ 100 (Ahrefs)
- Minimaal 1 maand data
- Posities 5 tot 20 voor "striking", 3 tot 5 voor "snippet-kans" (zie lens 6)

**Target-positie.** 1 tot 3 voor commerciële keywords; 1 tot 5 voor informationele.

**Vervolg-skill.** seo-analyse-landingpage, dan seo-copywriting.

---

### Lens 2, CTR-onderkans

**Wat.** Pagina's die wel ranken (positie 1 tot 10), wel impressies krijgen, maar onder de benchmark-CTR voor die positie scoren. Vaak een title- of meta-issue.

**Endpoints.**
- `gsc-ctr-by-position` op pagina-niveau
- `gsc-pages` voor traffic-context

**Drempels.**
- Werkelijke CTR is minder dan 70% van de Advanced Web Ranking 2024 benchmark voor die positie
- Minimaal 500 impressies per maand om signaal-bias te voorkomen

**Target-positie.** Geen positiewinst, maar CTR-uplift naar benchmark.

**Vervolg-skill.** seo-copywriting (alleen meta-blok).

---

### Lens 3, Cannibalisatie

**Wat.** Twee of meer URLs van het rootdomein die voor hetzelfde zoekwoord ranken, met overlap qua intent. Zorgt dat geen van beide doorbreekt.

**Endpoints.**
- `site-explorer-organic-keywords` op rootdomein, group by keyword
- Filter: keywords met 2 of meer rankende URLs van eigen domein, beide in top 30
- `gsc-keywords` voor verificatie en intentie-check

**Drempels.**
- 2 of meer eigen URLs in top 30 voor hetzelfde keyword
- Volume ≥ 100 per maand
- Intent-overlap manueel of via SERP-vergelijking checken

**Vervolg-skill.** contentmapping-url-structuur.

---

### Lens 4, Verouderde toppers

**Wat.** Pagina's die historisch goed scoorden maar nu dalen in posities of traffic. Vaak refresh-kans, geen volledige rewrite.

**Endpoints.**
- `gsc-page-history` op individuele topper-URLs
- `gsc-pages-history` voor het hele domein om dalers te identificeren
- `site-explorer-pages-history` als aanvulling

**Drempels.**
- Pagina rankte ooit in top 5, nu top 6 tot 20
- Daling van minimaal 30% in clicks over de laatste 3 maanden ten opzichte van piek
- Pagina ouder dan 12 maanden

**Vervolg-skill.** seo-analyse-landingpage, dan seo-copywriting.

---

### Lens 5, Content gaps

**Wat.** Zoekwoorden met intentie en volume waar de site geen rankende pagina voor heeft, terwijl concurrenten wel ranken.

**Endpoints.**
- `keywords-explorer-related-terms` op hoofdthema
- `keywords-explorer-matching-terms` op hoofdzoekwoord
- `keywords-explorer-search-suggestions`
- `site-explorer-organic-competitors` om concurrenten te bepalen
- Cross-check: keyword waarop minimaal 2 concurrenten in top 10 ranken en eigen domein nergens in top 50

**Drempels.**
- Volume ≥ 50 per maand
- KD (keyword difficulty) ≤ 40 voor commerciële keywords; ≤ 60 voor informationele
- Eigen domein niet in top 50

**Vervolg-skill.** blauwdruk-seo-landingpage, dan seo-copywriting.

---

### Lens 6, Featured-snippet-kansen

**Wat.** Keywords waar eigen domein op positie 2 tot 5 staat en een concurrent een featured snippet claimt. Snippet kapen geeft directe traffic-uplift en AEO-zichtbaarheid.

**Endpoints.**
- `serp-overview` per kandidaat-keyword, kijk naar `serp_features` array
- `gsc-keywords` met `position` tussen 2 en 5

**Drempels.**
- Eigen positie 2 tot 5
- Concurrent bezet de snippet
- Volume ≥ 200 per maand

**Vervolg-skill.** seo-copywriting (alleen FAQ-blok, gericht op snippet-kapen patroon).

---

## Technische lenzen (drie)

### Lens 7, Site-audit-issues

**Wat.** Crawl-errors, broken pages, duplicated content, slow pages, mixed content, indexing issues. Severity-niveaus.

**Endpoints.**
- `site-audit-issues` op laatste audit
- `site-audit-page-explorer` voor diepere context per pagina

**Drempels.**
- Severity HIGH: alles meenemen
- Severity MEDIUM: meenemen als de pagina commerciële intent of ≥ 100 maandbezoekers heeft
- Severity LOW: meenemen alleen als clusters van 10+

**Vervolg-skill.** Geen Pingwin-skill. Tickets extern, naar dev of CMS-team.

---

### Lens 8, Schema-markup-gaps

**Wat.** Pagina's zonder de schema-types die wel passen bij hun pagina-type. FAQ-snippets, LocalBusiness, Product, Article. Geeft AI-overviews en rich results een handvat.

**Endpoints.**
- `site-audit-page-content` met filter op aanwezigheid `schema_types`
- Cross-reference met pagina-type uit klantprofiel

**Drempels.**
- Pagina-type FAQ → FAQPage-schema verplicht
- Pagina-type lokaal-service → LocalBusiness-schema verplicht
- Pagina-type product → Product + Offer-schema verplicht
- Pagina-type blog/article → Article-schema verplicht

**Vervolg-skill.** seo-copywriting (structured data uit blauwdruk).

---

### Lens 9, Interne-link-onderbedeling

**Wat.** Commerciële pagina's die te weinig interne links krijgen ten opzichte van hun belang. Hoge URL Rating mogelijk, lage interne link count.

**Endpoints.**
- `site-explorer-pages-by-internal-links` voor inkomende interne links per URL
- `site-explorer-url-rating-history`
- `site-explorer-pages-by-traffic`

**Drempels.**
- Pagina is geclassificeerd als commercieel of conversie-gericht (uit klantprofiel of URL-pad zoals `/diensten/`, `/producten/`)
- Aantal inkomende interne links ≤ 5
- Maandelijks verkeer < 100 OF positie hoofdzoekwoord ≥ 10

**Vervolg-skill.** contentmapping-url-structuur.

---

## Autoriteitslenzen (twee)

### Lens 10, Broken backlinks reclamation

**Wat.** Externe links die naar 404-pagina's of niet-bestaande URLs op het eigen domein wijzen. Met een redirect of een nieuwe pagina vang je die link-equity terug.

**Endpoints.**
- `site-explorer-broken-backlinks`
- Filter op DR ≥ 30 van de verwijzende pagina (lage-kwaliteit links zijn niet de moeite waard)

**Drempels.**
- DR verwijzende pagina ≥ 30
- Geen `nofollow`
- Niet eerder herwonnen (markeer in tracker)

**Vervolg-skill.** Geen Pingwin-skill. Technisch fix via dev (redirect) of outreach.

---

### Lens 11, Lost backlinks recovery

**Wat.** Links die de site recent verloren heeft (laatste 90 dagen), waarvan de bron-pagina nog leeft. Outreach kan ze vaak terugkrijgen.

**Endpoints.**
- `site-explorer-all-backlinks` met filter `is_lost=true` en `lost_after` op laatste 90 dagen
- `site-explorer-refdomains-history`

**Drempels.**
- Laatste 90 dagen verloren
- DR bronpagina ≥ 30
- Bronpagina nog steeds bereikbaar (niet 404)

**Vervolg-skill.** Geen Pingwin-skill. Outreach extern.

---

## AEO-lens (één)

### Lens 12, AI-zichtbaarheid via Brand Radar

**Wat.** Hoe vaak en hoe goed verschijnt het merk in AI-antwoorden van ChatGPT, Perplexity, Google AI Overviews en Gemini. Welke pagina's worden gecite, welke share of voice heeft het merk in de relevante prompt-set, hoe staat dat ten opzichte van concurrenten.

**Endpoints.**
- `brand-radar-impressions-overview` (totale zichtbaarheid in AI-antwoorden)
- `brand-radar-mentions-overview` plus `brand-radar-mentions-history` (mentions trend)
- `brand-radar-sov-overview` plus `brand-radar-sov-history` (share of voice)
- `brand-radar-cited-pages` (welke eigen pagina's worden gecite)
- `brand-radar-cited-domains` (welke andere bronnen worden gecite voor dezelfde prompts, een proxy voor concurrenten in AI)
- `brand-radar-ai-responses` (raw responses voor steekproef)

**Werkwijze.**
1. Genereer 8 tot 12 representatieve AI-prompts op basis van klantprofiel plus propositie. Volg `references/aeo-prompts.md`.
2. Toon de prompts aan de gebruiker en vraag goedkeuring of bijstelling.
3. Draai de prompts via `management-brand-radar-prompts` of voeg ze toe aan een bestaand Brand Radar rapport.
4. Trek de overview-data en cited-pages-data.
5. Bepaal per prompt:
   - Wordt het merk gecite? Ja of nee
   - Op welke positie in het antwoord
   - Welke concurrent staat hoger
6. Identificeer 3 typen kansen:
   - Prompts waar concurrent wel verschijnt en wij niet (opportunity)
   - Prompts waar wij verschijnen op een lage positie (uplift)
   - Prompts waar geen helder antwoord is (white space)

**Drempels.**
- Prompt-set minstens 8 prompts (anders te weinig signaal)
- Cited concurrent met DR ≥ 30 (lage-DR-bronnen tellen niet als concurrent)

**Vervolg-skill.** klantprofiel-opstellen, dan tone-of-voice-bepalen, dan seo-copywriting (specifiek de FAQ- en direct-antwoord-blokken die door AI gepakt worden).

---

## Volgorde van uitvoeren

Doe niet alle 12 lenzen vrijwel parallel zonder context. Volgorde matters:

1. Lens 7 en 8 eerst (technisch en schema), want zonder crawlbaar fundament zijn andere fixes nutteloos.
2. Lens 1, 2, 3 en 6 (striking distance, CTR, cannibalisatie, snippets), want quick wins op bestaande pagina's.
3. Lens 4 en 9 (verouderde toppers en interne links), want refresh-werk op bestaande structuur.
4. Lens 5 (content gaps), want nieuwe pagina's bouwen kost tijd.
5. Lens 10 en 11 (autoriteit), want outreach loopt naast de inhoudelijke roadmap.
6. Lens 12 (AEO), want de prompt-set en analyse vragen apart accordering en zijn experimenteler.

In de scoring-stap worden alle bevindingen vervolgens gemengd en op ROI gesorteerd; deze volgorde is alleen voor de datacollectie zelf.

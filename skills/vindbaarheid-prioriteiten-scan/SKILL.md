---
name: vindbaarheid-prioriteiten-scan
description: "Site-brede SEO plus AEO prioriteringsscan. Scoort kansen op ROI, sorteert in vier tiers (deze week, maand, kwartaal, strategisch) plus Skip, wijst per bevinding de juiste Pingwin vervolg-skill aan. Levert rapport plus tracker. Gebruik wanneer iemand vraagt om: 'wat moet ik eerst aanpakken voor SEO', 'prioriteiten voor [domein]', 'waar zit de grootste ROI', 'vindbaarheid scan', 'SEO plus AEO audit', 'AI-zichtbaarheid auditen', 'striking distance', 'cannibalisatie', 'content gaps', 'broken backlinks', 'AI overviews', 'brand radar', 'roadmap voor SEO', 'waar moet ik beginnen op deze site', 'site-brede SEO prioritering', of wanneer een hele klantsite geanalyseerd moet worden om te bepalen waar tijd en budget naartoe gaan. Triggert ook op: 'AEO-scan', 'SOV scan', 'cited pages', 'CTR-onderkans', 'verouderde toppers'. Gebruik ALTIJD als eerste stap bij nieuw klanttraject of kwartaalreview, vóór seo-analyse-landingpage of blauwdruk, omdat die op pagina-niveau werken en deze skill site-breed prioriteert."
---

# Vindbaarheid Prioriteiten Scan

## Wat deze skill doet

Deze skill kijkt over een hele klantsite heen, scoort alle SEO plus AEO kansen op ROI, en zegt expliciet: dit eerst, dat tweede, dat derde, en dit niet doen. Het is een strateeg-skill, geen uitvoerder. Per bevinding wijst hij de juiste bestaande Pingwin-skill aan om het werk te doen (seo-analyse-landingpage, seo-copywriting, blauwdruk-seo-landingpage, contentmapping-url-structuur, tone-of-voice-bepalen, klantprofiel-opstellen).

## Verplichte eerste stappen

### Stap 1, laad de Pingwin huisstijl
Lees vóór elke output de centrale huisstijl-skill:
```
skills/pingwin-huisstijl/SKILL.md
```
en gebruik de docx-componenten via:
```
skills/pingwin-huisstijl/assets/pingwin-docx-components.js
```
Zonder deze huisstijl: stop en waarschuw de gebruiker.

### Stap 2, lees het klantprofiel
Als beschikbaar, lees `Penguin/[klantnaam]/klantprofiel.docx` of vergelijkbaar. Dit is de basis voor de relevance-fit-score.

### Stap 3, vraag verplichte propositie-input
Vraag de gebruiker om een propositie-zin van 1 tot 3 regels die de scherpe nuance toevoegt. Bijvoorbeeld: "luxe kozijnenmaker met dunne lijsten, geen prijsvechter" of "specialistische verzekeringskliniek voor sporters, geen algemene fysio". Zonder propositie: stop, want zonder die nuance drift de scan naar high-volume-low-fit zoekwoorden.

### Stap 4, bepaal de input-modus
Zie volgende sectie. Default is C, combinatie.

## Input-modi

Drie modi. Default is C.

**Modus A, auto.** Alleen URL plus klantnaam. De skill genereert zelf relevante zoekwoorden via Ahrefs Site Explorer (organic keywords waarop de site nu rankt), GSC-queries en Keywords Explorer (uitbreiding rond hoofdthema). Gebruik wanneer de klant geen eigen lijst heeft.

**Modus B, manueel.** URL plus zoekwoordenlijst die de gebruiker aanlevert (xlsx, csv of geplakt). Gebruik wanneer er al een gevalideerde keywordlijst ligt en de klant geen blinde-vlek-suggesties wil.

**Modus C, combinatie (default).** De aangeleverde lijst plus aanvulling door de skill met blinde-vlek-suggesties. Markeer in de output expliciet welke items "door scan gevonden" zijn versus aangedragen door de gebruiker.

## Verplichte input

| Input | Modus A | Modus B | Modus C |
|---|---|---|---|
| URL klantsite | ✅ | ✅ | ✅ |
| Klantnaam | ✅ | ✅ | ✅ |
| Propositie-zin (1 tot 3 regels) | ✅ | ✅ | ✅ |
| Zoekwoordenlijst | nee | ✅ | ✅ |
| Land of taal (default NL) | optioneel | optioneel | optioneel |
| Concurrenten (anders auto) | optioneel | optioneel | optioneel |

Stop en vraag als één van de verplichte velden mist.

## De 12 analyse-lenzen

Voor de volledige uitvoeringsdetails per lens, zie `references/12-lenzen.md`. Korte samenvatting:

**Inhoudelijk (zes lenzen)**
1. Striking distance keywords (positie 5 tot 20 met serieuze impressies)
2. CTR-onderkans (hoge impressies, lage CTR ten opzichte van benchmark)
3. Cannibalisatie (twee of meer URLs die om hetzelfde keyword strijden)
4. Verouderde toppers (dalende winners die om refresh vragen)
5. Content gaps (zoekwoord met intentie en volume, geen rankende pagina)
6. Featured-snippet-kansen (positie 2 tot 5, concurrent heeft snippet)

**Technisch (drie lenzen)**
7. Site-audit-issues uit Ahrefs (severity-niveaus)
8. Schema-markup-gaps (FAQ, LocalBusiness, Product, Article)
9. Interne-link-onderbedeling van commerciële pagina's

**Autoriteit (twee lenzen)**
10. Broken backlinks reclamation
11. Lost backlinks recovery

**AEO (één lens)**
12. Brand Radar plus cited-pages-data, met door de skill gegenereerde AI-prompts (eerst goedkeuring vragen aan de gebruiker, dan draaien)

Per lens haalt de skill data via de Ahrefs MCP. Welke endpoints precies, staat in `references/12-lenzen.md`.

## Scoringsformule

Per bevinding vier deelscores plus één ROI-score. Voor de volledige formule, intentie-multipliers en CTR-curves, zie `references/scoringsformule.md`.

**Impact (0 tot 100)** = `log10(maandvolume) × 100 × CTR_uplift × intentie_multiplier × relevance_fit`

waarin:
- `CTR_uplift` = verschil tussen verwachte CTR op huidige positie en op target-positie volgens de Advanced Web Ranking 2024 curve
- `intentie_multiplier` = transactional 1.0, lokaal-commercial 0.9, commercial 0.7, navigational 0.5, informational 0.3
- `relevance_fit` = waarde tussen 0 en 1, automatisch bepaald op basis van klantprofiel plus propositie

**Effort (1 tot 10)** = van title-tweak (1) tot nieuwe contentcluster (10).

**Time to effect (1 tot 5)** = 1 betekent 1 of 2 weken; 2 betekent 2 tot 6 weken; 3 betekent 1 tot 3 maanden; 4 betekent 3 tot 6 maanden; 5 betekent 6 maanden of meer.

**Confidence** = 0.3, 0.6 of 0.9.

**ROI-score** = `(Impact × Confidence) / (Effort × Time_to_effect)`

**Gate-check.** Als `relevance_fit < 0.4`, stuur het item automatisch naar Skip-tier met rationale, ongeacht ROI. Dit voorkomt dat de scan adviseert om hoog-volume-laag-fit zoekwoorden te najagen.

## Tier-toewijzing

Vier tiers plus Skip. Toewijzing is mechanisch op basis van de vier deelscores.

| Tier | Naam | Criteria |
|---|---|---|
| 1 | Deze week | Confidence ≥ 0.6, Effort ≤ 3, Time to effect ≤ 2, ROI-score in top 25% |
| 2 | Deze maand | Confidence ≥ 0.6, Effort ≤ 6, Time to effect ≤ 3 |
| 3 | Dit kwartaal | Effort ≤ 8, Time to effect ≤ 4 |
| 4 | Strategisch | Alles wat groter is dan tier 3 maar relevance_fit ≥ 0.4 |
| Skip | Niet doen | relevance_fit < 0.4 of ROI-score ≤ 0.5 |

De rationale per tier-toewijzing wordt opgeslagen in de tracker en geprint in het rapport.

## Output

Twee bestanden, allebei in Pingwin huisstijl. Gebruik `pingwin-docx-components.js` voor de docx en `references/pingwin-xlsx-styling.md` voor de xlsx.

### vindbaarheid-prioriteiten-rapport.docx

Maximaal 6 tot 10 pagina's. Vaste structuur:

1. **Cover** (createCoverPage met klantnaam, datum, propositie-zin)
2. **Executive summary** (top 5 acties, totale verwachte uplift in bezoeken per maand, eerste-effect-datum, totale effort)
3. **Scorecard** van de 12 lenzen op één pagina (groen pass, geel aandacht, rood kritiek)
4. **Roadmap-tabel** (vier tiers, per tier de drie tot vijf zwaarstwegende items, kort)
5. **Action cards** per tier-1- en tier-2-item (wat, waar, waarom, geschatte uplift, effort, TTE, expliciete vervolg-skill)
6. **Skip-rationale** (welke items afgewezen en waarom)
7. **Methodologie-bijlage** (één pagina, met CTR-model, datum, datasources, propositie-zin)

### vindbaarheid-prioriteiten-tracker.xlsx

Eén werkblad met alle bevindingen inclusief Skip-tier. Kolomstructuur:

`ID | Type | Titel | URL | Zoekwoord | Volume | Huidige positie | Target-positie | Impact | Effort | TTE | Confidence | ROI-score | Tier | Vervolg-skill | Status | Owner | Datum`

Status-veld kent waarden `open`, `in progress`, `done`. Filter en sortering werken op alle kolommen. Kop-rij in donker `#222222` met witte uppercase tekst, alternating rijen `#FFFFFF` en `#F7F7F7`, accent `#F15829` voor highlights (top-3-items).

## Vervolg-skill-koppeling

Per item noemt het rapport expliciet welke bestaande Pingwin-skill ingezet moet worden. Vaste mapping:

| Type bevinding | Vervolg-skill |
|---|---|
| Striking distance, content-only | seo-analyse-landingpage, dan seo-copywriting |
| CTR-onderkans (title plus meta) | seo-copywriting (alleen meta-blok) |
| Cannibalisatie | contentmapping-url-structuur |
| Verouderde topper | seo-analyse-landingpage, dan seo-copywriting |
| Content gap | blauwdruk-seo-landingpage, dan seo-copywriting |
| Featured-snippet-kans | seo-copywriting (alleen FAQ-blok) |
| Site-audit-issues | technisch ticket extern, geen Pingwin-skill |
| Schema-gaps | seo-copywriting (structured data uit blauwdruk) |
| Interne-link-onderbedeling | contentmapping-url-structuur |
| Broken backlinks | extern (outreach), geen Pingwin-skill |
| Lost backlinks | extern (outreach), geen Pingwin-skill |
| AEO-zichtbaarheid laag | klantprofiel-opstellen, dan tone-of-voice-bepalen, dan seo-copywriting (AI-overview blokken) |
| Geen propositie helder | klantprofiel-opstellen, dan tone-of-voice-bepalen |

## Methode in stappen

1. **Validatie.** Check verplichte input. Stop en vraag als iets mist.
2. **Inlezen klantprofiel en propositie.** Combineer tot een korte fit-statement van 1 alinea.
3. **Datacollectie via Ahrefs.** Trek per lens de relevante endpoints, zie `references/12-lenzen.md`.
4. **Modus C alleen.** Vergelijk aangeleverde lijst met auto-suggesties; markeer blinde-vlek-items.
5. **AEO-prompts genereren.** Maak 8 tot 12 representatieve AI-prompts op basis van klantprofiel en propositie. Toon ze aan de gebruiker, vraag goedkeuring of bijstelling, draai dan tegen Brand Radar.
6. **Scoring.** Voor elke bevinding bereken de vier deelscores en de ROI-score. Pas de gate-check toe.
7. **Tier-toewijzing.** Sorteer alle bevindingen in de vier tiers plus Skip volgens de tabel hierboven.
8. **Top-5-keuze.** Selecteer top 5 voor de executive summary, gewogen op ROI-score plus diversiteit (niet allemaal hetzelfde type).
9. **Verwachte uplift berekenen.** Som van Impact × Confidence over tier 1 en tier 2, vertaald naar geschatte extra bezoekers per maand.
10. **Genereer tracker.xlsx** via `scripts/generate_tracker.py`.
11. **Genereer rapport.docx** via `scripts/generate_report.js` met de Pingwin docx-componenten.
12. **Lever op.** Standaard naar `Penguin/[klantnaam]/`. Geen klantnaam: `_Claude-OUTPUT/`.

## Stijlregels

Voor alle output, ook tussentijdse antwoorden in de chat:

- **Geen em-dash (—), geen en-dash (–), geen hyphen-met-spaties ( - )** als zinsscheiding of tussenzin-inleiding. Vervang door komma, dubbele punt, puntkomma, haakjes of een nieuwe zin. Hyphen zonder spaties in samenstellingen (AI-tools, e-mail, B2B-bedrijf) blijft toegestaan, net als hyphens in URLs en bestandsnamen.
- **Doe vóór elke oplevering een scan** op " — ", " – " en " - " in alle gegenereerde teksten en vervang die.
- **Voertaal Nederlands.**
- **Pingwin huisstijl verplicht** in alle output. Montserrat, accent `#F15829` en `#E7773F` op CTAs en koppen, body `#181818`, headings `#222222`, surface licht `#F7F7F7`. Voor de exacte tokens: `Penguin/_huisstijl/pingwin-design-tokens.md`.

## Out of scope voor v1

- Herhaal-modus en delta-tracking ("wat heeft gewerkt sinds vorige scan"). Komt in v2.
- Google Sheets export. Voor nu xlsx-only.
- Automatisch ticketen in ClickUp of Linear. Wel handmatig kopieerbaar uit de tracker.

## Verwijzingen naar andere skills en documenten

- `Penguin/_huisstijl/PINGWIN-HUISSTIJL.md` (huisstijl-instructies)
- `Penguin/_huisstijl/pingwin-design-tokens.md` (design tokens)
- `Penguin/_huisstijl/pingwin-docx-components.js` (verplicht voor docx)
- `Penguin/_huisstijl/SEO-CRITERIA.md` (referentie bij andere SEO-skills)
- `Penguin/[klantnaam]/klantprofiel.docx` (basis voor relevance-fit, indien beschikbaar)
- `references/12-lenzen.md` (uitvoeringsdetails per lens)
- `references/scoringsformule.md` (volledige formule, multipliers, CTR-curves)
- `references/aeo-prompts.md` (hoe AI-prompts genereren voor Brand Radar)
- `references/pingwin-xlsx-styling.md` (xlsx-styling regels)
- `scripts/scoring.py` (scoring-implementatie)
- `scripts/generate_report.js` (docx-generator)
- `scripts/generate_tracker.py` (xlsx-generator)

# SEO-CRITERIA.md — Pingwin Landingpage Playbook

> **Single source of truth** voor alle SEO-skills in het Pingwin ecosysteem.
> Alle 4 skills in de workflow (`seo-analyse-landingpage`, `blauwdruk-seo-landingpage`, `seo-copywriting`, `seo-landingpage-workflow`) verwijzen naar dit document. Wijzig één plek = doorgevoerd in alle skills.
>
> **Laatste update:** 2026-04-24
> **Scope:** Nederlandstalige SEO-landingpages (pillar, cluster, blog, service, product, lokaal)
> **Basis:** Research 2024-2026 van Google Search Central, Moz, Ahrefs, Backlinko, SEJ, SEL, Quality Rater Guidelines

---

## Hoe dit document te gebruiken

1. **In elke skill** staat: *"Raadpleeg eerst `Penguin/_huisstijl/SEO-CRITERIA.md`."* Doe dat letterlijk.
2. **Elke criterium heeft een ID** (bv. `H1-01`). Skills kunnen ernaar verwijzen in rapporten, audits en kwaliteitschecks.
3. **Elke criterium heeft een classificatie:**
   - 🔴 **CRITICAL** — blokkerend. Output mag niet opgeleverd worden als dit faalt. Ranking-gevolgen direct.
   - 🟠 **MAJOR** — hoge impact. Faalt = waarschuwing + motivatie vereist in verantwoordingstabel.
   - 🟡 **MINOR** — best practice. Faalt = vermelding in rapport, geen blokker.
   - ⚪ **OPTIONAL** — nice-to-have / competitive edge.
4. **Elke criterium is pass/fail-meetbaar.** Geen "goed genoeg"-oordelen. Je kunt het tellen, knippen of kijken of iets er staat.
5. **Balans geldt overal.** Waar "minimum X" staat geldt ook "maximum Y". Onder-optimalisatie (Stroomzeker) is even fout als over-optimalisatie (keyword stuffing).

---

## 0. Gate: de verplichte score

Een pagina (of deliverable) is **pas goedgekeurd** als:

- **0 🔴 CRITICAL-failures** (hard blocker — geen uitzonderingen)
- **≤ 2 🟠 MAJOR-failures** met expliciete, onderbouwde motivatie in de verantwoordingstabel
- **Score ≥ 85/100** op de gewogen totaalscore (zie §15)

Faalt één van deze drie? Dan levert de skill **niet op** maar rapporteert wat er gefixt moet worden en stopt. De gebruiker kan expliciet een override geven ("lever toch op, ik accepteer de issues") — dat wordt dan in het rapport vastgelegd.

---

## 1. Structuur & headingshiërarchie

### H1-01 🔴 CRITICAL — Exact één H1
Precies één `<h1>`-tag per pagina. Niet 0, niet 2.
**Check:** `document.querySelectorAll('h1').length === 1`

### H1-02 🔴 CRITICAL — H1 bevat primair zoekwoord
De H1 bevat het primaire zoekwoord óf een herkenbare semantische variant (stam-match). Voor het zoekwoord "thuisbatterij" geldt: "thuisbatterij", "thuisbatterijen", "home battery" als direct pendant niet toegestaan omdat de pagina NL is.
**Check:** `H1.toLowerCase().includes(keyword.root)` OR semantische variant uit variantenlijst (§2.2).
**Rationale:** Stroomzeker's H1 had "thuisbatterij" wel — dit dekt de minimum-basis.

### H1-03 🟠 MAJOR — H1 is niet identiek aan meta title
H1 en `<title>` mogen niet letterlijk dezelfde string zijn. Verschil in formulering (H1 vollediger, title compacter).
**Check:** `H1.trim() !== title.trim()`

### H1-04 🟡 MINOR — H1 lengte 20-70 tekens
Te kort (<20) = geen context; te lang (>70) = verwatert focus.
**Check:** `20 ≤ H1.length ≤ 70`

### H2-01 🔴 CRITICAL — H2 keyword coverage 60-80%, target 70% (de Stroomzeker-regel)
Tussen **60% en 80%** van de H2's bevat het primaire zoekwoord óf een semantische variant uit de variantenlijst. Target = **70%** (sweet spot).
**Check:**
```
hits = count(H2 where H2.contains(keyword.root) OR H2.contains(any_semantic_variant))
coverage = hits / totalH2s
pass = 0.60 ≤ coverage ≤ 0.80
target = 0.70
```
**Pas op:** varianten tellen mee. Voor "thuisbatterij": "batterij", "energieopslag", "opslag thuis", "accu thuis" tellen allemaal als semantische variant.
**Onder 60% = onvoldoende topicsignaal (Stroomzeker-fout — geen topicrelevantie).**
**Boven 80% = keyword stuffing (Google penalty risico).**
**Optimale coverage = 70%:** minimaal 3/5, 4/6, 5/7 of 6/8 H2's bevat keyword of semantische variant.
**Rationale:** onder 60% onvoldoende signaal naar Google, boven 80% oogt onnatuurlijk; 70% is de sweet spot tussen topicsignaal en leesbaarheid.

### H2-02 🟠 MAJOR — Minimaal 4 H2's, maximaal 12
Te weinig H2's = te weinig structuur/diepte; te veel = versnipperd.
Uitzondering: pillar-pagina met 10 subtopics mag tot 15.
**Check:** `4 ≤ totalH2s ≤ 12` (pillar: `≤ 15`)

### H2-03 🟠 MAJOR — H2's zijn uniek qua intent
Geen 2 H2's die hetzelfde subtopic dekken. Geen duplicaten zoals "Kosten" + "Wat kost het".
**Check:** handmatige intent-dedupe.

### H2-04 🟡 MINOR — H2 klinkt als kop, niet als zoekquery
Vermijd formuleringen die aanvoelen als Google-zoekopdrachten.
- ❌ "Thuisbatterij kosten: wat kost het?" (zoekquery-structuur)
- ✅ "Wat kost een thuisbatterij?" (leesbare vraagkop)
- ✅ "Thuisbatterij prijzen en modellen" (beschrijvende kop)

### H3-01 🟡 MINOR — H3 coverage 20-50%
Tussen 20-50% van de H3's bevat keyword of semantische variant. Minder streng dan H2 omdat H3's dieper in hiërarchie zitten.
**Check:** `0.20 ≤ H3_coverage ≤ 0.50` (alleen als H3's aanwezig zijn)

### H3-02 🟠 MAJOR — Geen heading-level sprongen
Geen H3 zonder voorafgaande H2. Geen H4 zonder H3. Hiërarchie moet kloppen.
**Check:** DOM-validatie — elke H(n) heeft een voorafgaande H(n-1) op dezelfde of hogere niveau.

### H-99 🔴 CRITICAL — Zoekterm komt in maximaal 2 heading-levels per variant voor
Eén variant (bv. exacte match "thuisbatterij") mag niet in H1 én in 5 H2's én in 3 H3's. Dat is stuffing.
**Check:** per variant, tel voorkomens over alle heading-levels. `hits ≤ 2 × uniqueHeadings` waarbij uniqueHeadings betekent: niet dezelfde heading-tekst herhaald.

---

## 2. Keyword- & semantische coverage

### KW-01 🔴 CRITICAL — Primair zoekwoord in eerste 100 woorden
Het exacte primaire zoekwoord (of de direct afgeleide vorm) staat in de eerste 100 woorden van de body copy (ná de H1).
**Check:** `firstNWordsOfBody(100).includes(keyword)`

### KW-02 🟠 MAJOR — Primair zoekwoord in laatste alinea / afsluiting
Staat in de laatste alinea of conclusie-sectie. Sluit de loop.
**Check:** `lastParagraph.includes(keyword OR variant)`

### KW-03 🟠 MAJOR — Keyword-density 0.5%-2.0% voor primair zoekwoord
Te laag (<0.5%) = te weinig signaal; te hoog (>2%) = stuffing.
**Formule:** `(keywordOccurrences / totalWords) × 100`
**Check:** `0.5 ≤ density ≤ 2.0`
**Noot:** density is een vangnet, geen stuurmiddel. Als de tekst natuurlijk leest en het onderwerp volledig behandelt, zit density vanzelf goed.

### KW-04 🟠 MAJOR — Semantische variantendekking ≥ 60%
Uit de lijst van 10-15 semantische varianten (opgesteld tijdens blauwdruk, §2.2) verschijnt minimaal 60% minstens één keer in de body copy.
**Voorbeeld voor "thuisbatterij":** thuisbatterijen, batterijopslag, energieopslag, home battery (als Engelse term in context), accu, batterijsysteem, opslag zonnestroom, opslag thuis, buurtbatterij, batterij voor zonnepanelen, domestic battery, salderingsregeling (co-occurring entity), zelfconsumptie (co-occurring), off-grid, hybride omvormer.
**Check:** `variantsCovered / totalVariants ≥ 0.60`

### KW-05 🟠 MAJOR — Long-tail coverage in H2/H3/FAQ
Minimaal 3 long-tail zoekwoorden uit de zoekwoordenlijst verschijnen letterlijk als kop (H2, H3) of FAQ-vraag.
**Voorbeeld:** "hoeveel kost een thuisbatterij" als H2; "is een thuisbatterij rendabel" als FAQ.

### KW-06 🟡 MINOR — Geen geforceerde synoniemen
Varianten moeten termen zijn die échte mensen gebruiken. "Thuisaccumulatoren" is geforceerd; "accu voor thuis" is natuurlijk.
**Check:** handmatig — review door copywriter.

### KW-07 🔴 CRITICAL — Geen keyword stuffing in zichtbare tekst
Geen 3× dezelfde keyword in één alinea. Geen onderaan-pagina keyword lists.
**Check:** max 2 voorkomens van dezelfde exacte keyword per 100 woorden, aaneengesloten.

---

## 3. Meta-elementen

### META-01 🔴 CRITICAL — Meta title aanwezig en uniek
Elke pagina heeft een unieke `<title>`-tag. Niet leeg, niet identiek aan een andere pagina op het domein.

### META-02 🔴 CRITICAL — Meta title lengte 50-60 tekens
Google toont circa 60 tekens (575px) op desktop, ~50 op mobiel.
**Check:** `50 ≤ title.length ≤ 60`
**Pixel-check optioneel:** `measurePixelWidth(title) ≤ 580`

### META-03 🔴 CRITICAL — Primair zoekwoord in meta title, front-loaded
Primair zoekwoord in de eerste 30 tekens. Bij voorkeur als eerste woord.
**Check:** `title.substring(0, 30).toLowerCase().includes(keyword.root)`

### META-04 🟠 MAJOR — CTR-trigger in meta title
Minimaal één CTR-trigger: jaartal, cijfer, kwalificatie (gratis, snel, direct, 2026), actiewoord, USP.
**Check:** handmatig of regex `/\b(2024|2025|2026|gratis|direct|snel|binnen|vanaf|€|%|nr\.?\s*1|beste)\b/i`

### META-05 🟡 MINOR — Merknaam achter pipe
Formaat: `[Zoekwoord + context] — [USP/trigger] | [Merk]` of zonder merk voor lokale SEO.
**Check:** regex `/\s*[\|\-–—]\s*[\w\s&]+$/` aan het eind.

### META-06 🔴 CRITICAL — Meta description aanwezig
Elke pagina heeft `<meta name="description">`. Niet leeg.

### META-07 🔴 CRITICAL — Meta description lengte 140-160 tekens
**Check:** `140 ≤ description.length ≤ 160`

### META-08 🟠 MAJOR — Primair zoekwoord in meta description, 1× (max 2×)
1× is optimaal (wordt bold in SERP). 2× is acceptabel. 3× = stuffing.
**Check:** keyword occurrences in description = 1 or 2.

### META-09 🟠 MAJOR — Actieve CTA in meta description
Minimaal één CTA-werkwoord: bekijk, ontdek, vraag aan, bereken, lees meer, vergelijk, start.
**Check:** regex `/\b(bekijk|ontdek|vraag|bereken|lees|vergelijk|start|kies|plan|ontvang|krijg)\b/i`

### META-10 🟡 MINOR — Meta description herhaalt meta title niet letterlijk
Eerste 30 tekens van description mogen geen kopie zijn van title.

### URL-01 🟠 MAJOR — URL-slug bevat primair zoekwoord
**Check:** `url.path.includes(keywordSlug)` waarbij keywordSlug = kebab-case van primair zoekwoord.

### URL-02 🟡 MINOR — URL-slug max 5 woorden, kebab-case
Geen underscores, geen camelCase, geen parameters voor core content.
**Check:** `slug.split('-').length ≤ 5 && /^[a-z0-9-]+$/.test(slug)`

### URL-03 🔴 CRITICAL — Canonical tag aanwezig en self-referential
`<link rel="canonical" href="[eigen URL]">` op elke indexeerbare pagina.
**Check:** canonical is present AND canonical.href === page.url (normalized — https, trailing slash consistent).

### URL-04 🟡 MINOR — Consistente trailing slash-policy
Kies één: mét of zonder trailing slash. Andere versie 301 redirect.

### META-OG-01 🟡 MINOR — Open Graph basis-tags aanwezig
`og:title`, `og:description`, `og:image`, `og:url`, `og:type`.

### META-OG-02 🟡 MINOR — Twitter Card tags aanwezig
`twitter:card` (bv. "summary_large_image"), `twitter:title`, `twitter:description`, `twitter:image`.

---

## 4. Content & copy

### CON-01 🟠 MAJOR — Content-lengte per pagina-type

| Pagina-type | Minimum | Ideaal | Maximum |
|---|---|---|---|
| Pillar page | 2.000 | 2.500–4.000 | 8.000 |
| Cluster page (competitief) | 1.500 | 1.800–2.500 | 4.000 |
| Service landingpage | 1.200 | 1.500–2.500 | 3.500 |
| Lokaal service-pagina | 800 | 1.000–1.500 | 2.500 |
| Blog (competitief keyword) | 1.500 | 1.800–2.500 | 4.000 |
| Blog (long-tail) | 800 | 1.000–1.500 | 2.500 |
| Vergelijkingspagina | 1.800 | 2.000–3.500 | 5.000 |
| How-to gids | 1.200 | 1.500–2.500 | 3.500 |
| Productpagina | 500 | 800–1.500 | 2.500 |
| FAQ-pagina (standalone) | 400 | 600–1.200 | 2.500 |

**Rationale:** Backlinko (2023): positie #1 mediaan = 1.760 woorden voor competitieve keywords. Lengte moet matchen met intent — een 300-woorden-pagina op positie #1 voor een snelle definitie slaat 2.000-woorden-concurrenten.

### CON-02 🟠 MAJOR — Eerste alinea opent met direct antwoord (AEO-ready)
De eerste alinea beantwoordt de kernvraag van de zoeker in maximaal 2 zinnen — voorafgaand aan context of inleiding. Dit is AI Overview- én featured snippet-optimalisatie.
**Voorbeeld voor "thuisbatterij kosten":**
- ❌ "Thuisbatterijen zijn de afgelopen jaren steeds populairder geworden. In deze gids bespreken we…"
- ✅ "Een thuisbatterij kost in Nederland doorgaans tussen €4.500 en €12.000 inclusief installatie. De prijs hangt af van capaciteit, merk en of er zonnepanelen zijn."

### CON-03 🟠 MAJOR — Alinea's maximaal 4 zinnen
**Check:** geen alinea met meer dan 4 zinnen in de body. Acceptabel bij technische specificaties. Gemiddelde alinea-lengte ≤ 3 zinnen.

### CON-04 🟡 MINOR — Flesch-Douma leesbaarheidsscore 50-70
Nederlandse tegenhanger van Flesch-Kincaid. Streefbereik voor B2C/consumentencopy: 50-70 (redelijk makkelijk leesbaar). Voor technisch B2B: 40-60 mag.

### CON-05 🟡 MINOR — Actieve zinnen ≥ 80%
Zinnen in actieve vorm domineren. Passief ("er wordt geïnstalleerd") max 20%.

### CON-06 🟠 MAJOR — Concrete taal: minimaal 3 cijfers/specifieke getallen
Op een landingpage staan minimaal 3 specifieke feiten (bedragen, percentages, jaartallen, aantallen). Vage taal ("veel", "snel", "voordelig") is zwak.

### CON-07 🟠 MAJOR — Minimaal 5 interne links, minimaal 15 voor competitieve pagina's

| Pagina-type | Minimum interne links | Ideaal |
|---|---|---|
| Pillar page | 10 | 15–25 |
| Cluster/service | 5 | 8–15 |
| Blog | 3 | 5–12 |

**Check:** tel alleen contextuele interne links in de body — dus niet footer, header of nav.

### CON-08 🟠 MAJOR — Ankertekst-diversiteit
Verdeling van interne link-ankers op de pagina:
- Exacte match (primair keyword): **5-15%**
- Gedeeltelijke match / variant: **20-30%**
- Branded anker: **10-20%**
- Beschrijvend/generiek: **40-60%** (meer dan "klik hier"!)

Meer dan 20% exact-match is stuffing-risico. Minder dan 5% = te weinig signaal.

### CON-09 🟡 MINOR — Geen "klik hier"-ankers
Geen links met ankertekst "klik hier", "hier", "lees verder" zonder context.

### CON-10 🟠 MAJOR — Externe links naar autoriteit (optioneel maar helpt E-E-A-T)
Minimaal 1 externe link naar autoritatieve bron (overheid, wetenschap, norm, industriestandaard). `rel="noopener"` altijd; `rel="nofollow"` alleen als commercieel.

### CON-11 🔴 CRITICAL — Geen gekopieerde copy / duplicate content
Geen alinea's 1-op-1 gekopieerd van concurrent of eigen andere pagina. Substring-overlap > 60 tekens met een externe bron = fail.

### CON-12 🟡 MINOR — Conclusie/afsluitsectie bevat summary + CTA
De pagina sluit af met een korte samenvatting (1 alinea) én een concrete CTA.

---

## 5. Zoekintentie-matching

### INT-01 🔴 CRITICAL — Pagina-type matcht dominant SERP-type
Bepaald via SERP-analyse top-10. Als 7 van 10 posities blogposts/gidsen zijn, is de intentie informatief — een productpagina zal niet ranken.
**Check:** `pageType === dominantSERPType(top10)`

### INT-02 🟠 MAJOR — Content-format matcht intent
- Informatief → gids/blog met stappen, lijsten, definities
- Commercieel onderzoek → vergelijking, rankings, pros-cons-tabel
- Transactioneel → prijzen, CTA's, specs, reviews, formulier
- Lokaal → adres, openingstijden, reviews, map, bel-knop

### INT-03 🟡 MINOR — SERP-features geïdentificeerd en benut
Uit SERP-analyse: welke features (Featured Snippet, PAA, Video, Local Pack, Knowledge Panel, Image Pack, Shopping) zijn zichtbaar? Pagina moet minimaal 1 feature actief targeten.

---

## 6. FAQ-sectie

### FAQ-01 🟠 MAJOR — FAQ aanwezig op pagina
Elke landingpage (uitgezonderd homepage) heeft een FAQ-sectie. FAQ vangt long-tail en People Also Ask-queries én bouwt vertrouwen.

### FAQ-02 🟠 MAJOR — 4-8 vragen in FAQ-sectie
Te weinig = marginaal; te veel = FAQ-pagina (ander doel).
**Check:** `4 ≤ faqQuestionCount ≤ 8`

### FAQ-03 🟠 MAJOR — Elke FAQ-vraag bevat zoekwoord of long-tail
Minimaal 80% van de vragen bevat het primaire keyword, een variant, of een long-tail uit de zoekwoordenlijst.

### FAQ-04 🟠 MAJOR — FAQ-antwoord start met direct antwoord in 1 zin
Eerste zin = direct, volledig antwoord. Tweede-vierde zin = toelichting/context.

### FAQ-05 🟠 MAJOR — FAQ-antwoord lengte 40-80 woorden
40 = featured snippet-minimum; 80 = bovengrens voor snippet-eligibility én leesbaarheid.
**Check:** `40 ≤ wordCount(answer) ≤ 80`

### FAQ-06 🟡 MINOR — Vragen zijn opgebouwd uit People Also Ask / zoeksuggesties
Niet verzonnen — gebaseerd op echte PAA's uit SERP-analyse en Ahrefs search suggestions.

### FAQ-07 🟡 MINOR — Maximaal 3-4 FAQ-antwoorden bevatten merknaam
FAQ is primair informatief. Meer dan 4× merknaam = advertisement.

---

## 7. Afbeeldingen & visuele media

### IMG-01 🔴 CRITICAL — Elke img-tag heeft alt-attribuut
Geen `<img>` zonder `alt=""` (leeg = decoratief acceptabel) of `alt="beschrijving"`.
**Check:** DOM-scan — geen img zonder alt.

### IMG-02 🟠 MAJOR — Alt-tekst 8-125 tekens, beschrijvend
**Check:** `8 ≤ alt.length ≤ 125` — óf leeg voor decoratief.
Vermijd stuffing: `alt="thuisbatterij thuisbatterij batterij opslag"` = fail.

### IMG-03 🟡 MINOR — Primair zoekwoord in alt-tekst van 20-50% van afbeeldingen
Natuurlijk, niet geforceerd. Eerst: alt beschrijft wat er te zien is. Zoekwoord komt waar het logisch past.

### IMG-04 🟠 MAJOR — Bestandsnaam is beschrijvend, kebab-case
`thuisbatterij-installatie-proces.webp` ✓
`IMG_2847.jpeg` ✗
**Check:** bestandsnaam bevat minimaal 2 woorden gescheiden door `-`, max 60 tekens.

### IMG-05 🟠 MAJOR — Format is WebP of AVIF (met JPEG-fallback)
`.jpg`/`.png` zonder WebP-variant = MAJOR fail. Google bevoordeelt moderne formats voor Core Web Vitals.

### IMG-06 🟠 MAJOR — Expliciete dimensies (width/height) voor elke img
Voorkomt Cumulative Layout Shift. Zowel in HTML (`width="800" height="600"`) als via CSS aspect-ratio.

### IMG-07 🟠 MAJOR — Lazy loading voor images below-the-fold
`loading="lazy"` op elke img die niet in viewport laadt bij eerste render.
**Uitzondering:** hero/above-fold image krijgt `loading="eager"` en bij voorkeur `fetchpriority="high"`.

### IMG-08 🟡 MINOR — Responsive srcset/sizes voor hero en content-afbeeldingen
`srcset` met minimaal 2 breakpoints (mobiel + desktop).

### IMG-09 🟡 MINOR — Afbeelding bij elke hoofdsectie (H2)
Geen wall-of-text. Elke H2 van >300 woorden heeft minimaal 1 beeldelement (foto, icon, diagram, tabel).

### IMG-10 ⚪ OPTIONAL — ImageObject schema voor hero
JSON-LD ImageObject voor de hero-image (helpt image search + LLM-context).

---

## 8. Structured data (Schema.org)

### SD-01 🔴 CRITICAL — JSON-LD format (geen microdata/RDFa)
Alle structured data in `<script type="application/ld+json">`-blokken.

### SD-02 🟠 MAJOR — Schema per pagina-type minimaal ingevuld

| Pagina-type | Verplicht schema | Aanbevolen aanvulling |
|---|---|---|
| Pillar page | `Article` of `BlogPosting` | `BreadcrumbList`, `Organization` |
| Cluster/blog | `Article` / `BlogPosting` | `BreadcrumbList`, `Person` (author) |
| Service landingpage | `Service` + `LocalBusiness` | `Offer`, `AggregateRating`, `Review` |
| Lokaal | `LocalBusiness` (sub-type zo specifiek mogelijk) | `OpeningHoursSpecification`, `GeoCoordinates`, `Review` |
| Product | `Product` + `Offer` | `AggregateRating`, `Review`, `Brand` |
| Homepage | `Organization` + `WebSite` | `SearchAction`, `sameAs` |
| How-to | `HowTo` | `BreadcrumbList`, `VideoObject` |

### SD-03 🟠 MAJOR — BreadcrumbList-schema op alle subpagina's
Behalve homepage. Komt bovenop ankerbreadcrumb in HTML. Verhoogt kans op breadcrumb-weergave in SERP.

### SD-04 🟠 MAJOR — Organization-schema in footer/sitewide
Met `name`, `url`, `logo`, `sameAs` (social profiles). Één keer sitewide (via layout) is voldoende.

### SD-05 🟡 MINOR — Author-schema bij E-E-A-T-gevoelige content
Voor YMYL (health, finance, legal, safety) en redactionele content: `author` als `Person` met `name`, `jobTitle`, `sameAs` (LinkedIn), `image`.

### SD-06 🟠 MAJOR — Geen FAQPage-schema op niet-geautoriseerde sites
Sinds augustus 2023 toont Google FAQPage-rich-results alleen voor gezondheid/overheid-autoriteiten. Op andere sites: FAQPage-schema mag maar geeft geen rich result. Het kost ook geen ranking. Advies: **wel opnemen voor semantische context (helpt LLMs), maar verwacht geen rich result**.

### SD-07 🟠 MAJOR — Product-schema verplicht op e-commerce productpagina's
Met `name`, `description`, `image`, `brand`, `offers` (price, priceCurrency, availability), en `aggregateRating` als reviews bestaan.

### SD-08 🟠 MAJOR — Review/AggregateRating alleen bij echte reviews
Schema markup voor verzonnen of gemanipuleerde reviews = Google penalty. Alleen gebruiken als reviews echt geaggregeerd zijn.

### SD-09 🔴 CRITICAL — Schema validatie pass
Elke structured-data block moet pass opleveren in Google's [Rich Results Test](https://search.google.com/test/rich-results) én [Schema.org validator](https://validator.schema.org/).

### SD-10 🟡 MINOR — sameAs verwijst naar social profiles
`sameAs: ["https://linkedin.com/company/...", "https://facebook.com/..."]` in Organization-schema.

---

## 9. Technische SEO

### TECH-01 🔴 CRITICAL — HTTPS enabled
Geldig SSL/TLS-certificaat. Alle resources via HTTPS (geen mixed content).

### TECH-02 🔴 CRITICAL — Mobile-responsive
Geen separate mobielsite. Eén codebase die responsief is.
**Check:** viewport meta-tag + Google Mobile-Friendly Test pass.

### TECH-03 🔴 CRITICAL — Viewport meta-tag
`<meta name="viewport" content="width=device-width, initial-scale=1">`

### TECH-04 🟠 MAJOR — Tap targets ≥ 48×48 CSS-pixels
Buttons, links, form-elementen. Geen twee tappable elementen binnen 8px van elkaar.

### TECH-05 🟠 MAJOR — Lettergrootte body ≥ 16px op mobiel
Kleinere tekst triggert "tekst te klein" in Lighthouse.

### TECH-06 🟠 MAJOR — Geen intrusieve interstitials
Pop-ups die content blokkeren bij pageload triggeren intrusive-interstitial-penalty (mobiel).

### TECH-07 🟠 MAJOR — XML-sitemap bevat de pagina
Pagina moet in `sitemap.xml` staan én indexeerbaar zijn.

### TECH-08 🔴 CRITICAL — Geen noindex / nofollow op de pagina
Tenzij bewust gekozen. `<meta name="robots" content="index, follow">` expliciet OF default.

### TECH-09 🟡 MINOR — robots.txt blokkeert pagina niet
`Disallow`-rule mag niet de pagina-URL raken.

### TECH-10 🟡 MINOR — hreflang bij meertalige content
Alleen relevant bij NL + andere taalversies. `<link rel="alternate" hreflang="nl-NL" href="...">`.

---

## 10. Core Web Vitals & performance

### CWV-01 🔴 CRITICAL — LCP (Largest Contentful Paint) ≤ 2.5s
Meet via PageSpeed Insights / Lighthouse (field data preferred, lab als fallback).
**Target:** 75% van page views ≤ 2.5s.

### CWV-02 🔴 CRITICAL — INP (Interaction to Next Paint) ≤ 200ms
Vervanger van FID sinds maart 2024.

### CWV-03 🔴 CRITICAL — CLS (Cumulative Layout Shift) ≤ 0.1

### CWV-04 🟠 MAJOR — TTFB (Time To First Byte) ≤ 600ms
Goede TTFB = basis voor goede LCP. Server-/hostingkwestie.

### CWV-05 🟠 MAJOR — Hero-image heeft fetchpriority="high"
Op above-fold-images voor snellere LCP.

### CWV-06 🟠 MAJOR — Web fonts met font-display: swap
Voorkomt FOIT/CLS. `@font-face { font-display: swap; }`.

### CWV-07 🟡 MINOR — Third-party scripts defer/async
Analytics, chat, pixels: `defer` of `async`. Nooit in de kritieke rendering path van above-fold.

### CWV-08 🟡 MINOR — Image-optimalisatie (compressie + juiste afmeting)
Geen 4000×3000px hero waar 1920×1080 voldoet. Alle images geoptimaliseerd (~70-85% JPEG quality).

---

## 11. E-E-A-T signals (Experience, Expertise, Authoritativeness, Trust)

### EEAT-01 🟠 MAJOR — Auteur zichtbaar bij redactionele content
Naam + functie/expertise + publicatiedatum. Voor YMYL = CRITICAL.

### EEAT-02 🟠 MAJOR — Publicatie- én wijzigingsdatum zichtbaar
`Gepubliceerd: 15 januari 2026 · Laatst bijgewerkt: 10 april 2026`.
Bij niet-evergreen content: als wijziging >1 jaar oud = content refresh overwegen.

### EEAT-03 🟡 MINOR — Citaties / bronverwijzingen bij claims
Concrete claims (cijfers, studies, regels) met link naar bron.

### EEAT-04 🟠 MAJOR — Trust-badges / certificeringen / lidmaatschappen
Bij commerciële/service-pagina: minimaal 2 zichtbaar (bv. keurmerk, branchevereniging, certificering).

### EEAT-05 🟠 MAJOR — Reviews / testimonials aanwezig
Bij commerciële pagina: minimaal 3 klantreviews met naam (evt. bedrijf/rol), datum, en rating.

### EEAT-06 🟡 MINOR — Originele afbeeldingen / eigen foto's
Eigen werk > stockfoto. Eigen screenshots > uitgeknipte concurrentafbeeldingen.

### EEAT-07 🟡 MINOR — Eigen data / case studies / voorbeelden
Minimaal één stukje originele informatie die niet van concurrent komt (eigen cijfers, case, proces, product-specifieke details).

### EEAT-08 🟠 MAJOR — Contactgegevens direct toegankelijk
NAW-gegevens, telefoonnummer, e-mail. Footer of contact-sectie.

### EEAT-09 🟡 MINOR — About-pagina link in hoofdnavigatie
Minder belangrijk maar E-E-A-T-signaal.

---

## 12. AI Overview / AEO (Answer Engine Optimization)

### AEO-01 🟠 MAJOR — Pagina heeft direct-antwoord-formattering
Eerste alinea = 40-60 woorden directe beantwoording. Dit is het meest geciteerde segment in AI Overview, ChatGPT, Perplexity, Claude search.

### AEO-02 🟠 MAJOR — Minimaal 1 gestructureerde lijst (`<ol>` of `<ul>`)
Lijsten worden geëxtraheerd voor AI Overviews. Minimaal één numbered list bij stap-sequenties.

### AEO-03 🟠 MAJOR — Minimaal 1 tabel voor vergelijking/data
Tabellen zijn bij uitstek AI-citable. Prijsvergelijkingen, specs, pros/cons.

### AEO-04 🟡 MINOR — Expliciete definities bij jargon
Eerste gebruik van vakterm = korte definitie in dezelfde zin of direct erna. Helpt LLM-begrip én lezer.

### AEO-05 🟡 MINOR — Statistieken met bronattributie
"Volgens TNO (2024) is…" is AI-citation-vriendelijker dan "Uit onderzoek blijkt…".

### AEO-06 🟡 MINOR — "Chunkbare" content-structuur
Korte alinea's (3-5 zinnen), duidelijke subheaders, gelabelde secties. LLMs retrieven in chunks.

### AEO-07 ⚪ OPTIONAL — llms.txt file
`/.well-known/llms.txt` met crawl-richtlijnen voor LLMs. Emerging standard, nog geen brede impact.

---

## 13. Conversie & trust on-page

### CVR-01 🟠 MAJOR — Primaire CTA herhaald op 3-4 plekken
Above-fold + na werkwijze + na reviews + in footer/afsluiting.

### CVR-02 🟠 MAJOR — Consistente CTA-formulering
Alle primaire CTA's gebruiken dezelfde werkwoord-actie (bv. "Vraag offerte aan" overal, niet mix met "Aanvragen" / "Contact" / "Start").

### CVR-03 🟠 MAJOR — USP-blok met 3-5 kernvoordelen
Direct aanwezig in above-fold of sectie 1. Scanbare bullets met icon + max 6 woorden per voordeel.

### CVR-04 🟠 MAJOR — Werkwijze/stappenplan bij service-pagina
3-5 stappen van intake tot oplevering/resultaat. Drempelverlagend.

### CVR-05 🟡 MINOR — Social proof boven-fold
Reviews score + aantal reviews ("4,8/5 uit 347 beoordelingen") in hero of net eronder.

### CVR-06 🟡 MINOR — Formulier max 5 velden (lead gen)
Elke extra veld = ~10% conversie-verlies. Alleen de essentiële velden.

### CVR-07 🟡 MINOR — Terugbelservice / chat-widget
Drempel-alternatief voor bezoekers die niet willen mailen/formulieren.

---

## 14. SERP features targeting

### SERP-01 🟠 MAJOR — Featured snippet-formattering
Op pagina's die scorekans hebben: target minimaal 1 featured snippet.
- **Paragraph snippet:** 40-60 woorden directe paragraaf die een vraag beantwoordt (vaak onder H2 met vraagformaat)
- **List snippet:** `<ol>` of `<ul>` met 5-8 items
- **Table snippet:** `<table>` met header-rij en 3+ data-rijen

### SERP-02 🟠 MAJOR — People Also Ask optimalisatie
Elke FAQ-vraag targetet een PAA uit de SERP-analyse. Vraag letterlijk (of dichtbij) overnemen.

### SERP-03 🟡 MINOR — Video-sectie bij high-intent keywords
Als video-resultaten voorkomen in SERP-top-10: overweeg YouTube-embed + VideoObject-schema.

### SERP-04 🟡 MINOR — Image Pack-eligibility
Originele afbeeldingen met juiste alt/filename/ImageObject-schema maken kans op Image Pack.

---

## 15. Scoring & gewichten

Elke criterium telt mee in een totaalscore van 100. Gewichten:

| Categorie | Gewicht | Aantal criteria (indicatief) |
|---|---|---|
| §1 Structuur & headings | 15 | 11 |
| §2 Keyword/semantic | 15 | 7 |
| §3 Meta-elementen | 10 | 14 |
| §4 Content | 10 | 12 |
| §5 Intent-match | 5 | 3 |
| §6 FAQ | 5 | 7 |
| §7 Afbeeldingen | 8 | 10 |
| §8 Structured data | 8 | 10 |
| §9 Technische SEO | 7 | 10 |
| §10 Core Web Vitals | 7 | 8 |
| §11 E-E-A-T | 4 | 9 |
| §12 AEO | 3 | 7 |
| §13 Conversie/trust | 2 | 7 |
| §14 SERP features | 1 | 4 |

**Berekening per criterium:**
- 🔴 CRITICAL gehaald: +volle punten; gefaald: automatisch GATE FAIL (score irrelevant)
- 🟠 MAJOR gehaald: +volle punten; gefaald: -volledige punten uit die categorie-bijdrage
- 🟡 MINOR gehaald: +volle punten; gefaald: -halve punten
- ⚪ OPTIONAL gehaald: +bonus (buiten 100); gefaald: 0 (geen straf)

Per categorie worden de puntenwaarden evenredig verdeeld over de criteria in die categorie, waarbij CRITICAL 3×, MAJOR 2×, MINOR 1× weegt.

**Eindgate:**
- 0 CRITICAL-failures
- ≤ 2 MAJOR-failures met motivatie
- Score ≥ 85/100

---

## 16. Stroomzeker-diagnose (referentiecase)

**URL:** `https://stroomzeker-website-7zt9.vercel.app/thuisbatterij`
**Primair zoekwoord:** thuisbatterij

**Gefaalde criteria (vermoedelijk, op basis van gebruikersobservatie):**
- 🔴 **H2-01** (keyword coverage 60-80%, target 70%): eerste 4-5 H2's bevatten geen variant van "thuisbatterij" → coverage <20% → **GATE FAIL**
- Vermoedelijk ook: FAQ-check (02, 03), SD-02 (schema per type), CON-02 (direct-antwoord), mogelijk IMG-05 (WebP), EEAT-05 (reviews).

**Deze diagnose valideert:** als H2-01 als 🔴 CRITICAL in de skills ingebouwd was, was de pagina niet opgeleverd zonder fix. Dat is precies het mechanisme dat we met dit document afdwingen.

---

## 17. Variantenlijst opstellen — werkwijze

Voor elke pagina moet een expliciete "variantenlijst" bestaan (§2.2-referentie).

**Minimaal 10, bij voorkeur 15 items:**
1. Exacte keyword + natuurlijke buigingen (meervoud, diminutief)
2. Synoniemen die échte mensen gebruiken (geen geforceerde vertalingen)
3. Gerelateerde entiteiten (producten, merken, regelingen, technologieën)
4. Commerciële modifiers (kopen, aanschaffen, installeren, plaatsen)
5. Informatieve modifiers (werking, voordelen, nadelen, vergelijking)
6. Prijs-termen (kosten, prijs, tarief, investering, terugverdientijd)

**Bronnen:** Ahrefs Keywords Explorer (related terms + search suggestions), Google Search (PAA + "People also search for"), eigen domein-expertise.

**Opslaan in:** de blauwdruk-output, sectie "Zoekwoordenkaart". De copywriting-skill gebruikt deze lijst voor KW-04 (60%-dekking) en H2-01 (H2-variant-matching).

---

## 18. Rapport-template voor SEO-skills

Elk SEO-skill-rapport (.docx in Pingwin huisstijl) sluit af met een **Scorecard-sectie** die alle criterium-IDs uit dit document langsloopt:

| Criterium | ID | Classificatie | Status | Waarde | Opmerking |
|---|---|---|---|---|---|
| H1 uniek en aanwezig | H1-01 | CRITICAL | ✓ | 1 H1 | — |
| H1 bevat zoekwoord | H1-02 | CRITICAL | ✓ | "Thuisbatterij: …" | — |
| H2 coverage 60-80% (target 70%) | H2-01 | CRITICAL | ✗ | 20% (2/10) | **Blokker — moet gefixt** |
| … | … | … | … | … | … |

Aan het einde: **totaalscore + gate-uitslag**.
```
Score: 62/100
Gate: ❌ FAIL — 3 CRITICAL failures (H2-01, META-03, SD-09)
```

---

**Changelog**
- v1.0 (2026-04-24): Initial release. Fixt Stroomzeker-probleem via H2-01 (40-70% coverage als CRITICAL).
- v1.1 (2026-04-24): H2-01 verscherpt naar 60-80% met target 70%. Behoud-principe conditioneel gemaakt: per-element-toets, geen ondergrens op behoud-percentage.

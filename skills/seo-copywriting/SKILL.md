---
name: seo-copywriting
description: "Optimaliseert bestaande landingpage-copy of schrijft nieuwe SEO-webcopy. Werkt tegen harde, meetbare criteria uit SEO-CRITERIA.md: H2 keyword coverage 60-80% (target 70%), primair zoekwoord in eerste 100 woorden, density 0.5-2%, semantische variantendekking ≥60%, direct-antwoord-opening, FAQ-antwoorden 40-80 woorden — met pre-delivery validatie-loop die levert pas op als de scorecard pass is. Behoud van bestaande copy blijft leidend om SEO-continuïteit te beschermen. Gebruik deze skill wanneer iemand vraagt om: webcopy schrijven, landingpage copy, SEO-tekst optimaliseren, 'schrijf copy voor [pagina]', 'maak webcopy op basis van de blauwdruk', 'tekst uitschrijven voor [zoekterm]', 'content schrijven voor [URL]', 'landingpage tekst maken', of wanneer een blauwdruk beschikbaar is en de volgende stap het uitschrijven of optimaliseren van de tekst is Gebruik proactief zodra een blauwdruk is afgerond en de copy geschreven of geoptimaliseerd moet worden."
---


## ⚠️ Verplichte eerste stap — laad het criteria-document

Lees **`references/SEO-CRITERIA.md`** (bij deze skill meegeleverd) volledig vóór je begint.

Deze is een kopie van de master op **`Penguin/_huisstijl/SEO-CRITERIA.md`** — de single source of truth voor alle SEO-skills in het Pingwin ecosysteem. Als er een nieuwere versie in `Penguin/_huisstijl/` staat, gebruik die; anders is de bundled versie leidend.

**Zonder criteria-document: stop en waarschuw de gebruiker.**

---

## Pingwin Huisstijl

```
/mnt/skills/user/pingwin-huisstijl/SKILL.md
```

Importeer:

```js
const path = require("path");
const fs   = require("fs");
const P    = require(path.join("/mnt/skills/user/pingwin-huisstijl/assets/pingwin-docx-components.js"));
const logoBuffer = fs.readFileSync("/mnt/skills/user/pingwin-huisstijl/assets/Zzz_Pingwin_Logo.jpg");
```

---

# SEO Copywriting (v2 — criteria-gestuurd + behoud + pre-delivery validatie)

Je bent een senior SEO-copywriter. In de meeste gevallen **optimaliseer** je bestaande copy; soms schrijf je een volledig nieuwe pagina. Je combineert 4 bronnen tot publicatieklare copy:

1. **Bestaande copy** (bij optimalisatie — leidend voor behoud)
2. **Blauwdruk** (headings, variantenlijst, interne link-plan, meta-varianten, image-briefs)
3. **SEO-analyse / scorecard** (welke criteria moeten gefixt — input voor beslissingen)
4. **Tone-of-voice document** (klant-specifieke stijl)

Je levert niet op tot de copy **pass** op de scorecard-gate uit SEO-CRITERIA.md.

---

## ⚠️ Kernprincipe 1: behoud is conditioneel — criteria bepalen, niet gewoonte (SEO-continuïteit)

Behoud van bestaande copy is **waardevol maar niet heilig**. SEO-continuïteit werkt alleen zolang de bestaande copy ook daadwerkelijk aan alle SEO-criteria voldoet. Een zwakke alinea behouden "omdat het er al staat" beschermt geen rankings — het bevestigt mediocre content. De v2-filosofie: **criteria bepalen wat blijft, wat geldt aangepast, wat vervangen wordt — niet gewoonte of anciënniteit.**

**Per-element-toets (verplicht):**

Elk bestaand SEO-relevant element wordt afzonderlijk getoetst tegen:
- Alle **CRITICAL + MAJOR criteria** uit `SEO-CRITERIA.md` die op dat element van toepassing zijn
- De **blauwdruk** (headings-structuur, variantendekking, meta-templates, FAQ-items, image-briefs)
- De **SERP top-10 analyse** waar deze via de blauwdruk doorwerkt (dekking, intent-match)

**SEO-relevante elementen** = H1, elke H2-kop, elke H3-kop, elke alinea onder een kop, elk FAQ-item (vraag én antwoord), meta title, meta description, CTA-teksten, image alt-texts.

**Scoring per element:**

| Score | Voorwaarde | Actie |
|-------|------------|-------|
| 🟢 **Behouden** | Voldoet aan álle CRITICAL + álle relevante MAJOR criteria | Kopieer ongewijzigd |
| 🟡 **Aanpassen (minimaal)** | Faalt op max. 1 MAJOR OF 1-2 MINOR criteria | Fix exact dat — raak de rest niet aan |
| 🔴 **Vervangen** | Faalt op ≥1 CRITICAL, OF op ≥2 MAJOR, OF ontbreekt uit blauwdruk-eis | Herschrijven volgens blauwdruk + scorecard |

**Geen default "behouden".** De toets bepaalt, niet het uitgangspunt. Een pagina die 80% van zijn elementen faalt, krijgt 80% herschrijving — dat is niet erg; dat is de pagina op criteria brengen.

**Geen ondergrens aan behoud-percentage.** We sturen niet op "≥X% behouden" — de uitkomst is wat hij is. Een sterk element blijft, een zwak element vervangt.

**Headings volgen dezelfde logica.** Bestaande H2 mag alleen blijven als hij zelf voldoet aan H2-01 (keyword of semantische variant) én aan H2-03/H2-04 (uniek, niet-zoekqueryachtig). Anders: herschrijven.

**Verplichte inputcheck:** geen bestaande copy én geen analyse-rapport aangeleverd? Vraag er eerst om — tenzij bevestigd: nieuwe pagina (geen bestaande copy om te toetsen).

**Afsluitende rapportage (verplicht):** SEO-verantwoordingstabel toont per element de pass/fail-status én de actie (🟢/🟡/🔴). De behoud-telling is beschrijvend (X% behouden, Y% aangepast, Z% vervangen), geen normatieve ondergrens.

---

## ⚠️ Kernprincipe 2: natuurlijkheid boven alles (onzichtbare optimalisatie)

Goede SEO-copy is **onzichtbaar geoptimaliseerd** — de lezer merkt niks.

- Schrijf eerst voor de lezer, optimaliseer daarna.
- **Variatie is je wapen.** Google begrijpt synoniemen, gerelateerde termen, semantische context. Wissel af tussen exacte keyword, varianten en omschrijvingen.
- **Merknaam is geen zoekwoord.** Noem klant/merk op commerciële plekken (CTA's, vergelijking, afsluiting), niet in elke alinea.
- **Voorlees-test:** leest het hardop natuurlijk? Zo niet, herschrijf.
- **FAQ-antwoorden zijn objectief.** Max 3-4 van de 4-8 FAQ's bevatten merknaam.

---

## ⚠️ Kernprincipe 3: criteria zijn geen suggestie

De scorecard in SEO-CRITERIA.md bevat **meetbare** regels. Natuurlijkheid is belangrijk, maar niet als ze botst met een CRITICAL-criterium. Concreet:

- Als H2-coverage onder 60% zit, **herschrijf H2's tot ≥60% (target 70%)** — natuurlijk en leesbaar, met varianten waar mogelijk.
- Als density onder 0.5% zit, voeg keyword toe in context waar het hoort (niet "plakken").
- Als eerste 100 woorden geen keyword bevatten, herschrijf de opening.
- Als een bestaand element faalt, vervangen — ongeacht hoe lang het er al staat (zie Kernprincipe 1).

"Natuurlijk schrijven" = hoe je het doet. "Criteria halen" = wat je MOET halen. Beide, niet of/of.

---

## Input verzamelen

Vraag (via AskUserQuestion) om:

### Verplicht
- **Bestaande copy van de pagina** (URL of platte tekst) — tenzij nieuwe pagina, dan expliciet bevestigen
- **Blauwdruk** (uit blauwdruk-skill — met variantenlijst, heading-structuur, meta-varianten, interne link-plan, image-briefs)
- **Primair zoekwoord** en **zoekwoordenlijst** (primaire, secundaire, long-tail)
- **Tone of voice** document

### Optioneel maar sterk aanbevolen
- **SEO-analyse / scorecard** van de huidige pagina (uit analyse-skill) — vergroot precisie van behoud-scoring én laat zien welke criteria gefixt moeten
- USP's, prijzen, locaties, productinformatie
- Doelgroepbeschrijving (als niet in tone of voice)
- Specifieke CTA-teksten
- Interne links met gewenste ankertekst (als blauwdruk dit niet al dekt)

---

## Stap 1 — Analyse & voorbereiding

### 1a. Variantenlijst overnemen (verplicht voor KW-04)
Uit de blauwdruk: de 10-15 semantische varianten. Deze lijst ligt náást je terwijl je schrijft. Doel: minimaal 60% van deze items minstens één keer in de body copy.

### 1b. Bestaande copy in kaart (alleen bij optimalisatie)
1. Plak volledige bestaande copy in werkdocument, sectie per sectie.
2. Loop blauwdruk langs en koppel elke huidige sectie aan een blauwdruk-sectie:
   - **Match:** sectie staat in blauwdruk → behouden/aanpassen
   - **Mismatch:** sectie staat niet in blauwdruk → bekijken of hij verdwijnt/verplaatst
   - **Gat:** blauwdruk-sectie ontbreekt in huidige pagina → nieuw schrijven
3. Scoor 🟢/🟡/🔴 per sectie met reden.
4. Tel woorden in huidige copy — baseline voor eind-telling.

### 1c. Zoekwoordenkaart per sectie
```
H1: [primair zoekwoord]
H2-1: [secundair A, long-tail X]
H2-2: [secundair B, long-tail Y]
...
```

**Verdeling:**
- Primair → H1, eerste alinea, laatste alinea, title
- Secundair → verspreid over H2's (niet allemaal in één)
- Long-tails → H2/H3-koppen + FAQ-vragen
- Semantische termen → door hele tekst heen, geconcentreerd bij relevante sectie

### 1d. Tone of voice internaliseren
- Aanspreekvorm (je/u, wij)
- Kernwaarden, merkpersoonlijkheid
- Do's en don'ts in woordkeuze
- CTA-formulering
- Specifieke termen wel/niet

Tone of voice > SEO bij conflict — kies natuurlijke taal boven geforceerd keyword.

---

## Stap 2 — Meta title en meta description schrijven

**Schrijf deze EERST.** Ze zijn de belofte aan de zoeker én worden meegenomen in de scorecard.

**Behoud ook hier:** als huidige meta's al goed scoren, minimaal aanpassen.

### Meta title (verplicht criteria-conform)
- **META-02:** 50-60 tekens (ideaal 52-58)
- **META-03:** primair zoekwoord in eerste 30 tekens (bij voorkeur eerste woord)
- **META-04:** CTR-trigger (cijfer, jaartal, kwalificatie, actie)
- **META-05:** merknaam achter pipe (als gewenst)
- **Niet identiek aan H1** (H1-03)

Format:
```
[Primair zoekwoord + context] — [USP/trigger] | [Merk]
```

Bij voorkeur: gebruik meta-title-varianten die in de blauwdruk zijn voorgesteld. Als je afwijkt, motiveer.

### Meta description (verplicht criteria-conform)
- **META-07:** 140-160 tekens
- **META-08:** primair zoekwoord 1× (max 2×)
- **META-09:** actieve CTA aan het einde
- **META-10:** vult titel aan, herhaalt niet

Format:
```
[Kernbelofte met primair zoekwoord]. [Specifiek voordeel/cijfer]. [CTA].
```

---

## Stap 3 — Body copy: sectie voor sectie schrijven of optimaliseren

### Schrijfopdracht bepalen op basis van pagina-type

**Pillar page (breed overzicht + doorverwijzing):**
- Subtopic-secties: 150–250 woorden + interne CTA naar diepere pagina
- Volledig uitwerken alleen: hero, werkwijze, conversie, FAQ
- Formule: [korte intro wat/waarom] + [1-2 concrete punten/feiten] + [interne CTA: "Lees alles over [subtopic] →"]

**Cluster page (diepgaand subtopic):**
- Onderwerp volledig uitwerken
- Geen doorverwijzingen naar diepere lagen
- Terugverwijzing naar pillar (ankertekst in intro of expliciet)

**Blog (specifieke vraag / informatief):**
- Eén vraag of thema volledig
- Linkt terug naar pillar/cluster voor context
- Mag iets informeler dan landingpage

### Werkwijze per sectie (bij optimalisatie)

Volg heading-structuur uit blauwdruk **exact**. Per sectie:

1. **Bestaat er copy voor deze sectie in huidige pagina?**
   - Ja → stap 2
   - Nee → schrijf nieuw op basis van blauwdruk-instructies
2. **Gemarkeerd 🟢 behouden?** → kopieer ongewijzigd + H-tag prefix + behoud-status
3. **Gemarkeerd 🟡 aanpassen?** → kopieer + pas alleen het noodzakelijke aan
4. **Gemarkeerd 🔴 vervangen?** → herschrijf, hergebruik concrete feiten/cijfers/USP's uit oude tekst

Schrijf elke sectie volledig uit als publicatieklare webcopy.

### Zoekwoordverwerking — het principe

**Mindset:** je "plaatst" geen zoekwoorden. Je schrijft een compleet informatief stuk over een onderwerp — en dat onderwerp bevát de zoektermen van nature.

**Primair zoekwoord (KW-01 t/m KW-03):**
- **Eerste 100 woorden (KW-01, CRITICAL):** liefst eerste/tweede zin, alleen als natuurlijk
- **Laatste alinea (KW-02):** als onderdeel van afsluitende boodschap
- Door de tekst: laat organisch komen, exacte term OF variant OF omschrijving
- **Density (KW-03, 0.5-2.0%):** check achteraf — vangnet, geen stuurmiddel

**Secundaire & long-tails (KW-05):**
- Secundaire = natuurlijke varianten van primair, afwisselen
- Long-tails passen als H2/H3-koppen of FAQ-vragen (waar ze letterlijk de vragen zijn die mensen stellen)
- Niet elke long-tail in lopende tekst; als heading/FAQ staat, genoeg

**Semantisch veld (KW-04, ≥60%-coverage):**
- **Dit maakt het verschil.** Belangrijker dan frequentie.
- Dek de varianten, entiteiten, co-occurring terms uit de variantenlijst
- Noem entiteiten bij naam: producten, normen, organisaties, regelingen, locaties
- Alleen varianten die écht mensen gebruiken

**Merknaam / commercieel (FAQ-07, CVR-01):**
- Commerciële plekken: vergelijkingssectie, CTA-momenten, afsluiting, 3-4 FAQ-antwoorden
- Informatieve secties zijn neutraal
- Max 3-4 FAQ-antwoorden bevatten merknaam

---

### Headings optimaliseren — HARD RULES

**H1 (H1-01 + H1-02):**
- Exacte match van keyword óf semantische variant uit lijst
- Zoekintentie direct adresseren
- Niet identiek aan meta title (H1-03)
- Klinkt als paginatitel, niet als zoekquery
- Bestaande H1 die werkt → behouden, alleen aanpassen als keyword totaal mist

**H2's — HIER ZIT DE STROOMZEKER-FIX:**

```
CRITICAL: H2-01 — 60-80% van H2's bevat keyword of variant (target 70%)
```

**Dit is een harde regel, geen suggestie.** Voorheen leidde "max 40-50% heeft keyword, schrijf voor lezer" ertoe dat je bij 0% eindigde. Nu:

- **Onder 40%** = keyword-leesbaarheid ontbreekt → **herschrijf H2's tot ≥40%**
- **Boven 70%** = stuffing → herschrijf naar natuurlijkere koppen

Hoe **natuurlijk** 60-80% (target 70%) bereiken:
- Vermijd "SOA-test kosten: wat kost het?" (zoekquery-syntax) — gebruik "Wat kost een soa-test?" (vraagkop)
- Varianten tellen mee: bij "thuisbatterij": "batterij", "energieopslag", "opslag thuis", "accu thuis"
- Niet elke H2 hoeft de exacte term — variant volstaat

**Voorbeelden (keyword = "thuisbatterij"):**

```
❌ STROOMZEKER-PATROON (coverage 0%):
H2: Intro
H2: Hoe het werkt
H2: Voordelen
H2: Veelgestelde vragen
H2: Contact

✅ CORRECT (coverage 60%):
H2: Wat is een thuisbatterij?            [keyword]
H2: Hoe werkt een thuisbatterij?         [keyword]
H2: Voordelen van energieopslag thuis    [variant]
H2: Veelgestelde vragen
H2: Plan een gesprek
(3 van 5 = 60%)
```

**H3's (H3-01, 20-50%):**
- Long-tail varianten, deelvragen
- Meeste H3's zijn beschrijvende subkoppen
- Minimum lager dan H2, maximum ook lager

**H2-04 en H-99:** geen query-syntax, geen variant meer dan 2× in headings.

### H-tags ALTIJD benoemen in output

**Verplicht, elke heading:**
- `[H1] Thuisbatterij: Zelfvoorzienend met opslag thuis`
- `[H2] Wat is een thuisbatterij?`
- `[H3] Wanneer is een thuisbatterij rendabel?`

Zonder H-tag prefix ontstaan fouten in heading-hiërarchie (zowel SEO als toegankelijkheid). De prefix hoort in de opgeleverde .docx — niet alleen in comments.

### Behoud-status per sectie in output

Direct na H-tag prefix:
- `[H2] Wat kost een thuisbatterij? [🟢 BEHOUDEN]`
- `[H2] Hoe verloopt de installatie? [🟡 AANGEPAST: zoekwoord "stap-voor-stap" toegevoegd in alinea 2]`
- `[H2] Thuisbatterij en zonnepanelen [🔴 VERVANGEN: huidige sectie miste de samenhang]`
- `[H2] Veelgestelde vragen over thuisbatterijen [🆕 NIEUW: ontbrak op huidige pagina]`

### Direct-antwoord-opening (CON-02, AEO-01)

**Verplicht: eerste alinea beantwoordt de kernvraag in max 2 zinnen.**

Voorbeeld keyword "thuisbatterij kosten":
- ❌ "Thuisbatterijen zijn de afgelopen jaren populair geworden. In deze gids bespreken we…"
- ✅ "Een thuisbatterij kost in Nederland doorgaans tussen €4.500 en €12.000, inclusief installatie. De exacte prijs hangt af van capaciteit, merk en of er zonnepanelen zijn."

Deze opening wordt geciteerd in AI Overviews, ChatGPT, Perplexity — en geeft de lezer direct wat ze zoeken.

### Schrijfregels

1. Schrijf voor de zoeker, optimaliseer voor de crawler
2. Actieve zinnen ("Wij installeren" niet "Er wordt geïnstalleerd")
3. Korte alinea's — **max 4 zinnen (CON-03)**
4. Concrete taal — cijfers, voorbeelden (CON-06)
5. Interne links met beschrijvende ankertekst (CON-08/09) — géén "klik hier"
6. Eerste alinea = direct antwoord (CON-02, AEO-01)
7. Conclusie = kernboodschap + CTA (CON-12)
8. Tone of voice consequent (één merk-stem)

### Conversie-elementen (verplicht per blauwdruk)

- CTA's herhaald 3-4× (CVR-01), consistent geformuleerd (CVR-02)
- USP-blok 3-5 kernvoordelen (CVR-03)
- Werkwijze/stappenplan bij service (CVR-04)
- Social proof (CVR-05) op logische plekken
- FAQ met 4-8 vragen (FAQ-01/02)

### AEO-elementen (verplicht)

- **Minimaal 1 numbered list** (AEO-02) — bv. werkwijze, stappenplan
- **Minimaal 1 tabel** voor vergelijking/data (AEO-03) — prijs-breakdown, specs, pros/cons
- **Definities bij jargon** (AEO-04) — eerste gebruik met korte uitleg
- **Stats met bron** (AEO-05) — "Volgens TNO (2024)…" beter dan "Uit onderzoek blijkt…"

---

## Stap 4 — FAQ-sectie

- **FAQ-02:** 4-8 vragen
- **FAQ-03:** elke vraag bevat zoekwoord of long-tail (≥80%)
- **FAQ-04:** eerste zin = direct antwoord, daarna toelichting
- **FAQ-05:** antwoord 40-80 woorden (featured snippet + leesbaar)
- **FAQ-06:** vragen uit People Also Ask, Ahrefs search suggestions, blauwdruk
- **FAQ-07:** max 3-4 antwoorden noemen merk

Bij optimalisatie: bestaande FAQ als basis; behoud goede vragen, voeg ontbrekende toe, herschrijf alleen waar nodig.

Vermeld bij oplevering: FAQPage-schema optioneel (SD-06: geen rich result op de meeste domains, wel semantische context voor LLMs).

---

## Stap 5 — Pre-delivery validatie-loop (nieuw, verplicht)

**Vóór je iets aflevert, run je deze checklist en meet je elke regel letterlijk.** Faalt een CRITICAL of MAJOR? Iteratie: pas copy aan en meet opnieuw.

### Automatische metingen

```
SCORECARD COPY (vóór oplevering)
──────────────────────────────────
H1-01: exact 1 H1                         ✓/✗
H1-02: H1 bevat keyword of variant        ✓/✗  — H1: "..."
H1-03: H1 ≠ meta title                    ✓/✗

H2-01: H2 coverage 60-80% target 70%      ✓/✗  — XX% (N/M)  ← STROOMZEKER-CHECK
H2-02: 4-12 H2's (pillar: ≤15)            ✓/✗  — N H2's
H2-04: geen zoekquery-syntax              ✓/✗

KW-01: primair keyword in eerste 100 w    ✓/✗  — positie w#X
KW-02: primair keyword in laatste alinea  ✓/✗
KW-03: density 0.5-2.0%                   ✓/✗  — X.XX%
KW-04: semantische variantendekking ≥60%  ✓/✗  — XX% (N/M varianten)
KW-05: ≥3 long-tails als kop/FAQ          ✓/✗  — N long-tails
KW-07: geen stuffing (max 2×/100w)        ✓/✗

META-02: title 50-60 tekens               ✓/✗  — XX tekens: "..."
META-03: keyword in eerste 30 tekens      ✓/✗
META-04: CTR-trigger aanwezig             ✓/✗
META-07: description 140-160 tekens       ✓/✗  — XX tekens
META-08: keyword 1-2× in description      ✓/✗
META-09: CTA in description               ✓/✗

CON-02: direct-antwoord-opening           ✓/✗  — eerste 50 woorden: "..."
CON-03: alinea's ≤4 zinnen                ✓/✗  — langste: N zinnen
CON-06: ≥3 cijfers/specifieke feiten      ✓/✗  — N feiten
CON-07: interne links (≥5/≥10)            ✓/✗  — N links
CON-08: ankertekst-verdeling binnen ratio ✓/✗

FAQ-01: FAQ aanwezig                      ✓/✗
FAQ-02: 4-8 vragen                        ✓/✗  — N vragen
FAQ-03: ≥80% vragen met keyword/variant   ✓/✗  — N/M
FAQ-04: antwoord start met direct antw.   ✓/✗
FAQ-05: antwoorden 40-80 woorden          ✓/✗  — avg XX w, range [X-Y]

AEO-02: ≥1 numbered list                  ✓/✗
AEO-03: ≥1 tabel                          ✓/✗

CVR-01: CTA 3-4× herhaald                 ✓/✗  — N CTA's
CVR-02: CTA consistent geformuleerd       ✓/✗

Behoud (bij optimalisatie):
- % behouden ongewijzigd                  XX%
- % minimaal aangepast                    XX%
- % vervangen                             XX%
- Totaal behouden/minimaal                (beschrijvend — geen norm; pass-elementen tellen)

Gate-uitslag:
  0 CRITICAL failures?   ✓/✗
  ≤2 MAJOR failures?     ✓/✗
  Score ≥85/100?         ✓/✗

RESULTAAT: ✓ PASS — klaar voor oplevering
           ❌ FAIL — fix eerst: [lijst gefaalde IDs]
```

### Metingen hoe

**H2 coverage:**
```
Tel H2's. Tel H2's die exact keyword OF variant uit variantenlijst bevatten (case-insensitive, woordstam-match). Bereken %.
```

**Density:**
```
(aantalKeywordVoorkomens / totaalWoorden) × 100
```

**Variantendekking:**
```
Voor elke item in variantenlijst: komt het minstens 1× in de body copy voor? Bereken %.
```

**Alinea-lengte:**
```
Tel zinnen per alinea (eindigend op .?!). Max-per-alinea moet ≤4.
```

**FAQ-antwoord-lengte:**
```
Woordenaantal per antwoord. Alle binnen 40-80?
```

### Iteratie-flow

```
if (pass) → oplevering
else {
  identify failed criteria
  herschrijf relevante secties
  run scorecard opnieuw
  max 3 iteraties — als na 3× nog niet pass: rapporteer aan gebruiker met specifieke blokkers
}
```

**Faalt ondanks iteratie?** Lever dan niet op — rapporteer concreet wat blokkeert en waarom fix niet lukt. Vraag gebruiker om expliciete override of accepteer dat pagina niet klaar is.

---

## Stap 6 — Outputformaat: Pingwin .docx

### KRITIEKE REGEL — Elke heading exact één keer, met expliciete H-tag prefix

**Verplicht voor elke heading in de copy-output:**

1. **Elke heading wordt exact één keer weergegeven** — niet ook nog in een section divider erboven. Geen "H2-2 — Welke reisvorm..." als sectiebalk én daaronder nog "Welke reisvorm..." als heading. Dat is dubbele weergave en moet vermeden worden.

2. **Elke heading heeft een expliciete H-tag prefix in oranje (`#F6712C`):**
   - `[H1]  Rondreis Zuid-Afrika op maat: persoonlijk advies sinds 2001`
   - `[H2]  Welke reisvorm past bij uw rondreis Zuid-Afrika?`
   - `[H3]  Individuele rondreis op maat`

3. **De prefix is visueel klein (size 18, ≈9pt) en oranje**; de heading-tekst zelf is in de normale heading-grootte (H1=44, H2=32, H3=26 half-pt) en donkergrijs (`#2F2A2A`).

4. **Section dividers (oranje balken) gebruik je ALLEEN voor structuur ÓM de copy heen** — bijvoorbeeld "Toelichting voor de redacteur", "Meta-elementen", "Publicatieklare copy". Nooit voor een H1/H2/H3 zelf.

5. **Bij optimalisatie**: behoud-status komt achter de heading, niet ervoor:
   - `[H2]  Wat kost een thuisbatterij?  [🟢 BEHOUDEN]`
   - `[H3]  Stap 1: aanvraag indienen  [🟡 AANGEPAST: keyword toegevoegd]`

**Code-implementatie:**

```js
function makeHeading(level, text, behoudStatus = "") {
  const config = {
    1: { size: 44, before: 240, after: 200, label: "[H1]" },
    2: { size: 32, before: 480, after: 160, label: "[H2]" },
    3: { size: 26, before: 320, after: 120, label: "[H3]" },
  }[level];
  return new Paragraph({
    spacing: { before: config.before, after: config.after },
    children: [
      new TextRun({ text: config.label + "  ", font: "Noto Sans", size: 18, bold: true, color: "F6712C" }),
      new TextRun({ text: text, font: "Noto Sans", size: config.size, bold: true, color: "2F2A2A" }),
      ...(behoudStatus ? [new TextRun({ text: "  " + behoudStatus, font: "Noto Sans", size: 18, color: "84796B" })] : []),
    ],
  });
}
```

Gebruik: `children.push(makeHeading(2, "Welke reisvorm past bij uw rondreis?"))`

### Fontgroottes Pingwin huisstijl (Noto Sans)

Zie PINGWIN-HUISSTIJL.md voor exacte waarden. Samengevat:

| Element | Font | Size (half-pt) | Equivalent | Gewicht | Kleur |
|---|---|---|---|---|---|
| H1 | Noto Sans | 44 | 22pt | Bold | `#2F2A2A` (DARK) |
| H2 | Noto Sans | 32 | 16pt | Bold | `#2F2A2A` (DARK) |
| H3 | Noto Sans | 26 | 13pt | Bold | `#2F2A2A` (DARK) |
| H-tag prefix | Noto Sans | 18 | 9pt | Bold | `#F6712C` (ORANGE) |
| Body | Noto Sans | 22 | 11pt | Regular | `#2F2A2A` (BODY) |
| CTA-label | Noto Sans | 22 | 11pt | Bold | `#2F2A2A` |

### Documentopbouw

**Cover:**
- Eyebrow: `WEBCOPY · [MAAND JAAR]`
- H1: `Webcopy: [zoekterm/paginanaam]`
- Ondertitel: korte beschrijving doel + klant
- Meta-tabel: Opgesteld door / Klant / Zoekterm / Zoekvolume / URL / Type (optimalisatie / nieuw)

**Sectie 0 — Scorecard / Gate-verdict** (direct na cover, prominent)
highlightBlock met pass/fail per criterium + eindgate.

**SEO-metadata blok** (vóór de copy):
- Slug, meta title (met tekencount), meta description (met tekencount)

**Behoud-overzicht** (alleen bij optimalisatie):
highlightBlock met sectie-voor-sectie samenvatting wat behouden, aangepast, vervangen, nieuw is.

**Body copy:**
- `makeHeading(1, ...)` voor de H1 — exact één keer per pagina
- `makeHeading(2, ...)` voor elke H2
- `makeHeading(3, ...)` voor elke H3
- `bodyText()` voor alinea's
- `bulletItem()` voor opsommingen
- `highlightBlock()` voor kerncitaten en CTA-callouts (NIET voor headings)
- `dataTable()` voor vergelijkingen
- `stepBlock()` voor genummerde werkwijze-stappen
- CTA's worden gemarkeerd met `[CTA primair]` of `[CTA secundair]` als prefix in body — niet als heading

**FAQ-sectie:**
- `makeHeading(2, ...)` voor de FAQ-hoofdkop
- `makeHeading(3, ...)` per FAQ-vraag (de vraag IS de H3)
- `bodyText()` voor het antwoord

**SEO-verantwoording (laatste sectie):** uitgebreide `dataTable()`:

| Element | Check | Waarde |
|---|---|---|
| Type project | Optimalisatie / Nieuw | ... |
| Woorden originele copy | | XXXX |
| Woorden nieuwe copy | | XXXX |
| % ongewijzigd behouden (beschrijvend) | | XX% |
| % minimaal aangepast | | XX% |
| % vervangen | | XX% |
| Nieuwe secties toegevoegd | | N |
| Behoud ≥60% | ✓/✗ | motivatie indien <60% |
| H1-01 (exact 1 H1) | ✓/✗ | |
| H1-02 (H1 bevat keyword) | ✓/✗ | |
| H2-01 (coverage 60-80%, target 70%) | ✓/✗ | XX% (N/M) |
| KW-01 (keyword in eerste 100w) | ✓/✗ | |
| KW-02 (keyword in laatste alinea) | ✓/✗ | |
| KW-03 (density 0.5-2.0%) | ✓/✗ | X.XX% |
| KW-04 (variantendekking ≥60%) | ✓/✗ | XX% |
| KW-05 (≥3 long-tails als kop/FAQ) | ✓/✗ | N |
| META-02 (title 50-60 tekens) | ✓/✗ | XX tekens |
| META-03 (keyword eerste 30 tekens) | ✓/✗ | |
| META-07 (description 140-160) | ✓/✗ | XX tekens |
| META-09 (CTA in description) | ✓/✗ | |
| CON-02 (direct-antwoord-opening) | ✓/✗ | |
| CON-03 (alinea's ≤4 zinnen) | ✓/✗ | max N |
| CON-07 (interne links ≥5/≥10) | ✓/✗ | N links |
| FAQ-02 (4-8 vragen) | ✓/✗ | N |
| FAQ-05 (antwoorden 40-80 woorden) | ✓/✗ | avg XX |
| AEO-02 (≥1 numbered list) | ✓/✗ | |
| AEO-03 (≥1 tabel) | ✓/✗ | |
| CVR-01 (CTA 3-4×) | ✓/✗ | N |
| Tone of voice consistent | ✓/✗ | |
| Woordentotaal | | XXXX |

**Eindverdict:** Gate ✓ PASS / ❌ FAIL.

**Header:** `Pingwin · Webcopy – [zoekterm]`
**Footer:** Standaard Pingwin-footer met paginanummers

### Technisch

```bash
NODE_PATH=/usr/local/lib/node_modules_global/lib/node_modules node webcopy-script.js
python3 /path/to/skills/docx/scripts/office/validate.py [bestand].docx
```

Bestandsnaam: `webcopy-[zoekterm-slug].docx`

Opslaan in `_Claude-OUTPUT/` of `Penguin/[klantnaam]/`. Vraag eerst.

---

## Anti-patronen — wat je NIET doet

| Anti-patroon | Voorbeeld | Wat wel |
|---|---|---|
| **Bestaande copy negeren** | URL aangeleverd, maar begin met blanco doc | Plak huidige copy eerst integraal, scoor sectie voor sectie |
| **"Het kan beter" als vervang-reden** | Werkende sectie herschrijven | Alleen vervangen op basis van concrete scorecard-failure of blauwdruk-eis |
| **Goede headings vervangen "voor consistentie"** | Bestaande H2 die werkt overschrijven | Laten staan, alleen herschrijven bij intent/keyword-mismatch — rekening houdend met H2-01 coverage |
| **Criteria behandelen als "streefgetal"** | "Ik mik op ~50% coverage" maar eindigt op 20% | **Meten en itereren tot pass** |
| **Behoud-telling weglaten** | Verantwoordingstabel zonder behoud-% | Verplicht |
| **Merknaam in elke alinea** | 15 van 20 alinea's noemen klant | Alleen CTA's, vergelijking, afsluiting, 3-4 FAQ's |
| **FAQ = reclame** | Elk antwoord begint met klantnaam | Max 3-4 van 8 FAQ's |
| **H2 = zoekquery** | "Thuisbatterij kosten: wat kost het?" | "Wat kost een thuisbatterij?" |
| **Geen keyword in H2's (Stroomzeker)** | 0 van 5 H2's bevat keyword/variant | **Minimaal 40% — iteratief herschrijven** |
| **Te veel keyword in H2's** | 6 van 7 H2's bevat exacte keyword | Max 70%, varianten meewegen |
| **Exacte term steeds herhalen** | "SOA-test" 35× in 2.800 woorden | Wissel af met varianten, natuurlijke omschrijvingen |
| **Metatitel = H1 = eerste zin** | Drie keer dezelfde formulering | Elke positie andere insteek |
| **Informatieve sectie = verkooppraatje** | "Hoe werkt X?" → 50% over klant | Eerst objectief uitleggen, daarna kort merk |
| **Dichtheidsdoel als stuurmiddel** | "Ik moet nog 5× keyword plaatsen" | Schrijf volledig, check density achteraf (0.5-2.0%) |
| **Tone-of-voice negeren voor SEO** | Formeel/klinisch omdat "professioneler voor Google" | Tone of voice gaat vóór keyword-plaatsing |
| **Direct-antwoord-opening skippen** | "In deze gids bespreken we…" als eerste zin | Direct concreet antwoord in 1-2 zinnen |
| **Geen numbered list/tabel** | Alleen prosatekst | Minimaal 1 list + 1 tabel voor AEO |

**Vuistregel:** tekst hardop voorlezen. Klinkt het als herhaling, advertentie of geforceerde SEO? → herschrijf. Klinkt het als goed informatief artikel dat toevallig ook aan criteria voldoet? → pass.

---

## Kwaliteitscheck (vóór oplevering, volledig)

### Criteria-pass (uit scorecard Sectie 0)
- [ ] 0 CRITICAL failures (ANDERS: blokker — niet opleveren)
- [ ] ≤ 2 MAJOR failures (ANDERS: expliciet motiveren of alsnog fixen)
- [ ] Score ≥ 85/100

### Behoud (bij optimalisatie)
- [ ] Copy sectie voor sectie gescoord 🟢/🟡/🔴
- [ ] Behoud-status bij elke heading
- [ ] Elk element gescoord (🟢/🟡/🔴) met motivering uit scorecard of blauwdruk
- [ ] Geen sectie herschreven zonder scorecard/blauwdruk-reden
- [ ] Behoud-overzicht (highlightBlock) in Sectie 2
- [ ] Behoud-percentages in SEO-verantwoordingstabel

### Meta
- [ ] Title 50-60 tekens, keyword in eerste 30
- [ ] Description 140-160 tekens, met CTA
- [ ] Meta ≠ H1

### Headings
- [ ] Exact 1 H1 met keyword
- [ ] H2 coverage 60-80% (target 70%) (gemeten, vermeld)
- [ ] 4-12 H2's (pillar: ≤15)
- [ ] Geen heading klinkt als zoekquery
- [ ] H-tag prefix bij elke heading
- [ ] Behoud-status bij elke heading (bij optimalisatie)

### Body
- [ ] Keyword in eerste 100 woorden
- [ ] Keyword in laatste alinea
- [ ] Density 0.5-2.0%
- [ ] Variantendekking ≥60%
- [ ] ≥3 long-tails als kop/FAQ
- [ ] Alinea's ≤4 zinnen
- [ ] Actieve zinnen, concrete taal, ≥3 cijfers
- [ ] Interne links met beschrijvende ankertekst (ratio-conform)
- [ ] Direct-antwoord-opening in eerste alinea

### Natuurlijkheid
- [ ] Merknaam in ≤30-40% van alinea's
- [ ] Informatieve secties objectief
- [ ] Max 3-4 FAQ-antwoorden met merknaam
- [ ] Variatie in keyword-voorkomens (synoniemen, omschrijvingen)
- [ ] Voorlees-test klinkt natuurlijk

### Tone of voice
- [ ] Aanspreekvorm consistent
- [ ] Woordkeuze volgens merkrichtlijnen
- [ ] CTA's in tone of voice
- [ ] Eén consistente merk-stem

### FAQ
- [ ] 4-8 vragen uit PAA/Ahrefs/blauwdruk
- [ ] Elke vraag met keyword/long-tail (≥80%)
- [ ] Antwoorden 40-80 woorden, direct antwoord eerst
- [ ] Geen herhaling van hoofdcopy

### AEO
- [ ] ≥1 numbered list
- [ ] ≥1 tabel
- [ ] Definities bij jargon
- [ ] Stats met bron

### Totaal
- [ ] SEO-verantwoordingstabel met echte cijfers
- [ ] Hardop-lezen natuurlijk en overtuigend
- [ ] Alle blauwdruk-secties uitgeschreven (geen placeholders)
- [ ] Sectie 0 Scorecard staat bovenaan

---

## Stijl en toon

- Tone of voice van klant is leidend
- Professioneel maar menselijk — geen robotcopy, geen clichés
- Elke zin heeft doel: informeren, overtuigen of converteren
- Geen herhaling tussen secties
- Medisch/juridisch: feitelijk, bronvermelding

---

**Changelog t.o.v. v1:**
- Verwijst verplicht naar `Penguin/_huisstijl/SEO-CRITERIA.md`
- **H2-01 als CRITICAL self-check ingebouwd** (60-80% coverage, target 70%) — **fixt Stroomzeker**
- Kernprincipe 3 toegevoegd: criteria zijn geen suggestie (expliciet boven behoud-default bij CRITICAL)
- KW-03 density 0.5-2.0% concreet
- KW-04 variantendekking ≥60% concreet
- FAQ-05 antwoord-lengte 40-80 (was 40-60)
- Direct-antwoord-opening expliciet (CON-02, AEO-01)
- AEO-elementen verplicht (AEO-02 list, AEO-03 tabel)
- Pre-delivery validatie-loop (Stap 5) — gate op CRITICAL/MAJOR voor oplevering
- Uitgebreide SEO-verantwoordingstabel met alle criteria-ID's
- Scorecard Sectie 0 bovenaan rapport

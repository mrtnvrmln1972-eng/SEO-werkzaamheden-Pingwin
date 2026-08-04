# AEO-prompts genereren voor Brand Radar (lens 12)

Hoe je 8 tot 12 representatieve AI-prompts opstelt voor een specifieke klant, hoe je goedkeuring vraagt, en hoe je ze tegen Ahrefs Brand Radar draait.

---

## Doel

Brand Radar meet hoe vaak en hoe goed een merk in AI-antwoorden verschijnt. Maar dat hangt volledig af van welke prompts je tegen het systeem gebruikt. De skill genereert daarom zelf een prompt-set die representatief is voor hoe een echte koper of geïnteresseerde persoon in deze niche met AI praat.

---

## Inputs voor de prompt-generatie

1. **Klantprofiel** uit `Penguin/[klant]/klantprofiel.docx` (kerndiensten, doelgroepen, regio)
2. **Propositie-zin** zoals door de gebruiker aangeleverd
3. **Top-3-zoekwoorden** uit lens 1 of 5 (bewijs voor wat de markt vraagt)
4. **Top-3-concurrenten** uit `site-explorer-organic-competitors`

---

## Prompt-categorieën

Genereer minimaal één prompt per categorie. Doel is een mix die zowel directe vraag-stijl als verkennend gedrag dekt.

### A. Directe vergelijkingsprompts (2 stuks)
Vraag aan de AI: welke aanbieder is beste / meest geschikt / vertrouwd voor X.

Voorbeeld voor een lokale fysio:
> "Welke fysiotherapeuten in Utrecht zijn gespecialiseerd in hardloopblessures?"

### B. Aanbevelingsprompts (2 stuks)
"Wat zou jij aanraden voor [specifieke situatie]?"

Voorbeeld voor een kozijnenmaker:
> "Ik heb een jaren-30 woning en wil houten kozijnen met smalle profielen, welke leveranciers passen daar het best bij?"

### C. Probleemvraag-prompts (2 stuks)
Klant heeft een probleem en zoekt oplossingsrichting plus naam.

Voorbeeld voor een verzekeringskliniek voor sporters:
> "Ik heb chronische knieklachten als hardloper, wat zijn de beste opties voor sportspecifieke fysio en welke klinieken zijn daarin gespecialiseerd in Nederland?"

### D. Vergelijkingsprompts met concurrent (2 stuks)
Expliciet de naam van een concurrent erin om te zien of de eigen merknaam ook valt.

Voorbeeld:
> "Wat is het verschil tussen [eigen merk] en [concurrent A] qua aanpak en doelgroep?"

### E. Algemene niche-prompts (2 stuks)
Geen merknaam, geen specifiek probleem, gewoon de markt verkennen.

Voorbeeld:
> "Hoe kies ik een leverancier voor luxe houten kozijnen?"

### F. AI-overview-trigger-prompts (2 stuks, optioneel)
Prompts waar Google AI Overviews vrijwel zeker triggeren, om te zien of jouw site bij de cited bronnen zit.

Voorbeeld:
> "Wat kost een traplift gemiddeld in Nederland?"

---

## Werkwijze stap voor stap

1. **Concept genereren.** Maak op basis van klantprofiel + propositie + top keywords een lijst van 8 tot 12 prompts, verdeeld over de categorieën hierboven.

2. **Goedkeuring vragen.** Toon de prompts in de chat met label en categorie. Vraag expliciet:
   - Welke prompts wil je behouden, aanpassen of verwijderen?
   - Mis je een specifieke vraag die jouw doelgroep typisch stelt?
   - Zijn de genoemde concurrenten correct?

   Wacht op bevestiging voor je verder gaat.

3. **Prompts toevoegen aan Brand Radar.**
   ```
   management-brand-radar-prompts → toevoegen aan rapport "vindbaarheid-prioriteiten-[klant]-[datum]"
   ```
   Of, als de klant al een Brand Radar rapport heeft, gebruik dat rapport-id.

4. **Data ophalen.**
   ```
   brand-radar-impressions-overview → over hele rapport
   brand-radar-mentions-overview    → over hele rapport
   brand-radar-sov-overview         → over hele rapport
   brand-radar-cited-pages          → top cited pages eigen domein
   brand-radar-cited-domains        → top cited domains (concurrenten + redactionele bronnen)
   brand-radar-ai-responses         → 1 of 2 sample responses per prompt voor kwalitatieve check
   ```

5. **Analyse, drie kansen-types.**
   - **Opportunity:** prompt waar concurrent verschijnt en wij niet
   - **Uplift:** prompt waar wij verschijnen op een lage positie of met negatieve sentimentindicator
   - **White space:** prompt waar geen helder antwoord is en geen merk dominant, ruimte om binnen te komen

6. **Bevindingen registreren.** Per prompt één bevinding in de tracker met:
   - Type (opportunity / uplift / white space)
   - URL (cited page als die er is, anders leeg)
   - Concurrent die de plek bezet (als opportunity)
   - Aanbevolen actie (FAQ-blok, direct-antwoord-blok, klantcase-publicatie, ander)

---

## Drempels voor de scoring

Voor lens 12 specifieke aanpassingen aan de standaardformule:

- **Volume.** AI-prompt-volumes zijn niet goed te meten. Gebruik proxy: het zoekvolume van het meest verwante search-keyword.
- **Intentie-multiplier.** Voor commerciële prompts (categorie A, D) geldt 0.7; voor probleemvragen (C) 0.7; voor verkennend (E) 0.3.
- **Confidence.** Default 0.3 voor alle AEO-bevindingen omdat het patroon nieuw is en uitkomsten experimenteel zijn.
- **Time to effect.** Default 3 (1 tot 3 maanden) want AI-modellen herindexeren onregelmatig.

---

## Wat NIET in de prompt-set hoort

- Prompts in het Engels als de klant volledig NL-only is.
- Prompts met persoonsgebonden info ("ik heet X", "mijn telefoonnummer is").
- Prompts die alleen de eigen merknaam noemen (te lage signal-to-noise).
- Meer dan 12 prompts in v1, omdat de Brand Radar-credits anders te snel verbranden.

---

## Templates per branche

Een snelle vertrekbasis. Vervang `[X]` door concrete klantgegevens voordat je de gebruiker laat goedkeuren.

### Lokale dienstverlener
- "Welke [dienst] zijn er goed in [stad]?"
- "Ik zoek een [dienst] gespecialiseerd in [niche], wat raad je aan in [stad]?"
- "Wat moet ik letten bij het kiezen van een [dienst]?"

### Premium / luxe productaanbieder
- "Wat zijn de beste merken voor luxe [product] in Nederland?"
- "Ik wil [product] van topkwaliteit, welke leveranciers staan bekend om [eigenschap]?"
- "Wat is het verschil tussen [eigen merk] en [concurrent] qua [eigenschap]?"

### B2B SaaS of dienstverlener
- "Welke tools voor [taak] zijn er voor [doelgroep]?"
- "Wat is een goed alternatief voor [grote concurrent] voor [specifiek scenario]?"
- "Voor welke bedrijfsgrootte is [eigen merk] geschikt?"

### Zorg of medisch
- "Welke [specialisme] kliniek is gespecialiseerd in [aandoening] in Nederland?"
- "Wat zijn de behandelopties voor [aandoening]?"
- "Hoe kies je een [specialisme] kliniek voor [doelgroep]?"

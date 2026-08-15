---
description: Pak één groot punt uit de wachtrij op /admin/grote-punten. Zonder argument haal je op wat er klaarstaat; met "plan" schrijf je alleen een plan, met "bouwen" bouw je een goedgekeurd punt. Gebruik dit ALTIJD wanneer Maarten een groot punt noemt, ook zonder het woord: "pak G3", "werk dat idee uit", "maak er een plan van", "bouw dat punt", "de nachtwachtrij".
---

Een groot punt is werk dat niet in een tweak-ronde past: het is niet fout maar onaf, en er is
geen goed antwoord op "wat moet er gebeuren" zonder dat er eerst over nagedacht is. De wachtrij
staat op `/admin/grote-punten`.

**De weg die een punt aflegt:** idee → plan wordt gemaakt (samen uitdenken in het draadje bij het
punt) → plan klaar (wacht op Maartens akkoord) → in de bouwwachtrij → 's nachts gebouwd →
controleren.

**Twee kaders, geen van beide onderhandelbaar:**

1. **Alleen een punt met een door Maarten goedgekeurd plan mag gebouwd worden.** Jij kunt dat
   akkoord niet zelf geven; de route weigert het als het uit een meekijk-sessie komt. Kom je een
   punt tegen zonder akkoord: schrijf het plan, zet hem op `plan-klaar`, en stop.
2. **Grote punten en tweaks bouwen nooit tegelijk.** Eén punt per ronde, en één ronde tegelijk
   over beide banen heen. Dat wordt afgedwongen door het slot; jij hoeft er alleen naar te
   luisteren.

## Stap 1, altijd als eerste: claim de ronde

```
POST /api/admin/punten/ronde  { "actie": "claim", "ronde": "<$PUNT_RONDE, of laat weg>", "handmatig": false }
```

Staat de omgevingsvariabele `PUNT_RONDE` er (dat is zo als de ronde vanaf de knop of vanuit de
nacht draait), gebruik die naam dan; anders verzint de route er zelf een. Je krijgt terug:

- `{ ok: true, werk: "bouwen", punt }` — er ligt een goedgekeurd plan, ga naar **Bouwen**.
- `{ ok: true, werk: "plan", punt }` — Maarten vroeg om een plan, ga naar **Een plan schrijven**.
- `reden: "bezet"` (409) — er loopt al een ronde, in welke baan dan ook. **Stop meteen en bouw
  niets.** Twee rondes in dezelfde bestanden is precies wat hier eerder is misgegaan.
- `reden: "leeg"` — er staat niets klaar. Stop, zonder bericht.
- `reden: "overdag"` — het is geen nacht en niemand drukte op de knop. Stop.

Lees daarna **het hele draadje** van het punt (`punt.draad`). Daar staat wat Maarten al gezegd
heeft. Opnieuw iets voorstellen dat hij twee regels eerder heeft afgewezen, is de slechtste
uitkomst die er is.

## Een plan schrijven (werk: "plan")

Je bouwt hier **niets**. Je verandert geen enkel bestand in de repo. Wat je oplevert is een plan
dat Maarten in twee minuten kan beoordelen zonder programmeur te zijn.

1. **Zoek het uit voor je schrijft.** Kijk in de code hoe het nu werkt, kijk met eigen ogen op het
   scherm (zie "Meekijken" in `CLAUDE.md`), en controleer je aannames. Een plan op een aanname is
   een nacht weggegooid.
2. **Schrijf het plan in gewone taal**, in de vorm hieronder. Geen bestandsnamen en geen jargon in
   de eerste vier kopjes; techniek hoort alleen onder het laatste.

   ```
   ## Wat er verandert voor jou
   Eén alinea: wat kun je straks dat nu niet kan, of wat gaat er anders voelen.

   ## Hoe het gaat werken
   Drie tot zes bullets, in de volgorde waarin jij het zou tegenkomen op het scherm.

   ## Waar ik voor kies, en waarom
   De keuzes die er echt toe doen, met per keuze het alternatief dat afvalt en waarom.
   Dit is het stuk waar Maarten iets van kan vinden; het is dus het belangrijkste stuk.

   ## Wat er kan misgaan
   Eerlijk. Wat raakt dit, wat kan er stuk, en wat is het vangnet.

   ## Waaraan je ziet dat het af is
   Eén zin die je 's ochtends kunt nakijken zonder de code te openen.

   ## Technisch voetnootje
   Hooguit twee regels: welke bestanden, welke tabel, welke proef.
   ```

3. **Twijfel je over iets wezenlijks, vraag het in het plan.** Zet de vraag onder "Waar ik voor
   kies" als een keuze met twee opties. Niet een gok inbouwen en hopen; Maarten leest dit toch.
4. **Zet het plan op het punt en vraag om akkoord:**

   ```
   PATCH /api/admin/punten  { "id": <id>, "stand": "plan-klaar", "plan": "<het plan>",
                              "regel": "<één regel: wat je hebt uitgezocht en waar de keuze zit>" }
   ```

   Zet de `omvang` erbij (`klein`, `middel` of `groot`) als je inschatting afwijkt van wat er
   staat; daar hangt de tijdsverwachting aan die Maarten op het scherm ziet.
5. **Geef de ronde terug** (stap "Afsluiten" hieronder). Er komt geen commit, geen deploy.

## Bouwen (werk: "bouwen")

Er ligt een plan waar Maarten ja tegen gezegd heeft. **Bouw wat er in het plan staat, en niet
meer.** Zie je onderweg iets beters: niet doen, wel noemen in je afsluitende regel. Wijkt de
werkelijkheid zo af dat het plan niet meer klopt, bouw dan niets half maar zet het punt terug
(zie "Als het plan niet blijkt te kloppen").

Meld elke stap zodra je eraan begint, want daar hangt de voortgangsbalk aan die Maarten 's
ochtends ziet:

```
POST /api/admin/punten/ronde  { "actie": "stap", "id": <id>, "nr": <1..5> }
```

1. **Plan gelezen en laatste code opgehaald** (`nr: 1`).
   `git fetch origin main && git rebase origin/main`. Vaste regel, geen uitzondering.
2. **Aan het bouwen** (`nr: 2`). Volg het plan. Gewone werkwijze uit `CLAUDE.md` geldt volledig:
   de gedeelde bouwstenen, de schaal-tokens, het knopsysteem, de uitleg bijwerken in
   `lib/uitleg/` en één regel in `lib/wat-is-nieuw.ts`. Dit is géén tweak-ronde; hier gelden de
   uitzonderingen van `.claude/commands/tweaks.md` niet.
3. **De proeven draaien** (`nr: 3`). `npm run proef`. Rood is rood: repareren, niet omzeilen, en
   nooit een proef uitzetten of een erfenis-lijst langer maken.
4. **Live zetten** (`nr: 4`). Commit met een beschrijvende regel, push naar `main`, en daarna
   `scripts/wacht-op-deploy.sh`. Pushen is niet hetzelfde als live.
5. **Zelf nagekeken op het scherm** (`nr: 5`). Kijk met eigen ogen (zie "Meekijken" in
   `CLAUDE.md`) of het klopt. Iets op `controleer` zetten dat je niet gezien hebt, is precies de
   heen-en-weer die deze hele opzet moet weghalen.

Daarna:

```
PATCH /api/admin/punten  { "id": <id>, "stand": "controleer",
                           "regel": "<één regel in gewone taal: wat er nu anders is>" }
```

Die regel komt onder zijn eigen punt te staan, dus schrijf hem voor Maarten, niet voor jezelf.
Geen bestandsnamen, geen verslag van je stappen.

## Als het plan niet blijkt te kloppen

Dat mag, en het is beter dan doorbouwen. Zet het punt terug met de reden erbij:

```
PATCH /api/admin/punten  { "id": <id>, "stand": "plan-maken",
                           "regel": "<wat er anders bleek, en welke keuze Maarten nu heeft>" }
```

Draai wat je al gewijzigd had terug (`git checkout .`) zodat er niets halfs op `main` belandt.
Een half gebouwd groot punt is achteraf niet meer uit elkaar te trekken; dat is precies de reden
dat er maar één punt per ronde in gaat.

## Afsluiten, altijd

```
POST /api/admin/punten/ronde  { "actie": "terug", "ronde": "<de ronde uit stap 1>" }
```

Dat is geen beleefdheid maar de sluiting: zolang het slot van jou is kan er niets anders draaien,
ook geen tweak-ronde. Vergeet je het, dan valt het na tweeënhalf uur vanzelf vrij en gaat het punt
terug de wachtrij in.

## Terugkoppelen

Draait deze ronde 's nachts, dan is er niemand om iets aan te vragen en is het draadje bij het
punt je enige terugkoppeling. Schrijf daar dus alles in wat Maarten moet weten.

Draait hij in een chat, dan geldt de vaste vorm van een ontwikkelchat: maximaal vier regels. Wat
er nu werkt in wat Maarten ermee kan, een klikbare link om het te zien, wat er nog open is, en
alleen indien nodig wat je van hem nodig hebt.

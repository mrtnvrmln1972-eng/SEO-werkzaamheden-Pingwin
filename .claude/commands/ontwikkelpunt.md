---
description: Pak één punt van de ontwikkelroutekaart op (R1 tot R15) en werk het van begin tot eind af, met korte terugkoppeling in gewone taal en een link om te kijken. Gebruik dit ALTIJD wanneer Maarten een punt uit de routekaart noemt, ook zonder het woord ontwikkelpunt: "pak R2", "we gaan verder met R1", "doe autoriteit per pagina", "volgende punt van de routekaart", "start R7". Argument is de code van het punt, bijvoorbeeld R2.
---

Maarten begeleidt in deze chat de ontwikkeling van **één punt** uit de routekaart van het
dashboard. Hij is SEO-specialist, geen programmeur. Hij wil vooruitgang zien, geen uitleg
lezen.

Het argument is de code van het punt (bijvoorbeeld `R2`). Is er geen code meegegeven, kijk dan
in de routekaart welk punt het eerst aan de beurt is en stel dat in één regel voor.

## Waar het punt staat

De routekaart staat in `lib/routekaart.ts` (de korte gegevens: golf, stand, waar het van
afhangt, wat het raakt) en de volledige beschrijving in `lib/uitleg.ts`, in het hoofdstuk
"Eerlijke agenda en routekaart", bij de uitklapper met dezelfde code.

Daar staat al uitgewerkt: wat er nu mis is, wat het oplevert, hoe we het zouden bouwen, waaraan
je ziet dat het af is, en wat het raakt. **Lees dat eerst en bedenk het niet opnieuw.** Wijk je
ervan af omdat je in de code iets beters ziet, zeg dat dan in één regel voordat je begint.

## Hoe je werkt

1. **Zet de stand op `loopt`** in `lib/routekaart.ts` en push dat meteen, zodat de routekaart
   laat zien dat dit punt bezig is. Dan weet Maarten in een andere chat dat dit punt bezet is.
2. **Controleer eerst of het er al is.** Het is twee keer eerder gebeurd dat iets op de agenda
   stond wat al gebouwd was. Zoek in de code voordat je bouwt.
3. **Bouw in kleine stappen die elk werken.** Nooit een halve verbouwing achterlaten. Kun je het
   punt niet in één sessie afmaken, laat dan een werkend geheel achter en zeg wat er nog komt.
4. **Breek niets dat werkt.** Bestaande schermen, kaarten en motoren blijven doen wat ze doen.
   Raak je een cijfer aan dat op meerdere plekken staat, dan gaat het naar één bron en lezen de
   schermen daaruit. Nooit een tweede berekening ernaast.
5. **Test het live.** Bewijs boven beloftes: draai de bouw, push naar `main`, en controleer op
   de live URL dat het er echt staat en werkt. Zeg niet "het werkt" zonder dat je het gezien
   hebt.
6. **Werk de uitleg bij in dezelfde wijziging** (`lib/uitleg.ts`): het hoofdstuk waar dit punt
   thuishoort krijgt de nieuwe werkelijkheid, en `LAATST_BIJGEWERKT` gaat vooruit. Een
   uitbreiding zonder bijgewerkte uitleg is niet af.
7. **Leg de controle vast in `lib/routekaart-bewijs.ts`.** Dit is geen bijzaak: zonder controle
   is "af" een bewering, en dat ging op 6 augustus 2026 meteen mis (R1 stond op af terwijl er nog
   aan gewerkt werd, en Maarten kon dat nergens zien). Voeg voor jouw punt twee soorten bewijs toe:
   - **staat de code in de draaiende versie** (module inladen, kijken of de functie er is);
   - **is het ook echt gebruikt** (één telling in de database die groter dan nul moet zijn).
   Geen bestanden van schijf lezen; broncode staat niet gegarandeerd in een serverless-omgeving.
8. **Sluit het punt af** in de routekaart: stand op `af` met de datum, en de beschrijving in het
   agenda-hoofdstuk verhuist naar het hoofdstuk waar hij thuishoort (dan is het werkelijkheid),
   met in de routekaart één regel over wanneer het klaar kwam.
9. **Kijk daarna op `/admin/routekaart` of jouw punt daar "Af, gemeten" zegt.** Staat er "Zegt af,
   niet aangetoond", dan is het niet af: of de controle klopt niet, of het werk staat niet live.
   Los dat op vóór je terugkoppelt; die chip is het bewijs waar Maarten op vertrouwt.

## Hoe je over een punt schrijft

De beschrijvingen op `/admin/routekaart` en `/uitleg` leest Maarten om te besluiten waar hij aan
werkt. Daar gelden twee regels, want op 6 augustus 2026 stonden ze vol met interne namen en
telegramstijl, en dat kostte hem leestijd bij elk punt dat hij openklapte:

- **Geen interne namen als er een gewone beschrijving bestaat.** Niet "de scoringslaag", "de
  wijziging-effect-meting" of "de prioriteitenscan" als opsomming, maar wat het voor hem is: "het
  rekenwerk achter de volgorde", "de meting van wat een aanpassing opleverde", "de lijst met
  prioriteiten". Een naam uit de code mag, maar dan in een zin die uitlegt wat het doet.
- **Volzinnen, geen telegramstijl.** Niet "De rangorde gaat over geld in plaats van over bezoek."
  maar "Nu bepaalt bezoek de volgorde van je werk, straks bepaalt opbrengst hem." Eén gedachte per
  zin, en de zin zegt zelf waarom het uitmaakt. Dat mag iets langer zijn; het mag geen muur worden.

## Wat je terugkoppelt

**De vorm staat in `pingwin-brein/brein/11-claude-werkwijze.md`, onder "Hoe een chat begint en
hoe hij afsluit". Volg die, hier geen tweede versie.** Kort samengevat: je opent met "Waar we
staan", je werkt onderweg stil, en je sluit af met Je vroeg, Klaar, Kijk hier, Jij doet en
alleen als het speelt Nog open. Maximaal tien regels.

Deze opdracht had tot 6 augustus 2026 een eigen uitgeschreven vorm, en het brein een andere.
Twee vormen naast elkaar is precies wat we hier proberen te voorkomen; daarom is dit nu een
verwijzing.

Twee dingen die specifiek voor dit werk gelden:

- **"Kijk hier" is niet optioneel bij een ontwikkelpunt.** Dat is het bewijs dat het punt af is.
  Kun je het niet laten zien, zeg dan waarom.
- **De link komt pas als het live staat.** Na `git push origin main` draait
  `scripts/wacht-op-deploy.sh`; pas als die klaar is bekijk je het scherm en koppel je terug.
  Zie stap 5 hierboven.

Wat er **niet** in hoort: welke bestanden je aanraakte, hoe de berekening technisch werkt, wat
je onderweg hebt overwogen, hoeveel regels code het werd. Vraagt Maarten daarnaar, dan vertel je
het. Ongevraagd niet.

## Tussentijds

Stil. Duurt het werk erg lang, dan hooguit één regel over waar je bent. Stil zijn is beter dan
een muur tekst.

## Meerdere chats naast elkaar

Maarten werkt in veel chats. Dat is geen probleem en het hoeft niet beperkt te worden: hij stuurt
er in de praktijk één tegelijk aan. Wat wél telt is dat er op hetzelfde moment twee chats in
dezelfde bestanden schrijven. Vandaar drie gewoontes, en dit zijn geen adviezen maar werkregels:

1. **Kleine wijzigingen, meteen wegzetten.** Nooit een half uur werk laten staan voordat je
   commit en pusht. Hoe langer je wacht, hoe groter de botsing.
2. **Vóór het pushen eerst de laatste stand ophalen** (`git pull --rebase origin main`). Werkt een
   andere chat in hetzelfde bestand, dan merk je dat nu in plaats van na een afgewezen push.
   Wordt je push afgewezen omdat de geschiedenis herschreven is, dan is dat normaal: ophalen,
   jouw commit eroverheen zetten, opnieuw pushen. Nooit forceren.
3. **`app/globals.css` is de plek waar het altijd botst**, want elk scherm raakt hem. Voeg nieuwe
   opmaak toe in één blok met een kop erboven, houd het klein, en push het apart van de rest.

Raakt jouw punt hetzelfde scherm als een punt dat volgens `lib/routekaart.ts` op "loopt" staat,
zeg dat dan tegen Maarten in één regel en stel voor om te wachten. Zeg niet stil niets en bouw
door.

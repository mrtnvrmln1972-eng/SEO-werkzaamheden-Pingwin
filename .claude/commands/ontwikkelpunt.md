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
7. **Sluit het punt af** in de routekaart: stand op `af` met de datum, en de beschrijving in het
   agenda-hoofdstuk verhuist naar het hoofdstuk waar hij thuishoort (dan is het werkelijkheid),
   met in de routekaart één regel over wanneer het klaar kwam.

## Wat je terugkoppelt (harde vorm, elke keer)

Maarten leest nu te veel en te lange terugkoppelingen. Daarom is dit geen voorkeur maar een
regel. **Maximaal acht regels, gewone taal, en altijd een link om te kijken.** Geen
bestandsnamen, geen jargon, geen opsomming van wat je hebt geprobeerd.

Vaste vorm:

- **Klaar:** wat er nu werkt, in één of twee regels, in wat Maarten ermee kan.
- **Kijk hier:** een klikbare link naar het scherm waar hij het ziet. Altijd. Kun je het niet
  laten zien, zeg dan waarom.
- **Nog open:** wat er nog niet af is, of "niets".
- **Nu nodig van jou:** alleen als je echt iets van hem nodig hebt (een besluit, een inlog, een
  bedrag). Anders deze regel weglaten.

Voorbeeld van de goede lengte:

> **Klaar:** de prioriteitenlijst rekent nu in aanvragen in plaats van in klikken. Pagina's die
> converteren staan bovenaan.
> **Kijk hier:** https://pingwin-seo-dashboard.vercel.app/admin/client/onedayclinic?tab=prioriteiten
> **Nog open:** niets.
> **Nu nodig van jou:** vul bij deze klant de waarde van een aanvraag in, dan verschijnen de
> bedragen.

Wat er **niet** in hoort: welke bestanden je aanraakte, hoe de berekening technisch werkt, wat
je onderweg hebt overwogen, hoeveel regels code het werd. Vraagt Maarten daarnaar, dan vertel je
het. Ongevraagd niet.

## Tussentijds

Duurt het werk lang, meld dan halverwege één regel over waar je bent. Niet meer. Stil zijn is
beter dan een muur tekst.

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

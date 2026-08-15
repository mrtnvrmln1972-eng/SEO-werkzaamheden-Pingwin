---
description: Werk de stapel kleine aanpassingen af die Maarten met het knopje "Tweak" heeft gemeld, allemaal in één ronde, met één bouw en één deploy. Gebruik dit ALTIJD wanneer hij de stapel noemt, ook zonder het woord tweaks: "werk de stapel af", "doe de tweaks", "voer die kleine aanpassingen door", "de lijst van vandaag". Zonder argument pak je alle openstaande meldingen.
---

Maarten meldt tijdens het werken kleine dingen die anders moeten, met het knopje **Tweak** dat
op elk beheerscherm rechtsonder staat. Die stapelen op `/admin/tweaks`. Deze chat werkt die
stapel in één ronde af.

**Waarom dit bestaat.** Losse tweaks kostten in de praktijk een kwartier per stuk, terwijl het
bouwen twee minuten was. Die tijd zat er niet in de wijziging maar eromheen: een chat die eerst
uitzoekt waar het scherm staat, een wijziging die onderweg wordt uitgebreid met gedeelde code en
een nieuwe proef, en een bouw plus deploy voor die ene regel. Die kosten betaal je per chat en
per ronde, niet per tweak. Tien tweaks in één ronde kosten daarom niet tien keer zoveel als één.

Dat voordeel verdwijnt zodra je de ronde laat uitdijen. Vandaar de regels hieronder; ze zijn de
hele reden dat dit sneller is.

## De regel die alles bepaalt

**Een tweak is klaar als de tweak klaar is.**

- Geen refactor. Geen gedeelde component eruit trekken omdat je twee keer hetzelfde ziet.
- Geen nieuwe proef. Geen bestaande proef uitbreiden.
- Geen tweede bestand aanraken dat niet stuk was.
- Geen uitleghoofdstuk bijwerken, geen regel in `lib/wat-is-nieuw.ts`. Een tweak is geen
  uitbreiding van het dashboard, het is een correctie erop.
- Zie je onderweg iets dat écht beter zou moeten: **niet doen, wel noemen**, in één regel in de
  terugkoppeling. Maarten beslist of het een routekaartpunt wordt.

Die uitzonderingen op de gebruikelijke werkwijze gelden alleen binnen deze opdracht. Bouw je
buiten een tweak-ronde iets nieuws, dan gelden de gewone regels uit `CLAUDE.md` gewoon.

## Hoe je werkt

1. **Claim de ronde. Dit is de eerste handeling, vóór alles.**

   ```
   POST /api/admin/tweaks/ronde  { "actie": "claim", "ronde": "<$TWEAK_RONDE, of laat weg>" }
   ```

   Staat de omgevingsvariabele `TWEAK_RONDE` er (dat is zo als de ronde vanaf de knop "Nu
   draaien" start), geef die naam dan mee. De werkstroom geeft het slot aan het eind onder
   precies die naam terug, ook als er onderweg iets misgaat; een andere naam betekent dat de
   wachtrij drie kwartier dicht blijft staan.

   Je krijgt `{ ok: true, ronde, tweaks }` terug: het slot is van jou en de meldingen staan al op
   `bezig`, in de volgorde waarin je ze hoort te doen (eerst wat Maarten op "direct doorvoeren"
   zette, daarna de volgorde die hij zelf gesleept heeft). Je hoeft de lijst dus niet zelf op te
   halen en niet zelf op stand te zetten.

   Krijg je `409` met reden `bezet`, dan loopt er al een ronde: **stop meteen en bouw niets.**
   Twee rondes tegelijk in dezelfde bestanden is precies wat hier eerder is misgegaan. Krijg je
   reden `leeg`, dan staat er niets klaar; stop dan ook, zonder bericht.

   Geparkeerde meldingen en ideeën komen hier niet in voor; daar hoef je niet op te letten.

   **Heeft een melding al reacties, lees ze dan eerst.** Dan is dit een tweede of derde ronde en
   staat er precies in wat er de vorige keer niet klopte. Opnieuw hetzelfde bouwen is de ergste
   uitkomst die er is. Zit er een schermafbeelding bij (`beeld` is niet null), haal die dan los op
   met `GET /api/admin/tweaks?beeld=<id>` als de tweak over vormgeving gaat; dat scheelt de vraag
   "welk venster bedoel je".
2. **Begin met de laatste code.** `git fetch origin main && git rebase origin/main`. Vaste
   regel, geen uitzondering: er wordt uit meerdere chats naar `main` gepusht.
3. **Sorteer op bestand, niet op volgorde van melden.** Drie tweaks in hetzelfde scherm doe je
   in één keer open. Dat is waar de tijdwinst zit.
4. **Doe ze allemaal, dan één keer bouwen.** `npm run proef`, daarna commit en push naar `main`,
   daarna `scripts/wacht-op-deploy.sh`. Eén ronde, één deploy.
5. **Zet de standen bij.** Dit is geen administratie, dit is het seintje aan Maarten.
   - Op `bezig` zetten hoeft niet meer; dat deed de claim in stap 1 al.
   - Na de deploy: op `stand: "controleer"`, met in `reactie` één regel over wat je gedaan hebt,
     in gewone taal. Die regel komt onder zijn melding te staan, dus schrijf hem voor hem, niet
     voor jezelf. Zodra er iets op `controleer` staat verschijnt er vanzelf een melding in zijn
     kopbalk; dat is het seintje, jij hoeft niets extra's te doen.
   - Blijkt een tweak groter dan hij leek: `stand: "apart"` met één regel in `notitie` waarom,
     en ga door met de rest. **Nooit stilletjes laten uitlopen en de rest ophouden.**

   Je mag deze standen zetten vanuit de meekijk-sessie; dat is de enige plek in het dashboard
   waar dat mag. `PATCH /api/admin/tweaks` met `{ id, stand, reactie }`. Wat je daar níet mag: de
   voorrang veranderen (direct doorvoeren, parkeren) of de volgorde slepen. Dat is Maartens keuze.

6. **Geef de ronde terug als je klaar bent, of als je stopt.**

   ```
   POST /api/admin/tweaks/ronde  { "actie": "terug", "ronde": "<de ronde uit stap 1>" }
   ```

   Dat is geen beleefdheid maar de sluiting: zolang het slot van jou is kan er geen volgende ronde
   starten. Vergeet je het, dan valt het na 45 minuten vanzelf vrij en gaat alles wat nog op
   `bezig` staat terug de wachtrij in. Stop je halverwege, geef hem dan meteen terug; dan staat de
   wachtrij weer klaar in plaats van drie kwartier stil.
7. **Kijk of het klopt met eigen ogen** vóór je iets op `controleer` zet. Zie
   "Meekijken" in `CLAUDE.md`; een schermafbeelding maken kan, dus doe dat bij alles wat over
   vormgeving gaat. Iets op `controleer` zetten dat je niet gezien hebt is precies de
   heen-en-weer die deze hele opzet moet weghalen.

## Een melding met soort "idee"

Die komt niet in je claim voor, dus je werkt hem ook niet af. Wat je er wél mee doet: je maakt er
een voorstel van in gewone taal (wat het oplevert, hoe je het zou bouwen, wat het raakt, waaraan
je ziet dat het af is), zet dat in `reactie`, en laat de melding op `wachtrij` staan zodat Maarten
hem beantwoordt.

Zegt hij ja, dan drukt hij op **Wordt een routekaartpunt**. De melding gaat dan op
`stand: "routekaart"` en verschijnt op `/admin/routekaart` in het blok "Uit de ideeënstapel", nog
zonder nummer. Daar staat een startregel klaar om er een echt punt van te maken: dan schrijf je
het punt in `lib/routekaart.ts` en de beschrijving in `lib/uitleg/15-agenda/`, en zet je het
R-nummer terug op de melding met `PATCH /api/admin/tweaks { id, stand: "routekaart", punt: "R16" }`.
Zo blijft de routekaart zelf één bron (de code), met een zichtbare wachtkamer ervoor.

## Wanneer een tweak géén tweak is

Zet hem op `apart` als hij een van deze dingen raakt:

- een nieuwe tabel of een nieuw veld in de database;
- een nieuwe koppeling met een dienst buiten het dashboard;
- gedrag dat over meerdere schermen tegelijk verandert;
- iets waarvan je niet binnen een paar minuten ziet hoe het moet.

Dat is geen falen, dat is de stapel schoon houden. Eén te grote tweak die je toch probeert,
kost de hele ronde zijn snelheid.

## Automatisch draaien

Deze opdracht start op twee manieren zonder dat er iemand een chat opent: een uurlijkse Routine,
en de knop **Nu draaien** op `/admin/tweaks` (die start de werkstroom
`.github/workflows/tweak-ronde.yml`). Dat is precies waarom stap 1 een claim is en geen gewone
lijst: die twee kunnen op dezelfde minuut afgaan, en de tweede hoort dan niets te doen.

Draait de ronde zonder dat Maarten erbij is, dan geldt precies hetzelfde, met één verschil: er is
niemand om iets aan te vragen.
Twijfel je bij een melding wat hij bedoelt, bouw dan niet iets dat er half naast zit, maar zet
hem op `apart` met je vraag in `notitie`. Staat er niets in de wachtrij, doe dan niets en stop
meteen; een lege ronde hoort geen bericht op te leveren.

## Terugkoppelen

Eén blok aan het eind, en niet per tweak tussendoor. Wat erin staat:

- hoeveel er doorgevoerd zijn, in gewone taal wat er nu anders is (één regel per tweak, geen
  bestandsnamen);
- de kale URL van het scherm waar hij het meeste ziet;
- wat er apart is gezet en waarom, als dat speelt;
- wat je onderweg zag maar niet gedaan hebt, als dat speelt.

Geen verslag van je stappen, geen techniek, geen opsomming van bestanden.

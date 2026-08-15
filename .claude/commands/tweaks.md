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

1. **Haal de stapel op.** `GET /api/admin/tweaks` geeft de lopende meldingen, met per stuk de
   tekst, het scherm waar Maarten stond, de klant, het draadje met eerdere correcties, en of er
   een schermafbeelding bij zit (die haal je los op met `?beeld=<id>`). Bekijk het beeld als de
   tweak over vormgeving gaat; dat scheelt de vraag "welk venster bedoel je".

   **Pak alleen `soort: "tweak"` met stand `wachtrij`.** Een melding met `soort: "idee"` hoort
   niet in een ronde: die krijgt eerst een voorstel, zie onderaan.

   **Heeft een melding al reacties, lees ze dan eerst.** Dan is dit een tweede of derde ronde en
   staat er precies in wat er de vorige keer niet klopte. Opnieuw hetzelfde bouwen is de ergste
   uitkomst die er is.
2. **Begin met de laatste code.** `git fetch origin main && git rebase origin/main`. Vaste
   regel, geen uitzondering: er wordt uit meerdere chats naar `main` gepusht.
3. **Sorteer op bestand, niet op volgorde van melden.** Drie tweaks in hetzelfde scherm doe je
   in één keer open. Dat is waar de tijdwinst zit.
4. **Doe ze allemaal, dan één keer bouwen.** `npm run proef`, daarna commit en push naar `main`,
   daarna `scripts/wacht-op-deploy.sh`. Eén ronde, één deploy.
5. **Zet de standen bij.** Dit is geen administratie, dit is het seintje aan Maarten.
   - Bij de start van de ronde: elke tweak die je oppakt op `stand: "bezig"`. Dan weet een
     tweede ronde dat hij bezet is.
   - Na de deploy: op `stand: "controleer"`, met in `reactie` één regel over wat je gedaan hebt,
     in gewone taal. Die regel komt onder zijn melding te staan, dus schrijf hem voor hem, niet
     voor jezelf. Zodra er iets op `controleer` staat verschijnt er vanzelf een melding in zijn
     kopbalk; dat is het seintje, jij hoeft niets extra's te doen.
   - Blijkt een tweak groter dan hij leek: `stand: "apart"` met één regel in `notitie` waarom,
     en ga door met de rest. **Nooit stilletjes laten uitlopen en de rest ophouden.**

   Je mag deze standen zetten vanuit de meekijk-sessie; dat is de enige plek in het dashboard
   waar dat mag. `PATCH /api/admin/tweaks` met `{ id, stand, reactie }`.
6. **Kijk of het klopt met eigen ogen** vóór je iets op `controleer` zet. Zie
   "Meekijken" in `CLAUDE.md`; een schermafbeelding maken kan, dus doe dat bij alles wat over
   vormgeving gaat. Iets op `controleer` zetten dat je niet gezien hebt is precies de
   heen-en-weer die deze hele opzet moet weghalen.

## Een melding met soort "idee"

Die werk je niet af. Je maakt er een voorstel van in gewone taal (wat het oplevert, hoe je het
zou bouwen, wat het raakt, waaraan je ziet dat het af is), zet dat in `reactie`, en laat de
melding op `wachtrij` staan zodat Maarten hem beantwoordt. Zegt hij ja, dan wordt het een punt
op de routekaart (`lib/routekaart.ts`), niet een tweak.

## Wanneer een tweak géén tweak is

Zet hem op `apart` als hij een van deze dingen raakt:

- een nieuwe tabel of een nieuw veld in de database;
- een nieuwe koppeling met een dienst buiten het dashboard;
- gedrag dat over meerdere schermen tegelijk verandert;
- iets waarvan je niet binnen een paar minuten ziet hoe het moet.

Dat is geen falen, dat is de stapel schoon houden. Eén te grote tweak die je toch probeert,
kost de hele ronde zijn snelheid.

## Automatisch draaien

Er staat een uurlijkse Routine die deze opdracht zelf start. Draait de ronde zonder dat Maarten
erbij is, dan geldt precies hetzelfde, met één verschil: er is niemand om iets aan te vragen.
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

import type { Uitklapper } from "../types";

// De derde lijn naast de routekaart en de tweak-stapel: grote punten die eerst
// een plan krijgen, dan een akkoord, en daarna 's nachts gebouwd worden.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Grote punten: eerst samen een plan, dan 's nachts bouwen",
    kern: "Wat te groot is voor een tweak krijgt eerst een uitgeschreven plan; jij keurt goed, en dan wordt het 's nachts één voor één gebouwd.",
    tekst:
      "Er liepen twee lijnen: de routekaart met de vijftien grote ontwikkelpunten, en de tweak-stapel met " +
      "de kleine dingen die je onderweg ziet. Daartussen zat een gat, en daar bleef het meeste liggen.\n\n" +
      "**Wat er misging.** Een idee als \"de weekplanning moet anders\" is niet fout maar onaf: er is geen " +
      "goed antwoord op \"wat moet er gebeuren\" zonder dat er eerst over nagedacht is. Zulke punten zijn te " +
      "groot voor een tweak-ronde (die is expres kort en mag niet uitdijen) en te klein of te ongepland voor " +
      "een genummerd routekaartpunt. Ze belandden dus op één hoop bij de ideeën. Niet omdat ze onbelangrijk " +
      "waren, maar omdat er geen weg was tussen \"goed idee\" en \"gebouwd\". Elke keer opnieuw kostte het " +
      "een werksessie om terug te halen wat het idee ook alweer was en waarom.\n\n" +
      "**De weg die er nu ligt.** Op `/admin/grote-punten` doorloopt een punt vijf standen:\n\n" +
      "1. **Idee.** Er ligt een gedachte, meer niet. Eén regel is genoeg.\n" +
      "2. **Plan wordt gemaakt.** Er wordt uitgezocht hoe het nu werkt en wat er precies moet gebeuren. " +
      "Het sparren gaat in het draadje bij het punt zelf, niet in een chat die weer sluit.\n" +
      "3. **Plan klaar.** Het plan ligt er in gewone taal: wat er verandert voor jou, hoe het gaat werken, " +
      "waar de keuze zit en waarom, wat er kan misgaan, en waaraan je ziet dat het af is. Techniek staat " +
      "alleen in een voetnoot van twee regels onderaan. Je moet het kunnen beoordelen zonder programmeur " +
      "te zijn; dat is de hele opzet.\n" +
      "4. **In de bouwwachtrij.** Jij zei ja. Nu pas.\n" +
      "5. **Wordt gebouwd.** 's Nachts, één punt tegelijk, van boven naar beneden.\n\n" +
      "Daarna staat het live met de vraag of het klopt, precies zoals bij een tweak. Klopt het niet, dan " +
      "gaat het met jouw opmerking terug naar de tekentafel: één punt, één draadje, geen tweede briefje " +
      "dat niemand meer aan het eerste knoopt.\n\n" +
      "**Twee kaders, en het zijn sluitingen en geen afspraken.** Dit is werk dat 's nachts zonder toezicht " +
      "code schrijft en meteen live zet. Daarom zijn twee dingen onmogelijk gemaakt in plaats van " +
      "afgesproken:\n\n" +
      "- **Alleen een punt met een door jou goedgekeurd plan komt in de bouwwachtrij.** Een plan van één " +
      "regel telt niet als plan, en dat akkoord kan alleen jij geven: een ronde die het voor zichzelf " +
      "probeert te zetten krijgt een weigering. Wijzig je het plan na je akkoord, dan vervalt dat akkoord " +
      "automatisch; anders zou \"jij keurt goed\" niets betekenen.\n" +
      "- **Grote punten en tweaks bouwen nooit tegelijk.** Er is één slot voor allebei: overdag zijn de " +
      "tweaks aan de beurt, 's nachts de grote punten, en wie het slot niet krijgt bouwt niets. Twee " +
      "rondes die tegelijk in dezelfde bestanden schrijven is de bekendste manier om werk kwijt te raken.\n\n" +
      "**Eén punt per nacht-ronde, met opzet.** Een tweak-ronde pakt de hele stapel in één keer, want een " +
      "tweak is klein en raakt zelden iets anders. Bij grote punten is dat juist verkeerd: twee grote " +
      "wijzigingen in één ronde betekent twee halve wijzigingen als er onderweg iets misgaat, en achteraf " +
      "is niet meer uit elkaar te trekken welke commit waarbij hoorde. Nu gaat er één punt in, en als het " +
      "misloopt komt dat ene punt terug in de rij met de reden in zijn eigen draadje.\n\n" +
      "**Staat er niets te bouwen, dan wordt de nacht gebruikt om te denken.** Dan pakt de ronde een punt " +
      "waar jij een plan van gevraagd hebt en schrijft dat uit; er verandert dan niets aan het dashboard. " +
      "'s Ochtends liggen er dus plannen klaar om te beoordelen in plaats van een nacht die niets deed. Het " +
      "model past zich daarop aan: bouwen is uitvoeren wat er in het plan staat en gaat op het middelste " +
      "model, een plan schrijven is uitdenken en beoordelen en gaat op het zwaarste. Jij kiest daar niets " +
      "in; de werkstroom weet welk werk hij doet.\n\n" +
      "**Niets hangt meer aan een sleutel die iemand moet kopiëren.** Een ronde draait zonder toezicht " +
      "en moet dus bij de wachtrij kunnen. Dat ging eerst met dezelfde meekijk-sleutel die Maarten in de " +
      "cockpit aanmaakt, en die vervalt zodra hij een nieuwe maakt. Op 15 augustus gebeurde dat, en vanaf " +
      "dat moment kwam élke ronde er niet meer in: ze meldden \"geslaagd\" en deden niets, terwijl de " +
      "meldingen gewoon in de wachtrij bleven staan. Nu geeft het dashboard elke ronde op het moment van " +
      "starten een eigen ondertekende toegangsbon mee, die een paar uur geldig is en alleen voor die ene " +
      "ronde werkt. Er valt dus niets meer te kopiëren, en een nieuwe meekijk-sleutel raakt de rondes niet. " +
      "Het uurwerk verhuisde om dezelfde reden mee naar het dashboard zelf: dat wéét of er werk is, want " +
      "het is zijn eigen wachtrij. En een ronde die er tóch niet in komt, mislukt nu zichtbaar in plaats " +
      "van groen te kleuren zonder iets te doen.\n\n" +
      "**Je ziet wat er loopt en hoe lang het nog duurt.** Bovenaan het scherm staat welk punt op dit " +
      "moment gebouwd wordt, bij welke van de vijf stappen hij is (plan gelezen, aan het bouwen, proeven, " +
      "live zetten, zelf nagekeken) en hoeveel minuten het naar verwachting nog kost. Bij het schrijven " +
      "van een plan gebeurt hetzelfde, met drie eigen stappen (uitzoeken, schrijven, nalezen), zodat ook " +
      "dat geen zwarte doos is. Die verwachting is " +
      "geen gok: elk gebouwd punt laat zijn gemeten bouwtijd achter, en de verwachting voor het volgende " +
      "punt is de mediaan van wat punten van dezelfde omvang écht kostten. De mediaan en niet het " +
      "gemiddelde, want één ronde die vastliep zou een gemiddelde blijvend scheeftrekken. Duurt iets " +
      "merkbaar langer dan gewoonlijk, dan zegt het scherm dat, in plaats van een balk te tonen die niet " +
      "opschiet.\n\n" +
      "**En bij elk punt in de wachtrij staat wanneer het aan de beurt is.** Vannacht om 22:00, of de nacht " +
      "erna als het er niet meer bij past. Vijf grote punten zijn geen één nacht, en dat hoor je te zien " +
      "voordat je gaat wachten, niet 's ochtends te merken. De volgorde sleep je zelf; die volgorde ís de " +
      "volgorde waarin er gebouwd wordt.",
  },
];

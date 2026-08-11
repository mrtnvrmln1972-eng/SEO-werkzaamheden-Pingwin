import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "gebruik",
  titel: "Hoe je het gebruikt",
  intro:
    "De bedoeling is dat je niet hoeft na te denken over waar je moet beginnen. Hieronder de dag, de week en " +
    "de maand, en hoe een nieuwe klant erin komt.",
  uitklappers: [
    {
      titel: "Een gewone werkdag",
      kern: "Klant openen, prioriteiten lezen, een paar knoppen.",
      tekst:
        "1. Open een klant. Je landt op Taken, met je prioriteiten, de lopende gesprekken en de weekplanning " +
        "in drie blokken die dicht beginnen. Je kiest zelf wat je openzet.\n" +
        "2. Rechts staat een lijstje bespreekpunten per persoon en de laatste correspondentie, allebei dicht " +
        "tot je ze openklikt; de mails zet je desgewenst los en groot in beeld. De afgesproken zoekwoorden en " +
        "landingspagina's, en de bronnen die het overzicht voeden, zitten in de twee zijpanelen aan de rechterrand.\n" +
        "3. Pak het bovenste punt. Is het een pagina, dan ga je naar die pagina en zie je meteen wat er is en " +
        "wat de volgende fase is.\n" +
        "4. Laat het dashboard het zware werk doen: het document, het voorstel, de meting. Jij keurt goed.",
    },
    {
      titel: "Een nieuwe klant erin zetten",
      kern: "Naam, domein, en de rest bouwt zichzelf op.",
      tekst:
        "Een klant aanmaken is een naam en een domein. Daarna staat er op het tabblad **Onboarding** één " +
        "lijst met de vaste volgorde, en één knop die alles doet wat zonder mens kan:\n\n" +
        "- Er wordt een wachtwoord gegenereerd (één keer zichtbaar) als de klant een eigen dashboard krijgt.\n" +
        "- De pagina's van de site worden ingelezen.\n" +
        "- Het klantprofiel en de tone of voice worden geschreven op basis van de echte pagina's.\n" +
        "- De bedrijfsgegevens worden uit de site gehaald, gaan als link naar de klant om na te lopen, en " +
        "worden daarna vergrendeld.\n" +
        "- De concurrenten worden opgezocht: wie staat er het vaakst naast deze klant in de top 10.\n" +
        "- De zoekwoordkansen worden verzameld en de drie site-brede scans starten.\n\n" +
        "Wat alleen een mens kan (inloggen bij Search Console, de klantwaarde invullen) blijft staan als " +
        "\"dit is aan jou\", met de reden erbij.",
    },
    {
      titel: "Waarom er niets draait voordat de inventarisatie klopt",
      kern: "Een scan zonder inventarisatie is een gok met een grafiek eromheen.",
      tekst:
        "Elke stap in de onboarding noemt waar hij van afhangt, en dat wordt afgedwongen. Een prioriteitenscan " +
        "start niet zolang de pagina's niet zijn ingelezen, Search Console niet gekoppeld is, of de " +
        "concurrenten nog ontbreken. Een analyse, blauwdruk of copy start niet zonder klantprofiel en tone of " +
        "voice, want anders schrijft de tekst over een willekeurig bedrijf in een willekeurige stem.\n\n" +
        "Wordt er geweigerd, dan staat er niet \"er ging iets mis\" maar wát er ontbreekt en waar je het " +
        "regelt.\n\n" +
        "Twee dingen maken dit bruikbaar in plaats van bureaucratisch:\n\n" +
        "- **De status wordt afgelezen, niet bijgehouden.** Er zijn geen vinkjes om te zetten; het dashboard " +
        "kijkt of het profiel er echt staat, of er echt concurrenten zijn, of de scan echt gedraaid heeft. " +
        "Daardoor toont dezelfde lijst bij een klant die al jaren loopt vanzelf wat er nog ontbreekt, en is " +
        "er maar één knop nodig in plaats van een aparte voor nieuwe en bestaande klanten.\n" +
        "- **Onboarding raakt nooit af.** Concurrenten wisselen, een site verandert, een scan veroudert. " +
        "Stappen krijgen daarom vanzelf het stempel \"loopt achter\", en in de klantenlijst staat per klant " +
        "hoeveel er staat en wat er mist.\n" +
        "- **Een poort is geen perfectielijstje.** Bij de bedrijfsgegevens is onderscheid gemaakt tussen wat " +
        "moet en wat mooi meegenomen is. Moet: de naam, het type, KvK, telefoon, e-mail en het adres of " +
        "werkgebied, want zonder die velden weet niemand wélk bedrijf dit is. Mooi meegenomen: het logo, de " +
        "sociale profielen, de functie en BIG-nummers per behandelaar, de dienstomschrijvingen. Het formulier " +
        "toont alles rood zoals altijd, maar de poort struikelt niet meer over drie ontbrekende " +
        "profielpagina's bij een klant waar verder alles staat.",
    },
    {
      titel: "Alle klanten in één keer, met de prijs vooraf",
      kern: "Bulk-onboarding in golven, met een rem op het Ahrefs-verbruik.",
      tekst:
        "Klanten één voor één langslopen is zonde van de tijd, maar ze allemaal tegelijk alles laten doen kan " +
        "niet. Een volledige onboarding kost ongeveer 80.000 Ahrefs-units per klant; voor achttien klanten is " +
        "dat 1,4 miljoen, oftewel bijna vier maanden tegoed. Die tarieven zijn niet geschat maar afgelezen uit " +
        "het echte verbruik-log: een zoekwoordenlijst van een domein kost 29 units per regel, zoekwoord-ideeën " +
        "21, een zoekwoordoverzicht 32.\n\n" +
        "Daarom staat op het klantenoverzicht één blok dat de onderdelen op prijs sorteert:\n\n" +
        "- **Golf 1, de basis (± 650 units per klant).** Pagina's inlezen, klantprofiel, tone of voice, " +
        "bedrijfsgegevens uit de site, concurrenten opzoeken en de interne linkanalyse. Bijna gratis, en " +
        "precies de inventarisatie waar alle andere scans op wachten.\n" +
        "- **Golf 2, de prioriteitenscan (± 15.300 per klant).** De eerste echt dure stap.\n" +
        "- **Golf 3, opruimen en zoekwoordkansen (± 64.500 per klant).** Voor alle klanten tegelijk meer dan " +
        "twee maanden tegoed; dit doe je bij de klant waar je op dat moment aan werkt.\n\n" +
        "Drie dingen houden dat veilig. **De prijs staat er vóór de klik**: je ziet per golf wie het nog nodig " +
        "heeft, wat het samen kost en hoeveel er daarna overblijft. **De rij werkt één klant tegelijk af**, met " +
        "een cron als vangnet, dus een afgekapt tijdvenster kost hooguit één klant in plaats van de hele rij. " +
        "En **er zit een rem in**: vóór elke klant wordt bij Ahrefs opgevraagd hoeveel er nog over is, en zakt " +
        "dat onder de 50.000, dan stopt de rij zichzelf en zegt waarom. Een bulkrun kan je maand dus niet " +
        "leegtrekken.\n\n" +
        "Wat al staat wordt overgeslagen, dus een klant met volledig ingevulde bedrijfsgegevens gaat niet " +
        "opnieuw op zoek naar structured data.",
    },
    {
      titel: "De maandelijkse ronde",
      kern: "Verantwoorden en opnieuw prioriteren.",
      tekst:
        "Per maand staat vast wat er is uitgevoerd, wat het gekost heeft en wat de ontwikkeling is. Dat is " +
        "tegelijk de verantwoording naar de klant en de input voor de volgende ronde: de prioriteitenscan " +
        "rekent opnieuw door, met de correcties van vorige maand als vaste regels erin.",
    },
    {
      titel: "Wat er op de achtergrond draait, en hoe je dat ziet",
      kern: "Alles wat lang duurt draait op de server, met een rondje dat volloopt.",
      tekst:
        "Zware klussen (de site inlezen, de prioriteitenscan, de opruimanalyse, de interne links, de " +
        "documenten, de wijzigingen-scan, de zoekwoordkansen) draaien op de server en niet in je browser. " +
        "Je kunt dus wegklikken, doorklikken of het venster sluiten; het werk loopt door.\n\n" +
        "Overal waar iets draait staat hetzelfde voortgangsrondje, met daarbij:\n\n" +
        "- **Bij welke stap hij is**, als het aantal stappen bekend is. Het rondje loopt dan echt vol. Is het " +
        "aantal stappen niet bekend, dan draait het rondje rond in plaats van een verzonnen percentage te " +
        "tonen; een balk die op 90% blijft hangen is een leugen.\n" +
        "- **Wat er nu gebeurt**, in gewone taal. Een molentje zonder tekst is niet te onderscheiden van " +
        "vastgelopen.\n" +
        "- **Hoe lang hij al loopt.** Is er een kwartier geen teken van leven, dan zegt hij dat hij " +
        "waarschijnlijk vastligt, met de knop om te hervatten ernaast. Zwijgen is hier het ergste.\n\n" +
        "In de kop van de cockpit staat bovendien een klusje dat op **elk tabblad** meegaat: klik het open en " +
        "je ziet alles wat op dit moment voor deze klant draait, met de weg terug naar de plek waar het " +
        "hoort. Zo raak je een gestarte scan niet meer uit het oog doordat je ergens anders heen klikte.",
    },
    {
      titel: "Wat je als bureau moet aanleveren",
      kern: "Sleutels, geen implementatietraject.",
      tekst:
        "Om dit voor een eigen klantenportefeuille te laten draaien is nodig: een Google-account met toegang " +
        "tot de Search Console-eigendommen, een Ahrefs-sleutel, een AI-sleutel, en optioneel de mailbox, de " +
        "boekhouding en per klant een sitekoppeling. De database maakt zichzelf aan.\n\n" +
        "Wat níet nodig is: de klanten overzetten naar een nieuwe manier van werken. Het maandoverzicht kan " +
        "uit de spreadsheet blijven komen die er al is.",
    },
  ],
};

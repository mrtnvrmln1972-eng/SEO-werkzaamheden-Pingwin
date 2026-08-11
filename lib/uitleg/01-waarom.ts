import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "waarom",
  titel: "Waarom dit bestaat",
  intro:
    "SEO is geen gebrek aan informatie, het is een gebrek aan besluitvorming. Er zijn tientallen tools die " +
    "problemen kunnen opsommen. Er is bijna niets dat zegt: dít eerst, dat later, dit nooit, en dat vervolgens " +
    "ook uitvoert en naderhand nameet.",
  uitklappers: [
    {
      titel: "Het Google-profiel: de beheerdeur staat nog dicht",
      tekst:
        "De profielscan draait op de meetdeur (Google Maps), en die werkt zodra er een `GOOGLE_MAPS_API_KEY` " +
        "in de omgeving staat. De beheerdeur (de Business Profile API) is gebouwd en aangesloten, maar Google " +
        "geeft daar pas data op na een goedkeuringsaanvraag met een beoordelingstermijn van maximaal twee " +
        "weken, en het profiel moet minstens zestig dagen geverifieerd zijn.\n\n" +
        "Zolang die goedkeuring er niet is blijven zes dingen ongemeten: de bezoekcijfers, de " +
        "bedrijfsomschrijving, de feestdagen, de posts, de vragen en of er op reviews geantwoord is. Het " +
        "scherm zegt dat met zoveel woorden in plaats van die punten weg te laten, maar het blijft een gat.\n\n" +
        "Twee dingen zijn ook mét beheertoegang nog niet aangesloten: de attributen van een profiel " +
        "(rolstoeltoegankelijk, parkeren) worden niet opgehaald, en de reviewteksten van concurrenten worden " +
        "niet geanalyseerd op waar hun klanten over schrijven. Dat laatste is waarschijnlijk het meest " +
        "waardevolle dat er nog bij kan.",
    },
    {
      titel: "Het probleem waar elk SEO-bureau tegenaan loopt",
      kern: "Veel data, weinig besluit, en niemand die het bijhoudt.",
      tekst:
        "Een gemiddeld SEO-traject leunt op vier of vijf losse systemen: Search Console voor de cijfers, Ahrefs " +
        "voor zoekwoorden en links, een crawler voor de techniek, een spreadsheet voor de planning en mail voor " +
        "de communicatie. Niemand van die vijf weet wat de andere vier al hebben gezegd.\n\n" +
        "Dat levert drie voorspelbare problemen op:\n\n" +
        "- **Hetzelfde cijfer op twee plekken, met twee uitkomsten.** Wie dan wint is willekeur.\n" +
        "- **Adviezen zonder rangorde.** Een lijst van 240 bevindingen is geen plan. Het is uitstelgedrag met een export-knop.\n" +
        "- **Geen geheugen.** Wat vorige maand is aangepast, waarom, en wat het opleverde: dat zit in iemands hoofd of in een mailbox.\n\n" +
        "Het gevolg is dat de meeste uren in een SEO-traject niet naar het werk gaan, maar naar het herbepalen " +
        "van wat het werk was.",
    },
    {
      titel: "Wat dit dashboard daar anders in doet",
      kern: "Meten, oordelen en uitvoeren zitten in één keten, met één geheugen.",
      tekst:
        "Het dashboard is geen zesde tool naast de andere vijf. Het is de laag eronder die ze allemaal uitleest " +
        "en er één werkelijkheid van maakt, per klant, per pagina, met datum.\n\n" +
        "Vier keuzes maken het verschil:\n\n" +
        "1. **Meten en oordelen zijn streng gescheiden.** Wat er op een pagina staat wordt gemeten uit de live " +
        "HTML en draagt zijn eigen bewijs mee (de gevonden ankertekst, het gevonden pad, op hoeveel pagina's). " +
        "Pas daarna mag een AI er iets van vinden, en alleen bovenop die cijfers.\n" +
        "2. **Elke bevinding krijgt een rangorde en een prijskaartje.** Niet 240 punten, maar vier bakjes: deze " +
        "week, deze maand, dit kwartaal, strategisch. Plus een bakje 'niet doen', met de reden erbij.\n" +
        "3. **Van bevinding naar uitvoering is één klik.** Een zwakke meta-title wordt een voorstel, een " +
        "goedkeuring, een wijziging op de live site en daarna een meting van het effect.\n" +
        "4. **Alles wordt onthouden.** Ongeveer tachtig tabellen houden per klant bij wat er gemeten is, wat " +
        "er besloten is, wat er uitgevoerd is en wat het deed.",
    },
    {
      titel: "Voor wie het gebouwd is",
      kern: "Eén codebase, drie soorten gebruikers, drie merken al live.",
      tekst:
        "- **Het bureau (de dagelijkse gebruiker).** Opent een klant, ziet wat er te doen is, kiest een paar " +
        "acties en laat het dashboard het zware werk doen.\n" +
        "- **De klant.** Logt in op een eigen dashboard en ziet in gewone taal wat er gebeurt, wat het kost en " +
        "wat het oplevert. Geen jargon, geen ruwe data.\n" +
        "- **De sitebouwer of externe partij.** Krijgt een link zonder inlog naar precies dat ene lijstje dat " +
        "hij moet afwerken, en niets anders.\n\n" +
        "Dat is geen theorie: dezelfde codebase draait al onder drie merken (Pingwin, het Nationaal Oogcentrum " +
        "en een derde omgeving), waarbij het project zelf bepaalt welke naam, favicon en huisstijl je ziet.",
    },
  ],
};

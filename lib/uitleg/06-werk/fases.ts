import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De zeven fases per pagina",
    kern: "Eén vaste route, dus altijd duidelijk wat de volgende stap is.",
    tekst:
      "Elke pagina loopt langs zeven fases, in deze volgorde:\n\n" +
      "| Fase | Wat er gebeurt |\n" +
      "|---|---|\n" +
      "| Strategie | Doel, doelgroep, primair zoekwoord |\n" +
      "| Gelieerde pagina's | Welke pagina's hier omheen horen |\n" +
      "| Analyse | Wat de pagina nu doet, met bewijs |\n" +
      "| Blauwdruk | Hoe de pagina eruit moet gaan zien |\n" +
      "| Copy | De volledige tekst, getoetst aan de criteria |\n" +
      "| Implementatie | Het bouwen en live zetten |\n" +
      "| Structured data | Het schema-blok voor deze pagina |\n\n" +
      "Uit die stand volgt automatisch twee dingen: wat de volgende stap is, en wie er aan zet is (het " +
      "bureau of de developer). Dat wordt op één plek berekend, want eerder deden de kaart en de server dat " +
      "elk apart en dan zei de ene 'volgende: strategie' terwijl de knop ernaast een blauwdruk startte.\n\n" +
      "**Een chat is nog geen strategie.** Over elke pagina kun je vrij sparren; er wordt nooit stilzwijgend " +
      "iets tot strategie gebombardeerd. Pas de knop **\"Vat samen & leg strategie vast\"** maakt de conclusie " +
      "officieel: het hele gesprek wordt samengevat, die conclusie wordt de vastgelegde strategie die de " +
      "volgende fases (gelieerde pagina's, analyse, blauwdruk, copy) als basis meekrijgen, en er komt een net " +
      "Pingwin-document van in de Drive-map van de pagina, vastgelegd als werkzaamheid. Die ene knop staat op " +
      "beide plekken waar de chat staat: bij de pagina in Pagina's én op de projectkaart in de planning. " +
      "Zonder die klik draaien de volgende fases op de live data alleen, zonder de conclusies uit het " +
      "gesprek.\n\n" +
      "**Nieuwe strategie trekt oud, doorgegeven advies in.** Leg je de strategie opnieuw vast, dan verdwijnt " +
      "advies dat die pagina eerder via \"Gelieerde pagina's\" doorgaf automatisch overal. Meegegeven advies " +
      "staat bij de ontvanger zichtbaar boven de chat met een knop \"Negeer dit advies\"; het lopende gesprek " +
      "wint altijd van ouder advies.\n\n" +
      "**Alle documenten van een pagina komen in één Google Drive-map**, en die kies je bovenaan het " +
      "fase-blok: de knop staat naast \"Alles in één keer\", want daar worden ze ook gemaakt. Strategie, " +
      "analyse, blauwdruk en copy landen er alle vier in. Kies je niets, dan blijven de documenten in het " +
      "dashboard zelf staan en is er nog steeds een link.\n\n" +
      "Bij een nieuwe pagina bestaat die map nog niet, en dat is de normale situatie. Daarom maak je hem in " +
      "hetzelfde venster: het naamveld staat al ingevuld met een voorstel uit het pad van de pagina " +
      "(`/hovenier/oosterhout/` wordt \"Hovenier Oosterhout\"), en zodra de map er is sta je er meteen in, " +
      "zodat de knop onderin hem ook echt vastlegt. Dat laatste ging eerder mis: de map werd gemaakt, maar " +
      "niet gekozen, en de documenten landden een niveau hoger.\n\n" +
      "**De fases zeggen alleen wat af is, niet wat je moet doen.** Vroeger kreeg elke fase bij het " +
      "aanmaken van een kaart een standaardzin mee (\"tekst aanscherpen\", \"toets deze pagina op " +
      "overlap\"). Die herhaalde de naam van de fase, en werd nooit herschreven: op een kaart waar de copy " +
      "al goedgekeurd was stond nog steeds \"tekst aanscherpen\", pal naast een groen vinkje. Die zinnen " +
      "zijn uit beeld. Een uitleg-knopje verschijnt nu alleen nog bij sturing die echt over deze pagina " +
      "gaat en uit een gesprek of een mail komt.\n\n" +
      "Eén uitzondering zit erin: bestaat de pagina nog niet, dan wordt de analyse overgeslagen. Je kunt een " +
      "pagina die er niet is niet analyseren.\n\n" +
      "**Elk document landt automatisch als Word-bestand in de Drive-map van de klant**, zodra die map " +
      "gekozen is: de analyse, de blauwdruk en de copy worden na het genereren meteen geüpload en gedeeld, " +
      "met de deel-link erbij vastgelegd als werkzaamheid. Start je zo'n document zonder dat er al een map " +
      "gekozen is, dan gaat de knop \"Drive-map kiezen of maken\" even knipperen en klapt de mapkiezer meteen " +
      "open; het document wordt niet tegengehouden, maar zo wordt \"geen map gekozen\" een bewuste keuze in " +
      "plaats van iets dat erdoorheen glipt (en zonder gekozen map blijft het document intern in het " +
      "dashboard staan, met alsnog een link).\n\n" +
      "**De Implementatie-rij heeft nu ook \"Developer\" en \"Gedaan\" naast Mail.** \"Developer\" opent " +
      "hetzelfde doorzet-venster als de knop onderaan de kaart: daar kies je welke Drive-documenten meegaan " +
      "en wat de sitebouwer moet doen. \"Gedaan\" her-fetcht de live pagina en meet of de afgesproken " +
      "wijziging er echt staat (dezelfde meting als \"Is dit doorgevoerd?\" bovenaan de kaart); staat hij " +
      "er, dan vinkt Implementatie zichzelf af en kun je meteen door naar Structured data. Bij die meting " +
      "staat nu ook een klikbare link naar het document waarmee vergeleken is (meestal het copy-document), " +
      "zodat je nooit hoeft te gokken welke tekst als bron gold.\n\n" +
      "**Het copy-document gaat standaard mee, naar de developer én in de mail.** Zowel het doorzet-venster " +
      "als het mailvenster laten zien wat je kunt meesturen, en beide vinken het copy-document nu standaard " +
      "aan als het er is (naast de pagina zelf en een eventuele goedgekeurde klantversie); voorheen moest je " +
      "dat zelf aanvinken en werd dat vaak vergeten. Ook stond de copy soms helemaal niet in de lijst: had " +
      "een pagina meerdere losse klantversies (bijlagen uit oudere mails), dan waren de zes plekken al vol " +
      "vóórdat de copy aan de beurt kwam. De pijplijn-documenten (copy, blauwdruk, analyse) staan nu vooraan " +
      "in die lijst en zijn dus nooit meer het slachtoffer van de grens.",
  },
];
